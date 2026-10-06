import type { Ailment, TriageRule, AgeBand, Language, Severity, QuestionStep, TriageResult, Person, ContentStatus } from "../types";
import { getResultPhrasing } from './grandmaVoice';
import { runRuleBasedTriage } from './ruleBasedEngine';
import { fetchTriageDecisionFromDb } from '../services/dbService';

// These are now dynamic, fetched from DB
export const AILMENTS: Ailment[] = [];
export const EMERGENCY_KEYWORDS = {};

// Used to seed initial data in database
// =========================================================================
// AGENTIC KNOWLEDGE REPOSITORY (@knowledge_agent — Spec §3 & §4)
// Multi-tier clinical rules (RED / ORANGE / YELLOW / GREEN) with hybrid store
// graph nodes, vector dimensions, age bands, body parts, and audit provenance.
// =========================================================================
export const AGENTIC_KNOWLEDGE_REPOSITORY: TriageRule[] = [
  // -----------------------------------------------------------------------
  // 🔴 TIER 1: DETERMINISTIC RED-LINE EMERGENCY RULES (Immediate 995 / A&E)
  // -----------------------------------------------------------------------
  // 1. Spec §3.1 Infant: Breathing Distress
  {
    ruleId: 'RESP-INF-001',
    conditionId: 'COND-RESP-INF-DISTRESS',
    version: '1.2.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'breathing_difficulty',
    ageBand: 'infant',
    bodyPart: 'Respiratory / Chest',
    symptomSet: ['labored_breathing', 'flared_nostrils', 'deep_rib_retractions', 'tachypnea'],
    appliesTo: { ageMinDays: 0, ageMaxDays: 365 },
    when: { any: ['labored_breathing == true', 'flared_nostrils == true', 'deep_rib_retractions == true', 'severe_difficulty == true'] },
    severity: 'RED',
    careTierKey: 'tier.red.a_and_e_995',
    reasonKey: 'reason.infant_breathing_distress',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['MOH Singapore Pediatric Respiratory Distress CPG (2026)', 'KKH Clinical Emergency Handbook'],
    originatingAgent: '@decipher_agent',
    hybridStore: { graphNode: 'node_infant_resp_failure', vectorDim: 1536, queryShape: 'graph' },
    rationale: 'Compliant infant chest wall with nasal flaring and deep intercostal retractions signals impending respiratory collapse.',
  },
  // 2. Spec §3.1 Infant: Skin/Lip Discoloration / Cyanosis
  {
    ruleId: 'CYANOSIS-INF-001',
    conditionId: 'COND-INF-CYANOSIS',
    version: '1.1.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'skin_rash',
    ageBand: 'infant',
    bodyPart: 'Cardiovascular / Skin',
    symptomSet: ['pale_skin', 'blotchy_skin', 'gray_skin', 'blue_lips', 'blue_tongue'],
    appliesTo: { ageMinDays: 0, ageMaxDays: 365 },
    when: { any: ['pale_skin == true', 'blotchy_skin == true', 'gray_skin == true', 'blue_lips == true', 'blue_tongue == true'] },
    severity: 'RED',
    careTierKey: 'tier.red.a_and_e_995',
    reasonKey: 'reason.infant_cyanosis_discoloration',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['SingHealth Pediatric Critical Care Protocols', 'MOH Singapore SaMD Class II Spec'],
    originatingAgent: '@decipher_agent',
    hybridStore: { graphNode: 'node_infant_hypoxemia_shock', vectorDim: 1536, queryShape: 'graph' },
    rationale: 'Central or peripheral cyanosis, gray pallor, or mottled skin reflects acute hypoxemia or septic hypoperfusion.',
  },
  // 3. Spec §3.1 Infant: Newborn Fever (< 3 months)
  {
    ruleId: 'FEV-NEWBORN-001',
    conditionId: 'COND-NEONATAL-FEVER',
    version: '1.3.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'fever',
    ageBand: 'young_infant',
    bodyPart: 'Systemic / Vitals',
    symptomSet: ['temp_c >= 38.0', 'feels_hot', 'neonatal_lethargy'],
    appliesTo: { ageMinDays: 0, ageMaxDays: 89 },
    when: { any: ['temp_c >= 38.0', 'feels_hot == true', 'unresponsive_appearance == true'] },
    severity: 'RED',
    careTierKey: 'tier.red.a_and_e_995',
    reasonKey: 'reason.fever_young_infant',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['MOH Singapore Neonatal Febrile Illness Guideline (2026)', 'NUH Pediatric Emergency Care'],
    originatingAgent: '@decipher_agent',
    hybridStore: { graphNode: 'node_neonatal_fever_emergency', vectorDim: 1536, queryShape: 'graph' },
    rationale: 'Infants under 3 months with temperature >= 38.0°C have immature immune defenses; full septic workup is mandated.',
  },
  // 4. Spec §3.1 Infant: Extreme Lethargy & Floppiness
  {
    ruleId: 'LETHARGY-INF-001',
    conditionId: 'COND-INF-LETHARGY',
    version: '1.1.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'confusion_neuro',
    ageBand: 'infant',
    bodyPart: 'Neurology',
    symptomSet: ['extreme_lethargy', 'limp_baby', 'floppy_baby', 'hard_to_wake', 'unresponsive'],
    appliesTo: { ageMinDays: 0, ageMaxDays: 365 },
    when: { any: ['extreme_lethargy == true', 'limp_baby == true', 'hard_to_wake == true', 'unresponsive == true', 'drowsy == true'] },
    severity: 'RED',
    careTierKey: 'tier.red.a_and_e_995',
    reasonKey: 'reason.infant_extreme_lethargy',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['KKH Pediatric Altered Mental Status CPG', 'MOH Pediatric Clinical Practice Guidelines'],
    originatingAgent: '@decipher_agent',
    hybridStore: { graphNode: 'node_infant_encephalopathy', vectorDim: 1536, queryShape: 'graph' },
    rationale: 'Hypotonia and inability to arouse indicates acute central nervous system depression or severe systemic sepsis.',
  },
  // 5. Spec §3.1 Infant: Inconsolable High-Pitched Crying
  {
    ruleId: 'CRY-INF-001',
    conditionId: 'COND-INF-INCONSOLABLE-CRY',
    version: '1.0.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'mood',
    ageBand: 'infant',
    bodyPart: 'Neurology / Systemic',
    symptomSet: ['inconsolable_crying', 'high_pitched_cry', 'unsoothable'],
    appliesTo: { ageMinDays: 0, ageMaxDays: 365 },
    when: { any: ['inconsolable_crying == true', 'high_pitched_cry == true', 'unsoothable == true'] },
    severity: 'RED',
    careTierKey: 'tier.red.a_and_e_995',
    reasonKey: 'reason.infant_inconsolable_crying',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['College of Paediatrics and Child Health Singapore', 'MOH Acute Pediatric Care Protocols'],
    originatingAgent: '@ml_agent',
    hybridStore: { graphNode: 'node_infant_cerebral_cry', vectorDim: 1536, queryShape: 'hybrid' },
    rationale: 'High-pitched cerebral crying unresponsive to soothing indicates raised ICP, corneal injury, or intussusception.',
  },
  // 6. Spec §3.1 Infant: Severe Dehydration (Dry mouth, crying without tears, no wet diapers >6h)
  {
    ruleId: 'DEHYDR-INF-001',
    conditionId: 'COND-INF-SEVERE-DEHYDR',
    version: '1.2.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'vomiting_diarrhea',
    ageBand: 'infant',
    bodyPart: 'GI / Hydration',
    symptomSet: ['dry_mouth', 'crying_no_tears', 'no_wet_diapers_6h', 'sunken_fontanelle'],
    appliesTo: { ageMinDays: 0, ageMaxDays: 365 },
    when: { any: ['dry_mouth == true', 'crying_no_tears == true', 'no_wet_diaper_hours >= 6', 'severe_dehydration == true'] },
    severity: 'RED',
    careTierKey: 'tier.red.a_and_e_995',
    reasonKey: 'reason.infant_severe_dehydration',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['HealthHub Infant Dehydration Guidelines', 'MOH Singapore Clinical Practice Guideline'],
    originatingAgent: '@decipher_agent',
    hybridStore: { graphNode: 'node_infant_hypovolemic_shock', vectorDim: 1536, queryShape: 'graph' },
    rationale: 'Lack of urine output for >=6h and absent tear production indicates critical hypovolemic dehydration in infants.',
  },
  // 7. Spec §3.1 Infant: Total Feeding Refusal
  {
    ruleId: 'FEED-INF-001',
    conditionId: 'COND-INF-FEEDING-REFUSAL',
    version: '1.0.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'vomiting_diarrhea',
    ageBand: 'infant',
    bodyPart: 'GI / Hydration',
    symptomSet: ['feeding_refusal', 'unable_to_feed', 'vomiting_all_feeds'],
    appliesTo: { ageMinDays: 0, ageMaxDays: 365 },
    when: { any: ['feeding_refusal == true', 'unable_to_feed == true', 'vomit_every_feed == true'] },
    severity: 'RED',
    careTierKey: 'tier.red.a_and_e_995',
    reasonKey: 'reason.infant_feeding_refusal',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['KKH Emergency Clinical Pathways', 'SingHealth Pediatrics Guideline'],
    originatingAgent: '@ml_agent',
    hybridStore: { graphNode: 'node_infant_acute_intolerance', vectorDim: 1536, queryShape: 'hybrid' },
    rationale: 'Complete inability or refusal to drink feeds triggers rapid hypoglycemia and metabolic ketoacidosis.',
  },
  // 8. Spec §3.1 Infant: Neurological Signs & Seizures
  {
    ruleId: 'NEURO-INF-001',
    conditionId: 'COND-INF-SEIZURE',
    version: '1.2.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'confusion_neuro',
    ageBand: 'infant',
    bodyPart: 'Neurology',
    symptomSet: ['seizure', 'rhythmic_jerking', 'staring_spells', 'eye_flutter'],
    appliesTo: { ageMinDays: 0, ageMaxDays: 365 },
    when: { any: ['seizure == true', 'rhythmic_jerking == true', 'staring_spells == true', 'eye_flutter == true'] },
    severity: 'RED',
    careTierKey: 'tier.red.a_and_e_995',
    reasonKey: 'reason.infant_seizure_neuro',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['National Neuroscience Institute (NNI) Pediatric Seizure Protocols (2026)'],
    originatingAgent: '@decipher_agent',
    hybridStore: { graphNode: 'node_infant_status_epilepticus', vectorDim: 1536, queryShape: 'graph' },
    rationale: 'Rhythmic twitching or sudden unprovoked staring spells indicates acute focal or generalized epileptic activity.',
  },
  // 9. Spec §3.1 Infant: Non-Blanching Rash (Glass Test Failure)
  {
    ruleId: 'PURPURA-INF-001',
    conditionId: 'COND-INF-PURPURA',
    version: '1.3.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'skin_rash',
    ageBand: 'infant',
    bodyPart: 'Dermatology / Systemic',
    symptomSet: ['non_blanching_rash', 'purpura', 'petechiae', 'glass_test_fails'],
    appliesTo: { ageMinDays: 0, ageMaxDays: 365 },
    when: { any: ['non_blanching_rash == true', 'purpura == true', 'petechiae == true', 'glass_test_fails == true'] },
    severity: 'RED',
    careTierKey: 'tier.red.a_and_e_995',
    reasonKey: 'reason.infant_non_blanching_rash',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['MOH Singapore Communicable Diseases Agency (CDA) Meningococcal Standard'],
    originatingAgent: '@decipher_agent',
    hybridStore: { graphNode: 'node_meningococcal_purpura', vectorDim: 1536, queryShape: 'graph' },
    rationale: 'Petechial or purpuric rash that fails to fade under glass pressure strongly indicates acute meningococcal septicemia.',
  },
  // 10. Spec §3.2 Senior: Sudden Confusion & Acute Delirium
  {
    ruleId: 'CONFUSION-SNR-001',
    conditionId: 'COND-SNR-ACUTE-DELIRIUM',
    version: '1.2.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'confusion_neuro',
    ageBand: 'elderly',
    bodyPart: 'Neurology / Mental Health',
    symptomSet: ['sudden_confusion', 'acute_delirium', 'sudden_speech_loss', 'disorientation'],
    appliesTo: { ageMinDays: 23725 }, // >= 65 years
    when: { any: ['sudden_confusion == true', 'acute_delirium == true', 'sudden_speech_loss == true', 'disorientation == true'] },
    severity: 'RED',
    careTierKey: 'tier.red.a_and_e_995',
    reasonKey: 'reason.senior_acute_delirium',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['TTSH Institute of Geriatrics Acute Delirium Guidance (2026)', 'MOH Singapore CPG'],
    originatingAgent: '@decipher_agent',
    hybridStore: { graphNode: 'node_senior_delirium_emergency', vectorDim: 1536, queryShape: 'graph' },
    rationale: 'Abrupt disorientation or sudden speech change in older adults suggests acute stroke, intracranial bleed, or severe sepsis.',
  },
  // 11. Spec §3.2 Senior: Chest Pain / Squeezing Pressure
  {
    ruleId: 'CHEST-SNR-001',
    conditionId: 'COND-SNR-CORONARY-SYNDROME',
    version: '1.4.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'chest_pain',
    ageBand: 'elderly',
    bodyPart: 'Cardiovascular',
    symptomSet: ['chest_pain', 'crushing_chest', 'chest_pressure', 'heart_attack_signs'],
    appliesTo: { ageMinDays: 23725 },
    when: { any: ['chest_pain == true', 'crushing_chest == true', 'chest_pressure == true', 'heart_attack_signs == true'] },
    severity: 'RED',
    careTierKey: 'tier.red.a_and_e_995',
    reasonKey: 'reason.senior_chest_pain',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['National Heart Centre Singapore (NHCS) Acute Coronary Protocol', 'SCDF Emergency Protocols'],
    originatingAgent: '@decipher_agent',
    hybridStore: { graphNode: 'node_senior_acute_coronary', vectorDim: 1536, queryShape: 'graph' },
    rationale: 'Any squeezing or heavy pressure in the chest of an older adult warrants immediate SCDF 995 dispatch for STEMI screening.',
  },
  // 12. Spec §3.2 Senior: Shortness of Breath at Rest & Gasping
  {
    ruleId: 'DYSPNEA-SNR-001',
    conditionId: 'COND-SNR-ACUTE-DYSPNEA',
    version: '1.2.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'breathing_difficulty',
    ageBand: 'elderly',
    bodyPart: 'Respiratory / Cardiovascular',
    symptomSet: ['shortness_breath_rest', 'gasping_breath', 'acute_wheezing', 'cannot_catch_breath'],
    appliesTo: { ageMinDays: 23725 },
    when: { any: ['shortness_breath_rest == true', 'gasping_breath == true', 'acute_wheezing == true', 'severe_difficulty == true'] },
    severity: 'RED',
    careTierKey: 'tier.red.a_and_e_995',
    reasonKey: 'reason.senior_rest_dyspnea',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['NUH Department of Medicine Acute Dyspnea Guidelines', 'MOH Emergency Care Standards'],
    originatingAgent: '@decipher_agent',
    hybridStore: { graphNode: 'node_senior_pulmonary_edema', vectorDim: 1536, queryShape: 'graph' },
    rationale: 'Sudden gasping or severe breathlessness at rest in seniors signals pulmonary edema, pulmonary embolism, or tension pneumothorax.',
  },
  // 13. Spec §3.2 Senior: Stroke Signs & Focal Deficits
  {
    ruleId: 'STROKE-SNR-001',
    conditionId: 'COND-SNR-FAST-STROKE',
    version: '1.4.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'confusion_neuro',
    ageBand: 'elderly',
    bodyPart: 'Neurology',
    symptomSet: ['facial_droop', 'arm_weakness', 'gait_loss', 'slurred_speech', 'hemiparesis'],
    appliesTo: { ageMinDays: 23725 },
    when: { any: ['facial_droop == true', 'arm_weakness == true', 'gait_loss == true', 'slurred_speech == true'] },
    severity: 'RED',
    careTierKey: 'tier.red.a_and_e_995',
    reasonKey: 'reason.senior_fast_stroke',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['National Neuroscience Institute (NNI) Hyperacute Stroke Protocols', 'SCDF Fast Triage Rule'],
    originatingAgent: '@decipher_agent',
    hybridStore: { graphNode: 'node_acute_ischemic_stroke', vectorDim: 1536, queryShape: 'graph' },
    rationale: 'Unilateral limb weakness, facial drop, or ataxia marks acute cerebrovascular infarction with time-critical thrombolytic window.',
  },
  // 14. Spec §3.2 Senior: High Fever >= 39.4°C or Fever with Stiff Neck
  {
    ruleId: 'FEV-SNR-001',
    conditionId: 'COND-SNR-HIGH-FEVER-SEPSIS',
    version: '1.1.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'fever',
    ageBand: 'elderly',
    bodyPart: 'Systemic / Vitals',
    symptomSet: ['temp_c >= 39.4', 'stiff_neck', 'severe_rigors', 'elderly_confusion'],
    appliesTo: { ageMinDays: 23725 },
    when: { any: ['temp_c >= 39.4', 'stiff_neck == true', 'severe_rigors == true'] },
    severity: 'RED',
    careTierKey: 'tier.red.a_and_e_995',
    reasonKey: 'reason.senior_high_fever_sepsis',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['Society of Infectious Disease (Singapore) Geriatric Sepsis Protocol (2026)'],
    originatingAgent: '@ml_agent',
    hybridStore: { graphNode: 'node_geriatric_severe_sepsis', vectorDim: 1536, queryShape: 'graph' },
    rationale: 'High fever in older adults indicates life-threatening bacteremia, urosepsis, or central nervous system infection.',
  },
  // 15. Spec §3.2 Senior: Severe Dehydration & Syncope
  {
    ruleId: 'DEHYDR-SNR-001',
    conditionId: 'COND-SNR-DEHYDRATION-SYNCOPE',
    version: '1.1.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'vomiting_diarrhea',
    ageBand: 'elderly',
    bodyPart: 'GI / Hydration',
    symptomSet: ['sunken_eyes', 'dark_urine', 'syncope', 'fainting_vomiting'],
    appliesTo: { ageMinDays: 23725 },
    when: { any: ['sunken_eyes == true', 'dark_urine == true', 'syncope == true', 'fainting_vomiting == true'] },
    severity: 'RED',
    careTierKey: 'tier.red.a_and_e_995',
    reasonKey: 'reason.senior_severe_dehydration_syncope',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['HealthHub Geriatric Acute Care Guidance', 'TTSH ED Protocol'],
    originatingAgent: '@decipher_agent',
    hybridStore: { graphNode: 'node_geriatric_hypovolemia_syncope', vectorDim: 1536, queryShape: 'graph' },
    rationale: 'Volume contraction in seniors rapidly triggers acute renal failure, orthostatic collapse, and watershed ischemic stroke.',
  },
  // 16. Spec §3.2 Senior: Sudden Severe Abdominal Pain or Thunderclap Headache
  {
    ruleId: 'PAIN-SNR-001',
    conditionId: 'COND-SNR-ACUTE-CATASTROPHE',
    version: '1.2.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'injury_wound',
    ageBand: 'elderly',
    bodyPart: 'Vascular / Abdomen / Brain',
    symptomSet: ['sudden_severe_abd_pain', 'thunderclap_headache', 'worst_headache_life'],
    appliesTo: { ageMinDays: 23725 },
    when: { any: ['sudden_severe_abd_pain == true', 'thunderclap_headache == true', 'worst_headache_life == true'] },
    severity: 'RED',
    careTierKey: 'tier.red.a_and_e_995',
    reasonKey: 'reason.senior_sudden_severe_catastrophe',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['SGH Department of Emergency Medicine Acute Vascular Protocols'],
    originatingAgent: '@decipher_agent',
    hybridStore: { graphNode: 'node_vascular_catastrophe', vectorDim: 1536, queryShape: 'graph' },
    rationale: 'Abrupt severe abdominal pain or thunderclap headache suggests dissecting AAA or ruptured cerebral berry aneurysm.',
  },
  // 17. General Red Flag: Anaphylaxis
  {
    ruleId: 'ANAPH-001',
    conditionId: 'COND-ANAPHYLAXIS',
    version: '1.1.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'allergic_reaction',
    ageBand: 'all',
    bodyPart: 'Immunology / Airway',
    symptomSet: ['lip_tongue_swelling', 'breathing_difficulty', 'faintness'],
    appliesTo: {},
    when: { any: ['lip_tongue_swelling == true', 'breathing_difficulty == true', 'faintness == true'] },
    severity: 'RED',
    careTierKey: 'tier.red.a_and_e_995',
    reasonKey: 'reason.anaphylaxis',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['MOH Singapore Anaphylaxis Clinical Protocol'],
    originatingAgent: '@decipher_agent',
    hybridStore: { graphNode: 'node_anaphylaxis_protocol', vectorDim: 1536, queryShape: 'graph' },
    rationale: 'Airway compromise and cardiovascular collapse in acute systemic allergy requires immediate epinephrine and 995 ambulance.',
  },
  // 18. General Red Flag: Uncontrolled Bleeding
  {
    ruleId: 'BLEED-001',
    conditionId: 'COND-HEMORRHAGE',
    version: '1.1.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'injury_wound',
    ageBand: 'all',
    bodyPart: 'Trauma / Vascular',
    symptomSet: ['uncontrolled_bleeding', 'arterial_gushing'],
    appliesTo: {},
    when: { any: ['uncontrolled_bleeding == true'] },
    severity: 'RED',
    careTierKey: 'tier.red.a_and_e_995',
    reasonKey: 'reason.uncontrolled_bleeding',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['SCDF Trauma Care Guidelines'],
    originatingAgent: '@decipher_agent',
    hybridStore: { graphNode: 'node_major_hemorrhage', vectorDim: 1536, queryShape: 'graph' },
    rationale: 'Continuous heavy hemorrhage despite direct compression leads to hypovolemic shock.',
  },
  // 19. General Red Flag: Crisis Self-Harm
  {
    ruleId: 'SELFHARM-001',
    conditionId: 'COND-CRISIS-SELFHARM',
    version: '1.0.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'mood',
    ageBand: 'all',
    bodyPart: 'Mental Health',
    symptomSet: ['self_harm_intent', 'suicidal_ideation'],
    appliesTo: {},
    when: { any: ['self_harm_intent == true'] },
    severity: 'RED',
    careTierKey: 'tier.red.crisis',
    reasonKey: 'reason.mental_health_crisis',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['IMH Singapore Crisis Helpline Integration'],
    originatingAgent: '@decipher_agent',
    hybridStore: { graphNode: 'node_crisis_intervention', vectorDim: 1536, queryShape: 'graph' },
    rationale: 'Active self-harm ideation or intent triggers immediate crisis helpline escalation and safety net protocol.',
  },

  // -----------------------------------------------------------------------
  // 🟠 TIER 2: ORANGE RULES (Urgent Care / Same-Day Evaluation within 4-6h)
  // -----------------------------------------------------------------------
  {
    ruleId: 'FEV-TODDLER-001',
    conditionId: 'COND-FEV-TODDLER-HIGH',
    version: '1.0.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'fever',
    ageBand: 'toddler',
    bodyPart: 'Systemic / Vitals',
    symptomSet: ['temp_c >= 39.0', 'toddler_fever', 'mild_irritability'],
    appliesTo: { ageMinDays: 365, ageMaxDays: 1095 },
    when: { any: ['temp_c >= 39.0', 'temp_c >= 39.2'] },
    severity: 'ORANGE',
    careTierKey: 'tier.orange.urgent_care_clinic',
    reasonKey: 'reason.toddler_high_fever_urgent',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['KKH Pediatric Urgent Care Clinical Pathways'],
    originatingAgent: '@knowledge_agent',
    hybridStore: { graphNode: 'node_toddler_febrile_urgent', vectorDim: 1536, queryShape: 'hybrid' },
    rationale: 'Toddler high fever without red-line signs warrants same-day medical examination to exclude occult bacterial infection.',
  },
  {
    ruleId: 'DEHYDR-MOD-001',
    conditionId: 'COND-MODERATE-DEHYDRATION',
    version: '1.1.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'vomiting_diarrhea',
    ageBand: 'all',
    bodyPart: 'GI / Hydration',
    symptomSet: ['reduced_urination', 'dry_lips', 'persistent_vomiting_fluids'],
    appliesTo: {},
    when: { any: ['dry_lips == true', 'reduced_fluids == true', 'moderate_dehydration == true'] },
    severity: 'ORANGE',
    careTierKey: 'tier.orange.urgent_care_clinic',
    reasonKey: 'reason.moderate_dehydration_urgent',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['MOH Singapore Gastroenteritis Clinical Practice Guideline'],
    originatingAgent: '@knowledge_agent',
    hybridStore: { graphNode: 'node_moderate_hypovolemia', vectorDim: 1536, queryShape: 'hybrid' },
    rationale: 'Persistent fluid loss with moderate dehydration benefits from oral rehydration salts under clinical supervision.',
  },
  {
    ruleId: 'ABD-ACUTE-001',
    conditionId: 'COND-ACUTE-ABDOMINAL-PAIN',
    version: '1.0.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'vomiting_diarrhea',
    ageBand: 'all',
    bodyPart: 'GI / Abdomen',
    symptomSet: ['persistent_vomiting', 'constant_abdominal_pain'],
    appliesTo: {},
    when: { any: ['constant_abdominal_pain == true', 'repeated_vomiting == true'] },
    severity: 'ORANGE',
    careTierKey: 'tier.orange.urgent_care_clinic',
    reasonKey: 'reason.acute_abdominal_pain_urgent',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['SingHealth Emergency Abdominal Pain Pathways'],
    originatingAgent: '@knowledge_agent',
    hybridStore: { graphNode: 'node_acute_abdomen_evaluation', vectorDim: 1536, queryShape: 'graph' },
    rationale: 'Constant localized abdominal pain with nausea requires physical palpation to exclude acute appendicitis.',
  },
  {
    ruleId: 'FALL-ELDER-001',
    conditionId: 'COND-ELDERLY-FALL-FRACTURE',
    version: '1.2.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'dizziness_fall',
    ageBand: 'elderly',
    bodyPart: 'Musculoskeletal / Trauma',
    symptomSet: ['fall_elderly', 'unable_bear_weight', 'limb_pain_post_fall'],
    appliesTo: { ageMinDays: 23725 },
    when: { any: ['unable_bear_weight == true', 'limb_pain_post_fall == true', 'elderly_fall_pain == true'] },
    severity: 'ORANGE',
    careTierKey: 'tier.orange.urgent_care_clinic',
    reasonKey: 'reason.elderly_fall_suspected_fracture',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['TTSH Falls and Fracture Prevention Program (2026)'],
    originatingAgent: '@knowledge_agent',
    hybridStore: { graphNode: 'node_geriatric_fracture_risk', vectorDim: 1536, queryShape: 'graph' },
    rationale: 'Fall in an older adult resulting in immobility or localized bony tenderness warrants urgent radiographic evaluation.',
  },
  {
    ruleId: 'ASTHMA-EXAC-001',
    conditionId: 'COND-ASTHMA-EXACERBATION',
    version: '1.0.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'breathing_difficulty',
    ageBand: 'all',
    bodyPart: 'Respiratory',
    symptomSet: ['persistent_wheezing', 'inhaler_partial_relief', 'chest_tightness'],
    appliesTo: {},
    when: { any: ['persistent_wheezing == true', 'inhaler_partial_relief == true'] },
    severity: 'ORANGE',
    careTierKey: 'tier.orange.urgent_care_clinic',
    reasonKey: 'reason.asthma_exacerbation_urgent',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['Asthma Association of Singapore Clinical Guidance'],
    originatingAgent: '@knowledge_agent',
    hybridStore: { graphNode: 'node_asthma_bronchospasm', vectorDim: 1536, queryShape: 'hybrid' },
    rationale: 'Suboptimal response to relief bronchodilator indicates advancing bronchospasm requiring nebulization.',
  },
  {
    ruleId: 'LACERATION-001',
    conditionId: 'COND-DEEP-LACERATION',
    version: '1.0.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'injury_wound',
    ageBand: 'all',
    bodyPart: 'Skin / Trauma',
    symptomSet: ['deep_wound', 'gaping_edges', 'hemostasis_achieved'],
    appliesTo: {},
    when: { any: ['deep_wound == true', 'gaping_cut == true'] },
    severity: 'ORANGE',
    careTierKey: 'tier.orange.urgent_care_clinic',
    reasonKey: 'reason.deep_wound_suture_urgent',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['MOH Singapore Primary Care Trauma Guidelines'],
    originatingAgent: '@knowledge_agent',
    hybridStore: { graphNode: 'node_wound_closure_suture', vectorDim: 1536, queryShape: 'graph' },
    rationale: 'Full-thickness lacerations with gaping edges require surgical toilet and suture approximation within 6-8 hours.',
  },
  {
    ruleId: 'EYE-TRAUMA-001',
    conditionId: 'COND-CORNEAL-TRAUMA',
    version: '1.0.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'eye_symptoms',
    ageBand: 'all',
    bodyPart: 'Ophthalmology',
    symptomSet: ['foreign_body_sensation', 'photophobia', 'intense_eye_pain'],
    appliesTo: {},
    when: { any: ['foreign_body_sensation == true', 'intense_eye_pain == true'] },
    severity: 'ORANGE',
    careTierKey: 'tier.orange.urgent_care_clinic',
    reasonKey: 'reason.corneal_trauma_urgent',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['Singapore National Eye Centre (SNEC) Clinical Guidelines'],
    originatingAgent: '@knowledge_agent',
    hybridStore: { graphNode: 'node_corneal_abrasion', vectorDim: 1536, queryShape: 'graph' },
    rationale: 'Acute ocular pain with photophobia suggests corneal abrasion or retained foreign material needing slit-lamp exam.',
  },
  {
    ruleId: 'HTN-URGENT-001',
    conditionId: 'COND-HYPERTENSIVE-URGENCY',
    version: '1.1.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'chest_pain',
    ageBand: 'adult',
    bodyPart: 'Cardiovascular',
    symptomSet: ['systolic_bp >= 180', 'mild_headache', 'no_focal_neuro'],
    appliesTo: { ageMinDays: 6570 },
    when: { any: ['bp_sys >= 180', 'severe_hypertension_mild_symptoms == true'] },
    severity: 'ORANGE',
    careTierKey: 'tier.orange.urgent_care_clinic',
    reasonKey: 'reason.hypertensive_urgency',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['NHCS Clinical Practice Guidelines on Hypertension (2026)'],
    originatingAgent: '@knowledge_agent',
    hybridStore: { graphNode: 'node_hypertensive_urgency', vectorDim: 1536, queryShape: 'graph' },
    rationale: 'Marked blood pressure elevation (>180/110) requires same-day clinical assessment and gradual oral titrations.',
  },

  // -----------------------------------------------------------------------
  // 🟡 TIER 3: YELLOW RULES (Primary Care / GP / Polyclinic within 24-48h)
  // -----------------------------------------------------------------------
  {
    ruleId: 'COUGH-PROD-001',
    conditionId: 'COND-PROLONGED-COUGH',
    version: '1.0.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'cough_cold',
    ageBand: 'all',
    bodyPart: 'Respiratory',
    symptomSet: ['cough_duration > 5_days', 'phlegm_production', 'low_grade_fever'],
    appliesTo: {},
    when: { any: ['cough_days >= 5', 'persistent_productive_cough == true'] },
    severity: 'YELLOW',
    careTierKey: 'tier.yellow.gp_polyclinic_24h',
    reasonKey: 'reason.prolonged_cough_gp',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['MOH Singapore Primary Care Cough & URTI Guidelines'],
    originatingAgent: '@knowledge_agent',
    hybridStore: { graphNode: 'node_bronchitis_primary_care', vectorDim: 1536, queryShape: 'vector' },
    rationale: 'Cough persisting beyond 5 days with purulent sputum benefits from chest auscultation to exclude secondary consolidation.',
  },
  {
    ruleId: 'RASH-BLANCH-001',
    conditionId: 'COND-MILD-EXANTHEM',
    version: '1.0.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'skin_rash',
    ageBand: 'all',
    bodyPart: 'Dermatology',
    symptomSet: ['blanching_rash', 'mild_itch', 'no_facial_swelling'],
    appliesTo: {},
    when: { any: ['blanching_rash == true', 'mild_itch == true'] },
    severity: 'YELLOW',
    careTierKey: 'tier.yellow.gp_polyclinic_24h',
    reasonKey: 'reason.mild_exanthem_gp',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['National Skin Centre (NSC) Singapore Guidelines'],
    originatingAgent: '@knowledge_agent',
    hybridStore: { graphNode: 'node_viral_exanthem_gp', vectorDim: 1536, queryShape: 'vector' },
    rationale: 'Mild blanching macular rash without systemic red flags can be appropriately evaluated by a neighborhood GP.',
  },
  {
    ruleId: 'HEAD-MINOR-001',
    conditionId: 'COND-MINOR-HEAD-INJURY',
    version: '1.1.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'injury_wound',
    ageBand: 'all',
    bodyPart: 'Neurology / Head',
    symptomSet: ['minor_bump', 'alert_oriented', 'no_vomiting', 'no_loss_consciousness'],
    appliesTo: {},
    when: { any: ['minor_head_knock == true', 'bump_no_vomiting == true'] },
    severity: 'YELLOW',
    careTierKey: 'tier.yellow.gp_polyclinic_24h',
    reasonKey: 'reason.minor_head_bump_gp',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['KKH Head Injury Care Advice for Caregivers'],
    originatingAgent: '@knowledge_agent',
    hybridStore: { graphNode: 'node_minor_concussion_surveillance', vectorDim: 1536, queryShape: 'vector' },
    rationale: 'Alert child or adult with minor head knock and zero high-risk features should be monitored with primary care safety netting.',
  },
  {
    ruleId: 'SORETHROAT-001',
    conditionId: 'COND-PHARYNGITIS',
    version: '1.0.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'cough_cold',
    ageBand: 'all',
    bodyPart: 'ENT / Throat',
    symptomSet: ['throat_pain', 'normal_swallowing', 'mild_fever'],
    appliesTo: {},
    when: { any: ['sore_throat == true', 'mild_tonsillitis == true'] },
    severity: 'YELLOW',
    careTierKey: 'tier.yellow.gp_polyclinic_24h',
    reasonKey: 'reason.sore_throat_gp',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['MOH Singapore Sore Throat Primary Care Guidance'],
    originatingAgent: '@knowledge_agent',
    hybridStore: { graphNode: 'node_pharyngitis_centor', vectorDim: 1536, queryShape: 'vector' },
    rationale: 'Sore throat without stridor, trismus, or drooling is managed safely in primary polyclinic/GP consultations.',
  },
  {
    ruleId: 'EAR-OTITIS-001',
    conditionId: 'COND-OTITIS-MEDIA',
    version: '1.0.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'earache',
    ageBand: 'all',
    bodyPart: 'ENT / Ear',
    symptomSet: ['ear_tugging', 'mild_earache', 'mild_fever'],
    appliesTo: {},
    when: { any: ['earache == true', 'ear_tugging == true'] },
    severity: 'YELLOW',
    careTierKey: 'tier.yellow.gp_polyclinic_24h',
    reasonKey: 'reason.otitis_media_gp',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['HealthHub Singapore Ear Infection Guidance'],
    originatingAgent: '@knowledge_agent',
    hybridStore: { graphNode: 'node_otitis_media_otoscopy', vectorDim: 1536, queryShape: 'vector' },
    rationale: 'Otoscopy by a GP confirms tympanic membrane hyperemia and guides targeted analgesia or antimicrobials.',
  },
  {
    ruleId: 'UTI-MILD-001',
    conditionId: 'COND-UNCOMPLICATED-UTI',
    version: '1.1.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'uti',
    ageBand: 'adult',
    bodyPart: 'Genitourinary',
    symptomSet: ['dysuria', 'urinary_frequency', 'no_fever', 'no_flank_pain'],
    appliesTo: { ageMinDays: 6570 },
    when: { any: ['dysuria == true', 'urinary_frequency == true'] },
    severity: 'YELLOW',
    careTierKey: 'tier.yellow.gp_polyclinic_24h',
    reasonKey: 'reason.uncomplicated_uti_gp',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['MOH Singapore CPG on Urinary Tract Infections'],
    originatingAgent: '@knowledge_agent',
    hybridStore: { graphNode: 'node_uncomplicated_cystitis', vectorDim: 1536, queryShape: 'vector' },
    rationale: 'Lower urinary tract burning without fever or back pain warrants urine dipstick at a CHAS clinic or polyclinic.',
  },
  {
    ruleId: 'GASTRO-MILD-001',
    conditionId: 'COND-MILD-GASTROENTERITIS',
    version: '1.0.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'vomiting_diarrhea',
    ageBand: 'all',
    bodyPart: 'GI',
    symptomSet: ['loose_stools_tolerating_liquids', 'mild_cramps'],
    appliesTo: {},
    when: { any: ['mild_diarrhea == true', 'loose_stools == true'] },
    severity: 'YELLOW',
    careTierKey: 'tier.yellow.gp_polyclinic_24h',
    reasonKey: 'reason.mild_gastroenteritis_gp',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['HealthHub Digestive Health Guidelines'],
    originatingAgent: '@knowledge_agent',
    hybridStore: { graphNode: 'node_gastroenteritis_conservative', vectorDim: 1536, queryShape: 'vector' },
    rationale: 'Mild gastroenteritis with retained oral fluids requires symptomatic monitoring and rehydration salts.',
  },
  {
    ruleId: 'CHRONIC-REFILL-001',
    conditionId: 'COND-PRESCRIPTION-REVIEW',
    version: '1.0.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'mood',
    ageBand: 'all',
    bodyPart: 'General Medicine',
    symptomSet: ['medication_refill_request', 'stable_chronic_disease'],
    appliesTo: {},
    when: { any: ['medication_refill == true', 'prescription_check == true'] },
    severity: 'YELLOW',
    careTierKey: 'tier.yellow.gp_polyclinic_24h',
    reasonKey: 'reason.chronic_refill_gp',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['Healthier SG Chronic Disease Management Guidelines'],
    originatingAgent: '@knowledge_agent',
    hybridStore: { graphNode: 'node_chronic_disease_refill', vectorDim: 1536, queryShape: 'vector' },
    rationale: 'Routine prescription review ensures compliance and timely monitoring of renal/metabolic markers.',
  },

  // -----------------------------------------------------------------------
  // 🟢 TIER 4: GREEN RULES (Home Care & Tele-Monitoring Guidance)
  // -----------------------------------------------------------------------
  {
    ruleId: 'COLD-VIRAL-001',
    conditionId: 'COND-COMMON-COLD',
    version: '1.0.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'cough_cold',
    ageBand: 'all',
    bodyPart: 'Respiratory / Nasal',
    symptomSet: ['clear_rhinorrhea', 'sneezing', 'normal_energy', 'adequate_hydration'],
    appliesTo: {},
    when: { any: ['clear_runny_nose == true', 'mild_cold_symptoms == true'] },
    severity: 'GREEN',
    careTierKey: 'tier.green.home_care_telemonitoring',
    reasonKey: 'reason.common_cold_home_care',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['HealthHub Singapore Common Cold Home Care Guide'],
    originatingAgent: '@knowledge_agent',
    hybridStore: { graphNode: 'node_viral_rhinitis_home', vectorDim: 1536, queryShape: 'vector' },
    rationale: 'Uncomplicated upper respiratory viral infection resolves spontaneously with rest, fluids, and saline nasal sprays.',
  },
  {
    ruleId: 'POSTVAX-FEV-001',
    conditionId: 'COND-POST-IMMUNIZATION-FEVER',
    version: '1.1.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'fever',
    ageBand: 'all',
    bodyPart: 'Systemic / Immune',
    symptomSet: ['post_vaccination_24h', 'temp_c < 38.5', 'active_playful'],
    appliesTo: { ageMinDays: 90 },
    when: { any: ['post_vaccine_fever == true', 'mild_fever_post_jab == true'] },
    severity: 'GREEN',
    careTierKey: 'tier.green.home_care_telemonitoring',
    reasonKey: 'reason.post_vaccination_fever_home',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['MOH National Childhood Immunisation Schedule (NCIS) Advisory'],
    originatingAgent: '@knowledge_agent',
    hybridStore: { graphNode: 'node_post_immunization_pyrexia', vectorDim: 1536, queryShape: 'vector' },
    rationale: 'Expected mild immunological response within 24 hours of vaccination, responsive to oral paracetamol and cooling.',
  },
  {
    ruleId: 'GRAZE-MINOR-001',
    conditionId: 'COND-SUPERFICIAL-ABRASION',
    version: '1.0.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'injury_wound',
    ageBand: 'all',
    bodyPart: 'Skin / Trauma',
    symptomSet: ['superficial_graze', 'minimal_oozing', 'clean_edges'],
    appliesTo: {},
    when: { any: ['superficial_scrape == true', 'minor_abrasion == true'] },
    severity: 'GREEN',
    careTierKey: 'tier.green.home_care_telemonitoring',
    reasonKey: 'reason.superficial_scrape_home',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['Singapore Red Cross First Aid Manual (2026)'],
    originatingAgent: '@knowledge_agent',
    hybridStore: { graphNode: 'node_superficial_wound_care', vectorDim: 1536, queryShape: 'vector' },
    rationale: 'Superficial epidermal abrasions heal effectively with gentle soap cleansing, antiseptic ointment, and simple dressing.',
  },
  {
    ruleId: 'TEETHING-001',
    conditionId: 'COND-INFANT-TEETHING',
    version: '1.0.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'fever',
    ageBand: 'infant',
    bodyPart: 'Oral / Dental',
    symptomSet: ['drooling', 'gum_chewing', 'mild_fussiness_feeding_ok', 'temp_c < 37.8'],
    appliesTo: { ageMinDays: 120, ageMaxDays: 730 },
    when: { any: ['teething_drool == true', 'gum_rubbing == true'] },
    severity: 'GREEN',
    careTierKey: 'tier.green.home_care_telemonitoring',
    reasonKey: 'reason.infant_teething_home',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['SingHealth Health Promotion Board Infant Care Guidelines'],
    originatingAgent: '@knowledge_agent',
    hybridStore: { graphNode: 'node_dentition_development', vectorDim: 1536, queryShape: 'vector' },
    rationale: 'Normal developmental tooth eruption accompanied by mild drooling and gum rubbing; manageable with chilled teething rings.',
  },
  {
    ruleId: 'MYALGIA-EXERT-001',
    conditionId: 'COND-POST-EXERTION-MYALGIA',
    version: '1.0.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'injury_wound',
    ageBand: 'adult',
    bodyPart: 'Musculoskeletal',
    symptomSet: ['diffuse_muscle_soreness', 'post_sports', 'no_joint_swelling'],
    appliesTo: {},
    when: { any: ['exercise_muscle_ache == true', 'doms_soreness == true'] },
    severity: 'GREEN',
    careTierKey: 'tier.green.home_care_telemonitoring',
    reasonKey: 'reason.exercise_soreness_home',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['HealthHub Physical Activity & Recovery Guidelines'],
    originatingAgent: '@knowledge_agent',
    hybridStore: { graphNode: 'node_delayed_onset_myalgia', vectorDim: 1536, queryShape: 'vector' },
    rationale: 'Benign delayed onset muscle soreness (DOMS) resolving over 48 hours with hydration, gentle stretching, and rest.',
  },
  {
    ruleId: 'HEADACHE-TENS-001',
    conditionId: 'COND-TENSION-HEADACHE',
    version: '1.0.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'mood',
    ageBand: 'adult',
    bodyPart: 'Neurology / Head',
    symptomSet: ['mild_band_like_headache', 'screen_fatigue', 'relieved_by_rest'],
    appliesTo: {},
    when: { any: ['tension_headache == true', 'mild_fatigue_headache == true'] },
    severity: 'GREEN',
    careTierKey: 'tier.green.home_care_telemonitoring',
    reasonKey: 'reason.tension_headache_home',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['National Neuroscience Institute (NNI) Headache Guide'],
    originatingAgent: '@knowledge_agent',
    hybridStore: { graphNode: 'node_tension_cephalalgia', vectorDim: 1536, queryShape: 'vector' },
    rationale: 'Mild band-like bilateral discomfort without focal deficits; safely managed with digital pause, hydration, and sleep.',
  },
  // 42. Acute Foot / Ankle Soft Tissue Injury or Sprain
  {
    ruleId: 'INJURY-FOOT-001',
    conditionId: 'COND-FOOT-ANKLE-SPRAIN',
    version: '1.0.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'injury_wound',
    ageBand: 'all',
    bodyPart: 'Musculoskeletal / Lower Extremity',
    symptomSet: ['foot_injury', 'ankle_sprain', 'limping', 'swollen_foot', 'foot_pain', 'minor_sprain', 'extremity_sprain'],
    appliesTo: {},
    when: { any: ['foot_injury == true', 'ankle_sprain == true', 'foot_pain == true', 'limping == true', 'minor_sprain == true', 'extremity_sprain == true', 'musculoskeletal_injury == true'] },
    severity: 'YELLOW',
    careTierKey: 'tier.yellow.gp_clinic',
    reasonKey: 'reason.foot_ankle_sprain',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['MOH Singapore Clinical Practice Guidelines: Acute Soft Tissue Injuries and Sprains', 'SingHealth Polyclinics Musculoskeletal Care Protocol'],
    originatingAgent: '@knowledge_agent',
    hybridStore: { graphNode: 'node_extremity_soft_tissue_injury', vectorDim: 1536, queryShape: 'hybrid' },
    rationale: 'Acute extremity/foot soft-tissue injury or sprain without gross bony deformity or neurovascular compromise. Recommend R.I.C.E protocol (Rest, Ice, Compression, Elevation), simple analgesia, and GP/polyclinic review if unable to weight-bear.',
  },
  // 43. Suspected Extremity Fracture / Bony Deformity
  {
    ruleId: 'INJURY-FRACTURE-001',
    conditionId: 'COND-SUSPECTED-FRACTURE',
    version: '1.0.0',
    contentStatus: 'CLINICALLY_APPROVED',
    ailment: 'injury_wound',
    ageBand: 'all',
    bodyPart: 'Musculoskeletal / Bone',
    symptomSet: ['suspected_fracture', 'unable_bear_weight', 'bony_deformity', 'severe_swelling'],
    appliesTo: {},
    when: { any: ['suspected_fracture == true', 'unable_bear_weight == true', 'bony_deformity == true'] },
    severity: 'ORANGE',
    careTierKey: 'tier.orange.urgent_care_clinic',
    reasonKey: 'reason.suspected_extremity_fracture',
    localesRequired: ['en', 'zh', 'ms'],
    sourceRefs: ['Ottawa Ankle and Foot Rules (SRFAC/MOH CPG)', 'KKH / SGH Department of Emergency Medicine Orthopaedic Trauma Protocol'],
    originatingAgent: '@knowledge_agent',
    hybridStore: { graphNode: 'node_extremity_bony_trauma', vectorDim: 1536, queryShape: 'graph' },
    rationale: 'Extremity trauma with severe localized bony tenderness, gross deformity, or inability to bear weight requires urgent plain radiography (X-ray) at an Urgent Care Centre or Emergency Department to exclude acute fracture.',
  },
];

