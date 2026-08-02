/** @type {import('tailwindcss').Config} */

// TD-007. Lifted verbatim from the inline `tailwind.config` that lived in
// index.html alongside the cdn.tailwindcss.com Play script.
//
// Pinned to Tailwind 3.4 (v3-lts) rather than 4.x on purpose: the Play CDN
// serves v3, so v3 semantics are what every class in this codebase was written
// against. v4 renames utilities (shadow-sm -> shadow-xs, ring default 3px ->
// 1px, among others), which is a large visual-regression surface across ~21.6k
// LOC with no visual-regression suite yet to catch it. Removing the CDN and
// upgrading Tailwind are two changes; doing them together would make any
// regression ambiguous between them. v4 is tracked separately.
export default {
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './utils/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Cairo', 'sans-serif'],
        arabic: ['Cairo', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
      },
    },
  },
  plugins: [],
};
