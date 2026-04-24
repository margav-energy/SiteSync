import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { usersService, onboardingService, useAuthContext } from '@staff4dshire/shared';
import type { OnboardingJson } from '@staff4dshire/shared';
import type { UsersStackParamList } from '../../navigation/UsersStack';

type Nav = NativeStackNavigationProp<UsersStackParamList>;
type R = RouteProp<UsersStackParamList, 'UserOnboarding'>;

function isCisOnFile(cis?: OnboardingJson): boolean {
  if (!cis || typeof cis !== 'object') return false;
  const c = cis as Record<string, unknown>;
  if (c.declaration_ack === true) return true;
  const keys = ['full_name', 'utr', 'ni_number', 'trading_name'];
  return keys.some((k) => typeof c[k] === 'string' && String(c[k]).trim().length > 0);
}

export function UserOnboardingViewScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<R>();
  const { userId } = route.params;
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthContext();

  const { data: targetUser, isLoading: userLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => usersService.getById(userId),
  });

  const { data: onboarding, isLoading: onboardingLoading } = useQuery({
    queryKey: ['onboarding-progress', userId],
    queryFn: () => onboardingService.loadProgress(userId),
    enabled: Boolean(userId),
  });

  const remindMutation = useMutation({
    mutationFn: () => onboardingService.remindUser(userId),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['onboarding'] });
      void queryClient.invalidateQueries({ queryKey: ['onboarding-progress', userId] });
      Alert.alert('Sent', data.message || 'Reminder notification sent.');
    },
    onError: (e: unknown) => {
      let msg = 'Failed';
      if (isAxiosError(e)) {
        const d = e.response?.data as { error?: string } | undefined;
        msg = d?.error ?? e.message;
      } else if (e instanceof Error) {
        msg = e.message;
      }
      Alert.alert('Reminder', msg);
    },
  });

  const onboardingRequired =
    targetUser?.role === 'staff' || targetUser?.role === 'supervisor';

  const canSendReminderRole =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'superadmin' ||
    currentUser?.role === 'supervisor';

  if (userLoading || onboardingLoading || !targetUser) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  const standardDone = Boolean(onboarding?.completed_at);
  const cisDone = isCisOnFile(onboarding?.cis);

  const standardBadge = standardDone ? (
    <View style={[styles.badge, styles.badgeDone]}>
      <Text style={styles.badgeTextDone}>Completed</Text>
    </View>
  ) : onboardingRequired ? (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>Incomplete</Text>
    </View>
  ) : (
    <View style={[styles.badge, styles.badgeNeutral]}>
      <Text style={styles.badgeTextNeutral}>Not required</Text>
    </View>
  );

  const cisBadge = cisDone ? (
    <View style={[styles.badge, styles.badgeDone]}>
      <Text style={styles.badgeTextDone}>On file</Text>
    </View>
  ) : onboardingRequired ? (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>Not started</Text>
    </View>
  ) : (
    <View style={[styles.badge, styles.badgeNeutral]}>
      <Text style={styles.badgeTextNeutral}>Not required</Text>
    </View>
  );

  const onboardingIncomplete = !onboarding?.completed_at;
  const showRemindButton =
    canSendReminderRole && onboardingRequired && onboardingIncomplete;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>
        {targetUser.first_name} {targetUser.last_name}
      </Text>
      <Text style={styles.email}>{targetUser.email}</Text>
      <Text style={styles.hint}>
        Review this user&apos;s onboarding forms (read-only). Use the button below to send a reminder
        notification.
      </Text>

      {!onboardingRequired ? (
        <Text style={styles.roleNote}>
          Onboarding forms are only required for staff and supervisors. This account&apos;s role is{' '}
          {targetUser.role}.
        </Text>
      ) : null}

      {showRemindButton ? (
        <View style={styles.remindBlock}>
          <TouchableOpacity
            style={[styles.remindBtn, remindMutation.isPending && styles.remindBtnDisabled]}
            onPress={() => remindMutation.mutate()}
            disabled={remindMutation.isPending}
          >
            {remindMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.remindBtnText}>Send reminder</Text>
            )}
          </TouchableOpacity>
          {onboarding?.last_reminder_at ? (
            <Text style={styles.remindMeta}>
              Last reminder: {onboarding.last_reminder_at.slice(0, 16).replace('T', ' ')}
            </Text>
          ) : null}
        </View>
      ) : canSendReminderRole && onboardingRequired && !onboardingIncomplete ? (
        <Text style={styles.remindDoneNote}>Onboarding is complete — reminders are not needed.</Text>
      ) : null}

      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('UserOnboardingForm', { userId, readOnly: true })}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Standard onboarding</Text>
          {standardBadge}
        </View>
        <Text style={styles.cardSub}>New starter, qualifications, policies</Text>
        {standardDone && onboarding?.completed_at ? (
          <Text style={styles.meta}>Completed {onboarding.completed_at.slice(0, 10)}</Text>
        ) : null}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('UserCisOnboarding', { userId, readOnly: true })}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>CIS onboarding</Text>
          {cisBadge}
        </View>
        <Text style={styles.cardSub}>Construction Industry Scheme details</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollContent: { padding: 20, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: '#4a026f' },
  email: { fontSize: 14, color: '#707173', marginTop: 4 },

  hint: { fontSize: 14, color: '#707173', marginTop: 16, marginBottom: 8 },
  roleNote: {
    fontSize: 13,
    color: '#b45309',
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#4a026f', flex: 1 },
  cardSub: { fontSize: 13, color: '#707173', marginTop: 4 },
  meta: { fontSize: 11, color: '#897c98', marginTop: 6 },
  badge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#b45309' },
  badgeDone: { backgroundColor: '#dcfce7' },
  badgeTextDone: { fontSize: 11, fontWeight: '600', color: '#166534' },
  badgeNeutral: { backgroundColor: '#e5e7eb' },
  badgeTextNeutral: { fontSize: 11, fontWeight: '600', color: '#4b5563' },
  remindBlock: { marginBottom: 16 },
  remindBtn: {
    backgroundColor: '#4a026f',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  remindBtnDisabled: { opacity: 0.7 },
  remindBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  remindMeta: { fontSize: 12, color: '#897c98', marginTop: 8, textAlign: 'center' },
  remindDoneNote: {
    fontSize: 13,
    color: '#166534',
    backgroundColor: '#dcfce7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
});
