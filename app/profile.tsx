import { View, Text } from 'react-native';
import { Screen } from '../components/Screen';
import { Card, Ch, KV, Sm, Toast, B } from '../components/ui';
import { Icon } from '../components/Icon';
import { useTheme } from '../theme/ThemeProvider';

export default function Profile() {
  const { c, fonts } = useTheme();
  return (
    <Screen title="Profile">
      <View style={{ alignItems: 'center', paddingVertical: 10 }}>
        <View
          style={{
            width: 82, height: 82, borderRadius: 41, backgroundColor: c.cardAlt,
            borderWidth: 2, borderColor: c.line, alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon name="person" size={44} color={c.inkFaint} />
          <View
            style={{
              position: 'absolute', bottom: 0, right: 0, width: 27, height: 27, borderRadius: 14,
              backgroundColor: c.nut, borderWidth: 2.5, borderColor: c.surface,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 11 }}>✎</Text>
          </View>
        </View>
        <Text style={{ fontFamily: fonts.display, fontSize: 20, color: c.ink, marginTop: 9 }}>Cody</Text>
        <Sm>cody@example.com</Sm>
      </View>

      <Toast>
        Tapping <B>✎</B> will open Android's system photo picker — it hands back only the one image you choose, so
        the app never needs gallery permission.
      </Toast>

      <Card>
        <Ch>Body</Ch>
        <KV k="Height" v="Not set" />
        <KV k="Weight" v="Not set" />
        <KV k="Age / Sex" v="Not set" />
        <KV k="Activity level" v="Not set" />
      </Card>

      <Card style={{ paddingVertical: 10 }}>
        <KV k="Household size" v="1 person" />
      </Card>

      <Sm style={{ textAlign: 'center' }}>Multiple profiles land alongside sync — the schema already allows for them.</Sm>
    </Screen>
  );
}
