import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';

export const COLORS = {
  bg: '#F5F2EB',
  card: '#FFFEFA',
  border: '#D7D3CA',
  accent: '#BE1C2D',
  text: '#17191B',
  muted: '#686B6F',
  subtle: '#777A7D',
  green: '#18794E',
  greenBg: '#E7F4EC',
  red: '#A61B29',
  redBg: '#FBE9E9',
  yellow: '#A86408',
  yellowBg: '#F8EEDC',
  blue: '#315F8A',
  blueBg: '#E8EFF5',
  purple: '#654B8E',
};

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function StatCard({
  label,
  value,
  sublabel,
  color = COLORS.text,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  color?: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      {sublabel ? <Text style={styles.statSub}>{sublabel}</Text> : null}
    </View>
  );
}

export function Badge({
  label,
  variant = 'gray',
}: {
  label: string;
  variant?: 'gray' | 'green' | 'red' | 'yellow' | 'blue' | 'purple' | 'accent';
}) {
  const map: Record<string, { bg: string; fg: string }> = {
    gray: { bg: '#E7E4DC', fg: '#686B6F' },
    green: { bg: COLORS.greenBg, fg: COLORS.green },
    red: { bg: COLORS.redBg, fg: COLORS.red },
    yellow: { bg: COLORS.yellowBg, fg: COLORS.yellow },
    blue: { bg: COLORS.blueBg, fg: COLORS.blue },
    purple: { bg: '#EFEAF5', fg: COLORS.purple },
    accent: { bg: '#F8E4E6', fg: COLORS.accent },
  };
  const c = map[variant] ?? map.gray;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

export function Btn({
  label,
  onPress,
  variant = 'primary',
  disabled,
  small,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  disabled?: boolean;
  small?: boolean;
  style?: ViewStyle;
}) {
  const bg: Record<string, string> = {
    primary: COLORS.accent,
    secondary: '#35383B',
    danger: '#7F1D1D',
    success: '#166534',
    ghost: 'transparent',
  };
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.btn,
        small && styles.btnSmall,
        { backgroundColor: bg[variant] ?? COLORS.accent, opacity: disabled ? 0.5 : 1 },
        variant === 'ghost' && { borderWidth: 1, borderColor: COLORS.border },
        style,
      ]}
    >
      <Text style={[styles.btnText, small && { fontSize: 12 }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  style,
  ...rest
}: TextInputProps & { label?: string; style?: ViewStyle }) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput placeholderTextColor={COLORS.subtle} style={styles.input} {...rest} />
    </View>
  );
}

export function KV({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvKey}>{k}</Text>
      <Text style={styles.kvVal}>{v}</Text>
    </View>
  );
}

export function Loader() {
  return <ActivityIndicator color={COLORS.accent} style={{ marginTop: 24 }} />;
}

export function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

export function ModalSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          {title ? <Text style={styles.modalTitle}>{title}</Text> : null}
          <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function Pager({
  page,
  totalPages,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <View style={styles.pager}>
      <Text style={styles.pagerText}>
        Page {page} of {totalPages}
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn label="Prev" small variant="ghost" onPress={onPrev} disabled={page <= 1} />
        <Btn label="Next" small variant="ghost" onPress={onNext} disabled={page >= totalPages} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.card, borderColor: COLORS.border, borderWidth: 1, borderRadius: 4, padding: 14, marginBottom: 12 },
  sectionTitle: { color: COLORS.text, fontSize: 15, fontWeight: '700', marginBottom: 8 },
  statCard: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 4,
    padding: 12,
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 140,
  },
  statLabel: { color: COLORS.muted, fontSize: 11, marginBottom: 6 },
  statValue: { fontSize: 24, fontWeight: '800' },
  statSub: { color: COLORS.subtle, fontSize: 11, marginTop: 4 },
  badge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  btn: { backgroundColor: COLORS.accent, borderRadius: 4, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  btnSmall: { paddingHorizontal: 10, paddingVertical: 6 },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  field: { marginBottom: 10 },
  fieldLabel: { color: COLORS.muted, fontSize: 12, marginBottom: 4 },
  input: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 14,
  },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, gap: 12 },
  kvKey: { color: COLORS.subtle, fontSize: 13 },
  kvVal: { color: COLORS.text, fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  empty: { color: COLORS.muted, fontSize: 13, marginTop: 8 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: COLORS.card, borderTopLeftRadius: 6, borderTopRightRadius: 6, padding: 16, maxHeight: '85%', borderTopWidth: 1, borderColor: COLORS.border },
  modalTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700', marginBottom: 12 },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  pagerText: { color: COLORS.subtle, fontSize: 12 },
});
