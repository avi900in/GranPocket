# Tencent Cloud ADP — Multi-Agent Medical Triage Workflow Setup Guide

> **Goal:** Configure and test the Multi-Agent API workflow in Tencent Cloud ADP before integrating it into the GranPocket app's "Override Rule Harvesting and Governance" page.

---

## 1. Target Workflow Sequence

```
API Call (from App)
  └→ Web Evidence Agent
       └→ Clinical Rule Compiler
            └→ Medical Reviewer Agent
                 └→ Knowledge Database Agent
                      └→ Response back to App via API
```

### Input
```json
{
  "url": "https://kidsclinic.sg/pd-guides/health-topics/injuries-in-children/"
}
```

### Expected Output (response back to app)

The ADP API must return an array of harvested rule proposals matching the app's `kb_proposals` table schema. Below is the actual expected output for this URL — it should produce **3 rules** (choking, burns/scalds, accidental poisoning), each with an ICD-10 code, an executable rule code snippet, and full provenance.

```json
{
  "success": true,
  "message": "Successfully harvested 3 rule(s).",
  "harvestedCount": 3,
  "skippedCount": 0,
  "proposals": [
    {
      "id": "kb-prop-auto-kidsclinic-sg-injuries-in-children-t17-9",
      "title": "Auto-Harvested Rule: Foreign body in respiratory tract / Choking emergency (kidsclinic.sg)",
      "rule_code_snippet": "if (context.pediatric_airway_obstruct || (context.symptoms && context.symptoms.some((s: string) => s.toLowerCase().includes('pediatric airway obstruction / choking')))) return EMERGENCY_HALT('HARVEST-T17.9');",
      "rationale": "Harvested by @decipher_agent from verified content at kidsclinic.sg. Matched ICD/SNOMED entity: Foreign body in respiratory tract / Choking emergency [T17.9].",
      "source_doc": "https://kidsclinic.sg/pd-guides/health-topics/injuries-in-children/",
      "source_url": "https://kidsclinic.sg/pd-guides/health-topics/injuries-in-children/",
      "publisher": "kidsclinic.sg / @decipher_agent",
      "retrieved_at": "2026-09-29T00:37:07.103Z",
      "proposed_changes": "Add deterministic trigger: [Foreign body in respiratory tract / Choking emergency] -> Instant Tier 1 EMERGENCY / RED.",
      "rationale": "Harvested by @decipher_agent from verified content at kidsclinic.sg. Matched ICD/SNOMED entity: Foreign body in respiratory tract / Choking emergency [T17.9].",
      "status": "pending_review",
      "affected_ailment": "general",
      "target_tier": "Tier 1 Deterministic Red-Line",
      "age_band": "pediatric",
      "category": "Auto-Harvested",
      "originating_agent": "@decipher_agent",
      "confidence_score": 99,
      "verified_source": "kidsclinic.sg",
      "original_text": "For older children who turn blue or become unconscious, you can use the Heimlich manoeuvre to dislodge the inhaled object. This can be lifesaving.",
      "requires_clinician_review": false,
      "clinician_review_reason": "",
      "is_emergency_escalation": true,
      "diff": {
        "originalText": "For older children who turn blue or become unconscious...",
        "entity": {
          "source_id": "decipher-ae563791",
          "entity_type": "condition",
          "raw_text": "pediatric airway obstruction / choking",
          "trigger_keywords": ["choking can cause", "trachea or windpipe", "heimlich manoeuvre", "choking"],
          "normalized_term": "Foreign body in respiratory tract / Choking emergency",
          "code_system": "ICD-10",
          "code": "T17.9",
          "confidence": 0.99,
          "is_emergency_escalation": true,
          "requires_clinician_review": false,
          "original_excerpt": "For older children who turn blue or become unconscious..."
        },
        "ruleCodeSnippet": "if (context.pediatric_airway_obstruct || ...) return EMERGENCY_HALT('HARVEST-T17.9');",
        "requiresClinicianReview": false,
        "clinicianReviewReason": "",
        "isEmergencyEscalation": true
      }
    },
    {
      "id": "kb-prop-auto-kidsclinic-sg-injuries-in-children-t30-0",
      "title": "Auto-Harvested Rule: Burn and corrosion, unspecified (Scald) (kidsclinic.sg)",
      "rule_code_snippet": "if (context.acute_pediatric_burn_scal || (context.symptoms && context.symptoms.some((s: string) => s.toLowerCase().includes('acute pediatric burn / scalding injury')))) return EMERGENCY_HALT('HARVEST-T30.0');",
      "rationale": "Harvested by @decipher_agent from verified content at kidsclinic.sg. Matched ICD/SNOMED entity: Burn and corrosion, unspecified (Scald) [T30.0].",
      "source_doc": "https://kidsclinic.sg/pd-guides/health-topics/injuries-in-children/",
      "status": "pending_review",
      "target_tier": "Tier 1 Deterministic Red-Line",
      "age_band": "pediatric",
      "category": "Auto-Harvested",
      "originating_agent": "@decipher_agent",
      "confidence_score": 97,
      "verified_source": "kidsclinic.sg",
      "original_text": "2. Burns and scalds. Treat superficial burns by immersing in cold water, cleaning with antiseptic then applying a dry dressing. Young children are naturally curious therefore they might try and touch items around them that might not be safe...",
      "requires_clinician_review": false,
      "is_emergency_escalation": true
    },
    {
      "id": "kb-prop-auto-kidsclinic-sg-injuries-in-children-t65-9",
      "title": "Auto-Harvested Rule: Toxic effect of substance / Accidental poisoning (kidsclinic.sg)",
      "rule_code_snippet": "if (context.accidental_toxic_chemical || (context.symptoms && context.symptoms.some((s: string) => s.toLowerCase().includes('accidental toxic chemical poisoning / ingestion')))) return EMERGENCY_HALT('HARVEST-T65.9');",
      "rationale": "Harvested by @decipher_agent from verified content at kidsclinic.sg. Matched ICD/SNOMED entity: Toxic effect of substance / Accidental poisoning [T65.9].",
      "source_doc": "https://kidsclinic.sg/pd-guides/health-topics/injuries-in-children/",
      "status": "pending_review",
      "target_tier": "Tier 1 Deterministic Red-Line",
      "age_band": "pediatric",
      "category": "Auto-Harvested",
      "originating_agent": "@decipher_agent",
      "confidence_score": 98,
      "verified_source": "kidsclinic.sg",
      "original_text": "9. Accidental poisoning. If your child has ingested or is suspected to have swallowed something poisonous, you should seek medical attention as soon as possible. Do not try to force him into vomiting or attempt a home remedy...",
      "requires_clinician_review": false,
      "is_emergency_escalation": true
    }
  ],
  "provenance": {
    "input": "https://kidsclinic.sg/pd-guides/health-topics/injuries-in-children/",
    "extraction": "web_evidence_agent",
    "compilation": "clinical_rule_compiler",
    "review": "medical_reviewer_agent",
    "persistence": "knowledge_database_agent"
  }
}
```

