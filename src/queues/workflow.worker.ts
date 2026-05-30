import { Worker } from "bullmq";
import { prisma } from "../plugins/prisma.js";
import { redis } from "../plugins/redis.js";

export const workflowWorker = new Worker(
  "workflow-executions",
  async (job) => {
    console.log("Processing workflow job:", {
      id: job.id,
      name: job.name,
      data: job.data,
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

    const { executionId, workflowId, workspaceId, input } = job.data;

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

    const actions = workflow.actions as Array<Record<string, unknown>>;

    const actionResults = actions.map((action, index) => {
      return {
        index,
        action,
        status: "SUCCESS",
        simulated: true,
        executedAt: new Date().toISOString(),
      };
    });

    const output = {
      workflowId: workflow.id,
      workflowName: workflow.name,
      input,
      actionsExecuted: actionResults.length,
      results: actionResults,
    };

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
    connection: redis,
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