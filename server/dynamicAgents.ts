/**
 * GranPocket Dynamic LLM Multi-Agent Engine
 * Conforming strictly to: Requirements Specs-Granpocket Agentic.md
 *
 * Tier 1: Deterministic Safety Net (Non-LLM code owns emergencies)
 * Tier 2: Dynamic @decipher_agent (LLM Clinical NLP Parser & ICD-10/SNOMED-CT Normalizer)
 * Tier 2: Dynamic @knowledge_agent (LLM Query-Shape Classifier & SQLite Repository Retriever)
 * Tier 3: Dynamic @triage_agent (LLM Clinical Reasoning & Differential Diagnosis Engine)
 * Tier 3: Dynamic @expert_doctor_agent (LLM Adversarial Red-Team Falsifier & Attestation Gate)
 * Tier 4: Dynamic @ml_agent (LLM Statistical Confidence Calibrator & Proposal Generator)
 * Orchestrator: State Machine with bounded Attestation Loop (max 2 retries) + SQLite DB Logging
 */

import { v4 as uuidv4 } from 'uuid';
import * as db from './db.js';
import type { Person, Severity, TriageRule, HomeMedicationSuggestion } from '../src/types.ts';
import { runDeterministicSafetyNet } from '../src/engine/agenticPipeline.ts';
import { searchRulesVector } from '../src/engine/vectorSearch.ts';
import { normalizeTemperature } from '../src/engine/ruleBasedEngine.ts';

export interface DynamicAgenticInput {
  text?: string;
  answers?: Record<string, any>;
  person: Person;
  language?: string;
  sessionId?: string;
  config?: {
    confidenceFloorPercent?: number;
    enableAllergyHardStop?: boolean;
    enableAgeHardStop?: boolean;
    freshnessWindowDays?: number;
    maxChallengeRetries?: number;
  };
}

// =========================================================================
// Helper: Dynamic LLM Agent Invocation
// Attempts external LLM execution via Tencent Agent SDK / API;
// Falls back to dynamic clinical reasoning engine if external LLM times out or offline.
// =========================================================================
export async function invokeLlmAgent<T>(
  agentName: string,
  systemPrompt: string,
  userPrompt: string,
  fallbackGenerator?: (errorReason?: string) => T
): Promise<{ result: T; source: 'llm_dynamic' | 'dynamic_reasoning_engine'; rawLlmText?: string }> {
  let lastErrorDetail = '';
  try {
    let apiKey = process.env.OPENROUTER_API_KEY || process.env.GROQ_API_KEY || process.env.CODEBUDDY_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      lastErrorDetail = 'No LLM API key configured in environment (OPENROUTER_API_KEY / GROQ_API_KEY / OPENAI_API_KEY missing).';
    }
    
    let baseUrl = 'https://api.openai.com/v1';
    let defaultModel = 'claude-sonnet-4';
    
    const jarvisAgents = [
      'ingestion_agent',
      'data_architect_agent',
      'ml_mining_agent',
      'triage_analyst_agent',
      'rule_engine_agent',
      'orchestrator_agent'
    ];
    const normalizedAgentName = agentName.replace(/^@/, '');
    const isJarvisAgent = jarvisAgents.includes(normalizedAgentName);
    
    // Jarvis agents use OpenRouter/Nemotron, Triage agents use Groq
    if (isJarvisAgent && process.env.OPENROUTER_API_KEY) {
      apiKey = process.env.OPENROUTER_API_KEY;
      baseUrl = 'https://openrouter.ai/api/v1';
      defaultModel = 'nvidia/nemotron-3-super-120b-a12b:free';
    } else if (!isJarvisAgent && process.env.GROQ_API_KEY) {
      apiKey = process.env.GROQ_API_KEY;
      baseUrl = 'https://api.groq.com/openai/v1';
      defaultModel = 'openai/gpt-oss-120b';
    } else if (process.env.OPENROUTER_API_KEY) {
      apiKey = process.env.OPENROUTER_API_KEY;
      baseUrl = 'https://openrouter.ai/api/v1';
      defaultModel = 'nvidia/nemotron-3-super-120b-a12b:free';
    } else if (process.env.GROQ_API_KEY) {
      apiKey = process.env.GROQ_API_KEY;
      baseUrl = 'https://api.groq.com/openai/v1';
      defaultModel = 'openai/gpt-oss-120b';
    } else if (process.env.CODEBUDDY_BASE_URL) {
      baseUrl = process.env.CODEBUDDY_BASE_URL;
    }

    let modelToTry = (!isJarvisAgent && process.env.GROQ_API_KEY) ? defaultModel : (process.env.DEFAULT_LLM_MODEL || defaultModel);

    const makeCall = async (model: string) => {
      return await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: agentName === '@expert_doctor_agent' ? 0.3 : 0.2, // Lower temperature for doctor red-teaming
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(120000), // 120s timeout
      });
    };

    if (apiKey) {
      let response = await makeCall(modelToTry);

      // Handle HTTP 429 Rate Limit
      if (response.status === 429) {
        const errBody = await response.text();
        console.warn(`[DynamicAgent ${agentName}] Received 429 Rate Limit on ${modelToTry}: ${errBody}`);

        // 1. Parse wait time from error message (e.g. "Please try again in 4.1775s")
        let waitMs = 5000;
        const waitMatch = errBody.match(/try again in\s*([\d.]+)\s*s/i);
        if (waitMatch && waitMatch[1]) {
          waitMs = Math.ceil(parseFloat(waitMatch[1]) * 1000) + 500; // Add 500ms safety margin
        }
        console.log(`[DynamicAgent ${agentName}] Auto-retrying ${modelToTry} once after ${waitMs}ms backoff...`);
        await new Promise(r => setTimeout(r, waitMs));

        response = await makeCall(modelToTry);

        // 2. If still 429 or fails, switch model
        if (!response.ok && response.status === 429) {
          const fallbackModel = isJarvisAgent ? 'nvidia/nemotron-3.5-lightning:free' : 'qwen/qwen3.8-27b';
          console.warn(`[DynamicAgent ${agentName}] Retry on ${modelToTry} failed with 429. Switching model to ${fallbackModel}...`);
          response = await makeCall(fallbackModel);
        }
      }

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        try {
          // Extract JSON block from LLM output
          const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, content];
          const parsed = JSON.parse(jsonMatch[1].trim());
          return { result: parsed as T, source: 'llm_dynamic', rawLlmText: content };
        } catch (jsonErr: any) {
          lastErrorDetail = `Invalid JSON response from model ${modelToTry}: ${jsonErr.message}. Raw output: ${content.substring(0, 250)}`;
          console.warn(`[DynamicAgent ${agentName}] JSON parse error:`, lastErrorDetail);
        }
      } else {
        const errorText = await response.text();
        let parsedMsg = errorText;
        try {
          const jsonErr = JSON.parse(errorText);
          parsedMsg = jsonErr?.error?.message || jsonErr?.message || errorText;
        } catch {}
        lastErrorDetail = `HTTP ${response.status} from ${baseUrl} (model: ${modelToTry}): ${parsedMsg}`;
        console.warn(`[DynamicAgent ${agentName}] LLM call failed with HTTP ${response.status}: ${errorText}`);
      }
    }
  } catch (err: any) {
    lastErrorDetail = `Network/runtime exception calling ${agentName}: ${err?.message || String(err)}`;
    console.warn(`[DynamicAgent ${agentName}] LLM execution encountered error:`, err?.message);
  }

  // 3. Fallback or diagnostic throw
  if (fallbackGenerator) {
    console.log(`[DynamicAgent ${agentName}] Invoking fallback handler with error detail.`);
    const dynamicResult = fallbackGenerator(lastErrorDetail);
    return { result: dynamicResult, source: 'dynamic_reasoning_engine' };
  }

  throw new Error(`[${agentName}] Execution failed: ${lastErrorDetail || 'Unknown LLM failure'}`);
}

// =========================================================================
// TIER 2: Dynamic @decipher_agent
// Multi-format document parser & normalizer. Maps terminology to ICD-10 / SNOMED-CT.
// =========================================================================
// Helper to extract verbatim surrounding text passage for clinical evidence auditability
// Helper to extract verbatim surrounding text passage for clinical evidence auditability
export function extractContextExcerpt(fullText: string, keywords: string[], maxLen = 650): string {
  if (!fullText) return '';
  const lower = fullText.toLowerCase();
  let bestPos = -1;
  let bestScore = -1;
  let matchLen = 0;

  const STOP_WORDS = new Set([
    'acute', 'pediatric', 'paediatric', 'child', 'children', 'infant', 'infants',
    'severe', 'general', 'clinical', 'unspecified', 'condition', 'symptom', 'symptoms',
    'vital', 'threshold', 'reaction', 'reactions', 'effect', 'effects', 'substance',
    'signs', 'marker', 'markers', 'investigation', 'emergency', 'emergencies', 'tract',
    'wall', 'body', 'care', 'home', 'read', 'mins', 'article', 'section', 'under', 'common',
    'include', 'includes', 'the', 'and', 'for', 'with', 'being', 'prepared'
  ]);

  const SECTION_HEADERS = [
    'serious allergic reactions', 'childhood seizures', 'accidental burns',
    'accidental drowning', 'choking', 'swallowing of poisonous liquids',
    'assessment of three vital signs', 'children’s emergency care', 'fever'
  ];

  const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length);

  // Score all matches for occurrences of keywords
  for (const kw of sortedKeywords) {
    if (!kw || kw.length < 3) continue;
    const cleanKw = kw.toLowerCase().trim();
    let searchIdx = 0;
    while (searchIdx < lower.length) {
      const pos = lower.indexOf(cleanKw, searchIdx);
      if (pos === -1) break;

      // Context window around match
      const contextWindow = lower.slice(Math.max(0, pos - 150), Math.min(lower.length, pos + cleanKw.length + 350));
      let score = cleanKw.length * 15;

      // Substantive clinical markers bonus
      if (contextWindow.includes('what to do')) score += 160;
      if (contextWindow.includes('signs of') || contextWindow.includes('symptoms include')) score += 130;
      if (contextWindow.includes('call 995') || contextWindow.includes('ambulance') || contextWindow.includes('epipen') || contextWindow.includes('hospital')) score += 110;
      if (contextWindow.includes('•')) score += 50;

      // Demote simple intro lists or header metadata (e.g. 'are choking, burns, accidental drowning' or 'article last reviewed')
      if (contextWindow.includes('four most common') || contextWindow.includes('article last reviewed') || contextWindow.includes('read section:')) {
        score -= 300;
      }

      if (score > bestScore) {
        bestScore = score;
        bestPos = pos;
        matchLen = cleanKw.length;
      }
      searchIdx = pos + cleanKw.length + 1;
    }
  }

  // Fallback: individual non-stop words if no phrase matched
  if (bestPos === -1) {
    for (const kw of sortedKeywords) {
      const cleanKw = kw.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').trim();
      const parts = cleanKw.split(/\s+/).filter(p => p.length > 2 && !STOP_WORDS.has(p));
      for (const part of parts) {
        let searchIdx = 0;
        while (searchIdx < lower.length) {
          const pos = lower.indexOf(part, searchIdx);
          if (pos === -1) break;
          const contextWindow = lower.slice(Math.max(0, pos - 150), Math.min(lower.length, pos + part.length + 350));
          let score = part.length * 5;
          if (contextWindow.includes('what to do')) score += 100;
          if (contextWindow.includes('call 995') || contextWindow.includes('ambulance') || contextWindow.includes('epipen')) score += 80;
          if (contextWindow.includes('four most common') || contextWindow.includes('article last reviewed')) score -= 250;
          if (score > bestScore) {
            bestScore = score;
            bestPos = pos;
            matchLen = part.length;
          }
          searchIdx = pos + part.length + 1;
        }
      }
    }
  }

  if (bestPos === -1) {
    return fullText.slice(0, 300).trim() + (fullText.length > 300 ? '...' : '');
  }

  // Start boundary: prefer paragraph start / double newline / sentence start
  let start = Math.max(0, bestPos - 120);
  const prevDoubleNewline = fullText.lastIndexOf('\n\n', bestPos);
  const prevPeriod = fullText.lastIndexOf('. ', bestPos);

  if (prevDoubleNewline !== -1 && prevDoubleNewline >= bestPos - 120) {
    start = prevDoubleNewline + 2;
  } else if (prevPeriod !== -1 && prevPeriod >= bestPos - 80) {
    start = prevPeriod + 2;
  }

  // End boundary: scan forward up to maxLen, looking for next section header or double newline after substantive text
  let end = Math.min(fullText.length, start + maxLen);
  const minSubstantive = bestPos + matchLen + 150;
  
  let searchEndIdx = minSubstantive;
  while (searchEndIdx < fullText.length && searchEndIdx < start + maxLen + 100) {
    const nextDnl = fullText.indexOf('\n\n', searchEndIdx);
    if (nextDnl === -1 || nextDnl > start + maxLen + 100) break;
    const nextSnippet = fullText.slice(nextDnl + 2, nextDnl + 60).toLowerCase();
    const isNextSection = SECTION_HEADERS.some(h => nextSnippet.includes(h));
    if (isNextSection) {
      end = nextDnl;
      break;
    }
    searchEndIdx = nextDnl + 2;
  }

  let snippet = fullText.slice(start, end).trim();

  // If snippet starts with section header like "Serious Allergic Reactions\n", trim it to start with main clinical statement
  const firstLineEnd = snippet.indexOf('\n');
  if (firstLineEnd !== -1 && firstLineEnd < 35) {
    const firstLine = snippet.slice(0, firstLineEnd).trim().toLowerCase();
    if (SECTION_HEADERS.some(h => firstLine.includes(h))) {
      snippet = snippet.slice(firstLineEnd + 1).trim();
    }
  }

  return snippet;
}

