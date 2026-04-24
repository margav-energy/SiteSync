import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { onboardingService, useAuthContext } from '@staff4dshire/shared';
import type { OnboardingRecord } from '@staff4dshire/shared';

function RecordItem({
  item,
  onRemind,
  reminding,
  onOpenStandard,
  onOpenCis,
  canRemind,
}: {
  item: OnboardingRecord;
  onRemind: () => void;
  reminding: boolean;
  onOpenStandard: () => void;
  onOpenCis: () => void;
  canRemind: boolean;
}) {
  const incomplete = !item.completed_at;
  const label = item.user_name || `User ${item.user_id?.slice(0, 8)}…`;
  const sub = item.user_email ? `${item.user_email} · ${item.user_role ?? ''}` : item.user_id;

  return (
    <View style={styles.item}>
      <View style={styles.itemHeader}>
        <Text style={styles.name}>{label}</Text>
        {incomplete ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Incomplete</Text>
          </View>
        ) : (
          <View style={[styles.badge, styles.badgeDone]}>
            <Text style={styles.badgeTextDone}>Done</Text>
          </View>
        )}
      </View>
      <Text style={styles.sub}>{sub}</Text>
      {item.completed_at ? (
        <Text style={styles.meta}>Completed {item.completed_at.slice(0, 10)}</Text>
      ) : item.last_reminder_at ? (
        <Text style={styles.meta}>Last reminder {item.last_reminder_at.slice(0, 16).replace('T', ' ')}</Text>
      ) : null}

      <View style={styles.row}>
        {canRemind ? (
          <TouchableOpacity
            style={[styles.smallBtn, incomplete ? styles.smallBtnPrimary : styles.smallBtnMuted]}
            onPress={onRemind}
            disabled={!incomplete || reminding}
          >
            {reminding ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.smallBtnText}>Send reminder</Text>
            )}
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.smallBtnOutline} onPress={onOpenStandard}>
          <Text style={styles.smallBtnOutlineText}>Standard form</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.smallBtnOutline} onPress={onOpenCis}>
          <Text style={styles.smallBtnOutlineText}>CIS form</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function OnboardingScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { user } = useAuthContext();
  const showTeamList =
    user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'supervisor';

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['onboarding'],
    queryFn: () => onboardingService.getAll(),
    enabled: showTeamList,
  });

  const remindMutation = useMutation({
    mutationFn: (userId: string) => onboardingService.remindUser(userId),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['onboarding'] });
      Alert.alert('Sent', data.message || 'Reminder notification sent.');
    },
    onError: (e: unknown) => {
      let msg = 'Failed';
      if (isAxiosError(e)) {
        const data = e.response?.data as { error?: string } | undefined;
        msg = data?.error ?? e.message;
      } else if (e instanceof Error) {
        msg = e.message;
      }
      Alert.alert('Reminder', msg);
    },
  });

  const incomplete = records.filter((r) => !r.completed_at);
  const complete = records.filter((r) => r.completed_at);

  const onOpenStandard = useCallback(
    (userId: string) => {
      navigation.navigate('OnboardingForm' as never, { userId } as never);
    },
    [navigation]
  );

  const onOpenCis = useCallback(
    (userId: string) => {
      navigation.navigate('CisOnboarding' as never, { userId } as never);
    },
    [navigation]
  );

  if (showTeamList && isLoading) {
    return (
      <View style={styles.centered}>
        <Text>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <TouchableOpacity
        style={styles.cardBtn}
        onPress={() => navigation.navigate('OnboardingForm' as never)}
      >
        <Text style={styles.cardTitle}>Standard onboarding</Text>
        <Text style={styles.cardSub}>New starter details, qualifications, policies</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.cardBtn}
        onPress={() => navigation.navigate('CisOnboarding' as never)}
      >
        <Text style={styles.cardTitle}>CIS onboarding</Text>
        <Text style={styles.cardSub}>Construction Industry Scheme (subcontractor)</Text>
      </TouchableOpacity>

      {showTeamList ? (
        <>
          <Text style={styles.sectionTitle}>Needs completion ({incomplete.length})</Text>
          {incomplete.length === 0 ? (
            <Text style={styles.empty}>No incomplete onboarding.</Text>
          ) : (
            incomplete.map((item) => (
              <RecordItem
                key={item.id}
                item={item}
                canRemind={item.user_role === 'staff' || item.user_role === 'supervisor'}
                reminding={remindMutation.isPending && remindMutation.variables === item.user_id}
                onRemind={() => remindMutation.mutate(item.user_id)}
                onOpenStandard={() => onOpenStandard(item.user_id)}
                onOpenCis={() => onOpenCis(item.user_id)}
              />
            ))
          )}

          <Text style={styles.sectionTitle}>Completed ({complete.length})</Text>
          {complete.map((item) => (
            <RecordItem
              key={item.id}
              item={item}
              canRemind={false}
              reminding={false}
              onRemind={() => {}}
              onOpenStandard={() => onOpenStandard(item.user_id)}
              onOpenCis={() => onOpenCis(item.user_id)}
            />
          ))}
        </>
      ) : (
        <Text style={styles.hint}>Complete your own onboarding using the options above.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollContent: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cardBtn: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#4a026f' },
  cardSub: { fontSize: 13, color: '#707173', marginTop: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#4a026f', marginBottom: 8, marginTop: 16 },
  item: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: 15, fontWeight: '600', color: '#4a026f', flex: 1 },
  sub: { fontSize: 12, color: '#707173', marginTop: 4 },
  meta: { fontSize: 11, color: '#897c98', marginTop: 4 },
  badge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#b45309' },
  badgeDone: { backgroundColor: '#dcfce7' },
  badgeTextDone: { fontSize: 11, fontWeight: '600', color: '#166534' },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  smallBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 110,
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  smallBtnPrimary: { backgroundColor: '#4a026f' },
  smallBtnMuted: { backgroundColor: '#d1d5db' },
  smallBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  smallBtnOutline: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4a026f',
    marginRight: 8,
    marginBottom: 8,
  },
  smallBtnOutlineText: { color: '#4a026f', fontSize: 13, fontWeight: '600' },
  empty: { color: '#707173', textAlign: 'center', marginTop: 8, marginBottom: 8 },
  hint: { fontSize: 13, color: '#707173', marginTop: 8, lineHeight: 20 },
});