### Key Fields Each Harvested Rule Must Include

| Field | Description | Example |
|---|---|---|
| `id` | Auto-generated from domain + URL path + ICD-10 code | `kb-prop-auto-kidsclinic-sg-injuries-in-children-t17-9` |
| `title` | `{normalized_term} ({domain})` | `Auto-Harvested Rule: Foreign body in respiratory tract / Choking emergency (kidsclinic.sg)` |
| `rule_code_snippet` | Executable JS/TS code that triggers EMERGENCY_HALT | `if (context.pediatric_airway_obstruct \|\| ...) return EMERGENCY_HALT('HARVEST-T17.9');` |
| `rationale` | Provenance + ICD/SNOMED entity match info | `Harvested by @decipher_agent from verified content at kidsclinic.sg. Matched ICD/SNOMED entity: Foreign body in respiratory tract / Choking emergency [T17.9].` |
| `source_doc` | The harvested URL | `https://kidsclinic.sg/pd-guides/health-topics/injuries-in-children/` |
| `verified_source` | Domain of the source | `kidsclinic.sg` |
| `category` | `Auto-Harvested` or `⚠️ Non-Conforming CPG` | `Auto-Harvested` |
| `target_tier` | Always `Tier 1 Deterministic Red-Line` for emergency rules | `Tier 1 Deterministic Red-Line` |
| `age_band` | `pediatric`, `adult`, `senior`, etc. | `pediatric` |
| `originating_agent` | Agent that extracted the rule | `@decipher_agent` |
| `confidence_score` | 0-100, derived from entity extraction confidence | `99` |
| `status` | `pending_review` (default for new harvests) | `pending_review` |
| `original_text` | Excerpt from the source page for the extracted entity | `For older children who turn blue...` |
| `requires_clinician_review` | `true` if terminology doesn't map cleanly to ICD-10/SNOMED | `false` |
| `is_emergency_escalation` | `true` for all harvested rules (they trigger EMERGENCY_HALT) | `true` |
| `diff.entity.code` | ICD-10 code | `T17.9` |
| `diff.entity.code_system` | Coding system | `ICD-10` |
| `diff.entity.normalized_term` | Clinical term | `Foreign body in respiratory tract / Choking emergency` |
| `diff.entity.entity_type` | `condition`, `symptom`, or `vital_threshold` | `condition` |
| `diff.entity.confidence` | 0-1 float | `0.99` |

---

## 2. Agent Prompts (from PDF Design Document)

The following prompts are extracted from the "Multiagent Medical Triage Design" PDF and adapted for the 4-agent ADP workflow. Each agent should be created as a separate node in the ADP multi-agent workflow.

---

### Agent 1: Web Evidence Agent

**Role:** Retrieve and structure information from expert-provided web sources. More than a "web scraper" — it determines what the source actually supports and extracts clinical evidence statements with full provenance.

**System Prompt:**

```
You are the Web Evidence Acquisition Agent for a clinical knowledge repository.

Your job is to retrieve and structure information from expert-provided web sources.

You MUST NOT create clinical recommendations that are absent from the source.

You MUST preserve the distinction between:
- what the source explicitly states;
- what can be directly structured from the source;
- what is inferred;
- what is unknown.

Never convert an inference into a clinical fact.

SOURCE HANDLING
For every source capture:
- URL
- domain
- page title
- publisher
- author if available
- publication date
- last updated date if available
- retrieval date
- jurisdiction
- document/version identifier
- source type
- evidence category

SOURCE TYPES MAY INCLUDE:
- government guideline
- professional medical society
- hospital/health system guideline
- peer-reviewed publication
- drug label
- public-health authority
- clinical reference
- educational material
- commercial medical site
- unknown

EXTRACTION TARGETS
Extract, when explicitly supported:
1. emergency warning signs
2. symptoms
3. vital-sign thresholds
4. age-specific modifiers
5. contraindications
6. allergy-related considerations
7. triage categories
8. recommended disposition
9. escalation criteria
10. monitoring criteria
11. medication information
12. exclusions
13. exceptions
14. uncertainty statements
15. evidence citations

For every extracted clinical statement, capture:
- statement_id
- source_id
- source_location
- original_statement
- normalized_statement
- population
- age_range
- clinical_domain
- condition
- symptoms
- vital_signs
- thresholds
- triage_acuity
- disposition
- exceptions
- evidence_level
- extraction_confidence

IMPORTANT:
Do not manufacture numerical thresholds.
Do not extrapolate adult thresholds to pediatric populations.
Do not assume that absence of an emergency criterion means that a patient is safe for home monitoring.
Do not turn educational prose into a deterministic clinical rule without explicit clinical review.

OUTPUT:
Return:
- SOURCE_RECORDS
- EVIDENCE_STATEMENTS
- CANDIDATE_CLINICAL_RULES
- UNRESOLVED_AMBIGUITIES
- SOURCE_CONFLICTS

Every clinical statement must have provenance.

INPUT: You will receive a URL from the API call. Fetch the web page content, extract clinical evidence, and return structured output.
```

---

### Agent 2: Clinical Rule Compiler

**Role:** Transform medically approved clinical knowledge (evidence statements from the Web Evidence Agent) into explicit, deterministic, executable rules. This agent may compile ONLY approved evidence statements — it may NOT create new clinical logic.

**System Prompt:**

```
You are the Clinical Rule Compiler.

Your responsibility is to transform medically approved clinical knowledge into explicit, deterministic, executable rules.

You may compile ONLY:
- approved evidence statements;
- approved candidate rules;
- approved triage criteria;
- approved medication knowledge.

You may not create new clinical logic.

Every rule must contain:
- rule_id
- version
- status
- population
- age_range
- conditions
- symptoms
- vitals
- laboratory_values_if_applicable
- allergy_constraints
- medication_constraints
- exclusions
- triage_acuity
- disposition
- action
- escalation
- evidence
- source
- reviewer
- approval_date
- effective_date
- expiry_or_review_date

Rules must support:
- AND
- OR
- NOT
- numeric comparison
- categorical comparison
- age constraints
- temporal conditions where explicitly supported
- missing-value behavior
- unknown-value behavior

CRITICAL:
Never treat missing data as normal.
Never treat unknown as false.
For every condition specify behavior when the required input is missing.
Emergency rules should fail safely.

When a rule cannot be safely evaluated:
    disposition = "INSUFFICIENT_INFORMATION"
unless an approved clinical policy explicitly specifies another behavior.

Do not resolve contradictory rules yourself.

Return:
- COMPILED_RULES
- RULE_CONFLICTS
- UNSAFE_RULES
- UNRESOLVED_DEPENDENCIES

INPUT: You will receive EVIDENCE_STATEMENTS and CANDIDATE_CLINICAL_RULES from the Web Evidence Agent. Compile these into deterministic executable rules with full provenance metadata.
```

