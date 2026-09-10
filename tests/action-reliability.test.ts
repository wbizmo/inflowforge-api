import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { executeActions } from "../src/engine/action-engine.js";

test("Telegram action remains simulated when credentials are absent", async () => {
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalChat = process.env.TELEGRAM_CHAT_ID;
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;

  const [result] = await executeActions({
    input: { name: "Demo" },
    actions: [{ type: "telegram", message: "Hello {{input.name}}" }],
  });

  assert.equal(result.type, "telegram");
  assert.equal(result.status, "SIMULATED");
  assert.equal(result.message, "Hello Demo");

  if (originalToken) process.env.TELEGRAM_BOT_TOKEN = originalToken;
  if (originalChat) process.env.TELEGRAM_CHAT_ID = originalChat;
});
