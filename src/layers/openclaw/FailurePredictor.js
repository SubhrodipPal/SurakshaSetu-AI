// ─── Predictive Failure Detection ───
// Model: Lightweight logistic regression
// Inputs: voltage variance, packet drop trend, link instability
// Output: failure probability per node

export class FailurePredictor {
    constructor() {
        // Logistic regression weights (pre-trained simulated)
        this.weights = {
            voltageVariance: -2.5,
            packetDropTrend: 0.08,
            linkInstability: -0.04,
            riskScore: 3.0,
            bias: -1.2,
        };
        this.failureThreshold = 0.65;
    }

    // Sigmoid function
    _sigmoid(z) {
        return 1 / (1 + Math.exp(-z));
    }

    // Calculate variance of array
    _variance(arr) {
        if (arr.length < 2) return 0;
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        return arr.reduce((s, v) => s + (v - mean) ** 2, 0) / (arr.length - 1);
    }

    // Calculate trend (slope) of array
    _trend(arr) {
        if (arr.length < 2) return 0;
        const n = arr.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        for (let i = 0; i < n; i++) {
            sumX += i;
            sumY += arr[i];
            sumXY += i * arr[i];
            sumXX += i * i;
        }
        return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    }

    // Predict failure probability for each node
    predict(telemetry, anomalyResults) {
        const predictions = {};

        for (const [nodeId, data] of Object.entries(telemetry)) {
            if (data.status === 'failed' || data.status === 'isolated') {
                predictions[nodeId] = {
                    nodeId,
                    failureProbability: data.status === 'failed' ? 1.0 : 0.0,
                    shouldAct: data.status === 'failed',
                    features: {},
                    reasoning: data.status === 'failed' ? 'Node already failed' : 'Node is isolated',
                };
                continue;
            }

            // Extract features
            const voltageVariance = this._variance(data.history.voltage);
            const packetDropTrend = this._trend(data.history.packetLoss);
            const linkInstability = 100 - data.metrics.linkStability;
            const riskScore = anomalyResults[nodeId]?.riskScore || 0;

            // Logistic regression
            const z =
                this.weights.voltageVariance * voltageVariance +
                this.weights.packetDropTrend * packetDropTrend +
                this.weights.linkInstability * linkInstability +
                this.weights.riskScore * riskScore +
                this.weights.bias;

            const probability = +this._sigmoid(z).toFixed(4);
            const shouldAct = probability >= this.failureThreshold;

            // Generate reasoning
            const reasons = [];
            if (voltageVariance > 0.05) reasons.push(`High voltage variance (${voltageVariance.toFixed(3)})`);
            if (packetDropTrend > 1) reasons.push(`Rising packet loss trend (${packetDropTrend.toFixed(2)}/tick)`);
            if (linkInstability > 20) reasons.push(`Link instability at ${linkInstability.toFixed(1)}%`);
            if (riskScore > 0.3) reasons.push(`Elevated risk score (${riskScore})`);

            predictions[nodeId] = {
                nodeId,
                failureProbability: probability,
                shouldAct,
                features: {
                    voltageVariance: +voltageVariance.toFixed(4),
                    packetDropTrend: +packetDropTrend.toFixed(4),
                    linkInstability: +linkInstability.toFixed(2),
                    riskScore,
                },
                reasoning: reasons.length > 0 ? reasons.join('; ') : 'All metrics nominal',
            };
        }

        return predictions;
    }
}