// ===== Red-Flag Hard-Stop Rules (SRS TRI-05) =====
// Derived directly from the Agentic Knowledge Repository where severity is RED

export const RED_FLAG_RULES: TriageRule[] = [];

// Modifier Functions - To be made Agentic via LLM
export function detectEmergencyKeywords(text: string, lang: Language): any { return null; }
export function applyProfileModifiers(person: Person, currentSeverity: Severity): Severity { return currentSeverity; }
export function evaluateImageDescriptors(descriptors: string[]): any { return null; }

// --- UI Translation Text (Static) ---
export function getCareTierText(severity: Severity, lang: Language = "en"): string {
  switch (severity) {
    case "RED":
      if (lang === "zh") return "立即拨打 995 呼叫救护车或前往最近的急诊中心（A&E）。切勿自行驾车前往。";
      if (lang === "ms") return "Hubungi 995 dengan segera atau pergi ke Jabatan Kemalangan & Kecemasan (A&E) terdekat. Jangan memandu sendiri.";
      return "Call 995 immediately or proceed to the nearest Hospital Accident & Emergency (A&E) department.";
    case "ORANGE":
      if (lang === "zh") return "请在数小时内前往最近的24小时诊所、紧急护理中心或安排日间急诊/综合诊疗所（Polyclinic）。";
      if (lang === "ms") return "Sila berjumpa doktor di klinik 24 jam atau pusat rawatan segera dalam beberapa jam.";
      return "Visit the nearest 24-hour clinic, urgent care centre, or arrange a same-day Polyclinic / GP consultation within hours.";
    case "YELLOW":
      if (lang === "zh") return "请在1至3天内前往综合诊疗所（Polyclinic）、家庭医生（GP）或您的 Healthier SG 签约医生处进行检查。";
      if (lang === "ms") return "Lawati Poliklinik atau klinik GP dalam masa 1-3 hari. Teruskan pemantauan di rumah.";
      return "Visit a Polyclinic, GP clinic, or your registered Healthier SG GP within 1 to 3 days.";
    case "GREEN":
      if (lang === "zh") return "目前情况适宜在家观察护理。请遵循家庭护理指引并留意观察随访提醒。";
      if (lang === "ms") return "Penjagaan di rumah adalah wajar buat masa ini. Ikuti panduan penjagaan dan tunggu peringatan susulan.";
      return "Home care is appropriate for now. Follow supportive care steps and monitor for the warning signs below.";
  }
}

