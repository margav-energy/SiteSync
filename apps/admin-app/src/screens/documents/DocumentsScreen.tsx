import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function DocumentsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Document Hub</Text>
      <Text style={styles.subtitle}>Verify documents, track expiry</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f5f5f5' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#4a026f', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#707173' },
});
