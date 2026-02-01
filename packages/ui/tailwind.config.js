/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        argus: {
          dark: '#0d1117',
          darker: '#010409',
          border: '#30363d',
          text: '#c9d1d9',
          muted: '#8b949e',
          accent: '#58a6ff',
          green: '#3fb950',
          yellow: '#d29922',
          red: '#f85149',
        },
      },
    },
  },
  plugins: [],
};
