import { useRef, useState } from 'react';
import { View, Text, Pressable, Image, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { GUIDE, type Shot } from '../lib/ocr';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Two framed captures: the ingredients, then the directions.
 *
 * Photographing a whole cookbook page and working out which lines are
 * ingredients and which are method is the least reliable thing this app does,
 * and on-device OCR is not close to doing it well. Framing each half — the way
 * a bank makes you fit a cheque inside a rectangle — means the section is
 * known rather than guessed, and only the text inside the frame is read.
 *
 * The guide is shared with `lib/ocr.ts` so the rectangle drawn here and the
 * rectangle filtered against are the same rectangle.
 */

type Step = { key: 'ingredients' | 'directions'; title: string; hint: string };

const STEPS: Step[] = [
  { key: 'ingredients', title: 'Ingredients', hint: 'Fit the ingredients list inside the frame' },
  { key: 'directions', title: 'Directions', hint: 'Now fit the method inside the frame' },
];

export function PageCamera({
  onDone,
  onCancel,
}: {
  onDone: (shots: { ingredients: Shot; steps: Shot }) => void;
  onCancel: () => void;
}) {
  const { c, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);

  const [taken, setTaken] = useState<Shot[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const index = taken.length; // 0 = ingredients, 1 = directions
  const step = STEPS[Math.min(index, STEPS.length - 1)];

  function accept(next: Shot[]) {
    if (next.length >= 2) onDone({ ingredients: next[0], steps: next[1] });
    else setTaken(next);
  }

  async function shoot() {
    // takePictureAsync before onCameraReady returns a blank frame on Android.
    if (!camera.current || !ready || busy) return;
    setBusy(true);
    try {
      // Full quality: OCR accuracy depends almost entirely on resolution.
      const shot = await camera.current.takePictureAsync({ quality: 1 });
      if (shot?.uri) {
        accept([...taken, { uri: shot.uri, width: shot.width, height: shot.height }]);
      }
    } catch {
      // A failed shot is not worth an error screen — the shutter does nothing
      // and the viewfinder is still there to try again.
    } finally {
      setBusy(false);
    }
  }

  async function fromGallery() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    // A picked photo has no guide to have been framed against, so its width
    // and height are passed as zero and the region filter stands down.
    accept([...taken, { uri: a.uri, width: 0, height: 0 }]);
  }

  /* ── the camera cannot run here ── */
  if (Platform.OS === 'web') {
    return <Fallback message="The camera only works in the installed app." onPick={fromGallery} onCancel={onCancel} />;
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
            : 'Camera access is off for this app. Turn it on in Settings, or pick a photo instead.'
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
      <CameraView ref={camera} style={{ flex: 1 }} facing="back" onCameraReady={() => setReady(true)} />

      <Guide />

      {/* which shot you are on */}
      <View style={{ position: 'absolute', top: insets.top + 54, left: 0, right: 0, alignItems: 'center' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: c.nut, letterSpacing: 1.6 }}>
          {(index + 1).toString()} OF 2 · {step.title.toUpperCase()}
        </Text>
        <Text
          style={{
            fontFamily: fonts.semi,
            fontSize: 14,
            color: '#fff',
            marginTop: 5,
            textShadowColor: 'rgba(0,0,0,0.8)',
            textShadowRadius: 5,
          }}
        >
          {step.hint}
        </Text>
      </View>

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
        {/* gallery, in the corner — or the first shot, tap to retake it */}
        <Pressable
          onPress={taken.length ? () => setTaken([]) : fromGallery}
          hitSlop={12}
          accessibilityLabel={taken.length ? 'Retake the ingredients photo' : 'Choose from your photos'}
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
          {taken.length ? (
            <>
              <Image source={{ uri: taken[0].uri }} style={{ width: '100%', height: '100%' }} />
              <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)' }} />
              <Text style={{ position: 'absolute', color: '#fff', fontFamily: fonts.bold, fontSize: 9 }}>
                RETAKE
              </Text>
            </>
          ) : (
            <GalleryGlyph />
          )}
        </Pressable>

        {/* shutter */}
        <Pressable
          onPress={shoot}
          accessibilityLabel={`Photograph the ${step.title.toLowerCase()}`}
          accessibilityRole="button"
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            borderWidth: 4,
            borderColor: 'rgba(255,255,255,0.9)',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: ready && !busy ? 1 : 0.45,
          }}
        >
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' }} />
        </Pressable>

        <View style={{ width: 46 }} />
      </View>
    </View>
  );
}

/**
 * The frame. Everything outside it is dimmed so it is obvious what will be
 * read, and only the corners are drawn — a full rectangle competes with the
 * text you are trying to line up inside it.
 */
function Guide() {
  const { c } = useTheme();
  const shade = 'rgba(0,0,0,0.45)';
  const pct = (n: number) => `${n * 100}%` as const;

  const corner = {
    position: 'absolute' as const,
    width: 26,
    height: 26,
    borderColor: c.nut,
  };

  return (
    <View style={{ position: 'absolute', inset: 0 }} pointerEvents="none">
      {/* dim outside the frame */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: pct(GUIDE.y), backgroundColor: shade }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: pct(GUIDE.y + GUIDE.h), bottom: 0, backgroundColor: shade }} />
      <View style={{ position: 'absolute', left: 0, width: pct(GUIDE.x), top: pct(GUIDE.y), height: pct(GUIDE.h), backgroundColor: shade }} />
      <View style={{ position: 'absolute', right: 0, width: pct(1 - GUIDE.x - GUIDE.w), top: pct(GUIDE.y), height: pct(GUIDE.h), backgroundColor: shade }} />

      {/* corners */}
      <View style={{ position: 'absolute', left: pct(GUIDE.x), top: pct(GUIDE.y), width: pct(GUIDE.w), height: pct(GUIDE.h) }}>
        <View style={{ ...corner, top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 }} />
        <View style={{ ...corner, top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 }} />
        <View style={{ ...corner, bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 }} />
        <View style={{ ...corner, bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 }} />
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
    <View style={{ flex: 1, backgroundColor: c.surface, paddingTop: insets.top + 40, paddingHorizontal: 26, alignItems: 'center' }}>
      <Text style={{ fontFamily: fonts.body, fontSize: 14.5, color: c.inkSoft, textAlign: 'center', lineHeight: 21 }}>
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
