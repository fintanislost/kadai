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
      },
    },
  },
  plugins: [typography],
};
