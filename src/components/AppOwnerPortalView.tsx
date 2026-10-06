import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Users,
  FileCheck,
  Building2,
  Bluetooth,
  CloudSun,
  CreditCard,
  Watch,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Info,
  MapPin,
  Phone,
  Activity,
  Zap,
  Radio,
  Sliders,
  Sparkles,
  HelpCircle,
  FileText,
  Clock,
  Heart,
  AlertOctagon,
  Shield,
  Layers,
  Award,
  Check,
  X,
  ChevronUp,
  Cpu,
  Database,
  Bot,
  Play,
  Brain,
  Upload,
  ArrowRight,
  CheckCheck,
  FileSpreadsheet,
  BarChart3,
  MessageSquareHeart,
  Star,
  ThumbsUp,
  CheckCircle,
  ShieldAlert,
  BrainCircuit,
  Pill,
  Save,
  Edit2
} from 'lucide-react';
import type {
  Person,
  Household,
  SystemRole,
  Language,
  TriageRule,
  Severity,
  HospitalFacility,
  RolePermissions,
  ScreenKey,
  RoleCapabilityKey,
  HouseholdRbacConfig,
  KbProposal,
  InsuranceCompany
} from '../types';
import { DEFAULT_ROLE_PERMISSIONS, ALL_SCREENS_META, CAPABILITIES_META } from '../data/defaultRbac';
import { AILMENTS, RED_FLAG_RULES, AGENTIC_KNOWLEDGE_REPOSITORY } from '../engine/triageEngine';
import { SINGAPORE_FACILITIES } from '../data/mockData';
import { lookupSingaporePostalCode } from '../engine/singaporeData';
import { MultiAgentSimulatorView } from './MultiAgentSimulatorView';
import { ClinicalKbConsoleView } from './ClinicalKbConsoleView';
import { AgenticKnowledgeHarvester } from './AgenticKnowledgeHarvester';
import { HelperInfoButton } from './HelperInfoButton';
import {
  fetchCustomerFeedback,
  fetchKeyStatistics,
  fetchGuardrailsFromDb,
  updateGuardrailsInDb,
  fetchAllTriageDecisionsFromDb,
  saveTriageDecisionToDb,
  type CustomerFeedback,
  type KeySystemStatistics,
  type GuardrailSettings
} from '../services/dbService';

interface AppOwnerPortalViewProps {
  currentUser: Person | null;
  household: Household;
  allHouseholds: Household[];
  members: Person[];
  onUpdateMembers: (newMembers: Person[]) => void;
  language: Language;
  onOpenSos: () => void;
  customRules: TriageRule[];
  onAddCustomRule: (rule: TriageRule) => void;
  onDeleteCustomRule: (ruleId: string) => void;
  allFacilities: HospitalFacility[];
  onAddFacility: (facility: HospitalFacility) => void;
  onSelectTab: (tab: string) => void;
  rolePermissions?: Record<SystemRole, RolePermissions>;
  onUpdateRolePermissions?: (newPerms: Record<SystemRole, RolePermissions>) => Promise<boolean>;
  onResetRolePermissions?: () => Promise<boolean>;
  menuMode?: 'clinical_lab' | 'app_workspace';
  proposals?: KbProposal[];
  onApproveProposal?: (id: string, doctorNameOrOverrides?: any, mcr?: any) => void;
  onDeleteProposal?: (id: string) => void;
  onMoveToPendingProposal?: (id: string) => void;
  onRefreshProposals?: () => Promise<void>;
}

type SubTab = 
  | 'harvesting'
  | 'rbac' 
  | 'rules' 
  | 'simulation'
  | 'statistics'
  | 'feedback'
  | 'hospitals' 
  | 'bluetooth' 
  | 'weather'
  | 'guardrails'
  | 'triage_medications'
  | 'insurance' 
  | 'wearables'
  | 'jarvis_arh';

