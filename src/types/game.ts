export enum Difficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
}

export enum ShadowQuality {
  LOW = 'low',
  HIGH = 'high',
}

export enum GameState {
  TITLE = 'title',
  PLAYING = 'playing',
  PAUSED = 'paused',
  VICTORY = 'victory',
}

export interface DifficultyConfig {
  id: Difficulty;
  label: string;
  subtitle: string;
  gridSize: number; // Must be odd: 11, 17, 23
  collectibleCount: number;
  wallColorHex: number;
  accentColorHex: number;
}

export const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  [Difficulty.EASY]: {
    id: Difficulty.EASY,
    label: 'Лёгкий',
    subtitle: '11 × 11 · 5 реликвий',
    gridSize: 11,
    collectibleCount: 5,
    wallColorHex: 0x3b82f6,
    accentColorHex: 0x38bdf8,
  },
  [Difficulty.MEDIUM]: {
    id: Difficulty.MEDIUM,
    label: 'Средний',
    subtitle: '17 × 17 · 10 реликвий',
    gridSize: 17,
    collectibleCount: 10,
    wallColorHex: 0x6366f1,
    accentColorHex: 0xf59e0b,
  },
  [Difficulty.HARD]: {
    id: Difficulty.HARD,
    label: 'Сложный',
    subtitle: '23 × 23 · 16 реликвий',
    gridSize: 23,
    collectibleCount: 16,
    wallColorHex: 0x8b5cf6,
    accentColorHex: 0xf43f5e,
  },
};

export interface CollectibleItem {
  id: number;
  gridX: number;
  gridZ: number;
  worldX: number;
  worldZ: number;
  collected: boolean;
  collectAnimProgress: number; // 0 = idle, >0 = collecting animation
  phaseOffset: number;
}

export interface MazeData {
  size: number;
  grid: number[][]; // 1 = wall, 0 = path
  startCell: { x: number; z: number };
  exitCell: { x: number; z: number };
  collectibles: CollectibleItem[];
  revealed: boolean[][];
  totalPathCells: number;
}

export interface BestRecord {
  bestTimeMs: number;
  bestAllRelicsTimeMs: number | null;
  maxRelicsCollected: number;
  totalRelics: number;
  wallHits: number;
  updatedAt: string;
}

export type RecordsByDifficulty = Record<Difficulty, BestRecord | null>;

export interface HudSnapshot {
  elapsedMs: number;
  collectedCount: number;
  totalCollectibles: number;
  exploredPercent: number;
  wallBumps: number;
  isExitUnlocked: boolean;
  nearExitHint: boolean;
  lastImpactIntensity: number; // 0..1 for vignette flash
}
