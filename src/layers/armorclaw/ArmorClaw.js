// ─── ArmorClaw Intent Enforcement Layer ───
// Validates intent tokens, checks policy compliance, verifies plan integrity
// FAIL-CLOSED: any validation error = DENY
// All enforcement decisions are logged

import { POLICY } from './Policy.js';

export class ArmorClaw {
    constructor() {
        this.policy = POLICY;
        this.enforcementLog = [];
        this._secret = 'suraksha-setu-hmac-key-2026'; // Must match OpenClaw's secret
    }

    // ═══ MAIN VALIDATION PIPELINE ═══
    validate(reasoningResult) {
        const decision = {
            id: this._generateId(),
            timestamp: Date.now(),
            planId: reasoningResult?.plan?.id || 'unknown',
            checks: [],
            approved: false,
            toolCalls: [],
            violations: [],
        };

        // Guard: no plan to validate
        if (!reasoningResult || !reasoningResult.plan) {
            decision.checks.push({
                check: 'Plan Existence',
                passed: false,
                detail: 'No execution plan provided',
            });
            decision.approved = false;
            this._log(decision);
            return decision;
        }

        const { plan, intentToken } = reasoningResult;
        let allPassed = true;

        // ─── CHECK 1: Intent Token Presence ───
        const tokenPresent = intentToken && intentToken.token && intentToken.token.length > 0;
        decision.checks.push({
            check: 'Intent Token Presence',
            passed: tokenPresent,
            detail: tokenPresent ? `Token: ${intentToken.token}` : 'No intent token provided',
        });
        if (!tokenPresent) allPassed = false;

        // ─── CHECK 2: Token Issuer Validation ───
        if (tokenPresent) {
            const validIssuer = intentToken.issuer === 'OpenClaw-ReasoningAgent';
            decision.checks.push({
                check: 'Token Issuer Validation',
                passed: validIssuer,
                detail: validIssuer ? `Issuer verified: ${intentToken.issuer}` : `Invalid issuer: ${intentToken.issuer}`,
            });
            if (!validIssuer) allPassed = false;
        }

        // ─── CHECK 3: Plan Integrity (re-compute hash and compare) ───
        const computedHash = this._computePlanHash(plan);
        const integrityValid = computedHash === plan.hash;
        decision.checks.push({
            check: 'Plan Integrity (Hash)',
            passed: integrityValid,
            detail: integrityValid
                ? `Hash verified: ${computedHash}`
                : `Hash mismatch! Expected: ${plan.hash}, Computed: ${computedHash} — PLAN TAMPERED`,
        });
        if (!integrityValid) {
            allPassed = false;
            decision.violations.push({
                type: 'PLAN_TAMPERED',
                detail: 'Plan was modified after token generation — integrity check failed',
            });
        }

        // ─── CHECK 4: Policy Compliance (per tool call) ───
        const approvedToolCalls = [];

        for (const toolCall of plan.toolCalls) {
            const toolName = toolCall.tool;

            // Check deny list first (deny always wins)
            if (this.policy.deny.includes(toolName)) {
                allPassed = false;
                decision.checks.push({
                    check: `Policy: ${toolName}`,
                    passed: false,
                    detail: `DENIED — Tool "${toolName}" is in the deny list`,
                });
                decision.violations.push({
                    type: 'DENIED_TOOL',
                    tool: toolName,
                    detail: `Tool "${toolName}" is explicitly denied by policy`,
                });
                continue;
            }

            // Check allow list
            if (!this.policy.allow.includes(toolName)) {
                allPassed = false;
                decision.checks.push({
                    check: `Policy: ${toolName}`,
                    passed: false,
                    detail: `BLOCKED — Tool "${toolName}" is not in the allow list`,
                });
                decision.violations.push({
                    type: 'UNKNOWN_TOOL',
                    tool: toolName,
                    detail: `Tool "${toolName}" is not in the allow list — fail-closed`,
                });
                continue;
            }

            // Tool is allowed
            decision.checks.push({
                check: `Policy: ${toolName}`,
                passed: true,
                detail: `ALLOWED — Tool "${toolName}" passes policy check`,
            });
            approvedToolCalls.push(toolCall);
        }

        // ─── CHECK 5: Max tool calls limit ───
        if (plan.toolCalls.length > this.policy.maxToolCallsPerPlan) {
            allPassed = false;
            decision.checks.push({
                check: 'Tool Call Limit',
                passed: false,
                detail: `Plan has ${plan.toolCalls.length} tool calls, max allowed is ${this.policy.maxToolCallsPerPlan}`,
            });
        } else {
            decision.checks.push({
                check: 'Tool Call Limit',
                passed: true,
                detail: `${plan.toolCalls.length} tool call(s) within limit of ${this.policy.maxToolCallsPerPlan}`,
            });
        }

        // ─── FINAL DECISION ───
        decision.approved = allPassed;
        decision.toolCalls = allPassed ? approvedToolCalls : [];

        this._log(decision);
        return decision;
    }

    // Re-compute plan hash for integrity verification
    _computePlanHash(plan) {
        const payload = JSON.stringify(plan.toolCalls.map(tc => ({
            tool: tc.tool,
            params: tc.params,
        })));

        let hash = 0;
        const combined = this._secret + payload;
        for (let i = 0; i < combined.length; i++) {
            const char = combined.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        return Math.abs(hash).toString(16).padStart(8, '0');
    }

    _log(decision) {
        this.enforcementLog.push(decision);
    }

    _generateId() {
        return 'ac-' + Math.random().toString(36).substring(2, 10);
    }

    getEnforcementLog() {
        return [...this.enforcementLog];
    }

    getPolicy() {
        return { ...this.policy };
    }
}
