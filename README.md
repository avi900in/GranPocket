# GranPocket — Agentic Healthcare Triage System

**GranPocket** is an enterprise-grade agent-based clinical triage and healthcare decision-support platform built on Tencent CodeBuddy Agent SDK, React 18, TDesign, Express, and SQLite.

---

##  Key Architecture & Capabilities

1. **Deterministic Red-Line Safety Engine**:
   - Hardcoded, non-LLM safety checks execute first to catch red-flag conditions (e.g., severe chest pain, stroke FAST indicators, anaphylaxis).
   - Life-critical emergencies trigger immediate escalations and 911 / emergency dispatch protocols without relying solely on LLMs.

2. **Agentic Multi-Role Triaging Pipeline**:
   - **Triage Agent**: Collects patient symptoms, vital signs, demographic profiles, and medical history to formulate preliminary triage levels (ESI 1-5).
   - **Expert Clinical Doctor Agent**: Evaluates, attests, or challenges triage suggestions with clinical reasoning.
   - **Decipher & Knowledge Agent**: Parses medical records, lab tests, and clinical literature.
   - **Human-in-the-Loop Gateway**: Clinicians review and sign off on knowledge base proposals before ingestion into production.

3. **Role-Based Portals & Dashboards**:
   - **Household / Patient View**: Intuitive interface for reporting symptoms, medication tracking, and reviewing recommendations.
   - **Caregiver / Family View**: Monitoring plans, critical alerts, and emergency contacts.
   - **Owner / Administrator Portal**: Complete RBAC control, clinical rule configuration, facility routing, and audit execution logs.

4. **Facility & Provider Routing**:
   - Integrated geospatial directory and mapping (Leaflet) for acute care centers, urgent care clinics, and specialized hospitals.

---

##  Technology Stack

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, TDesign React UI, Lucide Icons, Leaflet
- **Backend**: Node.js, Express, TypeScript, TSX, Better-SQLite3
- **AI / Agentic Engine**: Tencent CodeBuddy Agent SDK (`@tencent-ai/agent-sdk`)
- **Database**: SQLite (`data/chat.db`) with tables for households, members, triage rules, KB proposals, medications, facilities, and audit events.

---

##  Getting Started

### 1. Prerequisites

- Node.js 18+
- npm or yarn

### 2. Installation

```bash
npm install
```

### 3. Development Server

Run both frontend and backend concurrently:

```bash
npm run dev
```

- **Frontend**: [http://localhost:5174](http://localhost:5174)
- **Backend API**: [http://localhost:3001](http://localhost:3001)

### 4. Production Build

```bash
npm run build
```

---

## 📁 Repository Structure

```
├── server/
│   ├── index.ts              # Express API & Server-Sent Events (SSE) streaming
│   ├── db.ts                 # SQLite schema & database queries
│   └── dynamicAgents.ts      # Multi-agent orchestrator & dynamic agent configurations
├── src/
│   ├── components/           # UI components (triage cards, map, vitals, alerts)
│   ├── pages/                # Role portals (Patient, Caregiver, Owner, Admin)
│   ├── types.ts              # System TypeScript definitions
│   └── App.tsx               # Client routes and layout
├── data/
│   └── chat.db               # SQLite database with pre-configured rules & facilities
├── ADP_MultiAgent_Workflow_Setup.md     # Agentic workflow specifications
└── Requirements Specs-Granpocket Agentic.md  # Detailed requirements
```

---

## 🔒 Security & Safety Protocol

GranPocket enforces the principle: **Deterministic code owns emergencies, LLMs assist reasoning, humans authorize critical knowledge updates.** Every clinical rule and agent recommendation is recorded with audit logs for full traceability.
