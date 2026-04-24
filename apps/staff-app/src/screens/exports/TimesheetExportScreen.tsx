import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Platform, Pressable, ActivityIndicator, TextInput } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthContext } from '@staff4dshire/shared';
import { timesheetsService, usersService, projectsService } from '@staff4dshire/shared';
import type { TimeEntry, User, Project } from '@staff4dshire/shared';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';

type RangePreset = 'all' | 'week' | 'month' | 'custom';

function parseIsoDateInput(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = new Date(`${trimmed}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function isInRange(signInAt: string, preset: RangePreset, customStart: string, customEnd: string): boolean {
  const t = new Date(signInAt).getTime();
  if (Number.isNaN(t)) return false;
  if (preset === 'all') return true;

  const now = new Date();
  if (preset === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    return t >= start.getTime() && t <= now.getTime();
  }
  if (preset === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    return t >= start.getTime() && t <= now.getTime();
  }

  const start = parseIsoDateInput(customStart);
  const end = parseIsoDateInput(customEnd);
  if (!start || !end) return false;
  const endInclusive = new Date(end);
  endInclusive.setHours(23, 59, 59, 999);
  return t >= start.getTime() && t <= endInclusive.getTime();
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

type EnrichedExportRow = {
  entry: TimeEntry;
  staffLabel: string;
  projectLabel: string;
  approvedByLabel: string;
};

function buildCsvRows(rows: EnrichedExportRow[]): string {
  const header = ['Staff', 'Project', 'Sign in (local)', 'Sign out (local)', 'Duration', 'Status', 'Approved by', 'Approved at'];
  const lines = [header.map(escapeCsvCell).join(',')];
  for (const row of rows) {
    const e = row.entry;
    const start = new Date(e.sign_in_at).getTime();
    const end = e.sign_out_at ? new Date(e.sign_out_at).getTime() : Date.now();
    const ms = Math.max(0, end - start);
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const duration = `${h}h ${m}m`;
    lines.push(
      [
        escapeCsvCell(row.staffLabel),
        escapeCsvCell(row.projectLabel),
        escapeCsvCell(new Date(e.sign_in_at).toLocaleString()),
        escapeCsvCell(e.sign_out_at ? new Date(e.sign_out_at).toLocaleString() : ''),
        escapeCsvCell(duration),
        escapeCsvCell(e.sign_out_at ? 'Completed' : 'Open'),
        escapeCsvCell(row.approvedByLabel),
        escapeCsvCell(e.approved_at ? new Date(e.approved_at).toLocaleString() : ''),
      ].join(',')
    );
  }
  return '\uFEFF' + lines.join('\r\n');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildPdfHtml(rows: EnrichedExportRow[]): string {
  const rowsHtml = rows
    .map((row) => {
      const e = row.entry;
      const start = new Date(e.sign_in_at).getTime();
      const end = e.sign_out_at ? new Date(e.sign_out_at).getTime() : Date.now();
      const ms = Math.max(0, end - start);
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const duration = `${h}h ${m}m`;
      return `<tr>
        <td>${escapeHtml(row.staffLabel)}</td>
        <td>${escapeHtml(row.projectLabel)}</td>
        <td>${escapeHtml(new Date(e.sign_in_at).toLocaleString())}</td>
        <td>${escapeHtml(e.sign_out_at ? new Date(e.sign_out_at).toLocaleString() : '—')}</td>
        <td>${escapeHtml(duration)}</td>
        <td>${e.sign_out_at ? 'Completed' : 'Open'}</td>
        <td>${escapeHtml(row.approvedByLabel)}</td>
        <td>${escapeHtml(e.approved_at ? new Date(e.approved_at).toLocaleString() : '—')}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; color: #1f2937; }
      h1 { color: #4a026f; margin: 0 0 8px 0; }
      p { color: #6b7280; margin: 0 0 16px 0; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; text-align: left; }
      th { background: #ede9fe; color: #4a026f; font-weight: 700; }
    </style>
  </head>
  <body>
    <h1>Timesheet Export</h1>
    <p>Generated ${escapeHtml(new Date().toLocaleString())}</p>
    <table>
      <thead>
        <tr>
          <th>Staff</th>
          <th>Project</th>
          <th>Sign in</th>
          <th>Sign out</th>
          <th>Duration</th>
          <th>Status</th>
          <th>Approved by</th>
          <th>Approved at</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </body>
</html>`;
}

export function TimesheetExportScreen() {
  const { user } = useAuthContext();
  const isSupervisor = user?.role === 'supervisor';
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);
  const [rangePreset, setRangePreset] = useState<RangePreset>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const { data: entries = [], isLoading: loadingEntries } = useQuery({
    queryKey: ['timesheets', 'export', user?.id, isSupervisor ? 'supervisor' : 'self'],
    queryFn: () => (isSupervisor ? timesheetsService.getAll() : timesheetsService.getByUserId(user!.id)),
    enabled: !!user?.id,
  });
  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersService.getAll(),
    enabled: !!user?.id,
  });
  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsService.getAll(),
    enabled: !!user?.id,
  });

  const userMap = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach((u) => map.set(u.id, u));
    return map;
  }, [users]);
  const projectMap = useMemo(() => {
    const map = new Map<string, Project>();
    projects.forEach((p) => map.set(p.id, p));
    return map;
  }, [projects]);

  const scopedEntries = useMemo(() => {
    if (!isSupervisor || !user?.id) return entries;
    const supervisedProjects = new Set(
      projects.filter((p) => p.supervisor_id === user.id).map((p) => p.id)
    );
    return entries.filter((e) => supervisedProjects.has(e.project_id));
  }, [entries, isSupervisor, projects, user?.id]);

  const sortedEntries = useMemo(
    () => [...scopedEntries].sort((a, b) => new Date(b.sign_in_at).getTime() - new Date(a.sign_in_at).getTime()),
    [scopedEntries]
  );

  const customRangeValid = useMemo(() => {
    if (rangePreset !== 'custom') return true;
    const start = parseIsoDateInput(customStart);
    const end = parseIsoDateInput(customEnd);
    return !!start && !!end && start.getTime() <= end.getTime();
  }, [rangePreset, customStart, customEnd]);

  const filteredEntries = useMemo(
    () => sortedEntries.filter((entry) => isInRange(entry.sign_in_at, rangePreset, customStart, customEnd)),
    [sortedEntries, rangePreset, customStart, customEnd]
  );
  const enrichedEntries = useMemo<EnrichedExportRow[]>(
    () =>
      filteredEntries.map((entry) => {
        const u = userMap.get(entry.user_id);
        const p = projectMap.get(entry.project_id);
        const staffLabel = u ? `${u.first_name} ${u.last_name}`.trim() || u.email : entry.user_id;
        return {
          entry,
          staffLabel,
          projectLabel: p?.name ?? entry.project_id,
          approvedByLabel: entry.approved_by_user_id
            ? `${userMap.get(entry.approved_by_user_id)?.first_name ?? ''} ${userMap.get(entry.approved_by_user_id)?.last_name ?? ''}`.trim() ||
              userMap.get(entry.approved_by_user_id)?.email ||
              entry.approved_by_user_id
            : '—',
        };
      }),
    [filteredEntries, userMap, projectMap]
  );

  const exportCsv = useCallback(async () => {
    if (!customRangeValid) {
      Alert.alert('Invalid custom range', 'Use valid dates in YYYY-MM-DD format and ensure start date is before end date.');
      return;
    }
    if (enrichedEntries.length === 0) {
      Alert.alert('Nothing to export', 'No time entries available.');
      return;
    }
    setExporting('csv');
    try {
      const csv = buildCsvRows(enrichedEntries);
      const name = `timesheets_${Date.now()}.csv`;
      if (Platform.OS === 'web' && typeof globalThis.document !== 'undefined') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = globalThis.document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
        Alert.alert('Download started', 'CSV export has been downloaded.');
        return;
      }

      const base = FileSystem.cacheDirectory;
      if (!base) {
        Alert.alert('Export unavailable', 'File storage is not available in this environment.');
        return;
      }
      const uri = base + name;
      await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export timesheets (CSV)',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('Saved', `File written to cache:\n${uri}`);
      }
    } catch (error) {
      Alert.alert('Export failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setExporting(null);
    }
  }, [enrichedEntries, customRangeValid]);

  const exportPdf = useCallback(async () => {
    if (!customRangeValid) {
      Alert.alert('Invalid custom range', 'Use valid dates in YYYY-MM-DD format and ensure start date is before end date.');
      return;
    }
    if (enrichedEntries.length === 0) {
      Alert.alert('Nothing to export', 'No time entries available.');
      return;
    }
    setExporting('pdf');
    try {
      const html = buildPdfHtml(enrichedEntries);
      if (Platform.OS === 'web' && typeof globalThis.window !== 'undefined') {
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const popup = globalThis.window.open(url, '_blank', 'noopener,noreferrer');
        if (popup) {
          popup.focus();
          setTimeout(() => URL.revokeObjectURL(url), 120000);
          Alert.alert('Print to PDF', 'In the opened tab, use Print and select Save as PDF.');
        } else {
          URL.revokeObjectURL(url);
          Alert.alert('Pop-up blocked', 'Allow pop-ups to export PDF.');
        }
        return;
      }

      const result = await Print.printToFileAsync({
        html,
        width: 612,
        height: 792,
        margins: { left: 24, right: 24, top: 24, bottom: 24 },
      });
      if (!result?.uri) {
        Alert.alert('Export failed', 'Could not create PDF file.');
        return;
      }
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(result.uri, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
          dialogTitle: 'Export timesheets (PDF)',
        });
      } else {
        Alert.alert('Saved', result.uri);
      }
    } catch (error) {
      Alert.alert('Export failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setExporting(null);
    }
  }, [enrichedEntries, customRangeValid]);

  const isLoading = loadingEntries || loadingUsers || loadingProjects;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Timesheet export</Text>
      <Text style={styles.lead}>Export your timesheet entries to CSV (Excel-compatible) or PDF.</Text>
      {isLoading ? <Text style={styles.meta}>Loading entries...</Text> : <Text style={styles.meta}>Loaded entries: {filteredEntries.length} / {sortedEntries.length}</Text>}

      <Text style={styles.label}>Date range</Text>
      <View style={styles.chips}>
        {(
          [
            { key: 'all' as const, label: 'All' },
            { key: 'week' as const, label: 'This week' },
            { key: 'month' as const, label: 'This month' },
            { key: 'custom' as const, label: 'Custom' },
          ] as const
        ).map((item) => (
          <Pressable
            key={item.key}
            style={({ pressed }) => [
              styles.chip,
              rangePreset === item.key && styles.chipActive,
              pressed && { opacity: 0.9 },
            ]}
            onPress={() => setRangePreset(item.key)}
          >
            <Text style={rangePreset === item.key ? styles.chipTextActive : styles.chipText}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      {rangePreset === 'custom' ? (
        <View style={styles.customRangeBox}>
          <TextInput
            value={customStart}
            onChangeText={setCustomStart}
            placeholder="Start date (YYYY-MM-DD)"
            placeholderTextColor="#8a8a8a"
            autoCapitalize="none"
            style={styles.input}
          />
          <TextInput
            value={customEnd}
            onChangeText={setCustomEnd}
            placeholder="End date (YYYY-MM-DD)"
            placeholderTextColor="#8a8a8a"
            autoCapitalize="none"
            style={styles.input}
          />
          {!customRangeValid ? <Text style={styles.error}>Enter valid dates and ensure start is not after end.</Text> : null}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, pressed && styles.actionPressed]}
          onPress={exportCsv}
          disabled={exporting !== null}
        >
          {exporting === 'csv' ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>Export CSV</Text>}
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, styles.actionBtnSecondary, pressed && styles.actionPressed]}
          onPress={exportPdf}
          disabled={exporting !== null}
        >
          {exporting === 'pdf' ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>Export PDF</Text>}
        </Pressable>
      </View>

      <Text style={styles.note}>Tip: CSV opens directly in Excel. PDF is suitable for sharing and approvals.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#4a026f', marginBottom: 8 },
  lead: { fontSize: 14, color: '#707173', lineHeight: 20, marginBottom: 12 },
  meta: { fontSize: 14, color: '#333', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '700', color: '#6b4d7c', marginBottom: 8, textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d3c8e2',
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  chipActive: { backgroundColor: '#4a026f', borderColor: '#4a026f' },
  chipText: { color: '#4a026f', fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: '#fff', fontWeight: '700', fontSize: 13 },
  customRangeBox: { marginBottom: 12, gap: 8 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 9,
    fontSize: 14,
    color: '#2f2f2f',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  },
  error: { color: '#b91c1c', fontSize: 12 },
  actions: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  actionBtn: {
    flex: 1,
    backgroundColor: '#4a026f',
    borderRadius: 10,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  actionBtnSecondary: { backgroundColor: '#6d28d9' },
  actionPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  actionText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  note: { fontSize: 13, color: '#707173', lineHeight: 18 },
});
