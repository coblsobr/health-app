import { useRef, useState } from 'react';
import { View, Text, Pressable, Image, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../theme/ThemeProvider';

/**
 * A live camera for photographing a recipe page.
 *
 * The old flow was a form with a "📷 Camera" button that handed off to the
 * system camera app. This is the shape people expect instead: the viewfinder
 * fills the screen, the shutter is the big circle, and the gallery sits in the
 * corner next to it.
 *
 * Cookbook recipes often run across two pages, so shots stack up as thumbnails
 * and `onDone` receives all of them at once.
 */
export function PageCamera({
  onDone,
  onCancel,
  max = 4,
}: {
  onDone: (uris: string[]) => void;
  onCancel: () => void;
  max?: number;
}) {
  const { c, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);

  const [pages, setPages] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  async function shoot() {
    // takePictureAsync before onCameraReady returns a blank frame on Android.
    if (!camera.current || !ready || busy || pages.length >= max) return;
    setBusy(true);
    try {
      // Full quality: OCR accuracy depends almost entirely on resolution.
      const shot = await camera.current.takePictureAsync({ quality: 1 });
      if (shot?.uri) setPages((p) => [...p, shot.uri].slice(0, max));
    } catch {
      // A failed shot is not worth an error screen — the shutter just does
      // nothing and the viewfinder is still there to try again.
    } finally {
      setBusy(false);
    }
  }

  async function fromGallery() {
    // The system picker returns only what you choose, so this needs no
    // gallery permission of its own.
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsMultipleSelection: true,
      selectionLimit: max - pages.length,
    });
    if (!res.canceled) {
      const picked = res.assets.map((a) => a.uri);
      // Picking from the gallery is a complete choice in itself, so it goes
      // straight through rather than making you press Use as well.
      onDone([...pages, ...picked].slice(0, max));
    }
  }

  /* ── the camera cannot run here ── */
  if (Platform.OS === 'web') {
    return (
      <Fallback
        message="The camera only works in the installed app. You can still pick a screenshot."
        onPick={fromGallery}
        onCancel={onCancel}
      />
    );
  }

  if (!permission) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <Fallback
        message={
          permission.canAskAgain
            ? 'Photographing a page needs the camera.'
            : 'Camera access is off for this app. Turn it on in Settings, or pick a screenshot instead.'
        }
        onPick={fromGallery}
        onCancel={onCancel}
        onGrant={permission.canAskAgain ? requestPermission : undefined}
      />
    );
  }

  /* ── the viewfinder ── */
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        ref={camera}
        style={{ flex: 1 }}
        facing="back"
        onCameraReady={() => setReady(true)}
      />

      {/* close */}
      <Pressable
        onPress={onCancel}
        hitSlop={14}
        accessibilityLabel="Close the camera"
        accessibilityRole="button"
        style={{
          position: 'absolute',
          top: insets.top + 12,
          left: 18,
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: 'rgba(0,0,0,0.42)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#fff', fontSize: 19, lineHeight: 22 }}>✕</Text>
      </Pressable>

      {pages.length ? (
        <Text
          style={{
            position: 'absolute',
            top: insets.top + 19,
            alignSelf: 'center',
            fontFamily: fonts.semi,
            fontSize: 12.5,
            color: '#fff',
          }}
        >
          {pages.length} of {max} pages
        </Text>
      ) : null}

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingBottom: insets.bottom + 26,
          paddingTop: 18,
          paddingHorizontal: 24,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'rgba(0,0,0,0.34)',
        }}
      >
        {/* gallery, in the corner — the last shot shows here once there is one */}
        <Pressable
          onPress={pages.length ? undefined : fromGallery}
          onLongPress={fromGallery}
          hitSlop={12}
          accessibilityLabel={pages.length ? 'Pages taken' : 'Choose from your photos'}
          accessibilityRole="button"
          style={{
            width: 46,
            height: 46,
            borderRadius: 6,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.55)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {pages.length ? (
            <>
              <Image source={{ uri: pages[pages.length - 1] }} style={{ width: '100%', height: '100%' }} />
              <View
                style={{
                  position: 'absolute',
                  right: 0,
                  bottom: 0,
                  paddingHorizontal: 4,
                  backgroundColor: 'rgba(0,0,0,0.65)',
                }}
              >
                <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 10 }}>{pages.length}</Text>
              </View>
            </>
          ) : (
            <GalleryGlyph />
          )}
        </Pressable>

        {/* shutter */}
        <Pressable
          onPress={shoot}
          accessibilityLabel="Take a photo of the page"
          accessibilityRole="button"
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            borderWidth: 4,
            borderColor: 'rgba(255,255,255,0.9)',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: ready && pages.length < max ? 1 : 0.45,
          }}
        >
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' }} />
        </Pressable>

        {/* use what has been taken */}
        <Pressable
          onPress={() => pages.length && onDone(pages)}
          hitSlop={12}
          accessibilityLabel="Use these pages"
          accessibilityRole="button"
          style={{ width: 46, alignItems: 'flex-end' }}
        >
          <Text
            style={{
              fontFamily: fonts.bold,
              fontSize: 15,
              color: pages.length ? c.nut : 'rgba(255,255,255,0.4)',
            }}
          >
            {pages.length ? 'Read' : ''}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Shown when the camera is unavailable. Picking a photo still works. */
function Fallback({
  message,
  onPick,
  onCancel,
  onGrant,
}: {
  message: string;
  onPick: () => void;
  onCancel: () => void;
  onGrant?: () => void;
}) {
  const { c, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.surface,
        paddingTop: insets.top + 40,
        paddingHorizontal: 26,
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          fontFamily: fonts.body,
          fontSize: 14.5,
          color: c.inkSoft,
          textAlign: 'center',
          lineHeight: 21,
        }}
      >
        {message}
      </Text>

      {onGrant ? (
        <Pressable
          onPress={onGrant}
          style={{ marginTop: 20, backgroundColor: c.nut, borderRadius: 8, paddingVertical: 13, paddingHorizontal: 26 }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>Allow the camera</Text>
        </Pressable>
      ) : null}

      <Pressable onPress={onPick} style={{ marginTop: 16 }}>
        <Text style={{ fontFamily: fonts.semi, fontSize: 14, color: c.nut }}>Choose a photo instead</Text>
      </Pressable>

      <Pressable onPress={onCancel} style={{ marginTop: 18 }}>
        <Text style={{ fontFamily: fonts.body, fontSize: 13.5, color: c.inkFaint }}>Back</Text>
      </Pressable>
    </View>
  );
}

function GalleryGlyph() {
  return (
    <View style={{ width: 22, height: 18, borderWidth: 1.6, borderColor: '#fff', borderRadius: 3, overflow: 'hidden' }}>
      <View
        style={{
          position: 'absolute',
          bottom: -4,
          left: 2,
          width: 11,
          height: 11,
          backgroundColor: '#fff',
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}
