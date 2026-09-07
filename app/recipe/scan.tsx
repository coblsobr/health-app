import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { RecipeForm } from '../../components/RecipeForm';
import { PageCamera } from '../../components/PageCamera';
import { Toast, B } from '../../components/ui';
import { importFromImages, type OcrRecipe } from '../../lib/ocr';
import { saveRecipe, type RecipeInput } from '../../lib/db';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * Scan a recipe.
 *
 * Opens straight into the viewfinder rather than a form with a Camera button
 * on it: choosing Camera from the Recipes screen has already said what you
 * want to do, so being asked again is a screen for nothing.
 */
export default function ScanRecipe() {
  const { c, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [pages, setPages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OcrRecipe | null>(null);

  async function read(uris: string[]) {
    setPages(uris);
    setBusy(true);
    setError(null);
    try {
      setResult(await importFromImages(uris));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that image.');
    } finally {
      setBusy(false);
    }
  }

  async function save(input: RecipeInput) {
    const id = await saveRecipe(input);
    router.replace(`/recipe/${id}`);
  }

  /* ── reading ── */
  if (busy) {
    return (
      <View style={{ flex: 1, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <ActivityIndicator color={c.nut} />
        <Text style={{ fontFamily: fonts.body, fontSize: 14, color: c.inkSoft }}>
          Reading {pages.length === 1 ? 'the page' : `${pages.length} pages`}…
        </Text>
      </View>
    );
  }

  /* ── it did not read ── */
  if (error) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: c.surface,
          paddingTop: insets.top + 50,
          paddingHorizontal: 26,
          alignItems: 'center',
        }}
      >
        <Text style={{ fontFamily: fonts.body, fontSize: 14.5, color: c.inkSoft, textAlign: 'center', lineHeight: 21 }}>
          {error}
        </Text>
        <Pressable
          onPress={() => { setError(null); setPages([]); }}
          style={{ marginTop: 20, backgroundColor: c.nut, borderRadius: 8, paddingVertical: 13, paddingHorizontal: 28 }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>Try again</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ fontFamily: fonts.body, fontSize: 13.5, color: c.inkFaint }}>Back</Text>
        </Pressable>
      </View>
    );
  }

  /* ── review what was read ── */
  if (result) {
    return (
      <View style={{ flex: 1, backgroundColor: c.surface, paddingTop: insets.top }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10 }}>
          <Pressable onPress={() => { setResult(null); setPages([]); }} hitSlop={12}>
            <Text style={{ fontSize: 22, color: c.ink }}>‹</Text>
          </Pressable>
          <Text style={{ fontFamily: fonts.display, fontSize: 19, color: c.ink, marginLeft: 12 }}>Review scan</Text>
        </View>

        <View style={{ paddingHorizontal: 14 }}>
          {result.warnings.length ? (
            <Toast warn>
              {result.warnings.map((w, i) => (
                <Text key={i}>{i ? '\n' : ''}· {w}</Text>
              ))}
            </Toast>
          ) : (
            <Toast>
              Read <B>{result.ingredients.length} ingredients</B> and <B>{result.steps.length} steps</B>.
              Check them over — scanning is never perfect.
            </Toast>
          )}
        </View>

        <RecipeForm
          initial={{
            name: result.name ?? '',
            servings: result.servings ?? 4,
            prepMin: result.prepMin,
            cookMin: result.cookMin,
            sourceUrl: null,
            photoUri: pages[0] ?? null,
            notes: result.notes,
            rating: null,
            ingredients: result.ingredients.map((text) => ({ text, isPrimary: false })),
            steps: result.steps,
            tags: [],
          }}
          submitLabel="Save to library"
          onSubmit={save}
          onCancel={() => { setResult(null); setPages([]); }}
        />
      </View>
    );
  }

  /* ── the camera ── */
  return <PageCamera onDone={read} onCancel={() => router.back()} />;
}
