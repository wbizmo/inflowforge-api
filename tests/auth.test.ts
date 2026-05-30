import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";

test("GET /protected/me should reject requests without API key", async () => {
  const app = await buildApp();

  const response = await app.inject({
    method: "GET",
    url: "/protected/me",
  });

  const body = response.json();

  assert.equal(response.statusCode, 401);
  assert.equal(body.error, "Unauthorized");
  assert.equal(body.message, "Missing x-api-key header");

  await app.close();
});

test("GET /protected/me should accept valid API key", async () => {
  const app = await buildApp();

  const response = await app.inject({
    method: "GET",
    url: "/protected/me",
    headers: {
      "x-api-key": "iff_dev_test_key_123456789",
    },
  });

  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(body.workspace.name, "Demo Workspace");
  assert.equal(body.apiKey.name, "Development Test Key");
  assert.equal(body.apiKey.status, "ACTIVE");

  await app.close();
});