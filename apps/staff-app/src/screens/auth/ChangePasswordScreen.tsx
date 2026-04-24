import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuthContext } from '@staff4dshire/shared';

export function ChangePasswordScreen() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const { changePassword } = useAuthContext();

  const submit = async () => {
    if (!current.trim() || !next.trim()) {
      Alert.alert('Error', 'Enter current and new password');
      return;
    }
    if (next !== confirm) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
    if (next.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await changePassword(current.trim(), next.trim());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not update password';
      Alert.alert('Error', String(message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Change password</Text>
        <Text style={styles.subtitle}>Your organisation requires you to set a new password.</Text>

        <TextInput
          style={styles.input}
          placeholder="Current password"
          placeholderTextColor="#897c98"
          value={current}
          onChangeText={setCurrent}
          secureTextEntry
        />
        <TextInput
          style={styles.input}
          placeholder="New password"
          placeholderTextColor="#897c98"
          value={next}
          onChangeText={setNext}
          secureTextEntry
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm new password"
          placeholderTextColor="#897c98"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={submit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Update password</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#897c98',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
  },
  title: { fontSize: 22, fontWeight: 'bold', color: '#4a026f', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#707173', marginBottom: 20 },
  input: {
    borderWidth: 1,
    borderColor: '#707173',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#4a026f',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
