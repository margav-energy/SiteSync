import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Pressable,
  RefreshControl,
  FlatList,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  useAuthContext,
  useCompanyContext,
  hasCapability,
  xeroService,
  type XeroStatusResponse,
  type XeroInvoiceListItem,
} from '@staff4dshire/shared';
import { CreateInvoiceModal } from './CreateInvoiceModal';

function apiErrorMessage(err: unknown): string {
  const ax = err as { response?: { data?: { error?: string; message?: string } }; message?: string };
  const d = ax.response?.data;
  return d?.error || d?.message || ax.message || 'Request failed';
}

function isXeroConnected(s: XeroStatusResponse | null): s is Extract<XeroStatusResponse, { status: 'connected' }> {
  return s !== null && s.status === 'connected' && s.xero_connected === true;
}

const STATUS_OPTIONS = [
  { key: 'ALL', label: 'All' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'SUBMITTED', label: 'Submitted' },
  { key: 'AUTHORISED', label: 'Authorised' },
  { key: 'PAID', label: 'Paid' },
  { key: 'VOIDED', label: 'Voided' },
] as const;

function formatMoney(inv: XeroInvoiceListItem): string {
  const cur = inv.currency_code || 'GBP';
  const n = inv.total ?? 0;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(n);
  } catch {
    return `${cur} ${n.toFixed(2)}`;
  }
}

function matchesSearch(inv: XeroInvoiceListItem, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const blob = [
    inv.invoice_number,
    inv.contact_name ?? '',
    inv.reference ?? '',
    inv.status,
  ]
    .join(' ')
    .toLowerCase();
  return s.split(/\s+/).every((p) => blob.includes(p));
}

function InvoiceRow({ item }: { item: XeroInvoiceListItem }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <Text style={styles.invNum} numberOfLines={1}>
          {item.invoice_number || '—'}
        </Text>
        <Text style={styles.amount}>{formatMoney(item)}</Text>
      </View>
      <Text style={styles.contact} numberOfLines={2}>
        {item.contact_name || 'No contact'}
      </Text>
      <View style={styles.rowMeta}>
        <Text style={styles.metaText}>
          {item.date ? item.date : '—'} · {item.status}
        </Text>
        {item.amount_due != null && item.amount_due > 0 ? (
          <Text style={styles.due}>Due {item.currency_code ?? 'GBP'} {item.amount_due.toFixed(2)}</Text>
        ) : null}
      </View>
    </View>
  );
}

