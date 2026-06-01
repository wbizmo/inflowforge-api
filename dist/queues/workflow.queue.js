import { Queue } from "bullmq";
import { redisConnectionOptions } from "../plugins/redis.js";
export const workflowQueue = new Queue("workflow-executions", {
    connection: redisConnectionOptions,
});
