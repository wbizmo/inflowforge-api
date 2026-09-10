import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";

const configuredToken = "dev_admin_secret_12345";

test("admin routes reject an invalid token", async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: "GET",
    url: "/admin/workspaces",
    headers: { "x-admin-token": "definitely-not-valid" },
  });

  assert.equal(response.statusCode, 401);
  await app.close();
});

test("admin auth fails closed when ADMIN_TOKEN is absent", async () => {
  const original = process.env.ADMIN_TOKEN;
  delete process.env.ADMIN_TOKEN;

  const app = await buildApp();
  const response = await app.inject({
    method: "GET",
    url: "/admin/workspaces",
    headers: { "x-admin-token": configuredToken },
  });

  assert.equal(response.statusCode, 503);
  await app.close();

  if (original) process.env.ADMIN_TOKEN = original;
});
