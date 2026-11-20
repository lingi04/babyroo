import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { colors, layout, radius, spacing, typography } from '../theme/tokens';
import {
  type CreditPurchaseStatus,
  purchaseStatusCopy,
} from './CreditPurchaseCoordinator';

export function CreditPurchaseCard({
  label,
  price,
  status,
  checking,
  onPress,
}: {
  label: string;
  price: string;
  status?: CreditPurchaseStatus;
  checking: boolean;
  onPress: () => void;
}) {
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 350 || fontScale >= 1.4;
  const copy = status ? purchaseStatusCopy[status] : undefined;
  return (
    <View style={styles.card}>
      <Pressable
        style={[
          styles.row,
          stacked && styles.stacked,
          checking && styles.disabled,
        ]}
        onPress={onPress}
        disabled={checking}
        accessibilityRole="button"
        accessibilityState={{ disabled: checking, busy: checking }}
        accessibilityLabel={`${status ? 'Recheck' : 'Purchase'} ${label}`}
        accessibilityHint={
          status ? '새로 결제하지 않고 이전 구매 상태를 확인합니다.' : undefined
        }
      >
        <View style={styles.details}>
          <Text style={styles.title}>{label}</Text>
          <Text style={styles.price}>{price}</Text>
        </View>
        <Text style={styles.action}>
          {checking ? '확인 중' : status ? '다시 확인' : '구매'}
        </Text>
      </Pressable>
      {copy ? (
        <View style={styles.status} accessibilityLiveRegion="polite">
          <Text style={styles.statusTitle}>{copy.title}</Text>
          <Text style={styles.statusMessage}>{copy.message}</Text>
          {status !== 'completion-delayed' ? (
            <Text style={styles.statusMessage}>
              다시 결제하지 말고 상태를 확인해주세요.
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: layout.touchTarget,
  },
  stacked: { alignItems: 'stretch', flexDirection: 'column' },
  details: { flexShrink: 1 },
  title: { color: colors.text, fontSize: 15, fontWeight: '900' },
  price: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  action: { ...typography.caption, color: colors.coralText },
  disabled: { opacity: 0.5 },
  status: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.sm,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  statusTitle: {
    color: colors.amberText,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 20,
  },
  statusMessage: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
});
