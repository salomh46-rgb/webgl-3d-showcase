import React from 'react';
import {
  Difficulty,
  DIFFICULTY_CONFIGS,
  GameState,
  HudSnapshot,
  RecordsByDifficulty,
  ShadowQuality,
} from '../types/game';
import { formatTimeMs } from '../utils/recordsStorage';

interface TitleScreenProps {
  selectedDifficulty: Difficulty;
  onSelectDifficulty: (diff: Difficulty) => void;
  shadowQuality: ShadowQuality;
  onSelectShadowQuality: (quality: ShadowQuality) => void;
  records: RecordsByDifficulty;
  onStartGame: () => void;
  onClearRecords: () => void;
  muted: boolean;
  onToggleMute: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  selectedDifficulty,
  onSelectDifficulty,
  shadowQuality,
  onSelectShadowQuality,
  records,
  onStartGame,
  onClearRecords,
  muted,
  onToggleMute,
}) => {
  const hasAnyRecord = Boolean(
    records[Difficulty.EASY] || records[Difficulty.MEDIUM] || records[Difficulty.HARD]
  );

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-6 md:p-10 pointer-events-none">
      {/* Top perimeter bar: minimal brand badge + graphics & sound toggles */}
      <div className="flex items-center justify-between w-full max-w-6xl mx-auto pointer-events-auto">
        <div className="flex items-center gap-3 bg-[#0F172A]/90 border border-slate-700/80 px-4 py-2 rounded-xl">
          <svg className="w-5 h-5 text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L20 7V17L12 22L4 17V7L12 2Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M12 8L16 10.5V15.5L12 18L8 15.5V10.5L12 8Z"
              fill="currentColor"
            />
          </svg>
          <span className="font-display font-bold text-sm tracking-tight text-slate-100 whitespace-nowrap">
            ПолиЛабиринт 3D
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() =>
              onSelectShadowQuality(
                shadowQuality === ShadowQuality.HIGH ? ShadowQuality.LOW : ShadowQuality.HIGH
              )
            }
            className="px-4 py-2 text-xs font-medium text-slate-200 bg-[#0F172A]/90 border border-slate-700/80 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            Тени: {shadowQuality === ShadowQuality.HIGH ? 'Высокие' : 'Низкие'}
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className="px-4 py-2 text-xs font-medium text-slate-200 bg-[#0F172A]/90 border border-slate-700/80 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            {muted ? 'Звук: Выкл [M]' : 'Звук: Вкл'}
          </button>
        </div>
      </div>

      {/* Center focal lockup over negative space */}
      <div className="w-full max-w-4xl mx-auto my-auto flex flex-col items-center text-center pointer-events-auto">
        {/* Bespoke inline SVG Isometric Low-Poly Emblem */}
        <div className="mb-4">
          <svg
            className="w-16 h-16 md:w-20 md:h-20 mx-auto"
            viewBox="0 0 96 96"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Outer isometric low-poly labyrinth cube */}
            <polygon points="48,8 86,28 48,48 10,28" fill="#38BDF8" />
            <polygon points="10,28 48,48 48,88 10,68" fill="#0284C7" />
            <polygon points="86,28 86,68 48,88 48,48" fill="#0369A1" />
            {/* Carved corridor pathways */}
            <polygon points="48,18 72,30 48,42 24,30" fill="#0F172A" />
            {/* Floating golden relic crystal in center */}
            <polygon points="48,12 58,28 48,40 38,28" fill="#FBBF24" />
            <polygon points="48,12 58,28 48,25" fill="#FEF08A" />
          </svg>
        </div>

        <h1
          className="font-display font-extrabold text-slate-50 tracking-tight mb-3"
          style={{ fontSize: 'clamp(2.25rem, 4.5vw, 3.75rem)', textWrap: 'balance' }}
        >
          ПолиЛабиринт 3D
        </h1>

        <p className="text-slate-300 text-sm md:text-base max-w-xl mb-8 leading-relaxed">
          Исследуйте низкополигональные коридоры от первого лица, открывайте карту сквозь туман войны, собирайте парящие реликвии и найдите портал выхода.
        </p>

        {/* Main interactive panel: Difficulty Selection + Graphics Settings + Best Records Table */}
        <div className="w-full bg-[#0F172A]/95 border border-slate-700/90 rounded-2xl p-6 md:p-7 shadow-2xl text-left">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left column: Difficulty segmented selector, Shadow quality & Start CTA */}
            <div className="lg:col-span-7 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-300">
                    Выберите уровень сложности
                  </span>
                  <span className="text-xs text-slate-400">
                    Размер лабиринта и число реликвий
                  </span>
                </div>

                {/* Segmented interactive buttons */}
                <div className="grid grid-cols-3 gap-2.5 p-1.5 bg-slate-900 rounded-xl border border-slate-800 mb-4">
                  {(Object.keys(DIFFICULTY_CONFIGS) as Difficulty[]).map((diffKey) => {
                    const cfg = DIFFICULTY_CONFIGS[diffKey];
                    const active = selectedDifficulty === diffKey;
                    return (
                      <button
                        key={diffKey}
                        type="button"
                        onClick={() => onSelectDifficulty(diffKey)}
                        className={`py-3 px-3 rounded-lg text-left transition-all cursor-pointer ${
                          active
                            ? 'bg-amber-500 text-slate-950 font-semibold shadow-md'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                        }`}
                      >
                        <div className="text-sm font-display font-bold whitespace-nowrap">
                          {cfg.label}
                        </div>
                        <div
                          className={`text-[11px] mt-0.5 whitespace-nowrap ${
                            active ? 'text-slate-900 font-medium' : 'text-slate-400'
                          }`}
                        >
                          {cfg.subtitle}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Shadow Quality Selector for Performance */}
                <div className="flex items-center justify-between gap-4 p-3 bg-slate-900/70 rounded-xl border border-slate-800/90 mb-5">
                  <div>
                    <div className="text-xs font-semibold text-slate-200">
                      Качество теней
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Низкое качество повышает FPS на слабых устройствах
                    </div>
                  </div>

                  <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSelectShadowQuality(ShadowQuality.LOW)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        shadowQuality === ShadowQuality.LOW
                          ? 'bg-sky-500 text-slate-950 font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Низкое
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectShadowQuality(ShadowQuality.HIGH)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        shadowQuality === ShadowQuality.HIGH
                          ? 'bg-sky-500 text-slate-950 font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Высокое
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={onStartGame}
                  className="w-full py-3.5 px-6 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-slate-950 font-display font-bold text-base rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <span>Войти в лабиринт</span>
                  <span className="text-xs font-normal opacity-80">(Enter / Space)</span>
                </button>
              </div>
            </div>

            {/* Right column: High Scores per difficulty */}
            <div className="lg:col-span-5 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-800 pt-5 lg:pt-0 lg:pl-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-300">
                    Таблица рекордов
                  </span>
                  {hasAnyRecord && (
                    <button
                      type="button"
                      onClick={onClearRecords}
                      className="text-[11px] text-slate-400 hover:text-rose-400 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Сбросить
                    </button>
                  )}
                </div>

                <div className="space-y-2.5">
                  {(Object.keys(DIFFICULTY_CONFIGS) as Difficulty[]).map((diffKey) => {
                    const cfg = DIFFICULTY_CONFIGS[diffKey];
                    const rec = records[diffKey];
                    const isSelected = selectedDifficulty === diffKey;

                    return (
                      <div
                        key={diffKey}
                        onClick={() => onSelectDifficulty(diffKey)}
                        className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-slate-800/90 border-amber-500/50'
                            : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-semibold text-slate-200">
                            {cfg.label}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {rec
                              ? `Реликвии: ${rec.maxRelicsCollected}/${rec.totalRelics} · Касаний: ${rec.wallHits}`
                              : 'Нет записей'}
                          </div>
                        </div>

                        <div className="text-right font-mono-tabular">
                          {rec ? (
                            <span className="text-sm font-bold text-amber-400">
                              {formatTimeMs(rec.bestTimeMs)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">— : —</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Flat single-line control hint bar at bottom */}
      <div className="w-full max-w-4xl mx-auto text-center pointer-events-auto">
        <div className="inline-flex flex-wrap items-center justify-center gap-2 text-xs text-slate-300 bg-[#0F172A]/90 border border-slate-800 px-4 py-2 rounded-xl">
          <span>WASD / Стрелки — Движение</span>
          <span>·</span>
          <span>Мышь / Q E — Обзор</span>
          <span>·</span>
          <span>Shift — Ускорение</span>
          <span>·</span>
          <span>M — Размер карты</span>
          <span>·</span>
          <span>Esc — Пауза</span>
        </div>
      </div>
    </div>
  );
};

interface PauseOrVictoryModalProps {
  gameState: GameState.PAUSED | GameState.VICTORY;
  difficulty: Difficulty;
  shadowQuality: ShadowQuality;
  hud: HudSnapshot;
  records: RecordsByDifficulty;
  isNewBestTime: boolean;
  isNewAllRelicsRecord: boolean;
  onResume: () => void;
  onRestart: () => void;
  onChangeDifficulty: (diff: Difficulty) => void;
  onChangeShadowQuality: (quality: ShadowQuality) => void;
  onReturnToTitle: () => void;
}

export const PauseOrVictoryModal: React.FC<PauseOrVictoryModalProps> = ({
  gameState,
  difficulty,
  shadowQuality,
  hud,
  records,
  isNewBestTime,
  isNewAllRelicsRecord,
  onResume,
  onRestart,
  onChangeDifficulty,
  onChangeShadowQuality,
  onReturnToTitle,
}) => {
  const isVictory = gameState === GameState.VICTORY;
  const diffConfig = DIFFICULTY_CONFIGS[difficulty];
  const currentRecord = records[difficulty];
  const collectedAll = hud.collectedCount >= hud.totalCollectibles;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-6 bg-slate-950/75 pointer-events-auto">
      <div className="w-full max-w-lg bg-[#0F172A] border border-slate-700 rounded-2xl p-6 md:p-8 shadow-2xl">
        <div className="text-center mb-6">
          <div className="text-xs font-medium text-amber-400 mb-1">
            {diffConfig.label} уровень · Лабиринт {diffConfig.gridSize}×{diffConfig.gridSize}
          </div>
          <h2 className="font-display font-extrabold text-2xl md:text-3xl text-slate-50">
            {isVictory ? 'Выход найден!' : 'Игра на паузе'}
          </h2>
          {isVictory && (
            <p className="text-xs text-slate-300 mt-1.5">
              {isNewBestTime
                ? 'Новый рекорд времени на этом уровне сложности!'
                : isNewAllRelicsRecord
                ? 'Новый рекорд полного сбора всех реликвий!'
                : collectedAll
                ? 'Вы собрали все реликвии лабиринта и открыли портал!'
                : 'Вы успешно выбрались из лабиринта!'}
            </p>
          )}
        </div>

        {/* Metrics grid with tabular-nums */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
            <div className="text-xs text-slate-400 mb-1">Время прохождения</div>
            <div className="font-mono-tabular text-xl font-bold text-slate-100">
              {formatTimeMs(hud.elapsedMs)}
            </div>
            {currentRecord && (
              <div className="text-[11px] text-amber-400 font-mono-tabular mt-1">
                Рекорд: {formatTimeMs(currentRecord.bestTimeMs)}
              </div>
            )}
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
            <div className="text-xs text-slate-400 mb-1">Собрано реликвий</div>
            <div className="font-mono-tabular text-xl font-bold text-amber-400">
              {hud.collectedCount} / {hud.totalCollectibles}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {collectedAll ? '100% коллекция' : 'Частичный сбор'}
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
            <div className="text-xs text-slate-400 mb-1">Исследовано карты</div>
            <div className="font-mono-tabular text-lg font-bold text-sky-400">
              {hud.exploredPercent}%
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
            <div className="text-xs text-slate-400 mb-1">Столкновений со стенами</div>
            <div className="font-mono-tabular text-lg font-bold text-slate-200">
              {hud.wallBumps}
            </div>
          </div>
        </div>

        {/* Quick difficulty switcher for next run */}
        <div className="mb-4">
          <div className="text-xs text-slate-400 mb-2">Сложность лабиринта:</div>
          <div className="grid grid-cols-3 gap-2 p-1 bg-slate-900 rounded-xl border border-slate-800">
            {(Object.keys(DIFFICULTY_CONFIGS) as Difficulty[]).map((dKey) => {
              const cfg = DIFFICULTY_CONFIGS[dKey];
              const active = dKey === difficulty;
              return (
                <button
                  key={dKey}
                  type="button"
                  onClick={() => onChangeDifficulty(dKey)}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {cfg.label} ({cfg.gridSize}×{cfg.gridSize})
                </button>
              );
            })}
          </div>
        </div>

        {/* Shadow Quality Switcher in Pause / Victory */}
        <div className="flex items-center justify-between gap-3 p-3 bg-slate-900/80 border border-slate-800 rounded-xl mb-6">
          <div>
            <div className="text-xs font-medium text-slate-200">Качество теней</div>
            <div className="text-[11px] text-slate-400">
              Оптимизация для слабых устройств
            </div>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => onChangeShadowQuality(ShadowQuality.LOW)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                shadowQuality === ShadowQuality.LOW
                  ? 'bg-sky-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Низкое
            </button>
            <button
              type="button"
              onClick={() => onChangeShadowQuality(ShadowQuality.HIGH)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                shadowQuality === ShadowQuality.HIGH
                  ? 'bg-sky-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Высокое
            </button>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          {!isVictory && (
            <button
              type="button"
              onClick={onResume}
              className="flex-1 py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-sm rounded-xl transition-colors cursor-pointer whitespace-nowrap"
            >
              Продолжить игру
            </button>
          )}
          <button
            type="button"
            onClick={onRestart}
            className={`flex-1 py-3 px-4 font-display font-bold text-sm rounded-xl transition-colors cursor-pointer whitespace-nowrap ${
              isVictory
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100'
            }`}
          >
            Новый лабиринт
          </button>
          <button
            type="button"
            onClick={onReturnToTitle}
            className="py-3 px-4 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-sm font-medium rounded-xl transition-colors cursor-pointer whitespace-nowrap"
          >
            В меню
          </button>
        </div>
      </div>
    </div>
  );
};
