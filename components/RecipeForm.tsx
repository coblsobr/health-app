import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Image, KeyboardAvoidingView, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../theme/ThemeProvider';
import { Card, Ch, Row, Sm, Xs, Btn, Divider } from './ui';
import { Icon } from './Icon';
import type { RecipeInput } from '../lib/db';

export const ALL_TAGS = [
  'Vegetarian', 'Vegan', 'Gluten free', 'Dairy free',
  'Low sodium', 'High protein', 'Quick', 'Anti-inflammatory',
];

type Props = {
  initial?: Partial<RecipeInput>;
  submitLabel: string;
  onSubmit: (input: RecipeInput) => Promise<void>;
  onCancel: () => void;
};

export function RecipeForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const { c, fonts } = useTheme();

  const [name, setName] = useState(initial?.name ?? '');
  const [servings, setServings] = useState(String(initial?.servings ?? 4));
  const [prep, setPrep] = useState(initial?.prepMin != null ? String(initial.prepMin) : '');
  const [cook, setCook] = useState(initial?.cookMin != null ? String(initial.cookMin) : '');
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [photoUri, setPhotoUri] = useState<string | null>(initial?.photoUri ?? null);
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [ingredients, setIngredients] = useState<{ text: string; isPrimary: boolean }[]>(
    initial?.ingredients?.length ? initial.ingredients : [{ text: '', isPrimary: false }]
  );
  const [steps, setSteps] = useState<string[]>(initial?.steps?.length ? initial.steps : ['']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const input = {
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.card,
    borderRadius: 11,
    paddingHorizontal: 11,
    paddingVertical: 9,
    fontFamily: fonts.body,
    fontSize: 13,
    color: c.ink,
  } as const;

  async function pickPhoto() {
    // The system picker returns only the chosen image, so no gallery
    // permission prompt is needed.
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!res.canceled && res.assets[0]) setPhotoUri(res.assets[0].uri);
  }

  async function submit() {
    if (!name.trim()) {
      setError('Give the recipe a name.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        servings: Math.max(1, parseInt(servings, 10) || 1),
        prepMin: prep ? parseInt(prep, 10) : null,
        cookMin: cook ? parseInt(cook, 10) : null,
        sourceUrl: sourceUrl.trim() || null,
        photoUri,
        notes: notes.trim() || null,
        rating: initial?.rating ?? null,
        ingredients: ingredients.filter((i) => i.text.trim()),
        steps: steps.filter((s) => s.trim()),
        tags,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {error ? (
          <View style={{ backgroundColor: c.dangerSoft, borderRadius: 12, padding: 10, marginBottom: 10 }}>
            <Text style={{ fontFamily: fonts.semi, fontSize: 11.5, color: c.danger }}>{error}</Text>
          </View>
        ) : null}

        <Pressable onPress={pickPhoto}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={{ width: '100%', height: 150, borderRadius: 15, marginBottom: 10 }} />
          ) : (
            <View
              style={{
                height: 96, borderRadius: 15, borderWidth: 1.4, borderColor: c.line, borderStyle: 'dashed',
                alignItems: 'center', justifyContent: 'center', marginBottom: 10, gap: 5, backgroundColor: c.card,
              }}
            >
              <Icon name="camera" size={22} color={c.inkFaint} />
              <Xs>Add a photo</Xs>
            </View>
          )}
        </Pressable>

        <Card>
          <Ch>The basics</Ch>
          <TextInput
            value={name} onChangeText={setName} style={input}
            placeholder="Recipe name" placeholderTextColor={c.inkFaint}
          />
          <Row style={{ gap: 8, marginTop: 8 }}>
            {([['Servings', servings, setServings], ['Prep min', prep, setPrep], ['Cook min', cook, setCook]] as const).map(
              ([label, val, set]) => (
                <View key={label} style={{ flex: 1 }}>
                  <Xs style={{ marginBottom: 3 }}>{label}</Xs>
                  <TextInput
                    value={val} onChangeText={set} style={input}
                    keyboardType="number-pad" placeholder="—" placeholderTextColor={c.inkFaint}
                  />
                </View>
              )
            )}
          </Row>
        </Card>

        <Card>
          <Ch right={<Text style={{ fontFamily: fonts.bold, fontSize: 10, color: c.nut }}>{ingredients.length}</Text>}>
            Ingredients
          </Ch>
          <Xs style={{ marginBottom: 7 }}>
            One per line, as you'd write it — "2 cloves garlic, minced". Star the main one.
          </Xs>
          {ingredients.map((ing, i) => (
            <Row key={i} style={{ gap: 6, marginBottom: 6 }}>
              <TextInput
                value={ing.text}
                onChangeText={(t) => setIngredients((prev) => prev.map((x, j) => (j === i ? { ...x, text: t } : x)))}
                style={[input, { flex: 1 }]}
                placeholder={i === 0 ? '2 cloves garlic, minced' : ''}
                placeholderTextColor={c.inkFaint}
              />
              <Pressable
                onPress={() => setIngredients((prev) => prev.map((x, j) => (j === i ? { ...x, isPrimary: !x.isPrimary } : x)))}
                hitSlop={6}
                style={{
                  width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: ing.isPrimary ? c.gold : c.cardAlt,
                }}
              >
                <Text style={{ fontSize: 14, color: ing.isPrimary ? '#fff' : c.inkFaint }}>★</Text>
              </Pressable>
              <Pressable
                onPress={() => setIngredients((prev) => (prev.length === 1 ? prev : prev.filter((_, j) => j !== i)))}
                hitSlop={6}
              >
                <Text style={{ fontSize: 15, color: c.inkFaint }}>✕</Text>
              </Pressable>
            </Row>
          ))}
          <Pressable onPress={() => setIngredients((p) => [...p, { text: '', isPrimary: false }])}>
            <Text style={{ fontFamily: fonts.semi, fontSize: 11.5, color: c.nut, marginTop: 2 }}>+ Add ingredient</Text>
          </Pressable>
        </Card>

        <Card>
          <Ch>Directions</Ch>
          {steps.map((s, i) => (
            <Row key={i} style={{ gap: 6, marginBottom: 6, alignItems: 'flex-start' }}>
              <Text style={{ fontFamily: fonts.displayBold, fontSize: 13, color: c.nut, marginTop: 10, width: 16 }}>{i + 1}</Text>
              <TextInput
                value={s}
                onChangeText={(t) => setSteps((prev) => prev.map((x, j) => (j === i ? t : x)))}
                style={[input, { flex: 1, minHeight: 44 }]}
                multiline
                placeholder={i === 0 ? 'Heat the oven to 400°F…' : ''}
                placeholderTextColor={c.inkFaint}
              />
              <Pressable
                onPress={() => setSteps((prev) => (prev.length === 1 ? prev : prev.filter((_, j) => j !== i)))}
                hitSlop={6}
              >
                <Text style={{ fontSize: 15, color: c.inkFaint, marginTop: 10 }}>✕</Text>
              </Pressable>
            </Row>
          ))}
          <Pressable onPress={() => setSteps((p) => [...p, ''])}>
            <Text style={{ fontFamily: fonts.semi, fontSize: 11.5, color: c.nut, marginTop: 2 }}>+ Add step</Text>
          </Pressable>
        </Card>

        <Card>
          <Ch>Tags</Ch>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {ALL_TAGS.map((t) => {
              const on = tags.includes(t);
              return (
                <Pressable key={t} onPress={() => setTags((p) => (on ? p.filter((x) => x !== t) : [...p, t]))}>
                  <View
                    style={{
                      backgroundColor: on ? c.nut : c.cardAlt, borderColor: on ? c.nut : c.line, borderWidth: 1,
                      borderRadius: 30, paddingVertical: 6, paddingHorizontal: 11,
                    }}
                  >
                    <Text style={{ fontFamily: fonts.semi, fontSize: 10.5, color: on ? '#fff' : c.inkSoft }}>{t}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Card>
          <Ch>Extras</Ch>
          <Xs style={{ marginBottom: 3 }}>Source link</Xs>
          <TextInput
            value={sourceUrl} onChangeText={setSourceUrl} style={input}
            autoCapitalize="none" keyboardType="url"
            placeholder="https://…" placeholderTextColor={c.inkFaint}
          />
          <Divider />
          <Xs style={{ marginBottom: 3 }}>Notes</Xs>
          <TextInput
            value={notes} onChangeText={setNotes} style={[input, { minHeight: 60 }]} multiline
            placeholder="Halve the salt next time…" placeholderTextColor={c.inkFaint}
          />
        </Card>

        <Btn label={saving ? 'Saving…' : submitLabel} onPress={submit} />
        <Btn label="Cancel" ghost onPress={onCancel} style={{ marginTop: 8 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
