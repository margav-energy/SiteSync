import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Alert, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthContext } from '@staff4dshire/shared';
import { setFitDeclaration } from '../../lib/complianceStorage';

export function FitToWorkScreen() {
  const { user } = useAuthContext();
  const navigation = useNavigation();
  const [fit, setFit] = useState(true);
  const [noInjury, setNoInjury] = useState(true);
  const [notFatigued, setNotFatigued] = useState(true);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!user?.id) return;
    setSaving(true);
    await setFitDeclaration(user.id, {
      fit,
      noInjury,
      notFatigued,
      savedAt: new Date().toISOString(),
    });
    setSaving(false);
    if (!fit) {
      Alert.alert(
        'Declaration saved',
        'You marked not fit for work. Sign-in will stay blocked until you submit a fit declaration.'
      );
    } else {
      Alert.alert('Saved', 'Declaration saved successfully.');
    }
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.lead}>
        Complete before sign-in.
      </Text>
      <View style={styles.card}>
        <Row label="I am fit for work today" value={fit} onValueChange={setFit} />
        <Row label="I have no injury preventing safe work" value={noInjury} onValueChange={setNoInjury} />
        <Row label="I am not impaired by fatigue or substances" value={notFatigued} onValueChange={setNotFatigued} />
      </View>
      <Text style={styles.hint}>Save your declaration before starting work.</Text>
      <Pressable style={[styles.btn, saving && styles.btnDisabled]} onPress={() => void save()} disabled={saving}>
        <Text style={styles.btnText}>{saving ? 'Saving...' : 'Save declaration'}</Text>
      </Pressable>
    </ScrollView>
  );
}

function Row({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: '#ccc', true: '#c4a3d4' }} />
    </View>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e8e8e8',
  },
  label: { flex: 1, fontSize: 15, color: '#333', paddingRight: 12 },
  hint: { fontSize: 13, color: '#897c98', marginTop: 16, lineHeight: 18 },
  btn: {
    marginTop: 12,
    backgroundColor: '#4a026f',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.65 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
