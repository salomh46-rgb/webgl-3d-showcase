import { Difficulty, BestRecord, RecordsByDifficulty } from '../types/game';

const STORAGE_KEY = 'polylabyrinth_3d_records_v1';

const DEFAULT_RECORDS: RecordsByDifficulty = {
  [Difficulty.EASY]: null,
  [Difficulty.MEDIUM]: null,
  [Difficulty.HARD]: null,
};

export function loadRecords(): RecordsByDifficulty {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_RECORDS };
    const parsed = JSON.parse(raw);
    return {
      [Difficulty.EASY]: parsed[Difficulty.EASY] || null,
      [Difficulty.MEDIUM]: parsed[Difficulty.MEDIUM] || null,
      [Difficulty.HARD]: parsed[Difficulty.HARD] || null,
    };
  } catch {
    return { ...DEFAULT_RECORDS };
  }
}

export function saveRunRecord(
  difficulty: Difficulty,
  timeMs: number,
  collected: number,
  total: number,
  wallHits: number
): { records: RecordsByDifficulty; isNewBestTime: boolean; isNewAllRelicsRecord: boolean } {
  const currentAll = loadRecords();
  const prev = currentAll[difficulty];
  const allCollected = collected >= total;

  let isNewBestTime = false;
  let isNewAllRelicsRecord = false;

  if (!prev) {
    isNewBestTime = true;
    if (allCollected) isNewAllRelicsRecord = true;
    currentAll[difficulty] = {
      bestTimeMs: timeMs,
      bestAllRelicsTimeMs: allCollected ? timeMs : null,
      maxRelicsCollected: collected,
      totalRelics: total,
      wallHits,
      updatedAt: new Date().toISOString(),
    };
  } else {
    const nextBestTime = timeMs < prev.bestTimeMs ? timeMs : prev.bestTimeMs;
    if (timeMs < prev.bestTimeMs) {
      isNewBestTime = true;
    }

    let nextAllRelicsTime = prev.bestAllRelicsTimeMs;
    if (allCollected) {
      if (prev.bestAllRelicsTimeMs === null || timeMs < prev.bestAllRelicsTimeMs) {
        nextAllRelicsTime = timeMs;
        isNewAllRelicsRecord = true;
      }
    }

    currentAll[difficulty] = {
      bestTimeMs: nextBestTime,
      bestAllRelicsTimeMs: nextAllRelicsTime,
      maxRelicsCollected: Math.max(prev.maxRelicsCollected, collected),
      totalRelics: total,
      wallHits: isNewBestTime ? wallHits : prev.wallHits,
      updatedAt: new Date().toISOString(),
    };
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentAll));
  } catch {
    // Ignore storage quota errors
  }

  return {
    records: currentAll,
    isNewBestTime,
    isNewAllRelicsRecord,
  };
}

export function clearAllRecords(): RecordsByDifficulty {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  return { ...DEFAULT_RECORDS };
}

export function formatTimeMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
}
