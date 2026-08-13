import path from "path";

export default {
  plugins: {
    tailwindcss: {
      config: path.join(process.cwd(), "client", "tailwind.config.js"),
    },
    autoprefixer: {},
  },
};
