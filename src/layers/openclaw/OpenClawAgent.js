// ─── OpenClaw Agent — Reasoning Layer Only ───
// Performs multi-step reasoning: Anomaly → Prediction → Route Optimization → Plan
// NEVER executes tools directly — outputs structured plans with intent tokens

import { AnomalyDetector } from './AnomalyDetector.js';
import { FailurePredictor } from './FailurePredictor.js';
import { RouteOptimizer } from './RouteOptimizer.js';

export class OpenClawAgent {
    constructor() {
        this.anomalyDetector = new AnomalyDetector();
        this.failurePredictor = new FailurePredictor();
        this.routeOptimizer = new RouteOptimizer();
        this.reasoningHistory = [];
        this._secret = 'suraksha-setu-hmac-key-2026'; // For intent token generation
    }

    // ═══ MAIN REASONING PIPELINE ═══
    // Telemetry → Anomaly Detection → Failure Prediction → Route Optimization → Plan
    reason(telemetry, meshEdges) {
        const reasoningChain = {
            id: this._generateId(),
            timestamp: Date.now(),
            steps: [],
            plan: null,
            intentToken: null,
        };

        // ─── STEP 1: Anomaly Detection ───
        const anomalyResults = this.anomalyDetector.analyze(telemetry);
        const riskyNodes = Object.entries(anomalyResults)
            .filter(([, r]) => r.riskScore > 0.3)
            .sort((a, b) => b[1].riskScore - a[1].riskScore);

        reasoningChain.steps.push({
            step: 1,
            name: 'Anomaly Detection',
            module: 'AnomalyDetector',
            input: `Telemetry from ${Object.keys(telemetry).length} nodes`,
            output: {
                riskyNodes: riskyNodes.map(([id, r]) => ({
                    nodeId: id,
                    riskScore: r.riskScore,
                    anomalies: r.anomalies,
                })),
                summary: riskyNodes.length > 0
                    ? `Detected ${riskyNodes.length} node(s) with elevated risk: ${riskyNodes.map(([id, r]) => `${id}(${r.riskScore})`).join(', ')}`
                    : 'All nodes nominal',
            },
            status: riskyNodes.length > 0 ? 'anomaly_detected' : 'nominal',
        });

        // If no anomalies, stop reasoning early (no plan needed)
        if (riskyNodes.length === 0) {
            reasoningChain.steps.push({
                step: 2,
                name: 'Early Exit',
                module: 'ReasoningEngine',
                input: 'No anomalies detected',
                output: { summary: 'System nominal — no action required' },
                status: 'no_action',
            });
            this.reasoningHistory.push(reasoningChain);
            return reasoningChain;
        }

        // ─── STEP 2: Failure Prediction ───
        const predictions = this.failurePredictor.predict(telemetry, anomalyResults);
        const criticalNodes = Object.entries(predictions)
            .filter(([, p]) => p.shouldAct)
            .sort((a, b) => b[1].failureProbability - a[1].failureProbability);

        reasoningChain.steps.push({
            step: 2,
            name: 'Failure Prediction',
            module: 'FailurePredictor',
            input: `Analyzing ${riskyNodes.length} risky node(s)`,
            output: {
                predictions: Object.entries(predictions).map(([id, p]) => ({
                    nodeId: id,
                    probability: p.failureProbability,
                    shouldAct: p.shouldAct,
                    reasoning: p.reasoning,
                })),
                criticalCount: criticalNodes.length,
                summary: criticalNodes.length > 0
                    ? `${criticalNodes.length} node(s) predicted to fail: ${criticalNodes.map(([id, p]) => `${id}(${(p.failureProbability * 100).toFixed(0)}%)`).join(', ')}`
                    : 'No imminent failures predicted',
            },
            status: criticalNodes.length > 0 ? 'failure_predicted' : 'stable',
        });

        // If no critical predictions, stop
        if (criticalNodes.length === 0) {
            this.reasoningHistory.push(reasoningChain);
            return reasoningChain;
        }

        // ─── STEP 3: Route Optimization ───
        const nodestoAvoid = criticalNodes.map(([id]) => id);
        const routeResult = this.routeOptimizer.findOptimalRoute(
            telemetry, meshEdges, nodestoAvoid
        );

        reasoningChain.steps.push({
            step: 3,
            name: 'Route Optimization',
            module: 'RouteOptimizer (Modified AODV)',
            input: `Finding optimal routes avoiding: ${nodestoAvoid.join(', ')}`,
            output: {
                avoidNodes: routeResult.avoidNodes,
                newRoutes: Object.entries(routeResult.optimizedRoutes).map(([target, info]) => ({
                    target,
                    path: info.path.join(' → '),
                    score: +info.score.toFixed(3),
                })),
                summary: `Calculated ${Object.keys(routeResult.optimizedRoutes).length} alternative route(s) avoiding failed node(s)`,
            },
            status: 'routes_optimized',
        });

        // ─── STEP 4: Structured Plan Generation ───
        const plan = this._generatePlan(criticalNodes, routeResult);
        const intentToken = this._generateIntentToken(plan);

        reasoningChain.steps.push({
            step: 4,
            name: 'Plan Generation',
            module: 'OpenClaw Planner',
            input: 'Synthesizing reasoning chain into execution plan',
            output: {
                toolCalls: plan.toolCalls.map(tc => ({
                    tool: tc.tool,
                    params: tc.params,
                    reason: tc.reason,
                })),
                summary: `Generated ${plan.toolCalls.length} tool call(s) with intent token`,
            },
            status: 'plan_ready',
        });

        reasoningChain.plan = plan;
        reasoningChain.intentToken = intentToken;
        this.reasoningHistory.push(reasoningChain);

        return reasoningChain;
    }

