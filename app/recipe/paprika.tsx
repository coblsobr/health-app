import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { File, Directory, Paths } from 'expo-file-system';
import { readPaprikaArchive, type PaprikaRecipe } from '../../lib/paprika';
import { listRecipes, saveRecipe, type RecipeInput } from '../../lib/db';
import { estimateRecipe } from '../../lib/nutrition';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * Bring a whole Paprika 3 library in at once.
 *
 * Opens straight into the file picker — there is nothing to ask first. In
 * Paprika: Settings → Export → Paprika Recipe Format, saved anywhere the
 * phone's Files can see. Everything imports in one go, and a recipe already
 * in the library (same link, or same name) is skipped, so running it twice
 * is harmless.
 */

type Phase =
  | { kind: 'idle'; note?: string }
  | { kind: 'reading' }
  | { kind: 'importing'; done: number; total: number }
  | { kind: 'done'; added: number; skipped: string[]; failed: string[] };

/** Same link, ignoring query strings, case and a trailing slash. */
const urlKey = (u: string) => u.trim().toLowerCase().replace(/[?#].*$/, '').replace(/\/+$/, '');
const nameKey = (n: string) => n.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Photos live beside the database, not in a cache the system may clear. */
function savePhoto(r: PaprikaRecipe): string | null {
  if (!r.photoBase64) return null;
  try {
    const dir = new Directory(Paths.document, 'photos');
    dir.create({ idempotent: true, intermediates: true });
    const file = new File(dir, `paprika-${r.uid.replace(/[^A-Za-z0-9-]/g, '')}.jpg`);
    if (!file.exists) {
      file.create();
      file.write(r.photoBase64, { encoding: 'base64' });
    }
    return file.uri;
  } catch {
    return null; // a recipe without its photo beats no recipe
  }
}

function toInput(r: PaprikaRecipe, photoUri: string | null): RecipeInput {
  const servings = r.servings ?? 4;
  let nutrition: RecipeInput['nutrition'] = r.nutrition
    ? {
        kcal: r.nutrition.kcal, protein: r.nutrition.protein, carbs: r.nutrition.carbs,
        fat: r.nutrition.fat, fiber: r.nutrition.fiber, sugar: r.nutrition.sugar,
        sodium: r.nutrition.sodium, source: 'published',
      }
    : null;
  if (!nutrition && r.ingredients.length) {
    // Same rule as a recipe typed by hand: below half the lines matched, the
    // estimate misleads more than it helps.
    const e = estimateRecipe(r.ingredients, servings);
    if (e.coverage >= 0.5) {
      nutrition = {
        kcal: e.perServing.kcal, protein: e.perServing.protein, carbs: e.perServing.carbs,
        fat: e.perServing.fat, fiber: e.perServing.fiber, sugar: e.perServing.sugar,
        sodium: e.perServing.sodium, source: 'estimated',
      };
    }
  }
  return {
    name: r.name,
    servings,
    prepMin: r.prepMin,
    cookMin: r.cookMin,
    sourceUrl: r.sourceUrl,
    photoUri,
    notes: r.notes,
    rating: r.rating,
    ingredients: r.ingredients.map((text) => ({ text, isPrimary: false })),
    steps: r.steps,
    tags: r.tags,
    nutrition,
  };
}

export default function PaprikaImport() {
  const { c, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const started = useRef(false);

  async function pick() {
    const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.length) {
      setPhase({ kind: 'idle' });
      return;
    }
    setPhase({ kind: 'reading' });
    try {
      const bytes = await new File(res.assets[0].uri).bytes();
      const archive = readPaprikaArchive(bytes);
      if (archive.recipes.length === 0) {
        setPhase({ kind: 'idle', note: 'No Paprika recipes in that file. Export with "Paprika Recipe Format" and pick the .paprikarecipes file.' });
        return;
      }
      await importAll(archive.recipes, archive.failed);
    } catch {
      setPhase({ kind: 'idle', note: 'That file could not be read. Pick the .paprikarecipes file Paprika exported.' });
    }
  }

  async function importAll(recipes: PaprikaRecipe[], failed: string[]) {
    const existing = await listRecipes().catch(() => []);
    const urls = new Set(existing.flatMap((r) => (r.source_url ? [urlKey(r.source_url)] : [])));
    const names = new Set(existing.map((r) => nameKey(r.name)));

    let added = 0;
    const skipped: string[] = [];
    const broken = [...failed];
    for (let i = 0; i < recipes.length; i++) {
      const r = recipes[i];
      setPhase({ kind: 'importing', done: i, total: recipes.length });
      // Let the counter draw; 122 synchronous saves would freeze it at zero.
      await new Promise((ok) => setTimeout(ok, 0));

      if ((r.sourceUrl && urls.has(urlKey(r.sourceUrl))) || names.has(nameKey(r.name))) {
        skipped.push(r.name);
        continue;
      }
      try {
        await saveRecipe(toInput(r, savePhoto(r)));
        added++;
        names.add(nameKey(r.name));
        if (r.sourceUrl) urls.add(urlKey(r.sourceUrl));
      } catch {
        broken.push(r.name);
      }
    }
    setPhase({ kind: 'done', added, skipped, failed: broken });
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    pick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy = phase.kind === 'reading' || phase.kind === 'importing';
  const Body = ({ children }: { children: React.ReactNode }) => (
    <Text style={{ fontFamily: fonts.body, fontSize: 15, color: c.inkSoft, lineHeight: 22, marginTop: 10 }}>{children}</Text>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.surface, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10 }}>
        <Pressable onPress={() => router.back()} hitSlop={12} disabled={busy}>
          <Text style={{ fontSize: 22, color: busy ? c.inkFaint : c.ink }}>‹</Text>
        </Pressable>
        <Text style={{ fontFamily: fonts.display, fontSize: 19, color: c.ink, marginLeft: 12 }}>From Paprika</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 120 }}>
        {phase.kind === 'idle' ? (
          <>
            {phase.note ? (
              <Text style={{ fontFamily: fonts.body, fontSize: 14, color: c.nut, lineHeight: 20, marginTop: 10 }}>{phase.note}</Text>
            ) : null}
            <Body>
              In Paprika, open Settings → Export, choose{' '}
              <Text style={{ fontFamily: fonts.semi, color: c.ink }}>Paprika Recipe Format</Text>, and save the
              file to your phone. Then pick it here.
            </Body>
            <Body>
              Names, ingredients, steps, photos, ratings, times and nutrition all come across. Anything
              already in your library is skipped, so it is safe to run again.
            </Body>
          </>
        ) : null}

        {busy ? (
          <View style={{ alignItems: 'center', marginTop: 60, gap: 14 }}>
            <ActivityIndicator color={c.nut} size="large" />
            <Text style={{ fontFamily: fonts.semi, fontSize: 15, color: c.ink }}>
              {phase.kind === 'reading' ? 'Reading the export…' : `Importing ${phase.done + 1} of ${phase.total}`}
            </Text>
          </View>
        ) : null}

        {phase.kind === 'done' ? (
          <>
            <Text style={{ fontFamily: fonts.display, fontSize: 40, color: c.ink, marginTop: 16 }}>{phase.added}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 15, color: c.inkSoft }}>
              recipe{phase.added === 1 ? '' : 's'} added to your library.
            </Text>
            {phase.skipped.length ? (
              <Body>
                {phase.skipped.length} already there, so skipped
                {phase.skipped.length <= 6 ? `: ${phase.skipped.join(', ')}.` : '.'}
              </Body>
            ) : null}
            {phase.failed.length ? (
              <Text style={{ fontFamily: fonts.body, fontSize: 14, color: c.nut, lineHeight: 20, marginTop: 12 }}>
                {phase.failed.length} could not be read: {phase.failed.join(', ')}
              </Text>
            ) : null}
            <Body>
              Breakfasts, baking, drinks and dressings are recognised and left off dinner nights in the
              planner unless you ask for them.
            </Body>
          </>
        ) : null}
      </ScrollView>

      {!busy ? (
        <View
          style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            paddingBottom: insets.bottom + 18, paddingTop: 14, paddingHorizontal: 18, backgroundColor: c.surface,
          }}
        >
          <Pressable
            onPress={phase.kind === 'done' ? () => router.replace('/recipes' as never) : pick}
            style={{ backgroundColor: c.nut, paddingVertical: 15, borderRadius: 8, alignItems: 'center' }}
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff', letterSpacing: 1 }}>
              {phase.kind === 'done' ? 'SEE MY RECIPES' : 'CHOOSE THE EXPORT'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
