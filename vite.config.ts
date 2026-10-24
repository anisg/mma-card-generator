import { defineConfig, type Connect, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// ufc.com images have no CORS headers, so they are served same-origin to keep the PNG export working.
// Node's http-proxy is rejected by ufc.com bot protection, while fetch() is accepted.
const ufcImages: Connect.NextHandleFunction = async (req, res, next) => {
  if (!req.url?.startsWith("/ufc-images/")) return next();
  try {
    const upstream = await fetch(`https://www.ufc.com/images/${req.url.slice("/ufc-images/".length)}`);
    res.statusCode = upstream.status;
    res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    res.statusCode = 502;
    res.end();
  }
};

const ufcImagesProxy = (): Plugin => ({
  name: "ufc-images-proxy",
  configureServer: (server) => void server.middlewares.use(ufcImages),
  configurePreviewServer: (server) => void server.middlewares.use(ufcImages),
});

export default defineConfig({
  plugins: [react(), tailwindcss(), ufcImagesProxy()],
});
