import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/app/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Palette ArtisaStock — Charles & Nadejda ──────────────────────────
        // Chocolat
        choco: {
          50:  '#F5EFE6',
          100: '#EAD9C8',
          200: '#D4B799',
          300: '#B8906A',
          400: '#9E7B5C',
          500: '#6F4E37',
          600: '#3D2817',
          700: '#2C1810',
          800: '#1E0F08',
          900: '#140A04',
          DEFAULT: '#3D2817',
        },
        // Or / Gold
        or: {
          50:  '#FFF9E4',
          100: '#FFF3C9',
          200: '#FFE580',
          300: '#F5D044',
          400: '#D4AF37',
          500: '#B8960D',
          600: '#7D6608',
          DEFAULT: '#D4AF37',
        },
        // Framboise / CTA
        framboise: {
          50:  '#FFE4E4',
          100: '#FFD0D7',
          200: '#F5A0B0',
          300: '#E06080',
          400: '#C72C48',
          500: '#9A1F37',
          600: '#6E1226',
          DEFAULT: '#C72C48',
        },
        // Crème / fond app
        creme: {
          50:  '#FDFDFC',
          100: '#FAF7F1',
          200: '#F5E6D3',
          300: '#ECE9D8',
          400: '#D4C4B4',
          500: '#ACA899',
          DEFAULT: '#FAF7F1',
        },
        // Neutrals ERP
        neutral: {
          0:   '#FFFFFF',
          50:  '#FDFDFC',
          100: '#F5F0E8',
          200: '#ECE9D8',
          300: '#D4D0C8',
          400: '#ACA899',
          500: '#706f6c',
          600: '#55524E',
          700: '#3E3E3A',
          800: '#2A2A27',
          900: '#1b1b18',
        },
        // Semantics
        success:     '#27AE60',
        warning:     '#D35400',
        danger:      '#C72C48',
        info:        '#316AC5',
        // Sidebar surface
        rail: {
          DEFAULT: '#271A10',
          dark:    '#1E0F08',
          hl:      'rgba(212,175,55,0.10)',
        },
        // Legacy primary → alias vers choco pour compat classes existantes
        primary: {
          50:  '#F5EFE6',
          100: '#EAD9C8',
          200: '#D4B799',
          300: '#B8906A',
          400: '#9E7B5C',
          500: '#6F4E37',
          600: '#3D2817',
          700: '#2C1810',
          800: '#1E0F08',
          900: '#140A04',
          DEFAULT: '#3D2817',
          foreground: '#FDFDFC',
        },
      },
      fontFamily: {
        sans:    ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'system-ui', 'sans-serif'],
        serif:   ['Playfair Display', 'Cormorant Garamond', 'Georgia', 'serif'],
        heading: ['Playfair Display', 'Georgia', 'serif'],
      },
      fontSize: {
        'erp-xs': '11px',
        'erp-sm': '12.5px',
        'erp-md': '13.5px',
        'erp-lg': '15.5px',
        'erp-xl': '19px',
      },
      boxShadow: {
        'sh-1':    '0 1px 2px rgba(61,40,23,0.06), 0 1px 3px rgba(61,40,23,0.04)',
        'sh-2':    '0 2px 8px rgba(61,40,23,0.08), 0 1px 3px rgba(61,40,23,0.05)',
        'sh-3':    '0 8px 24px rgba(61,40,23,0.10), 0 2px 6px rgba(61,40,23,0.06)',
        'sh-gold': '0 0 0 1px rgba(212,175,55,0.5), 0 2px 12px rgba(212,175,55,0.25)',
        'sh-card': '0 1px 0 rgba(61,40,23,0.04), 0 1px 2px rgba(61,40,23,0.04)',
        'sh-pop':  '0 6px 16px rgba(61,40,23,0.14), 0 2px 4px rgba(61,40,23,0.06)',
        'sh-rail': '2px 0 12px rgba(0,0,0,0.06)',
      },
      borderRadius: {
        'rx-sm':  '2px',
        'rx-md':  '4px',
        'rx-card':'6px',
        'rx-doc': '8px',
        'rx-pill':'999px',
        lg: '8px',
        md: '6px',
        sm: '4px',
      },
      animation: {
        'fade-in':  'fadeIn 150ms ease-out',
        'slide-in': 'slideIn 250ms ease-out',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideIn: { from: { transform: 'translateY(-8px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
      },
    },
  },
  plugins: [],
};

export default config;
