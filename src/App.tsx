import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  Difficulty,
  DIFFICULTY_CONFIGS,
  GameState,
  HudSnapshot,
  MazeData,
  RecordsByDifficulty,
  ShadowQuality,
} from './types/game';
import {
  CELL_WORLD_SIZE,
  computeExploredPercentage,
  generateMaze,
  gridToWorld,
  revealAroundCell,
  worldToGrid,
} from './utils/mazeGenerator';
import {
  buildMazeWallsGroup,
  createExitPortalGroup,
  createFloorTileTexture,
  createRelicGroup,
} from './utils/lowPolyModels';
import {
  clearAllRecords,
  formatTimeMs,
  loadRecords,
  saveRunRecord,
} from './utils/recordsStorage';
import { soundEngine } from './utils/soundEngine';
import { Minimap } from './components/Minimap';
import { PauseOrVictoryModal, TitleScreen } from './components/GameModals';

// Pre-allocated math helpers at module scope (zero GC in render loop)
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _camEuler = new THREE.Euler(0, 0, 0, 'YXZ');

const PLAYER_RADIUS = 0.72;
const EYE_HEIGHT = 1.68;
const WALK_SPEED = 7.4;
const SPRINT_SPEED = 10.6;
const SHADOW_PREF_KEY = 'polylabyrinth_3d_shadow_quality_v1';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  const [gameState, setGameState] = useState<GameState>(GameState.TITLE);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [shadowQuality, setShadowQuality] = useState<ShadowQuality>(() => {
    try {
      const saved = localStorage.getItem(SHADOW_PREF_KEY);
      if (saved === ShadowQuality.LOW || saved === ShadowQuality.HIGH) {
        return saved;
      }
    } catch {
      // ignore
    }
    return ShadowQuality.HIGH;
  });
  const [records, setRecords] = useState<RecordsByDifficulty>(() => loadRecords());
  const [muted, setMuted] = useState<boolean>(false);
  const [minimapExpanded, setMinimapExpanded] = useState<boolean>(false);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [pointerLocked, setPointerLocked] = useState<boolean>(false);
  const [isNewBestTime, setIsNewBestTime] = useState<boolean>(false);
  const [isNewAllRelicsRecord, setIsNewAllRelicsRecord] = useState<boolean>(false);

  const [hud, setHud] = useState<HudSnapshot>({
    elapsedMs: 0,
    collectedCount: 0,
    totalCollectibles: DIFFICULTY_CONFIGS[Difficulty.MEDIUM].collectibleCount,
    exploredPercent: 0,
    wallBumps: 0,
    isExitUnlocked: true,
    nearExitHint: false,
    lastImpactIntensity: 0,
  });

  // Mutable simulation refs so Three.js loop never gets torn down by React state updates
  const gameStateRef = useRef<GameState>(GameState.TITLE);
  const difficultyRef = useRef<Difficulty>(Difficulty.MEDIUM);
  const shadowQualityRef = useRef<ShadowQuality>(shadowQuality);
  const mazeRef = useRef<MazeData | null>(null);
  const playerPosRef = useRef<{ x: number; z: number; yaw: number; pitch: number }>({
    x: 0,
    z: 0,
    yaw: 0,
    pitch: 0,
  });
  const rebuildMazeTriggerRef = useRef<((diff: Difficulty, startPlay: boolean) => void) | null>(
    null
  );
  const applyShadowQualityTriggerRef = useRef<((quality: ShadowQuality) => void) | null>(null);
  const requestPointerLockRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    difficultyRef.current = difficulty;
  }, [difficulty]);

  const handleToggleMute = () => {
    soundEngine.muted = !soundEngine.muted;
    setMuted(soundEngine.muted);
  };

  const handleSelectShadowQuality = (quality: ShadowQuality) => {
    setShadowQuality(quality);
    shadowQualityRef.current = quality;
    try {
      localStorage.setItem(SHADOW_PREF_KEY, quality);
    } catch {
      // ignore
    }
    if (applyShadowQualityTriggerRef.current) {
      applyShadowQualityTriggerRef.current(quality);
    }
  };

  const handleStartGame = () => {
    setIsNewBestTime(false);
    setIsNewAllRelicsRecord(false);
    if (rebuildMazeTriggerRef.current) {
      rebuildMazeTriggerRef.current(difficultyRef.current, true);
    }
    setGameState(GameState.PLAYING);
    if (requestPointerLockRef.current) {
      requestPointerLockRef.current();
    }
  };

  const handleSelectDifficulty = (newDiff: Difficulty) => {
    setDifficulty(newDiff);
    difficultyRef.current = newDiff;
    if (rebuildMazeTriggerRef.current) {
      const shouldKeepPlaying = gameStateRef.current === GameState.PLAYING;
      rebuildMazeTriggerRef.current(newDiff, shouldKeepPlaying);
    }
  };

  const handleRestartMaze = () => {
    setIsNewBestTime(false);
    setIsNewAllRelicsRecord(false);
    if (rebuildMazeTriggerRef.current) {
      rebuildMazeTriggerRef.current(difficultyRef.current, true);
    }
    setGameState(GameState.PLAYING);
    if (requestPointerLockRef.current) {
      requestPointerLockRef.current();
    }
  };

  const handleResumeGame = () => {
    setGameState(GameState.PLAYING);
    if (requestPointerLockRef.current) {
      requestPointerLockRef.current();
    }
  };

  const handleReturnToTitle = () => {
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
    setGameState(GameState.TITLE);
  };

  const handleClearRecords = () => {
    setRecords(clearAllRecords());
  };

  // Initialize Three.js WebGL scene once inside canvasMountRef
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Software WebGL detection per Three.js skill
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type =
      shadowQualityRef.current === ShadowQuality.HIGH
        ? THREE.PCFSoftShadowMap
        : THREE.BasicShadowMap;
    renderer.setSize(window.innerWidth, window.innerHeight);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const sceneFog = new THREE.FogExp2(0x0f172a, 0.032);
    scene.fog = sceneFog;

    // Procedural vertical gradient texture for scene.background that shifts hue over time in the labyrinth
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 2;
    skyCanvas.height = 256;
    const skyCtx = skyCanvas.getContext('2d')!;
    const skyGradientTexture = new THREE.CanvasTexture(skyCanvas);
    skyGradientTexture.colorSpace = THREE.SRGBColorSpace;
    skyGradientTexture.minFilter = THREE.LinearFilter;
    skyGradientTexture.magFilter = THREE.LinearFilter;

    const topColor = new THREE.Color();
    const midColor = new THREE.Color();
    const horizonColor = new THREE.Color();
    const bottomColor = new THREE.Color();
    const whiteColor = new THREE.Color(0xffffff);

    const updateProceduralSkyGradient = (timeSpentSec: number) => {
      // Smoothly cycle atmospheric hue through twilight blue -> mystic indigo -> violet -> warm dusk -> deep teal
      const cycle = (timeSpentSec / 140) % 1;
      const baseHue = (0.61 + Math.sin(cycle * Math.PI * 2) * 0.14 + cycle * 0.35) % 1;
      const horizonHue = (baseHue + 0.06 + Math.sin(timeSpentSec * 0.04) * 0.03) % 1;

      topColor.setHSL(baseHue, 0.58, 0.06);
      midColor.setHSL((baseHue + 0.03) % 1, 0.52, 0.12);
      horizonColor.setHSL(horizonHue, 0.48, 0.21);
      bottomColor.setHSL(baseHue, 0.45, 0.08);

      const grad = skyCtx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0.0, `#${topColor.getHexString()}`);
      grad.addColorStop(0.42, `#${midColor.getHexString()}`);
      grad.addColorStop(0.68, `#${horizonColor.getHexString()}`);
      grad.addColorStop(1.0, `#${bottomColor.getHexString()}`);

      skyCtx.fillStyle = grad;
      skyCtx.fillRect(0, 0, 2, 256);
      skyGradientTexture.needsUpdate = true;

      // Sync horizon fog color with the gradient's horizon band so distant walls blend seamlessly
      sceneFog.color.copy(midColor).lerp(horizonColor, 0.55);
    };

    updateProceduralSkyGradient(0);
    scene.background = skyGradientTexture;

    // Studio RoomEnvironment reflection map
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      72,
      window.innerWidth / window.innerHeight,
      0.1,
      140
    );

    // Balanced 3-Point / Warm-Cool Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.85);
    hemiLight.position.set(0, 40, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfffbeb, 1.45);
    dirLight.position.set(22, 38, 18);
    dirLight.castShadow = !isSoftwareGl;
    const initMapSize = shadowQualityRef.current === ShadowQuality.HIGH ? 2048 : 512;
    dirLight.shadow.mapSize.width = initMapSize;
    dirLight.shadow.mapSize.height = initMapSize;
    const d = 48;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 110;
    dirLight.shadow.bias = -0.0005;
    dirLight.shadow.normalBias = 0.02;
    scene.add(dirLight);

    // Runtime Shadow Quality Switcher (updates shadowMap type, resolution, and pixelRatio)
    const applyShadowQuality = (quality: ShadowQuality) => {
      if (isSoftwareGl) return;

      const isHigh = quality === ShadowQuality.HIGH;
      renderer.shadowMap.type = isHigh ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
      renderer.setPixelRatio(
        isHigh
          ? Math.min(window.devicePixelRatio, 2)
          : Math.min(window.devicePixelRatio, 1.25)
      );

      const targetMapSize = isHigh ? 2048 : 512;
      if (dirLight.shadow.mapSize.width !== targetMapSize) {
        dirLight.shadow.mapSize.set(targetMapSize, targetMapSize);
        if (dirLight.shadow.map) {
          dirLight.shadow.map.dispose();
          dirLight.shadow.map = null;
        }
      }
      renderer.shadowMap.needsUpdate = true;

      // Mark standard materials for shader update when switching between BasicShadowMap & PCFSoftShadowMap
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => {
              m.needsUpdate = true;
            });
          } else if (mesh.material) {
            mesh.material.needsUpdate = true;
          }
        }
      });
    };
    applyShadowQualityTriggerRef.current = applyShadowQuality;
    applyShadowQuality(shadowQualityRef.current);

    // Warm torch / player aura light so corridors feel atmospheric
    const playerLight = new THREE.PointLight(0x38bdf8, 1.6, 14, 1.8);
    scene.add(playerLight);

    // Floor plane with procedural tile texture
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const floorTex = createFloorTileTexture(maxAniso);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.8,
      metalness: 0.1,
    });
    const floorGeo = new THREE.PlaneGeometry(200, 200);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Dynamic world containers
    let worldGroup = new THREE.Group();
    scene.add(worldGroup);

    let relicMeshes: THREE.Group[] = [];
    let exitPortalGroup: THREE.Group | null = null;
    let exitLight: THREE.PointLight | null = null;

    // Pooled particle burst system for item pickups and wall collision sparks
    const PARTICLE_COUNT = 36;
    const particleGeo = new THREE.OctahedronGeometry(0.11, 0);
    const particleMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    const particleInstanced = new THREE.InstancedMesh(
      particleGeo,
      particleMat,
      PARTICLE_COUNT
    );
    particleInstanced.frustumCulled = false;
    scene.add(particleInstanced);

    interface ParticleState {
      active: boolean;
      pos: THREE.Vector3;
      vel: THREE.Vector3;
      life: number;
      maxLife: number;
      scale: number;
    }
    const particles: ParticleState[] = Array.from({ length: PARTICLE_COUNT }, () => ({
      active: false,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      life: 0,
      maxLife: 0.5,
      scale: 1,
    }));
    const particleDummy = new THREE.Object3D();

    const spawnParticles = (
      wx: number,
      wy: number,
      wz: number,
      colorHex: number,
      count: number,
      speedScale: number
    ) => {
      particleMat.color.setHex(colorHex);
      let spawned = 0;
      for (const p of particles) {
        if (!p.active && spawned < count) {
          p.active = true;
          p.pos.set(wx, wy, wz);
          const angle = Math.random() * Math.PI * 2;
          const up = (Math.random() - 0.2) * speedScale;
          const radial = (0.4 + Math.random() * 0.8) * speedScale;
          p.vel.set(Math.cos(angle) * radial, up, Math.sin(angle) * radial);
          p.life = 0;
          p.maxLife = 0.32 + Math.random() * 0.25;
          p.scale = 0.7 + Math.random() * 0.6;
          spawned++;
        }
      }
    };

    // Rare Ghostly Low-Poly Apparition in the Fog of War (Composite 6-part THREE.Group)
    const ghostPrimaryMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.85,
      roughness: 0.25,
      metalness: 0.1,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      flatShading: true,
    });
    const ghostAccentMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.1,
      roughness: 0.15,
      metalness: 0.3,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      flatShading: true,
    });

    const ghostGroup = new THREE.Group();
    ghostGroup.visible = false;

    // 1. Primary silhouette: Low-poly tapered cloak mantle
    const cloakGeo = new THREE.ConeGeometry(0.52, 1.45, 6, 1, true);
    cloakGeo.translate(0, 0.95, 0);
    const cloakMesh = new THREE.Mesh(cloakGeo, ghostPrimaryMat);
    ghostGroup.add(cloakMesh);

    // 2. Secondary read: Faceted shoulder guard
    const shoulderGeo = new THREE.OctahedronGeometry(0.42, 0);
    shoulderGeo.scale(1.25, 0.55, 0.85);
    const shoulderMesh = new THREE.Mesh(shoulderGeo, ghostPrimaryMat);
    shoulderMesh.position.set(0, 1.55, 0);
    ghostGroup.add(shoulderMesh);

    // 3. Secondary read: Floating polyhedral head
    const headGeo = new THREE.IcosahedronGeometry(0.24, 0);
    const headMesh = new THREE.Mesh(headGeo, ghostAccentMat);
    headMesh.position.set(0, 1.98, 0);
    headMesh.name = 'ghostHead';
    ghostGroup.add(headMesh);

    // 4. Accent detail: Floating geometric halo ring above head
    const haloGeo = new THREE.TorusGeometry(0.32, 0.025, 5, 7);
    haloGeo.rotateX(Math.PI / 2);
    const haloMesh = new THREE.Mesh(haloGeo, ghostAccentMat);
    haloMesh.position.set(0, 2.34, 0);
    haloMesh.name = 'ghostHalo';
    ghostGroup.add(haloMesh);

    // 5 & 6. Accent details: Left & Right floating lantern shards
    const shardGeo = new THREE.OctahedronGeometry(0.11, 0);
    shardGeo.scale(1, 1.7, 1);
    const leftShard = new THREE.Mesh(shardGeo, ghostAccentMat);
    leftShard.position.set(-0.58, 1.35, 0.15);
    leftShard.name = 'ghostShardL';
    ghostGroup.add(leftShard);

    const rightShard = new THREE.Mesh(shardGeo, ghostAccentMat);
    rightShard.position.set(0.58, 1.35, 0.15);
    rightShard.name = 'ghostShardR';
    ghostGroup.add(rightShard);

    const ghostLight = new THREE.PointLight(0x38bdf8, 0, 9, 2);
    ghostLight.position.set(0, 1.6, 0);
    ghostGroup.add(ghostLight);

    scene.add(ghostGroup);

    const ghostState = {
      active: false,
      vanishing: false,
      wx: 0,
      wz: 0,
      life: 0,
      maxLife: 7.5,
      opacity: 0,
      cooldown: 5.5, // Seconds until next apparition check
    };

    // Simulation state variables
    let elapsedMs = 0;
    let wallBumps = 0;
    let lastWallBumpSoundTime = 0;
    let hitstopTimer = 0;
    let shakeIntensity = 0;
    let shakeRoll = 0;
    let impactFlash = 0;
    let stepCycle = 0;
    let lastStepIndex = 0;
    let playerVelX = 0;
    let playerVelZ = 0;
    let titleOrbitAngle = 0;

    // Build / rebuild maze level
    const buildLevel = (diff: Difficulty, startPlay: boolean) => {
      const cfg = DIFFICULTY_CONFIGS[diff];
      const newMaze = generateMaze(cfg.gridSize, cfg.collectibleCount);
      mazeRef.current = newMaze;

      // Reset ghost apparition state on level rebuild
      ghostState.active = false;
      ghostState.vanishing = false;
      ghostState.opacity = 0;
      ghostState.cooldown = 4.5 + Math.random() * 4.0;
      ghostGroup.visible = false;

      // Clean up old world group
      scene.remove(worldGroup);
      worldGroup.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry?.dispose();
          if (Array.isArray(m.material)) {
            m.material.forEach((mat) => mat.dispose());
          } else {
            m.material?.dispose();
          }
        }
      });

      worldGroup = new THREE.Group();
      scene.add(worldGroup);

      // Update floor repeat
      const worldSpan = newMaze.size * CELL_WORLD_SIZE;
      floorTex.repeat.set(newMaze.size * 5, newMaze.size * 5);

      // 1. Add instanced 3-part low-poly walls
      const wallsGroup = buildMazeWallsGroup(newMaze.grid, cfg.wallColorHex);
      worldGroup.add(wallsGroup);

      // 2. Add Collectible Relics
      relicMeshes = [];
      for (const item of newMaze.collectibles) {
        const relic = createRelicGroup(cfg.accentColorHex);
        relic.position.set(item.worldX, 0, item.worldZ);
        worldGroup.add(relic);
        relicMeshes.push(relic);
      }

      // 3. Add Exit Portal Shrine
      const exitWorld = gridToWorld(newMaze.exitCell.x, newMaze.exitCell.z, newMaze.size);
      exitPortalGroup = createExitPortalGroup();
      exitPortalGroup.position.set(exitWorld.x, 0, exitWorld.z);
      worldGroup.add(exitPortalGroup);

      exitLight = new THREE.PointLight(0x10b981, 2.5, 16, 1.6);
      exitLight.position.set(exitWorld.x, 2.4, exitWorld.z);
      worldGroup.add(exitLight);

      // Set player starting coordinates and face toward open adjacent corridor
      const startWorld = gridToWorld(
        newMaze.startCell.x,
        newMaze.startCell.z,
        newMaze.size
      );
      let initialYaw = 0;
      const sx = newMaze.startCell.x;
      const sz = newMaze.startCell.z;
      if (newMaze.grid[sz]?.[sx + 1] === 0) {
        initialYaw = -Math.PI / 2; // +X
      } else if (newMaze.grid[sz + 1]?.[sx] === 0) {
        initialYaw = Math.PI; // +Z
      }

      playerPosRef.current = {
        x: startWorld.x,
        z: startWorld.z,
        yaw: initialYaw,
        pitch: 0,
      };

      playerVelX = 0;
      playerVelZ = 0;
      elapsedMs = 0;
      wallBumps = 0;
      shakeIntensity = 0;
      impactFlash = 0;

      // Update shadow bounds for maze size
      const halfSpan = worldSpan * 0.6;
      dirLight.shadow.camera.left = -halfSpan;
      dirLight.shadow.camera.right = halfSpan;
      dirLight.shadow.camera.top = halfSpan;
      dirLight.shadow.camera.bottom = -halfSpan;
      dirLight.shadow.camera.updateProjectionMatrix();

      if (!isSoftwareGl) {
        renderer.compile(scene, camera);
      }

      setHud({
        elapsedMs: 0,
        collectedCount: 0,
        totalCollectibles: newMaze.collectibles.length,
        exploredPercent: computeExploredPercentage(newMaze),
        wallBumps: 0,
        isExitUnlocked: true,
        nearExitHint: false,
        lastImpactIntensity: 0,
      });

      if (startPlay) {
        gameStateRef.current = GameState.PLAYING;
      }
    };

    rebuildMazeTriggerRef.current = buildLevel;
    buildLevel(difficultyRef.current, false);

    // Input Handling: Separate continuous held keys from edge-triggered actions
    const heldKeys = new Set<string>();
    let isDraggingLook = false;
    let lastPointerX = 0;
    let lastPointerY = 0;

    const requestLock = () => {
      try {
        renderer.domElement.requestPointerLock?.();
      } catch {
        // Fallback to drag look if pointer lock is restricted
      }
    };
    requestPointerLockRef.current = requestLock;

    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === renderer.domElement;
      setPointerLocked(locked);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (gameStateRef.current !== GameState.PLAYING) return;
      const sensitivity = 0.0023;

      if (document.pointerLockElement === renderer.domElement) {
        playerPosRef.current.yaw -= e.movementX * sensitivity;
        playerPosRef.current.pitch = Math.max(
          -Math.PI * 0.42,
          Math.min(Math.PI * 0.42, playerPosRef.current.pitch - e.movementY * sensitivity)
        );
      } else if (isDraggingLook) {
        const dx = e.clientX - lastPointerX;
        const dy = e.clientY - lastPointerY;
        lastPointerX = e.clientX;
        lastPointerY = e.clientY;
        playerPosRef.current.yaw -= dx * sensitivity * 1.3;
        playerPosRef.current.pitch = Math.max(
          -Math.PI * 0.42,
          Math.min(Math.PI * 0.42, playerPosRef.current.pitch - dy * sensitivity * 1.3)
        );
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (gameStateRef.current !== GameState.PLAYING) return;
      if (document.pointerLockElement !== renderer.domElement) {
        requestLock();
      }
      isDraggingLook = true;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
    };

    const onMouseUp = () => {
      isDraggingLook = false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      heldKeys.add(e.code);

      if (gameStateRef.current === GameState.TITLE) {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          handleStartGame();
        }
        return;
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (gameStateRef.current === GameState.PLAYING) {
          if (document.pointerLockElement) {
            document.exitPointerLock?.();
          }
          setGameState(GameState.PAUSED);
        } else if (gameStateRef.current === GameState.PAUSED) {
          setGameState(GameState.PLAYING);
          requestLock();
        }
      } else if (e.code === 'KeyM' || e.code === 'Tab') {
        if (gameStateRef.current === GameState.PLAYING) {
          e.preventDefault();
          setMinimapExpanded((prev) => !prev);
        }
      } else if (e.code === 'KeyH') {
        setDockCollapsed((prev) => !prev);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      heldKeys.delete(e.code);
    };

    const onWindowBlur = () => {
      heldKeys.clear();
      isDraggingLook = false;
    };

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    document.addEventListener('pointerlockchange', onPointerLockChange);
    window.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('resize', onResize);

    // Circle vs Grid Wall AABB collision solver with crisp tactile feedback
    const resolveMazeCollisions = (
      nextX: number,
      nextZ: number,
      vx: number,
      vz: number,
      maze: MazeData
    ): {
      x: number;
      z: number;
      vx: number;
      vz: number;
      hitMaxPenetration: number;
      hitNormalX: number;
      hitNormalZ: number;
    } => {
      let rx = nextX;
      let rz = nextZ;
      let rvx = vx;
      let rvz = vz;
      let hitMaxPenetration = 0;
      let hitNormalX = 0;
      let hitNormalZ = 0;

      const halfWorld = (maze.size * CELL_WORLD_SIZE) / 2;
      const cellCoords = worldToGrid(rx, rz, maze.size);
      const halfCell = CELL_WORLD_SIZE / 2;

      for (let gz = cellCoords.z - 1; gz <= cellCoords.z + 1; gz++) {
        for (let gx = cellCoords.x - 1; gx <= cellCoords.x + 1; gx++) {
          const isWall =
            gz < 0 ||
            gz >= maze.size ||
            gx < 0 ||
            gx >= maze.size ||
            maze.grid[gz][gx] === 1;

          if (!isWall) continue;

          const wallCenterX = gx * CELL_WORLD_SIZE - halfWorld + halfCell;
          const wallCenterZ = gz * CELL_WORLD_SIZE - halfWorld + halfCell;

          const minX = wallCenterX - halfCell;
          const maxX = wallCenterX + halfCell;
          const minZ = wallCenterZ - halfCell;
          const maxZ = wallCenterZ + halfCell;

          const closestX = Math.max(minX, Math.min(rx, maxX));
          const closestZ = Math.max(minZ, Math.min(rz, maxZ));

          const dx = rx - closestX;
          const dz = rz - closestZ;
          const distSq = dx * dx + dz * dz;

          if (distSq < PLAYER_RADIUS * PLAYER_RADIUS) {
            const dist = Math.sqrt(distSq);
            let nx = 0;
            let nz = 0;
            let penetration = 0;

            if (dist > 0.0001) {
              nx = dx / dist;
              nz = dz / dist;
              penetration = PLAYER_RADIUS - dist;
            } else {
              // Fallback if center is exactly on edge
              nx = 1;
              nz = 0;
              penetration = PLAYER_RADIUS;
            }

            rx += nx * penetration;
            rz += nz * penetration;

            // Project velocity along wall tangent + slight bouncy recoil when hitting head-on
            const vn = rvx * nx + rvz * nz;
            if (vn < 0) {
              const impactSpeed = -vn;
              // Crisp knockback impulse so hitting a wall feels physical and solid
              const restitution = impactSpeed > 3.2 ? 0.28 : 0.0;
              rvx -= (1 + restitution) * vn * nx;
              rvz -= (1 + restitution) * vn * nz;

              if (impactSpeed > hitMaxPenetration) {
                hitMaxPenetration = impactSpeed;
                hitNormalX = nx;
                hitNormalZ = nz;
              }
            }
          }
        }
      }

      return {
        x: rx,
        z: rz,
        vx: rvx,
        vz: rvz,
        hitMaxPenetration,
        hitNormalX,
        hitNormalZ,
      };
    };

    // Main 60fps simulation and rendering loop (with software WebGL fence pacing)
    let frameId = 0;
    let lastTime = performance.now();
    let lastHudSyncTime = 0;
    let lastSkyUpdateTime = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      const now = performance.now();
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05);
      const maze = mazeRef.current;

      if (maze) {
        // Animate collectible relics and exit portal in all states
        const timeSec = now * 0.001;

        // Smoothly update procedural sky gradient based on time spent in the labyrinth (throttled ~10fps)
        if (now - lastSkyUpdateTime > 100) {
          lastSkyUpdateTime = now;
          const labyrinthTimeSec =
            gameStateRef.current === GameState.TITLE ? timeSec * 0.6 : elapsedMs * 0.001;
          updateProceduralSkyGradient(labyrinthTimeSec);
          hemiLight.color.copy(horizonColor).lerp(whiteColor, 0.35);
        }

        for (let i = 0; i < maze.collectibles.length; i++) {
          const item = maze.collectibles[i];
          const meshGroup = relicMeshes[i];
          if (!meshGroup) continue;

          if (!item.collected) {
            const core = meshGroup.getObjectByName('floatingCore');
            if (core) {
              core.position.y = 1.2 + Math.sin(timeSec * 3.0 + item.phaseOffset) * 0.18;
              core.rotation.y = timeSec * 1.6 + item.phaseOffset;
              const ringA = core.getObjectByName('ringA');
              const ringB = core.getObjectByName('ringB');
              if (ringA) ringA.rotation.z = timeSec * 2.4;
              if (ringB) ringB.rotation.x = -timeSec * 2.1;
            }
          } else if (item.collectAnimProgress < 1) {
            // Squash-and-stretch pop-up collection animation
            item.collectAnimProgress = Math.min(1, item.collectAnimProgress + dt * 3.8);
            const t = item.collectAnimProgress;
            const s = t < 0.3 ? 1 + t * 1.4 : Math.max(0, 1.42 * (1 - (t - 0.3) / 0.7));
            meshGroup.scale.set(s, s * 1.25, s);
            meshGroup.position.y = t * 1.6;
            meshGroup.rotation.y += dt * 12;
            if (t >= 1) {
              meshGroup.visible = false;
            }
          }
        }

        // Animate Exit Portal Shrine
        if (exitPortalGroup) {
          const ring = exitPortalGroup.getObjectByName('portalRing');
          const core = exitPortalGroup.getObjectByName('portalCore');
          const beacon = exitPortalGroup.getObjectByName('portalBeacon');
          if (ring) ring.rotation.z = timeSec * 2.2;
          if (core) {
            core.rotation.y = -timeSec * 3.0;
            core.rotation.x = timeSec * 1.5;
            const pulse = 1 + Math.sin(timeSec * 4.5) * 0.12;
            core.scale.setScalar(pulse);
          }
          if (beacon) {
            beacon.position.y = 3.45 + Math.sin(timeSec * 3.2) * 0.22;
            beacon.rotation.y = timeSec * 2.5;
          }
        }

        // Update pooled particles
        let anyParticlesUpdated = false;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const p = particles[i];
          if (p.active) {
            p.life += dt;
            if (p.life >= p.maxLife) {
              p.active = false;
              particleDummy.scale.setScalar(0);
              particleDummy.updateMatrix();
              particleInstanced.setMatrixAt(i, particleDummy.matrix);
              anyParticlesUpdated = true;
            } else {
              p.pos.addScaledVector(p.vel, dt);
              p.vel.y -= 9.8 * dt;
              const ratio = 1 - p.life / p.maxLife;
              particleDummy.position.copy(p.pos);
              particleDummy.rotation.set(p.life * 8, p.life * 6, 0);
              particleDummy.scale.setScalar(p.scale * ratio);
              particleDummy.updateMatrix();
              particleInstanced.setMatrixAt(i, particleDummy.matrix);
              anyParticlesUpdated = true;
            }
          } else {
            particleDummy.scale.setScalar(0);
            particleDummy.updateMatrix();
            particleInstanced.setMatrixAt(i, particleDummy.matrix);
          }
        }
        if (anyParticlesUpdated) {
          particleInstanced.instanceMatrix.needsUpdate = true;
        }

        // State-specific camera & player simulation
        if (gameStateRef.current === GameState.TITLE) {
          // Live atmospheric aerial pan over the 3D low-poly labyrinth
          titleOrbitAngle += dt * 0.18;
          const orbitRadius = maze.size * CELL_WORLD_SIZE * 0.36;
          camera.position.set(
            Math.cos(titleOrbitAngle) * orbitRadius,
            maze.size * 1.15 + 10,
            Math.sin(titleOrbitAngle) * orbitRadius
          );
          camera.lookAt(0, 1.5, 0);
          playerLight.position.set(camera.position.x, 6, camera.position.z);
        } else if (gameStateRef.current === GameState.PLAYING) {
          elapsedMs += dt * 1000;

          // Rare Ghostly Silhouette Apparition in Fog-of-War Corridors
          if (!ghostState.active) {
            ghostState.cooldown -= dt;
            if (ghostState.cooldown <= 0) {
              const pCell = worldToGrid(
                playerPosRef.current.x,
                playerPosRef.current.z,
                maze.size
              );
              const yaw = playerPosRef.current.yaw;
              const fwdX = -Math.sin(yaw);
              const fwdZ = -Math.cos(yaw);

              const candidates: Array<{ gx: number; gz: number; score: number }> = [];
              for (let gz = 1; gz < maze.size - 1; gz++) {
                for (let gx = 1; gx < maze.size - 1; gx++) {
                  if (maze.grid[gz][gx] !== 0) continue;
                  const distCells = Math.hypot(gx - pCell.x, gz - pCell.z);
                  // Prefer cells at twilight fog edge (3 to 7 cells away)
                  if (distCells >= 3.0 && distCells <= 7.2) {
                    const worldCandidate = gridToWorld(gx, gz, maze.size);
                    const toX = worldCandidate.x - playerPosRef.current.x;
                    const toZ = worldCandidate.z - playerPosRef.current.z;
                    const len = Math.hypot(toX, toZ) || 1;
                    const dot = (toX / len) * fwdX + (toZ / len) * fwdZ;
                    // Spawn mostly ahead of player's gaze and preferentially in unrevealed fog
                    if (dot > 0.25) {
                      const fogBonus = !maze.revealed[gz][gx] ? 2.0 : 1.0;
                      candidates.push({ gx, gz, score: dot * fogBonus });
                    }
                  }
                }
              }

              if (candidates.length > 0) {
                candidates.sort((a, b) => b.score - a.score);
                const pick =
                  candidates[Math.floor(Math.random() * Math.min(4, candidates.length))];
                const wPos = gridToWorld(pick.gx, pick.gz, maze.size);
                ghostState.active = true;
                ghostState.vanishing = false;
                ghostState.wx = wPos.x;
                ghostState.wz = wPos.z;
                ghostState.life = 0;
                ghostState.maxLife = 5.5 + Math.random() * 3.5;
                ghostState.opacity = 0.01;
                ghostGroup.position.set(wPos.x, 0, wPos.z);
                ghostGroup.scale.set(1, 1, 1);
                ghostGroup.visible = true;
              } else {
                ghostState.cooldown = 3.0;
              }
            }
          } else {
            ghostState.life += dt;
            const distToPlayer = Math.hypot(
              playerPosRef.current.x - ghostState.wx,
              playerPosRef.current.z - ghostState.wz
            );

            // Dissolve rapidly if player approaches within 7.5 meters or lifetime expires
            if (
              !ghostState.vanishing &&
              (distToPlayer < 7.5 || ghostState.life >= ghostState.maxLife)
            ) {
              ghostState.vanishing = true;
              if (distToPlayer < 7.5) {
                soundEngine.playGhostVanish();
                spawnParticles(ghostState.wx, 1.4, ghostState.wz, 0x38bdf8, 14, 3.8);
              }
            }

            if (ghostState.vanishing) {
              ghostState.opacity = THREE.MathUtils.damp(ghostState.opacity, 0, 7.5, dt);
              // Stretch upward and narrow as it evaporates into the mist
              ghostGroup.scale.x = THREE.MathUtils.damp(ghostGroup.scale.x, 0.15, 6, dt);
              ghostGroup.scale.z = THREE.MathUtils.damp(ghostGroup.scale.z, 0.15, 6, dt);
              ghostGroup.scale.y = THREE.MathUtils.damp(ghostGroup.scale.y, 1.65, 5, dt);
              ghostGroup.position.y += dt * 1.4;

              if (ghostState.opacity < 0.02) {
                ghostState.active = false;
                ghostGroup.visible = false;
                ghostState.cooldown = 9.0 + Math.random() * 7.0;
              }
            } else {
              // Ethereal fade-in and subtle hover in the fog
              const targetOp = 0.42 + Math.sin(timeSec * 4.2) * 0.08;
              ghostState.opacity = THREE.MathUtils.damp(
                ghostState.opacity,
                targetOp,
                3.5,
                dt
              );
              ghostGroup.position.y = Math.sin(timeSec * 2.4) * 0.16;
            }

            // Face toward the player and animate floating sub-parts
            ghostGroup.lookAt(
              playerPosRef.current.x,
              ghostGroup.position.y + 1.2,
              playerPosRef.current.z
            );
            const gHalo = ghostGroup.getObjectByName('ghostHalo');
            const gHead = ghostGroup.getObjectByName('ghostHead');
            const gShardL = ghostGroup.getObjectByName('ghostShardL');
            const gShardR = ghostGroup.getObjectByName('ghostShardR');
            if (gHalo) gHalo.rotation.z = timeSec * 2.5;
            if (gHead) gHead.rotation.y = Math.sin(timeSec * 1.8) * 0.35;
            if (gShardL) gShardL.position.y = 1.35 + Math.sin(timeSec * 3.6) * 0.12;
            if (gShardR) gShardR.position.y = 1.35 + Math.cos(timeSec * 3.6) * 0.12;

            ghostPrimaryMat.opacity = ghostState.opacity;
            ghostAccentMat.opacity = Math.min(1, ghostState.opacity * 1.35);
            ghostLight.intensity = ghostState.opacity * 2.2;
          }

          // Keyboard rotation fallback (Q/E or Left/Right arrows)
          const turnSpeed = 2.1;
          if (heldKeys.has('KeyQ')) playerPosRef.current.yaw += turnSpeed * dt;
          if (heldKeys.has('KeyE')) playerPosRef.current.yaw -= turnSpeed * dt;

          // Hitstop brief freeze on heavy wall impact (35ms)
          if (hitstopTimer > 0) {
            hitstopTimer = Math.max(0, hitstopTimer - dt);
          } else {
            // Calculate input movement vector
            let moveZ = 0;
            let moveX = 0;
            if (heldKeys.has('KeyW') || heldKeys.has('ArrowUp')) moveZ += 1;
            if (heldKeys.has('KeyS') || heldKeys.has('ArrowDown')) moveZ -= 1;
            if (heldKeys.has('KeyD') || heldKeys.has('ArrowRight')) moveX += 1;
            if (heldKeys.has('KeyA') || heldKeys.has('ArrowLeft')) moveX -= 1;

            const isSprinting = heldKeys.has('ShiftLeft') || heldKeys.has('ShiftRight');
            const targetSpeed = isSprinting ? SPRINT_SPEED : WALK_SPEED;

            const yaw = playerPosRef.current.yaw;
            _forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
            _right.set(Math.cos(yaw), 0, -Math.sin(yaw));

            _moveDir.set(0, 0, 0);
            _moveDir.addScaledVector(_forward, moveZ);
            _moveDir.addScaledVector(_right, moveX);
            if (_moveDir.lengthSq() > 1) _moveDir.normalize();

            const targetVx = _moveDir.x * targetSpeed;
            const targetVz = _moveDir.z * targetSpeed;

            // Smooth exponential velocity damping
            playerVelX = THREE.MathUtils.damp(playerVelX, targetVx, 14, dt);
            playerVelZ = THREE.MathUtils.damp(playerVelZ, targetVz, 14, dt);

            const candidateX = playerPosRef.current.x + playerVelX * dt;
            const candidateZ = playerPosRef.current.z + playerVelZ * dt;

            // Solve wall collisions
            const col = resolveMazeCollisions(
              candidateX,
              candidateZ,
              playerVelX,
              playerVelZ,
              maze
            );

            playerPosRef.current.x = col.x;
            playerPosRef.current.z = col.z;
            playerVelX = col.vx;
            playerVelZ = col.vz;

            // Trigger tangible wall collision feedback if impact velocity is significant
            if (col.hitMaxPenetration > 2.4 && now - lastWallBumpSoundTime > 210) {
              lastWallBumpSoundTime = now;
              wallBumps++;
              const normImpact = Math.min(1, col.hitMaxPenetration / SPRINT_SPEED);
              shakeIntensity = Math.min(0.45, 0.16 + normImpact * 0.28);
              shakeRoll = (Math.random() > 0.5 ? 1 : -1) * 0.045 * normImpact;
              impactFlash = Math.min(0.85, 0.35 + normImpact * 0.5);
              if (normImpact > 0.65) {
                hitstopTimer = 0.038; // 38ms tactile hitstop on heavy sprint collision
              }
              soundEngine.playWallThud(normImpact);
              spawnParticles(
                col.x - col.hitNormalX * 0.45,
                1.35,
                col.z - col.hitNormalZ * 0.45,
                0x38bdf8,
                10,
                4.2
              );
            }

            // Headbob and footstep synthesis while moving
            const groundSpeed = Math.hypot(playerVelX, playerVelZ);
            if (groundSpeed > 0.8) {
              stepCycle += groundSpeed * dt * 1.55;
              const currentStepIdx = Math.floor(stepCycle / Math.PI);
              if (currentStepIdx > lastStepIndex) {
                lastStepIndex = currentStepIdx;
                soundEngine.playFootstep(currentStepIdx);
              }
            }
          }

          // Decay camera shake and impact vignette
          shakeIntensity = THREE.MathUtils.damp(shakeIntensity, 0, 12, dt);
          shakeRoll = THREE.MathUtils.damp(shakeRoll, 0, 10, dt);
          impactFlash = THREE.MathUtils.damp(impactFlash, 0, 7, dt);

          // Reveal fog-of-war cells around current grid position
          const currentCell = worldToGrid(
            playerPosRef.current.x,
            playerPosRef.current.z,
            maze.size
          );
          revealAroundCell(maze.revealed, maze.grid, currentCell.x, currentCell.z);

          // Check Collectible pickups
          let newlyCollected = false;
          for (let i = 0; i < maze.collectibles.length; i++) {
            const item = maze.collectibles[i];
            if (item.collected) continue;
            const distToItem = Math.hypot(
              playerPosRef.current.x - item.worldX,
              playerPosRef.current.z - item.worldZ
            );
            if (distToItem < 1.35) {
              item.collected = true;
              item.collectAnimProgress = 0.01;
              newlyCollected = true;
              const countNow = maze.collectibles.filter((c) => c.collected).length;
              soundEngine.playCollect(countNow, maze.collectibles.length);
              if (countNow === maze.collectibles.length) {
                soundEngine.playAllCollectedFanfare();
              }
              spawnParticles(item.worldX, 1.3, item.worldZ, 0xfbbf24, 18, 5.5);
            }
          }

          // Check Exit Portal arrival
          const exitWorld = gridToWorld(
            maze.exitCell.x,
            maze.exitCell.z,
            maze.size
          );
          const distToExit = Math.hypot(
            playerPosRef.current.x - exitWorld.x,
            playerPosRef.current.z - exitWorld.z
          );

          if (distToExit < 1.45) {
            // Victory reached!
            soundEngine.playVictory();
            if (document.pointerLockElement) {
              document.exitPointerLock?.();
            }
            const collectedCount = maze.collectibles.filter((c) => c.collected).length;
            const saveResult = saveRunRecord(
              difficultyRef.current,
              Math.round(elapsedMs),
              collectedCount,
              maze.collectibles.length,
              wallBumps
            );
            setRecords(saveResult.records);
            setIsNewBestTime(saveResult.isNewBestTime);
            setIsNewAllRelicsRecord(saveResult.isNewAllRelicsRecord);
            setHud({
              elapsedMs: Math.round(elapsedMs),
              collectedCount,
              totalCollectibles: maze.collectibles.length,
              exploredPercent: computeExploredPercentage(maze),
              wallBumps,
              isExitUnlocked: true,
              nearExitHint: false,
              lastImpactIntensity: 0,
            });
            gameStateRef.current = GameState.VICTORY;
            setGameState(GameState.VICTORY);
          }

          // Update first-person camera transform with headbob + collision shake
          const speedRatio = Math.min(1, Math.hypot(playerVelX, playerVelZ) / WALK_SPEED);
          const bobY = Math.sin(stepCycle * 2) * 0.055 * speedRatio;
          const bobX = Math.cos(stepCycle) * 0.03 * speedRatio;

          const shakeX = (Math.random() - 0.5) * 2 * shakeIntensity;
          const shakeY = (Math.random() - 0.5) * 2 * shakeIntensity;

          camera.position.set(
            playerPosRef.current.x + bobX + shakeX,
            EYE_HEIGHT + bobY + shakeY,
            playerPosRef.current.z
          );

          _camEuler.set(
            playerPosRef.current.pitch + shakeY * 0.18,
            playerPosRef.current.yaw + shakeX * 0.18,
            shakeRoll,
            'YXZ'
          );
          camera.quaternion.setFromEuler(_camEuler);

          // Smooth FOV widening when sprinting
          const targetFov = speedRatio > 1.1 ? 77 : 72;
          camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 8, dt);
          camera.updateProjectionMatrix();

          playerLight.position.set(
            playerPosRef.current.x,
            EYE_HEIGHT + 0.5,
            playerPosRef.current.z
          );

          // Throttled HUD state sync (~12fps for timer & counters, or immediately on pickup/hit)
          if (now - lastHudSyncTime > 80 || newlyCollected || impactFlash > 0.1) {
            lastHudSyncTime = now;
            const collectedCount = maze.collectibles.filter((c) => c.collected).length;
            setHud({
              elapsedMs: Math.round(elapsedMs),
              collectedCount,
              totalCollectibles: maze.collectibles.length,
              exploredPercent: computeExploredPercentage(maze),
              wallBumps,
              isExitUnlocked: true,
              nearExitHint: distToExit < 6.0,
              lastImpactIntensity: impactFlash,
            });
          }
        }
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      window.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('resize', onResize);
      floorGeo.dispose();
      floorMat.dispose();
      floorTex.dispose();
      skyGradientTexture.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      cloakGeo.dispose();
      shoulderGeo.dispose();
      headGeo.dispose();
      haloGeo.dispose();
      shardGeo.dispose();
      ghostPrimaryMat.dispose();
      ghostAccentMat.dispose();
      renderer.dispose();
    };
  }, []);

  const currentDiffConfig = DIFFICULTY_CONFIGS[difficulty];
  const currentBest = records[difficulty];

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0F172A] select-none">
      {/* Dedicated isolated WebGL Canvas Mount Container */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full z-0" />

      {/* Crisp Tactile Wall-Collision Vignette Overlay */}
      {gameState === GameState.PLAYING && hud.lastImpactIntensity > 0.02 && (
        <div
          className="fixed inset-0 pointer-events-none z-10 transition-opacity duration-75"
          style={{
            opacity: hud.lastImpactIntensity,
            boxShadow: 'inset 0 0 90px 28px rgba(245, 158, 11, 0.55)',
          }}
        />
      )}

      {/* Center First-Person Reticle & Pointer Lock Hint */}
      {gameState === GameState.PLAYING && (
        <div className="fixed inset-0 pointer-events-none z-10 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full border border-white/70 bg-amber-400/80 shadow-sm" />
          {!pointerLocked && (
            <div className="mt-16 bg-[#0F172A]/90 border border-slate-700/80 px-3.5 py-1.5 rounded-lg text-xs text-slate-200">
              Нажмите на экран для захвата курсора мыши
            </div>
          )}
        </div>
      )}

      {/* Active Gameplay HUD Overlay (Low-Occlusion Perimeter Clusters, zero backdrop-filter) */}
      {gameState === GameState.PLAYING && (
        <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 md:p-6">
          {/* Top Perimeter Row: Status Cluster (Top-Left) & Fog-of-War Minimap (Top-Right) */}
          <div className="flex items-start justify-between gap-4">
            {/* Top-Left Telemetry Cluster */}
            <div className="pointer-events-auto bg-[#0F172A]/95 border border-slate-700/80 rounded-xl px-4 py-3 shadow-2xl flex items-center gap-5">
              {/* Timer */}
              <div>
                <div className="text-[11px] text-slate-400">Время</div>
                <div className="font-mono-tabular text-xl font-bold text-slate-50">
                  {formatTimeMs(hud.elapsedMs)}
                </div>
              </div>

              <div className="h-8 w-px bg-slate-800" />

              {/* Collectibles Counter */}
              <div>
                <div className="text-[11px] text-slate-400">Реликвии</div>
                <div className="font-mono-tabular text-xl font-bold text-amber-400 flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-amber-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="12,2 20,12 12,22 4,12" />
                  </svg>
                  <span>
                    {hud.collectedCount} / {hud.totalCollectibles}
                  </span>
                </div>
              </div>

              <div className="h-8 w-px bg-slate-800 hidden sm:block" />

              {/* Explored % & Best Record */}
              <div className="hidden sm:block">
                <div className="text-[11px] text-slate-400">
                  {currentDiffConfig.label} · Открыто {hud.exploredPercent}%
                </div>
                <div className="font-mono-tabular text-xs font-semibold text-sky-400 mt-0.5">
                  {currentBest
                    ? `Рекорд: ${formatTimeMs(currentBest.bestTimeMs)}`
                    : 'Рекорд не установлен'}
                </div>
              </div>
            </div>

            {/* Top-Right Fog-of-War Minimap */}
            <Minimap
              mazeRef={mazeRef}
              playerPosRef={playerPosRef}
              expanded={minimapExpanded}
              onToggleExpand={() => setMinimapExpanded((prev) => !prev)}
            />
          </div>

          {/* Near Exit Portal Banner */}
          {hud.nearExitHint && (
            <div className="mx-auto my-auto pt-36 pointer-events-none">
              <div className="bg-[#0F172A]/95 border border-emerald-500/60 px-4 py-2 rounded-xl text-xs font-semibold text-emerald-300 shadow-lg">
                Портал выхода рядом — шагните в изумрудную арку!
              </div>
            </div>
          )}

          {/* Unified Collapsible Bottom Control Dock (per Three.js ergonomic UI directive) */}
          <div className="w-full flex flex-col items-center pointer-events-none">
            <div className="pointer-events-auto flex flex-col items-center">
              <button
                type="button"
                onClick={() => setDockCollapsed((prev) => !prev)}
                className="px-3 py-1 bg-[#0F172A]/95 border border-b-0 border-slate-700/80 rounded-t-lg text-[11px] font-medium text-slate-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
              >
                {dockCollapsed ? '▴ Панель управления [H]' : '▾ Скрыть панель [H]'}
              </button>

              {!dockCollapsed && (
                <div className="bg-[#0F172A]/95 border border-slate-700/80 rounded-xl px-4 py-2.5 shadow-2xl flex flex-wrap items-center justify-center gap-3 max-w-[94vw]">
                  {/* Difficulty switcher pills */}
                  <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                    {(Object.keys(DIFFICULTY_CONFIGS) as Difficulty[]).map((dKey) => {
                      const cfg = DIFFICULTY_CONFIGS[dKey];
                      const active = difficulty === dKey;
                      return (
                        <button
                          key={dKey}
                          type="button"
                          onClick={() => handleSelectDifficulty(dKey)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                            active
                              ? 'bg-amber-500 text-slate-950 font-semibold'
                              : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="h-5 w-px bg-slate-800 hidden sm:block" />

                  {/* Shadow quality toggle in bottom dock */}
                  <button
                    type="button"
                    onClick={() =>
                      handleSelectShadowQuality(
                        shadowQuality === ShadowQuality.HIGH
                          ? ShadowQuality.LOW
                          : ShadowQuality.HIGH
                      )
                    }
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Тени: {shadowQuality === ShadowQuality.HIGH ? 'Выс.' : 'Низ.'}
                  </button>

                  <button
                    type="button"
                    onClick={handleRestartMaze}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Пересоздать
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleMute}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {muted ? 'Звук: Выкл' : 'Звук: Вкл'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (document.pointerLockElement) {
                        document.exitPointerLock?.();
                      }
                      setGameState(GameState.PAUSED);
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Пауза [Esc]
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Title Screen Modal Overlay */}
      {gameState === GameState.TITLE && (
        <TitleScreen
          selectedDifficulty={difficulty}
          onSelectDifficulty={handleSelectDifficulty}
          shadowQuality={shadowQuality}
          onSelectShadowQuality={handleSelectShadowQuality}
          records={records}
          onStartGame={handleStartGame}
          onClearRecords={handleClearRecords}
          muted={muted}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Pause & Victory Modal Overlay */}
      {(gameState === GameState.PAUSED || gameState === GameState.VICTORY) && (
        <PauseOrVictoryModal
          gameState={gameState}
          difficulty={difficulty}
          shadowQuality={shadowQuality}
          hud={hud}
          records={records}
          isNewBestTime={isNewBestTime}
          isNewAllRelicsRecord={isNewAllRelicsRecord}
          onResume={handleResumeGame}
          onRestart={handleRestartMaze}
          onChangeDifficulty={handleSelectDifficulty}
          onChangeShadowQuality={handleSelectShadowQuality}
          onReturnToTitle={handleReturnToTitle}
        />
      )}
    </div>
  );
}
