import "dotenv/config";
import { buildApp } from "./app.js";
import "./queues/workflow.worker.js";

const app = buildApp();

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 4000;

    await app.listen({
      port,
      host: "0.0.0.0",
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();