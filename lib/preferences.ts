import { getSetting, setSetting } from './db';
import { readPreferences, type Preferences } from './prefs';

/**
 * Load and save Preferences. Kept under the setting keys the app already
 * used — `household` and `plan_prefs` — so nothing set before is lost.
 */

export async function loadPreferences(): Promise<Preferences> {
  const [household, kinds, swaps, pantry] = await Promise.all(
    ['household', 'plan_prefs', 'swaps', 'pantry'].map((k) => getSetting(k).catch(() => null))
  );
  return readPreferences({ household, kinds, swaps, pantry });
}

export async function savePreferences(p: Preferences): Promise<void> {
  await Promise.all([
    setSetting('household', JSON.stringify(p.people)),
    setSetting('plan_prefs', JSON.stringify(p.kinds)),
    setSetting('swaps', JSON.stringify(p.swaps)),
    setSetting('pantry', JSON.stringify(p.pantry)),
  ]);
}
