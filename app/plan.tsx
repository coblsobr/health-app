import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useNavigation } from 'expo-router';
import {
  listForPlanner, getSetting, setSetting, replacePlan, markPastPlanMade, saveRecipe, listSourceUrls,
  type PlannerRow, type RecipeInput,
} from '../lib/db';
import {
  buildPlan, setDay, swapDay, allowedRecipe, candidatesFor, servingsPerCook, householdFrom, cookDates,
  toISODate, fromISODate, addDays, cadenceLabel,
  type Plan, type PlanRecipe,
} from '../lib/planner';
import { inferKinds, meatStatus } from '../lib/kinds';
import { describePeople, DEFAULT_PREFERENCES, type Preferences } from '../lib/prefs';
import { loadPreferences } from '../lib/preferences';
import { groceriesFromPlan, setPlanRange } from '../lib/shop';
import { discover, SOURCES } from '../lib/discover';
import { estimateRecipe } from '../lib/nutrition';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Plan the week in three choices: how many meals, over how many days, and
 * whether to bring in something new from online. Everything else — who is
 * eating, leftovers, swaps — was decided once in Preferences.
 *
 * Then "Happy with these?": replace any meal, or pick one yourself, and one
 * button saves the plan and makes the grocery list.
 *
 * The last saved plan reopens here, so coming back shows what is for dinner.
 */

const DAY_CHOICES = [5, 7, 14];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Step = 'setup' | 'review';
type Saved = { plan: Plan };

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

