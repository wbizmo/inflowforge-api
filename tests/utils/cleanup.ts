import { prisma } from "../../src/plugins/prisma.js";
import { redis } from "../../src/plugins/redis.js";
import { workflowQueue } from "../../src/queues/workflow.queue.js";

export async function closeTestResources() {
  await workflowQueue.close().catch(() => {});
  await prisma.$disconnect().catch(() => {});

  if (redis.status !== "end") {
    await redis.quit().catch(() => redis.disconnect());
  }
}
