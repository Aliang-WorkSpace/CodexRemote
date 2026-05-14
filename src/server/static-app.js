import fs from "node:fs/promises";
import path from "node:path";

const contentTypeByExtension = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".webmanifest", "application/manifest+json; charset=utf-8"]
]);

export function resolveStaticAppPath({ pathname, appRoot }) {
  if (pathname === "/app" || pathname === "/app/") {
    return path.join(appRoot, "index.html");
  }

  if (!pathname.startsWith("/app/")) {
    return null;
  }

  const relativePath = pathname.replace("/app/", "");
  const safePath = path.normalize(relativePath);

  if (safePath.startsWith("..")) {
    return null;
  }

  return path.join(appRoot, safePath);
}

export function resolveClientModulePath({ pathname, clientRoot }) {
  if (!pathname.startsWith("/src/client/")) {
    return null;
  }

  const relativePath = pathname.replace("/src/client/", "");
  const safePath = path.normalize(relativePath);

  if (safePath.startsWith("..")) {
    return null;
  }

  return path.join(clientRoot, safePath);
}

export async function tryServeStaticApp({ pathname, appRoot, response, requestId }) {
  const filePath = resolveStaticAppPath({ pathname, appRoot });
  return tryServeFile({ filePath, response, requestId });
}

export async function tryServeStaticAppIndex({
  pathname,
  appRoot,
  response,
  requestId,
  initialState = null
}) {
  const filePath = resolveStaticAppPath({ pathname, appRoot });
  if (!filePath || !filePath.endsWith("index.html")) {
    return false;
  }

  try {
    let content = await fs.readFile(filePath, "utf8");
    if (initialState) {
      const serialized = JSON.stringify(initialState).replaceAll("<", "\\u003c");
      const bootstrapTag = `<script>window.__CODEX_REMOTE_INITIAL_STATE__ = ${serialized};window.__CONTROL_PLANE_INITIAL_STATE__ = window.__CODEX_REMOTE_INITIAL_STATE__;</script>`;
      content = content.replace('<script type="module" src="/app/app.js"></script>', `${bootstrapTag}\n    <script type="module" src="/app/app.js"></script>`);
    }

    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "x-request-id": requestId
    });
    response.end(content);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

export async function tryServeClientModule({ pathname, clientRoot, response, requestId }) {
  const filePath = resolveClientModulePath({ pathname, clientRoot });
  return tryServeFile({ filePath, response, requestId });
}

async function tryServeFile({ filePath, response, requestId }) {
  if (!filePath) {
    return false;
  }

  try {
    const content = await fs.readFile(filePath);
    const extension = path.extname(filePath);
    response.writeHead(200, {
      "content-type": contentTypeByExtension.get(extension) ?? "application/octet-stream",
      "x-request-id": requestId
    });
    response.end(content);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}
