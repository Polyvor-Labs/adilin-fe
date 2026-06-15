import {createReadStream} from "node:fs";
import {stat} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";

const BACKEND_URL = (process.env.JUSTIKA_BACKEND_URL || "http://151.243.222.93:37990").replace(/\/+$/, "");
const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 5173);
const ROOT = path.dirname(fileURLToPath(import.meta.url));

const CONTENT_TYPES = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
};

function readBody(request) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        request.on("data", (chunk) => chunks.push(chunk));
        request.on("end", () => resolve(Buffer.concat(chunks)));
        request.on("error", reject);
    });
}

function sendText(response, statusCode, text, contentType = "text/plain; charset=utf-8") {
    response.writeHead(statusCode, {"Content-Type": contentType});
    response.end(text);
}

async function proxyToBackend(request, response) {
    const body = await readBody(request);
    const upstream = await fetch(`${BACKEND_URL}${request.url}`, {
        method: request.method,
        headers: {
            "Content-Type": request.headers["content-type"] || "application/json",
        },
        body: request.method === "GET" || request.method === "HEAD" ? undefined : body,
    });
    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const payload = Buffer.from(await upstream.arrayBuffer());
    response.writeHead(upstream.status, {"Content-Type": contentType});
    response.end(payload);
}

async function sendFile(response, urlPath) {
    let safePath = decodeURIComponent(urlPath.split("?")[0]);
    if (safePath === "/") safePath = "/index.html";
    if (safePath === "/ai") safePath = "/ai/index.html";

    const candidate = path.resolve(ROOT, `.${safePath}`);
    if (!candidate.startsWith(ROOT)) {
        sendText(response, 403, "Forbidden");
        return;
    }

    try {
        const fileStat = await stat(candidate);
        if (!fileStat.isFile()) {
            sendText(response, 404, "Not found");
            return;
        }
    } catch {
        sendText(response, 404, "Not found");
        return;
    }

    response.writeHead(200, {"Content-Type": CONTENT_TYPES[path.extname(candidate)] || "application/octet-stream"});
    createReadStream(candidate).pipe(response);
}

const server = createServer(async (request, response) => {
    try {
        if (request.url.startsWith("/api/") || request.url === "/health") {
            await proxyToBackend(request, response);
            return;
        }
        await sendFile(response, request.url);
    } catch (error) {
        sendText(response, 502, error.message || "Proxy error");
    }
});

server.listen(PORT, HOST, () => {
    console.log(`Justika frontend running at http://${HOST}:${PORT}`);
    console.log(`Proxy backend: ${BACKEND_URL}`);
});
