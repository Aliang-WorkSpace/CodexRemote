import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {
  resolveClientModulePath,
  resolveStaticAppPath,
  tryServeStaticApp
} from "../src/server/static-app.js";

test("resolveStaticAppPath maps /app to index.html", () => {
  const appRoot = "/tmp/app";
  assert.equal(resolveStaticAppPath({ pathname: "/app", appRoot }), path.join(appRoot, "index.html"));
  assert.equal(resolveStaticAppPath({ pathname: "/app/", appRoot }), path.join(appRoot, "index.html"));
});

test("resolveStaticAppPath rejects directory traversal", () => {
  const appRoot = "/tmp/app";
  assert.equal(resolveStaticAppPath({ pathname: "/app/../secret.txt", appRoot }), null);
});

test("resolveClientModulePath maps client module paths safely", () => {
  const clientRoot = "/tmp/client";
  assert.equal(
    resolveClientModulePath({
      pathname: "/src/client/codex-remote-client.js",
      clientRoot
    }),
    path.join(clientRoot, "codex-remote-client.js")
  );
  assert.equal(
    resolveClientModulePath({
      pathname: "/src/client/../secret.js",
      clientRoot
    }),
    null
  );
});

test("tryServeStaticApp returns false for missing files", async () => {
  const response = createMockResponse();
  const served = await tryServeStaticApp({
    pathname: "/app/missing.js",
    appRoot: path.join(process.cwd(), "public", "app"),
    response,
    requestId: "req_missing"
  });

  assert.equal(served, false);
});

function createMockResponse() {
  return {
    headers: null,
    body: null,
    writeHead(_statusCode, headers) {
      this.headers = headers;
    },
    end(body) {
      this.body = body;
    }
  };
}
