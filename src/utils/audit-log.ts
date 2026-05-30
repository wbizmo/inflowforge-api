import { prisma } from "../plugins/prisma.js";

type CreateAuditLogInput = {
  workspaceId: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

export async function createAuditLog(input: CreateAuditLogInput) {
  return prisma.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      metadata: input.metadata ?? {},
    },
  });
}