import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '@staff4dshire/shared';
import type { StaffDashboardStackParamList } from '../../navigation/DashboardStack';

type Nav = NativeStackNavigationProp<StaffDashboardStackParamList, 'ComplianceHub'>;

const items: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: keyof StaffDashboardStackParamList;
  roles?: Array<'admin' | 'supervisor'>;
}[] = [
  {
    title: 'Fit to work',
    subtitle: 'Daily declaration before sign-in',
    icon: 'heart-outline',
    route: 'FitToWork',
  },
  {
    title: 'RAMS',
    subtitle: 'Risk assessments & sign-off',
    icon: 'document-text-outline',
    route: 'Rams',
  },
  {
    title: 'Toolbox talks',
    subtitle: 'Attendance & acknowledgements',
    icon: 'people-circle-outline',
    route: 'ToolboxTalk',
  },
  {
    title: 'Fire roll call',
    subtitle: 'Emergency headcount (admins and supervisors)',
    icon: 'flame-outline',
    route: 'FireRoll',
    roles: ['admin', 'supervisor'],
  },
];

export function ComplianceHubScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuthContext();
  const isSupervisor = user?.role === 'supervisor';
  const visibleItems = items.filter((item) => {
    if (!item.roles) return true;
    if (!user?.role) return false;
    return item.roles.includes(user.role as 'admin' | 'supervisor');
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Safety & compliance</Text>
      <Text style={styles.subtitle}>
        {isSupervisor
          ? 'RAMS, toolbox talks, and fire roll are available here. Supervisor sign-in is only needed during on-site inspections.'
          : 'Fit-to-work, RAMS, toolbox talks, and fire roll surface here for daily compliance.'}
      </Text>
      {visibleItems.map((item) => (
        <Pressable
          key={item.route}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => navigation.navigate(item.route)}
        >
          <View style={styles.iconWrap}>
            <Ionicons name={item.icon} size={24} color="#4a026f" />
          </View>
          <View style={styles.textWrap}>
            <Text style={styles.rowTitle}>{item.title}</Text>
            <Text style={styles.rowSub}>{item.subtitle}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#897c98" />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#4a026f', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#707173', lineHeight: 20, marginBottom: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  rowPressed: { opacity: 0.88 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#f0e6f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textWrap: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  rowSub: { fontSize: 13, color: '#707173', marginTop: 2 },
});
