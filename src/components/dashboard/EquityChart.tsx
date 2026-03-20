import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/useStore';

// ─── Paleta MD dark ───────────────────────────────────────────────────────────
const C = {
  bg:          '#111417',
  surface:     '#1d2023',
  surfaceHigh: '#272a2e',
  primary:     '#4cd6ff',
  green:       '#00e297',
  red:         '#ffb4ab',
  text:        '#e1e2e7',
  dim:         '#bbc9cf',
  outline:     '#3c494e',
} as const;

type Period = '7D' | '30D' | '90D';

interface Props {
  height?: number;
}

export default function EquityChart({ height = 180 }: Props) {
  const canvasRef                     = useRef<HTMLCanvasElement>(null);
  const { equityCurve, capital }      = useStore();
  const [period, setPeriod]           = useState<Period>('30D');

  const pnl      = capital - 100;
  const pnlPct   = ((capital - 100) / 100) * 100;
  const isProfit = pnl >= 0;
  const lineColor = isProfit ? C.green : C.red;

  // Filtrar pontos pelo período selecionado
  const cutoffMs: Record<Period, number> = {
    '7D':  7  * 24 * 3600 * 1000,
    '30D': 30 * 24 * 3600 * 1000,
    '90D': 90 * 24 * 3600 * 1000,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr  = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width  = rect.width  * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;

    ctx.clearRect(0, 0, W, H);

    const now    = Date.now();
    const cutoff = now - cutoffMs[period];

    const raw = equityCurve.filter(p => p.time >= cutoff);
    const points =
      raw.length > 1
        ? raw
        : [
            { time: now - 3600000 * 6, value: 100 },
            { time: now - 3600000 * 5, value: 101.2 },
            { time: now - 3600000 * 4, value: 99.8 },
            { time: now - 3600000 * 3, value: 102.4 },
            { time: now - 3600000 * 2, value: 101.9 },
            { time: now - 3600000,     value: 103.1 },
            { time: now,               value: capital || 102.5 },
          ];

    const values = points.map(p => p.value);
    const minVal = Math.min(...values) * 0.998;
    const maxVal = Math.max(...values) * 1.002;
    const range  = maxVal - minVal || 1;
    const pad    = { top: 16, right: 16, bottom: 24, left: 50 };

    const toX = (i: number) =>
      pad.left + (i / Math.max(1, points.length - 1)) * (W - pad.left - pad.right);
    const toY = (v: number) =>
      pad.top + (1 - (v - minVal) / range) * (H - pad.top - pad.bottom);

    // ── Grid horizontal muito sutil ─────────────────────────────────────────
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const y   = pad.top + (i / gridLines) * (H - pad.top - pad.bottom);
      const val = maxVal - (i / gridLines) * range;

      ctx.strokeStyle = 'rgba(60,73,78,0.5)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([3, 6]);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(W - pad.right, y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(187,201,207,0.45)';
      ctx.font      = `9px 'Inter', monospace`;
      ctx.textAlign = 'right';
      ctx.fillText(`$${val.toFixed(0)}`, pad.left - 6, y + 3);
    }
    ctx.textAlign = 'left';

    // ── Linha de base $100 ───────────────────────────────────────────────────
    if (minVal < 100 && maxVal > 100) {
      const baseY = toY(100);
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = 'rgba(187,201,207,0.2)';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(pad.left, baseY);
      ctx.lineTo(W - pad.right, baseY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (points.length < 2) return;

    // ── Gradiente sob a curva ─────────────────────────────────────────────────
    const grad = ctx.createLinearGradient(0, pad.top, 0, H - pad.bottom);
    grad.addColorStop(0,   isProfit ? 'rgba(0,226,151,0.15)'  : 'rgba(255,180,171,0.15)');
    grad.addColorStop(0.6, isProfit ? 'rgba(0,226,151,0.04)'  : 'rgba(255,180,171,0.04)');
    grad.addColorStop(1,   'rgba(0,0,0,0)');

    ctx.beginPath();
    ctx.moveTo(toX(0), toY(points[0].value));
    for (let i = 1; i < points.length; i++) {
      const cpx = (toX(i - 1) + toX(i)) / 2;
      ctx.bezierCurveTo(
        cpx, toY(points[i - 1].value),
        cpx, toY(points[i].value),
        toX(i), toY(points[i].value),
      );
    }
    ctx.lineTo(toX(points.length - 1), H - pad.bottom);
    ctx.lineTo(toX(0), H - pad.bottom);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // ── Linha principal ───────────────────────────────────────────────────────
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(points[0].value));
    for (let i = 1; i < points.length; i++) {
      const cpx = (toX(i - 1) + toX(i)) / 2;
      ctx.bezierCurveTo(
        cpx, toY(points[i - 1].value),
        cpx, toY(points[i].value),
        toX(i), toY(points[i].value),
      );
    }
    ctx.strokeStyle  = lineColor;
    ctx.lineWidth    = 2;
    ctx.shadowColor  = lineColor;
    ctx.shadowBlur   = 8;
    ctx.stroke();
    ctx.shadowBlur   = 0;

    // ── Ponto final ───────────────────────────────────────────────────────────
    const lx = toX(points.length - 1);
    const ly = toY(points[points.length - 1].value);

    ctx.beginPath();
    ctx.arc(lx, ly, 5, 0, Math.PI * 2);
    ctx.fillStyle   = lineColor;
    ctx.shadowColor = lineColor;
    ctx.shadowBlur  = 14;
    ctx.fill();
    ctx.shadowBlur  = 0;

    ctx.beginPath();
    ctx.arc(lx, ly, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

  }, [equityCurve, capital, period]);

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 12,
        overflow: 'hidden',
        background: C.surface,
        border: `1px solid ${C.outline}`,
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: `1px solid ${C.outline}`,
          flexShrink: 0,
          background: '#0b0e11',
        }}
      >
        {/* Título + selector de período */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: C.text,
            }}
          >
            Curva de Performance
          </span>
          {/* Selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              background: C.surfaceHigh,
              borderRadius: 6,
              padding: 2,
            }}
          >
            {(['7D', '30D', '90D'] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  cursor: 'pointer',
                  border: 'none',
                  transition: 'all 0.15s',
                  background:
                    period === p ? C.primary + '22' : 'transparent',
                  color: period === p ? C.primary : C.dim,
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Métricas resumidas */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: 9,
                color: C.dim,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginBottom: 2,
              }}
            >
              Portfólio
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: C.text,
                fontVariantNumeric: 'tabular-nums',
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              ${capital.toFixed(2)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: 9,
                color: C.dim,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginBottom: 2,
              }}
            >
              Retorno
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: isProfit ? C.green : C.red,
                fontVariantNumeric: 'tabular-nums',
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              {isProfit ? '+' : ''}
              {pnlPct.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      {/* ── Canvas ── */}
      <div
        style={{
          position: 'relative',
          padding: '8px 4px 4px',
          minHeight: height,
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            width: '100%',
            height: height,
          }}
        />

        {/* Badge PNL no canto inferior direito */}
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            right: 16,
            padding: '4px 10px',
            borderRadius: 6,
            background: isProfit ? C.green + '18' : C.red + '18',
            border: `1px solid ${isProfit ? C.green + '44' : C.red + '44'}`,
            fontSize: 11,
            fontWeight: 700,
            color: isProfit ? C.green : C.red,
            fontFamily: "'Space Grotesk', sans-serif",
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '0.04em',
          }}
        >
          {isProfit ? '+' : ''}${pnl.toFixed(2)}
        </div>
      </div>
    </div>
  );
}
