import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { RecipeForm } from '../../../components/RecipeForm';
import { getRecipe, saveRecipe, type RecipeInput } from '../../../lib/db';
import { useTheme } from '../../../theme/ThemeProvider';

export default function EditRecipe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [initial, setInitial] = useState<Partial<RecipeInput> | null>(null);

  useEffect(() => {
    getRecipe(id).then((r) => {
      if (!r) return;
      setInitial({
        name: r.name,
        servings: r.servings,
        prepMin: r.prep_min,
        cookMin: r.cook_min,
        sourceUrl: r.source_url,
        photoUri: r.photo_uri,
        notes: r.notes,
        rating: r.rating,
        ingredients: r.ingredients.map((i) => ({ text: i.raw_text, isPrimary: !!i.is_primary })),
        steps: r.steps.map((s) => s.text),
        tags: r.tags,
      });
    });
  }, [id]);

  async function handleSubmit(input: RecipeInput) {
    await saveRecipe(input, id);
    router.back();
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.surface, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10 }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ fontSize: 22, color: c.ink }}>‹</Text>
        </Pressable>
        <Text style={{ fontFamily: fonts.display, fontSize: 19, color: c.ink, marginLeft: 12 }}>Edit recipe</Text>
      </View>
      {initial ? (
        <RecipeForm initial={initial} submitLabel="Save changes" onSubmit={handleSubmit} onCancel={() => router.back()} />
      ) : (
        <ActivityIndicator color={c.nut} style={{ marginTop: 30 }} />
      )}
    </View>
  );
}
