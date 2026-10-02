/**
 * GranPocket - Severity Display Helper (SRS SEV-01, SEV-02)
 * Principle 3: Never rely on colour alone - every severity level pairs
 * unique color + unique icon + descriptive text label.
 *
 * Severity scale (used ONLY for triage outcomes and alerts):
 * - Red, Emergency: #C62828 on #FDECEA, white text on solid red
 * - Orange, Urgent (see a doctor within hours): #E65100 on #FFF1E5
 * - Yellow, Monitor closely: #B58105 on #FFF8E1 (dark text on solid yellow)
 * - Green, Safe to monitor at home: #2E7D32 on #E8F5E9
 *
 * Severity icons (each unique in shape, not only in colour):
 * - Red = AlertOctagon (siren / octagon-alert)
 * - Orange = AlertTriangle (triangle-alert)
 * - Yellow = Eye (watch / monitor)
 * - Green = Home (house-heart / home care)
 */

import type { Severity } from '../types';

export interface SeverityDisplay {
  level: Severity;
  label: string;
  color: string;          // Main solid color
  bgColor: string;        // Tint background color
  borderColor: string;    // Border color
  textColor: string;      // Accessible high-contrast text
  iconName: 'AlertOctagon' | 'AlertTriangle' | 'Eye' | 'Home';
  description: string;
}

export function getSeverityDisplay(severity: Severity): SeverityDisplay {
  switch (severity) {
    case 'RED':
      return {
        level: 'RED',
        label: 'Emergency: Call 995',
        color: '#C62828',
        bgColor: '#FDECEA',
        borderColor: '#C62828',
        textColor: '#FFFFFF',
        iconName: 'AlertOctagon',
        description: 'Immediate 995 SCDF Ambulance Response',
      };
    case 'ORANGE':
      return {
        level: 'ORANGE',
        label: 'Urgent: See Doctor Within Hours',
        color: '#E65100',
        bgColor: '#FFF1E5',
        borderColor: '#E65100',
        textColor: '#FFFFFF',
        iconName: 'AlertTriangle',
        description: 'Visit Urgent Care Clinic / A&E Today',
      };
    case 'YELLOW':
      return {
        level: 'YELLOW',
        label: 'Monitor Closely: See GP Clinic',
        color: '#B58105',
        bgColor: '#FFF8E1',
        borderColor: '#B58105',
        textColor: '#14212B', // dark text on solid yellow for AAA contrast
        iconName: 'Eye',
        description: 'Consult Polyclinic / GP Within 24-48 Hours',
      };
    case 'GREEN':
      return {
        level: 'GREEN',
        label: 'Safe to Monitor at Home',
        color: '#2E7D32',
        bgColor: '#E8F5E9',
        borderColor: '#2E7D32',
        textColor: '#FFFFFF',
        iconName: 'Home',
        description: 'Rest, Hydration & Symptom Tracking',
      };
  }
}
