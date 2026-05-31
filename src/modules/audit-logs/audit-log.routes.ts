import type { FastifyInstance } from "fastify";
import { prisma } from "../../plugins/prisma.js";
import { apiKeyAuth } from "../../middleware/api-key-auth.js";

const apiKeyHeaderSchema = {
  type: "object",
  properties: {
    "x-api-key": {
      type: "string",
      description: "Workspace API key",
    },
  },
};

export async function auditLogRoutes(app: FastifyInstance) {
  app.addHook("preHandler", apiKeyAuth);

  app.get(
    "/",
    {
      schema: {
        tags: ["Audit Logs"],
        summary: "List audit logs",
        description: "Lists audit logs belonging to the authenticated workspace.",
        headers: apiKeyHeaderSchema,
        security: [{ ApiKeyAuth: [] }],
      },
    },
    async (request) => {
      return prisma.auditLog.findMany({
        where: {
          workspaceId: request.workspace!.id,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    }
  );
}