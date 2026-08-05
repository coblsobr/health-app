import { View, Text } from 'react-native';
import { Screen } from '../../components/Screen';
import { Card, Ch, Row, Sm, Xs, Chip, Btn } from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';

const TYPES = ['🏋️ Strength', '🏃 Run', '🚴 Ride', '🚶 Walk', '🧘 Mobility', '🏊 Swim'];

export default function Log() {
  const { c, fonts } = useTheme();
  return (
    <Screen title="Log a workout">
      <Card>
        <Ch>Type</Ch>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {TYPES.map((t, i) => <Chip key={t} label={t} on={i === 0} tone="fit" />)}
        </View>
      </Card>

      <Card>
        <Ch>Details</Ch>
        {[['Duration', '45 min'], ['Calories', 'auto-estimate'], ['When', 'Today, 6:12 AM'], ['Notes', 'optional']].map(([k, v]) => (
          <Row key={k} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.line }}>
            <Sm style={{ color: c.ink }}>{k}</Sm>
            <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: c.inkFaint }}>{v}</Text>
          </Row>
        ))}
      </Card>

      <Btn label="Save workout" tone="fit" />
      <Xs style={{ textAlign: 'center', marginTop: 8 }}>
        Manual logging is the backstop — most sessions will arrive from your watch automatically.
      </Xs>
    </Screen>
  );
}
