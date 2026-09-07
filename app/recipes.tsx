import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, Image, ScrollView, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { listRecipes, getSetting, setSetting, type Recipe } from '../lib/db';
import { useTheme } from '../theme/ThemeProvider';

type View_ = 'photos' | 'names';

/**
 * Recipes. The whole screen.
 *
 * Deliberately just three things: the recipes, a toggle between photos and
 * names in the bottom-left corner, and one Add button. No search, no sort, no
 * filter strip, no tab bar, no summary line. Everything that used to be here
 * was scaffolding around a library that is still nearly empty.
 */
export default function Recipes() {
  const { c, fonts } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [view, setView] = useState<View_>('photos');
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  // Restore the last-used view. Failing to read it is not worth surfacing.
  useEffect(() => {
    let alive = true;
    getSetting('recipes_view')
      .then((v) => { if (alive && (v === 'photos' || v === 'names')) setView(v); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      listRecipes()
        .then((r) => { if (!alive) return; setRecipes(r); setDbError(null); setLoading(false); })
        .catch((e) => {
          if (!alive) return;
          setDbError(e instanceof Error ? e.message : 'Could not read your recipes.');
          setLoading(false);
        });
      return () => { alive = false; };
    }, [])
  );

  const toggle = () => {
    const next: View_ = view === 'photos' ? 'names' : 'photos';
    setView(next);
    setSetting('recipes_view', next).catch(() => {});
  };

  // Without photos every tile is the same block of colour, which reads as a
  // loading state rather than a library. Vary it by id so the grid has life.
  const swatches = [c.g1[1], c.g2[1], c.g3[1], c.g5[1], c.g6[1], c.g4[1]];
  const swatchFor = (id: string) => {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return swatches[h % swatches.length];
  };

  const PAD = 18;
  const GAP = 10;
  const tile = (width - PAD * 2 - GAP) / 2;

  // The bar is absolute, so the scroll view needs to end above it.
  const BAR = 96;

  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <View style={{ paddingTop: insets.top + 14, paddingHorizontal: PAD, paddingBottom: 12 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 34, color: c.ink, letterSpacing: -0.5 }}>
          Recipes
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: PAD, paddingBottom: BAR + insets.bottom + 20 }}
        showsVerticalScrollIndicator={false}
      >
        {dbError ? (
          <Text style={{ fontFamily: fonts.body, fontSize: 13, color: c.danger }}>{dbError}</Text>
        ) : null}

        {!loading && !dbError && recipes.length === 0 ? (
          <Text style={{ fontFamily: fonts.displayItalic, fontSize: 15, color: c.inkFaint, marginTop: 10 }}>
            Nothing here yet.
          </Text>
        ) : null}

        {view === 'photos' ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
            {recipes.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => router.push(`/recipe/${r.id}`)}
                style={{ width: tile, marginBottom: 8 }}
              >
                <View style={{ width: tile, height: tile * 0.84, borderRadius: 6, overflow: 'hidden' }}>
                  {r.photo_uri ? (
                    <Image source={{ uri: r.photo_uri }} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <View
                      style={{
                        flex: 1,
                        backgroundColor: swatchFor(r.id),
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontFamily: fonts.display, fontSize: 28, color: 'rgba(255,255,255,0.6)' }}>
                        {r.name.trim().charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  numberOfLines={2}
                  style={{ fontFamily: fonts.medium, fontSize: 13, color: c.ink, marginTop: 6, lineHeight: 17 }}
                >
                  {r.name}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View>
            {recipes.map((r) => (
              <Pressable key={r.id} onPress={() => router.push(`/recipe/${r.id}`)}>
                <Text
                  numberOfLines={1}
                  style={{ fontFamily: fonts.body, fontSize: 16, color: c.ink, paddingVertical: 14 }}
                >
                  {r.name}
                </Text>
                <View style={{ height: 1, backgroundColor: c.line }} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* The only two controls on the screen. */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingBottom: insets.bottom + 18,
          paddingTop: 14,
          paddingHorizontal: PAD,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: c.surface,
        }}
      >
        <Pressable
          onPress={() => router.push('/recipe/import')}
          accessibilityRole="button"
          accessibilityLabel="Add a recipe"
          style={{
            backgroundColor: c.nut,
            paddingVertical: 17,
            paddingHorizontal: 54,
            borderRadius: 8,
          }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: '#fff', letterSpacing: 1.4 }}>
            ADD
          </Text>
        </Pressable>

        <Pressable
          onPress={toggle}
          hitSlop={16}
          accessibilityRole="button"
          accessibilityLabel={view === 'photos' ? 'Show names' : 'Show photos'}
          style={{ position: 'absolute', left: PAD, bottom: insets.bottom + 30 }}
        >
          {view === 'photos' ? <NamesGlyph tone={c.inkSoft} /> : <PhotosGlyph tone={c.inkSoft} />}
        </Pressable>
      </View>
    </View>
  );
}

/** Three stacked lines — tap to switch to the names list. */
function NamesGlyph({ tone }: { tone: string }) {
  return (
    <View style={{ width: 20, gap: 4 }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ height: 2, borderRadius: 1, backgroundColor: tone }} />
      ))}
    </View>
  );
}

/** Four squares — tap to switch back to the photo grid. */
function PhotosGlyph({ tone }: { tone: string }) {
  return (
    <View style={{ width: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ width: 8.5, height: 8.5, backgroundColor: tone }} />
      ))}
    </View>
  );
}
