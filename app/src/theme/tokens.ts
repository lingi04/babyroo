export const colors = {
  background: '#FFFFFE',
  surface: '#FFFFFF',
  surfaceRaised: '#F3EDE8',
  surfaceSoft: '#F7EFE8',
  text: '#000000',
  muted: 'rgba(0, 0, 0, 0.62)',
  subtleText: 'rgba(0, 0, 0, 0.46)',
  inverseText: '#FFFFFF',
  inverseMuted: 'rgba(255, 255, 255, 0.72)',
  border: 'rgba(0, 0, 0, 0.12)',
  borderSubtle: 'rgba(0, 0, 0, 0.08)',
  primary: '#FA6A2E',
  primaryStrong: '#E85E25',
  primarySoft: '#FFE1D3',
  foreground: '#000000',
  foregroundSoft: '#171717',
  cream: '#F3EDE8',
  blue: '#2092F1',
  blueText: '#0F4D9C',
  mint: '#DFF3E8',
  mintText: '#14614C',
  lilac: '#EFE7F5',
  lilacText: '#65507C',
  amber: '#FFE5B8',
  amberText: '#8A4B13',
  coral: '#FA6A2E',
  coralSoft: '#FFE1D3',
  coralText: '#A74619',
  warning: '#A85B16',
  danger: '#D63E32',
  shadow: '#111111',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  pill: 999,
};

export const typography = {
  display: {
    fontSize: 34,
    lineHeight: 36,
    fontWeight: '900' as const,
  },
  title: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '900' as const,
  },
  section: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900' as const,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600' as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800' as const,
  },
};

export const layout = {
  screenPadding: spacing.xl,
  cardPadding: spacing.xl,
  cardGap: spacing.md,
  touchTarget: 48,
};

export const shadows = {
  card: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.12,
    shadowRadius: 30,
    elevation: 5,
  },
  elevated: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 38,
    elevation: 10,
  },
};
