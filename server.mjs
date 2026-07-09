import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "out");
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function resolvePath(urlPath) {
  const cleanPath = normalize(decodeURIComponent(urlPath.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
  const requested = join(root, cleanPath);

  if (existsSync(requested) && statSync(requested).isFile()) {
    return requested;
  }

  const indexFile = join(requested, "index.html");
  if (existsSync(indexFile)) {
    return indexFile;
  }

  return join(root, "index.html");
}

createServer((request, response) => {
  const filePath = resolvePath(request.url || "/");
  const type = contentTypes[extname(filePath)] || "application/octet-stream";

  response.setHeader("Content-Type", type);
  response.setHeader("Cache-Control", filePath.includes("/_next/") ? "public, max-age=31536000, immutable" : "no-cache");

  createReadStream(filePath)
    .on("error", () => {
      response.statusCode = 404;
      response.end("Not found");
    })
    .pipe(response);
}).listen(port, host, () => {
  console.log(`Serving static site on ${host}:${port}`);
});
