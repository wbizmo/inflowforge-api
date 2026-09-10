import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../plugins/prisma.js";
import { apiKeyAuth } from "../../middleware/api-key-auth.js";
import { workflowQueue } from "../../queues/workflow.queue.js";
import { createAuditLog } from "../../utils/audit-log.js";
import {
  paginationQueryJsonSchema,
  paginationQuerySchema,
  sendPage,
} from "../../utils/pagination.js";

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

const conditionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    field: {
      type: "string",
      description:
        "Input field to evaluate. Example: plan, input.plan, user.email",
    },
    operator: {
      type: "string",
      enum: [
        "equals",
        "not_equals",
        "contains",
        "exists",
        "greater_than",
        "less_than",
      ],
      description: "Condition operator",
    },
    value: {
      description: "Expected comparison value",
    },
  },
  required: ["field", "operator"],
};

const actionSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    type: {
      type: "string",
      enum: ["email", "telegram", "http_request", "log", "delay"],
      description: "Action type to execute",
    },

    to: {
      type: "string",
      description:
        "Email recipient. Supports templates like {{input.email}}. Used by email action.",
    },
    subject: {
      type: "string",
      description:
        "Email subject. Supports templates like Welcome {{input.name}}. Used by email action.",
    },
    html: {
      type: "string",
      description:
        "Email HTML body. Supports templates like <p>Hello {{input.name}}</p>. Used by email action.",
    },
    text: {
      type: "string",
      description:
        "Email plain text body. Supports templates. Used by email action.",
    },

    message: {
      type: "string",
      description:
        "Message content for telegram or log actions. Supports templates like {{input.email}}.",
    },

    method: {
      type: "string",
      enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      description: "HTTP method for http_request action.",
    },
    url: {
      type: "string",
      description:
        "Target URL for http_request action. Supports templates.",
    },
    headers: {
      type: "object",
      additionalProperties: true,
      description: "Optional headers for http_request action.",
    },
    body: {
      type: "object",
      additionalProperties: true,
      description:
        "Optional JSON body for http_request action. Supports templates.",
    },

    seconds: {
      type: "number",
      description:
        "Delay duration in seconds. Used by delay action. Currently capped internally for safety.",
    },
  },
  required: ["type"],
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
      description:
        "Trigger configuration. Example: { type: 'webhook' }",
      properties: {
        type: {
          type: "string",
          description: "Trigger type, for example webhook or schedule",
        },
      },
    },
    conditions: {
      oneOf: [
        conditionSchema,
        {
          type: "array",
          items: conditionSchema,
        },
      ],
      description:
        "Optional condition or list of conditions. Actions run only when conditions pass. Example: { field: 'plan', operator: 'equals', value: 'premium' }",
    },
    actions: {
      type: "array",
      minItems: 1,
      description:
        "Actions to execute when the workflow runs. Supported action types: email, telegram, http_request, log, delay.",
      items: actionSchema,
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
      properties: {
        type: {
          type: "string",
          description: "Trigger type, for example webhook or schedule",
        },
      },
    },
    conditions: {
      oneOf: [
        conditionSchema,
        {
          type: "array",
          items: conditionSchema,
        },
      ],
      description:
        "Optional condition or list of conditions. Actions run only when conditions pass.",
    },
    actions: {
      type: "array",
      minItems: 1,
      description:
        "Actions to execute when the workflow runs. Supported action types: email, telegram, http_request, log, delay.",
      items: actionSchema,
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
      description:
        "Input payload passed into the workflow execution. Example: { name: 'Williams', email: 'demo@example.com', plan: 'premium' }",
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
          "Creates a workflow for the authenticated workspace. Workflows can use webhook triggers, optional conditions, and actions like Resend email, Telegram notifications, HTTP requests, logs, and delays.",
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
        description:
          "Lists workflows belonging to the authenticated workspace using bounded cursor pagination. The response remains an array; when another page exists its cursor is returned in the x-next-cursor header.",
        headers: apiKeyHeaderSchema,
        querystring: paginationQueryJsonSchema,
        security: [{ ApiKeyAuth: [] }],
      },
    },
    async (request, reply) => {
      const { limit, cursor } = paginationQuerySchema.parse(request.query);
      const rows = await prisma.workflow.findMany({
        where: { workspaceId: request.workspace!.id },
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
          "Creates a workflow execution record and queues it for background processing. The worker evaluates conditions and runs configured actions.",
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
