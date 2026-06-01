export function resolveTemplate(value: unknown, input: Record<string, unknown>) {
  if (typeof value !== "string") {
    return value;
  }

  return value.replace(/\{\{input\.([a-zA-Z0-9_.-]+)\}\}/g, (_, path) => {
    const keys = String(path).split(".");
    let current: unknown = input;

    for (const key of keys) {
      if (
        current &&
        typeof current === "object" &&
        key in current
      ) {
        current = (current as Record<string, unknown>)[key];
      } else {
        return "";
      }
    }

    return String(current ?? "");
  });
}

export function resolveObjectTemplates(
  value: unknown,
  input: Record<string, unknown>
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => resolveObjectTemplates(item, input));
  }

  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value)) {
      output[key] = resolveObjectTemplates(item, input);
    }

    return output;
  }

  return resolveTemplate(value, input);
}