import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg:     '#02040C',
          panel:  'rgba(6,10,20,0.92)',
          border: 'rgba(34,211,238,0.10)',
          cyan:   '#22D3EE',
          green:  '#10B981',
          red:    '#EF4444',
          amber:  '#F59E0B',
          purple: '#8B5CF6',
          blue:   '#38BDF8',
          muted:  '#64748B',
          dim:    '#1E293B',
          bright: '#E2E8F0',
        },
        neon: {
          cyan:   '#67E8F9',
          green:  '#34D399',
          red:    '#FC8181',
          amber:  '#FCD34D',
          purple: '#C4B5FD',
        },
        md: {
          primary:             '#22D3EE',
          'on-primary':        '#003640',
          'primary-container': '#004D5C',
          secondary:           '#10B981',
          error:               '#EF4444',
          surface:             'rgba(6,10,20,0.92)',
          'on-surface':        '#E2E8F0',
          'surface-variant':   'rgba(9,14,26,0.88)',
          outline:             'rgba(34,211,238,0.10)',
          scrim:               'rgba(0,0,0,0.85)',
        },
      },
      fontFamily: {
        mono:    ['"JetBrains Mono"', 'monospace'],
        display: ['"Orbitron"', 'sans-serif'],
        ui:      ['"Space Grotesk"', '"Inter"', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px' }],
        '3xs': ['9px',  { lineHeight: '12px' }],
        '4xs': ['8px',  { lineHeight: '11px' }],
      },
      spacing: {
        'md-1': '4px', 'md-2': '8px', 'md-3': '12px',
        'md-4': '16px', 'md-5': '24px', 'md-6': '32px',
        'md-7': '48px', 'md-8': '64px',
      },
      borderRadius: {
        'md-xs': '4px', 'md-sm': '6px', 'md-md': '8px',
        'md-lg': '12px', 'md-xl': '16px', 'md-full': '9999px',
      },
      boxShadow: {
        'neon-cyan':   '0 0 10px rgba(34,211,238,0.45),  0 0 30px rgba(34,211,238,0.15)',
        'neon-green':  '0 0 10px rgba(16,185,129,0.45),  0 0 30px rgba(16,185,129,0.15)',
        'neon-red':    '0 0 10px rgba(239,68,68,0.45),   0 0 30px rgba(239,68,68,0.15)',
        'neon-amber':  '0 0 10px rgba(245,158,11,0.45),  0 0 30px rgba(245,158,11,0.15)',
        'glass':       '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(34,211,238,0.07)',
        'panel':       '0 4px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
        'md-1': '0 1px 2px rgba(0,0,0,0.3), 0 1px 3px 1px rgba(0,0,0,0.15)',
        'md-2': '0 1px 2px rgba(0,0,0,0.3), 0 2px 6px 2px rgba(0,0,0,0.15)',
        'md-3': '0 4px 8px 3px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.3)',
      },
      backdropBlur: {
        xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '24px',
      },
      animation: {
        'pulse-glow':   'pulseGlow 3s ease-in-out infinite',
        'ticker':       'ticker 50s linear infinite',
        'scan':         'scan 8s linear infinite',
        'live-pulse':   'livePulse 1.8s ease-in-out infinite',
        'flip-in':      'flipIn 0.18s cubic-bezier(0.34,1.56,0.64,1)',
        'fade-up':      'fadeUp 0.3s ease-out',
        'slide-right':  'slideRight 0.25s ease-out',
        'md-enter':     'mdEnter 0.2s cubic-bezier(0.2,0,0,1)',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 1px rgba(34,211,238,0.10), 0 0 16px rgba(34,211,238,0.06)' },
          '50%':      { boxShadow: '0 0 0 1px rgba(34,211,238,0.25), 0 0 32px rgba(34,211,238,0.14)' },
        },
        ticker: {
          '0%':   { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        scan: { '0%': { top: '0' }, '100%': { top: '100vh' } },
        livePulse: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%':      { transform: 'scale(1.3)', opacity: '0.8' },
        },
        flipIn: {
          '0%':   { transform: 'translateY(-6px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeUp: {
          '0%':   { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideRight: {
          '0%':   { transform: 'translateX(-8px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        mdEnter: {
          '0%':   { transform: 'scale(0.94)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      transitionTimingFunction: {
        'md-standard':   'cubic-bezier(0.2, 0, 0, 1)',
        'md-decelerate': 'cubic-bezier(0, 0, 0, 1)',
        'md-accelerate': 'cubic-bezier(0.3, 0, 1, 1)',
        'spring':        'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
