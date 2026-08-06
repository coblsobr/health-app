import { View, Text } from 'react-native';
import { Screen } from '../components/Screen';
import { Card, Ch, Row, Sm, Xs, KV, Toggle, Toast, B, Divider } from '../components/ui';
import { UpdatePanel } from '../components/UpdatePanel';
import { useTheme } from '../theme/ThemeProvider';

export default function Account() {
  const { c, fonts } = useTheme();

  return (
    <Screen title="Account & Sync">
      <Card>
        <Ch>Sync</Ch>
        <Row>
          <View>
            <Text style={{ fontFamily: fonts.display, fontSize: 13, color: c.ink }}>Off</Text>
            <Xs>Everything is stored on this device only</Xs>
          </View>
          <Toggle />
        </Row>
        <Divider />
        <KV k="Server" v="Not configured" sub />
        <Row style={{ paddingVertical: 5 }}><Sm>Wi-Fi only</Sm><Toggle /></Row>
      </Card>

      <UpdatePanel />

      <Toast>Your data lives on <B>your machine</B>. Nothing goes to a third party.</Toast>
    </Screen>
  );
}
