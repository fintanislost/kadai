/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Cascadia Code', 'Menlo', 'monospace'],
      },
      colors: {
        // Surfaces (single neutral + elevation via shadow, not bg variation)
        bg:               '#0c0c0e',
        'surface-1':      '#131318',
        'surface-2':      '#16161c',
        muted:            '#a1a1aa',
        'text-primary':   '#f4f4f5',
        'text-secondary': '#a1a1aa',
        'text-tertiary':  '#71717a',
        'text-quaternary':'#52525b',
        // Brand accent — used sparingly (one CTA per page)
        accent:           '#5eead4',
        'accent-fg':      '#042f2e',
        // Status palette — only used by StatusBadge + kanban borders
        'status-backlog':     '#a1a1aa',
        'status-ready':       '#93c5fd',
        'status-in_progress': '#fcd34d',
        'status-blocked':     '#fca5a5',
        'status-review':      '#c4b5fd',
        'status-done':        '#6ee7b7',
        'status-cancelled':   '#52525b',
      },
      boxShadow: {
        'elev-1': '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 1px 2px rgba(0,0,0,0.3)',
        'elev-2': '0 1px 0 0 rgba(255,255,255,0.05) inset, 0 4px 12px rgba(0,0,0,0.4)',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [typography],
};
