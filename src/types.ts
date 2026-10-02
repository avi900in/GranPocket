/**
 * GranPocket - Type Definitions (SRS & Architecture Compliance)
 */

// ===== Severity Levels (SRS §0, SEV-01) =====
export type Severity = 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN';

// ===== Age Bands (SRS §7.2) =====
export type AgeBand =
  | 'neonate'       // 0-28 days
  | 'young_infant'  // 29 days-<3 months
  | 'infant'        // 3-<12 months
  | 'toddler'       // 1-<3 years
  | 'child'         // 3-<12 years
  | 'adolescent'    // 12-<18 years
  | 'adult'         // 18-<65 years
  | 'elderly';      // 65+ (with frailty/fall/delirium modifiers)

// ===== System Roles (SRS §3) =====
export type SystemRole = 'ADMIN' | 'MEMBER' | 'CAREGIVER' | 'DEPENDENT' | 'APP_OWNER';

// ===== Content Status (SRS §4.9 CLIN-01) =====
export type ContentStatus = 'DRAFT' | 'PROVISIONAL' | 'CLINICALLY_APPROVED' | 'WARNING_OVERRIDE' | 'AGENTIC_PREVIEW';

// ===== Supported Languages (SRS §4.3 INT-11) =====
export type Language = 'en' | 'zh' | 'ms';

// ===== Household & Address (SRS FAM-01) =====
export interface Household {
  id: string;
  name: string;
  defaultRegion: string;
  addresses: Address[];
  emergencyContacts: EmergencyContact[];
  createdAt: string;
}

export interface Address {
  id: string;
  householdId: string;
  label: string;
  text: string;
  postalCode: string;
  lat: number;
  lng: number;
  isPrimary: boolean;
}

export interface EmergencyContact {
  id: string;
  householdId: string;
  personId?: string;
  name: string;
  relationship: string;
  phone: string;
  priority: number;
}

// ===== Person & Medical Profile (SRS FAM-02, FAM-03) =====
export interface Person {
  id: string;
  householdId: string;
  name: string;
  dob: string;
  sex: 'male' | 'female' | 'other';
  relationshipLabel: string;
  language: Language;
  hasLogin: boolean;
  phone?: string;
  systemRole: SystemRole;
  avatar?: string;
  medicalProfile: MedicalProfile;
  insurance?: Insurance;
  careLinks?: CareLink[];
  activeComplaint?: string;
}

export interface MedicalProfile {
  conditions: MedicalCondition[];
  allergies: Allergy[];
  intolerances: string[];
  medications: Medication[];
  vaccinations: Vaccination[];
  emergencyContact?: string;
  weight?: number; // kg
  bloodType?: string;
  pregnancyStatus?: 'not_pregnant' | 'pregnant' | 'unsure' | null;
  lastReviewedDate?: string;
}

export interface MedicalCondition {
  id: string;
  code?: string;
  name: string;
  type: string;
  severity?: 'mild' | 'moderate' | 'severe';
  diagnosedDate?: string;
}

export interface Allergy {
  id: string;
  code?: string;
  name: string;
  type: 'drug' | 'food' | 'environmental';
  severity: 'mild' | 'moderate' | 'severe';
}

export interface Medication {
  id: string;
  code?: string;
  name: string;
  dose: string;
  frequency: string;
  minIntervalHours?: number; // for duplicate-dose warning
  startDate?: string;
  endDate?: string;
  indications?: string;
}

export interface Vaccination {
  id: string;
  name: string;
  date: string;
  nextDue?: string;
}

export interface Insurance {
  provider: string;
  plan: string;
  policyId: string;
  panelStatus: string;
}

export interface CareLink {
  caregiverPersonId: string;
  recipientPersonId: string;
  type: string; // e.g., 'primary_caregiver' | 'helper' | 'co_caregiver'
  start?: string;
  end?: string;
}

// ===== Triage Engine (SRS §7) =====
export interface Ailment {
  code: string;
  name: string;
  nameZh?: string;
  nameMs?: string;
  icon: string;
  redFlagThemes: string[];
  description?: string;
}

export interface SymptomArea {
  code: string;
  label: string;
  labelZh: string;
  labelMs: string;
  icon: string;
  ailmentCodes: string[];
}

export interface SymptomInput {
  type: 'text' | 'voice' | 'photo';
  content: string;
  transcript?: string;
  imageUrl?: string;
  imageDescriptors?: string[];
  language: Language;
  consentFlags?: {
    audioStored?: boolean;
    imageStored?: boolean;
  };
}

