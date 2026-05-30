import "dotenv/config";
import { after } from "node:test";
import { closeTestResources } from "./utils/cleanup.js";

after(async () => {
  await closeTestResources();
});
