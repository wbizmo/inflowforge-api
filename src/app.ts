import Fastify from "fastify";
import { prisma } from "./plugins/prisma.js";
import { redis } from "./plugins/redis.js";
import { workflowQueue } from "./queues/workflow.queue.js";

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  app.get("/", async () => {
    return {
      message: "inFlowForge API is running",
    };
  });

  app.get("/health", async () => {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();

    return {
      status: "ok",
      service: "inFlowForge API",
      database: "connected",
      redis: "connected",
      queue: "ready",
    };
  });

  app.post("/queue/test", async () => {
    const job = await workflowQueue.add("test-job", {
      message: "Hello from BullMQ",
      createdAt: new Date(),
    });

    return {
      success: true,
      jobId: job.id,
    };
  });

  return app;
}