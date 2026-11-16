import { Play, Volume2, VolumeX } from 'lucide-react';
import { TRACK_CONFIGS } from '../game/tracks';
import { LIVERY_OPTIONS, TrackId } from '../game/types';

interface TitleOverlayProps {
  selectedTrack: TrackId;
  selectedLivery: string;
  muted: boolean;
  onSelectTrack: (track: TrackId) => void;
  onSelectLivery: (liveryId: string) => void;
  onToggleMute: () => void;
  onStartRace: () => void;
}

export function TitleOverlay({
  selectedTrack,
  selectedLivery,
  muted,
  onSelectTrack,
  onSelectLivery,
  onToggleMute,
  onStartRace,
}: TitleOverlayProps) {
  const tracks = Object.values(TRACK_CONFIGS);

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-6 md:p-10">
      {/* Subtle left atmospheric scrim so typography stays crisp against sunlit sky without covering the live 3D track */}
      <div
        className="pointer-events-none fixed inset-y-0 left-0 w-full max-w-[540px]"
        style={{
          background:
            'linear-gradient(90deg, rgba(10,14,22,0.82) 0%, rgba(10,14,22,0.52) 62%, rgba(10,14,22,0) 100%)',
        }}
      />

      {/* Top Row: Bespoke inline SVG Title Lockup & Mute Toggle */}
      <div className="relative flex items-start justify-between">
        <div className="pointer-events-auto max-w-md pt-2">
          <svg
            viewBox="0 0 380 84"
            className="h-16 w-auto md:h-20"
            role="img"
            aria-label="Apex Circuit"
          >
            {/* Aerodynamic chevron crest */}
            <polygon points="4,64 28,16 44,16 20,64" fill="#EF4444" />
            <polygon points="28,64 46,28 58,28 40,64" fill="#F59E0B" />
            <text
              x="68"
              y="46"
              fill="#F8FAFC"
              fontFamily="Oxanium, sans-serif"
              fontWeight="800"
              fontSize="40"
              letterSpacing="2"
            >
              APEX
            </text>
            <text
              x="68"
              y="72"
              fill="#CBD5E1"
              fontFamily="Oxanium, sans-serif"
              fontWeight="700"
              fontSize="21"
              letterSpacing="7"
            >
              CIRCUIT
            </text>
          </svg>
          <p className="mt-2 text-sm text-slate-300/90 max-w-sm leading-relaxed">
            Three-lap Grand Prix sprint across sunlit coastal harbor bends and desert sandstone mesas.
          </p>
        </div>

        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? 'Unmute audio' : 'Mute audio'}
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-lg border border-white/15 bg-[#0c1018]/85 text-slate-200 transition-colors hover:bg-[#161d2b] focus-visible:outline-2 focus-visible:outline-amber-400"
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      </div>

      {/* Bottom-Left Setup Cluster + Start CTA + Flat Control Line */}
      <div className="relative flex flex-col items-start gap-5 max-w-md">
        {/* Track Selector */}
        <div className="pointer-events-auto w-full">
          <div className="mb-2 text-xs font-medium tracking-wider text-slate-400">
            Select Circuit
          </div>
          <div className="grid grid-cols-2 gap-2">
            {tracks.map((t) => {
              const active = selectedTrack === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectTrack(t.id)}
                  className={`flex flex-col items-start rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
                    active
                      ? 'border-amber-400/90 bg-[#141b29]/95 text-white'
                      : 'border-white/12 bg-[#0c1018]/80 text-slate-300 hover:border-white/30 hover:text-white'
                  }`}
                >
                  <span className="font-display text-sm font-bold whitespace-nowrap">
                    {t.name}
                  </span>
                  <span className="mt-0.5 text-[11px] text-slate-400 truncate w-full">
                    {t.laps} Laps · {t.id === 'coastal' ? 'Harbor' : 'Mesa'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Livery Swatches */}
        <div className="pointer-events-auto flex items-center gap-3">
          <span className="text-xs font-medium text-slate-400">Livery</span>
          <div className="flex items-center gap-2">
            {LIVERY_OPTIONS.map((liv) => {
              const active = selectedLivery === liv.id;
              return (
                <button
                  key={liv.id}
                  type="button"
                  onClick={() => onSelectLivery(liv.id)}
                  title={liv.name}
                  aria-label={`Select ${liv.name} livery`}
                  className={`h-8 w-8 rounded-md border-2 transition-transform ${
                    active ? 'scale-110 border-white' : 'border-white/20 hover:scale-105'
                  }`}
                  style={{
                    background: `linear-gradient(135deg, ${liv.primary} 65%, ${liv.accent} 65%)`,
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Primary CTA */}
        <div className="pointer-events-auto flex items-center gap-4">
          <button
            type="button"
            onClick={onStartRace}
            className="flex items-center gap-2.5 rounded-lg bg-amber-500 px-7 py-3.5 font-display text-base font-bold tracking-wide text-slate-950 transition-colors hover:bg-amber-400 active:bg-amber-600 focus-visible:outline-2 focus-visible:outline-white whitespace-nowrap"
          >
            <Play className="h-4 w-4 fill-current" />
            Start Race
          </button>
          <span className="text-xs text-slate-400 whitespace-nowrap">
            Press Enter to launch
          </span>
        </div>

        {/* Single flat control-hint line */}
        <div className="text-xs text-slate-300/85 tracking-wide">
          WASD / Arrows Drive · Space Drift · Shift Nitro · C Camera · Esc Pause
        </div>
      </div>
    </div>
  );
}
