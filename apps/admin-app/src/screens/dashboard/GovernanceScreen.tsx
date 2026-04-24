import React from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { governanceService } from '@staff4dshire/shared';

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export function GovernanceScreen() {
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['governance', 'summary'],
    queryFn: () => governanceService.getSummary(),
  });
  const { data: severe = [], isLoading: severeLoading } = useQuery({
    queryKey: ['governance', 'incidents-overview'],
    queryFn: () => governanceService.getIncidentsOverview(),
  });
  const { data: compliance = [], isLoading: complianceLoading } = useQuery({
    queryKey: ['governance', 'compliance-overview'],
    queryFn: () => governanceService.getComplianceOverview(),
  });

  if (summaryLoading || severeLoading || complianceLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#4a026f" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={severe}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View>
          <Text style={styles.title}>Platform governance</Text>
          <Text style={styles.subtitle}>Cross-company oversight for operations and compliance.</Text>
          <View style={styles.metrics}>
            <Metric label="Companies" value={summary?.companies ?? 0} />
            <Metric label="Active users" value={summary?.active_users ?? 0} />
            <Metric label="Projects" value={summary?.projects ?? 0} />
            <Metric label="Incidents" value={summary?.incidents ?? 0} />
            <Metric label="Pending approvals" value={summary?.pending_approvals ?? 0} />
          </View>
          <Text style={styles.section}>Compliance by company</Text>
          {compliance.map((row) => (
            <View key={row.company_id} style={styles.companyRow}>
              <Text style={styles.companyName}>{row.company_name}</Text>
              <Text style={styles.companyMeta}>
                Pending: {row.pending}  Completed: {row.completed}
              </Text>
            </View>
          ))}
          <Text style={styles.section}>Severe unresolved incidents</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.incidentRow}>
          <Text style={styles.incidentTitle}>{item.company_name}</Text>
          <Text style={styles.incidentMeta}>
            {item.severity.toUpperCase()} - {item.status}
          </Text>
          <Text style={styles.incidentBody}>{item.description}</Text>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>No severe unresolved incidents.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16, paddingBottom: 24 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: '#4a026f' },
  subtitle: { marginTop: 4, color: '#6d6280', marginBottom: 12 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  metricCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    padding: 12,
  },
  metricValue: { fontSize: 20, fontWeight: '700', color: '#4a026f' },
  metricLabel: { color: '#6d6280', marginTop: 4, fontSize: 12 },
  section: { fontSize: 15, fontWeight: '700', color: '#4a026f', marginBottom: 8, marginTop: 8 },
  companyRow: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  companyName: { fontSize: 14, fontWeight: '600', color: '#2f2f36' },
  companyMeta: { color: '#6d6280', marginTop: 2 },
  incidentRow: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f0d5d5',
    padding: 12,
    marginBottom: 8,
  },
  incidentTitle: { fontWeight: '700', color: '#4a026f' },
  incidentMeta: { marginTop: 2, color: '#a33a3a', fontSize: 12 },
  incidentBody: { marginTop: 6, color: '#333' },
  empty: { color: '#6d6280' },
});
