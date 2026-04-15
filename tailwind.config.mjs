/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    "text-dark-red",
    "bg-dark-red",
    "hover:bg-dark-red-light",
    "border-dark-red",
    "focus:ring-dark-red",
    "focus:border-dark-red",
    "text-dark-red-light",
    "hover:text-dark-red-light",
    "bg-dark-red-light",
    "bg-marine",
    "border-marine",
    "text-marine",
    "bg-opacity-20",
  ],
  theme: {
    extend: {
      colors: {
        "dark-red": "#b31919",
        "dark-red-light": "#A01C47",
        marine: "#1A3A52",
        "marine-light": "#2D5A7B",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      backgroundImage: {
        "auth-bg": 'url("/images/background.png")',
      },
    },
  },
  plugins: [],
};