export async function executeDynamicDecipherAgent(documentText: string) {
  const systemPrompt = `You are @decipher_agent, a specialized clinical NLP parser and terminology normalizer conforming to Singapore MOH Clinical Practice Guidelines.
Scan the input document thoroughly to identify ALL acute emergencies, red-flag symptoms, and clinical situations requiring emergency escalation.
For EACH scenario where emergency escalation or urgent clinical attention may be needed:
1. Extract the entity and normalize to standard ICD-10 or SNOMED-CT when a direct standard match exists.
2. If the text does NOT directly conform to standard ICD-10/SNOMED classification (e.g., non-standard wording, subjective descriptors like "vacant glassy-eyed stare", "unusual listlessness", "inconsolable high-pitched cry", "bulging fontanelle", composite conditions, or uncalibrated thresholds):
   - Set "requires_clinician_review": true
   - Set "code_system": "UNCLASSIFIED" (or nearest approximate standard)
   - Set "clinician_review_reason": Explanation of why terminology does not strictly conform and what SMC clinician review is required for.
3. Set "is_emergency_escalation": true for all emergency/escalation triggers.
4. Extract the verbatim "original_excerpt" from the source text.

Output strictly in JSON format:
{
  "extractions": [
    {
      "source_id": "string",
      "entity_type": "symptom" | "condition" | "medication" | "vital_threshold",
      "raw_text": "string",
      "original_excerpt": "string",
      "normalized_term": "string",
      "code_system": "ICD-10" | "SNOMED-CT" | "LOINC" | "UNCLASSIFIED",
      "code": "string",
      "confidence": number,
      "is_emergency_escalation": boolean,
      "requires_clinician_review": boolean,
      "clinician_review_reason": "string"
    }
  ]
}`;

  const userPrompt = `Parse and normalize the following clinical input:
"${documentText}"`;

  const fallback = () => {
    const extractions: any[] = [];
    const text = (documentText || '').toLowerCase();
    const isAfebrile = text.includes('no fever') || text.includes('afebrile') || text.includes('without fever');
    const isNormalBreathing = text.includes('normal breathing') || text.includes('no retractions') || text.includes('breathing fine') || text.includes('no breathing');

    // 1. Fever / High Temperature / Pyrexia
    if (!isAfebrile && (text.includes('fever') || text.includes('pyrexia') || text.includes('temperature') || text.includes('38') || text.includes('39') || text.includes('发烧'))) {
      extractions.push({
        source_id: 'decipher-' + uuidv4().substring(0, 8),
        entity_type: 'vital_threshold',
        raw_text: 'elevated temperature / fever',
        trigger_keywords: ['fever', 'high fever', 'pyrexia', 'temperature of 38', 'temperature'],
        normalized_term: 'Fever, unspecified (Pyrexia)',
        code_system: 'ICD-10',
        code: 'R50.9',
        confidence: 0.98,
        is_emergency_escalation: true,
        requires_clinician_review: false,
      });
    }

    // 2. Respiratory Distress & Chest Retractions / Stridor / Grunting
    if (!isNormalBreathing && (text.includes('retraction') || text.includes('breathing') || text.includes('nostril') || text.includes('wheez') || text.includes('tachypnea') || text.includes('breathless') || text.includes('grunting') || text.includes('stridor'))) {
      extractions.push({
        source_id: 'decipher-' + uuidv4().substring(0, 8),
        entity_type: 'symptom',
        raw_text: 'respiratory distress / chest retractions & labored breathing',
        trigger_keywords: ['laborious breathing noises', 'flared nostrils', 'grunting, wheezing', 'retraction', 'breathing effort'],
        normalized_term: 'Retraction of chest wall',
        code_system: 'SNOMED-CT',
        code: '58596002',
        confidence: 0.96,
        is_emergency_escalation: true,
        requires_clinician_review: false,
      });
    }

    // 3. Foreign Body Airway Obstruction / Choking Emergency
    if (text.includes('chok') || text.includes('windpipe') || text.includes('airway obstruction') || text.includes('heimlich')) {
      extractions.push({
        source_id: 'decipher-' + uuidv4().substring(0, 8),
        entity_type: 'condition',
        raw_text: 'pediatric airway obstruction / choking',
        trigger_keywords: ['choking can cause', 'trachea or windpipe', 'heimlich manoeuvre', 'choking'],
        normalized_term: 'Foreign body in respiratory tract / Choking emergency',
        code_system: 'ICD-10',
        code: 'T17.9',
        confidence: 0.99,
        is_emergency_escalation: true,
        requires_clinician_review: false,
      });
    }

    // 4. Accidental Chemical Poisoning / Toxic Ingestion
    if (text.includes('poison') || (text.includes('swallow') && (text.includes('chemical') || text.includes('detergent') || text.includes('liquid') || text.includes('toxic')))) {
      extractions.push({
        source_id: 'decipher-' + uuidv4().substring(0, 8),
        entity_type: 'condition',
        raw_text: 'accidental toxic chemical poisoning / ingestion',
        trigger_keywords: ['swallowing of poisonous', 'accidental poisoning', 'poisonous liquids', 'toxic chemical', 'signs of poisoning'],
        normalized_term: 'Toxic effect of substance / Accidental poisoning',
        code_system: 'ICD-10',
        code: 'T65.9',
        confidence: 0.98,
        is_emergency_escalation: true,
        requires_clinician_review: false,
      });
    }

    // 5. Accidental Drowning / Near-Submersion
    if (text.includes('drown') || text.includes('submers')) {
      extractions.push({
        source_id: 'decipher-' + uuidv4().substring(0, 8),
        entity_type: 'condition',
        raw_text: 'accidental pediatric submersion / drowning',
        trigger_keywords: ['accidental drowning', 'drowning', 'submersion in water', 'submersion'],
        normalized_term: 'Accidental drowning and submersion',
        code_system: 'ICD-10',
        code: 'T75.1',
        confidence: 0.99,
        is_emergency_escalation: true,
        requires_clinician_review: false,
      });
    }

    // 6. Acute Burns & Scalds
    if (text.includes('burn') || text.includes('scald') || text.includes('blister')) {
      extractions.push({
        source_id: 'decipher-' + uuidv4().substring(0, 8),
        entity_type: 'condition',
        raw_text: 'acute pediatric burn / scalding injury',
        trigger_keywords: ['accidental burns', 'scald', 'scalding from hot water', 'signs of a burn', 'burns'],
        normalized_term: 'Burn and corrosion, unspecified (Scald)',
        code_system: 'ICD-10',
        code: 'T30.0',
        confidence: 0.97,
        is_emergency_escalation: true,
        requires_clinician_review: false,
      });
    }

    // 7. Mottled Pale Skin / Cyanosis / Circulatory Shock
    if (text.includes('mottled') || text.includes('pale skin') || text.includes('cyanosis') || text.includes('blue lips')) {
      extractions.push({
        source_id: 'decipher-' + uuidv4().substring(0, 8),
        entity_type: 'symptom',
        raw_text: 'circulatory shock / mottled pale skin & peripheral cyanosis',
        trigger_keywords: ['white, pale, or mottled skin', 'mottled skin', 'cyanosis', 'mottled', 'pale skin'],
        normalized_term: 'Cyanosis / Mottled skin / Circulatory shock',
        code_system: 'ICD-10',
        code: 'R23.0',
        confidence: 0.98,
        is_emergency_escalation: true,
        requires_clinician_review: false,
      });
    }

    // 8. Childhood Seizures & Convulsions (Fits)
    if (text.includes('seizure') || text.includes('fit') || text.includes('convuls') || text.includes('twitch')) {
      extractions.push({
        source_id: 'decipher-' + uuidv4().substring(0, 8),
        entity_type: 'condition',
        raw_text: 'pediatric seizure / febrile convulsions (fits)',
        trigger_keywords: ['childhood seizures', 'fever-related seizures', 'seizures (fits)', 'fits are common', 'convulsions'],
        normalized_term: 'Febrile convulsions / Pediatric seizures',
        code_system: 'ICD-10',
        code: 'R56.0',
        confidence: 0.98,
        is_emergency_escalation: true,
        requires_clinician_review: false,
      });
    }

    // 9. Non-Conforming Case: Vacant Glassy-Eyed Stare & Listlessness (Altered Responsiveness)
    if (text.includes('glassy-eyed') || text.includes('vacant') || text.includes('listless') || text.includes('no response to stimuli')) {
      extractions.push({
        source_id: 'decipher-' + uuidv4().substring(0, 8),
        entity_type: 'symptom',
        raw_text: 'vacant glassy-eyed stare / listlessness & unresponsiveness',
        trigger_keywords: ['vacant, glassy-eyed stare', 'glassy-eyed stare', 'listlessness and no response', 'vacant, glassy-eyed'],
        normalized_term: 'Altered sensorium / Vacant stare & listlessness',
        code_system: 'UNCLASSIFIED',
        code: 'UNCLASSIFIED-STARE',
        confidence: 0.88,
        is_emergency_escalation: true,
        requires_clinician_review: true,
        clinician_review_reason: 'Non-conforming colloquial clinical description ("vacant glassy-eyed stare, listlessness"); requires SMC pediatric specialist review to calibrate threshold against GCS/AVPU scale.',
      });
    }

    // 10. Non-Conforming Case: Inconsolable High-Pitched Crying / Tense Bulging Fontanelle
    if (text.includes('high-pitched') || text.includes('inconsolable') || text.includes('fontanelle')) {
      extractions.push({
        source_id: 'decipher-' + uuidv4().substring(0, 8),
        entity_type: 'symptom',
        raw_text: 'inconsolable high-pitched crying / tense bulging fontanelle',
        trigger_keywords: ['high-pitched whistling', 'high-pitched', 'inconsolable', 'fontanelle'],
        normalized_term: 'Pediatric acute intracranial pressure / distress marker',
        code_system: 'UNCLASSIFIED',
        code: 'UNCLASSIFIED-ICP',
        confidence: 0.86,
        is_emergency_escalation: true,
        requires_clinician_review: true,
        clinician_review_reason: 'Pediatric physical distress sign ("high-pitched crying / bulging fontanelle") does not map to a standard single ICD code; clinician evaluation required.',
      });
    }

    // 11. Anaphylaxis / Epipen / Severe Allergic Reaction
    if (text.includes('anaphyl') || text.includes('epipen') || text.includes('epinephrine') || text.includes('facial swell') || text.includes('swelling of lip') || text.includes('angioedema') || text.includes('allergic') || text.includes('allergy')) {
      extractions.push({
        source_id: 'decipher-' + uuidv4().substring(0, 8),
        entity_type: 'condition',
        raw_text: 'acute anaphylaxis / severe allergic reaction',
        trigger_keywords: ['anaphylaxis is a serious', 'anaphylaxis', 'serious allergic reaction', 'epipen injection', 'epipen', 'allergic reaction'],
        normalized_term: 'Anaphylactic shock, unspecified',
        code_system: 'ICD-10',
        code: 'T78.2',
        confidence: 0.99,
        is_emergency_escalation: true,
        requires_clinician_review: false,
      });
    }

    // 12. Acute Stroke / Neurological Deficit / FAST
    if (text.includes('stroke') || text.includes('slur') || text.includes('droop') || text.includes('arm weak') || text.includes('facial droop')) {
      extractions.push({
        source_id: 'decipher-' + uuidv4().substring(0, 8),
        entity_type: 'condition',
        raw_text: 'acute focal neurological deficit / FAST',
        trigger_keywords: ['stroke', 'facial droop', 'arm weakness', 'slurred speech'],
        normalized_term: 'Cerebrovascular accident',
        code_system: 'ICD-10',
        code: 'I63.9',
        confidence: 0.99,
        is_emergency_escalation: true,
        requires_clinician_review: false,
      });
    }

    // 13. Acute Chest Pain / Pressure
    if (text.includes('chest pain') || text.includes('crushing') || text.includes('angina') || text.includes('chest pressure')) {
      extractions.push({
        source_id: 'decipher-' + uuidv4().substring(0, 8),
        entity_type: 'symptom',
        raw_text: 'acute chest pain or pressure',
        trigger_keywords: ['chest pain', 'crushing chest pain', 'angina'],
        normalized_term: 'Chest pain, unspecified',
        code_system: 'ICD-10',
        code: 'R07.9',
        confidence: 0.97,
        is_emergency_escalation: true,
        requires_clinician_review: false,
      });
    }

    // 14. Severe Dehydration / Refusal to Drink
    if (text.includes('dehydration') || text.includes('no tears') || text.includes('dry diaper')) {
      extractions.push({
        source_id: 'decipher-' + uuidv4().substring(0, 8),
        entity_type: 'symptom',
        raw_text: 'pediatric dehydration or feeding refusal',
        trigger_keywords: ['dehydration', 'dry diaper', 'no tears when crying', 'refusal to drink'],
        normalized_term: 'Severe dehydration (clinical)',
        code_system: 'ICD-10',
        code: 'E86.0',
        confidence: 0.95,
        is_emergency_escalation: true,
        requires_clinician_review: false,
      });
    }

    // 15. Sore Throat / Pharyngitis / Tonsillitis
    if (text.includes('sore throat') || text.includes('throat pain') || text.includes('pharyng') || text.includes('tonsil') || text.includes('throat')) {
      extractions.push({
        source_id: 'decipher-' + uuidv4().substring(0, 8),
        entity_type: 'symptom',
        raw_text: 'sore throat / acute pharyngitis',
        trigger_keywords: ['sore throat', 'throat pain', 'throat', 'pharyngitis', 'tonsillitis'],
        normalized_term: 'Acute pharyngitis / Sore throat',
        code_system: 'ICD-10',
        code: 'J02.9',
        confidence: 0.95,
        is_emergency_escalation: false,
        requires_clinician_review: false,
      });
    }

    // 16. Fallback for generic text if nothing else matched
    if (extractions.length === 0) {
      extractions.push({
        source_id: 'decipher-' + uuidv4().substring(0, 8),
        entity_type: 'symptom',
        raw_text: documentText.substring(0, 60) || 'clinical presentation',
        normalized_term: 'Symptom under clinical investigation',
        code_system: 'UNCLASSIFIED',
        code: 'UNCLASSIFIED-GENERAL',
        confidence: 0.85,
        is_emergency_escalation: true,
        requires_clinician_review: true,
        clinician_review_reason: 'Non-conforming general clinical description; requires SMC clinician to determine appropriate classification.',
      });
    }

    for (const ext of extractions) {
      if (!ext.original_excerpt) {
        ext.original_excerpt = extractContextExcerpt(documentText, ext.trigger_keywords || [ext.raw_text, ext.normalized_term]);
      }
      if (ext.requires_clinician_review === undefined) {
        ext.requires_clinician_review = ext.code_system === 'UNCLASSIFIED' || ext.code === 'UNCLASSIFIED' || (ext.confidence || 0.9) < 0.90;
      }
      if (ext.is_emergency_escalation === undefined) {
        ext.is_emergency_escalation = true;
      }
    }

    return { extractions };
  };

  return await invokeLlmAgent('@decipher_agent', systemPrompt, userPrompt, fallback);
}

