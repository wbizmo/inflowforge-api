import type { FastifyReply, FastifyRequest } from "fastify";

export async function adminAuth(request: FastifyRequest, reply: FastifyReply) {
  const adminToken = request.headers["x-admin-token"];

  if (!adminToken || typeof adminToken !== "string") {
    return reply.status(401).send({
      error: "Unauthorized",
      message: "Missing x-admin-token header",
    });
  }

  if (adminToken !== process.env.ADMIN_TOKEN) {
    return reply.status(401).send({
      error: "Unauthorized",
      message: "Invalid admin token",
    });
  }
}