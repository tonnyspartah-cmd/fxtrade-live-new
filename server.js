const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon"
};

function handler(req, res) {
  if (req.url === "/api/health") {
    res.writeHead(200, {"Content-Type": "application/json"});
    return res.end(JSON.stringify({ok: true, mode: "prototype", realMoney: false}));
  }

  let pathname = decodeURIComponent((req.url || "/").split("?")[0]);
  if (pathname === "/") pathname = "/index.html";

  // Keep this standalone version independent from Deriv.
  // Only serve files that exist inside the project directory.
  const file = path.resolve(root, "." + pathname);
  if (!file.startsWith(root + path.sep) && file !== root) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, {"Content-Type": "text/plain; charset=utf-8"});
    return res.end("FXTRADE page not found");
  }

  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, {"Content-Type": mime[ext] || "application/octet-stream"});
  res.end(fs.readFileSync(file));
}

module.exports = handler;

if (require.main === module) {
  const server = http.createServer(handler);
  server.listen(process.env.PORT || 3000, () => {
    console.log("FXTRADE prototype running");
  });
}