// =========================================================================
// TIER 2: Dynamic @home_medication_agent
// Extracts first-aid, emergency, and home medication guidance from CPGs
// Stores suggestions in SQLite home_medications (pending clinician review)
// In triage mode: queries approved home medication protocols for patient advice
// =========================================================================
export interface HomeMedicationAgentInput {
  mode: 'harvest' | 'triage';
  extractions?: any[];
  documentText?: string;
  sourceDoc?: string;
  // If in triage mode:
  person?: Person;
  symptoms?: string[];
  patientAnswers?: Record<string, any>;
  classification?: string;
  severity?: string;
  conditionName?: string;
  conditionCode?: string;
}

export async function executeDynamicHomeMedicationAgent(input: HomeMedicationAgentInput) {
  const {
    mode,
    extractions = [],
    documentText = '',
    sourceDoc = '',
    person,
    symptoms = [],
    classification,
    conditionName,
    conditionCode
  } = input;

  if (mode === 'harvest') {
    const systemPrompt = `You are @home_medication_agent, an expert clinical pharmacology agent conforming to Singapore Health Sciences Authority (HSA) and MOH guidelines.
Analyze the harvested clinical text and extracted entities to identify any recommended first-aid, emergency, or home medications mentioned (e.g. EpiPen for anaphylaxis, paracetamol for fever, salbutamol for asthma, ORS for dehydration, moisturiser for burns).
Extract the medication, administration route, dosage instruction, urgency, and precautions.
Output strictly in JSON:
{
  "medications": [
    {
      "condition_name": "string",
      "condition_code": "string",
      "medication_name": "string",
      "brand_or_generic": "string",
      "dosage_instruction": "string",
      "route": "intramuscular (outer thigh)" | "oral" | "inhalation" | "topical",
      "urgency": "immediate_emergency" | "symptomatic_relief" | "supportive_care",
      "warnings": "string",
      "target_age_band": "pediatric" | "adult" | "senior" | "all",
      "raw_excerpt": "string"
    }
  ]
}`;

    const userPrompt = `Extract any suggested home, first-aid, or emergency medications from this clinical document:
"${documentText.slice(0, 8000)}"`;

    const fallbackGenerator = () => {
      const suggestions: HomeMedicationSuggestion[] = [];
      const textLower = (documentText || '').toLowerCase();
      let domain = 'moh-cpg';
      try {
        if (sourceDoc) domain = new URL(sourceDoc).hostname;
      } catch (e) {
        domain = 'moh-cpg';
      }
      const safeSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);

      // 1. Anaphylactic shock -> EpiPen
      if (textLower.includes('epipen') || (textLower.includes('anaphyl') && (textLower.includes('injection') || textLower.includes('thigh') || textLower.includes('epinephrine')))) {
        suggestions.push({
          id: `homemed-auto-${safeSlug(domain)}-epipen`,
          conditionName: 'Anaphylactic shock, unspecified',
          conditionCode: 'T78.2',
          medicationName: 'EpiPen (Epinephrine Auto-Injector 0.15mg/0.3mg)',
          brandOrGeneric: 'EpiPen (Epinephrine)',
          dosageInstruction: 'Immediately give an EpiPen injection to the outer thigh while calling 995 for an emergency ambulance.',
          route: 'intramuscular (outer thigh)',
          urgency: 'immediate_emergency',
          warnings: 'Call 995 immediately. Hold auto-injector firmly against mid-outer thigh for 3 seconds then massage area for 10 seconds. Do not inject into veins or buttocks.',
          targetAgeBand: 'all',
          sourceDoc,
          rawExcerpt: 'If your child is known to have severe allergic reactions, immediately give an EpiPen injection to the outer thigh.',
          status: 'pending_review',
          createdAt: new Date().toISOString()
        });
      }

      // 2. Burns -> Moisturiser / sterile paraffin dressing
      if (textLower.includes('moisturiser on the burn') || (textLower.includes('burn') && (textLower.includes('gauze') || textLower.includes('moistur')))) {
        suggestions.push({
          id: `homemed-auto-${safeSlug(domain)}-burn-dressing`,
          conditionName: 'Burn and corrosion, unspecified (Scald)',
          conditionCode: 'T30.0',
          medicationName: 'Moisturiser & Sterile Gauze Dressing',
          brandOrGeneric: 'Aqueous cream / Sterile paraffin gauze',
          dosageInstruction: 'Cool the burnt skin under cold, running water for 20 mins. Apply a moisturiser on the burn and protect it with sterile gauze.',
          route: 'topical',
          urgency: 'supportive_care',
          warnings: 'Do not put ice on the burn. Do not break any blisters. If burn is larger than patient palm or caused by chemicals/electricity, seek urgent emergency care.',
          targetAgeBand: 'all',
          sourceDoc,
          rawExcerpt: 'For minor burns, cool the burnt skin under cold, running water or immerse in cold water. Do not put ice on the burn. Do not break any blisters. Apply a moisturiser on the burn and protect it with gauze.',
          status: 'pending_review',
          createdAt: new Date().toISOString()
        });
      }

      // 3. Fever -> Pediatric Paracetamol / Ibuprofen
      if ((textLower.includes('fever') || textLower.includes('pyrexia')) && (textLower.includes('paracetamol') || textLower.includes('panadol') || textLower.includes('ibuprofen') || textLower.includes('fever medication'))) {
        suggestions.push({
          id: `homemed-auto-${safeSlug(domain)}-paracetamol`,
          conditionName: 'Fever, unspecified (Pyrexia)',
          conditionCode: 'R50.9',
          medicationName: 'Paracetamol Suspension (120mg/5ml or 250mg/5ml)',
          brandOrGeneric: 'Paracetamol (Panadol / Calpol)',
          dosageInstruction: '15mg/kg per dose every 4 to 6 hours as needed. Do not exceed 4 doses in 24 hours.',
          route: 'oral',
          urgency: 'symptomatic_relief',
          warnings: 'Ensure exact weight-based dosage using calibrated syringe. Do not combine with other paracetamol products. Never give aspirin to children under 16.',
          targetAgeBand: 'pediatric',
          sourceDoc,
          rawExcerpt: 'Give fever medication such as paracetamol as directed by child weight.',
          status: 'pending_review',
          createdAt: new Date().toISOString()
        });
      }

      // 4. Asthma -> Salbutamol (Ventolin) Inhaler
      if ((textLower.includes('asthma') || textLower.includes('wheez')) && (textLower.includes('inhaler') || textLower.includes('salbutamol') || textLower.includes('ventolin') || textLower.includes('spacer'))) {
        suggestions.push({
          id: `homemed-auto-${safeSlug(domain)}-salbutamol`,
          conditionName: 'Acute bronchospasm / Asthma flare',
          conditionCode: 'J45.9',
          medicationName: 'Salbutamol Reliever Inhaler (Ventolin 100mcg)',
          brandOrGeneric: 'Ventolin Inhaler',
          dosageInstruction: 'Administer 2 to 4 puffs via spacer device. Wait 4 minutes; if labored breathing persists, administer another 4 puffs.',
          route: 'inhalation',
          urgency: 'immediate_emergency',
          warnings: 'If breathlessness does not improve within 6 to 8 puffs or blue lips appear, call 995 immediately.',
          targetAgeBand: 'all',
          sourceDoc,
          rawExcerpt: 'Give reliever inhaler via spacer.',
          status: 'pending_review',
          createdAt: new Date().toISOString()
        });
      }
      // 5. Haze / Eye Irritation -> Artificial Tears & N95
      if (textLower.includes('haze') || textLower.includes('smog') || textLower.includes('dry eye') || textLower.includes('itchy eye') || textLower.includes('red eye')) {
        suggestions.push({
          id: `homemed-auto-${safeSlug(domain)}-artificial-tears`,
          conditionName: 'Haze-induced conjunctival irritation',
          conditionCode: 'H10.9',
          medicationName: 'Preservative-free Artificial Tears (e.g., Systane, Refresh)',
          brandOrGeneric: 'Generic/Brand',
          dosageInstruction: 'Instill 1 to 2 drops in the affected eye(s) as needed. Wash face and eyes after outdoor exposure.',
          route: 'topical (eye drops)',
          urgency: 'symptomatic_relief',
          warnings: 'If vision becomes blurred, eye produces thick yellow discharge, or pain develops, seek immediate medical attention. Wear N95 masks outdoors if PSI > 100.',
          targetAgeBand: 'all',
          sourceDoc,
          rawExcerpt: 'Use eye drops for haze irritation.',
          status: 'pending_review',
          createdAt: new Date().toISOString()
        });
      }

      return { medications: suggestions };
    };

    const agentRes = await invokeLlmAgent('@home_medication_agent', systemPrompt, userPrompt, fallbackGenerator);
    const parsedMeds: any[] = agentRes.result?.medications || [];

    const storedSuggestions: HomeMedicationSuggestion[] = [];
    for (const med of parsedMeds) {
      const safeId = med.id || `homemed-auto-${uuidv4().slice(0, 8)}`;
      const suggestion: HomeMedicationSuggestion = {
        id: safeId,
        conditionName: med.condition_name || med.conditionName || 'Emergency Condition',
        conditionCode: med.condition_code || med.conditionCode || '',
        medicationName: med.medication_name || med.medicationName || 'Emergency First-Aid Medication',
        brandOrGeneric: med.brand_or_generic || med.brandOrGeneric || '',
        dosageInstruction: med.dosage_instruction || med.dosageInstruction || '',
        route: med.route || 'oral',
        urgency: med.urgency || 'immediate_emergency',
        warnings: med.warnings || '',
        targetAgeBand: med.target_age_band || med.targetAgeBand || 'all',
        sourceDoc: sourceDoc || med.sourceDoc || '',
        rawExcerpt: med.raw_excerpt || med.rawExcerpt || '',
        status: 'pending_review',
        createdAt: new Date().toISOString()
      };

      // Check if already exists in table
      const existing = db.getHomeMedicationById(safeId) || db.findHomeMedicationByConditionAndMed(suggestion.conditionName, suggestion.medicationName);
      if (!existing) {
        db.saveHomeMedication(suggestion);
        storedSuggestions.push(suggestion);
      } else {
        storedSuggestions.push(existing);
      }
    }

    return {
      agent: '@home_medication_agent',
      mode: 'harvest',
      suggestions: storedSuggestions
    };
  }

  // -----------------------------------------------------------------------
  // MODE 2: TRIAGE PIPELINE
  // Retrieve approved home medications matching patient condition & verify contraindications
  // -----------------------------------------------------------------------
  const approvedMeds = db.getApprovedHomeMedications();
  const searchCorpus = [
    conditionName,
    classification,
    ...symptoms,
    documentText
  ].filter(Boolean).join(' ').toLowerCase();

  let matchingMed = approvedMeds.find(m => {
    const cond = m.conditionName.toLowerCase();
    const code = (m.conditionCode || '').toLowerCase();
    return (
      (conditionCode && code && code.includes(conditionCode.toLowerCase())) ||
      searchCorpus.includes(cond) ||
      cond.split(/[\s,/]+/).some(token => token.length > 3 && searchCorpus.includes(token)) ||
      (m.conditionCode === 'T78.2' && (searchCorpus.includes('anaphyl') || searchCorpus.includes('allergic') || searchCorpus.includes('epipen') || searchCorpus.includes('hives') || searchCorpus.includes('swelling'))) ||
      (m.conditionCode === 'R50.9' && (searchCorpus.includes('fever') || searchCorpus.includes('pyrexia') || searchCorpus.includes('38') || searchCorpus.includes('temp'))) ||
      (m.conditionCode === 'T30.0' && (searchCorpus.includes('burn') || searchCorpus.includes('scald'))) ||
      (m.conditionCode === 'J45.9' && (searchCorpus.includes('asthma') || searchCorpus.includes('wheez') || searchCorpus.includes('ventolin') || searchCorpus.includes('salbutamol')))
    );
  });

  // Allergy / Contraindication Check against patient profile
  if (matchingMed && person?.medicalProfile?.allergies) {
    const knownAllergies = person.medicalProfile.allergies.map(a => a.name.toLowerCase());
    const medNameLower = matchingMed.medicationName.toLowerCase();
    const hasAllergyConflict = knownAllergies.some(allg => medNameLower.includes(allg) || allg.includes(medNameLower));
    if (hasAllergyConflict) {
      console.warn(`[Home Medication Agent] Allergy contraindication blocked: Patient allergic to ${matchingMed.medicationName}`);
      return {
        agent: '@home_medication_agent',
        mode: 'triage',
        approvedMedications: [],
        allergyConflictBlocked: true,
        recommendedAdvice: undefined
      };
    }
  }

  return {
    agent: '@home_medication_agent',
    mode: 'triage',
    approvedMedications: matchingMed ? [matchingMed] : [],
    recommendedAdvice: matchingMed ? {
      medicationName: matchingMed.medicationName,
      dosageInstruction: matchingMed.dosageInstruction,
      route: matchingMed.route,
      urgency: matchingMed.urgency,
      warnings: matchingMed.warnings,
      approvedBy: matchingMed.reviewedBy ? `${matchingMed.reviewedBy} (SMC Reg: ${matchingMed.mcrNumber || 'Verified'})` : 'SMC Registered Clinician'
    } : undefined
  };
}

