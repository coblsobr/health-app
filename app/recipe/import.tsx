import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { RecipeForm, ALL_TAGS } from '../../components/RecipeForm';
import { Card, Ch, Row, Sm, Xs, H3, Btn, Toast, B } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { importFromUrl, type ParsedRecipe } from '../../lib/import';
import { saveRecipe, type RecipeInput } from '../../lib/db';
import { useTheme } from '../../theme/ThemeProvider';

/** Map what the parser found onto the form's shape. */
function toFormInput(p: ParsedRecipe): Partial<RecipeInput> {
  return {
    name: p.name,
    servings: p.servings ?? 4,
    prepMin: p.prepMin,
    cookMin: p.cookMin,
    sourceUrl: p.sourceUrl,
    photoUri: p.imageUrl,
    notes: p.description,
    rating: null,
    ingredients: p.ingredients.map((text) => ({ text, isPrimary: false })),
    steps: p.steps,
    // Keep only tags the form offers, so a selected chip always reflects what
    // was saved. Sites publish dozens of loose keywords; most are noise.
    tags: ALL_TAGS.filter((t) =>
      p.tags.some((raw) => raw.toLowerCase().replace(/[-_]/g, ' ') === t.toLowerCase())
    ),
    nutrition: p.nutrition
      ? {
          kcal: p.nutrition.calories,
          protein: p.nutrition.protein,
          carbs: p.nutrition.carbs,
          fat: p.nutrition.fat,
          fiber: p.nutrition.fiber,
          sugar: p.nutrition.sugar,
          sodium: p.nutrition.sodium,
          source: 'published',
        }
      : null,
  };
}

export default function ImportRecipe() {
  const { c, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedRecipe | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const result = await importFromUrl(url);
      setParsed(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that page.');
    } finally {
      setBusy(false);
    }
  }

  async function save(input: RecipeInput) {
    const id = await saveRecipe(input);
    router.replace(`/recipe/${id}`);
  }

  const header = (title: string, onBack: () => void) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10 }}>
      <Pressable onPress={onBack} hitSlop={12}>
        <Text style={{ fontSize: 22, color: c.ink }}>‹</Text>
      </Pressable>
      <Text style={{ fontFamily: fonts.display, fontSize: 19, color: c.ink, marginLeft: 12 }}>{title}</Text>
    </View>
  );

  /* ── review step ── */
  if (parsed) {
    const thin = parsed.via !== 'json-ld' || parsed.ingredients.length === 0;
    return (
      <View style={{ flex: 1, backgroundColor: c.surface, paddingTop: insets.top }}>
        {header('Review import', () => setParsed(null))}
        <View style={{ paddingHorizontal: 14 }}>
          {thin ? (
            <Toast warn>
              That page had no structured recipe data, so only the basics came through.
              Fill in the rest below before saving.
            </Toast>
          ) : (
            <Toast>
              Read <B>{parsed.ingredients.length} ingredients</B> and <B>{parsed.steps.length} steps</B>
              {parsed.nutrition?.calories ? `, plus ${parsed.nutrition.calories} cal per serving` : ''}.
              Check it over, then save.
            </Toast>
          )}
        </View>
        <RecipeForm
          initial={toFormInput(parsed)}
          submitLabel="Save to library"
          onSubmit={save}
          onCancel={() => setParsed(null)}
        />
      </View>
    );
  }

  /* ── url entry step ── */
  return (
    <View style={{ flex: 1, backgroundColor: c.surface, paddingTop: insets.top }}>
      {header('Import from a link', () => router.back())}
      <ScrollView contentContainerStyle={{ padding: 14 }} keyboardShouldPersistTaps="handled">
        <Card>
          <Ch>Recipe link</Ch>
          <TextInput
            value={url}
            onChangeText={(t) => {
              setUrl(t);
              setError(null);
            }}
            placeholder="https://www.loveandlemons.com/lentil-soup/"
            placeholderTextColor={c.inkFaint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={() => url.trim() && !busy && go()}
            style={{
              borderWidth: 1, borderColor: error ? c.danger : c.line, backgroundColor: c.card,
              borderRadius: 11, paddingHorizontal: 11, paddingVertical: 10,
              fontFamily: fonts.body, fontSize: 13, color: c.ink,
            }}
          />
          <Xs style={{ marginTop: 6 }}>Long-press the field to paste.</Xs>
          <Btn
            label={busy ? 'Reading…' : 'Get recipe'}
            onPress={go}
            style={{ marginTop: 8, opacity: url.trim() && !busy ? 1 : 0.5 }}
          />
          {busy ? <ActivityIndicator color={c.nut} style={{ marginTop: 12 }} /> : null}
          {error ? (
            <View style={{ backgroundColor: c.dangerSoft, borderRadius: 11, padding: 10, marginTop: 10 }}>
              <Text style={{ fontFamily: fonts.semi, fontSize: 11.5, color: c.danger }}>{error}</Text>
            </View>
          ) : null}
        </Card>

        <Card>
          <Ch>How this works</Ch>
          <Sm>
            Recipe sites publish their ingredients and steps in a hidden, standard format so search
            engines can read them. The app reads that same data — so what you get is exactly what the
            site says, not a guess.
          </Sm>
          <Xs style={{ marginTop: 8, lineHeight: 16 }}>
            A few large sites (Allrecipes, Serious Eats) block apps from fetching their pages. If one
            refuses, the photo import will handle it once that lands.
          </Xs>
        </Card>

        {Platform.OS === 'web' ? (
          <Toast warn>
            Import only works in the installed app — browsers block reading other sites.
          </Toast>
        ) : null}
      </ScrollView>
    </View>
  );
}
