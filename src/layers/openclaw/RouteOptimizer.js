// ─── Route Optimizer ───
// Modified AODV routing with path scoring
// Scores based on: signal strength, stability, hop count, latency

export class RouteOptimizer {
    constructor() {
        this.weights = {
            signalStrength: 0.3,
            stability: 0.3,
            hopCount: 0.25,
            latency: 0.15,
        };
    }

    // Find best alternative path avoiding specified nodes
    findOptimalRoute(telemetry, meshEdges, avoidNodes, sourceId = 'A') {
        const activeNodes = Object.keys(telemetry).filter(
            id => !avoidNodes.includes(id) && telemetry[id].status !== 'failed' && telemetry[id].status !== 'isolated'
        );

        const activeEdges = meshEdges.filter(
            e => e.active && !avoidNodes.includes(e.from) && !avoidNodes.includes(e.to)
        );

        // Build adjacency
        const adj = {};
        for (const id of activeNodes) adj[id] = [];
        for (const edge of activeEdges) {
            if (adj[edge.from]) adj[edge.from].push(edge.to);
            if (adj[edge.to]) adj[edge.to].push(edge.from);
        }

        // Find all paths from source using DFS (limited depth)
        const allPaths = {};
        for (const targetId of activeNodes) {
            if (targetId === sourceId) continue;
            const paths = this._findAllPaths(adj, sourceId, targetId, 6);
            if (paths.length > 0) {
                // Score each path and pick the best
                const scoredPaths = paths.map(path => ({
                    path,
                    score: this._scorePath(path, telemetry),
                }));
                scoredPaths.sort((a, b) => b.score - a.score);
                allPaths[targetId] = scoredPaths[0];
            }
        }

        return {
            avoidNodes,
            optimizedRoutes: allPaths,
            timestamp: Date.now(),
        };
    }

    // DFS path finder with depth limit
    _findAllPaths(adj, source, target, maxDepth) {
        const paths = [];
        const visited = new Set();

        const dfs = (current, path) => {
            if (path.length > maxDepth) return;
            if (current === target) {
                paths.push([...path]);
                return;
            }
            visited.add(current);
            for (const nbr of (adj[current] || [])) {
                if (!visited.has(nbr)) {
                    path.push(nbr);
                    dfs(nbr, path);
                    path.pop();
                }
            }
            visited.delete(current);
        };

        dfs(source, [source]);
        return paths;
    }

    // Score a path based on multi-criteria
    _scorePath(path, telemetry) {
        if (path.length <= 1) return 0;

        // Signal strength — average RSSI (normalized to 0-1)
        let avgRssi = 0;
        for (const id of path) {
            const rssi = telemetry[id]?.metrics?.rssi || -90;
            avgRssi += (rssi + 90) / 60; // normalize -90→0, -30→1
        }
        avgRssi /= path.length;
        avgRssi = Math.max(0, Math.min(1, avgRssi));

        // Stability — average link stability
        let avgStability = 0;
        for (const id of path) {
            avgStability += (telemetry[id]?.metrics?.linkStability || 0) / 100;
        }
        avgStability /= path.length;

        // Hop count — fewer is better
        const hopScore = Math.max(0, 1 - (path.length - 2) / 5);

        // Latency — based on packet loss (lower is better)
        let avgLatency = 0;
        for (const id of path) {
            avgLatency += (telemetry[id]?.metrics?.packetLoss || 0) / 100;
        }
        avgLatency /= path.length;
        const latencyScore = 1 - avgLatency;

        return (
            this.weights.signalStrength * avgRssi +
            this.weights.stability * avgStability +
            this.weights.hopCount * hopScore +
            this.weights.latency * latencyScore
        );
    }
}
