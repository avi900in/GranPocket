/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        heading: ['Nunito', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // Brand Primary & Accents
        'gp-teal': '#0F766E',
        'gp-teal-hover': '#0B5C56',
        'gp-teal-tint': '#E6F4F1',
        'gp-sand': '#F5E9DA',
        'gp-coral': '#F28C6B',
        // Neutrals (Light Mode)
        'gp-ink': '#14212B',
        'gp-text-sub': '#52616B',
        'gp-border': '#DDE5E9',
        'gp-bg': '#FAFBFA',
        'gp-surface': '#FFFFFF',
        // Severity Scale (Used ONLY for triage outcomes & emergency alerts)
        'gp-red': '#C62828',
        'gp-red-bg': '#FDECEA',
        'gp-orange': '#E65100',
        'gp-orange-bg': '#FFF1E5',
        'gp-yellow': '#B58105',
        'gp-yellow-bg': '#FFF8E1',
        'gp-green': '#2E7D32',
        'gp-green-bg': '#E8F5E9',
        // Dark Mode Semantic Tokens
        'gp-dark-bg': '#091014',
        'gp-dark-surface': '#0F1A20',
        'gp-dark-surface-elevated': '#16232B',
        'gp-dark-border': '#1E2D37',
        'gp-dark-text': '#F1F5F9',
        'gp-dark-text-sub': '#94A3B8',
      },
      borderRadius: {
        'card': '16px',
        'input': '12px',
        'pill': '9999px',
      },
      boxShadow: {
        'soft': '0 2px 8px -2px rgba(20, 33, 43, 0.05), 0 4px 16px -2px rgba(20, 33, 43, 0.05)',
        'soft-lg': '0 8px 24px -4px rgba(20, 33, 43, 0.08), 0 2px 8px -2px rgba(20, 33, 43, 0.04)',
      },
      minHeight: {
        'touch': '48px',
      },
      minWidth: {
        'touch': '48px',
      },
    },
  },
  plugins: [],
}
