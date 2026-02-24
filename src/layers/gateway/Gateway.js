// ─── Gateway Layer ───
// Collects telemetry, maintains routing map, exposes tool interfaces
// Gateway NEVER executes autonomously — only responds to validated tool calls

export class Gateway {
    constructor(meshNetwork) {
        this.mesh = meshNetwork;
        this.adminNotifications = [];
        this.executionLog = [];
    }

    // ═══ TOOL INTERFACES ═══
    // These are the only functions that can be invoked by the execution layer

    get_network_status() {
        const status = this.mesh.getNetworkStatus();
        this._log('get_network_status', {}, status);
        return status;
    }

    isolate_node(params) {
        const { nodeId } = params;
        const result = this.mesh.isolateNode(nodeId);
        this._log('isolate_node', params, result);
        return result;
    }

    update_routing(params) {
        const { nodeId, newPath } = params;
        const result = this.mesh.updateRouting(nodeId, newPath);
        this._log('update_routing', params, result);
        return result;
    }

    notify_admin(params) {
        const { message } = params;
        const notification = {
            timestamp: Date.now(),
            message,
            level: params.level || 'warning',
        };
        this.adminNotifications.push(notification);
        this._log('notify_admin', params, notification);
        return { success: true, notification };
    }

    reset_node(params) {
        const { nodeId } = params;
        const result = this.mesh.resetNode(nodeId);
        this._log('reset_node', params, result);
        return result;
    }

    // ═══ DENIED TOOLS (these exist but should NEVER pass ArmorClaw) ═══

    shutdown_all_nodes() {
        // This should NEVER be executed — ArmorClaw must block it
        return { success: false, error: 'CRITICAL: This tool should have been blocked by ArmorClaw!' };
    }

    reset_entire_network() {
        return { success: false, error: 'CRITICAL: This tool should have been blocked by ArmorClaw!' };
    }

    erase_logs() {
        return { success: false, error: 'CRITICAL: This tool should have been blocked by ArmorClaw!' };
    }

    // Get all available tool names
    getAvailableTools() {
        return [
            'get_network_status',
            'isolate_node',
            'update_routing',
            'notify_admin',
            'reset_node',
            'shutdown_all_nodes',
            'reset_entire_network',
            'erase_logs',
        ];
    }

    // Execute a tool by name
    executeTool(toolName, params = {}) {
        if (typeof this[toolName] === 'function') {
            return this[toolName](params);
        }
        return { success: false, error: `Unknown tool: ${toolName}` };
    }

    _log(toolName, params, result) {
        this.executionLog.push({
            timestamp: Date.now(),
            tool: toolName,
            params,
            result,
        });
    }

    getExecutionLog() {
        return [...this.executionLog];
    }
}
