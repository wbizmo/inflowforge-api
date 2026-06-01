export function resolveTemplate(value, input) {
    if (typeof value !== "string") {
        return value;
    }
    return value.replace(/\{\{input\.([a-zA-Z0-9_.-]+)\}\}/g, (_, path) => {
        const keys = String(path).split(".");
        let current = input;
        for (const key of keys) {
            if (current &&
                typeof current === "object" &&
                key in current) {
                current = current[key];
            }
            else {
                return "";
            }
        }
        return String(current ?? "");
    });
}
export function resolveObjectTemplates(value, input) {
    if (Array.isArray(value)) {
        return value.map((item) => resolveObjectTemplates(item, input));
    }
    if (value && typeof value === "object") {
        const output = {};
        for (const [key, item] of Object.entries(value)) {
            output[key] = resolveObjectTemplates(item, input);
        }
        return output;
    }
    return resolveTemplate(value, input);
}
