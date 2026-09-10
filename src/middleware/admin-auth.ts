import crypto from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

export async function adminAuth(request: FastifyRequest, reply: FastifyReply) {
  const expectedToken = process.env.ADMIN_TOKEN;
  if (!expectedToken) {
    return reply.status(503).send({
      error: "Service Unavailable",
      message: "Admin authentication is not configured",
    });
  }

  const adminToken = request.headers["x-admin-token"];
  if (!adminToken || typeof adminToken !== "string") {
    return reply.status(401).send({
      error: "Unauthorized",
      message: "Missing x-admin-token header",
    });
  }

  const provided = Buffer.from(adminToken);
  const expected = Buffer.from(expectedToken);
  const valid =
    provided.length === expected.length && crypto.timingSafeEqual(provided, expected);

  if (!valid) {
    return reply.status(401).send({
      error: "Unauthorized",
      message: "Invalid admin token",
    });
  }
}
