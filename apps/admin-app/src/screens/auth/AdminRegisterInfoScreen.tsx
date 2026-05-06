import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminAuthStackParamList } from '../../navigation/authTypes';

type Props = NativeStackScreenProps<AdminAuthStackParamList, 'AdminRegisterInfo'>;

export function AdminRegisterInfoScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Admin registration</Text>
        <Text style={styles.body}>
          Admin accounts are created by invitation only. Ask your organisation to send you an invitation
          link or code, then use &quot;Complete invitation&quot; from the sign-in screen. You can also request a
          resend using your invitation email.
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.buttonText}>Back to sign in</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondary}
          onPress={() => navigation.navigate('InvitationRegister', {})}
        >
          <Text style={styles.secondaryText}>I have an invitation code</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#897c98' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 24 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#4a026f', marginBottom: 12 },
  body: { fontSize: 15, color: '#707173', lineHeight: 22, marginBottom: 20 },
  button: {
    backgroundColor: '#4a026f',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondary: { padding: 12, alignItems: 'center' },
  secondaryText: { color: '#4a026f', fontSize: 15, fontWeight: '600' },
});
