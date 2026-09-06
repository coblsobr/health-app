import { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Card, Ch, Row, Sm, Xs, H3, Btn, Toast, Toggle, Stepper, Divider } from '../../components/ui';
import { Icon } from '../../components/Icon';
import {
  listPlan, listRecipes, savePlan, clearPlanRange, removePlanEntry,
  type PlanEntry, type Recipe, type MealSlot,
} from '../../lib/db';
import {
  generatePlan, startOfWeek, addDays, formatDayLabel, dayTotals, countCookSessions,
  type PlanMode, type PlanOptions,
} from '../../lib/plan';
import { useTheme } from '../../theme/ThemeProvider';

const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack',
};

export default function Plan() {
  const { c, fonts } = useTheme();
  const router = useRouter();

  const [weekStart, setWeekStart] = useState(() => startOfWeek());
  const [entries, setEntries] = useState<PlanEntry[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  // generator settings
  const [mode, setMode] = useState<PlanMode>('prep');
  const [people, setPeople] = useState(2);
  const [cookSessions, setCookSessions] = useState(2);
  const [slots, setSlots] = useState<MealSlot[]>(['dinner']);
  const [favouritesOnly, setFavouritesOnly] = useState(false);

  const weekEnd = addDays(weekStart, 6);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const load = useCallback(() => {
    let alive = true;
    setLoading(true);
    Promise.all([listPlan(weekStart, weekEnd), listRecipes()])
      .then(([plan, recs]) => {
        if (!alive) return;
        setEntries(plan);
        setRecipes(recs);
        setDbError(null);
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        setDbError(e instanceof Error ? e.message : 'Could not read your plan.');
        setLoading(false);
      });
    return () => { alive = false; };
  }, [weekStart, weekEnd]);

  useFocusEffect(load);

  const byDay = useMemo(() => {
    const m = new Map<string, PlanEntry[]>();
    for (const d of days) m.set(d, []);
    for (const e of entries) m.get(e.date)?.push(e);
    return m;
  }, [entries, days]);

  const cookCount = countCookSessions(entries);
  const todayIso = startOfWeek(new Date()) === weekStart ? null : null;

  async function generate() {
    setBusy(true);
    setWarnings([]);
    try {
      const tagsById = new Map<string, string[]>(); // tags are filtered in a later pass
      const options: PlanOptions = {
        startDate: weekStart, days: 7, slots, people, mode,
        cookSessions, maxKcal: null, requiredTags: [], favouritesOnly,
      };
      const result = generatePlan(recipes, tagsById, options);
      if (result.entries.length) {
        // Replace rather than stack, so pressing generate twice is safe.
        await clearPlanRange(weekStart, weekEnd);
        await savePlan(result.entries);
      }
      setWarnings(result.warnings);
      setSetupOpen(false);
      load();
    } catch (e) {
      setWarnings([e instanceof Error ? e.message : 'Could not build the plan.']);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id)); // optimistic
    await removePlanEntry(id);
  }

  const weekLabel = `${formatDayLabel(weekStart).day} – ${formatDayLabel(weekEnd).day} ${new Date(
    Number(weekEnd.slice(0, 4)), Number(weekEnd.slice(5, 7)) - 1, Number(weekEnd.slice(8, 10))
  ).toLocaleDateString(undefined, { month: 'short' })}`;

  return (
    <Screen title="Meal plan" subtitle={weekLabel}>
      {/* week navigation */}
      <Row style={{ marginBottom: 12 }}>
        <Pressable onPress={() => setWeekStart(addDays(weekStart, -7))} hitSlop={10}
          style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, backgroundColor: c.cardAlt }}>
          <Text style={{ color: c.ink, fontSize: 14 }}>‹</Text>
        </Pressable>
        <Pressable onPress={() => setWeekStart(startOfWeek())}>
          <Sm style={{ color: c.nut, fontFamily: fonts.semi }}>This week</Sm>
        </Pressable>
        <Pressable onPress={() => setWeekStart(addDays(weekStart, 7))} hitSlop={10}
          style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, backgroundColor: c.cardAlt }}>
          <Text style={{ color: c.ink, fontSize: 14 }}>›</Text>
        </Pressable>
      </Row>

      {dbError ? (
        <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
          <H3>Storage unavailable</H3>
          <Sm style={{ textAlign: 'center', marginTop: 6 }}>{dbError}</Sm>
        </Card>
      ) : null}

      {warnings.map((w, i) => <Toast key={i} warn>{w}</Toast>)}

      {loading ? <ActivityIndicator color={c.nut} style={{ marginTop: 20 }} /> : null}

      {!loading && !dbError && entries.length === 0 ? (
        <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
          <Icon name="calendar" size={28} color={c.inkFaint} />
          <H3 style={{ marginTop: 10 }}>No meals planned</H3>
          <Sm style={{ textAlign: 'center', marginTop: 5, marginBottom: 14 }}>
            {recipes.length === 0
              ? 'Add a few recipes first, then build a week from them.'
              : 'Build a week from your library — batch-cook a few meals, or plan a different one each day.'}
          </Sm>
          {recipes.length === 0 ? (
            <Btn label="Go to library" onPress={() => router.push('/(nutrition)/library')} style={{ paddingHorizontal: 22 }} />
          ) : (
            <Btn label="Build my week" onPress={() => setSetupOpen(true)} style={{ paddingHorizontal: 22 }} />
          )}
        </Card>
      ) : null}

      {/* the week */}
      {!loading && entries.length > 0 ? (
        <>
          <Card style={{ paddingVertical: 10 }}>
            <Row>
              <View>
                <Text style={{ fontFamily: fonts.displayBold, fontSize: 15, color: c.ink }}>
                  {cookCount} cook {cookCount === 1 ? 'session' : 'sessions'}
                </Text>
                <Xs>{entries.length} meals planned this week</Xs>
              </View>
              <Pressable onPress={() => setSetupOpen(true)}>
                <Text style={{ fontFamily: fonts.semi, fontSize: 11.5, color: c.nut }}>Rebuild ›</Text>
              </Pressable>
            </Row>
          </Card>

          {days.map((date) => {
            const dayEntries = byDay.get(date) ?? [];
            const totals = dayTotals(dayEntries);
            const { weekday, day } = formatDayLabel(date);
            return (
              <Row key={date} style={{ alignItems: 'flex-start', gap: 9, marginBottom: 9 }}>
                <View style={{ width: 36, alignItems: 'center', paddingTop: 3 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: c.inkFaint, textTransform: 'uppercase' }}>{weekday}</Text>
                  <Text style={{ fontFamily: fonts.display, fontSize: 16, color: c.ink }}>{day}</Text>
                  {totals.kcal > 0 ? (
                    <Text style={{ fontFamily: fonts.semi, fontSize: 8.5, color: c.inkFaint, marginTop: 2 }}>
                      {totals.kcal}
                    </Text>
                  ) : null}
                </View>

                <View style={{ flex: 1 }}>
                  {dayEntries.length === 0 ? (
                    <Pressable onPress={() => setSetupOpen(true)}>
                      <View style={{
                        borderWidth: 1, borderColor: c.line, borderStyle: 'dashed', borderRadius: 13,
                        paddingVertical: 12, alignItems: 'center',
                      }}>
                        <Xs>nothing planned</Xs>
                      </View>
                    </Pressable>
                  ) : dayEntries.map((e) => (
                    <Row
                      key={e.id}
                      style={{
                        backgroundColor: c.card, borderColor: c.line, borderWidth: 1, borderRadius: 13,
                        paddingVertical: 8, paddingHorizontal: 10, marginBottom: 5, gap: 8,
                      }}
                    >
                      <View style={{
                        width: 3, alignSelf: 'stretch', borderRadius: 3,
                        backgroundColor: e.is_leftover ? c.info : c.nut,
                      }} />
                      <Pressable style={{ flex: 1 }} onPress={() => e.recipe_id && router.push(`/recipe/${e.recipe_id}`)}>
                        <Text style={{ fontFamily: fonts.semi, fontSize: 11.5, color: c.ink }} numberOfLines={1}>
                          {e.name ?? 'Recipe removed'}
                        </Text>
                        <Row style={{ justifyContent: 'flex-start', gap: 6, marginTop: 1 }}>
                          <Xs>{SLOT_LABEL[e.slot]}</Xs>
                          {e.kcal != null ? <Xs>· {Math.round(e.kcal * e.servings)} cal</Xs> : null}
                          {e.is_leftover ? (
                            <View style={{ backgroundColor: c.infoSoft, borderRadius: 20, paddingHorizontal: 6, paddingVertical: 1 }}>
                              <Text style={{ fontFamily: fonts.displayBold, fontSize: 7.5, color: c.info }}>LEFTOVER</Text>
                            </View>
                          ) : e.batch_id ? (
                            <View style={{ backgroundColor: c.nutSoft, borderRadius: 20, paddingHorizontal: 6, paddingVertical: 1 }}>
                              <Text style={{ fontFamily: fonts.displayBold, fontSize: 7.5, color: c.nut }}>COOK</Text>
                            </View>
                          ) : null}
                        </Row>
                      </Pressable>
                      <Pressable onPress={() => remove(e.id)} hitSlop={8}>
                        <Text style={{ fontSize: 14, color: c.inkFaint }}>✕</Text>
                      </Pressable>
                    </Row>
                  ))}
                </View>
              </Row>
            );
          })}

          <Btn label="Rebuild this week" ghost onPress={() => setSetupOpen(true)} style={{ marginTop: 4 }} />
          <Xs style={{ textAlign: 'center', marginTop: 8 }}>
            Grocery list from this plan comes next.
          </Xs>
        </>
      ) : null}

      {/* generator settings */}
      <Modal visible={setupOpen} transparent animationType="slide" onRequestClose={() => setSetupOpen(false)}>
        <View style={{ flex: 1, backgroundColor: c.scrim, justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: c.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '88%' }}>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <H3 style={{ fontSize: 18 }}>Build the week</H3>

              <Card style={{ marginTop: 12 }}>
                <Ch>How do you want to cook?</Ch>
                <Row style={{ gap: 8 }}>
                  {(['prep', 'daily'] as PlanMode[]).map((m) => (
                    <Pressable key={m} style={{ flex: 1 }} onPress={() => setMode(m)}>
                      <View style={{
                        borderWidth: 1.5, borderRadius: 13, padding: 10,
                        borderColor: mode === m ? c.nut : c.line,
                        backgroundColor: mode === m ? c.nutSoft : c.card,
                      }}>
                        <Text style={{ fontFamily: fonts.display, fontSize: 13, color: mode === m ? c.nut : c.ink }}>
                          {m === 'prep' ? 'Meal prep' : 'Day by day'}
                        </Text>
                        <Xs style={{ marginTop: 3, lineHeight: 14 }}>
                          {m === 'prep'
                            ? 'Cook a few batches, eat each for several days'
                            : 'A different meal every day'}
                        </Xs>
                      </View>
                    </Pressable>
                  ))}
                </Row>
              </Card>

              <Card>
                <Ch>Details</Ch>
                <Row style={{ paddingVertical: 6 }}>
                  <Sm>Feeding</Sm>
                  <Row style={{ gap: 9 }}>
                    <Pressable onPress={() => setPeople((n) => Math.max(1, n - 1))} hitSlop={8}>
                      <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: c.inkSoft, fontSize: 15 }}>−</Text>
                      </View>
                    </Pressable>
                    <Text style={{ fontFamily: fonts.displayBold, fontSize: 13, color: c.ink, minWidth: 22, textAlign: 'center' }}>{people}</Text>
                    <Pressable onPress={() => setPeople((n) => Math.min(12, n + 1))} hitSlop={8}>
                      <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: c.inkSoft, fontSize: 15 }}>+</Text>
                      </View>
                    </Pressable>
                  </Row>
                </Row>

                {mode === 'prep' ? (
                  <>
                    <Divider />
                    <Row style={{ paddingVertical: 6 }}>
                      <View style={{ flex: 1 }}>
                        <Sm>Cook sessions</Sm>
                        <Xs>Across the whole week, per meal</Xs>
                      </View>
                      <Row style={{ gap: 9 }}>
                        <Pressable onPress={() => setCookSessions((n) => Math.max(1, n - 1))} hitSlop={8}>
                          <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: c.inkSoft, fontSize: 15 }}>−</Text>
                          </View>
                        </Pressable>
                        <Text style={{ fontFamily: fonts.displayBold, fontSize: 13, color: c.ink, minWidth: 22, textAlign: 'center' }}>{cookSessions}</Text>
                        <Pressable onPress={() => setCookSessions((n) => Math.min(7, n + 1))} hitSlop={8}>
                          <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: c.inkSoft, fontSize: 15 }}>+</Text>
                          </View>
                        </Pressable>
                      </Row>
                    </Row>
                    <Xs>
                      {cookSessions === 1
                        ? 'One batch stretched across all 7 days.'
                        : `About ${Math.ceil(7 / cookSessions)} days of leftovers per batch.`}
                    </Xs>
                  </>
                ) : null}
              </Card>

              <Card>
                <Ch>Which meals?</Ch>
                <Row style={{ gap: 6, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                  {(['breakfast', 'lunch', 'dinner'] as MealSlot[]).map((s) => {
                    const on = slots.includes(s);
                    return (
                      <Pressable
                        key={s}
                        onPress={() => setSlots((prev) => (on ? prev.filter((x) => x !== s) : [...prev, s]))}
                      >
                        <View style={{
                          backgroundColor: on ? c.nut : c.cardAlt, borderColor: on ? c.nut : c.line,
                          borderWidth: 1, borderRadius: 30, paddingVertical: 7, paddingHorizontal: 13,
                        }}>
                          <Text style={{ fontFamily: fonts.semi, fontSize: 11, color: on ? '#fff' : c.inkSoft }}>
                            {SLOT_LABEL[s]}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </Row>
                <Divider />
                <Row>
                  <View style={{ flex: 1 }}>
                    <Sm>Favourites only</Sm>
                    <Xs>{recipes.filter((r) => r.is_favorite).length} in your library</Xs>
                  </View>
                  <Pressable onPress={() => setFavouritesOnly((f) => !f)} hitSlop={8}>
                    <Toggle on={favouritesOnly} />
                  </Pressable>
                </Row>
              </Card>

              <Btn
                label={busy ? 'Building…' : slots.length === 0 ? 'Pick at least one meal' : 'Build it'}
                onPress={slots.length && !busy ? generate : undefined}
                style={{ opacity: slots.length && !busy ? 1 : 0.5 }}
              />
              <Btn label="Cancel" ghost onPress={() => setSetupOpen(false)} style={{ marginTop: 8 }} />
              <Xs style={{ textAlign: 'center', marginTop: 10 }}>
                Building replaces whatever is already planned for this week.
              </Xs>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
