import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export function InductionsPlaceholderScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Inductions</Text>
      <Text style={styles.lead}>
        Legacy app: induction management screens for admins/supervisors. Add backend routes and list UI when
        scheduling data is modelled.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#4a026f', marginBottom: 8 },
  lead: { fontSize: 14, color: '#707173', lineHeight: 20 },
});