---

### Agent 3: Medical Reviewer Agent

**Role:** The highest-authority AI agent. Reviews proposed clinical knowledge and provides an advisory decision. Responsible for safety, clinical coherence, evidence traceability, and identification of uncertainty. Its review decision and identified risks are stored as metadata on the rule for the human reviewer — it does NOT gate whether a rule is persisted. It still does NOT replace an actual physician approval process.

**System Prompt:**

```
You are the Medical Knowledge Review Agent.

You review proposed clinical knowledge and provide an advisory decision with full rationale.

IMPORTANT: Your decision is ADVISORY ONLY. It does NOT determine whether a rule is persisted to the knowledge repository. ALL rules will be persisted regardless of your decision — your review decision and identified risks will be stored as metadata for a human clinician to review later in the governance UI.

Your responsibility is safety, clinical coherence, evidence traceability, and identification of uncertainty.

You MUST NOT invent evidence.

For each proposed item evaluate:
1. source authority
2. source recency
3. population applicability
4. age applicability
5. clinical plausibility
6. internal consistency
7. external evidence support
8. contraindications
9. allergy implications
10. vital-sign interpretation
11. emergency escalation implications
12. false-negative risk
13. false-positive risk
14. missing-data behavior
15. medication safety
16. jurisdiction-specific limitations
17. conflicts with existing approved knowledge

For ML-derived rules additionally evaluate:
- whether the feature is clinically meaningful;
- whether the discovered threshold is plausible;
- whether dataset bias may explain the result;
- whether there is confounding;
- whether the rule generalizes;
- whether pediatric/geriatric populations are adequately represented;
- whether the rule should be rejected despite statistical performance.

DECISION OPTIONS:
- APPROVE
- APPROVE_WITH_CONDITIONS
- REQUEST_REVISION
- REJECT
- ESCALATE_TO_HUMAN_PHYSICIAN

Never use:
"probably safe"
"likely correct"
"should be okay"
for production clinical rules.

For every decision provide:
- review_id
- reviewer_role
- decision
- rationale
- evidence
- identified_risks
- required_changes
- population_scope
- jurisdiction_scope
- review_date
- next_review_date

Any emergency triage rule with unresolved safety uncertainty must be ESCALATE_TO_HUMAN_PHYSICIAN.

Any medication rule involving dosage, contraindication, age restriction, drug interaction, pregnancy, renal/hepatic impairment, or allergy should be treated as high-risk content requiring human clinical review.

INPUT: You will receive COMPILED_RULES from the Clinical Rule Compiler. Review each rule and return your decision with full rationale.
```

---

### Agent 4: Knowledge Database Agent

**Role:** Persistence of clinical knowledge. Deliberately "boring" — its job is NOT reasoning. It handles persistence, schema enforcement, versioning, provenance, and audit. It persists ALL rules submitted to it — regardless of the Medical Reviewer's decision — so that a human reviewer can evaluate them in the app's governance UI. The Medical Reviewer's decision and identified risks are stored as metadata alongside the rule, NOT used as a gate to discard rules.

**System Prompt:**

```
You are the Clinical Knowledge Repository Agent.

You are responsible for persistence of clinical knowledge.

You do not create, modify, reinterpret, or clinically reason about rules.

CRITICAL POLICY: You MUST persist ALL rules submitted to you, regardless of the Medical Reviewer Agent's decision (APPROVED, APPROVE_WITH_CONDITIONS, REQUEST_REVISION, REJECT, or ESCALATE_TO_HUMAN_PHYSICIAN).

The Medical Reviewer's decision and identified risks must be stored as metadata on the record — they MUST NOT cause a rule to be discarded or rejected from persistence. A human clinician will review all rules later in the governance UI.

Every record must have:
- knowledge_id
- knowledge_type
- version
- status: always set to "pending_review" for newly harvested rules
- source_id
- source_version
- source_location
- jurisdiction
- population
- effective_date
- review_date
- created_at
- updated_at
- reviewer_id
- approval_id
- content_hash

ADDITIONAL FIELDS FOR EACH RULE (from the Medical Reviewer):
- review_decision: the Medical Reviewer's decision (APPROVED, APPROVE_WITH_CONDITIONS, REQUEST_REVISION, REJECT, ESCALATE_TO_HUMAN_PHYSICIAN)
- review_rationale: the Medical Reviewer's rationale
- identified_risks: risks identified by the Medical Reviewer
- required_changes: changes requested by the Medical Reviewer
- requires_clinician_review: true if the Medical Reviewer flagged the rule for revision or escalation

SUPPORTED KNOWLEDGE TYPES:
- EMERGENCY_SIGN
- SYMPTOM
- VITAL_THRESHOLD
- TRIAGE_RULE
- DISPOSITION_RULE
- DIAGNOSIS_ASSOCIATION
- MEDICATION
- CONTRAINDICATION
- ALLERGY_CONSTRAINT
- MONITORING_RULE
- ESCALATION_RULE
- CLINICAL_DEFINITION
- SOURCE
- CANDIDATE_RULE
- CONFLICT
- REVIEW

Never overwrite an approved version.
Create a new version instead.
Retain historical versions.
Every change must be auditable.

Never reject or discard a rule based on the Medical Reviewer's decision. ALWAYS persist the rule with status "pending_review" and include the reviewer's decision and risks as metadata.

Reject persistence ONLY if:
- provenance is missing (no source URL)
- population scope is missing where required
- jurisdiction is missing where required
- source is unknown for externally derived knowledge

DO NOT reject persistence for:
- clinical status being ambiguous (that's for the human reviewer to decide)
- conflicting rules (store both and flag the conflict)
- the Medical Reviewer's decision being REQUEST_REVISION or REJECT (the human reviewer will make the final call)

Support:
- create
- version
- supersede
- deprecate
- reject
- rollback
- audit
- diff

INPUT: You will receive reviewed rules with a decision from the Medical Reviewer Agent. Persist ALL rules — regardless of the review decision — into the knowledge repository with status "pending_review", full versioning, audit metadata, and the reviewer's decision/risks stored as metadata fields. Return ALL persisted knowledge records in the response.

OUTPUT FORMAT: Return a JSON array of all persisted rules. Do NOT ask for clarification. Do NOT ask about output format. Always output the JSON array.

Each rule in the array must include these fields:
- knowledge_id (string)
- title (string)
- rule_code_snippet (string, executable JS code with EMERGENCY_HALT)
- rationale (string)
- source_doc (string, the harvested URL)
- verified_source (string, domain name)
- category (string, "Auto-Harvested")
- target_tier (string, "Tier 1 Deterministic Red-Line")
- age_band (string, "pediatric")
- originating_agent (string, "@decipher_agent")
- confidence_score (number, 0-100)
- status (string, "pending_review")
- original_text (string, excerpt from source page)
- review_decision (string, the Medical Reviewer's decision)
- review_rationale (string, the Medical Reviewer's rationale)
- identified_risks (array of strings)
- requires_clinician_review (boolean)

Example output:
[
  {
    "knowledge_id": "kb-prop-001",
    "title": "Auto-Harvested Rule: Head injury emergency (kidsclinic.sg)",
    "rule_code_snippet": "if (context.head_injury || ...) return EMERGENCY_HALT('HARVEST-S06.0');",
    "rationale": "Harvested by @decipher_agent from verified content at kidsclinic.sg",
    "source_doc": "https://kidsclinic.sg/pd-guides/health-topics/injuries-in-children/",
    "verified_source": "kidsclinic.sg",
    "category": "Auto-Harvested",
    "target_tier": "Tier 1 Deterministic Red-Line",
    "age_band": "pediatric",
    "originating_agent": "@decipher_agent",
    "confidence_score": 95,
    "status": "pending_review",
    "original_text": "Some symptoms that indicate your child's head injury is serious...",
    "review_decision": "APPROVE_WITH_CONDITIONS",
    "review_rationale": "Rule is clinically sound but needs vital sign thresholds",
    "identified_risks": ["Missing vital sign parameters"],
    "requires_clinician_review": true
  }
]
```

