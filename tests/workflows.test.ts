import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";

const apiKey = "iff_dev_test_key_123456789";

test("POST /workflows should create a workflow", async () => {
  const app = await buildApp();

  const response = await app.inject({
    method: "POST",
    url: "/workflows",
    headers: {
      "x-api-key": apiKey,
      "content-type": "application/json",
    },
    payload: {
      name: "Test Workflow",
      description: "Created from automated test",
      trigger: {
        type: "webhook",
      },
      actions: [
        {
          type: "email",
          provider: "smtp",
        },
      ],
    },
  });

  const body = response.json();

  assert.equal(response.statusCode, 201);
  assert.equal(body.name, "Test Workflow");
  assert.equal(body.description, "Created from automated test");
  assert.equal(body.status, "ACTIVE");

  await app.close();
});

test("GET /workflows should list workflows", async () => {
  const app = await buildApp();

  const response = await app.inject({
    method: "GET",
    url: "/workflows",
    headers: {
      "x-api-key": apiKey,
    },
  });

  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(Array.isArray(body), true);

  await app.close();
});