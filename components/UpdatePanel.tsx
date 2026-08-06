import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Platform } from 'react-native';
import * as Updates from 'expo-updates';
import { useTheme } from '../theme/ThemeProvider';
import { Card, Ch, Row, Sm, Xs, Divider } from './ui';

/**
 * Shows which build is running and lets you pull an over-the-air update on
 * demand. Updates normally arrive on their own at launch; this is here so a
 * push can be verified without waiting for a restart.
 */
export function UpdatePanel() {
  const { c, fonts } = useTheme();
  const { currentlyRunning, isUpdateAvailable, isUpdatePending } = Updates.useUpdates();
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // expo-updates is inert in Expo Go and in the web/dev bundle.
  const live = !__DEV__ && Platform.OS !== 'web';

  // isEmbeddedLaunch is false in dev too, so check `live` first or the dev
  // bundle claims to have been updated over the air.
  const label = !live
    ? 'Development bundle'
    : currentlyRunning.isEmbeddedLaunch
      ? 'Original install'
      : 'Updated over the air';

  const published = currentlyRunning.createdAt
    ? new Date(currentlyRunning.createdAt).toLocaleString()
    : '—';

  async function check() {
    setChecking(true);
    setNote(null);
    try {
      const res = await Updates.checkForUpdateAsync();
      if (res.isAvailable) {
        setNote('Update found — downloading…');
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync(); // restarts into the new version
      } else {
        setNote('You are on the latest version.');
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Could not reach the update server.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <Card>
      <Ch>App updates</Ch>

      <Row>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.semi, fontSize: 12, color: c.ink }}>{label}</Text>
          <Xs>Published {published}</Xs>
        </View>
        <View
          style={{
            backgroundColor: isUpdatePending ? c.goldSoft : c.tagA[0],
            borderRadius: 20,
            paddingVertical: 4,
            paddingHorizontal: 9,
          }}
        >
          <Text style={{ fontFamily: fonts.displayBold, fontSize: 9, color: isUpdatePending ? c.gold : c.tagA[1] }}>
            {isUpdatePending ? 'RESTART TO APPLY' : isUpdateAvailable ? 'UPDATE READY' : 'UP TO DATE'}
          </Text>
        </View>
      </Row>

      <Divider />

      <Row style={{ paddingVertical: 3 }}>
        <Sm>Channel</Sm>
        <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: c.inkSoft }}>
          {currentlyRunning.channel ?? 'development'}
        </Text>
      </Row>
      <Row style={{ paddingVertical: 3 }}>
        <Sm>Build</Sm>
        <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: c.inkSoft }}>
          {(currentlyRunning.runtimeVersion ?? '—').slice(0, 12)}
        </Text>
      </Row>

      <Pressable
        onPress={check}
        disabled={checking || !live}
        style={{
          marginTop: 10,
          borderRadius: 12,
          borderWidth: 1.4,
          borderColor: c.line,
          paddingVertical: 10,
          alignItems: 'center',
          opacity: live ? 1 : 0.45,
        }}
      >
        {checking ? (
          <ActivityIndicator size="small" color={c.nut} />
        ) : (
          <Text style={{ fontFamily: fonts.display, fontSize: 12, color: c.nut }}>Check for updates now</Text>
        )}
      </Pressable>

      {note ? <Xs style={{ marginTop: 7, textAlign: 'center' }}>{note}</Xs> : null}
      {!live ? <Xs style={{ marginTop: 7, textAlign: 'center' }}>Only active in the installed app.</Xs> : null}
    </Card>
  );
}
