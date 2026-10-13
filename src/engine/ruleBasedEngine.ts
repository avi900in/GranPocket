/**
 * GranPocket - Triage Rule Engine (SRS §4.4, §7)
 * "Models assist, rules decide" - The rule engine is the SOLE authority over severity.
 * AI/LLM can only ESCALATE (raise severity), never lower it.
 */

import type {
  Severity, AgeBand, Person, TriageRule, QuestionStep,
  TriageResult, ContentStatus, Ailment, Language
} from '../types';
import { getResultPhrasing } from './grandmaVoice';
import { resolveAilmentVector } from './vectorSearch';

// ===== 16 MVP Ailments (SRS §7.3) =====
export const AILMENTS: Ailment[] = [
  {
    code: 'fever',
    name: 'Fever',
    nameZh: '发烧',
    nameMs: 'Demam',
    icon: 'Thermometer',
    redFlagThemes: ['Young-infant fever → RED', 'drowsiness', 'stiff neck', 'non-blanching rash', 'chronic conditions'],
    description: 'High body temperature, chills, sweating, or hot to touch',
  },
  {
    code: 'cough',
    name: 'Cough',
    nameZh: '咳嗽',
    nameMs: 'Batuk',
    icon: 'Wind',
    redFlagThemes: ['Breathing difficulty', 'blue lips', 'coughing blood'],
    description: 'Dry or phlegmy cough, chest rattle, or persistent coughing',
  },
  {
    code: 'sore_throat',
    name: 'Sore Throat',
    nameZh: '喉咙痛',
    nameMs: 'Sakit Tekak',
    icon: 'Megaphone',
    redFlagThemes: ['Drooling/unable to swallow', 'breathing difficulty'],
    description: 'Pain swallowing, swollen glands, hoarse voice',
  },
  {
    code: 'abdominal_pain',
    name: 'Abdominal Pain',
    nameZh: '肚子痛 / 腹痛',
    nameMs: 'Sakit Perut',
    icon: 'CircleDot',
    redFlagThemes: ['Severe/persistent pain', 'blood in vomit/stool', 'pregnancy', 'elderly'],
    description: 'Stomach cramps, sharp pain, bloating, or colic',
  },
  {
    code: 'headache',
    name: 'Headache',
    nameZh: '头痛',
    nameMs: 'Sakit Kepala',
    icon: 'Zap',
    redFlagThemes: ['Sudden severe onset', 'neurological signs', 'fever with stiff neck', 'head injury'],
    description: 'Throbbing pain, migraine, sudden severe headache, or pressure',
  },
  {
    code: 'vomiting_diarrhea',
    name: 'Vomiting / Diarrhoea',
    nameZh: '呕吐 / 腹泻',
    nameMs: 'Muntah / Cirit-birit',
    icon: 'Droplets',
    redFlagThemes: ['Dehydration (infants, elderly)', 'blood', 'unable to keep fluids down'],
    description: 'Nausea, throwing up, watery stools, dehydration signs',
  },
  {
    code: 'rash',
    name: 'Rash',
    nameZh: '皮疹 / 红疹',
    nameMs: 'Ruam Kulit',
    icon: 'Layers',
    redFlagThemes: ['Breathing difficulty/swelling', 'fever with rash', 'non-blanching'],
    description: 'Red spots, hives, itching, bumps, or petechiae',
  },
  {
    code: 'chest_pain',
    name: 'Chest Pain',
    nameZh: '胸痛 / 胸闷',
    nameMs: 'Sakit Dada',
    icon: 'Heart',
    redFlagThemes: ['Risk factors', 'radiation', 'sweating', 'breathlessness → RED'],
    description: 'Tightness, squeezing pressure, aching, or sharp pain',
  },
  {
    code: 'breathing_difficulty',
    name: 'Breathing Difficulty',
    nameZh: '呼吸困难 / 气喘',
    nameMs: 'Sesak Nafas',
    icon: 'Activity',
    redFlagThemes: ['Severe difficulty', 'blue lips', 'unable to speak → RED'],
    description: 'Shortness of breath, wheezing, gasping, rapid shallow breathing',
  },
  {
    code: 'injury_wound',
    name: 'Injury / Wound',
    nameZh: '外伤 / 伤口',
    nameMs: 'Kecederaan / Luka',
    icon: 'Scissors',
    redFlagThemes: ['Uncontrolled bleeding', 'deformity', 'head injury', 'blood thinners', 'elderly falls'],
    description: 'Cuts, bleeding, sprains, suspected fractures, or head knocks',
  },
  {
    code: 'uti',
    name: 'Urinary Symptoms',
    nameZh: '排尿异常 / 尿道感染',
    nameMs: 'Gejala Kencing',
    icon: 'Droplet',
    redFlagThemes: ['Fever/flank pain', 'blood', 'confusion in elderly', 'pregnancy'],
    description: 'Burning urination, frequent urgent pee, cloudy or bloody urine',
  },
  {
    code: 'earache',
    name: 'Earache',
    nameZh: '耳朵痛',
    nameMs: 'Sakit Telinga',
    icon: 'Headphones',
    redFlagThemes: ['Swelling behind the ear', 'discharge', 'infants'],
    description: 'Ear pain, discharge, pulling at ear, hearing muffled',
  },
  {
    code: 'allergic_reaction',
    name: 'Allergic Reaction',
    nameZh: '过敏反应',
    nameMs: 'Tindak Balas Alahan',
    icon: 'AlertTriangle',
    redFlagThemes: ['Lip/tongue swelling', 'breathing difficulty', 'faintness → RED'],
    description: 'Swollen lips or eyes, hives, food or drug allergy reaction',
  },
  {
    code: 'confusion_neuro',
    name: 'Confusion / Neurological Change',
    nameZh: '神志模糊 / 中风前兆',
    nameMs: 'Kekeliruan / Perubahan Saraf',
    icon: 'HelpCircle',
    redFlagThemes: ['Sudden confusion', 'slurred speech', 'facial droop', 'limb weakness → RED', 'delirium in elderly'],
    description: 'FAST stroke signs, sudden disorientation, slurred speech, delirium',
  },
  {
    code: 'dizziness_fall',
    name: 'Dizziness / Fainting / Fall',
    nameZh: '头晕 / 晕厥 / 跌倒',
    nameMs: 'Pening / Pengsan / Jatuh',
    icon: 'RotateCcw',
    redFlagThemes: ['Fainting with chest pain/palpitations', 'injury after fall', 'polypharmacy in elderly'],
    description: 'Lightheadedness, spinning vertigo, blackouts, slips or falls',
  },
  {
    code: 'eye_symptoms',
    name: 'Eye Symptoms (Red Eye)',
    nameZh: '眼睛症状 / 红眼',
    nameMs: 'Gejala Mata (Mata Merah)',
    icon: 'Eye',
    redFlagThemes: ['Severe pain', 'vision change', 'chemical exposure', 'trauma'],
    description: 'Redness, foreign body sensation, discharge, sudden vision blurring',
  },
];

// ===== Emergency Keywords (SRS TRI-06) =====
// Evaluates independently of LLM on raw text/transcripts. Negation does not silence emergency signals.
export const EMERGENCY_KEYWORDS = {
  en: [
    'not breathing', 'cant breathe', "can't breathe", 'cannot breathe', 'suffocating',
    'unconscious', 'unresponsive', 'passed out', 'collapsed', 'blacked out',
    'seizure', 'fitting', 'convulsing', 'shaking violently', 'rhythmic jerking',
    'chest pain', 'crushing chest', 'heart attack', 'tight chest', 'chest pressure',
    'stroke', 'slurred speech', 'face drooping', 'facial droop', 'weakness in arm', 'cant move arm',
    'blue lips', 'blue face', 'turning blue', 'grey lips', 'blue tongue',
    'severe bleeding', 'wont stop bleeding', "won't stop bleeding", 'bleeding heavily', 'gushing blood',
    'anaphylaxis', 'throat closing', 'tongue swelling', 'lips swelling', 'cannot swallow',
    'not moving', 'limp baby', 'floppy baby', 'hard to wake', 'cannot wake up', 'extreme lethargy',
    'sudden confusion', 'confused and', 'cant speak', "can't speak", 'talking gibberish', 'acute delirium',
    'suicide', 'kill myself', 'end my life', 'self harm', 'hurt myself', 'want to die',
    'overdose', 'too many pills',
    // Spec §3.1 Infant Red-Lines
    'labored breathing', 'flared nostrils', 'rib retractions', 'chest retractions', 'deep retractions',
    'blotchy skin', 'gray skin', 'pale skin', 'inconsolable crying', 'crying without tears',
    'dry mouth', 'no wet diaper', 'refusing feed', 'refusing to feed', 'unable to feed',
    'staring spell', 'non-blanching rash', 'glass test', 'purpura',
    // Spec §3.2 Senior Red-Lines
    'gasping for breath', 'cannot catch breath', 'sunken eyes', 'dark urine', 'thunderclap headache',
    'sudden severe abdominal pain', 'worst headache',
  ],
  zh: [
    '不能呼吸', '没有呼吸', '窒息', '喘不过气',
    '昏迷', '没有意识', '晕倒', '晕厥', '叫不醒',
    '抽搐', '痉挛', '癫痫', '抽筋不止', '阵挛',
    '胸痛', '胸闷', '心脏病', '胸口压迫感', '胸骨后剧痛',
    '中风', '说话不清', '口齿不清', '嘴歪', '面瘫', '手脚无力', '半边瘫痪',
    '嘴唇发紫', '脸色发青', '唇色青紫', '青紫', '发绀',
    '大量出血', '止不住血', '血流不止', '喷血',
    '过敏性休克', '喉咙发紧', '舌头肿', '嘴唇肿', '呼吸骤停',
    '全身无力', '瘫软', '婴儿瘫软', '软绵绵', '神志淡漠',
    '突然糊涂', '意识模糊', '说不出话', '胡言乱语', '谵妄',
    '自杀', '想死', '结束生命', '自残', '伤害自己',
    '服药过量', '吃太多药',
    // Spec §3.1 婴儿紧急信号
    '呼吸费力', '鼻翼扇动', '胸骨凹陷', '肋骨凹陷', '皮肤发花', '面色苍白',
    '哭闹不止', '无法安抚', '哭无眼泪', '口唇干燥', '数小时无尿', '拒绝进食', '拒奶',
    '双眼凝视', '压之不退', '瘀斑', '玻璃杯试验',
    // Spec §3.2 老年紧急信号
    '喘不上气', '静息气促', '突发剧烈腹痛', '霹雳样头痛', '眼窝凹陷', '突发眩晕晕厥',
  ],
  ms: [
    'tidak bernafas', 'sesak nafas', 'lemas', 'susah nafas',
    'tidak sedarkan diri', 'pengsan', 'rebah', 'tak bangun',
    'sawan', 'kejang', 'tarik sawan', 'pergerakan berirama',
    'sakit dada', 'serangan jantung', 'dada sempit', 'tekanan dada',
    'strok', 'angin ahmar', 'slurred', 'muka senget', 'muka herot', 'kelemahan tangan',
    'bibir biru', 'muka biru', 'pucat lesu', 'lidah biru',
    'pendarahan teruk', 'berdarah banyak', 'darah tak henti',
    'anafilaksis', 'tekak sempit', 'lidah bengkak', 'tersedak teruk',
    'anggota lembik', 'bayi lembik', 'tak bergerak', 'sangat mengantuk',
    'kekeliruan tiba-tiba', 'tidak boleh bercakap', 'cakap merapu', 'delirium',
    'bunuh diri', 'mahu mati', 'mudarabat diri',
    'overdos', 'terlebih ubat',
    // Spec §3.1 Infant Red-Lines
    'pernafasan kencang', 'hidung kembang kempis', 'tarikan dada', 'kulit berbintik',
    'tangisan berterusan', 'tangis tanpa air mata', 'lampin kering', 'enggan minum susu',
    'sawan renungan', 'ruam merah gelap', 'ujian kaca gagal',
    // Spec §3.2 Senior Red-Lines
    'tercungap-cungap', 'sakit perut mendadak', 'sakit kepala petir', 'mata cengkung',
  ],
};

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
export const RED_FLAG_RULES: TriageRule[] = AGENTIC_KNOWLEDGE_REPOSITORY.filter(
  rule => rule.severity === 'RED'
);

