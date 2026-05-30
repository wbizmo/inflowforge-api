import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../plugins/prisma.js";
import { apiKeyAuth } from "../../middleware/api-key-auth.js";

export async function executionRoutes(app: FastifyInstance) {
  app.addHook("preHandler", apiKeyAuth);

  app.get("/", async (request) => {
    return prisma.workflowExecution.findMany({
      where: {
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
      orderBy: {
        createdAt: "desc",
      },
    });
  });

  app.get("/:id", async (request, reply) => {
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
  });
}