/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      // ── Lettertypes ─────────────────────────────────────
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans:  ['"DM Sans"', 'system-ui', 'sans-serif'],
      },

      // ── Kleurenpalet (ELLE/Harper's Bazaar) ─────────────
      colors: {
        cream: {
          50:  '#FDFBF7',
          100: '#FAF7F0',
          200: '#F5EFE0',
          300: '#EDE3CC',
        },
        goud: {
          300: '#E8D5A3',
          400: '#D4AF6B',
          500: '#B8965A',
          600: '#9A7B47',
        },
        roos: {
          100: '#F9EEF0',
          200: '#F0D4D8',
          300: '#E0A8B0',
          400: '#C97882',
        },
        antraciet: {
          700: '#2D2D2D',
          800: '#1A1A1A',
          900: '#0D0D0D',
        },
      },

      // ── Typografie schaal ────────────────────────────────
      fontSize: {
        'display': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'heading':  ['2rem',   { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'subhead':  ['1.25rem',{ lineHeight: '1.4' }],
      },

      // ── Vloeiende schaduwen ──────────────────────────────
      boxShadow: {
        'editorial': '0 2px 20px rgba(0,0,0,0.06)',
        'card':      '0 4px 32px rgba(0,0,0,0.08)',
        'goud':      '0 0 0 2px rgba(212,175,107,0.4)',
      },

      // ── Border radius ────────────────────────────────────
      borderRadius: {
        'editorial': '2px',
      },
    },
  },
  plugins: [],
};
