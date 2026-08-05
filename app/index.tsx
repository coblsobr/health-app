import { Redirect } from 'expo-router';

/** Landing route — Nutrition is the day-to-day screen, so start there. */
export default function Index() {
  return <Redirect href="/(nutrition)/diary" />;
}
