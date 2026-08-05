import { View, Text } from 'react-native';
import { Screen } from '../../components/Screen';
import { Card, Ch, Row, Sm, Xs, Seg, Btn, Toast, B } from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';

const LIST: [string, string, string, boolean][] = [
  ['Produce', 'Yellow onions', '3', false],
  ['Produce', 'Broccoli florets', '1 lb', true],
  ['Produce', 'Roma tomatoes', '6', false],
  ['Meat & Seafood', 'Salmon fillets', '1.5 lb', false],
  ['Dairy', 'Greek yogurt, plain', '32 oz', true],
  ['Dairy', 'Parmesan, grated', '8 oz', false],
  ['Pantry', 'Red lentils', '1 lb', false],
  ['Pantry', 'Coconut milk', '2 cans', false],
];

export default function Shop() {
  const { c, fonts } = useTheme();
  let lastAisle = '';

  return (
    <Screen title="Grocery list" subtitle="8 items · est. $112">
      <View style={{ marginBottom: 11 }}><Seg options={['List', 'Pantry', 'Cart']} active={0} /></View>

      <Toast>Skipped <B>4 items</B> you already have in the pantry.</Toast>

      <Card>
        {LIST.map(([aisle, name, qty, done]) => {
          const header = aisle !== lastAisle ? aisle : null;
          lastAisle = aisle;
          return (
            <View key={name}>
              {header ? (
                <Text style={{ fontFamily: fonts.displayBold, fontSize: 9.5, color: c.fit, letterSpacing: 1, textTransform: 'uppercase', marginTop: 10, marginBottom: 2 }}>
                  {header}
                </Text>
              ) : null}
              <Row style={{ paddingVertical: 7, gap: 9, justifyContent: 'flex-start' }}>
                <View
                  style={{
                    width: 17, height: 17, borderRadius: 6, borderWidth: 1.8,
                    borderColor: done ? c.fit : c.track, backgroundColor: done ? c.fit : 'transparent',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {done ? <Text style={{ color: '#fff', fontSize: 10, lineHeight: 12 }}>✓</Text> : null}
                </View>
                <Sm style={{ flex: 1, color: done ? c.inkFaint : c.ink, textDecorationLine: done ? 'line-through' : 'none' }}>{name}</Sm>
                <Text style={{ fontFamily: fonts.bold, fontSize: 10.5, color: c.inkSoft }}>{qty}</Text>
              </Row>
            </View>
          );
        })}
      </Card>

      <Btn label="🛒 Fill my Meijer cart" />
      <Xs style={{ textAlign: 'center', marginTop: 6 }}>Builds the cart — you place the order. Phase 7.</Xs>
    </Screen>
  );
}
