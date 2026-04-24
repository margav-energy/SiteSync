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
import { onboardingService, useAuthContext } from '@staff4dshire/shared';
import type { OnboardingJson } from '@staff4dshire/shared';

type CisParams = { userId?: string; readOnly?: boolean } | undefined;
type Nav = NativeStackNavigationProp<Record<string, object | undefined>, 'CisOnboarding'>;
type R = RouteProp<{ CisOnboarding: CisParams }, 'CisOnboarding'>;

function asStrings(obj: unknown): Record<string, string> {
  if (!obj || typeof obj !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[k] = v == null ? '' : String(v);
  }
  return out;
}

function asBool(v: unknown): boolean {
  return Boolean(v);
}

export function CisOnboardingFormScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<R>();
  const { user } = useAuthContext();
  const targetUserId = route.params?.userId ?? user?.id;
  const readOnly = Boolean(route.params?.readOnly);

  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Record<string, string>>({});
  const [boolFields, setBoolFields] = useState({
    utr_verified: false,
    ppe_boots: false,
    ppe_helmet: false,
    ppe_gloves: false,
    ppe_hi_vis: false,
    declaration_ack: false,
  });

  const load = useCallback(async () => {
    if (!targetUserId) return;
    setLoading(true);
    try {
      const { data } = await onboardingService.loadCis(targetUserId);
      const d = data as Record<string, unknown>;
      setForm(asStrings(d));
      setBoolFields({
        utr_verified: asBool(d.utr_verified),
        ppe_boots: asBool(d.ppe_boots),
        ppe_helmet: asBool(d.ppe_helmet),
        ppe_gloves: asBool(d.ppe_gloves),
        ppe_hi_vis: asBool(d.ppe_hi_vis),
        declaration_ack: asBool(d.declaration_ack),
      });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not load CIS');
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const setField = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!targetUserId || readOnly) return;
    const payload = {
      ...form,
      ...boolFields,
    } as OnboardingJson;
    await onboardingService.saveCis(targetUserId, payload);
    Alert.alert('Saved', 'CIS onboarding updated.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
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

  return (
    <View style={styles.wrap}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.section}>Identity & CIS</Text>
        <Field label="Full name" value={form.full_name} onChange={(v) => setField('full_name', v)} readOnly={readOnly} />
        <Field label="Date of birth (YYYY-MM-DD)" value={form.dob} onChange={(v) => setField('dob', v)} readOnly={readOnly} />
        <Field label="National Insurance no." value={form.ni_number} onChange={(v) => setField('ni_number', v)} readOnly={readOnly} />
        <Field label="UTR (Unique Taxpayer Reference)" value={form.utr} onChange={(v) => setField('utr', v)} readOnly={readOnly} />
        <BoolRow label="UTR verified" value={boolFields.utr_verified} onChange={(v) => setBoolFields((p) => ({ ...p, utr_verified: v }))} readOnly={readOnly} />
        <Field label="VAT number (if any)" value={form.vat_number} onChange={(v) => setField('vat_number', v)} readOnly={readOnly} />
        <Field label="Trading name" value={form.trading_name} onChange={(v) => setField('trading_name', v)} readOnly={readOnly} />
        <Field label="Subcontractor type" value={form.subcontractor_type} onChange={(v) => setField('subcontractor_type', v)} readOnly={readOnly} />
        <Field label="CIS deduction rate (e.g. 20%)" value={form.cis_rate} onChange={(v) => setField('cis_rate', v)} readOnly={readOnly} />

        <Text style={styles.section}>Bank</Text>
        <Field label="Bank name" value={form.bank_name} onChange={(v) => setField('bank_name', v)} readOnly={readOnly} />
        <Field label="Sort code" value={form.bank_sort} onChange={(v) => setField('bank_sort', v)} readOnly={readOnly} />
        <Field label="Account number" value={form.bank_account} onChange={(v) => setField('bank_account', v)} readOnly={readOnly} />

        <Text style={styles.section}>Site / PPE</Text>
        <BoolRow label="Safety boots" value={boolFields.ppe_boots} onChange={(v) => setBoolFields((p) => ({ ...p, ppe_boots: v }))} readOnly={readOnly} />
        <BoolRow label="Hard hat" value={boolFields.ppe_helmet} onChange={(v) => setBoolFields((p) => ({ ...p, ppe_helmet: v }))} readOnly={readOnly} />
        <BoolRow label="Gloves" value={boolFields.ppe_gloves} onChange={(v) => setBoolFields((p) => ({ ...p, ppe_gloves: v }))} readOnly={readOnly} />
        <BoolRow label="Hi-vis" value={boolFields.ppe_hi_vis} onChange={(v) => setBoolFields((p) => ({ ...p, ppe_hi_vis: v }))} readOnly={readOnly} />
        <Field label="Site rules / induction notes" value={form.site_rules} onChange={(v) => setField('site_rules', v)} readOnly={readOnly} multiline />

        <Text style={styles.section}>Declaration</Text>
        <Field label="Full name (signature)" value={form.signature_name} onChange={(v) => setField('signature_name', v)} readOnly={readOnly} />
        <BoolRow label="I confirm the details above are correct" value={boolFields.declaration_ack} onChange={(v) => setBoolFields((p) => ({ ...p, declaration_ack: v }))} readOnly={readOnly} />
      </ScrollView>
      {!readOnly && (
        <TouchableOpacity style={styles.saveBtn} onPress={() => void save().catch((e) => Alert.alert('Error', String(e)))}>
          <Text style={styles.saveText}>Save CIS onboarding</Text>
        </TouchableOpacity>
      )}
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

function BoolRow({
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
  scroll: { padding: 16, paddingBottom: 32 },
  section: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4a026f',
    marginTop: 8,
    marginBottom: 8,
  },
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
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  policyLabel: { flex: 1, fontSize: 15, color: '#333', paddingRight: 12 },
  saveBtn: {
    backgroundColor: '#4a026f',
    margin: 16,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: '700' },
});
