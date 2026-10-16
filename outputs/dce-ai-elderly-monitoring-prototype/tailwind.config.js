/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        forest: {
          50: '#edf5f1',
          100: '#d8e9e2',
          500: '#3f7465',
          700: '#285b4e',
          800: '#214c43',
          900: '#173b34',
        },
        sage: {
          50: '#f5f7f3',
          100: '#e7ece5',
          200: '#d6ddd3',
          500: '#557064',
          700: '#4d6157',
        },
        amber: {
          50: '#fff9ed',
          100: '#fdf0cc',
          200: '#f6d88f',
          600: '#8a550b',
          700: '#71450b',
        },
      },
      boxShadow: {
        card: '0 14px 32px -24px rgba(23, 59, 52, 0.38)',
        selected: '0 18px 38px -25px rgba(33, 76, 67, 0.58)',
        modal: '0 28px 80px -28px rgba(11, 30, 25, 0.56)',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.7' },
          '50%': { transform: 'scale(1.35)', opacity: '1' },
        },
        alertPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(251, 113, 133, 0.10)' },
          '50%': { boxShadow: '0 0 0 11px rgba(251, 113, 133, 0)' },
        },
        slideUp: {
          from: { transform: 'translateY(14px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        scan: {
          '0%': { transform: 'translateY(-6px)', opacity: '0' },
          '28%, 76%': { opacity: '0.75' },
          '100%': { transform: 'translateY(166px)', opacity: '0' },
        },
      },
      animation: {
        breathe: 'breathe 2.2s ease-in-out infinite',
        alert: 'alertPulse 1.5s ease-in-out infinite',
        'slide-up': 'slideUp 260ms cubic-bezier(0.16, 1, 0.3, 1) both',
        scan: 'scan 3.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
