import { Worker } from "bullmq";
import { prisma } from "../plugins/prisma.js";
import { redisConnectionOptions } from "../plugins/redis.js";
import { evaluateConditions } from "../engine/condition-engine.js";
import { executeActions } from "../engine/action-engine.js";
export const workflowWorker = new Worker("workflow-executions", async (job) => {
    console.log("Processing workflow job:", {
        id: job.id,
        name: job.name,
        data: job.data,
    });
    if (job.name === "test-job") {
        return {
            success: true,
            processedAt: new Date().toISOString(),
        };
    }
    if (job.name !== "execute-workflow") {
        throw new Error(`Unknown job type: ${job.name}`);
    }
    const { executionId, workflowId, workspaceId, input } = job.data;
    await prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
            status: "RUNNING",
            startedAt: new Date(),
        },
    });
    const workflow = await prisma.workflow.findFirst({
        where: {
            id: workflowId,
            workspaceId,
        },
    });
    if (!workflow) {
        throw new Error("Workflow not found during execution");
    }
    const workflowInput = (input ?? {});
    const actions = workflow.actions;
    const conditionResult = evaluateConditions(workflow.conditions, workflowInput);
    if (!conditionResult.passed) {
        const output = {
            workflowId: workflow.id,
            workflowName: workflow.name,
            input: workflowInput,
            conditions: conditionResult,
            skipped: true,
            actionsExecuted: 0,
            results: [],
        };
        await prisma.workflowExecution.update({
            where: { id: executionId },
            data: {
                status: "SUCCESS",
                output,
                finishedAt: new Date(),
            },
        });
        return output;
    }
    const actionResults = await executeActions({
        actions,
        input: workflowInput,
    });
    const output = {
        workflowId: workflow.id,
        workflowName: workflow.name,
        input: workflowInput,
        conditions: conditionResult,
        skipped: false,
        actionsExecuted: actionResults.length,
        results: actionResults,
    };
    await prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
            status: "SUCCESS",
            output,
            finishedAt: new Date(),
        },
    });
    return output;
}, {
    connection: redisConnectionOptions,
});
workflowWorker.on("completed", (job) => {
    console.log(`Workflow job ${job.id} completed`);
});
workflowWorker.on("failed", async (job, error) => {
    console.error(`Workflow job ${job?.id} failed`, error);
    const executionId = job?.data?.executionId;
    if (executionId) {
        await prisma.workflowExecution.update({
            where: { id: executionId },
            data: {
                status: "FAILED",
                error: error.message,
                finishedAt: new Date(),
            },
        });
    }
});
