/**
 * GranPocket - Automated Caregiver Scheduler Workflow & Notification Engine
 * Automatically monitors medication intervals and check-back monitoring cadences,
 * routing real-time alerts to the designated family caregiver (SMS, WhatsApp, In-App).
 */

import type { Person, CheckBackPlan, MedicationLogEntry, Severity } from '../types';
import type { CaregiverAlertEntry } from './dbService';

export interface ScheduledJob {
  id: string;
  type: 'MEDICINE_DUE' | 'MONITORING_UPDATE_DUE';
  patientId: string;
  patientName: string;
  patientAvatar: string;
  caregiverId: string;
  caregiverName: string;
  caregiverRole: string;
  caregiverPhone: string;
  title: string;
  description: string;
  dueAt: string;
  frequency: string;
  status: 'DUE_NOW' | 'SCHEDULED' | 'ALERTED' | 'ACKNOWLEDGED';
  severity: Severity;
  channels: ('APP_PUSH' | 'SMS' | 'WHATSAPP')[];
  details: {
    medicineName?: string;
    dose?: string;
    planId?: string;
    interval?: string;
    lastGivenTime?: string;
    temperatureTarget?: string;
  };
}

/**
 * Resolves the designated primary caregiver for a given patient
 */
export function resolveCaregiverForPatient(
  patient: Person, 
  allMembers: Person[], 
  currentCaregiver?: Person | null
): {
  id: string;
  name: string;
  role: string;
  phone: string;
} {
  // 1. If currentCaregiver is provided and has a careLink with patient (or is the patient themselves):
  if (currentCaregiver) {
    if (patient.id === currentCaregiver.id) {
      return {
        id: currentCaregiver.id,
        name: currentCaregiver.name,
        role: currentCaregiver.relationshipLabel || 'Self',
        phone: currentCaregiver.phone || '+65 9234-5678',
      };
    }
    const matchingLink = patient.careLinks?.find(cl => cl.caregiverPersonId === currentCaregiver.id);
    if (matchingLink) {
      return {
        id: currentCaregiver.id,
        name: currentCaregiver.name,
        role: currentCaregiver.relationshipLabel || (matchingLink.type === 'helper' ? 'Helper / Caregiver' : 'Caregiver'),
        phone: currentCaregiver.phone || '+65 9888-7766',
      };
    }
  }

  // 2. Check direct careLinks
  if (patient.careLinks && patient.careLinks.length > 0) {
    const primaryLink = patient.careLinks.find(cl => cl.type === 'primary_caregiver') || patient.careLinks[0];
    const caregiver = allMembers.find(m => m.id === primaryLink.caregiverPersonId);
    if (caregiver) {
      return {
        id: caregiver.id,
        name: caregiver.name,
        role: caregiver.relationshipLabel || 'Primary Caregiver',
        phone: caregiver.phone || '+65 9234-5678',
      };
    }
  }

  // 3. Fallback to adult admin or member in household
  const adult = allMembers.find(m => m.id !== patient.id && (m.systemRole === 'ADMIN' || m.systemRole === 'CAREGIVER' || m.systemRole === 'MEMBER'));
  if (adult) {
    return {
      id: adult.id,
      name: adult.name,
      role: adult.relationshipLabel || 'Caregiver',
      phone: adult.phone || '+65 9123-4567',
    };
  }

  return {
    id: 'cg-default',
    name: 'Sarah Tan',
    role: 'Mother / Primary Caregiver',
    phone: '+65 9234-5678',
  };
}

/**
 * Generates all active scheduled jobs based on current members, medications, and monitoring plans
 */
