import crypto from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../plugins/prisma.js";

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

  await prisma.apiKey.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  });

  request.workspace = record.workspace;
  request.apiKey = record;
}