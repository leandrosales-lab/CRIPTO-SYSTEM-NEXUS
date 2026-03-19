import { useEffect, useRef } from 'react';
import { useStore } from '../../store/useStore';

export default function EquityChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { equityCurve, capital } = useStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;

    ctx.clearRect(0, 0, W, H);

    const points = equityCurve.length > 1 ? equityCurve : [
      { time: Date.now() - 3600000, value: 100 },
      { time: Date.now() - 2400000, value: 101.2 },
      { time: Date.now() - 1800000, value: 99.8 },
      { time: Date.now() - 1200000, value: 102.4 },
      { time: Date.now() - 600000,  value: 101.9 },
      { time: Date.now(),           value: capital },
    ];

    const values = points.map(p => p.value);
    const minVal = Math.min(...values) * 0.998;
    const maxVal = Math.max(...values) * 1.002;
    const range = maxVal - minVal || 1;
    const pad = { top: 20, right: 20, bottom: 28, left: 56 };
    const isProfit = capital >= 100;
    const lineColor = isProfit ? '#34D399' : '#F43F5E';

    const toX = (i: number) => pad.left + (i / Math.max(1, points.length - 1)) * (W - pad.left - pad.right);
    const toY = (v: number) => pad.top + (1 - (v - minVal) / range) * (H - pad.top - pad.bottom);

    // Grid horizontal lines
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (i / 4) * (H - pad.top - pad.bottom);
      const val = maxVal - (i / 4) * range;
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(W - pad.right, y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(148,163,184,0.5)';
      ctx.font = `9px 'JetBrains Mono', monospace`;
      ctx.textAlign = 'right';
      ctx.fillText(`$${val.toFixed(2)}`, pad.left - 6, y + 3);
    }
    ctx.textAlign = 'left';

    // Baseline $100
    if (minVal < 100 && maxVal > 100) {
      const baseY = toY(100);
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = 'rgba(148,163,184,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.left, baseY);
      ctx.lineTo(W - pad.right, baseY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(148,163,184,0.3)';
      ctx.font = `8px 'JetBrains Mono', monospace`;
      ctx.fillText('$100', W - pad.right + 4, baseY + 3);
    }

    if (points.length < 2) return;

    // Fill gradient under curve
    const grad = ctx.createLinearGradient(0, pad.top, 0, H - pad.bottom);
    grad.addColorStop(0, isProfit ? 'rgba(52,211,153,0.2)' : 'rgba(244,63,94,0.2)');
    grad.addColorStop(0.7, isProfit ? 'rgba(52,211,153,0.03)' : 'rgba(244,63,94,0.03)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.beginPath();
    ctx.moveTo(toX(0), toY(points[0].value));
    for (let i = 1; i < points.length; i++) {
      const cpx = (toX(i - 1) + toX(i)) / 2;
      ctx.bezierCurveTo(cpx, toY(points[i - 1].value), cpx, toY(points[i].value), toX(i), toY(points[i].value));
    }
    ctx.lineTo(toX(points.length - 1), H - pad.bottom);
    ctx.lineTo(toX(0), H - pad.bottom);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Main line
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(points[0].value));
    for (let i = 1; i < points.length; i++) {
      const cpx = (toX(i - 1) + toX(i)) / 2;
      ctx.bezierCurveTo(cpx, toY(points[i - 1].value), cpx, toY(points[i].value), toX(i), toY(points[i].value));
    }
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.shadowColor = lineColor;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Last point dot
    const lx = toX(points.length - 1);
    const ly = toY(points[points.length - 1].value);
    ctx.beginPath();
    ctx.arc(lx, ly, 5, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.shadowColor = lineColor;
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Inner dot
    ctx.beginPath();
    ctx.arc(lx, ly, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

  }, [equityCurve, capital]);

  const pnl = capital - 100;
  const pnlPct = ((capital - 100) / 100) * 100;
  const isProfit = pnl >= 0;

  return (
    <div
      className="w-full h-full flex flex-col overflow-hidden rounded-xl"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.05] flex-shrink-0">
        <div className="flex items-center gap-4">
          <span
            className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase"
            style={{ fontFamily: "'Orbitron', sans-serif" }}
          >
            Curva de Capital
          </span>
          <div className="flex items-center gap-3 text-[9px] font-mono text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-4 h-px inline-block" style={{ background: isProfit ? '#34D399' : '#F43F5E' }} />
              P&L
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-px inline-block" style={{ background: 'rgba(148,163,184,0.3)', borderTop: '1px dashed rgba(148,163,184,0.3)' }} />
              Base $100
            </span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[9px] font-mono text-slate-500 leading-none mb-0.5">PORTFÓLIO</div>
            <div className="text-sm font-mono font-bold text-slate-100">${capital.toFixed(2)}</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] font-mono text-slate-500 leading-none mb-0.5">RETORNO</div>
            <div className={`text-sm font-mono font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isProfit ? '+' : ''}{pnlPct.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 p-2 min-h-0">
        <canvas ref={canvasRef} className="w-full h-full" style={{ display: 'block' }} />
      </div>
    </div>
  );
}
