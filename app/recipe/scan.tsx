import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { RecipeForm } from '../../components/RecipeForm';
import { PageCamera } from '../../components/PageCamera';
import { Toast, B } from '../../components/ui';
import { importFromPages, type OcrRecipe, type ScanPage, type Shot } from '../../lib/ocr';
import { saveRecipe, type RecipeInput } from '../../lib/db';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * Scan a recipe: photograph the page, read the whole thing, parse it.
 *
 * Opens straight into the viewfinder rather than a form with a Camera button
 * on it — choosing Camera has already said what you want to do.
 */
export default function ScanRecipe() {
  const { c, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [pages, setPages] = useState<Shot[]>([]);
  const [scan, setScan] = useState<ScanPage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OcrRecipe | null>(null);
  const [shared, setShared] = useState(false);

  async function read(shots: Shot[]) {
    setPages(shots);
    setBusy(true);
    setError(null);
    try {
      const out = await importFromPages(shots);
      setScan(out.pages);
      setResult(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read those photos.');
    } finally {
      setBusy(false);
    }
  }

  /**
   * Hand the raw OCR out of the phone so a scan can become a test case.
   *
   * What ML Kit actually returned is the only honest input to tune the parser
   * against — its line breaks, its misreads, the order it stitches columns in.
   * Positions go too: which column a line sits in is the strongest signal for
   * telling ingredients from method, and the parser currently ignores it.
   *
   * Uses the platform share sheet, which is part of React Native itself, so
   * this needed no new native module and shipped over the air.
   */
  async function exportScan() {
    try {
      await Share.share({
        message: JSON.stringify({
          kind: 'health-app-scan',
          at: new Date().toISOString(),
          pages: scan,
          parsed: {
            name: result?.name ?? null,
            servings: result?.servings ?? null,
            prepMin: result?.prepMin ?? null,
            cookMin: result?.cookMin ?? null,
            ingredients: result?.ingredients ?? [],
            steps: result?.steps ?? [],
          },
        }),
      });
      setShared(true);
    } catch {
      // Dismissing the share sheet is not an error worth a screen.
    }
  }

  async function save(input: RecipeInput) {
    const id = await saveRecipe(input);
    router.replace(`/recipe/${id}`);
  }

  function restart() {
    setResult(null);
    setPages([]);
    setScan([]);
    setShared(false);
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
          onPress={() => { setError(null); restart(); }}
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
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 15,
            paddingVertical: 10,
            gap: 12,
          }}
        >
          <Pressable onPress={restart} hitSlop={12}>
            <Text style={{ fontSize: 22, color: c.ink }}>‹</Text>
          </Pressable>
          <Text style={{ fontFamily: fonts.display, fontSize: 19, color: c.ink, flex: 1 }}>Review scan</Text>

          {/* Sending the raw OCR out is how a bad scan becomes a fix. */}
          <Pressable
            onPress={exportScan}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Export the scan data"
            style={{
              borderWidth: 1,
              borderColor: shared ? c.line : c.nut,
              borderRadius: 7,
              paddingVertical: 6,
              paddingHorizontal: 11,
            }}
          >
            <Text style={{ fontFamily: fonts.semi, fontSize: 12, color: shared ? c.inkFaint : c.nut }}>
              {shared ? 'Sent' : 'Export scan'}
            </Text>
          </Pressable>
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
            photoUri: pages[0]?.uri ?? null,
            notes: result.notes,
            rating: null,
            ingredients: result.ingredients.map((text) => ({ text, isPrimary: false })),
            steps: result.steps,
            tags: [],
          }}
          submitLabel="Save to library"
          onSubmit={save}
          onCancel={restart}
        />
      </View>
    );
  }

  /* ── the camera ── */
  return <PageCamera onDone={read} onCancel={() => router.back()} />;
}
