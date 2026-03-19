interface GlowBadgeProps {
  label: string;
  color?: 'cyan' | 'green' | 'red' | 'amber' | 'purple';
  size?: 'xs' | 'sm';
  dot?: boolean;
}

const colorMap: Record<string, { text: string; bg: string; border: string; dot: string }> = {
  cyan:   { text: 'text-cyan-400',    bg: 'rgba(34,211,238,0.08)',   border: 'rgba(34,211,238,0.3)',  dot: '#22D3EE' },
  green:  { text: 'text-emerald-400', bg: 'rgba(52,211,153,0.08)',   border: 'rgba(52,211,153,0.3)',  dot: '#34D399' },
  red:    { text: 'text-rose-400',    bg: 'rgba(244,63,94,0.08)',    border: 'rgba(244,63,94,0.3)',   dot: '#F43F5E' },
  amber:  { text: 'text-amber-400',   bg: 'rgba(251,191,36,0.08)',   border: 'rgba(251,191,36,0.3)',  dot: '#FBBF24' },
  purple: { text: 'text-violet-400',  bg: 'rgba(139,92,246,0.08)',   border: 'rgba(139,92,246,0.3)',  dot: '#8B5CF6' },
};

export default function GlowBadge({ label, color = 'cyan', size = 'xs', dot = false }: GlowBadgeProps) {
  const c = colorMap[color];
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono font-semibold uppercase tracking-widest rounded-md ${c.text} ${size === 'xs' ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]'}`}
      style={{ background: c.bg, border: `1px solid ${c.border}` }}
    >
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ background: c.dot, boxShadow: `0 0 4px ${c.dot}` }}
        />
      )}
      {label}
    </span>
  );
}
