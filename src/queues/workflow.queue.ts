import { Queue } from "bullmq";
import { redis } from "../plugins/redis.js";

export const workflowQueue = new Queue("workflow-executions", {
  connection: redis,
});