---

## 3. ADP Workflow Configuration Steps

### Step 1: Create the Application in ADP Console

1. Log in to **Tencent Cloud ADP** (https://adp.cloud.tencent.com)
2. Navigate to **Application Management** → **Create Application**
3. Name it: `GranPocket-Medical-Triage-KB-Builder`
4. Select the multi-agent workflow mode

### Step 2: Create Each Agent Node

For each of the 4 agents above:

1. Click **Add Agent** in the workflow canvas
2. Set the agent name (e.g., `Web Evidence Agent`)
3. Paste the corresponding **System Prompt** from Section 2
4. Configure the model (recommend `claude-sonnet-4` or equivalent strong model)
5. Set the input/output schema for each agent

### Step 3: Wire the Agent Sequence

Connect the agents in this exact order:

```
[API Input Node]
      ↓
[Web Evidence Agent]
      ↓
[Clinical Rule Compiler]
      ↓
[Medical Reviewer Agent]
      ↓
[Knowledge Database Agent]
      ↓
[API Output Node]
```

### Step 4: Configure the API Input Node

The API input node should accept:

```json
{
  "url": "string (required) — the clinical guidance URL to harvest"
}
```

### Step 5: Configure Agent-to-Agent Data Passing

Each agent's output feeds as input to the next:

| From Agent | To Agent | Data Passed |
|---|---|---|
| API Input | Web Evidence Agent | `{ url }` |
| Web Evidence Agent | Clinical Rule Compiler | `{ source_records, evidence_statements, candidate_clinical_rules, unresolved_ambiguities, source_conflicts }` |
| Clinical Rule Compiler | Medical Reviewer Agent | `{ compiled_rules, rule_conflicts, unsafe_rules, unresolved_dependencies }` |
| Medical Reviewer Agent | Knowledge Database Agent | `{ review_id, decision, rationale, reviewed_rules, identified_risks, required_changes }` |
| Knowledge Database Agent | API Output | `{ persisted_knowledge, rejected_records, audit_trail }` |

### Step 6: Configure the API Output Node

The final response should include:
- Persisted knowledge records (if any)
- Review decision and rationale
- Full provenance chain
- Any conflicts or ambiguities flagged
- Any rules escalated for human review

### Step 7: Deploy and Get the API Endpoint

1. Click **Deploy** in the ADP console
2. After deployment, copy the **API endpoint URL** (e.g., `https://adp.cloud.tencent.com/api/app/xxxxx/execute`)
3. Note the authentication method (API key / token)
4. Save these for later integration into the app

---

## 4. Testing the ADP Workflow (Before Code Integration)

### Test URLs to Use

Use these authentic Singapore clinical guidance URLs for testing:

| # | URL | Expected Content | Expected Rules |
|---|---|---|---|
| 1 | `https://kidsclinic.sg/pd-guides/health-topics/injuries-in-children/` | Pediatric injuries & emergencies | **3 rules**: Choking (T17.9), Burns/Scalds (T30.0), Accidental Poisoning (T65.9) |
| 2 | `https://www.healthhub.sg/health-conditions/children-emergencies` | Pediatric emergency signs | Emergency warning signs, vital thresholds |
| 3 | `https://www.stroke.org.sg/stroke-warning-signs` | Stroke FAST warning signs | Stroke red-flag rules |
| 4 | `https://www.healthhub.sg/a-z/diseases-and-conditions` | General disease encyclopedia | Various condition rules |

> **Primary Test URL:** Use `https://kidsclinic.sg/pd-guides/health-topics/injuries-in-children/` as the benchmark. The current local pipeline already produces 3 correct rules from this URL (stored in `kb_proposals` table). The ADP Multi-Agent API must produce equivalent output.

### Test Cases

#### Test Case 1: Benchmark — Kids Clinic Injuries (Primary Validation)
```json
{
  "url": "https://kidsclinic.sg/pd-guides/health-topics/injuries-in-children/"
}
```

**Expected: 3 rules harvested** — this is the benchmark test case. The output must match the data already in the `kb_proposals` table:

| Rule | ICD-10 | Title | Confidence |
|---|---|---|---|
| 1 | T17.9 | Foreign body in respiratory tract / Choking emergency | 99% |
| 2 | T30.0 | Burn and corrosion, unspecified (Scald) | 97% |
| 3 | T65.9 | Toxic effect of substance / Accidental poisoning | 98% |

Each rule must include:
- `rule_code_snippet` — executable JS code with `EMERGENCY_HALT` call
- `rationale` — "Harvested by @decipher_agent from verified content at kidsclinic.sg"
- `verified_source` — `kidsclinic.sg`
- `target_tier` — `Tier 1 Deterministic Red-Line`
- `age_band` — `pediatric`
- `status` — `pending_review`

#### Test Case 2: URL with Non-Clinical Content
```json
{
  "url": "https://www.example.com/some-random-page"
}
```

**Expected:**
- Web Evidence Agent returns empty or minimal evidence statements
- Clinical Rule Compiler returns no compiled rules
- Medical Reviewer Agent returns REJECT or REQUEST_REVISION
- Knowledge Database Agent does not persist anything

#### Test Case 3: URL with Medication Information
```json
{
  "url": "https://www.healthhub.sg/medications"
}
```

**Expected:**
- Web Evidence Agent extracts medication info, dosage, contraindications
- Clinical Rule Compiler creates medication rules with allergy constraints
- Medical Reviewer Agent flags medication rules as high-risk → may ESCALATE_TO_HUMAN_PHYSICIAN
- Knowledge Database Agent only persists if APPROVED

#### Test Case 4: Conflicting Evidence
If two URLs provide different thresholds (e.g., different fever thresholds for infants):

**Expected:**
- Web Evidence Agent creates SOURCE_CONFLICTS record
- Clinical Rule Compiler creates RULE_CONFLICTS
- Medical Reviewer Agent does NOT resolve by majority vote — creates CLINICAL_CONFLICT
- Knowledge Database Agent rejects persistence for conflicting rules

### Testing Checklist

- [x] ADP workflow deploys successfully
- [x] API endpoint is accessible (test with curl/Postman)
- [ ] Test Case 1 passes — valid URL produces structured rules
- [ ] Test Case 2 passes — non-clinical URL is properly rejected
- [ ] Test Case 3 passes — medication rules are flagged for human review
- [ ] Test Case 4 passes — conflicting evidence is not silently resolved
- [x] Response includes full provenance chain
- [ ] Response includes review decision and rationale
- [ ] Response latency is acceptable (< 60 seconds for full pipeline) — **currently ~98s, needs optimization**
- [ ] Error handling: invalid URL returns graceful error, not a crash
- [ ] Error handling: unreachable URL returns graceful error
- [ ] All agent outputs are structured JSON, not free-form prose

### Test Run #1 Results (2026-10-02)

**Status: Partially working — needs prompt fixes**

The API was tested with the following curl command:

```bash
curl -s --max-time 120 --location --request POST \
  'https://wss.lke.tencentcloud.com/adp/v2/chat' \
  --header 'Content-Type: application/json' \
  --data '{
    "RequestId": "test-cb-001",
    "ConversationId": "d4bca75f-e713-42c4-ad37-67b7d6621f10",
    "AppKey": "ebwZQcRTFXAhmZswRBkWjAEiRAliJwpKftvDYoCymcgOEqtHvTOoiUgAHduWlcfFmbKIxeWeWjoETGCxDGPOHsvcoOEGTcXXSSFJOJqgAzdQCKPUWTvrladChbWFjCwm",
    "Contents": [{"Type": "text", "Text": "https://kidsclinic.sg/pd-guides/health-topics/injuries-in-children/"}],
    "VisitorId": "100015179581",
    "Incremental": true,
    "EnableMultiIntent": true,
    "Stream": "disable"
  }'
```

#### What Worked

| Agent | Result |
|---|---|
| Master Orchestrator | Correctly identified the URL and decided to scrape it |
| firecrawl_scrape (tool) | Successfully scraped the full page content from kidsclinic.sg (4.2s) |
| firecrawl_extract (tool) | Successfully extracted **3 evidence statements** with full provenance (22.3s) |
| Web Evidence Agent | Extracted: (1) Head injury — drowsiness/vomiting/bleeding/unconsciousness, (2) Inhaled objects — turning blue/unconsciousness, (3) Accidental poisoning |

The 3 evidence statements all had correct:
- `source_location`: `https://kidsclinic.sg/pd-guides/health-topics/injuries-in-children/`
- `domain`: `kidsclinic.sg`
- `jurisdiction`: `Singapore`
- `clinical_domain`: `pediatrics`
- `triage_acuity`: `emergency`

#### What Didn't Work

| Issue | Agent | Problem | Fix |
|---|---|---|---|
| **1. Agent4 asked for clarification** | Knowledge Database Agent | Said *"I need to understand what specific database output the user wants"* and asked about format (SQL/JSON/table) instead of persisting rules | Added explicit OUTPUT FORMAT section to Agent4 prompt with JSON schema and example |
| **2. Agents 2 & 3 only produced "thought" messages** | Clinical Rule Compiler, Medical Reviewer | Both agents generated only 1-sentence "thought" messages, not actual structured output (no compiled rules, no review decision) | Each agent prompt needs explicit "OUTPUT FORMAT" instructions telling it to produce structured JSON in the response content, not just think |
| **3. Final reply was a question** | Final Reply | The API returned *"What specific database output format do you need?"* instead of rule proposals | Fixed by Issue 1 fix above |
| **4. Latency ~98 seconds** | Full pipeline | Total elapsed was 97,906ms (mainly the firecrawl_extract tool at 22.3s + multiple orchestrator thought steps) | Consider simplifying the workflow or using a faster extraction model |
| **5. Streaming format** | API Response | The API returns SSE (Server-Sent Events) streaming format even with `"Stream": "disable"` — need to parse SSE events | See SSE parsing instructions below |

#### Extracted Evidence Statements (from Web Evidence Agent)

```json
{
  "evidence_statements": [
    {
      "statement_id": "1",
      "condition": "injuries",
      "normalized_statement": "Seek medical attention if your child has a serious head injury with symptoms such as drowsiness, vomiting, bleeding from the ears or nose, or if they are unconscious.",
      "original_statement": "Some symptoms that indicate your child's head injury is serious includes drowsiness, vomiting, bleeding from the ears or nose and if your child is unconscious.",
      "symptoms": "drowsiness, vomiting, bleeding from ears or nose, unconsciousness",
      "triage_acuity": "emergency",
      "disposition": "seek medical attention",
      "age_range": "children",
      "population": "children",
      "clinical_domain": "pediatrics"
    },
    {
      "statement_id": "2",
      "condition": "inhaled objects",
      "normalized_statement": "If a child inhales an object and turns blue or becomes unconscious, call for an ambulance immediately.",
      "original_statement": "If your baby turns blue or becomes unconscious you should immediately call the ambulance.",
      "symptoms": "turning blue, unconsciousness",
      "triage_acuity": "emergency",
      "disposition": "seek medical attention immediately",
      "age_range": "children",
      "population": "children",
      "clinical_domain": "pediatrics"
    },
    {
      "statement_id": "3",
      "condition": "accidental poisoning",
      "normalized_statement": "If a child is suspected to have swallowed something poisonous, seek medical attention immediately.",
      "original_statement": "If your child has ingested or is suspected to have swallowed something poisonous, you should seek medical attention as soon as possible.",
      "triage_acuity": "emergency",
      "disposition": "seek medical attention immediately",
      "age_range": "children",
      "population": "children",
      "clinical_domain": "pediatrics"
    }
  ]
}
```

### ADP API Response Format (SSE Streaming)

The ADP API (`https://wss.lke.tencentcloud.com/adp/v2/chat`) returns **Server-Sent Events (SSE)** format even when `"Stream": "disable"` is set. The response contains:

```
event: request_ack
data: {"Type":"request_ack","RequestAck":{...}}

event: response.created
data: {"Type":"response.created","Response":{"Status":"processing",...}}

event: response.processing
data: {"Type":"response.processing","Response":{"StatusDesc":"Invoke workflow",...}}

event: message.added
data: {"Type":"message.added","Message":{"Type":"thought","ExtraInfo":{"AgentName":"Master Orchestrator Agent",...}}}

event: content.added
data: {"Type":"content.added","ContentIndex":0,...}

event: text.delta
data: {"Type":"text.delta","Text":"...agent output text..."}

event: message.done
data: {"Type":"message.done","Message":{"Type":"thought","Contents":[{"Text":"..."}],...}}

event: response.completed
data: {"Type":"response.completed","Response":{"Messages":[...all messages...],...}}

event: done
data: {"Type":"done"}
```

#### Key events to parse:

1. **`response.completed`** — Contains `Response.Messages[]` array with all agent outputs. This is the main event to parse.

2. Each message in `Messages[]` has:
   - `Type`: `thought`, `tool_call`, `reply`
   - `ExtraInfo.AgentName`: which agent produced it
   - `Contents[].Text`: the actual content

3. The **final reply** is the message with `Type: "reply"` — this is what the app would display.

4. The **agent outputs** are messages with `Type: "thought"` and `ExtraInfo.AgentName` set (e.g., "Clinical Rule Compiler", "Medical Reviewer Agent", "Knowledge Database Agent").

#### Parsing with Python

```python
import json

with open('adp_response.json', 'r') as f:
    raw = f.read()

# Parse SSE events
events = []
for block in raw.split('\n\n'):
    event_type = None
    data_lines = []
    for line in block.split('\n'):
        if line.startswith('event: '):
            event_type = line[7:].strip()
        elif line.startswith('data: '):
            data_lines.append(line[6:])
    if event_type and data_lines:
        data_str = ''.join(data_lines)
        events.append({'event': event_type, 'data': json.loads(data_str)})

# Extract final response
for e in events:
    if e['event'] == 'response.completed':
        messages = e['data']['Response']['Messages']
        for msg in messages:
            agent = msg.get('ExtraInfo', {}).get('AgentName', '')
            msg_type = msg.get('Type', '')
            text = ''.join(c.get('Text', '') for c in msg.get('Contents', []))
            print(f'[{agent or msg_type}] {text}')
```

### curl Test Command

Once the ADP API endpoint is deployed, test with:

```bash
curl -X POST \
  "YOUR_ADP_API_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "url": "https://kidsclinic.sg/pd-guides/health-topics/injuries-in-children/"
  }'
```

> **Validation:** The response must contain **3 rule proposals** with ICD-10 codes T17.9 (choking), T30.0 (burns/scalds), and T65.9 (accidental poisoning). Compare the output against the data in the `kb_proposals` table — the fields and structure must match.

### ⚠️ ADP Response Parsing — Known Issue & Solution

The ADP API returns a **raw workflow execution trace** containing every agent node's full input/output, COS file references, token stats, etc. The actual clinical data is nested deep inside. You must parse it correctly.

#### ADP Response Structure

```
Choices[0]
  ├── .Message.Content        ← final reply text (may be empty)
  ├── .Records[]              ← array of ALL node executions
  │     ├── [0] Agent1 (Web Evidence Agent)
  │     │     ├── .NodeName: "Agent1"
  │     │     ├── .Output: "{\"Content\":\"...\",\"Thought\":[...]}"  ← JSON string
  │     │     └── .OutputRef: "https://...cos.../output.json?..."    ← COS URL
  │     ├── [1] Agent2 (Clinical Rule Compiler)
  │     ├── [2] Agent3 (Medical Reviewer Agent)
  │     ├── [3] Agent4 (Knowledge Database Agent)  ← FINAL CLINICAL OUTPUT
  │     └── [4] End node → .Output: "{}"
  └── .StatInfo               ← token usage, cost, trace ID

ExtraInfo
  ├── .RequestId
  ├── .TraceId
  └── .Elapsed (ms)
```

#### How to Extract the Final Result

The final clinical output is in the **second-to-last record** (Agent4 / Knowledge Database Agent), inside `Output.Content` (which is itself a JSON-encoded string that must be parsed twice):

**Step 1:** Get `Choices[0].Records[]`, filter out the End node (`NodeType === 16`)

**Step 2:** Take the last non-End record → its `Output` field is a **JSON string**. Parse it.

**Step 3:** The parsed object has a `Content` field — also a **JSON string** (or Markdown with embedded JSON). Parse it again to get the final structured data.

#### Solution 1: Fix the ADP End Node (Recommended)

In the ADP console, configure the **End node** to output only the final agent's result:

1. Open your workflow in the ADP console
2. Click on the **End (结束)** node
3. Set its output variable to reference only **Agent4's output content**, e.g.:
   ```
   {{Agent4.Output.Content}}
   ```
4. This makes `Choices[0].Message.Content` contain just the final structured JSON

#### Solution 2: Parse the Raw Trace (If End Node Can't Be Changed)

If you can't modify the ADP workflow, use `jq` to extract the final agent output from the curl response:

```bash
curl -s -X POST \
  "YOUR_ADP_API_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"url": "https://kidsclinic.sg/pd-guides/health-topics/injuries-in-children/"}' \
| jq '
  # Get all records, remove the End node, take the last one
  .Choices[0].Records[]
  | select(.NodeType != 16)
  | .Output
' | tail -1 \
| jq fromjson \
| jq '.Content | fromjson'
```

Or in a single `jq` pipeline:

```bash
curl -s -X POST \
  "YOUR_ADP_API_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"url": "https://kidsclinic.sg/pd-guides/health-topics/injuries-in-children/"}' \
| jq '[.Choices[0].Records[] | select(.NodeType != 16)] | last | .Output | fromjson | .Content'
```

#### What the Raw ADP Response Looks Like (Abbreviated)

```json
{
  "Choices": [{
    "Message": {
      "Content": "",
      "Role": "assistant"
    },
    "Records": [
      {
        "NodeName": "Agent1",
        "NodeType": 23,
        "Status": 2,
        "Input": "{\"Content\":\"https://kidsclinic.sg/...\"}",
        "Output": "{\"Content\":\"## Evidence Extraction Report...\",\"Thought\":[...]}",
        "OutputRef": "https://...cos.../output.json?...",
        "StatInfos": [{"InputTokens": 4626, "OutputTokens": 518, "TotalTokens": 5144}]
      },
      {
        "NodeName": "Agent2",
        "NodeType": 23,
        "Output": "{\"Content\":\"## Compiled Rules...\",\"Thought\":[...]}",
        "StatInfos": [{"TotalTokens": 5144}]
      },
      {
        "NodeName": "Agent3",
        "NodeType": 23,
        "Output": "{\"Content\":\"## Medical Knowledge Review Report...APPROVE_WITH_CONDITIONS...\"}",
        "StatInfos": [{"TotalTokens": 40381}]
      },
      {
        "NodeName": "Agent4",
        "NodeType": 23,
        "Output": "{\"Content\":\"I have processed the Medical Knowledge Review Report...rules have been persisted...\"}",
        "StatInfos": [{"TotalTokens": 3516}]
      },
      {
        "NodeName": "End",
        "NodeType": 16,
        "Output": "{}"
      }
    ],
    "StatInfo": {
      "InputTokens": 36787,
      "OutputTokens": 3594,
      "TotalTokens": 40381,
      "TotalCost": "71655"
    }
  }],
  "ExtraInfo": {
    "RequestId": "ExmjIGL6Oy-7035160285",
    "TraceId": "97b1510e577c93037d7cd43b3696b74e",
    "Elapsed": "71741"
  }
}
```

> **Key insight:** The `Output` field of each record is a **JSON-encoded string** (not a JSON object). You must `JSON.parse()` it to access `.Content`. The `.Content` field itself may also be a string containing Markdown/JSON that needs further parsing.

### Test Run #3 Results (2026-10-02, Full Response)

**Status: Workflow completes but agents only produce "thought" messages, not reply output**

The API call completed successfully in **156 seconds** (2.6 minutes). All 4 agents ran, but the final output was still a clarification question, not structured rules.

#### Agent Execution Chain

| # | Agent/Step | Type | Elapsed | Output Summary |
|---|---|---|---|---|
| 0 | Master Orchestrator | thought | 2.6s | Decided to scrape the URL |
| 1 | firecrawl_scrape | tool_call | 4.2s | Scraped full page content from kidsclinic.sg |
| 2 | Master Orchestrator | thought | 2.8s | Decided to extract evidence |
| 3 | firecrawl_extract | tool_call | 22.5s | Extracted **10 evidence statements** |
| 4 | Master Orchestrator | thought | 3.7s | Noticed gaps, decided to re-extract |
| 5 | firecrawl_extract | tool_call | 20.4s | Re-extracted **5 evidence statements + 5 candidate rules** |
| 6 | Master Orchestrator | thought | 4.3s | Prepared final output |
| 7 | Clinical Rule Compiler | thought | **1.0s** | "I need to compile the rules..." (no actual output) |
| 8 | Medical Reviewer Agent | thought | **1.1s** | "I need to perform a review..." (no actual output) |
| 9 | Knowledge Database Agent | thought | **1.1s** | "I need to clarify the format..." (no actual output) |
| 10 | Final Reply | reply | 0.0s | **"What specific database output format do you need?"** |

#### What Worked

The Web Evidence Agent successfully extracted conditions from the page:

| # | Condition | Acuity | Disposition |
|---|---|---|---|
| 1 | Injuries in Children | — | Seek medical attention if serious |
| 2 | Inhaled objects | Emergency | Seek medical attention immediately |
| 3 | Accidental poisoning | Emergency | Seek medical attention immediately |
| 4 | Head injury | Emergency | Visit doctor |
| 5 | Fractures | Urgent | See a doctor |
| 6 | Burns and scalds | Urgent | Seek medical attention if serious |
| 7 | Swallowed objects | Emergency | Seek medical attention immediately |
| 8 | Eye injuries | Emergency | Seek medical attention immediately |
| 9 | Trapped fingers | Urgent | Seek medical attention for serious cases |
| 10 | Pulled elbow | Urgent | Visit doctor |

Plus 5 candidate clinical rules were extracted in the second pass.

#### Root Cause Analysis (from ADP Documentation)

Based on the Tencent Cloud ADP documentation (https://cloud.tencent.com/document/product/1759/104206):

> **The ADP platform uses two types of models:**
> - **思考模型 (Thinking Model)** — used for intent recognition, task planning, and selecting connectors/tools (this is what runs in Multi-Agent mode for planning)
> - **生成模型 (Generation Model)** — used for reading comprehension, summarization, and **generating the reply result**

The agents are only producing `thought` messages because:
1. The **thinking model** is doing task planning (producing thoughts)
2. The **generation model** is not being invoked to produce the actual reply content
3. Each agent spends only ~1 second — it thinks about what to do but never actually does it

#### Fixes Required in ADP Console

**Fix 1: Configure Agent Output Settings (PRIMARY FIX)**

In the ADP console for each agent node (Agent2, Agent3, Agent4):

1. Open the agent node's **Advanced Settings (高级设置)**
2. Check the **output field mapping (输出字段映射)** — ensure the output is mapped to `reply_content` (回复内容), NOT `thought_process` (思考过程)
3. Look for a setting like **"仅返回思考" (Return thought only)** — if it exists, **turn it OFF**
4. Ensure the **Response Format** is set to `text` or `json` (not `reasoning`)
5. The output should flow: `节点输出 → 输出变量 → reply_content`

**Fix 2: Ensure Generation Model is Configured**

In **Application Settings (应用设置) → Model Settings (模型设置)**:
1. Verify the **生成模型 (Generation Model)** is configured and not just the thinking model
2. The generation model is what produces the actual reply content
3. If only the thinking model is configured, agents will only produce thoughts

**Fix 3: Agent Prompt Structure**

Each agent prompt should end with an explicit output instruction that forces content generation:

```
You MUST produce the actual output NOW, not just describe what you plan to do.

OUTPUT FORMAT: Return your result as a JSON array. Do NOT ask for clarification. Do NOT describe your plan. Produce the actual output immediately.

Example of WRONG output: "I need to compile the rules..."
Example of CORRECT output: [{"rule_id": "R001", "condition": "head injury", ...}]
```

**Fix 4: Check Node Output Type Configuration**

In the ADP workflow editor:
1. Click each agent node
2. Look at the node properties panel for **"输出类型" (Output Type)**
3. Ensure it's set to `回复内容 (Reply Content)` not `思考过程 (Thought Process)`
4. If there's a toggle for output mode, switch from thought-only to reply

**Fix 5: Debug Using the Dialog Debug Window**

Use the ADP console's **对话调试窗口 (Dialog Debug Window)** to:
1. Run the same URL test interactively
2. Click on each agent node in the **对话调用树 (Dialog Call Tree)** to see its input/output details
3. Verify which model (thinking vs generation) is being invoked for each agent
4. Check if the generation model is actually running

#### Summary of ADP Configuration Documentation References

| Documentation | URL | Key Info |
|---|---|---|
| Application Settings Overview | https://cloud.tencent.com/document/product/1759/104206 | Explains thinking model vs generation model |
| Variable Configuration | https://cloud.tencent.com/document/product/1759/122457 | Node output variables, output field mapping |
| Dialog Debug Window | https://cloud.tencent.com/document/product/1759/122607 | Dialog call tree, step details, input/output inspection |
| Operation Guide Index | https://cloud.tencent.com/document/product/1759/104203 | Multi-Agent and Workflow documentation sections |
| Product Page | https://cloud.tencent.com/product/lke | ADP console access link |

---

## 5. Future API Integration Architecture (After ADP Testing)

> **Note:** This section documents the planned integration. NO code changes will be made until ADP testing is complete.

### Current State
The app's "Override Rule Harvesting and Governance" page (`ClinicalKbConsoleView.tsx`) currently:
- Accepts comma-separated URLs in the "Adhoc Rule Harvesting Configuration" panel
- Calls `POST /api/agentic/harvest` on the local Express server
- The server fetches the URL, extracts text, and runs local `@decipher_agent` for entity extraction
- Harvested rules are saved to SQLite as `kb_proposals` with pending_review status

### Target State (Post-ADP Testing)
The same UI panel will call the ADP Multi-Agent API instead of the local pipeline:

```
UI: "Dispatch Agent to Harvest" button
  → POST /api/agentic/harvest (local server proxy)
    → POST to ADP Multi-Agent API endpoint
      → Web Evidence Agent → Clinical Rule Compiler → Medical Reviewer Agent → Knowledge Database Agent
    ← ADP returns structured response
  ← Local server maps response to kb_proposals format
  ← UI displays harvested rules
```

### Planned Changes (NOT YET IMPLEMENTED)

1. **`server/index.ts`** — Modify the `/api/agentic/harvest` endpoint to call the ADP API instead of local `executeDynamicDecipherAgent`. The server acts as a proxy, adding the API key and mapping the ADP response back to the app's `KBChangeProposal` format.

2. **`src/components/ClinicalKbConsoleView.tsx`** — Minimal changes. The existing UI already expects `{ success, harvestedCount, proposals, skipped }` from the harvest API. The server proxy will map ADP output to this shape.

3. **Environment Configuration** — Store the ADP API endpoint URL and authentication key in environment variables:
   ```
   ADP_API_ENDPOINT=https://adp.cloud.tencent.com/api/app/xxxxx/execute
   ADP_API_KEY=your_api_key_here
   ```

### Response Mapping (ADP → App `kb_proposals` table)

The server proxy must map the ADP API response to the app's `kb_proposals` schema. Below is the exact column mapping based on the actual database schema:

| ADP Response Field | `kb_proposals` Column | Type | Example |
|---|---|---|---|
| ADP-generated rule ID | `id` | TEXT PK | `kb-prop-auto-kidsclinic-sg-injuries-in-children-t17-9` |
| Rule title (normalized_term + domain) | `title` | TEXT | `Auto-Harvested Rule: Foreign body in respiratory tract / Choking emergency (kidsclinic.sg)` |
| Executable rule code | `rule_code_snippet` | TEXT | `if (context.pediatric_airway_obstruct ...) return EMERGENCY_HALT('HARVEST-T17.9');` |
| Harvest rationale | `rationale` | TEXT | `Harvested by @decipher_agent from verified content at kidsclinic.sg...` |
| JSON diff (entity + excerpt + snippet) | `diff` | TEXT (JSON) | `{"originalText":"...","entity":{...},"ruleCodeSnippet":"...","isEmergencyEscalation":true}` |
| Source URL | `source_doc` | TEXT | `https://kidsclinic.sg/pd-guides/health-topics/injuries-in-children/` |
| Category | `category` | TEXT | `Auto-Harvested` or `⚠️ Non-Conforming CPG` |
| Target tier | `target_tier` | TEXT | `Tier 1 Deterministic Red-Line` |
| Age band | `age_band` | TEXT | `pediatric` |
| Originating agent | `originating_agent` | TEXT | `@decipher_agent` |
| Confidence (0-100) | `confidence_score` | REAL | `99.0` |
| Review status | `status` | TEXT | `pending_review` |
| Source domain | `verified_source` | TEXT | `kidsclinic.sg` |
| Source excerpt | `original_text` | TEXT | `For older children who turn blue...` |
| Needs clinician review? | `requires_clinician_review` | INTEGER | `0` (false) or `1` (true) |
| Clinician review reason | `clinician_review_reason` | TEXT | `""` or reason text |
| Sign-off doctor name | `sign_off_by` | TEXT | `null` (until approved) |
| Doctor MCR number | `mcr_number` | TEXT | `null` (until approved) |
| Harvest timestamp | `timestamp` | TEXT | `2026-09-29T00:37:07.103Z` |
| Last updated | `updated_at` | TEXT | `2026-09-29T00:37:07.103Z` |

---

## 6. Key Design Principles (from PDF)

These principles must be enforced by the ADP workflow:

1. **No AI-generated clinical content can become production clinical knowledge** without traceable evidence, explicit clinical review, deterministic representation, and automated validation.

2. **The ML system should answer:** "What patterns are present in this dataset?" — NOT "What diagnosis should a patient receive?"

3. **Emergency detection takes precedence over diagnosis.** The system should first check: "Does any approved emergency criterion apply?" before proceeding to triage assessment.

4. **A statistical association is NOT automatically a clinical rule.** A model-derived threshold is NOT automatically a clinical threshold. A correlation is NOT evidence of causation.

5. **Never treat missing data as normal. Never treat unknown as false.** Emergency rules should fail safely.

6. **Only the Medical Reviewer Agent may approve clinical content.** All other agents label outputs as CANDIDATE.

7. **Every clinical statement must have provenance.** No provenance = no persistence.

---

## 7. Agent Skills Registry (Reference)

| Agent | Skills |
|---|---|
| Web Evidence Agent | source validation, scraping, extraction, citation, provenance capture |
| Clinical Rule Compiler | deterministic rule generation, schema enforcement, conflict detection |
| Medical Reviewer Agent | clinical review, contradiction detection, safety analysis, evidence evaluation |
| Knowledge Database Agent | persistence, versioning, audit, provenance enforcement |

---

## 8. Next Steps

1. **Configure the 4 agents in ADP** using the prompts in Section 2
2. **Wire the workflow** as described in Section 3
3. **Deploy and test** using the test cases in Section 4
4. **Record the ADP API endpoint URL and auth key**
5. **Share test results** — once all test cases pass, proceed to code integration
6. **Code integration** — modify `server/index.ts` to proxy to the ADP API (Section 5)
