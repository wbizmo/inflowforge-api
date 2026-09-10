import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";

const apiKey = "iff_dev_test_key_123456789";

for (const url of ["/workflows", "/executions", "/audit-logs"]) {
  test(`${url} respects the requested page limit`, async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "GET",
      url: `${url}?limit=1`,
      headers: { "x-api-key": apiKey },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(Array.isArray(response.json()), true);
    assert.equal(response.json().length <= 1, true);
    assert.equal(response.headers["x-page-limit"], "1");
    await app.close();
  });
}

test("workspace list pagination rejects an oversized page", async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: "GET",
    url: "/workflows?limit=101",
    headers: { "x-api-key": apiKey },
  });

  assert.equal(response.statusCode, 400);
  await app.close();
});
