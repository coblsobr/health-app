import { useState } from 'react';
import { View, Text, Pressable, Image, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { RecipeForm } from '../../components/RecipeForm';
import { Card, Ch, Row, Sm, Xs, Btn, Toast, B } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { importFromImages, type OcrRecipe } from '../../lib/ocr';
import { saveRecipe, type RecipeInput } from '../../lib/db';
import { useTheme } from '../../theme/ThemeProvider';

export default function ScanRecipe() {
  const { c, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [pages, setPages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OcrRecipe | null>(null);

  async function addFromLibrary() {
    setError(null);
    // The system picker returns only what you choose, so no gallery permission.
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1, // full resolution: OCR accuracy depends on it
      allowsMultipleSelection: true,
      selectionLimit: 4,
    });
    if (!res.canceled) setPages((p) => [...p, ...res.assets.map((a) => a.uri)].slice(0, 4));
  }

  async function addFromCamera() {
    setError(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError('Camera access is needed to photograph a page. You can still pick a screenshot instead.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!res.canceled && res.assets[0]) setPages((p) => [...p, res.assets[0].uri].slice(0, 4));
  }

  async function read() {
    setBusy(true);
    setError(null);
    try {
      const parsed = await importFromImages(pages);
      setResult(parsed);
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

  const header = (title: string, onBack: () => void) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10 }}>
      <Pressable onPress={onBack} hitSlop={12}>
        <Text style={{ fontSize: 22, color: c.ink }}>‹</Text>
      </Pressable>
      <Text style={{ fontFamily: fonts.display, fontSize: 19, color: c.ink, marginLeft: 12 }}>{title}</Text>
    </View>
  );

  /* ── review ── */
  if (result) {
    return (
      <View style={{ flex: 1, backgroundColor: c.surface, paddingTop: insets.top }}>
        {header('Review scan', () => setResult(null))}
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
          onCancel={() => setResult(null)}
        />
      </View>
    );
  }

  /* ── picking pages ── */
  return (
    <View style={{ flex: 1, backgroundColor: c.surface, paddingTop: insets.top }}>
      {header('Scan a recipe', () => router.back())}
      <ScrollView contentContainerStyle={{ padding: 14 }}>
        <Card>
          <Ch right={pages.length ? <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: c.nut }}>{pages.length}/4</Text> : undefined}>
            Pages
          </Ch>

          {pages.length === 0 ? (
            <Sm style={{ marginBottom: 10 }}>
              Photograph the page, or pick a screenshot. Cookbook recipes often run across two
              pages — add both and they are read as one recipe.
            </Sm>
          ) : (
            <Row style={{ flexWrap: 'wrap', gap: 8, justifyContent: 'flex-start', marginBottom: 10 }}>
              {pages.map((uri, i) => (
                <View key={uri + i}>
                  <Image source={{ uri }} style={{ width: 74, height: 96, borderRadius: 10, backgroundColor: c.cardAlt }} />
                  <Pressable
                    onPress={() => setPages((p) => p.filter((_, j) => j !== i))}
                    hitSlop={8}
                    style={{
                      position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11,
                      backgroundColor: c.danger, alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 12, lineHeight: 14 }}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </Row>
          )}

          <Row style={{ gap: 8 }}>
            <Btn label="📷 Camera" ghost onPress={addFromCamera} style={{ flex: 1 }} />
            <Btn label="🖼 Choose" ghost onPress={addFromLibrary} style={{ flex: 1 }} />
          </Row>
        </Card>

        {pages.length > 0 ? (
          <Btn
            label={busy ? 'Reading…' : `Read ${pages.length === 1 ? 'this page' : `these ${pages.length} pages`}`}
            onPress={read}
            style={{ opacity: busy ? 0.6 : 1 }}
          />
        ) : null}
        {busy ? <ActivityIndicator color={c.nut} style={{ marginTop: 12 }} /> : null}

        {error ? (
          <View style={{ backgroundColor: c.dangerSoft, borderRadius: 12, padding: 11, marginTop: 10 }}>
            <Text style={{ fontFamily: fonts.semi, fontSize: 11.5, color: c.danger }}>{error}</Text>
          </View>
        ) : null}

        <Card style={{ marginTop: 10 }}>
          <Ch>For the best read</Ch>
          <Sm>
            Fill the frame with the page and keep it flat and evenly lit. Printed pages read very
            well; handwriting and text over photos are hit and miss.
          </Sm>
          <Xs style={{ marginTop: 8 }}>
            Everything happens on your phone — the image is never uploaded, and there is no cost per scan.
          </Xs>
        </Card>

        {Platform.OS === 'web' ? (
          <Toast warn>Scanning only works in the installed app.</Toast>
        ) : null}
      </ScrollView>
    </View>
  );
}
