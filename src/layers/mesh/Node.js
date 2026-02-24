// ─── IoT Node Simulator ───
// Simulates an individual IoT sensor node (ESP32/STM32 + LoRa)
// Pure sensing and communication — NO AI logic, NO security enforcement

export class Node {
    constructor(id, label, x, y, neighbors = []) {
        this.id = id;
        this.label = label;
        this.x = x;
        this.y = y;
        this.neighbors = [...neighbors];
        this.status = 'healthy'; // healthy | degrading | failed | isolated

        // Sensor readings
        this.voltage = 3.3 + (Math.random() * 0.4 - 0.2);
        this.rssi = -40 - Math.random() * 20;
        this.packetLoss = Math.random() * 2;
        this.linkStability = 95 + Math.random() * 5;
        this.temperature = 22 + Math.random() * 8;
        this.humidity = 40 + Math.random() * 30;
        this.pressure = 1013 + Math.random() * 10 - 5;
        this.gasLevel = Math.random() * 50;

        // Internal state
        this.heartbeatInterval = 2000; // ms
        this.lastHeartbeat = Date.now();
        this.heartbeatHistory = [];
        this.voltageHistory = [];
        this.rssiHistory = [];
        this.packetLossHistory = [];
        this.failureProbability = 0;
        this.riskScore = 0;

        // Degradation config
        this._degrading = false;
        this._degradationRate = 0;
        this._degradationStep = 0;
    }

    // Start gradual degradation
    startDegradation(rate = 0.02) {
        this._degrading = true;
        this._degradationRate = rate;
        this._degradationStep = 0;
        this.status = 'degrading';
    }

    // Instant failure
    fail() {
        this.status = 'failed';
        this.voltage = 0;
        this.rssi = -120;
        this.packetLoss = 100;
        this.linkStability = 0;
        this._degrading = false;
    }

    // Isolate from mesh
    isolate() {
        this.status = 'isolated';
        this._degrading = false;
    }

    // Reset to healthy
    reset() {
        this.status = 'healthy';
        this.voltage = 3.3 + (Math.random() * 0.4 - 0.2);
        this.rssi = -40 - Math.random() * 20;
        this.packetLoss = Math.random() * 2;
        this.linkStability = 95 + Math.random() * 5;
        this._degrading = false;
        this._degradationStep = 0;
    }

    // Tick simulation — updates metrics
    tick() {
        if (this.status === 'failed' || this.status === 'isolated') return;

        if (this._degrading) {
            this._degradationStep++;
            const d = this._degradationStep * this._degradationRate;

            this.voltage = Math.max(0, 3.3 - d * 1.5 + (Math.random() * 0.1 - 0.05));
            this.rssi = Math.min(-10, -45 - d * 30 + (Math.random() * 5 - 2.5));
            this.packetLoss = Math.min(100, 2 + d * 40 + Math.random() * 3);
            this.linkStability = Math.max(0, 97 - d * 45 + Math.random() * 2);
            this.temperature = 22 + d * 15 + Math.random() * 2;
            this.gasLevel = Math.min(999, 30 + d * 80 + Math.random() * 10);

            if (this.voltage < 0.5) {
                this.fail();
                return;
            }
        } else {
            // Normal jitter
            this.voltage += (Math.random() - 0.5) * 0.02;
            this.voltage = Math.max(2.8, Math.min(3.7, this.voltage));
            this.rssi += (Math.random() - 0.5) * 2;
            this.rssi = Math.max(-90, Math.min(-30, this.rssi));
            this.packetLoss = Math.max(0, this.packetLoss + (Math.random() - 0.5) * 0.5);
            this.linkStability = Math.min(100, Math.max(80, this.linkStability + (Math.random() - 0.5) * 0.3));
            this.temperature += (Math.random() - 0.5) * 0.3;
            this.humidity += (Math.random() - 0.5) * 0.5;
            this.gasLevel = Math.max(0, this.gasLevel + (Math.random() - 0.5) * 2);
        }

        // Record history (keep last 30 data points)
        const now = Date.now();
        this.heartbeatHistory.push(now - this.lastHeartbeat);
        this.voltageHistory.push(this.voltage);
        this.rssiHistory.push(this.rssi);
        this.packetLossHistory.push(this.packetLoss);

        if (this.heartbeatHistory.length > 30) this.heartbeatHistory.shift();
        if (this.voltageHistory.length > 30) this.voltageHistory.shift();
        if (this.rssiHistory.length > 30) this.rssiHistory.shift();
        if (this.packetLossHistory.length > 30) this.packetLossHistory.shift();

        this.lastHeartbeat = now;
    }

    // Get current telemetry snapshot
    getTelemetry() {
        return {
            nodeId: this.id,
            label: this.label,
            status: this.status,
            timestamp: Date.now(),
            metrics: {
                voltage: +this.voltage.toFixed(2),
                rssi: +this.rssi.toFixed(1),
                packetLoss: +this.packetLoss.toFixed(1),
                linkStability: +this.linkStability.toFixed(1),
                temperature: +this.temperature.toFixed(1),
                humidity: +this.humidity.toFixed(1),
                pressure: +this.pressure.toFixed(1),
                gasLevel: +this.gasLevel.toFixed(1),
            },
            history: {
                voltage: [...this.voltageHistory],
                rssi: [...this.rssiHistory],
                packetLoss: [...this.packetLossHistory],
                heartbeat: [...this.heartbeatHistory],
            },
        };
    }
}
