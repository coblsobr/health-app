import { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useNavigation } from 'expo-router';
import {
  listGrocery, setGroceryPurchased, removeGroceryItem, addManualGroceryItem,
  clearPurchasedGrocery, getSetting, setSetting, listRecipes,
  type GroceryItem, type Recipe,
} from '../lib/db';
import { AISLES } from '../lib/grocery';
import { toISODate, addDays, daysBetween } from '../lib/planner';
import { groceriesFromPlan, groceriesFromSelection, getPlanRange, type Selection, type PlanRange } from '../lib/shop';
import { useTheme } from '../theme/ThemeProvider';

/**
 * The shopping list.
 *
 * Built from a **selection of recipes**, seeded from the plan but kept
 * separately in `grocery_recipes`. Shopping decisions are not planning
 * decisions: dropping a dish off the list because the cupboard already has
 * what it needs must not quietly delete it from the week's dinners.
 *
 * Ticks survive a rebuild — `replacePlanGrocery` matches on `item_key` — so
 * adding one more recipe halfway round the shop does not clear the trolley.
 *
 * A plan longer than a week can be shopped a week at a time — a month of
 * fresh herbs bought on the 1st is compost by the 20th.
 */

export default function Groceries() {
  const { c, fonts } = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<GroceryItem[]>([]);
  const [selection, setSelection] = useState<Selection[]>([]);
  const [library, setLibrary] = useState<Recipe[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [adding, setAdding] = useState('');
  const [picking, setPicking] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [range, setRange] = useState<PlanRange | null>(null);
  /** -1 is the whole plan; 0, 1… a week of it. */
  const [week, setWeek] = useState(-1);

  const load = useCallback(async () => {
    const [list, sel, r, w] = await Promise.all([
      listGrocery().catch(() => [] as GroceryItem[]),
      getSetting('grocery_recipes').catch(() => null),
      getPlanRange(),
      getSetting('grocery_week').catch(() => null),
    ]);
    setItems(list);
    setSelection(sel ? JSON.parse(sel) : []);
    setRange(r);
    if (w != null) setWeek(Number(w));
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      load().catch(() => {});
      listRecipes().then((r) => { if (alive) setLibrary(r); }).catch(() => {});
      return () => { alive = false; };
    }, [load])
  );

  /** Turn a selection of recipes into shopping lines and store it. */
  async function rebuild(sel: Selection[]) {
    setBusy(true);
    setNote(null);
    try {
      setSelection(sel);
      setNote(await groceriesFromSelection(sel));
      await load();
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Could not build the list.');
    } finally {
      setBusy(false);
    }
  }

  const planDays = range ? daysBetween(range.from, range.to) + 1 : 0;
  const weeks = Math.ceil(planDays / 7);

  /** The dates the list covers: the whole saved plan, or one week of it. */
  function span(w: number): [string, string] {
    if (!range) {
      const start = toISODate(new Date());
      return [start, addDays(start, 180)];
    }
    if (w < 0 || weeks <= 1) return [range.from, range.to];
    const from = addDays(range.from, w * 7);
    const to = addDays(from, 6);
    return [from, to > range.to ? range.to : to];
  }

  /** Build the list from the plan, over the chosen span. */
  async function fromPlan(w = week) {
    setBusy(true);
    setNote(null);
    try {
      setWeek(w);
      await setSetting('grocery_week', String(w)).catch(() => {});
      const [from, to] = span(w);
      const { selection: sel, note: n } = await groceriesFromPlan(from, to);
      setSelection(sel);
      setNote(n);
      await load();
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Could not read the plan.');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(item: GroceryItem) {
    await setGroceryPurchased(item.id, !item.is_purchased);
    setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, is_purchased: x.is_purchased ? 0 : 1 } : x)));
  }

  async function drop(item: GroceryItem) {
    await removeGroceryItem(item.id);
    setItems((xs) => xs.filter((x) => x.id !== item.id));
  }

  async function addOwn() {
    const name = adding.trim();
    if (!name) return;
    setAdding('');
    await addManualGroceryItem(name);
    await load();
  }

  const PAD = 18;
  const done = items.filter((i) => i.is_purchased).length;
  const byAisle = AISLES.map((a) => ({ aisle: a, lines: items.filter((i) => i.aisle === a) })).filter((g) => g.lines.length);

  const Label = ({ children }: { children: string }) => (
    <Text style={{ fontFamily: fonts.semi, fontSize: 11, color: c.inkFaint, letterSpacing: 1.1, marginTop: 26, marginBottom: 6 }}>
      {children.toUpperCase()}
    </Text>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: insets.top + 14, paddingHorizontal: PAD, paddingBottom: 6,
        }}
      >
        <Text style={{ fontFamily: fonts.display, fontSize: 34, color: c.ink, letterSpacing: -0.5 }}>
          Groceries
        </Text>
        <Pressable
          onPress={() => navigation.dispatch({ type: 'OPEN_DRAWER' })}
          hitSlop={14}
          accessibilityLabel="Open menu"
          accessibilityRole="button"
          style={{ width: 24, justifyContent: 'center', gap: 5, paddingVertical: 8 }}
        >
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ height: 2, borderRadius: 2, backgroundColor: c.inkSoft }} />
          ))}
        </Pressable>
      </View>

      {items.length > 0 ? (
        <Text style={{ fontFamily: fonts.body, fontSize: 13, color: c.inkFaint, paddingHorizontal: PAD }}>
          {done} of {items.length} in the trolley
        </Text>
      ) : null}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: PAD, paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        {weeks > 1 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {[-1, ...Array.from({ length: weeks }, (_, i) => i)].map((w) => {
              const on = week === w;
              const [from, to] = span(w);
              const md = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
              return (
                <Pressable
                  key={w}
                  onPress={() => fromPlan(w)}
                  disabled={busy}
                  style={{
                    paddingVertical: 7, paddingHorizontal: 11, borderRadius: 7, borderWidth: 1,
                    borderColor: on ? c.nut : c.line, backgroundColor: on ? c.nut : 'transparent',
                  }}
                >
                  <Text style={{ fontFamily: on ? fonts.semi : fonts.body, fontSize: 12.5, color: on ? '#fff' : c.inkSoft }}>
                    {w < 0 ? 'Whole plan' : `Week ${w + 1} · ${md(from)}–${md(to)}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {busy ? (
          <View style={{ alignItems: 'center', marginTop: 40, gap: 12 }}>
            <ActivityIndicator color={c.nut} />
          </View>
        ) : null}

        {note ? (
          <Text style={{ fontFamily: fonts.body, fontSize: 13.5, color: c.inkSoft, marginTop: 18, lineHeight: 20 }}>
            {note}
          </Text>
        ) : null}

        {!busy && items.length === 0 && !note ? (
          <Text style={{ fontFamily: fonts.displayItalic, fontSize: 15, color: c.inkFaint, marginTop: 20, lineHeight: 22 }}>
            Nothing on the list. Build it from your plan, or add something by hand.
          </Text>
        ) : null}

        {byAisle.map((group) => (
          <View key={group.aisle}>
            <Label>{group.aisle}</Label>
            {group.lines.map((item) => (
              <View key={item.id} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 11, gap: 12 }}>
                <Pressable onPress={() => toggle(item)} hitSlop={8} style={{ paddingTop: 2 }}>
                  <View
                    style={{
                      width: 20, height: 20, borderRadius: 4, borderWidth: 1.5,
                      borderColor: item.is_purchased ? c.nut : c.line,
                      backgroundColor: item.is_purchased ? c.nut : 'transparent',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {item.is_purchased ? <Text style={{ color: '#fff', fontSize: 12, lineHeight: 14 }}>✓</Text> : null}
                  </View>
                </Pressable>

                <Pressable style={{ flex: 1 }} onPress={() => toggle(item)}>
                  <Text
                    style={{
                      fontFamily: fonts.body, fontSize: 15.5, lineHeight: 21,
                      color: item.is_purchased ? c.inkFaint : c.ink,
                      textDecorationLine: item.is_purchased ? 'line-through' : 'none',
                    }}
                  >
                    {item.qty_text ? `${item.qty_text}  ` : ''}{item.name}
                  </Text>
                  {/* What it is for. Without this a merged line is a mystery
                      when you are standing in the aisle deciding to skip it. */}
                  {item.recipes ? (
                    <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: c.inkFaint, marginTop: 2 }}>
                      {item.recipes}
                    </Text>
                  ) : null}
                </Pressable>

                <Pressable onPress={() => drop(item)} hitSlop={10} style={{ paddingTop: 2 }}>
                  <Text style={{ fontSize: 16, color: c.inkFaint }}>✕</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ))}

        <Label>Add something</Label>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TextInput
            value={adding}
            onChangeText={setAdding}
            placeholder="Milk, batteries, whatever"
            placeholderTextColor={c.inkFaint}
            onSubmitEditing={addOwn}
            returnKeyType="done"
            style={{
              flex: 1, fontFamily: fonts.body, fontSize: 15, color: c.ink,
              borderBottomWidth: 1, borderBottomColor: c.line, paddingVertical: 8,
            }}
          />
          <Pressable onPress={addOwn} hitSlop={8}>
            <Text style={{ fontFamily: fonts.semi, fontSize: 14, color: adding.trim() ? c.nut : c.inkFaint }}>Add</Text>
          </Pressable>
        </View>

        {/* Which recipes feed the list, and the controls to change that. */}
        <Pressable onPress={() => setShowSources((v) => !v)} style={{ marginTop: 28 }} hitSlop={8}>
          <Text style={{ fontFamily: fonts.semi, fontSize: 11, color: c.inkFaint, letterSpacing: 1.1 }}>
            {`FROM ${selection.length} RECIPE${selection.length === 1 ? '' : 'S'}  ${showSources ? '▾' : '▸'}`}
          </Text>
        </Pressable>

        {showSources ? (
          <>
            {selection.map((s) => (
              <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 }}>
                <Pressable style={{ flex: 1 }} onPress={() => router.push(`/recipe/${s.id}`)}>
                  <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: 15, color: c.ink }}>{s.name}</Text>
                  <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: c.inkFaint, marginTop: 2 }}>
                    {s.servings} servings needed
                  </Text>
                </Pressable>
                <Pressable onPress={() => rebuild(selection.filter((x) => x.id !== s.id))} hitSlop={10}>
                  <Text style={{ fontSize: 16, color: c.inkFaint }}>✕</Text>
                </Pressable>
              </View>
            ))}

            <Pressable onPress={() => setPicking((v) => !v)} style={{ paddingVertical: 12 }} hitSlop={8}>
              <Text style={{ fontFamily: fonts.semi, fontSize: 14, color: c.nut }}>
                {picking ? 'Never mind' : '+ Add a recipe to the list'}
              </Text>
            </Pressable>

            {picking
              ? library
                  .filter((r) => !selection.some((s) => s.id === r.id))
                  .map((r) => (
                    <Pressable
                      key={r.id}
                      onPress={() => {
                        setPicking(false);
                        // One batch as written; edit the plan for anything else.
                        rebuild([...selection, { id: r.id, servings: r.servings || 4, name: r.name }]);
                      }}
                      style={{ paddingVertical: 10 }}
                    >
                      <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: 15, color: c.inkSoft }}>
                        {r.name}
                      </Text>
                    </Pressable>
                  ))
              : null}

            <Pressable onPress={() => fromPlan()} style={{ paddingVertical: 12 }} hitSlop={8}>
              <Text style={{ fontFamily: fonts.semi, fontSize: 14, color: c.nut }}>Reset from my plan</Text>
            </Pressable>
          </>
        ) : null}

        {done > 0 ? (
          <Pressable
            onPress={async () => { await clearPurchasedGrocery(); await load(); }}
            style={{ marginTop: 22 }}
            hitSlop={8}
          >
            <Text style={{ fontFamily: fonts.body, fontSize: 13.5, color: c.inkFaint }}>
              Clear the {done} ticked
            </Text>
          </Pressable>
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
          onPress={() => fromPlan()}
          disabled={busy}
          style={{ backgroundColor: c.nut, paddingVertical: 16, paddingHorizontal: 40, borderRadius: 8, opacity: busy ? 0.6 : 1 }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff', letterSpacing: 1.1 }}>
            {items.length ? 'REBUILD FROM PLAN' : 'BUILD FROM PLAN'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
