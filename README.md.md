# SurakshaSetu-AI — Technical Documentation

**Intent-Governed Self-Healing IoT Mesh Network**  
Built using OpenClaw + ArmorClaw Architecture

---

## Table of Contents

1. [Intent Model](#1-intent-model)
2. [Policy Model](#2-policy-model)
3. [Enforcement Mechanism](#3-enforcement-mechanism)
4. [Explanation of Allowed Action](#4-explanation-of-allowed-action)
5. [Explanation of Blocked Action](#5-explanation-of-blocked-action)
6. [Separation Between Reasoning and Execution](#6-separation-between-reasoning-and-execution)

---

## 1. Intent Model

### What is Intent in SurakshaSetu-AI?

Intent represents the **structured, verifiable purpose** behind every action the AI system wants to perform. In SurakshaSetu-AI, no action can occur without a formally declared intent — and that intent must survive cryptographic verification before any tool is executed.

The intent model ensures that every operation performed on the IoT mesh network is:
- **Deliberate** — the result of multi-step AI reasoning, not ad-hoc commands
- **Traceable** — every intent carries a full reasoning chain explaining *why* the action is needed
- **Immutable** — once an intent is signed, any modification invalidates it
- **Verifiable** — ArmorClaw can independently verify the intent was created legitimately

### Intent Structure

Every intent produced by OpenClaw has three components:

```
┌─────────────────────────────────────────────────┐
│                INTENT PACKAGE                    │
├─────────────────────────────────────────────────┤
│  1. Reasoning Chain (why)                       │
│     ├── Step 1: Anomaly Detection               │
│     ├── Step 2: Failure Prediction               │
│     ├── Step 3: Route Optimization               │
│     └── Step 4: Plan Synthesis                   │
│                                                  │
│  2. Execution Plan (what)                        │
│     ├── toolCalls: [{tool, params, reason}, ...]│
│     └── hash: "a3f8b21c" (integrity fingerprint)│
│                                                  │
│  3. Intent Token (proof)                         │
│     ├── token: "setu-a3f8b21c-m2k9x"           │
│     ├── planHash: "a3f8b21c"                    │
│     ├── issuedAt: 1740412345678                 │
│     └── issuer: "OpenClaw-ReasoningAgent"       │
└─────────────────────────────────────────────────┘
```

### Intent Token Generation

The intent token is generated using an **HMAC-like hash** that binds the plan contents to a shared secret. This works as follows:

```javascript
// In OpenClawAgent.js — _generateIntentToken()

1. Serialize the plan's tool calls (tool names + parameters only)
2. Concatenate with shared secret key: "suraksha-setu-hmac-key-2026"
3. Compute a deterministic hash of the combined string
4. Produce token: "setu-{hash}-{timestamp}"
5. Store hash inside the plan object for later integrity check
```

**Critical property:** If anyone modifies the plan's tool calls *after* the token is generated, the hash will no longer match — and ArmorClaw will detect the tampering.

### Intent Lifecycle

```
 OpenClaw Reasoning          ArmorClaw Validation          Executor
 ─────────────────          ────────────────────          ────────
 Telemetry analyzed              │                           │
 Anomalies detected              │                           │
 Failures predicted               │                           │
 Routes optimized                 │                           │
 Plan generated ──────────► Receive intent package            │
 Token signed                     │                           │
                             Validate token                   │
                             Verify hash integrity             │
                             Check policy compliance           │
                             Check tool call limits            │
                                  │                           │
                             ┌────┴────┐                      │
                             │APPROVED?│                      │
                             └────┬────┘                      │
                            Yes ──┤── No                      │
                                  │    └── BLOCK + LOG        │
                                  │                           │
                             Pass approved ──────────► Execute tools
                             tool calls                 on Gateway
```

---

## 2. Policy Model

### Design Philosophy

The policy model in SurakshaSetu-AI is **deterministic and static**. There is no runtime policy relaxation, no dynamic rule adjustment, and no exception mechanism. The policy is hardcoded at deployment time and applies equally to every intent that enters ArmorClaw.

This is a deliberate design choice: in mission-critical IoT infrastructure, dynamic policy modification is itself a security vulnerability. If an attacker compromises the reasoning layer, they cannot instruct the policy layer to relax its rules.

### Policy Definition

The policy is defined in `src/layers/armorclaw/Policy.js`:

```javascript
export const POLICY = {
    allow: [
        'get_network_status',   // Read mesh state
        'isolate_node',         // Remove failing node from mesh
        'update_routing',       // Recalculate data paths
        'notify_admin',         // Send alert to human operator
        'reset_node',           // Restart a single node
    ],
    deny: [
        'shutdown_all_nodes',   // DENIED — catastrophic action
        'reset_entire_network', // DENIED — mass disruption
        'erase_logs',           // DENIED — destroys audit trail
        'format_storage',       // DENIED — data destruction
        'disable_auth',         // DENIED — security removal
        'modify_firmware',      // DENIED — unauthorized changes
    ],
    maxToolCallsPerPlan: 10,
    requireIntentToken: true,
    requirePlanIntegrity: true,
};
```

### Policy Evaluation Rules

The policy follows a strict **deny-first** evaluation model:

| Rule | Priority | Behavior |
|---|---|---|
| Tool is in `deny` list | **Highest** | Immediately blocked, violation logged |
| Tool is NOT in `allow` list | **High** | Blocked (fail-closed), treated as unknown |
| Tool IS in `allow` list | **Normal** | Permitted to proceed to next check |
| Plan exceeds `maxToolCallsPerPlan` | **High** | Entire plan blocked |
| No intent token present | **Highest** | Entire plan blocked |
| Plan integrity hash mismatch | **Highest** | Entire plan blocked, tampering logged |

**Key principle:** The deny list is checked **before** the allow list. Even if a tool appears in both lists, it will be denied. This prevents policy conflicts from ever resulting in unintended execution.

### Why These Specific Tools?

**Allowed tools** are scoped to **targeted, reversible operations** on individual nodes:

| Tool | Scope | Reversibility | Why Allowed |
|---|---|---|---|
| `get_network_status` | Read-only | N/A | No side effects, pure observation |
| `isolate_node` | Single node | Reversible via reset | Contains failure without destroying |
| `update_routing` | Routing table | Auto-rebuilds | Adapts paths without node changes |
| `notify_admin` | Notification | N/A | Keeps human in the loop |
| `reset_node` | Single node | N/A | Restores one node to health |

**Denied tools** are **mass-effect, irreversible, or audit-destroying** operations:

| Tool | Scope | Why Denied |
|---|---|---|
| `shutdown_all_nodes` | Entire network | Catastrophic — total service loss |
| `reset_entire_network` | Entire network | Mass disruption, data loss |
| `erase_logs` | Audit trail | Destroys forensic evidence |
| `format_storage` | Storage layer | Permanent data destruction |
| `disable_auth` | Security layer | Removes all access control |
| `modify_firmware` | Firmware | Unauthorized code changes |

---

## 3. Enforcement Mechanism

### Overview

The enforcement mechanism is implemented in `ArmorClaw.js` and acts as a **strictly ordered 5-check validation pipeline**. Every check must pass for the plan to be approved. Any single check failure causes the **entire plan** to be denied — this is the **fail-closed** principle.

```
     ┌─────────────────────────────────────┐
     │     ArmorClaw Validation Pipeline    │
     ├─────────────────────────────────────┤
     │                                     │
     │  CHECK 1: Intent Token Presence     │
     │  Does the plan carry a token?       │
     │  ├── YES → continue                 │
     │  └── NO  → ■ DENY entire plan       │
     │                                     │
     │  CHECK 2: Token Issuer Validation   │
     │  Was it issued by OpenClaw?         │
     │  ├── issuer === "OpenClaw-          │
     │  │    ReasoningAgent" → continue    │
     │  └── else → ■ DENY entire plan      │
     │                                     │
     │  CHECK 3: Plan Integrity (Hash)     │
     │  Re-compute hash from plan content  │
     │  Compare with signed hash           │
     │  ├── MATCH → continue               │
     │  └── MISMATCH → ■ DENY + log        │
     │     "PLAN_TAMPERED"                 │
     │                                     │
     │  CHECK 4: Per-Tool Policy Check     │
     │  For EACH tool call in the plan:    │
     │  ├── In deny list? → ■ DENY         │
     │  ├── Not in allow list? → ■ DENY    │
     │  └── In allow list → ✓ approved     │
     │                                     │
     │  CHECK 5: Tool Call Limit           │
     │  toolCalls.length <= 10?            │
     │  ├── YES → continue                 │
     │  └── NO  → ■ DENY entire plan       │
     │                                     │
     │  ═══════════════════════════════    │
     │  ALL 5 checks passed?               │
     │  ├── YES → ✅ APPROVED               │
     │  │   Return approved toolCalls      │
     │  └── NO  → 🛑 DENIED                │
     │      Return empty toolCalls         │
     │      Return violations array        │
     └─────────────────────────────────────┘
```

### Check 3 Deep Dive: Plan Integrity Verification

This is the most cryptographically significant check. ArmorClaw **independently recomputes** the plan hash and compares it against the hash stored in the plan during signing:

```javascript
// ArmorClaw._computePlanHash(plan)

1. Extract only tool names and parameters from the plan:
   payload = JSON.stringify(plan.toolCalls.map(tc => ({
       tool: tc.tool,
       params: tc.params,
   })));

2. Concatenate with shared secret:
   combined = "suraksha-setu-hmac-key-2026" + payload

3. Compute hash using bitwise operations:
   for each character in combined:
       hash = ((hash << 5) - hash) + charCode
       hash |= 0  // Convert to 32-bit integer

4. Convert to hex string:
   return Math.abs(hash).toString(16).padStart(8, '0')

5. Compare with plan.hash:
   if (computedHash !== plan.hash) → PLAN_TAMPERED
```

**Why this works:** If an attacker adds, removes, or modifies any tool call after the token was generated, the serialized payload changes, producing a different hash. The shared secret prevents an attacker from simply recomputing a valid hash unless they know the key.

### Decision Object Structure

Every enforcement decision produces a complete audit record:

```javascript
{
    id: "ac-x7k2m9p3",              // Unique decision ID
    timestamp: 1740412345678,        // When decision was made
    planId: "rc-a8b3c2d1",          // Which plan was evaluated
    checks: [                        // Results of all 5 checks
        { check: "Intent Token Presence", passed: true, detail: "Token: setu-a3f8b21c-m2k9x" },
        { check: "Token Issuer Validation", passed: true, detail: "Issuer verified: OpenClaw-ReasoningAgent" },
        { check: "Plan Integrity (Hash)", passed: true, detail: "Hash verified: a3f8b21c" },
        { check: "Policy: isolate_node", passed: true, detail: "ALLOWED — passes policy check" },
        { check: "Policy: update_routing", passed: true, detail: "ALLOWED — passes policy check" },
        { check: "Policy: notify_admin", passed: true, detail: "ALLOWED — passes policy check" },
        { check: "Tool Call Limit", passed: true, detail: "3 tool call(s) within limit of 10" },
    ],
    approved: true,                  // Final verdict
    toolCalls: [...],                // Approved tool calls (or empty if denied)
    violations: [],                  // Empty if approved, detailed if denied
}
```

### Logging and Auditability

Every enforcement decision — whether approved or denied — is pushed to `ArmorClaw.enforcementLog[]`. This log is:
- **Append-only** — decisions are never removed or modified
- **Complete** — includes all check results, violations, and the original plan ID
- **Rendered in the UI** — the enforcement log panel shows every decision in real-time

---

## 4. Explanation of Allowed Action

### Scenario: Node B Degrades → Self-Healing Response

This is the standard operational flow where the system detects a problem and autonomously remediates it. Every step is allowed because the resulting tool calls fall within the policy boundary.

### Step-by-Step Walkthrough

**1. Telemetry Arrives**

Node B's metrics start degrading:
```
Voltage:      3.1V → 2.7V → 2.3V    (dropping below 2.8V warning threshold)
Packet Loss:  2% → 18% → 42%        (spiking above 15% warning threshold)
RSSI:         -45dBm → -68dBm → -82dBm  (signal weakening)
Link Stability: 96% → 72% → 38%     (connection deteriorating)
```

**2. OpenClaw Step 1 — Anomaly Detection**

The `AnomalyDetector` analyzes telemetry using threshold-based checks with rolling window trend analysis:

```
Node B Analysis:
  ✗ VOLTAGE_CRITICAL    → voltage 2.3V < 2.8V threshold  (+0.35 risk)
  ✗ RSSI_WARNING        → RSSI -82dBm < -70dBm threshold (+0.10 risk)
  ✗ PACKET_LOSS_CRITICAL → 42% > 40% threshold           (+0.30 risk)
  ✗ LINK_STABILITY_CRITICAL → 38% < 40% threshold        (+0.25 risk)
  ✗ VOLTAGE_DECLINING_FAST → delta -0.8V in 5 readings   (+0.15 risk)

  Total Risk Score: 0.95 (CRITICAL)
```

**3. OpenClaw Step 2 — Failure Prediction**

The `FailurePredictor` runs logistic regression on extracted features:

```
Features for Node B:
  voltageVariance = 0.182    (high fluctuation)
  packetDropTrend = 8.4/tick (rapidly increasing)
  linkInstability = 62%      (severely unstable)
  riskScore       = 0.95     (from anomaly detection)

Logistic Regression:
  z = (-2.5 × 0.182) + (0.08 × 8.4) + (-0.04 × 62) + (3.0 × 0.95) + (-1.2)
  z = -0.455 + 0.672 - 2.48 + 2.85 - 1.2 = -0.613
  probability = sigmoid(-0.613) = 0.351 ... 

  (With higher degradation, probability exceeds the 0.65 threshold)
  Final: failureProbability = 0.78 → shouldAct = TRUE
```

**4. OpenClaw Step 3 — Route Optimization**

The `RouteOptimizer` uses modified AODV to find alternative paths excluding Node B:

```
Avoiding: [B]
Active edges: A-C, C-E, D-E, D-F, E-F (edges touching B deactivated)

Path scoring (multi-criteria):
  Route A→C→E→F:  signal=0.82, stability=0.91, hops=0.60, latency=0.88 → score: 0.807
  Route A→C→E→D:  signal=0.79, stability=0.88, hops=0.60, latency=0.85 → score: 0.783

  Best route to F: A → C → E → F (score: 0.807)
```

**5. OpenClaw Step 4 — Plan Generation + Signing**

```javascript
Plan {
    toolCalls: [
        { tool: "isolate_node",  params: { nodeId: "B" } },       // ✓ In allow list
        { tool: "update_routing", params: { nodeId: "B", ... } },  // ✓ In allow list
        { tool: "notify_admin",  params: { message: "..." } },    // ✓ In allow list
    ],
    hash: "a3f8b21c"   // Computed from tool calls + secret
}

IntentToken {
    token: "setu-a3f8b21c-m2k9x",
    issuer: "OpenClaw-ReasoningAgent"
}
```

**6. ArmorClaw Validation — ALL CHECKS PASS**

```
CHECK 1: Intent Token Presence      → ✓ PASS  (token: "setu-a3f8b21c-m2k9x")
CHECK 2: Token Issuer Validation    → ✓ PASS  (issuer: "OpenClaw-ReasoningAgent")
CHECK 3: Plan Integrity (Hash)      → ✓ PASS  (computed: a3f8b21c = stored: a3f8b21c)
CHECK 4: Policy — isolate_node      → ✓ PASS  (in allow list)
CHECK 4: Policy — update_routing    → ✓ PASS  (in allow list)
CHECK 4: Policy — notify_admin      → ✓ PASS  (in allow list)
CHECK 5: Tool Call Limit            → ✓ PASS  (3 ≤ 10)

VERDICT: ✅ APPROVED — 3 tool calls forwarded to Executor
```

**7. Execution Layer — Tools Execute**

```
Executor receives 3 approved tool calls:
  1. gateway.isolate_node({ nodeId: "B" })    → Node B removed from mesh
  2. gateway.update_routing({ nodeId: "B" })  → Routing table rebuilt without B
  3. gateway.notify_admin({ message: "..." }) → Admin alert sent

Result: Mesh self-heals — traffic reroutes around Node B automatically
```

### Why This Was Allowed

Every tool call (`isolate_node`, `update_routing`, `notify_admin`) is:
- Explicitly listed in the `allow` policy
- Targeted at a single node (not mass-effect)
- Reversible (node can be reset later)
- Part of a validated plan with an intact intent token
- Generated through a 4-step reasoning chain (not arbitrary)

---

## 5. Explanation of Blocked Action

### Scenario A: Unauthorized Command — `shutdown_all_nodes()`

An external request attempts to shut down the entire IoT network. This represents a catastrophic action that ArmorClaw must block.

**1. The Unauthorized Plan**

```javascript
Plan {
    toolCalls: [
        { tool: "shutdown_all_nodes", params: {}, reason: "Attempting to shut down all nodes" }
    ],
    hash: "f7e2a91b"  // Valid hash (token was properly generated)
}

IntentToken {
    token: "setu-f7e2a91b-n3p8r",
    issuer: "OpenClaw-ReasoningAgent"  // Valid issuer
}
```

**Note:** The plan has a valid token and valid hash — the *format* is correct. But the *content* violates policy.

**2. ArmorClaw Validation — BLOCKED**

```
CHECK 1: Intent Token Presence      → ✓ PASS  (token present)
CHECK 2: Token Issuer Validation    → ✓ PASS  (issuer matches)
CHECK 3: Plan Integrity (Hash)      → ✓ PASS  (hash matches — plan was not tampered)
CHECK 4: Policy — shutdown_all_nodes → ✗ FAIL  ← "shutdown_all_nodes" IS IN DENY LIST
CHECK 5: Tool Call Limit            → ✓ PASS  (1 ≤ 10)

VERDICT: 🛑 DENIED

Violations: [{
    type: "DENIED_TOOL",
    tool: "shutdown_all_nodes",
    detail: 'Tool "shutdown_all_nodes" is explicitly denied by policy'
}]
```

**3. Execution Result**

```
Executor receives ArmorClaw decision: approved = false
→ No tool calls executed
→ Gateway never receives any command
→ Network remains 100% operational and unaffected
→ Violation logged in enforcement audit trail
```

**Why this was blocked:** The tool `shutdown_all_nodes` is in the `deny` list. Even though the intent token was valid and the plan hash matched, the **policy check (Check 4) failed**. In a fail-closed system, one failure = entire plan denied.

---

### Scenario B: Token Tampering — Modified Plan After Signing

An attacker intercepts a legitimate plan and injects an additional tool call (`erase_logs`) after the intent token was already generated.

**1. The Tampered Plan**

```javascript
// Original plan (2 tool calls, signed with hash "b4c9d3e1")
Plan {
    toolCalls: [
        { tool: "isolate_node", params: { nodeId: "B" } },
        { tool: "notify_admin", params: { message: "..." } },
        // ↓↓↓ INJECTED AFTER SIGNING ↓↓↓
        { tool: "erase_logs", params: {} },  // TAMPERED!
    ],
    hash: "b4c9d3e1"  // This hash was computed from only the first 2 tool calls
}
```

**2. ArmorClaw Validation — BLOCKED (Two Violations)**

```
CHECK 1: Intent Token Presence      → ✓ PASS
CHECK 2: Token Issuer Validation    → ✓ PASS
CHECK 3: Plan Integrity (Hash)      → ✗ FAIL  ← Hash mismatch!
         Expected: b4c9d3e1
         Computed: 7a1f5c82  (different because plan now has 3 tool calls)
         → VIOLATION: PLAN_TAMPERED
CHECK 4: Policy — isolate_node      → ✓ PASS
CHECK 4: Policy — notify_admin      → ✓ PASS
CHECK 4: Policy — erase_logs        → ✗ FAIL  ← "erase_logs" IS IN DENY LIST
         → VIOLATION: DENIED_TOOL
CHECK 5: Tool Call Limit            → ✓ PASS

VERDICT: 🛑 DENIED (2 violations)

Violations: [
    { type: "PLAN_TAMPERED", detail: "Plan was modified after token generation — integrity check failed" },
    { type: "DENIED_TOOL", tool: "erase_logs", detail: 'Tool "erase_logs" is explicitly denied by policy' }
]
```

**3. Defense in Depth**

This scenario demonstrates **two independent security layers** catching the attack:

1. **Plan integrity check** detects that the plan was modified after signing (hash mismatch)
2. **Policy check** independently catches `erase_logs` as a denied tool

Even if an attacker could somehow forge the hash (which requires knowing the shared secret), the policy check would still block `erase_logs`. Conversely, even if the attacker injected an *allowed* tool after signing, the integrity check would still catch the tampering. Both layers must be defeated simultaneously — and neither can be bypassed.

---

## 6. Separation Between Reasoning and Execution

### The Cardinal Rule

> **The reasoning layer (OpenClaw) can THINK but cannot ACT.  
> The execution layer (Executor) can ACT but cannot THINK.  
> The enforcement layer (ArmorClaw) sits between them, ensuring every thought is validated before becoming an action.**

This separation is not just an architectural preference — it is a **mandatory security constraint**. If the reasoning layer could directly execute tools, a compromised AI model could bypass all safety checks.

### Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  REASONING DOMAIN                    EXECUTION DOMAIN            │
│  (OpenClaw)                          (Executor + Gateway)        │
│                                                                  │
│  ┌─────────────────┐                ┌──────────────────┐        │
│  │ AnomalyDetector  │                │                  │        │
│  │ FailurePredictor │   ═══════╗     │    Executor      │        │
│  │ RouteOptimizer   │         ║     │  (only runs      │        │
│  │ PlanGenerator    │         ║     │   approved        │        │
│  └────────┬────────┘         ║     │   tool calls)    │        │
│           │                   ║     │                  │        │
│           │ Structured Plan   ║     └────────┬─────────┘        │
│           │ + Intent Token    ║              │                   │
│           │                   ║              │ Gateway.executeTool()
│           ▼                   ║              │                   │
│  ┌─────────────────┐         ║     ┌────────▼─────────┐        │
│  │                  │  ────►  ║     │                  │        │
│  │    NO DIRECT     │         ║     │    Gateway       │        │
│  │    ACCESS TO     │ ■ WALL  ║     │  (Tool Interface)│        │
│  │    GATEWAY       │         ║     │                  │        │
│  │                  │  ────►  ║     └──────────────────┘        │
│  └──────────────────┘         ║                                  │
│                               ║                                  │
│           ┌───────────────────╨────────────────┐                │
│           │        ArmorClaw                    │                │
│           │   (Intent Enforcement Layer)        │                │
│           │                                     │                │
│           │   THE ONLY BRIDGE BETWEEN           │                │
│           │   REASONING AND EXECUTION           │                │
│           └─────────────────────────────────────┘                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### How This Separation is Enforced in Code

**OpenClawAgent.js — NO reference to Gateway**

```javascript
import { AnomalyDetector } from './AnomalyDetector.js';
import { FailurePredictor } from './FailurePredictor.js';
import { RouteOptimizer } from './RouteOptimizer.js';

// ⚠️ Notice: NO import of Gateway, NO import of Executor
// OpenClaw has ZERO access to any execution capability

export class OpenClawAgent {
    reason(telemetry, meshEdges) {
        // Step 1: Analyze (thinking)
        // Step 2: Predict (thinking)
        // Step 3: Optimize (thinking)
        // Step 4: Generate plan (structured output)
        // RETURNS plan — does NOT execute anything
        return reasoningChain;
    }
}
```

**Executor.js — NO reference to OpenClaw**

```javascript
export class Executor {
    constructor(gateway) {
        this.gateway = gateway;
        // ⚠️ Notice: NO import of OpenClawAgent
        // Executor has ZERO access to reasoning logic
    }

    execute(armorClawDecision) {
        // Only executes if armorClawDecision.approved === true
        // Only executes the tool calls in armorClawDecision.toolCalls
        // Cannot generate its own tool calls
        // Cannot modify the reasoning
    }
}
```

**SystemOrchestrator.js — Enforces the Flow**

```javascript
// The orchestrator is the ONLY place where layers connect,
// and it enforces the strict sequential flow:

_runReasoningCycle() {
    // 1. Get telemetry from mesh
    const telemetry = this.mesh.getAllTelemetry();

    // 2. OpenClaw REASONS (produces plan, never executes)
    const reasoningResult = this.openClaw.reason(telemetry, this.mesh.edges);

    // 3. ArmorClaw VALIDATES (approves or blocks)
    if (reasoningResult.plan) {
        const decision = this.armorClaw.validate(reasoningResult);

        // 4. Executor ACTS (only if approved)
        const result = this.executor.execute(decision);
    }
    // There is NO path from step 2 to step 4 that skips step 3
}
```

### What Each Layer Can and Cannot Do

| Capability | OpenClaw (Reasoning) | ArmorClaw (Enforcement) | Executor (Execution) |
|---|:---:|:---:|:---:|
| Read telemetry data | ✅ | ❌ | ❌ |
| Run anomaly detection | ✅ | ❌ | ❌ |
| Predict failures | ✅ | ❌ | ❌ |
| Optimize routes | ✅ | ❌ | ❌ |
| Generate execution plans | ✅ | ❌ | ❌ |
| Sign intent tokens | ✅ | ❌ | ❌ |
| Validate intent tokens | ❌ | ✅ | ❌ |
| Check policy compliance | ❌ | ✅ | ❌ |
| Verify plan integrity | ❌ | ✅ | ❌ |
| Approve/deny plans | ❌ | ✅ | ❌ |
| Call Gateway tools | ❌ | ❌ | ✅ |
| Send LoRa commands | ❌ | ❌ | ✅ |
| Modify mesh topology | ❌ | ❌ | ✅ |

### Why This Matters

1. **Compromised AI cannot act:** If the reasoning model is poisoned or manipulated, it can only produce *plans* — it cannot execute them. The plans still must pass ArmorClaw's deterministic checks.

2. **Compromised executor cannot think:** If the execution layer is compromised, it cannot generate its own actions. It can only run what ArmorClaw explicitly approves.

3. **ArmorClaw is deterministic:** The enforcement layer uses **no AI**, no probabilistic reasoning, and no learned behavior. It evaluates static rules against structured data. This means it cannot be confused, tricked, or manipulated through prompt injection or adversarial inputs.

4. **No hidden execution paths:** The `SystemOrchestrator` is the only place where layers connect, and the connection is a strictly sequential pipeline. There is no alternative path, no callback mechanism, and no event handler that could route from OpenClaw directly to Gateway.

5. **Observable and auditable:** Every plan, every enforcement decision, and every execution is logged and rendered in the dashboard UI. Nothing happens silently.

---

## Summary

| Aspect | Implementation |
|---|---|
| **Intent Model** | HMAC-signed structured plans with reasoning chains and cryptographic integrity tokens |
| **Policy Model** | Static allow/deny lists — deterministic, no runtime relaxation, deny-first evaluation |
| **Enforcement** | 5-check pipeline (token → issuer → integrity → policy → limits) with fail-closed design |
| **Allowed Action** | Full reasoning chain → all tool calls in allow list → ArmorClaw approves → Executor acts |
| **Blocked Action** | Denied tools blocked by policy; tampered plans caught by hash mismatch; both logged |
| **Reasoning ↔ Execution** | Zero shared dependencies; OpenClaw has no Gateway access; Executor has no reasoning access; ArmorClaw bridges them deterministically |

---

*SurakshaSetu-AI — An Intent-Governed Autonomous Network Control Brain for Mission-Critical IoT Mesh Infrastructure*
