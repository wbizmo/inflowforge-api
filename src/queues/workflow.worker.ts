import type { Prisma } from "@prisma/client";
import { Worker } from "bullmq";
import { prisma } from "../plugins/prisma.js";
import { redisConnectionOptions } from "../plugins/redis.js";
import { evaluateConditions } from "../engine/condition-engine.js";
import { executeActions } from "../engine/action-engine.js";

export const workflowWorker = new Worker(
  "workflow-executions",
  async (job) => {
    const { executionId, workflowId, workspaceId, input } = job.data ?? {};

    console.log("Processing workflow job:", {
      id: job.id,
      name: job.name,
      executionId,
      workflowId,
      workspaceId,
    });

    if (job.name === "test-job") {
      return {
        success: true,
        processedAt: new Date().toISOString(),
      };
    }

    if (job.name !== "execute-workflow") {
      throw new Error(`Unknown job type: ${job.name}`);
    }

    await prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
      },
    });

    const workflow = await prisma.workflow.findFirst({
      where: {
        id: workflowId,
        workspaceId,
      },
    });

    if (!workflow) {
      throw new Error("Workflow not found during execution");
    }

    const workflowInput = (input ?? {}) as Record<string, unknown>;
    const actions = workflow.actions as Array<Record<string, unknown>>;

    const conditionResult = evaluateConditions(
      workflow.conditions,
      workflowInput
    );

    if (!conditionResult.passed) {
      const output = {
        workflowId: workflow.id,
        workflowName: workflow.name,
        input: workflowInput,
        conditions: conditionResult,
        skipped: true,
        actionsExecuted: 0,
        results: [],
      } as Prisma.InputJsonValue;

      await prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: "SUCCESS",
          output,
          finishedAt: new Date(),
        },
      });

      return output;
    }

    const actionResults = await executeActions({
      actions,
      input: workflowInput,
    });

    const output = {
      workflowId: workflow.id,
      workflowName: workflow.name,
      input: workflowInput,
      conditions: conditionResult,
      skipped: false,
      actionsExecuted: actionResults.length,
      results: actionResults,
    } as Prisma.InputJsonValue;

    await prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        status: "SUCCESS",
        output,
        finishedAt: new Date(),
      },
    });

    return output;
  },
  {
    connection: redisConnectionOptions,
  }
);

workflowWorker.on("completed", (job) => {
  console.log(`Workflow job ${job.id} completed`);
});

workflowWorker.on("failed", async (job, error) => {
  console.error(`Workflow job ${job?.id} failed`, error);

  const executionId = job?.data?.executionId;

  if (executionId) {
    await prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        status: "FAILED",
        error: error.message,
        finishedAt: new Date(),
      },
    });
  }
});
