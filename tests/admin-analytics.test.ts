import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/plugins/prisma.js";

const adminToken = "dev_admin_secret_12345";

test("workflow analytics returns grouped execution counts", async () => {
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { slug: "demo-workspace" },
  });
  const workflow = await prisma.workflow.create({
    data: {
      name: "Analytics aggregation fixture",
      trigger: { type: "manual" },
      actions: [{ type: "log", message: "fixture" }],
      workspaceId: workspace.id,
    },
  });

  await prisma.workflowExecution.createMany({
    data: [
      { workflowId: workflow.id, workspaceId: workspace.id, status: "SUCCESS" },
      { workflowId: workflow.id, workspaceId: workspace.id, status: "SUCCESS" },
      { workflowId: workflow.id, workspaceId: workspace.id, status: "FAILED" },
      { workflowId: workflow.id, workspaceId: workspace.id, status: "PENDING" },
      { workflowId: workflow.id, workspaceId: workspace.id, status: "RUNNING" },
    ],
  });

  const app = await buildApp();
  const response = await app.inject({
    method: "GET",
    url: "/admin/analytics/workflows",
    headers: { "x-admin-token": adminToken },
  });
  const row = response.json().find((item: { id: string }) => item.id === workflow.id);

  assert.equal(response.statusCode, 200);
  assert.equal(row.totalExecutions, 5);
  assert.equal(row.successfulExecutions, 2);
  assert.equal(row.failedExecutions, 1);
  assert.equal(row.pendingExecutions, 1);
  assert.equal(row.runningExecutions, 1);
  assert.equal(typeof row.lastExecutionAt, "string");

  await app.close();
  await prisma.workflow.delete({ where: { id: workflow.id } });
});
