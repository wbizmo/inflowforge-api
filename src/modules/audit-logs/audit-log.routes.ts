import type { FastifyInstance } from "fastify";
import { prisma } from "../../plugins/prisma.js";
import { apiKeyAuth } from "../../middleware/api-key-auth.js";

export async function auditLogRoutes(app: FastifyInstance) {
  app.addHook("preHandler", apiKeyAuth);

  app.get("/", async (request) => {
    return prisma.auditLog.findMany({
      where: {
        workspaceId: request.workspace!.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  });
}