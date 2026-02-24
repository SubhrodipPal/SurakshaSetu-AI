// ─── Execution Layer ───
// Only executes tool calls approved by ArmorClaw
// No decision-making logic here — pure execution

export class Executor {
    constructor(gateway) {
        this.gateway = gateway;
        this.executionLog = [];
    }

    // Execute all approved tool calls from an ArmorClaw decision
    execute(armorClawDecision) {
        const results = {
            decisionId: armorClawDecision.id,
            timestamp: Date.now(),
            approved: armorClawDecision.approved,
            executions: [],
        };

        if (!armorClawDecision.approved) {
            results.executions.push({
                status: 'BLOCKED',
                reason: 'ArmorClaw denied execution',
                violations: armorClawDecision.violations,
            });
            this.executionLog.push(results);
            return results;
        }

        // Execute each approved tool call
        for (const toolCall of armorClawDecision.toolCalls) {
            try {
                const result = this.gateway.executeTool(toolCall.tool, toolCall.params);
                results.executions.push({
                    tool: toolCall.tool,
                    params: toolCall.params,
                    status: 'EXECUTED',
                    result,
                });
            } catch (error) {
                results.executions.push({
                    tool: toolCall.tool,
                    params: toolCall.params,
                    status: 'ERROR',
                    error: error.message,
                });
            }
        }

        this.executionLog.push(results);
        return results;
    }

    getExecutionLog() {
        return [...this.executionLog];
    }
}
