import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";

const apiKey = "iff_dev_test_key_123456789";

test("GET /workflows without API key returns 401", async () => {
  const app = await buildApp();

  const response = await app.inject({
    method: "GET",
    url: "/workflows",
  });

  assert.equal(response.statusCode, 401);

  await app.close();
});

test("GET /executions without API key returns 401", async () => {
  const app = await buildApp();

  const response = await app.inject({
    method: "GET",
    url: "/executions",
  });

  assert.equal(response.statusCode, 401);

  await app.close();
});

test("GET /audit-logs without API key returns 401", async () => {
  const app = await buildApp();

  const response = await app.inject({
    method: "GET",
    url: "/audit-logs",
  });

  assert.equal(response.statusCode, 401);

  await app.close();
});

test("POST /workflows without name should fail", async () => {
  const app = await buildApp();

  const response = await app.inject({
    method: "POST",
    url: "/workflows",
    headers: {
      "x-api-key": apiKey,
      "content-type": "application/json",
    },
    payload: {
      trigger: {
        type: "webhook",
      },
      actions: [
        {
          type: "email",
        },
      ],
    },
  });

  assert.equal(response.statusCode >= 400, true);

  await app.close();
});

test("POST /workflows without actions should fail", async () => {
  const app = await buildApp();

  const response = await app.inject({
    method: "POST",
    url: "/workflows",
    headers: {
      "x-api-key": apiKey,
      "content-type": "application/json",
    },
    payload: {
      name: "Invalid Workflow",
      trigger: {
        type: "webhook",
      },
    },
  });

  assert.equal(response.statusCode >= 400, true);

  await app.close();
});

test("GET unknown workflow returns 404", async () => {
  const app = await buildApp();

  const response = await app.inject({
    method: "GET",
    url: "/workflows/does-not-exist",
    headers: {
      "x-api-key": apiKey,
    },
  });

  assert.equal(response.statusCode, 404);

  await app.close();
});

test("PATCH unknown workflow returns 404", async () => {
  const app = await buildApp();

  const response = await app.inject({
    method: "PATCH",
    url: "/workflows/does-not-exist",
    headers: {
      "x-api-key": apiKey,
      "content-type": "application/json",
    },
    payload: {
      name: "Updated",
    },
  });

  assert.equal(response.statusCode, 404);

  await app.close();
});

test("DELETE unknown workflow returns 404", async () => {
  const app = await buildApp();

  const response = await app.inject({
    method: "DELETE",
    url: "/workflows/does-not-exist",
    headers: {
      "x-api-key": apiKey,
    },
  });

  assert.equal(response.statusCode, 404);

  await app.close();
});

test("Executing unknown workflow returns 404", async () => {
  const app = await buildApp();

  const response = await app.inject({
    method: "POST",
    url: "/workflows/does-not-exist/execute",
    headers: {
      "x-api-key": apiKey,
      "content-type": "application/json",
    },
    payload: {},
  });

  assert.equal(response.statusCode, 404);

  await app.close();
});
