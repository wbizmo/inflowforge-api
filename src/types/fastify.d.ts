import type { ApiKey, Workspace } from "@prisma/client";

declare module "fastify" {
  interface FastifyRequest {
    workspace?: Workspace;
    apiKey?: ApiKey;
  }
}