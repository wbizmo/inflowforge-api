import { Resend } from "resend";
import { resolveObjectTemplates, resolveTemplate } from "./template.js";
import { safeHttpRequest } from "../utils/safe-http.js";

type Action = Record<string, unknown>;

type ExecuteActionsInput = {
  actions: Action[];
  input: Record<string, unknown>;
};

const TELEGRAM_TIMEOUT_MS = 10_000;
let resendClient: Resend | undefined;
let resendClientKey: string | undefined;

function getResendClient(apiKey: string) {
  if (!resendClient || resendClientKey !== apiKey) {
    resendClient = new Resend(apiKey);
    resendClientKey = apiKey;
  }
  return resendClient;
}

async function executeEmailAction(action: Action, input: Record<string, unknown>) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  const to = resolveTemplate(action.to, input);
  const subject = resolveTemplate(action.subject, input);
  const html = resolveTemplate(action.html, input);
  const text = resolveTemplate(action.text, input);

  if (!apiKey) {
    return {
      type: "email",
      provider: "resend",
      status: "SIMULATED",
      reason: "RESEND_API_KEY is not configured",
      to,
      subject,
      html,
      text,
    };
  }

  const result = await getResendClient(apiKey).emails.send({
    from,
    to: String(to),
    subject: String(subject || "inFlowForge Notification"),
    html: String(html || text || "<p>inFlowForge notification</p>"),
  });

  return {
    type: "email",
    provider: "resend",
    status: "SUCCESS",
    to,
    subject,
    result,
  };
}

async function executeTelegramAction(
  action: Action,
  input: Record<string, unknown>
) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const message = resolveTemplate(action.message, input);

  if (!botToken || !chatId) {
    return {
      type: "telegram",
      status: "SIMULATED",
      reason: "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not configured",
      chatId,
      message,
    };
  }

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: String(message || "inFlowForge notification"),
      }),
      signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(`Telegram action failed: ${JSON.stringify(result)}`);
  }

  return {
    type: "telegram",
    status: "SUCCESS",
    chatId,
    message,
    result,
  };
}

async function executeHttpRequestAction(
  action: Action,
  input: Record<string, unknown>
) {
  const method = String(action.method || "POST").toUpperCase();
  const url = resolveTemplate(action.url, input);
  const headers = resolveObjectTemplates(action.headers ?? {}, input) as Record<
    string,
    string
  >;
  const body = resolveObjectTemplates(action.body ?? {}, input);

  if (!url) {
    throw new Error("HTTP request action requires a URL");
  }

  const response = await safeHttpRequest({
    url: String(url),
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body,
  });

  return {
    type: "http_request",
    status: response.ok ? "SUCCESS" : "FAILED",
    method,
    url,
    statusCode: response.status,
    responseBody: response.body,
  };
}

async function executeLogAction(action: Action, input: Record<string, unknown>) {
  const message = resolveTemplate(action.message, input);

  return {
    type: "log",
    status: "SUCCESS",
    message,
  };
}

async function executeDelayAction(action: Action) {
  const seconds = Number(action.seconds || 1);
  const safeSeconds = Math.min(Math.max(seconds, 1), 10);

  await new Promise((resolve) => setTimeout(resolve, safeSeconds * 1000));

  return {
    type: "delay",
    status: "SUCCESS",
    seconds: safeSeconds,
  };
}

export async function executeActions({ actions, input }: ExecuteActionsInput) {
  const results = [];

  for (const action of actions) {
    const type = action.type;

    if (type === "email") {
      results.push(await executeEmailAction(action, input));
      continue;
    }

    if (type === "telegram") {
      results.push(await executeTelegramAction(action, input));
      continue;
    }

    if (type === "http_request") {
      results.push(await executeHttpRequestAction(action, input));
      continue;
    }

    if (type === "log") {
      results.push(await executeLogAction(action, input));
      continue;
    }

    if (type === "delay") {
      results.push(await executeDelayAction(action));
      continue;
    }

    results.push({
      type,
      status: "SKIPPED",
      reason: "Unknown action type",
      action,
    });
  }

  return results;
}
