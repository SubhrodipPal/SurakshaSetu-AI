// ─── Dashboard Controller ───
// Wires all UI components to the SystemOrchestrator events

import { MeshVisualizer } from './MeshVisualizer.js';
import { POLICY } from '../layers/armorclaw/Policy.js';

export class Dashboard {
    constructor(orchestrator) {
        this.orch = orchestrator;
        this.meshViz = null;
        this.toastContainer = null;
        this._init();
    }

    _init() {
        this.meshViz = new MeshVisualizer('meshCanvas');
        this.toastContainer = document.getElementById('toastContainer');

        this._renderPolicy();
        this._bindDemoButtons();
        this._bindEvents();
    }

    _bindEvents() {
        this.orch.on('mesh-update', (data) => this._onMeshUpdate(data));
        this.orch.on('telemetry-update', (data) => this._onTelemetryUpdate(data));
        this.orch.on('reasoning-complete', (data) => this._onReasoningComplete(data));
        this.orch.on('enforcement-decision', (data) => this._onEnforcementDecision(data));
        this.orch.on('execution-result', (data) => this._onExecutionResult(data));
        this.orch.on('demo-start', (data) => this._onDemoStart(data));
        this.orch.on('demo-end', (data) => this._onDemoEnd(data));
        this.orch.on('demo-event', (data) => this._showToast(data.message, data.type));
        this.orch.on('system-reset', () => this._onSystemReset());
    }

    _bindDemoButtons() {
        document.getElementById('btnDemo1').addEventListener('click', () => this.orch.runDemo1());
        document.getElementById('btnDemo2').addEventListener('click', () => this.orch.runDemo2());
        document.getElementById('btnDemo3').addEventListener('click', () => this.orch.runDemo3());
        document.getElementById('btnReset').addEventListener('click', () => this.orch.resetSystem());
    }

    // ═══ MESH UPDATE ═══
    _onMeshUpdate(data) {
        this.meshViz.update(data);
        this._updateArchFlow();
    }

    // ═══ TELEMETRY UPDATE ═══
    _onTelemetryUpdate(telemetry) {
        const container = document.getElementById('telemetryGrid');
        if (!container) return;

        container.innerHTML = '';

        for (const [nodeId, data] of Object.entries(telemetry)) {
            const statusClass = data.status === 'failed' ? 'critical' :
                data.status === 'degrading' ? 'warning' :
                    data.status === 'isolated' ? 'isolated' : '';

            const statusColor = data.status === 'healthy' ? 'var(--accent-emerald)' :
                data.status === 'degrading' ? 'var(--accent-amber)' :
                    data.status === 'failed' ? 'var(--accent-red)' : 'var(--text-muted)';

            const voltClass = data.metrics.voltage < 2.2 ? 'critical' : data.metrics.voltage < 2.8 ? 'warning' : '';
            const rssiClass = data.metrics.rssi < -85 ? 'critical' : data.metrics.rssi < -70 ? 'warning' : '';
            const plClass = data.metrics.packetLoss > 40 ? 'critical' : data.metrics.packetLoss > 15 ? 'warning' : '';

            const el = document.createElement('div');
            el.className = `telemetry-node ${statusClass}`;
            el.innerHTML = `
        <div class="telemetry-node__header">
          <span class="telemetry-node__name">${nodeId}</span>
          <span class="telemetry-node__status" style="background:${statusColor}20;color:${statusColor}">${data.status}</span>
        </div>
        <div class="telemetry-node__metrics">
          <div class="metric"><span>Voltage</span><span class="metric__value ${voltClass}">${data.metrics.voltage}V</span></div>
          <div class="metric"><span>RSSI</span><span class="metric__value ${rssiClass}">${data.metrics.rssi}dBm</span></div>
          <div class="metric"><span>P.Loss</span><span class="metric__value ${plClass}">${data.metrics.packetLoss}%</span></div>
          <div class="metric"><span>Temp</span><span class="metric__value">${data.metrics.temperature}°C</span></div>
        </div>
      `;
            container.appendChild(el);
        }
    }

    // ═══ REASONING CHAIN ═══
    _onReasoningComplete(result) {
        const container = document.getElementById('reasoningChain');
        if (!container) return;

        // Highlight architecture flow
        this._highlightLayer('openclaw');

        const chainEl = document.createElement('div');
        chainEl.className = 'reasoning-chain-entry';
        chainEl.style.marginBottom = '12px';
        chainEl.style.paddingBottom = '12px';
        chainEl.style.borderBottom = '1px solid rgba(99,102,241,0.1)';

        const timeStr = new Date().toLocaleTimeString();
        chainEl.innerHTML = `<div style="font-size:0.6rem;color:var(--text-muted);margin-bottom:6px;font-family:var(--font-mono);">${timeStr} — Chain #${result.id}</div>`;

        for (const step of result.steps) {
            const stepClass = step.name.includes('Anomaly') ? 'anomaly' :
                step.name.includes('Prediction') || step.name.includes('Failure') ? 'prediction' :
                    step.name.includes('Route') || step.name.includes('Optimization') ? 'optimization' :
                        step.name.includes('Plan') ? 'plan' :
                            step.name.includes('Unauthorized') ? 'unauthorized' :
                                step.name.includes('Tamper') ? 'tampered' : '';

            const stepEl = document.createElement('div');
            stepEl.className = `reasoning-step ${stepClass}`;
            stepEl.innerHTML = `
        <div class="reasoning-step__header">
          <span class="reasoning-step__number">${step.step}</span>
          <span class="reasoning-step__name">${step.name}</span>
          <span class="reasoning-step__module">${step.module}</span>
        </div>
        <div class="reasoning-step__summary">${step.output?.summary || ''}</div>
      `;
            chainEl.appendChild(stepEl);
        }

        // Prepend (newest first)
        container.insertBefore(chainEl, container.firstChild);

        // Keep max 5 entries
        while (container.children.length > 5) {
            container.removeChild(container.lastChild);
        }
    }

