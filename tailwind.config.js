/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sora: ['var(--font-sora)', 'sans-serif'],
        manrope: ['var(--font-manrope)', 'sans-serif'],
      },
      colors: {
        courtGreen: '#1E5631',
        courtGreenDark: '#122F1B',
        courtGreenMid: '#2C6B41',
        clay: '#C1502E',
        clayDark: '#9C3E22',
        tennisYellow: '#D9E82E',
        ballDark: '#B9C71C',
        chalk: '#F7F5EE',
        chalkDim: '#EDEAE0',
        ink: '#1B2620',
        slate: '#5B6B62',
        // Dark theme - Roland nocturne palette
        rolandDark: '#1A1512',
        rolandCard: '#241D18',
        rolandBorder: '#3A2B23',
        rolandClay: '#D9673D',
        rolandText: '#F4ECE4',
        rolandSlate: '#9E8F85',
      },
      borderRadius: {
        card: '18px',
        input: '12px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(27,38,32,0.08), 0 1px 2px rgba(27,38,32,0.06)',
        'card-hover': '0 10px 24px rgba(27,38,32,0.10), 0 4px 8px rgba(27,38,32,0.06)',
      },
      keyframes: {
        'ball-bounce': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-24px)' },
        },
        'ball-shadow': {
          '0%, 100%': { transform: 'scaleX(1)', opacity: '0.3' },
          '50%': { transform: 'scaleX(0.6)', opacity: '0.15' },
        },
        'ball-drop': {
          '0%': { transform: 'translateY(-220px) scale(0.9)', opacity: '0' },
          '40%': { transform: 'translateY(0) scale(1.05)', opacity: '1' },
          '55%': { transform: 'translateY(-36px) scale(0.98)' },
          '70%': { transform: 'translateY(0) scale(1)' },
          '85%': { transform: 'translateY(-12px)' },
          '100%': { transform: 'translateY(0)' },
        },
        'shadow-scale': {
          '0%': { transform: 'scale(0.4)', opacity: '0.15' },
          '40%': { transform: 'scale(1.12)', opacity: '0.32' },
          '70%': { transform: 'scale(0.9)', opacity: '0.28' },
          '100%': { transform: 'scale(1)', opacity: '0.3' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          // Pas de `transform` à 100% : un transform résiduel ferait de
          // l'élément animé le containing block des descendants `fixed`
          // (tab bar, modales) et casserait leur positionnement viewport.
          '100%': { opacity: '1' },
        },
        'spin-ring': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'ball-bounce': 'ball-bounce 0.8s cubic-bezier(0.36, 0, 0.66, -0.56) infinite',
        'ball-shadow': 'ball-shadow 0.8s cubic-bezier(0.36, 0, 0.66, -0.56) infinite',
        'ball-drop': 'ball-drop 1.6s cubic-bezier(.22,.9,.12,1) both',
        'shadow-scale': 'shadow-scale 1.6s cubic-bezier(.22,.9,.12,1) both',
        shimmer: 'shimmer 1.5s infinite',
        'fade-in': 'fade-in 0.4s ease-out both',
        'spin-ring': 'spin-ring 0.8s linear infinite',
      },
    },
  },
  plugins: [],
}
