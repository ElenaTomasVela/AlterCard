import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default ({ mode }) => {
  process.env = { ...process.env, ...loadEnv(mode, process.cwd()) };
  return defineConfig({
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // server: {
    //   proxy: {
    //     "/api": {
    //       target: process.env.VITE_BACKEND_URL,
    //       changeOrigin: true,
    //       secure: false,
    //       rewrite: (path) => path.replace(/^\/api/, ""),
    //     },
    //   },
    // },
  });
};
