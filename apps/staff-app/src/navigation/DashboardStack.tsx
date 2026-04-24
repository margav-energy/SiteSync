import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { SignInOutScreen } from '../screens/signInOut/SignInOutScreen';
import { TimesheetsScreen } from '../screens/timesheets/TimesheetsScreen';
import { ComplianceHubScreen } from '../screens/compliance/ComplianceHubScreen';
import { FitToWorkScreen } from '../screens/compliance/FitToWorkScreen';
import { RamsScreen } from '../screens/compliance/RamsScreen';
import { ToolboxTalkScreen } from '../screens/compliance/ToolboxTalkScreen';
import { FireRollScreen } from '../screens/compliance/FireRollScreen';
import { JobCompletionsScreen } from '../screens/jobCompletions/JobCompletionsScreen';
import { JobCompletionSubmitScreen } from '../screens/jobCompletions/JobCompletionSubmitScreen';
import { IncidentsScreen } from '../screens/incidents/IncidentsScreen';
import { TimesheetExportScreen } from '../screens/exports/TimesheetExportScreen';
import { NotificationBell } from '../components/NotificationBell';

export type StaffDashboardStackParamList = {
  DashboardHome: undefined;
  SignInOut: undefined;
  Timesheets: undefined;
  ComplianceHub: undefined;
  FitToWork: undefined;
  Rams: undefined;
  ToolboxTalk: undefined;
  FireRoll: undefined;
  Jobs: undefined;
  JobCompletionSubmit: { projectId: string; projectName: string };
  Incidents: undefined;
  TimesheetExport: undefined;
};

const Stack = createNativeStackNavigator<StaffDashboardStackParamList>();

export function DashboardStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#4a026f' },
        headerTintColor: '#fff',
        headerBackTitle: 'Back',
        headerRight: () => <NotificationBell />,
      }}
    >
      <Stack.Screen name="DashboardHome" component={DashboardScreen} options={{ title: 'Home' }} />
      <Stack.Screen name="SignInOut" component={SignInOutScreen} options={{ title: 'Sign in / out' }} />
      <Stack.Screen name="Timesheets" component={TimesheetsScreen} options={{ title: 'Timesheets' }} />
      <Stack.Screen
        name="ComplianceHub"
        component={ComplianceHubScreen}
        options={{ title: 'Safety & compliance' }}
      />
      <Stack.Screen name="FitToWork" component={FitToWorkScreen} options={{ title: 'Fit to work' }} />
      <Stack.Screen name="Rams" component={RamsScreen} options={{ title: 'RAMS' }} />
      <Stack.Screen name="ToolboxTalk" component={ToolboxTalkScreen} options={{ title: 'Toolbox talks' }} />
      <Stack.Screen name="FireRoll" component={FireRollScreen} options={{ title: 'Fire roll call' }} />
      <Stack.Screen name="Jobs" component={JobCompletionsScreen} options={{ title: 'Job completions' }} />
      <Stack.Screen name="JobCompletionSubmit" component={JobCompletionSubmitScreen} options={{ title: 'Submit job completion' }} />
      <Stack.Screen name="Incidents" component={IncidentsScreen} options={{ title: 'Incidents' }} />
      <Stack.Screen name="TimesheetExport" component={TimesheetExportScreen} options={{ title: 'Export timesheets' }} />
    </Stack.Navigator>
  );
}
