/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── 研究指定主色调 ─────────────────────────────────────────
        // 深森林绿
        forest: {
          50: '#EDF4F0',
          100: '#D7E7DE',
          200: '#B4D0C2',
          300: '#8FAE96', // 鼠尾草绿（浅端）
          400: '#5E8571',
          500: '#3C6653',
          600: '#2E5545',
          700: '#254D3C', // 主色
          800: '#1C3E30',
          900: '#142C23',
        },
        // 鼠尾草绿
        sage: {
          50: '#F2F6F1',
          100: '#E9F0E8', // 浅灰绿
          200: '#D5E0D3',
          300: '#BCCDB9',
          400: '#A3BBA2',
          500: '#8FAE96', // 主色
          600: '#6F8F78',
          700: '#57735F',
          800: '#425849',
          900: '#2F4034',
        },
        // 奶油白
        cream: {
          50: '#FDFDFA',
          100: '#F8F8F3', // 主色
          200: '#F1F1E8',
          300: '#E6E6D9',
        },
        // 香槟金
        champagne: {
          50: '#FBF7EF',
          100: '#F5EDDC',
          200: '#EBDCBE',
          300: '#DCC59A',
          400: '#C5A36A', // 主色
          500: '#AE8C53',
          600: '#8E7040',
          700: '#6E5632',
          800: '#4F3D24',
          900: '#332717',
        },
        // 状态色（不单独依赖颜色传达信息，始终配合图标与文字）
        alert: {
          50: '#FDF2F3',
          100: '#FBE3E5',
          500: '#C4576A',
          600: '#A54455',
          700: '#83343F',
        },
        info: {
          50: '#EFF4F7',
          100: '#DEE9EF',
          600: '#3D5F72',
          700: '#2E4A59',
        },
      },
      fontFamily: {
        sans: [
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'Noto Sans SC',
          'Source Han Sans SC',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
      },
      fontSize: {
        // 面向中老年参与者：整体上调正文基准字号
        'read-sm': ['0.9375rem', { lineHeight: '1.75' }],
        'read-base': ['1.0625rem', { lineHeight: '1.8' }],
        'read-lg': ['1.1875rem', { lineHeight: '1.75' }],
      },
      borderRadius: {
        control: '8px',
        panel: '12px',
        surface: '16px',
        feature: '20px',
      },
      boxShadow: {
        card: '0 14px 32px -24px rgba(20, 44, 35, 0.38)',
        selected: '0 18px 38px -25px rgba(37, 77, 60, 0.55)',
        modal: '0 28px 80px -28px rgba(11, 30, 25, 0.56)',
        nav: '0 10px 30px -22px rgba(20, 44, 35, 0.4)',
      },
      spacing: {
        4.5: '1.125rem',
        18: '4.5rem',
      },
      maxWidth: {
        content: '76rem',
      },
      minHeight: {
        11: '2.75rem',
        12: '3rem',
        13: '3.25rem',
      },
      minWidth: {
        11: '2.75rem',
        12: '3rem',
        13: '3.25rem',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.72' },
          '50%': { transform: 'scale(1.3)', opacity: '1' },
        },
        alertRing: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(196, 87, 106, 0.28)' },
          '50%': { boxShadow: '0 0 0 10px rgba(196, 87, 106, 0)' },
        },
        slideUp: {
          from: { transform: 'translateY(14px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        scan: {
          '0%': { transform: 'translateY(-6px)', opacity: '0' },
          '28%, 76%': { opacity: '0.7' },
          '100%': { transform: 'translateY(166px)', opacity: '0' },
        },
        progressGrow: {
          from: { transform: 'scaleX(0)' },
          to: { transform: 'scaleX(1)' },
        },
      },
      animation: {
        breathe: 'breathe 2.4s ease-in-out infinite',
        alert: 'alertRing 1.6s ease-in-out infinite',
        'slide-up': 'slideUp 260ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fadeIn 220ms ease-out both',
        scan: 'scan 3.6s ease-in-out infinite',
        'progress-grow': 'progressGrow 400ms cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
}