export function InvoicesScreen() {
  const navigation = useNavigation();
  const { user } = useAuthContext();
  const { companies, activeCompanyId, loading: companiesLoading } = useCompanyContext();
  const selectedCompanyId = activeCompanyId;
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]['key']>('ALL');
  const [search, setSearch] = useState('');
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);

  const canManage = hasCapability(user?.role, 'manage_invoices');
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const { data: xeroStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['xero', 'status', selectedCompanyId],
    queryFn: () => xeroService.getStatus(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId && isAdmin),
  });

  const {
    data: invoicePayload,
    isLoading: invoicesLoading,
    error: invoicesError,
    refetch: refetchInvoices,
    isRefetching,
  } = useQuery({
    queryKey: ['xero', 'invoices', selectedCompanyId, statusFilter],
    queryFn: () =>
      xeroService.listInvoices({
        companyId: selectedCompanyId!,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        page: 1,
      }),
    enabled: Boolean(selectedCompanyId && isAdmin && isXeroConnected(xeroStatus ?? null)),
  });

  const filtered = useMemo(() => {
    const list = invoicePayload?.invoices ?? [];
    return list.filter((inv: XeroInvoiceListItem) => matchesSearch(inv, search));
  }, [invoicePayload?.invoices, search]);

  const onRefresh = useCallback(async () => {
    await refetchStatus();
    await refetchInvoices();
  }, [refetchStatus, refetchInvoices]);

  const openXeroSettings = useCallback(() => {
    const tabNav = navigation.getParent() as { navigate: (n: string, p?: object) => void } | undefined;
    if (tabNav) {
      tabNav.navigate('Settings', { screen: 'XeroIntegration' });
    } else {
      Alert.alert('Navigation', 'Open Settings → Xero from the Settings tab.');
    }
  }, [navigation]);

  if (!user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Not signed in.</Text>
      </View>
    );
  }

  if (!canManage) {
    return (
      <View style={styles.centered}>
        <Text style={styles.body}>You do not have access to invoicing.</Text>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <Text style={styles.body}>Only admins can view Xero invoices.</Text>
      </View>
    );
  }

  if (!companiesLoading && companies.length === 0) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.warn}>No companies found. Create a company first.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {!selectedCompanyId ? (
        <View style={styles.centered}>
          <ActivityIndicator size={36} color="#4a026f" />
        </View>
      ) : (
        <>
          <View style={[styles.banner, !isXeroConnected(xeroStatus ?? null) && styles.bannerWarn]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>Xero</Text>
              {xeroStatus == null ? (
                <Text style={styles.bannerBody}>Loading connection status…</Text>
              ) : isXeroConnected(xeroStatus ?? null) ? (
                <Text style={styles.bannerBody} numberOfLines={2}>
                  Linked to{' '}
                  {xeroStatus.status === 'connected'
                    ? xeroStatus.xero_tenant_name || xeroStatus.xero_tenant_id
                    : ''}
                  . Sales invoices (ACCREC) load below.
                </Text>
              ) : xeroStatus.status === 'reauth_required' ? (
                <Text style={styles.bannerBody}>Reconnect Xero — your authorisation expired.</Text>
              ) : (
                <Text style={styles.bannerBody}>Connect Xero to list sales invoices for this company.</Text>
              )}
            </View>
            <Pressable style={styles.bannerBtn} onPress={openXeroSettings}>
              <Text style={styles.bannerBtnText}>
                {isXeroConnected(xeroStatus ?? null) ? 'Manage' : 'Connect'}
              </Text>
            </Pressable>
          </View>

          {invoicesError ? (
            <Text style={styles.errorText}>{apiErrorMessage(invoicesError)}</Text>
          ) : null}

          {isXeroConnected(xeroStatus ?? null) ? (
            <>
              <View style={styles.createInvoiceRow}>
                <Pressable style={styles.createInvoiceBtn} onPress={() => setCreateInvoiceOpen(true)}>
                  <Ionicons name="add-circle-outline" size={22} color="#fff" />
                  <Text style={styles.createInvoiceBtnText}>New invoice</Text>
                </Pressable>
              </View>
              {selectedCompanyId ? (
                <CreateInvoiceModal
                  visible={createInvoiceOpen}
                  companyId={selectedCompanyId}
                  onClose={() => setCreateInvoiceOpen(false)}
                />
              ) : null}

              <View style={styles.searchRow}>
                <Ionicons name="search-outline" size={20} color="#6b4d7c" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search number, contact, reference…"
                  placeholderTextColor="#8b7c99"
                  value={search}
                  onChangeText={setSearch}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {search.length > 0 ? (
                  <Pressable onPress={() => setSearch('')} hitSlop={10}>
                    <Ionicons name="close-circle" size={22} color="#897c98" />
                  </Pressable>
                ) : null}
              </View>

              <Text style={styles.label}>Status</Text>
              <View style={styles.filterWrap}>
                {STATUS_OPTIONS.map((o) => {
                  const active = statusFilter === o.key;
                  return (
                    <Pressable
                      key={o.key}
                      style={[styles.filterChip, active && styles.filterChipActive]}
                      onPress={() => setStatusFilter(o.key)}
                    >
                      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{o.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {invoicesLoading && !invoicePayload ? (
                <ActivityIndicator size={36} color="#4a026f" style={styles.spinner} />
              ) : (
                <FlatList
                  data={filtered}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => <InvoiceRow item={item} />}
                  refreshControl={
                    <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor="#4a026f" />
                  }
                  ListEmptyComponent={
                    <Text style={styles.empty}>
                      {invoicesLoading ? 'Loading…' : 'No invoices match the current filters.'}
                    </Text>
                  }
                  contentContainerStyle={styles.listContent}
                  style={styles.list}
                />
              )}
              <Text style={styles.footerHint}>
                Create sales invoices here or in Xero. List shows up to 100 per page. For bills and other document
                types, use Xero.
              </Text>
            </>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f0eef5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  body: { fontSize: 16, color: '#333', textAlign: 'center' },
  muted: { color: '#707173' },
  block: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  label: { fontSize: 12, fontWeight: '700', color: '#897c98', marginBottom: 8, textTransform: 'uppercase' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d8c8e0',
    backgroundColor: '#fff',
  },
  chipSelected: { borderColor: '#4a026f', backgroundColor: '#f3ecfc' },
  chipText: { fontSize: 14, color: '#333' },
  chipTextSelected: { fontWeight: '700', color: '#4a026f' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#e8ddfa',
    borderWidth: 1,
    borderColor: '#dcd6e8',
    gap: 12,
  },
  bannerWarn: { backgroundColor: '#fef3c7', borderColor: '#fcd34d' },
  bannerTitle: { fontSize: 13, fontWeight: '800', color: '#4a026f', marginBottom: 4 },
  bannerBody: { fontSize: 13, color: '#4b5563', lineHeight: 18 },
  bannerBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#4a026f',
  },
  bannerBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  errorText: { color: '#b91c1c', marginHorizontal: 16, marginBottom: 8, fontSize: 13 },
  createInvoiceRow: { paddingHorizontal: 16, marginBottom: 10 },
  createInvoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4a026f',
    paddingVertical: 12,
    borderRadius: 12,
  },
  createInvoiceBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d8c8e0',
    backgroundColor: '#fff',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#2d1b3d',
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  },
  filterWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d8c8e0',
    backgroundColor: '#fff',
  },
  filterChipActive: { backgroundColor: '#4a026f', borderColor: '#4a026f' },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#4a026f' },
  filterChipTextActive: { color: '#fff' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  row: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e0eb',
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  invNum: { fontSize: 16, fontWeight: '800', color: '#4a026f', flex: 1 },
  amount: { fontSize: 16, fontWeight: '700', color: '#111' },
  contact: { fontSize: 14, color: '#374151', marginTop: 6 },
  rowMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 8 },
  metaText: { fontSize: 12, color: '#6b7280', flex: 1 },
  due: { fontSize: 12, fontWeight: '600', color: '#b45309' },
  empty: { textAlign: 'center', color: '#897c98', padding: 24, fontSize: 14 },
  spinner: { marginVertical: 24 },
  footerHint: { fontSize: 11, color: '#9ca3af', paddingHorizontal: 20, paddingBottom: 16, lineHeight: 16 },
  warn: { color: '#b45309', marginHorizontal: 16, marginTop: 12, fontSize: 14 },
});
