import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../plugins/prisma.js";
import { adminAuth } from "../../middleware/admin-auth.js";

function hashKey(key: string) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function generateApiKey() {
  return `iff_live_${crypto.randomBytes(24).toString("hex")}`;
}

const createApiKeySchema = z.object({
  name: z.string().min(2),
});

const adminHeaderSchema = {
  type: "object",
  properties: {
    "x-admin-token": {
      type: "string",
      description: "Admin access token",
    },
  },
};

const workspaceParamsSchema = {
  type: "object",
  properties: {
    workspaceId: {
      type: "string",
      description: "Workspace ID",
    },
  },
  required: ["workspaceId"],
};

const apiKeyParamsSchema = {
  type: "object",
  properties: {
    id: {
      type: "string",
      description: "API key ID",
    },
  },
  required: ["id"],
};

const createApiKeyBodySchema = {
  type: "object",
  required: ["name"],
  properties: {
    name: {
      type: "string",
      minLength: 2,
      description: "Display name for the API key",
    },
  },
};

type WorkflowMetrics = {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  pendingExecutions: number;
  runningExecutions: number;
  lastExecutionAt: Date | null;
};

function emptyWorkflowMetrics(): WorkflowMetrics {
  return {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    pendingExecutions: 0,
    runningExecutions: 0,
    lastExecutionAt: null,
  };
}

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", adminAuth);

  app.get(
    "/workspaces",
    {
      schema: {
        tags: ["Admin"],
        summary: "List workspaces",
        description: "Lists all workspaces with usage counts.",
        headers: adminHeaderSchema,
        security: [{ AdminTokenAuth: [] }],
      },
    },
    async () => {
      return prisma.workspace.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: {
              apiKeys: true,
              workflows: true,
              executions: true,
              auditLogs: true,
            },
          },
        },
      });
    }
  );

  app.get(
    "/api-keys",
    {
      schema: {
        tags: ["Admin"],
        summary: "List API keys",
        description: "Lists all API keys without exposing their secret values.",
        headers: adminHeaderSchema,
        security: [{ AdminTokenAuth: [] }],
      },
    },
    async () => {
      return prisma.apiKey.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          status: true,
          lastUsedAt: true,
          createdAt: true,
          revokedAt: true,
          workspace: {
            select: { id: true, name: true, slug: true },
          },
        },
      });
    }
  );

  app.post(
    "/workspaces/:workspaceId/api-keys",
    {
      schema: {
        tags: ["Admin"],
        summary: "Create API key",
        description:
          "Creates a new API key for a workspace. The plain key is shown only once.",
        headers: adminHeaderSchema,
        params: workspaceParamsSchema,
        body: createApiKeyBodySchema,
        security: [{ AdminTokenAuth: [] }],
      },
    },
    async (request, reply) => {
      const params = z.object({ workspaceId: z.string() }).parse(request.params);
      const body = createApiKeySchema.parse(request.body);

      const workspace = await prisma.workspace.findUnique({
        where: { id: params.workspaceId },
      });

      if (!workspace) {
        return reply.status(404).send({
          error: "Not Found",
          message: "Workspace not found",
        });
      }

      const plainApiKey = generateApiKey();

      const apiKey = await prisma.apiKey.create({
        data: {
          name: body.name,
          keyHash: hashKey(plainApiKey),
          keyPrefix: plainApiKey.slice(0, 12),
          workspaceId: workspace.id,
        },
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          status: true,
          createdAt: true,
        },
      });

      return reply.status(201).send({
        message:
          "API key created. Store this key securely because it will not be shown again.",
        apiKey,
        plainApiKey,
      });
    }
  );

  app.patch(
    "/api-keys/:id/revoke",
    {
      schema: {
        tags: ["Admin"],
        summary: "Revoke API key",
        description: "Revokes an API key so it can no longer access the API.",
        headers: adminHeaderSchema,
        params: apiKeyParamsSchema,
        security: [{ AdminTokenAuth: [] }],
      },
    },
    async (request, reply) => {
      const params = z.object({ id: z.string() }).parse(request.params);

      const existing = await prisma.apiKey.findUnique({
        where: { id: params.id },
      });

      if (!existing) {
        return reply.status(404).send({
          error: "Not Found",
          message: "API key not found",
        });
      }

      const apiKey = await prisma.apiKey.update({
        where: { id: existing.id },
        data: {
          status: "REVOKED",
          revokedAt: new Date(),
        },
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          status: true,
          revokedAt: true,
        },
      });

      return {
        success: true,
        message: "API key revoked",
        apiKey,
      };
    }
  );

  app.get(
    "/analytics/overview",
    {
      schema: {
        tags: ["Admin Analytics"],
        summary: "Get analytics overview",
        description:
          "Returns global platform metrics for workspaces, keys, workflows, executions, and audit logs.",
        headers: adminHeaderSchema,
        security: [{ AdminTokenAuth: [] }],
      },
    },
    async () => {
      const [
        workspaces,
        apiKeys,
        activeApiKeys,
        workflows,
        executions,
        successfulExecutions,
        failedExecutions,
        auditLogs,
      ] = await Promise.all([
        prisma.workspace.count(),
        prisma.apiKey.count(),
        prisma.apiKey.count({ where: { status: "ACTIVE" } }),
        prisma.workflow.count(),
        prisma.workflowExecution.count(),
        prisma.workflowExecution.count({ where: { status: "SUCCESS" } }),
        prisma.workflowExecution.count({ where: { status: "FAILED" } }),
        prisma.auditLog.count(),
      ]);

      return {
        workspaces,
        apiKeys,
        activeApiKeys,
        revokedApiKeys: apiKeys - activeApiKeys,
        workflows,
        executions,
        successfulExecutions,
        failedExecutions,
        auditLogs,
      };
    }
  );

  app.get(
    "/analytics/workflows",
    {
      schema: {
        tags: ["Admin Analytics"],
        summary: "Get workflow analytics",
        description:
          "Returns execution metrics grouped by workflow, including success, failure, pending, and running counts.",
        headers: adminHeaderSchema,
        security: [{ AdminTokenAuth: [] }],
      },
    },
    async () => {
      const [workflows, executionGroups] = await Promise.all([
        prisma.workflow.findMany({
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            workspace: {
              select: { id: true, name: true, slug: true },
            },
          },
        }),
        prisma.workflowExecution.groupBy({
          by: ["workflowId", "status"],
          _count: { _all: true },
          _max: { createdAt: true },
        }),
      ]);

      const metrics = new Map<string, WorkflowMetrics>();
      for (const group of executionGroups) {
        const current = metrics.get(group.workflowId) ?? emptyWorkflowMetrics();
        const count = group._count._all;
        current.totalExecutions += count;

        if (group.status === "SUCCESS") current.successfulExecutions += count;
        if (group.status === "FAILED") current.failedExecutions += count;
        if (group.status === "PENDING") current.pendingExecutions += count;
        if (group.status === "RUNNING") current.runningExecutions += count;

        const latest = group._max.createdAt;
        if (latest && (!current.lastExecutionAt || latest > current.lastExecutionAt)) {
          current.lastExecutionAt = latest;
        }
        metrics.set(group.workflowId, current);
      }

      return workflows.map((workflow) => ({
        ...workflow,
        ...(metrics.get(workflow.id) ?? emptyWorkflowMetrics()),
      }));
    }
  );

  app.get(
    "/executions/recent",
    {
      schema: {
        tags: ["Admin Executions"],
        summary: "List recent executions",
        description: "Returns the 20 most recent workflow executions.",
        headers: adminHeaderSchema,
        security: [{ AdminTokenAuth: [] }],
      },
    },
    async () => {
      return prisma.workflowExecution.findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
        include: {
          workspace: {
            select: { id: true, name: true, slug: true },
          },
          workflow: {
            select: { id: true, name: true, status: true },
          },
        },
      });
    }
  );

  app.get(
    "/executions/failed",
    {
      schema: {
        tags: ["Admin Executions"],
        summary: "List failed executions",
        description: "Returns the 20 most recent failed workflow executions.",
        headers: adminHeaderSchema,
        security: [{ AdminTokenAuth: [] }],
      },
    },
    async () => {
      return prisma.workflowExecution.findMany({
        where: { status: "FAILED" },
        take: 20,
        orderBy: { createdAt: "desc" },
        include: {
          workspace: {
            select: { id: true, name: true, slug: true },
          },
          workflow: {
            select: { id: true, name: true, status: true },
          },
        },
      });
    }
  );

  app.patch(
    "/executions/mark-stale-failed",
    {
      schema: {
        tags: ["Admin Executions"],
        summary: "Mark stale executions as failed",
        description:
          "Marks old PENDING or RUNNING executions as FAILED if they have been stuck for more than 10 minutes.",
        headers: adminHeaderSchema,
        security: [{ AdminTokenAuth: [] }],
      },
    },
    async () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

      const result = await prisma.workflowExecution.updateMany({
        where: {
          status: {
            in: ["PENDING", "RUNNING"],
          },
          createdAt: {
            lt: tenMinutesAgo,
          },
        },
        data: {
          status: "FAILED",
          error: "Execution marked as failed because it was stale.",
          finishedAt: new Date(),
        },
      });

      return {
        success: true,
        message: "Stale executions marked as failed",
        updatedCount: result.count,
      };
    }
  );
}
