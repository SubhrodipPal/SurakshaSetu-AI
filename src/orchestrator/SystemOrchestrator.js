// ─── System Orchestrator ───
// Wires all layers: Mesh → Gateway → OpenClaw → ArmorClaw → Executor
// Manages simulation loop and demo scenario triggers
// Emits events for UI updates

import { MeshNetwork } from '../layers/mesh/MeshNetwork.js';
import { Gateway } from '../layers/gateway/Gateway.js';
import { OpenClawAgent } from '../layers/openclaw/OpenClawAgent.js';
import { ArmorClaw } from '../layers/armorclaw/ArmorClaw.js';
import { Executor } from '../layers/execution/Executor.js';

export class SystemOrchestrator {
    constructor() {
        // Initialize all layers
        this.mesh = new MeshNetwork();
        this.gateway = new Gateway(this.mesh);
        this.openClaw = new OpenClawAgent();
        this.armorClaw = new ArmorClaw();
        this.executor = new Executor(this.gateway);

        // Event listeners
        this.listeners = new Map();

        // State
        this.running = false;
        this.tickCount = 0;
        this.reasoningInterval = null;
        this.demoInProgress = false;
    }

    // ═══ LIFECYCLE ═══

    start() {
        if (this.running) return;
        this.running = true;
        this.mesh.start(1500); // Tick every 1.5s

        // Run reasoning every 3 seconds
        this.reasoningInterval = setInterval(() => {
            this._runReasoningCycle();
        }, 3000);

        // Listen to mesh events for UI updates
        this.mesh.on('tick', (telemetry) => {
            this.tickCount++;
            this._emit('telemetry-update', telemetry);
            this._emit('mesh-update', {
                nodes: Array.from(this.mesh.nodes.values()).map(n => ({
                    id: n.id, label: n.label, x: n.x, y: n.y,
                    status: n.status, riskScore: n.riskScore,
                    failureProbability: n.failureProbability,
                })),
                edges: this.mesh.edges,
            });
        });

        this.mesh.on('node-isolated', (data) => this._emit('node-isolated', data));
        this.mesh.on('node-reset', (data) => this._emit('node-reset', data));
        this.mesh.on('routing-updated', (data) => this._emit('routing-updated', data));

        this._emit('system-started', { timestamp: Date.now() });
    }

    stop() {
        this.running = false;
        this.mesh.stop();
        if (this.reasoningInterval) {
            clearInterval(this.reasoningInterval);
            this.reasoningInterval = null;
        }
        this._emit('system-stopped', { timestamp: Date.now() });
    }

    // ═══ CORE REASONING CYCLE ═══
    // Telemetry → OpenClaw → ArmorClaw → Executor

    _runReasoningCycle() {
        if (!this.running) return;

        const telemetry = this.mesh.getAllTelemetry();
        const reasoningResult = this.openClaw.reason(telemetry, this.mesh.edges);

        // Update node risk/failure scores for visualization
        for (const step of reasoningResult.steps) {
            if (step.name === 'Anomaly Detection' && step.output.riskyNodes) {
                for (const rn of step.output.riskyNodes) {
                    const node = this.mesh.nodes.get(rn.nodeId);
                    if (node) node.riskScore = rn.riskScore;
                }
            }
            if (step.name === 'Failure Prediction' && step.output.predictions) {
                for (const pred of step.output.predictions) {
                    const node = this.mesh.nodes.get(pred.nodeId);
                    if (node) node.failureProbability = pred.probability;
                }
            }
        }

        this._emit('reasoning-complete', reasoningResult);

        // If there's a plan, send to ArmorClaw
        if (reasoningResult.plan) {
            const decision = this.armorClaw.validate(reasoningResult);
            this._emit('enforcement-decision', decision);

            // Execute if approved
            const executionResult = this.executor.execute(decision);
            this._emit('execution-result', executionResult);
        }
    }

    // ═══ DEMO SCENARIOS ═══

