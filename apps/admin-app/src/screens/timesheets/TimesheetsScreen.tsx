import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Alert,
  Platform,
  ScrollView,
  TextInput,
  LayoutAnimation,
  UIManager,
  Modal,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { timesheetsService, usersService, projectsService } from '@staff4dshire/shared';
import type { TimeEntry, User, Project } from '@staff4dshire/shared';

type Period = 'all' | 'week' | 'month';
type StatusFilter = 'all' | 'open' | 'completed';

type EnrichedEntry = TimeEntry & {
  staffLabel: string;
  projectLabel: string;
  durationLabel: string;
  isOpen: boolean;
  /** Lowercase string for search (name, project, email). */
  searchBlob: string;
};

function travelLabel(r: TimeEntry): string {
  if (!r.arrived_at) return '';
  return `${r.travel_minutes ?? 0} min / ${(r.travel_miles ?? 0).toFixed(2)} mi`;
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDuration(signIn: string, signOut?: string): string {
  const start = new Date(signIn).getTime();
  const end = signOut ? new Date(signOut).getTime() : Date.now();
  const ms = Math.max(0, end - start);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (!signOut) {
    return `${h}h ${m}m · on shift`;
  }
  return `${h}h ${m}m`;
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function inPeriod(signInAt: string, period: Period): boolean {
  if (period === 'all') return true;
  const t = new Date(signInAt).getTime();
  const now = Date.now();
  if (period === 'week') {
    return t >= startOfWeek(new Date()).getTime();
  }
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  return t >= monthStart.getTime() && t <= now;
}

function buildCsvRows(rows: EnrichedEntry[]): string {
  const header = [
    'Staff',
    'Project',
    'Sign in (local)',
    'Sign out (local)',
    'Duration',
    'Status',
    'Sign-in origin',
    'Arrival',
    'Travel',
  ];
  const lines = [header.map(escapeCsvCell).join(',')];
  for (const r of rows) {
    lines.push(
      [
        escapeCsvCell(r.staffLabel),
        escapeCsvCell(r.projectLabel),
        escapeCsvCell(new Date(r.sign_in_at).toLocaleString()),
        escapeCsvCell(r.sign_out_at ? new Date(r.sign_out_at).toLocaleString() : ''),
        escapeCsvCell(r.durationLabel.replace(' · on shift', '')),
        escapeCsvCell(r.isOpen ? 'Open' : 'Completed'),
        escapeCsvCell(r.sign_in_address ?? ''),
        escapeCsvCell(r.arrived_at ? new Date(r.arrived_at).toLocaleString() : ''),
        escapeCsvCell(travelLabel(r)),
      ].join(',')
    );
  }
  return '\uFEFF' + lines.join('\r\n');
}

function buildPdfHtml(rows: EnrichedEntry[], title: string): string {
  const th =
    'padding:10px 8px;text-align:left;border-bottom:2px solid #c5b0e0;background:#e8ddfa;color:#4a026f;font-size:11px;';
  const rowsHtml = rows
    .map((r, i) => {
      const bg = i % 2 === 0 ? '#ffffff' : '#faf8fc';
      const td = `padding:8px;border-bottom:1px solid #e8e8e8;vertical-align:top;font-size:10px;background:${bg};color:#2d1b3d;`;
      return `<tr>
      <td style="${td}">${escapeHtml(r.staffLabel)}</td>
      <td style="${td}">${escapeHtml(r.projectLabel)}</td>
      <td style="${td}">${escapeHtml(new Date(r.sign_in_at).toLocaleString())}</td>
      <td style="${td}">${escapeHtml(r.sign_out_at ? new Date(r.sign_out_at).toLocaleString() : '—')}</td>
      <td style="${td}">${escapeHtml(r.durationLabel)}</td>
      <td style="${td}">${r.isOpen ? 'Open' : 'Completed'}</td>
      <td style="${td}">${escapeHtml(r.sign_in_address ?? '—')}</td>
      <td style="${td}">${escapeHtml(r.arrived_at ? new Date(r.arrived_at).toLocaleString() : '—')}</td>
      <td style="${td}">${escapeHtml(travelLabel(r) || '—')}</td>
    </tr>`;
    })
    .join('');
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#fff;color:#2d1b3d;">
  <h1 style="color:#4a026f;font-size:18px;margin:0 0 8px 0;">${escapeHtml(title)}</h1>
  <p style="color:#707173;font-size:11px;margin:0 0 16px 0;">Generated ${escapeHtml(new Date().toLocaleString())}</p>
  <table style="width:100%;border-collapse:collapse;border:1px solid #e4dce8;">
    <thead><tr>
      <th style="${th}">Staff</th>
      <th style="${th}">Project</th>
      <th style="${th}">Sign in</th>
      <th style="${th}">Sign out</th>
      <th style="${th}">Duration</th>
      <th style="${th}">Status</th>
      <th style="${th}">Sign-in origin</th>
      <th style="${th}">Arrival</th>
      <th style="${th}">Travel</th>
    </tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function StatBox({ children }: { children: React.ReactNode }) {
  return <View style={styles.statBox}>{children}</View>;
}

function matchesSearch(entry: EnrichedEntry, raw: string): boolean {
  const q = raw.trim().toLowerCase();
  if (!q) return true;
  const parts = q.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return true;
  return parts.every((p) => entry.searchBlob.includes(p));
}

function TableHeader() {
  return (
    <View style={[styles.tr, styles.trHeader]}>
      <Text style={[styles.th, styles.colStaff]}>Staff</Text>
      <Text style={[styles.th, styles.colProject]}>Project</Text>
      <Text style={[styles.th, styles.colTime]}>Sign in</Text>
      <Text style={[styles.th, styles.colTime]}>Sign out</Text>
      <Text style={[styles.th, styles.colDur]}>Duration</Text>
      <Text style={[styles.th, styles.colStatus]}>Status</Text>
      <Text style={[styles.th, styles.colWide]}>Sign-in origin</Text>
      <Text style={[styles.th, styles.colTime]}>Arrival</Text>
      <Text style={[styles.th, styles.colDur]}>Travel</Text>
    </View>
  );
}

function TableRow({
  item,
  index,
  onOpen,
}: {
  item: EnrichedEntry;
  index: number;
  onOpen: (item: EnrichedEntry) => void;
}) {
  const zebra = index % 2 === 0 ? styles.tdZebraA : styles.tdZebraB;
  return (
    <Pressable style={[styles.tr, zebra]} onPress={() => onOpen(item)}>
      <Text style={[styles.td, styles.colStaff]} numberOfLines={2}>
        {item.staffLabel}
      </Text>
      <Text style={[styles.td, styles.colProject]} numberOfLines={2}>
        {item.projectLabel}
      </Text>
      <Text style={[styles.td, styles.colTime]} numberOfLines={2}>
        {new Date(item.sign_in_at).toLocaleString()}
      </Text>
      <Text style={[styles.td, styles.colTime]} numberOfLines={2}>
        {item.sign_out_at ? new Date(item.sign_out_at).toLocaleString() : '—'}
      </Text>
      <Text style={[styles.td, styles.colDur]} numberOfLines={2}>
        {item.durationLabel}
      </Text>
      <View style={[styles.td, styles.colStatus, styles.statusCell]}>
        <View style={[styles.badge, item.isOpen ? styles.badgeOpen : styles.badgeDone]}>
          <Text style={[styles.badgeTxt, item.isOpen ? styles.badgeTxtOpen : styles.badgeTxtDone]}>
            {item.isOpen ? 'Open' : 'Done'}
          </Text>
        </View>
      </View>
      <Text style={[styles.td, styles.colWide]} numberOfLines={2}>
        {item.sign_in_address ?? '—'}
      </Text>
      <Text style={[styles.td, styles.colTime]} numberOfLines={2}>
        {item.arrived_at ? new Date(item.arrived_at).toLocaleString() : '—'}
      </Text>
      <Text style={[styles.td, styles.colDur]} numberOfLines={2}>
        {travelLabel(item) || '—'}
      </Text>
    </Pressable>
  );
}

export function TimesheetsScreen() {
  const [period, setPeriod] = useState<Period>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<EnrichedEntry | null>(null);

  const filtersActive = period !== 'all' || statusFilter !== 'all';

  const toggleFilters = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFiltersOpen((o) => !o);
  }, []);

  const { data: entries = [], isLoading: loadingEntries } = useQuery({
    queryKey: ['timesheets'],
    queryFn: () => timesheetsService.getAll(),
  });
  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersService.getAll(),
  });
  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsService.getAll(),
  });

  const userMap = useMemo(() => {
    const m = new Map<string, User>();
    users.forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

  const projectMap = useMemo(() => {
    const m = new Map<string, Project>();
    projects.forEach((p) => m.set(p.id, p));
    return m;
  }, [projects]);

  const enriched: EnrichedEntry[] = useMemo(() => {
    return entries.map((e) => {
      const u = userMap.get(e.user_id);
      const p = projectMap.get(e.project_id);
      const staffLabel = u
        ? `${u.first_name} ${u.last_name}`.trim() || u.email
        : `User ${e.user_id.slice(0, 8)}…`;
      const projectLabel = p?.name ?? `Project ${e.project_id.slice(0, 8)}…`;
      const isOpen = !e.sign_out_at;
      const email = (u?.email ?? '').toLowerCase();
      const searchBlob = [
        staffLabel,
        projectLabel,
        email,
        u ? `${u.first_name} ${u.last_name}`.toLowerCase() : '',
      ]
        .join(' ')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
      return {
        ...e,
        staffLabel,
        projectLabel,
        durationLabel: formatDuration(e.sign_in_at, e.sign_out_at),
        isOpen,
        searchBlob,
      };
    });
  }, [entries, userMap, projectMap]);

  const filtered = useMemo(() => {
    let list = enriched.filter((e) => inPeriod(e.sign_in_at, period));
    if (statusFilter === 'open') list = list.filter((e) => e.isOpen);
    else if (statusFilter === 'completed') list = list.filter((e) => !e.isOpen);
    list = list.filter((e) => matchesSearch(e, searchQuery));
    return list;
  }, [enriched, period, statusFilter, searchQuery]);

  const stats = useMemo(() => {
    const open = filtered.filter((e) => e.isOpen).length;
    const done = filtered.filter((e) => !e.isOpen).length;
    return { total: filtered.length, open, done };
  }, [filtered]);

  const exportCsv = useCallback(async () => {
    if (filtered.length === 0) {
      Alert.alert('Nothing to export', 'No timesheet rows match the current filters.');
      return;
    }
    setExporting('csv');
    try {
      const csv = buildCsvRows(filtered);
      const name = `timesheets_${period}_${Date.now()}.csv`;

      if (Platform.OS === 'web' && typeof globalThis.document !== 'undefined') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = globalThis.document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
        Alert.alert('Download started', 'Your CSV file should download (opens in Excel).');
        return;
      }

      const base = FileSystem.cacheDirectory;
      if (!base) {
        Alert.alert('Export unavailable', 'File storage is not available in this environment.');
        return;
      }
      const uri = base + name;
      await FileSystem.writeAsStringAsync(uri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export timesheets (Excel)',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('Saved', `File written to cache:\n${uri}`);
      }
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setExporting(null);
    }
  }, [filtered, period]);

  const exportPdf = useCallback(async () => {
    if (filtered.length === 0) {
      Alert.alert('Nothing to export', 'No timesheet rows match the current filters.');
      return;
    }
    setExporting('pdf');
    try {
      const label =
        period === 'all' ? 'All timesheets' : period === 'week' ? 'This week' : 'This month';
      const html = buildPdfHtml(filtered, `Timesheets — ${label}`);

      if (Platform.OS === 'web' && typeof globalThis.window !== 'undefined') {
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const w = globalThis.window.open(url, '_blank', 'noopener,noreferrer');
        if (w) {
          w.focus();
          setTimeout(() => URL.revokeObjectURL(url), 120000);
          Alert.alert(
            'Print to PDF',
            'Use your browser: Print → Save as PDF. If the page looks blank, refresh the tab once.'
          );
        } else {
          URL.revokeObjectURL(url);
          Alert.alert('Pop-up blocked', 'Allow pop-ups for this site to open the printable report.');
        }
        return;
      }

      const result = await Print.printToFileAsync({
        html,
        width: 612,
        height: 792,
        margins: { left: 24, right: 24, top: 24, bottom: 24 },
      });
      const uri = result?.uri;
      if (!uri) {
        Alert.alert('PDF', 'Could not create PDF file on this device.');
        return;
      }
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
          dialogTitle: 'Export timesheets (PDF)',
        });
      } else {
        Alert.alert('Saved', uri);
      }
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setExporting(null);
    }
  }, [filtered, period]);

  const loading = loadingEntries || loadingUsers || loadingProjects;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4a026f" />
        <Text style={styles.loadingText}>Loading timesheets…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.listContent}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.exportRow}>
          <Pressable
            style={({ pressed }) => [styles.exportBtnOuter, styles.exportBtnPrimary, pressed && styles.exportBtnPressed]}
            onPress={exportCsv}
            disabled={exporting !== null}
          >
            <View style={styles.exportBtnInner}>
              {exporting === 'csv' ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="document-text-outline" size={20} color="#fff" />
                  <Text style={styles.exportBtnText}>Excel (CSV)</Text>
                </>
              )}
            </View>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.exportBtnOuter, styles.exportBtnSecondary, pressed && styles.exportBtnPressed]}
            onPress={exportPdf}
            disabled={exporting !== null}
          >
            <View style={styles.exportBtnInner}>
              {exporting === 'pdf' ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="document-outline" size={20} color="#fff" />
                  <Text style={styles.exportBtnText}>PDF</Text>
                </>
              )}
            </View>
          </Pressable>
        </View>

        <View style={styles.searchBarOuter}>
          <View style={styles.searchBarInner}>
            <View style={styles.searchRow}>
              <View style={styles.searchFieldInner}>
                <Ionicons name="search-outline" size={20} color="#6b4d7c" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search staff, email, or project…"
                  placeholderTextColor="#8b7c99"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="Search timesheets"
                />
                {searchQuery.length > 0 ? (
                  <Pressable onPress={() => setSearchQuery('')} hitSlop={10} accessibilityLabel="Clear search">
                    <Ionicons name="close-circle" size={22} color="#897c98" />
                  </Pressable>
                ) : null}
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.filterIconBtn,
                  filtersOpen && styles.filterIconBtnActive,
                  pressed && { opacity: 0.88 },
                ]}
                onPress={toggleFilters}
                accessibilityRole="button"
                accessibilityLabel={filtersOpen ? 'Hide filters' : 'Show filters'}
              >
                <Ionicons name="options-outline" size={22} color={filtersOpen ? '#fff' : '#4a026f'} />
                {filtersActive ? <View style={styles.filterDot} /> : null}
              </Pressable>
            </View>
          </View>
        </View>

        {filtersOpen ? (
          <View style={styles.filterDrawer}>
            <View style={styles.filterDrawerInner}>
              <Text style={styles.filterDrawerTitle}>Refine list</Text>
              <Text style={styles.filterLabel}>Status</Text>
              <View style={styles.chips}>
                {(
                  [
                    { key: 'all' as const, label: 'All' },
                    { key: 'open' as const, label: 'On shift' },
                    { key: 'completed' as const, label: 'Completed' },
                  ] as const
                ).map(({ key, label }) => {
                  const active = statusFilter === key;
                  return (
                    <Pressable
                      key={key}
                      style={({ pressed }) => [styles.chipOuter, active ? styles.chipOuterActive : null, pressed && { opacity: 0.92 }]}
                      onPress={() => setStatusFilter(key)}
                    >
                      <Text style={active ? styles.chipTextActive : styles.chipText}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.filterLabel}>Period</Text>
              <View style={styles.chips}>
                {(['all', 'week', 'month'] as const).map((p) => {
                  const active = period === p;
                  const label = p === 'all' ? 'All' : p === 'week' ? 'This week' : 'This month';
                  return (
                    <Pressable
                      key={p}
                      style={({ pressed }) => [styles.chipOuter, active ? styles.chipOuterActive : null, pressed && { opacity: 0.92 }]}
                      onPress={() => setPeriod(p)}
                    >
                      <Text style={active ? styles.chipTextActive : styles.chipText}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.statsRow}>
          <StatBox>
            <Text style={styles.statNum}>{stats.total}</Text>
            <Text style={styles.statLbl}>Showing</Text>
          </StatBox>
          <StatBox>
            <Text style={[styles.statNum, styles.statOpen]}>{stats.open}</Text>
            <Text style={styles.statLbl}>On shift</Text>
          </StatBox>
          <StatBox>
            <Text style={styles.statNum}>{stats.done}</Text>
            <Text style={styles.statLbl}>Completed</Text>
          </StatBox>
        </View>

        <Text style={styles.sectionHeading}>Attendance</Text>

        <View style={styles.tableWrap}>
          <TableHeader />
          {filtered.length === 0 ? (
            <Text style={styles.empty}>No rows match the current filters.</Text>
          ) : (
            filtered.map((item, index) => (
              <TableRow key={item.id} item={item} index={index} onOpen={setSelectedEntry} />
            ))
          )}
        </View>
      </ScrollView>
      <Modal visible={!!selectedEntry} transparent animationType="slide" onRequestClose={() => setSelectedEntry(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {selectedEntry ? (
              <>
                <Text style={styles.modalTitle}>Timesheet review</Text>
                <Text style={styles.modalMeta}>Staff: {selectedEntry.staffLabel}</Text>
                <Text style={styles.modalMeta}>Project: {selectedEntry.projectLabel}</Text>
                <Text style={styles.modalMeta}>Sign in: {new Date(selectedEntry.sign_in_at).toLocaleString()}</Text>
                <Text style={styles.modalMeta}>
                  Sign out: {selectedEntry.sign_out_at ? new Date(selectedEntry.sign_out_at).toLocaleString() : '—'}
                </Text>
                <Text style={styles.modalMeta}>Duration: {selectedEntry.durationLabel}</Text>
                <Text style={styles.modalMeta}>Sign-in origin: {selectedEntry.sign_in_address ?? '—'}</Text>
                <Text style={styles.modalMeta}>
                  Arrival: {selectedEntry.arrived_at ? new Date(selectedEntry.arrived_at).toLocaleString() : '—'}
                </Text>
                <Text style={styles.modalMeta}>Travel: {travelLabel(selectedEntry) || '—'}</Text>
                <Text style={styles.modalMeta}>
                  Status: {selectedEntry.isOpen ? 'Open shift' : selectedEntry.approved_at ? 'Approved' : 'Completed'}
                </Text>
                <Pressable style={styles.modalCloseBtn} onPress={() => setSelectedEntry(null)}>
                  <Text style={styles.modalCloseText}>Close</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f0eef5' },
  scroll: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0eef5' },
  loadingText: { marginTop: 12, color: '#707173', fontSize: 14 },
  listContent: { padding: 16, paddingBottom: 40 },
  exportRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  exportBtnOuter: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#5b21b6',
  },
  exportBtnPrimary: {
    backgroundColor: '#6b21a8',
  },
  exportBtnSecondary: {
    backgroundColor: '#7c3aed',
  },
  exportBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  exportBtnPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  exportBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#897c98',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
    marginTop: 4,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: '#2d1b3d',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chipOuter: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#d8c8e0',
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOuterActive: {
    backgroundColor: '#4a026f',
    borderColor: '#4a026f',
  },
  chipText: { fontSize: 13, fontWeight: '700', color: '#4a026f' },
  chipTextActive: { fontSize: 13, fontWeight: '700', color: '#fff' },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  statBox: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dcd6e8',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 88,
  },
  searchBarOuter: {
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#dcd6e8',
    backgroundColor: '#ebe4f7',
  },
  searchBarInner: {
    padding: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 2,
  },
  searchFieldInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d8c8e0',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 4,
    minHeight: 46,
  },
  filterIconBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(74, 2, 111, 0.25)',
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: '#f8f4ff',
  },
  filterIconBtnActive: {
    backgroundColor: '#4a026f',
    borderColor: '#4a026f',
  },
  filterDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f59e0b',
    borderWidth: 1,
    borderColor: '#fff',
  },
  filterDrawer: {
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#dcd6e8',
    backgroundColor: '#f3ecfc',
  },
  filterDrawerInner: {
    padding: 16,
    minHeight: 80,
  },
  filterDrawerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#4a026f',
    marginBottom: 12,
  },
  statNum: { fontSize: 22, fontWeight: '800', color: '#4a026f' },
  statOpen: { color: '#b45309' },
  statLbl: { fontSize: 11, color: '#897c98', marginTop: 4, fontWeight: '600' },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4a026f',
    marginBottom: 10,
  },
  tableWrap: {
    borderWidth: 1,
    borderColor: '#dcd6e8',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  tr: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
    borderBottomColor: '#ebe4f0',
  },
  trHeader: {
    borderBottomColor: '#a78bca',
    borderBottomWidth: 2,
    backgroundColor: '#e8ddfa',
  },
  th: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4a026f',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    paddingVertical: 12,
    paddingHorizontal: 8,
    minWidth: 0,
  },
  td: {
    fontSize: 12,
    color: '#333',
    paddingVertical: 10,
    paddingHorizontal: 8,
    minWidth: 0,
  },
  tdZebraA: { backgroundColor: '#faf8fc' },
  tdZebraB: { backgroundColor: '#ffffff' },
  colStaff: { flex: 1.15, minWidth: 0 },
  colProject: { flex: 1.15, minWidth: 0 },
  colTime: { flex: 1, minWidth: 0 },
  colDur: { flex: 0.85, minWidth: 0 },
  colStatus: { flex: 0.75, minWidth: 0 },
  colWide: { flex: 1.25, minWidth: 0 },
  statusCell: { justifyContent: 'center' },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeOpen: { backgroundColor: '#fef3c7' },
  badgeDone: { backgroundColor: '#dcfce7' },
  badgeTxt: { fontSize: 10, fontWeight: '800' },
  badgeTxtOpen: { color: '#b45309' },
  badgeTxtDone: { color: '#166534' },
  empty: {
    padding: 24,
    textAlign: 'center',
    color: '#897c98',
    fontSize: 14,
    width: '100%',
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '80%',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#4a026f', marginBottom: 10 },
  modalMeta: { fontSize: 13, color: '#333', marginBottom: 8 },
  modalCloseBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#4a026f',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalCloseText: { color: '#4a026f', fontWeight: '700' },
});