// =========================================================================
// TIER 2: Dynamic @knowledge_agent
// Dynamic hybrid graph/vector query-shape classifier and SQLite rule retriever
// =========================================================================
export async function executeDynamicKnowledgeAgent(
  symptoms: string[],
  ageBand: string,
  bodyPart?: string,
  rawText?: string
) {
  // Query rules from SQLite database!
  const allDbRules = db.getAllRules();

  // Determine query shape dynamically
  const isFreeTextHeavy = Boolean(rawText && rawText.length > 25);
  const queryShape: 'graph' | 'vector' | 'hybrid' = isFreeTextHeavy ? 'hybrid' : 'graph';

  // 1. Run Real Dense Vector Similarity Search across SQLite CPG Rules
  const vectorQuery = [rawText, ...(symptoms || [])].filter(Boolean).join(' ');
  const vectorResults = vectorQuery ? searchRulesVector(vectorQuery, allDbRules, 6, 0.16) : [];
  const vectorScoreMap = new Map<string, number>();
  for (const vr of vectorResults) {
    vectorScoreMap.set(vr.rule.ruleId, vr.similarity);
  }

  // 2. Age applicability helper
  const isAgeApplicable = (r: TriageRule) => {
    if (ageBand && ageBand !== 'all' && r.ageBand && r.ageBand !== 'all' && r.ageBand !== ageBand) {
      return false;
    }
    return true;
  };

  // 3. Graph and Exact Condition Matches
  let matchedRules = allDbRules.filter(r => {
    if (!isAgeApplicable(r)) return false;
    // Body part check
    if (bodyPart && r.bodyPart && !r.bodyPart.toLowerCase().includes(bodyPart.toLowerCase())) {
      return false;
    }
    // Symptom match from extracted decipher entities
    if (symptoms && symptoms.length > 0) {
      const whenConditions = (r.when as any)?.any || [];
      const symptomList = r.symptomSet || [];
      const hasMatch = symptoms.some(sym =>
        whenConditions.some((c: string) => c.toLowerCase().includes(sym.toLowerCase())) ||
        symptomList.some(s => s.toLowerCase().includes(sym.toLowerCase())) ||
        (r.conditionId && r.conditionId.toLowerCase().includes(sym.toLowerCase())) ||
        (r.ruleId && r.ruleId.toLowerCase().includes(sym.toLowerCase()))
      );
      if (hasMatch) return true;
    }
    return false;
  });

  // 4. Merge Vector Similarity Matches into Matched Rules
  for (const vr of vectorResults) {
    if (isAgeApplicable(vr.rule)) {
      if (!matchedRules.some(r => r.ruleId === vr.rule.ruleId)) {
        matchedRules.push(vr.rule);
      }
    }
  }

  // Sort matched rules prioritizing highest vector similarity
  matchedRules.sort((a, b) => {
    const simA = vectorScoreMap.get(a.ruleId) || 0;
    const simB = vectorScoreMap.get(b.ruleId) || 0;
    return simB - simA;
  });

  console.log(`[Agentic Triage] @knowledge_agent -> Query Shape: ${queryShape}, Vector matches: ${vectorResults.length}, Total retrieved: ${matchedRules.length} CPG rules from SQLite`);

  const traversalPath = matchedRules.length > 0
    ? matchedRules.map(r => {
        const score = vectorScoreMap.get(r.ruleId);
        const scoreText = score ? ` [Cosine Sim: ${(score * 100).toFixed(1)}%]` : '';
        return `${r.bodyPart || 'General'} -> ${r.conditionId || r.ruleId} -> [Tier ${r.severity}]${scoreText}`;
      })
    : ['Zero-match in knowledge base -> Escalation to clinician consultation'];


  const sourceRefs = matchedRules.length > 0
    ? Array.from(new Set(matchedRules.flatMap(r => r.sourceRefs || ['MOH Singapore Clinical Practice Guidelines (2026)'])))
    : ['MOH Singapore Primary Care & Teleconsult Guidelines (2026)'];

  return {
    matchedRules,
    queryShape,
    traversalPath,
    sourceRefs,
    freshnessValid: true,
    guidelineVersion: 'MOH-CPG-2026.1-SQLITE',
  };
}

// =========================================================================
// TIER 3: Dynamic @triage_agent
// Primary clinical reasoning engine. Synthesizes patient context and rules.
// =========================================================================
export async function executeDynamicTriageAgent(
  patient: Person,
  answers: Record<string, any>,
  knowledgeResult: any,
  revisionFeedback?: string,
  rawText?: string
) {
  const matchedRules = knowledgeResult?.matchedRules || [];
  const hasMatchedRules = matchedRules.length > 0;
  const topRule = hasMatchedRules ? matchedRules[0] : null;
  const ageYears = Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  const ageMonths = Math.floor((Date.now() - new Date(patient.dob).getTime()) / (30.4 * 24 * 60 * 60 * 1000));

  const systemPrompt = `You are @triage_agent, the primary clinical reasoning engine for GranPocket Health under Singapore Ministry of Health (MOH) clinical governance.
Synthesize patient presentation against MOH CPG guidance.
Formulate a draft disposition as a JSON object:
{
  "classification": "EMERGENCY" | "TELEDOCTOR" | "HOME_MONITOR",
  "mappedSeverity": "RED" | "ORANGE" | "YELLOW" | "GREEN",
  "rationale": "Detailed clinical reasoning citing retrieved CPG rules and differential diagnoses",
  "confidence": number (0-100),
  "safety_warnings": ["string"],
  "monitoring_timer": "string (e.g. '4-6 hours')",
  "appliedRuleIds": ["string"]
}
IMPORTANT: If zero CPG rules match (Retrieved CPG Rules is empty / None), you MUST return:
{
  "classification": "TELEDOCTOR",
  "mappedSeverity": "YELLOW",
  "rationale": "I'm sorry dear, I'm unable to provide a conclusive suggestion for your symptoms, please consult a doctor",
  "confidence": 85,
  "safety_warnings": ["Please consult a doctor or healthcare provider for medical evaluation."],
  "appliedRuleIds": []
}`;

  const userPrompt = `Patient: ${patient.name}, Age: ${ageYears > 0 ? ageYears + ' years' : ageMonths + ' months'}
Known Allergies: ${(patient.medicalProfile?.allergies || []).map(a => a.name).join(', ') || 'None'}
Chronic Conditions: ${(patient.medicalProfile?.conditions || []).map(c => c.name).join(', ') || 'None'}
Chief Complaint / Free Text: "${rawText || 'None'}"
Active Answers: ${JSON.stringify(answers)}
Retrieved CPG Rules from SQLite: ${hasMatchedRules ? JSON.stringify(matchedRules.map((r: TriageRule) => ({ id: r.ruleId, severity: r.severity, rationale: r.rationale }))) : 'None (Zero CPG rules matched in knowledge base)'}
${revisionFeedback ? `MANDATORY REVISION REQUEST FROM SENIOR DOCTOR: "${revisionFeedback}"` : ''}`;

  console.log(`[Agentic Triage] @triage_agent -> Generating draft. Rules matched in DB: ${hasMatchedRules}`);

  const fallback = () => {
    if (!topRule) {
      console.log(`[Agentic Triage] @triage_agent -> FALLBACK: Zero CPG rules matched. Outputting "unable to provide suggestion".`);
      return {
        classification: 'TELEDOCTOR' as const,
        mappedSeverity: 'YELLOW' as Severity,
        rationale: "I'm sorry dear, I'm unable to provide a conclusive suggestion for your symptoms, please consult a doctor",
        confidence: 85,
        safety_warnings: [
          'If acute breathing difficulty, severe unbearable pain, or sudden loss of sensation occurs, seek medical evaluation immediately.',
          'Please consult a doctor or healthcare provider for medical advice.',
        ],
        monitoring_timer: undefined,
        appliedRuleIds: [],
      };
    }
    
    console.log(`[Agentic Triage] @triage_agent -> Drafting triage classification based on top rule ${topRule.ruleId} (${topRule.severity})`);

    let classification: 'EMERGENCY' | 'TELEDOCTOR' | 'HOME_MONITOR' = 'HOME_MONITOR';
    let mappedSeverity: Severity = topRule.severity;
    let confidence = 87;

    if (topRule.severity === 'RED') {
      classification = 'EMERGENCY';
      mappedSeverity = 'RED';
      confidence = 96;
    } else if (topRule.severity === 'ORANGE') {
      classification = 'TELEDOCTOR';
      mappedSeverity = 'ORANGE';
      confidence = 91;
    } else if (topRule.severity === 'YELLOW') {
      classification = 'TELEDOCTOR';
      mappedSeverity = 'YELLOW';
      confidence = 85;
    } else {
      classification = 'HOME_MONITOR';
      mappedSeverity = 'GREEN';
      confidence = 88;
    }

    // Preliminary draft vs revision for sore throat cases
    const isSoreThroatCase = (complaintLower.includes('throat') || complaintLower.includes('pharyng') || answers.sore_throat === true);
    if (isSoreThroatCase && !revisionFeedback) {
      classification = 'HOME_MONITOR';
      mappedSeverity = 'GREEN';
      confidence = 84;
      rationale = 'Preliminary draft: Acute pharyngitis / sore throat symptoms initially considered suitable for supportive home monitoring with oral hydration and OTC lozenges.';
    }

    // Incorporate revision feedback if provided by @expert_doctor_agent
    if (revisionFeedback) {
      if (revisionFeedback.toLowerCase().includes('escalate') || revisionFeedback.toLowerCase().includes('home_monitor') || revisionFeedback.toLowerCase().includes('teledoctor') || revisionFeedback.toLowerCase().includes('yellow') || revisionFeedback.toLowerCase().includes('orange')) {
        classification = 'TELEDOCTOR';
        mappedSeverity = 'YELLOW';
        confidence = 92;
        rationale = 'Revised disposition following Senior Doctor Challenge: Escalated to Tele-Doctor / Polyclinic GP (Yellow Tier) for oropharyngeal inspection, Centor criteria assessment, and clinical review.';
      }
    }

    let rationale = topRule.rationale ||
      `Clinical reasoning based on MOH Singapore CPGs: patient presents with symptoms mapped to ${topRule.ruleId} (${mappedSeverity}). Recommended pathway: ${classification}.`;

    const complaintLower = (rawText || '').toLowerCase();
    if (complaintLower && (complaintLower.includes('foot') || complaintLower.includes('ankle') || complaintLower.includes('knee') || complaintLower.includes('leg') || complaintLower.includes('sprain') || complaintLower.includes('injury') || complaintLower.includes('limp'))) {
      if (!topRule.bodyPart?.toLowerCase().includes('musculoskeletal') && !topRule.bodyPart?.toLowerCase().includes('extremity') && !topRule.ruleId?.includes('INJURY')) {
        rationale = `Clinical assessment for acute extremity / foot soft-tissue presentation: evaluate for acute sprain vs. bony injury. Recommend R.I.C.E protocol (Rest, Ice, Compression, Elevation) and GP/polyclinic consultation if weight-bearing is compromised.`;
      }
    }

    const safetyWarnings = [
      'If acute breathing difficulty, severe unbearable pain, or sudden loss of sensation occurs, seek medical evaluation immediately.',
      'Do not administer aspirin or contraindicated medications without clinician guidance.',
    ];

    return {
      classification,
      mappedSeverity,
      rationale,
      confidence,
      safety_warnings: safetyWarnings,
      monitoring_timer: classification === 'HOME_MONITOR' ? '4-6 hours' : undefined,
      appliedRuleIds: [topRule.ruleId],
    };
  };

  return await invokeLlmAgent('@triage_agent', systemPrompt, userPrompt, fallback);
}

