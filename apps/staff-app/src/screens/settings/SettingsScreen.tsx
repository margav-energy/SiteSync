import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthContext } from '@staff4dshire/shared';

export function SettingsScreen() {
  const { user, logout } = useAuthContext();
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <View style={styles.profile}>
        <Text style={styles.name}>{user?.first_name} {user?.last_name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>
      <TouchableOpacity
        style={styles.linkButton}
        onPress={() => navigation.navigate('Onboarding' as never)}
      >
        <Text style={styles.linkText}>Onboarding</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.linkButton}
        onPress={() => navigation.navigate('Notifications' as never)}
      >
        <Text style={styles.linkText}>Notifications</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f5f5f5' },
  profile: { marginBottom: 32 },
  name: { fontSize: 20, fontWeight: 'bold', color: '#4a026f' },
  email: { fontSize: 14, color: '#707173', marginTop: 4 },
  linkButton: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  linkText: { fontSize: 16, color: '#4a026f' },
  logoutButton: {
    backgroundColor: '#4a026f',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
