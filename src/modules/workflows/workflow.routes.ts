import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../plugins/prisma.js";
import { apiKeyAuth } from "../../middleware/api-key-auth.js";
import { workflowQueue } from "../../queues/workflow.queue.js";
import { createAuditLog } from "../../utils/audit-log.js";

const createWorkflowSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  trigger: z.record(z.string(), z.any()),
  conditions: z.record(z.string(), z.any()).optional(),
  actions: z.array(z.record(z.string(), z.any())).min(1),
});

const updateWorkflowSchema = createWorkflowSchema.partial();

const executeWorkflowSchema = z.object({
  input: z.record(z.string(), z.any()).optional(),
});

const apiKeyHeaderSchema = {
  type: "object",
  properties: {
    "x-api-key": {
      type: "string",
      description: "Workspace API key",
    },
  },
};

const workflowBodySchema = {
  type: "object",
  required: ["name", "trigger", "actions"],
  properties: {
    name: {
      type: "string",
      minLength: 2,
      description: "Workflow name",
    },
    description: {
      type: "string",
      description: "Optional workflow description",
    },
    trigger: {
      type: "object",
      additionalProperties: true,
      description: "Trigger configuration, for example webhook or schedule",
    },
    conditions: {
      type: "object",
      additionalProperties: true,
      description: "Optional condition rules for the workflow",
    },
    actions: {
      type: "array",
      minItems: 1,
      description: "Workflow actions to execute",
      items: {
        type: "object",
        additionalProperties: true,
      },
    },
  },
};

const updateWorkflowBodySchema = {
  type: "object",
  properties: {
    name: {
      type: "string",
      minLength: 2,
      description: "Workflow name",
    },
    description: {
      type: "string",
      description: "Optional workflow description",
    },
    trigger: {
      type: "object",
      additionalProperties: true,
      description: "Trigger configuration",
    },
    conditions: {
      type: "object",
      additionalProperties: true,
      description: "Optional condition rules",
    },
    actions: {
      type: "array",
      minItems: 1,
      description: "Workflow actions to execute",
      items: {
        type: "object",
        additionalProperties: true,
      },
    },
  },
  additionalProperties: false,
};

const workflowParamsSchema = {
  type: "object",
  properties: {
    id: {
      type: "string",
      description: "Workflow ID",
    },
  },
  required: ["id"],
};

const executeWorkflowBodySchema = {
  type: "object",
  properties: {
    input: {
      type: "object",
      additionalProperties: true,
      description: "Input payload passed into the workflow execution",
    },
  },
};

