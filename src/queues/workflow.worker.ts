import { Worker } from "bullmq";
import { redis } from "../plugins/redis.js";

export const workflowWorker = new Worker(
  "workflow-executions",
  async (job) => {
    console.log("Processing workflow job:", {
      id: job.id,
      name: job.name,
      data: job.data,
    });

    return {
      success: true,
      processedAt: new Date().toISOString(),
    };
  },
  {
    connection: redis,
  }
);

workflowWorker.on("completed", (job) => {
  console.log(`Workflow job ${job.id} completed`);
});

workflowWorker.on("failed", (job, error) => {
  console.error(`Workflow job ${job?.id} failed`, error);
});