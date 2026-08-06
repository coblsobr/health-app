import { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, Image, Modal, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { getRecipe, deleteRecipe, toggleFavorite, setRating, type RecipeFull } from '../../lib/db';
import { Card, Ch, Row, Sm, Xs, H3, Btn, Divider, Tag } from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';

export default function RecipeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [recipe, setRecipe] = useState<RecipeFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(() => {
    let alive = true;
    getRecipe(id).then((r) => {
      if (alive) {
        setRecipe(r);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [id]);

  // Reload on focus so edits made on the edit screen show up on the way back.
  useFocusEffect(load);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c.nut} />
      </View>
    );
  }

  if (!recipe) {
    return (
      <View style={{ flex: 1, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Sm>That recipe no longer exists.</Sm>
        <Btn label="Back to library" onPress={() => router.replace('/(nutrition)/library')} style={{ marginTop: 14 }} />
      </View>
    );
  }

  const total = (recipe.prep_min ?? 0) + (recipe.cook_min ?? 0);
  const circle = {
    width: 32, height: 32, borderRadius: 16, backgroundColor: c.card,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  };

  async function onDelete() {
    await deleteRecipe(id);
    setConfirmDelete(false);
    router.replace('/(nutrition)/library');
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ height: 190, backgroundColor: c.cardAlt }}>
          {recipe.photo_uri ? (
            <Image source={{ uri: recipe.photo_uri }} style={{ width: '100%', height: '100%' }} />
          ) : (
            <View style={{ flex: 1, backgroundColor: c.g1[1] }} />
          )}
          <Row style={{ position: 'absolute', top: insets.top + 8, left: 12, right: 12 }}>
            <Pressable onPress={() => router.back()} hitSlop={10} style={circle}>
              <Text style={{ fontSize: 18, color: c.ink }}>‹</Text>
            </Pressable>
            <Row style={{ gap: 8 }}>
              <Pressable
                onPress={async () => {
                  const next = !recipe.is_favorite;
                  setRecipe({ ...recipe, is_favorite: next ? 1 : 0 });
                  await toggleFavorite(id, next);
                }}
                hitSlop={10}
                style={circle}
              >
                <Text style={{ fontSize: 15, color: recipe.is_favorite ? c.danger : c.inkFaint }}>
                  {recipe.is_favorite ? '♥' : '♡'}
                </Text>
              </Pressable>
              <Pressable onPress={() => router.push(`/recipe/edit/${id}`)} hitSlop={10} style={circle}>
                <Text style={{ fontSize: 14, color: c.ink }}>✎</Text>
              </Pressable>
            </Row>
          </Row>
        </View>

        <View style={{ padding: 14, marginTop: -18 }}>
          <Card>
            <H3 style={{ fontSize: 19 }}>{recipe.name}</H3>
            {recipe.source_url ? (
              <Xs style={{ marginTop: 3, color: c.info }} numberOfLines={1}>{recipe.source_url}</Xs>
            ) : null}

            {recipe.tags.length ? (
              <Row style={{ gap: 5, marginTop: 9, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                {recipe.tags.map((t) => <Tag key={t} label={t.toUpperCase()} tone="A" />)}
              </Row>
            ) : null}

            <Divider />
            <Row>
              {[
                [total ? `${total}m` : '—', 'Total'],
                [String(recipe.servings), 'Servings'],
                [recipe.rating ? `${recipe.rating}/10` : '—', 'Rating'],
              ].map(([v, l]) => (
                <View key={l} style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.displayBold, fontSize: 14, color: l === 'Rating' ? c.gold : c.ink }}>{v}</Text>
                  <Xs>{l}</Xs>
                </View>
              ))}
            </Row>
          </Card>

          <Card>
            <Ch>Your rating</Ch>
            <Row style={{ justifyContent: 'flex-start', gap: 2 }}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <Pressable
                  key={n}
                  hitSlop={4}
                  onPress={async () => {
                    const next = recipe.rating === n ? null : n;
                    setRecipe({ ...recipe, rating: next });
                    await setRating(id, next);
                  }}
                >
                  <Text style={{ fontSize: 19, color: (recipe.rating ?? 0) >= n ? c.gold : c.track }}>★</Text>
                </Pressable>
              ))}
            </Row>
          </Card>

          <Card>
            <Ch right={<Text style={{ fontFamily: fonts.bold, fontSize: 10, color: c.inkFaint }}>{recipe.ingredients.length}</Text>}>
              Ingredients
            </Ch>
            {recipe.ingredients.length === 0 ? (
              <Xs>None recorded.</Xs>
            ) : (
              recipe.ingredients.map((ing) => (
                <Row key={ing.id} style={{ paddingVertical: 4 }}>
                  <Sm style={{ color: c.ink, flex: 1 }}>{ing.raw_text}</Sm>
                  {ing.is_primary ? <Tag label="MAIN" tone="D" /> : null}
                </Row>
              ))
            )}
          </Card>

          <Card>
            <Ch>Directions</Ch>
            {recipe.steps.length === 0 ? (
              <Xs>None recorded.</Xs>
            ) : (
              recipe.steps.map((s, i) => (
                <Row key={s.id} style={{ alignItems: 'flex-start', paddingVertical: 4, gap: 8 }}>
                  <Text style={{ fontFamily: fonts.displayBold, fontSize: 12, color: c.nut, width: 15 }}>{i + 1}</Text>
                  <Sm style={{ color: c.ink, flex: 1 }}>{s.text}</Sm>
                </Row>
              ))
            )}
          </Card>

          {recipe.notes ? (
            <Card>
              <Ch>Notes</Ch>
              <Sm style={{ color: c.ink }}>{recipe.notes}</Sm>
            </Card>
          ) : null}

          <Btn label="Delete recipe" ghost onPress={() => setConfirmDelete(true)} style={{ marginTop: 6 }} />
        </View>
      </ScrollView>

      {/* A Modal rather than Alert.alert — multi-button alerts are silently
          ignored by react-native-web, which makes the button look broken. */}
      <Modal visible={confirmDelete} transparent animationType="fade" onRequestClose={() => setConfirmDelete(false)}>
        <View style={{ flex: 1, backgroundColor: c.scrim, alignItems: 'center', justifyContent: 'center', padding: 30 }}>
          <View style={{ backgroundColor: c.surface, borderRadius: 18, padding: 18, width: '100%' }}>
            <H3>Delete this recipe?</H3>
            <Sm style={{ marginTop: 6 }}>“{recipe.name}” will be removed from your library.</Sm>
            <Row style={{ gap: 8, marginTop: 16 }}>
              <Btn label="Cancel" ghost onPress={() => setConfirmDelete(false)} style={{ flex: 1 }} />
              <Pressable
                onPress={onDelete}
                style={{ flex: 1, backgroundColor: c.danger, borderRadius: 14, paddingVertical: 12, alignItems: 'center' }}
              >
                <Text style={{ fontFamily: fonts.display, fontSize: 12.5, color: '#fff' }}>Delete</Text>
              </Pressable>
            </Row>
          </View>
        </View>
      </Modal>
    </View>
  );
}
