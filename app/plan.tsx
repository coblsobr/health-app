import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useNavigation } from 'expo-router';
import {
  listForPlanner, getSetting, setSetting, replacePlan, markPastPlanMade, type PlannerRow,
} from '../lib/db';
import {
  buildPlan, setDay, clearDay, swapDay, candidatesFor, summarise, servingsPerCook,
  timesInPlan, toISODate, fromISODate, addDays, datesFrom, daysBetween, cadenceLabel,
  type Plan, type PlanRecipe, type Household, type Prefs,
} from '../lib/planner';
import { KINDS, inferKinds, type MealKind } from '../lib/kinds';
import { groceriesFromPlan, setPlanRange } from '../lib/shop';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Build a dinner plan.
 *
 * Two screens. Setup: how long, how much, what sounds good — or nothing, and
 * it picks. Review: every night is filled; tap one to swap it, choose it
 * yourself, lock it or clear it, and shuffle the rest. One button saves the
 * plan and makes the grocery list.
 *
 * The last saved plan reopens in review, so coming back to this screen shows
 * what is for dinner rather than a blank form.
 */

const HORIZONS: { label: string; days: number }[] = [
  { label: 'Week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: 'Month', days: 30 },
];

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Step = 'setup' | 'review';
type Saved = { plan: Plan; house: Household; prefs: Prefs };

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

export default function PlanScreen() {
  const { c, fonts } = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [rows, setRows] = useState<PlannerRow[]>([]);
  const [step, setStep] = useState<Step>('setup');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const [days, setDays] = useState(7);
  const [startIn, setStartIn] = useState(0);
  const [perMeal, setPerMeal] = useState(2.5);
  const [leftoverLunch, setLeftoverLunch] = useState(true);
  const [prefs, setPrefs] = useState<Prefs>({});

  const today = toISODate(new Date());
  // Reopen the saved plan once, on first visit — not on every focus, or
  // coming back from a recipe would throw away unsaved changes.
  const restored = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        // First, so a dinner eaten yesterday counts towards its rhythm today.
        await markPastPlanMade(today).catch(() => {});
        const [lib, hh, pf, cur] = await Promise.all([
          listForPlanner().catch(() => [] as PlannerRow[]),
          getSetting('household').catch(() => null),
          getSetting('plan_prefs').catch(() => null),
          getSetting('plan_current').catch(() => null),
        ]);
        if (!alive) return;
        setRows(lib);
        if (hh) {
          const h = JSON.parse(hh);
          if (typeof h.perMeal === 'number') setPerMeal(h.perMeal);
          if (typeof h.leftoverLunch === 'boolean') setLeftoverLunch(h.leftoverLunch);
        }
        if (pf) setPrefs(JSON.parse(pf));
        if (cur && !restored.current) {
          const saved: Saved = JSON.parse(cur);
          const end = addDays(saved.plan.start, saved.plan.days - 1);
          if (end >= today) {
            setPlan(saved.plan);
            setDays(saved.plan.days);
            setStep('review');
            setDirty(false);
          }
        }
        restored.current = true;
      })();
      return () => { alive = false; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const recipes: PlanRecipe[] = useMemo(
    () =>
      rows.map((r) => ({
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
      })),
    [rows]
  );
  const byId = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);

  const house: Household = { perMeal, leftoverLunch };
  const perCook = servingsPerCook(house);

  const nextMonday = (() => {
    const dow = new Date().getDay();
    return ((8 - dow) % 7) || 7;
  })();
  const STARTS = [
    { label: 'Today', offset: 0 },
    { label: 'Tomorrow', offset: 1 },
    ...(nextMonday > 1 ? [{ label: 'Next Monday', offset: nextMonday }] : []),
  ];
  const start = addDays(today, startIn);

  const kindCounts = useMemo(() => {
    const m = new Map<MealKind, number>();
    for (const r of recipes) for (const k of r.kinds) m.set(k, (m.get(k) ?? 0) + 1);
    return m;
  }, [recipes]);

  function cyclePref(k: MealKind) {
    setPrefs((p) => {
      const next = { ...p };
      if (!p[k]) next[k] = 'more';
      else if (p[k] === 'more') next[k] = 'skip';
      else delete next[k];
      return next;
    });
  }

  function build() {
    setSetting('household', JSON.stringify({ perMeal, leftoverLunch })).catch(() => {});
    setSetting('plan_prefs', JSON.stringify(prefs)).catch(() => {});
    setPlan(buildPlan(recipes, { start, days, house, prefs, seed: newSeed() }));
    setOpen(null);
    setDirty(true);
    setStep('review');
  }

  function shuffle() {
    if (!plan) return;
    const keep = plan.entries.filter((e) => e.locked);
    setPlan(buildPlan(recipes, { start: plan.start, days: plan.days, house, prefs, seed: newSeed(), keep }));
    setOpen(null);
    setDirty(true);
  }

  function edit(next: Plan) {
    setPlan(next);
    setDirty(true);
    setChoosing(false);
    setShowAll(false);
  }

  async function saveAndShop() {
    if (!plan) return;
    setBusy(true);
    try {
      const end = addDays(plan.start, plan.days - 1);
      await replacePlan(
        plan.start,
        end,
        plan.entries.map((e) => ({ date: e.date, recipeId: e.recipeId, servings: e.servingsMade }))
      );
      const saved: Saved = { plan, house, prefs };
      await setSetting('plan_current', JSON.stringify(saved));
      await setPlanRange({ from: plan.start, to: end });
      await groceriesFromPlan(plan.start, end);
      setDirty(false);
      router.push('/groceries' as never);
    } finally {
      setBusy(false);
    }
  }

  const PAD = 18;
  const Label = ({ children, first }: { children: string; first?: boolean }) => (
    <Text style={{ fontFamily: fonts.semi, fontSize: 11, color: c.inkFaint, letterSpacing: 1.1, marginTop: first ? 8 : 24, marginBottom: 8 }}>
      {children.toUpperCase()}
    </Text>
  );
  const Chip = ({ on, off, label, onPress }: { on: boolean; off?: boolean; label: string; onPress: () => void }) => (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 8, paddingHorizontal: 13, borderRadius: 7, borderWidth: 1,
        borderColor: on ? c.nut : c.line, backgroundColor: on ? c.nut : 'transparent',
        opacity: off ? 0.55 : 1,
      }}
    >
      <Text
        style={{
          fontFamily: on ? fonts.semi : fonts.body, fontSize: 13,
          color: on ? '#fff' : c.inkSoft,
          textDecorationLine: off ? 'line-through' : 'none',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
  const Action = ({ label, onPress, strong }: { label: string; onPress: () => void; strong?: boolean }) => (
    <Pressable onPress={onPress} hitSlop={8} style={{ paddingVertical: 6 }}>
      <Text style={{ fontFamily: strong ? fonts.bold : fonts.semi, fontSize: 13.5, color: c.nut }}>{label}</Text>
    </Pressable>
  );

  const dayLabel = (iso: string) => {
    const d = fromISODate(iso);
    return { dow: DOW[d.getDay()], date: `${MON[d.getMonth()]} ${d.getDate()}` };
  };

  const withRhythm = recipes.filter((r) => r.cadenceDays);
  const shownKinds = KINDS.filter((k) => (kindCounts.get(k) ?? 0) > 0);

  /* ── setup ─────────────────────────────────────────────────── */

  const setup = (
    <>
      <Label first>How long</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {HORIZONS.map((h) => (
          <Chip key={h.label} on={days === h.days} label={h.label} onPress={() => setDays(h.days)} />
        ))}
      </View>

      <Label>Starting</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {STARTS.map((s) => (
          <Chip key={s.label} on={startIn === s.offset} label={s.label} onPress={() => setStartIn(s.offset)} />
        ))}
      </View>

      <Label>How much</Label>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.body, fontSize: 15, color: c.ink }}>Servings per meal</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 12, color: c.inkFaint, marginTop: 2 }}>
            Count a little one as half
          </Text>
        </View>
        <Pressable onPress={() => setPerMeal((v) => Math.max(0.5, v - 0.5))} hitSlop={10} style={{ paddingHorizontal: 14 }}>
          <Text style={{ fontSize: 22, color: c.inkSoft }}>−</Text>
        </Pressable>
        <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: c.ink, minWidth: 34, textAlign: 'center' }}>{perMeal}</Text>
        <Pressable onPress={() => setPerMeal((v) => v + 0.5)} hitSlop={10} style={{ paddingHorizontal: 14 }}>
          <Text style={{ fontSize: 22, color: c.inkSoft }}>+</Text>
        </Pressable>
      </View>
      <View style={{ height: 1, backgroundColor: c.line }} />
      <Pressable
        onPress={() => setLeftoverLunch((v) => !v)}
        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 }}
      >
        <View
          style={{
            width: 20, height: 20, borderRadius: 4, borderWidth: 1.5,
            borderColor: leftoverLunch ? c.nut : c.line, backgroundColor: leftoverLunch ? c.nut : 'transparent',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          {leftoverLunch ? <Text style={{ color: '#fff', fontSize: 12, lineHeight: 14 }}>✓</Text> : null}
        </View>
        <Text style={{ fontFamily: fonts.body, fontSize: 15, color: c.ink, flex: 1 }}>
          Leftovers for the next day's lunch
        </Text>
      </Pressable>
      <Text style={{ fontFamily: fonts.body, fontSize: 13, color: c.inkSoft, lineHeight: 19 }}>
        Every dinner makes at least{' '}
        <Text style={{ fontFamily: fonts.semi, color: c.ink }}>{perCook} servings</Text>
        {leftoverLunch ? ` — ${perMeal} tonight, ${perMeal} for lunch.` : '.'} Recipes are scaled up in
        half-batch steps.
      </Text>

      <Label>What sounds good</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip on={Object.keys(prefs).length === 0} label="Surprise me" onPress={() => setPrefs({})} />
        {shownKinds.map((k) => (
          <Chip
            key={k}
            on={prefs[k] === 'more'}
            off={prefs[k] === 'skip'}
            label={`${prefs[k] === 'more' ? 'More ' : ''}${k}`}
            onPress={() => cyclePref(k)}
          />
        ))}
      </View>
      <Text style={{ fontFamily: fonts.body, fontSize: 12, color: c.inkFaint, marginTop: 8, lineHeight: 17 }}>
        {shownKinds.length === 0
          ? 'Add a few recipes and their kinds show up here.'
          : 'Tap once for more of it, twice to leave it out. Kinds are read from each recipe\'s name and ingredients.'}
      </Text>

      <Label>On a rhythm</Label>
      {withRhythm.length === 0 ? (
        <Text style={{ fontFamily: fonts.body, fontSize: 13, color: c.inkFaint, lineHeight: 19 }}>
          None yet. On the recipe list, tap "How often?" on a recipe to have it land in every plan
          on its own schedule.
        </Text>
      ) : (
        withRhythm.map((r) => {
          const n = timesInPlan(r, start, days);
          return (
            <View key={r.id} style={{ flexDirection: 'row', alignItems: 'baseline', paddingVertical: 8, gap: 10 }}>
              <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: 15, color: c.ink, flex: 1 }}>{r.name}</Text>
              <Text style={{ fontFamily: fonts.body, fontSize: 12, color: c.inkFaint }}>{cadenceLabel(r.cadenceDays)}</Text>
              <Text style={{ fontFamily: fonts.semi, fontSize: 12, color: n ? c.nut : c.inkFaint, minWidth: 52, textAlign: 'right' }}>
                {n ? `${n}× in plan` : 'not due'}
              </Text>
            </View>
          );
        })
      )}
    </>
  );

  /* ── review ────────────────────────────────────────────────── */

  const review = plan ? (() => {
    const s = summarise(plan);
    const entries = new Map(plan.entries.map((e) => [e.date, e]));
    const made = plan.entries.map((e) => e.servingsMade);
    const lo = Math.min(...made);
    const hi = Math.max(...made);

    return (
      <>
        <Text style={{ fontFamily: fonts.body, fontSize: 14.5, color: c.inkSoft, lineHeight: 21, marginTop: 4 }}>
          <Text style={{ fontFamily: fonts.semi, color: c.ink }}>
            {s.planned} dinner{s.planned === 1 ? '' : 's'}
          </Text>{' '}
          from {s.distinctRecipes} recipe{s.distinctRecipes === 1 ? '' : 's'}
          {s.planned ? ` · each makes ${lo === hi ? lo : `${lo}–${hi}`} servings` : ''}.
          {' '}Tap a night to change it.
        </Text>
        {s.open > 0 ? (
          <Text style={{ fontFamily: fonts.body, fontSize: 13, color: c.nut, marginTop: 8, lineHeight: 19 }}>
            {s.open} night{s.open === 1 ? '' : 's'} left open —{' '}
            {recipes.length === 0 ? 'add some recipes first.' : 'not enough recipes fit your preferences.'}
          </Text>
        ) : null}

        {datesFrom(plan.start, plan.days).map((date, i) => {
          const e = entries.get(date);
          const r = e ? byId.get(e.recipeId) : undefined;
          const { dow, date: dl } = dayLabel(date);
          const isOpen = open === date;
          const past = daysBetween(today, date) < 0;

          const choices = isOpen && choosing
            ? candidatesFor(date, new Map(plan.entries.filter((x) => x.date !== date).map((x) => [x.date, x])), recipes, {}, 1)
                .map((x) => x.r)
                .filter((x) => x.id !== e?.recipeId)
            : [];
          const listed = showAll ? recipes.filter((x) => x.id !== e?.recipeId) : choices.slice(0, 8);

          return (
            <View key={date}>
              {i % 7 === 0 && plan.days > 7 ? (
                <Text style={{ fontFamily: fonts.displayItalic, fontSize: 17, color: c.ink, marginTop: 22, marginBottom: 2 }}>
                  Week {i / 7 + 1}
                </Text>
              ) : null}
              <Pressable
                onPress={() => { setOpen(isOpen ? null : date); setChoosing(!e); setShowAll(false); }}
                style={{ flexDirection: 'row', paddingVertical: 11, gap: 12, opacity: past ? 0.5 : 1 }}
              >
                <View style={{ width: 50 }}>
                  <Text style={{ fontFamily: fonts.semi, fontSize: 12.5, color: c.nut }}>{dow}</Text>
                  <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: c.inkFaint }}>{dl}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={2} style={{ fontFamily: fonts.body, fontSize: 15.5, color: e ? c.ink : c.inkFaint, lineHeight: 20 }}>
                    {e ? e.name : 'Nothing yet — tap to choose'}
                  </Text>
                  {e ? (
                    <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: c.inkFaint, marginTop: 2 }}>
                      {e.servingsMade} servings{e.scale !== 1 ? ` (${e.scale}×)` : ''}
                      {e.reason === 'rhythm' && r?.cadenceDays ? ` · ${cadenceLabel(r.cadenceDays)}` : ''}
                      {e.locked ? ' · kept' : ''}
                      {r && r.kinds.length ? ` · ${r.kinds.filter((k) => k !== 'Quick').slice(0, 2).join(', ')}` : ''}
                    </Text>
                  ) : null}
                </View>
              </Pressable>

              {isOpen ? (
                <View style={{ marginLeft: 62, marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 20 }}>
                    {e ? <Action label="Swap" onPress={() => edit(swapDay(plan, date, recipes, prefs, house, newSeed()))} /> : null}
                    <Action label={choosing ? 'Hide list' : 'Choose'} onPress={() => { setChoosing((v) => !v); setShowAll(false); }} />
                    {e ? (
                      <Action
                        label={e.locked ? 'Unkeep' : 'Keep'}
                        onPress={() => edit({ ...plan, entries: plan.entries.map((x) => (x.date === date ? { ...x, locked: !x.locked } : x)) })}
                      />
                    ) : null}
                    {e ? <Action label="Clear" onPress={() => edit(clearDay(plan, date))} /> : null}
                    {e ? <Action label="Recipe" onPress={() => router.push(`/recipe/${e.recipeId}`)} /> : null}
                  </View>

                  {choosing ? (
                    <View style={{ marginTop: 4 }}>
                      {listed.map((x) => (
                        <Pressable key={x.id} onPress={() => edit(setDay(plan, date, x, house))} style={{ paddingVertical: 8 }}>
                          <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: 14.5, color: c.inkSoft }}>
                            {x.name}
                          </Text>
                        </Pressable>
                      ))}
                      {!showAll && recipes.length > listed.length + 1 ? (
                        <Action label={`All ${recipes.length} recipes`} onPress={() => setShowAll(true)} />
                      ) : null}
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
        <Text style={{ fontFamily: fonts.display, fontSize: 34, color: c.ink, letterSpacing: -0.5 }}>
          {step === 'setup' ? 'Plan' : 'Dinners'}
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

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: PAD, paddingBottom: insets.bottom + 150 }}
        showsVerticalScrollIndicator={false}
      >
        {step === 'setup' ? setup : review}
      </ScrollView>

      <View
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          paddingBottom: insets.bottom + 14, paddingTop: 12, paddingHorizontal: PAD,
          alignItems: 'center', backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.line,
        }}
      >
        <Pressable
          onPress={step === 'setup' ? build : saveAndShop}
          disabled={busy || (step === 'review' && !plan?.entries.length)}
          style={{
            backgroundColor: c.nut, paddingVertical: 15, borderRadius: 8, alignSelf: 'stretch', alignItems: 'center',
            opacity: busy || (step === 'review' && !plan?.entries.length) ? 0.6 : 1,
          }}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff', letterSpacing: 1 }}>
              {step === 'setup' ? 'BUILD MY PLAN' : dirty ? 'SAVE & MAKE GROCERY LIST' : 'REMAKE GROCERY LIST'}
            </Text>
          )}
        </Pressable>

        {step === 'review' ? (
          <View style={{ flexDirection: 'row', gap: 28, marginTop: 8 }}>
            <Action label="Shuffle" onPress={shuffle} />
            <Action label={dirty ? 'Settings' : 'New plan'} onPress={() => { setStep('setup'); setOpen(null); }} />
          </View>
        ) : null}
      </View>
    </View>
  );
}