export interface TriageRule {
  ruleId: string;
  version: string;
  contentStatus: ContentStatus;
  ailment: string;
  appliesTo: {
    ageMinDays?: number;
    ageMaxDays?: number;
  };
  when: {
    any?: string[];
    all?: string[];
  };
  severity: Severity;
  careTierKey: string;
  reasonKey: string;
  localesRequired: Language[];
  // Agentic Knowledge Repository Fields (Spec §4)
  conditionId?: string;
  ageBand?: AgeBand | 'all';
  bodyPart?: string;
  symptomSet?: string[];
  sourceRefs?: string[];
  originatingAgent?: string;
  hybridStore?: {
    graphNode?: string;
    vectorDim?: number;
    queryShape?: 'graph' | 'vector' | 'hybrid';
  };
  rationale?: string;
}

export interface QuestionStep {
  id: string;
  textKey: string;
  text: string;
  textZh?: string;
  textMs?: string;
  answerType: 'yes_no' | 'choice' | 'number' | 'text';
  options?: string[];
  optionsZh?: string[];
  optionsMs?: string[];
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  redFlagIf?: (string | number | boolean)[];
  helpText?: string;
}

export interface TriageResult {
  severity: Severity;
  action: string;
  actionZh?: string;
  actionMs?: string;
  timeframe: string;
  careTierText: string;
  careTierTextZh?: string;
  careTierTextMs?: string;
  reasons: string[];
  reasonsZh?: string[];
  reasonsMs?: string[];
  whenToWorry: string[];
  whenToWorryZh?: string[];
  whenToWorryMs?: string[];
  disclaimer: string;
  contentStatusLabel: ContentStatus;
  triggeredRuleIds: string[];
  matchedKeywords?: string[];
  suggestedAilment?: string;
  grandmaExplanation?: string;
  agenticLogId?: string;
  agenticTransitions?: any[];
  agenticAttestation?: any;
  homeMedicationAdvice?: {
    medicationName: string;
    dosageInstruction: string;
    route?: string;
    urgency?: string;
    warnings?: string;
    approvedBy?: string;
  };
}

