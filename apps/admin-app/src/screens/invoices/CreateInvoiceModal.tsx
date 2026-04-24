import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { xeroService, type XeroCreateInvoiceLine } from '@staff4dshire/shared';

function apiErrorMessage(err: unknown): string {
  const ax = err as { response?: { data?: { error?: string; message?: string } }; message?: string };
  const d = ax.response?.data;
  return d?.error || d?.message || ax.message || 'Request failed';
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

type LineForm = {
  description: string;
  quantity: string;
  unit_amount: string;
  account_code: string;
};

const emptyLine = (defaultAccount: string): LineForm => ({
  description: '',
  quantity: '1',
  unit_amount: '',
  account_code: defaultAccount,
});

export function CreateInvoiceModal(props: {
  visible: boolean;
  companyId: string;
  onClose: () => void;
}) {
  const { visible, companyId, onClose } = props;
  const queryClient = useQueryClient();

  const [contactName, setContactName] = useState('');
  const [reference, setReference] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(todayIso());
  const [dueDate, setDueDate] = useState(addDaysIso(7));
  const [issueAs, setIssueAs] = useState<'DRAFT' | 'AUTHORISED'>('DRAFT');
  const [lines, setLines] = useState<LineForm[]>([emptyLine('')]);

  const { data: accountsRes, isLoading: accountsLoading } = useQuery({
    queryKey: ['xero', 'accounts', companyId],
    queryFn: () => xeroService.listAccounts(companyId),
    enabled: visible && Boolean(companyId),
  });

  const defaultAccount = useMemo(() => accountsRes?.accounts[0]?.code ?? '', [accountsRes?.accounts]);

  useEffect(() => {
    if (!visible) return;
    setContactName('');
    setReference('');
    setInvoiceDate(todayIso());
    setDueDate(addDaysIso(7));
    setIssueAs('DRAFT');
    setLines([emptyLine('')]);
  }, [visible]);

  useEffect(() => {
    if (!visible || !defaultAccount) return;
    setLines((prev) => {
      if (prev.length === 0) return [emptyLine(defaultAccount)];
      const [first, ...rest] = prev;
      if (first.account_code) return prev;
      return [{ ...first, account_code: defaultAccount }, ...rest];
    });
  }, [visible, defaultAccount]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const line_items: XeroCreateInvoiceLine[] = [];
      for (let i = 0; i < lines.length; i++) {
        const L = lines[i];
        const qty = Number(L.quantity);
        const unit = Number(L.unit_amount);
        if (!L.description.trim()) throw new Error(`Line ${i + 1}: add a description`);
        if (!Number.isFinite(qty) || qty <= 0) throw new Error(`Line ${i + 1}: invalid quantity`);
        if (!Number.isFinite(unit)) throw new Error(`Line ${i + 1}: invalid amount`);
        if (!L.account_code.trim()) throw new Error(`Line ${i + 1}: choose an account code`);
        line_items.push({
          description: L.description.trim(),
          quantity: qty,
          unit_amount: unit,
          account_code: L.account_code.trim(),
        });
      }
      return xeroService.createInvoice({
        companyId,
        contact_name: contactName.trim(),
        reference: reference.trim() || undefined,
        date: invoiceDate,
        due_date: dueDate,
        status: issueAs,
        line_items,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['xero', 'invoices'] });
      Alert.alert('Xero', 'Invoice created.');
      onClose();
    },
  });

  const setLine = (index: number, patch: Partial<LineForm>) => {
    setLines((prev) => prev.map((L, i) => (i === index ? { ...L, ...patch } : L)));
  };

  const addLine = () => {
    setLines((prev) => [...prev, emptyLine(defaultAccount)]);
  };

  const removeLine = (index: number) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const errMsg = createMutation.isError ? apiErrorMessage(createMutation.error) : null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>New sales invoice</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={26} color="#4a026f" />
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Customer / contact name</Text>
            <TextInput
              style={styles.input}
              placeholder="Required — matches or creates a Xero contact"
              placeholderTextColor="#9ca3af"
              value={contactName}
              onChangeText={setContactName}
            />

            <Text style={styles.fieldLabel}>Reference (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Your PO / job ref"
              placeholderTextColor="#9ca3af"
              value={reference}
              onChangeText={setReference}
            />

            <View style={styles.row2}>
              <View style={styles.row2Item}>
                <Text style={styles.fieldLabel}>Invoice date</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9ca3af"
                  value={invoiceDate}
                  onChangeText={setInvoiceDate}
                />
              </View>
              <View style={styles.row2Item}>
                <Text style={styles.fieldLabel}>Due date</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9ca3af"
                  value={dueDate}
                  onChangeText={setDueDate}
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>When created</Text>
            <View style={styles.toggleRow}>
              <Pressable
                style={[styles.toggleChip, issueAs === 'DRAFT' && styles.toggleChipOn]}
                onPress={() => setIssueAs('DRAFT')}
              >
                <Text style={[styles.toggleChipText, issueAs === 'DRAFT' && styles.toggleChipTextOn]}>Draft</Text>
              </Pressable>
              <Pressable
                style={[styles.toggleChip, issueAs === 'AUTHORISED' && styles.toggleChipOn]}
                onPress={() => setIssueAs('AUTHORISED')}
              >
                <Text style={[styles.toggleChipText, issueAs === 'AUTHORISED' && styles.toggleChipTextOn]}>
                  Authorised
                </Text>
              </Pressable>
            </View>
            <Text style={styles.hintSmall}>
              Draft saves in Xero for review. Authorised marks it approved (per your Xero numbering and tax rules).
            </Text>

            <Text style={styles.fieldLabel}>Line items</Text>
            {accountsLoading ? (
              <ActivityIndicator color="#4a026f" style={{ marginVertical: 8 }} />
            ) : accountsRes && accountsRes.accounts.length === 0 ? (
              <Text style={styles.warnSmall}>
                No revenue accounts returned — enter the account code from your Xero chart (e.g. 200).
              </Text>
            ) : null}

            {lines.map((line, index) => (
              <View key={index} style={styles.lineBlock}>
                <View style={styles.lineHeader}>
                  <Text style={styles.lineTitle}>Line {index + 1}</Text>
                  {lines.length > 1 ? (
                    <Pressable onPress={() => removeLine(index)}>
                      <Text style={styles.removeLine}>Remove</Text>
                    </Pressable>
                  ) : null}
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Description"
                  placeholderTextColor="#9ca3af"
                  value={line.description}
                  onChangeText={(t) => setLine(index, { description: t })}
                />
                <View style={styles.row3}>
                  <TextInput
                    style={[styles.input, styles.qty]}
                    placeholder="Qty"
                    placeholderTextColor="#9ca3af"
                    keyboardType="decimal-pad"
                    value={line.quantity}
                    onChangeText={(t) => setLine(index, { quantity: t })}
                  />
                  <TextInput
                    style={[styles.input, styles.amt]}
                    placeholder="Unit price"
                    placeholderTextColor="#9ca3af"
                    keyboardType="decimal-pad"
                    value={line.unit_amount}
                    onChangeText={(t) => setLine(index, { unit_amount: t })}
                  />
                  <TextInput
                    style={[styles.input, styles.code]}
                    placeholder="Acct"
                    placeholderTextColor="#9ca3af"
                    value={line.account_code}
                    onChangeText={(t) => setLine(index, { account_code: t })}
                  />
                </View>
              </View>
            ))}

            <Pressable style={styles.addLineBtn} onPress={addLine}>
              <Ionicons name="add-circle-outline" size={20} color="#4a026f" />
              <Text style={styles.addLineText}>Add line</Text>
            </Pressable>

            {errMsg ? <Text style={styles.errorInline}>{errMsg}</Text> : null}

            <Pressable
              style={[styles.primaryBtn, createMutation.isPending && styles.primaryBtnDisabled]}
              disabled={createMutation.isPending}
              onPress={() => {
                if (!contactName.trim()) {
                  Alert.alert('Contact required', 'Enter a customer or contact name.');
                  return;
                }
                createMutation.mutate();
              }}
            >
              {createMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Create in Xero</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  keyboardView: { maxHeight: '92%', width: '100%' },
  sheet: {
    maxHeight: '92%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e0eb',
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#4a026f' },
  scroll: { paddingHorizontal: 16, paddingTop: 12 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#897c98',
    marginBottom: 6,
    marginTop: 10,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d8c8e0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: 15,
    color: '#2d1b3d',
    backgroundColor: '#faf8fc',
  },
  row2: { flexDirection: 'row', gap: 10 },
  row2Item: { flex: 1 },
  row3: { flexDirection: 'row', gap: 8, marginTop: 8 },
  qty: { flex: 0.7 },
  amt: { flex: 1.2 },
  code: { flex: 0.9 },
  toggleRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  toggleChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d8c8e0',
    backgroundColor: '#fff',
  },
  toggleChipOn: { backgroundColor: '#4a026f', borderColor: '#4a026f' },
  toggleChipText: { fontWeight: '700', color: '#4a026f', fontSize: 14 },
  toggleChipTextOn: { color: '#fff' },
  hintSmall: { fontSize: 11, color: '#9ca3af', marginTop: 6, lineHeight: 15 },
  lineBlock: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f7f4fb',
    borderWidth: 1,
    borderColor: '#e8e0f0',
  },
  lineHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  lineTitle: { fontWeight: '700', color: '#4a026f', fontSize: 14 },
  removeLine: { color: '#b91c1c', fontWeight: '600', fontSize: 13 },
  addLineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 12,
    marginBottom: 8,
  },
  addLineText: { color: '#4a026f', fontWeight: '700', fontSize: 15 },
  warnSmall: { fontSize: 12, color: '#b45309', marginBottom: 4 },
  errorInline: { color: '#b91c1c', fontSize: 13, marginVertical: 8 },
  primaryBtn: {
    backgroundColor: '#4a026f',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
