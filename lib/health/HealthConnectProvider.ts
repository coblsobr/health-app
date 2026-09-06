/**
 * Android implementation, reading Google Health Connect.
 *
 * Health Connect is the system store that Samsung Health, Fitbit, Strava and
 * Google Fit all write into, so reading it once covers whatever the user
 * actually uses. Free, on-device, no account, no API key.
 *
 * The library is required lazily so this file can be imported anywhere — the
 * native module does not exist on web or in a build without it.
 */

import type { HealthProvider, HealthStatus, DaySummary, Workout, BodyMetrics } from './types';
import { EMPTY_DAY } from './types';

/**
 * Described structurally rather than imported, so this file still compiles
 * while the package is uninstalled. It is reinstalled when Health Connect is
 * wired up for real, which also needs a fresh APK.
 */
type HC = {
  initialize(): Promise<boolean>;
  getSdkStatus(): Promise<number>;
  requestPermission(perms: unknown): Promise<unknown>;
  getGrantedPermissions(): Promise<{ recordType: string }[]>;
  openHealthConnectSettings(): Promise<void>;
  readRecords(type: string, opts: unknown): Promise<{ records: unknown[] }>;
  aggregateRecord(req: unknown): Promise<unknown>;
  SdkAvailabilityStatus: {
    SDK_UNAVAILABLE: number;
    SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED: number;
    SDK_AVAILABLE: number;
  };
};

let cached: HC | null | undefined;

function hc(): HC | null {
  if (cached === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      cached = require('react-native-health-connect') as HC;
    } catch {
      cached = null; // not in this build
    }
  }
  return cached;
}

/** Everything we ask to read. Kept narrow — nothing is requested "just in case". */
const PERMISSIONS = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'read', recordType: 'TotalCaloriesBurned' },
  { accessType: 'read', recordType: 'Distance' },
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'read', recordType: 'HeartRate' },
  { accessType: 'read', recordType: 'Weight' },
] as const;

/** Local midnight-to-midnight, so a "day" matches the user's calendar day. */
function dayRange(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d, 23, 59, 59, 999);
  return { operator: 'between' as const, startTime: start.toISOString(), endTime: end.toISOString() };
}

function rangeBetween(startDate: string, endDate: string) {
  const [y1, m1, d1] = startDate.split('-').map(Number);
  const [y2, m2, d2] = endDate.split('-').map(Number);
  return {
    operator: 'between' as const,
    startTime: new Date(y1, m1 - 1, d1, 0, 0, 0, 0).toISOString(),
    endTime: new Date(y2, m2 - 1, d2, 23, 59, 59, 999).toISOString(),
  };
}

let initialised = false;
async function ensureInit(): Promise<boolean> {
  const lib = hc();
  if (!lib) return false;
  if (initialised) return true;
  initialised = await lib.initialize();
  return initialised;
}

/** Exercise types come back as numeric constants; name the ones people actually log. */
const EXERCISE_NAMES: Record<number, string> = {
  8: 'Biking', 9: 'Stationary bike', 13: 'Boot camp', 16: 'Calisthenics',
  25: 'Elliptical', 27: 'Football', 32: 'Golf', 35: 'Gymnastics', 36: 'Handball',
  37: 'HIIT', 38: 'Hiking', 44: 'Martial arts', 46: 'Paddling', 48: 'Pilates',
  54: 'Rock climbing', 56: 'Rowing', 57: 'Rowing machine', 58: 'Rugby',
  59: 'Running', 60: 'Treadmill run', 61: 'Sailing', 62: 'Scuba diving',
  63: 'Skating', 64: 'Skiing', 66: 'Snowboarding', 68: 'Football',
  70: 'Stair climbing', 71: 'Stair machine', 73: 'Strength training',
  74: 'Stretching', 75: 'Surfing', 76: 'Swimming', 77: 'Swimming',
  79: 'Table tennis', 80: 'Tennis', 82: 'Volleyball', 83: 'Walking',
  84: 'Water polo', 85: 'Weightlifting', 86: 'Wheelchair', 87: 'Yoga',
  0: 'Workout',
};

