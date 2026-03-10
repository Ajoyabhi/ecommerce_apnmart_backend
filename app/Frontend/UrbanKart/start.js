import { createServer } from "vite";

const server = await createServer({
  configFile: "./vite.config.ts",
  server: {
    port: 5008,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});

await server.listen();
server.printUrls();
