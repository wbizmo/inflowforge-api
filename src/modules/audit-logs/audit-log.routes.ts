import type { FastifyInstance } from "fastify";
import { prisma } from "../../plugins/prisma.js";
import { apiKeyAuth } from "../../middleware/api-key-auth.js";
import {
  paginationQueryJsonSchema,
  paginationQuerySchema,
  sendPage,
} from "../../utils/pagination.js";

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
        description:
          "Lists audit logs belonging to the authenticated workspace using bounded cursor pagination. The response remains an array; when another page exists its cursor is returned in the x-next-cursor header.",
        headers: apiKeyHeaderSchema,
        querystring: paginationQueryJsonSchema,
        security: [{ ApiKeyAuth: [] }],
      },
    },
    async (request, reply) => {
      const { limit, cursor } = paginationQuerySchema.parse(request.query);
      const rows = await prisma.auditLog.findMany({
        where: { workspaceId: request.workspace!.id },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      return sendPage(rows, limit, reply);
    }
  );
}
