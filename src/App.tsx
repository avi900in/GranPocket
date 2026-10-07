import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { 
  Person, 
  Household, 
  Language, 
  TriageResult, 
  Ailment, 
  MedicationLogEntry, 
  CheckBackPlan, 
  KBChangeProposal, 
  AuditEvent,
  Severity,
  TriageRule,
  HospitalFacility,
  RolePermissions,
  SystemRole,
  ScreenKey
} from './types';
import { DEFAULT_ROLE_PERMISSIONS } from './data/defaultRbac';
import { 
  INITIAL_HOUSEHOLD, 
  APP_OWNER_HOUSEHOLD,
  ALL_HOUSEHOLDS,
  INITIAL_MEMBERS, 
  INITIAL_MEDICATION_LOGS, 
  INITIAL_MONITORING_PLANS, 
  INITIAL_KB_PROPOSALS, 
  INITIAL_AUDIT_LOGS,
  SINGAPORE_FACILITIES
} from './data/mockData';
import { lookupSingaporePostalCode } from './engine/singaporeData';
import { setDynamicCustomRules } from './engine/triageEngine';
import { getAgeBand } from './engine/ruleBasedEngine';
import {
  fetchRulesFromDb,
  saveRuleToDb,
  deleteRuleFromDb,
  fetchProposalsFromDb,
  updateProposalStatusInDb,
  fetchPersonsFromDb,
  savePersonToDb,
  getDatabaseStats,
  type DatabaseStats,
  fetchCaregiverAlerts,
  saveCaregiverAlertToDb,
  acknowledgeCaregiverAlertInDb,
  resolvePersonAilmentInDb,
  saveTriageAssessmentToDb,
  type CaregiverAlertEntry,
  fetchFacilitiesFromDb,
  saveFacilityToDb
} from './services/dbService';

import { Navbar } from './components/Navbar';
import { LoginPage } from './components/LoginPage';
import { WhoIsUnwellStep } from './components/WhoIsUnwellStep';
import { EmergencySosModal } from './components/EmergencySosModal';
import { CrisisModal } from './components/CrisisModal';
import { CreateHouseholdModal } from './components/CreateHouseholdModal';
import { TriageFlowView } from './components/TriageFlowView';
import { TriageResultView } from './components/TriageResultView';
import { FamilyProfilesView } from './components/FamilyProfilesView';
import { MedicationLogView } from './components/MedicationLogView';
import { HomeMonitoringView } from './components/HomeMonitoringView';
import { HospitalFinderView } from './components/HospitalFinderView';
import { ClinicalKbConsoleView } from './components/ClinicalKbConsoleView';
import { AuditAndPdpaView } from './components/AuditAndPdpaView';
import { BottomTabBar } from './components/BottomTabBar';
import { AppOwnerPortalView } from './components/AppOwnerPortalView';
import { CustomerFeedbackView } from './components/CustomerFeedbackView';
import { CaregiverAlertToast } from './components/CaregiverAlertToast';
import { CaregiverSchedulerModal } from './components/CaregiverSchedulerModal';
import {
  ScheduledJob,
  computeScheduledJobs,
  createCaregiverAlertFromJob
} from './services/schedulerService';

