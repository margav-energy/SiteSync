import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { onboardingService, useAuthContext } from '@staff4dshire/shared';
import type { OnboardingRecord } from '@staff4dshire/shared';

function RecordItem({ item }: { item: OnboardingRecord }) {
  return (
    <View style={styles.item}>
      <Text style={styles.id}>User {item.user_id?.slice(0, 8)}…</Text>
      <Text style={styles.status}>{item.status}</Text>
      {item.completed_at ? (
        <Text style={styles.meta}>Completed {item.completed_at.slice(0, 10)}</Text>
      ) : null}
    </View>
  );
}

export function OnboardingScreen() {
  const navigation = useNavigation();
  const { user } = useAuthContext();
  const showTeamList = user?.role === 'admin' || user?.role === 'superadmin';
  const { data: records = [], isLoading } = useQuery({
    queryKey: ['onboarding'],
    queryFn: () => onboardingService.getAll(),
    enabled: showTeamList,
  });

  if (showTeamList && isLoading) {
    return (
      <View style={styles.centered}>
        <Text>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
          <Text style={styles.sectionTitle}>Team records</Text>
          <FlatList
            data={records}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <RecordItem item={item} />}
            ListEmptyComponent={<Text style={styles.empty}>No onboarding records yet.</Text>}
          />
        </>
      ) : (
        <Text style={styles.hint}>Complete your own onboarding using the options above.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
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
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#4a026f', marginBottom: 8, marginTop: 8 },
  item: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  id: { fontSize: 14, fontWeight: '600', color: '#4a026f' },
  status: { fontSize: 12, color: '#707173', marginTop: 4 },
  meta: { fontSize: 11, color: '#897c98', marginTop: 2 },
  empty: { color: '#707173', textAlign: 'center', marginTop: 16 },
  hint: { fontSize: 13, color: '#707173', marginTop: 8, lineHeight: 20 },
});
