import { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Image, PanResponder, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Region } from '../lib/ocr';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Drag a rectangle over a photo to say which part to read.
 *
 * The camera gets its framing from the guide overlay; a photo out of the
 * gallery was never framed against anything, so the frame is drawn afterwards
 * instead. Same idea either way — the parser is told which half of the page it
 * is looking at rather than guessing.
 *
 * Nothing is cropped in the image sense. The rectangle is converted to 0-1
 * units and handed to the OCR region filter, which is why this needs no image
 * manipulation library and ships over the air.
 */

type Rect = { x: number; y: number; w: number; h: number };

const HANDLE = 30;
const MIN = 60;

export function CropFrame({
  uri,
  width,
  height,
  title,
  hint,
  onDone,
  onSkip,
  onBack,
}: {
  uri: string;
  /** Pixel size of the source image, used to normalise the rectangle. */
  width: number;
  height: number;
  title: string;
  hint: string;
  onDone: (region: Region) => void;
  /** Read the whole photo instead of a part of it. */
  onSkip: () => void;
  onBack: () => void;
}) {
  const { c, fonts } = useTheme();
  const insets = useSafeAreaInsets();

  const [box, setBox] = useState({ w: 0, h: 0 });
  const [rect, setRect] = useState<Rect | null>(null);
  const start = useRef<Rect | null>(null);

  /** Where the photo actually sits inside the area, once letterboxed. */
  const fitted = useMemo(() => {
    if (!box.w || !box.h || !width || !height) return null;
    const scale = Math.min(box.w / width, box.h / height);
    const w = width * scale;
    const h = height * scale;
    return { x: (box.w - w) / 2, y: (box.h - h) / 2, w, h };
  }, [box, width, height]);

  function onLayout(e: LayoutChangeEvent) {
    const { width: w, height: h } = e.nativeEvent.layout;
    setBox({ w, h });
  }

  // Start with a rectangle over the middle of the photo, inset a little.
  const current: Rect | null = useMemo(() => {
    if (rect) return rect;
    if (!fitted) return null;
    return {
      x: fitted.x + fitted.w * 0.08,
      y: fitted.y + fitted.h * 0.12,
      w: fitted.w * 0.84,
      h: fitted.h * 0.5,
    };
  }, [rect, fitted]);

  const clamp = (r: Rect): Rect => {
    if (!fitted) return r;
    const w = Math.max(MIN, Math.min(r.w, fitted.w));
    const h = Math.max(MIN, Math.min(r.h, fitted.h));
    return {
      w,
      h,
      x: Math.max(fitted.x, Math.min(r.x, fitted.x + fitted.w - w)),
      y: Math.max(fitted.y, Math.min(r.y, fitted.y + fitted.h - h)),
    };
  };

  /** Drag the middle to move the whole rectangle. */
  const move = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { start.current = currentRef.current; },
      onPanResponderMove: (_e, g) => {
        const s = start.current;
        if (!s) return;
        setRect(clampRef.current({ ...s, x: s.x + g.dx, y: s.y + g.dy }));
      },
    })
  ).current;

  /**
   * Corner handles. Each corner moves its own two edges, so the opposite
   * corner stays put — the rectangle resizes rather than sliding.
   */
  const corner = (cx: 'l' | 'r', cy: 't' | 'b') =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { start.current = currentRef.current; },
      onPanResponderMove: (_e, g) => {
        const s = start.current;
        if (!s) return;
        let { x, y, w, h } = s;
        if (cx === 'l') { x = s.x + g.dx; w = s.w - g.dx; } else { w = s.w + g.dx; }
        if (cy === 't') { y = s.y + g.dy; h = s.h - g.dy; } else { h = s.h + g.dy; }
        if (w < MIN) { if (cx === 'l') x = s.x + s.w - MIN; w = MIN; }
        if (h < MIN) { if (cy === 't') y = s.y + s.h - MIN; h = MIN; }
        setRect(clampRef.current({ x, y, w, h }));
      },
    });

  // PanResponder handlers are created once, so they must read live values
  // through refs rather than closing over the first render's state.
  const currentRef = useRef<Rect | null>(current);
  currentRef.current = current;
  const clampRef = useRef(clamp);
  clampRef.current = clamp;

  const corners = useRef({
    tl: corner('l', 't'),
    tr: corner('r', 't'),
    bl: corner('l', 'b'),
    br: corner('r', 'b'),
  }).current;

  function confirm() {
    if (!current || !fitted) return;
    onDone({
      x: (current.x - fitted.x) / fitted.w,
      y: (current.y - fitted.y) / fitted.h,
      w: current.w / fitted.w,
      h: current.h / fitted.h,
    });
  }

  const shade = 'rgba(0,0,0,0.55)';

  return (
    <View style={{ flex: 1, backgroundColor: '#000', paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: 18, paddingBottom: 10 }}>
        <Pressable onPress={onBack} hitSlop={12} style={{ paddingVertical: 6 }}>
          <Text style={{ color: '#fff', fontSize: 22, lineHeight: 24 }}>‹</Text>
        </Pressable>
        <Text style={{ fontFamily: fonts.display, fontSize: 22, color: '#fff' }}>{title}</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.72)', marginTop: 3 }}>
          {hint}
        </Text>
      </View>

      <View style={{ flex: 1 }} onLayout={onLayout}>
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />

        {current && fitted ? (
          <>
            {/* dim everything outside the rectangle */}
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: current.y, backgroundColor: shade }} />
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: current.y + current.h, bottom: 0, backgroundColor: shade }} />
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, width: current.x, top: current.y, height: current.h, backgroundColor: shade }} />
            <View pointerEvents="none" style={{ position: 'absolute', left: current.x + current.w, right: 0, top: current.y, height: current.h, backgroundColor: shade }} />

            {/* the rectangle */}
            <View
              {...move.panHandlers}
              style={{
                position: 'absolute',
                left: current.x,
                top: current.y,
                width: current.w,
                height: current.h,
                borderWidth: 2,
                borderColor: c.nut,
              }}
            />

            {/* corner handles, sized for a thumb rather than a mouse */}
            {([
              ['tl', current.x, current.y],
              ['tr', current.x + current.w - HANDLE, current.y],
              ['bl', current.x, current.y + current.h - HANDLE],
              ['br', current.x + current.w - HANDLE, current.y + current.h - HANDLE],
            ] as const).map(([key, left, top]) => (
              <View
                key={key}
                {...corners[key].panHandlers}
                style={{
                  position: 'absolute',
                  left,
                  top,
                  width: HANDLE,
                  height: HANDLE,
                  alignItems: key[1] === 'l' ? 'flex-start' : 'flex-end',
                  justifyContent: key[0] === 't' ? 'flex-start' : 'flex-end',
                }}
              >
                <View style={{ width: 16, height: 16, backgroundColor: c.nut, borderRadius: 2 }} />
              </View>
            ))}
          </>
        ) : null}
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingTop: 14,
          paddingBottom: insets.bottom + 18,
          gap: 14,
        }}
      >
        <Pressable onPress={onSkip} hitSlop={10}>
          <Text style={{ fontFamily: fonts.semi, fontSize: 13.5, color: 'rgba(255,255,255,0.75)' }}>
            Use the whole photo
          </Text>
        </Pressable>

        <Pressable
          onPress={confirm}
          style={{ backgroundColor: c.nut, borderRadius: 8, paddingVertical: 13, paddingHorizontal: 30 }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff', letterSpacing: 0.6 }}>Next</Text>
        </Pressable>
      </View>
    </View>
  );
}
