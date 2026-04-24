import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import * as Location from 'expo-location';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuthContext } from '@staff4dshire/shared';
import {
  projectsService,
  timesheetsService,
  previewAttendanceAtProject,
  MAX_GPS_ACCURACY_METERS,
} from '@staff4dshire/shared';
import type { TimeEntry, Project } from '@staff4dshire/shared';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { StaffDashboardStackParamList } from '../../navigation/DashboardStack';
import { getFitDeclaration } from '../../lib/complianceStorage';

type Nav = NativeStackNavigationProp<StaffDashboardStackParamList, 'SignInOut'>;

function getErrorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const r = (err as { response?: { data?: { error?: string } } }).response;
    if (r?.data?.error) return r.data.error;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

type LocationPreview = {
  lat: number;
  lng: number;
  accuracyM: number;
  distanceM: number;
};

function useLocationPreview(
  project: Project | null | undefined,
  mode: 'sign_in' | 'sign_out'
) {
  const [preview, setPreview] = useState<LocationPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (!project) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    setRefreshing(true);
    setPreviewError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPreviewError('Location permission is required.');
        setPreview(null);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const acc = pos.coords.accuracy;
      const check = previewAttendanceAtProject(project, lat, lng, acc ?? null, mode);
      if (!check.ok) {
        setPreviewError(check.message);
        setPreview(null);
        return;
      }
      setPreview({
        lat,
        lng,
        accuracyM: acc ?? 0,
        distanceM: check.distanceM,
      });
      setPreviewError(null);
    } catch (e) {
      setPreviewError(getErrorMessage(e));
      setPreview(null);
    } finally {
      setRefreshing(false);
    }
  }, [project, mode]);

  return { preview, previewError, refreshing, refresh };
}

