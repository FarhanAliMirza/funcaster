import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { inspectBundle } from "./bundle.mjs";

const directory = process.argv[2];
if (!directory)
  throw Error("Usage: npm run game:preview -- /path/to/game-bundle");
const root = path.resolve(directory),
  bundle = inspectBundle(root);
// Snapshot validated files into memory to avoid path traversal and symlink races.
const files = new Map(
  bundle.files.map((f) => [
    "/bundle/" + f.path,
    fs.readFileSync(path.join(root, f.path)),
  ]),
);
const mime = {
  html: "text/html",
  js: "text/javascript",
  mjs: "text/javascript",
  css: "text/css",
  json: "application/json",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  woff2: "font/woff2",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  glb: "model/gltf-binary",
};
const escape = (s) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const server = http.createServer((req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()",
  );
  res.setHeader("Cache-Control", "no-store");
  let pathname;
  try {
    pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405).end();
    return;
  }
  if (pathname === "/") {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; style-src 'unsafe-inline'; frame-src 'self'; base-uri 'none'; form-action 'none'",
    );
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(
      `<!doctype html><meta charset="utf-8"><title>Funcaster creator preview</title><style>body{margin:0;background:#17231f;color:#fff;font:16px system-ui}header{padding:16px}iframe{display:block;width:100%;height:calc(100vh - 88px);border:0;background:#fff}small{color:#d5deb6}</style><header>${escape(bundle.manifest.title)} · isolated preview<br><small>No room credentials, network connections, downloads or persistent storage. Keyboard and pointer only.</small></header><iframe title="${escape(bundle.manifest.title)}" sandbox="allow-scripts" src="/bundle/index.html"></iframe>`,
    );
    return;
  }
  const data = files.get(pathname);
  if (!data) {
    res.writeHead(404).end("File not in validated bundle");
    return;
  }
  const own = "http://127.0.0.1:" + server.address().port;
  res.setHeader(
    "Content-Security-Policy",
    `default-src 'none'; script-src 'unsafe-inline' ${own}; style-src 'unsafe-inline' ${own}; img-src data: blob: ${own}; font-src ${own}; media-src blob: ${own}; connect-src ${own}/bundle/; worker-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; sandbox allow-scripts`,
  );
  res.setHeader("Access-Control-Allow-Origin", "*"); // Opaque sandbox needs this for local ESM.
  res.setHeader(
    "Content-Type",
    (mime[pathname.split(".").pop()] || "application/octet-stream") +
      (/\.(html|css|js|mjs|json|svg)$/.test(pathname) ? "; charset=utf-8" : ""),
  );
  res.end(req.method === "HEAD" ? undefined : data);
});
server.listen(0, "127.0.0.1", () =>
  console.log(
    `Validated ${bundle.gameId}@${bundle.version} (${bundle.bundleHash})\nPreview: http://127.0.0.1:${server.address().port}/\nCtrl+C to close.`,
  ),
);
