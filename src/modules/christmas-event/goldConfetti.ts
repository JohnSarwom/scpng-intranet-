import confetti from 'canvas-confetti';

const GOLD = ['#fff6d5', '#f7dc8b', '#ecc56a', '#d9a845', '#b8862b', '#fffbea'];

const rand = (min: number, max: number) => Math.random() * (max - min) + min;

/** Gold confetti drawn on a canvas inside the invitation overlay. */
export function createGoldConfetti(canvas: HTMLCanvasElement) {
  const fire = confetti.create(canvas, { resize: true, useWorker: false, disableForReducedMotion: true });
  let drizzle: number | null = null;

  return {
    /** A burst from one point (x and y are 0..1 of the screen). */
    burst(origin: { x: number; y: number } = { x: 0.5, y: 0.5 }, power = 1) {
      fire({
        particleCount: Math.round(110 * power),
        spread: 360,
        startVelocity: 26 * power,
        decay: 0.92,
        gravity: 0.7,
        ticks: 240,
        scalar: 0.9,
        origin,
        colors: GOLD,
        shapes: ['circle', 'square', 'star'],
      });
    },
    /** Two cannons from the lower corners, for the grand moments. */
    cannons(power = 1) {
      const common = {
        particleCount: Math.round(90 * power),
        spread: 62,
        startVelocity: 58,
        decay: 0.91,
        gravity: 0.85,
        ticks: 320,
        scalar: 1.05,
        colors: GOLD,
        shapes: ['square', 'circle', 'star'] as confetti.Shape[],
      };
      fire({ ...common, angle: 58, origin: { x: -0.02, y: 0.92 } });
      fire({ ...common, angle: 122, origin: { x: 1.02, y: 0.92 } });
    },
    /** A slow fall of gold glitter until stopped. */
    startDrizzle() {
      if (drizzle !== null) return;
      drizzle = window.setInterval(() => {
        fire({
          particleCount: 1,
          startVelocity: 0,
          ticks: 520,
          gravity: rand(0.25, 0.45),
          drift: rand(-0.35, 0.35),
          scalar: rand(0.45, 0.85),
          origin: { x: Math.random(), y: -0.04 },
          colors: GOLD,
          shapes: ['circle', 'square'],
        });
      }, 140);
    },
    stopDrizzle() {
      if (drizzle !== null) window.clearInterval(drizzle);
      drizzle = null;
    },
    reset() {
      if (drizzle !== null) window.clearInterval(drizzle);
      drizzle = null;
      fire.reset();
    },
  };
}

export type GoldConfetti = ReturnType<typeof createGoldConfetti>;
