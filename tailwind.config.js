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
          surface: '#0F172A',
          'surface-elevated': '#131D31',
          'border-subtle': '#1E293B',
          royal: '#1E40AF',
          hover: '#1D4ED8',
          sky: '#38BDF8',
          navy: '#0F172A',
          'text-primary': '#F8FAFC',
          'text-secondary': '#94A3B8',
          'text-muted': '#64748B',
        },
        rb: {
          navy: '#0F172A',
          turquoise: '#38BDF8',
          coral: '#1E40AF',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        heading: ['"Plus Jakarta Sans"', '"Space Grotesk"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '4px',
        sm: '2px',
        md: '4px',
        lg: '6px',
        xl: '6px',
      },
      animation: {
        'fade-in': 'fadeIn 0.35s ease-out',
        'slide-up': 'slideUp 0.35s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}
