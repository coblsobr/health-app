/**
 * The shape of health data the app consumes, independent of where it came from.
 *
 * Android reads Health Connect; iOS will read HealthKit. Screens import from
 * `lib/health` and never from either implementation, so adding iOS is a new
 * file rather than edits scattered across the UI.
 */

export type HealthStatus =
  | 'ready'          // permissions granted, data readable
  | 'needs-permission'
  | 'unavailable'    // no Health Connect / HealthKit on this device
  | 'needs-update'   // provider installed but too old
  | 'unsupported';   // wrong platform, or running on web

export type DaySummary = {
  date: string;              // YYYY-MM-DD
  steps: number | null;
  /** Active calories only — the burn *above* resting, which is what may be eaten back. */
  activeKcal: number | null;
  /** Everything the body burned, resting included. Used for TDEE work later. */
  totalKcal: number | null;
  distanceMeters: number | null;
};

export type Workout = {
  id: string;
  type: string;              // human-readable, e.g. "Running"
  start: string;             // ISO
  end: string;
  durationMin: number;
  kcal: number | null;
  distanceMeters: number | null;
  title: string | null;
};

export type BodyMetrics = {
  weightKg: number | null;
  weightAt: string | null;
  restingHr: number | null;
};

export interface HealthProvider {
  /** Whether this device can provide health data at all. */
  getStatus(): Promise<HealthStatus>;
  /** Ask for the permissions we need. Returns the status afterwards. */
  requestAccess(): Promise<HealthStatus>;
  /** Open the OS screen where the user manages what we can see. */
  openSettings(): Promise<void>;
  getDaySummary(date: string): Promise<DaySummary>;
  getWorkouts(startDate: string, endDate: string): Promise<Workout[]>;
  getBodyMetrics(): Promise<BodyMetrics>;
}

export const EMPTY_DAY = (date: string): DaySummary => ({
  date, steps: null, activeKcal: null, totalKcal: null, distanceMeters: null,
});
