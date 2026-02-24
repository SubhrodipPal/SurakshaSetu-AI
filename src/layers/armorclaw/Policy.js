// ─── ArmorClaw Policy Definition ───
// Deterministic allow/deny policy
// NO dynamic policy relaxation allowed

export const POLICY = {
    allow: [
        'get_network_status',
        'isolate_node',
        'update_routing',
        'notify_admin',
        'reset_node',
    ],
    deny: [
        'shutdown_all_nodes',
        'reset_entire_network',
        'erase_logs',
        'format_storage',
        'disable_auth',
        'modify_firmware',
    ],
    maxToolCallsPerPlan: 10,
    requireIntentToken: true,
    requirePlanIntegrity: true,
};
