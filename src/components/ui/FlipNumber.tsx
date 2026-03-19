import { useEffect, useRef, useState } from 'react';

interface FlipNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  colorize?: boolean;
  className?: string;
}

export default function FlipNumber({ value, prefix = '', suffix = '', decimals = 2, colorize = false, className = '' }: FlipNumberProps) {
  const [display, setDisplay] = useState(value);
  const [flip, setFlip] = useState(false);
  const prev = useRef(value);

  useEffect(() => {
    if (value !== prev.current) {
      setFlip(true);
      const t = setTimeout(() => {
        setDisplay(value);
        setFlip(false);
        prev.current = value;
      }, 140);
      return () => clearTimeout(t);
    }
  }, [value]);

  const color = colorize
    ? display > 0 ? 'text-emerald-400' : display < 0 ? 'text-rose-400' : 'text-slate-300'
    : '';

  const formatted = Math.abs(display).toFixed(decimals);
  const sign = colorize && display !== 0 ? (display > 0 ? '+' : '-') : '';

  return (
    <span
      className={`font-mono tabular-nums inline-block transition-all duration-150 ${flip ? 'opacity-0 -translate-y-1' : 'opacity-100 translate-y-0'} ${color} ${className}`}
    >
      {prefix}{sign}{formatted}{suffix}
    </span>
  );
}