    // Demo 1: Normal Self-Healing
    async runDemo1() {
        if (this.demoInProgress) return;
        this.demoInProgress = true;

        this._emit('demo-start', { demo: 1, name: 'Self-Healing Network Recovery' });

        // Reset mesh first
        this.mesh.resetAll();
        this.mesh.start(1500);

        // Wait a bit, then start degrading Node B
        setTimeout(() => {
            this._emit('demo-event', { message: '⚡ Node B starting to degrade...', type: 'warning' });
            this.mesh.degradeNode('B', 0.04);
        }, 2000);

        // Demo will resolve through normal reasoning cycle
        setTimeout(() => {
            this.demoInProgress = false;
            this._emit('demo-end', { demo: 1 });
        }, 20000);
    }

    // Demo 2: Unauthorized Command Blocking
    async runDemo2() {
        if (this.demoInProgress) return;
        this.demoInProgress = true;

        this._emit('demo-start', { demo: 2, name: 'Unauthorized Command Blocking' });

        setTimeout(() => {
            this._emit('demo-event', { message: '🚨 Injecting unauthorized command: shutdown_all_nodes()', type: 'danger' });

            // Generate unauthorized plan
            const unauthorizedResult = this.openClaw.generateUnauthorizedPlan();
            this._emit('reasoning-complete', unauthorizedResult);

            // Send to ArmorClaw — should be BLOCKED
            const decision = this.armorClaw.validate(unauthorizedResult);
            this._emit('enforcement-decision', decision);

            // Attempt execution (should be blocked)
            const executionResult = this.executor.execute(decision);
            this._emit('execution-result', executionResult);

            this._emit('demo-event', {
                message: decision.approved
                    ? '❌ ERROR: Command was not blocked!'
                    : '✅ Command successfully BLOCKED by ArmorClaw',
                type: decision.approved ? 'danger' : 'success',
            });
        }, 1500);

        setTimeout(() => {
            this.demoInProgress = false;
            this._emit('demo-end', { demo: 2 });
        }, 8000);
    }

    // Demo 3: Token Tampering Detection
    async runDemo3() {
        if (this.demoInProgress) return;
        this.demoInProgress = true;

        this._emit('demo-start', { demo: 3, name: 'Token Tampering Detection' });

        // Start degrading a node to generate a legitimate plan
        this.mesh.degradeNode('C', 0.06);

        setTimeout(() => {
            this._emit('demo-event', { message: '🔓 Generating tampered plan (modifying after token signing)...', type: 'warning' });

            const telemetry = this.mesh.getAllTelemetry();
            const tamperedResult = this.openClaw.generateTamperedPlan(telemetry, this.mesh.edges);
            this._emit('reasoning-complete', tamperedResult);

            // Send tampered plan to ArmorClaw — should detect tampering
            const decision = this.armorClaw.validate(tamperedResult);
            this._emit('enforcement-decision', decision);

            const executionResult = this.executor.execute(decision);
            this._emit('execution-result', executionResult);

            const hasTamperViolation = decision.violations.some(v => v.type === 'PLAN_TAMPERED' || v.type === 'DENIED_TOOL');
            this._emit('demo-event', {
                message: hasTamperViolation
                    ? '✅ Tampering DETECTED — plan integrity check failed, execution blocked'
                    : '❌ ERROR: Tampering was not detected!',
                type: hasTamperViolation ? 'success' : 'danger',
            });
        }, 3000);

        setTimeout(() => {
            // Reset degraded node
            this.mesh.resetNode('C');
            this.demoInProgress = false;
            this._emit('demo-end', { demo: 3 });
        }, 10000);
    }

    // Reset entire system
    resetSystem() {
        this.stop();
        this.mesh.resetAll();
        this.gateway = new Gateway(this.mesh);
        this.openClaw = new OpenClawAgent();
        this.armorClaw = new ArmorClaw();
        this.executor = new Executor(this.gateway);
        this.tickCount = 0;
        this.demoInProgress = false;
        this._emit('system-reset', { timestamp: Date.now() });
        this.start();
    }

    // ═══ EVENT SYSTEM ═══

    on(event, callback) {
        if (!this.listeners.has(event)) this.listeners.set(event, []);
        this.listeners.get(event).push(callback);
    }

    _emit(event, data) {
        const cbs = this.listeners.get(event) || [];
        for (const cb of cbs) cb(data);
    }
}
