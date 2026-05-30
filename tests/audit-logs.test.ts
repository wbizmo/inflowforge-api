import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";

const apiKey = "iff_dev_test_key_123456789";

test("GET /audit-logs should list audit logs", async () => {
  const app = await buildApp();

  const response = await app.inject({
    method: "GET",
    url: "/audit-logs",
    headers: {
      "x-api-key": apiKey,
    },
  });

  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(Array.isArray(body), true);

  await app.close();
});