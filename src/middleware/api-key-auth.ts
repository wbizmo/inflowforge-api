import crypto from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../plugins/prisma.js";

const LAST_USED_WRITE_INTERVAL_MS = 5 * 60 * 1000;

export async function apiKeyAuth(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const apiKey = request.headers["x-api-key"];

  if (!apiKey || typeof apiKey !== "string") {
    return reply.status(401).send({
      error: "Unauthorized",
      message: "Missing x-api-key header",
    });
  }

  const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

  const record = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { workspace: true },
  });

  if (!record || record.status !== "ACTIVE") {
    return reply.status(401).send({
      error: "Unauthorized",
      message: "Invalid or revoked API key",
    });
  }

  const staleBefore = new Date(Date.now() - LAST_USED_WRITE_INTERVAL_MS);
  if (!record.lastUsedAt || record.lastUsedAt < staleBefore) {
    await prisma.apiKey.updateMany({
      where: {
        id: record.id,
        OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: staleBefore } }],
      },
      data: { lastUsedAt: new Date() },
    });
  }

  request.workspace = record.workspace;
  request.apiKey = record;
}