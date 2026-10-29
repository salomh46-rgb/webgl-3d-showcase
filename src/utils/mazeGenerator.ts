import { CollectibleItem, MazeData } from '../types/game';

export const CELL_WORLD_SIZE = 4.0; // Each maze cell is 4x4 meters in 3D space

/**
 * Generates an odd-sized 2D maze grid using randomized recursive backtracker,
 * adds a few extra loops on larger mazes for playful navigation, places the exit
 * at the topological farthest cell from start, and scatters collectibles.
 */
export function generateMaze(size: number, collectibleCount: number): MazeData {
  // Ensure odd dimensions
  const gridSize = size % 2 === 0 ? size + 1 : size;
  const grid: number[][] = Array.from({ length: gridSize }, () =>
    Array(gridSize).fill(1)
  );
  const revealed: boolean[][] = Array.from({ length: gridSize }, () =>
    Array(gridSize).fill(false)
  );

  const startCell = { x: 1, z: 1 };
  grid[startCell.z][startCell.x] = 0;

  const stack: Array<{ x: number; z: number }> = [startCell];
  const dirs = [
    { dx: 0, dz: -2 },
    { dx: 2, dz: 0 },
    { dx: 0, dz: 2 },
    { dx: -2, dz: 0 },
  ];

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const neighbors: Array<{ nx: number; nz: number; wx: number; wz: number }> = [];

    for (const d of dirs) {
      const nx = current.x + d.dx;
      const nz = current.z + d.dz;
      if (nx > 0 && nx < gridSize - 1 && nz > 0 && nz < gridSize - 1) {
        if (grid[nz][nx] === 1) {
          neighbors.push({
            nx,
            nz,
            wx: current.x + d.dx / 2,
            wz: current.z + d.dz / 2,
          });
        }
      }
    }

    if (neighbors.length > 0) {
      const chosen = neighbors[Math.floor(Math.random() * neighbors.length)];
      grid[chosen.wz][chosen.wx] = 0;
      grid[chosen.nz][chosen.nx] = 0;
      stack.push({ x: chosen.nx, z: chosen.nz });
    } else {
      stack.pop();
    }
  }

  // Carve a few strategic braided shortcuts (~6% of internal walls) so movement feels dynamic
  const extraOpenings = Math.floor((gridSize * gridSize) * 0.025);
  for (let i = 0; i < extraOpenings; i++) {
    const rx = 2 + Math.floor(Math.random() * (gridSize - 4));
    const rz = 2 + Math.floor(Math.random() * (gridSize - 4));
    if (grid[rz][rx] === 1) {
      const horizPass = grid[rz][rx - 1] === 0 && grid[rz][rx + 1] === 0 && grid[rz - 1][rx] === 1 && grid[rz + 1][rx] === 1;
      const vertPass = grid[rz - 1][rx] === 0 && grid[rz + 1][rx] === 0 && grid[rz][rx - 1] === 1 && grid[rz][rx + 1] === 1;
      if (horizPass || vertPass) {
        grid[rz][rx] = 0;
      }
    }
  }

  // BFS from startCell to find distances and place Exit at the farthest reachable path cell
  const dist: number[][] = Array.from({ length: gridSize }, () =>
    Array(gridSize).fill(-1)
  );
  const queue: Array<{ x: number; z: number }> = [startCell];
  dist[startCell.z][startCell.x] = 0;

  let exitCell = { x: gridSize - 2, z: gridSize - 2 };
  let maxDist = 0;
  const candidateCells: Array<{ x: number; z: number; d: number; isDeadEnd: boolean }> = [];
  let totalPathCells = 0;

  while (queue.length > 0) {
    const curr = queue.shift()!;
    totalPathCells++;
    const d = dist[curr.z][curr.x];

    if (d > maxDist) {
      maxDist = d;
      exitCell = { x: curr.x, z: curr.z };
    }

    let openNeighbors = 0;
    const stepDirs = [
      { dx: 0, dz: -1 },
      { dx: 1, dz: 0 },
      { dx: 0, dz: 1 },
      { dx: -1, dz: 0 },
    ];

    for (const sd of stepDirs) {
      const nx = curr.x + sd.dx;
      const nz = curr.z + sd.dz;
      if (nx >= 0 && nx < gridSize && nz >= 0 && nz < gridSize && grid[nz][nx] === 0) {
        openNeighbors++;
        if (dist[nz][nx] === -1) {
          dist[nz][nx] = d + 1;
          queue.push({ x: nx, z: nz });
        }
      }
    }

    if ((curr.x !== startCell.x || curr.z !== startCell.z) && d >= 3) {
      candidateCells.push({
        x: curr.x,
        z: curr.z,
        d,
        isDeadEnd: openNeighbors === 1,
      });
    }
  }

  // Filter out the exitCell from collectible candidates
  const validCandidates = candidateCells.filter(
    (c) => !(c.x === exitCell.x && c.z === exitCell.z)
  );

  // Prioritize dead-ends and well-spaced corridor cells for collectibles
  const deadEnds = validCandidates.filter((c) => c.isDeadEnd);
  const corridors = validCandidates.filter((c) => !c.isDeadEnd);

  // Shuffle helper
  const shuffle = <T,>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const orderedPool = [...shuffle(deadEnds), ...shuffle(corridors)];
  const selectedCollectibles: CollectibleItem[] = [];

  for (const cand of orderedPool) {
    if (selectedCollectibles.length >= collectibleCount) break;
    // Try to keep collectibles at least 2 cells apart if possible
    const tooClose = selectedCollectibles.some(
      (item) => Math.abs(item.gridX - cand.x) + Math.abs(item.gridZ - cand.z) < 2
    );
    if (!tooClose || orderedPool.length < collectibleCount * 2) {
      const worldPos = gridToWorld(cand.x, cand.z, gridSize);
      selectedCollectibles.push({
        id: selectedCollectibles.length + 1,
        gridX: cand.x,
        gridZ: cand.z,
        worldX: worldPos.x,
        worldZ: worldPos.z,
        collected: false,
        collectAnimProgress: 0,
        phaseOffset: Math.random() * Math.PI * 2,
      });
    }
  }

  // Reveal initial starting zone
  revealAroundCell(revealed, grid, startCell.x, startCell.z);

  return {
    size: gridSize,
    grid,
    startCell,
    exitCell,
    collectibles: selectedCollectibles,
    revealed,
    totalPathCells,
  };
}

