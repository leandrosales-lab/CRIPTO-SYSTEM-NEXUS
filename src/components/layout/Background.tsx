import { useEffect, useRef } from 'react';

export default function Background() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let W = window.innerWidth, H = window.innerHeight;

    const resize = () => {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    type Particle = { x: number; y: number; vx: number; vy: number; r: number; opacity: number; };

    const N = 60;
    const particles: Particle[] = Array.from({ length: N }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 1.2 + 0.3,
      opacity: Math.random() * 0.4 + 0.08,
    }));

    const LINK_DIST = 140;
    const CYAN = '34, 211, 238';
    const PURPLE = '139, 92, 246';

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // Ambient radial glows
      const g1 = ctx.createRadialGradient(W * 0.15, H * 0.2, 0, W * 0.15, H * 0.2, W * 0.35);
      g1.addColorStop(0, 'rgba(34,211,238,0.045)'); g1.addColorStop(1, 'transparent');
      ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);

      const g2 = ctx.createRadialGradient(W * 0.85, H * 0.75, 0, W * 0.85, H * 0.75, W * 0.3);
      g2.addColorStop(0, 'rgba(139,92,246,0.035)'); g2.addColorStop(1, 'transparent');
      ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);

      const g3 = ctx.createRadialGradient(W * 0.5, H * 0.9, 0, W * 0.5, H * 0.9, W * 0.25);
      g3.addColorStop(0, 'rgba(16,185,129,0.025)'); g3.addColorStop(1, 'transparent');
      ctx.fillStyle = g3; ctx.fillRect(0, 0, W, H);

      // Particle connections
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < LINK_DIST) {
            const a = (1 - dist / LINK_DIST) * 0.15;
            const color = dist < LINK_DIST * 0.5 ? CYAN : PURPLE;
            ctx.strokeStyle = `rgba(${color},${a})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Particles
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${CYAN},${p.opacity})`;
        ctx.fill();

        // Soft halo
        const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
        halo.addColorStop(0, `rgba(${CYAN},${p.opacity * 0.3})`);
        halo.addColorStop(1, 'transparent');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 5, 0, Math.PI * 2);
        ctx.fill();

        p.x += p.vx; p.y += p.vy;
        if (p.x < -20) p.x = W + 20;
        if (p.x > W + 20) p.x = -20;
        if (p.y < -20) p.y = H + 20;
        if (p.y > H + 20) p.y = -20;
      }

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 0, opacity: 0.85 }}
      />
      <div className="scan-line" />
    </>
  );
}
