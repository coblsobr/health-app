import { View, Text } from 'react-native';
import Constants from 'expo-constants';
import { Screen } from '../components/Screen';
import { Card, Ch, Row, Sm, Xs, KV, Toggle, Toast, B, Divider } from '../components/ui';
import { useTheme } from '../theme/ThemeProvider';

export default function Account() {
  const { c, fonts } = useTheme();
  const version = Constants.expoConfig?.version ?? '0.1.0';

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

      <Card>
        <Ch>App updates</Ch>
        <Row>
          <View>
            <Text style={{ fontFamily: fonts.semi, fontSize: 12, color: c.ink }}>v{version}</Text>
            <Xs>Shell build</Xs>
          </View>
          <View style={{ backgroundColor: c.tagA[0], borderRadius: 20, paddingVertical: 4, paddingHorizontal: 9 }}>
            <Text style={{ fontFamily: fonts.displayBold, fontSize: 9, color: c.tagA[1] }}>UP TO DATE</Text>
          </View>
        </Row>
        <Divider />
        <Row style={{ paddingVertical: 4 }}><Sm>Update automatically</Sm><Toggle on /></Row>
        <Xs style={{ marginTop: 4 }}>
          Checks on launch and installs in the background. You only reinstall the APK when something native changes.
        </Xs>
      </Card>

      <Toast>Your data lives on <B>your machine</B>. Nothing goes to a third party.</Toast>
    </Screen>
  );
}
