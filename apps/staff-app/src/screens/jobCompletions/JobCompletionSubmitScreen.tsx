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
  ScrollView,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useAuthContext, jobCompletionsService, uploadsService } from '@staff4dshire/shared';
import * as ImagePicker from 'expo-image-picker';
import type { StaffDashboardStackParamList } from '../../navigation/DashboardStack';

type Nav = NativeStackNavigationProp<StaffDashboardStackParamList, 'JobCompletionSubmit'>;
type ScreenRoute = RouteProp<StaffDashboardStackParamList, 'JobCompletionSubmit'>;

export function JobCompletionSubmitScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<ScreenRoute>();
  const { user } = useAuthContext();
  const queryClient = useQueryClient();
  const [description, setDescription] = useState('');
  const [photoUris, setPhotoUris] = useState<string[]>([]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !description.trim()) throw new Error('Add a description');
      if (photoUris.length === 0) throw new Error('Attach at least one photo');
      const uploadedPhotos = await Promise.all(
        photoUris.map((uri, index) =>
          uploadsService.uploadChatAttachment({
            uri,
            name: `job-completion-${Date.now()}-${index + 1}.jpg`,
            type: 'image/jpeg',
          })
        )
      );
      return jobCompletionsService.create({
        user_id: user.id,
        project_id: route.params.projectId,
        description: description.trim(),
        photo_urls: uploadedPhotos,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['job-completions'] });
      Alert.alert('Submitted', 'Job completion submitted for approval.');
      navigation.goBack();
    },
    onError: (err) => Alert.alert('Error', String(err)),
  });

  const pickPhotos = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Photo access is required to attach evidence.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: 10,
    });
    if (!res.canceled && res.assets.length > 0) {
      setPhotoUris(res.assets.map((a) => a.uri).filter(Boolean));
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.projectLabel}>Project: {route.params.projectName}</Text>
        <TextInput
          style={styles.input}
          placeholder="Describe completed work"
          placeholderTextColor="#897c98"
          value={description}
          onChangeText={setDescription}
          multiline
        />
        <Text style={styles.sectionTitle}>Photo evidence (required)</Text>
        <TouchableOpacity style={styles.attachButton} onPress={pickPhotos} disabled={submitMutation.isPending}>
          <Text style={styles.attachButtonText}>
            {photoUris.length > 0 ? 'Change attached photos' : 'Attach one or more photos'}
          </Text>
        </TouchableOpacity>
        <View style={styles.previewRow}>
          {photoUris.map((uri) => (
            <Image key={uri} source={{ uri }} style={styles.previewImage} />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.button, submitMutation.isPending && styles.buttonDisabled]}
          onPress={() => submitMutation.mutate()}
          disabled={submitMutation.isPending}
        >
          {submitMutation.isPending ? (
            <View style={styles.loaderRow}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.buttonText}>Submitting...</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>Submit for approval</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {submitMutation.isPending ? (
        <View style={styles.blockingOverlay}>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={styles.blockingText}>Submitting job completion...</Text>
          <Text style={styles.blockingSubtext}>Uploading photos and sending for approval</Text>
      </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 24, paddingBottom: 40 },
  projectLabel: { fontSize: 15, color: '#4a026f', fontWeight: '700', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#707173',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    backgroundColor: '#fff',
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#4a026f', marginTop: 16, marginBottom: 8 },
  attachButton: {
    borderWidth: 1,
    borderColor: '#4a026f',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
  },
  attachButtonText: { color: '#4a026f', fontWeight: '600' },
  previewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  previewImage: { width: 72, height: 72, borderRadius: 8, backgroundColor: '#ddd' },
  button: {
    backgroundColor: '#4a026f',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: { opacity: 0.7 },
  loaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  blockingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(30, 11, 49, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  blockingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 14,
    textAlign: 'center',
  },
  blockingSubtext: {
    color: '#ddd6f3',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
});