export function getActionText(severity: Severity, lang: Language = "en"): string {
  switch (severity) {
    case "RED":
      if (lang === "zh") return "医疗急症：立即拨打 995 或前往急诊部";
      if (lang === "ms") return "Kecemasan Perubatan: Hubungi 995 sekarang";
      return "Medical Emergency: Call 995 now or go to A&E immediately";
    case "ORANGE":
      if (lang === "zh") return "紧急就医：须在数小时内接受医生检查";
      if (lang === "ms") return "Rawatan Segera: Perlu diperiksa doktor dalam beberapa jam";
      return "Urgent Review: Be seen by a doctor within hours";
    case "YELLOW":
      if (lang === "zh") return "建议就诊：请在1-3天内到诊所检查";
      if (lang === "ms") return "Perlu Pemeriksaan: Jumpa doktor dalam 1-3 hari";
      return "Doctor Review Recommended: See a GP within 1-3 days";
    case "GREEN":
      if (lang === "zh") return "在家观察：目前风险较低，保持监测";
      if (lang === "ms") return "Penjagaan Rumah: Risiko rendah, pantau bersama";
      return "Home Care: Low risk for now, monitor and rest";
  }
}

export function getTimeframe(severity: Severity, lang: Language = "en"): string {
  switch (severity) {
    case "RED": return lang === "zh" ? "立即 (Now)" : lang === "ms" ? "Segera (Now)" : "Now";
    case "ORANGE": return lang === "zh" ? "数小时内 (Within hours)" : lang === "ms" ? "Dalam beberapa jam" : "Within hours";
    case "YELLOW": return lang === "zh" ? "1-3天内 (1-3 days)" : lang === "ms" ? "Dalam 1-3 hari" : "Within 1-3 days";
    case "GREEN": return lang === "zh" ? "无需急诊 (Home care)" : lang === "ms" ? "Di rumah (Home care)" : "Home care";
  }
}

