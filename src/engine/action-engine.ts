import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Resend } from "resend";
import { resolveObjectTemplates, resolveTemplate } from "./template.js";

type Action = Record<string, unknown>;
type ExecuteActionsInput = { actions: Action[]; input: Record<string, unknown> };

const MAX_HTTP_RESPONSE_BYTES = 1024 * 1024;
const HTTP_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb") || normalized.startsWith("::ffff:127.") || normalized.startsWith("::ffff:10.") || normalized.startsWith("::ffff:192.168.");
}

async function assertSafeHttpUrl(value: string): Promise<URL> {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("HTTP request action requires a valid absolute URL"); }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only HTTP(S) workflow destinations are allowed");
  if (url.username || url.password) throw new Error("Credentials embedded in workflow URLs are not allowed");
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host === "metadata.google.internal") throw new Error("Private workflow destinations are not allowed");

  const literalVersion = isIP(host);
  const addresses = literalVersion ? [{ address: host, family: literalVersion }] : await lookup(host, { all: true, verbatim: true });
  if (addresses.length === 0) throw new Error("Workflow destination could not be resolved");
  for (const entry of addresses) {
    if ((entry.family === 4 && isPrivateIpv4(entry.address)) || (entry.family === 6 && isPrivateIpv6(entry.address))) {
      throw new Error("Private, loopback, link-local, and metadata workflow destinations are blocked");
    }
  }
  return url;
}

async function readLimitedBody(response: Response): Promise<unknown> {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > MAX_HTTP_RESPONSE_BYTES) throw new Error("HTTP action response exceeded the 1 MiB limit");
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > MAX_HTTP_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("HTTP action response exceeded the 1 MiB limit");
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const text = new TextDecoder().decode(bytes);
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

async function secureFetch(initialUrl: string, init: RequestInit): Promise<{ response: Response; finalUrl: string }> {
  let current = initialUrl;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const safeUrl = await assertSafeHttpUrl(current);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(safeUrl, { ...init, redirect: "manual", signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (![301, 302, 303, 307, 308].includes(response.status)) return { response, finalUrl: safeUrl.toString() };
    if (redirects === MAX_REDIRECTS) throw new Error("HTTP action exceeded redirect limit");
    const location = response.headers.get("location");
    if (!location) throw new Error("HTTP action redirect was missing a Location header");
    current = new URL(location, safeUrl).toString();
  }
  throw new Error("HTTP action redirect limit exceeded");
}

async function executeEmailAction(action: Action, input: Record<string, unknown>) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const to = resolveTemplate(action.to, input);
  const subject = resolveTemplate(action.subject, input);
  const html = resolveTemplate(action.html, input);
  const text = resolveTemplate(action.text, input);
  if (!apiKey) return { type: "email", provider: "resend", status: "SIMULATED", reason: "RESEND_API_KEY is not configured", to, subject, html, text };
  const resend = new Resend(apiKey);
  const result = await resend.emails.send({ from, to: String(to), subject: String(subject || "inFlowForge Notification"), html: String(html || text || "<p>inFlowForge notification</p>") });
  return { type: "email", provider: "resend", status: "SUCCESS", to, subject, result };
}

async function executeTelegramAction(action: Action, input: Record<string, unknown>) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const message = resolveTemplate(action.message, input);
  if (!botToken || !chatId) return { type: "telegram", status: "SIMULATED", reason: "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not configured", chatId, message };
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: String(message || "inFlowForge notification") }) });
  const result = await response.json();
  if (!response.ok) throw new Error(`Telegram action failed: ${JSON.stringify(result)}`);
  return { type: "telegram", status: "SUCCESS", chatId, message, result };
}

async function executeHttpRequestAction(action: Action, input: Record<string, unknown>) {
  const method = String(action.method || "POST").toUpperCase();
  if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) throw new Error("Unsupported HTTP action method");
  const url = resolveTemplate(action.url, input);
  const headers = resolveObjectTemplates(action.headers ?? {}, input) as Record<string, string>;
  const body = resolveObjectTemplates(action.body ?? {}, input);
  if (!url) throw new Error("HTTP request action requires a URL");
  for (const name of Object.keys(headers)) {
    if (["host", "connection", "content-length", "transfer-encoding"].includes(name.toLowerCase())) delete headers[name];
  }
  const { response, finalUrl } = await secureFetch(String(url), {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
  const responseBody = await readLimitedBody(response);
  return { type: "http_request", status: response.ok ? "SUCCESS" : "FAILED", method, url: finalUrl, statusCode: response.status, responseBody };
}

async function executeLogAction(action: Action, input: Record<string, unknown>) { return { type: "log", status: "SUCCESS", message: resolveTemplate(action.message, input) }; }
async function executeDelayAction(action: Action) { const seconds = Math.min(Math.max(Number(action.seconds || 1), 1), 10); await new Promise((resolve) => setTimeout(resolve, seconds * 1000)); return { type: "delay", status: "SUCCESS", seconds }; }

export async function executeActions({ actions, input }: ExecuteActionsInput) {
  const results = [];
  for (const action of actions) {
    const type = action.type;
    if (type === "email") results.push(await executeEmailAction(action, input));
    else if (type === "telegram") results.push(await executeTelegramAction(action, input));
    else if (type === "http_request") results.push(await executeHttpRequestAction(action, input));
    else if (type === "log") results.push(await executeLogAction(action, input));
    else if (type === "delay") results.push(await executeDelayAction(action));
    else results.push({ type, status: "SKIPPED", reason: "Unknown action type" });
  }
  return results;
}
