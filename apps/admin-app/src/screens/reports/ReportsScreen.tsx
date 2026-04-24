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
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  timesheetsService,
  usersService,
  projectsService,
  companiesService,
  jobCompletionsService,
  incidentsService,
} from '@staff4dshire/shared';
import type {
  TimeEntry,
  User,
  Project,
  Company,
  JobCompletion,
  Incident,
  UserRole,
} from '@staff4dshire/shared';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type DatasetId = 'attendance' | 'users' | 'projects' | 'companies' | 'jobs' | 'incidents';
type Period = 'all' | 'week' | 'month';
type AttStatus = 'all' | 'open' | 'completed';
type JobStatus = 'all' | 'pending' | 'approved';
type IncidentStatus = 'all' | 'open' | 'resolved';

const DATASETS: { id: DatasetId; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'attendance', label: 'Attendance', icon: 'time-outline' },
  { id: 'users', label: 'Users', icon: 'people-outline' },
  { id: 'projects', label: 'Projects', icon: 'business-outline' },
  { id: 'companies', label: 'Companies', icon: 'briefcase-outline' },
  { id: 'jobs', label: 'Job completions', icon: 'checkmark-done-outline' },
  { id: 'incidents', label: 'Incidents', icon: 'warning-outline' },
];

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildCsv(columns: string[], rows: string[][]): string {
  const lines = [columns.map(escapeCsvCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(','));
  }
  return '\uFEFF' + lines.join('\r\n');
}

