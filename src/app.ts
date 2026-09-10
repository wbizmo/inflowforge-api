import Fastify from "fastify";

import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";

import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";

import { prisma } from "./plugins/prisma.js";
import { redis } from "./plugins/redis.js";
import { workflowQueue } from "./queues/workflow.queue.js";

import { apiKeyAuth } from "./middleware/api-key-auth.js";

import { workflowRoutes } from "./modules/workflows/workflow.routes.js";
import { executionRoutes } from "./modules/executions/execution.routes.js";
import { auditLogRoutes } from "./modules/audit-logs/audit-log.routes.js";
import { adminRoutes } from "./modules/admin/admin.routes.js";
import { webhookRoutes } from "./modules/webhooks/webhook.routes.js";

const apiKeyHeaderSchema = {
  type: "object",
  properties: {
    "x-api-key": {
      type: "string",
      description: "Workspace API key",
    },
  },
};

function configuredCorsOrigins(): Set<string> {
  return new Set(
    (process.env.CORS_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  );
}

function isDevelopmentLocalOrigin(origin: string): boolean {
  if (process.env.NODE_ENV === "production") return false;
  try {
    const url = new URL(origin);
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });
  const allowedOrigins = configuredCorsOrigins();

  await app.register(cors, {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      callback(null, allowedOrigins.has(origin) || isDevelopmentLocalOrigin(origin));
    },
  });

  await app.register(helmet);

  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "inFlowForge API",
        description:
          "Backend-first workflow automation API with API keys, workflows, queues, executions, audit logs, analytics, and webhook triggers.",
        version: "1.0.1",
      },
      tags: [
        { name: "System", description: "System and health endpoints" },
        { name: "Auth", description: "API key authenticated endpoints" },
        { name: "Workflows", description: "Workflow management endpoints" },
        { name: "Executions", description: "Workflow execution endpoints" },
        { name: "Audit Logs", description: "Workspace audit log endpoints" },
        { name: "Webhooks", description: "External workflow trigger endpoints" },
        { name: "Admin", description: "Admin management endpoints" },
        { name: "Admin Analytics", description: "Admin analytics endpoints" },
        {
          name: "Admin Executions",
          description: "Admin execution monitoring endpoints",
        },
      ],
      components: {
        securitySchemes: {
          ApiKeyAuth: {
            type: "apiKey",
            in: "header",
            name: "x-api-key",
          },
          AdminTokenAuth: {
            type: "apiKey",
            in: "header",
            name: "x-admin-token",
          },
        },
      },
    },
  });

  await app.register(swaggerUI, {
    routePrefix: "/docs",
  });

  app.get(
    "/",
    {
      schema: {
        tags: ["System"],
        summary: "API welcome route",
        description: "Returns a basic message confirming that the API is running.",
      },
    },
    async () => {
      return {
        message: "inFlowForge API is running",
      };
    }
  );

  app.get(
    "/health",
    {
      schema: {
        tags: ["System"],
        summary: "Health check",
        description: "Checks API, PostgreSQL, Redis, and queue readiness.",
      },
    },
    async () => {
      await prisma.$queryRaw`SELECT 1`;
      await redis.ping();

      return {
        status: "ok",
        service: "inFlowForge API",
        database: "connected",
        redis: "connected",
        queue: "ready",
      };
    }
  );

  if (process.env.NODE_ENV !== "production") {
    app.post(
      "/queue/test",
      {
        preHandler: apiKeyAuth,
        schema: {
          tags: ["System"],
          summary: "Queue test",
          description: "Adds an authenticated test job to the queue in non-production environments only.",
          headers: apiKeyHeaderSchema,
          security: [{ ApiKeyAuth: [] }],
        },
      },
      async () => {
        const job = await workflowQueue.add("test-job", {
          message: "Hello from BullMQ",
          createdAt: new Date(),
        });

        return {
          success: true,
          jobId: job.id,
        };
      }
    );
  }

  app.get(
    "/protected/me",
    {
      preHandler: apiKeyAuth,
      schema: {
        tags: ["Auth"],
        summary: "Get authenticated workspace",
        description:
          "Returns the workspace and API key metadata for the provided x-api-key.",
        headers: apiKeyHeaderSchema,
        security: [{ ApiKeyAuth: [] }],
      },
    },
    async (request) => {
      return {
        workspace: request.workspace,
        apiKey: {
          id: request.apiKey?.id,
          name: request.apiKey?.name,
          keyPrefix: request.apiKey?.keyPrefix,
          status: request.apiKey?.status,
        },
      };
    }
  );

  app.register(workflowRoutes, {
    prefix: "/workflows",
  });

  app.register(executionRoutes, {
    prefix: "/executions",
  });

  app.register(auditLogRoutes, {
    prefix: "/audit-logs",
  });

  app.register(adminRoutes, {
    prefix: "/admin",
  });

  app.register(webhookRoutes, {
    prefix: "/webhooks",
  });

  return app;
}
