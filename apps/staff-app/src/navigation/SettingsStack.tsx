import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';
import { OnboardingFormScreen } from '../screens/onboarding/OnboardingFormScreen';
import { CisOnboardingFormScreen } from '../screens/onboarding/CisOnboardingFormScreen';
import { NotificationBell } from '../components/NotificationBell';

const Stack = createNativeStackNavigator();

export function SettingsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#4a026f' },
        headerTintColor: '#fff',
        headerBackTitle: 'Back',
        headerRight: () => <NotificationBell />,
      }}
    >
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Notifications', headerRight: () => null }}
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
