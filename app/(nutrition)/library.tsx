import { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, Image, TextInput, useWindowDimensions } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Icon } from '../../components/Icon';
import { listRecipes, type Recipe } from '../../lib/db';
import { useTheme } from '../../theme/ThemeProvider';

type Sort = 'Recent' | 'Rating' | 'A–Z';
const SORTS: Sort[] = ['Recent', 'Rating', 'A–Z'];

/** Out of ten, drawn as five — half a star is a rating of an odd number. */
function Stars({ rating, color, dim }: { rating: number | null; color: string; dim: string }) {
  if (rating == null) return null;
  const outOfFive = rating / 2;
  return (
    <View style={{ flexDirection: 'row', gap: 1, marginTop: 3 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Text key={n} style={{ fontSize: 10, color: outOfFive >= n - 0.5 ? color : dim }}>★</Text>
      ))}
    </View>
  );
}

export default function Library() {
  const { c, fonts } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [query, setQuery] = useState('');
  const [favesOnly, setFavesOnly] = useState(false);
  const [sort, setSort] = useState<Sort>('Recent');
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      listRecipes()
        .then((r) => { if (!alive) return; setRecipes(r); setDbError(null); setLoading(false); })
        .catch((e) => {
          if (!alive) return;
          setDbError(e instanceof Error ? e.message : 'Could not read your recipes.');
          setLoading(false);
        });
      return () => { alive = false; };
    }, [])
  );

  const shown = useMemo(() => {
    let out = recipes;
    const q = query.trim().toLowerCase();
    if (q) out = out.filter((r) => r.name.toLowerCase().includes(q));
    if (favesOnly) out = out.filter((r) => r.is_favorite);
    const sorted = [...out];
    if (sort === 'Rating') sorted.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
    if (sort === 'A–Z') sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [recipes, query, favesOnly, sort]);

  // Without photos every tile is the same block of colour, which reads as a
  // loading state rather than a library. Vary it by id so the grid has life.
  const swatches = [c.g1[1], c.g2[1], c.g3[1], c.g5[1], c.g6[1], c.g4[1]];
  const placeholderFor = (id: string) => {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return swatches[h % swatches.length];
  };

  const gap = 10;
  const pad = 16;
  const tile = (width - pad * 2 - gap) / 2;

  return (
    <Screen
      title="All Recipes"
      subtitle={loading ? undefined : `${recipes.length} ${recipes.length === 1 ? 'recipe' : 'recipes'}`}
      action={
        <Pressable onPress={() => router.push('/recipe/import')} hitSlop={14}>
          <Text style={{ fontSize: 26, color: '#fff', marginTop: -3 }}>+</Text>
        </Pressable>
      }
    >
      {/* search */}
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 8,
          backgroundColor: c.cardAlt, borderRadius: 9, paddingHorizontal: 10, marginBottom: 12,
        }}
      >
        <Icon name="search" size={15} color={c.inkFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search"
          placeholderTextColor={c.inkFaint}
          style={{ flex: 1, paddingVertical: 8, fontFamily: fonts.body, fontSize: 14, color: c.ink }}
        />
      </View>

      {/* filters — a compact strip, not a row of pills */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 14 }}>
        <Pressable onPress={() => setFavesOnly((f) => !f)} hitSlop={8}>
          <Text style={{ fontFamily: favesOnly ? fonts.semi : fonts.body, fontSize: 12.5, color: favesOnly ? c.nut : c.inkSoft }}>
            ♥ Favourites
          </Text>
        </Pressable>
        <View style={{ width: 1, height: 12, backgroundColor: c.line }} />
        {SORTS.map((s) => (
          <Pressable key={s} onPress={() => setSort(s)} hitSlop={8}>
            <Text style={{ fontFamily: sort === s ? fonts.semi : fonts.body, fontSize: 12.5, color: sort === s ? c.nut : c.inkSoft }}>
              {s}
            </Text>
          </Pressable>
        ))}
      </View>

      {dbError ? (
        <Text style={{ fontFamily: fonts.body, fontSize: 13, color: c.danger }}>{dbError}</Text>
      ) : null}

      {!loading && !dbError && recipes.length === 0 ? (
        <View style={{ paddingVertical: 40, alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 20, color: c.ink }}>No recipes yet</Text>
          <Text style={{ fontFamily: fonts.displayItalic, fontSize: 14, color: c.inkSoft, marginTop: 6, textAlign: 'center' }}>
            Paste a link from any cooking site{'\n'}and the whole recipe comes across.
          </Text>
          <Pressable
            onPress={() => router.push('/recipe/import')}
            style={{ marginTop: 18, backgroundColor: c.nut, borderRadius: 7, paddingVertical: 11, paddingHorizontal: 22 }}
          >
            <Text style={{ fontFamily: fonts.semi, fontSize: 13.5, color: '#fff' }}>Import from a link</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/recipe/new')} style={{ marginTop: 12 }}>
            <Text style={{ fontFamily: fonts.semi, fontSize: 13, color: c.inkSoft }}>or add one by hand</Text>
          </Pressable>
        </View>
      ) : null}

      {/* the grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
        {shown.map((r) => (
          <Pressable key={r.id} onPress={() => router.push(`/recipe/${r.id}`)} style={{ width: tile, marginBottom: 6 }}>
            <View style={{ width: tile, height: tile * 0.82, borderRadius: 6, overflow: 'hidden', backgroundColor: c.cardAlt }}>
              {r.photo_uri ? (
                <Image source={{ uri: r.photo_uri }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <View style={{ flex: 1, backgroundColor: placeholderFor(r.id), alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: fonts.display, fontSize: 26, color: 'rgba(255,255,255,0.55)' }}>
                    {r.name.trim().charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              {r.is_favorite ? (
                <View style={{
                  position: 'absolute', top: 6, left: 6, width: 20, height: 20, borderRadius: 10,
                  backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 11, color: c.nut }}>♥</Text>
                </View>
              ) : null}
            </View>
            <Text
              numberOfLines={2}
              style={{ fontFamily: fonts.medium, fontSize: 12.5, color: c.ink, marginTop: 6, lineHeight: 16 }}
            >
              {r.name}
            </Text>
            <Stars rating={r.rating} color={c.gold} dim={c.track} />
          </Pressable>
        ))}
      </View>

      {shown.length === 0 && recipes.length > 0 ? (
        <Text style={{ fontFamily: fonts.displayItalic, fontSize: 14, color: c.inkFaint, paddingVertical: 20 }}>
          Nothing matches that.
        </Text>
      ) : null}
    </Screen>
  );
}
