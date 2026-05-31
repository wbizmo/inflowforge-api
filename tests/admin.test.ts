import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";

const adminToken = "dev_admin_secret_12345";

test("GET /admin/workspaces should list workspaces", async () => {
  const app = await buildApp();

  const response = await app.inject({
    method: "GET",
    url: "/admin/workspaces",
    headers: {
      "x-admin-token": adminToken,
    },
  });

  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(Array.isArray(body), true);

  await app.close();
});

test("GET /admin/api-keys should list API keys", async () => {
  const app = await buildApp();

  const response = await app.inject({
    method: "GET",
    url: "/admin/api-keys",
    headers: {
      "x-admin-token": adminToken,
    },
  });

  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(Array.isArray(body), true);

  await app.close();
});

test("GET /admin/analytics/overview should return analytics overview", async () => {
  const app = await buildApp();

  const response = await app.inject({
    method: "GET",
    url: "/admin/analytics/overview",
    headers: {
      "x-admin-token": adminToken,
    },
  });

  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(typeof body.workspaces, "number");
  assert.equal(typeof body.apiKeys, "number");
  assert.equal(typeof body.workflows, "number");
  assert.equal(typeof body.executions, "number");

  await app.close();
});

test("GET /admin/executions/recent should list recent executions", async () => {
  const app = await buildApp();

  const response = await app.inject({
    method: "GET",
    url: "/admin/executions/recent",
    headers: {
      "x-admin-token": adminToken,
    },
  });

  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(Array.isArray(body), true);

  await app.close();
});

test("GET /admin/executions/failed should list failed executions", async () => {
  const app = await buildApp();

  const response = await app.inject({
    method: "GET",
    url: "/admin/executions/failed",
    headers: {
      "x-admin-token": adminToken,
    },
  });

  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(Array.isArray(body), true);

  await app.close();
});

test("GET /admin/analytics/workflows should return workflow analytics", async () => {
  const app = await buildApp();

  const response = await app.inject({
    method: "GET",
    url: "/admin/analytics/workflows",
    headers: {
      "x-admin-token": adminToken,
    },
  });

  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(Array.isArray(body), true);

  await app.close();
});
