import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { loadEnvFile } from "node:process";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import path from "node:path";
const projectRoot = fileURLToPath(new URL("..", import.meta.url));
for (const name of [".env.local", ".env"]) {
  try {
    loadEnvFile(path.join(projectRoot, name));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
const { default: tutor } = await import("../api/ai/tutor.js");
const root = path.resolve(
  projectRoot,
  process.argv.includes("--dist") ? "dist" : ".",
);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`),
      requested = decodeURIComponent(url.pathname);
    if (requested === "/api/ai/tutor") {
      const controller = new AbortController(),
        disconnected = () => {
          if (!res.writableEnded) controller.abort();
        };
      res.once("close", disconnected);
      const request = new Request(url, {
        method: req.method,
        headers: req.headers,
        signal: controller.signal,
        ...(!["GET", "HEAD"].includes(req.method)
          ? { body: Readable.toWeb(req), duplex: "half" }
          : {}),
      });
      const response = await tutor.fetch(request);
      if (res.destroyed) return;
      const body = Buffer.from(await response.arrayBuffer());
      res.removeListener("close", disconnected);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(body);
      return;
    }
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405);
      res.end("Method not allowed");
      return;
    }
    // Only public assets are served. Source secrets and server modules are never reachable.
    if (
      !/^\/(?:$|index\.html$|icon\.svg$|version\.json$|(?:styles|js|components|activities|data)\/[a-zA-Z0-9_./-]+$)/.test(
        requested,
      ) ||
      requested.includes("..") ||
      requested.includes("/.") ||
      requested.endsWith(".xlsx") || requested.startsWith("/data/adapters/")
    ) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    if (requested === "/version.json" && !process.argv.includes("--dist")) {
      res.writeHead(200, {
        "Content-Type": types[".json"],
        "Cache-Control": "no-store",
      });
      res.end('{"version":"development"}');
      return;
    }
    const file = path.resolve(
      root,
      "." + (requested === "/" ? "/index.html" : requested),
    );
    if (
      !file.startsWith(root + path.sep) ||
      !types[path.extname(file)] ||
      !(await stat(file)).isFile()
    )
      throw new Error("Not found");
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)],
      "Cache-Control":
        requested === "/version.json"
          ? "no-store"
          : "no-cache, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(req.method === "HEAD" ? undefined : await readFile(file));
  } catch {
    if (!res.headersSent) res.writeHead(404);
    res.end("Not found");
  }
});
const port = Number(process.env.PORT) || 4174;
server.listen(port, "127.0.0.1", () =>
  console.log(
    `Bahasa Melayu Mastery: http://localhost:${port}${process.argv.includes("--dist") ? " (production build)" : ""}`,
  ),
);
