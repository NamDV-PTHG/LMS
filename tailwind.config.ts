import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      // ─── BRAND COLORS ───────────────────────────────────────────
      colors: {
        // shadcn/ui CSS variable mappings (used in globals.css @apply)
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        // Primary blue
        primary: {
          DEFAULT: '#185FA5',
          dark:    '#0C447C',
          light:   '#378ADD',
          tint:    '#E6F1FB',
        },
        // Semantic
        success: {
          DEFAULT: '#3B6D11',
          tint:    '#EAF3DE',
        },
        warning: {
          DEFAULT: '#854F0B',
          tint:    '#FAEEDA',
        },
        danger: {
          DEFAULT: '#993C1D',
          tint:    '#FAECE7',
        },
        // Neutral / Surface
        surface:  '#FFFFFF',
        muted:    '#F1EFE8',
        border: {
          DEFAULT: 'hsl(var(--border))',
          subtle: 'rgba(0,0,0,0.08)',
        },
        // Text
        content: '#111827',   // text-content  — tiêu đề, body
        subtle:  '#4B5563',   // text-subtle   — mô tả, label
        faint:   '#9CA3AF',   // text-faint    — placeholder, time
      },

      // ─── TYPOGRAPHY ─────────────────────────────────────────────
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Custom sizes không có sẵn trong Tailwind
        '2xs': ['10px', { lineHeight: '1.4' }],
        '13':  ['13px', { lineHeight: '1.5' }],
        '15':  ['15px', { lineHeight: '1.4' }],
        '17':  ['17px', { lineHeight: '1.3' }],
        '20':  ['20px', { lineHeight: '1.3' }],
        '36':  ['36px', { lineHeight: '1.1' }],
      },

      // ─── SPACING ────────────────────────────────────────────────
      spacing: {
        '4.5': '1.125rem',  // 18px — dùng cho gap đặc biệt
        '13':  '3.25rem',   // 52px
        '15':  '3.75rem',   // 60px — bottom nav area
        '18':  '4.5rem',    // 72px — header + extra
      },

      // ─── BORDER RADIUS ──────────────────────────────────────────
      borderRadius: {
        // Override defaults để nhất quán với design
        DEFAULT: '0.5rem',    // 8px
        sm:  '0.375rem',      // 6px
        md:  '0.5rem',        // 8px
        lg:  '0.625rem',      // 10px — button, input
        xl:  '0.75rem',       // 12px — card ← quan trọng nhất
        '2xl': '1rem',        // 16px — chỉ dùng cho chat bubble
        full: '9999px',
      },

      // ─── SHADOWS ────────────────────────────────────────────────
      boxShadow: {
        // Thay thế shadow nặng bằng border tinh tế
        card:  '0 0 0 0.5px rgba(0,0,0,0.08)',
        nav:   '0 -1px 0 rgba(0,0,0,0.06)',
        input: '0 0 0 2px rgba(24,95,165,0.20)',  // focus ring
        none:  'none',
      },

      // ─── HEIGHT ─────────────────────────────────────────────────
      height: {
        'screen-safe': 'calc(100vh - env(safe-area-inset-bottom))',
        'nav': '64px',    // bottom nav height
        'header': '56px', // top header height
        'video': '200px', // video player fixed height
      },

      // ─── MAX WIDTH ──────────────────────────────────────────────
      maxWidth: {
        'phone': '448px',  // max-w-phone — PWA container
      },

      // ─── BACKGROUND GRADIENTS ───────────────────────────────────
      backgroundImage: {
        'primary-gradient':
          'linear-gradient(135deg, #0C447C 0%, #185FA5 60%, #378ADD 100%)',
        'hero-dark':
          'linear-gradient(160deg, #0C447C 0%, #185FA5 60%, #378ADD 100%)',
      },

      // ─── KEYFRAMES ──────────────────────────────────────────────
      keyframes: {
        'fade-in': {
          '0%':   { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          '0%':   { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in':  'fade-in 0.2s ease-out',
        'slide-up': 'slide-up 0.25s ease-out',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),  // dùng với shadcn/ui
  ],
}

export default config
