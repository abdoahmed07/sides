// vite.config.js
import { defineConfig } from "file:///sessions/vibrant-quirky-mccarthy/mnt/Summer%202026/project-01-code-review/frontend/node_modules/vite/dist/node/index.js";
import react from "file:///sessions/vibrant-quirky-mccarthy/mnt/Summer%202026/project-01-code-review/frontend/node_modules/@vitejs/plugin-react/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy API and socket requests to the backend during local dev
    // This avoids CORS issues when running both servers locally
    proxy: {
      "/api": "http://localhost:3000",
      "/socket.io": {
        target: "http://localhost:3000",
        ws: true
        // WebSocket proxying — needed for Socket.io
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvdmlicmFudC1xdWlya3ktbWNjYXJ0aHkvbW50L1N1bW1lciAyMDI2L3Byb2plY3QtMDEtY29kZS1yZXZpZXcvZnJvbnRlbmRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9zZXNzaW9ucy92aWJyYW50LXF1aXJreS1tY2NhcnRoeS9tbnQvU3VtbWVyIDIwMjYvcHJvamVjdC0wMS1jb2RlLXJldmlldy9mcm9udGVuZC92aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vc2Vzc2lvbnMvdmlicmFudC1xdWlya3ktbWNjYXJ0aHkvbW50L1N1bW1lciUyMDIwMjYvcHJvamVjdC0wMS1jb2RlLXJldmlldy9mcm9udGVuZC92aXRlLmNvbmZpZy5qc1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlXCI7XG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0XCI7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtyZWFjdCgpXSxcbiAgc2VydmVyOiB7XG4gICAgcG9ydDogNTE3MyxcbiAgICAvLyBQcm94eSBBUEkgYW5kIHNvY2tldCByZXF1ZXN0cyB0byB0aGUgYmFja2VuZCBkdXJpbmcgbG9jYWwgZGV2XG4gICAgLy8gVGhpcyBhdm9pZHMgQ09SUyBpc3N1ZXMgd2hlbiBydW5uaW5nIGJvdGggc2VydmVycyBsb2NhbGx5XG4gICAgcHJveHk6IHtcbiAgICAgIFwiL2FwaVwiOiBcImh0dHA6Ly9sb2NhbGhvc3Q6MzAwMFwiLFxuICAgICAgXCIvc29ja2V0LmlvXCI6IHtcbiAgICAgICAgdGFyZ2V0OiBcImh0dHA6Ly9sb2NhbGhvc3Q6MzAwMFwiLFxuICAgICAgICB3czogdHJ1ZSwgLy8gV2ViU29ja2V0IHByb3h5aW5nIFx1MjAxNCBuZWVkZWQgZm9yIFNvY2tldC5pb1xuICAgICAgfSxcbiAgICB9LFxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXVhLFNBQVMsb0JBQW9CO0FBQ3BjLE9BQU8sV0FBVztBQUVsQixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxDQUFDO0FBQUEsRUFDakIsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBO0FBQUE7QUFBQSxJQUdOLE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxRQUNaLFFBQVE7QUFBQSxRQUNSLElBQUk7QUFBQTtBQUFBLE1BQ047QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