function buildPdfHtml(title: string, columns: string[], rows: string[][]): string {
  const th =
    'padding:10px 8px;text-align:left;border-bottom:2px solid #c5b0e0;background:#e8ddfa;color:#4a026f;font-size:11px;';
  const headCells = columns.map((c) => `<th style="${th}">${escapeHtml(c)}</th>`).join('');
  const body = rows
    .map((row, i) => {
      const bg = i % 2 === 0 ? '#ffffff' : '#faf8fc';
      const td = `padding:8px;border-bottom:1px solid #e8e8e8;font-size:10px;background:${bg};color:#2d1b3d;`;
      return `<tr>${row.map((cell) => `<td style="${td}">${escapeHtml(cell)}</td>`).join('')}</tr>`;
    })
    .join('');
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#fff;color:#2d1b3d;">
  <h1 style="color:#4a026f;font-size:18px;margin:0 0 8px 0;">${escapeHtml(title)}</h1>
  <p style="color:#707173;font-size:11px;margin:0 0 16px 0;">Generated ${escapeHtml(new Date().toLocaleString())}</p>
  <table style="width:100%;border-collapse:collapse;border:1px solid #e4dce8;"><thead><tr>${headCells}</tr></thead><tbody>${body}</tbody></table>
</body></html>`;
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setDate(x.getDate() - x.getDay());
  x.setHours(0, 0, 0, 0);
  return x;
}

function inPeriod(signInAt: string, period: Period): boolean {
  if (period === 'all') return true;
  const t = new Date(signInAt).getTime();
  const now = Date.now();
  if (period === 'week') return t >= startOfWeek(new Date()).getTime();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  return t >= monthStart.getTime() && t <= now;
}

function formatDuration(signIn: string, signOut?: string): string {
  const start = new Date(signIn).getTime();
  const end = signOut ? new Date(signOut).getTime() : Date.now();
  const ms = Math.max(0, end - start);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (!signOut) return `${h}h ${m}m · on shift`;
  return `${h}h ${m}m`;
}

function matchesSearch(blob: string, raw: string): boolean {
  const q = raw.trim().toLowerCase();
  if (!q) return true;
  const parts = q.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return true;
  return parts.every((p) => blob.includes(p));
}

function StatBox({ children }: { children: React.ReactNode }) {
  return <View style={styles.statBox}>{children}</View>;
}

type RowModel = { id: string; cells: string[]; searchBlob: string };

export function ReportsScreen() {
  const [dataset, setDataset] = useState<DatasetId>('attendance');
  const [searchQuery, setSearchQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [period, setPeriod] = useState<Period>('all');
  const [attStatus, setAttStatus] = useState<AttStatus>('all');
  const [userRole, setUserRole] = useState<'all' | UserRole>('all');
  const [jobStatus, setJobStatus] = useState<JobStatus>('all');
  const [incidentStatus, setIncidentStatus] = useState<IncidentStatus>('all');
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);

  const { data: entries = [], isLoading: loadT } = useQuery({
    queryKey: ['timesheets'],
    queryFn: () => timesheetsService.getAll(),
  });
  const { data: users = [], isLoading: loadU } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersService.getAll(),
  });
  const { data: projects = [], isLoading: loadP } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsService.getAll(),
  });
  const { data: companies = [], isLoading: loadC } = useQuery({
    queryKey: ['companies'],
    queryFn: () => companiesService.getAll(),
  });
  const { data: jobs = [], isLoading: loadJ } = useQuery({
    queryKey: ['job-completions'],
    queryFn: () => jobCompletionsService.getAll(),
  });
  const { data: incidents = [], isLoading: loadI } = useQuery({
    queryKey: ['incidents'],
    queryFn: () => incidentsService.getAll(),
  });

  const loading = loadT || loadU || loadP || loadC || loadJ || loadI;

  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u] as const)), [users]);
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p] as const)), [projects]);
  const companyMap = useMemo(() => new Map(companies.map((c) => [c.id, c] as const)), [companies]);

  const { columns, rows } = useMemo(() => {
    if (dataset === 'attendance') {
      const cols = ['Staff', 'Project', 'Sign in', 'Sign out', 'Duration', 'Status'];
      const list = entries
        .map((e: TimeEntry) => {
          const u = userMap.get(e.user_id);
          const p = projectMap.get(e.project_id);
          const staff = u ? `${u.first_name} ${u.last_name}`.trim() || u.email : e.user_id.slice(0, 8);
          const proj = p?.name ?? e.project_id.slice(0, 8);
          const open = !e.sign_out_at;
          const blob = [staff, proj, u?.email ?? '', 'attendance', 'timesheet'].join(' ').toLowerCase();
          let ok = inPeriod(e.sign_in_at, period);
          if (ok && attStatus === 'open') ok = open;
          if (ok && attStatus === 'completed') ok = !open;
          if (!ok) return null;
          return {
            id: e.id,
            searchBlob: blob,
            cells: [
              staff,
              proj,
              new Date(e.sign_in_at).toLocaleString(),
              e.sign_out_at ? new Date(e.sign_out_at).toLocaleString() : '—',
              formatDuration(e.sign_in_at, e.sign_out_at),
              open ? 'On shift' : 'Completed',
            ],
          };
        })
        .filter((r): r is RowModel => r != null);
      return { columns: cols, rows: list };
    }
    if (dataset === 'users') {
      const cols = ['Name', 'Email', 'Role', 'Company', 'Active'];
      const list = users
        .map((u: User) => {
          if (userRole !== 'all' && u.role !== userRole) return null;
          const co = companyMap.get(u.company_id)?.name ?? u.company_id.slice(0, 8);
          const name = `${u.first_name} ${u.last_name}`.trim();
          const blob = [name, u.email, u.role, co, String(u.is_active)].join(' ').toLowerCase();
          return {
            id: u.id,
            searchBlob: blob,
            cells: [name, u.email, u.role, co, u.is_active ? 'Yes' : 'No'],
          };
        })
        .filter((r): r is RowModel => r != null);
      return { columns: cols, rows: list };
    }
    if (dataset === 'projects') {
      const cols = ['Name', 'Company', 'Address', 'Type', 'Start'];
      const base: RowModel[] = projects.map((p: Project) => {
        const co = companyMap.get(p.company_id)?.name ?? p.company_id;
        const blob = [p.name, co, p.address ?? '', p.project_type ?? '', p.category ?? ''].join(' ').toLowerCase();
        return {
          id: p.id,
          searchBlob: blob,
          cells: [
            p.name,
            co,
            p.address ?? '—',
            p.project_type ?? '—',
            p.start_date ? p.start_date.slice(0, 10) : '—',
          ],
        };
      });
      return { columns: cols, rows: base };
    }
    if (dataset === 'companies') {
      const cols = ['Name', 'Created'];
      const base: RowModel[] = companies.map((c: Company) => ({
        id: c.id,
        searchBlob: `${c.name} company`.toLowerCase(),
        cells: [c.name, new Date(c.created_at).toLocaleDateString()],
      }));
      return { columns: cols, rows: base };
    }
    if (dataset === 'jobs') {
      const cols = ['Staff', 'Project', 'Status', 'Description', 'Created'];
      const list = jobs
        .map((j: JobCompletion) => {
          if (jobStatus !== 'all' && j.status !== jobStatus) return null;
          const u = userMap.get(j.user_id);
          const p = projectMap.get(j.project_id);
          const staff = u ? `${u.first_name} ${u.last_name}`.trim() : j.user_id.slice(0, 8);
          const proj = p?.name ?? j.project_id.slice(0, 8);
          const desc = j.description.length > 80 ? `${j.description.slice(0, 77)}…` : j.description;
          const blob = [staff, proj, j.status, j.description].join(' ').toLowerCase();
          return {
            id: j.id,
            searchBlob: blob,
            cells: [staff, proj, j.status, desc, new Date(j.created_at).toLocaleString()],
          };
        })
        .filter((r): r is RowModel => r != null);
      return { columns: cols, rows: list };
    }
    const cols = ['Staff', 'Project', 'Status', 'Description', 'Created'];
    const base: RowModel[] = incidents
      .map((inc: Incident) => {
        const status = inc.status.toLowerCase();
        if (incidentStatus === 'open' && status === 'resolved') return null;
        if (incidentStatus === 'resolved' && status !== 'resolved') return null;
        const u = userMap.get(inc.user_id);
        const p = inc.project_id ? projectMap.get(inc.project_id) : undefined;
        const staff = u ? `${u.first_name} ${u.last_name}`.trim() : inc.user_id.slice(0, 8);
        const proj = p?.name ?? (inc.project_id ? inc.project_id.slice(0, 8) : '—');
        const desc = inc.description.length > 80 ? `${inc.description.slice(0, 77)}…` : inc.description;
        const blob = [staff, proj, inc.status, inc.description].join(' ').toLowerCase();
        return {
          id: inc.id,
          searchBlob: blob,
          cells: [staff, proj, inc.status, desc, new Date(inc.created_at).toLocaleString()],
        };
      })
      .filter((r): r is RowModel => r != null);
    return { columns: cols, rows: base };
  }, [
    dataset,
    entries,
    users,
    projects,
    companies,
    jobs,
    incidents,
    userMap,
    projectMap,
    companyMap,
    period,
    attStatus,
    userRole,
    jobStatus,
    incidentStatus,
  ]);

  const filteredRows = useMemo(
    () => rows.filter((r) => matchesSearch(r.searchBlob, searchQuery)),
    [rows, searchQuery]
  );

  const stats = useMemo(() => {
    const total = filteredRows.length;
    const subset = dataset === 'attendance' ? filteredRows.filter((r) => r.cells[5] === 'On shift').length : 0;
    return { total, subset };
  }, [filteredRows, dataset]);

  const filtersActive =
    period !== 'all' ||
    attStatus !== 'all' ||
    userRole !== 'all' ||
    jobStatus !== 'all' ||
    incidentStatus !== 'all';

  const toggleFilters = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFiltersOpen((o) => !o);
  }, []);

  const exportCsv = useCallback(async () => {
    if (filteredRows.length === 0) {
      Alert.alert('Nothing to export', 'No rows match the current filters.');
      return;
    }
    const label = DATASETS.find((d) => d.id === dataset)?.label ?? 'report';
    const csv = buildCsv(
      columns,
      filteredRows.map((r) => r.cells)
    );
    const name = `report_${label.replace(/\s+/g, '_')}_${Date.now()}.csv`;
    setExporting('csv');
    try {
      if (Platform.OS === 'web' && typeof globalThis.document !== 'undefined') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = globalThis.document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
        Alert.alert('Download started', 'CSV file will open in Excel.');
        return;
      }
      const base = FileSystem.cacheDirectory;
      if (!base) {
        Alert.alert('Export unavailable', 'File storage is not available.');
        return;
      }
      const uri = base + name;
      await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Export report' });
      } else {
        Alert.alert('Saved', uri);
      }
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setExporting(null);
    }
  }, [filteredRows, columns, dataset]);

  const exportPdf = useCallback(async () => {
    if (filteredRows.length === 0) {
      Alert.alert('Nothing to export', 'No rows match the current filters.');
      return;
    }
    const title = `Report — ${DATASETS.find((d) => d.id === dataset)?.label ?? 'Export'}`;
    const html = buildPdfHtml(
      title,
      columns,
      filteredRows.map((r) => r.cells)
    );
    setExporting('pdf');
    try {
      if (Platform.OS === 'web' && typeof globalThis.window !== 'undefined') {
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const w = globalThis.window.open(url, '_blank', 'noopener,noreferrer');
        if (w) {
          w.focus();
          setTimeout(() => URL.revokeObjectURL(url), 120000);
          Alert.alert('Print to PDF', 'Use your browser Print → Save as PDF.');
        } else {
          URL.revokeObjectURL(url);
          Alert.alert('Pop-up blocked', 'Allow pop-ups to print.');
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
        Alert.alert('PDF', 'Could not create PDF.');
        return;
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Export report' });
      } else {
        Alert.alert('Saved', uri);
      }
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setExporting(null);
    }
  }, [filteredRows, columns, dataset]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4a026f" />
        <Text style={styles.loadingText}>Loading data…</Text>
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
        <Text style={styles.screenTitle}>Generate reports</Text>
        <Text style={styles.screenSub}>Choose a dataset, filter, then export to CSV or PDF.</Text>

        <View style={styles.datasetRow}>
          {DATASETS.map((d) => {
            const active = dataset === d.id;
            return (
              <Pressable
                key={d.id}
                style={[styles.datasetChip, active && styles.datasetChipActive]}
                onPress={() => setDataset(d.id)}
              >
                <View style={styles.datasetChipInner}>
                  <Ionicons name={d.icon} size={16} color={active ? '#fff' : '#4a026f'} />
                  <Text style={[styles.datasetChipText, active && styles.datasetChipTextActive]}>{d.label}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

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
                  placeholder="Search this report…"
                  placeholderTextColor="#8b7c99"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 ? (
                  <Pressable onPress={() => setSearchQuery('')} hitSlop={10}>
                    <Ionicons name="close-circle" size={22} color="#897c98" />
                  </Pressable>
                ) : null}
              </View>
              <Pressable
                style={[styles.filterIconBtn, filtersOpen && styles.filterIconBtnActive]}
                onPress={toggleFilters}
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
              <Text style={styles.filterDrawerTitle}>Refine</Text>
              {dataset === 'attendance' ? (
                <>
                  <Text style={styles.filterLabel}>Period</Text>
                  <View style={styles.chips}>
                    {(['all', 'week', 'month'] as const).map((p) => {
                      const active = period === p;
                      const label = p === 'all' ? 'All' : p === 'week' ? 'This week' : 'This month';
                      return (
                        <Pressable
                          key={p}
                          onPress={() => setPeriod(p)}
                          style={[styles.chipOuter, active && styles.chipOuterActive]}
                        >
                          <Text style={active ? styles.chipTextActive : styles.chipText}>{label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={styles.filterLabel}>Shift status</Text>
                  <View style={styles.chips}>
                    {(
                      [
                        ['all', 'All'],
                        ['open', 'On shift'],
                        ['completed', 'Completed'],
                      ] as const
                    ).map(([k, label]) => {
                      const active = attStatus === k;
                      return (
                        <Pressable
                          key={k}
                          onPress={() => setAttStatus(k)}
                          style={[styles.chipOuter, active && styles.chipOuterActive]}
                        >
                          <Text style={active ? styles.chipTextActive : styles.chipText}>{label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}
              {dataset === 'users' ? (
                <>
                  <Text style={styles.filterLabel}>Role</Text>
                  <View style={styles.chips}>
                    {(['all', 'staff', 'supervisor', 'admin', 'superadmin'] as const).map((r) => {
                      const active = userRole === r;
                      const label = r === 'all' ? 'All roles' : r;
                      return (
                        <Pressable
                          key={r}
                          onPress={() => setUserRole(r)}
                          style={[styles.chipOuter, active && styles.chipOuterActive]}
                        >
                          <Text style={active ? styles.chipTextActive : styles.chipText}>{label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}
              {dataset === 'jobs' ? (
                <>
                  <Text style={styles.filterLabel}>Approval</Text>
                  <View style={styles.chips}>
                    {(
                      [
                        ['all', 'All'],
                        ['pending', 'Pending'],
                        ['approved', 'Approved'],
                      ] as const
                    ).map(([k, label]) => {
                      const active = jobStatus === k;
                      return (
                        <Pressable
                          key={k}
                          onPress={() => setJobStatus(k)}
                          style={[styles.chipOuter, active && styles.chipOuterActive]}
                        >
                          <Text style={active ? styles.chipTextActive : styles.chipText}>{label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}
              {dataset === 'incidents' ? (
                <>
                  <Text style={styles.filterLabel}>Incident status</Text>
                  <View style={styles.chips}>
                    {(
                      [
                        ['all', 'All'],
                        ['open', 'Open only'],
                        ['resolved', 'Resolved only'],
                      ] as const
                    ).map(([k, label]) => {
                      const active = incidentStatus === k;
                      return (
                        <Pressable
                          key={k}
                          onPress={() => setIncidentStatus(k)}
                          style={[styles.chipOuter, active && styles.chipOuterActive]}
                        >
                          <Text style={active ? styles.chipTextActive : styles.chipText}>{label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}
              {dataset !== 'attendance' &&
              dataset !== 'users' &&
              dataset !== 'jobs' &&
              dataset !== 'incidents' ? (
                <Text style={styles.filterHint}>Use search to narrow this list.</Text>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.statsRow}>
          <StatBox>
            <Text style={styles.statNum}>{stats.total}</Text>
            <Text style={styles.statLbl}>Rows</Text>
          </StatBox>
          {dataset === 'attendance' ? (
            <StatBox>
              <Text style={[styles.statNum, styles.statOpen]}>{stats.subset}</Text>
              <Text style={styles.statLbl}>On shift</Text>
            </StatBox>
          ) : (
            <StatBox>
              <Text style={styles.statNum}>{columns.length}</Text>
              <Text style={styles.statLbl}>Columns</Text>
            </StatBox>
          )}
          <StatBox>
            <Text style={styles.statDatasetName} numberOfLines={2}>
              {DATASETS.find((x) => x.id === dataset)?.label ?? '—'}
            </Text>
            <Text style={styles.statLbl}>Dataset</Text>
          </StatBox>
        </View>

        <Text style={styles.sectionHeading}>Preview</Text>

        <View style={styles.tableWrap}>
          <View style={[styles.tr, styles.trHeader]}>
            {columns.map((c) => (
              <Text key={c} style={[styles.th, { flex: columnFlex(c) }]} numberOfLines={2}>
                {c}
              </Text>
            ))}
          </View>
          {filteredRows.length === 0 ? (
            <Text style={styles.empty}>No rows match.</Text>
          ) : (
            filteredRows.map((r, index) => (
              <View
                key={r.id}
                style={[styles.tr, index % 2 === 0 ? styles.tdZebraA : styles.tdZebraB]}
              >
                {r.cells.map((cell, i) => (
                  <Text
                    key={`${r.id}-${i}`}
                    style={[styles.td, { flex: columnFlex(columns[i]) }]}
                    numberOfLines={dataset === 'jobs' || dataset === 'incidents' ? 3 : 2}
                  >
                    {cell}
                  </Text>
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/** Relative flex weights so the table fits the screen width without horizontal scroll. */
function columnFlex(col: string): number {
  if (col === 'Description') return 2;
  if (col === 'Address') return 1.5;
  if (col === 'Email' || col === 'Company') return 1.2;
  if (col === 'Name' || col === 'Staff' || col === 'Project') return 1.1;
  return 1;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f0eef5' },
  scroll: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0eef5' },
  loadingText: { marginTop: 12, color: '#707173', fontSize: 14 },
  listContent: { padding: 16, paddingBottom: 40 },
  screenTitle: { fontSize: 20, fontWeight: '800', color: '#4a026f', marginBottom: 4 },
  screenSub: { fontSize: 14, color: '#5c4a6e', marginBottom: 14 },
  datasetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  datasetChip: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(74,2,111,0.2)',
    backgroundColor: '#fff',
  },
  datasetChipActive: { backgroundColor: '#4a026f', borderColor: '#4a026f' },
  datasetChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  datasetChipText: { fontSize: 13, fontWeight: '700', color: '#4a026f' },
  datasetChipTextActive: { color: '#fff' },
  exportRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  exportBtnOuter: {
    flex: 1,
    borderRadius: 14,
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#5b21b6',
  },
  exportBtnPrimary: { backgroundColor: '#6b21a8' },
  exportBtnSecondary: { backgroundColor: '#7c3aed' },
  exportBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exportBtnPressed: { opacity: 0.9 },
  exportBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  searchBarOuter: {
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#dcd6e8',
    backgroundColor: '#ebe4f7',
  },
  searchBarInner: { padding: 10 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchFieldInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d8c8e0',
    paddingHorizontal: 12,
    minHeight: 46,
    paddingVertical: Platform.OS === 'ios' ? 10 : 4,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: '#2d1b3d',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  },
  filterIconBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(74,2,111,0.25)',
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
  filterDrawerInner: { padding: 16 },
  filterDrawerTitle: { fontSize: 15, fontWeight: '800', color: '#4a026f', marginBottom: 10 },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#897c98',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  filterHint: { fontSize: 13, color: '#6b5a7a', lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chipOuter: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d8c8e0',
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 80,
    alignItems: 'center',
  },
  chipOuterActive: {
    backgroundColor: '#4a026f',
    borderColor: '#4a026f',
  },
  chipText: { fontSize: 13, fontWeight: '700', color: '#4a026f' },
  chipTextActive: { fontSize: 13, fontWeight: '700', color: '#fff' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statBox: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dcd6e8',
    backgroundColor: '#fff',
    paddingVertical: 14,
    minHeight: 86,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNum: { fontSize: 22, fontWeight: '800', color: '#4a026f' },
  statDatasetName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4a026f',
    textAlign: 'center',
    lineHeight: 17,
  },
  statOpen: { color: '#b45309' },
  statLbl: { fontSize: 11, color: '#897c98', marginTop: 4, fontWeight: '600' },
  sectionHeading: { fontSize: 14, fontWeight: '800', color: '#4a026f', marginBottom: 10 },
  tableWrap: {
    borderWidth: 1,
    borderColor: '#dcd6e8',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  tr: { flexDirection: 'row', alignItems: 'stretch', borderBottomWidth: 1, borderBottomColor: '#ebe4f0' },
  trHeader: {
    borderBottomColor: '#a78bca',
    borderBottomWidth: 2,
    backgroundColor: '#e8ddfa',
  },
  th: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4a026f',
    textTransform: 'uppercase',
    paddingVertical: 12,
    paddingHorizontal: 6,
    minWidth: 0,
  },
  td: { fontSize: 11, color: '#333', paddingVertical: 10, paddingHorizontal: 6, minWidth: 0 },
  tdZebraA: { backgroundColor: '#faf8fc' },
  tdZebraB: { backgroundColor: '#ffffff' },
  empty: { padding: 24, textAlign: 'center', color: '#897c98', width: '100%' },
});
