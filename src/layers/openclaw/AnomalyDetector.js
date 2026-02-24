// ─── Anomaly Detection Engine ───
// Input: heartbeat interval, packet loss %, RSSI, voltage fluctuation
// Method: threshold-based + rolling window analysis
// Output: risk score per node (0–1)

export class AnomalyDetector {
    constructor() {
        // Thresholds
        this.thresholds = {
            voltage: { warning: 2.8, critical: 2.2 },
            rssi: { warning: -70, critical: -85 },
            packetLoss: { warning: 15, critical: 40 },
            linkStability: { warning: 70, critical: 40 },
            heartbeatDelay: { warning: 3000, critical: 6000 },
        };
    }

    // Analyze telemetry and return per-node risk scores
    analyze(telemetry) {
        const results = {};

        for (const [nodeId, data] of Object.entries(telemetry)) {
            if (data.status === 'failed' || data.status === 'isolated') {
                results[nodeId] = {
                    nodeId,
                    riskScore: data.status === 'failed' ? 1.0 : 0.0,
                    anomalies: data.status === 'failed' ? ['NODE_FAILED'] : ['NODE_ISOLATED'],
                    details: {},
                };
                continue;
            }

            const anomalies = [];
            const details = {};
            let score = 0;

            // Voltage check
            const v = data.metrics.voltage;
            if (v < this.thresholds.voltage.critical) {
                anomalies.push('VOLTAGE_CRITICAL');
                score += 0.35;
                details.voltage = { value: v, severity: 'critical' };
            } else if (v < this.thresholds.voltage.warning) {
                anomalies.push('VOLTAGE_WARNING');
                score += 0.15;
                details.voltage = { value: v, severity: 'warning' };
            }

            // RSSI check
            const r = data.metrics.rssi;
            if (r < this.thresholds.rssi.critical) {
                anomalies.push('RSSI_CRITICAL');
                score += 0.25;
                details.rssi = { value: r, severity: 'critical' };
            } else if (r < this.thresholds.rssi.warning) {
                anomalies.push('RSSI_WARNING');
                score += 0.1;
                details.rssi = { value: r, severity: 'warning' };
            }

            // Packet loss check
            const pl = data.metrics.packetLoss;
            if (pl > this.thresholds.packetLoss.critical) {
                anomalies.push('PACKET_LOSS_CRITICAL');
                score += 0.3;
                details.packetLoss = { value: pl, severity: 'critical' };
            } else if (pl > this.thresholds.packetLoss.warning) {
                anomalies.push('PACKET_LOSS_WARNING');
                score += 0.12;
                details.packetLoss = { value: pl, severity: 'warning' };
            }

            // Link stability check
            const ls = data.metrics.linkStability;
            if (ls < this.thresholds.linkStability.critical) {
                anomalies.push('LINK_STABILITY_CRITICAL');
                score += 0.25;
                details.linkStability = { value: ls, severity: 'critical' };
            } else if (ls < this.thresholds.linkStability.warning) {
                anomalies.push('LINK_STABILITY_WARNING');
                score += 0.1;
                details.linkStability = { value: ls, severity: 'warning' };
            }

            // Voltage trend analysis (rolling window)
            if (data.history.voltage.length >= 5) {
                const recent = data.history.voltage.slice(-5);
                const trend = recent[recent.length - 1] - recent[0];
                if (trend < -0.3) {
                    anomalies.push('VOLTAGE_DECLINING_FAST');
                    score += 0.15;
                    details.voltageTrend = { delta: +trend.toFixed(3), severity: 'warning' };
                }
            }

            // Packet loss trend
            if (data.history.packetLoss.length >= 5) {
                const recent = data.history.packetLoss.slice(-5);
                const trend = recent[recent.length - 1] - recent[0];
                if (trend > 10) {
                    anomalies.push('PACKET_LOSS_RISING');
                    score += 0.1;
                    details.packetLossTrend = { delta: +trend.toFixed(1), severity: 'warning' };
                }
            }

            results[nodeId] = {
                nodeId,
                riskScore: Math.min(1, +score.toFixed(3)),
                anomalies,
                details,
            };
        }

        return results;
    }
}
