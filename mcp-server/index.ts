import app from "./src/server.js";
import { loadNodes } from "./src/nodes.js";

const PORT = Number(process.env.PORT ?? 3001);

// Pre-warm node cache on startup
loadNodes().catch((err) => {
  console.error("[startup] Failed to pre-warm nodes cache:", err);
});

const server = Bun.serve({
  port: PORT,
  fetch: app.fetch,
});

console.log(`[mcp-server] Listening on http://localhost:${PORT}`);
console.log(`[mcp-server] Endpoints:`);
console.log(`  POST   /ask     — browser UI`);
console.log(`  ALL    /mcp     — MCP Streamable HTTP`);
console.log(`  GET    /health  — liveness`);
console.log(`  GET    /ready   — readiness`);

export default server;