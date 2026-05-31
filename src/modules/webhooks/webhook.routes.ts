import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../plugins/prisma.js";
import { workflowQueue } from "../../queues/workflow.queue.js";
import { createAuditLog } from "../../utils/audit-log.js";

const webhookParamsSchema = {
  type: "object",
  properties: {
    workflowId: {
      type: "string",
      description: "Workflow ID to trigger via webhook",
    },
  },
  required: ["workflowId"],
};

const webhookBodySchema = {
  type: "object",
  additionalProperties: true,
  description: "Any JSON payload sent by the external system",
};

export async function webhookRoutes(app: FastifyInstance) {
  app.post(
    "/:workflowId",
    {
      schema: {
        tags: ["Webhooks"],
        summary: "Trigger workflow by webhook",
        description:
          "Receives an external webhook payload and queues the matching active workflow for execution.",
        params: webhookParamsSchema,
        body: webhookBodySchema,
      },
    },
    async (request, reply) => {
      const params = z.object({ workflowId: z.string() }).parse(request.params);

      const workflow = await prisma.workflow.findFirst({
        where: {
          id: params.workflowId,
          status: "ACTIVE",
        },
      });

      if (!workflow) {
        return reply.status(404).send({
          error: "Not Found",
          message: "Active workflow not found",
        });
      }

      const execution = await prisma.workflowExecution.create({
        data: {
          status: "PENDING",
          input: (request.body as Record<string, unknown>) ?? {},
          workspaceId: workflow.workspaceId,
          workflowId: workflow.id,
        },
      });

      const job = await workflowQueue.add("execute-workflow", {
        executionId: execution.id,
        workflowId: workflow.id,
        workspaceId: workflow.workspaceId,
        input: request.body ?? {},
        source: "webhook",
      });

      await createAuditLog({
        workspaceId: workflow.workspaceId,
        action: "workflow.webhook_triggered",
        entity: "WorkflowExecution",
        entityId: execution.id,
        metadata: {
          workflowId: workflow.id,
          jobId: job.id,
        },
      });

      return reply.status(202).send({
        success: true,
        message: "Webhook received and workflow execution queued",
        workflowId: workflow.id,
        executionId: execution.id,
        jobId: job.id,
      });
    }
  );
}