export default function App() {
  // Theme State (Dark mode support with semantic tokens)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(prev => !prev);

  // Global State (Persisted with localStorage for multi-family & custom data support)
  const [allHouseholds, setAllHouseholds] = useState<Household[]>(ALL_HOUSEHOLDS);

  const [household, setHousehold] = useState<Household>(INITIAL_HOUSEHOLD);

  const [members, setMembers] = useState<Person[]>(INITIAL_MEMBERS);

  // Fetch initial data from server
  useEffect(() => {
    Promise.all([
      fetch('/api/db/households').then(r => r.json()),
      fetch('/api/db/persons').then(r => r.json())
    ]).then(([hhData, pData]) => {
      let loadedHouseholds = ALL_HOUSEHOLDS;
      if (hhData.success && hhData.households.length > 0) {
        loadedHouseholds = hhData.households;
      }
      setAllHouseholds(loadedHouseholds);

      let loadedMembers = INITIAL_MEMBERS;
      if (pData.success && pData.persons.length > 0) {
        loadedMembers = pData.persons;
      }
      setMembers(loadedMembers);

      const savedId = localStorage.getItem('granpocket_active_household_id');
      if (savedId) {
        const found = loadedHouseholds.find(h => h.id === savedId);
        if (found) setHousehold(found);
      } else {
        setHousehold(loadedHouseholds[0] || INITIAL_HOUSEHOLD);
      }
    }).catch(err => {
      console.error('Failed to load data from server', err);
      setAllHouseholds(ALL_HOUSEHOLDS);
      setMembers(INITIAL_MEMBERS);
      setHousehold(ALL_HOUSEHOLDS[0] || INITIAL_HOUSEHOLD);
    });
  }, []);

  // (Removed localStorage sync for households and members)

  useEffect(() => {
    try {
      localStorage.setItem('granpocket_active_household_id', household.id);
    } catch (e) {
      console.error('Failed to persist active household id', e);
    }
  }, [household.id]);
  
  // Authentication & Flow State (Structured Step Flow - Persisted across reloads)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    try {
      return localStorage.getItem('granpocket_is_logged_in') === 'true';
    } catch {
      return false;
    }
  });
  const [currentUser, setCurrentUser] = useState<Person | null>(() => {
    try {
      const saved = localStorage.getItem('granpocket_current_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Filter household members strictly by current active household (Tan Family vs App Owner Family vs New Families)
  const currentHouseholdMembers = members.filter(m => m.householdId === household.id);

  // Triage sub-step: 'select_patient' (Who is unwell) vs 'assessment' (Symptom Intake)
  const [triageStep, setTriageStep] = useState<'select_patient' | 'assessment'>('select_patient');

  // Selected Person (defaults to Baby Lucas or first dependent)
  const [selectedPerson, setSelectedPerson] = useState<Person>(() => {
    const lucas = members.find(m => m.id === 'person-lucas' && m.householdId === household.id);
    return lucas || currentHouseholdMembers[0] || members[0];
  });

  // App Language
  const [language, setLanguage] = useState<Language>('en');

  // Navigation Tabs: triage | family | medications | monitoring | facilities | clinical_kb | pdpa_audit
  const [activeTab, setActiveTab] = useState<string>(() => {
    try {
      return localStorage.getItem('granpocket_active_tab') || 'triage';
    } catch {
      return 'triage';
    }
  });

  // Sync auth and tab state to localStorage so refreshes don't log out
  useEffect(() => {
    try {
      localStorage.setItem('granpocket_is_logged_in', String(isLoggedIn));
      if (currentUser) {
        localStorage.setItem('granpocket_current_user', JSON.stringify(currentUser));
      } else {
        localStorage.removeItem('granpocket_current_user');
      }
    } catch (e) {
      console.warn('Failed to persist auth to localStorage', e);
    }
  }, [isLoggedIn, currentUser]);

  useEffect(() => {
    try {
      localStorage.setItem('granpocket_active_tab', activeTab);
    } catch (e) {
      console.warn('Failed to persist activeTab to localStorage', e);
    }
  }, [activeTab]);

  // Active Triage Assessment State
  const [currentResult, setCurrentResult] = useState<TriageResult | null>(null);
  const [currentAilment, setCurrentAilment] = useState<Ailment | undefined>(undefined);
  const [currentAnswers, setCurrentAnswers] = useState<Record<string, any>>({});

  // Medication Logs (Persisted)
  const [medicationLogs, setMedicationLogs] = useState<MedicationLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem('granpocket_med_logs');
      if (saved) {
        const parsed: MedicationLogEntry[] = JSON.parse(saved);
        // Data migration: ensure medlog-02 administered by Sarah Tan, and medlog-01 uses latest Axcel Paracetamol image
        return parsed.map(log => {
          if (log.id === 'medlog-01' && (log.photoUrl?.includes('unsplash') || !log.photoUrl)) {
            return { ...log, photoUrl: '/images/axcel_paracetamol_250.jpg' };
          }
          if (log.id === 'medlog-02' || (log.medicine?.toLowerCase().includes('aspirin') && log.givenBy?.includes('Siti'))) {
            return { ...log, givenBy: 'Sarah Tan (Mom)' };
          }
          return log;
        });
      }
      return INITIAL_MEDICATION_LOGS;
    } catch {
      return INITIAL_MEDICATION_LOGS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('granpocket_med_logs', JSON.stringify(medicationLogs));
    } catch (e) {
      console.error('Failed to persist medication logs', e);
    }
  }, [medicationLogs]);

  // Home Monitoring Plans
  const [monitoringPlans, setMonitoringPlans] = useState<CheckBackPlan[]>(INITIAL_MONITORING_PLANS);

  // Caregiver Scheduler Workflow State
  const [caregiverAlerts, setCaregiverAlerts] = useState<CaregiverAlertEntry[]>([]);
  const [activeAlertToast, setActiveAlertToast] = useState<CaregiverAlertEntry | null>(null);
  const [isSchedulerModalOpen, setIsSchedulerModalOpen] = useState<boolean>(false);
  const [createHouseholdInitialPhone, setCreateHouseholdInitialPhone] = useState<string>('');
  const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(new Set());
  const hasAutoDispatchedRef = useRef<Set<string>>(new Set());

  // Load Caregiver Alerts from SQLite on mount
  useEffect(() => {
    fetchCaregiverAlerts().then(alerts => {
      if (alerts && alerts.length > 0) {
        setCaregiverAlerts(alerts);
      }
    });
  }, []);



  // Handle Remove / Resolve Ongoing Ailment for a Patient
  const handleRemoveAilment = async (personId: string) => {
    // 1. Clear active complaint for the member in state & localStorage
    setMembers(prev => prev.map(m => (m.id === personId ? { ...m, activeComplaint: undefined } : m)));
    if (selectedPerson.id === personId) {
      setSelectedPerson(prev => ({ ...prev, activeComplaint: undefined }));
    }

    // 2. Mark active monitoring plans for this person as completed
    setMonitoringPlans(prev =>
      prev.map(p => (p.subjectId === personId && p.status === 'active' ? { ...p, status: 'completed' } : p))
    );

    // 3. Persist to SQLite
    await resolvePersonAilmentInDb(personId);

    // 4. Add audit event
    const targetMember = members.find(m => m.id === personId);
    const newAudit: AuditEvent = {
      id: `audit-resolve-${Date.now()}`,
      actor: currentUser?.name || 'Caregiver',
      action: 'AILMENT_RESOLVED',
      resource: `Patient ${targetMember?.name || personId}`,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      details: `Ongoing ailment cleared and active monitoring case discharged.`,
    };
    setAuditLogs(prev => [newAudit, ...prev]);
  };

  const handleTriggerSimulatedAlert = (job: ScheduledJob) => {
    const newAlert = createCaregiverAlertFromJob(job);
    setActiveAlertToast(newAlert);
    setCaregiverAlerts(prev => [newAlert, ...prev]);
    saveCaregiverAlertToDb(newAlert);
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    setCaregiverAlerts(prev => prev.map(a => (a.id === alertId ? { ...a, status: 'ACKNOWLEDGED' } : a)));
    if (activeAlertToast?.id === alertId) {
      setActiveAlertToast(null);
    }
    await acknowledgeCaregiverAlertInDb(alertId);
  };

  const handleSnoozeAlert = (alertId: string) => {
    setDismissedAlertIds(prev => new Set(prev).add(alertId));
    if (activeAlertToast?.id === alertId) {
      setActiveAlertToast(null);
    }
    // Re-enable after 30 seconds for quick testing
    setTimeout(() => {
      setDismissedAlertIds(prev => {
        const next = new Set(prev);
        next.delete(alertId);
        return next;
      });
    }, 30000);
  };

  const handleAlertAction = (alert: CaregiverAlertEntry) => {
    setActiveAlertToast(null);
    if (alert.type === 'MEDICINE_DUE') {
      setActiveTab('medications');
    } else {
      setActiveTab('monitoring');
    }
  };

  // Clinical KB Proposals
  const [kbProposals, setKbProposals] = useState<KBChangeProposal[]>(INITIAL_KB_PROPOSALS);

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>(INITIAL_AUDIT_LOGS);

  // App Owner Custom Triage Rules
  const [customRules, setCustomRules] = useState<TriageRule[]>(() => {
    try {
      const saved = localStorage.getItem('granpocket_custom_triage_rules');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('granpocket_custom_triage_rules', JSON.stringify(customRules));
      setDynamicCustomRules(customRules);
    } catch (e) {
      console.error('Failed to persist custom rules', e);
    }
  }, [customRules]);

  const handleAddCustomRule = async (rule: TriageRule) => {
    setCustomRules(prev => [rule, ...prev]);
    await saveRuleToDb(rule); // Save to SQLite
    const newAudit: AuditEvent = {
      id: `audit-rule-${Date.now()}`,
      actor: currentUser?.name || 'Dr. Evelyn Lim (App Owner)',
      action: 'CLINICAL_RULE_ADDED',
      resource: `Rule ${rule.ruleId} (${rule.ailment} -> ${rule.severity})`,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      details: `Conditions: ${rule.when.any?.join(' OR ')} • Reason: ${rule.reasonKey}`,
    };
    setAuditLogs(prev => [newAudit, ...prev]);
  };

  const handleDeleteCustomRule = async (ruleId: string) => {
    setCustomRules(prev => prev.filter(r => r.ruleId !== ruleId));
    await deleteRuleFromDb(ruleId); // Delete from SQLite
  };

  // App Owner Hospital & Facility Registry (Backed by SQLite database)
  const [allFacilities, setAllFacilities] = useState<HospitalFacility[]>(() => {
    try {
      const saved = localStorage.getItem('granpocket_custom_facilities');
      if (saved) {
        const parsed: HospitalFacility[] = JSON.parse(saved);
        const map = new Map<string, HospitalFacility>();
        SINGAPORE_FACILITIES.forEach(f => map.set(f.id, f));
        parsed.forEach(f => map.set(f.id, f));
        return Array.from(map.values());
      }
      return SINGAPORE_FACILITIES;
    } catch {
      return SINGAPORE_FACILITIES;
    }
  });

  // Load facilities from SQLite database
  useEffect(() => {
    const loadDbFacilities = async () => {
      try {
        const dbFacs = await fetchFacilitiesFromDb();
        if (dbFacs && dbFacs.length > 0) {
          const map = new Map<string, HospitalFacility>();
          // Base fallback
          SINGAPORE_FACILITIES.forEach(f => map.set(f.id, f));
          // SQLite records override / append
          dbFacs.forEach(f => map.set(f.id, f));
          setAllFacilities(Array.from(map.values()));
        }
      } catch (err) {
        console.warn('Failed to load facilities from SQLite:', err);
      }
    };
    loadDbFacilities();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('granpocket_custom_facilities', JSON.stringify(allFacilities));
    } catch (e) {
      console.error('Failed to persist custom facilities', e);
    }
  }, [allFacilities]);

  const handleAddFacility = async (fac: HospitalFacility) => {
    setAllFacilities(prev => [fac, ...prev]);
    const newAudit: AuditEvent = {
      id: `audit-fac-${Date.now()}`,
      actor: currentUser?.name || 'Dr. Evelyn Lim (App Owner)',
      action: 'HOSPITAL_FACILITY_ADDED',
      resource: `${fac.name} (${fac.address})`,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      details: `24h ED: ${fac.hasED} • Phone: ${fac.phone} • Lat/Lng: ${fac.lat}/${fac.lng}`,
    };
    setAuditLogs(prev => [newAudit, ...prev]);

    // Persist to SQLite database table `facilities`
    await saveFacilityToDb(fac);
  };

  // Role-Based Access Control State (Backed by SQLite Database)
  const [rolePermissions, setRolePermissions] = useState<Record<SystemRole, RolePermissions>>(() => {
    try {
      const saved = localStorage.getItem('granpocket_rbac_permissions');
      return saved ? JSON.parse(saved) : DEFAULT_ROLE_PERMISSIONS;
    } catch {
      return DEFAULT_ROLE_PERMISSIONS;
    }
  });

  // Load RBAC from SQLite database on mount
  useEffect(() => {
    const loadRbacFromDb = async () => {
      try {
        const [permsRes, membersRes] = await Promise.allSettled([
          fetch('/api/rbac/permissions'),
          fetch('/api/rbac/members'),
        ]);

        if (permsRes.status === 'fulfilled' && permsRes.value.ok) {
          const json = await permsRes.value.json();
          if (json.success && json.permissions) {
            setRolePermissions(json.permissions);
            try {
              localStorage.setItem('granpocket_rbac_permissions', JSON.stringify(json.permissions));
            } catch {}
          }
        }

        if (membersRes.status === 'fulfilled' && membersRes.value.ok) {
          const memJson = await membersRes.value.json();
          if (memJson.success && memJson.memberRoles) {
            setMembers(prev => prev.map(m => {
              const savedRole = memJson.memberRoles[m.id]?.systemRole;
              return savedRole ? { ...m, systemRole: savedRole as SystemRole } : m;
            }));
          }
        }

        // Sync rules, proposals, and patient profiles from SQLite DB
        try {
          const [dbRules, dbProps, dbPersons] = await Promise.all([
            fetchRulesFromDb(),
            fetchProposalsFromDb(),
            fetchPersonsFromDb(),
          ]);
          if (dbRules && dbRules.length > 0) {
            setCustomRules(prev => {
              const existingIds = new Set(prev.map(r => r.ruleId));
              const newOnes = dbRules.filter(r => !existingIds.has(r.ruleId));
              return [...prev, ...newOnes];
            });
          }
          if (dbProps && dbProps.length > 0) {
            setKbProposals(dbProps);
          }
          if (dbPersons && dbPersons.length > 0) {
            setMembers(prev => {
              const dbIds = new Set(dbPersons.map(p => p.id));
              const customMembers = prev.filter(p => !dbIds.has(p.id));
              return [...dbPersons, ...customMembers];
            });
          }
        } catch (dbErr) {
          console.warn('[App] SQLite auto-sync error:', dbErr);
        }
      } catch (err) {
        console.error('Failed to load RBAC from database', err);
      }
    };

    loadRbacFromDb();
  }, []);

  const handleSaveRolePermissions = async (newPerms: Record<SystemRole, RolePermissions>): Promise<boolean> => {
    try {
      const res = await fetch('/api/rbac/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: newPerms }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.permissions) {
          setRolePermissions(json.permissions);
          try {
            localStorage.setItem('granpocket_rbac_permissions', JSON.stringify(json.permissions));
          } catch {}
          return true;
        }
      }
    } catch (err) {
      console.error('Failed to save RBAC to DB:', err);
    }
    return false;
  };

  const handleResetRolePermissions = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/rbac/reset', { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.permissions) {
          setRolePermissions(json.permissions);
          try {
            localStorage.setItem('granpocket_rbac_permissions', JSON.stringify(json.permissions));
          } catch {}
          return true;
        }
      }
    } catch (err) {
      console.error('Failed to reset RBAC in DB:', err);
    }
    return false;
  };

  // Dynamically calculate allowed screens for active login persona
  const activeUserRole: SystemRole = (currentUser?.systemRole as SystemRole) || 'MEMBER';
  const activeRolePerms = rolePermissions[activeUserRole] || DEFAULT_ROLE_PERMISSIONS[activeUserRole] || DEFAULT_ROLE_PERMISSIONS.MEMBER;
  const allowedScreens: ScreenKey[] = activeRolePerms?.allowedScreens || [];

  // Dynamically filter eligible triage subjects based on active role capabilities (Section 3 & 9 Architecture Capability Specification)
  const eligibleTriageMembers = useMemo(() => {
    if (!isLoggedIn || !currentUser) return [];
    const inquirySelfScope = activeRolePerms?.capabilities?.inquiry_self || 'own';
    const inquiryOthersScope = activeRolePerms?.capabilities?.inquiry_others || 'none';

    return currentHouseholdMembers.filter(member => {
      // 1. Assessing oneself
      if (member.id === currentUser.id) {
        return inquirySelfScope !== 'none';
      }
      // 2. Assessing others: check capability scope
      if (inquiryOthersScope === 'full') {
        return true;
      }
      if (inquiryOthersScope === 'care_recipients') {
        // Must be a designated care recipient linked via careLinks
        return member.careLinks?.some(link => link.caregiverPersonId === currentUser.id);
      }
      return false;
    });
  }, [currentHouseholdMembers, currentUser, activeRolePerms]);

  // Dynamically filter eligible members and logs for Medication Log & Safety tab based on active role capabilities (Section 3 & 9)
  const eligibleMedicationMembers = useMemo(() => {
    if (!isLoggedIn || !currentUser) return [];
    const medLogScope = activeRolePerms?.capabilities?.medication_log || 'none';

    if (medLogScope === 'full') {
      return currentHouseholdMembers;
    }
    if (medLogScope === 'care_recipients') {
      return currentHouseholdMembers.filter(member => {
        // Self or designated care recipient
        if (member.id === currentUser.id) return true;
        return member.careLinks?.some(link => link.caregiverPersonId === currentUser.id);
      });
    }
    if (medLogScope === 'own') {
      return currentHouseholdMembers.filter(member => member.id === currentUser.id);
    }
    return [];
  }, [currentHouseholdMembers, currentUser, activeRolePerms]);

  const eligibleMedicationLogs = useMemo(() => {
    const allowedIds = new Set(eligibleMedicationMembers.map(m => m.id));
    return medicationLogs.filter(log => allowedIds.has(log.subjectId));
  }, [medicationLogs, eligibleMedicationMembers]);

  // Dynamically filter active check-back home monitoring plans based on caregiving responsibilities
  const eligibleMonitoringPlans = useMemo(() => {
    const allowedIds = new Set(eligibleMedicationMembers.map(m => m.id));
    return monitoringPlans.filter(plan => allowedIds.has(plan.subjectId));
  }, [monitoringPlans, eligibleMedicationMembers]);

  // Dynamically filter eligible members for scheduled alerts & jobs based on active role capabilities (Section 3 & 9: receive_alerts)
  const eligibleAlertMembers = useMemo(() => {
    if (!isLoggedIn || !currentUser) return [];
    const alertScope = activeRolePerms?.capabilities?.receive_alerts || 'none';

    if (alertScope === 'full') {
      return currentHouseholdMembers;
    }
    if (alertScope === 'care_recipients') {
      return currentHouseholdMembers.filter(member => {
        // Self or designated care recipient linked via careLinks
        if (member.id === currentUser.id) return true;
        return member.careLinks?.some(link => link.caregiverPersonId === currentUser.id);
      });
    }
    if (alertScope === 'own') {
      return currentHouseholdMembers.filter(member => member.id === currentUser.id);
    }
    return [];
  }, [currentHouseholdMembers, currentUser, activeRolePerms]);

  // Compute active scheduled jobs dynamically (scoped to eligible alert members and active caregiver)
  const scheduledJobs = useMemo(() => {
    return computeScheduledJobs(
      eligibleAlertMembers,
      eligibleMonitoringPlans,
      medicationLogs,
      currentUser
    );
  }, [eligibleAlertMembers, eligibleMonitoringPlans, medicationLogs, currentUser]);

  const dueJobs = useMemo(() => {
    return scheduledJobs.filter(j => j.status === 'DUE_NOW');
  }, [scheduledJobs]);

  const eligibleCaregiverAlerts = useMemo(() => {
    if (!isLoggedIn || !currentUser) return [];
    const alertScope = activeRolePerms?.capabilities?.receive_alerts || 'none';
    if (alertScope === 'none') return [];

    const allowedPatientIds = new Set(eligibleAlertMembers.map(m => m.id));
    const allowedPatientNames = new Set(eligibleAlertMembers.map(m => m.name.toLowerCase()));

    return caregiverAlerts.filter(a => {
      // Must be strictly scoped to this household: either patient is an eligible member or caregiver matches current user
      const matchesPatient = (a.patientId && allowedPatientIds.has(a.patientId)) || 
                             (a.patientName && allowedPatientNames.has(a.patientName.toLowerCase()));
      const matchesCaregiver = a.caregiverId === currentUser.id || 
                               (a.caregiverName && a.caregiverName.toLowerCase() === currentUser.name.toLowerCase());
      return matchesPatient || matchesCaregiver;
    });
  }, [caregiverAlerts, eligibleAlertMembers, currentUser, activeRolePerms]);

  // Automated Caregiver Alert Dispatcher
  useEffect(() => {
    if (!isLoggedIn || !currentUser) {
      setActiveAlertToast(null);
      return;
    }

    // If there is an active job due and no active toast, pick the first un-dismissed due job and trigger alert once
    // Ensure the alert is user-centric (only pops up for the designated caregiver in this household)
    const firstDue = dueJobs.find(j => 
      !dismissedAlertIds.has(j.id) && 
      !hasAutoDispatchedRef.current.has(j.id) && 
      j.caregiverId === currentUser.id &&
      eligibleAlertMembers.some(m => m.id === j.patientId)
    );
    if (firstDue && !activeAlertToast) {
      hasAutoDispatchedRef.current.add(firstDue.id);
      const newAlert = createCaregiverAlertFromJob(firstDue);
      setActiveAlertToast(newAlert);
      setCaregiverAlerts(prev => [newAlert, ...prev]);
      saveCaregiverAlertToDb(newAlert);
    }
  }, [dueJobs, dismissedAlertIds, activeAlertToast, currentUser, eligibleAlertMembers, isLoggedIn]);

  // Dynamically filter members visible in Family Profiles based on active role capabilities (Section 3 & 9: view_own_profile & view_others_profile)
  const eligibleProfileMembers = useMemo(() => {
    if (!isLoggedIn || !currentUser) return [];
    const ownScope = activeRolePerms?.capabilities?.view_own_profile || 'none';
    const othersScope = activeRolePerms?.capabilities?.view_others_profile || 'none';

    if (othersScope === 'full') {
      return currentHouseholdMembers;
    }

    return currentHouseholdMembers.filter(member => {
      // 1. Viewing own profile
      if (member.id === currentUser.id) {
        return ownScope !== 'none';
      }
      // 2. Viewing others' profiles
      if (othersScope === 'care_recipients') {
        return member.careLinks?.some(link => link.caregiverPersonId === currentUser.id);
      }
      return false;
    });
  }, [currentHouseholdMembers, currentUser, activeRolePerms]);

  // Ensure selectedPerson is always an eligible member for current persona in triage and profile
  useEffect(() => {
    if (eligibleProfileMembers.length > 0 && !eligibleProfileMembers.some(m => m.id === selectedPerson.id)) {
      setSelectedPerson(eligibleProfileMembers[0]);
    }
  }, [eligibleProfileMembers, selectedPerson.id]);

  // Dynamically filter audit logs for Audit & PDPA based on active role capabilities (Section 3 & 9: view_inquiry_results)
  const eligibleAuditLogs = useMemo(() => {
    if (!currentUser) return auditLogs;
    const historyScope = activeRolePerms?.capabilities?.view_inquiry_results || 'none';
    if (historyScope === 'full') return auditLogs;

    const allowedNames = new Set(eligibleProfileMembers.map(m => m.name.toLowerCase()));
    return auditLogs.filter(log => {
      const lowerRes = (log.resource || '').toLowerCase();
      const lowerActor = (log.actor || '').toLowerCase();
      if (log.action?.includes('SYSTEM') || log.action?.includes('POLICY')) return true;
      return Array.from(allowedNames).some(name => lowerRes.includes(name) || lowerActor.includes(name));
    });
  }, [auditLogs, eligibleProfileMembers, currentUser, activeRolePerms]);

  // Reconcile activeTab whenever persona or allowedScreens changes based on DB permissions
  useEffect(() => {
    if (isLoggedIn && allowedScreens.length > 0) {
      if (!allowedScreens.includes(activeTab as ScreenKey)) {
        setActiveTab(allowedScreens[0]);
      }
    }
  }, [currentUser?.id, currentUser?.systemRole, allowedScreens, isLoggedIn, activeTab]);

  // Environment Safety Mode (CLIN-03): 'mvp' vs 'production'
  const [environmentMode, setEnvironmentMode] = useState<'mvp' | 'production'>('mvp');

  // Modals
  const [isSosOpen, setIsSosOpen] = useState(false);
  const [isCrisisOpen, setIsCrisisOpen] = useState(false);
  const [isCreateHouseholdOpen, setIsCreateHouseholdOpen] = useState(false);
  const [triageMode, setTriageMode] = useState<'rule-based' | 'agentic'>('rule-based');

  // Triage Completion Handler
  const handleTriageComplete = (result: TriageResult, answers: Record<string, any>, ailment?: Ailment) => {
    setCurrentResult(result);
    setCurrentAnswers(answers);
    setCurrentAilment(ailment);

    // Append to immutable audit log (SRS PRIV-04)
    const newAudit: AuditEvent = {
      id: `audit-${Date.now()}`,
      actor: `Caregiver acting for ${selectedPerson.name}`,
      action: `TRIAGE_COMPLETED_${result.severity}`,
      resource: `${selectedPerson.name} (${ailment?.name || 'General Symptoms'})`,
      timestamp: new Date().toISOString(),
      version: '1.0.0-provisional',
      details: `Rule IDs: ${result.triggeredRuleIds.join(', ')} • Action: ${result.action}`,
    };
    setAuditLogs(prev => [newAudit, ...prev]);

    // Save triage assessment to DB
    saveTriageAssessmentToDb({
      id: `triage-${Date.now()}`,
      date: new Date().toLocaleDateString('en-CA'),
      time: new Date().toLocaleTimeString('en-GB'),
      requested_by_id: currentUser?.id,
      requested_by_name: currentUser?.name || 'Unknown',
      information_provided: answers ? JSON.stringify(answers) : 'None',
      triage_method: triageMode,
      triage_outcome: result.severity,
      triage_rationale: result.reasons?.join(' ') || 'No rationale provided'
    }).catch(err => console.error('Failed to save triage assessment:', err));

    // If RED, automatically open Emergency SOS prompt if not already open
    if (result.severity === 'RED') {
      // Trigger emergency flow
    }
  };

  // Add Medication Log Handler
  const handleAddMedicationLog = (log: MedicationLogEntry) => {
    setMedicationLogs(prev => [log, ...prev]);

    // Append to audit log
    const newAudit: AuditEvent = {
      id: `audit-med-${Date.now()}`,
      actor: log.givenBy,
      action: 'MEDICATION_ADMINISTERED',
      resource: `${log.subjectName} / ${log.medicine}`,
      timestamp: new Date().toISOString(),
      version: '1.0.0-provisional',
      details: `Dose: ${log.dose} • Photo verified: ${Boolean(log.photoUrl)}`,
    };
    setAuditLogs(prev => [newAudit, ...prev]);
  };

  // Add Member Handler
  const handleAddMember = (newPerson: Person) => {
    setMembers(prev => [...prev, newPerson]);
    fetch('/api/db/persons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newPerson) }).catch(console.error);

    const newAudit: AuditEvent = {
      id: `audit-mem-${Date.now()}`,
      actor: 'Admin',
      action: 'MEMBER_ADDED',
      resource: `${newPerson.name} (${newPerson.relationshipLabel})`,
      timestamp: new Date().toISOString(),
      version: '1.0.0-provisional',
    };
    setAuditLogs(prev => [newAudit, ...prev]);
  };

  // Update Member Handler
  const handleUpdatePerson = (updated: Person) => {
    setMembers(prev => prev.map(m => (m.id === updated.id ? updated : m)));
    fetch('/api/db/persons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) }).catch(console.error);
    if (selectedPerson.id === updated.id) {
      setSelectedPerson(updated);
    }
  };

  // Delete Member Handler
  const handleDeleteMember = (personId: string) => {
    setMembers(prev => prev.filter(m => m.id !== personId));
    fetch(`/api/db/persons/${personId}`, { method: 'DELETE' }).catch(console.error);
    if (selectedPerson.id === personId && currentUser) {
      setSelectedPerson(currentUser);
    }
  };

  // Create Check-Back Monitoring Plan from Triage Result
  const handleCreateMonitoringPlan = () => {
    if (!currentResult) return;

    const newPlan: CheckBackPlan = {
      id: `plan-${Date.now()}`,
      inquiryId: `inq-${Date.now()}`,
      subjectId: selectedPerson.id,
      subjectName: selectedPerson.name,
      interval: currentResult.severity === 'ORANGE' ? '2 hours' : '8 hours',
      nextCheckAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      status: 'active',
      initialSeverity: currentResult.severity,
      checkIns: [
        {
          id: `ci-${Date.now()}`,
          planId: `plan-${Date.now()}`,
          sentAt: new Date().toISOString(),
          response: 'same',
          vitals: {
            progression: 'stable',
            timestamp: new Date().toISOString(),
          },
        },
      ],
    };

    setMonitoringPlans(prev => [newPlan, ...prev]);

    // Add OTC medications to person profile if they exist
    if (currentResult.otcMedications && currentResult.otcMedications.length > 0) {
      const updatedPerson = { ...selectedPerson };
      if (!updatedPerson.medicalProfile) {
        updatedPerson.medicalProfile = { conditions: [], medications: [], allergies: [], intolerances: [], vaccinations: [] };
      }
      
      const existingMeds = updatedPerson.medicalProfile.medications || [];
      const ageBand = getAgeBand(selectedPerson.dob);
      const doseMap = currentResult.medicationDoseByAge || {};
      const targetDose = doseMap[ageBand] || (['toddler'].includes(ageBand) ? '2.5ml' : ['child'].includes(ageBand) ? '5ml' : ['adolescent', 'adult', 'elderly'].includes(ageBand) ? '10ml' : 'N/A');
      const medFrequency = currentResult.medicationFrequency || 'As needed (PRN)';
      
      const newMedsToAdd = currentResult.otcMedications.filter(
        newMed => !existingMeds.some(m => m.name.toLowerCase() === newMed.toLowerCase())
      ).map(med => ({
        id: `med-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: med,
        dose: targetDose,
        frequency: medFrequency,
        minIntervalHours: medFrequency.includes('6 hours') ? 6 : medFrequency.includes('3 times') ? 8 : 4,
      }));

      if (newMedsToAdd.length > 0) {
        updatedPerson.medicalProfile.medications = [...existingMeds, ...newMedsToAdd];
        handleUpdatePerson(updatedPerson);
      }
    }

    // Integrated with Scheduler notification
    console.log('[Scheduler] Care Plan and OTC Medications integrated with Scheduler.');
    setActiveTab('monitoring');
  };

  // Trigger Deterioration Re-Triage
  const handleTriggerDeterioration = (person: Person, reason: string, newSeverity: Severity) => {
    setSelectedPerson(person);
    setCurrentResult({
      severity: newSeverity,
      action: newSeverity === 'RED' ? 'Emergency Escalation: Deterioration Detected' : 'Urgent Review Required',
      timeframe: newSeverity === 'RED' ? 'Now' : 'Within hours',
      careTierText: newSeverity === 'RED' ? 'Call 995 immediately. Condition worsened significantly during check-in.' : 'Visit nearest 24hr clinic.',
      reasons: [reason],
      whenToWorry: ['Call 995 immediately if breathing becomes difficult or person is unresponsive.'],
      disclaimer: 'GranPocket triage guidance. When in doubt, call 995.',
      contentStatusLabel: 'PROVISIONAL',
      triggeredRuleIds: ['MONITORING-DETERIORATION-ESCALATION'],
      grandmaExplanation: `Listen to me, dear. ${person.name}'s symptoms have worsened since our last check-in. We cannot wait any longer. Please seek urgent care right away.`,
    });
    setActiveTab('triage');
  };

  // KB Proposal Approval
  const handleApproveProposal = async (proposalId: string, doctorName: string, mcr: string) => {
    setKbProposals(prev =>
      prev.map(p =>
        p.id === proposalId
          ? {
              ...p,
              status: 'approved',
              reviewedBy: `${doctorName} (${mcr})`,
              reviewedAt: new Date().toISOString(),
            }
          : p
      )
    );

    // Persist approval & SMC MCR into SQLite
    await updateProposalStatusInDb(proposalId, 'APPROVED', doctorName, mcr);

    const newAudit: AuditEvent = {
      id: `audit-kb-${Date.now()}`,
      actor: `${doctorName} (${mcr})`,
      action: 'CLINICAL_PROPOSAL_APPROVED',
      resource: `Proposal ${proposalId}`,
      timestamp: new Date().toISOString(),
      version: '1.0.0-clinically-approved',
      details: 'SMC medical review completed and signed off',
    };
    setAuditLogs(prev => [newAudit, ...prev]);
  };

  // KB Proposal Deletion
  const handleDeleteProposal = async (proposalId: string) => {
    setKbProposals(prev => prev.filter(p => p.id !== proposalId));

    try {
      await fetch(`/api/agentic/proposals/${proposalId}`, { method: 'DELETE' });
    } catch (e) {
      console.error('Failed to delete proposal from DB', e);
    }
  };

  // KB Proposal Move to Pending
  const handleMoveToPendingProposal = async (proposalId: string) => {
    setKbProposals(prev =>
      prev.map(p =>
        p.id === proposalId
          ? {
              ...p,
              status: 'pending_review',
              reviewedBy: undefined,
              reviewedAt: undefined,
              signOffBy: undefined,
              mcrNumber: undefined,
            }
          : p
      )
    );

    try {
      await updateProposalStatusInDb(proposalId, 'pending_review', '', '');
      const newAudit: AuditEvent = {
        id: `audit-kb-${Date.now()}`,
        actor: 'SMC Clinician Governance Console',
        action: 'CLINICAL_PROPOSAL_REVERTED_TO_PENDING',
        resource: `Proposal ${proposalId}`,
        timestamp: new Date().toISOString(),
        version: '1.0.0-pending-review',
        details: 'Approved rule moved back to pending status for further clinical review',
      };
      setAuditLogs(prev => [newAudit, ...prev]);
    } catch (e) {
      console.error('Failed to move proposal to pending in DB', e);
    }
  };

  // Create New Household & Seed Clinical/Caregiver Data
  const handleCreateHousehold = (data: {
    name: string;
    addressText: string;
    postalCode: string;
    caregiverName: string;
    caregiverRelationship: string;
    caregiverPhone: string;
    seedSampleData: boolean;
  }) => {
    const newHouseholdId = `hh-custom-${Date.now()}`;
    const geo = lookupSingaporePostalCode(data.postalCode);
    const resolvedAddress = data.addressText || (geo ? geo.address : `Singapore Postal Sector ${data.postalCode}`);
    const resolvedLat = geo ? geo.lat : 1.3521;
    const resolvedLng = geo ? geo.lng : 103.8198;

    const newHousehold: Household = {
      id: newHouseholdId,
      name: data.name,
      defaultRegion: 'Central',
      addresses: [
        {
          id: `addr-${Date.now()}`,
          householdId: newHouseholdId,
          label: 'Home',
          text: resolvedAddress,
          postalCode: data.postalCode,
          lat: resolvedLat,
          lng: resolvedLng,
          isPrimary: true,
        },
      ],
      emergencyContacts: [
        {
          id: `ec-${Date.now()}`,
          householdId: newHouseholdId,
          name: data.caregiverName,
          relationship: data.caregiverRelationship,
          phone: data.caregiverPhone,
          priority: 1,
        },
      ],
      createdAt: new Date().toISOString(),
    };

    const isFather = /father|dad|husband|brother|uncle/i.test(data.caregiverRelationship);
    const isHelper = /helper|maid/i.test(data.caregiverRelationship);
    const avatar = isFather ? '👨' : (isHelper ? '🧕' : '👩');

    const caregiverPerson: Person = {
      id: `person-cg-${Date.now()}`,
      householdId: newHouseholdId,
      name: data.caregiverName,
      dob: '1988-05-12',
      sex: isFather ? 'male' : 'female',
      relationshipLabel: data.caregiverRelationship,
      language: language,
      hasLogin: true,
      phone: data.caregiverPhone,
      systemRole: 'ADMIN',
      avatar: avatar,
      postalCode: data.postalCode,
      medicalProfile: {
        bloodType: 'O+',
        conditions: [],
        allergies: [],
        intolerances: [],
        medications: [],
        vaccinations: [],
      },
    };

    const newMembersList: Person[] = [caregiverPerson];
    const newMedLogs: MedicationLogEntry[] = [];
    let defaultSelectedPerson: Person = caregiverPerson;

    if (data.seedSampleData) {
      const cleanSurname = data.name.replace(/^(The\s+)|(\s+(Family|Household))$/gi, '').trim() || 'Family';
      const childId = `person-child-${Date.now()}`;
      const childPerson: Person = {
        id: childId,
        householdId: newHouseholdId,
        name: `Chloe ${cleanSurname}`,
        dob: '2023-04-10', // ~3.5 years old
        sex: 'female',
        relationshipLabel: 'Daughter / Child',
        language: language,
        hasLogin: false,
        systemRole: 'DEPENDENT',
        avatar: '👧🏻',
        postalCode: data.postalCode,
        careLinks: [
          { caregiverPersonId: caregiverPerson.id, recipientPersonId: childId, type: 'primary_caregiver' },
        ],
        medicalProfile: {
          bloodType: 'A+',
          weight: 14.5,
          conditions: [
            { id: `c-asthma-${Date.now()}`, name: 'Mild Childhood Asthma (Step 1)', type: 'Respiratory' },
          ],
          allergies: [
            { id: `a-pen-${Date.now()}`, name: 'Amoxicillin / Penicillins', severity: 'moderate', type: 'drug' },
          ],
          intolerances: [],
          medications: [
            { id: `m-vent-${Date.now()}`, name: 'Salbutamol Inhaler (Ventolin)', dose: '100mcg', frequency: 'PRN for wheezing', minIntervalHours: 4 },
          ],
          vaccinations: [],
          lastReviewedDate: new Date().toISOString().slice(0, 10),
        },
        insurance: {
          provider: 'Prudential',
          plan: 'PRUShield Premier',
          policyId: 'PRU-772910',
          panelStatus: 'Active Panel Cover',
        },
      };

      const grandmaId = `person-gm-${Date.now()}`;
      const grandmaPerson: Person = {
        id: grandmaId,
        householdId: newHouseholdId,
        name: `Ah Ma ${cleanSurname}`,
        dob: '1952-11-20', // ~73 years old
        sex: 'female',
        relationshipLabel: 'Grandmother',
        language: language,
        hasLogin: false,
        systemRole: 'DEPENDENT',
        avatar: '👵',
        postalCode: data.postalCode,
        careLinks: [
          { caregiverPersonId: caregiverPerson.id, recipientPersonId: grandmaId, type: 'primary_caregiver' },
        ],
        medicalProfile: {
          bloodType: 'B+',
          weight: 58.0,
          conditions: [
            { id: `c-htn-${Date.now()}`, name: 'Essential Hypertension', type: 'Cardiovascular' },
            { id: `c-t2dm-${Date.now()}`, name: 'Type 2 Diabetes Mellitus (HbA1c 6.8%)', type: 'Endocrine' },
          ],
          allergies: [
            { id: `a-nsaid-${Date.now()}`, name: 'Ibuprofen / NSAIDs', severity: 'severe', type: 'drug' },
          ],
          intolerances: [],
          medications: [
            { id: `m-amlod-${Date.now()}`, name: 'Amlodipine Besylate', dose: '5mg', frequency: 'Once daily morning', minIntervalHours: 24 },
            { id: `m-metf-${Date.now()}`, name: 'Metformin XR', dose: '500mg', frequency: 'Twice daily with meals', minIntervalHours: 12 },
          ],
          vaccinations: [],
          lastReviewedDate: new Date().toISOString().slice(0, 10),
        },
        insurance: {
          provider: 'MediShield Life',
          plan: 'Standard Integrated Shield',
          policyId: 'MSL-552194',
          panelStatus: 'Active Panel Cover',
        },
      };

      newMembersList.push(childPerson, grandmaPerson);
      defaultSelectedPerson = childPerson;

      const recentTime = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      newMedLogs.push({
        id: `log-seed-1-${Date.now()}`,
        subjectId: childPerson.id,
        subjectName: childPerson.name,
        givenBy: `${caregiverPerson.name} (${caregiverPerson.relationshipLabel})`,
        medicine: 'Salbutamol Inhaler (Ventolin)',
        dose: '100mcg',
        givenAt: recentTime,
        notes: 'Routine maintenance puff given',
      });
      newMedLogs.push({
        id: `log-seed-2-${Date.now()}`,
        subjectId: grandmaPerson.id,
        subjectName: grandmaPerson.name,
        givenBy: `${caregiverPerson.name} (${caregiverPerson.relationshipLabel})`,
        medicine: 'Amlodipine Besylate',
        dose: '5mg',
        givenAt: recentTime,
        notes: 'Morning blood pressure dose',
      });
    }

    // Prevent duplicates by checking existing household name
    fetch('/api/db/households', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newHousehold) }).catch(console.error);
    newMembersList.forEach(m => fetch('/api/db/persons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(m) }).catch(console.error));
    setAllHouseholds(prev => {
      const existingIdx = prev.findIndex(h => h.name.trim().toLowerCase() === newHousehold.name.trim().toLowerCase());
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = newHousehold;
        return updated;
      }
      return [...prev, newHousehold];
    });

    setMembers(prev => {
      // Remove previous members for this household name if replacing
      const existing = allHouseholds.find(h => h.name.trim().toLowerCase() === newHousehold.name.trim().toLowerCase());
      const filtered = existing ? prev.filter(m => m.householdId !== existing.id) : prev;
      return [...filtered, ...newMembersList];
    });

    if (newMedLogs.length > 0) {
      setMedicationLogs(prev => [...newMedLogs, ...prev]);
    }

    // Persist new members to SQLite database
    newMembersList.forEach(p => {
      savePersonToDb(p);
    });

    setActiveAlertToast(null);
    hasAutoDispatchedRef.current.clear();
    setHousehold(newHousehold);
    setCurrentUser(caregiverPerson);
    setSelectedPerson(defaultSelectedPerson);
    setIsLoggedIn(true);
    setTriageStep('select_patient');
    setActiveTab('family');

    try {
      localStorage.setItem('granpocket_is_logged_in', 'true');
      localStorage.setItem('granpocket_current_user', JSON.stringify(caregiverPerson));
      localStorage.setItem('granpocket_active_tab', 'family');
      localStorage.setItem('granpocket_active_household_id', newHouseholdId);
    } catch {}

    const newAudit: AuditEvent = {
      id: `audit-hh-${Date.now()}`,
      actor: caregiverPerson.name,
      action: 'HOUSEHOLD_CREATED',
      resource: `${newHousehold.name} (${newHousehold.addresses[0]?.postalCode})`,
      timestamp: new Date().toISOString(),
      version: '1.0.0-provisional',
      details: `Caregiver: ${caregiverPerson.name} • Seed data: ${data.seedSampleData ? 'Yes' : 'No'}`,
    };
    setAuditLogs(prev => [newAudit, ...prev]);
  };

  // Switch Active Household
  const handleSwitchHousehold = (targetId: string) => {
    const target = allHouseholds.find(h => h.id === targetId);
    if (!target) return;
    setHousehold(target);
    const houseMembers = members.filter(m => m.householdId === target.id);
    const caregiver = houseMembers.find(m => m.systemRole === 'CAREGIVER') || houseMembers[0];
    const dependent = houseMembers.find(m => m.systemRole === 'DEPENDENT') || houseMembers[0] || caregiver;
    if (caregiver) setCurrentUser(caregiver);
    if (dependent) setSelectedPerson(dependent);
    setCurrentResult(null);
    setTriageStep('select_patient');
  };

  // Reset to Baseline Demo Data
  const handleResetDemoData = () => {
    try {
      localStorage.removeItem('granpocket_all_households');
      localStorage.removeItem('granpocket_members');
      localStorage.removeItem('granpocket_med_logs');
      localStorage.removeItem('granpocket_active_household_id');
    } catch {}
    setAllHouseholds(ALL_HOUSEHOLDS);
    setMembers(INITIAL_MEMBERS);
    setMedicationLogs(INITIAL_MEDICATION_LOGS);
    setHousehold(INITIAL_HOUSEHOLD);
    const sarah = INITIAL_MEMBERS.find(m => m.id === 'person-sarah') || INITIAL_MEMBERS[1];
    const lucas = INITIAL_MEMBERS.find(m => m.id === 'person-lucas') || INITIAL_MEMBERS[0];
    setCurrentUser(sarah);
    setSelectedPerson(lucas);
    setCurrentResult(null);
    setTriageStep('select_patient');
  };

  let primaryAddress = household.addresses?.[0];
  if (primaryAddress && (!primaryAddress.lat || !primaryAddress.lng) && primaryAddress.postalCode) {
    const geo = lookupSingaporePostalCode(primaryAddress.postalCode);
    if (geo) {
      primaryAddress = { ...primaryAddress, lat: geo.lat, lng: geo.lng };
    }
  }
  
  if (!primaryAddress) {
    primaryAddress = {
      id: 'addr-default',
      householdId: household.id,
      label: 'Home',
      text: 'Block 123 Toa Payoh Lorong 1, #08-456, Singapore 310123',
      postalCode: '310123',
      lat: 1.3325,
      lng: 103.8475,
      isPrimary: true,
    };
  }

  // STEP 1: Unauthenticated Flow -> Login Page (SRS AUTH-01 to AUTH-08)
  // Login success handler with automatic household & persona switching
  const handleLoginSuccess = (user: Person) => {
    setActiveAlertToast(null);
    hasAutoDispatchedRef.current.clear();
    setCurrentUser(user);
    setIsLoggedIn(true);

    const userHousehold = allHouseholds.find(h => h.id === user.householdId);
    const userRole: SystemRole = (user.systemRole as SystemRole) || 'MEMBER';
    const userRoleConfig = rolePermissions[userRole] || DEFAULT_ROLE_PERMISSIONS[userRole] || DEFAULT_ROLE_PERMISSIONS.MEMBER;
    const userScreens: ScreenKey[] = userRoleConfig?.allowedScreens || [];

    if (user.systemRole === 'APP_OWNER') {
      setHousehold(APP_OWNER_HOUSEHOLD);
      setSelectedPerson(user);
      setActiveTab(userScreens.includes('owner_admin') ? 'owner_admin' : (userScreens[0] || 'owner_admin'));
      setLanguage('en');
    } else if (userHousehold) {
      setHousehold(userHousehold);
      const houseMembers = members.filter(m => m.householdId === userHousehold.id);
      const dependent = houseMembers.find(m => m.systemRole === 'DEPENDENT') || houseMembers[0] || user;
      setSelectedPerson(dependent);
      setTriageStep('select_patient');
      const defaultScreen = userScreens.includes('family') ? 'family' : (userScreens[0] || 'facilities');
      setActiveTab(defaultScreen);
      if (user.language) setLanguage(user.language);
    } else {
      // Custom household or fallback
      const customHh = allHouseholds.find(h => h.id === user.householdId);
      if (customHh) {
        setHousehold(customHh);
        setSelectedPerson(user);
      } else {
        const fallbackHousehold: Household = {
          id: user.householdId || `hh-custom-${Date.now()}`,
          name: `${user.name}'s Family Household`,
          defaultRegion: 'Central',
          addresses: [
            {
              id: `addr-${Date.now()}`,
              householdId: user.householdId || `hh-custom-${Date.now()}`,
              label: 'Home',
              text: 'Singapore',
              postalCode: '310123',
              lat: 1.3521,
              lng: 103.8198,
              isPrimary: true,
            },
          ],
          emergencyContacts: [
            {
              id: `ec-${Date.now()}`,
              householdId: user.householdId || `hh-custom-${Date.now()}`,
              name: user.name,
              relationship: user.relationshipLabel || 'Admin',
              phone: user.phone || '+65 9123-4567',
              priority: 1,
            },
          ],
          createdAt: new Date().toISOString(),
        };
        setAllHouseholds(prev => [...prev, fallbackHousehold]);
        setHousehold(fallbackHousehold);
        setSelectedPerson(user);
      }
      setActiveTab('family');
      if (user.language) setLanguage(user.language);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setCurrentResult(null);
    setActiveAlertToast(null);
    hasAutoDispatchedRef.current.clear();
    setTriageStep('select_patient');
    setHousehold(INITIAL_HOUSEHOLD);
    setSelectedPerson(members.find(m => m.id === 'person-lucas') || members[0]);
    try {
      localStorage.removeItem('granpocket_is_logged_in');
      localStorage.removeItem('granpocket_current_user');
      localStorage.removeItem('granpocket_active_tab');
    } catch {}
  };

  // STEP 1: Unauthenticated Flow -> Login Page (SRS AUTH-01 to AUTH-08)
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#FAFBFA] dark:bg-[#091014] font-sans antialiased text-[#14212B] dark:text-[#F1F5F9] transition-colors">
        <LoginPage
          onLoginSuccess={handleLoginSuccess}
          onRegisterUser={handleAddMember}
          members={members}
          onOpenSos={() => setIsSosOpen(true)}
          language={language}
          onSelectLanguage={(lang) => setLanguage(lang)}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
          onOpenCreateHousehold={(phone?: string) => {
            if (phone) setCreateHouseholdInitialPhone(phone);
            setIsCreateHouseholdOpen(true);
          }}
          allHouseholds={allHouseholds}
        />

        {/* Global Emergency 995 Modal reachable without authentication (SRS AUTH-08) */}
        <EmergencySosModal
          isOpen={isSosOpen}
          onClose={() => setIsSosOpen(false)}
          person={selectedPerson}
          address={primaryAddress}
          emergencyContacts={household.emergencyContacts}
          language={language}
        />

        {/* Create Household Modal from Login Page */}
        <CreateHouseholdModal
          isOpen={isCreateHouseholdOpen}
          onClose={() => setIsCreateHouseholdOpen(false)}
          onCreateHousehold={handleCreateHousehold}
          language={language}
          initialPhone={createHouseholdInitialPhone}
          existingPhones={members.map(m => m.phone).filter((p): p is string => !!p)}
        />
      </div>
    );
  }

  // STEP 2 & 3: Authenticated Flow
  return (
    <div className="min-h-screen bg-[#FAFBFA] dark:bg-[#091014] flex flex-col font-sans antialiased text-[#14212B] dark:text-[#F1F5F9] transition-colors pb-16 md:pb-0">
      {/* Persistent Navigation Header */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'triage' && !currentResult) {
            // Keep current step or let user triage
          }
        }}
        selectedPerson={selectedPerson}
        members={currentHouseholdMembers}
        onSelectPerson={(p) => {
          setSelectedPerson(p);
          setCurrentResult(null);
          setTriageStep('assessment');
        }}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenWhoIsUnwell={() => {
          setActiveTab('triage');
          setTriageStep('select_patient');
          setCurrentResult(null);
        }}
        language={language}
        onSelectLanguage={(lang) => setLanguage(lang)}
        onOpenSos={() => setIsSosOpen(true)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
        showPatientSwitcher={!(activeTab === 'triage' && triageStep === 'select_patient')}
        household={household}
        allHouseholds={allHouseholds}
        onSwitchHousehold={handleSwitchHousehold}
        allowedScreens={allowedScreens}
        onOpenScheduler={() => setIsSchedulerModalOpen(true)}
        dueAlertCount={dueJobs.length}
        triageMode={triageMode}
        onToggleTriageMode={() => setTriageMode(prev => prev === 'rule-based' ? 'agentic' : 'rule-based')}
      />

      {/* Main Content View */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* Dynamic RBAC Screen Access Guard */}
        {!allowedScreens.includes(activeTab as ScreenKey) ? (
          <div className="bg-white dark:bg-[#14212B] border border-amber-200 dark:border-amber-800/40 rounded-3xl p-8 max-w-lg mx-auto text-center space-y-4 shadow-sm my-12 animate-fadeIn">
            <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto text-2xl border border-amber-200 dark:border-amber-800">
              🛡️
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">Screen Access Restricted</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Your active persona <strong className="text-slate-900 dark:text-white">{currentUser?.name}</strong> has role{' '}
              <span className="font-bold text-[#0F766E] dark:text-[#2DD4BF]">[{activeUserRole}]</span> ({activeRolePerms.label}).
              Access to this screen (<strong className="capitalize">{activeTab.replace('_', ' ')}</strong>) is restricted based on the role permissions configured in the database.
            </p>
            <div className="p-3 bg-slate-50 dark:bg-[#0F1A20] rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500 text-left space-y-2">
              <div className="font-bold text-slate-700 dark:text-slate-300">Permitted screens for [{activeUserRole}]:</div>
              <div className="flex flex-wrap gap-1.5">
                {allowedScreens.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setActiveTab(s)}
                    className="px-2.5 py-1 bg-white dark:bg-[#1E2D37] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-bold hover:border-[#0F766E] transition-all capitalize"
                  >
                    {s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab(allowedScreens[0] || 'triage')}
              className="w-full py-2.5 bg-[#0F766E] hover:bg-[#115E59] text-white rounded-xl text-xs font-bold shadow transition-all"
            >
              Go to Allowed Screen ({allowedScreens[0] || 'triage'})
            </button>
          </div>
        ) : (
          <>
            {/* TAB 1: Structured Triage Flow */}
            {activeTab === 'triage' && (
              triageStep === 'select_patient' ? (
                <WhoIsUnwellStep
                  currentUser={currentUser || currentHouseholdMembers[0]}
                  members={eligibleTriageMembers}
                  totalHouseholdCount={currentHouseholdMembers.length}
                  canAddMember={activeRolePerms?.capabilities?.edit_household === 'full'}
                  onSelectSubject={(subject) => {
                    setSelectedPerson(subject);
                    setCurrentResult(null);
                    setTriageStep('assessment');
                  }}
                  onAddNewMember={() => setActiveTab('family')}
                  onOpenSos={() => setIsSosOpen(true)}
                  language={language}
                  onRemoveAilment={handleRemoveAilment}
                />
              ) : currentResult ? (
                <TriageResultView
                  result={currentResult}
                  person={selectedPerson}
                  address={primaryAddress}
                  emergencyContacts={household.emergencyContacts}
                  language={language}
                  ailment={currentAilment}
                  triageMode={triageMode}
                  onReset={() => {
                    setCurrentResult(null);
                    setTriageStep('select_patient');
                  }}
                  onOpenSos={() => setIsSosOpen(true)}
                  onCreateMonitoringPlan={handleCreateMonitoringPlan}
                  onRemoveAilment={handleRemoveAilment}
                  onOpenFacilities={() => setActiveTab('facilities')}
                />
              ) : (
                <TriageFlowView
                  person={selectedPerson}
                  language={language}
                  onTriageComplete={handleTriageComplete}
                  onOpenSos={() => setIsSosOpen(true)}
                  onOpenCrisis={() => setIsCrisisOpen(true)}
                  onChangeSubject={() => setTriageStep('select_patient')}
                  onRemoveAilment={handleRemoveAilment}
                  triageMode={triageMode}
                />
              )
            )}

            {/* TAB 2: Family Profiles */}
            {activeTab === 'family' && (
              <FamilyProfilesView
                household={household}
                members={eligibleProfileMembers}
                selectedPerson={selectedPerson}
                currentUser={currentUser}
                canEditHousehold={activeRolePerms?.capabilities?.edit_household === 'full'}
                canManageCareLinks={activeRolePerms?.capabilities?.manage_care_links === 'full'}
                totalHouseholdCount={currentHouseholdMembers.length}
                onSelectPerson={setSelectedPerson}
                onUpdatePerson={handleUpdatePerson}
                onAddMember={handleAddMember}
                language={language}
                allHouseholds={currentUser?.systemRole === 'APP_OWNER' ? allHouseholds : undefined}
                onSwitchHousehold={handleSwitchHousehold}
                onResetDemoData={handleResetDemoData}
                onDeleteMember={handleDeleteMember}
              />
            )}

            {/* TAB 3: Customer Feedback */}
            {activeTab === 'feedback' && (
              <CustomerFeedbackView
                household={household}
                members={eligibleProfileMembers}
                selectedPerson={selectedPerson}
              />
            )}

            {activeTab === 'medications' && (
              <MedicationLogView
                logs={eligibleMedicationLogs}
                members={eligibleMedicationMembers}
                selectedPerson={selectedPerson}
                currentUser={currentUser}
                totalHouseholdCount={currentHouseholdMembers.length}
                onAddLog={handleAddMedicationLog}
                language={language}
              />
            )}

            {/* TAB 4: Home Monitoring */}
            {activeTab === 'monitoring' && (
              <HomeMonitoringView
                plans={eligibleMonitoringPlans}
                members={eligibleMedicationMembers}
                selectedPerson={selectedPerson}
                onUpdatePlan={updated =>
                  setMonitoringPlans(prev => prev.map(p => (p.id === updated.id ? updated : p)))
                }
                onTriggerReTriage={handleTriggerDeterioration}
                language={language}
                onRemoveAilment={handleRemoveAilment}
              />
            )}

            {/* TAB 5: Hospital & Clinic Finder */}
            {activeTab === 'facilities' && currentUser?.systemRole !== 'APP_OWNER' && (
              <HospitalFinderView
                userAddressText={primaryAddress.text}
                defaultPostal={primaryAddress.postalCode}
                defaultLat={primaryAddress.lat}
                defaultLng={primaryAddress.lng}
                language={language}
                facilities={allFacilities}
              />
            )}



            {/* TAB 7: PDPA & Audit Log */}
            {activeTab === 'pdpa_audit' && currentUser?.systemRole !== 'APP_OWNER' && (
              <AuditAndPdpaView
                auditLogs={eligibleAuditLogs}
                household={household}
                members={eligibleProfileMembers}
                currentUser={currentUser}
                exportDataScope={activeRolePerms?.capabilities?.export_delete_data || 'none'}
                totalHouseholdCount={currentHouseholdMembers.length}
                language={language}
              />
            )}

            {/* TAB 8: App Owner Administration & Integrations Hub */}
            {(activeTab === 'owner_admin' || activeTab === 'app_workspace' || activeTab === 'clinical_kb' || currentUser?.systemRole === 'APP_OWNER') && (
              (allowedScreens.includes(activeTab as any) || currentUser?.systemRole === 'APP_OWNER') ? (
                <AppOwnerPortalView
                  currentUser={currentUser}
                  household={household}
                  allHouseholds={allHouseholds}
                  members={members}
                  onUpdateMembers={setMembers}
                  language={language}
                  onOpenSos={() => setIsSosOpen(true)}
                  customRules={customRules}
                  onAddCustomRule={handleAddCustomRule}
                  onDeleteCustomRule={handleDeleteCustomRule}
                  allFacilities={allFacilities}
                  onAddFacility={handleAddFacility}
                  onSelectTab={setActiveTab}
                  rolePermissions={rolePermissions}
                  onUpdateRolePermissions={handleSaveRolePermissions}
                  onResetRolePermissions={handleResetRolePermissions}
                  menuMode={(activeTab === 'owner_admin' || activeTab === 'clinical_kb') ? 'clinical_lab' : 'app_workspace'}
                  proposals={kbProposals}
                  onApproveProposal={handleApproveProposal}
                  onDeleteProposal={handleDeleteProposal}
                  onMoveToPendingProposal={handleMoveToPendingProposal}
                  onRefreshProposals={async () => {
                    const dbProps = await fetchProposalsFromDb();
                    if (dbProps && dbProps.length > 0) {
                      setKbProposals(dbProps);
                    }
                  }}
                  auditLogs={eligibleAuditLogs}
                  primaryAddress={primaryAddress}
                />
              ) : (
                <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-md mx-auto text-center space-y-4 shadow-sm my-12 animate-fadeIn">
                  <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto text-2xl border border-indigo-200">
                    🔒
                  </div>
                  <h3 className="text-lg font-black text-slate-900">App Owner Access Required</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    The App Owner Administration & Integrations Suite is reserved for the 
                    <strong> App Owner & Medical Director</strong> persona.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const evelyn = members.find(m => m.systemRole === 'APP_OWNER');
                      if (evelyn) handleLoginSuccess(evelyn);
                    }}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow transition-all"
                  >
                    Switch to Dr. Evelyn Lim (App Owner Persona)
                  </button>
                </div>
              )
            )}
          </>
        )}
      </main>

      {/* Persistent Disclaimer Pattern (Singapore Context) */}
      <footer className="py-6 px-4 border-t border-[#DDE5E9] dark:border-[#1E2D37] text-center text-xs text-[#52616B] dark:text-[#94A3B8] space-y-1 mb-16 md:mb-0">
        <p className="font-semibold text-sm text-[#14212B] dark:text-[#F1F5F9]">
          Granpocket is not a diagnosis or medical advice. In an emergency, call 995.
        </p>
        <p className="text-xs opacity-75">
          Singapore PDPA Compliant • MOH Clinical Governance Aligned • SCDF 995 Emergency Ambulance Integration
        </p>
      </footer>

      {/* Mobile-friendly Bottom Tab Bar: Home, Check, Family, Medicines, More */}
      <BottomTabBar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'triage') {
            // Keep state or assess
          }
        }}
        language={language}
        currentUser={currentUser}
        onOpenWhoIsUnwell={() => {
          setActiveTab('triage');
          setTriageStep('select_patient');
          setCurrentResult(null);
        }}
        allowedScreens={allowedScreens}
        onOpenScheduler={() => setIsSchedulerModalOpen(true)}
      />

      {/* Global Emergency 995 Modal */}
      <EmergencySosModal
        isOpen={isSosOpen}
        onClose={() => setIsSosOpen(false)}
        person={selectedPerson}
        address={primaryAddress}
        emergencyContacts={household.emergencyContacts}
        language={language}
      />

      {/* Global Mental Health Crisis Modal */}
      <CrisisModal
        isOpen={isCrisisOpen}
        onClose={() => setIsCrisisOpen(false)}
        language={language}
      />

      {/* Automated Caregiver Alert Toast Banner */}
      <CaregiverAlertToast
        alert={activeAlertToast}
        onDismiss={() => {
          if (activeAlertToast) {
            setDismissedAlertIds(prev => new Set(prev).add(activeAlertToast.id));
          }
          setActiveAlertToast(null);
        }}
        onSnooze={handleSnoozeAlert}
        onActionClick={handleAlertAction}
        onOpenSchedulerModal={() => setIsSchedulerModalOpen(true)}
      />

      {/* Caregiver Scheduler & Automation Workflow Modal */}
      <CaregiverSchedulerModal
        isOpen={isSchedulerModalOpen}
        onClose={() => setIsSchedulerModalOpen(false)}
        jobs={scheduledJobs}
        alerts={eligibleCaregiverAlerts}
        members={eligibleAlertMembers}
        currentUser={currentUser}
        totalHouseholdCount={currentHouseholdMembers.length}
        onTriggerSimulatedAlert={handleTriggerSimulatedAlert}
        onAcknowledgeAlert={handleAcknowledgeAlert}
        onNavigateToMedication={() => {
          setIsSchedulerModalOpen(false);
          setActiveTab('medications');
        }}
        onNavigateToMonitoring={() => {
          setIsSchedulerModalOpen(false);
          setActiveTab('monitoring');
        }}
      />
    </div>
  );
}
