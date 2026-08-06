import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { RecipeForm } from '../../components/RecipeForm';
import { saveRecipe, type RecipeInput } from '../../lib/db';
import { useTheme } from '../../theme/ThemeProvider';

export default function NewRecipe() {
  const { c, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  async function handleSubmit(input: RecipeInput) {
    const id = await saveRecipe(input);
    router.replace(`/recipe/${id}`);
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.surface, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10 }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ fontSize: 22, color: c.ink }}>‹</Text>
        </Pressable>
        <Text style={{ fontFamily: fonts.display, fontSize: 19, color: c.ink, marginLeft: 12 }}>New recipe</Text>
      </View>
      <RecipeForm submitLabel="Save recipe" onSubmit={handleSubmit} onCancel={() => router.back()} />
    </View>
  );
}
