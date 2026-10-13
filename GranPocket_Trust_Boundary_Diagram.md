# GranPocket Trust Boundary & Threat Architecture

> **Direct Downloads**:
> - 📄 **PDF Document**: [GranPocket_Trust_Boundary_Diagram.pdf](file:///Users/avijit/Documents/Avi/AI/Tencent%20Hackathon/CodeBuddy/GranPocket-Agenticv5_ADP/GranPocket_Trust_Boundary_Diagram.pdf)
> - 🖼️ **High-Res PNG**: [GranPocket_Trust_Boundary_Diagram.png](file:///Users/avijit/Documents/Avi/AI/Tencent%20Hackathon/CodeBuddy/GranPocket-Agenticv5_ADP/GranPocket_Trust_Boundary_Diagram.png)
> - 📐 **Vector SVG**: [GranPocket_Trust_Boundary_Diagram.svg](file:///Users/avijit/Documents/Avi/AI/Tencent%20Hackathon/CodeBuddy/GranPocket-Agenticv5_ADP/GranPocket_Trust_Boundary_Diagram.svg)

---

## Architecture Diagram (Rendered)

![GranPocket Trust Boundary Diagram](file:///Users/avijit/Documents/Avi/AI/Tencent%20Hackathon/CodeBuddy/GranPocket-Agenticv5_ADP/GranPocket_Trust_Boundary_Diagram.png)

---

## Mermaid Source Specification

```mermaid
flowchart TD
    classDef client fill:#FEE2E2,stroke:#EF4444,stroke-width:2px,color:#7F1D1D;
    classDef edge fill:#FEF3C7,stroke:#F59E0B,stroke-width:2px,color:#78350F;
    classDef app fill:#DBEAFE,stroke:#3B82F6,stroke-width:2px,color:#1E3A8A;
    classDef agent fill:#EDE9FE,stroke:#8B5CF6,stroke-width:2px,color:#4C1D95;
    classDef storage fill:#DCFCE7,stroke:#10B981,stroke-width:2px,color:#064E3B;
    classDef external fill:#F1F5F9,stroke:#64748B,stroke-width:2px,color:#0F172A;

    subgraph TB0 [" Boundary 0: Client Perimeter (Browser / React SPA) "]
        ClientApp["React SPA with LocalStorage State\nClient-side RBAC and PDPA Consent Modal\nForm Inputs, Audio Recording, Photo Upload"]:::client
    end

    subgraph TB1 [" Boundary 1: Network Ingress and Edge Gateway "]
        RailwayEdge["Railway Edge Proxy\nTLS 1.3 HTTPS Termination Port 443\nSingle-Origin Reverse Proxy to Node Server"]:::edge
    end

    subgraph TB2 [" Boundary 2: Application Execution Tier (Express.js) "]
        ExpressServer["Express.js Server (Port 3000 / $PORT)\nBody Parsers (50mb JSON/URLEncoded)\nStatic SPA File Server (dist/index.html)"]:::app
        TriageModule["Deterministic Triage Engine\nEmergency Keyword Net (SCDF 995 Escalation)\n1024-D Vector Semantic Search Engine"]:::app
        AuditModule["Audit and Compliance Service\nSHA-256 Hashing on Audit Events\nPDPA De-identification Toggle"]:::app
    end

    subgraph TB3 [" Boundary 3: Agentic Reasoning Enclave "]
        AgentSDK["Tencent Agent SDK Integration\nIn-Memory Tool Permissions (5-Min Timeout)\nAgent Swarm Session Manager"]:::agent
        SwarmHarvest["Rule Harvesting Swarm\nProposals and CPG Clinical Extraction"]:::agent
    end

    subgraph TB4 [" Boundary 4: Data Persistence Tier (Mounted Volume) "]
        SqliteDB[("better-sqlite3 Database\nRailway Persistent Mount: /data/chat.db\nWAL Journal Mode Enabled\nHouseholds, KB, Rules, Audit Events")]:::storage
    end

    subgraph TB5 [" Boundary 5: External Cloud & Upstream APIs "]
        TencentCloud["Tencent Agent / Hunyuan Platform\nExternal LLM & Agent Execution"]:::external
        TwilioAPI["Twilio REST API\nDirect SMS Dispatch for Emergency SOS"]:::external
        GovAPIs["Singapore Government APIs\nNEA Air Quality, PSI, Dengue Clusters\nOneMap Geolocation & SLA Routing"]:::external
    end

    %% Communication Flows (As Actually Implemented)
    ClientApp -->|"1. HTTPS Requests: JSON / FormData / Audio"| RailwayEdge
    RailwayEdge -->|"2. Forward to Node Process on Container Port"| ExpressServer

    ExpressServer -->|"3. Static Files (GET /) or Direct API Routes"| ExpressServer
    ExpressServer -->|"4. Execute Triage & Vector Matching"| TriageModule
    ExpressServer -->|"5. Log Access and PDPA Events"| AuditModule

    TriageModule -->|"6. Query Ailments, CPG Rules, and Profiles"| SqliteDB
    AuditModule -->|"7. Insert SHA-256 Hashed Audit Rows"| SqliteDB

    ExpressServer -->|"8. Trigger Swarm Harvesting / Agent Execution"| AgentSDK
    AgentSDK -->|"9. Dispatch Swarm Tasks"| SwarmHarvest
    AgentSDK <-->|"10. Outbound HTTPS over TLS with Bearer Token"| TencentCloud

    ExpressServer -.->|"11. POST /api/send-sms via Account SID and Token"| TwilioAPI
    ExpressServer -.->|"12. Server-side fetch to data.gov.sg & NEA"| GovAPIs
```

---

## Trust Boundary Definition Matrix: Implemented vs. Future Controls

| Boundary Zone | Components Included | Security Level | Currently Implemented in Codebase | Future Planned Controls (Roadmap) |
| :--- | :--- | :--- | :--- | :--- |
| **Boundary 0: Client Perimeter** | Web browsers, Mobile PWAs, End Users, Clinic Admins | **Zero Trust (Untrusted)** | • Client-side input validation and payload structuring<br/>• Frontend RBAC screen filtering (`defaultRbac.ts`)<br/>• Session persistence via browser `localStorage`<br/>• Mandatory PDPA consent modal upon household signup (`CreateHouseholdModal.tsx`) | • Enforced idle session timeout (auto-logout after 15–30 mins)<br/>• Client-side CSRF tokens or HttpOnly secure cookies<br/>• Client-side payload encryption for uploaded photos/audio |
| **Boundary 1: Network Ingress & Edge** | Edge Reverse Proxy, Railway Ingress, Vite Static Server | **Perimeter Control** | • TLS 1.3 encryption on transit (enforced at Railway edge)<br/>• Express JSON body parsing with payload cap (`50mb` limit)<br/>• Static assets and API consolidated onto single origin to minimize CORS exposure | • Explicit CORS origin allowlisting (locking mutating endpoints to trusted domain)<br/>• Web Application Firewall (WAF) & IP rate-limiting middleware (`express-rate-limit`)<br/>• Security headers via `helmet.js` (HSTS, CSP, X-Frame-Options) |
| **Boundary 2: Application Compute** | Node.js Express Server, Deterministic Triage Engine | **Trusted Zone** | • Deterministic safety-first triage rule evaluation before AI delegation<br/>• Explicit CareLink relationship checks (caregiver vs. dependent)<br/>• SHA-256 hash generation for immutable audit events (`server/db.ts`)<br/>• PII de-identification flag and prompt sanitization logic (`AppOwnerPortalView.tsx`) | • Server-side JWT / session validation middleware on all `/api/db/*` routes<br/>• Strict role-based authorization verification directly in Express request handlers<br/>• Automated regex/NLP PII detection middleware before any downstream processing |
| **Boundary 3: AI Reasoning Enclave** | Tencent Agent SDK, Agent Swarms (`@decipher`, `@extractor`), Guardrails | **Restricted / Sandboxed** | • In-memory tool execution timeout (`PERMISSION_TIMEOUT = 5 mins`)<br/>• Sandboxed agent sessions via `unstable_v2_createSession`<br/>• Explicit tool permission resolution gate (`pendingPermissions.set`)<br/>• Pre-commit clinical rule validation before persisting proposals | • Isolated container / WebWorker execution for custom agent scripts<br/>• Differential privacy / k-anonymity scoring on harvested clinical knowledge<br/>• Real-time adversarial prompt injection detection filter |
| **Boundary 4: Persistent Storage** | Railway Mount `/data/chat.db`, SQLite WAL files, Audit Logs | **Confidential / High Trust** | • Isolated container filesystem with volume mounting (`/data/chat.db`)<br/>• WAL mode enabled (`PRAGMA journal_mode = WAL`) for ACID durability<br/>• Tamper-evident audit table (`audit_events`) logging actions and regimes<br/>• Database seeding verification on first mount (`server/db.ts`) | • At-rest database encryption via SQLCipher / envelope encryption<br/>• Cryptographic merkle tree / hash-chain verification for audit log entries<br/>• Automated scheduled off-site encrypted volume snapshots |
| **Boundary 5: External Upstream Providers** | Tencent Hunyuan API, Twilio SMS, SG MOH / OneMap APIs | **Third-Party Boundary** | • Server-to-server outbound TLS 1.3 communication<br/>• API secrets isolated in server environment variables (`.env` / Railway Env)<br/>• Zero personal identifiers forwarded to external weather/health APIs (OneMap, NEA) | • Outbound egress proxy and network egress allowlisting<br/>• Automated secret rotation and KMS integration for Twilio and Tencent API keys<br/>• Cryptographic payload signing for third-party webhook verification |