export function computeScheduledJobs(
  members: Person[],
  plans: CheckBackPlan[],
  medicationLogs: MedicationLogEntry[],
  currentCaregiver?: Person | null
): ScheduledJob[] {
  const jobs: ScheduledJob[] = [];

  // 1. Compute Medication Jobs
  for (const person of members) {
    const meds = person.medicalProfile?.medications || [];
    for (const med of meds) {
      const caregiver = resolveCaregiverForPatient(person, members, currentCaregiver);

      // Find the last given log for this patient and med
      const lastLog = medicationLogs.find(
        l => l.subjectId === person.id &&
             l.medicine.toLowerCase().includes(med.name.toLowerCase().slice(0, 8))
      );

      const minIntervalHours = med.minIntervalHours || 4;
      let isDue = false;
      let dueAtTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

      if (!lastLog) {
        // If never logged or has active fever complaint, it's due
        isDue = !!person.activeComplaint;
        dueAtTime = new Date().toISOString();
      } else {
        const elapsedHours = (Date.now() - new Date(lastLog.givenAt).getTime()) / (1000 * 60 * 60);
        if (elapsedHours >= minIntervalHours) {
          isDue = true;
          dueAtTime = new Date().toISOString();
        } else {
          const remainingHours = minIntervalHours - elapsedHours;
          dueAtTime = new Date(Date.now() + remainingHours * 60 * 60 * 1000).toISOString();
        }
      }

      jobs.push({
        id: `job-med-${person.id}-${med.id}`,
        type: 'MEDICINE_DUE',
        patientId: person.id,
        patientName: person.name,
        patientAvatar: person.avatar || '👶',
        caregiverId: caregiver.id,
        caregiverName: caregiver.name,
        caregiverRole: caregiver.role,
        caregiverPhone: caregiver.phone,
        title: `${person.name}: ${med.name} Due`,
        description: `${med.name} (${med.dose}) • ${med.frequency}`,
        dueAt: dueAtTime,
        frequency: med.frequency,
        status: isDue ? 'DUE_NOW' : 'SCHEDULED',
        severity: isDue ? 'ORANGE' : 'YELLOW',
        channels: ['APP_PUSH', 'SMS', 'WHATSAPP'],
        details: {
          medicineName: med.name,
          dose: med.dose,
          lastGivenTime: lastLog?.givenAt,
        },
      });
    }
  }

  // 2. Compute Monitoring Update Cadence Jobs
  for (const plan of plans.filter(p => p.status === 'active')) {
    const person = members.find(m => m.id === plan.subjectId) || {
      id: plan.subjectId,
      name: plan.subjectName,
      avatar: '👶',
      careLinks: [],
      medicalProfile: { conditions: [], allergies: [], intolerances: [], medications: [], vaccinations: [] },
      dob: '2025-12-18',
      sex: 'male',
      relationshipLabel: 'Baby',
      language: 'en',
      hasLogin: false,
      systemRole: 'DEPENDENT',
    } as unknown as Person;

    const caregiver = resolveCaregiverForPatient(person, members, currentCaregiver);
    const nextCheckTime = new Date(plan.nextCheckAt).getTime();
    const isDue = Date.now() >= nextCheckTime || plan.checkIns.length === 1;

    jobs.push({
      id: `job-mon-${plan.id}`,
      type: 'MONITORING_UPDATE_DUE',
      patientId: plan.subjectId,
      patientName: plan.subjectName,
      patientAvatar: person.avatar || '👶',
      caregiverId: caregiver.id,
      caregiverName: caregiver.name,
      caregiverRole: caregiver.role,
      caregiverPhone: caregiver.phone,
      title: `${plan.subjectName}: Monitoring Update Due`,
      description: `Home Cadence Check-Back (${plan.interval}) • Vitals & Temperature Re-Assessment`,
      dueAt: plan.nextCheckAt || new Date().toISOString(),
      frequency: `Every ${plan.interval}`,
      status: isDue ? 'DUE_NOW' : 'SCHEDULED',
      severity: plan.initialSeverity === 'RED' ? 'RED' : 'ORANGE',
      channels: ['APP_PUSH', 'SMS'],
      details: {
        planId: plan.id,
        interval: plan.interval,
      },
    });
  }

  return jobs;
}

/**
 * Creates a CaregiverAlertEntry from a ScheduledJob
 */
export function createCaregiverAlertFromJob(job: ScheduledJob): CaregiverAlertEntry {
  const isMed = job.type === 'MEDICINE_DUE';
  return {
    id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    jobId: job.id,
    type: job.type,
    patientId: job.patientId,
    patientName: job.patientName,
    caregiverId: job.caregiverId,
    caregiverName: job.caregiverName,
    caregiverRole: job.caregiverRole,
    caregiverPhone: job.caregiverPhone,
    title: isMed
      ? `⏰ Medicine Due Alert: ${job.details.medicineName}`
      : `📋 Monitoring Cadence Due: ${job.patientName}`,
    message: isMed
      ? `Dear ${job.caregiverName}, ${job.patientName}'s dose of ${job.details.medicineName} (${job.details.dose}) is DUE NOW for timely symptom relief.`
      : `Dear ${job.caregiverName}, please record ${job.patientName}'s home monitoring update (${job.details.interval} cadence) to check for condition stability.`,
    severity: job.severity,
    channels: job.channels,
    status: 'DISPATCHED',
    createdAt: new Date().toISOString(),
  };
}
