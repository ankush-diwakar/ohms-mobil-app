/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,ts,tsx}', 
    './components/**/*.{js,ts,tsx}',
    './screens/**/*.{js,ts,tsx}',
    './navigation/**/*.{js,ts,tsx}'
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        twitter: {
          blue: '#1DA1F2',
          lightblue: '#AAB8C2',
          background: '#FFFFFF',
          card: '#F7F9FA',
          textprimary: '#14171A',
          textsecondary: '#657786',
          success: '#17BF63',
          error: '#E0245E',
          border: '#E1E8ED',
        },
      },
      fontFamily: {
        'poppins': ['Poppins', 'sans-serif'],
        'poppins-light': ['Poppins_300Light', 'sans-serif'],
        'poppins-medium': ['Poppins_500Medium', 'sans-serif'],
        'poppins-semibold': ['Poppins_600SemiBold', 'sans-serif'],
        'poppins-bold': ['Poppins_700Bold', 'sans-serif'],
      },
      borderRadius: {
        'xl': '16px',
        '2xl': '20px',
        '3xl': '24px',
      },
    },
  },
  plugins: [],
};
