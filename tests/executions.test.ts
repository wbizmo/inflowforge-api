import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";

const apiKey = "iff_dev_test_key_123456789";

test("POST /workflows/:id/execute should queue execution", async () => {
  const app = await buildApp();

  // Create workflow first
  const workflowResponse = await app.inject({
    method: "POST",
    url: "/workflows",
    headers: {
      "x-api-key": apiKey,
      "content-type": "application/json",
    },
    payload: {
      name: "Execution Test Workflow",
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

  const workflow = workflowResponse.json();

  // Execute workflow
  const response = await app.inject({
    method: "POST",
    url: `/workflows/${workflow.id}/execute`,
    headers: {
      "x-api-key": apiKey,
      "content-type": "application/json",
    },
    payload: {
      input: {
        email: "demo@example.com",
        name: "Demo User",
      },
    },
  });

  const body = response.json();

  assert.equal(response.statusCode, 202);
  assert.equal(body.success, true);
  assert.ok(body.executionId);
  assert.ok(body.jobId);

  await app.close();
});