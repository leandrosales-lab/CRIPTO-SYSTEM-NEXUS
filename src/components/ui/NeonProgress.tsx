interface NeonProgressProps {
  value: number;
  max?: number;
  color?: 'cyan' | 'green' | 'red' | 'amber';
  label?: string;
  showValue?: boolean;
  height?: number;
}

const gradientMap = {
  cyan:  'linear-gradient(90deg, #0891b2, #22D3EE)',
  green: 'linear-gradient(90deg, #059669, #34D399)',
  red:   'linear-gradient(90deg, #be123c, #F43F5E)',
  amber: 'linear-gradient(90deg, #d97706, #FBBF24)',
};
const glowMap = {
  cyan:  '#22D3EE',
  green: '#34D399',
  red:   '#F43F5E',
  amber: '#FBBF24',
};

export default function NeonProgress({ value, max = 100, color = 'cyan', label, showValue = false, height = 4 }: NeonProgressProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const gradient = gradientMap[color];
  const glow = glowMap[color];
  return (
    <div className="w-full">
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-1">
          {label && <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">{label}</span>}
          {showValue && <span className="text-[9px] font-mono text-slate-300">{value.toFixed(1)}{max === 100 ? '%' : ''}</span>}
        </div>
      )}
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height, background: 'rgba(255,255,255,0.06)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: gradient,
            boxShadow: pct > 5 ? `0 0 6px ${glow}55` : 'none',
          }}
        />
      </div>
    </div>
  );
}
