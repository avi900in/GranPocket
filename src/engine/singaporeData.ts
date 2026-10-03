/**
 * GranPocket - Singapore Hospital & Navigation Engine (SRS ESC-01, ESC-03, ESC-04)
 * Geocoding, distance, ETA, and Insurance Panel mapping
 */

import type { HospitalFacility } from '../types';
import { SINGAPORE_FACILITIES } from '../data/mockData';

export const SINGAPORE_HOSPITALS = SINGAPORE_FACILITIES;

// Calculate distance using Haversine formula (km)
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Estimate driving ETA in Singapore (minutes)
export function estimateDriveEta(distanceKm: number): string {
  if (distanceKm <= 1.0) return '3-5 mins';
  if (distanceKm <= 3.0) return '6-9 mins';
  if (distanceKm <= 7.0) return '10-15 mins';
  if (distanceKm <= 12.0) return '16-22 mins';
  return '25-35 mins';
}

// Find nearest facilities with live distance & ETA calculation
export function findNearestFacilities(
  userLat: number = 1.3325,
  userLng: number = 103.8475,
  options?: {
    edOnly?: boolean;
    insurerPanel?: string;
    pediatricOnly?: boolean;
  }
): HospitalFacility[] {
  let list = SINGAPORE_HOSPITALS.map(f => {
    const dist = calculateDistance(userLat, userLng, f.lat, f.lng);
    return {
      ...f,
      distance: dist,
      eta: estimateDriveEta(dist),
    };
  });

  if (options?.edOnly) {
    list = list.filter(f => f.hasED);
  }

  if (options?.pediatricOnly) {
    // Prioritize KKH or facilities with children's emergency
    list.sort((a, b) => {
      const aPed = a.id === 'hosp-kkh' ? 1 : 0;
      const bPed = b.id === 'hosp-kkh' ? 1 : 0;
      return bPed - aPed;
    });
  } else {
    list.sort((a, b) => (a.distance || 0) - (b.distance || 0));
  }

  return list;
}

// Check if a hospital is in the patient's insurance panel
export function isPanelHospital(facility: HospitalFacility, userInsurer?: string): boolean {
  if (!userInsurer || !facility.insurerPanel) return false;
  const userLower = userInsurer.toLowerCase();
  return facility.insurerPanel.some(p => p.toLowerCase().includes(userLower) || userLower.includes(p.toLowerCase()));
}

// Simulated Postal Code lookup for Singapore
export function lookupSingaporePostalCode(postalCode: string): {
  address: string;
  lat: number;
  lng: number;
} | null {
  const clean = postalCode.trim();
  if (clean.startsWith('31')) {
    return {
      address: `Block ${clean.slice(2, 5) || '123'} Toa Payoh, Singapore ${clean}`,
      lat: 1.3325,
      lng: 103.8475,
    };
  }
  if (clean.startsWith('22') || clean.startsWith('23')) {
    return {
      address: `Bukit Timah / Newton Road, Singapore ${clean}`,
      lat: 1.3070,
      lng: 103.8361,
    };
  }
  if (clean.startsWith('24') || clean.startsWith('25')) {
    return {
      address: `Napier Road / Tanglin, Singapore ${clean}`,
      lat: 1.3069,
      lng: 103.8188,
    };
  }
  if (clean.startsWith('26') || clean.startsWith('27')) {
    return {
      address: `Holland Road / Leedon Heights, Singapore ${clean}`,
      lat: 1.3151,
      lng: 103.8020,
    };
  }
  if (clean.startsWith('16')) {
    return {
      address: `Outram Road / Chinatown, Singapore ${clean}`,
      lat: 1.2827,
      lng: 103.8355,
    };
  }
  if (clean.startsWith('52')) {
    return {
      address: `Simei / Tampines, Singapore ${clean}`,
      lat: 1.3396,
      lng: 103.9474,
    };
  }
  if (clean.startsWith('60') || clean.startsWith('61')) {
    return {
      address: `Jurong East / West, Singapore ${clean}`,
      lat: 1.3349,
      lng: 103.7417,
    };
  }
  // Generic Singapore Central fallback
  return {
    address: `Singapore Postal Sector ${clean}`,
    lat: 1.3325,
    lng: 103.8475,
  };
}