    // ═══ ENFORCEMENT DECISION ═══
    _onEnforcementDecision(decision) {
        const container = document.getElementById('enforcementLog');
        if (!container) return;

        this._highlightLayer('armorclaw');

        // Remove empty state
        const empty = container.querySelector('.empty-state');
        if (empty) empty.remove();

        const entry = document.createElement('div');
        entry.className = `enforcement-entry ${decision.approved ? 'approved' : 'denied'}`;

        const timeStr = new Date().toLocaleTimeString();

        let checksHtml = decision.checks.map(c => `
      <div class="enforcement-check ${c.passed ? 'passed' : 'failed'}">
        <span class="enforcement-check__icon">${c.passed ? '✓' : '✗'}</span>
        <span>${c.check}: ${c.detail}</span>
      </div>
    `).join('');

        let violationsHtml = '';
        if (decision.violations.length > 0) {
            violationsHtml = `
        <div class="enforcement-violations">
          ${decision.violations.map(v => `<div class="violation">⚠ ${v.type}: ${v.detail}</div>`).join('')}
        </div>
      `;
        }

        entry.innerHTML = `
      <div class="enforcement-entry__header">
        <span class="enforcement-entry__verdict ${decision.approved ? 'approved' : 'denied'}">
          ${decision.approved ? '✅ APPROVED' : '🛑 DENIED'}
        </span>
        <span class="enforcement-entry__time">${timeStr}</span>
      </div>
      <div class="enforcement-checks">${checksHtml}</div>
      ${violationsHtml}
    `;

        container.insertBefore(entry, container.firstChild);

        while (container.children.length > 8) {
            container.removeChild(container.lastChild);
        }

        // Update header badge
        const badge = document.getElementById('enforcementBadge');
        if (badge) {
            if (decision.approved) {
                badge.className = 'card__badge badge--active';
                badge.textContent = 'APPROVED';
            } else {
                badge.className = 'card__badge badge--blocked';
                badge.textContent = 'BLOCKED';
            }
        }
    }

    // ═══ EXECUTION RESULT ═══
    _onExecutionResult(result) {
        if (result.approved) {
            this._highlightLayer('executor');
        }
    }

    // ═══ DEMO LIFECYCLE ═══
    _onDemoStart(data) {
        this._showToast(`🎬 Demo ${data.demo}: ${data.name}`, 'info');
        this._setDemoButtonsDisabled(true);
    }

    _onDemoEnd(data) {
        this._showToast(`✨ Demo ${data.demo} complete`, 'success');
        this._setDemoButtonsDisabled(false);
    }

    _onSystemReset() {
        document.getElementById('reasoningChain').innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🧠</div>
        Reasoning chains will appear here when anomalies are detected
      </div>
    `;
        document.getElementById('enforcementLog').innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🛡️</div>
        ArmorClaw enforcement decisions will appear here
      </div>
    `;
        const badge = document.getElementById('enforcementBadge');
        if (badge) {
            badge.className = 'card__badge badge--active';
            badge.textContent = 'MONITORING';
        }
        this._showToast('🔄 System reset — all nodes healthy', 'info');
    }

    // ═══ TOAST NOTIFICATIONS ═══
    _showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `event-toast ${type}`;
        toast.textContent = message;
        this.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // ═══ ARCH FLOW HIGHLIGHT ═══
    _highlightLayer(layerId) {
        document.querySelectorAll('.arch-flow__layer').forEach(el => el.classList.remove('active'));
        const target = document.querySelector(`.arch-flow__layer--${layerId}`);
        if (target) {
            target.classList.add('active');
            setTimeout(() => target.classList.remove('active'), 2000);
        }
    }

    _updateArchFlow() {
        // Just keep indicators alive
    }

    // ═══ POLICY DISPLAY ═══
    _renderPolicy() {
        const container = document.getElementById('policyDisplay');
        if (!container) return;

        container.innerHTML = `
      <div class="policy-list">
        <div class="policy-list__title allow">✓ ALLOWED</div>
        ${POLICY.allow.map(t => `<div class="policy-item allow">${t}()</div>`).join('')}
      </div>
      <div class="policy-list">
        <div class="policy-list__title deny">✗ DENIED</div>
        ${POLICY.deny.map(t => `<div class="policy-item deny">${t}()</div>`).join('')}
      </div>
    `;
    }

    _setDemoButtonsDisabled(disabled) {
        ['btnDemo1', 'btnDemo2', 'btnDemo3'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.disabled = disabled;
        });
    }
}
