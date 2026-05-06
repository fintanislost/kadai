/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: '#1e1e22',
        panel: '#252528',
        muted: '#9ca3af',
        'panel-hi': '#2d2d31',
        'panel-lo': '#1a1a1d',
        'status-backlog':     '#9ca3af',
        'status-ready':       '#60a5fa',
        'status-in_progress': '#fbbf24',
        'status-blocked':     '#f87171',
        'status-review':      '#a78bfa',
        'status-done':        '#34d399',
        'status-cancelled':   '#52525b',
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
