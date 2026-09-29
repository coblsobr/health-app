import { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { SOURCES, discover, type Found } from '../lib/discover';
import type { ParsedRecipe } from '../lib/import';
import { saveRecipe, listSourceUrls, getSetting, setSetting, type RecipeInput } from '../lib/db';
import { useTheme } from '../theme/ThemeProvider';

/**
 * A found recipe, ready to save.
 *
 * Tags are dropped rather than carried across: sites publish dozens of loose
 * keywords and only a handful map onto the ones this app uses, so importing
 * them raw fills the library with noise nothing can filter on.
 */
function toRecipe(p: ParsedRecipe, url: string): RecipeInput {
  return {
    name: p.name,
    servings: p.servings ?? 4,
    prepMin: p.prepMin,
    cookMin: p.cookMin,
    sourceUrl: url,
    photoUri: p.imageUrl,
    notes: p.description,
    rating: null,
    ingredients: p.ingredients.map((text) => ({ text, isPrimary: false })),
    steps: p.steps,
    tags: [],
    nutrition: p.nutrition
      ? {
          kcal: p.nutrition.calories,
          protein: p.nutrition.protein,
          carbs: p.nutrition.carbs,
          fat: p.nutrition.fat,
          fiber: p.nutrition.fiber ?? null,
          sugar: p.nutrition.sugar ?? null,
          sodium: p.nutrition.sodium ?? null,
          // Marked published, never estimated: this came off the page, so the
          // estimator must not overwrite it later.
          source: 'published',
        }
      : undefined,
  };
}

/**
 * Find recipes that aren't in the library yet, from feeds rather than a search
 * API — no key and no bill. See `lib/discover.ts` for why these sites.
 *
 * Nothing is saved without being looked at. A recipe arriving from the
 * internet unasked is exactly the kind of thing that makes a library stop
 * feeling like yours.
 */
export default function Discover() {
  const { c, fonts } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [chosen, setChosen] = useState<string[]>(SOURCES.filter((s) => s.standard).map((s) => s.id));
  const [count, setCount] = useState(3);
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<Found[] | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getSetting('discover_sources')
        .then((v) => { if (alive && v) setChosen(JSON.parse(v)); })
        .catch(() => {});
      return () => { alive = false; };
    }, [])
  );

  function toggle(id: string) {
    const next = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id];
    setChosen(next);
    setSetting('discover_sources', JSON.stringify(next)).catch(() => {});
  }

  async function run() {
    setBusy(true);
    setNote(null);
    setFound(null);
    try {
      const have = await listSourceUrls().catch(() => [] as string[]);
      // A different starting point each time, so asking twice does not offer
      // the same posts again.
      const offset = Math.floor(Date.now() / 3_600_000) % 7;
      const report = await discover(chosen, count, have, { offset });
      setFound(report.found);
      setFailed(report.failedSources);
      if (report.found.length === 0) {
        setNote(
          report.failedSources.length
            ? 'Could not reach those sites. Worth trying again on a different connection.'
            : 'Nothing new turned up. Everything in those feeds is already in your library.'
        );
      } else if (report.found.length < count) {
        setNote(`Found ${report.found.length} of ${count}. Some posts had no recipe on them.`);
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  async function keep(f: Found) {
    await saveRecipe(toRecipe(f.recipe, f.url));
    setSaved((s) => ({ ...s, [f.url]: true }));
  }

  const PAD = 18;
  const Label = ({ children }: { children: string }) => (
    <Text style={{ fontFamily: fonts.semi, fontSize: 11, color: c.inkFaint, letterSpacing: 1.1, marginTop: 24, marginBottom: 8 }}>
      {children.toUpperCase()}
    </Text>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: insets.top + 12, paddingHorizontal: PAD, gap: 12 }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ fontSize: 24, color: c.ink }}>‹</Text>
        </Pressable>
        <Text style={{ fontFamily: fonts.display, fontSize: 30, color: c.ink, letterSpacing: -0.5 }}>Find new</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: PAD, paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        <Label>Where to look</Label>
        {SOURCES.map((s) => {
          const on = chosen.includes(s.id);
          return (
            <Pressable
              key={s.id}
              onPress={() => toggle(s.id)}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 }}
            >
              <View
                style={{
                  width: 18, height: 18, borderRadius: 4, borderWidth: 1.5,
                  borderColor: on ? c.nut : c.line, backgroundColor: on ? c.nut : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                {on ? <Text style={{ color: '#fff', fontSize: 11, lineHeight: 13 }}>✓</Text> : null}
              </View>
              <Text style={{ fontFamily: fonts.body, fontSize: 15.5, color: on ? c.ink : c.inkSoft }}>{s.name}</Text>
            </Pressable>
          );
        })}
        <Text style={{ fontFamily: fonts.body, fontSize: 12, color: c.inkFaint, marginTop: 6, lineHeight: 18 }}>
          These read each site's public feed and then the recipe page itself — no account and no
          cost. Sites that block non-browser requests were left out; they'd only ever fail.
        </Text>

        <Label>How many</Label>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.body, fontSize: 15, color: c.ink, flex: 1 }}>Recipes to find</Text>
          <Pressable onPress={() => setCount(Math.max(1, count - 1))} hitSlop={10} style={{ paddingHorizontal: 14 }}>
            <Text style={{ fontSize: 20, color: c.inkSoft }}>−</Text>
          </Pressable>
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: c.ink, minWidth: 22, textAlign: 'center' }}>{count}</Text>
          <Pressable onPress={() => setCount(Math.min(10, count + 1))} hitSlop={10} style={{ paddingHorizontal: 14 }}>
            <Text style={{ fontSize: 20, color: c.inkSoft }}>+</Text>
          </Pressable>
        </View>

        {busy ? (
          <View style={{ alignItems: 'center', marginTop: 34, gap: 12 }}>
            <ActivityIndicator color={c.nut} />
            <Text style={{ fontFamily: fonts.body, fontSize: 13.5, color: c.inkSoft }}>
              Reading feeds and pulling the recipes…
            </Text>
          </View>
        ) : null}

        {note ? (
          <Text style={{ fontFamily: fonts.body, fontSize: 13.5, color: c.inkSoft, marginTop: 20, lineHeight: 20 }}>
            {note}
          </Text>
        ) : null}

        {failed.length && found?.length ? (
          <Text style={{ fontFamily: fonts.body, fontSize: 12, color: c.inkFaint, marginTop: 12 }}>
            Couldn't reach {failed.join(', ')}.
          </Text>
        ) : null}

        {found?.length ? (
          <>
            <Label>Found</Label>
            {found.map((f) => (
              <View key={f.url} style={{ paddingVertical: 13 }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: c.ink, lineHeight: 22 }}>
                  {f.recipe.name}
                </Text>
                <Text style={{ fontFamily: fonts.body, fontSize: 12, color: c.inkFaint, marginTop: 3 }}>
                  {f.source} · {f.recipe.ingredients.length} ingredients · {f.recipe.steps.length} steps
                  {f.recipe.servings ? ` · serves ${f.recipe.servings}` : ''}
                </Text>
                <View style={{ flexDirection: 'row', gap: 18, marginTop: 10 }}>
                  <Pressable onPress={() => keep(f)} disabled={saved[f.url]} hitSlop={6}>
                    <Text style={{ fontFamily: fonts.semi, fontSize: 13.5, color: saved[f.url] ? c.inkFaint : c.nut }}>
                      {saved[f.url] ? 'Saved' : 'Keep it'}
                    </Text>
                  </Pressable>
                </View>
                <View style={{ height: 1, backgroundColor: c.line, marginTop: 13 }} />
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>

      <View
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          paddingBottom: insets.bottom + 18, paddingTop: 14, paddingHorizontal: PAD,
          alignItems: 'center', backgroundColor: c.surface,
        }}
      >
        <Pressable
          onPress={run}
          disabled={busy || chosen.length === 0}
          style={{
            backgroundColor: chosen.length === 0 ? c.track : c.nut,
            paddingVertical: 16, paddingHorizontal: 44, borderRadius: 8, opacity: busy ? 0.6 : 1,
          }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff', letterSpacing: 1.1 }}>
            {found ? 'LOOK AGAIN' : 'FIND RECIPES'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