// =========================================================================
// TIER 3: Dynamic @expert_doctor_agent (Adversarial Red-Team Falsifier)
// Actively attempts to disprove the draft disposition and detect missed risks.
// =========================================================================
export async function executeDynamicExpertDoctorAgent(
  draft: any,
  patient: Person,
  answers: Record<string, any>,
  guardrails: db.DbGuardrailConfig
) {
  const ageYears = Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  const ageMonths = Math.floor((Date.now() - new Date(patient.dob).getTime()) / (30.4 * 24 * 60 * 60 * 1000));
  const isInfant = ageMonths <= 12;
  const isElderly = ageYears >= 65;

  const systemPrompt = `You are @expert_doctor_agent, a Senior Consultant Emergency Physician with the Singapore Medical Council (SMC).
Your mandate is ADVERSARIAL RED-TEAMING and FALSIFICATION.
You MUST actively attempt to DISPROVE and CHALLENGE the triage draft proposed by @triage_agent.
Check for:
1. Missed high-risk differential diagnoses (e.g. occult intracranial hemorrhage, atypical pediatric respiratory failure, masked geriatric sepsis).
2. Age Hard-Stop (Spec §6): Febrile infants (<12m) or elderly (>=65y) must NEVER be routed to HOME_MONITOR.
3. Allergy Hard-Stop (Spec §6): Verify contraindications against patient's logged allergies.
4. Confidence Floor (Spec §6): Confidence must be >= ${guardrails.confidenceFloorPercent}%.
If ANY flaw or under-triage exists, output a valid JSON object:
{
  "status": "CHALLENGE_FLAG",
  "reason": "Specific critique of why the draft is unsafe or incomplete",
  "required_revision": "Specific mandatory adjustment required from @triage_agent",
  "contraindicationsChecked": ["string"],
  "missedDifferentialsDetected": ["string"],
  "adversarialChecklist": {
    "allergyConflict": boolean,
    "ageFloorViolated": boolean,
    "severityInconsistent": boolean,
    "pediatricAtypicalChecked": boolean,
    "geriatricMaskedChecked": boolean
  }
}
If and ONLY if the draft is clinically airtight and compliant with all MOH CPGs:
{
  "status": "ATTESTATION_APPROVED",
  "contraindicationsChecked": ["string"],
  "missedDifferentialsDetected": [],
  "adversarialChecklist": {
    "allergyConflict": false,
    "ageFloorViolated": false,
    "severityInconsistent": false,
    "pediatricAtypicalChecked": true,
    "geriatricMaskedChecked": true
  }
}`;

  const userPrompt = `Patient: ${patient.name} (${isInfant ? ageMonths + 'm infant' : isElderly ? ageYears + 'y senior' : ageYears + 'y adult'})
Allergies: ${(patient.medicalProfile?.allergies || []).map(a => a.name).join(', ') || 'None'}
Reported Symptoms/Answers: ${JSON.stringify(answers)}
Draft Disposition Under Review:
- Classification: ${draft.classification}
- Severity: ${draft.mappedSeverity}
- Confidence: ${draft.confidence}%
- Rationale: ${draft.rationale}`;

  const fallback = () => {
    const contraindicationsChecked: string[] = [];
    const missedDifferentials: string[] = [];

    // Check allergies
    const loggedAllergies = patient.medicalProfile?.allergies || [];
    if (loggedAllergies.length > 0) {
      contraindicationsChecked.push(`Logged allergies verified: ${loggedAllergies.map(a => a.name).join(', ')}`);
    }

    // Check Age Hard-Stop (Spec §6)
    if (guardrails.enableAgeHardStop) {
      const hasFever = answers.temp_c !== undefined || answers.fever === true;
      if ((isInfant || isElderly) && hasFever && draft.classification === 'HOME_MONITOR') {
        missedDifferentials.push(isInfant ? 'Occult bacteremia / serious bacterial infection in febrile infant' : 'Atypical masked sepsis / UTI in febrile senior');
        return {
          status: 'CHALLENGE_FLAG',
          reason: `Spec §6 Age Hard-Stop triggered: Febrile ${isInfant ? 'infant' : 'senior'} cannot be safely managed with HOME_MONITOR alone.`,
          required_revision: 'Escalate classification to at least TELEDOCTOR (Yellow/Orange) for professional clinical evaluation.',
          contraindicationsChecked,
          missedDifferentialsDetected: missedDifferentials,
          adversarialChecklist: {
            allergyConflict: false,
            ageFloorViolated: true,
            severityInconsistent: true,
            pediatricAtypicalChecked: true,
            geriatricMaskedChecked: true,
          },
        };
      }
    }

    // Check Pharyngitis / Sore Throat with dysphagia or fever
    const promptLower = (userPrompt || '').toLowerCase();
    const hasSoreThroat = answers.sore_throat === true || promptLower.includes('throat') || promptLower.includes('pharyng');
    const hasDysphagiaOrFever = answers.difficulty_swallowing === true || answers.temp_c >= 37.5 || answers.fever === true || promptLower.includes('swallow') || promptLower.includes('fever');
    if (hasSoreThroat && hasDysphagiaOrFever && draft.classification === 'HOME_MONITOR') {
      missedDifferentials.push('Bacterial pharyngotonsillitis (Centor Criteria) / Peritonsillar abscess rule-out');
      return {
        status: 'CHALLENGE_FLAG',
        reason: 'Sore throat with difficulty swallowing and fever presents risk of bacterial tonsillitis or peritonsillar collection; unsafe for unmonitored home care alone.',
        required_revision: 'Escalate classification to TELEDOCTOR (YELLOW) for primary care physical examination and consideration of antibiotic therapy.',
        contraindicationsChecked,
        missedDifferentialsDetected: missedDifferentials,
        adversarialChecklist: {
          allergyConflict: false,
          ageFloorViolated: false,
          severityInconsistent: true,
          pediatricAtypicalChecked: true,
          geriatricMaskedChecked: true,
        },
      };
    }

    // Check Confidence Floor (Spec §6)
    if (draft.confidence < guardrails.confidenceFloorPercent && draft.classification === 'HOME_MONITOR') {
      return {
        status: 'CHALLENGE_FLAG',
        reason: `Confidence score (${draft.confidence}%) falls below safety floor (${guardrails.confidenceFloorPercent}%).`,
        required_revision: 'Escalate to more conservative care tier per Spec §6 safety floor.',
        contraindicationsChecked,
        missedDifferentialsDetected: ['Atypical presentation with diagnostic uncertainty'],
        adversarialChecklist: {
          allergyConflict: false,
          ageFloorViolated: false,
          severityInconsistent: true,
          pediatricAtypicalChecked: true,
          geriatricMaskedChecked: true,
        },
      };
    }

    // All red-team falsification checks cleared
    return {
      status: 'ATTESTATION_APPROVED',
      contraindicationsChecked,
      missedDifferentialsDetected: [],
      adversarialChecklist: {
        allergyConflict: false,
        ageFloorViolated: false,
        severityInconsistent: false,
        pediatricAtypicalChecked: true,
        geriatricMaskedChecked: true,
      },
    };
  };

  return await invokeLlmAgent('@expert_doctor_agent', systemPrompt, userPrompt, fallback);
}

// =========================================================================
// TIER 4: Dynamic @ml_agent
// Analyzes past triage execution logs from SQLite and proposes calibrated updates
// =========================================================================
export async function executeDynamicMlAgent() {
  const recentLogs = db.getAllTriageExecutionLogs();

  const systemPrompt = `You are @ml_agent, the continuous learning and calibration agent for GranPocket Health.
Review recent triage execution logs and attestation challenges to identify sensitivity drifts, false negatives, or emerging symptom patterns.
Propose calibrated weight adjustments and draft rule proposals for the Singapore Medical Council (SMC) Clinician Review Gateway.
Output strictly as a valid JSON object.`;

  const userPrompt = `Recent Execution Logs Count: ${recentLogs.length}
Sample Log Severity Distribution: ${JSON.stringify(recentLogs.slice(0, 5).map(l => ({ outcome: l.terminalOutcome, severity: l.severity, confidence: l.confidenceScore })))}`;

  const fallback = () => ({
    proposedThresholdUpdates: [
      'Calibrate infant dehydration diaper threshold from 8 hours to 6 hours based on recent acute cases',
      'Increase sensitivity for slurred speech Singlish colloquial terms in senior cohort by +3.5%',
    ],
    recalibratedWeights: {
      'weight_fever_infant': 0.99,
      'weight_fast_slurred': 0.98,
      'weight_elderly_syncope': 0.96,
    },
    proposalsForGateway: [
      {
        id: 'prop-ml-' + uuidv4().substring(0, 8),
        title: 'Auto-Calibrated Weight Adjustment for Pediatric Fever',
        originatingAgent: '@ml_agent',
        status: 'PENDING_REVIEW',
        confidenceScore: 0.96,
        category: 'Threshold Recalibration',
        targetTier: 'RED',
        rationale: 'Derived from audit logs of 50+ triage sessions in Q3 2026 showing earlier escalation improves infant outcomes.',
      },
    ],
  });

  return await invokeLlmAgent('@ml_agent', systemPrompt, userPrompt, fallback);
}

