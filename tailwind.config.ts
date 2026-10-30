import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        void: '#0A0A0A', panel: '#111114', line: '#26252D', neon: '#E11D48', ember: '#F59E0B', mystic: '#8B5CF6', mist: '#F8FAFC'
      },
      fontFamily: { sans: ['var(--font-geist-sans)', 'Arial', 'sans-serif'], mono: ['var(--font-geist-mono)', 'monospace'] },
      boxShadow: { glow: '0 0 42px rgba(225,29,72,.14)', ember: '0 0 36px rgba(245,158,11,.12)' },
      backgroundImage: { 'samurai-grid': 'linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)' },
      keyframes: {
        float: { '0%,100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-8px)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        pulseGlow: { '0%,100%': { opacity: '.42' }, '50%': { opacity: '.9' } }
      },
      animation: { float: 'float 6s ease-in-out infinite', shimmer: 'shimmer 3.5s linear infinite', 'pulse-glow': 'pulseGlow 3s ease-in-out infinite' }
    }
  },
  plugins: []
};
export default config;
