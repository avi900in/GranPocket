/**
 * GranPocket Persistent SQLite Database & Dynamic Multi-Agent Service
 * Connects frontend components to the backend SQLite DB and dynamic LLM agents.
 */

import type { TriageRule, KBChangeProposal, Person, HospitalFacility } from '../types';

export interface DatabaseStats {
  triage_rules: number;
  kb_proposals: number;
  households: number;
  persons: number;
  facilities: number;
  clinical_guardrails: number;
  triage_execution_logs: number;
  medication_logs: number;
  monitoring_plans: number;
  audit_events: number;
  sessions: number;
  messages: number;
  role_permissions: number;
  member_roles: number;
}

export interface GuardrailSettings {
  confidenceFloorPercent: number;
  enableAllergyHardStop: boolean;
  enableAgeHardStop: boolean;
  freshnessWindowDays: number;
  maxChallengeRetries: number;
  updatedAt?: string;
}

// 1. Fetch DB Stats
export async function getDatabaseStats(): Promise<DatabaseStats | null> {
  try {
    const res = await fetch('/api/db/stats');
    if (!res.ok) return null;
    const json = await res.json();
    return json.stats;
  } catch (err) {
    console.warn('[dbService] Failed to fetch db stats:', err);
    return null;
  }
}

// 2. Fetch Rules from SQLite
export async function fetchRulesFromDb(): Promise<TriageRule[]> {
  try {
    const res = await fetch('/api/db/rules');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    return json.rules || [];
  } catch (err) {
    console.warn('[dbService] Error fetching rules from DB:', err);
    return [];
  }
}

