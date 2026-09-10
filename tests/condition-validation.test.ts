import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/plugins/prisma.js";

const apiKey = "iff_dev_test_key_123456789";
const headers = {
  "x-api-key": apiKey,
  "content-type": "application/json",
};

async function createWithConditions(conditions: unknown) {
  const app = await buildApp();
  const response = await app.inject({
    method: "POST",
    url: "/workflows",
    headers,
    payload: {
      name: `Condition validation ${Date.now()}`,
      trigger: { type: "manual" },
      conditions,
      actions: [{ type: "log", message: "ok" }],
    },
  });
  await app.close();
  return response;
}

test("workflow creation accepts one documented condition", async () => {
  const response = await createWithConditions({
    field: "plan",
    operator: "equals",
    value: "premium",
  });

  assert.equal(response.statusCode, 201);
  await prisma.workflow.delete({ where: { id: response.json().id } });
});

test("workflow creation accepts multiple documented conditions", async () => {
  const response = await createWithConditions([
    { field: "plan", operator: "equals", value: "premium" },
    { field: "age", operator: "greater_than", value: 18 },
  ]);

  assert.equal(response.statusCode, 201);
  await prisma.workflow.delete({ where: { id: response.json().id } });
});

test("workflow creation rejects an unsupported condition operator", async () => {
  const response = await createWithConditions({
    field: "plan",
    operator: "approximately_equals",
    value: "premium",
  });

  assert.equal(response.statusCode, 400);
});
