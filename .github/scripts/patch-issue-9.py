from pathlib import Path

path = Path("src/modules/workflows/workflow.routes.ts")
text = path.read_text()
old = '''const createWorkflowSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  trigger: z.record(z.string(), z.any()),
  conditions: z.record(z.string(), z.any()).optional(),
  actions: z.array(z.record(z.string(), z.any())).min(1),
});'''
new = '''const conditionValidationSchema = z
  .object({
    field: z.string().min(1),
    operator: z.enum([
      "equals",
      "not_equals",
      "contains",
      "exists",
      "greater_than",
      "less_than",
    ]),
    value: z.any().optional(),
  })
  .strict();

const conditionsValidationSchema = z.union([
  conditionValidationSchema,
  z.array(conditionValidationSchema).min(1),
]);

const createWorkflowSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  trigger: z.record(z.string(), z.any()),
  conditions: conditionsValidationSchema.optional(),
  actions: z.array(z.record(z.string(), z.any())).min(1),
});'''
if old not in text:
    raise SystemExit("expected createWorkflowSchema block not found")
text = text.replace(old, new, 1)
text = text.replace('''{
          type: "array",
          items: conditionSchema,
        },''', '''{
          type: "array",
          minItems: 1,
          items: conditionSchema,
        },''')
path.write_text(text)
