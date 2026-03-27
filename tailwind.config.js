/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: "#050508",
        surface: "#0D0D14",
        card: "#13131C",
        border: "#1E1E2E",
        accent: "#7C3AED",
        accentLight: "#9F67FF",
        accentGlow: "#4C1D95",
        text: "#E8E8F0",
        muted: "#6B6B85",
        online: "#22C55E",
        danger: "#EF4444",
      },
    },
  },
};