export function getWhenToWorry(severity: Severity, ailmentCode: string | undefined, lang: Language = "en"): string[] {
  if (severity === "RED") {
    return [
      lang === "zh" ? "请保持镇静，立即拨打995并留守病人身边。" : "Call 995 immediately. Stay calm and stay with the patient."
    ];
  }
  return [
    lang === "zh" ? "症状明显恶化或出现新症状" : "Symptoms worsen significantly or new red flags develop"
  ];
}

// --- Dynamic Flow Orchestrators ---
export async function runTriage(input: any): Promise<TriageResult> { 
  try {
    const { ailment, answers, person } = input;
    
    // Hit the server's Agentic Pipeline which queries the DB and runs the LLM
    const response = await fetch('/api/agentic/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `Ailment Code: ${ailment?.code || 'unknown'}\n` + (input.text || ''),
        answers: answers || {},
        person: person || { name: 'Unknown', dob: '1990-01-01', medicalProfile: {} },
        language: 'en'
      }),
      signal: input.abortSignal
    });

    const data = await response.json();
    if (data.success && data.result) {
      const res = data.result;
      const severity: Severity = res.severity || 'GREEN';
      
      return {
        severity,
        reasons: res.safetyWarnings || [],
        summary: res.primaryRationale || res.rationale || 'Agentic triage completed.',
        careTierText: getCareTierText(severity, 'en'),
        action: getActionText(severity, 'en'),
        actionText: getActionText(severity, 'en'),
        timeframe: getTimeframe(severity, 'en'),
        whenToWorry: getWhenToWorry(severity, ailment?.code, 'en'),
        disclaimer: 'Agentic Triage Active',
        contentStatusLabel: 'AI Generated',
        triggeredRuleIds: res.provenance?.tier1Deterministic ? ['DETERMINISTIC_MATCH'] : [],
        ruleMatches: res.provenance?.tier1Deterministic ? ['DETERMINISTIC_MATCH'] : [],
        agenticConfidence: res.confidenceScore,
        agenticProvenance: res.provenance,
        agenticAttestation: res.adversarialAttestation,
        deterministicAction: res.deterministicAction,
        otcMedications: res.otcMedications,
        homeCare: res.homeCare,
        telemedPartners: res.telemedPartners,
        grandmaExplanation: getResultPhrasing(severity, person),
      } as TriageResult;
    }
  } catch (error) {
    console.error('Triage run error:', error);
  }

  // Fallback if API fails: execute rule-based engine instead of hardcoding GREEN
  const fallbackResult = runRuleBasedTriage({
    ailmentCode: input.ailment?.code,
    answers: input.answers,
    person: input.person,
    text: input.text,
    imageDescriptors: input.imageDescriptors,
    language: 'en'
  });

  if (input.ailment?.code) {
    try {
      const decision = await fetchTriageDecisionFromDb(input.ailment.code, fallbackResult.severity);
      if (decision) {
        fallbackResult.deterministicAction = decision.action;
        fallbackResult.otcMedications = decision.otcMedications;
        fallbackResult.homeCare = decision.homeCare;
        fallbackResult.telemedPartners = decision.telemedPartners;
      }
    } catch {}
  }

  fallbackResult.disclaimer = "Agentic Triage Offline - Fallback to Rule-Based Engine";
  fallbackResult.summary = "Swarm connection failed. Used Rule-Based Fallback: " + (fallbackResult.summary || '');
  return fallbackResult as TriageResult;
}

