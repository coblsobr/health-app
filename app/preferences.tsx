import { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from 'expo-router';
import { loadPreferences, savePreferences } from '../lib/preferences';
import { DEFAULT_PREFERENCES, DEFAULT_PANTRY, VEG_SWAPS, describePeople, type Preferences } from '../lib/prefs';
import { householdFrom, servingsPerCook } from '../lib/planner';
import { KINDS, NOT_DINNER, type MealKind } from '../lib/kinds';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Everything decided once, so planning a week is three taps: who is eating,
 * leftovers, what kinds of meals, ingredient swaps, and what is always in the
 * cupboard. Saved as you change it — there is no Save button to forget.
 */
export default function PreferencesScreen() {
  const { c, fonts } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [p, setP] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [staple, setStaple] = useState('');

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadPreferences().then((x) => { if (alive) setP(x); }).catch(() => {});
      return () => { alive = false; };
    }, [])
  );

  function update(next: Preferences) {
    setP(next);
    savePreferences(next).catch(() => {});
  }
  const people = (patch: Partial<Preferences['people']>) => update({ ...p, people: { ...p.people, ...patch } });

  function cycleKind(k: MealKind) {
    const kinds = { ...p.kinds };
    if (NOT_DINNER.includes(k)) {
      if (kinds[k] === 'more') delete kinds[k];
      else kinds[k] = 'more';
    } else if (!kinds[k]) kinds[k] = 'more';
    else if (kinds[k] === 'more') kinds[k] = 'skip';
    else delete kinds[k];
    update({ ...p, kinds });
  }

  function addSwap() {
    if (!from.trim() || !to.trim()) return;
    update({ ...p, swaps: [...p.swaps.filter((s) => s.from.toLowerCase() !== from.trim().toLowerCase()), { from: from.trim(), to: to.trim() }] });
    setFrom('');
    setTo('');
  }

  function addStaple() {
    const s = staple.trim().toLowerCase();
    if (!s || p.pantry.includes(s)) return;
    update({ ...p, pantry: [...p.pantry, s] });
    setStaple('');
  }

  const perCook = servingsPerCook(householdFrom(p.people));
  const PAD = 18;

  const Label = ({ children }: { children: string }) => (
    <Text style={{ fontFamily: fonts.semi, fontSize: 11, color: c.inkFaint, letterSpacing: 1.1, marginTop: 26, marginBottom: 6 }}>
      {children.toUpperCase()}
    </Text>
  );
  const Hint = ({ children }: { children: React.ReactNode }) => (
    <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: c.inkFaint, marginTop: 6, lineHeight: 18 }}>{children}</Text>
  );
  const Stepper = ({ label, sub, value, set, min = 0 }: { label: string; sub?: string; value: number; set: (n: number) => void; min?: number }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.body, fontSize: 15, color: c.ink }}>{label}</Text>
        {sub ? <Text style={{ fontFamily: fonts.body, fontSize: 12, color: c.inkFaint, marginTop: 1 }}>{sub}</Text> : null}
      </View>
      <Pressable onPress={() => set(Math.max(min, value - 1))} hitSlop={10} style={{ paddingHorizontal: 14 }}>
        <Text style={{ fontSize: 22, color: c.inkSoft }}>−</Text>
      </Pressable>
      <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: c.ink, minWidth: 24, textAlign: 'center' }}>{value}</Text>
      <Pressable onPress={() => set(value + 1)} hitSlop={10} style={{ paddingHorizontal: 14 }}>
        <Text style={{ fontSize: 22, color: c.inkSoft }}>+</Text>
      </Pressable>
    </View>
  );
  const Check = ({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) => (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, gap: 12 }}>
      <View
        style={{
          width: 20, height: 20, borderRadius: 4, borderWidth: 1.5,
          borderColor: on ? c.nut : c.line, backgroundColor: on ? c.nut : 'transparent',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        {on ? <Text style={{ color: '#fff', fontSize: 12, lineHeight: 14 }}>✓</Text> : null}
      </View>
      <Text style={{ fontFamily: fonts.body, fontSize: 15, color: c.ink, flex: 1 }}>{label}</Text>
    </Pressable>
  );
  const Chip = ({ label, on, off, onPress, onRemove }: { label: string; on?: boolean; off?: boolean; onPress?: () => void; onRemove?: () => void }) => (
    <Pressable
      onPress={onPress ?? onRemove}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingVertical: 7, paddingHorizontal: 12, borderRadius: 7, borderWidth: 1,
        borderColor: on ? c.nut : c.line, backgroundColor: on ? c.nut : 'transparent', opacity: off ? 0.55 : 1,
      }}
    >
      <Text style={{ fontFamily: on ? fonts.semi : fonts.body, fontSize: 13, color: on ? '#fff' : c.inkSoft, textDecorationLine: off ? 'line-through' : 'none' }}>
        {label}
      </Text>
      {onRemove ? <Text style={{ fontSize: 12, color: c.inkFaint }}>✕</Text> : null}
    </Pressable>
  );
  const input = {
    fontFamily: fonts.body, fontSize: 15, color: c.ink,
    borderBottomWidth: 1, borderBottomColor: c.line, paddingVertical: 7,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: insets.top + 14, paddingHorizontal: PAD, paddingBottom: 4,
        }}
      >
        <Text style={{ fontFamily: fonts.display, fontSize: 34, color: c.ink, letterSpacing: -0.5 }}>Preferences</Text>
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

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: PAD, paddingBottom: insets.bottom + 60 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ fontFamily: fonts.body, fontSize: 14, color: c.inkSoft, lineHeight: 20 }}>
          Set these once. Planning a week then only asks how many meals.
        </Text>

        <Label>Diet</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label="Anything" on={p.kinds.diet !== 'mostlyVeg'} onPress={() => update({ ...p, kinds: { ...p.kinds, diet: 'any' } })} />
          <Chip label="Mostly vegetarian" on={p.kinds.diet === 'mostlyVeg'} onPress={() => update({ ...p, kinds: { ...p.kinds, diet: 'mostlyVeg' } })} />
        </View>
        {p.kinds.diet === 'mostlyVeg' ? (
          <Hint>
            Vegetarian recipes come first. A recipe with ground beef, crumbles, meatballs, sausage, bacon or
            boneless chicken can still be planned — the grocery list buys a vegetarian stand-in instead:{' '}
            {VEG_SWAPS.filter((s) => !/broth|stock|bouillon/.test(s.from))
              .filter((s) => !p.swaps.some((m) => m.from.toLowerCase() === s.from))
              .map((s) => `${s.from} → ${s.to}`).join(', ')}
            . Steak, roasts, wings and seafood are left out. Add a swap below to buy a specific brand instead
            (e.g. chicken → Quorn chik'n).
          </Hint>
        ) : null}

        <Label>Who's eating</Label>
        <Stepper label="Adults" value={p.people.adults} set={(n) => people({ adults: n })} min={1} />
        <View style={{ height: 1, backgroundColor: c.line }} />
        <Stepper label="Little ones" sub="Counted as half a portion" value={p.people.kids} set={(n) => people({ kids: n })} />

        <Label>Leftovers</Label>
        <Check on={p.people.leftoverLunch} label="Enough for the next day's lunch" onPress={() => people({ leftoverLunch: !p.people.leftoverLunch })} />
        <Check on={p.people.extraDinner} label="Enough for a second dinner too" onPress={() => people({ extraDinner: !p.people.extraDinner })} />
        <Hint>
          {describePeople(p.people, p.kinds.diet)}. Each meal makes at least{' '}
          <Text style={{ fontFamily: fonts.semi, color: c.ink }}>{perCook} servings</Text>, scaled up in half-batch steps.
        </Hint>

        <Label>Sides</Label>
        <Check
          on={!!p.kinds.withSides}
          label="Add a side to each meal"
          onPress={() => update({ ...p, kinds: { ...p.kinds, withSides: !p.kinds.withSides } })}
        />
        <Hint>
          Picked from your recipes that are sides — salads, roasted vegetables, potatoes and the like,
          with nothing filling in them. Sides are never planned as the meal itself. Each one is made in the
          same amount as the meal and goes on the grocery list.
        </Hint>

        <Label>Kinds of meals</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {KINDS.filter((k) => !NOT_DINNER.includes(k)).map((k) => (
            <Chip
              key={k}
              on={p.kinds[k] === 'more'}
              off={p.kinds[k] === 'skip'}
              label={`${p.kinds[k] === 'more' ? 'More ' : ''}${k}`}
              onPress={() => cycleKind(k)}
            />
          ))}
        </View>
        <Hint>Tap once for more of it, twice to never plan it. Untouched means no preference.</Hint>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {NOT_DINNER.map((k) => (
            <Chip key={k} on={p.kinds[k] === 'more'} off={p.kinds[k] !== 'more'} label={k} onPress={() => cycleKind(k)} />
          ))}
        </View>
        <Hint>Not usually dinner, so left out of plans. Tap one to allow it.</Hint>

        <Label>Swaps</Label>
        {p.swaps.map((s) => (
          <View key={s.from} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 }}>
            <Text style={{ fontFamily: fonts.body, fontSize: 15, color: c.ink, flex: 1 }}>
              {s.from} <Text style={{ color: c.inkFaint }}>→</Text> {s.to}
            </Text>
            <Pressable onPress={() => update({ ...p, swaps: p.swaps.filter((x) => x !== s) })} hitSlop={10}>
              <Text style={{ fontSize: 15, color: c.inkFaint }}>✕</Text>
            </Pressable>
          </View>
        ))}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <TextInput value={from} onChangeText={setFrom} placeholder="chicken" placeholderTextColor={c.inkFaint} style={[input, { flex: 1 }]} />
          <Text style={{ color: c.inkFaint }}>→</Text>
          <TextInput
            value={to} onChangeText={setTo} placeholder="Quorn chik'n" placeholderTextColor={c.inkFaint}
            onSubmitEditing={addSwap} returnKeyType="done" style={[input, { flex: 1.3 }]}
          />
          <Pressable onPress={addSwap} hitSlop={8}>
            <Text style={{ fontFamily: fonts.semi, fontSize: 14, color: from.trim() && to.trim() ? c.nut : c.inkFaint }}>Add</Text>
          </Pressable>
        </View>
        <Hint>
          Changes what goes on the grocery list, not the recipe. The more specific rule wins, so
          "chicken broth → vegetable broth" beats "chicken → Quorn".
        </Hint>

        <Label>Always in the pantry</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {p.pantry.map((s) => (
            <Chip key={s} label={s} onRemove={() => update({ ...p, pantry: p.pantry.filter((x) => x !== s) })} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <TextInput
            value={staple} onChangeText={setStaple} placeholder="Add a staple" placeholderTextColor={c.inkFaint}
            onSubmitEditing={addStaple} returnKeyType="done" style={[input, { flex: 1 }]}
          />
          <Pressable onPress={addStaple} hitSlop={8}>
            <Text style={{ fontFamily: fonts.semi, fontSize: 14, color: staple.trim() ? c.nut : c.inkFaint }}>Add</Text>
          </Pressable>
        </View>
        <Hint>
          Listed at the bottom of the grocery list to check, and left out of the Meijer cart.{' '}
          <Text onPress={() => update({ ...p, pantry: DEFAULT_PANTRY })} style={{ color: c.nut }}>Reset to the usual</Text>
        </Hint>
      </ScrollView>
    </View>
  );
}