// ===== Home Medication Protocol (Agentic Spec) =====
export interface HomeMedicationSuggestion {
  id: string;
  conditionName: string;
  conditionCode?: string;
  medicationName: string;
  brandOrGeneric?: string;
  dosageInstruction: string;
  route?: string;
  urgency?: 'immediate_emergency' | 'symptomatic_relief' | 'supportive_care';
  warnings?: string;
  targetAgeBand?: 'pediatric' | 'adult' | 'senior' | 'all';
  sourceDoc?: string;
  rawExcerpt?: string;
  status: 'pending_review' | 'approved' | 'rejected';
  reviewedBy?: string;
  mcrNumber?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface TriageSession {
  id: string;
  inquiryId: string;
  subjectId: string;
  subjectName: string;
  subjectAgeDisplay: string;
  raiserId: string;
  rulesetVersion: string;
  startedAt: string;
  completedAt?: string;
  answers: Record<string, any>;
  result?: TriageResult;
  status: 'in_progress' | 'completed' | 'escalated';
}

// ===== Active Inquiries =====
export interface Inquiry {
  id: string;
  subjectId: string;
  raiserId: string;
  status: 'open' | 'monitoring' | 'closed' | 'escalated';
  openedAt: string;
  closedAt?: string;
  locationUsed?: string;
  inputs: SymptomInput[];
  triageSession?: TriageSession;
  checkBackPlan?: CheckBackPlan;
}

// ===== Check-Back / Home Monitoring (SRS HOME-01 - 07) =====
export interface CheckBackPlan {
  id: string;
  inquiryId: string;
  subjectId: string;
  subjectName: string;
  interval: string;
  nextCheckAt: string;
  status: 'active' | 'completed' | 'escalated';
  checkIns: CheckIn[];
  initialSeverity: Severity;
}

export interface CheckIn {
  id: string;
  planId: string;
  sentAt: string;
  responseAt?: string;
  response?: 'better' | 'same' | 'worse';
  vitals?: VitalsLog;
  escalatedToSeverity?: Severity;
}

export interface VitalsLog {
  temperature?: number;
  painLevel?: number; // 1-10
  spo2?: number; // %
  progression?: 'improving' | 'stable' | 'worsening';
  notes?: string;
  timestamp: string;
}

// ===== Medication Safety & Reminders (SRS MED-01 - 07) =====
export interface MedicationLogEntry {
  id: string;
  subjectId: string;
  subjectName: string;
  givenBy: string;
  medicine: string;
  dose: string;
  givenAt: string;
  photoUrl?: string;
  inquiryId?: string;
  voidedReason?: string;
  notes?: string;
}

export interface MedicationReminder {
  id: string;
  subjectId: string;
  subjectName: string;
  medicine: string;
  dose: string;
  frequency: string;
  nextDueTime: string;
  minIntervalHours: number;
  assignedCaregivers: string[];
  status: 'active' | 'completed' | 'paused';
}

// ===== Hospital & Clinic Facility (SRS ESC-03, 04) =====
export interface HospitalFacility {
  id: string;
  name: string;
  type: 'public_hospital' | 'urgent_care' | '24hr_clinic' | 'polyclinic' | 'private_hospital' | 'gp_clinic';
  address: string;
  phone: string;
  hasED: boolean;
  hours?: string;
  lat: number;
  lng: number;
  distance?: number; // km
  eta?: string;     // estimated time in minutes
  insurerPanel?: string[]; // ['AIA', 'Great Eastern', 'Prudential', 'Singlife', 'NTUC Income']
  panels?: string[];
  specialtyNotes?: string; // e.g. "Dedicated Children's Emergency" for KKH
  specialties?: string[];
  waitTimeMinutes?: number;
}

// ===== Knowledge Base & Clinical Review (SRS CLIN / KB) =====
export interface KBArticle {
  id: string;
  title: string;
  version: string;
  status: ContentStatus;
  sources: KBSource[];
  reviewers: ClinicalReviewerApproval[];
  effectiveDate: string;
  summary: string;
}

export interface KBSource {
  name: string;
  url: string;
  publisher: 'MOH' | 'HealthHub' | 'HPB' | 'SCDF' | 'KKH' | 'WHO';
  retrievalDate: string;
}

export interface ClinicalReviewerApproval {
  reviewerName: string;
  credentialMCR: string; // Singapore Medical Council Reg No
  approvedAt: string;
  version: string;
  notes: string;
}

export interface KBChangeProposal {
  id: string;
  title: string;
  sourceUrl: string;
  publisher: string;
  retrievedAt: string;
  proposedChanges: string;
  rationale: string;
  status: 'pending_review' | 'approved' | 'rejected';
  affectedAilment: string;
  reviewedBy?: string;
  reviewedAt?: string;
  signOffBy?: string;
  mcrNumber?: string;
  // Agentic additions (Spec §3, §4, §6)
  targetTier?: 'Tier 1 Deterministic Red-Line' | 'Tier 2 Knowledge Ingest' | 'Tier 4 ML Calibration';
  ageBand?: 'infant' | 'senior' | 'adult' | 'all';
  category?: string;
  originatingAgent?: string;
  confidenceScore?: number;
  ruleCodeSnippet?: string;
  proposedRule?: Partial<TriageRule>;
  verifiedSource?: string;
  originalText?: string;
  diff?: any;
  requiresClinicianReview?: boolean;
  clinicianReviewReason?: string;
  isEmergencyEscalation?: boolean;
}

// ===== Audit Event (SRS PRIV-04) =====
export interface AuditEvent {
  id: string;
  actor: string;
  action: string;
  resource: string;
  timestamp: string;
  version: string;
  details?: string;
}

// ===== Family Alert (SRS ESC-06) =====
export interface FamilyAlert {
  id: string;
  subjectName: string;
  severity: Severity;
  location: string;
  message: string;
  sentAt: string;
  channels: ('push' | 'sms')[];
  recipients: string[];
}

// ===== Role-Based Access Control (RBAC §3, §9) =====
export type ScreenKey = 
  | 'triage' 
  | 'family' 
  | 'medications' 
  | 'monitoring' 
  | 'facilities' 
  | 'clinical_kb' 
  | 'pdpa_audit' 
  | 'owner_admin'
  | 'feedback';

export type RoleCapabilityKey =
  | 'edit_household'        // Create/edit household, addresses, members, medical info, insurance
  | 'manage_care_links'     // Manage care links and emergency contacts
  | 'view_own_profile'      // View own profile and history
  | 'view_others_profile'   // View profile of others (full, care recipients, none)
  | 'inquiry_self'          // Raise inquiry for self
  | 'inquiry_others'        // Raise inquiry for another person
  | 'view_inquiry_results'  // View inquiry results/summaries
  | 'medication_log'        // Log medication, upload photos, view medication log
  | 'receive_alerts'        // Receive escalation alerts
  | 'export_delete_data';   // Export/delete household data

export type CapabilityScope = 'full' | 'care_recipients' | 'own' | 'none';

export interface RolePermissions {
  role: SystemRole;
  label: string;
  description: string;
  allowedScreens: ScreenKey[];
  capabilities: Record<RoleCapabilityKey, CapabilityScope>;
}

export interface HouseholdRbacConfig {
  householdId: string;
  rolePermissions: Record<SystemRole, RolePermissions>;
  userScreenOverrides?: Record<string, ScreenKey[]>; // personId -> ScreenKey[]
}
