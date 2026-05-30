import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";

const apiKey = "iff_dev_test_key_123456789";

test("PATCH /workflows/:id should update a workflow", async () => {
  const app = await buildApp();

  const createResponse = await app.inject({
    method: "POST",
    url: "/workflows",
    headers: {
      "x-api-key": apiKey,
      "content-type": "application/json",
    },
    payload: {
      name: "Workflow Before Update",
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

  const workflow = createResponse.json();

  const updateResponse = await app.inject({
    method: "PATCH",
    url: `/workflows/${workflow.id}`,
    headers: {
      "x-api-key": apiKey,
      "content-type": "application/json",
    },
    payload: {
      name: "Workflow After Update",
    },
  });

  const updatedWorkflow = updateResponse.json();

  assert.equal(updateResponse.statusCode, 200);
  assert.equal(updatedWorkflow.name, "Workflow After Update");

  await app.close();
});

test("DELETE /workflows/:id should delete a workflow", async () => {
  const app = await buildApp();

  const createResponse = await app.inject({
    method: "POST",
    url: "/workflows",
    headers: {
      "x-api-key": apiKey,
      "content-type": "application/json",
    },
    payload: {
      name: "Workflow To Delete",
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

  const workflow = createResponse.json();

  const deleteResponse = await app.inject({
    method: "DELETE",
    url: `/workflows/${workflow.id}`,
    headers: {
      "x-api-key": apiKey,
    },
  });

  const body = deleteResponse.json();

  assert.equal(deleteResponse.statusCode, 200);
  assert.equal(body.success, true);
  assert.equal(body.message, "Workflow deleted");

  await app.close();
});