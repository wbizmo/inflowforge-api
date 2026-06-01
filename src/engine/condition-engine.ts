type Condition = {
  field: string;
  operator: string;
  value?: unknown;
};

function getValueFromInput(input: Record<string, unknown>, field: string) {
  const cleanField = field.startsWith("input.")
    ? field.replace("input.", "")
    : field;

  const keys = cleanField.split(".");
  let current: unknown = input;

  for (const key of keys) {
    if (
      current &&
      typeof current === "object" &&
      key in current
    ) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }

  return current;
}

function evaluateSingleCondition(
  condition: Condition,
  input: Record<string, unknown>
) {
  const actual = getValueFromInput(input, condition.field);
  const expected = condition.value;

  switch (condition.operator) {
    case "equals":
      return actual === expected;

    case "not_equals":
      return actual !== expected;

    case "contains":
      return String(actual ?? "").includes(String(expected ?? ""));

    case "exists":
      return actual !== undefined && actual !== null && actual !== "";

    case "greater_than":
      return Number(actual) > Number(expected);

    case "less_than":
      return Number(actual) < Number(expected);

    default:
      return false;
  }
}

export function evaluateConditions(
  conditions: unknown,
  input: Record<string, unknown>
) {
  if (!conditions) {
    return {
      passed: true,
      skipped: false,
      reason: "No conditions configured",
    };
  }

  if (Array.isArray(conditions)) {
    const results = conditions.map((condition) =>
      evaluateSingleCondition(condition as Condition, input)
    );

    const passed = results.every(Boolean);

    return {
      passed,
      skipped: !passed,
      reason: passed
        ? "All conditions passed"
        : "One or more conditions failed",
      results,
    };
  }

  if (typeof conditions === "object") {
    const passed = evaluateSingleCondition(conditions as Condition, input);

    return {
      passed,
      skipped: !passed,
      reason: passed ? "Condition passed" : "Condition failed",
      results: [passed],
    };
  }

  return {
    passed: false,
    skipped: true,
    reason: "Invalid condition format",
    results: [],
  };
}