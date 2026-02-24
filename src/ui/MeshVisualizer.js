// ─── Mesh Network Canvas Visualizer ───
// Animated canvas-based mesh graph with health-colored nodes

export class MeshVisualizer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.nodes = [];
        this.edges = [];
        this.animFrame = null;
        this.particles = [];
        this.time = 0;

        this._resize();
        window.addEventListener('resize', () => this._resize());
        this._animate();
    }

    _resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = 480 * window.devicePixelRatio;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = '480px';
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        this.width = rect.width;
        this.height = 480;
    }

    update(data) {
        if (!data) return;
        this.nodes = data.nodes || [];
        this.edges = data.edges || [];
    }

    _animate() {
        this.time += 0.02;
        this._draw();
        this.animFrame = requestAnimationFrame(() => this._animate());
    }

    _draw() {
        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;

        ctx.clearRect(0, 0, w, h);

        // Draw grid pattern
        this._drawGrid(ctx, w, h);

        // Draw edges
        for (const edge of this.edges) {
            const fromNode = this.nodes.find(n => n.id === edge.from);
            const toNode = this.nodes.find(n => n.id === edge.to);
            if (!fromNode || !toNode) continue;

            const x1 = fromNode.x * w;
            const y1 = fromNode.y * h;
            const x2 = toNode.x * w;
            const y2 = toNode.y * h;

            if (edge.active) {
                // Active edge — animated data flow
                this._drawActiveEdge(ctx, x1, y1, x2, y2, fromNode, toNode);
            } else {
                // Inactive edge — dashed
                this._drawInactiveEdge(ctx, x1, y1, x2, y2);
            }
        }

        // Draw particles
        this._updateParticles(ctx);

        // Draw nodes
        for (const node of this.nodes) {
            this._drawNode(ctx, node, w, h);
        }
    }

    _drawGrid(ctx, w, h) {
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.04)';
        ctx.lineWidth = 0.5;
        const gridSize = 40;
        for (let x = 0; x < w; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (let y = 0; y < h; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }
    }

    _drawActiveEdge(ctx, x1, y1, x2, y2, fromNode, toNode) {
        const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
        const fromColor = this._getNodeColor(fromNode.status);
        const toColor = this._getNodeColor(toNode.status);
        gradient.addColorStop(0, fromColor + '80');
        gradient.addColorStop(1, toColor + '80');

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Data flow particles
        if (Math.random() < 0.03) {
            this.particles.push({
                x: x1, y: y1,
                tx: x2, ty: y2,
                progress: 0,
                speed: 0.01 + Math.random() * 0.01,
                color: fromColor,
            });
        }
    }

    _drawInactiveEdge(ctx, x1, y1, x2, y2) {
        ctx.beginPath();
        ctx.setLineDash([4, 6]);
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
    }

    _updateParticles(ctx) {
        this.particles = this.particles.filter(p => p.progress < 1);
        for (const p of this.particles) {
            p.progress += p.speed;
            const x = p.x + (p.tx - p.x) * p.progress;
            const y = p.y + (p.ty - p.y) * p.progress;

            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();

            // Glow
            const glow = ctx.createRadialGradient(x, y, 0, x, y, 8);
            glow.addColorStop(0, p.color + '60');
            glow.addColorStop(1, 'transparent');
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, Math.PI * 2);
            ctx.fillStyle = glow;
            ctx.fill();
        }
    }

    _drawNode(ctx, node, w, h) {
        const x = node.x * w;
        const y = node.y * h;
        const radius = 24;
        const color = this._getNodeColor(node.status);

        // Outer glow
        const glowRadius = radius + 12 + Math.sin(this.time * 2 + node.x * 10) * 4;
        const glow = ctx.createRadialGradient(x, y, radius, x, y, glowRadius);
        glow.addColorStop(0, color + '30');
        glow.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        // Node circle
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        const bg = ctx.createRadialGradient(x - 4, y - 4, 0, x, y, radius);
        bg.addColorStop(0, color + 'cc');
        bg.addColorStop(1, color + '88');
        ctx.fillStyle = bg;
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Risk ring (if has risk)
        if (node.riskScore > 0.3 && node.status !== 'isolated' && node.status !== 'failed') {
            const riskAngle = node.riskScore * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(x, y, radius + 5, -Math.PI / 2, -Math.PI / 2 + riskAngle);
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        // Label
        ctx.fillStyle = '#f1f5f9';
        ctx.font = '600 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.id, x, y);

        // Status label below
        ctx.font = '500 9px "JetBrains Mono", monospace';
        ctx.fillStyle = color;
        ctx.fillText(node.status.toUpperCase(), x, y + radius + 14);

        // Failure probability (if > 0)
        if (node.failureProbability > 0.1 && node.status !== 'failed' && node.status !== 'isolated') {
            ctx.font = '600 9px "JetBrains Mono", monospace';
            ctx.fillStyle = node.failureProbability > 0.6 ? '#ef4444' : '#f59e0b';
            ctx.fillText(`${(node.failureProbability * 100).toFixed(0)}%`, x, y - radius - 10);
        }
    }

    _getNodeColor(status) {
        switch (status) {
            case 'healthy': return '#10b981';
            case 'degrading': return '#f59e0b';
            case 'failed': return '#ef4444';
            case 'isolated': return '#64748b';
            default: return '#6366f1';
        }
    }

    destroy() {
        if (this.animFrame) cancelAnimationFrame(this.animFrame);
    }
}