export function SignInOutScreen() {
  const { user } = useAuthContext();
  const navigation = useNavigation<Nav>();
  const isSupervisor = user?.role === 'supervisor';
  const isStaff = user?.role === 'staff';
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [declaredFit, setDeclaredFit] = useState(false);
  const [declaredSafe, setDeclaredSafe] = useState(false);
  const [arrivedChecked, setArrivedChecked] = useState(false);
  const [fitDeclarationSaved, setFitDeclarationSaved] = useState(false);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsService.getAll(),
  });

  const { data: myEntries = [], isLoading: loadingEntries } = useQuery({
    queryKey: ['timesheets', user?.id],
    queryFn: () => timesheetsService.getByUserId(user!.id),
    enabled: !!user?.id,
  });

  const openEntry = useMemo(
    () => myEntries.find((e: TimeEntry) => !e.sign_out_at) ?? null,
    [myEntries]
  );

  const selectedProject = useMemo(
    () => (selectedProjectId ? projects.find((p) => p.id === selectedProjectId) : undefined),
    [projects, selectedProjectId]
  );

  const signOutProject = useMemo(
    () => (openEntry ? projects.find((p) => p.id === openEntry.project_id) : undefined),
    [openEntry, projects]
  );

  const signInPreview = useLocationPreview(selectedProject, 'sign_in');
  const signOutPreview = useLocationPreview(signOutProject, 'sign_out');

  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        void getFitDeclaration(user.id).then((saved) => {
          setFitDeclarationSaved(!!saved);
          setDeclaredFit(!!saved?.fit);
          setDeclaredSafe(!!saved?.noInjury && !!saved?.notFatigued);
        });
      }
      if (openEntry && signOutProject) {
        void signOutPreview.refresh();
      } else if (!openEntry && selectedProject) {
        void signInPreview.refresh();
      }
    }, [
      openEntry,
      signOutProject,
      selectedProject,
      signOutPreview.refresh,
      signInPreview.refresh,
      user?.id,
    ])
  );

  const signInMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !selectedProjectId || !selectedProject) {
        throw new Error('Select a project first');
      }
      if (isStaff && (!declaredFit || !declaredSafe)) {
        throw new Error('Please complete safety declaration before sign in');
      }
      setLocating(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          throw new Error('Location permission required');
        }
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = pos.coords.accuracy;
        const check = previewAttendanceAtProject(selectedProject, lat, lng, acc ?? null, 'sign_in');
        if (!check.ok) throw new Error(check.message);
        const timestamp = new Date().toISOString();
        return timesheetsService.create({
          user_id: user.id,
          project_id: selectedProjectId,
          latitude_in: lat,
          longitude_in: lng,
          accuracy_in: acc ?? undefined,
          action_type: 'sign_in',
          timestamp,
          sign_in_at: timestamp,
          distance_from_project_m: check.distanceM,
        });
      } finally {
        setLocating(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      Alert.alert('Signed in', 'You are now clocked in.');
    },
    onError: (err) => {
      Alert.alert('Cannot sign in', getErrorMessage(err));
    },
  });

  const signOutMutation = useMutation({
    mutationFn: async () => {
      if (!openEntry) throw new Error('No open shift');
      const proj = signOutProject;
      if (!proj) throw new Error('Project not found');
      setLocating(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          throw new Error('Location permission required');
        }
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = pos.coords.accuracy;
        const check = previewAttendanceAtProject(proj, lat, lng, acc ?? null, 'sign_out');
        if (!check.ok) throw new Error(check.message);
        const timestamp = new Date().toISOString();
        return timesheetsService.update(openEntry.id, {
          sign_out_at: timestamp,
          latitude_out: lat,
          longitude_out: lng,
          accuracy_out: acc ?? undefined,
          action_type: 'sign_out',
          timestamp,
          distance_from_project_m: check.distanceM,
        });
      } finally {
        setLocating(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      Alert.alert('Signed out', 'Your shift has been closed.');
    },
    onError: (err) => Alert.alert('Cannot sign out', getErrorMessage(err)),
  });

  const markArrivedMutation = useMutation({
    mutationFn: async () => {
      if (!openEntry || !signOutProject) throw new Error('No active callout sign-in');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') throw new Error('Location permission required');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      return timesheetsService.markArrived(openEntry.id, {
        arrival_latitude: pos.coords.latitude,
        arrival_longitude: pos.coords.longitude,
        arrived_at: new Date().toISOString(),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      Alert.alert('Arrival recorded', 'Travel time and miles have been added to your timesheet.');
    },
    onError: (err) => Alert.alert('Cannot record arrival', getErrorMessage(err)),
  });

  const declarationReady = !isStaff || (declaredFit && declaredSafe);
  const busy =
    signInMutation.isPending || signOutMutation.isPending || locating || loadingEntries;

  if (loadingEntries) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#4a026f" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      {openEntry ? (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>You are signed in</Text>
          <Text style={styles.bannerSub}>
            Since {new Date(openEntry.sign_in_at).toLocaleString()}
          </Text>
          {signOutProject ? (
            <Text style={styles.projectLine}>Site: {signOutProject.name}</Text>
          ) : null}
          {openEntry.sign_in_address ? (
            <Text style={styles.signInOrigin}>Signed in from: {openEntry.sign_in_address}</Text>
          ) : null}

          <LocationInfoBlock
            project={signOutProject}
            preview={signOutPreview.preview}
            previewError={signOutPreview.previewError}
            refreshing={signOutPreview.refreshing}
            onRefresh={() => void signOutPreview.refresh()}
          />
          {signOutProject?.project_type === 'callout' ? (
            <View style={styles.arrivalCard}>
              <TouchableOpacity
                style={[styles.declarationItem, arrivedChecked && styles.declarationItemOn]}
                onPress={() => setArrivedChecked((v) => !v)}
              >
                <Text style={[styles.declarationText, arrivedChecked && styles.declarationTextOn]}>
                  I've arrived on site
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.refreshBtn,
                  (!arrivedChecked || !!openEntry.arrived_at || markArrivedMutation.isPending) &&
                    styles.buttonDisabled,
                ]}
                disabled={!arrivedChecked || !!openEntry.arrived_at || markArrivedMutation.isPending}
                onPress={() => markArrivedMutation.mutate()}
              >
                <Text style={styles.refreshBtnText}>
                  {openEntry.arrived_at
                    ? 'Arrival already recorded'
                    : markArrivedMutation.isPending
                      ? 'Recording...'
                      : 'Confirm arrival & calculate travel'}
                </Text>
              </TouchableOpacity>
              {openEntry.arrived_at ? (
                <Text style={styles.infoSub}>
                  Arrived {new Date(openEntry.arrived_at).toLocaleString()} · Travel {openEntry.travel_minutes ?? 0} min ·{' '}
                  {(openEntry.travel_miles ?? 0).toFixed(2)} miles
                </Text>
              ) : null}
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.button, styles.signOutBtn, busy && styles.buttonDisabled]}
            onPress={() => signOutMutation.mutate()}
            disabled={busy}
          >
            {signOutMutation.isPending || locating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign out</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Text style={styles.title}>{isSupervisor ? 'Inspection sign in' : 'Sign in'}</Text>
          <Text style={styles.subtitle}>
            {isSupervisor
              ? 'Optional for supervisors — sign in only when you are inspecting a project on site.'
              : 'Choose a project / site'}
          </Text>
          <View style={styles.complianceCard}>
            <Text style={styles.complianceTitle}>Safety & compliance declaration</Text>
            <Text style={styles.complianceSubtitle}>
              Staff must declare before sign in. Supervisors can still access compliance actions here.
            </Text>
            {isStaff ? (
              <>
                <View style={[styles.declarationItem, declaredFit && styles.declarationItemOn]}>
                  <Text style={[styles.declarationText, declaredFit && styles.declarationTextOn]}>
                    Fit declaration: {fitDeclarationSaved ? 'Saved' : 'Not saved'}
                  </Text>
                </View>
                {!declarationReady ? (
                  <Text style={styles.warnText}>
                    Complete Fit to work and submit a positive declaration before sign in.
                  </Text>
                ) : null}
              </>
            ) : null}
            <View style={styles.complianceActions}>
              <TouchableOpacity style={styles.compliancePill} onPress={() => navigation.navigate('FitToWork')}>
                <Text style={styles.compliancePillText}>Fit to work</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.compliancePill} onPress={() => navigation.navigate('Rams')}>
                <Text style={styles.compliancePillText}>RAMS</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.compliancePill} onPress={() => navigation.navigate('FireRoll')}>
                <Text style={styles.compliancePillText}>Fire roll call</Text>
              </TouchableOpacity>
            </View>
          </View>
          {projects.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.projectBtn, selectedProjectId === p.id && styles.projectBtnSelected]}
              onPress={() => setSelectedProjectId(p.id)}
            >
              <Text style={styles.projectText}>{p.name}</Text>
            </TouchableOpacity>
          ))}

          {selectedProject ? (
            <LocationInfoBlock
              project={selectedProject}
              preview={signInPreview.preview}
              previewError={signInPreview.previewError}
              refreshing={signInPreview.refreshing}
              onRefresh={() => void signInPreview.refresh()}
            />
          ) : null}

          <TouchableOpacity
            style={[
              styles.button,
              (!selectedProjectId || !declarationReady || busy) && styles.buttonDisabled,
            ]}
            onPress={() => signInMutation.mutate()}
            disabled={!selectedProjectId || !declarationReady || busy}
          >
            {signInMutation.isPending || locating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign in</Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

function LocationInfoBlock({
  project,
  preview,
  previewError,
  refreshing,
  onRefresh,
}: {
  project: Project | null | undefined;
  preview: LocationPreview | null;
  previewError: string | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  if (!project) return null;

  const radius =
    project.allowed_radius_meters != null && project.allowed_radius_meters > 0
      ? project.allowed_radius_meters
      : 150;

  if (project.latitude == null || project.longitude == null) {
    return (
      <View style={styles.infoBox}>
        <Text style={styles.warnText}>
          This project has no map coordinates. Ask an admin to set latitude and longitude before
          signing in.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.infoBox}>
      <Text style={styles.infoLabel}>Allowed radius: {Math.round(radius)} m</Text>
      <Text style={styles.infoLabel}>GPS accuracy required: ±{MAX_GPS_ACCURACY_METERS} m or better</Text>
      {preview ? (
        <>
          <Text style={styles.infoOk}>
            Distance from site: ~{Math.round(preview.distanceM)} m (within {Math.round(radius)} m)
          </Text>
          <Text style={styles.infoSub}>GPS accuracy: ±{Math.round(preview.accuracyM)} m</Text>
        </>
      ) : previewError ? (
        <Text style={styles.warnText}>{previewError}</Text>
      ) : (
        <Text style={styles.infoSub}>Tap refresh to get your current position.</Text>
      )}
      <TouchableOpacity
        style={styles.refreshBtn}
        onPress={onRefresh}
        disabled={refreshing}
        accessibilityLabel="Refresh location"
      >
        {refreshing ? (
          <ActivityIndicator color="#4a026f" size="small" />
        ) : (
          <Text style={styles.refreshBtnText}>Refresh location</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 24, backgroundColor: '#f5f5f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  banner: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4a026f',
  },
  bannerTitle: { fontSize: 18, fontWeight: 'bold', color: '#4a026f' },
  bannerSub: { fontSize: 14, color: '#707173', marginTop: 8, marginBottom: 20 },
  projectLine: { fontSize: 15, color: '#4a026f', marginBottom: 12, fontWeight: '600' },
  signInOrigin: { fontSize: 13, color: '#5a4e66', marginBottom: 10 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#4a026f', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#707173', marginBottom: 16 },
  projectBtn: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  projectBtnSelected: { borderColor: '#4a026f', backgroundColor: '#f0e6f5' },
  projectText: { fontSize: 16, color: '#4a026f' },
  button: {
    backgroundColor: '#4a026f',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  signOutBtn: { marginTop: 0 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  infoBox: {
    backgroundColor: '#f8f5fb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e8dff0',
  },
  infoLabel: { fontSize: 13, color: '#5c5368', marginBottom: 4 },
  infoOk: { fontSize: 14, color: '#2e7d32', fontWeight: '600', marginTop: 4 },
  infoSub: { fontSize: 13, color: '#707173', marginTop: 4 },
  warnText: { fontSize: 14, color: '#c62828', marginTop: 4 },
  refreshBtn: {
    borderWidth: 1,
    borderColor: '#4a026f',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  refreshBtnText: { color: '#4a026f', fontWeight: '600', fontSize: 15 },
  arrivalCard: {
    borderWidth: 1,
    borderColor: '#e8dff0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
    backgroundColor: '#fff',
  },
  complianceCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e8dff0',
    padding: 12,
    marginBottom: 12,
  },
  complianceTitle: { fontSize: 14, fontWeight: '700', color: '#4a026f' },
  complianceSubtitle: { fontSize: 12, color: '#6a6472', marginTop: 4, marginBottom: 8 },
  declarationItem: {
    borderWidth: 1,
    borderColor: '#d8d8d8',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#fafafa',
  },
  declarationItemOn: { borderColor: '#4a026f', backgroundColor: '#f0e6f5' },
  declarationText: { fontSize: 13, color: '#4a4a4a' },
  declarationTextOn: { color: '#4a026f', fontWeight: '600' },
  complianceActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  compliancePill: {
    borderWidth: 1,
    borderColor: '#4a026f',
    borderRadius: 16,
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  compliancePillText: { fontSize: 12, color: '#4a026f', fontWeight: '600' },
});
