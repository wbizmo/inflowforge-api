-- Add indexes for the workspace-scoped list and execution analytics paths.
CREATE INDEX IF NOT EXISTS "Workflow_workspaceId_createdAt_id_idx"
  ON "Workflow"("workspaceId", "createdAt", "id");

CREATE INDEX IF NOT EXISTS "WorkflowExecution_workspaceId_createdAt_id_idx"
  ON "WorkflowExecution"("workspaceId", "createdAt", "id");

CREATE INDEX IF NOT EXISTS "WorkflowExecution_workflowId_status_createdAt_idx"
  ON "WorkflowExecution"("workflowId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "WorkflowExecution_status_createdAt_idx"
  ON "WorkflowExecution"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "AuditLog_workspaceId_createdAt_id_idx"
  ON "AuditLog"("workspaceId", "createdAt", "id");
