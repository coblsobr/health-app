import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { RecipeForm } from '../../components/RecipeForm';
import { PageCamera } from '../../components/PageCamera';
import { CropFrame } from '../../components/CropFrame';
import { Toast, B } from '../../components/ui';
import { importFromSections, type OcrRecipe, type Region, type Shot } from '../../lib/ocr';
import { saveRecipe, type RecipeInput } from '../../lib/db';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * Scan a recipe: one framed photo of the ingredients, one of the directions.
 *
 * Opens straight into the viewfinder rather than a form with a Camera button
 * on it — choosing Camera has already said what you want to do. The two shots
 * are framed separately so the parser is told which half is which instead of
 * having to work it out from a whole page, which on-device OCR does badly.
 */
type Photo = { uri: string; width: number; height: number };

const CROP_STEPS = [
  { title: 'Ingredients', hint: 'Drag the frame around the ingredients list.' },
  { title: 'Directions', hint: 'Now drag it around the method.' },
];

export default function ScanRecipe() {
  const { c, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [pages, setPages] = useState<string[]>([]);
  /**
   * Gallery photos waiting to be framed. One photo means both halves are on
   * it and you draw two rectangles on the same image; two photos means one
   * each. `cropped` holds the shots confirmed so far.
   */
  const [picked, setPicked] = useState<Photo[] | null>(null);
  const [cropped, setCropped] = useState<Shot[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OcrRecipe | null>(null);

  async function read(shots: { ingredients: Shot; steps: Shot }) {
    setPages([shots.ingredients.uri, shots.steps.uri]);
    setBusy(true);
    setError(null);
    try {
      setResult(await importFromSections(shots));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read those photos.');
    } finally {
      setBusy(false);
    }
  }

  /** One rectangle confirmed. Two of them and we can read. */
  function addCrop(region: Region | null) {
    if (!picked) return;
    const step = cropped.length; // 0 = ingredients, 1 = directions
    // One photo carries both halves; two photos carry one each.
    const photo = picked[Math.min(step, picked.length - 1)];
    const next = [...cropped, { ...photo, region: region ?? undefined }];
    if (next.length < 2) {
      setCropped(next);
      return;
    }
    setPicked(null);
    setCropped([]);
    read({ ingredients: next[0], steps: next[1] });
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
          Reading the ingredients and directions…
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

  /* ── framing a gallery photo ── */
  if (picked) {
    const step = CROP_STEPS[cropped.length];
    const photo = picked[Math.min(cropped.length, picked.length - 1)];
    return (
      <CropFrame
        // Remount per step so the rectangle resets rather than keeping the
        // one just confirmed for the other half of the page.
        key={`${photo.uri}-${cropped.length}`}
        uri={photo.uri}
        width={photo.width}
        height={photo.height}
        title={step.title}
        hint={step.hint}
        onDone={addCrop}
        onSkip={() => addCrop(null)}
        onBack={() => {
          if (cropped.length) setCropped(cropped.slice(0, -1));
          else setPicked(null);
        }}
      />
    );
  }

  /* ── the camera ── */
  return (
    <PageCamera
      onDone={read}
      onPicked={(photos) => { setCropped([]); setPicked(photos); }}
      onCancel={() => router.back()}
    />
  );
}
