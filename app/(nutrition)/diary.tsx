import { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Card, Ch, Row, Sm, Xs, H3, Btn, Prog, Divider } from '../../components/ui';
import { Icon } from '../../components/Icon';
import {
  listDiary, addDiaryEntry, removeDiaryEntry, listPlan, listRecipes,
  getNumberSetting, SLOTS,
  type DiaryEntry, type PlanEntry, type Recipe, type MealSlot,
} from '../../lib/db';
import { toISODate, addDays, formatDayLabel } from '../../lib/plan';
import { useTheme } from '../../theme/ThemeProvider';

const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks',
};

export default function Diary() {
  const { c, fonts } = useTheme();
  const router = useRouter();

  const [date, setDate] = useState(() => toISODate(new Date()));
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [planned, setPlanned] = useState<PlanEntry[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [target, setTarget] = useState(2000);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addSlot, setAddSlot] = useState<MealSlot>('dinner');
  const [quickName, setQuickName] = useState('');
  const [quickKcal, setQuickKcal] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    let alive = true;
    Promise.all([listDiary(date), listPlan(date, date), listRecipes(), getNumberSetting('calorie_target', 2000)])
      .then(([d, p, r, t]) => {
        if (!alive) return;
        setEntries(d); setPlanned(p); setRecipes(r); setTarget(t);
        setDbError(null); setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        setDbError(e instanceof Error ? e.message : 'Could not read your diary.');
        setLoading(false);
      });
    return () => { alive = false; };
  }, [date]);

  useFocusEffect(load);

  const totals = useMemo(() => {
    let kcal = 0, protein = 0, carbs = 0, fat = 0;
    for (const e of entries) {
      kcal += e.kcal ?? 0; protein += e.protein_g ?? 0;
      carbs += e.carbs_g ?? 0; fat += e.fat_g ?? 0;
    }
    return { kcal: Math.round(kcal), protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat) };
  }, [entries]);

  const bySlot = useMemo(() => {
    const m = new Map<MealSlot, DiaryEntry[]>();
    for (const s of SLOTS) m.set(s, []);
    for (const e of entries) m.get(e.slot)?.push(e);
    return m;
  }, [entries]);

  /** Planned meals for this day that have not been logged yet. */
  const unlogged = useMemo(() => {
    const loggedRecipeIds = new Set(entries.filter((e) => e.recipe_id).map((e) => `${e.recipe_id}:${e.slot}`));
    return planned.filter((p) => p.recipe_id && !loggedRecipeIds.has(`${p.recipe_id}:${p.slot}`));
  }, [planned, entries]);

  async function logPlanned(p: PlanEntry) {
    await addDiaryEntry({
      date, slot: p.slot, name: p.name ?? 'Planned meal',
      servings: p.servings, recipeId: p.recipe_id, source: 'plan',
      perServing: { kcal: p.kcal, protein: p.protein_g },
    });
    load();
  }

  async function logRecipe(r: Recipe, slot: MealSlot) {
    await addDiaryEntry({
      date, slot, name: r.name, servings: 1, recipeId: r.id, source: 'recipe',
      perServing: {
        kcal: r.kcal, protein: r.protein_g, carbs: r.carbs_g, fat: r.fat_g,
        fiber: r.fiber_g, sugar: r.sugar_g, sodium: r.sodium_mg,
      },
    });
    setAddOpen(false); setSearch('');
    load();
  }

  async function quickAdd() {
    const name = quickName.trim();
    if (!name) return;
    const kcal = quickKcal ? Number(quickKcal) : null;
    await addDiaryEntry({
      date, slot: addSlot, name, servings: 1, source: 'quick',
      perServing: { kcal: Number.isFinite(kcal as number) ? kcal : null },
    });
    setQuickName(''); setQuickKcal(''); setAddOpen(false);
    load();
  }

  async function remove(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    await removeDiaryEntry(id);
  }

  const isToday = date === toISODate(new Date());
  const { weekday, day } = formatDayLabel(date);
  const pct = target > 0 ? (totals.kcal / target) * 100 : 0;
  const shown = search.trim()
    ? recipes.filter((r) => r.name.toLowerCase().includes(search.trim().toLowerCase()))
    : recipes.slice(0, 12);

  return (
    <Screen title="Diary" subtitle={isToday ? 'Today' : `${weekday} ${day}`}>
      <Row style={{ marginBottom: 12 }}>
        <Pressable onPress={() => setDate(addDays(date, -1))} hitSlop={10}
          style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, backgroundColor: c.cardAlt }}>
          <Text style={{ color: c.ink, fontSize: 14 }}>‹</Text>
        </Pressable>
        <Pressable onPress={() => setDate(toISODate(new Date()))}>
          <Sm style={{ color: isToday ? c.inkFaint : c.nut, fontFamily: fonts.semi }}>
            {isToday ? 'Today' : 'Back to today'}
          </Sm>
        </Pressable>
        <Pressable onPress={() => setDate(addDays(date, 1))} hitSlop={10}
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

      {loading ? <ActivityIndicator color={c.nut} style={{ marginTop: 20 }} /> : null}

      {!loading && !dbError ? (
        <>
          {/* running total */}
          <Card>
            <Row style={{ alignItems: 'flex-end', marginBottom: 8 }}>
              <View>
                <Text style={{ fontFamily: fonts.displayBold, fontSize: 26, color: c.ink, letterSpacing: -0.8 }}>
                  {totals.kcal}
                </Text>
                <Xs>of {target} cal</Xs>
              </View>
              <Text style={{ fontFamily: fonts.displayBold, fontSize: 15, color: totals.kcal > target ? c.danger : c.fit }}>
                {target - totals.kcal >= 0 ? `${target - totals.kcal} left` : `${totals.kcal - target} over`}
              </Text>
            </Row>
            <Prog pct={pct} tone={totals.kcal > target ? 'nut' : 'fit'} />
            <Row style={{ marginTop: 10 }}>
              {([['Protein', totals.protein], ['Carbs', totals.carbs], ['Fat', totals.fat]] as const).map(([label, v]) => (
                <View key={label} style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.displayBold, fontSize: 14, color: c.ink }}>{v}g</Text>
                  <Xs>{label}</Xs>
                </View>
              ))}
            </Row>
          </Card>

          {/* one tap for what is already planned */}
          {unlogged.length > 0 ? (
            <Card>
              <Ch>Planned for this day</Ch>
              {unlogged.map((p) => (
                <Row key={p.id} style={{ paddingVertical: 6, gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.semi, fontSize: 12, color: c.ink }} numberOfLines={1}>{p.name}</Text>
                    <Xs>
                      {SLOT_LABEL[p.slot]}
                      {p.kcal != null ? ` · ${Math.round(p.kcal * p.servings)} cal` : ''}
                      {p.is_leftover ? ' · leftover' : ''}
                    </Xs>
                  </View>
                  <Pressable onPress={() => logPlanned(p)}>
                    <View style={{ backgroundColor: c.nut, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 }}>
                      <Text style={{ fontFamily: fonts.display, fontSize: 11.5, color: '#fff' }}>Ate it</Text>
                    </View>
                  </Pressable>
                </Row>
              ))}
            </Card>
          ) : null}

          {/* logged meals */}
          {SLOTS.map((slot) => {
            const list = bySlot.get(slot) ?? [];
            const slotKcal = Math.round(list.reduce((n, e) => n + (e.kcal ?? 0), 0));
            return (
              <Card key={slot} style={{ paddingVertical: 10 }}>
                <Ch right={
                  <Row style={{ gap: 10 }}>
                    {slotKcal ? <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: c.ink }}>{slotKcal}</Text> : null}
                    <Pressable onPress={() => { setAddSlot(slot); setAddOpen(true); }} hitSlop={8}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: c.nut }}>＋</Text>
                    </Pressable>
                  </Row>
                }>
                  {SLOT_LABEL[slot]}
                </Ch>
                {list.length === 0 ? (
                  <Xs>Nothing logged</Xs>
                ) : list.map((e) => (
                  <Row key={e.id} style={{ paddingVertical: 4, gap: 8 }}>
                    <Pressable style={{ flex: 1 }} onPress={() => e.recipe_id && router.push(`/recipe/${e.recipe_id}`)}>
                      <Text style={{ fontFamily: fonts.body, fontSize: 12, color: c.ink }} numberOfLines={1}>{e.name}</Text>
                      {e.servings !== 1 ? <Xs>{e.servings} servings</Xs> : null}
                    </Pressable>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: c.inkSoft }}>
                      {e.kcal != null ? Math.round(e.kcal) : '—'}
                    </Text>
                    <Pressable onPress={() => remove(e.id)} hitSlop={8}>
                      <Text style={{ fontSize: 13, color: c.inkFaint }}>✕</Text>
                    </Pressable>
                  </Row>
                ))}
              </Card>
            );
          })}

          <Btn label="＋ Log something" onPress={() => { setAddSlot('dinner'); setAddOpen(true); }} />
          <Xs style={{ textAlign: 'center', marginTop: 8 }}>
            Barcode scanning and restaurant menus are not in yet.
          </Xs>
        </>
      ) : null}

      {/* add sheet */}
      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <View style={{ flex: 1, backgroundColor: c.scrim, justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: c.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '88%' }}>
            <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
              <H3 style={{ fontSize: 18 }}>Log to {SLOT_LABEL[addSlot].toLowerCase()}</H3>

              <Row style={{ gap: 6, marginTop: 10, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                {SLOTS.map((s) => (
                  <Pressable key={s} onPress={() => setAddSlot(s)}>
                    <View style={{
                      backgroundColor: addSlot === s ? c.nut : c.cardAlt,
                      borderColor: addSlot === s ? c.nut : c.line, borderWidth: 1,
                      borderRadius: 30, paddingVertical: 6, paddingHorizontal: 12,
                    }}>
                      <Text style={{ fontFamily: fonts.semi, fontSize: 10.5, color: addSlot === s ? '#fff' : c.inkSoft }}>
                        {SLOT_LABEL[s]}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </Row>

              <Card style={{ marginTop: 12 }}>
                <Ch>Quick add</Ch>
                <TextInput
                  value={quickName} onChangeText={setQuickName}
                  placeholder="Chicken burrito, coffee…" placeholderTextColor={c.inkFaint}
                  style={{
                    borderWidth: 1, borderColor: c.line, backgroundColor: c.card, borderRadius: 11,
                    paddingHorizontal: 11, paddingVertical: 9, fontFamily: fonts.body, fontSize: 13, color: c.ink,
                  }}
                />
                <Row style={{ gap: 8, marginTop: 8 }}>
                  <TextInput
                    value={quickKcal} onChangeText={setQuickKcal} keyboardType="number-pad"
                    placeholder="Calories" placeholderTextColor={c.inkFaint}
                    style={{
                      flex: 1, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, borderRadius: 11,
                      paddingHorizontal: 11, paddingVertical: 9, fontFamily: fonts.body, fontSize: 13, color: c.ink,
                    }}
                  />
                  <Pressable onPress={quickAdd}>
                    <View style={{
                      backgroundColor: c.nut, borderRadius: 11, paddingHorizontal: 18, paddingVertical: 10,
                      opacity: quickName.trim() ? 1 : 0.5,
                    }}>
                      <Text style={{ fontFamily: fonts.display, fontSize: 12.5, color: '#fff' }}>Add</Text>
                    </View>
                  </Pressable>
                </Row>
              </Card>

              <Card>
                <Ch>From your library</Ch>
                <Row style={{
                  backgroundColor: c.card, borderColor: c.line, borderWidth: 1, borderRadius: 11,
                  paddingHorizontal: 10, gap: 8, justifyContent: 'flex-start', marginBottom: 8,
                }}>
                  <Icon name="search" size={14} color={c.inkFaint} />
                  <TextInput
                    value={search} onChangeText={setSearch}
                    placeholder="Search recipes" placeholderTextColor={c.inkFaint}
                    style={{ flex: 1, paddingVertical: 8, fontFamily: fonts.body, fontSize: 12.5, color: c.ink }}
                  />
                </Row>
                {shown.length === 0 ? (
                  <Xs>No recipes match.</Xs>
                ) : shown.map((r) => (
                  <Pressable key={r.id} onPress={() => logRecipe(r, addSlot)}>
                    <Row style={{ paddingVertical: 7, borderTopWidth: 1, borderTopColor: c.line }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: fonts.body, fontSize: 12, color: c.ink }} numberOfLines={1}>{r.name}</Text>
                        <Xs>{r.kcal != null ? `${r.kcal} cal per serving` : 'no nutrition yet'}</Xs>
                      </View>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: c.nut }}>＋</Text>
                    </Row>
                  </Pressable>
                ))}
              </Card>

              <Btn label="Close" ghost onPress={() => setAddOpen(false)} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