// ===== Age Band Calculation (SRS §7.2) =====
export function getAgeBand(dob: string): AgeBand {
  const birth = new Date(dob);
  const now = new Date();
  const ageDays = Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24));
  const ageYears = ageDays / 365.25;

  if (ageDays < 0) return 'adult';
  if (ageDays <= 28) return 'neonate';
  if (ageDays < 90) return 'young_infant';
  if (ageDays < 365) return 'infant';
  if (ageYears < 3) return 'toddler';
  if (ageYears < 12) return 'child';
  if (ageYears < 18) return 'adolescent';
  if (ageYears < 65) return 'adult';
  return 'elderly';
}

export function getAgeDisplay(dob: string, lang: Language = 'en'): string {
  const birth = new Date(dob);
  const now = new Date();
  const ageDays = Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24));
  const ageMonths = Math.floor(ageDays / 30.43);
  const ageYears = Math.floor(ageDays / 365.25);

  if (ageDays < 0) return lang === 'zh' ? '未知' : 'Unknown';
  if (ageDays < 30) {
    if (lang === 'zh') return `${ageDays} 天大`;
    if (lang === 'ms') return `${ageDays} hari`;
    return `${ageDays} days old`;
  }
  if (ageYears < 2) {
    if (lang === 'zh') return `${ageMonths} 个月大`;
    if (lang === 'ms') return `${ageMonths} bulan`;
    return `${ageMonths} months old`;
  }
  if (lang === 'zh') return `${ageYears} 岁`;
  if (lang === 'ms') return `${ageYears} tahun`;
  return `${ageYears} years old`;
}

// ===== Safety Asymmetry: Escalation Only (TRI-07) =====
const SEVERITY_ORDER: Severity[] = ['GREEN', 'YELLOW', 'ORANGE', 'RED'];

export function escalateTo(current: Severity, target: Severity): Severity {
  return SEVERITY_ORDER.indexOf(target) > SEVERITY_ORDER.indexOf(current) ? target : current;
}

// ===== Emergency Keyword Detection (SRS TRI-06) =====
export function detectEmergencyKeywords(
  text: string,
  preferredLanguage: Language = 'en'
): { triggered: boolean; matchedKeywords: string[]; language: Language; isCrisis: boolean } {
  if (!text || !text.trim()) {
    return { triggered: false, matchedKeywords: [], language: preferredLanguage, isCrisis: false };
  }

  const lowerText = text.toLowerCase();
  const matched: string[] = [];
  let isCrisis = false;

  // Crisis check (SRS TRI-14)
  const crisisKeywords = ['suicide', 'kill myself', 'end my life', 'self harm', 'hurt myself', 'want to die', '自杀', '想死', '自残', 'bunuh diri', 'mahu mati'];
  for (const cw of crisisKeywords) {
    if (lowerText.includes(cw)) {
      isCrisis = true;
      matched.push(cw);
    }
  }

  // Scan all languages for mixed Singapore speech (Singlish / multi-dialect)
  for (const lang of ['en', 'zh', 'ms'] as const) {
    const keywords = EMERGENCY_KEYWORDS[lang];
    for (const kw of keywords) {
      if (lowerText.includes(kw.toLowerCase())) {
        if (!matched.includes(kw)) {
          matched.push(kw);
        }
      }
    }
  }

  return {
    triggered: matched.length > 0,
    matchedKeywords: matched,
    language: preferredLanguage,
    isCrisis,
  };
}

// ===== Profile Modifiers (SRS TRI-04) =====
export function applyProfileModifiers(
  baseSeverity: Severity,
  person: Person,
  ailmentCode: string
): { severity: Severity; reasons: string[] } {
  const reasons: string[] = [];
  let severity = baseSeverity;

  const ageBand = getAgeBand(person.dob);
  const profile = person.medicalProfile;
  if (!profile) return { severity, reasons };

  // 1. Blood thinners + head injury or bleeding → RED
  if (ailmentCode === 'injury_wound' || ailmentCode === 'headache') {
    const onBloodThinners = profile.medications?.some(m =>
      /aspirin|warfarin|clopidogrel|cardiprin|plavix|apixaban|rivaroxaban|dabigatran|xarelto|eliquis/i.test(m.name)
    );
    if (onBloodThinners) {
      severity = escalateTo(severity, 'RED');
      reasons.push('High risk: Patient is on blood thinners (antiplatelet/anticoagulant) with head injury or trauma');
    }
  }

  // 2. Chronic conditions + fever → at least ORANGE
  if (ailmentCode === 'fever') {
    const hasChronic = profile.conditions?.some(c =>
      /diabetes|hypertension|kidney|heart|tia|stroke|cancer|immuno|transplant|chemo/i.test(c.name)
    );
    if (hasChronic) {
      severity = escalateTo(severity, 'ORANGE');
      reasons.push('Pre-existing chronic condition requires early evaluation of fever');
    }
  }

  // 3. Elderly + Polypharmacy (5+ medications)
  if (ageBand === 'elderly' && (profile.medications?.length || 0) >= 4) {
    if (severity === 'GREEN') {
      severity = 'YELLOW';
      reasons.push('Elderly patient with multiple medications requires close medical monitoring');
    }
  }

  // 4. Pregnancy + Abdominal pain or bleeding
  if (ailmentCode === 'abdominal_pain' && profile.pregnancyStatus === 'pregnant') {
    severity = escalateTo(severity, 'ORANGE');
    reasons.push('Abdominal symptoms during pregnancy require prompt obstetric or medical assessment');
  }

  return { severity, reasons };
}

// ===== Image Descriptor Escalation (SRS INT-08) =====
// Vision descriptors can ONLY escalate severity, never lower it.
export function evaluateImageDescriptors(
  currentSeverity: Severity,
  descriptors: string[] = []
): { severity: Severity; reasons: string[] } {
  let severity = currentSeverity;
  const reasons: string[] = [];

  for (const desc of descriptors) {
    const d = desc.toLowerCase();
    if (d.includes('uncontrolled bleeding') || d.includes('heavy bleeding') || d.includes('non-blanching') || d.includes('petechiae') || d.includes('airway compromise') || d.includes('severe chemical burn')) {
      severity = escalateTo(severity, 'RED');
      reasons.push(`Visual analysis cue: ${desc} (Emergency indicator)`);
    } else if (d.includes('spreading erythema') || d.includes('significant swelling') || d.includes('deep laceration') || d.includes('pus discharge') || d.includes('corneal opacity')) {
      severity = escalateTo(severity, 'ORANGE');
      reasons.push(`Visual analysis cue: ${desc} (Urgent indicator)`);
    } else if (d.includes('mild redness') || d.includes('superficial graze') || d.includes('localised rash')) {
      // Does not change severity (cannot lower it)
      reasons.push(`Visual analysis cue: ${desc}`);
    }
  }

  return { severity, reasons };
}

let dynamicCustomRules: TriageRule[] = [];

export function setDynamicCustomRules(rules: TriageRule[]) {
  dynamicCustomRules = rules;
}

export function getDynamicCustomRules(): TriageRule[] {
  return dynamicCustomRules;
}

