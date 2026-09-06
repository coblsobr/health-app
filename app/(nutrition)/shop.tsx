import { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Card, Ch, Row, Sm, Xs, H3, Btn, Toast } from '../../components/ui';
import { Icon } from '../../components/Icon';
import {
  listGrocery, setGroceryPurchased, addManualGroceryItem, removeGroceryItem,
  clearPurchasedGrocery, replacePlanGrocery, listPlan, getIngredientsFor,
  type GroceryItem,
} from '../../lib/db';
import { buildGroceryList, servingsByRecipe, AISLES } from '../../lib/grocery';
import { startOfWeek, addDays } from '../../lib/plan';
import { useTheme } from '../../theme/ThemeProvider';

export default function Shop() {
  const { c, fonts } = useTheme();
  const router = useRouter();

  const [items, setItems] = useState<GroceryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [newItem, setNewItem] = useState('');

  const load = useCallback(() => {
    let alive = true;
    listGrocery()
      .then((rows) => {
        if (!alive) return;
        setItems(rows);
        setDbError(null);
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        setDbError(e instanceof Error ? e.message : 'Could not read your list.');
        setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  useFocusEffect(load);

  /** Read this week's plan and turn it into shopping lines. */
  async function rebuildFromPlan() {
    setBusy(true);
    setNote(null);
    try {
      const start = startOfWeek();
      const entries = await listPlan(start, addDays(start, 6));
      if (entries.length === 0) {
        setNote('Nothing is planned this week yet.');
        return;
      }

      // Batch-aware: every entry sharing a batch was cooked once, so its
      // servings add up to a single scaling of the recipe.
      const needed = servingsByRecipe(entries);
      const details = await getIngredientsFor([...needed.keys()]);

      const planned = [...needed.entries()].flatMap(([recipeId, neededServings]) => {
        const d = details.get(recipeId);
        if (!d || d.lines.length === 0) return [];
        return [{
          recipeId, name: d.name, recipeServings: d.servings,
          neededServings, ingredientLines: d.lines,
        }];
      });

      if (planned.length === 0) {
        setNote('The planned recipes have no ingredients recorded.');
        return;
      }

      const lines = buildGroceryList(planned);
      await replacePlanGrocery(lines);
      setNote(`Built ${lines.length} item${lines.length === 1 ? '' : 's'} from ${planned.length} recipe${planned.length === 1 ? '' : 's'}.`);
      load();
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Could not build the list.');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(item: GroceryItem) {
    const next = !item.is_purchased;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_purchased: next ? 1 : 0 } : i)));
    await setGroceryPurchased(item.id, next);
  }

  async function addManual() {
    const name = newItem.trim();
    if (!name) return;
    setNewItem('');
    await addManualGroceryItem(name);
    load();
  }

  const grouped = useMemo(() => {
    const remaining = items.filter((i) => !i.is_purchased);
    const done = items.filter((i) => i.is_purchased);
    const byAisle = new Map<string, GroceryItem[]>();
    for (const i of remaining) {
      if (!byAisle.has(i.aisle)) byAisle.set(i.aisle, []);
      byAisle.get(i.aisle)!.push(i);
    }
    const order = [...AISLES, 'Other'];
    const sorted = [...byAisle.entries()].sort(
      (a, b) => order.indexOf(a[0] as never) - order.indexOf(b[0] as never)
    );
    return { sorted, done, remainingCount: remaining.length };
  }, [items]);

  const ItemRow = ({ item }: { item: GroceryItem }) => (
    <Row style={{ paddingVertical: 7, gap: 10 }}>
      <Pressable onPress={() => toggle(item)} hitSlop={8}>
        <View style={{
          width: 19, height: 19, borderRadius: 6, borderWidth: 1.8,
          borderColor: item.is_purchased ? c.fit : c.track,
          backgroundColor: item.is_purchased ? c.fit : 'transparent',
          alignItems: 'center', justifyContent: 'center',
        }}>
          {item.is_purchased ? <Text style={{ color: '#fff', fontSize: 11, lineHeight: 13 }}>✓</Text> : null}
        </View>
      </Pressable>
      <Pressable style={{ flex: 1 }} onPress={() => toggle(item)}>
        <Text style={{
          fontFamily: fonts.body, fontSize: 12.5,
          color: item.is_purchased ? c.inkFaint : c.ink,
          textDecorationLine: item.is_purchased ? 'line-through' : 'none',
        }}>
          {item.name}
        </Text>
        {item.recipes ? <Xs numberOfLines={1}>{item.recipes}</Xs> : null}
      </Pressable>
      {item.qty_text ? (
        <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: c.inkSoft }}>{item.qty_text}</Text>
      ) : null}
      <Pressable onPress={() => { setItems((p) => p.filter((x) => x.id !== item.id)); removeGroceryItem(item.id); }} hitSlop={8}>
        <Text style={{ fontSize: 13, color: c.inkFaint }}>✕</Text>
      </Pressable>
    </Row>
  );

  return (
    <Screen title="Grocery list" subtitle={loading ? 'Loading…' : `${grouped.remainingCount} to buy`}>
      {dbError ? (
        <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
          <H3>Storage unavailable</H3>
          <Sm style={{ textAlign: 'center', marginTop: 6 }}>{dbError}</Sm>
        </Card>
      ) : null}

      {note ? <Toast>{note}</Toast> : null}

      {loading ? <ActivityIndicator color={c.nut} style={{ marginTop: 20 }} /> : null}

      {!loading && !dbError && items.length === 0 ? (
        <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
          <Icon name="cart" size={28} color={c.inkFaint} />
          <H3 style={{ marginTop: 10 }}>Nothing to buy yet</H3>
          <Sm style={{ textAlign: 'center', marginTop: 5, marginBottom: 14 }}>
            Build this week's list from your meal plan. Ingredients are merged across
            recipes, and a prep batch is only bought once.
          </Sm>
          <Btn
            label={busy ? 'Building…' : 'Build from meal plan'}
            onPress={busy ? undefined : rebuildFromPlan}
            style={{ paddingHorizontal: 20, opacity: busy ? 0.6 : 1 }}
          />
          <Btn label="Go to plan" ghost onPress={() => router.push('/(nutrition)/plan')} style={{ marginTop: 8, paddingHorizontal: 20 }} />
        </Card>
      ) : null}

      {/* the list */}
      {grouped.sorted.map(([aisle, list]) => (
        <View key={aisle}>
          <Text style={{
            fontFamily: fonts.displayBold, fontSize: 9.5, color: c.fit,
            letterSpacing: 1, textTransform: 'uppercase', marginTop: 12, marginBottom: 2,
          }}>
            {aisle}
          </Text>
          <Card style={{ paddingVertical: 4 }}>
            {list.map((i) => <ItemRow key={i.id} item={i} />)}
          </Card>
        </View>
      ))}

      {grouped.done.length ? (
        <View>
          <Text style={{
            fontFamily: fonts.displayBold, fontSize: 9.5, color: c.inkFaint,
            letterSpacing: 1, textTransform: 'uppercase', marginTop: 12, marginBottom: 2,
          }}>
            In the basket · {grouped.done.length}
          </Text>
          <Card style={{ paddingVertical: 4 }}>
            {grouped.done.map((i) => <ItemRow key={i.id} item={i} />)}
          </Card>
        </View>
      ) : null}

      {items.length > 0 ? (
        <>
          <Card style={{ marginTop: 12 }}>
            <Ch>Add something</Ch>
            <Row style={{ gap: 8 }}>
              <TextInput
                value={newItem}
                onChangeText={setNewItem}
                onSubmitEditing={addManual}
                returnKeyType="done"
                placeholder="Kitchen roll, milk…"
                placeholderTextColor={c.inkFaint}
                style={{
                  flex: 1, borderWidth: 1, borderColor: c.line, backgroundColor: c.card,
                  borderRadius: 11, paddingHorizontal: 11, paddingVertical: 9,
                  fontFamily: fonts.body, fontSize: 12.5, color: c.ink,
                }}
              />
              <Pressable onPress={addManual}>
                <View style={{
                  backgroundColor: c.nut, borderRadius: 11, paddingHorizontal: 16,
                  paddingVertical: 10, opacity: newItem.trim() ? 1 : 0.5,
                }}>
                  <Text style={{ fontFamily: fonts.display, fontSize: 12.5, color: '#fff' }}>Add</Text>
                </View>
              </Pressable>
            </Row>
          </Card>

          <Btn
            label={busy ? 'Rebuilding…' : 'Rebuild from meal plan'}
            ghost
            onPress={busy ? undefined : rebuildFromPlan}
          />
          <Xs style={{ textAlign: 'center', marginTop: 6 }}>
            Keeps anything you added by hand, and anything already ticked off.
          </Xs>

          {grouped.done.length ? (
            <Pressable onPress={async () => { await clearPurchasedGrocery(); load(); }} style={{ marginTop: 14 }}>
              <Text style={{ fontFamily: fonts.semi, fontSize: 11.5, color: c.danger, textAlign: 'center' }}>
                Clear {grouped.done.length} purchased
              </Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
