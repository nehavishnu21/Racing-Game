import { Play, RotateCcw, Trophy } from 'lucide-react';
import { formatRaceTime, ordinalSuffix } from '../game/format';
import { HudSnapshot } from '../game/types';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onExitToTitle: () => void;
}

export function PauseModal({ onResume, onRestart, onExitToTitle }: PauseModalProps) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#06090f]/75 p-4">
      <div className="w-full max-w-sm rounded-xl border border-white/15 bg-[#0f141e] p-6">
        <h2 className="font-display text-2xl font-bold text-white">Race Paused</h2>
        <p className="mt-1 text-sm text-slate-400">
          Press Escape to resume or restart the session.
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 font-display text-sm font-bold text-slate-950 transition-colors hover:bg-amber-400"
          >
            <Play className="h-4 w-4 fill-current" />
            Resume Race
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-[#161d2b] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1e283b]"
          >
            <RotateCcw className="h-4 w-4" />
            Restart Race
          </button>
          <button
            type="button"
            onClick={onExitToTitle}
            className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
          >
            Change Track / Menu
          </button>
        </div>
      </div>
    </div>
  );
}

interface FinishModalProps {
  hud: HudSnapshot;
  onRaceAgain: () => void;
  onExitToTitle: () => void;
}

export function FinishModal({ hud, onRaceAgain, onExitToTitle }: FinishModalProps) {
  const isPodium = hud.position <= 3;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#06090f]/78 p-4">
      <div className="w-full max-w-lg rounded-xl border border-white/15 bg-[#0f141e] p-6 md:p-7">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <div className="text-xs font-medium tracking-wider text-amber-400">
              Checkered Flag
            </div>
            <h2 className="mt-1 font-display text-3xl font-extrabold text-white">
              Finished {hud.position}
              <span className="text-lg font-bold text-amber-400">
                {ordinalSuffix(hud.position)}
              </span>
            </h2>
          </div>
          {isPodium && (
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-amber-400/40 bg-amber-500/15 text-amber-400">
              <Trophy className="h-6 w-6" />
            </div>
          )}
        </div>

        {/* Race Summary Metrics */}
        <div className="mt-4 grid grid-cols-3 gap-3 border-b border-white/10 pb-4">
          <div>
            <div className="text-xs text-slate-400">Total Time</div>
            <div className="mt-0.5 font-telemetry text-base font-bold text-white">
              {formatRaceTime(hud.raceTime)}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Best Lap</div>
            <div className="mt-0.5 font-telemetry text-base font-bold text-amber-400">
              {hud.bestLapTime !== null ? formatRaceTime(hud.bestLapTime) : '--:--.--'}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Top Speed</div>
            <div className="mt-0.5 font-telemetry text-base font-bold text-white">
              {hud.topSpeedKmh} km/h
            </div>
          </div>
        </div>

        {/* Standings Table */}
        <div className="mt-4">
          <div className="mb-2 text-xs font-medium text-slate-400">Final Standings</div>
          <div className="divide-y divide-white/8 rounded-lg border border-white/10 bg-[#0b0f17]">
            {hud.standings.map((r) => (
              <div
                key={r.id}
                className={`flex items-center justify-between px-3.5 py-2 text-sm ${
                  r.isPlayer ? 'bg-amber-500/12 font-semibold text-white' : 'text-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-telemetry w-5 text-xs text-slate-400">
                    {r.position}
                  </span>
                  <span
                    className="h-2.5 w-2.5 rounded-xs"
                    style={{ backgroundColor: r.color }}
                  />
                  <span>{r.name}</span>
                </div>
                <span className="font-telemetry text-xs text-slate-400">
                  {r.isPlayer ? formatRaceTime(hud.raceTime) : `Lap ${Math.min(r.lap, hud.totalLaps)}`}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={onRaceAgain}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-500 px-5 py-3 font-display text-sm font-bold text-slate-950 transition-colors hover:bg-amber-400"
          >
            <RotateCcw className="h-4 w-4" />
            Race Again
          </button>
          <button
            type="button"
            onClick={onExitToTitle}
            className="rounded-lg border border-white/15 bg-[#161d2b] px-5 py-3 text-sm font-medium text-slate-200 transition-colors hover:bg-[#1e283b] hover:text-white"
          >
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}