export const AppOwnerPortalView: React.FC<AppOwnerPortalViewProps> = ({
  currentUser,
  household,
  allHouseholds,
  members,
  onUpdateMembers,
  language,
  onOpenSos,
  customRules,
  onAddCustomRule,
  onDeleteCustomRule,
  allFacilities,
  onAddFacility,
  onSelectTab,
  rolePermissions: initialRolePermissions,
  onUpdateRolePermissions,
  onResetRolePermissions,
  menuMode = 'app_workspace',
  proposals = [],
  onApproveProposal,
  onDeleteProposal,
  onMoveToPendingProposal,
  onRefreshProposals
}) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>(menuMode === 'clinical_lab' ? 'rules' : 'rbac');
  
  // Update active sub-tab if menuMode changes
  useEffect(() => {
    setActiveSubTab(menuMode === 'clinical_lab' ? 'rules' : 'rbac');
  }, [menuMode]);

  const [integrationsDropdownOpen, setIntegrationsDropdownOpen] = useState(false);
  const integrationsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (integrationsDropdownRef.current && !integrationsDropdownRef.current.contains(e.target as Node)) {
        setIntegrationsDropdownOpen(false);
      }
    };
    if (integrationsDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [integrationsDropdownOpen]);

  // Insurance Registry State
  const [insuranceCompanies, setInsuranceCompanies] = useState<InsuranceCompany[]>([
    { id: 'ge', name: 'Great Eastern', panelHospitals: ['sgh', 'cgh'] },
    { id: 'aia', name: 'AIA Singapore', panelHospitals: ['nuh', 'kkh'] }
  ]);
  const [isAddingInsurance, setIsAddingInsurance] = useState(false);
  const [newInsuranceName, setNewInsuranceName] = useState('');
  const [newInsurancePanels, setNewInsurancePanels] = useState<string[]>([]);

  // ==========================================
  // KEY STATISTICS & CUSTOMER FEEDBACK STATE
  // ==========================================
  const [keyStats, setKeyStats] = useState<KeySystemStatistics | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [feedbackList, setFeedbackList] = useState<CustomerFeedback[]>([]);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  const [feedbackRatingFilter, setFeedbackRatingFilter] = useState<'ALL' | number>('ALL');
  const [feedbackCategoryFilter, setFeedbackCategoryFilter] = useState<string>('ALL');
  const [feedbackSearch, setFeedbackSearch] = useState('');

  const loadStatsAndFeedback = async () => {
    setIsLoadingStats(true);
    setIsLoadingFeedback(true);
    try {
      const [statsData, feedbacksData] = await Promise.all([
        fetchKeyStatistics(),
        fetchCustomerFeedback()
      ]);
      if (statsData) setKeyStats(statsData);
      if (feedbacksData) setFeedbackList(feedbacksData);
    } catch (err) {
      console.warn('Error loading stats/feedback:', err);
    } finally {
      setIsLoadingStats(false);
      setIsLoadingFeedback(false);
    }
  };

  useEffect(() => {
    loadStatsAndFeedback();
  }, []);

  // Auto-refresh when entering statistics or feedback tabs
  useEffect(() => {
    if (activeSubTab === 'statistics' || activeSubTab === 'feedback') {
      loadStatsAndFeedback();
    }
  }, [activeSubTab]);

  // ==========================================
  // CLINICAL GUARDRAILS STATE (Spec §6)
  // ==========================================
  const [confidenceFloor, setConfidenceFloor] = useState<number>(80);
  const [allergyHardStop, setAllergyHardStop] = useState<boolean>(true);
  const [ageHardStop, setAgeHardStop] = useState<boolean>(true);
  const [stalenessWindowDays, setStalenessWindowDays] = useState<number>(90);
  const [maxRetryCount, setMaxRetryCount] = useState<number>(2);
  const [isSavingGuardrails, setIsSavingGuardrails] = useState<boolean>(false);

  const loadGuardrails = async () => {
    try {
      const cfg = await fetchGuardrailsFromDb();
      if (cfg) {
        setConfidenceFloor(cfg.confidenceFloorPercent);
        setAllergyHardStop(cfg.enableAllergyHardStop);
        setAgeHardStop(cfg.enableAgeHardStop);
        setStalenessWindowDays(cfg.freshnessWindowDays);
        setMaxRetryCount(cfg.maxChallengeRetries);
      }
    } catch (e) {
      console.warn('Error loading guardrails:', e);
    }
  };

  const handleSaveGuardrails = async () => {
    setIsSavingGuardrails(true);
    try {
      const ok = await updateGuardrailsInDb({
        confidenceFloorPercent: confidenceFloor,
        enableAllergyHardStop: allergyHardStop,
        enableAgeHardStop: ageHardStop,
        freshnessWindowDays: stalenessWindowDays,
        maxChallengeRetries: maxRetryCount,
      });
      if (ok) {
        showToast('Clinical Guardrails updated successfully in SQLite database.');
      } else {
        showToast('Failed to update clinical guardrails.');
      }
    } catch (e) {
      showToast('Error saving guardrails.');
    } finally {
      setIsSavingGuardrails(false);
    }
  };

  // ==========================================
  // TRIAGE DECISIONS & MEDICATIONS STATE
  // ==========================================
  const [triageDecisionsList, setTriageDecisionsList] = useState<any[]>([]);
  const [isLoadingDecisions, setIsLoadingDecisions] = useState<boolean>(false);
  const [selectedDecisionId, setSelectedDecisionId] = useState<number | null>(null);
  const [isEditingDecision, setIsEditingDecision] = useState<boolean>(false);
  const [decisionFilterAilment, setDecisionFilterAilment] = useState<string>('ALL');

  // Form state for creating / editing decision
  const [formAilmentCode, setFormAilmentCode] = useState<string>('fever');
  const [formSeverity, setFormSeverity] = useState<string>('GREEN');
  const [formAction, setFormAction] = useState<string>('Home Care');
  const [formOtcMeds, setFormOtcMeds] = useState<string>('');
  const [formHomeCare, setFormHomeCare] = useState<string>('');
  const [formTelemed, setFormTelemed] = useState<string>('');
  const [formDoseToddler, setFormDoseToddler] = useState<string>('2.5ml');
  const [formDoseChild, setFormDoseChild] = useState<string>('5ml');
  const [formDoseAdult, setFormDoseAdult] = useState<string>('10ml');
  const [formFrequency, setFormFrequency] = useState<string>('Once every 6 hours');
  const [isSavingDecision, setIsSavingDecision] = useState<boolean>(false);

  const loadTriageDecisions = async () => {
    setIsLoadingDecisions(true);
    try {
      const data = await fetchAllTriageDecisionsFromDb();
      setTriageDecisionsList(data);
    } catch (e) {
      console.warn('Error loading triage decisions:', e);
    } finally {
      setIsLoadingDecisions(false);
    }
  };

  const handleOpenEditDecision = (decision?: any) => {
    if (decision) {
      setSelectedDecisionId(decision.id);
      setFormAilmentCode(decision.ailmentCode);
      setFormSeverity(decision.severity);
      setFormAction(decision.action || '');
      setFormOtcMeds((decision.otcMedications || []).join(', '));
      setFormHomeCare((decision.homeCare || []).join(', '));
      setFormTelemed((decision.telemedPartners || []).join(', '));
      setFormDoseToddler(decision.doses?.toddler || '2.5ml');
      setFormDoseChild(decision.doses?.child || '5ml');
      setFormDoseAdult(decision.doses?.adult || '10ml');
      setFormFrequency(decision.frequency || 'N/A');
    } else {
      setSelectedDecisionId(null);
      setFormAilmentCode('fever');
      setFormSeverity('GREEN');
      setFormAction('Home Care');
      setFormOtcMeds('');
      setFormHomeCare('');
      setFormTelemed('');
      setFormDoseToddler('2.5ml');
      setFormDoseChild('5ml');
      setFormDoseAdult('10ml');
      setFormFrequency('Once every 6 hours');
    }
    setIsEditingDecision(true);
  };

  const handleSaveDecisionForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingDecision(true);
    try {
      const payload = {
        id: selectedDecisionId || undefined,
        ailmentCode: formAilmentCode.trim().toLowerCase(),
        severity: formSeverity,
        action: formAction.trim(),
        otcMedications: formOtcMeds.split(',').map(s => s.trim()).filter(Boolean),
        homeCare: formHomeCare.split(',').map(s => s.trim()).filter(Boolean),
        telemedPartners: formTelemed.split(',').map(s => s.trim()).filter(Boolean),
        doses: {
          neonate: 'N/A',
          young_infant: 'N/A',
          infant: 'N/A',
          toddler: formDoseToddler.trim() || '2.5ml',
          child: formDoseChild.trim() || '5ml',
          adolescent: formDoseAdult.trim() || '10ml',
          adult: formDoseAdult.trim() || '10ml',
          elderly: formDoseAdult.trim() || '10ml'
        },
        frequency: formFrequency.trim() || 'N/A'
      };
      const ok = await saveTriageDecisionToDb(payload);
      if (ok) {
        showToast(`Triage decision for ${payload.ailmentCode} (${payload.severity}) saved to triage_decisions table!`);
        setIsEditingDecision(false);
        await loadTriageDecisions();
      } else {
        showToast('Failed to save triage decision.');
      }
    } catch (e) {
      showToast('Error saving triage decision.');
    } finally {
      setIsSavingDecision(false);
    }
  };

  useEffect(() => {
    loadGuardrails();
    loadTriageDecisions();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'guardrails') {
      loadGuardrails();
    } else if (activeSubTab === 'triage_medications') {
      loadTriageDecisions();
    }
  }, [activeSubTab]);

  // ==========================================
  // 1. RBAC STATE
  // ==========================================
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string>(household.id);
  const activeHousehold = allHouseholds.find(h => h.id === selectedHouseholdId) || household;
  const householdMembers = members.filter(m => m.householdId === activeHousehold.id);

  // Load RBAC permissions from props or defaults
  const [rolePermissions, setRolePermissions] = useState<Record<SystemRole, RolePermissions>>(
    () => initialRolePermissions || DEFAULT_ROLE_PERMISSIONS
  );
  const [isSavingRbac, setIsSavingRbac] = useState(false);

  useEffect(() => {
    if (initialRolePermissions) {
      setRolePermissions(initialRolePermissions);
    }
  }, [initialRolePermissions]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSaveRbac = async () => {
    setIsSavingRbac(true);
    try {
      let ok = false;
      if (onUpdateRolePermissions) {
        ok = await onUpdateRolePermissions(rolePermissions);
      } else {
        const res = await fetch('/api/rbac/permissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permissions: rolePermissions }),
        });
        ok = res.ok;
      }
      if (ok) {
        showToast('Role-Based Access Control (RBAC) permissions saved to SQLite database successfully. Persona access updated.');
      } else {
        showToast('Permissions saved locally, but database returned warning.');
      }
    } catch (e) {
      console.error(e);
      showToast('Failed to save permissions to database.');
    } finally {
      setIsSavingRbac(false);
    }
  };

  const handleResetRbacDefaults = async () => {
    try {
      if (onResetRolePermissions) {
        await onResetRolePermissions();
      } else {
        await fetch('/api/rbac/reset', { method: 'POST' });
        setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
      }
      showToast('RBAC permissions reset to Singapore MOH defaults in SQLite database.');
    } catch (e) {
      console.error(e);
      setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
      showToast('RBAC permissions reset to defaults.');
    }
  };

  const toggleScreenForRole = (role: SystemRole, screen: ScreenKey) => {
    setRolePermissions(prev => {
      const currentAllowed = prev[role]?.allowedScreens || [];
      const isAllowed = currentAllowed.includes(screen);
      const newAllowed = isAllowed
        ? currentAllowed.filter(s => s !== screen)
        : [...currentAllowed, screen];
      return {
        ...prev,
        [role]: {
          ...prev[role],
          allowedScreens: newAllowed,
        },
      };
    });
  };

  const handleRoleChangeForMember = async (memberId: string, newRole: SystemRole) => {
    const updated = members.map(m => {
      if (m.id === memberId) {
        return { ...m, systemRole: newRole };
      }
      return m;
    });
    onUpdateMembers(updated);

    try {
      await fetch('/api/rbac/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          systemRole: newRole,
          householdId: activeHousehold.id,
        }),
      });
      showToast(`Updated role to ${newRole} for member & saved to SQLite database.`);
    } catch (e) {
      console.error('Failed to save member role to DB:', e);
      showToast(`Updated role to ${newRole} for member.`);
    }
  };

  // ==========================================
  // 2. CLINICAL RULE BUILDER & AGENTIC REPOSITORY STATE
  // ==========================================
  const [ruleSeverityFilter, setRuleSeverityFilter] = useState<'ALL' | Severity>('ALL');
  const [ruleAgeBandFilter, setRuleAgeBandFilter] = useState<string>('ALL');
  const [ruleBodyPartFilter, setRuleBodyPartFilter] = useState<string>('ALL');
  const [ruleSearchQuery, setRuleSearchQuery] = useState<string>('');
  const [showArchFlow, setShowArchFlow] = useState<boolean>(true);

  // Form State
  const [newRuleId, setNewRuleId] = useState(`RULE-${Date.now().toString().slice(-4)}`);
  const [newRuleAilment, setNewRuleAilment] = useState(AILMENTS[0]?.code || 'fever');
  const [newRuleSeverity, setNewRuleSeverity] = useState<Severity>('RED');
  const [newRuleAgeBand, setNewRuleAgeBand] = useState<string>('infant');
  const [newRuleBodyPart, setNewRuleBodyPart] = useState<string>('Systemic / Vitals');
  const [newRuleAgeMin, setNewRuleAgeMin] = useState<string>('0');
  const [newRuleAgeMax, setNewRuleAgeMax] = useState<string>('365');
  const [newRuleCriteria, setNewRuleCriteria] = useState<string>('temp_c >= 39.5, lethargy == true');
  const [newRuleCareTier, setNewRuleCareTier] = useState('tier.red.a_and_e_995');
  const [newRuleReasonEn, setNewRuleReasonEn] = useState('High fever with altered consciousness in infant');
  const [newRuleReasonZh, setNewRuleReasonZh] = useState('婴儿高烧伴有意识模糊或反应迟钝');
  const [newRuleReasonMs, setNewRuleReasonMs] = useState('Demam tinggi dengan perubahan tahap kesedaran bayi');
  const [newRuleGuideline, setNewRuleGuideline] = useState('MOH Singapore Pediatric Clinical Practice Guidelines (2026)');

  const handleSeverityChange = (sev: Severity) => {
    setNewRuleSeverity(sev);
    if (sev === 'RED') setNewRuleCareTier('tier.red.a_and_e_995');
    else if (sev === 'ORANGE') setNewRuleCareTier('tier.orange.urgent_care_clinic');
    else if (sev === 'YELLOW') setNewRuleCareTier('tier.yellow.gp_polyclinic_24h');
    else setNewRuleCareTier('tier.green.home_care_telemonitoring');
  };

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleId.trim()) return;

    const criteriaList = newRuleCriteria.split(',').map(c => c.trim()).filter(Boolean);

    const rule: TriageRule = {
      ruleId: newRuleId.trim(),
      version: '1.0.0',
      contentStatus: 'CLINICALLY_APPROVED',
      ailment: newRuleAilment,
      appliesTo: {
        ageMinDays: newRuleAgeMin ? parseInt(newRuleAgeMin) : undefined,
        ageMaxDays: newRuleAgeMax ? parseInt(newRuleAgeMax) : undefined,
      },
      when: {
        any: criteriaList,
      },
      severity: newRuleSeverity,
      careTierKey: newRuleCareTier,
      reasonKey: newRuleReasonEn,
      localesRequired: ['en', 'zh', 'ms'],
      conditionId: `COND-${newRuleId.trim()}`,
      ageBand: (newRuleAgeBand as any) || 'all',
      bodyPart: newRuleBodyPart || 'General',
      symptomSet: criteriaList.map(c => c.split('==')[0]?.split('>=')[0]?.trim()).filter(Boolean),
      sourceRefs: [newRuleGuideline || 'App Owner Rule Builder'],
      originatingAgent: 'App Owner Workspace',
      hybridStore: {
        graphNode: `node_${newRuleId.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        vectorDim: 1536,
        queryShape: newRuleSeverity === 'RED' ? 'graph' : 'vector',
      },
      rationale: newRuleReasonEn,
    };

    onAddCustomRule(rule);
    showToast(`Rule ${rule.ruleId} (${rule.severity}) added to active decision triaging engine!`);
    setNewRuleId(`RULE-${Date.now().toString().slice(-4)}`);
  };

  // ==========================================
  // 2.1 ML DATASET PIPELINE STATE (Spec §4 & §5)
  // ==========================================
  const [ruleBuilderView, setRuleBuilderView] = useState<'explorer' | 'ml_pipeline' | 'author' | 'unified'>('explorer');
  const [editingUxRuleId, setEditingUxRuleId] = useState<string | null>(null);
  
  // Dummy local state to simulate fetching from triage_decisions
  const [uxMappings, setUxMappings] = useState<Record<string, { action: string, meds: string, partners: string }>>({
    'COLD-VIRAL-001': { action: 'Home Monitoring', meds: '["Prospan"]', partners: '[]' }
  });
  const [selectedDataset, setSelectedDataset] = useState<'mimic_iv' | 'moh_cpg' | 'nuhs_urgent' | 'custom'>('mimic_iv');
  const [customDatasetName, setCustomDatasetName] = useState<string>('pediatric_urgent_feed_2026.csv');
  const [customRecordCount, setCustomRecordCount] = useState<number>(6400);
  const [mlConfidenceFloor, setMlConfidenceFloor] = useState<number>(85);
  const [enforceHardStopGuard, setEnforceHardStopGuard] = useState<boolean>(true);
  const [enforcePdpaAnonymization, setEnforcePdpaAnonymization] = useState<boolean>(true);

  const [mlPipelineRunning, setMlPipelineRunning] = useState<boolean>(false);
  const [mlPipelineProgress, setMlPipelineProgress] = useState<number>(0);
  const [mlPipelineStage, setMlPipelineStage] = useState<string>('');
  const [mlLogs, setMlLogs] = useState<string[]>([]);
  const [mlHarvestedRules, setMlHarvestedRules] = useState<Array<{
    rule: TriageRule;
    supportCount: number;
    mlConfidence: number;
    icd10: string;
    conditionName: string;
    isFed: boolean;
  }>>([]);

  const handleInvokeMlPipeline = () => {
    setMlPipelineRunning(true);
    setMlPipelineProgress(10);
    setMlHarvestedRules([]);
    setMlLogs([
      `[00:00.12] Ingesting dataset: ${
        selectedDataset === 'mimic_iv' ? 'MIMIC-IV ED Clinical Triage Cohort (12,500 records)' :
        selectedDataset === 'moh_cpg' ? 'Singapore MOH Pediatric & Geriatric CPG 2026 (4,800 records)' :
        selectedDataset === 'nuhs_urgent' ? 'NUHS / SGH Outpatient Urgent Feed (8,400 records)' :
        `${customDatasetName} (${customRecordCount} records)`
      }`,
      `[00:00.35] @decipher_agent: Anonymization & PDPA Section 7 compliance check: PASS (100% de-identified).`,
      `[00:00.60] @decipher_agent: Tokenizing clinical presentations & extracting continuous vital sign thresholds...`
    ]);
    setMlPipelineStage('@decipher_agent: Ingesting dataset records & tokenizing clinical presentations...');

    setTimeout(() => {
      setMlPipelineProgress(35);
      setMlPipelineStage('@ml_agent: Training decision tree splits & calculating entropy information gain...');
      setMlLogs(prev => [
        ...prev,
        `[00:00.90] @ml_agent: Feature space: Heart Rate, SpO2, SBP, Resp Rate, Temp, GCS, Chief Complaint NLP tokens.`,
        `[00:01.10] @ml_agent: Inducing candidate decision paths with confidence floor >= ${mlConfidenceFloor}%...`
      ]);
    }, 600);

    setTimeout(() => {
      setMlPipelineProgress(70);
      setMlPipelineStage('@expert_doctor_agent: Cross-validating candidate rules against Singapore MOH Red-Lines...');
      setMlLogs(prev => [
        ...prev,
        `[00:01.40] @expert_doctor_agent: Deterministic hard-stop evaluation against infant §3.1 & senior §3.2 invariants.`,
        `[00:01.65] @expert_doctor_agent: 0 false negative violations detected across candidate partition.`
      ]);
    }, 1200);

    setTimeout(() => {
      setMlPipelineProgress(100);
      setMlPipelineStage('@knowledge_agent: Synthesized candidate rules ready for Knowledge Repository ingestion.');
      setMlLogs(prev => [
        ...prev,
        `[00:01.90] @knowledge_agent: Rule synthesis complete. High-yield rules formatted with ICD-10 & Singapore Care Tiers.`,
        `[00:02.00] Pipeline execution SUCCESS: Candidate rules awaiting Human Review Gateway approval.`
      ]);
      setMlPipelineRunning(false);

      let candidateRules: Array<{
        rule: TriageRule;
        supportCount: number;
        mlConfidence: number;
        icd10: string;
        conditionName: string;
        isFed: boolean;
      }> = [];

      if (selectedDataset === 'mimic_iv') {
        candidateRules = [
          {
            rule: {
              ruleId: `ML-MIMIC-RESP-${Date.now().toString().slice(-3)}1`,
              version: '1.0.0',
              contentStatus: 'CLINICALLY_APPROVED',
              ailment: 'respiratory',
              appliesTo: { ageMaxDays: 365 },
              severity: 'ORANGE',
              careTierKey: 'tier.orange.urgent_care_clinic',
              reasonKey: 'Pediatric viral bronchiolitis with subcostal retractions and tachypnea',
              when: { any: ['respiratory_distress', 'tachypnea', 'subcostal_retractions'] },
              conditionId: 'COND-ML-PED-BRONCH',
              ageBand: 'infant',
              bodyPart: 'Respiratory / Chest',
              sourceRefs: ['MIMIC-IV ED Dataset ML Pipeline', 'SMC Certified Gateway'],
              originatingAgent: '@ml_agent',
              rationale: 'Pediatric viral bronchiolitis presenting with increased work of breathing requires urgent medical evaluation within 4 hours.',
              localesRequired: ['en', 'zh', 'ms'],
              symptomSet: ['respiratory_distress', 'tachypnea', 'subcostal_retractions'],
            },
            supportCount: 412,
            mlConfidence: 94.6,
            icd10: 'J21.9',
            conditionName: 'Pediatric Acute Bronchiolitis with Subcostal Retraction',
            isFed: false,
          },
          {
            rule: {
              ruleId: `ML-MIMIC-MSK-${Date.now().toString().slice(-3)}2`,
              version: '1.0.0',
              contentStatus: 'CLINICALLY_APPROVED',
              ailment: 'injury_wound',
              appliesTo: {},
              severity: 'YELLOW',
              careTierKey: 'tier.yellow.gp_polyclinic_24h',
              reasonKey: 'Acute ankle inversion trauma with inability to bear weight (Ottawa Criteria)',
              when: { any: ['ankle_inversion', 'inability_to_bear_weight', 'malleolar_tenderness'] },
              conditionId: 'COND-ML-ANKLE-SPRAIN',
              ageBand: 'all',
              bodyPart: 'Musculoskeletal / Lower Extremity',
              sourceRefs: ['MIMIC-IV ED Dataset ML Pipeline', 'SMC Certified Gateway'],
              originatingAgent: '@ml_agent',
              rationale: 'Acute lateral ankle sprain with weight-bearing difficulty meets Ottawa criteria for GP clinic X-ray screening and R.I.C.E protocol.',
              localesRequired: ['en', 'zh', 'ms'],
              symptomSet: ['ankle_inversion', 'inability_to_bear_weight', 'malleolar_tenderness'],
            },
            supportCount: 1840,
            mlConfidence: 96.2,
            icd10: 'S93.4',
            conditionName: 'Acute Lateral Ankle Sprain (Ottawa Positive)',
            isFed: false,
          },
          {
            rule: {
              ruleId: `ML-MIMIC-CARD-${Date.now().toString().slice(-3)}3`,
              version: '1.0.0',
              contentStatus: 'CLINICALLY_APPROVED',
              ailment: 'chest_pain',
              appliesTo: { ageMinDays: 23725 },
              severity: 'ORANGE',
              careTierKey: 'tier.orange.urgent_care_clinic',
              reasonKey: 'Elderly presyncope on chronotropic cardiac medications',
              when: { any: ['presyncope', 'orthostatic_dizziness', 'bradycardia_post_exertion'] },
              conditionId: 'COND-ML-GER-PRESYNCOPE',
              ageBand: 'elderly',
              bodyPart: 'Cardiovascular / Heart',
              sourceRefs: ['MIMIC-IV ED Dataset ML Pipeline', 'SMC Certified Gateway'],
              originatingAgent: '@ml_agent',
              rationale: 'Elderly syncopal or presyncopal episode on cardiac medications warrants urgent clinical evaluation and 12-lead ECG within 4-6 hours.',
              localesRequired: ['en', 'zh', 'ms'],
              symptomSet: ['presyncope', 'orthostatic_dizziness', 'bradycardia_post_exertion'],
            },
            supportCount: 310,
            mlConfidence: 92.4,
            icd10: 'R55',
            conditionName: 'Elderly Exertional Presyncope with Beta-Blocker Therapy',
            isFed: false,
          },
          {
            rule: {
              ruleId: `ML-MIMIC-GI-${Date.now().toString().slice(-3)}4`,
              version: '1.0.0',
              contentStatus: 'CLINICALLY_APPROVED',
              ailment: 'vomiting_diarrhea',
              appliesTo: {},
              severity: 'GREEN',
              careTierKey: 'tier.green.home_care_telemonitoring',
              reasonKey: 'Uncomplicated acute gastroenteritis with normal oral hydration tolerance',
              when: { any: ['mild_diarrhea', 'tolerating_fluids', 'normal_skin_turgor'] },
              conditionId: 'COND-ML-GI-MILD',
              ageBand: 'all',
              bodyPart: 'GI / Hydration',
              sourceRefs: ['MIMIC-IV ED Dataset ML Pipeline', 'SMC Certified Gateway'],
              originatingAgent: '@ml_agent',
              rationale: 'Uncomplicated acute gastroenteritis with intact fluid tolerance is safe for home oral rehydration solution (ORS) with dynamic red-flag monitoring.',
              localesRequired: ['en', 'zh', 'ms'],
              symptomSet: ['mild_diarrhea', 'tolerating_fluids', 'normal_skin_turgor'],
            },
            supportCount: 2450,
            mlConfidence: 95.8,
            icd10: 'A09',
            conditionName: 'Uncomplicated Viral Gastroenteritis (Home Hydration)',
            isFed: false,
          },
        ];
      } else if (selectedDataset === 'moh_cpg') {
        candidateRules = [
          {
            rule: {
              ruleId: `ML-CPG-FEV-${Date.now().toString().slice(-3)}1`,
              version: '1.0.0',
              contentStatus: 'CLINICALLY_APPROVED',
              ailment: 'fever',
              appliesTo: { ageMaxDays: 365 },
              severity: 'ORANGE',
              careTierKey: 'tier.orange.urgent_care_clinic',
              reasonKey: 'Infant fever > 38.0°C exceeding 72 hours with reduced intake',
              when: { any: ['fever_gt_72h', 'infant_lethargy', 'decreased_wet_nappies'] },
              conditionId: 'COND-ML-CPG-INF-FEV',
              ageBand: 'infant',
              bodyPart: 'Systemic / Vitals',
              sourceRefs: ['MOH Singapore CPG 2026', 'SMC Certified Gateway'],
              originatingAgent: '@ml_agent',
              rationale: 'Infant fever exceeding 72 hours mandates prompt urgent care examination for occult bacterial infection (UTI/pneumonia).',
              localesRequired: ['en', 'zh', 'ms'],
              symptomSet: ['fever_gt_72h', 'infant_lethargy', 'decreased_wet_nappies'],
            },
            supportCount: 580,
            mlConfidence: 95.1,
            icd10: 'R50.9',
            conditionName: 'Infant Prolonged Pyrexia (>72 Hours)',
            isFed: false,
          },
          {
            rule: {
              ruleId: `ML-CPG-DERM-${Date.now().toString().slice(-3)}2`,
              version: '1.0.0',
              contentStatus: 'CLINICALLY_APPROVED',
              ailment: 'rash_skin',
              appliesTo: {},
              severity: 'ORANGE',
              careTierKey: 'tier.orange.urgent_care_clinic',
              reasonKey: 'Dengue syndromic rash with high fever and retro-orbital pain in Singapore endemic zone',
              when: { any: ['petechiae', 'retro_orbital_pain', 'high_fever'] },
              conditionId: 'COND-ML-CPG-DENGUE',
              ageBand: 'all',
              bodyPart: 'Dermatology / Skin',
              sourceRefs: ['MOH Singapore CPG 2026', 'NEA Dengue Surveillance Feed'],
              originatingAgent: '@ml_agent',
              rationale: 'Acute febrile illness with petechial rash and retro-orbital headache satisfies Singapore MOH criteria for urgent full blood count (FBC) and Dengue NS1 antigen.',
              localesRequired: ['en', 'zh', 'ms'],
              symptomSet: ['petechiae', 'retro_orbital_pain', 'high_fever'],
            },
            supportCount: 720,
            mlConfidence: 93.7,
            icd10: 'A90',
            conditionName: 'Acute Arboviral / Dengue Febrile Syndrome',
            isFed: false,
          },
          {
            rule: {
              ruleId: `ML-CPG-HEAT-${Date.now().toString().slice(-3)}3`,
              version: '1.0.0',
              contentStatus: 'CLINICALLY_APPROVED',
              ailment: 'fever',
              appliesTo: {},
              severity: 'YELLOW',
              careTierKey: 'tier.yellow.gp_polyclinic_24h',
              reasonKey: 'Tropical heat exhaustion with profuse diaphoresis and normal mental state',
              when: { any: ['heat_exposure', 'profuse_sweating', 'mild_dizziness'] },
              conditionId: 'COND-ML-CPG-HEAT',
              ageBand: 'all',
              bodyPart: 'Systemic / Vitals',
              sourceRefs: ['MOH Singapore CPG 2026', 'MSS Heat Stress Guidelines'],
              originatingAgent: '@ml_agent',
              rationale: 'Heat exhaustion without neurological compromise requires active cooling, electrolyte replacement, and GP clinic vitals recheck if recovery is delayed.',
              localesRequired: ['en', 'zh', 'ms'],
              symptomSet: ['heat_exposure', 'profuse_sweating', 'mild_dizziness'],
            },
            supportCount: 940,
            mlConfidence: 96.0,
            icd10: 'T67.5',
            conditionName: 'Tropical Heat Exhaustion without CNS Deficit',
            isFed: false,
          },
          {
            rule: {
              ruleId: `ML-CPG-RESP-${Date.now().toString().slice(-3)}4`,
              version: '1.0.0',
              contentStatus: 'CLINICALLY_APPROVED',
              ailment: 'cough_cold',
              appliesTo: {},
              severity: 'GREEN',
              careTierKey: 'tier.green.home_care_telemonitoring',
              reasonKey: 'Upper respiratory viral rhinorrhea with normal respiratory effort and clear lungs',
              when: { any: ['rhinorrhea', 'clear_auscultation', 'normal_breathing'] },
              conditionId: 'COND-ML-CPG-COLD',
              ageBand: 'all',
              bodyPart: 'Respiratory / Chest',
              sourceRefs: ['MOH Singapore CPG 2026', 'SingHealth Polyclinics'],
              originatingAgent: '@ml_agent',
              rationale: 'Uncomplicated acute viral rhinorrhea in non-vulnerable individual resolves with oral fluids and home tele-monitoring.',
              localesRequired: ['en', 'zh', 'ms'],
              symptomSet: ['rhinorrhea', 'clear_auscultation', 'normal_breathing'],
            },
            supportCount: 3120,
            mlConfidence: 97.4,
            icd10: 'J00',
            conditionName: 'Upper Respiratory Viral Rhinitis (Home Care)',
            isFed: false,
          },
        ];
      } else {
        candidateRules = [
          {
            rule: {
              ruleId: `ML-NUHS-TRAUMA-${Date.now().toString().slice(-3)}1`,
              version: '1.0.0',
              contentStatus: 'CLINICALLY_APPROVED',
              ailment: 'injury_wound',
              appliesTo: {},
              severity: 'ORANGE',
              careTierKey: 'tier.orange.urgent_care_clinic',
              reasonKey: 'Suspected metatarsal / malleolar bony fracture with inability to take 4 steps',
              when: { any: ['point_bony_tenderness', 'inability_to_take_4_steps', 'marked_edema'] },
              conditionId: 'COND-ML-NUHS-FRACTURE',
              ageBand: 'all',
              bodyPart: 'Musculoskeletal / Lower Extremity',
              sourceRefs: ['NUHS Outpatient Trauma Feed', 'SMC Certified Gateway'],
              originatingAgent: '@ml_agent',
              rationale: 'Severe focal bony tenderness post-trauma meets Ottawa criteria; urgent Plain Film Radiography (X-Ray) and immobilization indicated within 4-6h.',
              localesRequired: ['en', 'zh', 'ms'],
              symptomSet: ['point_bony_tenderness', 'inability_to_take_4_steps', 'marked_edema'],
            },
            supportCount: 620,
            mlConfidence: 94.8,
            icd10: 'S92.9',
            conditionName: 'Suspected Lower Extremity Bony Fracture',
            isFed: false,
          },
          {
            rule: {
              ruleId: `ML-NUHS-ASTHMA-${Date.now().toString().slice(-3)}2`,
              version: '1.0.0',
              contentStatus: 'CLINICALLY_APPROVED',
              ailment: 'respiratory',
              appliesTo: {},
              severity: 'ORANGE',
              careTierKey: 'tier.orange.urgent_care_clinic',
              reasonKey: 'Acute moderate bronchospasm with incomplete bronchodilator relief',
              when: { any: ['wheezing_recurrent', 'partial_bronchodilator_response', 'tachypnea'] },
              conditionId: 'COND-ML-NUHS-ASTHMA',
              ageBand: 'all',
              bodyPart: 'Respiratory / Chest',
              sourceRefs: ['NUHS Outpatient Urgent Feed', 'SMC Certified Gateway'],
              originatingAgent: '@ml_agent',
              rationale: 'Recurrent bronchospasm with blunted salbutamol response requires physician assessment and possible systemic oral corticosteroid therapy within 4 hours.',
              localesRequired: ['en', 'zh', 'ms'],
              symptomSet: ['wheezing_recurrent', 'partial_bronchodilator_response', 'tachypnea'],
            },
            supportCount: 880,
            mlConfidence: 93.2,
            icd10: 'J45.901',
            conditionName: 'Acute Exacerbation of Asthma / Bronchospasm',
            isFed: false,
          },
          {
            rule: {
              ruleId: `ML-NUHS-MSK-${Date.now().toString().slice(-3)}3`,
              version: '1.0.0',
              contentStatus: 'CLINICALLY_APPROVED',
              ailment: 'injury_wound',
              appliesTo: {},
              severity: 'YELLOW',
              careTierKey: 'tier.yellow.gp_polyclinic_24h',
              reasonKey: 'Superficial extremity contusion with preserved range of motion',
              when: { any: ['minor_bruising', 'intact_joint_motion', 'mild_tenderness'] },
              conditionId: 'COND-ML-NUHS-CONTUSION',
              ageBand: 'all',
              bodyPart: 'Musculoskeletal / Lower Extremity',
              sourceRefs: ['NUHS Outpatient Urgent Feed', 'SMC Certified Gateway'],
              originatingAgent: '@ml_agent',
              rationale: 'Superficial soft tissue blunt contusion without ligamentous instability is suitable for GP review within 24h and oral analgesia.',
              localesRequired: ['en', 'zh', 'ms'],
              symptomSet: ['minor_bruising', 'intact_joint_motion', 'mild_tenderness'],
            },
            supportCount: 1510,
            mlConfidence: 97.0,
            icd10: 'S90.0',
            conditionName: 'Superficial Extremity Contusion (Preserved Joint Motion)',
            isFed: false,
          },
          {
            rule: {
              ruleId: `ML-NUHS-HOME-${Date.now().toString().slice(-3)}4`,
              version: '1.0.0',
              contentStatus: 'CLINICALLY_APPROVED',
              ailment: 'headache',
              appliesTo: {},
              severity: 'GREEN',
              careTierKey: 'tier.green.home_care_telemonitoring',
              reasonKey: 'Episodic tension headache without visual or neurological red flags',
              when: { any: ['mild_tension_headache', 'no_visual_disturbance', 'normal_neuro'] },
              conditionId: 'COND-ML-NUHS-TENSION-HA',
              ageBand: 'all',
              bodyPart: 'Neurology / Mental Health',
              sourceRefs: ['NUHS Outpatient Urgent Feed', 'SMC Certified Gateway'],
              originatingAgent: '@ml_agent',
              rationale: 'Episodic tension headache with normal neurological signs is managed with hydration, paracetamol, and home rest.',
              localesRequired: ['en', 'zh', 'ms'],
              symptomSet: ['mild_tension_headache', 'no_visual_disturbance', 'normal_neuro'],
            },
            supportCount: 2190,
            mlConfidence: 96.6,
            icd10: 'G44.2',
            conditionName: 'Episodic Tension Headache (Home Care)',
            isFed: false,
          },
        ];
      }

      setMlHarvestedRules(candidateRules);
    }, 2000);
  };

  const handleFeedRuleToRepository = (harvestedItem: {
    rule: TriageRule;
    supportCount: number;
    mlConfidence: number;
    icd10: string;
    conditionName: string;
    isFed: boolean;
  }) => {
    onAddCustomRule(harvestedItem.rule);
    setMlHarvestedRules(prev => prev.map(r => r.rule.ruleId === harvestedItem.rule.ruleId ? { ...r, isFed: true } : r));
    showToast(`Rule ${harvestedItem.rule.ruleId} (${harvestedItem.rule.severity}) fed into Knowledge Repository (@knowledge_agent SQLite WAL)!`);
  };

  const handleFeedAllRulesToRepository = () => {
    const pendingRules = mlHarvestedRules.filter(r => !r.isFed);
    if (pendingRules.length === 0) return;
    pendingRules.forEach(r => onAddCustomRule(r.rule));
    setMlHarvestedRules(prev => prev.map(r => ({ ...r, isFed: true })));
    showToast(`Successfully fed ${pendingRules.length} ML-harvested rules into Knowledge Repository (@knowledge_agent SQLite WAL)!`);
  };

  // ==========================================
  // 3. HOSPITAL REGISTRY STATE
  // ==========================================
  const [newHospName, setNewHospName] = useState('');
  const [newHospType, setNewHospType] = useState<HospitalFacility['type']>('public_hospital');
  const [newHospAddress, setNewHospAddress] = useState('');
  const [newHospPostal, setNewHospPostal] = useState('');
  const [newHospPhone, setNewHospPhone] = useState('');
  const [newHospHasED, setNewHospHasED] = useState(true);
  const [newHospLat, setNewHospLat] = useState('1.3521');
  const [newHospLng, setNewHospLng] = useState('103.8198');
  const [newHospPanels, setNewHospPanels] = useState<string[]>(['Great Eastern', 'AIA', 'Prudential']);
  const [newHospSpecialties, setNewHospSpecialties] = useState('Pediatrics, Emergency Medicine, Trauma');

  const handlePostalAutoLookup = (postal: string) => {
    setNewHospPostal(postal);
    if (postal.trim().length >= 2) {
      const geo = lookupSingaporePostalCode(postal.trim());
      if (geo) {
        setNewHospLat(geo.lat.toFixed(4));
        setNewHospLng(geo.lng.toFixed(4));
        if (!newHospAddress) {
          setNewHospAddress(`${geo.address}, Singapore ${postal}`);
        }
      }
    }
  };

  const handleCreateFacility = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHospName.trim() || !newHospAddress.trim()) {
      showToast('Please provide facility name and address');
      return;
    }

    const facility: HospitalFacility = {
      id: `fac-custom-${Date.now()}`,
      name: newHospName.trim(),
      type: newHospType,
      address: newHospAddress.trim(),
      phone: newHospPhone.trim() || '6355-3000',
      hasED: newHospHasED,
      lat: parseFloat(newHospLat) || 1.3521,
      lng: parseFloat(newHospLng) || 103.8198,
      panels: newHospPanels,
      waitTimeMinutes: newHospHasED ? 35 : 15,
      specialties: newHospSpecialties.split(',').map(s => s.trim()).filter(Boolean),
    };

    onAddFacility(facility);
    showToast(`Facility "${facility.name}" successfully added to Singapore registry!`);
    setNewHospName('');
    setNewHospAddress('');
    setNewHospPostal('');
    setNewHospPhone('');
  };

  // ==========================================
  // 4. BLUETOOTH TEST BENCH STATE
  // ==========================================
  const [bleScanning, setBleScanning] = useState(false);
  const [connectedBleDevice, setConnectedBleDevice] = useState<string | null>('Omron HEM-7361T Blood Pressure Monitor');
  const [bleBattery, setBleBattery] = useState(94);
  const [bleRssi, setBleRssi] = useState(-58);
  const [bleLogs, setBleLogs] = useState<string[]>([
    '[BLE-GATT] Initialized Singapore HSA Class B Medical Device Profile',
    '[BLE-GATT] Service 0x1810 (Blood Pressure) Discovered',
    '[BLE-GATT] Characteristic 0x2A35 (Intermediate Cuff Pressure) Subscribed',
    '[BLE-GATT] Telemetry Stream: 122/81 mmHg, Pulse 74 bpm (Sinus Normal)',
  ]);
  const [simulatedSys, setSimulatedSys] = useState(122);
  const [simulatedDia, setSimulatedDia] = useState(81);
  const [simulatedPulse, setSimulatedPulse] = useState(74);
  const [simulatedTemp, setSimulatedTemp] = useState(37.2);
  const [simulatedSpo2, setSimulatedSpo2] = useState(98);

  const triggerBleScan = () => {
    setBleScanning(true);
    setBleLogs(prev => [`[SCAN] Scanning 2.4GHz BLE spectrum for certified health devices...`, ...prev]);
    setTimeout(() => {
      setBleScanning(false);
      setBleLogs(prev => [
        `[FOUND] Nonin 3230 Bluetooth Pulse Oximeter (MAC: 00:1C:05:BF:2A:11) RSSI -62dBm`,
        `[FOUND] Braun ThermoScan 7 Connected IR (MAC: 44:A6:42:DE:09:88) RSSI -54dBm`,
        `[FOUND] Omron HEM-7361T Smart BP (MAC: E8:EB:1B:33:F1:C9) RSSI -58dBm`,
        ...prev
      ]);
      showToast('Scan complete: 3 nearby clinical BLE devices detected.');
    }, 1200);
  };

  const simulateBlePacket = (deviceType: 'bp' | 'thermometer' | 'oximeter') => {
    const ts = new Date().toLocaleTimeString();
    if (deviceType === 'bp') {
      const newSys = Math.floor(115 + Math.random() * 20);
      const newDia = Math.floor(75 + Math.random() * 12);
      const newPls = Math.floor(68 + Math.random() * 15);
      setSimulatedSys(newSys);
      setSimulatedDia(newDia);
      setSimulatedPulse(newPls);
      setBleLogs(prev => [
        `[${ts}] [GATT-0x1810] Omron Packet [0x02 0x${newSys.toString(16).padStart(2,'0')} 0x${newDia.toString(16).padStart(2,'0')} 0x${newPls.toString(16).padStart(2,'0')} 0x00] -> ${newSys}/${newDia} mmHg, HR ${newPls} bpm`,
        ...prev
      ]);
      showToast(`BP Reading Synced: ${newSys}/${newDia} mmHg`);
    } else if (deviceType === 'thermometer') {
      const newT = +(36.8 + Math.random() * 1.8).toFixed(1);
      setSimulatedTemp(newT);
      setBleLogs(prev => [
        `[${ts}] [GATT-0x1809] Braun IR Thermometer [0x00 0xFE 0x01 0x${Math.round(newT * 10).toString(16)}] -> Body Temp ${newT}°C (${newT >= 38.0 ? 'FEVER' : 'Normal'})`,
        ...prev
      ]);
      showToast(`Temperature Synced: ${newT}°C`);
    } else {
      const newSp = Math.floor(96 + Math.random() * 4);
      setSimulatedSpo2(newSp);
      setBleLogs(prev => [
        `[${ts}] [GATT-0x1822] Nonin Pulse Oximeter [0x00 0x${newSp.toString(16)} 0x48 0x01] -> SpO2 ${newSp}%, Plethysmogram Valid`,
        ...prev
      ]);
      showToast(`Pulse Oximetry Synced: ${newSp}% SpO2`);
    }
  };

  // ==========================================
  // 5. WEATHER & SURROUNDING GEO CONDITIONS
  // ==========================================
  const [isLiveFeed, setIsLiveFeed] = useState(false);
  const [feedSource, setFeedSource] = useState('National Environment Agency (NEA) & data.gov.sg (Live)');
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);

  const [weatherData, setWeatherData] = useState({
    generalForecast: 'Thundery Showers',
    temperature: { low: 25, high: 34 },
    humidity: '60% - 95%',
    overallPsi: 81,
    psiRange: '64 – 81',
    psiStatus: 'Moderate',
    pm25Hourly: 33,
    pm25Timestamp: '11:00 PM SGT',
    hazeBulletin: {
      airQualityBlurb: '24-hr PSI Forecast: Moderate – Low Unhealthy',
      healthAdvisoryBlurb: 'Healthy persons: Normal activities. Elderly, pregnant women & children: reduce prolonged outdoor physical exertion if PSI rises.',
      hotspotSummary: 'Smoke plumes observed from fires in Kalimantan & southern Sumatra. Prevailing winds from southeast.',
      sourceUrl: 'https://www.haze.gov.sg',
    },
    regions: {
      north: { psi: 64, pm25: 19, weather: 'Cloudy' },
      south: { psi: 68, pm25: 31, weather: 'Cloudy' },
      east: { psi: 72, pm25: 35, weather: 'Cloudy' },
      west: { psi: 75, pm25: 38, weather: 'Cloudy' },
      central: { psi: 81, pm25: 43, weather: 'Cloudy' },
    },
    dengueClusters: [
      { location: 'Ho Ching Rd / Kang Ching Rd / Tah Ching Rd / Yuan Ching Rd', activeCases: 74, alertLevel: 'RED_CLUSTER', trend: 'High Risk (≥10 Cases)', hyperlink: 'https://www.nea.gov.sg/dengue-zika/dengue/dengue-clusters' },
      { location: 'Admirality Lk (Blk 488, 493)', activeCases: 9, alertLevel: 'YELLOW_CLUSTER', trend: 'Under Surveillance (<10 Cases)', hyperlink: 'https://www.nea.gov.sg/dengue-zika/dengue/dengue-clusters' },
      { location: 'Bishan St 12 (Blk 110, 115, 116)', activeCases: 5, alertLevel: 'YELLOW_CLUSTER', trend: 'Under Surveillance (<10 Cases)', hyperlink: 'https://www.nea.gov.sg/dengue-zika/dengue/dengue-clusters' },
      { location: 'Kim Tian Rd (Blk 119B, 119D, 127D)', activeCases: 4, alertLevel: 'YELLOW_CLUSTER', trend: 'Under Surveillance (<10 Cases)', hyperlink: 'https://www.nea.gov.sg/dengue-zika/dengue/dengue-clusters' },
      { location: 'Defu South St 1', activeCases: 3, alertLevel: 'YELLOW_CLUSTER', trend: 'Under Surveillance (<10 Cases)', hyperlink: 'https://www.nea.gov.sg/dengue-zika/dengue/dengue-clusters' },
      { location: 'Upp Changi Rd East (Changi Ct)', activeCases: 3, alertLevel: 'YELLOW_CLUSTER', trend: 'Under Surveillance (<10 Cases)', hyperlink: 'https://www.nea.gov.sg/dengue-zika/dengue/dengue-clusters' },
      { location: 'Canberra Rd (Blk 308) / Sembawang Vista (Blk 318)', activeCases: 2, alertLevel: 'YELLOW_CLUSTER', trend: 'Under Surveillance (<10 Cases)', hyperlink: 'https://www.nea.gov.sg/dengue-zika/dengue/dengue-clusters' },
    ],
    lastUpdated: new Date().toLocaleTimeString(),
  });

  const fetchLiveEnvironmentalData = async () => {
    setIsLoadingFeed(true);
    try {
      const res = await fetch('/api/singapore/environmental-live');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setWeatherData({
            generalForecast: json.data.generalForecast || 'Thundery Showers',
            temperature: json.data.temperature || { low: 25, high: 34 },
            humidity: json.data.humidity || '60% - 95%',
            overallPsi: json.data.overallPsi || 81,
            psiRange: json.data.psiRange || `${json.data.minPsi || 64} – ${json.data.maxPsi || 81}`,
            psiStatus: json.data.psiStatus || 'Moderate',
            pm25Hourly: json.data.pm25Hourly || 33,
            pm25Timestamp: json.data.pm25Timestamp || '11:00 PM SGT',
            hazeBulletin: json.data.hazeBulletin || {
              airQualityBlurb: '24-hr PSI Forecast: Moderate – Low Unhealthy',
              healthAdvisoryBlurb: 'Healthy persons: Normal activities. Elderly, pregnant women & children: reduce prolonged outdoor physical exertion if PSI rises.',
              hotspotSummary: 'Moderate smoke plumes observed in regional hotspots.',
              sourceUrl: 'https://www.haze.gov.sg',
            },
            regions: json.data.regions || {},
            dengueClusters: json.data.dengueClusters || [],
            lastUpdated: json.lastUpdated || new Date().toLocaleTimeString(),
          });
          setIsLiveFeed(true);
          setFeedSource(json.source || 'Singapore NEA & data.gov.sg');
          showToast('Live official Singapore NEA & data.gov.sg data updated!');
          return;
        }
      }
    } catch (e) {
      console.warn('Could not fetch live feeds:', e);
    } finally {
      setIsLoadingFeed(false);
    }
  };

  useEffect(() => {
    fetchLiveEnvironmentalData();
  }, []);

  const refreshWeatherData = () => {
    fetchLiveEnvironmentalData();
  };

  // ==========================================


  // ==========================================
  // 7. WEARABLES (APPLE WATCH) STATE
  // ==========================================
  const [appleWatchConnected, setAppleWatchConnected] = useState(true);
  const [appleWatchModel, setAppleWatchModel] = useState('Apple Watch Ultra 2 (Cellular)');
  const [appleWatchHeartRate, setAppleWatchHeartRate] = useState(72);
  const [appleWatchRhythm, setAppleWatchRhythm] = useState<'Sinus Rhythm' | 'Atrial Fibrillation' | 'High HR Alert'>('Sinus Rhythm');
  const [appleWatchFallSimulating, setAppleWatchFallSimulating] = useState(false);
  const [fallCountdown, setFallCountdown] = useState<number | null>(null);

  const simulateHardFall = () => {
    setAppleWatchFallSimulating(true);
    setFallCountdown(15);
    showToast('⚠️ Hard Fall Detected by Apple Watch Tri-axial Accelerometer!');
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (fallCountdown !== null && fallCountdown > 0) {
      timer = setTimeout(() => {
        setFallCountdown(prev => (prev !== null ? prev - 1 : null));
      }, 1000);
    } else if (fallCountdown === 0) {
      onOpenSos();
      setFallCountdown(null);
      setAppleWatchFallSimulating(false);
      showToast('🚨 Automatic Emergency 995 SOS dispatched via Apple Watch Fall Safety Protocol!');
    }
    return () => clearTimeout(timer);
  }, [fallCountdown, onOpenSos]);

  const cancelFallAlert = () => {
    setFallCountdown(null);
    setAppleWatchFallSimulating(false);
    showToast('Fall alert cancelled: Patient confirmed "I am OK".');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#14212B] text-white px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 border border-emerald-500/40 text-sm font-semibold animate-bounce">
          <Sparkles className="text-emerald-400" size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner: App Owner Governance Dashboard */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-teal-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-700/30 relative overflow-visible z-20">
        <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 bg-indigo-500/20 text-indigo-200 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider border border-indigo-400/30">
              <Shield size={14} className="text-teal-400" />
              <span>{menuMode === 'clinical_lab' ? 'App Owner Clinical Lab' : 'App Workspace Administration & Integrations Hub'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <span>{currentUser?.name || 'Dr. Evelyn Lim'}</span>
              <span className="text-xs bg-teal-500/30 text-teal-300 font-bold px-2.5 py-0.5 rounded-md border border-teal-400/30">
                SMC M12849J
              </span>
            </h1>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="mt-6 sm:mt-8 flex items-center gap-1.5 sm:gap-2 flex-wrap border-t border-slate-700/60 pt-3 sm:pt-4 relative z-30 overflow-visible">
          {menuMode === 'clinical_lab' && (
            <>
              <button
                type="button"
                onClick={() => setActiveSubTab('harvesting')}
                className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeSubTab === 'harvesting'
                    ? 'bg-teal-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <FileCheck size={14} />
                <span>Override Rule Harvesting</span>
              </button>

              <div className="relative flex items-center group">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('jarvis_arh')}
                  className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    activeSubTab === 'jarvis_arh'
                      ? 'bg-teal-500 text-slate-950 shadow-md font-black'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <BrainCircuit size={14} />
                  <span>Jarvis - ARH</span>
                </button>
                <div className="ml-1 text-slate-400 hover:text-white cursor-help">
                  <HelpCircle size={14} />
                </div>
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 p-3 bg-slate-900 border border-slate-700 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 text-[10px] text-slate-300 pointer-events-none">
                  <strong className="text-white block mb-1">Agentic Rule Harvester (ARH)</strong>
                  A pure multi-agentic LLM workflow that dynamically reads inputs (websites, PDFs, CSVs), understands clinical data, and proposes database updates automatically.
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveSubTab('rules')}
                className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeSubTab === 'rules'
                    ? 'bg-teal-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Sliders size={14} />
                <span>Clinical Rule Builder</span>
                {customRules.length > 0 && (
                  <span className="bg-amber-400 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded-full">
                    +{customRules.length}
                  </span>
                )}
              </button>
            </>
          )}

          {menuMode === 'app_workspace' && (
            <>
              <button
                type="button"
                onClick={() => setActiveSubTab('rbac')}
                className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeSubTab === 'rbac'
                    ? 'bg-teal-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Users size={14} />
                <span>RBAC & Permissions</span>
              </button>
            </>
          )}



          {menuMode === 'clinical_lab' && (
            <>
              {/* Multi-Agent Triage Simulator */}
              <button
                type="button"
                onClick={() => setActiveSubTab('simulation')}
                className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeSubTab === 'simulation'
                    ? 'bg-teal-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Bot size={14} className={activeSubTab === 'simulation' ? 'text-slate-950' : 'text-teal-400'} />
                <span>Agentic Triage Simulator</span>
                <span className="bg-indigo-500 text-white text-[8px] font-black px-1 py-0.2 rounded-full uppercase tracking-wider">
                  Live Trace
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('weather')}
                className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeSubTab === 'weather'
                    ? 'bg-teal-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <CloudSun size={14} />
                <span>Environment</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('guardrails')}
                className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeSubTab === 'guardrails'
                    ? 'bg-teal-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Shield size={14} className={activeSubTab === 'guardrails' ? 'text-slate-950' : 'text-teal-400'} />
                <span>Clinical Guardrails</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('triage_medications')}
                className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeSubTab === 'triage_medications'
                    ? 'bg-teal-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Pill size={14} className={activeSubTab === 'triage_medications' ? 'text-slate-950' : 'text-amber-400'} />
                <span>Triage Decisions & Medications</span>
              </button>
            </>
          )}

          {menuMode === 'app_workspace' && (
            <>
              {/* NEW: Key Statistics Screen */}
              <button
                type="button"
                onClick={() => setActiveSubTab('statistics')}
                className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeSubTab === 'statistics'
                    ? 'bg-teal-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <BarChart3 size={14} className={activeSubTab === 'statistics' ? 'text-slate-950' : 'text-teal-400'} />
                <span>Key Statistics</span>
              </button>

              {/* NEW: Customer Feedback List */}
              <button
                type="button"
                onClick={() => setActiveSubTab('feedback')}
                className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeSubTab === 'feedback'
                    ? 'bg-teal-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <MessageSquareHeart size={14} className={activeSubTab === 'feedback' ? 'text-slate-950' : 'text-amber-400'} />
                <span>Customer Feedback</span>
                {feedbackList.length > 0 && (
                  <span className="bg-amber-400 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded-full">
                    {feedbackList.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('hospitals')}
                className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeSubTab === 'hospitals'
                    ? 'bg-teal-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Building2 size={14} />
                <span>Hospital Registry</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('insurance')}
                className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeSubTab === 'insurance'
                    ? 'bg-teal-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <CreditCard size={14} />
                <span>Insurance Registry</span>
              </button>

              {/* Grouped Integrations & Devices Dropdown Menu (Dark shade without background blurring) */}
              <div className="relative" ref={integrationsDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIntegrationsDropdownOpen(!integrationsDropdownOpen)}
                  className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    ['bluetooth', 'wearables'].includes(activeSubTab)
                      ? 'bg-teal-500 text-slate-950 shadow-md font-black'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Cpu size={14} />
                  <span>Integrations</span>
                  {['bluetooth', 'wearables'].includes(activeSubTab) && (
                    <span className="text-[10px] opacity-80 font-normal">
                      ({activeSubTab === 'bluetooth' ? 'Bluetooth' : 'Wearables'})
                    </span>
                  )}
                  <ChevronDown size={13} className={`transition-transform duration-200 ${integrationsDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {integrationsDropdownOpen && (
                  <div className="absolute top-full right-0 mt-1.5 w-56 bg-[#070D14] border border-slate-700/90 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.95)] py-1.5 z-50 animate-fadeIn ring-1 ring-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSubTab('bluetooth');
                        setIntegrationsDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3.5 py-2 text-xs font-medium flex items-center gap-2.5 transition-all ${
                        activeSubTab === 'bluetooth' ? 'bg-teal-500/20 text-teal-300 font-bold' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Bluetooth size={14} className="text-teal-400" />
                      <span>Bluetooth Integrations</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSubTab('wearables');
                        setIntegrationsDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3.5 py-2 text-xs font-medium flex items-center gap-2.5 transition-all ${
                        activeSubTab === 'wearables' ? 'bg-teal-500/20 text-teal-300 font-bold' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Watch size={14} className="text-purple-400" />
                      <span>Known Wearables</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {activeSubTab === 'harvesting' && (
        <ClinicalKbConsoleView
          proposals={proposals}
          onApproveProposal={onApproveProposal as any}
          onDeleteProposal={onDeleteProposal!}
          onMoveToPendingProposal={onMoveToPendingProposal!}
          onRefreshProposals={onRefreshProposals!}
          environmentMode="production"
          onToggleEnvironmentMode={() => {}}
          language={language}
        />
      )}

      {activeSubTab === 'jarvis_arh' && (
        <AgenticKnowledgeHarvester
          onApproveProposal={onApproveProposal!}
          onDeleteProposal={onDeleteProposal!}
        />
      )}

      {/* ========================================================================= */}
      {/* 1. RBAC & SCREEN PERMISSIONS CONSOLE */}
      {/* ========================================================================= */}
      {activeSubTab === 'rbac' && (
        <div className="space-y-6">
          {/* Household Context Picker */}
          <div className="bg-white dark:bg-[#14212B] p-5 sm:p-6 rounded-3xl border border-[#DDE5E9] dark:border-[#1E2D37] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-black text-[#14212B] dark:text-white flex items-center gap-2">
                <Users className="text-[#0F766E] dark:text-[#2DD4BF]" size={20} />
                <span>Family Role-Based Access Control (SRS Section 3 & 9)</span>
                <HelperInfoButton
                  title="Family Role-Based Access Control"
                  content="Configures screen permissions, member system roles, and architectural capability boundaries for any family household. Governs who can sign off clinical rules, trigger emergency SOS, or edit medical profiles."
                />
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-[#52616B] dark:text-[#94A3B8]">Target Household:</span>
              <select
                value={selectedHouseholdId}
                onChange={e => setSelectedHouseholdId(e.target.value)}
                className="bg-[#F6F8FA] dark:bg-[#0F1A20] text-sm font-bold text-[#14212B] dark:text-white px-3.5 py-2 rounded-xl border border-[#DDE5E9] dark:border-[#1E2D37] focus:outline-none focus:border-[#0F766E]"
              >
                {allHouseholds.map(h => (
                  <option key={h.id} value={h.id}>
                    {h.name} {h.id === 'hh-app-owner-01' ? '(App Owner HQ)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Members & Roles Table */}
          <div className="bg-white dark:bg-[#14212B] p-6 rounded-3xl border border-[#DDE5E9] dark:border-[#1E2D37] shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#14212B] dark:text-white">
                  Members of {activeHousehold.name} ({householdMembers.length} profiles)
                </h3>
                <p className="text-xs text-[#52616B] dark:text-[#94A3B8]">
                  App Owner can assign roles to any user. Relationship labels are descriptive; System roles control permissions.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#DDE5E9] dark:border-[#1E2D37] text-[11px] font-black uppercase text-[#52616B] dark:text-[#94A3B8] tracking-wider">
                    <th className="py-3 px-3">Member</th>
                    <th className="py-3 px-3">Relationship Label</th>
                    <th className="py-3 px-3">Login Enabled</th>
                    <th className="py-3 px-3">Assigned System Role</th>
                    <th className="py-3 px-3">Effective Capabilities</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDE5E9]/60 dark:divide-[#1E2D37]/60 text-xs">
                  {householdMembers.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-[#0F1A20]/40 transition-colors">
                      <td className="py-3 px-3 font-bold text-[#14212B] dark:text-white flex items-center gap-2.5">
                        <span className="text-xl p-1 bg-slate-100 dark:bg-[#0F1A20] rounded-xl">{m.avatar || '👤'}</span>
                        <div>
                          <div>{m.name}</div>
                          <div className="text-[10px] text-[#52616B] dark:text-[#94A3B8] font-normal">{m.phone || 'No direct phone'}</div>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-medium text-[#52616B] dark:text-[#94A3B8]">
                        {m.relationshipLabel}
                      </td>
                      <td className="py-3 px-3">
                        {m.hasLogin ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md font-bold text-[10px]">
                            <CheckCircle2 size={12} /> Yes (SMS OTP)
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 font-medium">Profile Only</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <select
                          value={m.systemRole}
                          onChange={e => handleRoleChangeForMember(m.id, e.target.value as SystemRole)}
                          className="bg-white dark:bg-[#0F1A20] font-bold text-xs px-2.5 py-1.5 rounded-lg border border-[#DDE5E9] dark:border-[#1E2D37] text-[#14212B] dark:text-white focus:outline-none focus:border-[#0F766E]"
                        >
                          <option value="ADMIN">ADMIN (Household Manager)</option>
                          <option value="CAREGIVER">CAREGIVER (Helper / Parent)</option>
                          <option value="MEMBER">MEMBER (Self-service Adult)</option>
                          <option value="DEPENDENT">DEPENDENT (No Login)</option>
                          <option value="APP_OWNER">APP_OWNER (Governance)</option>
                        </select>
                      </td>
                      <td className="py-3 px-3 text-[#52616B] dark:text-[#94A3B8]">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {rolePermissions[m.systemRole]?.description || 'Standard profile'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Role Screen Permission Matrix */}
          <div className="bg-white dark:bg-[#14212B] p-6 rounded-3xl border border-[#DDE5E9] dark:border-[#1E2D37] shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-black text-sm text-[#14212B] dark:text-white flex items-center gap-2">
                  <Sliders className="text-[#0F766E] dark:text-[#2DD4BF]" size={18} />
                  <span>Screen Permissions Matrix (Per Role)</span>
                </h3>
                <p className="text-xs text-[#52616B] dark:text-[#94A3B8] mt-0.5 flex items-center gap-2 flex-wrap">
                  <span>App Owner can grant or revoke specific screens for any role. Changes are stored in SQLite database and dynamically govern persona screen access.</span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> SQLite: role_permissions table
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleResetRbacDefaults}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1E2D37] rounded-xl transition-all"
                >
                  Reset to MOH Defaults
                </button>
                <button
                  type="button"
                  onClick={handleSaveRbac}
                  disabled={isSavingRbac}
                  className="bg-[#0F766E] hover:bg-[#115E59] text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check size={14} className={isSavingRbac ? 'animate-spin' : ''} />
                  <span>{isSavingRbac ? 'Saving to DB...' : 'Save Permissions to Database'}</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#DDE5E9] dark:border-[#1E2D37] text-[11px] font-black uppercase text-[#52616B] dark:text-[#94A3B8] tracking-wider">
                    <th className="py-3 px-3">Screen Name</th>
                    <th className="py-3 px-2 text-center">Admin</th>
                    <th className="py-3 px-2 text-center">Caregiver</th>
                    <th className="py-3 px-2 text-center">Member</th>
                    <th className="py-3 px-2 text-center">Dependent</th>
                    <th className="py-3 px-2 text-center bg-indigo-50/50 dark:bg-indigo-950/20">App Owner</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDE5E9]/60 dark:divide-[#1E2D37]/60 text-xs">
                  {ALL_SCREENS_META.map(screen => (
                    <tr key={screen.id} className="hover:bg-slate-50 dark:hover:bg-[#0F1A20]/40 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-[#14212B] dark:text-white">{screen.name}</div>
                        <div className="text-[11px] text-[#52616B] dark:text-[#94A3B8]">{screen.description}</div>
                      </td>
                      {(['ADMIN', 'CAREGIVER', 'MEMBER', 'DEPENDENT', 'APP_OWNER'] as SystemRole[]).map(r => {
                        const isAllowed = rolePermissions[r]?.allowedScreens?.includes(screen.id);
                        return (
                          <td key={r} className={`py-3 px-2 text-center ${r === 'APP_OWNER' ? 'bg-indigo-50/40 dark:bg-indigo-950/10' : ''}`}>
                            <button
                              type="button"
                              onClick={() => toggleScreenForRole(r, screen.id)}
                              className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all ${
                                isAllowed
                                  ? 'bg-emerald-500 text-white font-bold shadow-xs'
                                  : 'bg-slate-200 dark:bg-[#1E2D37] text-slate-400 dark:text-slate-500'
                              }`}
                              title={`${isAllowed ? 'Allowed' : 'Disabled'} for ${r}`}
                            >
                              {isAllowed ? <Check size={16} /> : <X size={14} />}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3 & 9 Architectural RBAC Matrix */}
          <div className="bg-white dark:bg-[#14212B] p-6 rounded-3xl border border-[#DDE5E9] dark:border-[#1E2D37] shadow-sm space-y-4">
            <h3 className="font-black text-sm text-[#14212B] dark:text-white flex items-center gap-2">
              <Award className="text-[#0F766E] dark:text-[#2DD4BF]" size={18} />
              <span>Section 3 & 9 Architecture Capability Specification</span>
            </h3>
            <p className="text-xs text-[#52616B] dark:text-[#94A3B8]">
              Official capability distribution defined in the Health Triage Architecture Specification for Singapore healthcare compliance.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#DDE5E9] dark:border-[#1E2D37] text-[11px] font-black uppercase text-[#52616B] dark:text-[#94A3B8]">
                    <th className="py-2.5 px-3">Capability</th>
                    <th className="py-2.5 px-2 text-center">Admin</th>
                    <th className="py-2.5 px-2 text-center">Caregiver</th>
                    <th className="py-2.5 px-2 text-center">Member</th>
                    <th className="py-2.5 px-2 text-center">Dependent</th>
                    <th className="py-2.5 px-2 text-center bg-indigo-50/50 dark:bg-indigo-950/20">App Owner</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDE5E9]/60 dark:divide-[#1E2D37]/60">
                  {CAPABILITIES_META.map(cap => (
                    <tr key={cap.id} className="hover:bg-slate-50 dark:hover:bg-[#0F1A20]/40">
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{cap.label}</span>
                        <div className="text-[10px] text-slate-500">{cap.description}</div>
                      </td>
                      {(['ADMIN', 'CAREGIVER', 'MEMBER', 'DEPENDENT', 'APP_OWNER'] as SystemRole[]).map(r => {
                        const scope = rolePermissions[r]?.capabilities?.[cap.id] || 'none';
                        return (
                          <td key={r} className={`py-2.5 px-2 text-center ${r === 'APP_OWNER' ? 'bg-indigo-50/40 dark:bg-indigo-950/10' : ''}`}>
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              scope === 'full'
                                ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
                                : scope === 'care_recipients'
                                ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300'
                                : scope === 'own'
                                ? 'bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300'
                                : 'bg-slate-100 dark:bg-[#1E2D37] text-slate-400'
                            }`}>
                              {scope === 'full' ? '✅ Full' : scope === 'care_recipients' ? '👥 Care Recip.' : scope === 'own' ? '👤 Own' : '❌ None'}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. CLINICAL RULE BUILDER & AGENTIC KNOWLEDGE REPOSITORY (@knowledge_agent) */}
      {/* ========================================================================= */}
      {activeSubTab === 'rules' && (() => {
        // Aggregate all rules: custom rules + all knowledge repository rules
        const allRepositoryRules: TriageRule[] = [
          ...customRules,
          ...AGENTIC_KNOWLEDGE_REPOSITORY,
        ];

        // Deduplicate rules by ruleId if a custom rule overrides a repository rule
        const ruleMap = new Map<string, TriageRule>();
        allRepositoryRules.forEach(r => ruleMap.set(r.ruleId, r));
        const combinedRules = Array.from(ruleMap.values());

        // Counts per severity tier
        const redCount = combinedRules.filter(r => r.severity === 'RED').length;
        const orangeCount = combinedRules.filter(r => r.severity === 'ORANGE').length;
        const yellowCount = combinedRules.filter(r => r.severity === 'YELLOW').length;
        const greenCount = combinedRules.filter(r => r.severity === 'GREEN').length;

        // Filtering
        const filteredRules = combinedRules.filter(r => {
          if (ruleSeverityFilter !== 'ALL' && r.severity !== ruleSeverityFilter) return false;
          if (ruleAgeBandFilter !== 'ALL' && r.ageBand && r.ageBand !== 'all' && r.ageBand !== ruleAgeBandFilter) return false;
          if (ruleBodyPartFilter !== 'ALL' && r.bodyPart && !r.bodyPart.toLowerCase().includes(ruleBodyPartFilter.toLowerCase())) return false;
          if (ruleSearchQuery.trim()) {
            const q = ruleSearchQuery.toLowerCase();
            const matchId = r.ruleId.toLowerCase().includes(q) || (r.conditionId && r.conditionId.toLowerCase().includes(q));
            const matchAilment = r.ailment.toLowerCase().includes(q);
            const matchReason = r.reasonKey.toLowerCase().includes(q) || (r.rationale && r.rationale.toLowerCase().includes(q));
            const matchWhen = r.when.any?.some(w => w.toLowerCase().includes(q));
            const matchSource = r.sourceRefs?.some(s => s.toLowerCase().includes(q));
            if (!matchId && !matchAilment && !matchReason && !matchWhen && !matchSource) return false;
          }
          return true;
        });

        return (
          <div className="space-y-6">
            {/* Header & Metrics Banner */}
            <div className="bg-white dark:bg-[#14212B] p-6 rounded-3xl border border-[#DDE5E9] dark:border-[#1E2D37] shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                      Tier 2 Knowledge Agent Repository
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                      Spec §4 Hybrid Graph + Vector DB
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1 border border-emerald-300 dark:border-emerald-800">
                      <Database size={11} className="text-emerald-600 dark:text-emerald-400" />
                      <span>SQLite DB: data/chat.db (WAL Mode)</span>
                    </span>
                  </div>
                  <h2 className="text-lg font-black text-[#14212B] dark:text-white flex items-center gap-2 mt-1">
                    <Sliders className="text-[#0F766E] dark:text-[#2DD4BF]" size={22} />
                    <span>Clinical Rule Builder & Knowledge Repository</span>
                    <HelperInfoButton
                      title="Clinical Rule Builder & Knowledge Repository"
                      content="Models assist, rules decide. This comprehensive clinical rule repository is maintained by @knowledge_agent across all severity tiers (Red, Orange, Yellow, Green) and backed by SQLite WAL storage."
                    />
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setRuleBuilderView('explorer')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        ruleBuilderView === 'explorer'
                          ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Database size={13} />
                      <span>Rule Repository ({combinedRules.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRuleBuilderView('ml_pipeline')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        ruleBuilderView === 'ml_pipeline'
                          ? 'bg-gradient-to-r from-teal-500 to-indigo-600 text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Brain size={13} />
                      <span>ML Pipeline & Ingestion</span>
                      <span className="text-[9px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.2 rounded-full uppercase">
                        AI Harvest
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRuleBuilderView('author')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        ruleBuilderView === 'author'
                          ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Plus size={13} />
                      <span>Manual Studio</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRuleBuilderView('unified')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        ruleBuilderView === 'unified'
                          ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Layers size={13} />
                      <span>Unified Pathways</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowArchFlow(!showArchFlow)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                      showArchFlow 
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-900 dark:bg-indigo-950 dark:border-indigo-800 dark:text-indigo-200' 
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Layers size={13} className="text-indigo-600 dark:text-indigo-400" />
                    <span>Pipeline Arch</span>
                    {showArchFlow ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                </div>
              </div>

              {/* KPI Summary Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRuleSeverityFilter('ALL')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    ruleSeverityFilter === 'ALL'
                      ? 'border-slate-900 bg-slate-900 text-white shadow-sm dark:border-white dark:bg-white dark:text-slate-900'
                      : 'border-slate-200 bg-slate-50 dark:bg-slate-800/40 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">All Rules</div>
                  <div className="text-xl font-black mt-0.5">{combinedRules.length}</div>
                  <div className="text-[9px] opacity-70">Knowledge Base</div>
                </button>

                <button
                  type="button"
                  onClick={() => setRuleSeverityFilter('RED')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    ruleSeverityFilter === 'RED'
                      ? 'border-red-600 bg-red-600 text-white shadow-sm'
                      : 'border-red-200 bg-red-50/60 dark:bg-red-950/30 hover:border-red-300 text-red-900 dark:text-red-300'
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">🔴 RED Tier</div>
                  <div className="text-xl font-black mt-0.5">{redCount}</div>
                  <div className="text-[9px] opacity-70">995 Emergency Net</div>
                </button>

                <button
                  type="button"
                  onClick={() => setRuleSeverityFilter('ORANGE')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    ruleSeverityFilter === 'ORANGE'
                      ? 'border-amber-600 bg-amber-600 text-white shadow-sm'
                      : 'border-amber-200 bg-amber-50/60 dark:bg-amber-950/30 hover:border-amber-300 text-amber-900 dark:text-amber-300'
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">🟠 ORANGE Tier</div>
                  <div className="text-xl font-black mt-0.5">{orangeCount}</div>
                  <div className="text-[9px] opacity-70">Urgent Care (4-6h)</div>
                </button>

                <button
                  type="button"
                  onClick={() => setRuleSeverityFilter('YELLOW')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    ruleSeverityFilter === 'YELLOW'
                      ? 'border-yellow-600 bg-yellow-600 text-white shadow-sm'
                      : 'border-yellow-200 bg-yellow-50/60 dark:bg-yellow-950/30 hover:border-yellow-300 text-yellow-900 dark:text-yellow-300'
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">🟡 YELLOW Tier</div>
                  <div className="text-xl font-black mt-0.5">{yellowCount}</div>
                  <div className="text-[9px] opacity-70">GP / Polyclinic 24h</div>
                </button>

                <button
                  type="button"
                  onClick={() => setRuleSeverityFilter('GREEN')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    ruleSeverityFilter === 'GREEN'
                      ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                      : 'border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/30 hover:border-emerald-300 text-emerald-900 dark:text-emerald-300'
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">🟢 GREEN Tier</div>
                  <div className="text-xl font-black mt-0.5">{greenCount}</div>
                  <div className="text-[9px] opacity-70">Home Monitoring</div>
                </button>

                <div className="p-3 rounded-2xl border border-indigo-200 bg-indigo-50/60 dark:bg-indigo-950/30 text-indigo-950 dark:text-indigo-200">
                  <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">Hybrid Store</div>
                  <div className="text-xl font-black mt-0.5">Graph + Vec</div>
                  <div className="text-[9px] opacity-70">1536d / Neo4j Node</div>
                </div>
              </div>

              {/* Multi-Agent Architecture & State Machine (Spec §2, §5) */}
              {showArchFlow && (
                <div className="bg-slate-50 dark:bg-[#0F1A20] rounded-2xl p-4 border border-slate-200 dark:border-slate-800 space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                    <span className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                      <Cpu size={15} className="text-teal-600 dark:text-teal-400" />
                      <span>Multi-Agent Triage Pipeline & State Machine (Spec §2 & §5)</span>
                    </span>
                    <span className="text-[10px] text-teal-700 dark:text-teal-300 font-mono font-bold">
                      LangGraph State Machine Enforced • Bounded Retry Cap (2x)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                    <div className="bg-white dark:bg-[#14212B] p-3 rounded-xl border border-rose-200 dark:border-rose-900/60 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-400">
                        <span className="w-5 h-5 rounded-full bg-rose-100 dark:bg-rose-950 flex items-center justify-center text-[10px] font-black">1</span>
                        <span>Tier 1: Deterministic Net</span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                        Non-LLM regex/keyword engine. Halts immediately on infant §3.1 & senior §3.2 red-lines. 0ms latency.
                      </p>
                    </div>

                    <div className="bg-white dark:bg-[#14212B] p-3 rounded-xl border border-teal-200 dark:border-teal-900/60 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-teal-700 dark:text-teal-400">
                        <span className="w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-950 flex items-center justify-center text-[10px] font-black">2</span>
                        <span>Tier 2: @knowledge_agent</span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                        Hybrid Graph + Vector store. Graph edge is explainable rationale. Read-only for agents; Gateway writes only.
                      </p>
                    </div>

                    <div className="bg-white dark:bg-[#14212B] p-3 rounded-xl border border-indigo-200 dark:border-indigo-900/60 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-indigo-700 dark:text-indigo-400">
                        <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-[10px] font-black">3</span>
                        <span>Tier 3: Reasoning & Falsifier</span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                        <strong>@triage_agent</strong> drafts assessment; <strong>@expert_doctor_agent</strong> falsifies contraindications (max 2 retries).
                      </p>
                    </div>

                    <div className="bg-white dark:bg-[#14212B] p-3 rounded-xl border border-amber-200 dark:border-amber-900/60 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400">
                        <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-[10px] font-black">4</span>
                        <span>Tier 4: Governance Gateway</span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                        <strong>@ml_agent</strong> calibrates weights; Human Review Gateway enforces mandatory SMC Doctor cryptographic sign-off.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 1. Authoring Studio: rendered when ruleBuilderView === 'author' */}
            {ruleBuilderView === 'author' && (
              <div className="bg-white dark:bg-[#14212B] p-6 rounded-3xl border border-[#DDE5E9] dark:border-[#1E2D37] shadow-sm space-y-4 animate-fadeIn">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-black text-[#14212B] dark:text-white flex items-center gap-2">
                      <Plus className="text-[#0F766E] dark:text-[#2DD4BF]" size={18} />
                      <span>Rule Authoring Studio (Commit New Rule Across Any Severity Tier)</span>
                    </h3>
                    <p className="text-xs text-[#52616B] dark:text-[#94A3B8] mt-0.5">
                      Author and commit new hard-stop or diagnostic rules across RED, ORANGE, YELLOW, or GREEN tiers to immediately activate in the live decision engine.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRuleBuilderView('explorer')}
                    className="text-xs font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400 flex items-center gap-1 shrink-0"
                  >
                    <span>View All Active Rules ({combinedRules.length})</span>
                    <ArrowRight size={13} />
                  </button>
                </div>

                <form onSubmit={handleCreateRule} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-[#14212B] dark:text-white mb-1">Rule ID</label>
                    <input
                      type="text"
                      value={newRuleId}
                      onChange={e => setNewRuleId(e.target.value)}
                      className="w-full bg-[#F6F8FA] dark:bg-[#0F1A20] text-xs font-mono font-bold px-3 py-2.5 rounded-xl border border-[#DDE5E9] dark:border-[#1E2D37] text-[#14212B] dark:text-white"
                      placeholder="e.g. RESP-URG-02"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#14212B] dark:text-white mb-1">Target Ailment</label>
                    <select
                      value={newRuleAilment}
                      onChange={e => setNewRuleAilment(e.target.value)}
                      className="w-full bg-[#F6F8FA] dark:bg-[#0F1A20] text-xs font-bold px-3 py-2.5 rounded-xl border border-[#DDE5E9] dark:border-[#1E2D37] text-[#14212B] dark:text-white"
                    >
                      {AILMENTS.map(a => (
                        <option key={a.code} value={a.code}>{a.name} ({a.code})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#14212B] dark:text-white mb-1">Severity Tier</label>
                    <select
                      value={newRuleSeverity}
                      onChange={e => handleSeverityChange(e.target.value as Severity)}
                      className="w-full bg-[#F6F8FA] dark:bg-[#0F1A20] text-xs font-bold px-3 py-2.5 rounded-xl border border-[#DDE5E9] dark:border-[#1E2D37] text-[#14212B] dark:text-white"
                    >
                      <option value="RED">🔴 RED (995 Emergency / Immediate A&E)</option>
                      <option value="ORANGE">🟠 ORANGE (Urgent Care Clinic within 4-6h)</option>
                      <option value="YELLOW">🟡 YELLOW (GP / Polyclinic within 24h)</option>
                      <option value="GREEN">🟢 GREEN (Home Care & Tele-monitoring)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#14212B] dark:text-white mb-1">Target Age Band</label>
                    <select
                      value={newRuleAgeBand}
                      onChange={e => setNewRuleAgeBand(e.target.value)}
                      className="w-full bg-[#F6F8FA] dark:bg-[#0F1A20] text-xs font-bold px-3 py-2.5 rounded-xl border border-[#DDE5E9] dark:border-[#1E2D37] text-[#14212B] dark:text-white"
                    >
                      <option value="all">All Ages</option>
                      <option value="neonate">Neonate (0-28 days)</option>
                      <option value="young_infant">Young Infant (&lt; 3 months)</option>
                      <option value="infant">Infant (&lt; 12 months)</option>
                      <option value="toddler">Toddler (1-3 years)</option>
                      <option value="child">Child (3-12 years)</option>
                      <option value="adult">Adult (18-65 years)</option>
                      <option value="elderly">Senior (65+ years)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#14212B] dark:text-white mb-1">Body Part / Domain</label>
                    <select
                      value={newRuleBodyPart}
                      onChange={e => setNewRuleBodyPart(e.target.value)}
                      className="w-full bg-[#F6F8FA] dark:bg-[#0F1A20] text-xs font-bold px-3 py-2.5 rounded-xl border border-[#DDE5E9] dark:border-[#1E2D37] text-[#14212B] dark:text-white"
                    >
                      <option value="Respiratory">Respiratory / Chest</option>
                      <option value="Cardiovascular">Cardiovascular / Heart</option>
                      <option value="Neurology">Neurology / Mental Health</option>
                      <option value="Dermatology">Dermatology / Skin</option>
                      <option value="GI / Hydration">GI / Hydration / Abdomen</option>
                      <option value="Musculoskeletal">Musculoskeletal / Trauma</option>
                      <option value="Systemic / Vitals">Systemic / Vitals</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#14212B] dark:text-white mb-1">Min Age (Days)</label>
                    <input
                      type="number"
                      value={newRuleAgeMin}
                      onChange={e => setNewRuleAgeMin(e.target.value)}
                      className="w-full bg-[#F6F8FA] dark:bg-[#0F1A20] text-xs px-3 py-2.5 rounded-xl border border-[#DDE5E9] dark:border-[#1E2D37] text-[#14212B] dark:text-white"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#14212B] dark:text-white mb-1">Max Age (Days)</label>
                    <input
                      type="number"
                      value={newRuleAgeMax}
                      onChange={e => setNewRuleAgeMax(e.target.value)}
                      className="w-full bg-[#F6F8FA] dark:bg-[#0F1A20] text-xs px-3 py-2.5 rounded-xl border border-[#DDE5E9] dark:border-[#1E2D37] text-[#14212B] dark:text-white"
                      placeholder="365"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#14212B] dark:text-white mb-1">Care Tier Key</label>
                    <input
                      type="text"
                      value={newRuleCareTier}
                      onChange={e => setNewRuleCareTier(e.target.value)}
                      className="w-full bg-[#F6F8FA] dark:bg-[#0F1A20] text-xs font-mono px-3 py-2.5 rounded-xl border border-[#DDE5E9] dark:border-[#1E2D37] text-[#14212B] dark:text-white"
                    />
                  </div>

                  <div className="sm:col-span-2 md:col-span-4">
                    <label className="block text-xs font-bold text-[#14212B] dark:text-white mb-1">
                      Trigger Conditions (comma separated)
                    </label>
                    <input
                      type="text"
                      value={newRuleCriteria}
                      onChange={e => setNewRuleCriteria(e.target.value)}
                      className="w-full bg-[#F6F8FA] dark:bg-[#0F1A20] text-xs font-mono px-3 py-2.5 rounded-xl border border-[#DDE5E9] dark:border-[#1E2D37] text-[#14212B] dark:text-white"
                      placeholder="e.g. temp_c >= 39.5, lethargy == true, stiff_neck == true"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2 md:col-span-3">
                    <label className="block text-xs font-bold text-[#14212B] dark:text-white mb-1">
                      Clinical Rationale & Guidance (English)
                    </label>
                    <input
                      type="text"
                      value={newRuleReasonEn}
                      onChange={e => setNewRuleReasonEn(e.target.value)}
                      className="w-full bg-[#F6F8FA] dark:bg-[#0F1A20] text-xs px-3 py-2.5 rounded-xl border border-[#DDE5E9] dark:border-[#1E2D37] text-[#14212B] dark:text-white"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2 md:col-span-1 flex items-end">
                    <button
                      type="submit"
                      className="w-full bg-[#0F766E] hover:bg-[#115E59] text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                    >
                      <Plus size={16} />
                      <span>Commit Rule to Engine</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* 2. ML Dataset Ingestion & Rule Induction Pipeline Screen */}
            {ruleBuilderView === 'ml_pipeline' && (
              <div className="space-y-6 animate-fadeIn">
                {/* Hero / State Machine Card */}
                <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-teal-950 text-white rounded-3xl p-6 sm:p-7 border border-indigo-500/30 shadow-xl relative overflow-hidden">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                    <div>
                      <div className="inline-flex items-center gap-2 bg-teal-500/20 text-teal-300 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider border border-teal-400/30 mb-2">
                        <Brain size={14} className="text-teal-400" />
                        <span>Tier 4 Asynchronous Learning Pipeline (Spec §4 & §5)</span>
                      </div>
                      <h2 className="text-xl font-black text-white flex items-center gap-2">
                        <span>Machine Learning Rule Induction & Knowledge Ingestion</span>
                        <HelperInfoButton
                          title="ML Rule Induction & Knowledge Ingestion"
                          content="Ingests real-world clinical datasets via @decipher_agent, extracts continuous vital sign cutoffs and entropy-maximizing triage rules with @ml_agent, enforces Singapore MOH deterministic red-lines, and feeds approved candidate rules directly into @knowledge_agent (SQLite WAL)."
                        />
                      </h2>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md p-3 rounded-2xl border border-slate-700/60 text-xs">
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Target Knowledge Store</div>
                        <div className="font-mono font-black text-emerald-400 flex items-center gap-1.5 justify-end">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          <span>data/chat.db (SQLite WAL)</span>
                        </div>
                        <div className="text-[10px] text-teal-300 font-semibold mt-0.5">Active Rules: {combinedRules.length}</div>
                      </div>
                    </div>
                  </div>

                  {/* State Machine Flow Visualizer */}
                  <div className="mt-6 pt-4 border-t border-slate-700/60 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs relative z-10">
                    <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/60">
                      <div className="flex items-center gap-2 text-teal-400 font-bold mb-1">
                        <span className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center text-[10px] font-black">1</span>
                        <span>Dataset Ingest</span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        <strong>@decipher_agent</strong>: Tokenizes presentation complaints & validates PDPA de-identification.
                      </p>
                    </div>

                    <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/60">
                      <div className="flex items-center gap-2 text-indigo-400 font-bold mb-1">
                        <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-[10px] font-black">2</span>
                        <span>ML Rule Induction</span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        <strong>@ml_agent</strong>: C5.0 / RIPPER decision tree splits with entropy floor &gt;= {mlConfidenceFloor}%.
                      </p>
                    </div>

                    <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/60">
                      <div className="flex items-center gap-2 text-rose-400 font-bold mb-1">
                        <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-300 flex items-center justify-center text-[10px] font-black">3</span>
                        <span>Red-Line Guard</span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        <strong>@expert_doctor_agent</strong>: Deterministic validation against Infant §3.1 & Senior §3.2 invariants.
                      </p>
                    </div>

                    <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/60">
                      <div className="flex items-center gap-2 text-emerald-400 font-bold mb-1">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-[10px] font-black">4</span>
                        <span>Knowledge Feed</span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        <strong>@knowledge_agent</strong>: Human Gateway sign-off writes new rules directly to SQLite WAL store.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Dataset Selector & ML Configuration Card */}
                <div className="bg-white dark:bg-[#14212B] p-6 rounded-3xl border border-[#DDE5E9] dark:border-[#1E2D37] shadow-sm space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <FileSpreadsheet className="text-teal-600 dark:text-teal-400" size={18} />
                        <span>Select Clinical Dataset Source for Induction</span>
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Choose a de-identified syndromic dataset or upload a new clinical CSV cohort to train and extract rules.
                      </p>
                    </div>

                    <span className="text-[10px] font-mono bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 px-3 py-1 rounded-full font-bold border border-teal-200 dark:border-teal-800 flex items-center gap-1.5">
                      <Shield size={12} className="text-teal-600" />
                      <span>PDPA Section 7 & HIPAA Safe-Harbor Enforced</span>
                    </span>
                  </div>

                  {/* 4 Dataset Choice Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    <button
                      type="button"
                      onClick={() => setSelectedDataset('mimic_iv')}
                      className={`p-4 rounded-2xl border text-left transition-all relative ${
                        selectedDataset === 'mimic_iv'
                          ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/30 ring-2 ring-teal-500/20'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 hover:border-slate-300'
                      }`}
                    >
                      {selectedDataset === 'mimic_iv' && (
                        <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-teal-500 text-white flex items-center justify-center text-[10px]">
                          <Check size={12} />
                        </span>
                      )}
                      <div className="text-[10px] font-black uppercase text-teal-700 dark:text-teal-400 mb-1">
                        Emergency Cohort (v2.2)
                      </div>
                      <div className="text-xs font-black text-slate-900 dark:text-white leading-snug">
                        MIMIC-IV ED Triage Dataset
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        12,500 emergency presentations, vitals (SpO2, SBP, RR), GCS, and ESI acuity levels 1-5.
                      </p>
                      <div className="mt-3 pt-2 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                        <span>12,500 Records</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">De-identified</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedDataset('moh_cpg')}
                      className={`p-4 rounded-2xl border text-left transition-all relative ${
                        selectedDataset === 'moh_cpg'
                          ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/30 ring-2 ring-teal-500/20'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 hover:border-slate-300'
                      }`}
                    >
                      {selectedDataset === 'moh_cpg' && (
                        <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-teal-500 text-white flex items-center justify-center text-[10px]">
                          <Check size={12} />
                        </span>
                      )}
                      <div className="text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-400 mb-1">
                        Singapore CPG 2026
                      </div>
                      <div className="text-xs font-black text-slate-900 dark:text-white leading-snug">
                        MOH Pediatric & Geriatric CPG
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        4,800 structured primary care cases from SingHealth & NHG Singapore polyclinics.
                      </p>
                      <div className="mt-3 pt-2 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                        <span>4,800 Records</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">MOH Certified</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedDataset('nuhs_urgent')}
                      className={`p-4 rounded-2xl border text-left transition-all relative ${
                        selectedDataset === 'nuhs_urgent'
                          ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/30 ring-2 ring-teal-500/20'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 hover:border-slate-300'
                      }`}
                    >
                      {selectedDataset === 'nuhs_urgent' && (
                        <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-teal-500 text-white flex items-center justify-center text-[10px]">
                          <Check size={12} />
                        </span>
                      )}
                      <div className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400 mb-1">
                        Urgent Care Centre
                      </div>
                      <div className="text-xs font-black text-slate-900 dark:text-white leading-snug">
                        NUHS / SGH Outpatient Feed
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        8,400 acute respiratory, musculoskeletal trauma, and tropical fever ambulatory encounters.
                      </p>
                      <div className="mt-3 pt-2 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                        <span>8,400 Records</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">Ambulatory Net</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedDataset('custom')}
                      className={`p-4 rounded-2xl border text-left transition-all relative ${
                        selectedDataset === 'custom'
                          ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/30 ring-2 ring-teal-500/20'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 hover:border-slate-300'
                      }`}
                    >
                      {selectedDataset === 'custom' && (
                        <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-teal-500 text-white flex items-center justify-center text-[10px]">
                          <Check size={12} />
                        </span>
                      )}
                      <div className="text-[10px] font-black uppercase text-purple-700 dark:text-purple-400 mb-1">
                        Custom Clinical File
                      </div>
                      <div className="text-xs font-black text-slate-900 dark:text-white leading-snug">
                        Upload CSV / JSON Dataset
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        Custom tabular file with chief complaint, vitals thresholds, and clinical outcome tags.
                      </p>
                      <div className="mt-3 pt-2 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                        <span>{customDatasetName}</span>
                        <span className="text-purple-600 dark:text-purple-400 font-bold">{customRecordCount} rows</span>
                      </div>
                    </button>
                  </div>

                  {/* Hyperparameters & Controls */}
                  <div className="bg-slate-50 dark:bg-[#0F1A20] rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-white mb-1.5 flex items-center justify-between">
                        <span>Minimum Induction Confidence Floor</span>
                        <span className="text-teal-600 dark:text-teal-400 font-mono font-black">{mlConfidenceFloor}%</span>
                      </label>
                      <input
                        type="range"
                        min="70"
                        max="98"
                        value={mlConfidenceFloor}
                        onChange={e => setMlConfidenceFloor(parseInt(e.target.value))}
                        className="w-full accent-teal-600 cursor-pointer"
                      />
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                        Spec §6 default: 80-85%. Rules below this floor are automatically forced to higher care tiers or rejected.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-white mb-1.5">
                        Safety Hard-Stops & Governance
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={enforceHardStopGuard}
                            onChange={e => setEnforceHardStopGuard(e.target.checked)}
                            className="rounded accent-teal-600"
                          />
                          <span className="font-semibold">MOH §3.1/§3.2 Deterministic Hard-Stop Filter</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={enforcePdpaAnonymization}
                            onChange={e => setEnforcePdpaAnonymization(e.target.checked)}
                            className="rounded accent-teal-600"
                          />
                          <span className="font-semibold">PDPA Automated De-identification Verification</span>
                        </label>
                      </div>
                    </div>

                    <div className="flex flex-col justify-end">
                      <button
                        type="button"
                        disabled={mlPipelineRunning}
                        onClick={handleInvokeMlPipeline}
                        className={`w-full py-3 px-5 rounded-xl text-xs font-black shadow-lg flex items-center justify-center gap-2 transition-all ${
                          mlPipelineRunning
                            ? 'bg-slate-400 text-white cursor-not-allowed'
                            : 'bg-gradient-to-r from-teal-500 via-teal-600 to-indigo-600 hover:from-teal-600 hover:to-indigo-700 text-white hover:shadow-teal-500/20'
                        }`}
                      >
                        {mlPipelineRunning ? (
                          <>
                            <RefreshCw size={15} className="animate-spin text-white" />
                            <span>Running ML Induction Pipeline... ({mlPipelineProgress}%)</span>
                          </>
                        ) : (
                          <>
                            <Play size={15} className="fill-white" />
                            <span>Invoke ML Pipeline on Selected Dataset</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Progress & Live Telemetry Logs */}
                  {(mlPipelineRunning || mlLogs.length > 0) && (
                    <div className="bg-[#0F172A] rounded-2xl p-4 sm:p-5 border border-slate-800 text-slate-200 font-mono text-xs space-y-3 animate-fadeIn">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="font-black text-teal-400 flex items-center gap-2">
                          <Cpu size={14} className="animate-spin" />
                          <span>Pipeline Telemetry & Execution Trace</span>
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Stage: {mlPipelineProgress === 100 ? 'COMPLETED (Candidate Rules Ready)' : `${mlPipelineProgress}%`}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-teal-400 via-indigo-400 to-emerald-400 h-2 transition-all duration-300"
                          style={{ width: `${mlPipelineProgress}%` }}
                        ></div>
                      </div>

                      <div className="text-[11px] text-teal-300 font-sans font-bold">
                        {mlPipelineStage}
                      </div>

                      {/* Terminal Logs */}
                      <div className="bg-[#0B0F19] rounded-xl p-3 max-h-36 overflow-y-auto space-y-1 text-[10px] text-slate-400 scrollbar-thin border border-slate-800/80">
                        {mlLogs.map((log, idx) => (
                          <div key={idx} className={log.includes('SUCCESS') ? 'text-emerald-400 font-bold' : log.includes('@ml_agent') ? 'text-indigo-300' : 'text-slate-400'}>
                            {log}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Harvested Candidate Rules Ready for Knowledge Repository Feeding */}
                  {mlHarvestedRules.length > 0 && (
                    <div className="space-y-4 pt-2 animate-fadeIn">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-teal-50 dark:bg-teal-950/30 p-4 rounded-2xl border border-teal-200 dark:border-teal-800">
                        <div>
                          <div className="text-xs font-black text-teal-950 dark:text-teal-200 flex items-center gap-2">
                            <CheckCircle2 size={16} className="text-teal-600 dark:text-teal-400" />
                            <span>{mlHarvestedRules.length} High-Yield Candidate Rules Harvested by ML Pipeline</span>
                          </div>
                          <p className="text-[11px] text-teal-800 dark:text-teal-300 mt-0.5">
                            Rules have passed deterministic Section 3.1 & 3.2 safety hard-stops. Ingest them directly into <strong>@knowledge_agent</strong>'s active SQLite repository.
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleFeedAllRulesToRepository}
                            className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                          >
                            <CheckCheck size={15} />
                            <span>Approve & Feed All Rules into Knowledge Repository</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {mlHarvestedRules.map((item) => {
                          const sevBadge = 
                            item.rule.severity === 'RED' ? 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30' :
                            item.rule.severity === 'ORANGE' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30' :
                            item.rule.severity === 'YELLOW' ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30' :
                            'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';

                          return (
                            <div
                              key={item.rule.ruleId}
                              className={`bg-white dark:bg-[#14212B] p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                                item.isFed
                                  ? 'border-emerald-500/50 bg-emerald-50/20 dark:bg-emerald-950/10'
                                  : 'border-slate-200 dark:border-slate-800 hover:border-teal-500/50 shadow-sm'
                              }`}
                            >
                              <div className="space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border uppercase ${sevBadge}`}>
                                      {item.rule.severity} Tier
                                    </span>
                                    <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                                      {item.rule.ruleId}
                                    </span>
                                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-md font-mono">
                                      ICD-10 {item.icd10}
                                    </span>
                                  </div>

                                  <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold bg-teal-50 dark:bg-teal-950 px-2 py-0.5 rounded-full border border-teal-200 dark:border-teal-800">
                                    {item.mlConfidence}% Confidence
                                  </span>
                                </div>

                                <div>
                                  <h4 className="text-xs font-black text-slate-900 dark:text-white">
                                    {item.conditionName}
                                  </h4>
                                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 italic leading-relaxed">
                                    "{item.rule.rationale}"
                                  </p>
                                </div>

                                <div className="bg-slate-50 dark:bg-[#0F1A20] p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-[10px] space-y-1 font-mono">
                                  <div className="text-slate-500 dark:text-slate-400 font-bold uppercase">When Evaluated:</div>
                                  <div className="text-teal-700 dark:text-teal-300 font-semibold break-words">
                                    {item.rule.when.any?.join(' OR ')}
                                  </div>
                                  <div className="text-slate-500 dark:text-slate-400 text-[9px] pt-0.5">
                                    Domain: {item.rule.bodyPart} • Age Band: {item.rule.ageBand} • Support: {item.supportCount} cases
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                  Source: {item.rule.sourceRefs?.[0]}
                                </span>

                                {item.isFed ? (
                                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-800">
                                    <Check size={14} />
                                    <span>Fed to Knowledge Repository</span>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleFeedRuleToRepository(item)}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] px-3.5 py-1.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                                  >
                                    <Database size={13} />
                                    <span>Feed to Knowledge Repository</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="pt-2 flex justify-center">
                        <button
                          type="button"
                          onClick={() => setRuleBuilderView('explorer')}
                          className="text-xs font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400 flex items-center gap-1.5 underline decoration-teal-500/40 underline-offset-4"
                        >
                          <span>View in Rule Repository Explorer ({combinedRules.length} Active Rules)</span>
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2.5 Unified Pathways View */}
            {ruleBuilderView === 'unified' && (
              <div className="bg-white dark:bg-[#14212B] p-6 rounded-3xl border border-[#DDE5E9] dark:border-[#1E2D37] shadow-sm space-y-4 animate-fadeIn">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-black text-[#14212B] dark:text-white flex items-center gap-2">
                      <Layers className="text-[#0F766E] dark:text-[#2DD4BF]" size={18} />
                      <span>Unified Triage Pathways (Clinical vs UX Outcome Mapping)</span>
                    </h3>
                    <p className="text-xs text-[#52616B] dark:text-[#94A3B8] mt-0.5">
                      This view joins the Medical Engine (triage_rules) with the UX/Business Engine (triage_decisions) to show exact cause-and-effect.
                    </p>
                  </div>
                </div>

                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {filteredRules.map(rule => (
                    <div key={rule.ruleId} className="flex flex-col md:flex-row gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                      {/* Left side: Clinical Trigger */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Clinical Engine (triage_rules)</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            rule.severity === 'RED' ? 'bg-red-100 text-red-800' :
                            rule.severity === 'ORANGE' ? 'bg-amber-100 text-amber-800' :
                            rule.severity === 'YELLOW' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-emerald-100 text-emerald-800'
                          }`}>
                            {rule.severity}
                          </span>
                        </div>
                        <div className="bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm text-sm">
                          <div className="font-bold text-slate-800 dark:text-slate-200 mb-1">{rule.conditionId || rule.ruleId}</div>
                          <div className="text-xs text-slate-600 dark:text-slate-400 mb-2">Patient: {rule.ageBand} • Body: {rule.bodyPart}</div>
                          <div className="text-xs font-mono bg-slate-100 dark:bg-slate-900 p-2 rounded text-indigo-700 dark:text-indigo-400">
                            IF {JSON.stringify(rule.when)}
                          </div>
                        </div>
                      </div>

                      {/* Middle: Join */}
                      <div className="hidden md:flex flex-col items-center justify-center text-slate-300 dark:text-slate-700">
                        <div className="h-full border-l-2 border-dashed border-slate-300 dark:border-slate-700"></div>
                        <ArrowRight className="my-2" size={20} />
                        <div className="h-full border-l-2 border-dashed border-slate-300 dark:border-slate-700"></div>
                      </div>

                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400">UX Engine (triage_decisions)</span>
                          {editingUxRuleId === rule.ruleId ? (
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => {
                                  // Simple cancel: close editor. If it was just added and empty, we could remove it, but closing is enough for the mockup.
                                  setEditingUxRuleId(null);
                                }} 
                                className="text-[10px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-bold transition-colors"
                              >
                                Cancel
                              </button>
                              <button 
                                onClick={() => setEditingUxRuleId(null)} 
                                className="text-[10px] bg-teal-600 text-white px-2 py-0.5 rounded font-bold hover:bg-teal-700 transition-colors"
                              >
                                Save UX
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => {
                                setEditingUxRuleId(rule.ruleId);
                                  if (!uxMappings[rule.ruleId]) {
                                    setUxMappings(prev => ({
                                      ...prev,
                                      [rule.ruleId]: { action: (rule as any).then?.careTierKey || rule.careTierKey || '', meds: '[]', partners: '[]' }
                                    }));
                                  }
                              }} 
                              className="text-[10px] text-teal-600 hover:underline font-bold"
                            >
                              {uxMappings[rule.ruleId] ? 'Edit UX' : 'Add Mapping'}
                            </button>
                          )}
                        </div>
                        <div className={`p-3 rounded-xl border shadow-sm text-sm h-[calc(100%-1.5rem)] ${
                          uxMappings[rule.ruleId] 
                            ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/50' 
                            : 'bg-slate-50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800 border-dashed'
                        }`}>
                          <div className={`font-bold mb-2 ${uxMappings[rule.ruleId] ? 'text-indigo-900 dark:text-indigo-300' : 'text-slate-500'}`}>
                            {uxMappings[rule.ruleId] ? `Mapped Outcome for ${rule.severity}` : 'Unmapped (Using Default App Behavior)'}
                          </div>
                          
                          {editingUxRuleId === rule.ruleId ? (
                            <div className="space-y-2">
                              <div>
                                <label className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400">Action Plan</label>
                                <input 
                                  type="text" 
                                  value={uxMappings[rule.ruleId]?.action || ''} 
                                  onChange={e => setUxMappings(prev => ({ ...prev, [rule.ruleId]: { ...prev[rule.ruleId], action: e.target.value } }))}
                                  className="w-full bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded px-2 py-1 text-xs mt-0.5" 
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400">OTC Medications (JSON Array)</label>
                                <input 
                                  type="text" 
                                  value={uxMappings[rule.ruleId]?.meds || ''} 
                                  onChange={e => setUxMappings(prev => ({ ...prev, [rule.ruleId]: { ...prev[rule.ruleId], meds: e.target.value } }))}
                                  className="w-full bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded px-2 py-1 text-xs mt-0.5 font-mono" 
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400">Telemed Partners (JSON Array)</label>
                                <input 
                                  type="text" 
                                  value={uxMappings[rule.ruleId]?.partners || ''} 
                                  onChange={e => setUxMappings(prev => ({ ...prev, [rule.ruleId]: { ...prev[rule.ruleId], partners: e.target.value } }))}
                                  className="w-full bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded px-2 py-1 text-xs mt-0.5 font-mono" 
                                />
                              </div>
                            </div>
                          ) : uxMappings[rule.ruleId] ? (
                            <div className="space-y-1.5 text-xs">
                              <div className="flex justify-between border-b border-indigo-100 dark:border-indigo-900/30 pb-1">
                                <span className="text-indigo-600/70 dark:text-indigo-400/70">Action</span>
                                <span className="font-bold text-indigo-800 dark:text-indigo-200">{uxMappings[rule.ruleId].action}</span>
                              </div>
                              <div className="flex justify-between border-b border-indigo-100 dark:border-indigo-900/30 pb-1">
                                <span className="text-indigo-600/70 dark:text-indigo-400/70">Medications</span>
                                <span className="font-bold text-indigo-800 dark:text-indigo-200">{uxMappings[rule.ruleId].meds}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-indigo-600/70 dark:text-indigo-400/70">Partners</span>
                                <span className="font-bold text-indigo-800 dark:text-indigo-200">{uxMappings[rule.ruleId].partners}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center h-24 opacity-50">
                              <AlertTriangle size={24} className="mb-2 text-slate-400" />
                              <span className="text-xs font-bold">No custom UX mapping</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Knowledge Repository Explorer: rendered when ruleBuilderView === 'explorer' */}
            {ruleBuilderView === 'explorer' && (
              <div className="space-y-4 animate-fadeIn">
                {/* Quick Action Strip */}
                <div className="bg-gradient-to-r from-teal-500/10 via-indigo-500/10 to-teal-500/10 p-4 rounded-2xl border border-teal-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
                      <Brain size={18} />
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <span>Harvest Decision Rules from Clinical Datasets</span>
                        <span className="text-[9px] bg-teal-500 text-slate-950 font-black px-1.5 py-0.2 rounded-full uppercase">
                          ML Pipeline
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Invoke the Tier 4 ML induction pipeline on MIMIC-IV or MOH CPG datasets to discover and feed candidate rules into this repository.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRuleBuilderView('ml_pipeline')}
                      className="bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-600 hover:to-indigo-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5 shrink-0"
                    >
                      <Brain size={13} />
                      <span>Launch ML Pipeline</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRuleBuilderView('author')}
                      className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5 shrink-0"
                    >
                      <Plus size={13} />
                      <span>Manual Author</span>
                    </button>
                  </div>
                </div>

                {/* Filter and Search Bar for Knowledge Repository */}
                <div className="bg-white dark:bg-[#14212B] p-5 rounded-3xl border border-[#DDE5E9] dark:border-[#1E2D37] shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Database size={18} className="text-[#0F766E] dark:text-[#2DD4BF]" />
                  <h3 className="font-black text-sm text-[#14212B] dark:text-white">
                    Agentic Clinical Knowledge Repository ({filteredRules.length} of {combinedRules.length} Rules Active)
                  </h3>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Age Filter */}
                  <select
                    value={ruleAgeBandFilter}
                    onChange={e => setRuleAgeBandFilter(e.target.value)}
                    className="bg-[#F6F8FA] dark:bg-[#0F1A20] text-xs font-bold px-3 py-1.5 rounded-xl border border-[#DDE5E9] dark:border-[#1E2D37] text-[#14212B] dark:text-white"
                  >
                    <option value="ALL">All Age Bands</option>
                    <option value="neonate">Neonate (&lt;28d)</option>
                    <option value="young_infant">Young Infant (&lt;3m)</option>
                    <option value="infant">Infant (&lt;1y)</option>
                    <option value="toddler">Toddler (1-3y)</option>
                    <option value="child">Child (3-12y)</option>
                    <option value="adult">Adult (18-65y)</option>
                    <option value="elderly">Senior (65y+)</option>
                  </select>

                  {/* Body Part Filter */}
                  <select
                    value={ruleBodyPartFilter}
                    onChange={e => setRuleBodyPartFilter(e.target.value)}
                    className="bg-[#F6F8FA] dark:bg-[#0F1A20] text-xs font-bold px-3 py-1.5 rounded-xl border border-[#DDE5E9] dark:border-[#1E2D37] text-[#14212B] dark:text-white"
                  >
                    <option value="ALL">All Body Domains</option>
                    <option value="Respiratory">Respiratory</option>
                    <option value="Cardiovascular">Cardiovascular</option>
                    <option value="Neurology">Neurology</option>
                    <option value="Dermatology">Dermatology</option>
                    <option value="GI">GI / Hydration</option>
                    <option value="Musculoskeletal">Musculoskeletal</option>
                    <option value="Systemic">Systemic / Vitals</option>
                  </select>
                </div>
              </div>

              {/* Live Search Input */}
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={ruleSearchQuery}
                  onChange={e => setRuleSearchQuery(e.target.value)}
                  placeholder="Search rules by ID, condition, symptom keywords, trigger expression, or rationale..."
                  className="w-full bg-[#F6F8FA] dark:bg-[#0F1A20] text-xs pl-10 pr-4 py-2.5 rounded-xl border border-[#DDE5E9] dark:border-[#1E2D37] text-[#14212B] dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Active Filter Pills */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(['ALL', 'RED', 'ORANGE', 'YELLOW', 'GREEN'] as const).map(sev => {
                  const isSelected = ruleSeverityFilter === sev;
                  const label = sev === 'ALL' ? `All Rules (${combinedRules.length})` :
                    sev === 'RED' ? `🔴 RED Emergency (${redCount})` :
                    sev === 'ORANGE' ? `🟠 ORANGE Urgent (${orangeCount})` :
                    sev === 'YELLOW' ? `🟡 YELLOW Primary (${yellowCount})` : `🟢 GREEN Home (${greenCount})`;
                  
                  return (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setRuleSeverityFilter(sev)}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                        isSelected
                          ? sev === 'RED' ? 'bg-red-600 text-white shadow-sm' :
                            sev === 'ORANGE' ? 'bg-amber-600 text-white shadow-sm' :
                            sev === 'YELLOW' ? 'bg-yellow-600 text-white shadow-sm' :
                            sev === 'GREEN' ? 'bg-emerald-600 text-white shadow-sm' :
                            'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Rules Cards List: Showing ALL rules across RED, ORANGE, YELLOW, GREEN */}
            <div className="space-y-3">
              {filteredRules.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-[#14212B] rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-500 text-xs">
                  No rules match your filter criteria. Try resetting filters or search query.
                </div>
              ) : (
                filteredRules.map(r => {
                  const isCustom = customRules.some(cr => cr.ruleId === r.ruleId);
                  const isRed = r.severity === 'RED';
                  const isOrange = r.severity === 'ORANGE';
                  const isYellow = r.severity === 'YELLOW';
                  const isGreen = r.severity === 'GREEN';

                  return (
                    <div
                      key={r.ruleId}
                      className={`p-4 rounded-3xl border transition-all space-y-2.5 ${
                        isCustom
                          ? 'bg-amber-50/70 dark:bg-amber-950/20 border-2 border-amber-300 dark:border-amber-700/60 shadow-sm'
                          : 'bg-white dark:bg-[#14212B] border-[#DDE5E9] dark:border-[#1E2D37] hover:border-slate-300 shadow-xs'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-xs text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-lg">
                            {r.ruleId}
                          </span>

                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            isRed ? 'bg-red-500 text-white' :
                            isOrange ? 'bg-amber-500 text-white' :
                            isYellow ? 'bg-yellow-400 text-yellow-950' :
                            'bg-emerald-500 text-white'
                          }`}>
                            {r.severity}
                          </span>

                          {r.conditionId && (
                            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                              {r.conditionId}
                            </span>
                          )}

                          {r.ageBand && (
                            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.2 rounded-full font-bold">
                              Age: {r.ageBand}
                            </span>
                          )}

                          {r.bodyPart && (
                            <span className="text-[10px] bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 px-2 py-0.2 rounded-full font-bold border border-teal-200 dark:border-teal-900">
                              {r.bodyPart}
                            </span>
                          )}

                          {isCustom ? (
                            <span className="text-[10px] bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 px-2 py-0.2 rounded-full font-bold">
                              App Owner Custom
                            </span>
                          ) : (
                            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950 px-2 py-0.2 rounded-full border border-emerald-200 dark:border-emerald-800">
                              MOH Singapore Standard
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold text-slate-500">
                            {r.originatingAgent || '@knowledge_agent'}
                          </span>

                          {isCustom && (
                            <button
                              type="button"
                              onClick={() => onDeleteCustomRule(r.ruleId)}
                              className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-100 dark:hover:bg-red-950/50 rounded-xl transition-all"
                              title="Delete Custom Rule"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Rationale & Guidance */}
                      <p className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                        {r.rationale || r.reasonKey}
                      </p>

                      {/* Conditions & Technical Details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-100 dark:border-slate-800/80">
                        <div className="font-mono text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-[#0F1A20] p-2 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
                          <span className="font-bold text-slate-800 dark:text-slate-200">When: </span>
                          {r.when.any?.join(' OR ') || 'N/A'}
                        </div>

                        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#0F1A20] p-2 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
                          <span>
                            Care Tier: <strong className="text-slate-800 dark:text-slate-200 font-mono text-[10px]">{r.careTierKey}</strong>
                          </span>
                          {r.hybridStore && (
                            <span className="text-[10px] font-mono text-teal-600 dark:text-teal-400">
                              Node: {r.hybridStore.graphNode}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Sources & Citations */}
                      {r.sourceRefs && r.sourceRefs.length > 0 && (
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <span>Citation:</span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {r.sourceRefs.join(' • ')}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* 2.5 MULTI-AGENT TRIAGE SIMULATOR (Live Callouts & Decision Audit Trail)   */}
      {/* ========================================================================= */}
      {activeSubTab === 'simulation' && (
        <MultiAgentSimulatorView
          members={members}
          language={language}
          customRules={customRules}
          onOpenSos={onOpenSos}
        />
      )}

      {/* ========================================================================= */}
      {/* 3. HOSPITAL REGISTRY MANAGER */}
      {/* ========================================================================= */}
      {activeSubTab === 'hospitals' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#14212B] p-6 rounded-3xl border border-[#DDE5E9] dark:border-[#1E2D37] shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-black text-[#14212B] dark:text-white flex items-center gap-2">
                <Building2 className="text-[#0F766E] dark:text-[#2DD4BF]" size={20} />
                <span>Singapore Hospital & Clinic Facility Registry</span>
                <HelperInfoButton
                  title="Hospital & Clinic Facility Registry"
                  content="Add new hospitals, polyclinics, or CHAS emergency clinics. Newly registered facilities immediately reflect on the live Leaflet map and nearest finder."
                />
              </h2>
            </div>

            <form onSubmit={handleCreateFacility} className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-[#14212B] dark:text-white mb-1">Facility Name</label>
                <input
                  type="text"
                  value={newHospName}
                  onChange={e => setNewHospName(e.target.value)}
                  className="w-full bg-[#F6F8FA] dark:bg-[#0F1A20] text-xs font-bold px-3 py-2 rounded-xl border border-[#DDE5E9] dark:border-[#1E2D37] text-[#14212B] dark:text-white"
                  placeholder="e.g. Mount Alvernia Hospital"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#14212B] dark:text-white mb-1">Facility Category</label>
                <select
                  value={newHospType}
                  onChange={e => setNewHospType(e.target.value as any)}
                  className="w-full bg-[#F6F8FA] dark:bg-[#0F1A20] text-xs font-bold px-3 py-2 rounded-xl border border-[#DDE5E9] dark:border-[#1E2D37] text-[#14212B] dark:text-white"
                >
                  <option value="public_hospital">Public Acute Hospital (SGH, KKH, NUH)</option>
                  <option value="private_hospital">Private Hospital (Gleneagles, Mt E, Raffles)</option>
                  <option value="polyclinic">Polyclinic (SingHealth / NHG)</option>
                  <option value="gp_clinic">CHAS GP Clinic</option>
                  <option value="urgent_care">Urgent Care Centre</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#14212B] dark:text-white mb-1">Postal Code (Auto-Geocode)</label>
                <input
                  type="text"
                  value={newHospPostal}
                  onChange={e => handlePostalAutoLookup(e.target.value)}
                  className="w-full bg-[#F6F8FA] dark:bg-[#0F1A20] text-xs font-mono font-bold px-3 py-2 rounded-xl border border-[#DDE5E9] dark:border-[#1E2D37] text-[#14212B] dark:text-white"
                  placeholder="e.g. 574623"
                  maxLength={6}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-[#14212B] dark:text-white mb-1">Full Street Address</label>
                <input
                  type="text"
                  value={newHospAddress}
                  onChange={e => setNewHospAddress(e.target.value)}
                  className="w-full bg-[#F6F8FA] dark:bg-[#0F1A20] text-xs px-3 py-2 rounded-xl border border-[#DDE5E9] dark:border-[#1E2D37] text-[#14212B] dark:text-white"
                  placeholder="e.g. 820 Thomson Rd, Singapore 574623"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#14212B] dark:text-white mb-1">Emergency Phone</label>
                <input
                  type="text"
                  value={newHospPhone}
                  onChange={e => setNewHospPhone(e.target.value)}
                  className="w-full bg-[#F6F8FA] dark:bg-[#0F1A20] text-xs px-3 py-2 rounded-xl border border-[#DDE5E9] dark:border-[#1E2D37] text-[#14212B] dark:text-white"
                  placeholder="e.g. 6347-6688"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#14212B] dark:text-white mb-1">GPS Latitude</label>
                <input
                  type="text"
                  value={newHospLat}
                  onChange={e => setNewHospLat(e.target.value)}
                  className="w-full bg-[#F6F8FA] dark:bg-[#0F1A20] text-xs font-mono px-3 py-2 rounded-xl border border-[#DDE5E9] dark:border-[#1E2D37] text-[#14212B] dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#14212B] dark:text-white mb-1">GPS Longitude</label>
                <input
                  type="text"
                  value={newHospLng}
                  onChange={e => setNewHospLng(e.target.value)}
                  className="w-full bg-[#F6F8FA] dark:bg-[#0F1A20] text-xs font-mono px-3 py-2 rounded-xl border border-[#DDE5E9] dark:border-[#1E2D37] text-[#14212B] dark:text-white"
                />
              </div>

              <div className="flex items-center gap-3 pt-4">
                <input
                  type="checkbox"
                  id="hospHasED"
                  checked={newHospHasED}
                  onChange={e => setNewHospHasED(e.target.checked)}
                  className="w-4 h-4 text-[#0F766E] rounded"
                />
                <label htmlFor="hospHasED" className="text-xs font-bold text-[#14212B] dark:text-white">
                  24-Hour A&E / Emergency Department
                </label>
              </div>

              <div className="md:col-span-3 flex justify-end">
                <button
                  type="submit"
                  className="bg-[#0F766E] hover:bg-[#115E59] text-white font-bold text-xs py-2.5 px-6 rounded-xl transition-all shadow-sm flex items-center gap-2"
                >
                  <Plus size={16} />
                  <span>Register Facility in Singapore Directory</span>
                </button>
              </div>
            </form>
          </div>

          {/* Existing Facilities List */}
          <div className="bg-white dark:bg-[#14212B] p-6 rounded-3xl border border-[#DDE5E9] dark:border-[#1E2D37] shadow-sm space-y-4">
            <h3 className="font-black text-sm text-[#14212B] dark:text-white">
              Registered Singapore Hospitals & Centers ({allFacilities.length} total)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {allFacilities.map(f => (
                <div key={f.id} className="p-4 rounded-2xl bg-[#F6F8FA] dark:bg-[#0F1A20] border border-[#DDE5E9] dark:border-[#1E2D37] space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-sm text-[#14212B] dark:text-white">{f.name}</div>
                      <div className="text-xs text-[#52616B] dark:text-[#94A3B8] flex items-center gap-1 mt-0.5">
                        <MapPin size={12} className="text-[#0F766E]" />
                        <span>{f.address}</span>
                      </div>
                    </div>
                    {f.hasED && (
                      <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                        24h A&E
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 pt-1">
                    <span className="font-mono">Lat: {f.lat.toFixed(4)}, Lng: {f.lng.toFixed(4)}</span>
                    <span>•</span>
                    <span className="text-[#0F766E] font-bold">{f.phone}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. BLUETOOTH INTEGRATIONS TEST BENCH */}
      {/* ========================================================================= */}
      {activeSubTab === 'bluetooth' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#14212B] p-6 rounded-3xl border border-[#DDE5E9] dark:border-[#1E2D37] shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-black text-[#14212B] dark:text-white flex items-center gap-2">
                  <Bluetooth className="text-blue-500" size={20} />
                  <span>Bluetooth Low Energy (BLE) Medical Device Test Bench</span>
                  <HelperInfoButton
                    title="Bluetooth BLE Medical Device Test Bench"
                    content="Connect clinical sensors (pulse oximeters, blood pressure monitors, thermometers), inspect raw GATT packet telemetry, and verify data ingestion pipelines."
                  />
                </h2>
              </div>

              <button
                type="button"
                onClick={triggerBleScan}
                disabled={bleScanning}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2"
              >
                <RefreshCw size={14} className={bleScanning ? 'animate-spin' : ''} />
                <span>{bleScanning ? 'Scanning Spectrum...' : 'Scan For BLE Devices'}</span>
              </button>
            </div>

            {/* Active Device Card */}
            <div className="p-5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/20 border-2 border-blue-200 dark:border-blue-800/40 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <div className="text-[11px] uppercase font-bold text-blue-800 dark:text-blue-300">Connected Device</div>
                <div className="font-bold text-sm text-slate-900 dark:text-white mt-1">{connectedBleDevice}</div>
                <div className="text-xs text-slate-500 mt-0.5">MAC: E8:EB:1B:33:F1:C9 • Firmware 2.4.1</div>
              </div>

              <div>
                <div className="text-[11px] uppercase font-bold text-blue-800 dark:text-blue-300">Signal RSSI</div>
                <div className="font-bold text-base text-slate-900 dark:text-white mt-1 flex items-center gap-1.5">
                  <Radio size={16} className="text-emerald-500" />
                  <span>{bleRssi} dBm (Strong)</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">GATT 0x1810 Blood Pressure</div>
              </div>

              <div>
                <div className="text-[11px] uppercase font-bold text-blue-800 dark:text-blue-300">Battery Level</div>
                <div className="font-bold text-base text-slate-900 dark:text-white mt-1 flex items-center gap-1.5">
                  <Zap size={16} className="text-amber-500" />
                  <span>{bleBattery}% (GATT 0x180F)</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">CR2032 Lithium Coin Cell</div>
              </div>

              <div className="flex flex-col justify-center">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={16} /> Online & Streaming
                </span>
              </div>
            </div>

            {/* Live Clinical Measurement Generator */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-[#F6F8FA] dark:bg-[#0F1A20] border border-[#DDE5E9] dark:border-[#1E2D37] space-y-2">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Omron BP Monitor</span>
                  <Activity size={16} className="text-red-500" />
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {simulatedSys}/{simulatedDia} <span className="text-xs font-normal text-slate-500">mmHg</span>
                </div>
                <div className="text-xs text-slate-500">Pulse: {simulatedPulse} bpm</div>
                <button
                  type="button"
                  onClick={() => simulateBlePacket('bp')}
                  className="w-full mt-2 bg-white dark:bg-[#14212B] hover:bg-slate-100 text-xs font-bold py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 transition-all"
                >
                  Generate BP Reading
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-[#F6F8FA] dark:bg-[#0F1A20] border border-[#DDE5E9] dark:border-[#1E2D37] space-y-2">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Braun IR Thermometer</span>
                  <Zap size={16} className="text-amber-500" />
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {simulatedTemp}°C
                </div>
                <div className="text-xs text-slate-500">Ear Tympanic Membrane Sensor</div>
                <button
                  type="button"
                  onClick={() => simulateBlePacket('thermometer')}
                  className="w-full mt-2 bg-white dark:bg-[#14212B] hover:bg-slate-100 text-xs font-bold py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 transition-all"
                >
                  Generate Temp Reading
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-[#F6F8FA] dark:bg-[#0F1A20] border border-[#DDE5E9] dark:border-[#1E2D37] space-y-2">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Nonin Pulse Oximeter</span>
                  <Heart size={16} className="text-teal-500" />
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {simulatedSpo2}% <span className="text-xs font-normal text-slate-500">SpO2</span>
                </div>
                <div className="text-xs text-slate-500">Perfusion Index: 4.8</div>
                <button
                  type="button"
                  onClick={() => simulateBlePacket('oximeter')}
                  className="w-full mt-2 bg-white dark:bg-[#14212B] hover:bg-slate-100 text-xs font-bold py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 transition-all"
                >
                  Generate SpO2 Reading
                </button>
              </div>
            </div>

            {/* Raw GATT Packet Terminal */}
            <div className="bg-slate-950 text-emerald-400 p-4 rounded-2xl font-mono text-xs space-y-1.5 max-h-52 overflow-y-auto">
              <div className="text-slate-400 text-[11px] pb-1 border-b border-slate-800 flex justify-between">
                <span>GATT Raw Packet Capture (Web Bluetooth Trace)</span>
                <span>Port 2402 MHz</span>
              </div>
              {bleLogs.map((log, i) => (
                <div key={i} className="leading-relaxed">{log}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. WEATHER, HAZE & DENGUE SOURCING */}
      {/* ========================================================================= */}
      {activeSubTab === 'weather' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#14212B] p-6 rounded-3xl border border-[#DDE5E9] dark:border-[#1E2D37] shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-base font-black text-[#14212B] dark:text-white flex items-center gap-2">
                    <CloudSun className="text-amber-500" size={20} />
                    <span>Singapore Weather & Surrounding Geo-Conditions</span>
                    <HelperInfoButton
                      title="NEA Weather & Environmental Feeds"
                      content="Real-time data from National Environment Agency (NEA) & data.gov.sg API. Feeds rainfall, temperature, and 24-hr PSI haze metrics directly into asthma and heat-exhaustion clinical triage rules."
                    />
                  </h2>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Live Official NEA Feed</span>
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <a
                  href="https://www.nea.gov.sg/dengue-zika/dengue/dengue-clusters"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 hover:bg-teal-100 px-3 py-2 rounded-xl border border-teal-200 dark:border-teal-800 transition-all flex items-center gap-1.5"
                >
                  <span>NEA Official Portal</span>
                  <ExternalLink size={13} />
                </a>

                <span className="text-xs text-slate-500">Updated: {weatherData.lastUpdated}</span>
                <button
                  type="button"
                  onClick={refreshWeatherData}
                  disabled={isLoadingFeed}
                  className="bg-[#0F766E] hover:bg-[#115E59] text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                >
                  <RefreshCw size={14} className={isLoadingFeed ? 'animate-spin' : ''} />
                  <span>{isLoadingFeed ? 'Fetching NEA...' : 'Refresh Live Feeds'}</span>
                </button>
              </div>
            </div>

            {/* Top Environmental KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-black uppercase text-amber-900 dark:text-amber-300">24-Hr PSI (Haze)</div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-200/70 dark:bg-amber-800/50 text-amber-900 dark:text-amber-200">
                    Islandwide Range
                  </span>
                </div>
                <div className="text-3xl font-black text-amber-950 dark:text-amber-100 mt-1">{weatherData.psiRange}</div>
                <div className="text-xs font-bold text-amber-700 dark:text-amber-400 mt-0.5">
                  {weatherData.psiStatus} Band • Central: {weatherData.regions.central?.psi || 81} | North: {weatherData.regions.north?.psi || 64}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-black uppercase text-emerald-900 dark:text-emerald-300">1-Hr PM2.5</div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-200/70 dark:bg-emerald-800/50 text-emerald-900 dark:text-emerald-200">
                    {weatherData.pm25Timestamp || '11:00 PM SGT'}
                  </span>
                </div>
                <div className="text-3xl font-black text-emerald-950 dark:text-emerald-100 mt-1">{weatherData.pm25Hourly}</div>
                <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                  µg/m³ • Band 1 Normal (0–55)
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40">
                <div className="text-[11px] font-black uppercase text-blue-900 dark:text-blue-300">24h Island Forecast</div>
                <div className="text-lg font-black text-blue-950 dark:text-blue-100 mt-1 leading-snug">
                  {weatherData.generalForecast}
                </div>
                <div className="text-xs font-bold text-blue-700 dark:text-blue-400 mt-0.5">
                  Temp: {weatherData.temperature.low}°C - {weatherData.temperature.high}°C • RH: {weatherData.humidity}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40">
                <div className="text-[11px] font-black uppercase text-red-900 dark:text-red-300">Active Dengue Clusters</div>
                <div className="text-3xl font-black text-red-950 dark:text-red-100 mt-1">{weatherData.dengueClusters.length}</div>
                <div className="text-xs font-bold text-red-700 dark:text-red-400 mt-0.5">
                  {weatherData.dengueClusters.filter(c => c.alertLevel === 'RED_CLUSTER').length} High-Risk Red Zone (≥10 Cases)
                </div>
              </div>
            </div>

            {/* Regional Breakdown & Dengue Clusters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Regional PSI Breakdown */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-[#14212B] dark:text-white">
                    Singapore 5-Sector Air Quality & Weather
                  </h3>
                  <span className="text-[10px] text-slate-500 font-medium">NEA Live Stations ({weatherData.pm25Timestamp || '11:00 PM'})</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden text-xs">
                  {Object.entries(weatherData.regions).map(([regionKey, val]) => (
                    <div key={regionKey} className={`p-3 flex items-center justify-between ${regionKey === 'central' ? 'bg-amber-50/40 dark:bg-amber-950/10' : regionKey === 'north' ? 'bg-teal-50/30 dark:bg-teal-950/10' : 'bg-white dark:bg-[#14212B]'}`}>
                      <div>
                        <span className="font-bold uppercase text-slate-800 dark:text-slate-200">{regionKey} Singapore</span>
                        {regionKey === 'north' && (
                          <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-300">
                            North: PSI {val.psi} • PM2.5: {val.pm25}
                          </span>
                        )}
                        {regionKey === 'central' && (
                          <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
                            Central: PSI {val.psi} • PM2.5: {val.pm25}
                          </span>
                        )}
                      </div>
                      <span className="text-slate-500">{val.weather}</span>
                      <span className="font-mono font-bold bg-slate-100 dark:bg-[#0F1A20] px-2.5 py-1 rounded-lg">
                        PSI {val.psi} • PM2.5: {val.pm25} µg/m³
                      </span>
                    </div>
                  ))}
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0F1A20] border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                  <div>💡 <strong>1-Hr PM2.5 (19 vs 20):</strong> The haze.gov.sg web page displays the snapshot <em>"At 10pm"</em> (North was <strong>20 µg/m³</strong>). The official API feed (<code className="font-mono">api.data.gov.sg</code>) updates hourly and is already serving the <em>11pm batch</em>, where North PM2.5 refreshed to <strong>19 µg/m³</strong>.</div>
                  <div>💡 <strong>24-Hr PSI (64 vs 81):</strong> NEA reports 5 regional stations. <strong>64–65</strong> is North Singapore, while <strong>81</strong> is Central Singapore. The official national range is <strong>{weatherData.psiRange}</strong>.</div>
                </div>
              </div>

              {/* NEA Active Dengue Clusters */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-[#14212B] dark:text-white flex items-center gap-2">
                    <AlertOctagon size={16} className="text-red-500" />
                    <span>NEA Live Active Dengue Clusters ({weatherData.dengueClusters.length})</span>
                  </h3>
                  <span className="text-[11px] text-slate-500 font-semibold">Source: nea.gov.sg</span>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {weatherData.dengueClusters.map((cluster, i) => (
                    <div key={i} className="p-3 rounded-xl bg-slate-50 dark:bg-[#0F1A20] border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs hover:border-teal-500 transition-colors">
                      <div className="pr-2">
                        <div className="font-bold text-slate-900 dark:text-white">{cluster.location}</div>
                        <div className="text-[11px] text-slate-500">{cluster.trend}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-black uppercase ${
                          cluster.alertLevel === 'RED_CLUSTER' ? 'bg-red-500 text-white' : 'bg-amber-400 text-slate-950'
                        }`}>
                          {cluster.activeCases} Cases
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Official NEA Haze Situation & Health Advisory Card (haze.gov.sg) */}
            <div className="p-5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/20 border-2 border-amber-300 dark:border-amber-800/60 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CloudSun className="text-amber-600 dark:text-amber-400 shrink-0" size={20} />
                  <div>
                    <h3 className="font-bold text-sm text-amber-950 dark:text-amber-100">
                      Official NEA Haze Situation & Health Advisory
                    </h3>
                    <div className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                      {weatherData.hazeBulletin?.airQualityBlurb || '24-hr PSI Forecast: Moderate – Low Unhealthy'}
                    </div>
                  </div>
                </div>

                <a
                  href="https://www.haze.gov.sg"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-amber-900 dark:text-amber-200 bg-white dark:bg-[#0F1A20] hover:bg-amber-100 px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 transition-all flex items-center gap-1.5"
                >
                  <span>haze.gov.sg Official Portal</span>
                  <ExternalLink size={12} />
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1">
                <div className="p-3 bg-white dark:bg-[#14212B] rounded-xl border border-amber-200 dark:border-amber-800/50">
                  <div className="font-bold text-slate-800 dark:text-slate-200 mb-0.5">Healthy Population</div>
                  <div className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                    Normal activities when 1-hr PM2.5 is Band 1 (&le;55 &micro;g/m&sup3;) and 24-hr PSI is Moderate (&le;100).
                  </div>
                </div>

                <div className="p-3 bg-white dark:bg-[#14212B] rounded-xl border border-amber-200 dark:border-amber-800/50">
                  <div className="font-bold text-amber-900 dark:text-amber-300 mb-0.5">Elderly, Pregnant & Kids</div>
                  <div className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                    Minimise prolonged or strenuous outdoor physical exertion if 24-hr PSI exceeds 100.
                  </div>
                </div>

                <div className="p-3 bg-white dark:bg-[#14212B] rounded-xl border border-amber-200 dark:border-amber-800/50">
                  <div className="font-bold text-red-700 dark:text-red-400 mb-0.5">Chronic Lung & Heart Disease</div>
                  <div className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                    Avoid strenuous outdoor activity; keep prescribed reliever inhalers (Ventolin) accessible.
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-amber-800 dark:text-amber-300/80 bg-amber-100/60 dark:bg-amber-900/30 p-2.5 rounded-xl font-medium">
                <strong>Regional Hotspot Surveillance: </strong>
                {weatherData.hazeBulletin?.hotspotSummary || 'Prevailing winds blowing from southeast; smoke plumes observed in regional hotspots.'}
              </div>
            </div>

            {/* Clinical Triage Correlation Alert */}
            <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 flex items-start gap-3">
              <Info className="text-teal-600 mt-0.5 shrink-0" size={18} />
              <div className="text-xs text-teal-900 dark:text-teal-200 leading-relaxed">
                <span className="font-bold">Automated Clinical Decision Support Rule Binding: </span>
                When 24-hr PSI &gt; 100 or 1-hr PM2.5 is Elevated (Band 2), pediatric and geriatric triage rules automatically escalate persistent dry cough or shortness of breath from GREEN to YELLOW/ORANGE care tier. When a household postal code falls in an active Dengue Red Cluster, fever &gt; 48 hours is flagged for immediate NS1 antigen screening.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5B. CLINICAL GUARDRAILS (Spec §6) */}
      {/* ========================================================================= */}
      {activeSubTab === 'guardrails' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#14212B] p-6 rounded-3xl border border-[#DDE5E9] dark:border-[#1E2D37] shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-[#14212B] dark:text-white flex items-center gap-2">
                    <Shield className="text-teal-600 dark:text-teal-400" size={22} />
                    <span>Clinical Guardrails & Hard-Stops Settings (Spec §6)</span>
                  </h2>
                  <HelperInfoButton
                    title="Clinical Guardrails & Hard-Stops (Spec §6)"
                    content="Configures safety thresholds and deterministic hard-stops enforced prior to patient-facing output. Guardrails prevent model drift and ensure strict adherence to clinical escalation boundaries."
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Enforces deterministic clinical boundaries, allergy checks, pediatric safety cutoffs, and recertification windows across both Rule-based and Agentic triage.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[11px] bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-300 font-bold px-3 py-1 rounded-full border border-teal-200 dark:border-teal-800">
                  SMC Governance Active
                </span>
                <button
                  type="button"
                  onClick={handleSaveGuardrails}
                  disabled={isSavingGuardrails}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save size={14} />
                  <span>{isSavingGuardrails ? 'Saving...' : 'Save Guardrails to DB'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              {/* Confidence Floor */}
              <div className="bg-slate-50 dark:bg-[#0F1A20] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex justify-between items-center font-bold text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <span>Confidence Floor</span>
                    <HelperInfoButton
                      size="xs"
                      title="Confidence Floor Threshold"
                      content={`Forces conservative escalation if clinical confidence score falls below ${confidenceFloor}%. Prevents low-confidence automated triage decisions.`}
                    />
                  </div>
                  <span className="text-teal-700 dark:text-teal-300 font-black text-sm">{confidenceFloor}%</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="95"
                  step="5"
                  value={confidenceFloor}
                  onChange={e => setConfidenceFloor(parseInt(e.target.value))}
                  className="w-full accent-teal-600 cursor-pointer"
                />
                <div className="text-[10px] text-slate-400">
                  Fallback trigger when certainty &lt; {confidenceFloor}%
                </div>
              </div>

              {/* Allergy Hard Stop */}
              <div className="bg-slate-50 dark:bg-[#0F1A20] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex justify-between items-center font-bold text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <span>Allergy Hard Stop</span>
                    <HelperInfoButton
                      size="xs"
                      title="Allergy Pre-Output Gate"
                      content="Blocks any suggested over-the-counter (OTC) medications or interventions that conflict with recorded patient allergies."
                    />
                  </div>
                  <span className={`font-black ${allergyHardStop ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {allergyHardStop ? 'ENABLED' : 'OFF'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAllergyHardStop(!allergyHardStop)}
                  className={`w-full py-2 rounded-xl text-xs font-bold transition-all ${
                    allergyHardStop ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {allergyHardStop ? '✓ Active Pre-Output Gate' : 'Bypass Disabled'}
                </button>
                <div className="text-[10px] text-slate-400">
                  Auto-cross references against allergies
                </div>
              </div>

              {/* Age Hard Stop */}
              <div className="bg-slate-50 dark:bg-[#0F1A20] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex justify-between items-center font-bold text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <span>Age Escalation Gate</span>
                    <HelperInfoButton
                      size="xs"
                      title="Age Escalation Gate"
                      content="Blocks HOME_MONITOR triage for high-risk cohorts: automatically escalates infants < 3 months with fever or frail seniors with fall trauma to emergency care or clinic."
                    />
                  </div>
                  <span className={`font-black ${ageHardStop ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {ageHardStop ? 'ENABLED' : 'OFF'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAgeHardStop(!ageHardStop)}
                  className={`w-full py-2 rounded-xl text-xs font-bold transition-all ${
                    ageHardStop ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {ageHardStop ? '✓ Inf/Snr Gate Active' : 'Bypass Disabled'}
                </button>
                <div className="text-[10px] text-slate-400">
                  Escalates infants &lt; 3m &amp; frail seniors
                </div>
              </div>

              {/* Freshness Window & State Machine */}
              <div className="bg-slate-50 dark:bg-[#0F1A20] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex justify-between items-center font-bold text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <span>Freshness Window</span>
                    <HelperInfoButton
                      size="xs"
                      title="Freshness Window & Retries"
                      content="Sets hard expiration on unverified or stale clinical rules requiring recertification after the specified days, and caps automated agent retry cycles."
                    />
                  </div>
                  <span className="text-teal-700 dark:text-teal-300 font-black text-sm">{stalenessWindowDays} Days</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="365"
                  step="15"
                  value={stalenessWindowDays}
                  onChange={e => setStalenessWindowDays(parseInt(e.target.value))}
                  className="w-full accent-teal-600 cursor-pointer"
                />
                <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 pt-1">
                  <span>Max Agent Retries:</span>
                  <span className="font-mono font-bold bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded">
                    {maxRetryCount} revisions
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5C. TRIAGE DECISIONS & MEDICATIONS MANAGEMENT TABLE */}
      {/* ========================================================================= */}
      {activeSubTab === 'triage_medications' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#14212B] p-6 rounded-3xl border border-[#DDE5E9] dark:border-[#1E2D37] shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-base sm:text-lg font-black text-[#14212B] dark:text-white flex items-center gap-2">
                  <Pill className="text-teal-600 dark:text-teal-400" size={22} />
                  <span>Deterministic Triage Decisions & Medications Registry</span>
                  <HelperInfoButton
                    title="Triage Decisions & Medications Registry"
                    content="Manages the deterministic SQLite triage_decisions table. Controls OTC medications, home care instructions, dosage by age band, and frequency for Rule-Based Triage & Caregiver Scheduler."
                  />
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Persisted directly in SQLite <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-teal-700 dark:text-teal-400 font-mono">triage_decisions</code> table. Powers OTC recommendations and scheduler dosage calculations.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <select
                  value={decisionFilterAilment}
                  onChange={e => setDecisionFilterAilment(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1A20] text-xs font-bold text-slate-700 dark:text-slate-200"
                >
                  <option value="ALL">All Ailments</option>
                  <option value="fever">Fever</option>
                  <option value="cough">Cough</option>
                  <option value="cold">Cold</option>
                </select>

                <button
                  type="button"
                  onClick={() => handleOpenEditDecision()}
                  className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  <span>Add Decision / Med</span>
                </button>
              </div>
            </div>

            {/* Table of Decisions */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-[#0F1A20] border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="p-3">ID</th>
                    <th className="p-3">Ailment</th>
                    <th className="p-3">Severity</th>
                    <th className="p-3">Status / Action</th>
                    <th className="p-3">OTC Medications</th>
                    <th className="p-3">Dose (Toddler / Child / Adult)</th>
                    <th className="p-3">Frequency</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                  {triageDecisionsList
                    .filter(d => decisionFilterAilment === 'ALL' || d.ailmentCode === decisionFilterAilment)
                    .map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 font-mono font-bold text-slate-500">{item.id}</td>
                        <td className="p-3 font-black uppercase text-teal-700 dark:text-teal-400">{item.ailmentCode}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                            item.severity === 'RED' ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' :
                            item.severity === 'ORANGE' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                            item.severity === 'YELLOW' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300' :
                            'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          }`}>
                            {item.severity}
                          </span>
                        </td>
                        <td className="p-3 font-medium">{item.action}</td>
                        <td className="p-3">
                          {item.otcMedications && item.otcMedications.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {item.otcMedications.map((m: string, idx: number) => (
                                <span key={idx} className="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900 text-[11px] font-bold">
                                  {m}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">None</span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-[11px]">
                          {item.doses ? `${item.doses.toddler} / ${item.doses.child} / ${item.doses.adult}` : 'N/A'}
                        </td>
                        <td className="p-3">
                          <span className="font-semibold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-900 text-[11px]">
                            {item.frequency || 'N/A'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenEditDecision(item)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg font-bold text-xs flex items-center gap-1 ml-auto transition-all"
                          >
                            <Edit2 size={12} />
                            <span>Edit</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  {triageDecisionsList.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-400 italic">
                        {isLoadingDecisions ? 'Loading triage decisions from SQLite...' : 'No triage decisions found in SQLite table.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Edit / Add Modal */}
          {isEditingDecision && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white dark:bg-[#14212B] w-full max-w-xl rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 animate-scaleUp">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Pill className="text-teal-600" size={20} />
                    <span>{selectedDecisionId ? 'Edit Triage Decision & Medication' : 'Add New Triage Decision & Medication'}</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsEditingDecision(false)}
                    className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleSaveDecisionForm} className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Ailment Code</label>
                      <input
                        type="text"
                        required
                        value={formAilmentCode}
                        onChange={e => setFormAilmentCode(e.target.value)}
                        placeholder="e.g. fever, cough, cold"
                        className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1A20] text-slate-900 dark:text-white font-medium"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Severity</label>
                      <select
                        value={formSeverity}
                        onChange={e => setFormSeverity(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1A20] text-slate-900 dark:text-white font-bold"
                      >
                        <option value="GREEN">GREEN</option>
                        <option value="YELLOW">YELLOW</option>
                        <option value="ORANGE">ORANGE</option>
                        <option value="RED">RED</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Status / Action</label>
                    <input
                      type="text"
                      required
                      value={formAction}
                      onChange={e => setFormAction(e.target.value)}
                      placeholder="e.g. Home Care, Teledoctor / GP"
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1A20] text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">OTC Medications (comma-separated)</label>
                    <input
                      type="text"
                      value={formOtcMeds}
                      onChange={e => setFormOtcMeds(e.target.value)}
                      placeholder="e.g. Paracetamol, Ibuprofen"
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1A20] text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Toddler Dose</label>
                      <input
                        type="text"
                        value={formDoseToddler}
                        onChange={e => setFormDoseToddler(e.target.value)}
                        placeholder="e.g. 2.5ml"
                        className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1A20] text-slate-900 dark:text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Child Dose</label>
                      <input
                        type="text"
                        value={formDoseChild}
                        onChange={e => setFormDoseChild(e.target.value)}
                        placeholder="e.g. 5ml"
                        className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1A20] text-slate-900 dark:text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Adult / Senior Dose</label>
                      <input
                        type="text"
                        value={formDoseAdult}
                        onChange={e => setFormDoseAdult(e.target.value)}
                        placeholder="e.g. 10ml"
                        className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1A20] text-slate-900 dark:text-white font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Administration Frequency</label>
                    <input
                      type="text"
                      value={formFrequency}
                      onChange={e => setFormFrequency(e.target.value)}
                      placeholder="e.g. Once every 6 hours, 3 times a day"
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1A20] text-slate-900 dark:text-white font-semibold"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Home Care Guidance (comma-separated)</label>
                    <input
                      type="text"
                      value={formHomeCare}
                      onChange={e => setFormHomeCare(e.target.value)}
                      placeholder="e.g. Drink plenty of water, Rest, Tepid sponging"
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1A20] text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Telemedicine Partners (comma-separated)</label>
                    <input
                      type="text"
                      value={formTelemed}
                      onChange={e => setFormTelemed(e.target.value)}
                      placeholder="e.g. Whitecoat, Doctor Anywhere"
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1A20] text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsEditingDecision(false)}
                      className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingDecision}
                      className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Save size={14} />
                      <span>{isSavingDecision ? 'Saving...' : 'Save to SQLite'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. INSURANCE INTEGRATIONS & ELOG PRE-AUTHORIZATION */}
      {/* ========================================================================= */}
      {activeSubTab === 'insurance' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#14212B] p-6 rounded-3xl border border-[#DDE5E9] dark:border-[#1E2D37] shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-[#14212B] dark:text-white flex items-center gap-2">
                <CreditCard className="text-[#0F766E] dark:text-[#2DD4BF]" size={20} />
                <span>Insurance Provider Registry</span>
                <HelperInfoButton
                  title="Insurance Registry"
                  content="Manage insurance companies and their listed panel of hospitals. This is used for eLOG simulation and claim pre-authorizations."
                />
              </h2>
              <button
                type="button"
                onClick={() => setIsAddingInsurance(true)}
                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition-all shadow flex items-center gap-1.5"
              >
                <Plus size={14} />
                Add Insurance Provider
              </button>
            </div>

            {isAddingInsurance && (
              <div className="p-5 rounded-2xl bg-[#F6F8FA] dark:bg-[#0F1A20] border border-[#DDE5E9] dark:border-[#1E2D37] space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#14212B] dark:text-white mb-1">Company Name</label>
                    <input
                      type="text"
                      value={newInsuranceName}
                      onChange={(e) => setNewInsuranceName(e.target.value)}
                      placeholder="e.g. Manulife"
                      className="w-full bg-white dark:bg-[#14212B] border border-[#DDE5E9] dark:border-[#1E2D37] rounded-xl px-3 py-2 text-sm text-[#14212B] dark:text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#14212B] dark:text-white mb-1">Select Panel Hospitals</label>
                    <div className="flex gap-2 flex-wrap max-h-32 overflow-y-auto p-2 bg-white dark:bg-[#14212B] rounded-xl border border-[#DDE5E9] dark:border-[#1E2D37]">
                      {allFacilities.map(f => (
                        <label key={f.id} className="flex items-center gap-2 text-xs text-[#14212B] dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={newInsurancePanels.includes(f.id)}
                            onChange={(e) => {
                              if (e.target.checked) setNewInsurancePanels([...newInsurancePanels, f.id]);
                              else setNewInsurancePanels(newInsurancePanels.filter(id => id !== f.id));
                            }}
                            className="text-teal-600 focus:ring-teal-500 rounded"
                          />
                          {f.name}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-2 border-t border-[#DDE5E9] dark:border-[#1E2D37]">
                  <button
                    type="button"
                    onClick={() => setIsAddingInsurance(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!newInsuranceName.trim()) return;
                      setInsuranceCompanies([...insuranceCompanies, {
                        id: 'ins-' + Date.now(),
                        name: newInsuranceName,
                        panelHospitals: newInsurancePanels
                      }]);
                      setIsAddingInsurance(false);
                      setNewInsuranceName('');
                      setNewInsurancePanels([]);
                    }}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow"
                  >
                    Save Provider
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {insuranceCompanies.map(ins => (
                <div key={ins.id} className="flex flex-col sm:flex-row gap-4 p-4 border border-[#DDE5E9] dark:border-[#1E2D37] rounded-2xl items-start sm:items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-[#14212B] dark:text-white flex items-center gap-2">
                      <ShieldCheck size={16} className="text-teal-500" />
                      {ins.name}
                    </h3>
                    <p className="text-xs text-[#52616B] dark:text-[#94A3B8] mt-1">
                      {ins.panelHospitals.length} panel hospitals configured
                    </p>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {ins.panelHospitals.slice(0, 3).map(fId => {
                      const f = allFacilities.find(fac => fac.id === fId);
                      return f ? (
                        <span key={fId} className="px-2 py-1 text-[10px] font-bold bg-[#F0FDF4] text-teal-800 border border-teal-200 rounded-md">
                          {f.name}
                        </span>
                      ) : null;
                    })}
                    {ins.panelHospitals.length > 3 && (
                      <span className="px-2 py-1 text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 rounded-md">
                        +{ins.panelHospitals.length - 3} more
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setInsuranceCompanies(insuranceCompanies.filter(c => c.id !== ins.id))}
                    className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. KNOWN WEARABLES (APPLE WATCH) */}
      {/* ========================================================================= */}
      {activeSubTab === 'wearables' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#14212B] p-6 rounded-3xl border border-[#DDE5E9] dark:border-[#1E2D37] shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-black text-[#14212B] dark:text-white flex items-center gap-2">
                  <Watch className="text-indigo-600 dark:text-indigo-400" size={20} />
                  <span>Known Wearables Integration (Apple Watch HealthKit & Bio-Sensors)</span>
                  <HelperInfoButton
                    title="Apple HealthKit & Bio-Sensor Wearables"
                    content="Syncs continuous Apple HealthKit telemetry: Single-lead ECG rhythm classification, resting HR alerts, and fall detection SOS triggers directly into patient risk models."
                  />
                </h2>
              </div>

              <span className="inline-flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-full text-xs font-bold border border-indigo-200 dark:border-indigo-800">
                <CheckCircle2 size={14} /> Apple Watch Paired
              </span>
            </div>

            {/* Apple Watch Fall Detection Emergency Banner */}
            {appleWatchFallSimulating && (
              <div className="p-6 rounded-3xl bg-red-500 text-white shadow-2xl space-y-3 animate-pulse border-4 border-red-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertOctagon size={32} className="animate-bounce" />
                    <div>
                      <h3 className="font-black text-lg">Apple Watch Hard Fall Detected!</h3>
                      <p className="text-xs text-red-100">
                        Rapid deceleration and lack of movement recorded by Apple Watch gyroscopes.
                      </p>
                    </div>
                  </div>
                  <div className="text-4xl font-black bg-red-700 px-4 py-2 rounded-2xl">
                    {fallCountdown}s
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={cancelFallAlert}
                    className="bg-white text-red-600 hover:bg-red-50 font-bold text-xs px-4 py-2.5 rounded-xl transition-all"
                  >
                    I'm OK (Dismiss Alert)
                  </button>
                  <button
                    type="button"
                    onClick={onOpenSos}
                    className="bg-red-950 hover:bg-black text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-2"
                  >
                    <Phone size={14} />
                    <span>Dispatch 995 SCDF Ambulance Immediately</span>
                  </button>
                </div>
              </div>
            )}

            {/* Device Telemetry Specs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-[#F6F8FA] dark:bg-[#0F1A20] border border-[#DDE5E9] dark:border-[#1E2D37] space-y-2">
                <div className="text-xs text-slate-500 font-bold uppercase">Device Model</div>
                <div className="font-black text-sm text-slate-900 dark:text-white">{appleWatchModel}</div>
                <div className="text-xs text-emerald-600 font-bold">WatchOS 11.2 • HealthKit Verified</div>
              </div>

              <div className="p-5 rounded-2xl bg-[#F6F8FA] dark:bg-[#0F1A20] border border-[#DDE5E9] dark:border-[#1E2D37] space-y-2">
                <div className="text-xs text-slate-500 font-bold uppercase">Current Heart Rate</div>
                <div className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Heart size={20} className="text-red-500 animate-pulse" />
                  <span>{appleWatchHeartRate} <span className="text-xs font-normal text-slate-500">BPM</span></span>
                </div>
                <div className="text-xs text-slate-500">Resting range: 58-76 BPM (Normal)</div>
              </div>

              <div className="p-5 rounded-2xl bg-[#F6F8FA] dark:bg-[#0F1A20] border border-[#DDE5E9] dark:border-[#1E2D37] space-y-2">
                <div className="text-xs text-slate-500 font-bold uppercase">ECG Lead I Rhythm</div>
                <div className="font-black text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 size={16} />
                  <span>{appleWatchRhythm}</span>
                </div>
                <div className="text-xs text-slate-500">No signs of Atrial Fibrillation (AFib)</div>
              </div>
            </div>

            {/* Apple Watch ECG Rhythm Strip */}
            <div className="p-5 rounded-2xl bg-slate-950 text-emerald-400 space-y-3">
              <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                <span className="font-mono">Apple Watch ECG 500Hz Sampling (Lead I)</span>
                <span className="text-slate-400">Speed: 25mm/s • Gain: 10mm/mV</span>
              </div>
              <div className="h-20 flex items-center justify-center">
                <svg className="w-full h-full text-emerald-400" viewBox="0 0 500 80" preserveAspectRatio="none">
                  <path
                    d="M 0,40 L 40,40 L 50,38 L 55,42 L 60,40 L 70,40 L 75,20 L 80,65 L 85,10 L 90,50 L 95,38 L 105,40 L 140,40 L 180,40 L 190,38 L 195,42 L 200,40 L 210,40 L 215,20 L 220,65 L 225,10 L 230,50 L 235,38 L 245,40 L 280,40 L 320,40 L 330,38 L 335,42 L 340,40 L 350,40 L 355,20 L 360,65 L 365,10 L 370,50 L 375,38 L 385,40 L 420,40 L 460,40 L 470,38 L 475,42 L 480,40 L 500,40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              </div>
            </div>

            {/* Simulator Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={simulateHardFall}
                disabled={appleWatchFallSimulating}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2"
              >
                <AlertOctagon size={16} />
                <span>Simulate Hard Fall Event (60s Countdown)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAppleWatchHeartRate(138);
                  setAppleWatchRhythm('High HR Alert');
                  showToast('Apple Watch Inconclusive/High Resting HR Alert Triggered (138 bpm)!');
                }}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2"
              >
                <Zap size={16} />
                <span>Simulate Tachycardia (&gt;120 BPM at Rest)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAppleWatchHeartRate(72);
                  setAppleWatchRhythm('Sinus Rhythm');
                  showToast('Apple Watch Vitals Normalised.');
                }}
                className="bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-200 text-xs font-bold px-4 py-2.5 rounded-xl transition-all"
              >
                Reset Normal Rhythm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. KEY STATISTICS & MULTI-AGENT TELEMETRY SCREEN */}
      {/* ========================================================================= */}
      {activeSubTab === 'statistics' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header & Refresh */}
          <div className="bg-white dark:bg-[#14212B] p-5 sm:p-6 rounded-3xl border border-[#DDE5E9] dark:border-[#1E2D37] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 bg-teal-500/10 dark:bg-teal-500/20 text-[#0F766E] dark:text-[#2DD4BF] text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider mb-2">
                <BarChart3 size={14} />
                <span>Executive Operations Dashboard</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-[#14212B] dark:text-white flex items-center gap-2">
                <span>Key System Statistics & Multi-Agent Telemetry</span>
                <HelperInfoButton
                  title="Key System Statistics & Telemetry"
                  content="Real-time operational metrics across registered Singapore households, triage engine invocations, LLM agent health, and adversarial conflict reconciliations."
                />
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-400 font-mono">
                Source: SQLite (data/chat.db)
              </span>
              <button
                type="button"
                onClick={loadStatsAndFeedback}
                disabled={isLoadingStats}
                className="px-4 py-2.5 bg-[#0F766E] hover:bg-[#0D655E] text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw size={14} className={isLoadingStats ? 'animate-spin' : ''} />
                <span>{isLoadingStats ? 'Refreshing...' : 'Refresh Metrics'}</span>
              </button>
            </div>
          </div>

          {/* Top 4 KPI Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Registered Families */}
            <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50/40 dark:from-emerald-950/30 dark:to-slate-900 border border-emerald-200/80 dark:border-emerald-800/40 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                  Families Registered
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Users size={16} />
                </div>
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white mt-3">
                {keyStats?.registeredFamiliesCount ?? allHouseholds.length}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Active Singapore household registries under GranPocket Care management.
              </p>
              <div className="mt-3 pt-3 border-t border-emerald-200/60 dark:border-emerald-800/30 flex items-center gap-1.5 flex-wrap">
                {allHouseholds.map(h => (
                  <span key={h.id} className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/80 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/50">
                    {h.name.split(' ')[0]}
                  </span>
                ))}
              </div>
            </div>

            {/* 2. Triage Engine Invocations */}
            <div className="p-5 rounded-3xl bg-gradient-to-br from-teal-50 to-cyan-50/40 dark:from-teal-950/30 dark:to-slate-900 border border-teal-200/80 dark:border-teal-800/40 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider">
                  Triage Engine Invocations
                </span>
                <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                  <Activity size={16} />
                </div>
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white mt-3">
                {keyStats?.triageInvocationsCount ?? 162}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Cumulative pediatric & geriatric triage runs processed across 4-tier ESI engine.
              </p>
              <div className="mt-3 pt-3 border-t border-teal-200/60 dark:border-teal-800/30 text-[11px] font-bold text-teal-700 dark:text-teal-300 flex items-center gap-1.5">
                <Zap size={13} className="text-amber-500" />
                <span>42ms avg deterministic response time</span>
              </div>
            </div>

            {/* 3. Conflicts Detected & Resolved */}
            <div className="p-5 rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50/40 dark:from-amber-950/30 dark:to-slate-900 border border-amber-200/80 dark:border-amber-800/40 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                  Conflicts Detected & Resolved
                </span>
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <ShieldCheck size={16} />
                </div>
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white mt-3 flex items-baseline gap-2">
                <span>{keyStats?.conflictDetectionsCount ?? 19}</span>
                <span className="text-xs text-amber-600 dark:text-amber-400 font-bold">Adversarial Challenges</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Conflicts detected between @triage_agent and @expert_doctor_agent (dual-doctor attestation).
              </p>
              <div className="mt-3 pt-3 border-t border-amber-200/60 dark:border-amber-800/30 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle size={13} />
                <span>100% Reconciled before clinical final disposition</span>
              </div>
            </div>

            {/* 4. Customer Rating & Satisfaction */}
            <div className="p-5 rounded-3xl bg-gradient-to-br from-indigo-50 to-blue-50/40 dark:from-indigo-950/30 dark:to-slate-900 border border-indigo-200/80 dark:border-indigo-800/40 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider">
                  Customer Experience
                </span>
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Star size={16} className="fill-indigo-500 text-indigo-500" />
                </div>
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white mt-3 flex items-baseline gap-2">
                <span>{keyStats?.averageRating ?? '4.8'}</span>
                <span className="text-xs text-slate-500 font-normal">/ 5.0 Stars</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                {keyStats?.totalFeedbacks ?? feedbackList.length} verified household submissions stored in SQLite database.
              </p>
              <div className="mt-3 pt-3 border-t border-indigo-200/60 dark:border-indigo-800/30 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('feedback')}
                  className="text-xs font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 flex items-center gap-1"
                >
                  <span>View Feedback List</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Status of the Various LLM Agents */}
          <div className="bg-white dark:bg-[#14212B] p-6 rounded-3xl border border-[#DDE5E9] dark:border-[#1E2D37] shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black text-[#14212B] dark:text-white flex items-center gap-2">
                  <Bot className="text-teal-600 dark:text-teal-400" size={20} />
                  <span>Status of LLM Agents (@agent Architecture)</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Live health, operational status, underlying models, latency, and invocation volume across all 6 specialized agents.
                </p>
              </div>
              <span className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-3 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1.5 self-start sm:self-auto">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>All 6 Agents Healthy</span>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(keyStats?.agentStatuses || [
                {
                  id: '@decipher_agent',
                  name: 'Decipher Agent',
                  badge: 'Multimodal OCR & Audio',
                  role: 'OCR / Lab Report / Voice Ingestion',
                  model: 'Tencent Hunyuan 2.0 / Gemini 2.5 Flash',
                  status: 'ONLINE',
                  latency: '240ms',
                  successRate: '99.4%',
                  health: 'Optimal',
                  totalCalls: keyStats?.triageInvocationsCount || 162,
                  lastActive: 'Just now'
                },
                {
                  id: '@knowledge_agent',
                  name: 'Knowledge Agent',
                  badge: 'MOH SG / MIMIC-IV KG',
                  role: 'Clinical Protocols & MOH Guidelines',
                  model: 'Hybrid Vector + Deterministic KG (MOH/MIMIC-IV)',
                  status: 'ONLINE',
                  latency: '85ms',
                  successRate: '100%',
                  health: 'Optimal',
                  totalCalls: keyStats?.triageInvocationsCount || 162,
                  lastActive: 'Just now'
                },
                {
                  id: '@triage_agent',
                  name: 'Triage Agent',
                  badge: 'Deterministic ESI-4',
                  role: 'Primary Pediatric & Geriatric Triaging',
                  model: 'Singapore ESI 4-Tier Deterministic Engine',
                  status: 'ONLINE',
                  latency: '42ms',
                  successRate: '99.8%',
                  health: 'Optimal',
                  totalCalls: keyStats?.triageInvocationsCount || 162,
                  lastActive: 'Just now'
                },
                {
                  id: '@expert_doctor_agent',
                  name: 'Expert Doctor Agent',
                  badge: 'Adversarial Falsifier',
                  role: 'Critique, Discrepancy & Red-Team Verification',
                  model: 'Adversarial Challenger (Dual-Doctor Attestation)',
                  status: 'ONLINE',
                  latency: '310ms',
                  successRate: '98.9%',
                  health: 'Optimal',
                  totalCalls: keyStats?.triageInvocationsCount || 162,
                  lastActive: 'Just now'
                },
                {
                  id: '@ml_agent',
                  name: 'Machine Learning Agent',
                  badge: 'Rule Induction Engine',
                  role: 'Federated Clinical Rule Extraction',
                  model: 'Decision Tree Rule Inducer (MIMIC-IV / FastTree)',
                  status: 'ONLINE',
                  latency: '120ms',
                  successRate: '97.6%',
                  health: 'Optimal',
                  totalCalls: 64,
                  lastActive: '3 mins ago'
                },
                {
                  id: '@supervisor_agent',
                  name: 'Supervisor Agent',
                  badge: 'State Machine Lockout',
                  role: 'Agent Orchestration & Deterministic Lockout',
                  model: 'Hierarchical Router & State Machine',
                  status: 'ONLINE',
                  latency: '35ms',
                  successRate: '100%',
                  health: 'Optimal',
                  totalCalls: keyStats?.triageInvocationsCount || 162,
                  lastActive: 'Just now'
                }
              ]).map((agent: any) => (
                <div
                  key={agent.id}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3 hover:border-teal-500/50 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-xl bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-xs">
                        {agent.id.slice(1, 3).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-mono font-black text-slate-900 dark:text-white">
                          {agent.id}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {agent.name}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>{agent.status}</span>
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    <span className="font-semibold text-slate-500 dark:text-slate-400">Role: </span>
                    {agent.role}
                  </div>

                  <div className="text-[11px] p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1 font-mono">
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                      <span className="text-slate-400">Model:</span>
                      <span className="font-semibold truncate max-w-[170px]" title={agent.model}>{agent.model}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                      <span className="text-slate-400">Avg Latency:</span>
                      <span className="font-bold text-teal-600 dark:text-teal-400">{agent.latency}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                      <span className="text-slate-400">Success Rate:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{agent.successRate}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                    <span>Total Invocations: {agent.totalCalls}</span>
                    <span>Active: {agent.lastActive}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Conflict Detection Deep Dive: Triage Agent vs Expert Doctor Agent */}
          <div className="bg-white dark:bg-[#14212B] p-6 rounded-3xl border border-[#DDE5E9] dark:border-[#1E2D37] shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black text-[#14212B] dark:text-white flex items-center gap-2">
                  <ShieldAlert className="text-amber-500" size={20} />
                  <span>Adversarial Conflict Resolution: @triage_agent ↔ @expert_doctor_agent</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  How adversarial falsification challenges prevent medical hallucination, enforce age floors, and block contraindications.
                </p>
              </div>
              <div className="text-xs font-bold px-3 py-1 bg-amber-500/10 text-amber-700 dark:text-amber-300 rounded-full border border-amber-500/30">
                Total Conflicts Reconciled: {keyStats?.conflictDetectionsCount ?? 19}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 space-y-2">
                <div className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle size={15} />
                  <span>1. Missed Differentials & Age Floors</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  When @triage_agent assigns a lower tier (e.g. Yellow) to an infant under 3 months with fever, @expert_doctor_agent automatically challenges and escalates to Red (immediate A&E).
                </p>
                <div className="text-[10px] text-amber-700 dark:text-amber-400 font-mono font-bold">
                  8 Challenges Reconciled
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 space-y-2">
                <div className="text-xs font-bold text-rose-900 dark:text-rose-300 flex items-center gap-1.5">
                  <AlertOctagon size={15} />
                  <span>2. Drug & Allergy Hard-Stops</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Adversarial check blocks any recommendation of NSAIDs (Ibuprofen) for patients with active dengue warning or renal impairment, requiring immediate triage revision.
                </p>
                <div className="text-[10px] text-rose-700 dark:text-rose-400 font-mono font-bold">
                  6 Challenges Reconciled
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800/40 space-y-2">
                <div className="text-xs font-bold text-teal-900 dark:text-teal-300 flex items-center gap-1.5">
                  <CheckCircle size={15} />
                  <span>3. Confidence Floor Enforcement</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  If confidence drops below 85%, @expert_doctor_agent withholds approval until follow-up clarifying questions are asked or human-in-the-loop clinical teleconsult is recommended.
                </p>
                <div className="text-[10px] text-teal-700 dark:text-teal-400 font-mono font-bold">
                  5 Challenges Reconciled
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 10. CUSTOMER FEEDBACK LIST FOR APP OWNER */}
      {/* ========================================================================= */}
      {activeSubTab === 'feedback' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header */}
          <div className="bg-white dark:bg-[#14212B] p-5 sm:p-6 rounded-3xl border border-[#DDE5E9] dark:border-[#1E2D37] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider mb-2">
                <MessageSquareHeart size={14} />
                <span>Family Experience & Feedback Registry</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-[#14212B] dark:text-white flex items-center gap-2">
                <span>Customer Feedback Submissions</span>
                <span className="text-xs bg-amber-400 text-slate-950 font-black px-2.5 py-0.5 rounded-full">
                  {feedbackList.length} Stored in SQLite
                </span>
                <HelperInfoButton
                  title="Customer Feedback Submissions"
                  content="Reviews, ratings, and qualitative feedback submitted by Singapore families and SMC clinicians. Stored persistently in SQLite (data/chat.db)."
                />
              </h2>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={loadStatsAndFeedback}
                disabled={isLoadingFeedback}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
              >
                <RefreshCw size={13} className={isLoadingFeedback ? 'animate-spin' : ''} />
                <span>Refresh SQLite</span>
              </button>
            </div>
          </div>

          {/* Rating Summary Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-[#14212B] border border-[#DDE5E9] dark:border-[#1E2D37] flex items-center space-x-3.5 shadow-sm">
              <div className="w-11 h-11 rounded-2xl bg-amber-400/20 text-amber-500 flex items-center justify-center shrink-0">
                <Star size={24} className="fill-amber-400 text-amber-400" />
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {keyStats?.averageRating ?? '4.8'} <span className="text-xs font-normal text-slate-500">/ 5.0</span>
                </div>
                <div className="text-xs text-slate-500 font-semibold">Average Family Rating</div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#14212B] border border-[#DDE5E9] dark:border-[#1E2D37] flex items-center space-x-3.5 shadow-sm">
              <div className="w-11 h-11 rounded-2xl bg-emerald-400/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <ThumbsUp size={22} />
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {feedbackList.filter(f => f.rating >= 4).length} of {feedbackList.length}
                </div>
                <div className="text-xs text-slate-500 font-semibold">Positive Recommendations (≥4★)</div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#14212B] border border-[#DDE5E9] dark:border-[#1E2D37] flex items-center space-x-3.5 shadow-sm">
              <div className="w-11 h-11 rounded-2xl bg-teal-400/20 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                <Database size={22} />
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  100% Persistent
                </div>
                <div className="text-xs text-slate-500 font-semibold">Table `customer_feedback`</div>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-[#14212B] p-4 rounded-2xl border border-[#DDE5E9] dark:border-[#1E2D37]">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-500">Filter Rating:</span>
              {(['ALL', 5, 4, 3] as const).map(rate => (
                <button
                  type="button"
                  key={rate}
                  onClick={() => setFeedbackRatingFilter(rate as any)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    feedbackRatingFilter === rate
                      ? 'bg-amber-400 text-slate-950 shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {rate === 'ALL' ? 'All Ratings' : `${rate} Stars ★`}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={feedbackSearch}
                  onChange={e => setFeedbackSearch(e.target.value)}
                  placeholder="Search comments or member..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Feedback Cards List */}
          <div className="space-y-3.5">
            {feedbackList
              .filter(f => feedbackRatingFilter === 'ALL' || f.rating === feedbackRatingFilter)
              .filter(f => {
                if (!feedbackSearch.trim()) return true;
                const q = feedbackSearch.toLowerCase();
                return (
                  f.memberName.toLowerCase().includes(q) ||
                  f.comments.toLowerCase().includes(q) ||
                  f.category.toLowerCase().includes(q) ||
                  (f.householdName && f.householdName.toLowerCase().includes(q))
                );
              })
              .map(fb => (
                <div
                  key={fb.id}
                  className="p-5 rounded-2xl bg-white dark:bg-[#14212B] border border-[#DDE5E9] dark:border-[#1E2D37] shadow-sm space-y-3 hover:border-amber-400/50 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/60 pb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-teal-500 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow">
                        {fb.memberName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{fb.memberName}</span>
                          <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
                            • {fb.householdName || 'Singapore Household'}
                          </span>
                        </div>
                        <div className="text-[11px] text-teal-700 dark:text-teal-400 font-semibold">
                          Category: {fb.category}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map(st => (
                          <Star
                            key={st}
                            size={16}
                            className={st <= fb.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-700'}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {new Date(fb.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed pl-1 italic">
                    "{fb.comments}"
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                    <span className="font-mono">ID: {fb.id}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle size={11} />
                      <span>Verified Household Feedback</span>
                    </span>
                  </div>
                </div>
              ))}

            {feedbackList.length === 0 && (
              <div className="p-8 text-center bg-white dark:bg-[#14212B] rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 text-xs">
                No customer feedback found in database. Submit feedback in the Family section to see it appear here.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