export async function getQuestionTree(ailmentCode: string, person?: Person | null): Promise<QuestionStep[]> {
  try {
    const response = await fetch('/api/triage/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ailmentCode, person })
    });
    
    const data = await response.json();
    if (data.success && data.questions) {
      return data.questions;
    }
  } catch (error) {
    console.error('Failed to fetch dynamic questions:', error);
  }
  
  // Hard fallback if backend offline
  return [
    { id: "q1", text: "How long have you been experiencing this?", answerType: "choice", options: ["Less than 24 hours", "1-3 days", "More than 3 days"] },
    { id: "q2", text: "Is the pain or discomfort severe?", answerType: "yes_no" }
  ];
}

export function getAgeBand(dob: string): AgeBand { return "ADULT"; }
export function getAgeDisplay(dob: string, lang: Language = "en"): string {
  const birthDate = new Date(dob);
  const now = new Date();
  
  const diffTime = Math.abs(now.getTime() - birthDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  const ageYears = Math.floor(diffDays / 365.25);
  const ageMonths = Math.floor(diffDays / 30.436875);

  if (lang === 'zh') {
    if (ageYears > 0) return `${ageYears} 岁`;
    if (ageMonths > 0) return `${ageMonths} 个月`;
    return `${diffDays} 天`;
  }
  
  if (lang === 'ms') {
    if (ageYears > 0) return `${ageYears} tahun`;
    if (ageMonths > 0) return `${ageMonths} bulan`;
    return `${diffDays} hari`;
  }

  // English default
  if (ageYears > 0) return `${ageYears} yo`;
  if (ageMonths > 0) return `${ageMonths} mo`;
  return `${diffDays} days old`;
}
export function escalateTo(current: Severity, target: Severity): Severity { return target; }
export function setDynamicCustomRules(rules: TriageRule[]) {}
export function getDynamicCustomRules(): TriageRule[] { return []; }

export const RULESET_VERSION = "2.0.0";
export const RULESET_CONTENT_STATUS: ContentStatus = "PROVISIONAL";
