import { Camera, Pause, Volume2, VolumeX } from 'lucide-react';
import { formatRaceTime, ordinalSuffix } from '../game/format';
import { HudSnapshot, InputState } from '../game/types';

interface RaceHudProps {
  hud: HudSnapshot;
  muted: boolean;
  onCycleCamera: () => void;
  onToggleMute: () => void;
  onTogglePause: () => void;
  onTouchInput: (key: keyof InputState, pressed: boolean) => void;
}

export function RaceHud({
  hud,
  muted,
  onCycleCamera,
  onToggleMute,
  onTogglePause,
  onTouchInput,
}: RaceHudProps) {
  const pathD =
    hud.miniMapPath.length > 1
      ? `M ${hud.miniMapPath.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ')} Z`
      : '';

  const rpmBars = 14;
  const activeBars = Math.round(hud.rpmRatio * rpmBars);

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-4 md:p-6">
      {/* Top Row: Position/Lap/Timing (Left) + Minimap & Action Controls (Right) */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left Perimeter Telemetry */}
        <div className="rounded-lg border border-white/12 bg-[#0c1018]/84 px-4 py-3">
          <div className="flex items-baseline gap-4">
            <div className="flex items-baseline gap-1">
              <span className="font-display text-3xl font-extrabold text-amber-400 tabular-nums leading-none">
                {hud.position}
              </span>
              <span className="font-display text-xs font-bold text-amber-400/90">
                {ordinalSuffix(hud.position)}
              </span>
              <span className="ml-1 text-xs text-slate-400 tabular-nums">
                / {hud.totalCars}
              </span>
            </div>

            <span className="text-slate-600" aria-hidden="true">
              |
            </span>

            <div className="flex items-baseline gap-1.5">
              <span className="text-xs font-medium text-slate-400">LAP</span>
              <span className="font-display text-2xl font-bold text-white tabular-nums leading-none">
                {hud.lap}
              </span>
              <span className="text-xs text-slate-400 tabular-nums">
                / {hud.totalLaps}
              </span>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-3 text-xs text-slate-300 font-telemetry">
            <span>TIME {formatRaceTime(hud.currentLapTime)}</span>
            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>
            <span className="text-slate-400">
              BEST {hud.bestLapTime !== null ? formatRaceTime(hud.bestLapTime) : '--:--.--'}
            </span>
          </div>
        </div>

        {/* Top-Right Minimap Radar + Compact Utility Buttons */}
        <div className="flex items-start gap-3">
          <div className="hidden sm:block rounded-lg border border-white/12 bg-[#0c1018]/84 p-2">
            <svg viewBox="0 0 100 100" className="h-24 w-24">
              {pathD && (
                <path
                  d={pathD}
                  fill="none"
                  stroke="rgba(148, 163, 184, 0.38)"
                  strokeWidth="4.5"
                  strokeLinejoin="round"
                />
              )}
              {hud.racers.map((r) => (
                <circle
                  key={r.id}
                  cx={r.mapX}
                  cy={r.mapY}
                  r={r.isPlayer ? 4.4 : 2.8}
                  fill={r.isPlayer ? '#F59E0B' : r.color}
                  stroke={r.isPlayer ? '#FFFFFF' : '#0F172A'}
                  strokeWidth={r.isPlayer ? 1.4 : 0.8}
                />
              ))}
            </svg>
          </div>

          <div className="pointer-events-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={onCycleCamera}
              title={`Camera: ${hud.cameraMode} (C)`}
              aria-label="Switch camera angle"
              className="flex h-10 items-center gap-1.5 rounded-lg border border-white/12 bg-[#0c1018]/84 px-3 text-xs font-medium text-slate-200 transition-colors hover:bg-[#171f2e]"
            >
              <Camera className="h-4 w-4" />
              <span className="hidden md:inline capitalize">{hud.cameraMode}</span>
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/12 bg-[#0c1018]/84 text-slate-200 transition-colors hover:bg-[#171f2e]"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onTogglePause}
              aria-label="Pause race"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/12 bg-[#0c1018]/84 text-slate-200 transition-colors hover:bg-[#171f2e]"
            >
              <Pause className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Center-Top Transient Callouts (Countdown / Lap Split / Wrong Way) */}
      <div className="flex flex-col items-center justify-center gap-2">
        {hud.phase === 'countdown' && (
          <div className="rounded-lg border border-white/15 bg-[#0c1018]/90 px-8 py-4 text-center">
            <div className="font-display text-6xl font-extrabold text-amber-400 tabular-nums leading-none">
              {hud.countdownValue > 0 ? hud.countdownValue : 'GO'}
            </div>
          </div>
        )}

        {hud.phase === 'racing' && hud.lapBannerText && (
          <div className="rounded-lg border border-amber-400/40 bg-[#0c1018]/88 px-6 py-2.5 text-center">
            <span className="font-display text-2xl font-extrabold tracking-widest text-white">
              {hud.lapBannerText}
            </span>
          </div>
        )}

        {hud.wrongWay && (
          <div className="rounded-lg border border-red-500/70 bg-red-950/90 px-5 py-2 text-center">
            <span className="font-display text-lg font-bold tracking-wider text-red-200">
              WRONG WAY
            </span>
          </div>
        )}
      </div>

      {/* Bottom Row: Touch Controls (coarse pointer / small screens) + Right Digital Speedometer & Nitro */}
      <div className="flex items-end justify-between gap-4">
        {/* Touch Controls for mobile/tablet players */}
        <div className="pointer-events-auto flex items-end gap-2 md:hidden">
          <button
            type="button"
            onPointerDown={() => onTouchInput('left', true)}
            onPointerUp={() => onTouchInput('left', false)}
            onPointerLeave={() => onTouchInput('left', false)}
            onPointerCancel={() => onTouchInput('left', false)}
            className="flex h-14 w-14 items-center justify-center rounded-lg border border-white/20 bg-[#0c1018]/85 font-display text-lg font-bold text-white active:bg-amber-500 active:text-slate-950"
          >
            ◀
          </button>
          <button
            type="button"
            onPointerDown={() => onTouchInput('right', true)}
            onPointerUp={() => onTouchInput('right', false)}
            onPointerLeave={() => onTouchInput('right', false)}
            onPointerCancel={() => onTouchInput('right', false)}
            className="flex h-14 w-14 items-center justify-center rounded-lg border border-white/20 bg-[#0c1018]/85 font-display text-lg font-bold text-white active:bg-amber-500 active:text-slate-950"
          >
            ▶
          </button>
        </div>

        {/* Status Text Hints (Drafting / Drift) on Bottom-Left for desktop */}
        <div className="hidden md:flex items-center gap-3 text-xs font-medium text-slate-300/90">
          {hud.isDrafting && (
            <span className="rounded border border-sky-400/50 bg-[#0c1018]/85 px-2.5 py-1 text-sky-300">
              SLIPSTREAM +SPEED
            </span>
          )}
          {hud.isDrifting && (
            <span className="rounded border border-amber-400/50 bg-[#0c1018]/85 px-2.5 py-1 text-amber-300">
              DRIFT +NITRO
            </span>
          )}
        </div>

        {/* Touch Gas/Brake/Nitro + Digital Speedometer */}
        <div className="flex items-end gap-3">
          <div className="pointer-events-auto flex items-end gap-2 md:hidden">
            <button
              type="button"
              onPointerDown={() => onTouchInput('brake', true)}
              onPointerUp={() => onTouchInput('brake', false)}
              onPointerLeave={() => onTouchInput('brake', false)}
              onPointerCancel={() => onTouchInput('brake', false)}
              className="flex h-14 px-3.5 items-center justify-center rounded-lg border border-red-400/35 bg-[#0c1018]/85 font-display text-xs font-bold text-red-300 active:bg-red-500 active:text-white"
            >
              BRK
            </button>
            <button
              type="button"
              onPointerDown={() => onTouchInput('nitro', true)}
              onPointerUp={() => onTouchInput('nitro', false)}
              onPointerLeave={() => onTouchInput('nitro', false)}
              onPointerCancel={() => onTouchInput('nitro', false)}
              className="flex h-14 px-3.5 items-center justify-center rounded-lg border border-sky-400/35 bg-[#0c1018]/85 font-display text-xs font-bold text-sky-300 active:bg-sky-400 active:text-slate-950"
            >
              NOS
            </button>
            <button
              type="button"
              onPointerDown={() => onTouchInput('throttle', true)}
              onPointerUp={() => onTouchInput('throttle', false)}
              onPointerLeave={() => onTouchInput('throttle', false)}
              onPointerCancel={() => onTouchInput('throttle', false)}
              className="flex h-16 px-4 items-center justify-center rounded-lg border border-amber-400/50 bg-[#0c1018]/85 font-display text-xs font-bold text-amber-300 active:bg-amber-500 active:text-slate-950"
            >
              GAS
            </button>
          </div>

          {/* Bottom-Right Speedometer, Gear, RPM & Nitro */}
          <div className="rounded-lg border border-white/12 bg-[#0c1018]/86 px-4 py-3 min-w-[200px]">
            <div className="flex items-baseline justify-between gap-4">
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-4xl font-extrabold text-white tabular-nums leading-none">
                  {hud.speedKmh}
                </span>
                <span className="text-[11px] font-medium text-slate-400">KM/H</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-[11px] text-slate-400">GEAR</span>
                <span className="font-display text-xl font-bold text-amber-400 tabular-nums leading-none">
                  {hud.gear}
                </span>
              </div>
            </div>

            {/* Segmented RPM Bar */}
            <div className="mt-2.5 flex items-center gap-1" aria-label="Engine RPM">
              {Array.from({ length: rpmBars }).map((_, i) => {
                const lit = i < activeBars;
                const barColor =
                  i >= 11 ? 'bg-red-500' : i >= 8 ? 'bg-amber-400' : 'bg-slate-200';
                return (
                  <div
                    key={i}
                    className={`h-2 flex-1 rounded-[2px] ${
                      lit ? barColor : 'bg-white/10'
                    }`}
                  />
                );
              })}
            </div>

            {/* Nitro Bar */}
            <div className="mt-2.5 flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-wider text-sky-400">
                NITRO
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-[2px] bg-white/10">
                <div
                  className={`h-full transition-[width] duration-75 ${
                    hud.isBoosting ? 'bg-amber-400' : 'bg-sky-400'
                  }`}
                  style={{ width: `${hud.nitro}%` }}
                />
              </div>
              <span className="font-telemetry text-[11px] text-slate-300 w-7 text-right">
                {hud.nitro}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
