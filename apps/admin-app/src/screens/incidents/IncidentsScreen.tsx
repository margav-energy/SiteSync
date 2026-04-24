import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { incidentsService, uploadsService, useAuthContext } from '@staff4dshire/shared';
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

function IncidentItem({
  item,
  canResolve,
  onOpenResolve,
  resolving,
}: {
  item: Incident;
  canResolve: boolean;
  onOpenResolve: (id: string) => void;
  resolving: boolean;
}) {
  return (
    <View style={styles.item}>
      <Text style={styles.description}>{item.description}</Text>
      <Text style={[styles.severity, severityStyle(item.severity)]}>
        Severity: {item.severity.toUpperCase()}
      </Text>
      <Text style={styles.status}>{item.status}</Text>
      {item.photo_url ? <Image source={{ uri: item.photo_url }} style={styles.photo} resizeMode="cover" /> : null}
      {item.status.toLowerCase() === 'resolved' ? (
        <View style={styles.resolutionBox}>
          <Text style={styles.resolutionTitle}>Resolution report</Text>
          <Text style={styles.resolutionBody}>{item.resolution_report || 'No report provided.'}</Text>
          {item.resolution_photo_url ? (
            <Image source={{ uri: item.resolution_photo_url }} style={styles.photo} resizeMode="cover" />
          ) : null}
        </View>
      ) : null}
      {canResolve && item.status.toLowerCase() !== 'resolved' ? (
        <TouchableOpacity
          style={[styles.resolveButton, resolving && styles.resolveButtonDisabled]}
          onPress={() => onOpenResolve(item.id)}
          disabled={resolving}
        >
          {resolving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.resolveButtonText}>Mark as resolved</Text>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function IncidentsScreen() {
  const { user } = useAuthContext();
  const queryClient = useQueryClient();
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<IncidentSeverity>('medium');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [hideResolved, setHideResolved] = useState(true);
  const [resolvingIncidentId, setResolvingIncidentId] = useState<string | null>(null);
  const [resolutionReport, setResolutionReport] = useState('');
  const [resolutionPhotoUri, setResolutionPhotoUri] = useState<string | null>(null);
  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ['incidents'],
    queryFn: () => incidentsService.getAll(),
  });
  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!resolutionReport.trim()) throw new Error('Resolution report is required');
      if (!resolutionPhotoUri) throw new Error('Resolution image is required');
      const resolutionPhotoUrl = await uploadsService.uploadChatAttachment({
        uri: resolutionPhotoUri,
        name: `incident-resolution-${Date.now()}.jpg`,
        type: 'image/jpeg',
      });
      return incidentsService.update(id, {
        status: 'resolved',
        resolution_report: resolutionReport.trim(),
        resolution_photo_url: resolutionPhotoUrl,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      setResolvingIncidentId(null);
      setResolutionReport('');
      setResolutionPhotoUri(null);
    },
    onError: (e) => {
      Alert.alert('Resolve failed', String(e));
    },
  });
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!description.trim()) throw new Error('Enter incident description');
      let photoUrl: string | undefined;
      if (photoUri) {
        photoUrl = await uploadsService.uploadChatAttachment({
          uri: photoUri,
          name: `incident-${Date.now()}.jpg`,
          type: 'image/jpeg',
        });
      }
      return incidentsService.create({
        description: description.trim(),
        severity,
        photo_url: photoUrl,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      setDescription('');
      setSeverity('medium');
      setPhotoUri(null);
    },
    onError: (e) => {
      Alert.alert('Create failed', String(e));
    },
  });
  const canResolve = user?.role === 'admin' || user?.role === 'supervisor' || user?.role === 'superadmin';
  const visibleIncidents = hideResolved
    ? incidents.filter((i) => i.status.toLowerCase() !== 'resolved')
    : incidents;

  if (isLoading) return <View style={styles.centered}><Text>Loading...</Text></View>;

  const pickResolutionPhoto = async () => {
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
      setResolutionPhotoUri(res.assets[0].uri);
    }
  };
  const pickIncidentPhoto = async () => {
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
    <View style={styles.container}>
      <View style={styles.createCard}>
        <Text style={styles.createTitle}>Create incident report</Text>
        <TextInput
          style={styles.createInput}
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="Describe the incident"
          placeholderTextColor="#897c98"
        />
        <View style={styles.severityRow}>
          {SEVERITIES.map((level) => (
            <TouchableOpacity
              key={level}
              style={[styles.severityChip, severity === level && styles.severityChipOn]}
              onPress={() => setSeverity(level)}
            >
              <Text style={[styles.severityChipText, severity === level && styles.severityChipTextOn]}>
                {level.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.attachBtn} onPress={pickIncidentPhoto}>
          <Text style={styles.attachBtnText}>{photoUri ? 'Change photo' : 'Attach photo (optional)'}</Text>
        </TouchableOpacity>
        {photoUri ? <Image source={{ uri: photoUri }} style={styles.resolvePreview} resizeMode="cover" /> : null}
        <TouchableOpacity
          style={[styles.createSubmitBtn, createMutation.isPending && styles.resolveButtonDisabled]}
          onPress={() => createMutation.mutate()}
          disabled={createMutation.isPending}
        >
          <Text style={styles.createSubmitText}>
            {createMutation.isPending ? 'Submitting...' : 'Submit incident report'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.hideToggleBtn, hideResolved && styles.hideToggleBtnOn]}
          onPress={() => setHideResolved((v) => !v)}
        >
          <Text style={[styles.hideToggleText, hideResolved && styles.hideToggleTextOn]}>
            {hideResolved ? 'Showing unresolved only' : 'Showing all (including resolved)'}
          </Text>
        </TouchableOpacity>
      </View>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator
        data={visibleIncidents}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <IncidentItem
            item={item}
            canResolve={!!canResolve}
            onOpenResolve={(id) => {
              setResolvingIncidentId(id);
              setResolutionReport('');
              setResolutionPhotoUri(null);
            }}
            resolving={resolveMutation.isPending}
          />
        )}
      />
      {resolvingIncidentId ? (
        <View style={styles.resolvePanel}>
          <Text style={styles.resolvePanelTitle}>Resolve incident</Text>
          <TextInput
            style={styles.resolveInput}
            value={resolutionReport}
            onChangeText={setResolutionReport}
            multiline
            placeholder="Enter resolution report"
            placeholderTextColor="#897c98"
          />
          <TouchableOpacity style={styles.attachBtn} onPress={pickResolutionPhoto}>
            <Text style={styles.attachBtnText}>
              {resolutionPhotoUri ? 'Change resolution image' : 'Attach resolution image'}
            </Text>
          </TouchableOpacity>
          {resolutionPhotoUri ? (
            <Image source={{ uri: resolutionPhotoUri }} style={styles.resolvePreview} resizeMode="cover" />
          ) : null}
          <View style={styles.resolvePanelActions}>
            <TouchableOpacity
              style={[styles.panelBtn, styles.panelCancel]}
              onPress={() => {
                setResolvingIncidentId(null);
                setResolutionReport('');
                setResolutionPhotoUri(null);
              }}
            >
              <Text style={styles.panelCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.panelBtn, styles.panelSubmit, resolveMutation.isPending && styles.resolveButtonDisabled]}
              onPress={() => resolveMutation.mutate(resolvingIncidentId)}
              disabled={resolveMutation.isPending}
            >
              <Text style={styles.panelSubmitText}>
                {resolveMutation.isPending ? 'Resolving...' : 'Submit & resolve'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  list: { flex: 1 },
  listContent: { paddingBottom: 20 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  item: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  description: { fontSize: 14, color: '#4a026f' },
  severity: { fontSize: 12, fontWeight: '700', marginTop: 6, marginBottom: 2 },
  severityLow: { color: '#2e7d32' },
  severityMedium: { color: '#ef6c00' },
  severityHigh: { color: '#d84315' },
  severityCritical: { color: '#b71c1c' },
  status: { fontSize: 12, color: '#707173', marginTop: 4 },
  photo: { width: '100%', height: 160, borderRadius: 8, marginTop: 10, backgroundColor: '#e0e0e0' },
  resolutionBox: {
    marginTop: 10,
    backgroundColor: '#f5f0fa',
    borderRadius: 8,
    padding: 10,
  },
  resolutionTitle: { color: '#4a026f', fontSize: 12, fontWeight: '700' },
  resolutionBody: { color: '#5a4968', fontSize: 12, marginTop: 4 },
  resolveButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#4a026f',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  resolveButtonDisabled: { opacity: 0.6 },
  resolveButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  resolvePanel: {
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    backgroundColor: '#fff',
    padding: 12,
  },
  resolvePanelTitle: { color: '#4a026f', fontSize: 15, fontWeight: '700', marginBottom: 8 },
  resolveInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    minHeight: 90,
    padding: 10,
    textAlignVertical: 'top',
    color: '#333',
  },
  attachBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#4a026f',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  attachBtnText: { color: '#4a026f', fontWeight: '600', fontSize: 12 },
  resolvePreview: { width: 110, height: 110, borderRadius: 8, marginTop: 10, backgroundColor: '#ddd' },
  resolvePanelActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  panelBtn: { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  panelCancel: { borderWidth: 1, borderColor: '#707173', marginRight: 8 },
  panelSubmit: { backgroundColor: '#4a026f', marginLeft: 8 },
  panelCancelText: { color: '#707173', fontWeight: '600' },
  panelSubmitText: { color: '#fff', fontWeight: '700' },
  createCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  createTitle: { color: '#4a026f', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  createInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    minHeight: 80,
    padding: 10,
    textAlignVertical: 'top',
    color: '#333',
  },
  severityRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  severityChip: {
    borderWidth: 1,
    borderColor: '#c6b4d3',
    borderRadius: 16,
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginRight: 7,
    marginBottom: 7,
    backgroundColor: '#fff',
  },
  severityChipOn: { borderColor: '#4a026f', backgroundColor: '#ede7f6' },
  severityChipText: { color: '#5e4f6c', fontSize: 11, fontWeight: '600' },
  severityChipTextOn: { color: '#4a026f' },
  createSubmitBtn: {
    marginTop: 10,
    backgroundColor: '#4a026f',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  createSubmitText: { color: '#fff', fontWeight: '700' },
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
  hideToggleBtnOn: {
    backgroundColor: '#4a026f',
  },
  hideToggleText: { color: '#4a026f', fontWeight: '600', fontSize: 12 },
  hideToggleTextOn: { color: '#fff' },
});
