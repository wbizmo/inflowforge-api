import { prisma } from "../plugins/prisma.js";
export async function createAuditLog({ workspaceId, action, entity, entityId, metadata = {}, }) {
    return prisma.auditLog.create({
        data: {
            workspaceId,
            action,
            entity,
            entityId,
            metadata: metadata,
        },
    });
}
