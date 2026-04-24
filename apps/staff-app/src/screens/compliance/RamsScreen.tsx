import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthContext } from '@staff4dshire/shared';
import { setRamsDeclaration } from '../../lib/complianceStorage';

export function RamsScreen() {
  const { user } = useAuthContext();
  const navigation = useNavigation();
  const [read, setRead] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    await setRamsDeclaration(user.id, {
      read,
      understood,
      savedAt: new Date().toISOString(),
    });
    setSaving(false);
    Alert.alert('Saved', 'RAMS declaration saved.');
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.lead}>
        RAMS (risk assessments & method statements) for the active project should be reviewed here.
      </Text>
      <View style={styles.card}>
        <Pressable style={styles.check} onPress={() => setRead(!read)}>
          <Text style={styles.checkMark}>{read ? '☑' : '☐'}</Text>
          <Text style={styles.checkText}>I have read the RAMS for today&apos;s work</Text>
        </Pressable>
        <Pressable style={styles.check} onPress={() => setUnderstood(!understood)}>
          <Text style={styles.checkMark}>{understood ? '☑' : '☐'}</Text>
          <Text style={styles.checkText}>I understand the controls and will follow them</Text>
        </Pressable>
      </View>
      <Pressable
        style={[styles.btn, (!read || !understood || saving) && styles.btnDisabled]}
        disabled={!read || !understood || saving}
        onPress={() => void onSave()}
      >
        <Text style={styles.btnText}>{saving ? 'Saving...' : 'Save'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 20, paddingBottom: 40 },
  lead: { fontSize: 14, color: '#707173', lineHeight: 20, marginBottom: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  check: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  checkMark: { fontSize: 20, marginRight: 10, color: '#4a026f' },
  checkText: { flex: 1, fontSize: 15, color: '#333', lineHeight: 22 },
  btn: {
    marginTop: 20,
    backgroundColor: '#4a026f',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
