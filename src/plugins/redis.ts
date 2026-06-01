import Redis from "ioredis";

const isProduction = process.env.NODE_ENV === "production";

export const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  tls: isProduction ? {} : undefined,
});