export async function workflowRoutes(app: FastifyInstance) {
  app.addHook("preHandler", apiKeyAuth);

  app.post(
    "/",
    {
      schema: {
        tags: ["Workflows"],
        summary: "Create a workflow",
        description:
          "Creates a workflow for the authenticated workspace using the x-api-key header.",
        headers: apiKeyHeaderSchema,
        body: workflowBodySchema,
        security: [{ ApiKeyAuth: [] }],
      },
    },
    async (request, reply) => {
      const body = createWorkflowSchema.parse(request.body);

      const workflow = await prisma.workflow.create({
        data: {
          name: body.name,
          description: body.description,
          trigger: body.trigger,
          conditions: body.conditions,
          actions: body.actions,
          workspaceId: request.workspace!.id,
        },
      });

      await createAuditLog({
        workspaceId: request.workspace!.id,
        action: "workflow.created",
        entity: "Workflow",
        entityId: workflow.id,
        metadata: {
          name: workflow.name,
        },
      });

      return reply.status(201).send(workflow);
    }
  );

  app.get(
    "/",
    {
      schema: {
        tags: ["Workflows"],
        summary: "List workflows",
        description: "Lists workflows belonging to the authenticated workspace.",
        headers: apiKeyHeaderSchema,
        security: [{ ApiKeyAuth: [] }],
      },
    },
    async (request) => {
      return prisma.workflow.findMany({
        where: {
          workspaceId: request.workspace!.id,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    }
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: ["Workflows"],
        summary: "Get a workflow",
        description:
          "Returns one workflow by ID if it belongs to the authenticated workspace.",
        headers: apiKeyHeaderSchema,
        params: workflowParamsSchema,
        security: [{ ApiKeyAuth: [] }],
      },
    },
    async (request, reply) => {
      const params = z.object({ id: z.string() }).parse(request.params);

      const workflow = await prisma.workflow.findFirst({
        where: {
          id: params.id,
          workspaceId: request.workspace!.id,
        },
      });

      if (!workflow) {
        return reply.status(404).send({
          error: "Not Found",
          message: "Workflow not found",
        });
      }

      return workflow;
    }
  );

  app.post(
    "/:id/execute",
    {
      schema: {
        tags: ["Workflows"],
        summary: "Execute a workflow",
        description:
          "Creates a workflow execution record and queues it for background processing.",
        headers: apiKeyHeaderSchema,
        params: workflowParamsSchema,
        body: executeWorkflowBodySchema,
        security: [{ ApiKeyAuth: [] }],
      },
    },
    async (request, reply) => {
      const params = z.object({ id: z.string() }).parse(request.params);
      const body = executeWorkflowSchema.parse(request.body ?? {});

      const workflow = await prisma.workflow.findFirst({
        where: {
          id: params.id,
          workspaceId: request.workspace!.id,
        },
      });

      if (!workflow) {
        return reply.status(404).send({
          error: "Not Found",
          message: "Workflow not found",
        });
      }

      const execution = await prisma.workflowExecution.create({
        data: {
          status: "PENDING",
          input: body.input ?? {},
          workspaceId: request.workspace!.id,
          workflowId: workflow.id,
        },
      });

      const job = await workflowQueue.add("execute-workflow", {
        executionId: execution.id,
        workflowId: workflow.id,
        workspaceId: request.workspace!.id,
        input: body.input ?? {},
      });

      await createAuditLog({
        workspaceId: request.workspace!.id,
        action: "workflow.execution_queued",
        entity: "WorkflowExecution",
        entityId: execution.id,
        metadata: {
          workflowId: workflow.id,
          jobId: job.id,
        },
      });

      return reply.status(202).send({
        success: true,
        message: "Workflow execution queued",
        executionId: execution.id,
        jobId: job.id,
      });
    }
  );

  app.patch(
    "/:id",
    {
      schema: {
        tags: ["Workflows"],
        summary: "Update a workflow",
        description:
          "Updates a workflow that belongs to the authenticated workspace.",
        headers: apiKeyHeaderSchema,
        params: workflowParamsSchema,
        body: updateWorkflowBodySchema,
        security: [{ ApiKeyAuth: [] }],
      },
    },
    async (request, reply) => {
      const params = z.object({ id: z.string() }).parse(request.params);
      const body = updateWorkflowSchema.parse(request.body);

      const existing = await prisma.workflow.findFirst({
        where: {
          id: params.id,
          workspaceId: request.workspace!.id,
        },
      });

      if (!existing) {
        return reply.status(404).send({
          error: "Not Found",
          message: "Workflow not found",
        });
      }

      const workflow = await prisma.workflow.update({
        where: {
          id: existing.id,
        },
        data: body,
      });

      await createAuditLog({
        workspaceId: request.workspace!.id,
        action: "workflow.updated",
        entity: "Workflow",
        entityId: workflow.id,
        metadata: body,
      });

      return workflow;
    }
  );

  app.delete(
    "/:id",
    {
      schema: {
        tags: ["Workflows"],
        summary: "Delete a workflow",
        description:
          "Deletes a workflow that belongs to the authenticated workspace.",
        headers: apiKeyHeaderSchema,
        params: workflowParamsSchema,
        security: [{ ApiKeyAuth: [] }],
      },
    },
    async (request, reply) => {
      const params = z.object({ id: z.string() }).parse(request.params);

      const existing = await prisma.workflow.findFirst({
        where: {
          id: params.id,
          workspaceId: request.workspace!.id,
        },
      });

      if (!existing) {
        return reply.status(404).send({
          error: "Not Found",
          message: "Workflow not found",
        });
      }

      await prisma.workflow.delete({
        where: {
          id: existing.id,
        },
      });

      await createAuditLog({
        workspaceId: request.workspace!.id,
        action: "workflow.deleted",
        entity: "Workflow",
        entityId: existing.id,
        metadata: {
          name: existing.name,
        },
      });

      return {
        success: true,
        message: "Workflow deleted",
      };
    }
  );
}