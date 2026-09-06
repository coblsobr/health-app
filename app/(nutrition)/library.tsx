import { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, Image, TextInput } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Card, Row, Sm, Xs, H3, Btn } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { listRecipes, type Recipe } from '../../lib/db';
import { useTheme } from '../../theme/ThemeProvider';

type Sort = 'Newest' | 'Rating' | 'A–Z';
const SORTS: Sort[] = ['Newest', 'Rating', 'A–Z'];

export default function Library() {
  const { c, fonts } = useTheme();
  const router = useRouter();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [query, setQuery] = useState('');
  const [favesOnly, setFavesOnly] = useState(false);
  const [sort, setSort] = useState<Sort>('Newest');
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  // Refresh whenever the tab regains focus, so a recipe saved elsewhere shows up.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      listRecipes()
        .then((r) => {
          if (!alive) return;
          setRecipes(r);
          setDbError(null);
          setLoading(false);
        })
        .catch((e) => {
          if (!alive) return;
          setDbError(e instanceof Error ? e.message : 'Could not read your recipes.');
          setLoading(false);
        });
      return () => {
        alive = false;
      };
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

  const subtitle = loading
    ? 'Loading…'
    : `${recipes.length} ${recipes.length === 1 ? 'recipe' : 'recipes'}`;

  return (
    <Screen title="Library" subtitle={subtitle}>
      <Row
        style={{
          backgroundColor: c.card, borderColor: c.line, borderWidth: 1, borderRadius: 13,
          paddingHorizontal: 11, marginBottom: 10, gap: 8, justifyContent: 'flex-start',
        }}
      >
        <Icon name="search" size={15} color={c.inkFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search recipes"
          placeholderTextColor={c.inkFaint}
          style={{ flex: 1, paddingVertical: 9, fontFamily: fonts.body, fontSize: 12.5, color: c.ink }}
        />
      </Row>

      <Row style={{ gap: 6, marginBottom: 12, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
        <Pressable onPress={() => setFavesOnly((f) => !f)}>
          <View
            style={{
              backgroundColor: favesOnly ? c.nut : c.cardAlt, borderColor: favesOnly ? c.nut : c.line,
              borderWidth: 1, borderRadius: 30, paddingVertical: 5, paddingHorizontal: 11,
            }}
          >
            <Text style={{ fontFamily: fonts.semi, fontSize: 10, color: favesOnly ? '#fff' : c.inkSoft }}>♥ Favourites</Text>
          </View>
        </Pressable>
        {SORTS.map((s) => (
          <Pressable key={s} onPress={() => setSort(s)}>
            <View
              style={{
                backgroundColor: sort === s ? c.ink : c.cardAlt, borderColor: sort === s ? c.ink : c.line,
                borderWidth: 1, borderRadius: 30, paddingVertical: 5, paddingHorizontal: 11,
              }}
            >
              <Text style={{ fontFamily: fonts.semi, fontSize: 10, color: sort === s ? c.surface : c.inkSoft }}>{s}</Text>
            </View>
          </Pressable>
        ))}
      </Row>

      {dbError ? (
        <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
          <H3>Storage unavailable</H3>
          <Sm style={{ textAlign: 'center', marginTop: 6 }}>
            {dbError}{'\n'}Recipes save fine in the installed app on your phone.
          </Sm>
        </Card>
      ) : null}

      {!dbError && !loading && recipes.length === 0 ? (
        <Card style={{ alignItems: 'center', paddingVertical: 30 }}>
          <Icon name="library" size={30} color={c.inkFaint} />
          <H3 style={{ marginTop: 10 }}>No recipes yet</H3>
          <Sm style={{ textAlign: 'center', marginTop: 5, marginBottom: 14 }}>
            Paste a link from any cooking site and the whole recipe comes across.
          </Sm>
          <Btn label="Import from a link" onPress={() => router.push('/recipe/import')} style={{ paddingHorizontal: 24 }} />
          <Btn label="+ Add by hand" ghost onPress={() => router.push('/recipe/new')} style={{ marginTop: 8, paddingHorizontal: 24 }} />
        </Card>
      ) : null}

      {shown.length === 0 && recipes.length > 0 ? (
        <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
          <Sm>Nothing matches that.</Sm>
        </Card>
      ) : null}

      {shown.map((r) => {
        const total = (r.prep_min ?? 0) + (r.cook_min ?? 0);
        return (
          <Pressable key={r.id} onPress={() => router.push(`/recipe/${r.id}`)}>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <View style={{ height: 96 }}>
                {r.photo_uri ? (
                  <Image source={{ uri: r.photo_uri }} style={{ width: '100%', height: '100%' }} />
                ) : (
                  <View style={{ flex: 1, backgroundColor: c.g1[1] }} />
                )}
                {r.is_favorite ? (
                  <View
                    style={{
                      position: 'absolute', top: 8, left: 8, width: 24, height: 24, borderRadius: 12,
                      backgroundColor: c.card, alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 12, color: c.danger }}>♥</Text>
                  </View>
                ) : null}
              </View>
              <View style={{ padding: 11 }}>
                <H3 numberOfLines={2}>{r.name}</H3>
                <Row style={{ marginTop: 6 }}>
                  <Xs>
                    {total ? `${total} min · ` : ''}{r.servings} {r.servings === 1 ? 'serving' : 'servings'}
                  </Xs>
                  {r.rating ? (
                    <View style={{ backgroundColor: c.goldSoft, borderRadius: 20, paddingVertical: 3, paddingHorizontal: 8 }}>
                      <Text style={{ fontFamily: fonts.displayBold, fontSize: 10, color: c.gold }}>{r.rating}/10</Text>
                    </View>
                  ) : null}
                </Row>
              </View>
            </Card>
          </Pressable>
        );
      })}

      {recipes.length > 0 ? (
        <Btn label="+ Add a recipe" onPress={() => router.push('/recipe/new')} style={{ marginTop: 4 }} />
      ) : null}
    </Screen>
  );
}
