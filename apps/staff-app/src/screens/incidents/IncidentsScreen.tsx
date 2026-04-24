import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  FlatList,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthContext } from '@staff4dshire/shared';
import { incidentsService, uploadsService } from '@staff4dshire/shared';
import type { Incident } from '@staff4dshire/shared';
import * as ImagePicker from 'expo-image-picker';

const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
type IncidentSeverity = (typeof SEVERITIES)[number];

function severityStyle(severity: Incident['severity']) {
  if (severity === 'critical') return styles.severityCritical;
  if (severity === 'high') return styles.severityHigh;
  if (severity === 'low') return styles.severityLow;
  return styles.severityMedium;
}

export function IncidentsScreen() {
  const { user } = useAuthContext();
  const queryClient = useQueryClient();
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<IncidentSeverity>('medium');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [hideResolved, setHideResolved] = useState(true);
  const { data: incidents = [] } = useQuery({
    queryKey: ['incidents'],
    queryFn: () => incidentsService.getAll(),
  });
  const visibleIncidents = hideResolved
    ? incidents.filter((i) => i.status.toLowerCase() !== 'resolved')
    : incidents;

  const reportMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !description.trim()) throw new Error('Enter description');
      let uploadedPhotoUrl: string | undefined;
      if (photoUri) {
        uploadedPhotoUrl = await uploadsService.uploadChatAttachment({
          uri: photoUri,
          name: `incident-${Date.now()}.jpg`,
          type: 'image/jpeg',
        });
      }
      return incidentsService.create({
        user_id: user.id,
        description: description.trim(),
        severity,
        photo_url: uploadedPhotoUrl,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      setDescription('');
      setSeverity('medium');
      setPhotoUri(null);
      Alert.alert('Success', 'Incident reported');
    },
    onError: (err) => Alert.alert('Error', String(err)),
  });

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission', 'Photo library access is required.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!res.canceled && res.assets[0]?.uri) {
      setPhotoUri(res.assets[0].uri);
    }
  };

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.container}
      keyExtractor={(item) => item.id}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator
      ListHeaderComponent={
        <View>
      <Text style={styles.title}>Report Incident</Text>
      <TextInput
        style={styles.input}
        placeholder="Describe the incident"
        placeholderTextColor="#897c98"
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <Text style={styles.label}>Severity</Text>
      <View style={styles.severityRow}>
        {SEVERITIES.map((level) => (
          <TouchableOpacity
            key={level}
            style={[styles.severityChip, severity === level && styles.severityChipActive]}
            onPress={() => setSeverity(level)}
          >
            <Text style={[styles.severityChipText, severity === level && styles.severityChipTextActive]}>
              {level.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.label}>Photo (optional)</Text>
      <TouchableOpacity style={styles.photoButton} onPress={pickPhoto}>
        <Text style={styles.photoButtonText}>{photoUri ? 'Change photo' : 'Attach photo'}</Text>
      </TouchableOpacity>
      {photoUri ? <Image source={{ uri: photoUri }} style={styles.photoPreview} /> : null}
      <TouchableOpacity
        style={[styles.button, reportMutation.isPending && styles.buttonDisabled]}
        onPress={() => reportMutation.mutate()}
        disabled={reportMutation.isPending}
      >
        {reportMutation.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Report</Text>
        )}
      </TouchableOpacity>
          <TouchableOpacity
            style={[styles.hideToggleBtn, hideResolved && styles.hideToggleBtnOn]}
            onPress={() => setHideResolved((v) => !v)}
          >
            <Text style={[styles.hideToggleText, hideResolved && styles.hideToggleTextOn]}>
              {hideResolved ? 'Showing unresolved only' : 'Showing all (including resolved)'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.sectionTitle}>Incident history</Text>
        </View>
      }
      data={visibleIncidents}
      renderItem={({ item }) => (
        <View style={styles.item}>
          <Text style={styles.itemDescription}>{item.description}</Text>
          <Text style={[styles.itemSeverity, severityStyle(item.severity)]}>
            Severity: {item.severity.toUpperCase()}
          </Text>
          <Text style={styles.itemStatus}>Status: {item.status}</Text>
          {item.photo_url ? (
            <Image source={{ uri: item.photo_url }} style={styles.photoPreview} resizeMode="cover" />
          ) : null}
          {item.status.toLowerCase() === 'resolved' ? (
            <View style={styles.resolvedBox}>
              <Text style={styles.resolvedTitle}>Resolved report</Text>
              <Text style={styles.resolvedBody}>
                {item.resolution_report || 'No resolution report provided.'}
              </Text>
              {item.resolution_photo_url ? (
                <Image source={{ uri: item.resolution_photo_url }} style={styles.photoPreview} resizeMode="cover" />
              ) : null}
            </View>
          ) : null}
        </View>
      )}
      ListEmptyComponent={<Text style={styles.emptyText}>No incidents yet.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#f5f5f5' },
  container: { padding: 24, paddingBottom: 36 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#4a026f', marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#707173',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
  },
  label: { fontSize: 14, fontWeight: '600', color: '#4a026f', marginTop: 12, marginBottom: 8 },
  severityRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  severityChip: {
    borderWidth: 1,
    borderColor: '#c6b4d3',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  severityChipActive: { borderColor: '#4a026f', backgroundColor: '#ede7f6' },
  severityChipText: { color: '#5e4f6c', fontSize: 12, fontWeight: '600' },
  severityChipTextActive: { color: '#4a026f' },
  photoButton: {
    borderWidth: 1,
    borderColor: '#4a026f',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
  },
  photoButtonText: { color: '#4a026f', fontWeight: '600' },
  photoPreview: {
    width: 120,
    height: 120,
    borderRadius: 8,
    marginTop: 10,
    backgroundColor: '#ddd',
  },
  button: {
    backgroundColor: '#4a026f',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  sectionTitle: { marginTop: 20, marginBottom: 10, color: '#4a026f', fontSize: 17, fontWeight: '700' },
  item: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  itemDescription: { color: '#4a026f', fontSize: 14, fontWeight: '600' },
  itemSeverity: { marginTop: 5, fontSize: 12, fontWeight: '700' },
  severityLow: { color: '#2e7d32' },
  severityMedium: { color: '#ef6c00' },
  severityHigh: { color: '#d84315' },
  severityCritical: { color: '#b71c1c' },
  itemStatus: { marginTop: 4, fontSize: 12, color: '#707173' },
  resolvedBox: {
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: '#f4eef9',
    padding: 8,
  },
  resolvedTitle: { color: '#4a026f', fontWeight: '700', fontSize: 12 },
  resolvedBody: { color: '#5d4f6b', fontSize: 12, marginTop: 4 },
  emptyText: { color: '#707173', fontSize: 13, textAlign: 'center', marginTop: 12 },
  hideToggleBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#4a026f',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
  },
  hideToggleBtnOn: { backgroundColor: '#4a026f' },
  hideToggleText: { color: '#4a026f', fontWeight: '600', fontSize: 12 },
  hideToggleTextOn: { color: '#fff' },
});
