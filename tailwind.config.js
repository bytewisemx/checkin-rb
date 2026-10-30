/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          main: '#0B111E',
          surface: '#131D31',
          'surface-elevated': '#1A2742',
          'border-subtle': '#233354',
          royal: '#1E40AF',
          hover: '#1D4ED8',
          sky: '#38BDF8',
          navy: '#0F172A',
          'text-primary': '#F8FAFC',
          'text-secondary': '#94A3B8',
          'text-muted': '#64748B',
          success: '#38BDF8',
          error: '#E11D48',
          warning: '#F59E0B',
        },
        rb: {
          navy: '#0F172A',
          turquoise: '#38BDF8',
          coral: '#1E40AF',
        }
      },
      fontFamily: {
        sans: ['Sora', 'system-ui', 'sans-serif'],
        heading: ['Sora', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '6px',
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '10px',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}
