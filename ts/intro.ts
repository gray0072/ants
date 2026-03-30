import { CONFIG } from './config';
import { STATE } from './state';
import { Renderer } from './render';

const CELL  = CONFIG.CELL;
const MAP_W = CONFIG.COLS * CELL;

// Phase durations (ms)
const FLIGHT_MS = 2800;
const SHAKE_MS  =  700;   // trembling on touchdown
const SHED_MS   =  650;   // wings detach and fall
const WALK_MS   =  900;   // walk to nest entrance
const DIG_MS    = 1100;   // descend to chamber

let _introCleanup: (() => void) | null = null;

export const IntroModule = {
  play(onDone: () => void): void {
    const nestX  = STATE.nestCol * CELL + CELL / 2;
    const nestY  = STATE.nestRow * CELL + CELL / 2;

    // Landing spot: 5 cells to the right of the nest column, on top surface row
    const landX = (STATE.nestCol + 5) * CELL + CELL / 2;
    const landY = (STATE.surfaceRows - 1) * CELL + CELL / 2;

    // Spiral start: upper-right corner, outside the viewport
    const dx0 = (MAP_W + 80) - landX;
    const dy0 = -60 - landY;
    const R0  = Math.sqrt(dx0 * dx0 + dy0 * dy0);
    const a0  = Math.atan2(dy0, dx0);
    const LOOPS = 2.0;

    let rafId      = 0;
    let phaseStart = -1;
    let phase: 'fly' | 'shake' | 'shed' | 'walk' | 'dig' = 'fly';
    let landRot0   = 0;   // rotation at end of flight (for smooth landing turn)
    let skipped    = false;

    const onSkip = (): void => { skipped = true; };
    document.addEventListener('keydown',     onSkip);
    document.addEventListener('pointerdown', onSkip);

    function cleanup(): void {
      cancelAnimationFrame(rafId);
      document.removeEventListener('keydown',     onSkip);
      document.removeEventListener('pointerdown', onSkip);
      Renderer.setIntroQueen(null);
      _introCleanup = null;
    }
    _introCleanup = cleanup;

    function spiral(t: number): { x: number; y: number } {
      const radius = R0 * Math.pow(1 - t, 1.4);
      const angle  = a0 + LOOPS * Math.PI * 2 * t;
      return { x: landX + radius * Math.cos(angle), y: landY + radius * Math.sin(angle) };
    }

    function frame(now: number): void {
      if (phaseStart < 0) phaseStart = now;

      if (skipped) { cleanup(); onDone(); return; }

      const dt = now - phaseStart;

      // ── FLY: spiral in to landing spot ───────────────────────────────────
      if (phase === 'fly') {
        const t   = Math.min(dt / FLIGHT_MS, 1);
        const pos = spiral(t);
        const fwd = spiral(Math.min(t + 0.008, 1));
        const rot = Math.atan2(fwd.y - pos.y, fwd.x - pos.x) + Math.PI / 2;

        Renderer.setIntroQueen({
          x: pos.x, y: pos.y, rotation: rot,
          hasWings: true, wingPhase: dt / 200, wingAlpha: 1, scale: 1.5,
        });

        if (t >= 1) {
          phase = 'shake'; phaseStart = now; landRot0 = rot;
        }

      // ── SHAKE: queen trembles on touchdown ───────────────────────────────
      } else if (phase === 'shake') {
        const t    = Math.min(dt / SHAKE_MS, 1);
        // Rotation smoothly levels out to facing-down (π)
        let diff = Math.PI - landRot0;
        while (diff >  Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const rot  = landRot0 + diff * Math.min(1, t * 3);

        // Sinusoidal shake that decays toward end of phase
        const shakeAmp = 2.0 * (1 - t * 0.6);
        const shakeX   = Math.sin(dt * 0.045) * shakeAmp;

        Renderer.setIntroQueen({
          x: landX + shakeX, y: landY, rotation: rot,
          hasWings: true, wingPhase: dt / 200, wingAlpha: 1, scale: 1.0,
        });

        if (t >= 1) { phase = 'shed'; phaseStart = now; }

      // ── SHED: wings detach and fall flat ─────────────────────────────────
      } else if (phase === 'shed') {
        const t = Math.min(dt / SHED_MS, 1);

        // Slight residual shake at start, settling quickly
        const shakeX = Math.sin(dt * 0.05) * 1.5 * Math.max(0, 1 - t * 3);

        // Attached wings fade out in first half; fallen wings appear in second half
        const attachedAlpha = Math.max(0, 1 - t * 2.5);
        const fallenAlpha   = Math.min(1, Math.max(0, t * 2.0 - 0.4));

        Renderer.setIntroQueen({
          x: landX + shakeX, y: landY, rotation: Math.PI,
          hasWings: attachedAlpha > 0, wingPhase: dt / 200, wingAlpha: attachedAlpha,
          scale: 1.0,
          fallenX: landX, fallenY: landY, fallenAlpha,
        });

        if (t >= 1) { phase = 'walk'; phaseStart = now; }

      // ── WALK: walk horizontally to nest tunnel entrance ──────────────────
      } else if (phase === 'walk') {
        const t    = Math.min(dt / WALK_MS, 1);
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        const x    = landX + (nestX - landX) * ease;

        // Leg animation: slight bob
        const bob = Math.sin(t * Math.PI * 8) * 0.4;

        Renderer.setIntroQueen({
          x, y: landY + bob, rotation: -Math.PI / 2,  // facing left toward nest
          hasWings: false, wingPhase: 0, wingAlpha: 0, scale: 1.0,
          fallenX: landX, fallenY: landY, fallenAlpha: 1,
        });

        if (t >= 1) { phase = 'dig'; phaseStart = now; }

      // ── DIG: descend through tunnel to chamber ───────────────────────────
      } else {
        const t    = Math.min(dt / DIG_MS, 1);
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        const y    = landY + (nestY - landY) * ease;

        Renderer.setIntroQueen({
          x: nestX, y, rotation: Math.PI,
          hasWings: false, wingPhase: 0, wingAlpha: 0, scale: 1.0,
          fallenX: landX, fallenY: landY, fallenAlpha: 1,
        });

        if (t >= 1) { cleanup(); onDone(); return; }
      }

      Renderer.render();
      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);
  },

  cancel(): void {
    _introCleanup?.();
  },
};
