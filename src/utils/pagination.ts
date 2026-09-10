import type { FastifyReply } from "fastify";
import { z } from "zod";

export const MAX_PAGE_SIZE = 100;

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(50),
  cursor: z.string().min(1).optional(),
});

export const paginationQueryJsonSchema = {
  type: "object",
  properties: {
    limit: {
      type: "integer",
      minimum: 1,
      maximum: MAX_PAGE_SIZE,
      default: 50,
      description: "Maximum records to return in this page (1-100).",
    },
    cursor: {
      type: "string",
      description: "Record ID returned in x-next-cursor from the previous page.",
    },
  },
};

export function sendPage<T extends { id: string }>(
  rows: T[],
  limit: number,
  reply: FastifyReply
) {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  reply.header("x-page-limit", String(limit));
  if (hasMore) reply.header("x-next-cursor", page[page.length - 1]!.id);

  return page;
}
