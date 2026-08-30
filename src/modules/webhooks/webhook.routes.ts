import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
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

function validWebhookSecret(provided: unknown): boolean {
  const expected = process.env.WEBHOOK_TRIGGER_SECRET;
  if (!expected || typeof provided !== "string") return false;

  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");
  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}

export async function webhookRoutes(app: FastifyInstance) {
  app.post(
    "/:workflowId",
    {
      schema: {
        tags: ["Webhooks"],
        summary: "Trigger workflow by webhook",
        description:
          "Receives an authenticated external webhook payload and queues the matching active workflow for execution.",
        params: webhookParamsSchema,
        body: webhookBodySchema,
        headers: {
          type: "object",
          required: ["x-inflowforge-webhook-secret"],
          properties: {
            "x-inflowforge-webhook-secret": { type: "string", minLength: 16 },
          },
        },
      },
    },
    async (request, reply) => {
      if (!process.env.WEBHOOK_TRIGGER_SECRET) {
        request.log.error("WEBHOOK_TRIGGER_SECRET is not configured; webhook triggers are disabled");
        return reply.status(503).send({
          error: "Service Unavailable",
          message: "Webhook triggers are not configured",
        });
      }

      if (!validWebhookSecret(request.headers["x-inflowforge-webhook-secret"])) {
        return reply.status(401).send({
          error: "Unauthorized",
          message: "Invalid webhook secret",
        });
      }

      const params = z.object({
        workflowId: z.string(),
      }).parse(request.params);

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

      const payload =
        ((request.body as Record<string, unknown>) ??
          {}) as Prisma.InputJsonValue;

      const execution = await prisma.workflowExecution.create({
        data: {
          status: "PENDING",
          input: payload,
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
