import http, { type IncomingMessage, type RequestOptions } from "node:http";
import https from "node:https";
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

type ResolvedTarget = {
  url: URL;
  address: string;
  family: 4 | 6;
};

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

async function resolvePublicTarget(value: string): Promise<ResolvedTarget> {
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

  const directFamily = isIP(url.hostname);
  const resolved = directFamily
    ? [{ address: url.hostname, family: directFamily }]
    : await lookup(url.hostname, { all: true, verbatim: true });

  if (resolved.length === 0 || resolved.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("HTTP request action cannot target local or private network addresses");
  }

  const pinned = resolved[0];
  if (pinned.family !== 4 && pinned.family !== 6) {
    throw new Error("HTTP request action could not resolve a safe network destination");
  }

  return {
    url,
    address: pinned.address,
    family: pinned.family,
  };
}

function readLimitedBody(response: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;

    response.on("data", (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;

      if (size > MAX_RESPONSE_BYTES) {
        response.destroy();
        reject(new Error("HTTP request action response exceeded the 1 MiB safety limit"));
        return;
      }

      chunks.push(buffer);
    });

    response.on("error", reject);
    response.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      const contentType = String(response.headers["content-type"] ?? "");

      if (contentType.includes("application/json") && text) {
        try {
          resolve(JSON.parse(text));
          return;
        } catch {
          // Fall through to returning the original text.
        }
      }

      resolve(text);
    });
  });
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

  const target = await resolvePublicTarget(input.url);
  const headers = Object.fromEntries(
    Object.entries(input.headers).filter(([name]) => !BLOCKED_REQUEST_HEADERS.has(name.toLowerCase()))
  );

  const requestBody = method === "GET" ? undefined : JSON.stringify(input.body ?? {});
  if (requestBody !== undefined) {
    if (!Object.keys(headers).some((name) => name.toLowerCase() === "content-type")) {
      headers["content-type"] = "application/json";
    }
    headers["content-length"] = String(Buffer.byteLength(requestBody));
  }

  const options: RequestOptions = {
    protocol: target.url.protocol,
    hostname: target.url.hostname,
    port: target.url.port || undefined,
    path: `${target.url.pathname}${target.url.search}`,
    method,
    headers,
    lookup: (_hostname, _options, callback) => {
      callback(null, target.address, target.family);
    },
  };

  const transport = target.url.protocol === "https:" ? https : http;

  return await new Promise<{
    ok: boolean;
    status: number;
    body: unknown;
  }>((resolve, reject) => {
    const request = transport.request(options, async (response) => {
      const status = response.statusCode ?? 0;

      if (status >= 300 && status < 400) {
        response.resume();
        reject(new Error("HTTP request action redirects are blocked to prevent SSRF bypasses"));
        return;
      }

      try {
        resolve({
          ok: status >= 200 && status < 300,
          status,
          body: await readLimitedBody(response),
        });
      } catch (error) {
        reject(error);
      }
    });

    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy(new Error("HTTP request action timed out"));
    });
    request.on("error", reject);

    if (requestBody !== undefined) {
      request.write(requestBody);
    }
    request.end();
  });
}
