import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";

test("GET /health should return API health status", async () => {
  const app = await buildApp();

  const response = await app.inject({
    method: "GET",
    url: "/health",
  });

  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(body.status, "ok");
  assert.equal(body.service, "inFlowForge API");
  assert.equal(body.database, "connected");
  assert.equal(body.redis, "connected");
  assert.equal(body.queue, "ready");

  await app.close();
});