import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /* ── MD3 Dark — Surface ─────────────────────────────── */
        'background':                  '#111417',
        'surface':                     '#111417',
        'surface-dim':                 '#111417',
        'surface-bright':              '#37393d',
        'surface-container-lowest':    '#0b0e11',
        'surface-container-low':       '#191c1f',
        'surface-container':           '#1d2023',
        'surface-container-high':      '#272a2e',
        'surface-container-highest':   '#323538',

        /* ── MD3 Dark — Primary ─────────────────────────────── */
        'primary':                     '#4cd6ff',
        'primary-fixed':               '#b7eaff',
        'primary-fixed-dim':           '#4cd6ff',
        'primary-container':           '#00d1ff',
        'on-primary':                  '#003543',
        'on-primary-fixed':            '#001f28',
        'on-primary-fixed-variant':    '#004e60',
        'on-primary-container':        '#00566a',
        'inverse-primary':             '#00677f',
        'surface-tint':                '#4cd6ff',

        /* ── MD3 Dark — Secondary ───────────────────────────── */
        'secondary':                   '#00e297',
        'secondary-fixed':             '#4dffb2',
        'secondary-fixed-dim':         '#00e297',
        'secondary-container':         '#00ffab',
        'on-secondary':                '#003822',
        'on-secondary-fixed':          '#002112',
        'on-secondary-fixed-variant':  '#005234',
        'on-secondary-container':      '#007149',

        /* ── MD3 Dark — Tertiary ────────────────────────────── */
        'tertiary':                    '#ffd1d5',
        'tertiary-fixed':              '#ffd9dc',
        'tertiary-fixed-dim':          '#ffb2ba',
        'tertiary-container':          '#ffa9b2',
        'on-tertiary':                 '#670020',
        'on-tertiary-fixed':           '#400011',
        'on-tertiary-fixed-variant':   '#910030',
        'on-tertiary-container':       '#9f0036',

        /* ── MD3 Dark — Error ───────────────────────────────── */
        'error':                       '#ffb4ab',
        'error-container':             '#93000a',
        'on-error':                    '#690005',
        'on-error-container':          '#ffdad6',

        /* ── MD3 Dark — On-surface ──────────────────────────── */
        'on-surface':                  '#e1e2e7',
        'on-surface-variant':          '#bbc9cf',
        'on-background':               '#e1e2e7',
        'inverse-surface':             '#e1e2e7',
        'inverse-on-surface':          '#2e3134',

        /* ── MD3 Dark — Outline ─────────────────────────────── */
        'outline':                     '#859399',
        'outline-variant':             '#3c494e',
      },

      fontFamily: {
        headline: ['"Space Grotesk"', 'sans-serif'],
        body:     ['"Inter"', 'sans-serif'],
        label:    ['"Inter"', 'sans-serif'],
        mono:     ['"JetBrains Mono"', 'monospace'],
      },

      fontSize: {
        '2xs': ['10px', { lineHeight: '14px' }],
        '3xs': ['9px',  { lineHeight: '12px' }],
        '4xs': ['8px',  { lineHeight: '11px' }],
      },

      borderRadius: {
        DEFAULT: '0.125rem',
        lg:      '0.25rem',
        xl:      '0.5rem',
        full:    '0.75rem',
      },

      spacing: {
        'md-1': '4px',  'md-2': '8px',  'md-3': '12px',
        'md-4': '16px', 'md-5': '24px', 'md-6': '32px',
        'md-7': '48px', 'md-8': '64px',
      },

      boxShadow: {
        'glass': '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(76,214,255,0.05)',
        'panel': '0 4px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
        'md-1':  '0 1px 2px rgba(0,0,0,0.3), 0 1px 3px 1px rgba(0,0,0,0.15)',
        'md-2':  '0 1px 2px rgba(0,0,0,0.3), 0 2px 6px 2px rgba(0,0,0,0.15)',
        'md-3':  '0 4px 8px 3px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.3)',
      },

      backdropBlur: {
        xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '24px',
      },

      animation: {
        'fade-up':     'fadeUp 0.3s ease-out',
        'md-enter':    'mdEnter 0.2s cubic-bezier(0.2,0,0,1)',
        'flip-in':     'flipIn 0.18s cubic-bezier(0.34,1.56,0.64,1)',
        'live-pulse':  'livePulse 1.8s ease-in-out infinite',
        'ticker':      'ticker 50s linear infinite',
      },

      keyframes: {
        fadeUp: {
          '0%':   { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',   opacity: '1' },
        },
        mdEnter: {
          '0%':   { transform: 'scale(0.94)', opacity: '0' },
          '100%': { transform: 'scale(1)',    opacity: '1' },
        },
        flipIn: {
          '0%':   { transform: 'translateY(-6px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',     opacity: '1' },
        },
        livePulse: {
          '0%, 100%': { transform: 'scale(1)',   opacity: '1' },
          '50%':      { transform: 'scale(1.3)', opacity: '0.8' },
        },
        ticker: {
          '0%':   { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
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
