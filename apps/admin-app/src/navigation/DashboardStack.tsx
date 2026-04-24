import React from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { UsersStack } from './UsersStack';
import { ProjectsStack } from './ProjectsStack';
import { TimesheetsScreen } from '../screens/timesheets/TimesheetsScreen';
import { CompaniesScreen } from '../screens/companies/CompaniesScreen';
import { JobCompletionsScreen } from '../screens/jobCompletions/JobCompletionsScreen';
import { ReportsScreen } from '../screens/reports/ReportsScreen';
import { InvoicesScreen } from '../screens/invoices/InvoicesScreen';
import { IncidentsScreen } from '../screens/incidents/IncidentsScreen';
import { GovernanceScreen } from '../screens/dashboard/GovernanceScreen';
import { NotificationBell } from '../components/NotificationBell';
import { CompanySwitcher } from '../components/CompanySwitcher';

export type DashboardStackParamList = {
  DashboardHome: undefined;
  Users: undefined;
  Projects: undefined;
  Timesheets: undefined;
  Companies: undefined;
  Jobs: undefined;
  Reports: undefined;
  Invoices: undefined;
  Incidents: undefined;
  Governance: undefined;
};

const Stack = createNativeStackNavigator<DashboardStackParamList>();

export function DashboardStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#4a026f' },
        headerTintColor: '#fff',
        headerBackTitle: 'Back',
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <CompanySwitcher />
            <NotificationBell />
          </View>
        ),
      }}
    >
      <Stack.Screen name="DashboardHome" component={DashboardScreen} options={{ title: 'Home' }} />
      <Stack.Screen name="Users" component={UsersStack} options={{ headerShown: false }} />
      <Stack.Screen name="Projects" component={ProjectsStack} options={{ headerShown: false }} />
      <Stack.Screen name="Timesheets" component={TimesheetsScreen} options={{ title: 'Timesheets' }} />
      <Stack.Screen name="Companies" component={CompaniesScreen} options={{ title: 'Companies' }} />
      <Stack.Screen name="Jobs" component={JobCompletionsScreen} options={{ title: 'Job completions' }} />
      <Stack.Screen name="Reports" component={ReportsScreen} options={{ title: 'Reports' }} />
      <Stack.Screen name="Invoices" component={InvoicesScreen} options={{ title: 'Invoices' }} />
      <Stack.Screen name="Incidents" component={IncidentsScreen} options={{ title: 'Incident reports' }} />
      <Stack.Screen name="Governance" component={GovernanceScreen} options={{ title: 'Governance' }} />
    </Stack.Navigator>
  );
}