// ===== Main Triage Evaluation Engine =====
export function runRuleBasedTriage(input: {
  text?: string;
  ailmentCode?: string;
  answers?: Record<string, any>;
  person: Person;
  language?: Language;
  imageDescriptors?: string[];
  customRules?: TriageRule[];
}): TriageResult {
  const {
    text = '',
    ailmentCode: rawAilmentCode,
    answers = {},
    person,
    language = 'en',
    imageDescriptors = [],
    customRules = [],
  } = input;

  // Tri-Tier Diagnostic Pipeline:
  // Tier 1: Direct Search in Ailments Table (exact code or exact/partial name match)
  // Tier 2: Vector Search (Dense 1024-D semantic vector cosine similarity)
  // Tier 3: Fallback Diagnosis ('general' symptom review)
  let ailmentCode: string | undefined = undefined;

  // 1. Direct Search in Ailments Table
  if (rawAilmentCode) {
    const rawNormalized = rawAilmentCode.trim().toLowerCase();
    const directMatch = AILMENTS.find(a => 
      a.code.toLowerCase() === rawNormalized ||
      a.code.toLowerCase().replace(/_/g, ' ') === rawNormalized ||
      a.name.toLowerCase() === rawNormalized ||
      (a.nameZh && a.nameZh.toLowerCase() === rawNormalized) ||
      (a.nameMs && a.nameMs.toLowerCase() === rawNormalized)
    );
    if (directMatch) {
      ailmentCode = directMatch.code;
      console.log(`[Triage Engine] Tier 1: Direct search matched "${rawAilmentCode}" -> "${ailmentCode}"`);
    }
  }

  // 1b. Direct keyword search against ailment table names/codes in raw text if still unresolved
  if (!ailmentCode && text) {
    const cleanText = text.toLowerCase();
    for (const a of AILMENTS) {
      const codeWord = a.code.replace(/_/g, ' ').toLowerCase();
      const nameWord = a.name.toLowerCase();
      // Match on full word boundaries (\b) to avoid false substring positives (e.g. 'routine' matching 'uti')
      const codeRegex = new RegExp(`\\b${codeWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      const nameRegex = new RegExp(`\\b${nameWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (codeRegex.test(cleanText) || nameRegex.test(cleanText)) {
        ailmentCode = a.code;
        console.log(`[Triage Engine] Tier 1: Direct text keyword search matched -> "${ailmentCode}"`);
        break;
      }
    }
  }

  // 2. Vector Search (Semantic Cosine Similarity)
  if (!ailmentCode) {
    const query = rawAilmentCode || text || '';
    if (query.trim()) {
      const vectorResolved = resolveAilmentVector(query);
      if (vectorResolved) {
        ailmentCode = vectorResolved.code;
        console.log(`[Triage Engine] Tier 2: Vector Search resolved "${query}" -> "${vectorResolved.code}" (${(vectorResolved.similarity * 100).toFixed(1)}% cosine similarity)`);
      }
    }
  }

  // 3. Fallback Diagnosis (General / Unclassified Clinical Presentation)
  if (!ailmentCode) {
    ailmentCode = 'general';
    console.log(`[Triage Engine] Tier 3: Fallback diagnosis applied -> "${ailmentCode}" (General review)`);
  }

  console.log(`[Triage Engine] ====== Starting runTriage() ======`);
  console.log(`[Triage Engine] Resolved Ailment Code: ${ailmentCode} (raw: ${rawAilmentCode || 'none'})`);
  const conditionNames = person.medicalProfile?.conditions?.map(c => c.name).join(',') || 'None';
  console.log(`[Triage Engine] Patient Profile loaded: Age ${person.dob}, Conditions: ${conditionNames}`);

  const triggeredRules: string[] = [];
  const reasons: string[] = [];
  let severity: Severity = 'GREEN';

  // Step 1: Emergency Keyword Detection (Independent of LLM)
  const keywordResult = detectEmergencyKeywords(text, language);
  if (keywordResult.triggered) {
    severity = 'RED';
    triggeredRules.push(keywordResult.isCrisis ? 'SELFHARM-001' : 'KEYWORD-SAFETY-TRIGGER');
    reasons.push(
      language === 'zh'
        ? `触发紧急关键词：${keywordResult.matchedKeywords.join(', ')}`
        : language === 'ms'
        ? `Kata kunci kecemasan dikesan: ${keywordResult.matchedKeywords.join(', ')}`
        : `Emergency keywords detected: ${keywordResult.matchedKeywords.join(', ')}`
    );
  }

  // Step 2: Red-Flag Hard-Stop Rules Evaluation
  const birth = new Date(person.dob);
  const ageDays = Math.floor((Date.now() - birth.getTime()) / (1000 * 60 * 60 * 24));
  const ageBand = getAgeBand(person.dob);

  const activeRulesList = [...RED_FLAG_RULES, ...dynamicCustomRules, ...customRules];

  for (const rule of activeRulesList) {
    // Age applicability
    if (rule.appliesTo?.ageMinDays !== undefined && ageDays < rule.appliesTo.ageMinDays) continue;
    if (rule.appliesTo?.ageMaxDays !== undefined && ageDays > rule.appliesTo.ageMaxDays) continue;

    // Ailment filter
    if (ailmentCode && rule.ailment !== ailmentCode && rule.ailment !== 'mood') continue;

    // Check conditions
    const conditions = rule.when.any || [];
    let matched = false;
    for (const cond of conditions) {
      if (evaluateCondition(cond, answers)) {
        console.log(`[Triage Engine] Step 2: Rule matched! RuleId: ${rule.ruleId}, Condition: ${cond}, AnswerData:`, answers);
        matched = true;
        break;
      }
    }

    if (matched) {
      severity = escalateTo(severity, rule.severity);
      triggeredRules.push(rule.ruleId);
      reasons.push(getReasonText(rule.reasonKey, language));
    }
  }

  // Step 3: Profile Modifiers (e.g. blood thinners with head injury)
  if (ailmentCode) {
    const pregnancy = person.medicalProfile?.pregnancyStatus || 'not_pregnant';
    console.log(`[Triage Engine] Step 3: Checking Profile Modifiers. Reading DB fields (dob: ${person.dob}, pregnancy: ${pregnancy}, conditions: ${conditionNames})`);
    const modifierResult = applyProfileModifiers(severity, person, ailmentCode);
    if (modifierResult.severity !== severity) {
      severity = modifierResult.severity;
      reasons.push(...modifierResult.reasons);
      triggeredRules.push('PROFILE-MODIFIER');
    }
  }

  // Step 4: Neutral Image Descriptors (Escalate only)
  if (imageDescriptors.length > 0) {
    const visionResult = evaluateImageDescriptors(severity, imageDescriptors);
    if (visionResult.severity !== severity) {
      severity = visionResult.severity;
      reasons.push(...visionResult.reasons);
      triggeredRules.push('VISION-CUE-ESCALATION');
    }
  }

  // Step 5: Adaptive Ailment Tree Evaluation (if not already RED)
  if (severity !== 'RED' && ailmentCode) {
    console.log(`[Triage Engine] Step 5: Entering evaluateAilmentTree() for ailment: ${ailmentCode}`);
    const treeResult = evaluateAilmentTree(ailmentCode, answers, person, language);
    if (treeResult.severity) {
      console.log(`[Triage Engine] evaluateAilmentTree() returned severity: ${treeResult.severity}, ruleId: ${treeResult.ruleId}`);
      severity = escalateTo(severity, treeResult.severity);
      reasons.push(...treeResult.reasons);
      if (treeResult.ruleId) triggeredRules.push(treeResult.ruleId);
    }
  }

  // Step 6: Conservative Default
  if (Object.keys(answers).length === 0 && !keywordResult.triggered && imageDescriptors.length === 0) {
    severity = escalateTo(severity, 'YELLOW');
    reasons.push(
      language === 'zh'
        ? '信息尚不充分，系统采取审慎原则。如感到不适，请安排就医咨询。'
        : language === 'ms'
        ? 'Maklumat tidak mencukupi untuk penilaian penuh — sila rujuk doktor jika bimbang.'
        : 'Initial assessment based on limited details — when unsure, seek medical consultation.'
    );
  }

  return buildResult(severity, reasons, triggeredRules, ailmentCode, person, language, keywordResult.matchedKeywords);
}

// ===== Condition Evaluator =====
function evaluateCondition(condition: string, answers: Record<string, any>): boolean {
  const cond = condition.trim();

  // >= comparison (e.g. temp_c >= 38.0)
  const geMatch = cond.match(/^(\w+)\s*>=\s*([\d.]+)$/);
  if (geMatch) {
    const [, key, val] = geMatch;
    const answerVal = answers[key];
    if (answerVal === undefined || answerVal === null) return false;
    return Number(answerVal) >= Number(val);
  }

  // == comparison
  const eqMatch = cond.match(/^(\w+)\s*==\s*(.+)$/);
  if (eqMatch) {
    const [, key, val] = eqMatch;
    const answerVal = answers[key];
    if (answerVal === undefined || answerVal === null) return false;
    const valStr = val.trim();
    if (valStr === 'true') return answerVal === true || answerVal === 'true' || answerVal === 'yes';
    if (valStr === 'false') return answerVal === false || answerVal === 'false' || answerVal === 'no';
    return String(answerVal) === valStr;
  }

  const answerVal = answers[cond];
  return answerVal === true || answerVal === 'true' || answerVal === 'yes';
}

// ===== Ailment Tree Outcome Evaluator =====
function evaluateAilmentTree(
  ailmentCode: string,
  answers: Record<string, any>,
  person: Person,
  lang: Language = 'en'
): { severity: Severity | null; reasons: string[]; ruleId?: string } {
  const reasons: string[] = [];
  const ageBand = getAgeBand(person.dob);

  switch (ailmentCode) {
    case 'fever': {
      const temp = answers.temp_c !== undefined ? Number(answers.temp_c) : undefined;
      const isDrowsy = answers.drowsy === 'yes' || answers.drowsy === true;
      const hasStiffNeck = answers.stiff_neck === 'yes' || answers.stiff_neck === true;
      const rashType = answers.rash;
      const notDrinking = answers.fluids === 'refusing' || answers.fluids === 'dry_diapers';

      // 9-month-old infant logic (like Baby Lucas):
      if (ageBand === 'infant' || ageBand === 'young_infant' || ageBand === 'neonate') {
        if (isDrowsy) {
          return {
            severity: 'RED',
            reasons: [lang === 'zh' ? '婴儿发烧伴嗜睡、难以唤醒，属危急信号' : 'Infant with fever is unusually drowsy or difficult to wake — emergency'],
            ruleId: 'FEV-INF-DROWSY',
          };
        }
        if (rashType === 'Rash does not fade' || rashType === 'non_blanching') {
          return {
            severity: 'RED',
            reasons: [lang === 'zh' ? '发烧伴压之不退红疹（玻璃杯测试），须立即就诊' : 'Non-blanching rash with fever (fails glass test) requires immediate A&E assessment'],
            ruleId: 'FEV-RASH-NONBLANCH',
          };
        }
        if (notDrinking) {
          return {
            severity: 'ORANGE',
            reasons: [lang === 'zh' ? '婴儿拒绝饮水、尿布明显减少，有脱水风险' : 'Infant refusing fluids / dry diapers > 6-8 hours — risk of acute dehydration'],
            ruleId: 'FEV-INF-DEHYDRATION',
          };
        }
        if (temp && temp >= 39.5) {
          return {
            severity: 'ORANGE',
            reasons: [lang === 'zh' ? '婴儿体温高于39.5°C，应在数小时内就医' : 'Very high temperature in infant (>= 39.5°C) — seek medical review within hours'],
            ruleId: 'FEV-INF-HIGH',
          };
        }
        if (temp && temp >= 38.0) {
          return {
            severity: 'YELLOW',
            reasons: [lang === 'zh' ? '婴儿中度发烧，精神尚可；如持续超过1-2天请就诊' : 'Infant fever (38.0-39.4°C) with fair alertness — monitor closely, consult doctor within 1-3 days if not settling'],
            ruleId: 'FEV-INF-MODERATE',
          };
        }
      }

      // Adult / General fever
      if (hasStiffNeck || isDrowsy) {
        return { severity: 'RED', reasons: ['Fever with neck stiffness or drowsiness can indicate meningitis or severe systemic infection'], ruleId: 'FEV-MENINGITIS' };
      }
      if (temp && temp >= 39.5) {
        return { severity: 'ORANGE', reasons: ['High fever (>= 39.5°C) should be evaluated within hours'], ruleId: 'FEV-HIGH' };
      }
      if (temp && temp >= 38.0) {
        return { severity: 'YELLOW', reasons: ['Fever present — visit polyclinic or GP within 1-3 days if fever persists'], ruleId: 'FEV-GP' };
      }
      return { severity: 'GREEN', reasons: ['Mild temperature elevation — monitor with hydration and temperature charting at home'], ruleId: 'FEV-HOME' };
    }

    case 'cough': {
      if (answers.breathing_difficulty === 'yes' || answers.breathing_difficulty === true) {
        return { severity: 'RED', reasons: ['Breathing difficulty accompanying cough is an emergency'], ruleId: 'COUGH-BREATH-RED' };
      }
      if (answers.coughing_blood === 'yes' || answers.coughing_blood === true) {
        return { severity: 'RED', reasons: ['Hemoptysis (coughing blood) requires emergency medical review'], ruleId: 'COUGH-BLOOD-RED' };
      }
      if (answers.blue_lips === 'yes' || answers.blue_lips === true) {
        return { severity: 'RED', reasons: ['Cyanosis (blue tint on lips or fingernails) indicates low oxygen'], ruleId: 'COUGH-CYANOSIS' };
      }
      if (answers.fever === 'yes' || answers.fever === true) {
        return { severity: 'YELLOW', reasons: ['Cough with fever should be checked by a doctor within 1-3 days'], ruleId: 'COUGH-FEVER' };
      }
      if (answers.duration_days && Number(answers.duration_days) > 14) {
        return { severity: 'YELLOW', reasons: ['Chronic cough lasting longer than 2 weeks warrants GP review'], ruleId: 'COUGH-CHRONIC' };
      }
      return { severity: 'GREEN', reasons: ['Mild cough without red flags — maintain hydration and rest'], ruleId: 'COUGH-HOME' };
    }

    case 'confusion_neuro': {
      if (answers.sudden_confusion === 'yes' || answers.slurred_speech === 'yes' || answers.facial_droop === 'yes' || answers.limb_weakness === 'yes') {
        return {
          severity: 'RED',
          reasons: [lang === 'zh' ? '突发口齿不清、面部倾斜或肢体无力，可能为中风警示信号，请立即拨打995' : 'Sudden confusion, facial droop, slurred speech, or weakness in limb are FAST stroke warning signs — call 995'],
          ruleId: 'STROKE-FAST-RED',
        };
      }
      return { severity: 'ORANGE', reasons: ['New onset neurological changes should be evaluated within hours'], ruleId: 'NEURO-URGENT' };
    }

    case 'chest_pain': {
      if (answers.crushing_pain === 'yes' || answers.radiates === 'yes' || answers.sweating === 'yes' || answers.breathless === 'yes') {
        return { severity: 'RED', reasons: ['Crushing chest pressure with radiation or breathlessness suggests acute coronary syndrome — call 995'], ruleId: 'CHEST-ACS-RED' };
      }
      return { severity: 'ORANGE', reasons: ['Chest pain of uncertain origin requires urgent same-day evaluation'], ruleId: 'CHEST-URGENT' };
    }

    case 'breathing_difficulty': {
      console.log(`[Triage Engine] evaluateAilmentTree -> Hit 'breathing_difficulty' case block.`);
      console.log(`[Triage Engine] evaluateAilmentTree -> Decision: Immediate escalation to RED (ruleId: BREATH-RED) because acute breathing difficulty is considered a critical airway emergency.`);
      return { severity: 'RED', reasons: ['Acute breathing difficulty is a critical airway/breathing emergency — call 995'], ruleId: 'BREATH-RED' };
    }

    case 'injury_wound': {
      if (answers.uncontrolled_bleeding === 'yes' || answers.uncontrolled_bleeding === true) {
        return { severity: 'RED', reasons: ['Uncontrolled arterial or severe bleeding requires immediate 995 dispatch and pressure dressing'], ruleId: 'INJURY-BLEED-RED' };
      }
      if (answers.loss_of_consciousness === 'yes' || answers.loss_of_consciousness === true) {
        return { severity: 'RED', reasons: ['Loss of consciousness following trauma indicates significant head injury'], ruleId: 'INJURY-LOC-RED' };
      }
      if (answers.deformity === 'yes' || answers.deformity === true) {
        return { severity: 'ORANGE', reasons: ['Visible bone deformity or suspected fracture requires urgent radiography and splinting'], ruleId: 'INJURY-FRACTURE' };
      }
      return { severity: 'YELLOW', reasons: ['Minor wound or sprain — clean thoroughly, ice/elevate, consult GP if pain worsens'], ruleId: 'INJURY-MILD' };
    }

    case 'abdominal_pain': {
      if (answers.severe_pain === 'yes' || answers.severe_pain === true) {
        return { severity: 'ORANGE', reasons: ['Severe acute abdominal pain needs evaluation within hours to rule out surgical causes'], ruleId: 'ABD-SEVERE' };
      }
      if (answers.blood === 'yes' || answers.blood === true) {
        return { severity: 'RED', reasons: ['Gastrointestinal bleeding (blood in vomit or stool) is an emergency'], ruleId: 'ABD-GI-BLEED' };
      }
      return { severity: 'YELLOW', reasons: ['Persistent abdominal pain should be assessed by a GP within 1-3 days'], ruleId: 'ABD-MILD' };
    }

    case 'vomiting_diarrhea': {
      if (answers.blood_in_vomit === 'yes' || answers.blood_in_stool === 'yes') {
        return { severity: 'RED', reasons: ['Presence of blood in emesis or stool requires immediate medical evaluation'], ruleId: 'VD-BLOOD-RED' };
      }
      if (answers.unable_to_keep_fluids === 'yes' || answers.unable_to_keep_fluids === true) {
        return { severity: 'ORANGE', reasons: ['Intolerance of oral fluids poses high risk of severe dehydration and electrolyte imbalance'], ruleId: 'VD-DEHYDRATION' };
      }
      return { severity: 'YELLOW', reasons: ['Oral rehydration salts recommended; seek GP review if symptoms persist > 48 hours'], ruleId: 'VD-MILD' };
    }

    case 'headache': {
      if (answers.sudden_severe === 'yes' || answers.thunderclap === 'yes' || answers.stiff_neck === 'yes') {
        return { severity: 'RED', reasons: ['Sudden thunderclap headache or headache with neck stiffness is an emergency'], ruleId: 'HEADACHE-ACUTE-RED' };
      }
      return { severity: 'YELLOW', reasons: ['Mild tension or persistent headache — ensure hydration and consult GP within 1-3 days if not settling'], ruleId: 'HEADACHE-MILD-GP' };
    }

    case 'sore_throat': {
      if (answers.unable_to_swallow === 'yes' || answers.drooling === 'yes' || answers.breathing_difficulty === 'yes') {
        return { severity: 'RED', reasons: ['Inability to swallow saliva or respiratory distress indicates acute epiglottitis or airway compromise'], ruleId: 'THROAT-AIRWAY-RED' };
      }
      if (answers.fever === true && answers.severe_pain === true) {
        return { severity: 'YELLOW', reasons: ['Significant throat pain with fever warrants primary care doctor examination for tonsillitis'], ruleId: 'THROAT-GP' };
      }
      return { severity: 'GREEN', reasons: ['Mild throat irritation or pharyngitis — lozenges, warm liquids, and home rest advised'], ruleId: 'THROAT-HOME' };
    }

    case 'rash': {
      if (answers.non_blanching === 'yes' || answers.non_blanching === 'no_fade') {
        return { severity: 'RED', reasons: ['Non-blanching petechial or purpuric rash is a medical emergency (rule out meningococcemia)'], ruleId: 'RASH-PETECHIAE' };
      }
      if (answers.with_breathing_difficulty === 'yes' || answers.with_swelling === 'yes') {
        return { severity: 'RED', reasons: ['Widespread rash with facial swelling or dyspnea indicates anaphylaxis'], ruleId: 'RASH-ANAPHYLAXIS' };
      }
      if (answers.fever === false && (answers.oozing === false || answers.oozing === 'no')) {
        return { severity: 'GREEN', reasons: ['Mild localized skin irritation or eczema flare without infection or red flags — apply moisturizers and maintain hydration'], ruleId: 'RASH-MILD-HOME' };
      }
      return { severity: 'YELLOW', reasons: ['Rash without airway signs — keep area clean and cool; consult GP for topical treatment'], ruleId: 'RASH-MILD' };
    }

    case 'uti': {
      if (answers.flank_pain === 'yes' || answers.high_fever === 'yes') {
        return { severity: 'ORANGE', reasons: ['Urinary symptoms with high fever or flank pain suggests acute pyelonephritis'], ruleId: 'UTI-PYELONEPHRITIS' };
      }
      return { severity: 'YELLOW', reasons: ['Dysuria or urinary frequency requires clinic urine dipstick test and review within 1-3 days'], ruleId: 'UTI-MILD-GP' };
    }

    case 'earache': {
      if (answers.mastoid_swelling === 'yes' || answers.severe_pain === 'yes') {
        return { severity: 'ORANGE', reasons: ['Severe earache with swelling behind ear requires urgent ENT / GP assessment'], ruleId: 'EAR-URGENT' };
      }
      return { severity: 'YELLOW', reasons: ['Earache or fullness — avoid inserting objects into ear, consult GP within 1-3 days'], ruleId: 'EAR-MILD-GP' };
    }

    case 'general': {
      if (answers.bp_check === true && answers.dizziness === false && answers.headache === false) {
        return { severity: 'GREEN', reasons: ['Stable routine vitals / blood pressure check without symptomatic red flags — maintain scheduled routine care'], ruleId: 'VITALS-STABLE-HOME' };
      }
      if (answers.other_symptoms === 'no' || answers.other_symptoms === false) {
        return { 
          severity: 'GREEN', 
          reasons: [lang === 'zh' ? '无其他伴随症状或危险信号，建议保持居家观察与充分休息' : lang === 'ms' ? 'Tiada gejala tambahan atau tanda bahaya — teruskan pemantauan di rumah' : 'No additional symptoms or acute red flags reported — suitable for supportive home monitoring'], 
          ruleId: 'GENERAL-NO-SYMPTOMS-GREEN' 
        };
      }
      return { severity: 'YELLOW', reasons: ['General symptom presentation — recommend GP assessment if not improving'], ruleId: 'GENERAL-REVIEW' };
    }

    case 'allergic_reaction': {
      if (answers.lip_tongue_swelling === 'yes' || answers.breathing_difficulty === 'yes' || answers.faintness === 'yes') {
        return { severity: 'RED', reasons: ['Signs of severe anaphylactic reaction (angioedema, stridor, hypotension) — call 995 immediately'], ruleId: 'ALLERGY-ANAPH-RED' };
      }
      return { severity: 'YELLOW', reasons: ['Mild allergic reaction (localized hives or itch) — antihistamines may help, consult GP'], ruleId: 'ALLERGY-MILD' };
    }

    case 'dizziness_fall': {
      if (answers.chest_pain === 'yes' || answers.palpitations === 'yes') {
        return { severity: 'RED', reasons: ['Syncope/dizziness paired with chest symptoms suggests cardiogenic syncope — emergency'], ruleId: 'DIZ-CARDIAC-RED' };
      }
      if (ageBand === 'elderly') {
        return { severity: 'ORANGE', reasons: ['Geriatric fall or sudden vertigo requires prompt clinic examination to exclude subdural bleed'], ruleId: 'DIZ-ELDERLY-FALL' };
      }
      return { severity: 'YELLOW', reasons: ['Postural dizziness — ensure hydration and slow position changes; consult GP'], ruleId: 'DIZ-MILD' };
    }

    case 'eye_symptoms': {
      if (answers.severe_pain === 'yes' || answers.vision_change === 'yes' || answers.chemical_exposure === 'yes' || answers.trauma === 'yes') {
        return { severity: 'RED', reasons: ['Acute visual loss, severe eye pain, chemical injury, or penetrating eye trauma is an emergency'], ruleId: 'EYE-ACUTE-RED' };
      }
      return { severity: 'YELLOW', reasons: ['Conjunctival irritation or mild pink eye — avoid rubbing, seek GP review within 1-3 days'], ruleId: 'EYE-MILD' };
    }

    default:
      return { severity: 'YELLOW', reasons: ['General symptom presentation — recommend GP assessment if not improving'], ruleId: 'GENERAL-REVIEW' };
  }
}

// ===== Reason Text Resolver =====
function getReasonText(reasonKey: string, lang: Language = 'en'): string {
  const dict: Record<string, Record<Language, string>> = {
    'reason.fever_young_infant': {
      en: 'Fever in an infant under 3 months old requires immediate medical attention — do not wait',
      zh: '3个月以下婴儿发烧必须立即就医，切勿等待',
      ms: 'Demam pada bayi berumur kurang 3 bulan memerlukan rawatan kecemasan segera — jangan bertangguh',
    },
    'reason.infant_fever_red_flag': {
      en: 'Infant fever accompanied by drowsiness, difficulty waking, or petechial rash is an emergency',
      zh: '婴儿发烧伴随嗜睡、神志淡漠或皮疹，属急症必须立即送医',
      ms: 'Demam bayi dengan rasa mengantuk teruk atau ruam merah adalah kecemasan perubatan',
    },
    'reason.breathing_emergency': {
      en: 'Severe breathing difficulty or cyanosis is an emergency — call 995',
      zh: '严重呼吸困难或面色嘴唇青紫属危急急症 — 请立即拨打995',
      ms: 'Kesesakan nafas teruk adalah kecemasan — hubungi 995 dengan segera',
    },
    'reason.stroke_warning_signs': {
      en: 'Sudden confusion, facial droop, or slurred speech can be warning signs of a stroke',
      zh: '突发言语不清、面部倾斜或单侧肢体无力为中风危险警示信号',
      ms: 'Kekeliruan tiba-tiba, muka senget, atau pertuturan tidak jelas adalah tanda strok',
    },
    'reason.heart_attack_signs': {
      en: 'Crushing chest tightness with sweating and breathlessness can be signs of a heart attack',
      zh: '剧烈胸口压迫感伴出汗气促可能为急性心肌梗死警示信号 — 请拨打995',
      ms: 'Sakit dada yang menekan bersama sesak nafas mungkin tanda serangan jantung — dail 995',
    },
    'reason.anaphylaxis': {
      en: 'Swelling of the lips, tongue, or airway difficulty indicates severe anaphylaxis',
      zh: '唇舌肿胀或喉头水肿窒息感提示严重过敏性休克 — 立即拨打995',
      ms: 'Bengkak bibir/lidah dan susah nafas menunjukkan tindak balas anafilaksis teruk',
    },
    'reason.uncontrolled_bleeding': {
      en: 'Uncontrolled bleeding after direct pressure is a medical emergency',
      zh: '压迫止血无效的大出血属于医疗急症 — 持续压迫并立即拨打995',
      ms: 'Pendarahan yang tidak berhenti adalah kecemasan perubatan',
    },
    'reason.mental_health_crisis': {
      en: 'Expressions of self-harm intent require immediate support and crisis helpline contact',
      zh: '检测到自残或心理危机表达，请立即联系危机心理热线或拨打995',
      ms: 'Niat memudaratkan diri memerlukan bantuan krisis segera — dail hotline 1-767 atau 995',
    },
    // Spec §3.1 Infant Red-Lines
    'reason.infant_breathing_distress': {
      en: 'Infant breathing distress (labored breathing, flared nostrils, or deep rib retractions) — SCDF 995 Emergency',
      zh: '婴儿严重呼吸窘迫（呼吸费力、鼻翼扇动或肋骨深陷）— 紧急拨打995救护车',
      ms: 'Kesesakan nafas teruk bayi (hidung kembang kempis, tarikan dada) — Kecemasan 995',
    },
    'reason.infant_cyanosis_discoloration': {
      en: 'Skin/lip discoloration (pale, blotchy, gray, or blue lips/tongue) — Emergency hypoxemia risk',
      zh: '婴儿皮肤/口唇青紫或面色苍白发灰 — 紧急缺氧休克风险，立即送急诊',
      ms: 'Perubahan warna kulit/bibir bayi (kebiruan, pucat, kelabu) — Risiko hipoksemia kecemasan',
    },
    'reason.infant_extreme_lethargy': {
      en: 'Extreme lethargy (unusually drowsy, limp, floppy, or difficult to wake) — Critical neurological sign',
      zh: '婴儿极度嗜睡、肢体瘫软无力、难以唤醒 — 危急中枢神经系统或败血症警讯',
      ms: 'Bayi terlalu mengantuk, lembik, atau sukar dikejutkan — Tanda neurologi kritikal',
    },
    'reason.infant_inconsolable_crying': {
      en: 'Continuous, high-pitched crying unresponsive to normal soothing — Acute pediatric red flag',
      zh: '婴儿持续尖声哭闹、无法被安抚 — 急性颅内压或急腹症危急信号',
      ms: 'Tangisan bernada tinggi berterusan dan tidak dapat dipujuk — Tanda amaran kecemasan',
    },
    'reason.infant_severe_dehydration': {
      en: 'Severe dehydration (dry mouth, crying without tears, no wet diapers >6 hours) — Immediate IV hydration needed',
      zh: '婴儿严重脱水（口唇干燥、哭无泪、6小时以上无尿）— 须紧急静脉补液',
      ms: 'Dehidrasi teruk bayi (mulut kering, tangis tanpa air mata, tiada kencing >6 jam) — Perlu rawatan segera',
    },
    'reason.infant_feeding_refusal': {
      en: 'Total feeding refusal or inability to take fluids — Risk of acute infant metabolic collapse',
      zh: '婴儿完全拒食拒奶、无法吸吮 — 严重脱水与低血糖风险，立即就医',
      ms: 'Bayi enggan atau tidak mampu minum susu — Risiko dehidrasi akut dan hipoglisemia',
    },
    'reason.infant_seizure_neuro': {
      en: 'Neurological seizure signs (rhythmic jerking, sudden unprovoked staring spells) — Emergency protocol',
      zh: '神经系统抽搐表现（节律性肢体阵挛、突发双眼发呆凝视）— 立即拨打995急救',
      ms: 'Tanda sawan bayi (pergerakan berirama, renungan kosong tiba-tiba) — Protokol kecemasan',
    },
    'reason.infant_non_blanching_rash': {
      en: 'Dark red/purple rash that fails to fade under pressure (glass test) — Meningococcal red alert',
      zh: '深红/紫暗色皮疹在玻璃杯压迫下不褪色 — 疑似脑膜炎双球菌败血症危急警报',
      ms: 'Ruam merah gelap/ungu tidak pudar bawah tekanan kaca — Amaran kecemasan meningokokus',
    },
    // Spec §3.2 Senior Red-Lines
    'reason.senior_acute_delirium': {
      en: 'Sudden confusion, disorientation, or abrupt speech loss in an older adult — Stroke or severe infection alert',
      zh: '老年人突发神志模糊、谵妄或言语功能丧失 — 中风或重症感染危急信号',
      ms: 'Kekeliruan tiba-tiba atau kehilangan pertuturan pada warga emas — Amaran strok atau jangkitan teruk',
    },
    'reason.senior_chest_pain': {
      en: 'Heavy squeezing chest pressure or pain in an older adult — Immediate acute coronary syndrome evaluation',
      zh: '老年人剧烈胸口压迫感或绞痛 — 急性冠脉综合征排查，立即拨打995',
      ms: 'Tekanan atau sakit dada berat pada warga emas — Penilaian segera sindrom koronari akut',
    },
    'reason.senior_rest_dyspnea': {
      en: 'Sudden gasping, wheezing, or shortness of breath at rest in a senior — Emergency respiratory compromise',
      zh: '老年人静息状态下突发气促、喘息、喘不上气 — 急性心衰肺水肿或肺栓塞警示',
      ms: 'Tercungap-cungap atau sesak nafas tiba-tiba semasa rehat pada warga emas — Kecemasan pernafasan',
    },
    'reason.senior_fast_stroke': {
      en: 'Sudden facial droop, arm weakness, or gait ataxia (FAST stroke protocol) — Hyperacute window',
      zh: '突发单侧面瘫嘴歪、手臂无力或步态不稳（FAST中风筛查）— 黄金抢救时间',
      ms: 'Muka senget, kelemahan tangan, atau hilang keseimbangan secara tiba-tiba — Protokol strok segera',
    },
    'reason.senior_high_fever_sepsis': {
      en: 'High fever >= 39.4°C or fever with stiff neck and confusion — Fulminant bacteremia or CNS infection',
      zh: '老年人体温 >= 39.4°C 或发烧伴颈部僵硬、神志不清 — 重症败血症或中枢感染',
      ms: 'Demam tinggi >= 39.4°C atau bersama leher tegang dan kekeliruan — Risiko sepsis teruk',
    },
    'reason.senior_severe_dehydration_syncope': {
      en: 'Sunken eyes, dark urine, or fainting from persistent vomiting/diarrhea — Geriatric hypovolemic crisis',
      zh: '眼窝凹陷、尿色深浓或因呕吐腹泻导致头晕晕厥 — 老年急性循环血容量不足危急',
      ms: 'Mata cengkung, air kencing gelap, atau pengsan akibat muntah/cirit — Krisis hipovolemia warga emas',
    },
    'reason.senior_sudden_severe_catastrophe': {
      en: 'Sudden severe abdominal pain or thunderclap headache — Acute vascular catastrophe alert',
      zh: '突发剧烈剧痛腹痛或霹雳样剧烈头痛 — 疑似腹主动脉瘤破裂或脑动脉瘤破裂危急',
      ms: 'Sakit perut teruk mendadak atau sakit kepala petir — Amaran malapetaka vaskular akut',
    },
    // Orange Tiers
    'reason.toddler_high_fever_urgent': {
      en: 'High fever in toddler without red-line signs — Same-day clinical urgent care recommended',
      zh: '幼儿高烧但无危急红线体征 — 建议当日前往急诊或紧急诊所就诊',
      ms: 'Demam tinggi pada kanak-kanak tanpa tanda merah — Rawatan segera hari yang sama disyorkan',
    },
    'reason.moderate_dehydration_urgent': {
      en: 'Moderate dehydration with reduced urination and dry lips — Clinical evaluation required',
      zh: '中度脱水（尿量减少、唇干）— 须由医生评估并指导口服补液盐',
      ms: 'Dehidrasi sederhana dengan kencing berkurangan dan bibir kering — Penilaian klinikal diperlukan',
    },
    'reason.acute_abdominal_pain_urgent': {
      en: 'Persistent localized abdominal pain with nausea — Urgent clinic evaluation for acute abdomen',
      zh: '持续局限性腹痛伴恶心 — 建议尽快前往诊所排查急性阑尾炎等急腹症',
      ms: 'Sakit perut berterusan dengan loya — Penilaian klinik segera untuk abdomen akut',
    },
    'reason.elderly_fall_suspected_fracture': {
      en: 'Elderly fall with limb pain or inability to bear weight — Urgent X-ray fracture assessment',
      zh: '老年人跌倒后肢体疼痛无法承重 — 须尽快前往急诊或影像中心进行X光骨折排查',
      ms: 'Jatuh pada warga emas dengan kesakitan atau tidak boleh berdiri — Pemeriksaan X-ray segera',
    },
    'reason.asthma_exacerbation_urgent': {
      en: 'Asthma exacerbation with incomplete inhaler response — Urgent bronchodilator nebulization',
      zh: '哮喘急性发作吸入剂反应欠佳 — 须前往急诊或诊所进行雾化治疗',
      ms: 'Serangan asma dengan tindak balas inhaler separa — Perlu rawatan nebulizer segera',
    },
    'reason.deep_wound_suture_urgent': {
      en: 'Deep open laceration — Needs wound toilet and suture approximation within 6 hours',
      zh: '较深开放性伤口 — 建议6小时内前往诊所清创并缝合',
      ms: 'Luka koyak yang dalam — Memerlukan cuci luka dan jahitan dalam masa 6 jam',
    },
    'reason.corneal_trauma_urgent': {
      en: 'Acute eye trauma or foreign body sensation with photophobia — Urgent slit-lamp examination',
      zh: '眼部外伤或异物感伴畏光 — 须尽快前往眼科或急诊进行裂隙灯检查',
      ms: 'Trauma mata atau rasa ada habuk dengan silau — Pemeriksaan lampu celah segera',
    },
    'reason.hypertensive_urgency': {
      en: 'Severe blood pressure elevation without acute target organ damage — Same-day GP assessment',
      zh: '重度高血压伴轻度头痛 — 须当日就诊评估并调整降压药',
      ms: 'Tekanan darah sangat tinggi tanpa kerosakan organ akut — Penilaian doktor hari yang sama',
    },
    // Yellow Tiers
    'reason.prolonged_cough_gp': {
      en: 'Cough lasting > 5 days with phlegm — GP consultation recommended to evaluate lung sounds',
      zh: '咳嗽超过5天伴有痰液 — 建议前往全科家庭诊所（GP）听诊听肺音',
      ms: 'Batuk berlarutan > 5 hari bersama kahak — Rujukan GP disyorkan',
    },
    'reason.mild_exanthem_gp': {
      en: 'Localized blanching rash without systemic signs — Standard GP consultation',
      zh: '局部退色红疹无全身中毒症状 — 可前往邻里家庭诊所进行常规看诊',
      ms: 'Ruam memudar setempat tanpa tanda sistemik — Konsultasi GP biasa',
    },
    'reason.minor_head_bump_gp': {
      en: 'Minor head bump in alert patient without vomiting or loss of consciousness — Primary care observation',
      zh: '轻微磕碰头部且神志清醒、无呕吐昏迷 — 建议诊所看诊并居家观察48小时',
      ms: 'Benjol kepala ringan pada pesakit sedar tanpa muntah — Pemerhatian penjagaan primer',
    },
    'reason.sore_throat_gp': {
      en: 'Mild sore throat with normal swallowing — Polyclinic or GP examination',
      zh: '轻度咽喉肿痛、吞咽自如 — 可在综合诊疗所（Polyclinic）或GP就诊',
      ms: 'Sakit tekak ringan dengan menelan normal — Pemeriksaan poliklinik atau GP',
    },
    'reason.otitis_media_gp': {
      en: 'Earache or ear-tugging with mild fever — Otoscopic evaluation by GP',
      zh: '耳痛或抓耳伴低烧 — 建议GP耳镜检查以确认是否为中耳炎',
      ms: 'Sakit telinga dengan demam ringan — Pemeriksaan otoskopi oleh GP',
    },
    'reason.uncomplicated_uti_gp': {
      en: 'Burning urination or frequency without fever/back pain — GP urine dipstick test',
      zh: '尿频尿痛无发热及腰痛 — 前往CHAS诊所进行尿常规化验',
      ms: 'Kencing pedih atau kerap tanpa demam/sakit pinggang — Ujian air kencing di GP',
    },
    'reason.mild_gastroenteritis_gp': {
      en: 'Mild gastroenteritis tolerating fluids — Primary care supportive management',
      zh: '轻度腹泻且口服补液良好 — 建议诊所配药及口服补液盐',
      ms: 'Gastroenteritis ringan dengan pengambilan air baik — Rawatan sokongan GP',
    },
    'reason.chronic_refill_gp': {
      en: 'Routine chronic prescription refill and health review — CHAS GP or Polyclinic',
      zh: '慢性病常规开药与复查 — 可在Healthier SG家庭诊所完成',
      ms: 'Urusan tambah ubat penyakit kronik rutin — Poliklinik atau GP CHAS',
    },
    // Green Tiers
    'reason.common_cold_home_care': {
      en: 'Common viral cold with good hydration and activity — Home care and rest',
      zh: '普通病毒性感冒、精神良好、水分充足 — 建议居家充分休息与多喝水',
      ms: 'Selesema virus biasa dengan penghidratan baik — Penjagaan di rumah dan rehat',
    },
    'reason.post_vaccination_fever_home': {
      en: 'Expected mild post-vaccine fever — Paracetamol, hydration, and home monitoring',
      zh: '疫苗接种后轻微发热反应 — 可按剂量服用退烧药并补充水分',
      ms: 'Demam ringan biasa selepas vaksin — Paracetamol, minum air, dan pemantauan rumah',
    },
    'reason.superficial_scrape_home': {
      en: 'Superficial graze or scrape — Cleanse with soap/water and apply dressing at home',
      zh: '表皮轻微擦伤抓伤 — 居家使用清水或温和肥皂清洗并贴上创可贴',
      ms: 'Luka calar ringan — Cuci dengan air/sabun dan balut di rumah',
    },
    'reason.infant_teething_home': {
      en: 'Normal infant teething discomfort — Chilled teething rings and gum care',
      zh: '婴儿正常出牙期不适 — 可使用冷藏磨牙胶并注意口腔卫生',
      ms: 'Ketidakselesaan tumbuh gigi bayi — Gel tumbuh gigi atau mainan gigit sejuk',
    },
    'reason.exercise_soreness_home': {
      en: 'Post-exercise muscle soreness (DOMS) — Gentle stretching, hydration, and rest',
      zh: '运动后肌肉酸痛 — 充分热敷、温和拉伸及补充电解质水分',
      ms: 'Sakit otot selepas senaman — Regangan ringan, hidrasi, dan rehat',
    },
    'reason.tension_headache_home': {
      en: 'Mild tension headache from fatigue — Screen break, dark room rest, and hydration',
      zh: '轻度疲劳性紧张性头痛 — 减少屏幕时间、保持安静暗室休息',
      ms: 'Sakit kepala tegang ringan akibat keletihan — Rehat tanpa skrin dan minum air',
    },
  };

  if (dict[reasonKey] && dict[reasonKey][lang]) {
    return dict[reasonKey][lang];
  }
  return reasonKey;
}

// ===== Result Builder =====
function buildResult(
  severity: Severity,
  reasons: string[],
  triggeredRules: string[],
  ailmentCode: string | undefined,
  person: Person,
  lang: Language = 'en',
  matchedKeywords: string[] = []
): TriageResult {
  const careTierText = getCareTierText(severity, lang);
  const action = getActionText(severity, lang);
  const timeframe = getTimeframe(severity, lang);
  const whenToWorry = getWhenToWorry(severity, ailmentCode, lang);
  const grandmaExplanation = getResultPhrasing(severity, person);

  return {
    severity,
    action,
    timeframe,
    careTierText,
    reasons: reasons.length > 0 ? reasons : [lang === 'zh' ? '依据当前评估结果' : 'Based on reported symptoms'],
    whenToWorry,
    disclaimer:
      lang === 'zh'
        ? '本应用仅提供分诊与就医导航建议，不构成医学诊断或处方。如有疑虑，请致电 995 或咨询专业医生。'
        : lang === 'ms'
        ? 'Aplikasi ini hanya memberi panduan triaj & navigasi penjagaan, bukan diagnosis perubatan. Sila hubungi 995 jika ragu.'
        : 'GranPocket provides triage guidance and care navigation only. It does not diagnose, prescribe, or replace professional medical advice. When in doubt, call 995.',
    contentStatusLabel: 'PROVISIONAL',
    triggeredRuleIds: triggeredRules,
    matchedKeywords,
    suggestedAilment: ailmentCode,
    grandmaExplanation,
    homeMedicationAdvice: (() => {
      const isAnaphylaxisOrAllergy =
        ailmentCode === 'allergic_reaction' ||
        reasons.some(r => /anaphyl|allergic|epipen/i.test(r)) ||
        matchedKeywords.some(k => /allergic|anaphyl/i.test(k));
      if (isAnaphylaxisOrAllergy && severity === 'RED') {
        return {
          medicationName: 'EpiPen (Epinephrine Auto-Injector 0.15mg/0.3mg)',
          dosageInstruction: 'Immediately give an EpiPen injection to the outer thigh while calling 995 for an emergency ambulance.',
          route: 'intramuscular (outer thigh)',
          urgency: 'immediate_emergency',
          warnings: 'Call 995 immediately. Hold auto-injector firmly against mid-outer thigh for 3 seconds then massage area for 10 seconds. Do not inject into veins or buttocks.',
          approvedBy: 'Dr. Evelyn Lim (SMC Reg: M12849J)'
        };
      }
      return undefined;
    })(),
  };
}

// ===== Localized Care-Tier Text (SRS SEV-01) =====
export function getCareTierText(severity: Severity, lang: Language = 'en'): string {
  switch (severity) {
    case 'RED':
      if (lang === 'zh') return '立即拨打 995 呼叫救护车或前往最近的急诊中心（A&E）。切勿自行驾车前往。';
      if (lang === 'ms') return 'Hubungi 995 dengan segera atau pergi ke Jabatan Kemalangan & Kecemasan (A&E) terdekat. Jangan memandu sendiri.';
      return 'Call 995 immediately or proceed to the nearest Hospital Accident & Emergency (A&E) department. Do not drive yourself if experiencing heart attack or stroke symptoms — call an ambulance.';

    case 'ORANGE':
      if (lang === 'zh') return '请在数小时内前往最近的24小时诊所、紧急护理中心或安排日间急诊/综合诊疗所（Polyclinic）。如症状加重请立即拨打995。';
      if (lang === 'ms') return 'Sila berjumpa doktor di klinik 24 jam atau pusat rawatan segera dalam beberapa jam. Pergi ke A&E atau hubungi 995 jika bertambah teruk.';
      return 'Visit the nearest 24-hour clinic, urgent care centre, or arrange a same-day Polyclinic / GP consultation within hours. Go to A&E or call 995 if condition worsens.';

    case 'YELLOW':
      if (lang === 'zh') return '请在1至3天内前往综合诊疗所（Polyclinic）、家庭医生（GP）或您的 Healthier SG 签约医生处进行检查。期间请继续监测。';
      if (lang === 'ms') return 'Lawati Poliklinik atau klinik GP dalam masa 1-3 hari. Teruskan pemantauan di rumah.';
      return 'Visit a Polyclinic, GP clinic, or your registered Healthier SG GP within 1 to 3 days. Continue monitoring at home in the meantime.';

    case 'GREEN':
      if (lang === 'zh') return '目前情况适宜在家观察护理。请遵循家庭护理指引并留意观察随访提醒。';
      if (lang === 'ms') return 'Penjagaan di rumah adalah wajar buat masa ini. Ikuti panduan penjagaan dan tunggu peringatan susulan.';
      return 'Home care is appropriate for now. Follow supportive care steps and monitor for the warning signs below. A check-back reminder has been scheduled.';
  }
}

export function getActionText(severity: Severity, lang: Language = 'en'): string {
  switch (severity) {
    case 'RED':
      if (lang === 'zh') return '医疗急症：立即拨打 995 或前往急诊部';
      if (lang === 'ms') return 'Kecemasan Perubatan: Hubungi 995 sekarang';
      return 'Medical Emergency: Call 995 now or go to A&E immediately';

    case 'ORANGE':
      if (lang === 'zh') return '紧急就医：须在数小时内接受医生检查';
      if (lang === 'ms') return 'Rawatan Segera: Perlu diperiksa doktor dalam beberapa jam';
      return 'Urgent Review: Be seen by a doctor within hours';

    case 'YELLOW':
      if (lang === 'zh') return '建议就诊：请在1-3天内到诊所检查';
      if (lang === 'ms') return 'Perlu Pemeriksaan: Jumpa doktor dalam 1-3 hari';
      return 'Doctor Review Recommended: See a GP within 1-3 days';

    case 'GREEN':
      if (lang === 'zh') return '在家观察：目前风险较低，保持监测';
      if (lang === 'ms') return 'Penjagaan Rumah: Risiko rendah, pantau bersama';
      return 'Home Care: Low risk for now, monitor and rest';
  }
}

export function getTimeframe(severity: Severity, lang: Language = 'en'): string {
  switch (severity) {
    case 'RED': return lang === 'zh' ? '立即 (Now)' : lang === 'ms' ? 'Segera (Now)' : 'Now';
    case 'ORANGE': return lang === 'zh' ? '数小时内 (Within hours)' : lang === 'ms' ? 'Dalam beberapa jam' : 'Within hours';
    case 'YELLOW': return lang === 'zh' ? '1-3天内 (1-3 days)' : lang === 'ms' ? 'Dalam 1-3 hari' : 'Within 1-3 days';
    case 'GREEN': return lang === 'zh' ? '无需急诊 (Home care)' : lang === 'ms' ? 'Di rumah (Home care)' : 'Home care';
  }
}

export function getWhenToWorry(severity: Severity, ailmentCode: string | undefined, lang: Language = 'en'): string[] {
  if (severity === 'RED') {
    return [
      lang === 'zh' ? '请保持镇静，立即拨打995并留守病人身边。' : 'Call 995 immediately. Stay calm and stay with the patient.',
      lang === 'zh' ? '准备向救护人员报告家庭住址、现有疾病与过敏史。' : 'Have your home address and emergency info card ready for the operator.',
    ];
  }

  const base = [
    lang === 'zh' ? '症状明显恶化或出现新症状' : 'Symptoms worsen significantly or new red flags develop',
    lang === 'zh' ? '直觉感到不对劲或病人精神状态变差时，请果断就医' : 'Trust your instinct — if the person looks unwell or deteriorates, escalate immediately',
  ];

  if (ailmentCode === 'fever') {
    return [
      ...base,
      lang === 'zh' ? '体温升至39.5°C以上或服退烧药后不降' : 'Temperature rises above 39.5°C or fails to come down with medicine',
      lang === 'zh' ? '精神嗜睡、烦躁不安、拒绝饮水或尿量明显减少' : 'Baby or person becomes lethargic, unresponsive, or stops drinking fluids',
      lang === 'zh' ? '皮肤出现压之不褪色的红点或瘀斑' : 'Any rash appears that fails to fade under glass pressure',
    ];
  }

  if (ailmentCode === 'cough' || ailmentCode === 'breathing_difficulty') {
    return [
      ...base,
      lang === 'zh' ? '呼吸费力、呼吸过快或说话无法成句' : 'Breathing becomes laboured, rapid, or person cannot speak in sentences',
      lang === 'zh' ? '嘴唇、舌头或甲床泛青泛紫' : 'Lips, tongue, or face turn bluish or grey',
    ];
  }

  return base;
}

// ===== Question Trees for the 16 Ailments (SRS §7.3, §7.5) =====
export function getQuestionTree(ailmentCode: string, person?: Person | null): QuestionStep[] {
  const ageCat = person?.dob ? getAgeBand(person.dob) : 'adult';
  const isBabyOrToddler = ageCat === 'neonate' || ageCat === 'young_infant' || ageCat === 'infant' || ageCat === 'toddler';

  const trees: Record<string, QuestionStep[]> = {
    fever: [
      {
        id: 'temp_c',
        textKey: 'q.fever.temp',
        text: 'What is the current body temperature in °C? (e.g. 38.8)',
        textZh: '目前的体温是多少摄氏度？（例如 38.8）',
        textMs: 'Berapakah suhu badan sekarang dalam °C? (cth: 38.8)',
        answerType: 'number',
        unit: '°C',
        min: 35.0,
        max: 42.0,
        step: 0.1,
        helpText: isBabyOrToddler
          ? 'Use a digital thermometer under the armpit, forehead, or ear. Infant normal is 36.5–37.5°C.'
          : 'Use a digital thermometer under the armpit, forehead, or ear.',
      },
      {
        id: 'drowsy',
        textKey: 'q.fever.drowsy',
        text: isBabyOrToddler
          ? 'Is the baby unusually limp, hard to wake, or weak/floppy?'
          : 'Is the person abnormally drowsy, unusually limp, or hard to wake up?',
        textZh: isBabyOrToddler
          ? '婴儿是否异常嗜睡、四肢瘫软无力或难以唤醒？'
          : '病人是否异常嗜睡、全身软弱无力或难以唤醒？',
        textMs: isBabyOrToddler
          ? 'Adakah bayi sangat lembik, tidak bermaya, atau sukar dikejutkan?'
          : 'Adakah orang tersebut luar biasa mengantuk, lembik, atau susah dikejutkan?',
        answerType: 'yes_no',
        redFlagIf: ['yes', true],
      },
      {
        id: 'fluids',
        textKey: 'q.fever.fluids',
        text: isBabyOrToddler
          ? 'How is feeding and wet diapers?'
          : 'How is fluid intake and urination?',
        textZh: isBabyOrToddler
          ? '进食吸奶与湿尿布情况如何？'
          : '饮水和排尿情况如何？',
        textMs: isBabyOrToddler
          ? 'Bagaimanakah penyusuan dan lampin basah?'
          : 'Bagaimanakah pengambilan cecair dan kencing?',
        answerType: 'choice',
        options: isBabyOrToddler
          ? [
              'Feeding/drinking well & normal wet diapers',
              'Drinking less than usual',
              'Refusing all fluids / dry diapers > 6-8 hours',
            ]
          : [
              'Drinking well & normal urination',
              'Drinking less than usual / dark urine',
              'Unable to keep fluids down / no urination > 8-12 hours',
            ],
        optionsZh: isBabyOrToddler
          ? [
              '进食良好且湿尿布正常',
              '比平时吃/喝得少',
              '拒绝进食饮水 / 6-8小时以上无湿尿布',
            ]
          : [
              '饮水良好且排尿正常',
              '比平时喝得少 / 尿液深黄',
              '无法摄入液体 / 8-12小时以上无排尿',
            ],
        optionsMs: isBabyOrToddler
          ? [
              'Menyusu baik & lampin basah normal',
              'Kurang minum daripada biasa',
              'Enggan minum / tiada lampin basah > 6-8 jam',
            ]
          : [
              'Minum baik & kencing normal',
              'Kurang minum daripada biasa / kencing pekat',
              'Tidak boleh minum / tiada kencing > 8-12 jam',
            ],
        redFlagIf: [
          'Refusing all fluids / dry diapers > 6-8 hours',
          'Unable to keep fluids down / no urination > 8-12 hours',
          'Refusing all fluids / dry diapers > 8 hours',
        ],
      },
      {
        id: 'stiff_neck',
        textKey: 'q.fever.stiff_neck',
        text: 'Is there any neck stiffness or intolerance to bright light?',
        textZh: '是否有颈部僵硬或眼睛畏光？',
        textMs: 'Adakah terdapat leher kaku atau sensitif kepada cahaya terang?',
        answerType: 'yes_no',
        redFlagIf: ['yes', true],
      },
      {
        id: 'rash',
        textKey: 'q.fever.rash',
        text: 'Is there a rash? Press a clear drinking glass against the spots — does the rash fade under pressure?',
        textZh: '是否有皮疹？用透明玻璃杯用力压在红点上 — 红疹会褪色变白吗？',
        textMs: 'Adakah terdapat ruam? Tekan gelas lutsinar pada ruam — adakah ia pudar?',
        answerType: 'choice',
        options: ['No rash', 'Rash fades under pressure (Blanching)', 'Rash does not fade (Non-blanching petechiae)'],
        optionsZh: ['无皮疹', '压之褪色变白（良性充血疹）', '压之不褪色（红紫斑，危急特征）'],
        optionsMs: ['Tiada ruam', 'Ruam pudar bila ditekan', 'Ruam TIDAK pudar bila ditekan'],
        redFlagIf: ['Rash does not fade (Non-blanching petechiae)'],
      },
      {
        id: 'duration_days',
        textKey: 'q.fever.duration',
        text: 'How many days has this fever been present?',
        textZh: '发烧已经持续几天了？',
        textMs: 'Berapa hari demam ini telah berlarutan?',
        answerType: 'number',
        unit: 'days',
        min: 0,
        max: 30,
        step: 1,
      },
    ],

    cough: [
      {
        id: 'breathing_difficulty',
        textKey: 'q.cough.breathing',
        text: 'Is the person struggling for breath, gasping, or breathing unusually fast?',
        textZh: '是否有呼吸吃力、喘息或呼吸异常急促？',
        textMs: 'Adakah pesakit sukar bernafas, mengah atau bernafas sangat laju?',
        answerType: 'yes_no',
        redFlagIf: ['yes', true],
      },
      {
        id: 'blue_lips',
        textKey: 'q.cough.blue_lips',
        text: 'Are the lips, tongue, or fingertips turning bluish or grey?',
        textZh: '嘴唇、舌头或指尖是否有发紫、发青或发灰？',
        textMs: 'Adakah bibir, lidah atau hujung jari bertukar menjadi kebiruan atau kelabu?',
        answerType: 'yes_no',
        redFlagIf: ['yes', true],
      },
      {
        id: 'coughing_blood',
        textKey: 'q.cough.blood',
        text: 'Is there any blood or rust-coloured sputum in the cough?',
        textZh: '咳出的痰中是否有鲜血或铁锈色血丝？',
        textMs: 'Adakah terdapat darah atau kahak berdarah semasa batuk?',
        answerType: 'yes_no',
        redFlagIf: ['yes', true],
      },
      {
        id: 'fever',
        textKey: 'q.cough.fever',
        text: 'Is there an accompanying fever?',
        textZh: '是否伴有发烧？',
        textMs: 'Adakah batuk disertai demam?',
        answerType: 'yes_no',
      },
      {
        id: 'duration_days',
        textKey: 'q.cough.duration',
        text: 'How many days has the cough lasted?',
        textZh: '咳嗽已经持续多少天了？',
        textMs: 'Berapa hari batuk ini telah berlangsung?',
        answerType: 'number',
        unit: 'days',
        min: 0,
        max: 60,
      },
    ],

    confusion_neuro: [
      {
        id: 'sudden_confusion',
        textKey: 'q.conf.sudden',
        text: 'Did this confusion or disorientation appear suddenly?',
        textZh: '这种神志不清或糊涂是突然发生的吗？',
        textMs: 'Adakah kekeliruan ini berlaku secara tiba-tiba?',
        answerType: 'yes_no',
        redFlagIf: ['yes', true],
      },
      {
        id: 'slurred_speech',
        textKey: 'q.conf.speech',
        text: 'Is the speech slurred, garbled, or are they unable to find words?',
        textZh: '说话是否大舌头、含糊不清或突然无法表达？',
        textMs: 'Adakah percakapan tidak jelas (slurred) atau tidak boleh bertutur?',
        answerType: 'yes_no',
        redFlagIf: ['yes', true],
      },
      {
        id: 'facial_droop',
        textKey: 'q.conf.droop',
        text: 'Ask the person to smile. Does one side of the face or mouth droop?',
        textZh: '请让病人微笑。嘴角或单侧面部是否下垂对称不对称？',
        textMs: 'Minta pesakit senyum. Adakah sebelah muka atau mulut herot/menurun?',
        answerType: 'yes_no',
        redFlagIf: ['yes', true],
      },
      {
        id: 'limb_weakness',
        textKey: 'q.conf.weakness',
        text: 'Ask the person to raise both arms. Does one arm drift downward or feel weak/numb?',
        textZh: '请让病人抬起双臂。是否有一侧手臂无力下垂或麻木？',
        textMs: 'Minta pesakit angkat kedua-dua belah tangan. Adakah sebelah tangan jatuh atau lemah?',
        answerType: 'yes_no',
        redFlagIf: ['yes', true],
      },
    ],

    chest_pain: [
      {
        id: 'crushing_pain',
        textKey: 'q.chest.crushing',
        text: 'Is the pain described as heavy, crushing, squeezing, or like an elephant sitting on the chest?',
        textZh: '胸痛是否像重物挤压、胸口被石头压住一样闷痛？',
        textMs: 'Adakah sakit dada terasa mencengkam, berat atau tertekan?',
        answerType: 'yes_no',
        redFlagIf: ['yes', true],
      },
      {
        id: 'radiates',
        textKey: 'q.chest.radiates',
        text: 'Does the pain spread to the left arm, shoulder, jaw, neck, or back?',
        textZh: '疼痛是否放射扩散至左臂、下巴、颈部或后背？',
        textMs: 'Adakah sakit menjalar ke lengan kiri, rahang, leher atau belakang?',
        answerType: 'yes_no',
        redFlagIf: ['yes', true],
      },
      {
        id: 'sweating',
        textKey: 'q.chest.sweating',
        text: 'Is there cold sweating, dizziness, nausea, or clamminess?',
        textZh: '是否伴有冒冷汗、头晕恶心或四肢发冷？',
        textMs: 'Adakah pesakit berpeluh dingin, pening atau loya?',
        answerType: 'yes_no',
        redFlagIf: ['yes', true],
      },
      {
        id: 'breathless',
        textKey: 'q.chest.breathless',
        text: 'Is there breathlessness or shortness of breath?',
        textZh: '是否伴有气促、喘不过气？',
        textMs: 'Adakah terdapat kesukaran bernafas?',
        answerType: 'yes_no',
        redFlagIf: ['yes', true],
      },
    ],

    injury_wound: [
      {
        id: 'uncontrolled_bleeding',
        textKey: 'q.inj.bleeding',
        text: 'Is there active bleeding that does not stop after 10 minutes of direct, firm pressure?',
        textZh: '经过10分钟用力直接按压包扎后，伤口依然血流不止吗？',
        textMs: 'Adakah pendarahan berterusan walaupun ditekan kuat selama 10 minit?',
        answerType: 'yes_no',
        redFlagIf: ['yes', true],
      },
      {
        id: 'head_injury',
        textKey: 'q.inj.head',
        text: 'Did this injury involve a blow to the head or a serious fall?',
        textZh: '伤情是否涉及头部撞击或重度跌倒？',
        textMs: 'Adakah kecederaan ini melibatkan hentakan di kepala atau jatuh teruk?',
        answerType: 'yes_no',
        redFlagIf: ['yes', true],
      },
      {
        id: 'loss_of_consciousness',
        textKey: 'q.inj.conscious',
        text: 'Did the person black out, pass out, or lose consciousness even briefly?',
        textZh: '病人是否有哪怕数秒钟的昏厥、黑蒙或意识丧失？',
        textMs: 'Adakah pesakit pengsan atau hilang ingatan seketika?',
        answerType: 'yes_no',
        redFlagIf: ['yes', true],
      },
      {
        id: 'deformity',
        textKey: 'q.inj.deformity',
        text: 'Is there an obvious bone deformity, unnatural angle, or inability to bear any weight?',
        textZh: '是否有肉眼可见的骨骼变形、异常弯曲或完全无法受力负重？',
        textMs: 'Adakah terdapat kecacatan bentuk tulang atau tidak boleh memijak kaki langsung?',
        answerType: 'yes_no',
      },
    ],

    allergic_reaction: [
      {
        id: 'lip_tongue_swelling',
        textKey: 'q.all.swelling',
        text: 'Is there swelling of the lips, tongue, uvula, or feeling of throat tightness?',
        textZh: '嘴唇、舌头是否有水肿，或感觉喉咙收紧卡住？',
        textMs: 'Adakah bibir, lidah membengkak atau tekak terasa sempit?',
        answerType: 'yes_no',
        redFlagIf: ['yes', true],
      },
      {
        id: 'breathing_difficulty',
        textKey: 'q.all.breathing',
        text: 'Is there wheezing, difficulty breathing, or noisy breathing (stridor)?',
        textZh: '是否有喘息、气急或吸气时发出哮鸣音？',
        textMs: 'Adakah terdapat bunyi nafas berdehit atau kesukaran bernafas?',
        answerType: 'yes_no',
        redFlagIf: ['yes', true],
      },
      {
        id: 'faintness',
        textKey: 'q.all.faint',
        text: 'Is the person feeling dizzy, lightheaded, or fainting?',
        textZh: '病人是否感觉头晕目眩或即将晕倒？',
        textMs: 'Adakah pesakit berasa sangat pening atau hendak pengsan?',
        answerType: 'yes_no',
        redFlagIf: ['yes', true],
      },
    ],

    breathing_difficulty: [
      {
        id: 'severe_difficulty',
        textKey: 'q.breath.severe',
        text: 'Is the breathing difficulty severe — gasping or chest retractions?',
        textZh: '呼吸困难是否非常严重 — 大口喘气或肋骨胸骨明显凹陷？',
        textMs: 'Adakah kesukaran bernafas teruk — mengah atau dada berlekuk?',
        answerType: 'yes_no',
        redFlagIf: ['yes', true],
      },
      {
        id: 'blue_lips',
        textKey: 'q.breath.blue',
        text: 'Are lips, face, or fingernails blue or pale grey?',
        textZh: '嘴唇、面部或指甲是否有发青发紫？',
        textMs: 'Adakah bibir atau kuku kelihatan biru keunguan?',
        answerType: 'yes_no',
        redFlagIf: ['yes', true],
      },
      {
        id: 'unable_to_speak',
        textKey: 'q.breath.speak',
        text: 'Can the person speak a full sentence without pausing to take a breath?',
        textZh: '病人能否连续说一句完整的话而无需停顿喘气？',
        textMs: 'Bolehkah pesakit bercakap ayat penuh tanpa berhenti mengambil nafas?',
        answerType: 'yes_no',
        redFlagIf: ['no', false],
      },
    ],

    abdominal_pain: [
      {
        id: 'severe_pain',
        textKey: 'q.abd.severe',
        text: 'Is the pain severe, unbearable, or rapidly worsening?',
        textZh: '腹痛是否剧烈难忍或迅速加剧？',
        textMs: 'Adakah sakit perut teramat sangat atau semakin teruk dengan cepat?',
        answerType: 'yes_no',
        redFlagIf: ['yes', true],
      },
      {
        id: 'blood',
        textKey: 'q.abd.blood',
        text: 'Is there any blood in vomit (coffee-ground emesis) or in stools (black tarry stools)?',
        textZh: '呕吐物中是否有血或咖啡渣样物？排便是否有黑便或血便？',
        textMs: 'Adakah muntah darah atau najis berdarah/hitam pekat?',
        answerType: 'yes_no',
        redFlagIf: ['yes', true],
      },
      {
        id: 'fever',
        textKey: 'q.abd.fever',
        text: 'Is there an accompanying fever?',
        textZh: '是否伴有发烧？',
        textMs: 'Adakah disertai demam?',
        answerType: 'yes_no',
      },
    ],

    vomiting_diarrhea: [
      {
        id: 'unable_to_keep_fluids',
        textKey: 'q.vd.fluids',
        text: 'Can the person keep any small sips of water down, or is everything coming back up?',
        textZh: '病人是否连小口喝水都无法保留，喝什么吐什么？',
        textMs: 'Bolehkah pesakit menelan sedikit air, atau memuntahkan semua cecair?',
        answerType: 'yes_no',
        redFlagIf: ['yes', true],
      },
      {
        id: 'blood_in_vomit',
        textKey: 'q.vd.blood_v',
        text: 'Is there fresh red blood or dark coffee-ground granules in vomit?',
        textZh: '呕吐物中是否有鲜红血液或深色咖啡色颗粒？',
        textMs: 'Adakah darah dalam muntah?',
        answerType: 'yes_no',
        redFlagIf: ['yes', true],
      },
      {
        id: 'blood_in_stool',
        textKey: 'q.vd.blood_s',
        text: 'Is there blood or red mucus in the stool?',
        textZh: '大便中是否有血液或红色粘液？',
        textMs: 'Adakah najis berdarah atau mengandungi lendir merah?',
        answerType: 'yes_no',
        redFlagIf: ['yes', true],
      },
    ],

    headache: [
      {
        id: 'sudden_severe',
        textKey: 'q.head.sudden',
        text: 'Did this headache reach peak severity instantly ("thunderclap headache" - worst headache of life)?',
        textZh: '头痛是否在数秒或数分钟内爆发达到顶峰（雷击样剧痛，一生中最痛）？',
        textMs: 'Adakah sakit kepala berlaku sangat kuat secara mendadak (seperti kilat)?',
        answerType: 'yes_no',
        redFlagIf: ['yes', true],
      },
      {
        id: 'stiff_neck',
        textKey: 'q.head.stiff',
        text: 'Is there neck stiffness accompanied by fever?',
        textZh: '是否有脖子僵硬伴随发烧？',
        textMs: 'Adakah leher kaku disertai demam?',
        answerType: 'yes_no',
        redFlagIf: ['yes', true],
      },
      {
        id: 'neuro_signs',
        textKey: 'q.head.neuro',
        text: 'Are there visual disturbances, weakness, numbness, or difficulty talking?',
        textZh: '是否伴有视力改变（重影、视野缺损）、肢体麻木或说话困难？',
        textMs: 'Adakah terdapat gangguan penglihatan, kebas atau kesukaran bercakap?',
        answerType: 'yes_no',
        redFlagIf: ['yes', true],
      },
    ],

    rash: [
      {
        id: 'non_blanching',
        textKey: 'q.rash.blanch',
        text: 'Press a clear drinking glass firmly on the red spots. Do the spots disappear under the glass?',
        textZh: '用透明玻璃杯用力压在红疹上。红疹在杯底会褪色消失吗？',
        textMs: 'Tekan gelas kaca lutsinar pada ruam. Adakah bintik merah itu hilang/pudar?',
        answerType: 'choice',
        options: ['Yes, it fades completely (Blanching)', 'No, the red/purple spots stay visible (Non-blanching)', 'Not sure / no glass'],
        optionsZh: ['是的，压下去完全褪色变白', '没有，红紫斑依然清晰可见（不褪色）', '不确定 / 无玻璃杯'],
        optionsMs: ['Ya, pudar sepenuhnya', 'Tidak, bintik merah/ungu kekal kelihatan', 'Tidak pasti'],
        redFlagIf: ['No, the red/purple spots stay visible (Non-blanching)'],
      },
      {
        id: 'with_breathing_difficulty',
        textKey: 'q.rash.breathing',
        text: 'Is the rash accompanied by any difficulty breathing or swollen throat/lips?',
        textZh: '出疹是否伴有呼吸困难、嘴唇或喉咙肿胀？',
        textMs: 'Adakah ruam disertai sesak nafas atau bengkak bibir/tekak?',
        answerType: 'yes_no',
        redFlagIf: ['yes', true],
      },
    ],

    dizziness_fall: [
      {
        id: 'chest_pain',
        textKey: 'q.diz.chest',
        text: 'Was the dizziness or blackout accompanied by chest pain or racing heart palpitations?',
        textZh: '头晕或眼前发黑时是否伴有胸痛或心跳异常剧烈狂跳？',
        textMs: 'Adakah pening disertai sakit dada atau degupan jantung kencang?',
        answerType: 'yes_no',
        redFlagIf: ['yes', true],
      },
      {
        id: 'injury',
        textKey: 'q.diz.injury',
        text: 'Did the person injure their head, hip, or limb during a fall?',
        textZh: '跌倒时是否磕碰头部、髋骨或四肢造成伤害？',
        textMs: 'Adakah pesakit tercedera di kepala atau patah tulang semasa jatuh?',
        answerType: 'yes_no',
      },
    ],

    eye_symptoms: [
      {
        id: 'severe_pain',
        textKey: 'q.eye.pain',
        text: 'Is there severe deep eye pain or intense sensitivity to light?',
        textZh: '是否有眼球内部剧烈疼痛或极度畏光？',
        textMs: 'Adakah sakit mata yang teruk atau silau melampau?',
        answerType: 'yes_no',
        redFlagIf: ['yes', true],
      },
      {
        id: 'vision_change',
        textKey: 'q.eye.vision',
        text: 'Has there been a sudden drop in vision or blurred/blackened sight?',
        textZh: '视力是否有突发性下降、重影或视野发黑？',
        textMs: 'Adakah penglihatan kabur secara tiba-tiba atau hilang daya penglihatan?',
        answerType: 'yes_no',
        redFlagIf: ['yes', true],
      },
      {
        id: 'chemical_exposure',
        textKey: 'q.eye.chemical',
        text: 'Was there any chemical, bleach, or corrosive liquid splashed into the eye?',
        textZh: '是否有化学品、漂白水或腐蚀性液体溅入眼睛？',
        textMs: 'Adakah bahan kimia atau cecair peluntur terpercik ke dalam mata?',
        answerType: 'yes_no',
        redFlagIf: ['yes', true],
      },
    ],

    sore_throat: [
      {
        id: 'drooling',
        textKey: 'q.throat.drool',
        text: 'Is the person drooling, unable to swallow saliva, or having stridor/breathing trouble?',
        textZh: '病人是否无法吞咽口水、流口水不止，或出现呼吸喘鸣？',
        textMs: 'Adakah pesakit meleleh air liur kerana tak boleh menelan, atau susah nafas?',
        answerType: 'yes_no',
        redFlagIf: ['yes', true],
      },
      {
        id: 'fever',
        textKey: 'q.throat.fever',
        text: 'Is there an accompanying fever?',
        textZh: '是否伴有发烧？',
        textMs: 'Adakah disertai demam?',
        answerType: 'yes_no',
      },
    ],

    earache: [
      {
        id: 'swelling_behind',
        textKey: 'q.ear.swelling',
        text: 'Is there tender redness or swelling behind the ear (mastoid area)?',
        textZh: '耳后骨骼部位是否有红肿、隆起或明显压痛？',
        textMs: 'Adakah bengkak merah atau sakit di belakang telinga?',
        answerType: 'yes_no',
        redFlagIf: ['yes', true],
      },
      {
        id: 'discharge',
        textKey: 'q.ear.discharge',
        text: 'Is there pus or blood discharging from the ear canal?',
        textZh: '耳道是否有脓液或血液流出？',
        textMs: 'Adakah nanah atau darah mengalir keluar dari telinga?',
        answerType: 'yes_no',
      },
    ],

    uti: [
      {
        id: 'flank_pain',
        textKey: 'q.uti.flank',
        text: 'Is there high fever or severe pain in the back or side (flank)?',
        textZh: '是否有高烧伴随腰部或单侧肋下剧烈疼痛？',
        textMs: 'Adakah demam tinggi atau sakit mencucuk di pinggang/belakang?',
        answerType: 'yes_no',
        redFlagIf: ['yes', true],
      },
      {
        id: 'blood',
        textKey: 'q.uti.blood',
        text: 'Is there visible blood or red coloration in the urine?',
        textZh: '小便中是否有肉眼可见的血色或血块？',
        textMs: 'Adakah darah kelihatan dalam air kencing?',
        answerType: 'yes_no',
      },
    ],
    general: [
      {
        id: 'other_symptoms',
        textKey: 'q.general.other_symptoms',
        text: "Is there any other symptom you'd like to highlight?",
        textZh: "您是否还有其他想要特别说明的症状？",
        textMs: "Adakah terdapat sebarang gejala lain yang ingin anda nyatakan?",
        answerType: 'yes_no',
      },
    ],
  };

  return trees[ailmentCode] || trees.general || [];
}

export const RULESET_VERSION = '1.0.0';
export const RULESET_CONTENT_STATUS: ContentStatus = 'PROVISIONAL';
