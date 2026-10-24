/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0B0B0B',
        'bg-secondary': '#121212',
        'bg-card': '#181818',
        gold: {
          DEFAULT: '#D4AF37',
          soft: '#F4D37A',
          dark: '#9c7c20',
        },
        ink: {
          DEFAULT: '#FFFFFF',
          dim: '#BDBDBD',
          faint: '#6B6B6B',
        },
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'monospace'],
      },
      boxShadow: {
        'gold-sm': '0 0 12px rgba(212,175,55,0.12)',
        gold: '0 0 24px rgba(212,175,55,0.18)',
        'gold-lg': '0 0 48px rgba(212,175,55,0.28)',
        soft: '0 4px 24px rgba(0,0,0,0.4)',
        'soft-lg': '0 8px 40px rgba(0,0,0,0.5)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
    },
  },
  plugins: [],
};
