import React, { useEffect, useRef } from 'react';

export type SnowEffect = 'repel' | 'attract' | 'swirl';

interface Props {
  /** Snowflakes on a desktop screen (halved on screens narrower than 768px). */
  density?: number;
  /** Multiplier for how fast the snow falls. */
  speed?: number;
  /** How close the pointer must be, in pixels, to move a snowflake. */
  interactionRadius?: number;
  /** How strongly the pointer pushes or pulls the snow. */
  interactionStrength?: number;
  /** What the snow does near the pointer. */
  effect?: SnowEffect;
  enabled?: boolean;
  /** 0..1, multiplies each flake's own opacity. */
  opacity?: number;
  zIndex?: number;
}

interface Flake {
  x: number;
  y: number;
  radius: number;
  fallSpeed: number;
  velocityX: number;
  velocityY: number;
  opacity: number;
  phase: number;
  drift: number;
}

/**
 * Falling snow drawn on a full-screen canvas that reacts to the mouse or a
 * finger: flakes near the pointer are pushed away (or pulled in, or swirled).
 * The canvas never takes clicks, and nothing is drawn for people who prefer
 * reduced motion.
 */
export default function ChristmasSnowfall({
  density = 150,
  speed = 1,
  interactionRadius = 120,
  interactionStrength = 1.5,
  effect = 'repel',
  enabled = true,
  opacity = 0.9,
  zIndex = 10,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let animationId = 0;
    let lastTime = 0;
    let time = 0;
    const pointer = { x: -10000, y: -10000 };

    // Sharp on high-density screens, capped at 2x to keep it light.
    const resizeCanvas = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const createSnowflake = (): Flake => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: 0.8 + Math.random() * 2.8,
      fallSpeed: 0.4 + Math.random() * 1.2,
      velocityX: 0,
      velocityY: 0,
      opacity: 0.3 + Math.random() * 0.7,
      phase: Math.random() * Math.PI * 2,
      drift: 0.2 + Math.random() * 0.5,
    });

    resizeCanvas();
    const count = width < 768 ? Math.floor(density * 0.5) : density;
    const flakes: Flake[] = Array.from({ length: count }, createSnowflake);

    const handlePointerMove = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    };
    const resetPointer = () => {
      pointer.x = -10000;
      pointer.y = -10000;
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerdown', handlePointerMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', resetPointer);
    window.addEventListener('pointercancel', resetPointer);
    window.addEventListener('blur', resetPointer);
    window.addEventListener('resize', resizeCanvas);

    const animate = (timestamp: number) => {
      // Frame-rate independent: 1 = one 60 fps frame; capped after a pause.
      const delta = lastTime ? Math.min((timestamp - lastTime) / 16.67, 2) : 1;
      lastTime = timestamp;
      time += 0.012 * delta;
      const damping = Math.pow(0.94, delta);

      ctx.clearRect(0, 0, width, height);

      for (const flake of flakes) {
        const dx = flake.x - pointer.x;
        const dy = flake.y - pointer.y;
        const distance = Math.hypot(dx, dy);

        if (distance < interactionRadius && distance > 0.1) {
          const force = (1 - distance / interactionRadius) * interactionStrength * delta;
          const angle = Math.atan2(dy, dx);
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          if (effect === 'repel') {
            flake.velocityX += cos * force;
            flake.velocityY += sin * force;
          } else if (effect === 'attract') {
            flake.velocityX -= cos * force;
            flake.velocityY -= sin * force;
          } else {
            flake.velocityX += (-sin + cos * 0.25) * force;
            flake.velocityY += (cos + sin * 0.25) * force;
          }
        }

        flake.velocityX *= damping;
        flake.velocityY *= damping;
        flake.x += (flake.velocityX + Math.sin(time + flake.phase) * flake.drift) * delta;
        flake.y += (flake.fallSpeed * speed + flake.velocityY) * delta;

        // Recycle flakes that leave the screen.
        if (flake.y > height + 10) {
          flake.y = -10;
          flake.x = Math.random() * width;
        }
        if (flake.y < -30) flake.y = height + 5;
        if (flake.x > width + 10) flake.x = -10;
        if (flake.x < -10) flake.x = width + 10;

        ctx.beginPath();
        ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${flake.opacity * opacity})`;
        ctx.fill();
      }

      animationId = requestAnimationFrame(animate);
    };
    animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerdown', handlePointerMove);
      document.documentElement.removeEventListener('pointerleave', resetPointer);
      window.removeEventListener('pointercancel', resetPointer);
      window.removeEventListener('blur', resetPointer);
      window.removeEventListener('resize', resizeCanvas);
      ctx.clearRect(0, 0, width, height);
    };
  }, [density, speed, interactionRadius, interactionStrength, effect, enabled, opacity]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex,
      }}
    />
  );
}
