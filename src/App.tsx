/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { FinishModal, PauseModal } from './components/Modals';
import { RaceHud } from './components/RaceHud';
import { TitleOverlay } from './components/TitleOverlay';
import { RacingEngine } from './game/RacingEngine';
import { HudSnapshot, InputState, LIVERY_OPTIONS, TrackId } from './game/types';

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<RacingEngine | null>(null);

  const [selectedTrack, setSelectedTrack] = useState<TrackId>('coastal');
  const [selectedLivery, setSelectedLivery] = useState<string>(LIVERY_OPTIONS[0].id);
  const [muted, setMuted] = useState(false);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [hud, setHud] = useState<HudSnapshot | null>(null);

  useEffect(() => {
    const mountEl = mountRef.current;
    if (!mountEl) return;

    try {
      const engine = new RacingEngine(mountEl, (snapshot) => {
        setHud(snapshot);
      });
      engineRef.current = engine;
      return () => {
        engine.dispose();
        engineRef.current = null;
      };
    } catch (err) {
      setWebglError(
        err instanceof Error ? err.message : 'Unable to initialize 3D WebGL context.',
      );
    }
  }, []);

  const handleSelectTrack = useCallback((track: TrackId) => {
    setSelectedTrack(track);
    engineRef.current?.setTrack(track);
  }, []);

  const handleSelectLivery = useCallback((liveryId: string) => {
    setSelectedLivery(liveryId);
    engineRef.current?.setLivery(liveryId);
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      engineRef.current?.setMuted(next);
      return next;
    });
  }, []);

  const handleStartRace = useCallback(() => {
    engineRef.current?.startRace();
  }, []);

  const handleTogglePause = useCallback(() => {
    engineRef.current?.togglePause();
  }, []);

  const handleReturnToTitle = useCallback(() => {
    engineRef.current?.returnToTitle();
  }, []);

  const handleCycleCamera = useCallback(() => {
    engineRef.current?.cycleCamera();
  }, []);

  const handleTouchInput = useCallback((key: keyof InputState, pressed: boolean) => {
    engineRef.current?.setTouchInput(key, pressed);
  }, []);

  // Global keyboard shortcuts for Title / Finish / Mute
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'KeyM') {
        handleToggleMute();
        return;
      }
      if (hud?.phase === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        handleStartRace();
      } else if (hud?.phase === 'finished' && e.code === 'Enter') {
        e.preventDefault();
        handleStartRace();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hud?.phase, handleStartRace, handleToggleMute]);

  const phase = hud?.phase ?? 'title';

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0b0e14]">
      {/* Isolated WebGL mount container (never re-rendered by HUD state) */}
      <div ref={mountRef} className="absolute inset-0 h-full w-full" />

      {webglError && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0b0e14] p-6">
          <div className="max-w-md rounded-xl border border-white/15 bg-[#121722] p-6 text-center">
            <h1 className="font-display text-2xl font-bold text-white">
              3D Graphics Unavailable
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              WebGL could not be initialized in this browser ({webglError}).
            </p>
          </div>
        </div>
      )}

      {!webglError && phase === 'title' && (
        <TitleOverlay
          selectedTrack={selectedTrack}
          selectedLivery={selectedLivery}
          muted={muted}
          onSelectTrack={handleSelectTrack}
          onSelectLivery={handleSelectLivery}
          onToggleMute={handleToggleMute}
          onStartRace={handleStartRace}
        />
      )}

      {!webglError &&
        hud &&
        (phase === 'countdown' || phase === 'racing' || phase === 'paused') && (
          <RaceHud
            hud={hud}
            muted={muted}
            onCycleCamera={handleCycleCamera}
            onToggleMute={handleToggleMute}
            onTogglePause={handleTogglePause}
            onTouchInput={handleTouchInput}
          />
        )}

      {!webglError && phase === 'paused' && (
        <PauseModal
          onResume={handleTogglePause}
          onRestart={handleStartRace}
          onExitToTitle={handleReturnToTitle}
        />
      )}

      {!webglError && hud && phase === 'finished' && (
        <FinishModal
          hud={hud}
          onRaceAgain={handleStartRace}
          onExitToTitle={handleReturnToTitle}
        />
      )}
    </main>
  );
}
