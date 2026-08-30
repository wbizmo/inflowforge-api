import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../plugins/prisma.js";
import { workflowQueue } from "../../queues/workflow.queue.js";
import { createAuditLog } from "../../utils/audit-log.js";

const webhookParamsSchema = {
  type: "object",
  properties: { workflowId: { type: "string", description: "Workflow ID to trigger via webhook" } },
  required: ["workflowId"],
};

const webhookBodySchema = { type: "object", additionalProperties: true, description: "Any JSON payload sent by the external system" };

function secretMatches(presented: unknown, expected: string): boolean {
  if (typeof presented !== "string" || !presented) return false;
  const a = Buffer.from(presented, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function webhookRoutes(app: FastifyInstance) {
  app.post(
    "/:workflowId",
    {
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: {
        tags: ["Webhooks"],
        summary: "Trigger workflow by authenticated webhook",
        description: "Receives an external webhook payload only when the shared trigger secret is supplied in x-inflowforge-webhook-secret.",
        params: webhookParamsSchema,
        body: webhookBodySchema,
        headers: {
          type: "object",
          required: ["x-inflowforge-webhook-secret"],
          properties: { "x-inflowforge-webhook-secret": { type: "string", minLength: 16 } },
        },
      },
    },
    async (request, reply) => {
      const expectedSecret = process.env.WEBHOOK_TRIGGER_SECRET;
      if (!expectedSecret || expectedSecret.length < 32) {
        request.log.error("WEBHOOK_TRIGGER_SECRET is missing or too short");
        return reply.status(503).send({ error: "Service Unavailable", message: "Webhook triggers are not configured" });
      }
      if (!secretMatches(request.headers["x-inflowforge-webhook-secret"], expectedSecret)) {
        return reply.status(401).send({ error: "Unauthorized", message: "Invalid webhook credentials" });
      }

      const params = z.object({ workflowId: z.string() }).parse(request.params);
      const workflow = await prisma.workflow.findFirst({ where: { id: params.workflowId, status: "ACTIVE" } });
      if (!workflow) return reply.status(404).send({ error: "Not Found", message: "Active workflow not found" });

      const payload = ((request.body as Record<string, unknown>) ?? {}) as Prisma.InputJsonValue;
      const execution = await prisma.workflowExecution.create({
        data: { status: "PENDING", input: payload, workspaceId: workflow.workspaceId, workflowId: workflow.id },
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
        metadata: { workflowId: workflow.id, jobId: job.id },
      });

      return reply.status(202).send({ success: true, message: "Webhook received and workflow execution queued", workflowId: workflow.id, executionId: execution.id, jobId: job.id });
    }
  );
}
