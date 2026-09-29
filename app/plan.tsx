import { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  listForPlanner, getSetting, setSetting, replacePlan, type PlannerRow,
} from '../lib/db';
import {
  planCadence, fillOpenDates, summarise, toISODate, cadenceLabel,
  DEFAULT_FILL, type PlanRecipe, type Household, type Targets, type PlanResult,
} from '../lib/planner';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Build a dinner plan.
 *
 * Three steps, in this order on purpose: say who is eating and for how long,
 * look at what the rhythms already claim, then decide what to do with the days
 * left over. The middle step is the point — a planner that jumps straight to a
 * finished month is one nobody trusts, because there is no moment where you
 * get to disagree with it.
 */

const HORIZONS: { label: string; days: number }[] = [
  { label: 'Week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: 'Month', days: 30 },
  { label: '3 months', days: 90 },
  { label: '6 months', days: 182 },
  { label: 'Year', days: 365 },
];

type Step = 'setup' | 'review' | 'saved';

export default function Plan() {
  const { c, fonts } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [library, setLibrary] = useState<PlannerRow[]>([]);
  const [step, setStep] = useState<Step>('setup');
  const [plan, setPlan] = useState<PlanResult | null>(null);

  const [days, setDays] = useState(7);
  const [adults, setAdults] = useState(2);
  const [kids, setKids] = useState(1);
  const [lunchPeople, setLunchPeople] = useState(2);
  const [basis, setBasis] = useState<'servings' | 'calories'>('servings');

  const [fromLibrary, setFromLibrary] = useState(0);
  const [neverTried, setNeverTried] = useState(0);
  const [minRating, setMinRating] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      listForPlanner().then((r) => { if (alive) setLibrary(r); }).catch(() => {});
      getSetting('household')
        .then((v) => {
          if (!alive || !v) return;
          const h = JSON.parse(v);
          setAdults(h.adults ?? 2);
          setKids(h.kids ?? 1);
          setLunchPeople(h.lunchPeople ?? 2);
          setBasis(h.basis ?? 'servings');
        })
        .catch(() => {});
      return () => { alive = false; };
    }, [])
  );

  const house: Household = { adults, kids, kidFactor: 0.5, lunchPeople };
  const targets: Targets = { basis, adultDinnerKcal: 700, adultLunchKcal: 550 };
  const start = toISODate(new Date());

  const recipes: PlanRecipe[] = library.map((r) => ({
    id: r.id,
    name: r.name,
    servings: r.servings || 4,
    kcal: r.kcal,
    rating: r.rating,
    cadenceDays: r.cadence_days,
    lastMade: r.last_made_at,
  }));

  const withRhythm = recipes.filter((r) => r.cadenceDays);

  function build() {
    setSetting('household', JSON.stringify({ adults, kids, lunchPeople, basis })).catch(() => {});
    setPlan(planCadence(recipes, start, days, house, targets));
    setFromLibrary(0);
    setNeverTried(0);
    setStep('review');
  }

  function autoFill() {
    if (!plan) return;
    setPlan(
      fillOpenDates(
        planCadence(recipes, start, days, house, targets),
        recipes,
        { ...DEFAULT_FILL, fromLibrary, neverTried, minRating },
        house,
        targets
      )
    );
  }

  async function save() {
    if (!plan) return;
    await replacePlan(
      start,
      plan.entries[plan.entries.length - 1]?.date ?? start,
      plan.entries.map((e) => ({
        date: e.date, recipeId: e.recipeId, batches: e.batches, servings: e.servingsMade,
      }))
    );
    setStep('saved');
  }

  const PAD = 18;
  const Label = ({ children }: { children: string }) => (
    <Text style={{ fontFamily: fonts.semi, fontSize: 11, color: c.inkFaint, letterSpacing: 1.1, marginTop: 22, marginBottom: 8 }}>
      {children.toUpperCase()}
    </Text>
  );
  const Chip = ({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) => (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 8, paddingHorizontal: 13, borderRadius: 7, borderWidth: 1,
        borderColor: on ? c.nut : c.line, backgroundColor: on ? c.nutSoft : 'transparent',
      }}
    >
      <Text style={{ fontFamily: on ? fonts.semi : fonts.body, fontSize: 13, color: on ? c.nut : c.inkSoft }}>{label}</Text>
    </Pressable>
  );
  const Stepper = ({ label, value, set, min = 0 }: { label: string; value: number; set: (n: number) => void; min?: number }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9 }}>
      <Text style={{ fontFamily: fonts.body, fontSize: 15, color: c.ink, flex: 1 }}>{label}</Text>
      <Pressable onPress={() => set(Math.max(min, value - 1))} hitSlop={10} style={{ paddingHorizontal: 14 }}>
        <Text style={{ fontSize: 20, color: c.inkSoft }}>−</Text>
      </Pressable>
      <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: c.ink, minWidth: 22, textAlign: 'center' }}>{value}</Text>
      <Pressable onPress={() => set(value + 1)} hitSlop={10} style={{ paddingHorizontal: 14 }}>
        <Text style={{ fontSize: 20, color: c.inkSoft }}>+</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <View style={{ paddingTop: insets.top + 14, paddingHorizontal: PAD, paddingBottom: 8 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 34, color: c.ink, letterSpacing: -0.5 }}>
          {step === 'setup' ? 'Plan' : step === 'review' ? 'Your plan' : 'Saved'}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: PAD, paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        {step === 'setup' ? (
          <>
            <Label>How far ahead</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {HORIZONS.map((h) => (
                <Chip key={h.label} on={days === h.days} label={h.label} onPress={() => setDays(h.days)} />
              ))}
            </View>

            <Label>Who is eating</Label>
            <Stepper label="Adults" value={adults} set={setAdults} min={1} />
            <View style={{ height: 1, backgroundColor: c.line }} />
            <Stepper label="Children" value={kids} set={setKids} />
            <View style={{ height: 1, backgroundColor: c.line }} />
            <Stepper label="Lunches from leftovers" value={lunchPeople} set={setLunchPeople} />
            <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: c.inkFaint, marginTop: 8, lineHeight: 18 }}>
              A child is counted as half an adult portion. Each dinner is scaled to feed everyone
              that night and to leave {lunchPeople === 0 ? 'nothing' : `${lunchPeople} lunch${lunchPeople === 1 ? '' : 'es'}`} for the next day.
            </Text>

            <Label>Work it out by</Label>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Chip on={basis === 'servings'} label="Servings" onPress={() => setBasis('servings')} />
              <Chip on={basis === 'calories'} label="Calories" onPress={() => setBasis('calories')} />
            </View>

            <Label>Rhythms set</Label>
            {withRhythm.length === 0 ? (
              <Text style={{ fontFamily: fonts.displayItalic, fontSize: 14.5, color: c.inkFaint, lineHeight: 21 }}>
                None yet. Open a recipe and set how often you want to make it — monthly, every three
                months — and it will schedule itself from here on.
              </Text>
            ) : (
              withRhythm.map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => router.push(`/recipe/${r.id}`)}
                  style={{ flexDirection: 'row', alignItems: 'baseline', paddingVertical: 10, gap: 10 }}
                >
                  <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: 15, color: c.ink, flex: 1 }}>
                    {r.name}
                  </Text>
                  <Text style={{ fontFamily: fonts.semi, fontSize: 12, color: c.nut }}>
                    {cadenceLabel(r.cadenceDays)}
                  </Text>
                </Pressable>
              ))
            )}
          </>
        ) : null}

        {step === 'review' && plan ? (
          <>
            {(() => {
              const s = summarise(plan, days);
              return (
                <Text style={{ fontFamily: fonts.body, fontSize: 14.5, color: c.inkSoft, lineHeight: 21, marginTop: 4 }}>
                  <Text style={{ fontFamily: fonts.semi, color: c.ink }}>{s.planned} of {s.days} dinners</Text> are
                  planned from the rhythms you set, using {s.distinctRecipes} recipe
                  {s.distinctRecipes === 1 ? '' : 's'} and {s.cookSessions} batch
                  {s.cookSessions === 1 ? '' : 'es'}.
                  {s.open > 0 ? ` ${s.open} days are still open.` : ''}
                </Text>
              );
            })()}

            {plan.openDates.length > 0 ? (
              <>
                <Label>Fill the open days</Label>
                <Stepper label="From recipes you've made" value={fromLibrary} set={setFromLibrary} />
                <View style={{ height: 1, backgroundColor: c.line }} />
                <Stepper label="Never tried from the library" value={neverTried} set={setNeverTried} />
                <View style={{ height: 1, backgroundColor: c.line }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 8 }}>
                  <Text style={{ fontFamily: fonts.body, fontSize: 15, color: c.ink, flex: 1 }}>At least</Text>
                  {[null, 6, 7, 8, 9].map((n) => (
                    <Pressable key={String(n)} onPress={() => setMinRating(n)} hitSlop={6}>
                      <Text
                        style={{
                          fontFamily: minRating === n ? fonts.bold : fonts.body,
                          fontSize: 13.5,
                          color: minRating === n ? c.nut : c.inkFaint,
                        }}
                      >
                        {n == null ? 'any' : `${n}★`}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Pressable
                  onPress={autoFill}
                  style={{ marginTop: 14, borderWidth: 1, borderColor: c.line, borderRadius: 8, paddingVertical: 12, alignItems: 'center' }}
                >
                  <Text style={{ fontFamily: fonts.semi, fontSize: 14, color: c.nut }}>Choose them for me</Text>
                </Pressable>

                <Text style={{ fontFamily: fonts.body, fontSize: 12, color: c.inkFaint, marginTop: 10, lineHeight: 18 }}>
                  Finding brand-new recipes online isn't wired up yet — see the note in the plan doc
                  about doing it from site feeds rather than a paid search API.
                </Text>
              </>
            ) : null}

            <Label>The plan</Label>
            {plan.entries.map((e) => (
              <View key={e.date + e.recipeId} style={{ paddingVertical: 11 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
                  <Text style={{ fontFamily: fonts.semi, fontSize: 11.5, color: c.nut, width: 54 }}>
                    {e.date.slice(5).replace('-', '/')}
                  </Text>
                  <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: 15, color: c.ink, flex: 1 }}>
                    {e.name}
                  </Text>
                  <Text style={{ fontFamily: fonts.semi, fontSize: 12, color: c.inkFaint }}>
                    {e.batches}×
                  </Text>
                </View>
                <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: c.inkFaint, marginLeft: 64, marginTop: 2 }}>
                  {e.servingsMade} servings · {e.dinnerServings} at dinner
                  {e.lunchServings > 0 ? ` · ${e.lunchServings} for lunches` : ''}
                </Text>
                <View style={{ height: 1, backgroundColor: c.line, marginTop: 10 }} />
              </View>
            ))}
          </>
        ) : null}

        {step === 'saved' ? (
          <Text style={{ fontFamily: fonts.body, fontSize: 15, color: c.inkSoft, lineHeight: 22, marginTop: 6 }}>
            Saved. The grocery list can be built from it next.
          </Text>
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
          onPress={step === 'setup' ? build : step === 'review' ? save : () => setStep('setup')}
          style={{ backgroundColor: c.nut, paddingVertical: 16, paddingHorizontal: 44, borderRadius: 8 }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff', letterSpacing: 1.1 }}>
            {step === 'setup' ? 'BUILD PLAN' : step === 'review' ? 'SAVE PLAN' : 'START AGAIN'}
          </Text>
        </Pressable>

        {step === 'review' ? (
          <Pressable onPress={() => setStep('setup')} style={{ marginTop: 10 }} hitSlop={8}>
            <Text style={{ fontFamily: fonts.body, fontSize: 13.5, color: c.inkFaint }}>Change the settings</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
