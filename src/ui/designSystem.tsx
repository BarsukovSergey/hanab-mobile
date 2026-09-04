import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
  useWindowDimensions,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type ThemePreference = 'system' | 'light' | 'dark';
type ThemeScheme = 'light' | 'dark';

export type HanabTheme = {
  scheme: ThemeScheme;
  dark: boolean;
  colors: {
    background: string;
    surface: string;
    surfaceRaised: string;
    surfaceMuted: string;
    border: string;
    borderStrong: string;
    text: string;
    textMuted: string;
    accent: string;
    accentPressed: string;
    accentText: string;
    danger: string;
    dangerPressed: string;
    dangerText: string;
    success: string;
    warning: string;
    overlay: string;
    input: string;
  };
};

type ThemeContextValue = {
  theme: HanabTheme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const LIGHT: HanabTheme = {
  scheme: 'light',
  dark: false,
  colors: {
    background: '#f5f2ea', surface: '#fffdf8', surfaceRaised: '#ffffff',
    surfaceMuted: '#eee9dd', border: '#d8d0bf', borderStrong: '#a99f8c',
    text: '#25221d', textMuted: '#6c665b', accent: '#256c4b',
    accentPressed: '#1c543a', accentText: '#ffffff', danger: '#a23b35',
    dangerPressed: '#7e2e29', dangerText: '#ffffff', success: '#2f7a52',
    warning: '#9a6a13', overlay: 'rgba(37, 34, 29, 0.08)', input: '#ffffff',
  },
};

const DARK: HanabTheme = {
  scheme: 'dark',
  dark: true,
  colors: {
    background: '#151816', surface: '#1d211e', surfaceRaised: '#252a26',
    surfaceMuted: '#2b302c', border: '#3a423c', borderStrong: '#657068',
    text: '#f1eee6', textMuted: '#b7b1a6', accent: '#5aaa7d',
    accentPressed: '#468c66', accentText: '#101712', danger: '#d36a61',
    dangerPressed: '#b8524a', dangerText: '#1b0f0e', success: '#6dc394',
    warning: '#e2b45f', overlay: 'rgba(255, 255, 255, 0.07)', input: '#202521',
  },
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function HanabThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>('system');
  const scheme: ThemeScheme = preference === 'system'
    ? systemScheme === 'dark' ? 'dark' : 'light'
    : preference;
  const theme = scheme === 'dark' ? DARK : LIGHT;
  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    preference,
    setPreference,
  }), [preference, theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useHanabTheme() {
  const value = useContext(ThemeContext);
  if (value === null) throw new Error('useHanabTheme must be used inside HanabThemeProvider');
  return value;
}

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  const wide = width >= 760 || (width >= 620 && width > height);
  const tablet = width >= 900;
  return { width, height, wide, tablet, contentMaxWidth: tablet ? 1280 : wide ? 1080 : 720 };
}

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { theme, preference, setPreference } = useHanabTheme();
  const labels: readonly [ThemePreference, string][] = [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']];
  return <View accessibilityLabel="Appearance" style={styles.switcher}>
    {!compact && <Text style={[styles.switcherLabel, { color: theme.colors.textMuted }]}>Theme</Text>}
    <View style={[styles.switcherTrack, { backgroundColor: theme.colors.surfaceMuted }]}>
      {labels.map(([value, label]) => {
        const selected = preference === value;
        return <Pressable accessibilityRole="button" accessibilityState={{ selected }} key={value}
          onPress={() => setPreference(value)} style={({ pressed }) => [styles.switcherOption,
            selected && { backgroundColor: theme.colors.surfaceRaised }, pressed && { opacity: 0.72 }]}>
          <Text style={{ color: selected ? theme.colors.text : theme.colors.textMuted, fontSize: 12, fontWeight: selected ? '700' : '500' }}>{label}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}

export function Panel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { theme } = useHanabTheme();
  return <View style={[styles.panel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, style]}>{children}</View>;
}

export function SectionHeading({ title, detail }: { title: string; detail?: string }) {
  const { theme } = useHanabTheme();
  return <View style={styles.sectionHeading}><Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{title}</Text>
    {detail !== undefined && <Text style={[styles.sectionDetail, { color: theme.colors.textMuted }]}>{detail}</Text>}
  </View>;
}

type ActionButtonProps = {
  title: string; onPress: () => void; disabled?: boolean;
  tone?: 'primary' | 'secondary' | 'danger' | 'ghost'; compact?: boolean; style?: StyleProp<ViewStyle>;
};

export function ActionButton({ title, onPress, disabled = false, tone = 'secondary', compact = false, style }: ActionButtonProps) {
  const { theme } = useHanabTheme();
  const palette = tone === 'primary'
    ? { bg: theme.colors.accent, pressed: theme.colors.accentPressed, text: theme.colors.accentText, border: theme.colors.accent }
    : tone === 'danger'
      ? { bg: theme.colors.danger, pressed: theme.colors.dangerPressed, text: theme.colors.dangerText, border: theme.colors.danger }
      : tone === 'ghost'
        ? { bg: 'transparent', pressed: theme.colors.overlay, text: theme.colors.textMuted, border: 'transparent' }
        : { bg: theme.colors.surfaceRaised, pressed: theme.colors.surfaceMuted, text: theme.colors.text, border: theme.colors.borderStrong };
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [
    styles.button, compact && styles.buttonCompact,
    { backgroundColor: pressed ? palette.pressed : palette.bg, borderColor: palette.border }, disabled && styles.disabled, style,
  ]}><Text numberOfLines={1} style={[styles.buttonText, compact && styles.buttonTextCompact, { color: palette.text }]}>{title}</Text></Pressable>;
}

export function Field({ style, ...props }: TextInputProps & { style?: StyleProp<TextStyle> }) {
  const { theme } = useHanabTheme();
  return <TextInput placeholderTextColor={theme.colors.textMuted} selectionColor={theme.colors.accent} {...props}
    style={[styles.input, { backgroundColor: theme.colors.input, borderColor: theme.colors.borderStrong, color: theme.colors.text }, style]} />;
}

export function EmptyState({ children }: { children: ReactNode }) {
  const { theme } = useHanabTheme();
  return <Text style={[styles.empty, { color: theme.colors.textMuted }]}>{children}</Text>;
}

export function Pill({ children, active = false }: { children: ReactNode; active?: boolean }) {
  const { theme } = useHanabTheme();
  return <View style={[styles.pill, { backgroundColor: active ? theme.colors.accent : theme.colors.surfaceMuted,
    borderColor: active ? theme.colors.accent : theme.colors.border }]}>
    <Text style={[styles.pillText, { color: active ? theme.colors.accentText : theme.colors.textMuted }]}>{children}</Text>
  </View>;
}

export function Notice({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'error' | 'success' }) {
  const { theme } = useHanabTheme();
  const color = tone === 'error' ? theme.colors.danger : tone === 'success' ? theme.colors.success : theme.colors.textMuted;
  return <View style={[styles.notice, { backgroundColor: theme.colors.surfaceMuted, borderColor: color }]}><Text style={{ color, lineHeight: 20 }}>{children}</Text></View>;
}

const styles = StyleSheet.create({
  panel: { borderRadius: 16, borderWidth: 1, gap: 12, padding: 16 },
  sectionHeading: { gap: 2 }, sectionTitle: { fontSize: 19, fontWeight: '800', letterSpacing: 0.2 },
  sectionDetail: { fontSize: 13, lineHeight: 18 },
  button: { alignItems: 'center', borderRadius: 10, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 14, paddingVertical: 10 },
  buttonCompact: { borderRadius: 8, minHeight: 32, paddingHorizontal: 8, paddingVertical: 5 }, buttonText: { fontSize: 15, fontWeight: '700' },
  buttonTextCompact: { fontSize: 12 }, disabled: { opacity: 0.45 },
  input: { borderRadius: 10, borderWidth: 1, fontSize: 15, minHeight: 44, paddingHorizontal: 12, paddingVertical: 10 },
  empty: { fontSize: 14, fontStyle: 'italic', lineHeight: 20 }, pill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: '700' }, notice: { borderLeftWidth: 3, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  switcher: { alignItems: 'flex-end', gap: 4 }, switcherLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  switcherTrack: { borderRadius: 10, flexDirection: 'row', padding: 3 }, switcherOption: { borderRadius: 8, minHeight: 30, justifyContent: 'center', paddingHorizontal: 9 },
});
