import { invokeLlmAgent } from './dynamicAgents.js';
import * as db from './db.js';
import { v4 as uuidv4 } from 'uuid';

export async function executeRuleHarvestingSwarm(
  inputData: string,
  dataType: 'csv' | 'text' | 'url',
  sourceName: string,
  onLog?: (msg: string) => void
) {
  let contentToProcess = inputData;
  let isMultiFile = false;
  let denormalizedData = contentToProcess;

  if (dataType === 'url') {
    try {
      onLog?.(`Fetching source URL: ${inputData}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(inputData, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      // Remove scripts, styles, then tags, then excess whitespace
      let cleanText = text
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
        .replace(/<[^>]*>?/gm, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      contentToProcess = cleanText.substring(0, 10000);
    } catch (e: any) {
      throw new Error(`Failed to ingest URL (${inputData}): ${e.message}`);
    }
  } else {
    // Bound text input to prevent token overflows
    contentToProcess = inputData.substring(0, 15000);
  }

  if (contentToProcess.includes('=== FILE: ')) {
    isMultiFile = true;
    
    // 0. Data Architect Agent (Multi-file DB Denormalization)
    onLog?.('Executing Stage 0: @data_architect_agent analyzing relational schemas...');
    const architectPrompt = `You are the Data Architect Agent. I have uploaded multiple relational CSV files. 
Determine the relational schema and output a SQL-like join plan to flatten this data. Output ONLY valid JSON in the format: {"join_plan": {"tables": [], "foreign_keys": []}}.`;
    
    const architectRes = await invokeLlmAgent<any>(
      '@data_architect_agent',
      architectPrompt,
      contentToProcess.substring(0, 4000), // pass headers to architect
      (errReason) => {
        throw new Error(`[@data_architect_agent Failed] Multi-file relational schema analysis failed: ${errReason || 'No response from LLM'}`);
      }
    );
    
    // Real Denormalization Engine (In-Memory JS Hash Join)
    console.log('[Denormalization Engine] Executing Join Plan:', architectRes.result);
    
    // Parse the multiple CSVs into memory
    const tables: Record<string, any[]> = {};
    const fileBlocks = contentToProcess.split('=== FILE: ').slice(1);
    
    for (const block of fileBlocks) {
      const [fileNameLine, ...dataLines] = block.split('\n');
      const fileName = fileNameLine.replace(' ===', '').trim();
      
      const cleanLines = dataLines.filter(l => l.trim() !== '');
      if (cleanLines.length < 2) continue;
      
      const headers = cleanLines[0].split(',').map(h => h.trim());
      const rows = cleanLines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const rowObj: any = {};
        headers.forEach((h, i) => { rowObj[h] = values[i]; });
        return rowObj;
      });
      tables[fileName] = rows;
    }

    // Execute the join plan
    let joinedData: any[] = [];
    const plan = architectRes.result?.join_plan;
    
    if (plan && plan.foreign_keys && plan.foreign_keys.length > 0 && Object.keys(tables).length > 0) {
      // Start with the first table in the plan
      const baseTableName = plan.foreign_keys[0].from;
      joinedData = tables[baseTableName] || Object.values(tables)[0];
      
      for (const fk of plan.foreign_keys) {
        const targetTable = tables[fk.to];
        if (!targetTable) continue;
        
        // Hash join
        const hashTable = new Map();
        for (const row of targetTable) {
          hashTable.set(row[fk.key], row);
        }
        
        // Merge
        joinedData = joinedData.map(row => {
          const matchingRow = hashTable.get(row[fk.key]) || {};
          return { ...row, ...matchingRow };
        });
      }
      
      denormalizedData = JSON.stringify(joinedData.slice(0, 30)); // limit to 30 rows to prevent blowing up LLM context
    } else {
      denormalizedData = JSON.stringify(Object.values(tables)[0]?.slice(0, 30) || []);
    }
  }

  // 1. Ingestion Agent
  onLog?.('Executing Stage 1: @ingestion_agent extracting clinical knowledge...');
  const ingestionPrompt = `You are a strict Clinical Data Extraction Agent. Read the provided ${dataType} data. You will receive raw, messy webpage text containing CSS, javascript, and navigation menus.
If it's a CSV with many patient records, output exactly: {"type":"BULK_DATASET"}. 
Otherwise, ignore all website boilerplate, cookie notices, and non-medical text. Extract ONLY the core clinical knowledge (symptoms, treatments, red flags, and injuries) into structured snippets and output ONLY valid JSON in the format: {"type":"SNIPPETS", "data": "extracted content"}. Do not add markdown blocks or conversational text.`;
  const ingestionRes = await invokeLlmAgent<any>(
    '@ingestion_agent',
    ingestionPrompt,
    isMultiFile ? denormalizedData : contentToProcess,
    (errReason) => {
      throw new Error(`[@ingestion_agent Failed] Clinical data extraction failed: ${errReason || 'No response from LLM'}`);
    }
  );

  let processedEntities = ingestionRes.result;
  let mlRuleCandidates = null;

  // 2 & 3. Triage Analyst / ML Data Mining Agent
  if (ingestionRes.rawLlmText?.includes('BULK_DATASET') || dataType === 'csv' || isMultiFile) {
    onLog?.('Executing Stage 2: @ml_mining_agent analyzing symptom-outcome statistical correlations...');
    const mlPrompt = `You are the ML Data Mining Agent. Analyze this patient triage dataset (which has been denormalized and flattened).
Identify statistical correlations between symptoms and outcomes. Output probabilistic rule candidates. Output ONLY valid JSON in the format: {"candidates": []}.`;
    const mlRes = await invokeLlmAgent<any>(
      '@ml_mining_agent',
      mlPrompt,
      isMultiFile ? denormalizedData : inputData.substring(0, 4000), // bounded input
      (errReason) => {
        throw new Error(`[@ml_mining_agent Failed] Statistical pattern mining failed: ${errReason || 'No response from LLM'}`);
      }
    );
    mlRuleCandidates = mlRes.result;
  } else {
    onLog?.('Executing Stage 2: @triage_analyst_agent mapping clinical entities...');
    const analystPrompt = `You are the Triage Analyst Agent. Map these snippets to ailments, emergency_keywords, and home_medications. Strictly discard any entities that are not medically relevant (e.g., website buttons, privacy policies). Output ONLY valid JSON in the format: {"entities": []}.`;
    const analystRes = await invokeLlmAgent<any>(
      '@triage_analyst_agent',
      analystPrompt,
      JSON.stringify(processedEntities).substring(0, 6000),
      (errReason) => {
        throw new Error(`[@triage_analyst_agent Failed] Clinical entity mapping failed: ${errReason || 'No response from LLM'}`);
      }
    );
    processedEntities = analystRes.result;
  }

  // 4. Rule Engine Agent
  onLog?.('Executing Stage 3: @rule_engine_agent synthesizing triage rules & severity thresholds...');
  const ruleEnginePrompt = `You are the Rule Engine Agent. Synthesize triage_rules based on the extracted entities and ML candidates.
Determine symptom_set, when_conditions, output (MUST be one of: RED_FLAG, YELLOW_FLAG, GREEN_FLAG), and rationale. Output ONLY a valid JSON array of rules in the format: {"rules": [{"symptom_set": [], "when_conditions": {}, "output": "RED_FLAG", "rationale": "..."}]}. DO NOT put medications in the triage output.`;
  const ruleEngineRes = await invokeLlmAgent<any>(
    '@rule_engine_agent',
    ruleEnginePrompt,
    JSON.stringify({ processedEntities, mlRuleCandidates }).substring(0, 8000),
    (errReason) => {
      throw new Error(`[@rule_engine_agent Failed] Rule synthesis failed: ${errReason || 'No response from LLM'}`);
    }
  );

  // 5. Proposal Orchestrator Agent
  onLog?.('Executing Stage 4: @orchestrator_agent synthesizing governance proposals...');
  const orchestratorPrompt = `You are the Proposal Orchestrator. Format the final payload indicating which tables to update.
Output ONLY a strict JSON object matching this schema: {"proposals": [{ "id": "uuid", "title": "...", "description": "...", "status": "pending", "changes": [{ "table": "...", "action": "INSERT", "data": {} }], "author": "@agentic_swarm", "createdAt": "..." }]}`;
  const orchestratorRes = await invokeLlmAgent<any>(
    '@orchestrator_agent',
    orchestratorPrompt,
    JSON.stringify(ruleEngineRes.result).substring(0, 8000),
    (errReason) => {
      throw new Error(`[@orchestrator_agent Failed] Proposal formatting failed: ${errReason || 'No response from LLM'}`);
    }
  );

  const rawProposals = orchestratorRes.result?.proposals || [];
  // Ensure valid UUIDs and status
  const sanitizedProposals = rawProposals.map((p: any) => ({
    ...p,
    id: (p.id && p.id !== 'uuid' && p.id.length > 5) ? p.id : uuidv4(),
    status: p.status || 'pending',
    author: p.author || '@agentic_swarm',
    createdAt: p.createdAt || new Date().toISOString()
  }));

  return { proposals: sanitizedProposals };
}
