import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";

import { evaluateConditions } from "../src/engine/condition-engine.js";
import { resolveTemplate, resolveObjectTemplates } from "../src/engine/template.js";
import { executeActions } from "../src/engine/action-engine.js";

test("template engine should resolve input variables", () => {
  const result = resolveTemplate("Hello {{input.name}}", {
    name: "Williams",
  });

  assert.equal(result, "Hello Williams");
});

test("template engine should resolve nested object templates", () => {
  const result = resolveObjectTemplates(
    {
      message: "User {{input.user.email}}",
    },
    {
      user: {
        email: "demo@example.com",
      },
    }
  );

  assert.deepEqual(result, {
    message: "User demo@example.com",
  });
});

test("condition engine should pass equals condition", () => {
  const result = evaluateConditions(
    {
      field: "plan",
      operator: "equals",
      value: "premium",
    },
    {
      plan: "premium",
    }
  );

  assert.equal(result.passed, true);
  assert.equal(result.skipped, false);
});

test("condition engine should fail equals condition", () => {
  const result = evaluateConditions(
    {
      field: "plan",
      operator: "equals",
      value: "premium",
    },
    {
      plan: "free",
    }
  );

  assert.equal(result.passed, false);
  assert.equal(result.skipped, true);
});

test("action engine should execute log action", async () => {
  const results = await executeActions({
    input: {
      email: "demo@example.com",
    },
    actions: [
      {
        type: "log",
        message: "Processed {{input.email}}",
      },
    ],
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].type, "log");
  assert.equal(results[0].status, "SUCCESS");
  assert.equal(results[0].message, "Processed demo@example.com");
});

test("action engine should simulate email if Resend key is missing", async () => {
  const originalKey = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;

  const results = await executeActions({
    input: {
      email: "demo@example.com",
      name: "Demo User",
    },
    actions: [
      {
        type: "email",
        to: "{{input.email}}",
        subject: "Welcome {{input.name}}",
        html: "<p>Hello {{input.name}}</p>",
      },
    ],
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].type, "email");
  assert.equal(results[0].provider, "resend");
  assert.equal(results[0].status, "SIMULATED");

  if (originalKey) {
    process.env.RESEND_API_KEY = originalKey;
  }
});
