// ─── IoT Mesh Network Simulator ───
// Simulates the full mesh topology with multiple nodes
// Pure sensing and communication layer — NO AI, NO security

import { Node } from './Node.js';

export class MeshNetwork {
    constructor() {
        this.nodes = new Map();
        this.edges = [];
        this.routingTable = new Map();
        this.listeners = new Map();
        this._tickInterval = null;
        this._initializeDefaultMesh();
    }

    // Create default 6-node mesh
    _initializeDefaultMesh() {
        // Hex-ish arrangement for visual appeal
        const nodeConfigs = [
            { id: 'A', label: 'Node-A (Gateway)', x: 0.5, y: 0.15 },
            { id: 'B', label: 'Node-B (Sensor)', x: 0.25, y: 0.38 },
            { id: 'C', label: 'Node-C (Sensor)', x: 0.75, y: 0.38 },
            { id: 'D', label: 'Node-D (Relay)', x: 0.2, y: 0.65 },
            { id: 'E', label: 'Node-E (Relay)', x: 0.8, y: 0.65 },
            { id: 'F', label: 'Node-F (Endpoint)', x: 0.5, y: 0.85 },
        ];

        const edgeConfigs = [
            ['A', 'B'], ['A', 'C'],
            ['B', 'C'], ['B', 'D'],
            ['C', 'E'], ['D', 'E'],
            ['D', 'F'], ['E', 'F'],
        ];

        for (const cfg of nodeConfigs) {
            const neighbors = edgeConfigs
                .filter(([a, b]) => a === cfg.id || b === cfg.id)
                .map(([a, b]) => (a === cfg.id ? b : a));
            this.nodes.set(cfg.id, new Node(cfg.id, cfg.label, cfg.x, cfg.y, neighbors));
        }

        this.edges = edgeConfigs.map(([from, to]) => ({ from, to, active: true, weight: 1 }));
        this._buildRoutingTable();
    }

    // BFS-based routing table
    _buildRoutingTable() {
        this.routingTable.clear();
        for (const [srcId] of this.nodes) {
            const paths = {};
            const visited = new Set([srcId]);
            const queue = [[srcId, [srcId]]];

            while (queue.length > 0) {
                const [current, path] = queue.shift();
                paths[current] = path;
                const node = this.nodes.get(current);
                if (!node) continue;

                for (const nbr of node.neighbors) {
                    if (!visited.has(nbr)) {
                        const nbrNode = this.nodes.get(nbr);
                        if (nbrNode && nbrNode.status !== 'failed' && nbrNode.status !== 'isolated') {
                            visited.add(nbr);
                            queue.push([nbr, [...path, nbr]]);
                        }
                    }
                }
            }
            this.routingTable.set(srcId, paths);
        }
    }

    // Collect telemetry from all active nodes
    getAllTelemetry() {
        const telemetry = {};
        for (const [id, node] of this.nodes) {
            telemetry[id] = node.getTelemetry();
        }
        return telemetry;
    }

    // Get network status
    getNetworkStatus() {
        return {
            totalNodes: this.nodes.size,
            activeNodes: [...this.nodes.values()].filter(n => n.status === 'healthy' || n.status === 'degrading').length,
            failedNodes: [...this.nodes.values()].filter(n => n.status === 'failed').length,
            isolatedNodes: [...this.nodes.values()].filter(n => n.status === 'isolated').length,
            edges: this.edges.filter(e => e.active).length,
            routingTable: Object.fromEntries(this.routingTable),
            telemetry: this.getAllTelemetry(),
        };
    }

    // Isolate a node from the mesh
    isolateNode(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) return { success: false, error: `Node ${nodeId} not found` };

        node.isolate();
        // Deactivate edges involving this node
        for (const edge of this.edges) {
            if (edge.from === nodeId || edge.to === nodeId) {
                edge.active = false;
            }
        }
        this._buildRoutingTable();
        this._emit('node-isolated', { nodeId });
        return { success: true, nodeId, message: `Node ${nodeId} isolated from mesh` };
    }

    // Update routing for a node
    updateRouting(nodeId, newPath) {
        this._buildRoutingTable();
        this._emit('routing-updated', { nodeId, newPath });
        return { success: true, nodeId, newPath, message: `Routing updated, avoiding node ${nodeId}` };
    }

    // Reset a single node
    resetNode(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) return { success: false, error: `Node ${nodeId} not found` };

        node.reset();
        for (const edge of this.edges) {
            if (edge.from === nodeId || edge.to === nodeId) {
                edge.active = true;
            }
        }
        this._buildRoutingTable();
        this._emit('node-reset', { nodeId });
        return { success: true, nodeId, message: `Node ${nodeId} reset to healthy` };
    }

    // Start degrading a node (for demo)
    degradeNode(nodeId, rate = 0.03) {
        const node = this.nodes.get(nodeId);
        if (!node) return;
        node.startDegradation(rate);
        this._emit('node-degrading', { nodeId });
    }

    // Tick simulation
    tick() {
        for (const [, node] of this.nodes) {
            node.tick();
        }
        this._emit('tick', this.getAllTelemetry());
    }

    // Start auto-tick
    start(intervalMs = 1500) {
        if (this._tickInterval) return;
        this._tickInterval = setInterval(() => this.tick(), intervalMs);
        this.tick(); // immediate first tick
    }

    stop() {
        if (this._tickInterval) {
            clearInterval(this._tickInterval);
            this._tickInterval = null;
        }
    }

    // Reset entire mesh to defaults
    resetAll() {
        this.stop();
        this.nodes.clear();
        this.edges = [];
        this.routingTable.clear();
        this._initializeDefaultMesh();
    }

    // Event system
    on(event, callback) {
        if (!this.listeners.has(event)) this.listeners.set(event, []);
        this.listeners.get(event).push(callback);
    }

    _emit(event, data) {
        const cbs = this.listeners.get(event) || [];
        for (const cb of cbs) cb(data);
    }
}
