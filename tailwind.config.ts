import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1.5rem" },
    extend: {
      colors: {
        bg: { DEFAULT: "#0B0820", soft: "#120E2E", card: "#16113A", elev: "#1D1748" },
        line: "#2A2256",
        ink: { DEFAULT: "#F5F3FF", muted: "#A9A2D6", subtle: "#7A73AE" },
        brand: {
          50: "#F5E9FF", 100: "#E7CDFF", 200: "#D0A0FF", 300: "#B872FF",
          400: "#A04CFF", 500: "#8B33F2", 600: "#7321D6", 700: "#5B18A8",
          800: "#421080", 900: "#2A0858",
        },
        magenta: { 400: "#FF4DCB", 500: "#FF1AB5", 600: "#E60097" },
        ok: "#22C55E", warn: "#F59E0B", danger: "#EF4444", info: "#38BDF8",
      },
      fontFamily: { sans: ['"Inter"', "system-ui", "sans-serif"] },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #8B33F2 0%, #FF1AB5 100%)",
        "brand-soft": "linear-gradient(135deg, rgba(139,51,242,0.18) 0%, rgba(255,26,181,0.18) 100%)",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(139,51,242,0.4), 0 12px 40px -10px rgba(255,26,181,0.35)",
        card: "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 30px -10px rgba(0,0,0,0.5)",
      },
      borderRadius: { lg: "12px", xl: "16px", "2xl": "20px" },
    },
  },
  plugins: [],
};
export default config;