export default function PlanScreen() {
  const { c, fonts } = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [rows, setRows] = useState<PlannerRow[]>([]);
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [step, setStep] = useState<Step>('setup');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const [meals, setMeals] = useState(3);
  const [days, setDays] = useState(7);
  const [online, setOnline] = useState(false);

  const today = toISODate(new Date());
  // Reopen the saved plan once, on first visit — not on every focus, or
  // coming back from a recipe would throw away unsaved changes.
  const restored = useRef(false);

  const reload = useCallback(async () => {
    const [lib, pr] = await Promise.all([
      listForPlanner().catch(() => [] as PlannerRow[]),
      loadPreferences().catch(() => DEFAULT_PREFERENCES),
    ]);
    setRows(lib);
    setPrefs(pr);
    return lib;
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        // First, so a dinner eaten yesterday counts towards its rhythm today.
        await markPastPlanMade(today).catch(() => {});
        await reload();
        const [choice, cur] = await Promise.all([
          getSetting('plan_choice').catch(() => null),
          getSetting('plan_current').catch(() => null),
        ]);
        if (!alive) return;
        if (choice) {
          try {
            const ch = JSON.parse(choice);
            if (typeof ch.meals === 'number') setMeals(ch.meals);
            if (typeof ch.days === 'number') setDays(ch.days);
            if (typeof ch.online === 'boolean') setOnline(ch.online);
          } catch {}
        }
        if (cur && !restored.current) {
          try {
            const saved: Saved = JSON.parse(cur);
            if (addDays(saved.plan.start, saved.plan.days - 1) >= today) {
              setPlan(saved.plan);
              setStep('review');
              setDirty(false);
            }
          } catch {}
        }
        restored.current = true;
      })();
      return () => { alive = false; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const toPlanRecipes = (list: PlannerRow[]): PlanRecipe[] =>
    list.map((r) => ({
      id: r.id,
      name: r.name,
      servings: r.servings || 4,
      rating: r.rating,
      favorite: !!r.is_favorite,
      cadenceDays: r.cadence_days,
      lastMade: r.last_made_at ? r.last_made_at.slice(0, 10) : null,
      kinds: inferKinds({
        name: r.name,
        ingredients: r.ingredients ? r.ingredients.split('\n') : [],
        tags: r.tags ? r.tags.split('\n') : [],
        minutes: r.minutes,
      }),
      meat: meatStatus({ name: r.name, ingredients: r.ingredients ? r.ingredients.split('\n') : [] }),
    }));

  const recipes = useMemo(() => toPlanRecipes(rows), [rows]);
  const byId = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);
  const house = householdFrom(prefs.people);
  const perCook = servingsPerCook(house);

  /** Fetch a few new recipes from the blogs, save them to the library, return their ids. */
  async function findNew(count: number): Promise<string[]> {
    const have = await listSourceUrls().catch(() => []);
    const report = await discover(SOURCES.filter((s) => s.standard).map((s) => s.id), count, have, {
      onProgress: (done, total) => setBusy(`Finding new recipes… ${done + 1} of ${total}`),
      // The same Preferences check the library gets: "no seafood" means no
      // prawns from a food blog either.
      accept: (r) =>
        allowedRecipe(
          {
            kinds: inferKinds({ name: r.name, ingredients: r.ingredients, tags: r.tags, minutes: (r.prepMin ?? 0) + (r.cookMin ?? 0) || null }),
            meat: meatStatus({ name: r.name, ingredients: r.ingredients }),
          },
          prefs.kinds
        ),
    });
    const ids: string[] = [];
    for (const f of report.found) {
      const r = f.recipe;
      const servings = r.servings ?? 4;
      let nutrition: RecipeInput['nutrition'] = r.nutrition
        ? { kcal: r.nutrition.calories, protein: r.nutrition.protein, carbs: r.nutrition.carbs, fat: r.nutrition.fat,
            fiber: r.nutrition.fiber, sugar: r.nutrition.sugar, sodium: r.nutrition.sodium, source: 'published' }
        : null;
      if (!nutrition) {
        const e = estimateRecipe(r.ingredients, servings);
        if (e.coverage >= 0.5) {
          const n = e.perServing;
          nutrition = { kcal: n.kcal, protein: n.protein, carbs: n.carbs, fat: n.fat, fiber: n.fiber, sugar: n.sugar, sodium: n.sodium, source: 'estimated' };
        }
      }
      ids.push(await saveRecipe({
        name: r.name, servings, prepMin: r.prepMin, cookMin: r.cookMin, sourceUrl: f.url,
        photoUri: r.imageUrl, notes: r.description, rating: null,
        ingredients: r.ingredients.map((text) => ({ text, isPrimary: false })),
        steps: r.steps, tags: ['Found online'], nutrition,
      }));
    }
    return ids;
  }

  async function makePlan() {
    setNote(null);
    setSetting('plan_choice', JSON.stringify({ meals, days, online })).catch(() => {});
    let lib = rows;
    let fresh: string[] = [];
    if (online) {
      setBusy('Finding new recipes…');
      try {
        fresh = await findNew(Math.max(1, Math.round(meals / 3)));
        lib = await reload();
      } catch {
        // Handled below: no new recipes is said the same way either way.
      }
      if (fresh.length === 0) setNote("Couldn't find anything new just now, so these are all from your library.");
    }
    const all = toPlanRecipes(lib);
    const mine = all.filter((r) => !fresh.includes(r.id));
    let p = buildPlan(mine, { start: today, days, meals, house, prefs: prefs.kinds, seed: newSeed() });

    // Put the new ones on the last cook days that are not a rhythm.
    const spots = p.entries.filter((e) => e.reason !== 'rhythm').map((e) => e.date).reverse();
    fresh.forEach((id, i) => {
      const r = all.find((x) => x.id === id);
      if (!r || !spots[i]) return;
      p = setDay(p, spots[i], r, house);
      p = { ...p, entries: p.entries.map((e) => (e.date === spots[i] ? { ...e, reason: 'new', locked: false } : e)) };
    });

    setPlan(p);
    setOpen(null);
    setDirty(true);
    setBusy(null);
    setStep('review');
  }

  function shuffle() {
    if (!plan) return;
    const keep = plan.entries.filter((e) => e.locked || e.reason === 'new');
    setPlan(buildPlan(recipes, {
      start: plan.start, days: plan.days, meals: plan.slots?.length, house, prefs: prefs.kinds, seed: newSeed(), keep,
    }));
    setOpen(null);
    setDirty(true);
  }

  function edit(next: Plan) {
    setPlan(next);
    setDirty(true);
    setChoosing(false);
    setShowAll(false);
  }

  async function confirm() {
    if (!plan) return;
    setBusy('Making your grocery list…');
    try {
      const end = addDays(plan.start, plan.days - 1);
      await replacePlan(
        plan.start, end,
        plan.entries.map((e) => ({ date: e.date, recipeId: e.recipeId, servings: e.servingsMade }))
      );
      await setSetting('plan_current', JSON.stringify({ plan } satisfies Saved));
      await setPlanRange({ from: plan.start, to: end });
      await setSetting('grocery_week', '-1').catch(() => {});
      await groceriesFromPlan(plan.start, end);
      setDirty(false);
      router.push('/groceries' as never);
    } finally {
      setBusy(null);
    }
  }

  const PAD = 18;
  const Label = ({ children, first }: { children: string; first?: boolean }) => (
    <Text style={{ fontFamily: fonts.semi, fontSize: 11, color: c.inkFaint, letterSpacing: 1.1, marginTop: first ? 8 : 26, marginBottom: 10 }}>
      {children.toUpperCase()}
    </Text>
  );
  const Chip = ({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) => (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1,
        borderColor: on ? c.nut : c.line, backgroundColor: on ? c.nut : 'transparent',
      }}
    >
      <Text style={{ fontFamily: on ? fonts.semi : fonts.body, fontSize: 14.5, color: on ? '#fff' : c.inkSoft }}>{label}</Text>
    </Pressable>
  );
  const Action = ({ label, onPress }: { label: string; onPress: () => void }) => (
    <Pressable onPress={onPress} hitSlop={8} style={{ paddingVertical: 6 }}>
      <Text style={{ fontFamily: fonts.semi, fontSize: 14, color: c.nut }}>{label}</Text>
    </Pressable>
  );
  const dayLabel = (iso: string) => {
    const d = fromISODate(iso);
    return { dow: DOW[d.getDay()], date: `${MON[d.getMonth()]} ${d.getDate()}` };
  };

  /* ── setup ─────────────────────────────────────────────────── */

  const setup = (
    <>
      <Label first>How many meals</Label>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Pressable onPress={() => setMeals((m) => Math.max(1, m - 1))} hitSlop={10} style={{ paddingHorizontal: 12 }}>
          <Text style={{ fontSize: 30, color: c.inkSoft }}>−</Text>
        </Pressable>
        <Text style={{ fontFamily: fonts.display, fontSize: 46, color: c.ink, minWidth: 56, textAlign: 'center' }}>{meals}</Text>
        <Pressable onPress={() => setMeals((m) => Math.min(days, m + 1))} hitSlop={10} style={{ paddingHorizontal: 12 }}>
          <Text style={{ fontSize: 30, color: c.inkSoft }}>+</Text>
        </Pressable>
      </View>

      <Label>Over how many days</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {DAY_CHOICES.map((d) => (
          <Chip key={d} on={days === d} label={`${d} days`} onPress={() => { setDays(d); setMeals((m) => Math.min(m, d)); }} />
        ))}
      </View>

      <Label>Recipes</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip on={!online} label="Just mine" onPress={() => setOnline(false)} />
        <Chip on={online} label="Mix in something new" onPress={() => setOnline(true)} />
      </View>
      {online ? (
        <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: c.inkFaint, marginTop: 8, lineHeight: 18 }}>
          About one in three meals comes from a food blog, and is saved to your recipes so you can keep it.
        </Text>
      ) : null}

      <View style={{ height: 1, backgroundColor: c.line, marginTop: 28 }} />
      <Pressable onPress={() => router.push('/preferences' as never)} style={{ paddingVertical: 14 }}>
        <Text style={{ fontFamily: fonts.body, fontSize: 13.5, color: c.inkSoft, lineHeight: 20 }}>
          {describePeople(prefs.people, prefs.kinds.diet)} — each meal makes{' '}
          <Text style={{ fontFamily: fonts.semi, color: c.ink }}>{perCook}+ servings</Text>.
          {prefs.swaps.length ? ` ${prefs.swaps.length} swap${prefs.swaps.length === 1 ? '' : 's'} on.` : ''}{' '}
          <Text style={{ color: c.nut, fontFamily: fonts.semi }}>Preferences</Text>
        </Text>
      </Pressable>
      <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: c.inkFaint, lineHeight: 18 }}>
        Cooking on {cookDates(today, days, meals).map((d) => dayLabel(d).dow).join(', ')}.
      </Text>
    </>
  );

  /* ── review ────────────────────────────────────────────────── */

  const review = plan ? (() => {
    const slots = plan.slots ?? plan.entries.map((e) => e.date);
    const entries = new Map(plan.entries.map((e) => [e.date, e]));
    return (
      <>
        <Text style={{ fontFamily: fonts.display, fontSize: 24, color: c.ink, marginTop: 2 }}>
          {dirty ? 'Happy with these?' : 'This week'}
        </Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 13.5, color: c.inkSoft, marginTop: 4, lineHeight: 19 }}>
          Tap a meal to replace it or pick one yourself.
        </Text>
        {note ? <Text style={{ fontFamily: fonts.body, fontSize: 13, color: c.nut, marginTop: 8, lineHeight: 19 }}>{note}</Text> : null}

        {slots.map((date) => {
          const e = entries.get(date);
          const r = e ? byId.get(e.recipeId) : undefined;
          const { dow, date: dl } = dayLabel(date);
          const isOpen = open === date;
          const others = new Map(plan.entries.filter((x) => x.date !== date).map((x) => [x.date, x]));
          const choices = isOpen && choosing
            ? (showAll ? recipes : candidatesFor(date, others, recipes, prefs.kinds, 1).map((x) => x.r).slice(0, 8))
                .filter((x) => x.id !== e?.recipeId)
            : [];
          const tag = e?.reason === 'new' ? 'New' : e?.reason === 'rhythm' && r?.cadenceDays ? cadenceLabel(r.cadenceDays) : null;

          return (
            <View key={date}>
              <Pressable
                onPress={() => { setOpen(isOpen ? null : date); setChoosing(!e); setShowAll(false); }}
                style={{ flexDirection: 'row', paddingVertical: 14, gap: 12 }}
              >
                <View style={{ width: 50 }}>
                  <Text style={{ fontFamily: fonts.semi, fontSize: 13, color: c.nut }}>{dow}</Text>
                  <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: c.inkFaint }}>{dl}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={2} style={{ fontFamily: fonts.body, fontSize: 16.5, color: e ? c.ink : c.inkFaint, lineHeight: 21 }}>
                    {e ? e.name : 'Nothing yet — tap to choose'}
                  </Text>
                  {e ? (
                    <Text style={{ fontFamily: fonts.body, fontSize: 12, color: c.inkFaint, marginTop: 3 }}>
                      {e.servingsMade} servings{e.scale !== 1 ? ` (make ${e.scale}×)` : ''}
                      {tag ? <Text style={{ color: c.nut, fontFamily: fonts.semi }}>{`  ·  ${tag}`}</Text> : null}
                    </Text>
                  ) : null}
                </View>
              </Pressable>

              {isOpen ? (
                <View style={{ marginLeft: 62, marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 22 }}>
                    {e ? <Action label="Replace" onPress={() => edit(swapDay(plan, date, recipes, prefs.kinds, house, newSeed()))} /> : null}
                    <Action label={choosing ? 'Hide list' : 'Pick one'} onPress={() => { setChoosing((v) => !v); setShowAll(false); }} />
                    {e ? <Action label="See recipe" onPress={() => router.push(`/recipe/${e.recipeId}`)} /> : null}
                  </View>
                  {choosing ? (
                    <View style={{ marginTop: 4 }}>
                      {choices.map((x) => (
                        <Pressable key={x.id} onPress={() => edit(setDay(plan, date, x, house))} style={{ paddingVertical: 9 }}>
                          <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: 15, color: c.inkSoft }}>{x.name}</Text>
                        </Pressable>
                      ))}
                      {!showAll ? <Action label={`All ${recipes.length} recipes`} onPress={() => setShowAll(true)} /> : null}
                    </View>
                  ) : null}
                </View>
              ) : null}
              <View style={{ height: 1, backgroundColor: c.line }} />
            </View>
          );
        })}
      </>
    );
  })() : null;

  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: insets.top + 14, paddingHorizontal: PAD, paddingBottom: 8,
        }}
      >
        <Text style={{ fontFamily: fonts.display, fontSize: 34, color: c.ink, letterSpacing: -0.5 }}>Plan</Text>
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
        contentContainerStyle={{ paddingHorizontal: PAD, paddingBottom: insets.bottom + 160 }}
        showsVerticalScrollIndicator={false}
      >
        {busy ? (
          <View style={{ alignItems: 'center', marginTop: 60, gap: 14 }}>
            <ActivityIndicator color={c.nut} size="large" />
            <Text style={{ fontFamily: fonts.semi, fontSize: 15, color: c.ink }}>{busy}</Text>
          </View>
        ) : step === 'setup' ? setup : review}
      </ScrollView>

      {!busy ? (
        <View
          style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            paddingBottom: insets.bottom + 14, paddingTop: 12, paddingHorizontal: PAD,
            alignItems: 'center', backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.line,
          }}
        >
          <Pressable
            onPress={step === 'setup' ? makePlan : confirm}
            disabled={step === 'review' && !plan?.entries.length}
            style={{
              backgroundColor: c.nut, paddingVertical: 16, borderRadius: 8, alignSelf: 'stretch', alignItems: 'center',
              opacity: step === 'review' && !plan?.entries.length ? 0.6 : 1,
            }}
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff', letterSpacing: 1 }}>
              {step === 'setup' ? 'MAKE MY PLAN' : dirty ? 'LOOKS GOOD — MAKE GROCERY LIST' : 'OPEN GROCERY LIST'}
            </Text>
          </Pressable>
          {step === 'review' ? (
            <View style={{ flexDirection: 'row', gap: 30, marginTop: 8 }}>
              <Action label="Shuffle all" onPress={shuffle} />
              <Action label="Start over" onPress={() => { setStep('setup'); setOpen(null); setNote(null); }} />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
