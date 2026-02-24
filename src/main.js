// ─── Main Entry Point ───
import './styles/index.css';
import { SystemOrchestrator } from './orchestrator/SystemOrchestrator.js';
import { Dashboard } from './ui/Dashboard.js';

// Initialize system
const orchestrator = new SystemOrchestrator();
const dashboard = new Dashboard(orchestrator);

// Start the simulation
orchestrator.start();

// Expose for debugging
window.__suraksha = { orchestrator, dashboard };
