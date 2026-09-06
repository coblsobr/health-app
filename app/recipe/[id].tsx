import { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, Image, Modal, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { getRecipe, deleteRecipe, toggleFavorite, setRating, addPlanEntry, type RecipeFull, type MealSlot } from '../../lib/db';
import { Card, Ch, Row, Sm, Xs, H3, Btn, Divider, Tag, KV } from '../../components/ui';
import { estimateRecipe } from '../../lib/nutrition';
import { toISODate, addDays, formatDayLabel } from '../../lib/plan';
import { useTheme } from '../../theme/ThemeProvider';

export default function RecipeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [recipe, setRecipe] = useState<RecipeFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showAddToPlan, setShowAddToPlan] = useState(false);
  const [addedNote, setAddedNote] = useState<string | null>(null);
  const [planDate, setPlanDate] = useState(() => toISODate(new Date()));

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

          {recipe.kcal != null || recipe.protein_g != null ? (
            <Card>
              <Ch>Nutrition <Text style={{ fontFamily: fonts.body, fontSize: 9, color: c.inkFaint }}>per serving</Text></Ch>
              <Row>
                {([
                  [recipe.kcal, 'cal', c.nut],
                  [recipe.protein_g, 'protein', c.ink],
                  [recipe.carbs_g, 'carbs', c.ink],
                  [recipe.fat_g, 'fat', c.ink],
                ] as const).map(([v, label, col], i) => (
                  <View key={label} style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontFamily: fonts.displayBold, fontSize: i === 0 ? 20 : 16, color: col }}>
                      {v != null ? (i === 0 ? String(v) : v + 'g') : '—'}
                    </Text>
                    <Xs>{label}</Xs>
                  </View>
                ))}
              </Row>
              {recipe.sodium_mg != null || recipe.fiber_g != null ? (
                <>
                  <Divider />
                  {recipe.sodium_mg != null ? <KV k="Sodium" v={recipe.sodium_mg + ' mg'} sub /> : null}
                  {recipe.fiber_g != null ? <KV k="Fiber" v={recipe.fiber_g + ' g'} sub /> : null}
                  {recipe.sugar_g != null ? <KV k="Sugar" v={recipe.sugar_g + ' g'} sub /> : null}
                </>
              ) : null}
              {recipe.nutrition_source === 'published' ? (
                <Xs style={{ marginTop: 6, color: c.ok }}>✓ Published by the source — not estimated</Xs>
              ) : (
                <Pressable onPress={() => setShowBreakdown(true)} hitSlop={6}>
                  <Xs style={{ marginTop: 6, color: c.info, textDecorationLine: 'underline' }}>
                    Estimated from the ingredients — see how
                  </Xs>
                </Pressable>
              )}
            </Card>
          ) : null}

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

          <Btn label="Add to meal plan" onPress={() => setShowAddToPlan(true)} />
          {addedNote ? <Xs style={{ textAlign: 'center', marginTop: 6, color: c.ok }}>{addedNote}</Xs> : null}
          <Btn label="Delete recipe" ghost onPress={() => setConfirmDelete(true)} style={{ marginTop: 8 }} />
        </View>
      </ScrollView>

      <Modal visible={showAddToPlan} transparent animationType="slide" onRequestClose={() => setShowAddToPlan(false)}>
        <View style={{ flex: 1, backgroundColor: c.scrim, justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: c.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16 }}>
            <H3>Add to meal plan</H3>
            <Sm style={{ marginTop: 4, marginBottom: 12 }}>Pick a day, then a meal.</Sm>
            {(() => {
              const today = toISODate(new Date());
              const upcoming = Array.from({ length: 7 }, (_, i) => addDays(today, i));
              return (
                <>
                  <Row style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                    {upcoming.map((d) => {
                      const { weekday, day } = formatDayLabel(d);
                      const on = planDate === d;
                      return (
                        <Pressable key={d} onPress={() => setPlanDate(d)}>
                          <View style={{
                            width: 42, paddingVertical: 7, borderRadius: 11, alignItems: 'center',
                            backgroundColor: on ? c.nut : c.cardAlt,
                            borderWidth: 1, borderColor: on ? c.nut : c.line,
                          }}>
                            <Text style={{ fontFamily: fonts.semi, fontSize: 8.5, color: on ? '#fff' : c.inkFaint }}>
                              {weekday.toUpperCase()}
                            </Text>
                            <Text style={{ fontFamily: fonts.displayBold, fontSize: 14, color: on ? '#fff' : c.ink }}>{day}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </Row>
                  <Divider />
                  <Row style={{ gap: 8 }}>
                    {(['breakfast', 'lunch', 'dinner'] as MealSlot[]).map((slot) => (
                      <Pressable
                        key={slot}
                        style={{ flex: 1 }}
                        onPress={async () => {
                          await addPlanEntry({ date: planDate, slot, recipeId: id, servings: 1 });
                          const { weekday } = formatDayLabel(planDate);
                          setAddedNote(`Added to ${slot} on ${weekday}`);
                          setShowAddToPlan(false);
                        }}
                      >
                        <View style={{
                          borderWidth: 1, borderColor: c.line, borderRadius: 12,
                          paddingVertical: 12, alignItems: 'center', backgroundColor: c.card,
                        }}>
                          <Text style={{ fontFamily: fonts.semi, fontSize: 11.5, color: c.ink, textTransform: 'capitalize' }}>{slot}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </Row>
                </>
              );
            })()}
            <Btn label="Cancel" ghost onPress={() => setShowAddToPlan(false)} style={{ marginTop: 14 }} />
          </View>
        </View>
      </Modal>

      {/* Every estimate can be inspected: a wrong match should be visible,
          not buried inside a single confident-looking number. */}
      <Modal visible={showBreakdown} transparent animationType="slide" onRequestClose={() => setShowBreakdown(false)}>
        <View style={{ flex: 1, backgroundColor: c.scrim, justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: c.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '80%' }}>
            <View style={{ padding: 16, paddingBottom: 8 }}>
              <H3>How this was estimated</H3>
              <Sm style={{ marginTop: 4 }}>
                Each line is matched to a USDA food and converted to grams. Anything unmatched
                contributes nothing, so the total is an underestimate rather than a guess.
              </Sm>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4 }}>
              {(() => {
                const e = estimateRecipe(recipe.ingredients.map((i) => i.raw_text), recipe.servings);
                return (
                  <>
                    <Card style={{ paddingVertical: 10 }}>
                      <KV k="Lines matched" v={`${e.matchedCount} of ${e.totalCount}`} />
                      <KV k="Per serving" v={`${e.perServing.kcal} cal`} />
                    </Card>
                    {e.matches.map((m, i) => (
                      <View key={i} style={{ paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: c.line }}>
                        <Sm style={{ color: c.ink }}>{m.raw}</Sm>
                        <Row style={{ marginTop: 2 }}>
                          <Xs style={{ flex: 1, color: m.matchedName ? c.inkFaint : c.danger }} numberOfLines={1}>
                            {m.matchedName ?? 'no match found'}
                          </Xs>
                          <Xs style={{ color: c.inkSoft }}>
                            {m.grams != null ? `${m.grams} g · ${Math.round(m.kcal)} cal` : (m.reason === 'no-quantity' ? 'no amount given' : '—')}
                          </Xs>
                        </Row>
                      </View>
                    ))}
                  </>
                );
              })()}
              <Btn label="Close" ghost onPress={() => setShowBreakdown(false)} style={{ marginTop: 14 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

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
