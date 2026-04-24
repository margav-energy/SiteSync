import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { DocumentsScreen } from '../screens/documents/DocumentsScreen';
import { IncidentsScreen } from '../screens/incidents/IncidentsScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';
import { OnboardingFormScreen } from '../screens/onboarding/OnboardingFormScreen';
import { CisOnboardingFormScreen } from '../screens/onboarding/CisOnboardingFormScreen';
import { XeroIntegrationScreen } from '../screens/settings/XeroIntegrationScreen';
import { NotificationBell } from '../components/NotificationBell';

const Stack = createNativeStackNavigator();

export function SettingsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#4a026f' },
        headerTintColor: '#fff',
        headerRight: () => <NotificationBell />,
      }}
    >
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="XeroIntegration" component={XeroIntegrationScreen} options={{ title: 'Xero' }} />
      <Stack.Screen name="Documents" component={DocumentsScreen} />
      <Stack.Screen name="Incidents" component={IncidentsScreen} />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ headerRight: () => null }}
      />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ title: 'Onboarding' }} />
      <Stack.Screen
        name="OnboardingForm"
        component={OnboardingFormScreen}
        options={{ title: 'Standard onboarding', headerRight: () => null }}
      />
      <Stack.Screen
        name="CisOnboarding"
        component={CisOnboardingFormScreen}
        options={{ title: 'CIS onboarding', headerRight: () => null }}
      />
    </Stack.Navigator>
  );
}
