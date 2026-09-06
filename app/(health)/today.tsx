import { useCallback, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Ring } from '../../components/Ring';
import { Card, Ch, Row, Sm, Xs, Tile, Prog, Toast, B, Divider } from '../../components/ui';
import { listDiary, getNumberSetting } from '../../lib/db';
import { toISODate } from '../../lib/plan';
import { useTheme } from '../../theme/ThemeProvider';

export default function HealthToday() {
  const { c, fonts } = useTheme();
  const router = useRouter();
  const today = toISODate(new Date());

  const [eaten, setEaten] = useState({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  const [target, setTarget] = useState(2000);
  const [loading, setLoading] = useState(true);
  const [meals, setMeals] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      Promise.all([listDiary(today), getNumberSetting('calorie_target', 2000)])
        .then(([entries, t]) => {
          if (!alive) return;
          let kcal = 0, protein = 0, carbs = 0, fat = 0;
          for (const e of entries) {
            kcal += e.kcal ?? 0; protein += e.protein_g ?? 0;
            carbs += e.carbs_g ?? 0; fat += e.fat_g ?? 0;
          }
          setEaten({ kcal: Math.round(kcal), protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat) });
          setMeals(entries.length);
          setTarget(t);
          setLoading(false);
        })
        .catch(() => { if (alive) setLoading(false); });
      return () => { alive = false; };
    }, [today])
  );

  // Burn stays at zero until Health Connect lands in Phase 8. Showing a
  // placeholder number here would quietly corrupt the one figure this screen
  // exists to get right.
  const burned = 0;
  const budget = target + burned;
  const left = budget - eaten.kcal;

  const Macro = ({ label, have, need, tone }: { label: string; have: number; need: number; tone: 'info' | 'gold' | 'nut' }) => (
    <View style={{ marginBottom: 7 }}>
      <Row style={{ marginBottom: 3 }}>
        <Text style={{ fontFamily: fonts.semi, fontSize: 10, color: c.inkSoft }}>{label}</Text>
        <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: c.ink }}>{have} / {need} g</Text>
      </Row>
      <Prog pct={(have / need) * 100} tone={tone} thin />
    </View>
  );

  return (
    <Screen title="Health" subtitle={new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}>
      <Card style={{ paddingVertical: 14 }}>
        {loading ? (
          <ActivityIndicator color={c.nut} style={{ height: 122 }} />
        ) : (
          <Ring
            value={String(Math.abs(left))}
            label={left >= 0 ? 'CALORIES LEFT' : 'CALORIES OVER'}
            pct={budget > 0 ? eaten.kcal / budget : 0}
            accent={left >= 0 ? c.nut : c.danger}
          />
        )}
        <Divider />
        <Row>
          {[
            [String(eaten.kcal), 'Eaten', c.nut],
            [burned ? `+ ${burned}` : '—', 'Burned', c.fit],
            [String(budget), 'Budget', c.ink],
          ].map(([v, l, col], i) => (
            <View key={l as string} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i ? 1 : 0, borderLeftColor: c.line }}>
              <Text style={{ fontFamily: fonts.displayBold, fontSize: 16, color: col as string, letterSpacing: -0.5 }}>{v}</Text>
              <Xs>{l}</Xs>
            </View>
          ))}
        </Row>
      </Card>

      <Toast>
        {meals === 0
          ? 'Nothing logged today yet. Log a meal in the Diary and it shows up here.'
          : 'Training burn is not counted yet — that arrives with Health Connect, and the budget will grow on days you train.'}
      </Toast>

      <Card>
        <Ch>Macros</Ch>
        <Macro label="Protein" have={eaten.protein} need={Math.round((target * 0.3) / 4)} tone="info" />
        <Macro label="Carbs" have={eaten.carbs} need={Math.round((target * 0.45) / 4)} tone="gold" />
        <Macro label="Fat" have={eaten.fat} need={Math.round((target * 0.25) / 9)} tone="nut" />
      </Card>

      <Row style={{ gap: 8 }}>
        <Tile value="—" label="Steps" />
        <Tile value="—" label="Resting HR" />
        <Tile value="—" label="Weight" />
      </Row>

      <Sm style={{ marginTop: 14, textAlign: 'center' }}>
        Steps, heart rate and weight arrive with Health Connect.
      </Sm>
    </Screen>
  );
}