export const HealthConnectProvider: HealthProvider = {
  async getStatus(): Promise<HealthStatus> {
    const lib = hc();
    if (!lib) return 'unsupported';
    try {
      const status = await lib.getSdkStatus();
      if (status === lib.SdkAvailabilityStatus.SDK_UNAVAILABLE) return 'unavailable';
      if (status === lib.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'needs-update';
      if (!(await ensureInit())) return 'unavailable';
      const granted = await lib.getGrantedPermissions();
      // Steps and active calories are the minimum that makes the app useful.
      const names = new Set(granted.map((g: { recordType: string }) => g.recordType));
      return names.has('Steps') && names.has('ActiveCaloriesBurned') ? 'ready' : 'needs-permission';
    } catch {
      return 'unavailable';
    }
  },

  async requestAccess(): Promise<HealthStatus> {
    const lib = hc();
    if (!lib) return 'unsupported';
    try {
      if (!(await ensureInit())) return 'unavailable';
      await lib.requestPermission(PERMISSIONS as never);
      return await HealthConnectProvider.getStatus();
    } catch {
      return 'needs-permission';
    }
  },

  async openSettings() {
    const lib = hc();
    if (lib) await lib.openHealthConnectSettings();
  },

  async getDaySummary(date: string): Promise<DaySummary> {
    const lib = hc();
    if (!lib || !(await ensureInit())) return EMPTY_DAY(date);
    const timeRangeFilter = dayRange(date);

    // Each aggregate is independent: one missing permission or data type must
    // not blank the whole day.
    const num = async (recordType: string, key: string): Promise<number | null> => {
      try {
        const res = (await lib.aggregateRecord({ recordType, timeRangeFilter } as never)) as Record<string, unknown>;
        const raw = res?.[key] as { inKilocalories?: number; inMeters?: number } | number | undefined;
        if (typeof raw === 'number') return Math.round(raw);
        if (raw && typeof raw === 'object') {
          const v = raw.inKilocalories ?? raw.inMeters;
          return typeof v === 'number' ? Math.round(v) : null;
        }
        return null;
      } catch {
        return null;
      }
    };

    const [steps, activeKcal, totalKcal, distanceMeters] = await Promise.all([
      num('Steps', 'COUNT_TOTAL'),
      num('ActiveCaloriesBurned', 'ACTIVE_CALORIES_TOTAL'),
      num('TotalCaloriesBurned', 'ENERGY_TOTAL'),
      num('Distance', 'DISTANCE'),
    ]);

    return { date, steps, activeKcal, totalKcal, distanceMeters };
  },

  async getWorkouts(startDate: string, endDate: string): Promise<Workout[]> {
    const lib = hc();
    if (!lib || !(await ensureInit())) return [];
    try {
      const { records } = await lib.readRecords('ExerciseSession', {
        timeRangeFilter: rangeBetween(startDate, endDate),
        ascendingOrder: false,
      } as never);

      return (records as Record<string, unknown>[]).map((r) => {
        const start = String(r.startTime);
        const end = String(r.endTime);
        const ms = new Date(end).getTime() - new Date(start).getTime();
        const typeId = Number(r.exerciseType ?? 0);
        return {
          id: String((r.metadata as { id?: string })?.id ?? `${start}-${typeId}`),
          type: EXERCISE_NAMES[typeId] ?? 'Workout',
          start,
          end,
          durationMin: Math.max(0, Math.round(ms / 60000)),
          // Health Connect keeps a session's energy in a separate record type,
          // so it is filled in from the day's aggregate rather than guessed.
          kcal: null,
          distanceMeters: null,
          title: (r.title as string) ?? null,
        };
      });
    } catch {
      return [];
    }
  },

  async getBodyMetrics(): Promise<BodyMetrics> {
    const lib = hc();
    if (!lib || !(await ensureInit())) return { weightKg: null, weightAt: null, restingHr: null };

    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 86400000);
    const filter = {
      operator: 'between' as const,
      startTime: monthAgo.toISOString(),
      endTime: now.toISOString(),
    };

    let weightKg: number | null = null;
    let weightAt: string | null = null;
    try {
      const { records } = await lib.readRecords('Weight', { timeRangeFilter: filter, ascendingOrder: false } as never);
      const latest = (records as Record<string, unknown>[])[0];
      if (latest) {
        const w = latest.weight as { inKilograms?: number } | undefined;
        weightKg = typeof w?.inKilograms === 'number' ? Math.round(w.inKilograms * 10) / 10 : null;
        weightAt = String(latest.time ?? latest.startTime ?? '') || null;
      }
    } catch {
      /* leave null */
    }

    // Health Connect has no "resting" heart rate record, so the lowest reading
    // of the last day is used as a stand-in and labelled as such in the UI.
    let restingHr: number | null = null;
    try {
      const dayFilter = {
        operator: 'between' as const,
        startTime: new Date(now.getTime() - 86400000).toISOString(),
        endTime: now.toISOString(),
      };
      const { records } = await lib.readRecords('HeartRate', { timeRangeFilter: dayFilter } as never);
      const beats: number[] = [];
      for (const r of records as Record<string, unknown>[]) {
        for (const s of (r.samples as { beatsPerMinute?: number }[]) ?? []) {
          if (typeof s.beatsPerMinute === 'number') beats.push(s.beatsPerMinute);
        }
      }
      if (beats.length) restingHr = Math.min(...beats);
    } catch {
      /* leave null */
    }

    return { weightKg, weightAt, restingHr };
  },
};
