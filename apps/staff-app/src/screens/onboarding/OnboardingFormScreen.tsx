import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { isAxiosError } from 'axios';
import {
  onboardingService,
  useAuthContext,
} from '@staff4dshire/shared';
import type { OnboardingJson } from '@staff4dshire/shared';

type OnboardingFormParams = { userId?: string; readOnly?: boolean } | undefined;

type Nav = NativeStackNavigationProp<Record<string, object | undefined>, 'OnboardingForm'>;
type Route = RouteProp<{ OnboardingForm: OnboardingFormParams }, 'OnboardingForm'>;

function asStrings(obj: unknown): Record<string, string> {
  if (!obj || typeof obj !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[k] = v == null ? '' : String(v);
  }
  return out;
}

function asBools(obj: unknown): Record<string, boolean> {
  if (!obj || typeof obj !== 'object') return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[k] = Boolean(v);
  }
  return out;
}

export function OnboardingFormScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { user } = useAuthContext();
  const targetUserId = route.params?.userId ?? user?.id;
  const readOnly = Boolean(route.params?.readOnly);

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [newStarter, setNewStarter] = useState<Record<string, string>>({});
  const [qualifications, setQualifications] = useState<Record<string, string>>({});
  const [policies, setPolicies] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    if (!targetUserId) return;
    setLoading(true);
    try {
      const progress = await onboardingService.loadProgress(targetUserId);
      setRecordId(progress.id);
      setNewStarter(asStrings(progress.new_starter));
      setQualifications(asStrings(progress.qualifications));
      setPolicies(asBools(progress.policies));
      const ns = await onboardingService.loadNewStarter(targetUserId);
      if (ns.data && typeof ns.data === 'object' && Object.keys(ns.data as object).length) {
        setNewStarter((prev) => ({ ...asStrings(ns.data), ...prev }));
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not load onboarding');
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveNewStarterData = async () => {
    if (!targetUserId || readOnly) return;
    const payload = { ...newStarter } as OnboardingJson;
    await onboardingService.saveNewStarter(targetUserId, payload);
  };

  const saveQualificationsData = async () => {
    if (!targetUserId || readOnly) return;
    await onboardingService.saveQualifications(targetUserId, { ...qualifications } as OnboardingJson);
  };

  const savePoliciesData = async () => {
    if (!targetUserId || readOnly) return;
    await onboardingService.savePolicies(targetUserId, { ...policies } as OnboardingJson);
  };

  const finish = async () => {
    if (!targetUserId || readOnly) {
      throw new Error('Cannot save onboarding in this mode.');
    }
    let id = recordId;
    if (!id) {
      const p = await onboardingService.loadProgress(targetUserId);
      id = p.id;
      if (id) setRecordId(id);
    }
    if (!id) {
      throw new Error('Onboarding record could not be loaded. Go back and open this form again.');
    }
    await savePoliciesData();
    await onboardingService.update(id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
    });
    navigation.goBack();
    requestAnimationFrame(() => {
      Alert.alert('Done', 'Onboarding saved.');
    });
  };

  const next = async () => {
    if (readOnly) {
      if (step >= 2) {
        navigation.goBack();
        return;
      }
      setStep((s) => s + 1);
      return;
    }
    try {
      if (step === 0) await saveNewStarterData();
      if (step === 1) await saveQualificationsData();
      if (step === 2) {
        setSubmitting(true);
        try {
          await finish();
        } catch (e) {
          setSubmitting(false);
          let msg = 'Save failed';
          if (isAxiosError(e)) {
            const d = e.response?.data as { error?: string } | undefined;
            msg = d?.error ?? e.message;
          } else if (e instanceof Error) {
            msg = e.message;
          }
          Alert.alert('Error', msg);
          return;
        }
        return;
      }
      setStep((s) => s + 1);
    } catch (e) {
      let msg = 'Save failed';
      if (isAxiosError(e)) {
        const d = e.response?.data as { error?: string } | undefined;
        msg = d?.error ?? e.message;
      } else if (e instanceof Error) {
        msg = e.message;
      }
      Alert.alert('Error', msg);
    }
  };

  const back = () => {
    if (step === 0) navigation.goBack();
    else setStep((s) => s - 1);
  };

  if (!targetUserId) {
    return (
      <View style={styles.centered}>
        <Text>Not signed in.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  const labels = ['New starter', 'Qualifications', 'Policies'];

  return (
    <View style={styles.wrap}>
      <Text style={styles.steps}>
        Step {step + 1} of 3 — {labels[step]}
      </Text>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {step === 0 && (
          <>
            <Field label="Position / role" value={newStarter.position} onChange={(v) => setNewStarter((p) => ({ ...p, position: v }))} readOnly={readOnly} />
            <Field label="Site / project" value={newStarter.site} onChange={(v) => setNewStarter((p) => ({ ...p, site: v }))} readOnly={readOnly} />
            <Field label="National Insurance no." value={newStarter.ni_number} onChange={(v) => setNewStarter((p) => ({ ...p, ni_number: v }))} readOnly={readOnly} />
            <Field label="Address line 1" value={newStarter.address_line1} onChange={(v) => setNewStarter((p) => ({ ...p, address_line1: v }))} readOnly={readOnly} />
            <Field label="City" value={newStarter.city} onChange={(v) => setNewStarter((p) => ({ ...p, city: v }))} readOnly={readOnly} />
            <Field label="Postcode" value={newStarter.postcode} onChange={(v) => setNewStarter((p) => ({ ...p, postcode: v }))} readOnly={readOnly} />
            <Field label="Bank name" value={newStarter.bank_name} onChange={(v) => setNewStarter((p) => ({ ...p, bank_name: v }))} readOnly={readOnly} />
            <Field label="Sort code" value={newStarter.bank_sort_code} onChange={(v) => setNewStarter((p) => ({ ...p, bank_sort_code: v }))} readOnly={readOnly} />
            <Field label="Account number" value={newStarter.bank_account} onChange={(v) => setNewStarter((p) => ({ ...p, bank_account: v }))} readOnly={readOnly} />
            <Field label="Emergency contact name" value={newStarter.emergency_name} onChange={(v) => setNewStarter((p) => ({ ...p, emergency_name: v }))} readOnly={readOnly} />
            <Field label="Emergency contact phone" value={newStarter.emergency_phone} onChange={(v) => setNewStarter((p) => ({ ...p, emergency_phone: v }))} readOnly={readOnly} />
            <Field label="Right to work notes" value={newStarter.right_to_work} onChange={(v) => setNewStarter((p) => ({ ...p, right_to_work: v }))} readOnly={readOnly} />
            <Field label="Medical / allergies" value={newStarter.medical} onChange={(v) => setNewStarter((p) => ({ ...p, medical: v }))} readOnly={readOnly} multiline />
          </>
        )}
        {step === 1 && (
          <>
            <Field label="CSCS card number" value={qualifications.cscs_number} onChange={(v) => setQualifications((p) => ({ ...p, cscs_number: v }))} readOnly={readOnly} />
            <Field label="CSCS expiry (YYYY-MM-DD)" value={qualifications.cscs_expiry} onChange={(v) => setQualifications((p) => ({ ...p, cscs_expiry: v }))} readOnly={readOnly} />
            <Field label="CPCS / plant (if any)" value={qualifications.cpcs_number} onChange={(v) => setQualifications((p) => ({ ...p, cpcs_number: v }))} readOnly={readOnly} />
            <Field label="CPCS expiry (YYYY-MM-DD)" value={qualifications.cpcs_expiry} onChange={(v) => setQualifications((p) => ({ ...p, cpcs_expiry: v }))} readOnly={readOnly} />
            <Field label="Other tickets / notes" value={qualifications.other} onChange={(v) => setQualifications((p) => ({ ...p, other: v }))} readOnly={readOnly} multiline />
          </>
        )}
        {step === 2 && (
          <>
            <PolicyRow label="Health & safety policy acknowledged" value={policies.health_safety ?? false} onChange={(v) => setPolicies((p) => ({ ...p, health_safety: v }))} readOnly={readOnly} />
            <PolicyRow label="GDPR / Data policy acknowledged" value={policies.gdpr ?? false} onChange={(v) => setPolicies((p) => ({ ...p, gdpr: v }))} readOnly={readOnly} />
            <PolicyRow label="Company handbook acknowledged" value={policies.handbook ?? false} onChange={(v) => setPolicies((p) => ({ ...p, handbook: v }))} readOnly={readOnly} />
          </>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity style={styles.secondary} onPress={back}>
          <Text style={styles.secondaryText}>{step === 0 ? 'Cancel' : 'Back'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primary, submitting && styles.primaryDisabled]}
          onPress={() => void next()}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryText}>
              {readOnly ? (step >= 2 ? 'Done' : 'Next') : step === 2 ? 'Complete' : 'Save & next'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  readOnly,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        value={value}
        onChangeText={readOnly ? undefined : onChange}
        editable={!readOnly}
        placeholderTextColor="#897c98"
        multiline={multiline}
      />
    </View>
  );
}

function PolicyRow({
  label,
  value,
  onChange,
  readOnly,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  readOnly?: boolean;
}) {
  return (
    <View style={styles.policyRow}>
      <Text style={styles.policyLabel}>{label}</Text>
      <Switch value={value} onValueChange={readOnly ? undefined : onChange} disabled={readOnly} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f5f5f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  steps: { padding: 16, fontWeight: '700', color: '#4a026f' },
  scroll: { padding: 16, paddingBottom: 24 },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#4a026f', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#fff',
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  policyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  policyLabel: { flex: 1, fontSize: 15, color: '#333', paddingRight: 12 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  secondary: { padding: 12 },
  secondaryText: { color: '#4a026f', fontWeight: '600' },
  primary: {
    backgroundColor: '#4a026f',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryDisabled: { opacity: 0.7 },
  primaryText: { color: '#fff', fontWeight: '700' },
});
