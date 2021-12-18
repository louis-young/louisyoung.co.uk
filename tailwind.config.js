module.exports = {
  content: [
    "./src/components/**/*.{js,jsx,ts,tsx,css}",
    "./src/components/*.css",
    "./src/pages/**/*.{js,jsx,ts,tsx,css}",
    "./src/templates/**/*.{js,jsx,ts,tsx,css}",
    "./content/posts/**/*.{js,jsx,ts,tsx,css,md,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        dark: "#0f1420",
        darker: "#0d0f17",
      },
      letterSpacing: {
        tighter: "-.04em",
      },
      lineHeight: {
        tight: 1.2,
        open: 2.25,
      },
      fontSize: {
        "5xl": "2.5rem",
        "6xl": "2.75rem",
        "7xl": "4.5rem",
        "8xl": "6.25rem",
      },
      boxShadow: {
        sm: "0 5px 10px rgba(0, 0, 0, 0.12)",
        md: "0 8px 30px rgba(0, 0, 0, 0.12)",
      },
    },
  },
};
