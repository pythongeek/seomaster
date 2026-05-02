import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        card: 'var(--card)',
        border: 'var(--border)',
        'border-subtle': 'var(--border-subtle)',
        blue: { DEFAULT: 'var(--blue)', dim: 'var(--blue-dim)' },
        green: { DEFAULT: 'var(--green)' },
        amber: { DEFAULT: 'var(--amber)' },
        red: { DEFAULT: 'var(--red)' },
        purple: { DEFAULT: 'var(--purple)' },
        cyan: { DEFAULT: 'var(--cyan)' },
        text: 'var(--text)',
        muted: 'var(--muted)',
        'muted-light': 'var(--muted-light)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'slide-in': 'slideIn 0.3s ease-out forwards',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'gradient-shift': 'gradientShift 8s ease infinite',
      },
      backgroundSize: {
        '200': '200% 200%',
      },
    },
  },
  plugins: [],
};

export default config;