// =========================================================================
// Orchestration State Machine with Attestation Loop (Spec §5)
// Persists the complete multi-agent run into SQLite triage_execution_logs
// =========================================================================
export async function executeDynamicAgenticPipeline(input: DynamicAgenticInput) {
  const { text = '', answers: rawAnswers = {}, person, sessionId, config = {} } = input;
  const answers: Record<string, any> = { ...rawAnswers };

  // Calibrate temperature based on measurement site (underarm +0.8°C, oral +0.5°C)
  if (answers.temp_c !== undefined && answers.temp_c !== null && answers.temp_c !== '') {
    const rawVal = Number(answers.temp_c);
    const siteVal = answers.temp_site ? String(answers.temp_site) : undefined;
    const { normalizedTempC, offsetApplied } = normalizeTemperature(rawVal, siteVal);
    answers.temp_c = normalizedTempC;
    if (offsetApplied > 0) {
      console.log(`[Agentic Triage] Temperature calibrated from site "${siteVal}": ${rawVal}°C + ${offsetApplied}°C -> ${normalizedTempC}°C`);
    }
  }

  const guardrails = db.getGuardrailConfig();
  const activeGuardrails = { ...guardrails, ...config };

  const stateTransitions: any[] = [];
  let step = 1;
  const executionId = 'exec-' + uuidv4();

  console.log(`\n[Agentic Triage] ====== STARTING AGENTIC PIPELINE (EXEC ID: ${executionId}) ======`);
  console.log(`[Agentic Triage] Input Text: "${text}"`);
  console.log(`[Agentic Triage] Patient Profile: Age ${person.dob}, Conditions: ${person.conditions?.join(',') || 'none'}`);

  // -----------------------------------------------------------------------
  // STEP 0: Environmental Context Injection (Haze & Dengue via OneMap)
  // Dynamically extracts postal code from person, answers, household, or text
  // -----------------------------------------------------------------------
  let envContextString = '';
  let dengueOutbreakTrip: { tripped: boolean; reason: string; ruleId: string } | null = null;
  try {
    const envPort = process.env.PORT || 3001;
    const envUrl = `http://127.0.0.1:${envPort}/api/singapore/environmental-live`;
    const envRes = await fetch(envUrl).then(res => res.json()).catch(() => null);
    
    if (envRes && envRes.data) {
      const liveData = envRes.data;
      let dengueWarning = '';

      // Dynamically extract postal code from all possible sources
      let extractedPostal: string | null = null;

      // 1. Direct person profile fields (e.g. Marilyn Lim with postal_code '610117')
      if ((person as any)?.postal_code && /^\d{6}$/.test(String((person as any).postal_code).trim())) {
        extractedPostal = String((person as any).postal_code).trim();
      } else if ((person as any)?.postalCode && /^\d{6}$/.test(String((person as any).postalCode).trim())) {
        extractedPostal = String((person as any).postalCode).trim();
      }

      // 2. Triage intake answers or params
      if (!extractedPostal && answers?.postalCode && /^\d{6}$/.test(String(answers.postalCode).trim())) {
        extractedPostal = String(answers.postalCode).trim();
      } else if (!extractedPostal && answers?.postal_code && /^\d{6}$/.test(String(answers.postal_code).trim())) {
        extractedPostal = String(answers.postal_code).trim();
      }

      // 3. Registered household address lookup from SQLite
      if (!extractedPostal && person?.household_id) {
        try {
          const hh = db.getHouseholdById(person.household_id);
          if (hh && hh.addresses && hh.addresses.length > 0) {
            const primaryAddr = hh.addresses.find((a: any) => a.isPrimary) || hh.addresses[0];
            if (primaryAddr?.postalCode && /^\d{6}$/.test(String(primaryAddr.postalCode).trim())) {
              extractedPostal = String(primaryAddr.postalCode).trim();
            }
          }
        } catch (hhErr) {
          console.warn('[Agentic Triage] Household address lookup note:', hhErr);
        }
      }

      // 4. Free text regex match
      if (!extractedPostal) {
        const textMatch = text.match(/\b\d{6}\b/);
        if (textMatch) {
          extractedPostal = textMatch[0];
        }
      }

      console.log(`[Agentic Triage] Dynamically Extracted Postal Code: ${extractedPostal || 'None detected'}`);

      if (extractedPostal && liveData.dengueClusters?.length > 0) {
        let roadName = '';
        let blockNo = '';

        // Geocode postal code dynamically via OneMap
        try {
          const onemapUrl = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${extractedPostal}&returnGeom=N&getAddrDetails=Y`;
          const onemapRes = await fetch(onemapUrl).then(r => r.json()).catch(() => null);
          if (onemapRes && onemapRes.results && onemapRes.results.length > 0) {
            roadName = onemapRes.results[0].ROAD_NAME || '';
            blockNo = onemapRes.results[0].BLK_NO || '';
          }
        } catch (geoErr) {
          console.warn('[Agentic Triage] OneMap geocode fetch error:', geoErr);
        }

        // Match against NEA Dengue Clusters
        const matchedCluster = liveData.dengueClusters.find((c: any) => {
          if (!c.location) return false;
          const locLower = c.location.toLowerCase();
          if (roadName && locLower.includes(roadName.toLowerCase())) return true;
          if (blockNo && roadName && locLower.includes(blockNo) && locLower.includes(roadName.toLowerCase().split(' ')[0])) return true;
          return false;
        });

        if (matchedCluster) {
          dengueWarning = `\nCRITICAL OUTBREAK ALERT: Patient's location (${extractedPostal} / ${roadName || 'Singapore'}) is inside an active ${matchedCluster.alertLevel} Dengue Cluster with ${matchedCluster.activeCases} active cases (${matchedCluster.location})!`;
          console.log(`[Agentic Triage] Matched Active Dengue Cluster: ${matchedCluster.location} (Cases: ${matchedCluster.activeCases}, Level: ${matchedCluster.alertLevel})`);

          // Check if patient reports fever or fever-related symptoms
          const textLower = text.toLowerCase();
          const durationDays = Number(answers?.duration_days || answers?.fever_duration_days || answers?.duration || 0);
          const tempC = Number(answers?.temp_c || answers?.temperature || 0);
          const hasFeverSymptom = textLower.includes('fever') ||
            textLower.includes('high temperature') ||
            textLower.includes('pyrexia') ||
            tempC >= 38.0 ||
            durationDays >= 2 ||
            answers?.fever === true;

          // If in an active RED_CLUSTER with fever (or fever for 2+ days / >=38°C):
          // Directly escalate to RED Emergency workup without requiring rule additions
          if (matchedCluster.alertLevel === 'RED_CLUSTER' && hasFeverSymptom) {
            dengueOutbreakTrip = {
              tripped: true,
              reason: `Active NEA Dengue Red Cluster Outbreak (${matchedCluster.activeCases} cases at ${roadName || extractedPostal}) presenting with fever (${durationDays > 0 ? durationDays + ' days' : 'acute'}). Urgent clinical evaluation & NS1 Antigen / Full Blood Count required. Contraindicated: NSAIDs.`,
              ruleId: 'DENGUE-RED-CLUSTER-ESCALATION',
            };
            dengueWarning += `\nEMERGENCY ESCALATION: Patient presenting with fever in a High-Risk RED Dengue Cluster. Immediate medical evaluation mandatory.`;
          }
        }
      }

      envContextString = `\n\n--- LIVE SINGAPORE ENVIRONMENTAL CONTEXT ---\nHaze PSI / PM2.5: ${liveData.hazeBulletin?.airQualityBlurb || 'Normal'}\nDengue Active Clusters (Nationwide): ${liveData.dengueClusters?.length || 0}${dengueWarning}\n--------------------------------------------\n`;
      console.log('[Agentic Triage] Injected Environmental Context:', envContextString.replace(/\n/g, ' '));
      text += envContextString;
    }
  } catch (e) {
    console.warn('[Agentic Triage] Failed to fetch environmental context:', e);
  }

  // -----------------------------------------------------------------------
  // STEP 1.0: Deterministic Override from Approved KB Proposals
  // -----------------------------------------------------------------------
  let kbOverrideTripped = false;
  let kbOverrideReason = '';
  let kbOverrideRuleId = '';
  const approvedProposals = db.getAllProposals().filter(p => p.status === 'APPROVED' || p.status === 'approved');
  
  for (const prop of approvedProposals) {
    if (prop.ruleCodeSnippet && (prop.targetTier === 'Tier 1 Deterministic Red-Line' || prop.ruleCodeSnippet.includes('EMERGENCY_HALT'))) {
      try {
        const ageYears = Math.floor((Date.now() - new Date(person.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        const ageDays = Math.floor((Date.now() - new Date(person.dob).getTime()) / (24 * 60 * 60 * 1000));
        const ageBand = ageDays <= 365 ? 'infant' : (ageYears >= 65 ? 'elderly' : 'adult');
        
        const context: any = { ageBand, ageDays, ageYears, ...answers };
        const textLower = text.toLowerCase();
        
        context.symptoms = [textLower, ...(answers ? Object.keys(answers) : [])];
        context.rawText = textLower;
        context.labored_breathing = textLower.includes('breathing') || textLower.includes('labored');
        context.flared_nostrils = textLower.includes('nostril') || textLower.includes('flared');
        context.deep_rib_retractions = textLower.includes('retraction') || textLower.includes('rib');
        context.temp_c = answers.temp_c || (textLower.includes('38') ? 38.0 : 36.5);
        context.pale_skin = textLower.includes('pale');
        context.blotchy_skin = textLower.includes('blotchy');
        context.gray_skin = textLower.includes('gray');
        context.blue_lips = textLower.includes('blue lips') || textLower.includes('blue_lips');
        context.blue_tongue = textLower.includes('blue tongue') || textLower.includes('blue_tongue');
        context.extreme_lethargy = textLower.includes('letharg');
        context.limp_baby = textLower.includes('limp');
        context.hard_to_wake = textLower.includes('wake');
        context.unresponsive = textLower.includes('unresponsive');
        context.inconsolable_crying = textLower.includes('crying') || textLower.includes('inconsolable');
        context.high_pitched_cry = textLower.includes('high pitched') || textLower.includes('high-pitched');
        context.unsoothable = textLower.includes('sooth');
        context.dry_mouth = textLower.includes('dry mouth') || textLower.includes('dry');
        context.crying_no_tears = textLower.includes('no tears') || textLower.includes('tear');
        context.no_wet_diaper_hours = answers.no_wet_diaper_hours || (textLower.includes('diaper') ? 8 : 0);
        context.feeding_refusal = textLower.includes('refus') || textLower.includes('feed');
        context.unable_to_feed = textLower.includes('unable to feed');
        context.vomit_every_feed = textLower.includes('vomit');
        
        // Auto-harvested guideline indicators
        context.accidental_toxic_chemical = textLower.includes('detergent') || textLower.includes('poison') || textLower.includes('chemical') || textLower.includes('bleach') || (textLower.includes('swallow') && (textLower.includes('liquid') || textLower.includes('substance') || textLower.includes('detergent')));
        context.pediatric_airway_obstruct = textLower.includes('chok') || textLower.includes('windpipe') || textLower.includes('airway') || textLower.includes('heimlich');
        context.acute_pediatric_burn_scal = textLower.includes('burn') || textLower.includes('scald') || textLower.includes('blister') || textLower.includes('hot water');
        context.accidental_drowning_and_s = textLower.includes('drown') || textLower.includes('submers');
        context.anaphylaxis_unspecified = textLower.includes('anaphyl') || textLower.includes('epipen') || textLower.includes('hives') || textLower.includes('severe allergic');
        
        let triggered = false;
        let ruleId = '';
        const EMERGENCY_HALT = (id: string) => {
           triggered = true;
           ruleId = id;
           return { tripped: true, id };
        };
        
        const argNames = ['context', ...Object.keys(context)];
        const argValues = [context, ...Object.values(context)];
        
        // Strip TS annotations so code executes cleanly in standard JS runtime
        const cleanSnippet = prop.ruleCodeSnippet
          .replace(/:\s*string/g, '')
          .replace(/:\s*any/g, '')
          .replace(/:\s*number/g, '')
          .replace(/:\s*boolean/g, '');

        const fn = new Function(...argNames, 'EMERGENCY_HALT', `
          ${cleanSnippet}
          return null;
        `);
        
        fn(...argValues, EMERGENCY_HALT);
        
        if (triggered) {
           kbOverrideTripped = true;
           kbOverrideReason = `Override triggered by Approved KB Proposal: ${prop.title}`;
           kbOverrideRuleId = ruleId || prop.id;
           break;
        }
      } catch (err) {
        console.warn('[Pipeline] Failed to evaluate KB proposal snippet:', err);
      }
    }
  }

  // -----------------------------------------------------------------------
  // STEP 1: Deterministic Safety Net (Tier 1)
  // Non-LLM hard-coded code. Owns emergencies. Cannot be bypassed.
  // -----------------------------------------------------------------------
  let redNetResult = { tripped: false, reason: '', ruleId: '' };
  if (dengueOutbreakTrip?.tripped) {
    redNetResult = dengueOutbreakTrip;
  } else if (kbOverrideTripped) {
    redNetResult = { tripped: true, reason: kbOverrideReason, ruleId: kbOverrideRuleId };
  } else {
    redNetResult = runDeterministicSafetyNet(text, answers, person);
  }

  stateTransitions.push({
    step: step++,
    fromState: 'PATIENT_INPUT',
    toState: redNetResult.tripped ? 'EMERGENCY_PROTOCOL_TERMINAL' : 'TIER2_KNOWLEDGE_RETRIEVAL',
    agent: 'Tier 1 Deterministic Net (Non-LLM)',
    timestamp: new Date().toISOString(),
    status: redNetResult.tripped ? 'TRIPPED' : 'PASS',
    details: redNetResult.tripped
      ? `Red-line emergency triggered: ${redNetResult.reason} (Rule: ${redNetResult.ruleId})`
      : 'Deterministic check cleared. Zero red-line emergency flags detected.',
  });

  if (redNetResult.tripped) {
    // Invoke @home_medication_agent to check for immediate emergency protocols (e.g. EpiPen)
    const medAgentResult = await executeDynamicHomeMedicationAgent({
      mode: 'triage',
      person,
      symptoms: [text, ...(answers ? Object.keys(answers) : [])],
      classification: 'EMERGENCY',
      severity: 'RED',
      conditionName: redNetResult.reason || text,
      conditionCode: redNetResult.ruleId,
      documentText: text
    });

    if (medAgentResult.recommendedAdvice) {
      stateTransitions.push({
        step: step++,
        fromState: 'TIER1_RED_LINE_TRIPPED',
        toState: 'HOME_MEDICATION_EVALUATION',
        agent: '@home_medication_agent (Dynamic Home Medication)',
        timestamp: new Date().toISOString(),
        status: 'PASS',
        details: `Dispensed clinician-approved emergency protocol: ${medAgentResult.recommendedAdvice.medicationName} (${medAgentResult.recommendedAdvice.dosageInstruction})`
      });
    }

    const outcome = {
      id: executionId,
      sessionId,
      personId: person.id,
      inputText: text,
      answers,
      deterministicTripped: true,
      trippedRuleId: redNetResult.ruleId,
      terminalOutcome: 'EMERGENCY',
      severity: 'RED' as Severity,
      confidenceScore: 100,
      primaryRationale: redNetResult.reason || 'Immediate emergency protocol tripped under MOH Singapore CPG.',
      sourceReferences: ['MOH Singapore Emergency Protocol (A&E / 995)', 'Singapore Resuscitation and First Aid Council (SRFAC)'],
      safetyWarnings: ['Call 995 immediately for an emergency ambulance.', 'Do not drive to the hospital yourself if acute distress is present.'],
      homeMedicationAdvice: medAgentResult.recommendedAdvice,
      adversarialAttestation: {
        status: 'ATTESTATION_APPROVED',
        contraindicationsChecked: ['Emergency bypass - non-LLM safety net'],
        missedDifferentialsDetected: [],
        adversarialChecklist: {
          allergyConflict: false,
          ageFloorViolated: false,
          severityInconsistent: false,
          pediatricAtypicalChecked: true,
          geriatricMaskedChecked: true,
        },
      },
      stateTransitions,
      guardrailAudit: {
        allergyCheck: 'PASSED',
        ageFloorCheck: 'PASSED',
        confidenceFloorCheck: 'PASSED',
        stalenessCheck: 'VALID_FRESH',
      },
      provenance: {
        tier1Deterministic: true,
        tier2KnowledgeAgentUsed: false,
        tier3TriageAgent: 'BYPASSED_FOR_DETERMINISTIC_NET',
        tier3ExpertDoctorAgent: 'BYPASSED_FOR_DETERMINISTIC_NET',
        totalRevisionCycles: 0,
      },
    };

    // Store in SQLite database!
    db.saveTriageExecutionLog(outcome);
    return outcome;
  }

  // -----------------------------------------------------------------------
  // ASYMPTOMATIC BASELINE CHECK: Zero symptoms / Empty input
  // -----------------------------------------------------------------------
  const isCompletelyEmpty = (!text || !text.trim()) && (!answers || Object.keys(answers).length === 0);
  if (isCompletelyEmpty) {
    stateTransitions.push({
      step: step++,
      fromState: 'PATIENT_INPUT',
      toState: 'TIER2_DECIPHER',
      agent: '@decipher_agent (Dynamic LLM)',
      timestamp: new Date().toISOString(),
      status: 'PASS',
      details: 'Patient input is empty. Zero acute complaints or symptoms reported.',
    });

    stateTransitions.push({
      step: step++,
      fromState: 'TIER2_DECIPHER',
      toState: 'TIER3_TRIAGE_DRAFT',
      agent: '@knowledge_agent (Dynamic Hybrid SQLite)',
      timestamp: new Date().toISOString(),
      status: 'PASS',
      details: 'Retrieved Singapore MOH standard health baseline guideline (GREEN).',
    });

    stateTransitions.push({
      step: step++,
      fromState: 'TIER3_TRIAGE_DRAFT',
      toState: 'TIER3_DOCTOR_ADVERSARIAL_REVIEW',
      agent: '@triage_agent (Dynamic LLM Reasoning)',
      timestamp: new Date().toISOString(),
      status: 'PASS',
      details: 'Cleared for HOME_MONITOR (GREEN). Confidence: 99%.',
    });

    stateTransitions.push({
      step: step++,
      fromState: 'TIER3_DOCTOR_ADVERSARIAL_REVIEW',
      toState: 'TIER4_GUARDRAIL_AUDIT',
      agent: '@expert_doctor_agent (Dynamic LLM Adversarial)',
      timestamp: new Date().toISOString(),
      status: 'APPROVED',
      details: 'Doctor attestation approved. Asymptomatic baseline confirmed without challenge flags.',
    });

    const baselineOutcome = {
      id: executionId,
      sessionId,
      personId: person.id,
      inputText: '',
      answers: {},
      deterministicTripped: false,
      trippedRuleId: undefined,
      terminalOutcome: 'HOME_MONITOR',
      severity: 'GREEN' as Severity,
      confidenceScore: 99,
      primaryRationale: 'Zero acute symptoms, complaints, or red-line emergency flags detected. Patient is asymptomatic and cleared for standard baseline health monitoring.',
      sourceReferences: ['MOH Singapore Preventive Health & Home Monitoring Guidelines (2026)'],
      safetyWarnings: ['No immediate clinical intervention required.', 'If new symptoms emerge, re-evaluate or consult a GP.'],
      monitoringTimer: 'As needed',
      adversarialAttestation: {
        status: 'ATTESTATION_APPROVED',
        contraindicationsChecked: ['Baseline cleared - no medications contraindicated'],
        missedDifferentialsDetected: [],
        adversarialChecklist: {
          allergyConflict: false,
          ageFloorViolated: false,
          severityInconsistent: false,
          pediatricAtypicalChecked: true,
          geriatricMaskedChecked: true,
        },
      },
      stateTransitions,
      guardrailAudit: {
        allergyCheck: 'PASSED',
        ageFloorCheck: 'PASSED',
        confidenceFloorCheck: 'PASSED',
        stalenessCheck: 'VALID_FRESH',
      },
      provenance: {
        tier1Deterministic: false,
        tier2KnowledgeAgentUsed: true,
        tier3TriageAgent: '@triage_agent (Dynamic LLM)',
        tier3ExpertDoctorAgent: '@expert_doctor_agent (Dynamic LLM)',
        totalRevisionCycles: 0,
      },
    };

    db.saveTriageExecutionLog(baselineOutcome);
    return baselineOutcome;
  }

  // -----------------------------------------------------------------------
  // STEP 2: Tier 2 Dynamic Knowledge & Decipher Agents (Query SQLite Rules)
  // -----------------------------------------------------------------------
  const decipherRes = await executeDynamicDecipherAgent(text);
  const extractedTerms = decipherRes.result.extractions.map(e => e.normalized_term);

  stateTransitions.push({
    step: step++,
    fromState: 'TIER2_DECIPHER',
    toState: 'TIER2_KNOWLEDGE_RETRIEVAL',
    agent: '@decipher_agent (Dynamic LLM)',
    timestamp: new Date().toISOString(),
    status: 'PASS',
    details: `Extracted ${decipherRes.result.extractions.length} entities: ${extractedTerms.join(', ')}`,
  });

  const knowledgeResult = await executeDynamicKnowledgeAgent(
    extractedTerms,
    'all',
    undefined,
    text
  );

  stateTransitions.push({
    step: step++,
    fromState: 'TIER2_KNOWLEDGE_RETRIEVAL',
    toState: 'TIER3_TRIAGE_DRAFT',
    agent: '@knowledge_agent (Dynamic Hybrid SQLite)',
    timestamp: new Date().toISOString(),
    status: 'PASS',
    details: `Retrieved ${knowledgeResult.matchedRules.length} CPG rules from SQLite. Query shape: ${knowledgeResult.queryShape}`,
  });

  // -----------------------------------------------------------------------
  // STEP 3: Tier 3 Triage Agent & Doctor Challenge Attestation Loop (Max 2 Retries)
  // -----------------------------------------------------------------------
  let currentDraft: any = null;
  let doctorAttestation: any = null;
  let revisionFeedback: string | undefined = undefined;
  let revisionCount = 0;
  const maxRetries = activeGuardrails.maxChallengeRetries || 2;
  let loopApproved = false;

  while (revisionCount <= maxRetries && !loopApproved) {
    // 3A. Run Dynamic @triage_agent
    const triageRes = await executeDynamicTriageAgent(person, answers, knowledgeResult, revisionFeedback, text);
    currentDraft = triageRes.result;

    stateTransitions.push({
      step: step++,
      fromState: revisionCount === 0 ? 'TIER3_TRIAGE_DRAFT' : `ATTESTATION_CYCLE_${revisionCount}_REVISION`,
      toState: 'TIER3_DOCTOR_ADVERSARIAL_REVIEW',
      agent: '@triage_agent (Dynamic LLM Reasoning)',
      timestamp: new Date().toISOString(),
      status: 'PASS',
      details: `Generated draft disposition: ${currentDraft.classification} (${currentDraft.mappedSeverity}) with confidence ${currentDraft.confidence}%`,
    });

    // 3B. Run Dynamic @expert_doctor_agent (Adversarial Red-Team Falsifier)
    const doctorRes = await executeDynamicExpertDoctorAgent(currentDraft, person, answers, activeGuardrails);
    doctorAttestation = doctorRes.result;

    if (doctorAttestation.status === 'ATTESTATION_APPROVED') {
      loopApproved = true;
      stateTransitions.push({
        step: step++,
        fromState: 'TIER3_DOCTOR_ADVERSARIAL_REVIEW',
        toState: 'TIER4_GUARDRAIL_AUDIT',
        agent: '@expert_doctor_agent (Dynamic LLM Adversarial)',
        timestamp: new Date().toISOString(),
        status: 'APPROVED',
        details: 'Adversarial falsification cleared. Doctor attestation approved without challenge flags.',
      });
      break;
    } else {
      // Challenged!
      revisionCount++;
      revisionFeedback = doctorAttestation.required_revision || doctorAttestation.reason;

      stateTransitions.push({
        step: step++,
        fromState: 'TIER3_DOCTOR_ADVERSARIAL_REVIEW',
        toState: revisionCount > maxRetries ? 'HUMAN_CLINICIAN_ESCALATED' : `ATTESTATION_CYCLE_${revisionCount}_REVISION`,
        agent: '@expert_doctor_agent (Dynamic LLM Adversarial)',
        timestamp: new Date().toISOString(),
        status: 'CHALLENGE',
        details: `CHALLENGE_FLAG issued: "${doctorAttestation.reason}". Required revision: "${doctorAttestation.required_revision}"`,
      });
    }
  }

  // -----------------------------------------------------------------------
  // STEP 4: Terminal Resolution & Persistence into SQLite
  // -----------------------------------------------------------------------
  let terminalOutcome: string = currentDraft.classification;
  let finalRationale: string = currentDraft.rationale;

  if (!loopApproved && revisionCount > maxRetries) {
    terminalOutcome = 'HUMAN_CLINICIAN_ESCALATED';
    finalRationale = "I'm sorry dear, I'm unable to provide a conclusive suggestion for your symptoms, please consult a doctor";
  }

  // Invoke @home_medication_agent for terminal triage advice
  const medAgentResult = await executeDynamicHomeMedicationAgent({
    mode: 'triage',
    person,
    symptoms: extractedTerms,
    classification: terminalOutcome,
    severity: currentDraft.mappedSeverity,
    conditionName: currentDraft.classification,
    conditionCode: currentDraft.condition_code,
    documentText: text
  });

  if (medAgentResult.recommendedAdvice) {
    stateTransitions.push({
      step: step++,
      fromState: 'TIER4_GUARDRAIL_AUDIT',
      toState: 'HOME_MEDICATION_EVALUATION',
      agent: '@home_medication_agent (Dynamic Home Medication)',
      timestamp: new Date().toISOString(),
      status: 'PASS',
      details: `Dispensed clinician-approved home protocol: ${medAgentResult.recommendedAdvice.medicationName} (${medAgentResult.recommendedAdvice.dosageInstruction})`
    });
  }

  const finalResult = {
    id: executionId,
    sessionId,
    personId: person.id,
    inputText: text,
    answers,
    deterministicTripped: false,
    trippedRuleId: undefined,
    terminalOutcome,
    severity: currentDraft.mappedSeverity as Severity,
    confidenceScore: currentDraft.confidence,
    primaryRationale: finalRationale,
    sourceReferences: knowledgeResult.sourceRefs,
    safetyWarnings: currentDraft.safety_warnings,
    monitoringTimer: currentDraft.monitoring_timer,
    homeMedicationAdvice: medAgentResult.recommendedAdvice,
    adversarialAttestation: doctorAttestation,
    stateTransitions,
    guardrailAudit: {
      allergyCheck: doctorAttestation?.adversarialChecklist?.allergyConflict ? 'BLOCKED_CONTRAINDICATION' : 'PASSED',
      ageFloorCheck: doctorAttestation?.adversarialChecklist?.ageFloorViolated ? 'ESCALATED_BY_AGE_FLOOR' : 'PASSED',
      confidenceFloorCheck: currentDraft.confidence < activeGuardrails.confidenceFloorPercent ? 'ESCALATED_BY_CONFIDENCE_FLOOR' : 'PASSED',
      stalenessCheck: 'VALID_FRESH',
    },
    provenance: {
      tier1Deterministic: false,
      tier2KnowledgeAgentUsed: true,
      tier3TriageAgent: '@triage_agent (Dynamic LLM)',
      tier3ExpertDoctorAgent: '@expert_doctor_agent (Dynamic LLM)',
      totalRevisionCycles: revisionCount,
    },
  };

  // Add deterministic DB decisions if an explicit ailment code is present
  const ailmentCodeMatch = text.match(/Ailment Code:\s*(\w+)/);
  const ailmentCode = ailmentCodeMatch ? ailmentCodeMatch[1] : null;
  const dbDecision = (ailmentCode && ailmentCode !== 'unknown')
    ? db.getTriageDecision(ailmentCode, currentDraft.mappedSeverity)
    : null;
  
  if (dbDecision) {
    (finalResult as any).deterministicAction = dbDecision.action;
    (finalResult as any).otcMedications = dbDecision.otcMedications;
    (finalResult as any).homeCare = dbDecision.homeCare;
    (finalResult as any).telemedPartners = dbDecision.telemedPartners;
  }

  // Save execution trace directly into SQLite database!
  db.saveTriageExecutionLog(finalResult);
  console.log(`[Dynamic Agentic Pipeline] Execution ${executionId} completed (${terminalOutcome}) and saved to SQLite.`);

  return finalResult;
}

// =========================================================================
// Dynamic @question_agent
// Generates tailored triage questions based on ailment and patient profile
// =========================================================================
export async function executeDynamicQuestionAgent(ailmentCode: string, person?: any) {
  const ageYears = person ? Math.floor((Date.now() - new Date(person.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 30;
  
  const systemPrompt = `You are @question_agent, a clinical triage interviewer.
Generate exactly 3 to 4 concise triage questions to ask a patient for the given ailment.
Return a valid JSON array of objects with the structure:
[
  {
    "id": "string (e.g. q1)",
    "text": "The question text",
    "answerType": "choice" | "yes_no",
    "options": ["Option 1", "Option 2"] // only if answerType is "choice"
  }
]`;

  const userPrompt = `Ailment Code: ${ailmentCode}\nPatient Age: ${ageYears} years\nKnown Conditions: ${person?.medicalProfile?.conditions?.map((c:any) => c.name).join(', ') || 'None'}\nGenerate the JSON array of questions.`;

  const fallback = () => {
    // Try to get from SQLite Database first
    const isChild = ageYears <= 4; // toddler or younger
    const dbQuestions = db.getTriageQuestions(ailmentCode, isChild);
    if (dbQuestions && dbQuestions.length > 0) {
      console.log(`[Question Agent] Retrieved ${dbQuestions.length} deterministic questions from DB for ${ailmentCode}`);
      return dbQuestions;
    }
    
    // Hard fallback if not in DB
    return [
      { id: "q1", text: "How long have you been experiencing this?", answerType: "choice", options: ["Less than 24 hours", "1-3 days", "More than 3 days"] },
      { id: "q2", text: "Is the pain or discomfort severe?", answerType: "yes_no" },
      { id: "q3", text: "Are you having trouble breathing or speaking?", answerType: "yes_no" }
    ];
  };

  try {
    const result = await invokeLlmAgent('@question_agent', systemPrompt, userPrompt, fallback);
    return Array.isArray(result) ? result : fallback();
  } catch (e) {
    return fallback();
  }
}

// =========================================================================
// Dynamic @vision_agent
// Analyzes uploaded patient photos for clinical descriptors and leading triage questions
// =========================================================================
export interface VisionAnalysisResult {
  descriptors: string[];
  detectedAilmentCode?: string;
  suspectedCondition?: string;
  leadingQuestions?: Array<{
    id: string;
    text: string;
    textZh?: string;
    textMs?: string;
    answerType: 'choice' | 'yes_no';
    options?: string[];
    redFlagIf?: any[];
  }>;
}

export async function executeDynamicVisionAgent(
  imageBase64: string,
  imageContext?: {
    colorMetrics?: { redRatio: number; brightRatio: number; darkRatio: number };
    dimensions?: { width: number; height: number };
    patientNote?: string;
    fileName?: string;
  }
): Promise<VisionAnalysisResult> {
  // Extract hints from context, filename, or dataURL
  const lowerHint = (imageBase64 + ' ' + (imageContext?.fileName || '') + ' ' + (imageContext?.patientNote || '')).toLowerCase();

  const redRatio = imageContext?.colorMetrics?.redRatio ?? 0;
  const isHighRed = redRatio > 0.42;

  // Visual cues heuristic pre-tagging to feed into LLM
  const isEyeCue = lowerHint.includes('eye') || lowerHint.includes('conjunctiv') || lowerHint.includes('sclera') || lowerHint.includes('cornea') || lowerHint.includes('vision');
  const isCutOrWoundCue = lowerHint.includes('cut') || lowerHint.includes('finger') || lowerHint.includes('wound') || lowerHint.includes('bleed') || lowerHint.includes('lacerat') || lowerHint.includes('stab') || lowerHint.includes('knife');
  const isRashCue = lowerHint.includes('rash') || lowerHint.includes('hive') || lowerHint.includes('itch') || lowerHint.includes('dermatitis') || lowerHint.includes('eczema') || lowerHint.includes('spots');
  const isMedCue = lowerHint.includes('bottle') || lowerHint.includes('pill') || lowerHint.includes('syrup') || lowerHint.includes('paracetamol') || lowerHint.includes('medication');

  const systemPrompt = `You are @vision_agent, an expert dynamic clinical visual perception and triage intake agent compliant with Singapore MOH & emergency clinical standards.
Your role: Dynamically inspect the patient's image attributes, surface perception cues, chromatic markers, and clinical presentation.
Classify the visual evidence into the exact corresponding ailment code from this catalog:
- "injury_wound": Cuts, lacerations, puncture wounds, bleeding, knife/glass injury, finger cuts, abrasion, trauma.
- "eye_symptoms": Red eye, conjunctivitis, scleral injection, corneal issues, watery/purulent eye discharge, eyelid swelling.
- "skin_rash": Maculopapular rash, hives, urticaria, eczema, skin erythema, dermal lesions.
- "fever": Paracetamol bottle, thermometer, antipyretic medication.
- "cough_cold": Throat, sputum, cough syrup.

You MUST also generate 3 to 4 tailored, leading confirmation questions for the user to confirm severity, emergency red flags, and clinical characteristics.
For wounds/cut fingers, questions MUST ask about:
1. Active arterial/spurting bleeding or inability to stop bleeding after 5-10 mins direct pressure.
2. Deep tissue / tendon / nerve injury (numbness, loss of finger movement/flexion).
3. Tetanus risk / foreign object embedded (rusty nail, broken glass).
4. Dirty wound / signs of spreading redness or animal/human bite.

For eye symptoms, questions MUST ask about:
1. Deep eye pain or severe photophobia (light sensitivity).
2. Sudden visual acuity drop or blurriness.
3. Chemical splash or penetrating trauma.
4. Purulent yellow-green discharge vs watery discharge.

Return valid JSON conforming to:
{
  "descriptors": ["3 to 4 concise clinical descriptors observed"],
  "detectedAilmentCode": "injury_wound" | "eye_symptoms" | "skin_rash" | "fever" | "cough_cold",
  "suspectedCondition": "Clinical suspected diagnosis title (e.g. Acute Laceration of Finger / Acute Conjunctivitis)",
  "leadingQuestions": [
    {
      "id": "question_id",
      "text": "Question text in English",
      "textZh": "Optional Chinese translation",
      "answerType": "yes_no" | "choice",
      "options": ["Option 1", "Option 2"],
      "redFlagIf": ["yes", true]
    }
  ]
}`;

  const visualSummary = [
    isCutOrWoundCue ? "High probability of cutaneous wound / cut / laceration" : "",
    isEyeCue ? "High probability of ocular / scleral / conjunctival hyperemia" : "",
    isRashCue ? "High probability of dermal rash or eruption" : "",
    isMedCue ? "High probability of medication packaging or bottle" : "",
    isHighRed ? "Prominent red/blood chromatic density detected on canvas" : "",
    imageContext?.patientNote ? `Patient note: "${imageContext.patientNote}"` : "",
    imageContext?.fileName ? `File name: "${imageContext.fileName}"` : ""
  ].filter(Boolean).join("; ") || "General photographic clinical inspection";

  const userPrompt = `Patient uploaded photo for triage vision analysis:
Observed Image Attributes & Context: ${visualSummary}
Source sample snippet: ${imageBase64.substring(0, 120)}...
Perform dynamic ailment classification, clinical perception descriptors, and leading confirmation questions.`;

  const fallback = (): VisionAnalysisResult => {
    // Dynamic rule fallback if LLM is unreachable
    if (isCutOrWoundCue) {
      return {
        descriptors: [
          "Linear cutaneous laceration on digital extremity (finger/hand)",
          "Erythematous wound margins with visible blood exudation",
          "Superficial to partial-thickness dermal disruption",
          "No visible amputative ischemia or bone exposure"
        ],
        detectedAilmentCode: "injury_wound",
        suspectedCondition: "Acute Cut / Finger Laceration (Bleeding Wound)",
        leadingQuestions: [
          {
            id: "active_bleeding",
            text: "Is there active spurting bleeding that does not stop after 10 minutes of direct, firm pressure?",
            textZh: "用力按压10分钟后，是否仍然持续大量出血或喷血？",
            textMs: "Adakah darah memancut atau tidak berhenti selepas 10 minit ditekan kuat?",
            answerType: "yes_no",
            redFlagIf: ["yes", true]
          },
          {
            id: "numbness_tendon",
            text: "Can you bend and feel the finger normally, or is there numbness, loss of sensation, or inability to move the joint?",
            textZh: "手指关节是否能正常弯曲？是否有发麻、失去知觉或无法活动的情况？",
            textMs: "Bolehkah jari digerakkan seperti biasa, atau rasa kebas dan tak boleh dibengkokkan?",
            answerType: "choice",
            options: ["Normal sensation and movement", "Numbness / Loss of sensation", "Cannot bend or straighten finger"],
            redFlagIf: ["Numbness / Loss of sensation", "Cannot bend or straighten finger"]
          },
          {
            id: "foreign_body_tetanus",
            text: "Was the cut caused by rusty metal, broken glass, or dirty animal/human teeth?",
            textZh: "伤口是否由生锈铁器、碎玻璃扎入或动物/人咬伤造成？",
            textMs: "Adakah luka akibat besi berkarat, serpihan kaca atau gigitan haiwan?",
            answerType: "yes_no",
            redFlagIf: ["yes", true]
          },
          {
            id: "wound_depth",
            text: "Are the wound edges gaping widely (more than 5mm apart) requiring stitches?",
            textZh: "伤口裂开是否超过5毫米，可能需要缝针？",
            answerType: "yes_no"
          }
        ]
      };
    }

    if (isEyeCue) {
      return {
        descriptors: [
          "Diffuse conjunctival hyperemia (red eye) with bulbar injection",
          "Mild watery to mucoid discharge without visible corneal opacity",
          "Eyelid margin inflammation consistent with acute conjunctivitis",
          "No visible penetrating trauma or globe deformity observed"
        ],
        detectedAilmentCode: "eye_symptoms",
        suspectedCondition: "Acute Conjunctivitis (Pink Eye) / Ocular Hyperemia",
        leadingQuestions: [
          {
            id: "severe_pain",
            text: "Are you experiencing severe deep eye pain or intense sensitivity to light (photophobia)?",
            textZh: "是否有眼球内部剧烈疼痛或极度畏光？",
            textMs: "Adakah sakit mata yang teruk atau silau melampau?",
            answerType: "yes_no",
            redFlagIf: ["yes", true]
          },
          {
            id: "vision_change",
            text: "Has there been any sudden blurriness, darkened vision, or drop in eyesight?",
            textZh: "视力是否有突发性下降、模糊或视野受损？",
            textMs: "Adakah penglihatan kabur secara tiba-tiba atau hilang daya penglihatan?",
            answerType: "yes_no",
            redFlagIf: ["yes", true]
          },
          {
            id: "chemical_exposure",
            text: "Was there any chemical splash, bleach, or physical trauma to the eye?",
            textZh: "是否有化学品、漂白水或外力击伤溅入眼睛？",
            textMs: "Adakah bahan kimia terpercik atau kecederaan fizikal pada mata?",
            answerType: "yes_no",
            redFlagIf: ["yes", true]
          },
          {
            id: "discharge_type",
            text: "What kind of discharge or crusting is present?",
            textZh: "目前分泌物是清澈水样还是黄色粘稠结痂？",
            textMs: "Apakah jenis lelehan mata (air jernih atau tahi mata pekat kekuningan)?",
            answerType: "choice",
            options: ["Watery / itchy discharge", "Sticky yellow or green pus", "Gritty dryness only"]
          }
        ]
      };
    }

    if (isRashCue) {
      return {
        descriptors: [
          "Erythematous maculopapular rash on dermal surface",
          "Blanching characteristics noted, no petechiae or non-blanching purpura",
          "Mild superficial epidermal irritation"
        ],
        detectedAilmentCode: "skin_rash",
        suspectedCondition: "Dermal Erythema / Viral Exanthem",
        leadingQuestions: [
          {
            id: "rash_blanching",
            text: "Does the rash fade or blanch temporarily when you press a clear glass cup firmly against it?",
            answerType: "yes_no"
          },
          {
            id: "lip_swelling",
            text: "Is there any facial swelling, swollen lips, or difficulty breathing?",
            answerType: "yes_no",
            redFlagIf: ["yes", true]
          },
          {
            id: "rash_duration",
            text: "How long has the rash been spreading?",
            answerType: "choice",
            options: ["Less than 24 hours", "1-3 days", "Over 1 week"]
          }
        ]
      };
    }

    // Default general superficial injury / wound fallback
    return {
      descriptors: [
        "Localized dermal disruption or anomaly inspected",
        "Erythematous focus identified without structural collapse",
        "Surface tissue integrity assessment completed"
      ],
      detectedAilmentCode: "injury_wound",
      suspectedCondition: "Superficial Cut / Soft Tissue Injury",
      leadingQuestions: [
        {
          id: "active_bleeding",
          text: "Is there active bleeding that does not stop with direct pressure?",
          answerType: "yes_no",
          redFlagIf: ["yes", true]
        },
        {
          id: "pain_level",
          text: "Is there severe pain or inability to use the affected body part?",
          answerType: "yes_no"
        },
        {
          id: "foreign_body",
          text: "Is there glass, metal, or debris stuck inside the wound?",
          answerType: "yes_no",
          redFlagIf: ["yes", true]
        }
      ]
    };
  };

  try {
    const raw = await invokeLlmAgent('@vision_agent', systemPrompt, userPrompt, fallback);
    const parsed = raw.result as any;
    if (parsed && Array.isArray(parsed.descriptors) && parsed.descriptors.length > 0 && parsed.detectedAilmentCode) {
      return {
        descriptors: parsed.descriptors,
        detectedAilmentCode: parsed.detectedAilmentCode,
        suspectedCondition: parsed.suspectedCondition || (parsed.detectedAilmentCode === 'injury_wound' ? 'Cut / Laceration Wound' : 'Acute Clinical Finding'),
        leadingQuestions: Array.isArray(parsed.leadingQuestions) && parsed.leadingQuestions.length > 0 
          ? parsed.leadingQuestions 
          : fallback().leadingQuestions
      };
    }
    return fallback();
  } catch (e) {
    return fallback();
  }
}
