import type { Project } from '@prisma/client';

/** Reject GPS readings when reported accuracy is worse than this (meters). */
export const MAX_GPS_ACCURACY_METERS = 100;

const EARTH_RADIUS_M = 6_371_000;

export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

export type AttendanceValidation =
  | { ok: true; distanceM: number }
  | { ok: false; status: number; error: string };

/**
 * Validates GPS accuracy and distance from project site for sign in / sign out.
 */
export function validateAttendanceAtProject(
  project: Pick<Project, 'latitude' | 'longitude' | 'allowedRadiusMeters' | 'projectType'>,
  lat: number,
  lng: number,
  accuracyM: number | null | undefined,
  mode: 'sign_in' | 'sign_out'
): AttendanceValidation {
  if (project.projectType === 'callout') {
    // Callout jobs are mobile by nature, so record coordinates but don't geofence.
    return { ok: true, distanceM: 0 };
  }
  if (project.latitude == null || project.longitude == null) {
    return {
      ok: false,
      status: 400,
      error: 'Project work location is not configured. Ask an admin to set latitude and longitude.',
    };
  }

  if (accuracyM == null || accuracyM < 0 || Number.isNaN(accuracyM)) {
    return {
      ok: false,
      status: 400,
      error:
        'GPS accuracy is unavailable. Wait for a stronger signal or move outdoors, then try again.',
    };
  }

  if (accuracyM > MAX_GPS_ACCURACY_METERS) {
    return {
      ok: false,
      status: 400,
      error: `GPS accuracy is too low (±${Math.round(accuracyM)} m). Wait for a better fix (need ±${MAX_GPS_ACCURACY_METERS} m or better).`,
    };
  }

  const distanceM = haversineDistanceMeters(lat, lng, project.latitude, project.longitude);
  const radius = project.allowedRadiusMeters > 0 ? project.allowedRadiusMeters : 150;

  if (distanceM > radius) {
    const base =
      mode === 'sign_in'
        ? 'You must be within the project location to sign in.'
        : 'You must be within the project location to sign out.';
    return {
      ok: false,
      status: 400,
      error: `${base} (${Math.round(distanceM)} m from site; allowed ${Math.round(radius)} m).`,
    };
  }

  return { ok: true, distanceM };
}
