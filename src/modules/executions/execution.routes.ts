import type { FastifyInstance } from "fastify";
import { z } from "zod";
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

const executionParamsSchema = {
  type: "object",
  properties: {
    id: {
      type: "string",
      description: "Workflow execution ID",
    },
  },
  required: ["id"],
};

export async function executionRoutes(app: FastifyInstance) {
  app.addHook("preHandler", apiKeyAuth);

  app.get(
    "/",
    {
      schema: {
        tags: ["Executions"],
        summary: "List workflow executions",
        description:
          "Lists workflow executions belonging to the authenticated workspace using bounded cursor pagination. The response remains an array; when another page exists its cursor is returned in the x-next-cursor header.",
        headers: apiKeyHeaderSchema,
        querystring: paginationQueryJsonSchema,
        security: [{ ApiKeyAuth: [] }],
      },
    },
    async (request, reply) => {
      const { limit, cursor } = paginationQuerySchema.parse(request.query);
      const rows = await prisma.workflowExecution.findMany({
        where: { workspaceId: request.workspace!.id },
        include: {
          workflow: {
            select: { id: true, name: true },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      return sendPage(rows, limit, reply);
    }
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: ["Executions"],
        summary: "Get workflow execution",
        description:
          "Returns one workflow execution by ID if it belongs to the authenticated workspace.",
        headers: apiKeyHeaderSchema,
        params: executionParamsSchema,
        security: [{ ApiKeyAuth: [] }],
      },
    },
    async (request, reply) => {
      const params = z.object({ id: z.string() }).parse(request.params);

      const execution = await prisma.workflowExecution.findFirst({
        where: {
          id: params.id,
          workspaceId: request.workspace!.id,
        },
        include: {
          workflow: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!execution) {
        return reply.status(404).send({
          error: "Not Found",
          message: "Execution not found",
        });
      }

      return execution;
    }
  );
}