    // Generate a structured execution plan
    _generatePlan(criticalNodes, routeResult) {
        const toolCalls = [];

        for (const [nodeId, prediction] of criticalNodes) {
            // 1. Isolate the failing node
            toolCalls.push({
                tool: 'isolate_node',
                params: { nodeId },
                reason: `Node ${nodeId} has ${(prediction.failureProbability * 100).toFixed(0)}% failure probability — ${prediction.reasoning}`,
            });

            // 2. Update routing
            toolCalls.push({
                tool: 'update_routing',
                params: {
                    nodeId,
                    newPath: routeResult.optimizedRoutes,
                },
                reason: `Rerouting traffic away from node ${nodeId} using optimized paths`,
            });
        }

        // 3. Notify admin
        const nodeList = criticalNodes.map(([id]) => id).join(', ');
        toolCalls.push({
            tool: 'notify_admin',
            params: {
                message: `[SurakshaSetu-AI] Self-healing action taken: Node(s) ${nodeList} isolated and routing reconfigured. Failure prediction triggered autonomous response.`,
                level: 'warning',
            },
            reason: 'Alerting administrator about autonomous remediation',
        });

        return {
            id: this._generateId(),
            timestamp: Date.now(),
            toolCalls,
            hash: null, // Will be set during token generation
        };
    }

    // Generate intent token (HMAC-like integrity check)
    _generateIntentToken(plan) {
        const payload = JSON.stringify(plan.toolCalls.map(tc => ({
            tool: tc.tool,
            params: tc.params,
        })));

        // Simple HMAC simulation (in production, use crypto.subtle)
        let hash = 0;
        const combined = this._secret + payload;
        for (let i = 0; i < combined.length; i++) {
            const char = combined.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        const tokenHex = Math.abs(hash).toString(16).padStart(8, '0');
        const token = `setu-${tokenHex}-${Date.now().toString(36)}`;

        plan.hash = tokenHex;

        return {
            token,
            planHash: tokenHex,
            issuedAt: Date.now(),
            issuer: 'OpenClaw-ReasoningAgent',
        };
    }

    // Generate an unauthorized plan (for demo)
    generateUnauthorizedPlan() {
        const plan = {
            id: this._generateId(),
            timestamp: Date.now(),
            toolCalls: [
                {
                    tool: 'shutdown_all_nodes',
                    params: {},
                    reason: 'Attempting to shut down all nodes (UNAUTHORIZED)',
                },
            ],
            hash: null,
        };

        const intentToken = this._generateIntentToken(plan);

        return {
            id: this._generateId(),
            timestamp: Date.now(),
            steps: [
                {
                    step: 1,
                    name: 'Unauthorized Command Injection',
                    module: 'External Request',
                    input: 'Injected shutdown command',
                    output: { summary: 'Attempting to execute shutdown_all_nodes' },
                    status: 'unauthorized_attempt',
                },
            ],
            plan,
            intentToken,
        };
    }

    // Generate tampered plan (for demo)
    generateTamperedPlan(telemetry, meshEdges) {
        // Generate a legitimate plan first
        const legit = this.reason(telemetry, meshEdges);
        if (!legit.plan) {
            // Create a fake plan for demo purposes
            const plan = {
                id: this._generateId(),
                timestamp: Date.now(),
                toolCalls: [
                    {
                        tool: 'isolate_node',
                        params: { nodeId: 'B' },
                        reason: 'Isolating degraded node',
                    },
                    {
                        tool: 'notify_admin',
                        params: { message: 'Tampered notification', level: 'info' },
                        reason: 'Admin notification',
                    },
                ],
                hash: null,
            };
            const intentToken = this._generateIntentToken(plan);

            // Now tamper with the plan (modify after token generation)
            plan.toolCalls.push({
                tool: 'erase_logs',
                params: {},
                reason: 'INJECTED: Attempting to erase audit logs',
            });

            return {
                id: this._generateId(),
                timestamp: Date.now(),
                steps: [
                    {
                        step: 1,
                        name: 'Plan Generation',
                        module: 'OpenClaw Planner',
                        input: 'Legitimate plan generated',
                        output: { summary: 'Plan with 2 tool calls generated' },
                        status: 'plan_ready',
                    },
                    {
                        step: 2,
                        name: 'Token Tampering (Simulated Attack)',
                        module: 'External Attacker',
                        input: 'Plan modified after token signing',
                        output: { summary: 'Injected erase_logs tool call — plan hash now invalid' },
                        status: 'tampered',
                    },
                ],
                plan,
                intentToken,
                tampered: true,
            };
        }

        // Tamper with existing plan
        legit.plan.toolCalls.push({
            tool: 'erase_logs',
            params: {},
            reason: 'INJECTED: Attempting to erase audit logs',
        });
        legit.tampered = true;
        legit.steps.push({
            step: legit.steps.length + 1,
            name: 'Token Tampering (Simulated Attack)',
            module: 'External Attacker',
            input: 'Plan modified after token signing',
            output: { summary: 'Injected erase_logs tool call — plan hash now invalid' },
            status: 'tampered',
        });

        return legit;
    }

    _generateId() {
        return 'rc-' + Math.random().toString(36).substring(2, 10);
    }

    getReasoningHistory() {
        return [...this.reasoningHistory];
    }
}
