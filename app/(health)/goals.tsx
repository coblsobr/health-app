import { useCallback, useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Card, Ch, Row, Sm, Xs, KV, Chip, Seg, Toggle, Toast, B, Divider } from '../../components/ui';
import { getNumberSetting, setSetting } from '../../lib/db';
import { useTheme } from '../../theme/ThemeProvider';

const GOALS = ['🔥 Lose fat', '💪 Build muscle', '⚖️ Maintain', '🔁 Recomp', '🏃 Endurance'];

export default function Goals() {
  const { c, fonts } = useTheme();
  const [target, setTarget] = useState('2000');
  const [saved, setSaved] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getNumberSetting('calorie_target', 2000)
        .then((t) => { if (alive) setTarget(String(t)); })
        .catch(() => {});
      return () => { alive = false; };
    }, [])
  );

  async function save(value: string) {
    setTarget(value);
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) {
      await setSetting('calorie_target', String(Math.round(n)));
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  }
  return (
    <Screen title="Goals">
      <Card>
        <Ch>What are you after?</Ch>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {GOALS.map((g, i) => <Chip key={g} label={g} on={i === 0} />)}
        </View>
      </Card>

      <Card>
        <Ch>Pace</Ch>
        <Seg options={['0.5 lb', '1 lb', '1.5 lb', '2 lb']} active={1} />
        <Sm style={{ marginTop: 8 }}>per week · a 500 cal/day deficit</Sm>
        <Divider />
        <KV k="Target weight" v="178 lb" />
        <KV k="Est. arrival" v="Dec 14, 2026" sub />
      </Card>

      <Card>
        <Ch>Daily calorie target</Ch>
        <Row style={{ gap: 10 }}>
          <TextInput
            value={target}
            onChangeText={save}
            keyboardType="number-pad"
            placeholder="2000"
            placeholderTextColor={c.inkFaint}
            style={{
              flex: 1, borderWidth: 1, borderColor: c.line, backgroundColor: c.card,
              borderRadius: 11, paddingHorizontal: 11, paddingVertical: 10,
              fontFamily: fonts.displayBold, fontSize: 16, color: c.ink,
            }}
          />
          <Text style={{ fontFamily: fonts.semi, fontSize: 11, color: saved ? c.ok : c.inkFaint }}>
            {saved ? 'Saved' : 'cal / day'}
          </Text>
        </Row>
        <Xs style={{ marginTop: 6 }}>
          Drives the Diary and the Health tab. Working this out from your weight and
          activity needs body stats, which are not collected yet.
        </Xs>
      </Card>

      <Card>
        <Ch>Worked example</Ch>
        <KV k="Maintenance (TDEE)" v="2,966" />
        <KV k="Daily target" v="2,466" />
        <Divider />
        <KV k="Protein" v="165 g" sub />
        <KV k="Carbs" v="280 g" sub />
        <KV k="Fat" v="82 g" sub />
      </Card>

      <Card style={{ paddingVertical: 10 }}>
        <Row>
          <View>
            <Sm style={{ color: c.ink }}>Eat back exercise calories</Sm>
            <Xs>Budget grows on training days</Xs>
          </View>
          <Toggle on tone="hlth" />
        </Row>
      </Card>

      <Toast>Goals feed <B>both</B> planners — meals and workouts get picked to match.</Toast>
    </Screen>
  );
}