// 3. Save / Update Rule in SQLite
export async function saveRuleToDb(rule: TriageRule): Promise<boolean> {
  try {
    const res = await fetch('/api/db/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    });
    return res.ok;
  } catch (err) {
    console.error('[dbService] Error saving rule to DB:', err);
    return false;
  }
}

// 4. Delete Rule from SQLite
export async function deleteRuleFromDb(ruleId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/db/rules/${encodeURIComponent(ruleId)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (err) {
    console.error('[dbService] Error deleting rule from DB:', err);
    return false;
  }
}

// 5. Fetch KB Proposals from SQLite
export async function fetchProposalsFromDb(): Promise<KBChangeProposal[]> {
  try {
    const res = await fetch('/api/db/proposals');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    return json.proposals || [];
  } catch (err) {
    console.warn('[dbService] Error fetching proposals from DB:', err);
    return [];
  }
}

// 6. Update Proposal Status with SMC Sign-Off in SQLite
export async function updateProposalStatusInDb(
  id: string,
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'pending_review' | 'approved' | 'rejected',
  signOffBy?: string,
  mcrNumber?: string
): Promise<boolean> {
  try {
    const res = await fetch(`/api/db/proposals/${encodeURIComponent(id)}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, signOffBy, mcrNumber }),
    });
    return res.ok;
  } catch (err) {
    console.error('[dbService] Error updating proposal status in DB:', err);
    return false;
  }
}

// 7. Fetch Patients (Persons) from SQLite
export async function fetchPersonsFromDb(): Promise<Person[]> {
  try {
    const res = await fetch('/api/db/persons');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    return json.persons || [];
  } catch (err) {
    console.warn('[dbService] Error fetching persons from DB:', err);
    return [];
  }
}


// 8. Fetch Guardrail Config from SQLite
export async function fetchGuardrailsFromDb(): Promise<GuardrailSettings | null> {
  try {
    const res = await fetch('/api/db/guardrails');
    if (!res.ok) return null;
    const json = await res.json();
    return json.guardrails;
  } catch (err) {
    console.warn('[dbService] Error fetching guardrails from DB:', err);
    return null;
  }
}

// 9. Update Guardrail Config in SQLite
export async function updateGuardrailsInDb(updates: Partial<GuardrailSettings>): Promise<boolean> {
  try {
    const res = await fetch('/api/db/guardrails', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return res.ok;
  } catch (err) {
    console.error('[dbService] Error updating guardrails in DB:', err);
    return false;
  }
}

// 10. Execute Dynamic LLM Multi-Agent Pipeline via Backend Engine
export async function executeDynamicMultiAgentPipeline(input: {
  text?: string;
  answers?: Record<string, any>;
  person: Person;
  language?: string;
  sessionId?: string;
  config?: Partial<GuardrailSettings>;
}) {
  const res = await fetch('/api/agentic/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`Agentic pipeline failed: ${res.statusText}`);
  }
  const json = await res.json();
  return json.result;
}

// 11. Customer Feedback API
export interface CustomerFeedback {
  id: string;
  householdId?: string;
  householdName?: string;
  memberName: string;
  category: string;
  rating: number;
  comments: string;
  createdAt: string;
}

export async function fetchCustomerFeedback(): Promise<CustomerFeedback[]> {
  try {
    const res = await fetch('/api/feedback');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    return json.feedback || [];
  } catch (err) {
    console.warn('[dbService] Error fetching customer feedback:', err);
    return [];
  }
}

export async function submitCustomerFeedback(feedback: Omit<CustomerFeedback, 'id' | 'createdAt'>): Promise<{ success: boolean; feedback?: CustomerFeedback; error?: string }> {
  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(feedback),
    });
    const json = await res.json();
    return json;
  } catch (err: any) {
    console.error('[dbService] Error submitting customer feedback:', err);
    return { success: false, error: err.message };
  }
}

// 12. Key System Statistics & Metrics API
export interface AgentStatusInfo {
  id: string;
  name: string;
  badge: string;
  role: string;
  model: string;
  status: 'ONLINE' | 'READY' | 'DEGRADED';
  latency: string;
  successRate: string;
  health: string;
  totalCalls: number;
  lastActive: string;
}

export interface KeySystemStatistics {
  registeredFamiliesCount: number;
  triageInvocationsCount: number;
  conflictDetectionsCount: number;
  agentStatuses: AgentStatusInfo[];
  totalFeedbacks: number;
  averageRating: string;
  feedbacks: CustomerFeedback[];
}

export async function fetchKeyStatistics(): Promise<KeySystemStatistics | null> {
  try {
    const res = await fetch('/api/statistics');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    return json.stats;
  } catch (err) {
    console.warn('[dbService] Error fetching key statistics:', err);
    return null;
  }
}

// 13. Caregiver Scheduler Alert Interfaces & APIs
export interface CaregiverAlertEntry {
  id: string;
  jobId?: string;
  type: 'MEDICINE_DUE' | 'MONITORING_UPDATE_DUE';
  patientId?: string;
  patientName: string;
  caregiverId?: string;
  caregiverName: string;
  caregiverRole?: string;
  caregiverPhone?: string;
  title: string;
  message: string;
  severity: string;
  channels: string[];
  status: 'DISPATCHED' | 'ACKNOWLEDGED' | 'COMPLETED';
  createdAt: string;
  acknowledgedAt?: string;
}

export async function fetchCaregiverAlerts(): Promise<CaregiverAlertEntry[]> {
  try {
    const res = await fetch('/api/scheduler/alerts');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    return json.alerts || [];
  } catch (err) {
    console.warn('[dbService] Error fetching caregiver alerts:', err);
    return [];
  }
}

export async function saveCaregiverAlertToDb(alert: Partial<CaregiverAlertEntry>): Promise<boolean> {
  try {
    const res = await fetch('/api/scheduler/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alert),
    });
    return res.ok;
  } catch (err) {
    console.error('[dbService] Error saving caregiver alert to DB:', err);
    return false;
  }
}

export async function acknowledgeCaregiverAlertInDb(alertId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/scheduler/alerts/${encodeURIComponent(alertId)}/ack`, {
      method: 'PUT',
    });
    return res.ok;
  } catch (err) {
    console.error('[dbService] Error acknowledging alert in DB:', err);
    return false;
  }
}

// 14. Save Person & Resolve Ailment APIs
export async function savePersonToDb(person: Person): Promise<boolean> {
  try {
    const res = await fetch('/api/db/persons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(person),
    });
    return res.ok;
  } catch (err) {
    console.error('[dbService] Error saving person to DB:', err);
    return false;
  }
}

export async function resolvePersonAilmentInDb(personId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/persons/${encodeURIComponent(personId)}/resolve-ailment`, {
      method: 'POST',
    });
    return res.ok;
  } catch (err) {
    console.error('[dbService] Error resolving person ailment in DB:', err);
    return false;
  }
}

export async function saveTriageAssessmentToDb(assessment: any): Promise<boolean> {
  try {
    const res = await fetch('/api/db/triage-assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assessment),
    });
    return res.ok;
  } catch (err) {
    console.error('[dbService] Error saving triage assessment to DB:', err);
    return false;
  }
}

// 15. Home & First-Aid Medication APIs
export async function fetchHomeMedicationsFromDb(): Promise<import('../types').HomeMedicationSuggestion[]> {
  try {
    const res = await fetch('/api/agentic/medications/home');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    return json.medications || [];
  } catch (err) {
    console.warn('[dbService] Error fetching home medications from DB:', err);
    return [];
  }
}

export async function approveHomeMedicationInDb(id: string, doctorName: string, mcrNumber: string): Promise<boolean> {
  try {
    const res = await fetch('/api/agentic/medications/home/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, doctorName, mcrNumber }),
    });
    return res.ok;
  } catch (err) {
    console.error('[dbService] Error approving home medication in DB:', err);
    return false;
  }
}

export async function rejectHomeMedicationInDb(id: string, doctorName?: string, mcrNumber?: string): Promise<boolean> {
  try {
    const res = await fetch('/api/agentic/medications/home/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, doctorName, mcrNumber }),
    });
    return res.ok;
  } catch (err) {
    console.error('[dbService] Error rejecting home medication in DB:', err);
    return false;
  }
}

export async function moveHomeMedicationToPendingInDb(id: string): Promise<boolean> {
  try {
    const res = await fetch('/api/agentic/medications/home/pending', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    return res.ok;
  } catch (err) {
    console.error('[dbService] Error moving home medication to pending in DB:', err);
    return false;
  }
}

export async function deleteHomeMedicationInDb(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/agentic/medications/home/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (err) {
    console.error('[dbService] Error deleting home medication from DB:', err);
    return false;
  }
}


