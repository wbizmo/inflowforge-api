import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_RESPONSE_BYTES = 1024 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;
const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const BLOCKED_REQUEST_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "proxy-authorization",
  "proxy-connection",
  "transfer-encoding",
]);

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  if (normalized.startsWith("ff")) return true;
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length);
    return isIP(mapped) === 4 ? isPrivateIpv4(mapped) : true;
  }
  return false;
}

function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return true;
}

async function assertPublicUrl(value: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("HTTP request action requires a valid absolute URL");
  }

  if (!(["http:", "https:"] as string[]).includes(url.protocol)) {
    throw new Error("HTTP request action only supports HTTP or HTTPS URLs");
  }
  if (url.username || url.password) {
    throw new Error("HTTP request action URLs must not contain embedded credentials");
  }
  if (url.hostname.toLowerCase() === "localhost") {
    throw new Error("HTTP request action cannot target local or private network addresses");
  }

  const directIpVersion = isIP(url.hostname);
  if (directIpVersion && isPrivateAddress(url.hostname)) {
    throw new Error("HTTP request action cannot target local or private network addresses");
  }

  const resolved = await lookup(url.hostname, { all: true, verbatim: true });
  if (resolved.length === 0 || resolved.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("HTTP request action cannot target local or private network addresses");
  }

  return url;
}

async function readLimitedBody(response: Response): Promise<unknown> {
  if (!response.body) return null;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("HTTP request action response exceeded the 1 MiB safety limit");
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const text = new TextDecoder().decode(merged);
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json") && text) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

export async function safeHttpRequest(input: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}) {
  const method = input.method.toUpperCase();
  if (!ALLOWED_METHODS.has(method)) {
    throw new Error(`HTTP request action method ${method} is not allowed`);
  }

  const url = await assertPublicUrl(input.url);
  const headers = Object.fromEntries(
    Object.entries(input.headers).filter(([name]) => !BLOCKED_REQUEST_HEADERS.has(name.toLowerCase()))
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: method === "GET" ? undefined : JSON.stringify(input.body ?? {}),
      redirect: "manual",
      signal: controller.signal,
    });

    if (response.status >= 300 && response.status < 400) {
      throw new Error("HTTP request action redirects are blocked to prevent SSRF bypasses");
    }

    return {
      ok: response.ok,
      status: response.status,
      body: await readLimitedBody(response),
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("HTTP request action timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
