import { Stack } from 'expo-router';

/** Recipe screens push over the tabs rather than living inside them. */
export default function RecipeLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