export function gridToWorld(
  gridX: number,
  gridZ: number,
  gridSize: number
): { x: number; z: number } {
  const half = (gridSize * CELL_WORLD_SIZE) / 2;
  return {
    x: gridX * CELL_WORLD_SIZE - half + CELL_WORLD_SIZE / 2,
    z: gridZ * CELL_WORLD_SIZE - half + CELL_WORLD_SIZE / 2,
  };
}

export function worldToGrid(
  worldX: number,
  worldZ: number,
  gridSize: number
): { x: number; z: number } {
  const half = (gridSize * CELL_WORLD_SIZE) / 2;
  const gx = Math.floor((worldX + half) / CELL_WORLD_SIZE);
  const gz = Math.floor((worldZ + half) / CELL_WORLD_SIZE);
  return {
    x: Math.max(0, Math.min(gridSize - 1, gx)),
    z: Math.max(0, Math.min(gridSize - 1, gz)),
  };
}

/**
 * Reveals cells around the player's current grid coordinate, including line-of-sight
 * down open corridors up to 2 cells away so the fog-of-war minimap feels responsive.
 */
export function revealAroundCell(
  revealed: boolean[][],
  grid: number[][],
  cx: number,
  cz: number
): boolean {
  const size = grid.length;
  let changed = false;

  // Immediate 3x3 neighborhood (shows adjacent walls and corners)
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (nx >= 0 && nx < size && nz >= 0 && nz < size) {
        if (!revealed[nz][nx]) {
          revealed[nz][nx] = true;
          changed = true;
        }
      }
    }
  }

  // Short line-of-sight 2 cells ahead along open cardinal directions
  const dirs = [
    { dx: 0, dz: -1 },
    { dx: 1, dz: 0 },
    { dx: 0, dz: 1 },
    { dx: -1, dz: 0 },
  ];

  for (const d of dirs) {
    const midX = cx + d.dx;
    const midZ = cz + d.dz;
    if (
      midX >= 0 &&
      midX < size &&
      midZ >= 0 &&
      midZ < size &&
      grid[midZ][midX] === 0
    ) {
      const farX = cx + d.dx * 2;
      const farZ = cz + d.dz * 2;
      if (farX >= 0 && farX < size && farZ >= 0 && farZ < size) {
        if (!revealed[farZ][farX]) {
          revealed[farZ][farX] = true;
          changed = true;
        }
        // Also reveal walls flanking the open corridor cell
        for (let oz = -1; oz <= 1; oz++) {
          for (let ox = -1; ox <= 1; ox++) {
            const wx = midX + ox;
            const wz = midZ + oz;
            if (wx >= 0 && wx < size && wz >= 0 && wz < size && !revealed[wz][wx]) {
              revealed[wz][wx] = true;
              changed = true;
            }
          }
        }
      }
    }
  }

  return changed;
}

export function computeExploredPercentage(maze: MazeData): number {
  let exploredPaths = 0;
  for (let z = 0; z < maze.size; z++) {
    for (let x = 0; x < maze.size; x++) {
      if (maze.grid[z][x] === 0 && maze.revealed[z][x]) {
        exploredPaths++;
      }
    }
  }
  return Math.min(100, Math.round((exploredPaths / Math.max(1, maze.totalPathCells)) * 100));
}
