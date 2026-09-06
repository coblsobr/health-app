import { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Row, Rule, SectionTitle, Hero, Meter, LineItem, TextAction } from '../../components/ui';
import { Icon } from '../../components/Icon';
import {
  listDiary, addDiaryEntry, removeDiaryEntry, listPlan, listRecipes,
  getNumberSetting, SLOTS,
  type DiaryEntry, type PlanEntry, type Recipe, type MealSlot,
} from '../../lib/db';
import { toISODate, addDays } from '../../lib/plan';
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

  const unlogged = useMemo(() => {
    const logged = new Set(entries.filter((e) => e.recipe_id).map((e) => `${e.recipe_id}:${e.slot}`));
    return planned.filter((p) => p.recipe_id && !logged.has(`${p.recipe_id}:${p.slot}`));
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
  const [y, m, d] = date.split('-').map(Number);
  const longDate = new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const left = target - totals.kcal;
  const over = left < 0;
  const shown = search.trim()
    ? recipes.filter((r) => r.name.toLowerCase().includes(search.trim().toLowerCase()))
    : recipes.slice(0, 12);

  const field = {
    borderBottomWidth: 1, borderBottomColor: c.line, paddingVertical: 9,
    fontFamily: fonts.body, fontSize: 14, color: c.ink,
  } as const;

  return (
    <Screen title="Diary">
      {/* date line — quiet, sentence case, with navigation on the ends */}
      <Row style={{ marginBottom: 26 }}>
        <Pressable onPress={() => setDate(addDays(date, -1))} hitSlop={14}>
          <Text style={{ fontSize: 17, color: c.inkFaint }}>‹</Text>
        </Pressable>
        <Pressable onPress={() => setDate(toISODate(new Date()))}>
          <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: isToday ? c.inkSoft : c.nut }}>
            {isToday ? longDate : `${longDate} · back to today`}
          </Text>
        </Pressable>
        <Pressable onPress={() => setDate(addDays(date, 1))} hitSlop={14}>
          <Text style={{ fontSize: 17, color: c.inkFaint }}>›</Text>
        </Pressable>
      </Row>

      {dbError ? (
        <Text style={{ fontFamily: fonts.body, fontSize: 13, color: c.danger, marginBottom: 20 }}>{dbError}</Text>
      ) : null}

      {loading ? <ActivityIndicator color={c.nut} /> : null}

      {!loading && !dbError ? (
        <>
          {/* the one number this screen is about */}
          <Hero
            value={Math.abs(left).toLocaleString()}
            caption={over ? 'calories over' : 'calories left'}
            tone={over ? c.danger : c.ink}
          />
          <View style={{ marginTop: 16, marginBottom: 8 }}>
            <Meter pct={target > 0 ? (totals.kcal / target) * 100 : 0} tone={over ? c.danger : c.nut} />
          </View>
          <Text style={{ fontFamily: fonts.body, fontSize: 12, color: c.inkSoft }}>
            {totals.kcal.toLocaleString()} eaten · {target.toLocaleString()} budget
            {totals.protein ? `  ·  ${totals.protein}g protein` : ''}
          </Text>

          {/* planned, not yet eaten */}
          {unlogged.length > 0 ? (
            <View style={{ marginTop: 34 }}>
              <SectionTitle>Planned today</SectionTitle>
              <Rule />
              {unlogged.map((p) => (
                <View key={p.id}>
                  <LineItem
                    title={p.name ?? 'Planned meal'}
                    meta={`${SLOT_LABEL[p.slot]}${p.kcal != null ? ` · ${Math.round(p.kcal * p.servings)} cal` : ''}${p.is_leftover ? ' · leftover' : ''}`}
                    right={
                      <Pressable onPress={() => logPlanned(p)} hitSlop={8}>
                        <Text style={{ fontFamily: fonts.semi, fontSize: 13, color: c.nut }}>Ate it</Text>
                      </Pressable>
                    }
                  />
                  <Rule />
                </View>
              ))}
            </View>
          ) : null}

          {/* what was eaten */}
          <View style={{ marginTop: 34 }}>
            {SLOTS.map((slot) => {
              const list = bySlot.get(slot) ?? [];
              const slotKcal = Math.round(list.reduce((n, e) => n + (e.kcal ?? 0), 0));
              return (
                <View key={slot} style={{ marginBottom: 26 }}>
                  <SectionTitle
                    right={
                      <Row style={{ gap: 14 }}>
                        {slotKcal ? (
                          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: c.inkSoft }}>{slotKcal}</Text>
                        ) : null}
                        <Pressable onPress={() => { setAddSlot(slot); setAddOpen(true); }} hitSlop={12}>
                          <Text style={{ fontFamily: fonts.body, fontSize: 17, color: c.nut, marginTop: -2 }}>+</Text>
                        </Pressable>
                      </Row>
                    }
                  >
                    {SLOT_LABEL[slot]}
                  </SectionTitle>
                  <Rule />
                  {list.length === 0 ? (
                    <Text style={{ fontFamily: fonts.body, fontSize: 13, color: c.inkFaint, paddingVertical: 11 }}>
                      Nothing yet
                    </Text>
                  ) : (
                    list.map((e) => (
                      <View key={e.id}>
                        <LineItem
                          title={e.name}
                          meta={e.servings !== 1 ? `${e.servings} servings` : undefined}
                          value={e.kcal != null ? String(Math.round(e.kcal)) : '—'}
                          onPress={() => e.recipe_id && router.push(`/recipe/${e.recipe_id}`)}
                          right={
                            <Pressable onPress={() => remove(e.id)} hitSlop={10} style={{ marginLeft: 14 }}>
                              <Text style={{ fontSize: 14, color: c.inkFaint }}>×</Text>
                            </Pressable>
                          }
                        />
                        <Rule />
                      </View>
                    ))
                  )}
                </View>
              );
            })}
          </View>

          <TextAction label="Log something →" onPress={() => { setAddSlot('dinner'); setAddOpen(true); }} />
          <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: c.inkFaint, marginTop: 4, marginBottom: 8 }}>
            Barcode scanning and restaurant menus aren't in yet.
          </Text>
        </>
      ) : null}

      {/* add sheet */}
      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <View style={{ flex: 1, backgroundColor: c.scrim, justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: c.surface, borderTopLeftRadius: 4, borderTopRightRadius: 4, maxHeight: '88%' }}>
            <ScrollView contentContainerStyle={{ padding: 22 }} keyboardShouldPersistTaps="handled">
              <Text style={{ fontFamily: fonts.display, fontSize: 26, color: c.ink, letterSpacing: -0.6 }}>
                Log to {SLOT_LABEL[addSlot].toLowerCase()}
              </Text>

              <Row style={{ gap: 18, marginTop: 16, marginBottom: 26, justifyContent: 'flex-start' }}>
                {SLOTS.map((s) => (
                  <Pressable key={s} onPress={() => setAddSlot(s)} hitSlop={8}>
                    <Text style={{
                      fontFamily: addSlot === s ? fonts.semi : fonts.body,
                      fontSize: 13,
                      color: addSlot === s ? c.nut : c.inkFaint,
                    }}>
                      {SLOT_LABEL[s]}
                    </Text>
                  </Pressable>
                ))}
              </Row>

              <SectionTitle>Quick add</SectionTitle>
              <TextInput
                value={quickName} onChangeText={setQuickName}
                placeholder="Chicken burrito, coffee…" placeholderTextColor={c.inkFaint}
                style={field}
              />
              <Row style={{ gap: 16, marginTop: 4 }}>
                <TextInput
                  value={quickKcal} onChangeText={setQuickKcal} keyboardType="number-pad"
                  placeholder="Calories" placeholderTextColor={c.inkFaint}
                  style={[field, { flex: 1 }]}
                />
                <Pressable onPress={quickAdd} hitSlop={10}>
                  <Text style={{
                    fontFamily: fonts.semi, fontSize: 14,
                    color: quickName.trim() ? c.nut : c.inkFaint,
                  }}>
                    Add
                  </Text>
                </Pressable>
              </Row>

              <View style={{ marginTop: 34 }}>
                <SectionTitle>From your library</SectionTitle>
                <Row style={{ gap: 10, justifyContent: 'flex-start', borderBottomWidth: 1, borderBottomColor: c.line }}>
                  <Icon name="search" size={15} color={c.inkFaint} />
                  <TextInput
                    value={search} onChangeText={setSearch}
                    placeholder="Search recipes" placeholderTextColor={c.inkFaint}
                    style={{ flex: 1, paddingVertical: 9, fontFamily: fonts.body, fontSize: 14, color: c.ink }}
                  />
                </Row>
                {shown.length === 0 ? (
                  <Text style={{ fontFamily: fonts.body, fontSize: 13, color: c.inkFaint, paddingVertical: 12 }}>
                    {recipes.length === 0 ? 'No recipes saved yet.' : 'Nothing matches.'}
                  </Text>
                ) : shown.map((r) => (
                  <View key={r.id}>
                    <LineItem
                      title={r.name}
                      meta={r.kcal != null ? `${r.kcal} cal per serving` : 'no nutrition yet'}
                      onPress={() => logRecipe(r, addSlot)}
                      right={<Text style={{ fontFamily: fonts.body, fontSize: 16, color: c.nut }}>+</Text>}
                    />
                    <Rule />
                  </View>
                ))}
              </View>

              <TextAction label="Close" onPress={() => setAddOpen(false)} tone={c.inkSoft} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
