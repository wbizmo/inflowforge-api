import type { Prisma } from "@prisma/client";
import { prisma } from "../plugins/prisma.js";

type CreateAuditLogInput = {
  workspaceId: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

export async function createAuditLog({
  workspaceId,
  action,
  entity,
  entityId,
  metadata = {},
}: CreateAuditLogInput) {
  return prisma.auditLog.create({
    data: {
      workspaceId,
      action,
      entity,
      entityId,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });
}