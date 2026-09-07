import { Redirect } from 'expo-router';

/** Landing route. Recipes is the app right now; everything else is parked. */
export default function Index() {
  return <Redirect href="/recipes" />;
}
