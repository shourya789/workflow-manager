
import React, { useState, useEffect, useMemo } from 'react';
import {
  TrashIcon,
  DownloadIcon,
  RefreshCcwIcon,
  SparklesIcon,
  ClockIcon,
  CoffeeIcon,
  LogOutIcon,
  PhoneIncomingIcon,
  PhoneOutgoingIcon,
  UserCheckIcon,
  KeyIcon,
  UserIcon,
  IdCardIcon,
  ArrowRightIcon,
  MoonIcon,
  SunIcon,
  ShieldCheckIcon,
  SearchIcon,
  ChevronRightIcon,
  UsersIcon,
  LayersIcon,
  TrophyIcon,
  ZapIcon,
  CheckCircleIcon,
  XCircleIcon,
  TimerIcon,
  ActivityIcon,
  CircleMinusIcon,
  EditIcon,
  XIcon,
  ShieldAlertIcon,
  LogInIcon,
  ShieldIcon,
  LayoutGridIcon,
  FileSpreadsheetIcon,
  AlertCircleIcon,
  ArrowLeftIcon
} from 'lucide-react';
import { TimeData, User, ShiftType, EntryStatus } from './types';
import { timeToSeconds, secondsToTime, autoCorrectTime } from './utils';
import { parseRawTimeData } from './services/geminiService';
import { exportToExcel, exportConsolidatedExcel, exportDailyPerformanceReport } from './services/excelService';

const MILESTONES = [1800, 2100, 2500];

const INITIAL_FORM_STATE = {
  pause: '00:00:00',
  dispo: '00:00:00',
  dead: '00:00:00',
  currentLogin: '00:00:00',
  loginTimestamp: '00:00:00',
  logoutTimestamp: '00:00:00',
  wait: '00:00:00',
  talk: '00:00:00',
  hold: '00:00:00',
  customerTalk: '00:00:00',
  inbound: 0,
  outbound: 0,
  reason: ''
};

function StatusBadge({ status }: { status: EntryStatus }) {
  const styles = {
    'Approved': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    'Pending': 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse',
    'Rejected': 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    'N/A': 'bg-slate-500/10 text-slate-500 border-slate-500/20'
  };

  const icon = status === 'Approved' ? <CheckCircleIcon size={10} /> :
    status === 'Pending' ? <TimerIcon size={10} /> :
      status === 'Rejected' ? <XCircleIcon size={10} /> :
        <CircleMinusIcon size={10} />;

  return (
    <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase flex items-center gap-1 border ${styles[status]}`}>
      {icon} {status}
    </div>
  );
}

type KpiRow = {
  id: string;
  name: string;
  empId: string;
  date?: string;
  shiftType?: ShiftType;
  inbound?: number;
  outbound?: number;
  loginSec?: number;
  breakSec?: number;
  count?: number;
};

type MasterFiltersDraft = {
  searchQuery: string;
  agentFilter: string;
  dateStart: string;
  dateEnd: string;
  statusFilter: 'All' | EntryStatus;
  shiftFilter: 'All' | ShiftType;
  breakViolationFilter: 'All' | 'Yes' | 'No';
  overtimeFilter: 'All' | 'Yes' | 'No';
  underShiftFilter: 'All' | 'Full Day' | 'Half Day';
  sortBy: 'productivity' | 'break' | 'ot' | 'talk' | 'inbound' | 'outbound';
};

type OtRecordFilters = {
  searchQuery: string;
  dateStart: string;
  dateEnd: string;
  shiftFilter: 'All' | ShiftType;
  statusFilter: 'All' | 'Approved' | 'Rejected';
};

const createDefaultMasterFilters = (): MasterFiltersDraft => ({
  searchQuery: '',
  agentFilter: '',
  dateStart: '',
  dateEnd: '',
  statusFilter: 'All',
  shiftFilter: 'All',
  breakViolationFilter: 'All',
  overtimeFilter: 'All',
  underShiftFilter: 'All',
  sortBy: 'productivity'
});

const createDefaultOtRecordFilters = (): OtRecordFilters => ({
  searchQuery: '',
  dateStart: '',
  dateEnd: '',
  shiftFilter: 'All',
  statusFilter: 'All'
});

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [authRole, setAuthRole] = useState<'user' | 'admin'>('user');
  const [authError, setAuthError] = useState('');
  const [entries, setEntries] = useState<TimeData[]>([]);
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [isParsing, setIsParsing] = useState(false);
  const [rawText, setRawText] = useState('');
  const [parseFailures, setParseFailures] = useState(0);
  const [parsedSignature, setParsedSignature] = useState<string | null>(null);
  const [lastCommittedSignature, setLastCommittedSignature] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'calc' | 'details' | 'admin-dashboard' | 'admin' | 'all-logs' | 'ot-log' | 'ot-admin' | 'users' | 'migrations'>('calc');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [shiftType, setShiftType] = useState<ShiftType>('Full Day');
  const [emergencyOt, setEmergencyOt] = useState(false);
  const [showOTModal, setShowOTModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [adminViewingUserId, setAdminViewingUserId] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [detailsSearchQuery, setDetailsSearchQuery] = useState('');
  const [masterSearchQuery, setMasterSearchQuery] = useState('');
  const [masterStatusFilter, setMasterStatusFilter] = useState<'All' | EntryStatus>('All');
  const [masterShiftFilter, setMasterShiftFilter] = useState<'All' | ShiftType>('All');
  const [masterDateStart, setMasterDateStart] = useState('');
  const [masterDateEnd, setMasterDateEnd] = useState('');
  const [masterAgentFilter, setMasterAgentFilter] = useState('');
  const [masterBreakViolationFilter, setMasterBreakViolationFilter] = useState<'All' | 'Yes' | 'No'>('All');
  const [masterOvertimeFilter, setMasterOvertimeFilter] = useState<'All' | 'Yes' | 'No'>('All');
  const [masterUnderShiftFilter, setMasterUnderShiftFilter] = useState<'All' | 'Full Day' | 'Half Day'>('All');
  const [masterSortBy, setMasterSortBy] = useState<'productivity' | 'break' | 'ot' | 'talk' | 'inbound' | 'outbound'>('productivity');
  const [masterFocusMode, setMasterFocusMode] = useState<'all' | 'needs' | 'top' | 'pendingOt'>('all');
  const [overviewRange, setOverviewRange] = useState<'today' | 'weekly' | 'monthly' | 'yearly' | 'custom'>('today');
  const [overviewCustomStart, setOverviewCustomStart] = useState('');
  const [overviewCustomEnd, setOverviewCustomEnd] = useState('');
  const [userKpiRange, setUserKpiRange] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('weekly');
  const [showPasswords, setShowPasswords] = useState(false);
  const [masterDataServer, setMasterDataServer] = useState<TimeData[]>([]);
  const [migrations, setMigrations] = useState<any[]>([]);
  const [expandedMigrationId, setExpandedMigrationId] = useState<string | null>(null);
  const [otAdminSearchQuery, setOtAdminSearchQuery] = useState('');
  const [otApprovalSearchQuery, setOtApprovalSearchQuery] = useState('');
  const [otApprovalDateStart, setOtApprovalDateStart] = useState('');
  const [otApprovalDateEnd, setOtApprovalDateEnd] = useState('');
  const [otApprovalShiftFilter, setOtApprovalShiftFilter] = useState<'All' | ShiftType>('All');
  const [otApprovalStatusFilter, setOtApprovalStatusFilter] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('All');
  const [otRecordFiltersDraft, setOtRecordFiltersDraft] = useState<OtRecordFilters>(() => createDefaultOtRecordFilters());
  const [otRecordSearchQuery, setOtRecordSearchQuery] = useState('');
  const [otRecordDateStart, setOtRecordDateStart] = useState('');
  const [otRecordDateEnd, setOtRecordDateEnd] = useState('');
  const [otRecordShiftFilter, setOtRecordShiftFilter] = useState<'All' | ShiftType>('All');
  const [otRecordStatusFilter, setOtRecordStatusFilter] = useState<'All' | 'Approved' | 'Rejected'>('All');
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionedEntry, setActionedEntry] = useState<TimeData | null>(null);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalReason, setApprovalReason] = useState('');
  const [drillUserId, setDrillUserId] = useState<string | null>(null);
  const [kpiModalOpen, setKpiModalOpen] = useState(false);
  const [kpiModalTitle, setKpiModalTitle] = useState('');
  const [kpiModalRows, setKpiModalRows] = useState<KpiRow[]>([]);
  const [masterFiltersDraft, setMasterFiltersDraft] = useState<MasterFiltersDraft>(() => createDefaultMasterFilters());
  const [masterFiltersApplied, setMasterFiltersApplied] = useState(true);
  const [showMasterAdvancedFilters, setShowMasterAdvancedFilters] = useState(false);

  // Pagination state for admin tables
  const [masterCurrentPage, setMasterCurrentPage] = useState(1);
  const [masterPageSize] = useState(50); // Fixed page size
  const [detailsCurrentPage, setDetailsCurrentPage] = useState(1);
  const [detailsPageSize] = useState(50);

  // Advanced Search State
  const [detailsDateStart, setDetailsDateStart] = useState('');
  const [detailsDateEnd, setDetailsDateEnd] = useState('');
  const [detailsStatusFilter, setDetailsStatusFilter] = useState<'All' | EntryStatus>('All');
  const [detailsShiftFilter, setDetailsShiftFilter] = useState<'All' | ShiftType>('All');

  // Reset Data State
  const [showResetConfirm1, setShowResetConfirm1] = useState(false);
  const [showResetConfirm2, setShowResetConfirm2] = useState(false);

  const lastMasterCountRef = React.useRef(0);

  // Throttle state for fetchMasterData (prevents excessive API calls)
  const lastFetchRef = React.useRef<number>(0);
  const pendingFetchRef = React.useRef<NodeJS.Timeout | null>(null);

  const fetchMasterData = async (force = false) => {
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchRef.current;
    
    // Throttle: max 1 call per 3 seconds (unless forced)
    if (!force && timeSinceLastFetch < 3000) {
      // Schedule a delayed fetch if one isn't already scheduled
      if (!pendingFetchRef.current) {
        pendingFetchRef.current = setTimeout(() => {
          pendingFetchRef.current = null;
          fetchMasterData(true);
        }, 3000 - timeSinceLastFetch);
      }
      return;
    }
    
    lastFetchRef.current = now;
    if (pendingFetchRef.current) {
      clearTimeout(pendingFetchRef.current);
      pendingFetchRef.current = null;
    }
    
    try {
      const r = await fetch('/api/storage?action=getAllEntries');
      const d = await r.json();
      const nextCount = (d.entries || []).length;
      if (user?.role === 'admin' && lastMasterCountRef.current > 0 && nextCount > lastMasterCountRef.current) {
        pushToast(`${nextCount - lastMasterCountRef.current} new entries synced`, 'info');
      }
      lastMasterCountRef.current = nextCount;
      setMasterDataServer(d.entries || []);
    } catch (e) {
      console.error('Failed to fetch master data', e);
    }
  };

  const fetchMigrations = async () => {
    try {
      const r = await fetch('/api/storage?action=getMigrations');
      const d = await r.json();
      setMigrations(d.migrations || []);
    } catch (e) {
      console.error('Failed to fetch migrations', e);
    }
  };

  const downloadMigrationMapping = async (mapping: any, id: string, format: 'json' | 'csv' | 'zip' = 'json') => {
    try {
      if (!confirm(`Download mapping for migration ${id} as ${format.toUpperCase()}?`)) return;
      pushToast('Preparing download...', 'info');
      if (format === 'json') {
        const resp = await fetch(`/api/storage?action=exportMigration&id=${encodeURIComponent(id)}`);
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          pushToast(`Server export failed: ${body.error || 'Unknown'}`, 'error');
          // fallback to client-side download
          const blob = new Blob([JSON.stringify(mapping || {}, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `migration_${id}_mapping.json`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          pushToast('Downloaded fallback mapping', 'warning');
          return;
        }
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `migration_${id}_mapping.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        pushToast('Migration mapping downloaded', 'success');
        return;
      }

      const resp = await fetch(`/api/storage?action=exportMigrationFlat&id=${encodeURIComponent(id)}&format=${format}`);
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        pushToast(`Server export failed: ${body.error || 'Unknown'}`, 'error');
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `migration_${id}_mapping.${format === 'zip' ? 'zip' : 'csv'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      pushToast(`Migration mapping ${format.toUpperCase()} downloaded`, 'success');
    } catch (e) {
      console.error('Download failed', e);
      pushToast('Download failed', 'error');
    }
  };

  const [isMigrating, setIsMigrating] = useState(false);
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [migrationIncludeEntries, setMigrationIncludeEntries] = useState(true);

  // Toast system
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' | 'info' | 'warning' }>>([]);
  const pushToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', duration = 4000) => {
    const id = (globalThis as any).crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
    setToasts(t => [{ id, message, type }, ...t]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration);
  };

  const runMigrationNow = async (includeEntries = true) => {
    if (isMigrating) return;
    // close modal when starting
    setShowMigrationModal(false);
    setIsMigrating(true);
    try {
      const localUsers = JSON.parse(localStorage.getItem('registered_users') || '[]');
      let entriesObj: Record<string, any[]> = {};
      if (includeEntries) {
        for (const lu of localUsers) {
          const localEntries = JSON.parse(localStorage.getItem(`entries_${lu.id}`) || '[]');
          if (localEntries && localEntries.length) entriesObj[lu.id] = localEntries;
        }
      }

      if (!localUsers.length && Object.keys(entriesObj).length === 0) {
        pushToast('No local data found to migrate', 'info');
        setIsMigrating(false);
        return;
      }

      const resp = await fetch('/api/storage?action=migrateLocal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ users: localUsers, entries: entriesObj }) });
      const body = await resp.json();
      if (!resp.ok) {
        pushToast(`Migration failed: ${body.error || body.detail || 'server error'}`, 'error');
        setIsMigrating(false);
        return;
      }

      localStorage.setItem('migrated_to_db', new Date().toISOString());
      fetchMigrations();
      fetchMasterData();
      pushToast(`Migration completed: ${body.migratedUsers || 0} users, ${body.migratedEntries || 0} entries (id: ${body.migrationId || 'n/a'})`, 'success');
    } catch (err) {
      console.error('Manual migration failed', err);
      pushToast('Migration failed, check console', 'error');
    } finally {
      setIsMigrating(false);
    }
  };

  const viewingUser = useMemo(() => {
    if (!user) return null;
    return adminViewingUserId ? allUsers.find(u => u.id === adminViewingUserId) || null : user;
  }, [adminViewingUserId, allUsers, user]);

  useEffect(() => {
    const session = localStorage.getItem('current_session');
    if (session) {
      const parsedUser = JSON.parse(session);
      setUser(parsedUser);
      if (parsedUser.role === 'admin') setActiveTab('admin-dashboard');
    }
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    if (savedTheme) setTheme(savedTheme || 'light');

    // fetch registered users from server
    fetch('/api/storage?action=getUsers')
      .then(r => r.json())
      .then(d => {
        setAllUsers(d.users || []);

        // Silent one-time migration from localStorage to the central DB (no UI changes)
        try {
          if (!localStorage.getItem('migrated_to_db')) {
            const localUsers = JSON.parse(localStorage.getItem('registered_users') || '[]');
            const entriesObj: Record<string, any[]> = {};
            for (const lu of localUsers) {
              const localEntries = JSON.parse(localStorage.getItem(`entries_${lu.id}`) || '[]');
              if (localEntries && localEntries.length) entriesObj[lu.id] = localEntries;
            }

            if (localUsers.length || Object.keys(entriesObj).length) {
              fetch('/api/storage?action=migrateLocal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ users: localUsers, entries: entriesObj }) })
                .then(res => res.json())
                .then(resBody => {
                  console.log('Local migration result', resBody);
                  // Mark migration complete to avoid repeating
                  localStorage.setItem('migrated_to_db', new Date().toISOString());
                  // refresh server-side reports so admins can see the migration
                  fetchMigrations();
                  // show a non-intrusive notification of background migration
                  pushToast(`Background migration completed: ${resBody.migratedUsers || 0} users, ${resBody.migratedEntries || 0} entries`, 'success');
                })
                .catch(err => {
                  console.error('Local migration failed', err);
                  pushToast('Background migration failed (see console)', 'error');
                  // Do not set migrated flag so we can retry later
                });
            } else {
              // Nothing to migrate, mark as done
              localStorage.setItem('migrated_to_db', new Date().toISOString());
            }
          }
        } catch (e) {
          console.error('Migration check failed', e);
        }
      })
      .catch(e => console.error('Failed to fetch users', e));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (user) {
      if (selectedUsers.length > 0) {
        // Fetch entries for all selected users
        Promise.all(
          selectedUsers.map(userId =>
            fetch(`/api/storage?action=getEntries&userId=${encodeURIComponent(userId)}`)
              .then(r => r.json())
              .then(d => d.entries || [])
          )
        )
          .then(results => {
            const allEntries = results.flat().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setEntries(allEntries);
          })
          .catch(e => { console.error('Failed to fetch entries', e); setEntries([]); });
      } else {
        const idToFetch = adminViewingUserId || user.id;
        fetch(`/api/storage?action=getEntries&userId=${encodeURIComponent(idToFetch)}`)
          .then(r => r.json())
          .then(d => setEntries(d.entries || []))
          .catch(e => { console.error('Failed to fetch entries', e); setEntries([]); });
      }
    } else {
      setEntries([]);
    }
  }, [user, adminViewingUserId, selectedUsers]);

  const handleAuthSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError('');
    const data = new FormData(e.currentTarget);
    const empId = (data.get('empId') as string || '').trim().toLowerCase();
    const password = (data.get('password') as string || '');
    const name = (data.get('name') as string || '').trim();

    setTimeout(async () => {
      try {
        if (authView === 'login') {
          // For admin login, use name as empId since admin doesn't have empId field
          const loginEmpId = authRole === 'admin' ? name.toUpperCase() : empId;
          const loginPassword = authRole === 'admin' ? password : password;

          const resp = await fetch('/api/storage?action=auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ empId: loginEmpId, password: loginPassword, role: authRole }) });

          if (!resp.ok) {
            const text = await resp.text();
            try {
              const json = JSON.parse(text);
              setAuthError(json.error || `Server error (${resp.status})`);
            } catch (err) {
              setAuthError(`Server error (${resp.status}): ${text.substring(0, 50)}...`);
            }
            return;
          }
          const body = await resp.json();
          const found = body.user;
          setUser(found);
          localStorage.setItem('current_session', JSON.stringify(found));
          if (found.role === 'admin') { setActiveTab('admin-dashboard'); fetchMasterData(); }
          else setActiveTab('calc');
        } else {
          if (authRole === 'admin') { pushToast('Admin registration disabled. Default admin: TEAM / Pooja852', 'info'); setAuthView('login'); return; }
          const resp = await fetch('/api/storage?action=register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ empId, name, password, role: authRole }) });
          const body = await resp.json();
          if (!resp.ok) { setAuthError(body.error || 'Registration failed'); return; }
          const newUser = body.user;
          setAllUsers(prev => [...prev, newUser]);
          setAuthView('login');
        }
      } catch (e: any) {
        console.error('Auth error:', e);
        setAuthError(`Connection failed: ${e.message || 'Unknown error'}`);
      }
    }, 600);
  };

  const logout = () => {
    localStorage.removeItem('current_session');
    setUser(null);
    setAdminViewingUserId(null);
    setActiveTab('calc');
    setAuthView('login');
  };

  const handleAIParsing = async () => {
    if (!rawText || !rawText.trim()) return;
    setIsParsing(true);
    try {
      const parsed = await parseRawTimeData(rawText);
      if (parsed) {
        setFormData(prev => ({
          ...prev,
          ...parsed,
          loginTimestamp: parsed.loginTimestamp || prev.loginTimestamp,
          logoutTimestamp: parsed.logoutTimestamp || prev.logoutTimestamp
        }));
        const signature = JSON.stringify({ parsed, raw: rawText.trim() });
        setParsedSignature(signature);
        setRawText('');
      }
    } catch (e: any) {
      console.error(e);
      setParseFailures(prev => prev + 1);
      pushToast(`AI extraction failed: ${e?.message || 'Check server logs and ensure GENAI_API_KEY is set on Vercel'}`, 'error');
    } finally { setIsParsing(false); }
  };

  const loginSec = timeToSeconds(formData.currentLogin);
  const shiftBase = shiftType === 'Full Day' ? 9 * 3600 : 4.5 * 3600;
  const otEligibilitySec = 4.5 * 3600;
  const extraSec = Math.max(0, loginSec - shiftBase);
  const emergencyOtEligible = emergencyOt && loginSec >= 3600;
  const otTrigger = !emergencyOt && loginSec >= otEligibilitySec && extraSec > 3600;
  const otSec = emergencyOtEligible ? loginSec : otTrigger ? extraSec : 0;

  const loginRemainingSec = Math.max(0, shiftBase - loginSec);
  const totalBreakSec = timeToSeconds(formData.pause) + timeToSeconds(formData.dispo) + timeToSeconds(formData.dead);
  const breakLimit = shiftType === 'Full Day' ? 7200 : 2700;
  const breakRemainingSec = Math.max(0, breakLimit - totalBreakSec);

  const loginExceeded = loginSec > shiftBase;
  const breakExceeded = totalBreakSec > breakLimit;

  const commitRecord = async (applyForOT?: boolean) => {
    if (!user) return;
    const allZero = [
      formData.pause,
      formData.dispo,
      formData.dead,
      formData.currentLogin,
      formData.loginTimestamp,
      formData.logoutTimestamp,
      formData.wait,
      formData.talk,
      formData.hold,
      formData.customerTalk
    ].every(v => v === '00:00:00') &&
      (formData.inbound || 0) === 0 &&
      (formData.outbound || 0) === 0 &&
      (!formData.reason || !formData.reason.trim());
    const isNewUserEntry = !editingId && user.role === 'user';
    const isNewEntry = !editingId;

    if (isNewEntry && allZero) {
      pushToast('Please fill the data before committing.', 'warning');
      return;
    }

    if (isNewUserEntry) {
      if (!parsedSignature) {
        pushToast('Commit is allowed only after you paste and extract once.', 'warning');
        return;
      }

      if (parsedSignature && parsedSignature === lastCommittedSignature) {
        pushToast('This entry was already committed. Paste and extract new data to add again.', 'info');
        return;
      }
    }

    if (applyForOT && !formData.reason.trim()) {
      pushToast('Please add a justification before requesting OT.', 'warning');
      return;
    }

    if (emergencyOt && loginSec < 3600) {
      pushToast('Emergency OT requires at least 1 hour of login time.', 'warning');
      return;
    }

    const targetUserId = adminViewingUserId || user.id;
    const calculatedStatus: EntryStatus = emergencyOt ? 'Approved' : (applyForOT) ? 'Pending' : 'N/A';

    if (editingId) {
      // update on server
      const payload = { userId: targetUserId, entryId: editingId, entry: { ...formData, shiftType, status: calculatedStatus, emergencyOt } };
      try {
        const r = await fetch('/api/storage?action=updateEntry', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const b = await r.json();
        if (!r.ok) throw new Error(b.error || 'Update failed');
        setEntries(b.entries || []);
        setEditingId(null);
        if (user?.role === 'admin') fetchMasterData();
      } catch (e: any) { pushToast(`Failed to update entry: ${e.message}`, 'error'); }
    } else {
      const newEntry: TimeData = {
        id: crypto.randomUUID(),
        userId: viewingUser?.empId || '',
        userName: viewingUser?.name,
        date: new Date().toISOString(),
        shiftType,
        ...formData,
        status: calculatedStatus,
        emergencyOt
      };
      try {
        const r = await fetch('/api/storage?action=addEntry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: targetUserId, entry: newEntry }) });
        const b = await r.json();
        if (!r.ok) throw new Error(b.error || 'Add failed');
        setEntries(b.entries || []);
        if (user?.role === 'admin') fetchMasterData();
        if (isNewUserEntry) setLastCommittedSignature(parsedSignature);
      } catch (e: any) { pushToast(`Failed to add entry: ${e.message}`, 'error'); }
    }
    setFormData(INITIAL_FORM_STATE);
    setShowOTModal(false);
    setEmergencyOt(false);
  };

  const saveToHistory = () => {
    if (!emergencyOt && otTrigger && !showOTModal) {
      setShowOTModal(true);
      return;
    }
    commitRecord(false);
  };



  const deleteEntry = async (id: string, logOwnerEmpId?: string) => {
    if (!confirm("Permanently delete this entry?")) return;
    let targetId = logOwnerEmpId ? allUsers.find(u => u.empId.toLowerCase() === logOwnerEmpId.toLowerCase())?.id : (adminViewingUserId || user?.id);
    if (!targetId) return;
    try {
      const r = await fetch('/api/storage?action=deleteEntry', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: targetId, entryId: id }) });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || 'Delete failed');
      if (adminViewingUserId === targetId || user?.id === targetId) setEntries(b.entries || []);
      if (user?.role === 'admin') fetchMasterData();
    } catch (e) { pushToast('Failed to delete entry', 'error'); }
    setAllUsers([...allUsers]);
  };

  const deleteUser = async (id: string) => {
    if (!confirm('Delete user and all entries? This cannot be undone.')) return;
    try {
      const r = await fetch('/api/storage?action=deleteUser', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: id }) });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || 'Delete user failed');
      setAllUsers(b.users || []);
      if (adminViewingUserId === id) { setAdminViewingUserId(null); setEntries([]); }
      fetchMasterData();
    } catch (e) { pushToast('Failed to delete user', 'error'); }
  };

  const updateStatus = async (userId: string, entryId: string, newStatus: EntryStatus, reason?: string) => {
    const internalUser = allUsers.find(u => u.empId.toLowerCase() === userId.toLowerCase());
    if (!internalUser) return;
    try {
      const r = await fetch('/api/storage?action=updateStatus', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: internalUser.id, entryId, newStatus, reason }) });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || 'Update status failed');
      if (adminViewingUserId === internalUser.id) setEntries(b.entries || []);
      else if (!adminViewingUserId && (activeTab === 'all-logs' || activeTab === 'admin')) setAllUsers([...allUsers]);
      fetchMasterData();
      pushToast(`Status updated to ${newStatus}.`, 'success');
    } catch (e) { pushToast('Failed to update status', 'error'); }
  };

  const deleteAllEntries = async () => {
    if (!user) return;
    try {
      const r = await fetch('/api/storage?action=deleteAllUserEntries', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || 'Reset failed');

      setEntries([]);
      setFormData(INITIAL_FORM_STATE);
      setShowResetConfirm2(false);
      pushToast('All data has been reset successfully.', 'success');
    } catch (e) {
      pushToast('Failed to reset data', 'error');
    }
  };

  const startEdit = (entry: TimeData) => {
    setFormData({
      pause: entry.pause,
      dispo: entry.dispo,
      dead: entry.dead,
      currentLogin: entry.currentLogin,
      loginTimestamp: entry.loginTimestamp || '00:00:00',
      logoutTimestamp: entry.logoutTimestamp || '00:00:00',
      wait: entry.wait,
      talk: entry.talk,
      hold: entry.hold,
      customerTalk: entry.customerTalk,
      inbound: entry.inbound,
      outbound: entry.outbound,
      reason: entry.reason || ''
    });
    setShiftType(entry.shiftType);
    setEmergencyOt(!!entry.emergencyOt);
    setEditingId(entry.id);
    setActiveTab('calc');
  };

  const startEditAsAdmin = (entry: TimeData) => {
    const target = allUsers.find(u => u.empId.toLowerCase() === entry.userId.toLowerCase());
    if (target) setAdminViewingUserId(target.id);
    startEdit(entry);
  };

  const monthlyStats = useMemo(() => {
    const now = new Date();
    const relevant = entries.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && !e.emergencyOt;
    });
    return {
      inbound: relevant.reduce((acc, curr) => acc + (curr.inbound || 0), 0),
      outbound: relevant.reduce((acc, curr) => acc + (curr.outbound || 0), 0)
    };
  }, [entries]);

  const monthlyEmergencyStats = useMemo(() => {
    const now = new Date();
    const relevant = entries.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && e.emergencyOt;
    });
    return {
      inbound: relevant.reduce((acc, curr) => acc + (curr.inbound || 0), 0),
      outbound: relevant.reduce((acc, curr) => acc + (curr.outbound || 0), 0)
    };
  }, [entries]);

  const formatDateInput = (date: Date) => date.toISOString().split('T')[0];

  const getSearchTokens = (value: string) => {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return [] as string[];
    const match = trimmed.match(/^(.*?)\s*\((.*?)\)\s*$/);
    if (match) {
      const tokens = [match[1].trim(), match[2].trim()].filter(Boolean);
      return tokens.length ? tokens : [trimmed];
    }
    return [trimmed];
  };

  const computeEntryScore = (entry: TimeData) => {
    const talkSec = timeToSeconds(entry.talk || '00:00:00');
    const customerTalkSec = timeToSeconds(entry.customerTalk || '00:00:00');
    const inbound = entry.inbound || 0;
    const outbound = entry.outbound || 0;
    const breakSec = timeToSeconds(entry.pause || '00:00:00') + timeToSeconds(entry.dispo || '00:00:00') + timeToSeconds(entry.dead || '00:00:00');
    const breakLimit = entry.shiftType === 'Full Day' ? 7200 : 2700;
    const breakPenalty = breakSec > breakLimit ? 10 : 0;
    const volume = inbound + outbound;
    const score = (talkSec / 60) * 0.4 + (volume * 0.3) + (customerTalkSec / 60) * 0.2 - breakPenalty;
    return Math.max(0, score);
  };

  const isBlankEntry = (entry: TimeData) => {
    const allZero = [
      entry.pause,
      entry.dispo,
      entry.dead,
      entry.currentLogin,
      entry.loginTimestamp || '00:00:00',
      entry.logoutTimestamp || '00:00:00',
      entry.wait,
      entry.talk,
      entry.hold,
      entry.customerTalk
    ].every(v => v === '00:00:00') &&
      (entry.inbound || 0) === 0 &&
      (entry.outbound || 0) === 0 &&
      (!entry.reason || !entry.reason.trim());
    return allZero;
  };

  const masterData = useMemo(() => {
    if (user?.role !== 'admin') return [];
    return masterDataServer;
  }, [masterDataServer, user]);

  const otEntries = useMemo(() => {
    const eligibilitySec = 4.5 * 3600;
    return masterData.filter(d => {
      if (d.emergencyOt) return false;
      const loginSec = timeToSeconds(d.currentLogin || '00:00:00');
      const shiftTarget = d.shiftType === 'Full Day' ? 9 * 3600 : 4.5 * 3600;
      const extra = loginSec - shiftTarget;
      return loginSec >= eligibilitySec && extra > 3600 && d.status === 'Approved';
    });
  }, [masterData]);

  const filteredOtEntries = useMemo(() => {
    if (!otAdminSearchQuery) return otEntries;
    const q = otAdminSearchQuery.toLowerCase();
    return otEntries.filter(d =>
      d.userName.toLowerCase().includes(q) ||
      d.userId.toLowerCase().includes(q) ||
      new Date(d.date).toLocaleDateString('en-GB').includes(q)
    );
  }, [otEntries, otAdminSearchQuery]);

  const pendingOtApprovals = useMemo(() => {
    const eligibilitySec = 4.5 * 3600;
    return masterData.filter(d => {
      if (d.emergencyOt) return false;
      const loginSec = timeToSeconds(d.currentLogin || '00:00:00');
      const shiftBase = d.shiftType === 'Full Day' ? 9 * 3600 : 4.5 * 3600;
      const extra = loginSec - shiftBase;
      if (!(loginSec >= eligibilitySec && extra > 3600)) return false;
      return d.status === 'Pending';
    });
  }, [masterData]);

  const otRecordEntries = useMemo(() => {
    const eligibilitySec = 4.5 * 3600;
    return masterData.filter(d => {
      const loginSec = timeToSeconds(d.currentLogin || '00:00:00');
      if (d.emergencyOt) {
        return loginSec >= 3600;
      }
      const shiftBase = d.shiftType === 'Full Day' ? 9 * 3600 : 4.5 * 3600;
      const extra = loginSec - shiftBase;
      if (!(loginSec >= eligibilitySec && extra > 3600)) return false;
      return d.status === 'Approved' || d.status === 'Rejected';
    });
  }, [masterData]);

  const filteredOtRecords = useMemo(() => {
    let result = otRecordEntries;
    if (otRecordSearchQuery) {
      const q = otRecordSearchQuery.toLowerCase();
      result = result.filter(d =>
        (d.userName || '').toLowerCase().includes(q) ||
        (d.userId || '').toLowerCase().includes(q) ||
        new Date(d.date).toLocaleDateString('en-GB').includes(q)
      );
    }
    if (otRecordDateStart) {
      const start = new Date(otRecordDateStart);
      start.setHours(0, 0, 0, 0);
      result = result.filter(d => new Date(d.date) >= start);
    }
    if (otRecordDateEnd) {
      const end = new Date(otRecordDateEnd);
      end.setHours(23, 59, 59, 999);
      result = result.filter(d => new Date(d.date) <= end);
    }
    if (otRecordShiftFilter !== 'All') {
      result = result.filter(d => d.shiftType === otRecordShiftFilter);
    }
    if (otRecordStatusFilter !== 'All') {
      result = result.filter(d => d.status === otRecordStatusFilter);
    }
    return result;
  }, [otRecordEntries, otRecordSearchQuery, otRecordDateStart, otRecordDateEnd, otRecordShiftFilter, otRecordStatusFilter]);

  const otRecordTotals = useMemo(() => ({
    approved: filteredOtRecords.filter(d => d.status === 'Approved').length,
    rejected: filteredOtRecords.filter(d => d.status === 'Rejected').length
  }), [filteredOtRecords]);

  const getOverviewBounds = () => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    if (overviewRange === 'today') {
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    if (overviewRange === 'weekly') {
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    if (overviewRange === 'monthly') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    if (overviewRange === 'yearly') {
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    const customStart = overviewCustomStart ? new Date(overviewCustomStart) : new Date(end);
    const customEnd = overviewCustomEnd ? new Date(overviewCustomEnd) : new Date(end);
    customStart.setHours(0, 0, 0, 0);
    customEnd.setHours(23, 59, 59, 999);
    return { start: customStart, end: customEnd };
  };

  const getUserKpiBounds = () => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    if (userKpiRange === 'daily') {
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    if (userKpiRange === 'weekly') {
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    if (userKpiRange === 'monthly') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  };

  const overviewRangeBounds = useMemo(getOverviewBounds, [overviewCustomEnd, overviewCustomStart, overviewRange]);
  const userKpiRangeBounds = useMemo(getUserKpiBounds, [userKpiRange]);

  const overviewEntries = useMemo(() => {
    if (user?.role !== 'admin') return [] as TimeData[];
    return (masterDataServer || []).filter(d => {
      const entryDate = new Date(d.date);
      return entryDate >= overviewRangeBounds.start && entryDate <= overviewRangeBounds.end;
    });
  }, [masterDataServer, overviewRangeBounds.end, overviewRangeBounds.start, user]);

  const overviewDerived = useMemo(() => {
    const derived = overviewEntries.map(d => {
      const loginSec = timeToSeconds(d.currentLogin || '00:00:00');
      const talkSec = timeToSeconds(d.talk || '00:00:00');
      const breakSec = timeToSeconds(d.pause || '00:00:00') + timeToSeconds(d.dispo || '00:00:00') + timeToSeconds(d.dead || '00:00:00');
      const shiftBase = d.shiftType === 'Full Day' ? 9 * 3600 : 4.5 * 3600;
      const volume = (d.inbound || 0) + (d.outbound || 0);
      return {
        entry: d,
        loginSec,
        talkSec,
        breakSec,
        shiftBase,
        volume,
        hasReason: !!(d.reason && d.reason.trim())
      };
    });

    if (!derived.length) {
      return {
        needsAttention: [],
        topPerformers: [],
        pendingOt: [],
        stats: {
          totalUsers: 0,
          needsUsers: 0,
          topUsers: 0,
          pendingOtCount: 0,
          breakExceededUsers: 0
        },
        focusIds: {
          needs: new Set<string>(),
          top: new Set<string>(),
          pendingOt: new Set<string>()
        }
      };
    }

    const avgTalkSec = derived.reduce((acc, curr) => acc + curr.talkSec, 0) / derived.length;
    const avgVolume = derived.reduce((acc, curr) => acc + curr.volume, 0) / derived.length;
    const otRejectedCounts = new Map<string, number>();

    for (const item of derived) {
      const isOt = item.loginSec > item.shiftBase;
      if (isOt && item.entry.status === 'Rejected') {
        otRejectedCounts.set(item.entry.userId, (otRejectedCounts.get(item.entry.userId) || 0) + 1);
      }
    }

    const needsAttention = derived.filter(item => {
      const breakExceeded = item.breakSec > 2 * 3600;
      const underShift = item.loginSec < item.shiftBase;
      const lowActivity = item.volume < 5 && item.talkSec < 10 * 60;
      const repeatedOtMisuse = (otRejectedCounts.get(item.entry.userId) || 0) >= 2;
      return breakExceeded || underShift || lowActivity || repeatedOtMisuse;
    });

    const topPerformers = derived.filter(item => item.entry.inbound > 65 && item.breakSec < 2 * 3600);

    const pendingOt = derived.filter(item => item.loginSec >= 4.5 * 3600 && (item.loginSec - item.shiftBase) > 3600 && item.entry.status === 'Pending');

    const uniqueUsers = (items: typeof derived) => new Set(items.map(i => i.entry.userId)).size;
    const breakExceededUsers = new Set(derived.filter(item => item.breakSec > 2 * 3600).map(item => item.entry.userId)).size;

    return {
      needsAttention,
      topPerformers,
      pendingOt,
      stats: {
        totalUsers: uniqueUsers(derived),
        needsUsers: uniqueUsers(needsAttention),
        topUsers: uniqueUsers(topPerformers),
        pendingOtCount: pendingOt.length,
        breakExceededUsers
      },
      focusIds: {
        needs: new Set(needsAttention.map(item => item.entry.id)),
        top: new Set(topPerformers.map(item => item.entry.id)),
        pendingOt: new Set(pendingOt.map(item => item.entry.id))
      }
    };
  }, [overviewEntries]);

  const rangeEntries = useMemo(() => {
    if (user?.role !== 'admin') return [] as TimeData[];
    return (masterDataServer || []).filter(d => {
      if (isBlankEntry(d)) return false;
      const entryDate = new Date(d.date);
      return entryDate >= overviewRangeBounds.start && entryDate <= overviewRangeBounds.end;
    });
  }, [masterDataServer, overviewRangeBounds.end, overviewRangeBounds.start, user]);

  const rangeKpi = useMemo(() => {
    let inboundTotal = 0;
    let outboundTotal = 0;
    let halfDayCount = 0;
    let fullDayCount = 0;
    let underShiftFullDay = 0;
    let underShiftHalfDay = 0;
    let otCount = 0;

    for (const entry of rangeEntries) {
      const isEmergency = !!entry.emergencyOt;
      inboundTotal += entry.inbound || 0;
      outboundTotal += entry.outbound || 0;
      if (!isEmergency) {
        if (entry.shiftType === 'Full Day') {
          fullDayCount += 1;
          if (timeToSeconds(entry.currentLogin || '00:00:00') < 9 * 3600) {
            underShiftFullDay += 1;
          }
        } else {
          halfDayCount += 1;
          if (timeToSeconds(entry.currentLogin || '00:00:00') < 4.5 * 3600) {
            underShiftHalfDay += 1;
          }
        }
      }

      const loginSec = timeToSeconds(entry.currentLogin || '00:00:00');
      const shiftBase = entry.shiftType === 'Full Day' ? 9 * 3600 : 4.5 * 3600;
      if (isEmergency) {
        if (loginSec >= 3600) otCount += 1;
      } else if (loginSec > shiftBase) {
        otCount += 1;
      }
    }

    return {
      inboundTotal,
      outboundTotal,
      halfDayCount,
      fullDayCount,
      underShiftFullDay,
      underShiftHalfDay,
      otCount
    };
  }, [rangeEntries]);

  const userRangeEntries = useMemo(() => {
    return entries.filter(entry => {
      if (isBlankEntry(entry)) return false;
      const entryDate = new Date(entry.date);
      return entryDate >= userKpiRangeBounds.start && entryDate <= userKpiRangeBounds.end;
    });
  }, [entries, userKpiRangeBounds.end, userKpiRangeBounds.start]);

  const userKpiData = useMemo(() => {
    const inboundEntries = userRangeEntries.filter(entry => (entry.inbound || 0) > 0);
    const outboundEntries = userRangeEntries.filter(entry => (entry.outbound || 0) > 0);
    const halfDayEntries = userRangeEntries.filter(entry => entry.shiftType === 'Half Day' && !entry.emergencyOt);
    const fullDayEntries = userRangeEntries.filter(entry => entry.shiftType === 'Full Day' && !entry.emergencyOt);
    const underShiftFullDayEntries = userRangeEntries.filter(entry => entry.shiftType === 'Full Day' && !entry.emergencyOt && timeToSeconds(entry.currentLogin || '00:00:00') < 9 * 3600);
    const underShiftHalfDayEntries = userRangeEntries.filter(entry => entry.shiftType === 'Half Day' && !entry.emergencyOt && timeToSeconds(entry.currentLogin || '00:00:00') < 4.5 * 3600);
    const breakExceededEntries = userRangeEntries.filter(entry => {
      const breakSec = timeToSeconds(entry.pause || '00:00:00') + timeToSeconds(entry.dispo || '00:00:00') + timeToSeconds(entry.dead || '00:00:00');
      const breakLimit = entry.shiftType === 'Full Day' ? 7200 : 2700;
      return breakSec > breakLimit;
    });
    const otEntries = userRangeEntries.filter(entry => {
      const loginSec = timeToSeconds(entry.currentLogin || '00:00:00');
      if (entry.emergencyOt) return loginSec >= 3600;
      const shiftBase = entry.shiftType === 'Full Day' ? 9 * 3600 : 4.5 * 3600;
      return loginSec > shiftBase;
    });
    const rejectedOtCount = userRangeEntries.filter(entry => {
      const loginSec = timeToSeconds(entry.currentLogin || '00:00:00');
      const shiftBase = entry.shiftType === 'Full Day' ? 9 * 3600 : 4.5 * 3600;
      return loginSec > shiftBase && entry.status === 'Rejected';
    }).length;
    const repeatedOtMisuse = rejectedOtCount >= 2;
    const needsAttentionEntries = userRangeEntries.filter(entry => {
      const loginSec = timeToSeconds(entry.currentLogin || '00:00:00');
      const shiftBase = entry.shiftType === 'Full Day' ? 9 * 3600 : 4.5 * 3600;
      const breakSec = timeToSeconds(entry.pause || '00:00:00') + timeToSeconds(entry.dispo || '00:00:00') + timeToSeconds(entry.dead || '00:00:00');
      const breakLimit = entry.shiftType === 'Full Day' ? 7200 : 2700;
      const volume = (entry.inbound || 0) + (entry.outbound || 0);
      const talkSec = timeToSeconds(entry.talk || '00:00:00');
      const breakExceeded = breakSec > breakLimit;
      const underShift = loginSec < shiftBase;
      const lowActivity = volume < 5 && talkSec < 10 * 60;
      return breakExceeded || underShift || lowActivity || repeatedOtMisuse;
    });
    const topPerformerEntries = userRangeEntries.filter(entry => {
      const breakSec = timeToSeconds(entry.pause || '00:00:00') + timeToSeconds(entry.dispo || '00:00:00') + timeToSeconds(entry.dead || '00:00:00');
      return (entry.inbound || 0) > 65 && breakSec < 2 * 3600;
    });

    return {
      inboundEntries,
      outboundEntries,
      halfDayEntries,
      fullDayEntries,
      underShiftFullDayEntries,
      underShiftHalfDayEntries,
      totalLoginEntries: userRangeEntries,
      needsAttentionEntries,
      topPerformerEntries,
      otEntries,
      breakExceededEntries
    };
  }, [userRangeEntries]);

  const openKpiModal = (title: string, rows: KpiRow[]) => {
    setKpiModalTitle(title);
    setKpiModalRows(rows);
    setKpiModalOpen(true);
  };

  const downloadKpiModalRows = () => {
    if (!kpiModalRows.length) {
      pushToast('No records to download', 'warning');
      return;
    }

    const headers = [
      'Name',
      'Emp ID',
      ...(kpiModalMeta.hasCount ? ['Count'] : []),
      ...(kpiModalMeta.hasDate ? ['Date'] : []),
      ...(kpiModalMeta.hasShift ? ['Shift'] : []),
      ...(kpiModalMeta.hasInbound ? ['Inbound'] : []),
      ...(kpiModalMeta.hasOutbound ? ['Outbound'] : []),
      ...(kpiModalMeta.hasLogin ? ['Login'] : []),
      ...(kpiModalMeta.hasBreak ? ['Break'] : [])
    ];

    const escapeCsv = (value: string | number) => {
      const text = String(value ?? '');
      if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
      return text;
    };

    const rows = kpiModalRows.map(row => {
      const columns: Array<string | number> = [row.name, row.empId];
      if (kpiModalMeta.hasCount) columns.push(row.count ?? '-');
      if (kpiModalMeta.hasDate) columns.push(row.date ? new Date(row.date).toLocaleDateString() : '-');
      if (kpiModalMeta.hasShift) columns.push(row.shiftType || '-');
      if (kpiModalMeta.hasInbound) columns.push(row.inbound ?? 0);
      if (kpiModalMeta.hasOutbound) columns.push(row.outbound ?? 0);
      if (kpiModalMeta.hasLogin) columns.push(typeof row.loginSec === 'number' ? secondsToTime(row.loginSec) : '-');
      if (kpiModalMeta.hasBreak) columns.push(typeof row.breakSec === 'number' ? secondsToTime(row.breakSec) : '-');
      return columns.map(escapeCsv).join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `kpi_${kpiModalTitle.replace(/\s+/g, '_').toLowerCase()}_${formatDateInput(new Date())}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const buildEntryRows = (entries: TimeData[]) => {
    return entries.map(entry => ({
      id: entry.id,
      name: entry.userName || entry.userId,
      empId: entry.userId,
      date: entry.date,
      shiftType: entry.shiftType,
      inbound: entry.inbound || 0,
      outbound: entry.outbound || 0,
      loginSec: timeToSeconds(entry.currentLogin || '00:00:00'),
      breakSec: timeToSeconds(entry.pause || '00:00:00') + timeToSeconds(entry.dispo || '00:00:00') + timeToSeconds(entry.dead || '00:00:00')
    }));
  };

  const openTotalLoginUsers = () => {
    const userMap = new Map<string, KpiRow>();
    for (const entry of rangeEntries) {
      const existing = userMap.get(entry.userId);
      if (existing) {
        existing.count = (existing.count || 0) + 1;
        continue;
      }
      userMap.set(entry.userId, {
        id: entry.userId,
        name: entry.userName || entry.userId,
        empId: entry.userId,
        count: 1
      });
    }
    openKpiModal('Total Login Users', Array.from(userMap.values()));
  };

  const openNeedsAttentionKpi = () => {
    const userMap = new Map<string, KpiRow>();
    for (const item of overviewDerived.needsAttention) {
      const entry = item.entry;
      const existing = userMap.get(entry.userId);
      if (existing) {
        existing.count = (existing.count || 0) + 1;
        continue;
      }
      userMap.set(entry.userId, {
        id: entry.userId,
        name: entry.userName || entry.userId,
        empId: entry.userId,
        count: 1
      });
    }
    openKpiModal('Needs Attention', Array.from(userMap.values()));
  };

  const openTopPerformersKpi = () => {
    const entries = rangeEntries.filter(entry => (entry.inbound || 0) > 65 && (timeToSeconds(entry.pause || '00:00:00') + timeToSeconds(entry.dispo || '00:00:00') + timeToSeconds(entry.dead || '00:00:00')) < 2 * 3600);
    openKpiModal('Top Performers', buildEntryRows(entries));
  };

  const openPendingOtKpi = () => {
    openKpiModal('OT Requests Pending', buildEntryRows(overviewDerived.pendingOt.map(item => item.entry)));
  };

  const openBreakExceededKpi = () => {
    const userMap = new Map<string, KpiRow>();
    for (const entry of rangeEntries) {
      const breakSec = timeToSeconds(entry.pause || '00:00:00') + timeToSeconds(entry.dispo || '00:00:00') + timeToSeconds(entry.dead || '00:00:00');
      if (breakSec <= 2 * 3600) continue;
      const existing = userMap.get(entry.userId);
      if (existing) {
        existing.count = (existing.count || 0) + 1;
        if (typeof existing.breakSec === 'number') {
          existing.breakSec = Math.max(existing.breakSec, breakSec);
        } else {
          existing.breakSec = breakSec;
        }
        continue;
      }
      userMap.set(entry.userId, {
        id: entry.userId,
        name: entry.userName || entry.userId,
        empId: entry.userId,
        count: 1,
        breakSec
      });
    }
    openKpiModal('Break Exceeded Users', Array.from(userMap.values()));
  };

  const openInboundKpi = () => {
    const entries = rangeEntries.filter(entry => (entry.inbound || 0) > 0).sort((a, b) => (b.inbound || 0) - (a.inbound || 0));
    openKpiModal('Inbound', buildEntryRows(entries));
  };

  const openOutboundKpi = () => {
    const entries = rangeEntries.filter(entry => (entry.outbound || 0) > 0).sort((a, b) => (b.outbound || 0) - (a.outbound || 0));
    openKpiModal('Outbound', buildEntryRows(entries));
  };

  const openHalfDayKpi = () => {
    const entries = rangeEntries.filter(entry => entry.shiftType === 'Half Day' && !entry.emergencyOt);
    openKpiModal('Half Day', buildEntryRows(entries));
  };

  const openFullDayKpi = () => {
    const entries = rangeEntries.filter(entry => entry.shiftType === 'Full Day' && !entry.emergencyOt);
    openKpiModal('Full Day', buildEntryRows(entries));
  };

  const openUnderShiftFullDayKpi = () => {
    const entries = rangeEntries.filter(entry => entry.shiftType === 'Full Day' && !entry.emergencyOt && timeToSeconds(entry.currentLogin || '00:00:00') < 9 * 3600);
    openKpiModal('Under Shift Full Day', buildEntryRows(entries));
  };

  const openUnderShiftHalfDayKpi = () => {
    const entries = rangeEntries.filter(entry => entry.shiftType === 'Half Day' && !entry.emergencyOt && timeToSeconds(entry.currentLogin || '00:00:00') < 4.5 * 3600);
    openKpiModal('Under Shift Half Day', buildEntryRows(entries));
  };

  const openTotalOtKpi = () => {
    const entries = rangeEntries.filter(entry => {
      const loginSec = timeToSeconds(entry.currentLogin || '00:00:00');
      if (entry.emergencyOt) return loginSec >= 3600;
      const shiftBase = entry.shiftType === 'Full Day' ? 9 * 3600 : 4.5 * 3600;
      return loginSec > shiftBase;
    });
    openKpiModal('Total OTs', buildEntryRows(entries));
  };

  const kpiModalMeta = useMemo(() => {
    const hasDate = kpiModalRows.some(row => !!row.date);
    const hasShift = kpiModalRows.some(row => !!row.shiftType);
    const hasInbound = kpiModalRows.some(row => typeof row.inbound === 'number');
    const hasOutbound = kpiModalRows.some(row => typeof row.outbound === 'number');
    const hasLogin = kpiModalRows.some(row => typeof row.loginSec === 'number');
    const hasBreak = kpiModalRows.some(row => typeof row.breakSec === 'number');
    const hasCount = kpiModalRows.some(row => typeof row.count === 'number');
    return { hasDate, hasShift, hasInbound, hasOutbound, hasLogin, hasBreak, hasCount };
  }, [kpiModalRows]);

  const filteredMasterData = useMemo(() => {
    let result = masterData.filter(entry => !isBlankEntry(entry));
    const searchTerm = masterSearchQuery.trim().toLowerCase();
    const searchOverride = !!searchTerm && !masterFiltersApplied;

    if (!searchOverride && masterFocusMode !== 'all') {
      const focusIds = masterFocusMode === 'needs'
        ? overviewDerived.focusIds.needs
        : masterFocusMode === 'top'
          ? overviewDerived.focusIds.top
          : overviewDerived.focusIds.pendingOt;
      result = result.filter(entry => focusIds.has(entry.id));
    }

    if (searchTerm) {
      const tokens = getSearchTokens(searchTerm);
      result = result.filter(d => {
        const name = (d.userName || '').toLowerCase();
        const id = (d.userId || '').toLowerCase();
        const dateIso = formatDateInput(new Date(d.date));
        const dateGb = new Date(d.date).toLocaleDateString('en-GB');
        const reason = (d.reason || '').toLowerCase();
        return tokens.some(token =>
          name.includes(token) ||
          id.includes(token) ||
          dateIso.includes(token) ||
          dateGb.includes(token) ||
          reason.includes(token)
        );
      });
    }

    if (searchOverride) {
      return result;
    }

    if (masterAgentFilter) {
      const tokens = getSearchTokens(masterAgentFilter);
      result = result.filter(d => {
        const name = (d.userName || '').toLowerCase();
        const id = (d.userId || '').toLowerCase();
        return tokens.some(token => name.includes(token) || id.includes(token));
      });
    }

    if (masterStatusFilter !== 'All') {
      result = result.filter(d => d.status === masterStatusFilter);
    }

    if (masterShiftFilter !== 'All') {
      result = result.filter(d => d.shiftType === masterShiftFilter);
    }

    if (masterDateStart) {
      const start = new Date(masterDateStart);
      start.setHours(0, 0, 0, 0);
      result = result.filter(d => new Date(d.date) >= start);
    }

    if (masterDateEnd) {
      const end = new Date(masterDateEnd);
      end.setHours(23, 59, 59, 999);
      result = result.filter(d => new Date(d.date) <= end);
    }

    if (masterBreakViolationFilter !== 'All') {
      result = result.filter(d => {
        const breakSec = timeToSeconds(d.pause || '00:00:00') + timeToSeconds(d.dispo || '00:00:00') + timeToSeconds(d.dead || '00:00:00');
        const breakLimit = d.shiftType === 'Full Day' ? 7200 : 2700;
        const exceeded = breakSec > breakLimit;
        return masterBreakViolationFilter === 'Yes' ? exceeded : !exceeded;
      });
    }

    if (masterOvertimeFilter !== 'All') {
      result = result.filter(d => {
        const loginSec = timeToSeconds(d.currentLogin || '00:00:00');
        const shiftBase = d.shiftType === 'Full Day' ? 9 * 3600 : 4.5 * 3600;
        const overtime = loginSec > shiftBase;
        return masterOvertimeFilter === 'Yes' ? overtime : !overtime;
      });
    }

    if (masterUnderShiftFilter !== 'All') {
      result = result.filter(d => {
        if (masterUnderShiftFilter === 'Full Day' && d.shiftType !== 'Full Day') return false;
        if (masterUnderShiftFilter === 'Half Day' && d.shiftType !== 'Half Day') return false;
        const loginSec = timeToSeconds(d.currentLogin || '00:00:00');
        const shiftBase = d.shiftType === 'Full Day' ? 9 * 3600 : 4.5 * 3600;
        return loginSec < shiftBase;
      });
    }

    const sorted = [...result].sort((a, b) => {
      if (masterSortBy === 'productivity') {
        return computeEntryScore(a) - computeEntryScore(b);
      }
      if (masterSortBy === 'break') {
        const aBreak = timeToSeconds(a.pause || '00:00:00') + timeToSeconds(a.dispo || '00:00:00') + timeToSeconds(a.dead || '00:00:00');
        const bBreak = timeToSeconds(b.pause || '00:00:00') + timeToSeconds(b.dispo || '00:00:00') + timeToSeconds(b.dead || '00:00:00');
        return bBreak - aBreak;
      }
      if (masterSortBy === 'ot') {
        const aLogin = timeToSeconds(a.currentLogin || '00:00:00');
        const bLogin = timeToSeconds(b.currentLogin || '00:00:00');
        const aShift = a.shiftType === 'Full Day' ? 9 * 3600 : 4.5 * 3600;
        const bShift = b.shiftType === 'Full Day' ? 9 * 3600 : 4.5 * 3600;
        return (bLogin - bShift) - (aLogin - aShift);
      }
      if (masterSortBy === 'talk') {
        return timeToSeconds(b.talk || '00:00:00') - timeToSeconds(a.talk || '00:00:00');
      }
      if (masterSortBy === 'inbound') {
        return (b.inbound || 0) - (a.inbound || 0);
      }
      if (masterSortBy === 'outbound') {
        return (b.outbound || 0) - (a.outbound || 0);
      }
      return 0;
    });

    return sorted;
  }, [
    masterData,
    masterSearchQuery,
    masterAgentFilter,
    masterStatusFilter,
    masterShiftFilter,
    masterDateStart,
    masterDateEnd,
    masterBreakViolationFilter,
    masterOvertimeFilter,
    masterUnderShiftFilter,
    masterSortBy,
    masterFocusMode,
    masterFiltersApplied,
    overviewDerived
  ]);

  // Paginated master data (client-side pagination for performance)
  const paginatedMasterData = useMemo(() => {
    const startIdx = (masterCurrentPage - 1) * masterPageSize;
    const endIdx = startIdx + masterPageSize;
    return filteredMasterData.slice(startIdx, endIdx);
  }, [filteredMasterData, masterCurrentPage, masterPageSize]);

  const masterTotalPages = useMemo(() => Math.ceil(filteredMasterData.length / masterPageSize), [filteredMasterData.length, masterPageSize]);

  const handleMasterSearchApply = () => {
    applyMasterFilters();
    fetchMasterData(true);
  };

  const applyMasterFilters = (nextFilters?: MasterFiltersDraft) => {
    const source = nextFilters ?? masterFiltersDraft;
    setMasterSearchQuery(source.searchQuery);
    setMasterAgentFilter(source.agentFilter);
    setMasterDateStart(source.dateStart);
    setMasterDateEnd(source.dateEnd);
    setMasterStatusFilter(source.statusFilter);
    setMasterShiftFilter(source.shiftFilter);
    setMasterBreakViolationFilter(source.breakViolationFilter);
    setMasterOvertimeFilter(source.overtimeFilter);
    setMasterUnderShiftFilter(source.underShiftFilter);
    setMasterSortBy(source.sortBy);
    setMasterCurrentPage(1);
    setMasterFiltersApplied(true);
  };

  const applyOtRecordFilters = (nextFilters?: OtRecordFilters) => {
    const source = nextFilters ?? otRecordFiltersDraft;
    setOtRecordSearchQuery(source.searchQuery);
    setOtRecordDateStart(source.dateStart);
    setOtRecordDateEnd(source.dateEnd);
    setOtRecordShiftFilter(source.shiftFilter);
    setOtRecordStatusFilter(source.statusFilter);
  };

  const resetMasterFilters = () => {
    const next = buildTodayMasterFilters();
    setMasterFiltersDraft(next);
    applyMasterFilters(next);
    setMasterFiltersApplied(true);
    setMasterFocusMode('all');
    fetchMasterData(true);
  };

  const buildTodayMasterFilters = (overrides: Partial<MasterFiltersDraft> = {}) => {
    const today = formatDateInput(new Date());
    return {
      ...createDefaultMasterFilters(),
      searchQuery: '',
      dateStart: today,
      dateEnd: today,
      ...overrides
    };
  };

  const buildTodayOtRecordFilters = (overrides: Partial<OtRecordFilters> = {}) => {
    const today = formatDateInput(new Date());
    return {
      ...createDefaultOtRecordFilters(),
      dateStart: today,
      dateEnd: today,
      ...overrides
    };
  };

  const applyOverviewRangeToMaster = () => {
    const next = {
      ...masterFiltersDraft,
      dateStart: formatDateInput(overviewRangeBounds.start),
      dateEnd: formatDateInput(overviewRangeBounds.end),
      searchQuery: '',
      agentFilter: '',
      shiftFilter: 'All'
    };
    setMasterFiltersDraft(next);
    applyMasterFilters(next);
    setMasterFiltersApplied(true);
    setMasterFocusMode('all');
    fetchMasterData(true);
  };

  const applyTodayToMaster = () => {
    const next = buildTodayMasterFilters();
    setMasterFiltersDraft(next);
    applyMasterFilters(next);
    setMasterFocusMode('all');
    setMasterFiltersApplied(true);
    fetchMasterData(true);
  };

  const openTodayInbound = () => {
    const next = buildTodayMasterFilters({ sortBy: 'inbound' });
    setMasterFiltersDraft(next);
    applyMasterFilters(next);
    setMasterFocusMode('all');
    setMasterFiltersApplied(true);
    fetchMasterData(true);
    setActiveTab('all-logs');
  };

  const openTodayOutbound = () => {
    const next = buildTodayMasterFilters({ sortBy: 'outbound' });
    setMasterFiltersDraft(next);
    applyMasterFilters(next);
    setMasterFocusMode('all');
    setMasterFiltersApplied(true);
    fetchMasterData(true);
    setActiveTab('all-logs');
  };

  const openTodayHalfDay = () => {
    const next = buildTodayMasterFilters({ shiftFilter: 'Half Day' });
    setMasterFiltersDraft(next);
    applyMasterFilters(next);
    setMasterFocusMode('all');
    setMasterFiltersApplied(true);
    fetchMasterData(true);
    setActiveTab('all-logs');
  };

  const openTodayFullDay = () => {
    const next = buildTodayMasterFilters({ shiftFilter: 'Full Day' });
    setMasterFiltersDraft(next);
    applyMasterFilters(next);
    setMasterFocusMode('all');
    setMasterFiltersApplied(true);
    fetchMasterData(true);
    setActiveTab('all-logs');
  };

  const openUnderShiftFullDay = () => {
    const next = buildTodayMasterFilters({ shiftFilter: 'Full Day', underShiftFilter: 'Full Day' });
    setMasterFiltersDraft(next);
    applyMasterFilters(next);
    setMasterFocusMode('all');
    setMasterFiltersApplied(true);
    fetchMasterData(true);
    setActiveTab('all-logs');
  };

  const openUnderShiftHalfDay = () => {
    const next = buildTodayMasterFilters({ shiftFilter: 'Half Day', underShiftFilter: 'Half Day' });
    setMasterFiltersDraft(next);
    applyMasterFilters(next);
    setMasterFocusMode('all');
    setMasterFiltersApplied(true);
    fetchMasterData(true);
    setActiveTab('all-logs');
  };

  const applyOverviewRangeToOtApprovals = () => {
    setOtApprovalDateStart(formatDateInput(overviewRangeBounds.start));
    setOtApprovalDateEnd(formatDateInput(overviewRangeBounds.end));
    setOtApprovalShiftFilter('All');
    setOtApprovalSearchQuery('');
    setOtApprovalStatusFilter('All');
  };

  const openNeedsAttention = () => {
    applyOverviewRangeToMaster();
    setMasterFocusMode('needs');
    setActiveTab('all-logs');
  };

  const openTopPerformers = () => {
    applyOverviewRangeToMaster();
    setMasterFocusMode('top');
    setActiveTab('all-logs');
  };

  const openPendingOt = () => {
    applyOverviewRangeToOtApprovals();
    setActiveTab('ot-admin');
  };

  const drillEntries = useMemo(() => {
    if (!drillUserId) return [] as TimeData[];
    return [...(masterDataServer || [])]
      .filter(e => e.userId === drillUserId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);
  }, [drillUserId, masterDataServer]);

  const drillSummary = useMemo(() => {
    if (!drillUserId) return null;
    const all = (masterDataServer || []).filter(e => e.userId === drillUserId);
    let breakViolations = 0;
    let otCount = 0;
    let latest = 0;
    for (const entry of all) {
      const loginSec = timeToSeconds(entry.currentLogin || '00:00:00');
      const shiftBase = entry.shiftType === 'Full Day' ? 9 * 3600 : 4.5 * 3600;
      const breakSec = timeToSeconds(entry.pause || '00:00:00') + timeToSeconds(entry.dispo || '00:00:00') + timeToSeconds(entry.dead || '00:00:00');
      const breakLimit = entry.shiftType === 'Full Day' ? 7200 : 2700;
      if (breakSec > breakLimit) breakViolations += 1;
      if (loginSec > shiftBase) otCount += 1;
      const entryTime = new Date(entry.date).getTime();
      if (entryTime > latest) latest = entryTime;
    }
    return {
      total: all.length,
      breakViolations,
      otCount,
      latestDate: latest ? new Date(latest).toLocaleDateString() : 'N/A'
    };
  }, [drillUserId, masterDataServer]);

  useEffect(() => {
    if (user?.role === 'admin') { fetchMasterData(); fetchMigrations(); }
  }, [user, allUsers]);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    const intervalId = setInterval(() => {
      fetchMasterData();
    }, 15000);
    return () => clearInterval(intervalId);
  }, [user]);

  useEffect(() => {
    if (user?.role === 'admin') {
      const next = buildTodayMasterFilters();
      setMasterFiltersDraft(next);
      applyMasterFilters(next);
      const recordFilters = buildTodayOtRecordFilters();
      setOtRecordFiltersDraft(recordFilters);
      applyOtRecordFilters(recordFilters);
    }
  }, [user]);

  useEffect(() => {
    if (!rawText || !rawText.trim()) return;
    setParsedSignature(null);
  }, [rawText]);

  // Reset to page 1 when filters change (better UX)
  useEffect(() => {
    setMasterCurrentPage(1);
  }, [
    masterSearchQuery,
    masterStatusFilter,
    masterShiftFilter,
    masterDateStart,
    masterDateEnd,
    masterAgentFilter,
    masterBreakViolationFilter,
    masterOvertimeFilter,
    masterUnderShiftFilter,
    masterSortBy,
    masterSearchQuery
  ]);

  useEffect(() => {
    setDetailsCurrentPage(1);
  }, [detailsSearchQuery, detailsDateStart, detailsDateEnd, detailsStatusFilter, detailsShiftFilter]);

  const filteredDetailsEntries = useMemo(() => {
    let result = entries.filter(e => !isBlankEntry(e));

    // 1. Text Search (Expanded)
    if (detailsSearchQuery) {
      const q = detailsSearchQuery.toLowerCase();
      result = result.filter(e =>
        new Date(e.date).toLocaleDateString().includes(q) ||
        e.shiftType.toLowerCase().includes(q) ||
        (e.currentLogin && e.currentLogin.includes(q)) ||
        (e.reason && e.reason.toLowerCase().includes(q)) ||
        (e.status && e.status.toLowerCase().includes(q)) ||
        (e.talk && e.talk.includes(q)) ||
        (e.pause && e.pause.includes(q))
      );
    }

    // 2. Date Range Filter
    if (detailsDateStart) {
      const start = new Date(detailsDateStart);
      start.setHours(0, 0, 0, 0);
      result = result.filter(e => new Date(e.date) >= start);
    }
    if (detailsDateEnd) {
      const end = new Date(detailsDateEnd);
      end.setHours(23, 59, 59, 999);
      result = result.filter(e => new Date(e.date) <= end);
    }

    // 3. Status Filter
    if (detailsStatusFilter !== 'All') {
      result = result.filter(e => e.status === detailsStatusFilter);
    }

    // 4. Shift Filter
    if (detailsShiftFilter !== 'All') {
      result = result.filter(e => e.shiftType === detailsShiftFilter);
    }

    return result;
  }, [entries, detailsSearchQuery, detailsDateStart, detailsDateEnd, detailsStatusFilter, detailsShiftFilter]);

  // Paginated details entries (client-side pagination)
  const paginatedDetailsEntries = useMemo(() => {
    const startIdx = (detailsCurrentPage - 1) * detailsPageSize;
    const endIdx = startIdx + detailsPageSize;
    return filteredDetailsEntries.slice(startIdx, endIdx);
  }, [filteredDetailsEntries, detailsCurrentPage, detailsPageSize]);

  const detailsTotalPages = useMemo(() => Math.ceil(filteredDetailsEntries.length / detailsPageSize), [filteredDetailsEntries.length, detailsPageSize]);

  const otLogEntries = useMemo(() => {
    const eligibilitySec = 4.5 * 3600;
    return entries.filter(e => {
      if (e.emergencyOt) return false;
      const loginSec = timeToSeconds(e.currentLogin || '00:00:00');
      const shiftTarget = e.shiftType === 'Full Day' ? 9 * 3600 : 4.5 * 3600;
      const extra = loginSec - shiftTarget;
      return loginSec >= eligibilitySec && extra > 3600;
    });
  }, [entries]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-8 border-4 border-indigo-500/20">
          <div className="flex flex-col items-center mb-8">
            <div className="p-4 rounded-[1.5rem] text-white mb-4 shadow-xl bg-indigo-600">
              <ActivityIcon size={32} />
            </div>
            <h1 className="text-2xl font-black dark:text-white tracking-tight">WorkFlow Pro</h1>
            <p className="text-[10px] font-black tracking-widest uppercase mt-1 text-slate-400">Performance Audit Hub</p>
          </div>

          <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-8">
            <button onClick={() => setAuthRole('user')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${authRole === 'user' ? 'bg-white dark:bg-slate-700 shadow-lg text-indigo-600' : 'text-slate-400'}`}>Agent</button>
            <button onClick={() => setAuthRole('admin')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${authRole === 'admin' ? 'bg-white dark:bg-slate-700 shadow-lg text-amber-600' : 'text-slate-400'}`}>Admin</button>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authView === 'register' && authRole !== 'admin' && (
              <div className="group relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input required name="name" placeholder="Full Name" className="w-full pl-12 pr-5 py-4 bg-slate-50 dark:bg-slate-950 rounded-xl outline-none border-2 border-transparent focus:border-indigo-500 transition-all text-sm" />
              </div>
            )}
            {authRole === 'admin' && (
              <div className="group relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input required name="name" placeholder="Admin Name" className="w-full pl-12 pr-5 py-4 bg-slate-50 dark:bg-slate-950 rounded-xl outline-none border-2 border-transparent focus:border-indigo-500 transition-all text-sm uppercase font-black" />
              </div>
            )}
            {authRole !== 'admin' && (
              <div className="group relative">
                <IdCardIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input required name="empId" placeholder="Employee ID" className="w-full pl-12 pr-5 py-4 bg-slate-50 dark:bg-slate-950 rounded-xl outline-none border-2 border-transparent focus:border-indigo-500 transition-all text-sm uppercase font-black" />
              </div>
            )}
            <div className="group relative">
              <KeyIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input required name="password" type="password" placeholder="Password" className="w-full pl-12 pr-5 py-4 bg-slate-50 dark:bg-slate-950 rounded-xl outline-none border-2 border-transparent focus:border-indigo-500 transition-all text-sm" />
            </div>
            {authError && <div className="text-rose-500 text-[9px] font-black uppercase text-center">{authError}</div>}
            <button type="submit" className="w-full py-5 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl bg-indigo-600 hover:scale-[1.02] transition-all">
              {authView === 'login' ? 'Authorize Access' : 'Register Account'}
              <ArrowRightIcon className="inline ml-2" size={16} />
            </button>
          </form>

          <button onClick={() => { if (authRole === 'admin') { alert('Admin registration disabled. Default admin: TEAM '); return; } setAuthView(authView === 'login' ? 'register' : 'login'); }} className="w-full mt-6 text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] text-center hover:text-indigo-600 transition-colors">
            {authView === 'login' ? 'Create Account' : 'Back to Login'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950 transition-colors">
      {parseFailures >= 3 && (
        <div className="w-full p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-700 text-rose-700 dark:text-rose-200 flex justify-between items-center mb-4">
          <div className="text-sm font-bold">AI parsing has failed multiple times. Verify <code className="font-mono">GENAI_API_KEY</code> in Vercel or check server logs.</div>
          <div><button onClick={() => setParseFailures(0)} className="px-3 py-2 bg-rose-600 text-white rounded-lg text-xs font-bold">Dismiss</button></div>
        </div>
      )}
      {showOTModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-10 space-y-6 animate-in zoom-in duration-300">
            <div className="flex flex-col items-center text-center">
              <div className="p-4 bg-amber-500/10 rounded-3xl text-amber-500 mb-6"><AlertCircleIcon size={40} /></div>
              <h3 className="text-xl font-black dark:text-white uppercase tracking-tight">Overtime Threshold</h3>
              <p className="text-xs text-slate-500 mt-2">Duration <strong>{formData.currentLogin}</strong> exceeds base shift requirements.</p>
            </div>
            <div className="space-y-3">
              <button onClick={() => commitRecord(true)} className="w-full py-4 bg-amber-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">Apply for OT Approval</button>
              <button onClick={() => commitRecord(false)} className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest">Discard OT Claim</button>
              <button onClick={() => setShowOTModal(false)} className="w-full py-3 text-slate-400 font-bold text-[10px] uppercase tracking-widest">Return to Editor</button>
            </div>
          </div>
        </div>
      )}

      {rejectionModalOpen && actionedEntry && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-10 space-y-6 animate-in zoom-in duration-300">
            <div className="flex flex-col items-center text-center">
              <div className="p-4 bg-rose-500/10 rounded-3xl text-rose-500 mb-6"><XCircleIcon size={40} /></div>
              <h3 className="text-xl font-black dark:text-white uppercase tracking-tight">Reject Entry</h3>
              <p className="text-xs text-slate-500 mt-2">Provide a reason for rejecting this entry.</p>
            </div>
            <div className="space-y-3">
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full h-24 p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl outline-none text-xs font-mono resize-none border focus:border-rose-500 dark:text-white"
                placeholder="Rejection reason..."
              />
              <button
                onClick={() => {
                  updateStatus(actionedEntry.userId, actionedEntry.id, 'Rejected', rejectionReason);
                  setRejectionModalOpen(false);
                  setRejectionReason('');
                  setActionedEntry(null);
                }}
                className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl"
              >
                Confirm Rejection
              </button>
              <button
                onClick={() => {
                  setRejectionModalOpen(false);
                  setRejectionReason('');
                  setActionedEntry(null);
                }}
                className="w-full py-3 text-slate-400 font-bold text-[10px] uppercase tracking-widest"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {approvalModalOpen && actionedEntry && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-10 space-y-6 animate-in zoom-in duration-300">
            <div className="flex flex-col items-center text-center">
              <div className="p-4 bg-emerald-500/10 rounded-3xl text-emerald-500 mb-6"><CheckCircleIcon size={40} /></div>
              <h3 className="text-xl font-black dark:text-white uppercase tracking-tight">Approve Entry</h3>
              <p className="text-xs text-slate-500 mt-2">Are you sure you want to approve this entry?</p>
            </div>
            <div className="space-y-3">
              <textarea
                value={approvalReason}
                onChange={(e) => setApprovalReason(e.target.value)}
                className="w-full h-24 p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl outline-none text-xs font-mono resize-none border focus:border-emerald-500 dark:text-white"
                placeholder="Optional reason for approval..."
              />
              <button
                onClick={() => {
                  updateStatus(actionedEntry.userId, actionedEntry.id, 'Approved', approvalReason);
                  setApprovalModalOpen(false);
                  setApprovalReason('');
                  setActionedEntry(null);
                }}
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl"
              >
                Confirm Approval
              </button>
              <button
                onClick={() => {
                  setApprovalModalOpen(false);
                  setApprovalReason('');
                  setActionedEntry(null);
                }}
                className="w-full py-3 text-slate-400 font-bold text-[10px] uppercase tracking-widest"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {kpiModalOpen && (
        <div className="fixed inset-0 z-[105] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
          <div className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-8 space-y-6 animate-in zoom-in duration-300">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black dark:text-white uppercase tracking-tight">{kpiModalTitle}</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{kpiModalRows.length} Records</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={downloadKpiModalRows}
                  className="p-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-600"
                  title="Download"
                  type="button"
                >
                  <DownloadIcon size={16} />
                </button>
                <button onClick={() => setKpiModalOpen(false)} className="p-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500">
                  <XIcon size={16} />
                </button>
              </div>
            </div>

            {kpiModalRows.length === 0 ? (
              <div className="py-20 text-center text-[11px] font-bold uppercase tracking-widest text-slate-400">No records found</div>
            ) : (
              <div className="max-h-[60vh] overflow-auto rounded-2xl border border-slate-100 dark:border-slate-800">
                <table className="min-w-full text-left text-[11px]">
                  <thead className="bg-slate-50 dark:bg-slate-800/40 text-[10px] uppercase tracking-widest text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Emp ID</th>
                      {kpiModalMeta.hasCount && <th className="px-4 py-3">Count</th>}
                      {kpiModalMeta.hasDate && <th className="px-4 py-3">Date</th>}
                      {kpiModalMeta.hasShift && <th className="px-4 py-3">Shift</th>}
                      {kpiModalMeta.hasInbound && <th className="px-4 py-3">Inbound</th>}
                      {kpiModalMeta.hasOutbound && <th className="px-4 py-3">Outbound</th>}
                      {kpiModalMeta.hasLogin && <th className="px-4 py-3">Login</th>}
                      {kpiModalMeta.hasBreak && <th className="px-4 py-3">Break</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {kpiModalRows.map(row => (
                      <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-3 font-black uppercase dark:text-white">{row.name}</td>
                        <td className="px-4 py-3 font-mono text-slate-500 uppercase">{row.empId}</td>
                        {kpiModalMeta.hasCount && <td className="px-4 py-3 font-black text-indigo-600">{row.count ?? '-'}</td>}
                        {kpiModalMeta.hasDate && <td className="px-4 py-3 text-slate-500">{row.date ? new Date(row.date).toLocaleDateString() : '-'}</td>}
                        {kpiModalMeta.hasShift && <td className="px-4 py-3 text-slate-500">{row.shiftType || '-'}</td>}
                        {kpiModalMeta.hasInbound && <td className="px-4 py-3 font-black text-indigo-600">{row.inbound ?? 0}</td>}
                        {kpiModalMeta.hasOutbound && <td className="px-4 py-3 font-black text-emerald-600">{row.outbound ?? 0}</td>}
                        {kpiModalMeta.hasLogin && <td className="px-4 py-3 font-mono text-slate-600">{typeof row.loginSec === 'number' ? secondsToTime(row.loginSec) : '-'}</td>}
                        {kpiModalMeta.hasBreak && <td className="px-4 py-3 font-mono text-rose-600">{typeof row.breakSec === 'number' ? secondsToTime(row.breakSec) : '-'}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end">
              <button onClick={() => setKpiModalOpen(false)} className="px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500">Close</button>
            </div>
          </div>
        </div>
      )}
      {showMigrationModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-8 space-y-6 animate-in zoom-in duration-300">
            <div className="flex flex-col items-center text-center">
              <div className="p-4 bg-indigo-500/10 rounded-3xl text-indigo-500 mb-4"><AlertCircleIcon size={34} /></div>
              <h3 className="text-xl font-black dark:text-white uppercase tracking-tight">Run Local Migration</h3>
              <p className="text-sm text-slate-500 mt-2">This will copy any local <strong>users</strong> and optional <strong>entries</strong> from your browser into the central database. This action can be repeated but is intended as a one-time import.</p>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={migrationIncludeEntries} onChange={() => setMigrationIncludeEntries(p => !p)} /> Include entries in migration</label>
            </div>

            <div className="space-y-3">
              <button onClick={() => { setShowMigrationModal(false); }} disabled={isMigrating} className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest">Cancel</button>
              <button onClick={() => runMigrationNow(migrationIncludeEntries)} disabled={isMigrating} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">{isMigrating ? 'Migrating...' : 'Run migration now'}</button>
              <button onClick={() => setShowMigrationModal(false)} className="w-full py-3 text-slate-400 font-bold text-[10px] uppercase tracking-widest">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Data Confirmation Modal 1 */}
      {showResetConfirm1 && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-10 space-y-6 animate-in zoom-in duration-300">
            <div className="flex flex-col items-center text-center">
              <div className="p-4 bg-rose-500/10 rounded-3xl text-rose-500 mb-6"><TrashIcon size={40} /></div>
              <h3 className="text-xl font-black dark:text-white uppercase tracking-tight">Reset All Data?</h3>
              <p className="text-sm text-slate-500 mt-2">Are you sure? This will <strong>permanently delete</strong> all your performance history and entries. Your account credentials will remain.</p>
            </div>
            <div className="space-y-3">
              <button onClick={() => { setShowResetConfirm1(false); setShowResetConfirm2(true); }} className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">Yes, Clean Everything</button>
              <button onClick={() => setShowResetConfirm1(false)} className="w-full py-3 text-slate-400 font-bold text-[10px] uppercase tracking-widest">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Data Confirmation Modal 2 (Final Warning) */}
      {showResetConfirm2 && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-10 space-y-6 animate-in zoom-in duration-300 border-2 border-rose-500">
            <div className="flex flex-col items-center text-center">
              <div className="p-4 bg-rose-500/10 rounded-3xl text-rose-500 mb-6"><ShieldAlertIcon size={40} /></div>
              <h3 className="text-2xl font-black text-rose-500 uppercase tracking-tight">Final Warning</h3>
              <p className="text-sm text-slate-500 mt-2">This action is <strong>IRREVERSIBLE</strong>. All your logged data will be lost forever. <br /><br />Confirm reset?</p>
            </div>
            <div className="space-y-3">
              <button onClick={deleteAllEntries} className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl animate-pulse">CONFIRM PERMANENT RESET</button>
              <button onClick={() => setShowResetConfirm2(false)} className="w-full py-3 text-slate-400 font-bold text-[10px] uppercase tracking-widest">Cancel, keep my data</button>
            </div>
          </div>
        </div>
      )}

      <aside className={`w-full md:w-60 flex flex-col p-5 shadow-2xl ${user.role === 'admin' ? 'bg-slate-950' : 'bg-slate-900'} text-white`}>
        <div className="flex items-center gap-3 mb-10 px-2">
          <ActivityIcon size={20} className={user.role === 'admin' ? 'text-amber-500' : 'text-indigo-500'} />
          <span className="font-black text-lg tracking-tight">WorkFlow</span>
        </div>
        <div className="mb-8 p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs bg-indigo-600">{user.name.charAt(0)}</div>
          <div className="overflow-hidden"><p className="text-[11px] font-bold truncate uppercase">{user.name}</p><p className="text-[9px] text-slate-400 font-mono mt-1 opacity-60 uppercase">{user.empId}</p></div>
        </div>
        <nav className="flex-1 space-y-1">
          {user.role === 'admin' && (
            <>
              <button onClick={() => { setAdminViewingUserId(null); setActiveTab('admin-dashboard'); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'admin-dashboard' ? 'bg-amber-600 text-white font-bold' : 'text-slate-400 hover:bg-white/5'}`}><LayoutGridIcon size={16} /> Admin Dashboard</button>
              <button onClick={() => { setAdminViewingUserId(null); setActiveTab('admin'); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'admin' && !adminViewingUserId ? 'bg-amber-600 text-white font-bold' : 'text-slate-400 hover:bg-white/5'}`}><UsersIcon size={16} /> Team Hub</button>
              <button onClick={() => { setAdminViewingUserId(null); setActiveTab('ot-admin'); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'ot-admin' ? 'bg-amber-600 text-white font-bold' : 'text-slate-400 hover:bg-white/5'}`}><ZapIcon size={16} /> OT Approvals</button>
              <button onClick={() => { setAdminViewingUserId(null); setMasterFocusMode('all'); setActiveTab('all-logs'); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'all-logs' ? 'bg-amber-600 text-white font-bold' : 'text-slate-400 hover:bg-white/5'}`}><LayersIcon size={16} /> Master Stream</button>
            </>
          )}
          {user.role !== 'admin' && (
            <>
              <button onClick={() => setActiveTab('calc')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'calc' ? 'bg-indigo-600' : 'text-slate-400 hover:bg-white/5'}`}><ClockIcon size={16} /> Dashboard</button>
              <button onClick={() => setActiveTab('details')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'details' ? 'bg-indigo-600' : 'text-slate-400 hover:bg-white/5'}`}><LayoutGridIcon size={16} /> Sequential Data</button>
              <button onClick={() => setActiveTab('ot-log')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'ot-log' ? 'bg-indigo-600' : 'text-slate-400 hover:bg-white/5'}`}><ZapIcon size={16} /> OT Records</button>
            </>
          )}
        </nav>
        <div className="mt-auto pt-6 space-y-2">
          <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="w-full flex items-center gap-3 px-4 py-2 text-[10px] font-bold uppercase text-slate-500 hover:text-white">{theme === 'light' ? <MoonIcon size={14} /> : <SunIcon size={14} />} Theme</button>
          {user.role === 'user' && (
            <button onClick={() => setShowResetConfirm1(true)} className="w-full flex items-center gap-3 px-4 py-2 text-[10px] font-bold uppercase text-rose-500 hover:text-rose-400"><TrashIcon size={14} /> Reset Data</button>
          )}
          <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-2 text-[10px] font-bold uppercase text-rose-500 hover:text-rose-400"><LogOutIcon size={14} /> Logout</button>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-8 overflow-y-auto scrollbar-hide">
        <div className="max-w-7xl mx-auto space-y-8">
          {adminViewingUserId && (
            <div className="flex items-center justify-between bg-amber-500/5 border border-amber-500/10 p-4 rounded-2xl">
              <div className="flex items-center gap-4">
                <button onClick={() => setAdminViewingUserId(null)} className="p-2 bg-white dark:bg-slate-900 rounded-xl text-amber-600"><ArrowLeftIcon size={18} /></button>
                <div><h3 className="text-sm font-black dark:text-white uppercase">{viewingUser?.name}</h3><p className="text-[9px] text-amber-600 uppercase font-black">{viewingUser?.empId}</p></div>
              </div>
              <ShieldAlertIcon className="text-amber-600" size={18} />
            </div>
          )}

          {activeTab === 'calc' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-500">
              <div className="lg:col-span-8 space-y-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border dark:border-slate-800">
                  <div className="flex items-center gap-2 mb-3"><SparklesIcon size={14} className="text-indigo-500" /><h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Performance Injector</h4></div>
                  <textarea value={rawText} onChange={(e) => setRawText(e.target.value)} className="w-full h-24 p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl outline-none text-xs font-mono resize-none border focus:border-indigo-500 dark:text-white" placeholder="Paste squashed dialer performance text..." />
                  <button onClick={handleAIParsing} disabled={isParsing || !rawText} className={`w-full mt-3 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest bg-slate-900 text-white ${isParsing || !rawText ? 'opacity-50' : ''}`}>{isParsing ? <RefreshCcwIcon className="animate-spin" size={14} /> : 'Auto-Extract Metrics'}</button>
                </div>

                <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border dark:border-slate-800">
                  <div className="flex justify-between mb-8 items-center">
                    <h2 className="font-black text-sm uppercase dark:text-white flex items-center gap-3"><ActivityIcon className="text-indigo-500" size={18} /> Audit Inspector</h2>
                    <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                      <button onClick={() => setShiftType('Full Day')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${shiftType === 'Full Day' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Full Day</button>
                      <button onClick={() => setShiftType('Half Day')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${shiftType === 'Half Day' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Half Day</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                    {[
                      { l: 'Login At', n: 'loginTimestamp', i: <LogInIcon size={12} /> },
                      { l: 'Logout At', n: 'logoutTimestamp', i: <LogOutIcon size={12} /> },
                      { l: 'Login Dur.', n: 'currentLogin', i: <ClockIcon size={12} /> },
                      { l: 'Talk Time', n: 'talk', i: <UserCheckIcon size={12} /> },
                      { l: 'Pause Time', n: 'pause', i: <CoffeeIcon size={12} /> },
                      { l: 'Dispo Time', n: 'dispo', i: <RefreshCcwIcon size={12} /> },
                      { l: 'Dead Time', n: 'dead', i: <TrashIcon size={12} /> },
                      { l: 'Inbound', n: 'inbound', i: <PhoneIncomingIcon size={12} />, t: 'number' },
                      { l: 'Outbound', n: 'outbound', i: <PhoneOutgoingIcon size={12} />, t: 'number' },
                      { l: 'Customer Talk', n: 'customerTalk', i: <UserCheckIcon size={12} /> },
                      { l: 'Hold Time', n: 'hold', i: <TimerIcon size={12} /> },
                      { l: 'Wait Time', n: 'wait', i: <ActivityIcon size={12} /> },
                    ].map(f => (
                      <div key={f.n} className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 pl-1">{f.i} {f.l}</label><input type={f.t || 'text'} value={(formData as any)[f.n]} onChange={(e) => setFormData({ ...formData, [f.n]: f.t === 'number' ? parseInt(e.target.value) || 0 : e.target.value })} onBlur={(e) => f.t !== 'number' && setFormData({ ...formData, [f.n]: autoCorrectTime(e.target.value) })} className="w-full p-3 bg-slate-50 dark:bg-slate-950 rounded-xl outline-none border focus:border-indigo-500/20 font-mono text-xs dark:text-white" /></div>
                    ))}
                  </div>

                  <div className="mt-6">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Notes / Reason</label>
                    <textarea value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} placeholder="Optional note: reason for OT or any comment" className="w-full mt-2 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl outline-none border focus:border-indigo-500/20 font-mono text-xs dark:text-white" rows={3} />
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <input
                      id="emergency-ot"
                      type="checkbox"
                      checked={emergencyOt}
                      onChange={(e) => setEmergencyOt(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <label htmlFor="emergency-ot" className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                      Emergency OT (Min 1 Hour)
                    </label>
                  </div>

                  <div className="flex gap-3 mt-8">
                    {editingId && (<button onClick={() => { setEditingId(null); setFormData(INITIAL_FORM_STATE); setEmergencyOt(false); }} className="px-6 py-4 bg-slate-200 text-slate-600 rounded-2xl font-black text-[10px] uppercase">Cancel</button>)}
                    <button onClick={saveToHistory} className={`flex-1 py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl text-white bg-indigo-600`}>{editingId ? 'Update Session' : 'Commit Audit'}</button>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4 space-y-6">
                <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border dark:border-slate-800 space-y-8">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Real-time Session Status</p>

                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <span className="text-[8px] font-black text-slate-400 uppercase leading-none">Logged Duration</span>
                        <div className={`text-2xl font-black font-mono tracking-tighter dark:text-white ${loginExceeded ? 'text-rose-600' : ''}`}>{formData.currentLogin}</div>
                      </div>
                      <div className="text-right space-y-1">
                        <span className="text-[8px] font-black text-slate-400 uppercase leading-none">Total Login Remaining</span>
                        <div className={`text-sm font-black font-mono tracking-tighter ${loginExceeded ? 'text-rose-600' : 'text-emerald-500'}`}>{secondsToTime(loginRemainingSec)}</div>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-1000 ${loginExceeded ? 'bg-rose-500' : 'bg-indigo-500'}`}
                        style={{ width: `${Math.min(100, (loginSec / shiftBase) * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[7px] font-black uppercase text-slate-400">
                      <span>Shift Start</span>
                      <span>Target: {secondsToTime(shiftBase)}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <span className="text-[8px] font-black text-slate-400 uppercase leading-none">Break Balance Used</span>
                        <div className={`text-2xl font-black font-mono tracking-tighter dark:text-white ${breakExceeded ? 'text-rose-600' : ''}`}>{secondsToTime(totalBreakSec)}</div>
                      </div>
                      <div className="text-right space-y-1">
                        <span className="text-[8px] font-black text-slate-400 uppercase leading-none">Total Pause Remaining</span>
                        <div className={`text-sm font-black font-mono tracking-tighter ${breakExceeded ? 'text-rose-600' : 'text-emerald-500'}`}>{secondsToTime(breakRemainingSec)}</div>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-1000 ${breakExceeded ? 'bg-rose-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(100, (totalBreakSec / breakLimit) * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[7px] font-black uppercase text-slate-400">
                      <span>Available</span>
                      <span>Cap: {secondsToTime(breakLimit)}</span>
                    </div>
                  </div>

                  {(otTrigger || emergencyOtEligible) && (
                    <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20 text-center animate-pulse">
                      <div className="text-[8px] font-black text-rose-600 uppercase tracking-widest flex items-center justify-center gap-2">
                        <ZapIcon size={12} /> {emergencyOt ? 'Emergency OT' : 'Overtime Detected'}: {secondsToTime(otSec)}
                      </div>
                    </div>
                  )}
                </div>

                <div className={`p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden bg-slate-900`}>
                  <div className="absolute -top-10 -right-10 p-10 opacity-10 rotate-12"><TrophyIcon size={150} /></div>
                  <p className="text-[10px] font-black uppercase opacity-60 mb-6 tracking-widest">Monthly Inbound Target</p>
                  <div className="flex gap-4 mb-8">
                    <div className="flex-1 p-3 bg-white/5 rounded-2xl border border-white/10 text-center"><div className="text-[8px] font-black opacity-40 uppercase mb-1">Inbound</div><div className="text-2xl font-black tracking-tighter leading-none">{monthlyStats.inbound}</div></div>
                    <div className="flex-1 p-3 bg-white/5 rounded-2xl border border-white/10 text-center"><div className="text-[8px] font-black opacity-40 uppercase mb-1">Outbound</div><div className="text-2xl font-black tracking-tighter leading-none">{monthlyStats.outbound}</div></div>
                  </div>
                  <div className="flex gap-4 mb-8">
                    <div className="flex-1 p-3 bg-white/5 rounded-2xl border border-white/10 text-center"><div className="text-[8px] font-black opacity-40 uppercase mb-1">Emergency Inbound</div><div className="text-xl font-black tracking-tighter leading-none">{monthlyEmergencyStats.inbound}</div></div>
                    <div className="flex-1 p-3 bg-white/5 rounded-2xl border border-white/10 text-center"><div className="text-[8px] font-black opacity-40 uppercase mb-1">Emergency Outbound</div><div className="text-xl font-black tracking-tighter leading-none">{monthlyEmergencyStats.outbound}</div></div>
                  </div>
                  <div className="space-y-4 relative z-10">
                    <div className="flex justify-between items-center text-[9px] font-black uppercase opacity-80"><span>Milestone Reach</span><span>{Math.round(Math.min(100, (monthlyStats.inbound / 2500) * 100))}%</span></div>
                    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden shadow-inner"><div className="h-full bg-indigo-400 transition-all duration-1000" style={{ width: `${Math.min(100, (monthlyStats.inbound / 2500) * 100)}%` }} /></div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {MILESTONES.map((target) => (
                        <div key={target} className={`flex flex-col items-center p-2 rounded-xl border border-white/5 transition-all duration-500 ${monthlyStats.inbound >= target ? 'bg-white/20 border-white/20' : 'opacity-20'}`}><span className="text-[9px] font-black">{target}</span></div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'details' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-wider dark:text-white">Sequential Performance Data</h2>
                  <p className="text-slate-400 text-[10px] font-bold mt-1 uppercase tracking-widest">
                    {selectedUsers.length > 0
                      ? `Showing data for ${selectedUsers.length} user${selectedUsers.length !== 1 ? 's' : ''}: ${allUsers.filter(u => selectedUsers.includes(u.id)).map(u => u.name).join(', ')}`
                      : viewingUser
                        ? `Excel-style Property Inspection for ${viewingUser.name}`
                        : 'Excel-style Property Inspection'
                    }
                  </p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => {
                    let dataToExport = filteredDetailsEntries;
                    if (selectedUsers.length > 0) {
                      // filteredDetailsEntries already respects selection
                    }
                    exportDailyPerformanceReport(dataToExport);
                  }} className="bg-emerald-600 px-6 py-3 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"><FileSpreadsheetIcon size={14} /> Download My Report</button>

                  <button onClick={() => {
                    if (selectedUsers.length > 0) {
                      const selectedUserObjects = allUsers.filter(u => selectedUsers.includes(u.id));
                      exportToExcel(entries, selectedUserObjects[0]); // Use first user for filename, but export all entries
                    } else if (viewingUser) {
                      exportToExcel(entries, viewingUser);
                    }
                  }} className="bg-indigo-600 px-6 py-3 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"><FileSpreadsheetIcon size={14} /> Performance XLSX</button>
                </div>
              </div>

              {adminViewingUserId && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border dark:border-slate-800 shadow-sm space-y-5">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Range</span>
                      <button onClick={() => setUserKpiRange('daily')} className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase ${userKpiRange === 'daily' ? 'bg-amber-600 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>Daily</button>
                      <button onClick={() => setUserKpiRange('weekly')} className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase ${userKpiRange === 'weekly' ? 'bg-amber-600 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>Weekly</button>
                      <button onClick={() => setUserKpiRange('monthly')} className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase ${userKpiRange === 'monthly' ? 'bg-amber-600 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>Monthly</button>
                      <button onClick={() => setUserKpiRange('yearly')} className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase ${userKpiRange === 'yearly' ? 'bg-amber-600 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>Yearly</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {[
                      { label: 'Inbound Calls', rows: userKpiData.inboundEntries, valueClass: 'text-indigo-600' },
                      { label: 'Outbound Calls', rows: userKpiData.outboundEntries, valueClass: 'text-emerald-600' },
                      { label: 'Half Days', rows: userKpiData.halfDayEntries, valueClass: 'text-amber-600' },
                      { label: 'Full Days', rows: userKpiData.fullDayEntries, valueClass: 'text-slate-900 dark:text-white' },
                      { label: 'Under Shift Full Day', rows: userKpiData.underShiftFullDayEntries, valueClass: 'text-rose-600' },
                      { label: 'Under Shift Half Day', rows: userKpiData.underShiftHalfDayEntries, valueClass: 'text-orange-600' },
                      { label: 'Total Login Days', rows: userKpiData.totalLoginEntries, valueClass: 'text-indigo-600' },
                      { label: 'Needs Attention Days', rows: userKpiData.needsAttentionEntries, valueClass: 'text-rose-600' },
                      { label: 'Top Performers Days', rows: userKpiData.topPerformerEntries, valueClass: 'text-emerald-600' },
                      { label: 'No of OTs', rows: userKpiData.otEntries, valueClass: 'text-amber-600' },
                      { label: 'Break Exceeded Users', rows: userKpiData.breakExceededEntries, valueClass: 'text-rose-600' }
                    ].map(card => (
                      <button
                        key={card.label}
                        onClick={() => openKpiModal(card.label, buildEntryRows(card.rows))}
                        className="group p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-left hover:shadow-md transition-all"
                        type="button"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{card.label}</p>
                            <div className={`text-2xl font-black mt-2 ${card.valueClass}`}>{card.rows.length}</div>
                          </div>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              exportDailyPerformanceReport(card.rows);
                            }}
                            className="p-2 rounded-xl bg-white/70 dark:bg-slate-900 text-slate-500 hover:text-indigo-600 shadow-sm"
                            title="Download"
                            type="button"
                          >
                            <DownloadIcon size={14} />
                          </button>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border dark:border-slate-800 shadow-sm space-y-6">
                <div className="relative group max-w-md">
                  <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                  <input
                    type="text"
                    placeholder="Search logs by date, shift, reason, status..."
                    value={detailsSearchQuery}
                    onChange={(e) => setDetailsSearchQuery(e.target.value)}
                    className="w-full py-4 bg-slate-50 dark:bg-slate-950 rounded-2xl outline-none pl-14 pr-8 text-xs font-bold border border-transparent focus:border-indigo-500/20 dark:text-white transition-all shadow-inner"
                  />
                </div>

                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">From Date</label>
                    <input type="date" value={detailsDateStart} onChange={(e) => setDetailsDateStart(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl outline-none text-xs font-bold dark:text-white shadow-inner" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">To Date</label>
                    <input type="date" value={detailsDateEnd} onChange={(e) => setDetailsDateEnd(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl outline-none text-xs font-bold dark:text-white shadow-inner" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Status</label>
                    <select value={detailsStatusFilter} onChange={(e) => setDetailsStatusFilter(e.target.value as any)} className="w-full p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl outline-none text-xs font-bold dark:text-white shadow-inner appearance-none cursor-pointer">
                      <option value="All">All Statuses</option>
                      <option value="Approved">Approved</option>
                      <option value="Pending">Pending</option>
                      <option value="Rejected">Rejected</option>
                      <option value="N/A">N/A</option>
                    </select>
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Shift</label>
                    <select value={detailsShiftFilter} onChange={(e) => setDetailsShiftFilter(e.target.value as any)} className="w-full p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl outline-none text-xs font-bold dark:text-white shadow-inner appearance-none cursor-pointer">
                      <option value="All">All Shifts</option>
                      <option value="Full Day">Full Day</option>
                      <option value="Half Day">Half Day</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-[2rem] border dark:border-slate-800/50">
                  <table className="w-full text-left text-[13px] border-collapse min-w-[1300px]">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-400 uppercase font-black tracking-[0.1em] text-[10px] sticky top-0 z-10 border-b dark:border-slate-800">
                      <tr>
                        <th className="px-4 py-5">Agent</th>
                        <th className="px-4 py-5 whitespace-nowrap">Extraction Date</th>
                        <th className="px-4 py-5">Shift</th>
                        <th className="px-4 py-5">Login Dur.</th>
                        <th className="px-4 py-5">Talk Time</th>
                        <th className="px-4 py-5">Cust Talk</th>
                        <th className="px-4 py-5">Hold Time</th>
                        <th className="px-4 py-5">Pause</th>
                        <th className="px-4 py-5">Dispo</th>
                        <th className="px-4 py-5">Dead</th>
                        <th className="px-4 py-5 font-bold text-indigo-500">Total Break</th>
                        <th className="px-4 py-5">Wait</th>
                        <th className="px-4 py-5">Reason</th>
                        <th className="px-4 py-5 text-center">Inbound</th>
                        <th className="px-4 py-5 text-center">Outbound</th>
                        <th className="px-4 py-5 text-center">Status</th>
                        <th className="px-4 py-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-800/50">
                      {paginatedDetailsEntries.map((e) => {
                        const tBrk = timeToSeconds(e.pause) + timeToSeconds(e.dispo) + timeToSeconds(e.dead);
                        const sLimit = e.shiftType === 'Full Day' ? 7200 : 2700;
                        const bExceed = tBrk > sLimit;

                        return (
                          <tr key={e.id} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-950/10 transition-colors">
                            <td className="px-4 py-5">
                              <div className="font-black uppercase dark:text-white">{e.userName || e.userId}</div>
                              <div className="text-[9px] text-slate-400 font-mono uppercase">{e.userId}</div>
                            </td>
                            <td className="px-4 py-5">
                              <div className="font-black dark:text-slate-200">{new Date(e.date).toLocaleDateString()}</div>
                              <div className="text-[9px] text-slate-400 uppercase font-bold">{new Date(e.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                            </td>
                            <td className="px-4 py-5"><span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-black uppercase text-[9px] dark:text-slate-300">{e.shiftType}</span></td>
                            <td className="px-4 py-5 font-mono font-black text-indigo-500">{e.currentLogin}</td>
                            <td className="px-4 py-5 font-mono dark:text-slate-300">{e.talk}</td>
                            <td className="px-4 py-5 font-mono dark:text-slate-300">{e.customerTalk}</td>
                            <td className="px-4 py-5 font-mono dark:text-slate-300">{e.hold}</td>
                            <td className="px-4 py-5 font-mono dark:text-slate-400">{e.pause}</td>
                            <td className="px-4 py-5 font-mono dark:text-slate-400">{e.dispo}</td>
                            <td className="px-4 py-5 font-mono dark:text-slate-400">{e.dead}</td>
                            <td className={`px-4 py-5 font-mono font-black ${bExceed ? 'text-rose-500' : 'text-emerald-500'}`}>{secondsToTime(tBrk)}</td>
                            <td className="px-4 py-5 font-mono dark:text-slate-400">{e.wait}</td>
                            <td className="px-4 py-5 text-sm text-slate-600">{e.reason ? (e.reason.length > 80 ? e.reason.slice(0, 77) + '...' : e.reason) : '-'}</td>
                            <td className="px-4 py-5 text-center font-black dark:text-slate-200">{e.inbound}</td>
                            <td className="px-4 py-5 text-center font-black dark:text-slate-200">{e.outbound || 0}</td>
                            <td className="px-4 py-5 text-center"><StatusBadge status={e.status} /></td>
                            <td className="px-4 py-5 text-right">
                              <div className="flex justify-end gap-1">
                                <button onClick={() => startEdit(e)} className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded transition-all"><EditIcon size={12} /></button>
                                <button onClick={() => deleteEntry(e.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded transition-all"><TrashIcon size={12} /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {paginatedDetailsEntries.length === 0 && (
                        <tr><td colSpan={17} className="px-6 py-24 text-center text-slate-400 font-bold uppercase tracking-[0.2em] opacity-30">No sequential entries recorded matching search criteria</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {detailsTotalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-950 rounded-2xl mt-4">
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      Showing {((detailsCurrentPage - 1) * detailsPageSize) + 1}-{Math.min(detailsCurrentPage * detailsPageSize, filteredDetailsEntries.length)} of {filteredDetailsEntries.length} entries
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setDetailsCurrentPage(1)} disabled={detailsCurrentPage === 1} className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed">First</button>
                      <button onClick={() => setDetailsCurrentPage(p => p - 1)} disabled={detailsCurrentPage === 1} className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed">Prev</button>
                      <span className="px-4 py-2 text-xs font-bold dark:text-white">Page {detailsCurrentPage} of {detailsTotalPages}</span>
                      <button onClick={() => setDetailsCurrentPage(p => p + 1)} disabled={detailsCurrentPage === detailsTotalPages} className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed">Next</button>
                      <button onClick={() => setDetailsCurrentPage(detailsTotalPages)} disabled={detailsCurrentPage === detailsTotalPages} className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed">Last</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'ot-log' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="flex justify-between items-center">
                <div><h2 className="text-xl font-black uppercase tracking-wider dark:text-white">Overtime Activity Log</h2><p className="text-slate-400 text-[10px] font-bold mt-1">Archive of sessions that exceeded base duration requirements</p></div>
                <button onClick={() => viewingUser && exportToExcel(otLogEntries, viewingUser)} className="bg-amber-600 px-6 py-3 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-amber-600/20 hover:bg-amber-700 transition-all"><ZapIcon size={14} /> Save OT Records</button>
              </div>

              <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border dark:border-slate-800 shadow-sm space-y-6">
                <div className="relative group max-w-lg">
                  <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                  <input
                    type="text"
                    placeholder="Search OT records by name, employee ID, or date (DD/MM/YYYY)..."
                    value={otAdminSearchQuery}
                    onChange={(e) => setOtAdminSearchQuery(e.target.value)}
                    className="w-full py-4 bg-slate-50 dark:bg-slate-950 rounded-2xl outline-none pl-14 pr-8 text-xs font-bold border border-transparent focus:border-indigo-500/20 dark:text-white transition-all shadow-inner"
                  />
                </div>

                <div className="overflow-x-auto rounded-[2rem] border dark:border-slate-800/50">
                  <table className="w-full text-left text-[13px]">
                    <thead className="bg-slate-50 dark:bg-slate-950/50 font-black uppercase tracking-[0.2em] text-slate-400 text-[10px]">
                      <tr>
                        <th className="px-6 py-5">Shift Date</th>
                        <th className="px-6 py-5">Logged Duration</th>
                        <th className="px-6 py-5 text-center">Calculated OT</th>
                        <th className="px-6 py-5 text-center">Approval Path</th>
                        <th className="px-6 py-5">Reason</th>
                        <th className="px-6 py-5 text-right">Commit Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-800/50">
                      {otLogEntries.map(e => {
                        const lSec = timeToSeconds(e.currentLogin);
                        const sBase = e.shiftType === 'Full Day' ? 9 * 3600 : 4.5 * 3600;
                        return (
                          <tr key={e.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                            <td className="px-6 py-6">
                              <span className="font-black dark:text-slate-200">{new Date(e.date).toLocaleDateString()}</span>
                              <span className="block text-[10px] text-slate-400 font-black uppercase mt-0.5">{e.shiftType}</span>
                            </td>
                            <td className="px-6 py-6 font-mono font-black dark:text-slate-400">{e.currentLogin}</td>
                            <td className="px-6 py-6 text-center text-amber-600 font-black font-mono">{secondsToTime(lSec - sBase)}</td>
                            <td className="px-6 py-6 text-center">
                              <StatusBadge status={e.status} />
                            </td>
                            <td className="px-6 py-6 text-sm text-slate-600">{e.reason ? (e.reason.length > 80 ? e.reason.slice(0, 77) + '...' : e.reason) : '-'}</td>
                            <td className="px-6 py-6 text-right">
                              <button onClick={() => startEdit(e)} className="text-indigo-500 hover:bg-indigo-500/5 px-3 py-1.5 rounded-lg font-bold text-[9px] uppercase transition-colors">Inspect Session</button>
                            </td>
                          </tr>
                        );
                      })}
                      {otLogEntries.length === 0 && (
                        <tr><td colSpan={6} className="px-6 py-24 text-center text-slate-400 font-bold uppercase tracking-widest opacity-30">No Overtime Activity Detected</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}



          {activeTab === 'admin-dashboard' && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black uppercase dark:text-white">Admin Dashboard</h2>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Overview page for daily decisions</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => setOverviewRange('today')} className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase ${overviewRange === 'today' ? 'bg-amber-600 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>Today</button>
                  <button onClick={() => setOverviewRange('weekly')} className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase ${overviewRange === 'weekly' ? 'bg-amber-600 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>Weekly</button>
                  <button onClick={() => setOverviewRange('monthly')} className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase ${overviewRange === 'monthly' ? 'bg-amber-600 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>Monthly</button>
                  <button onClick={() => setOverviewRange('yearly')} className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase ${overviewRange === 'yearly' ? 'bg-amber-600 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>Yearly</button>
                  <button onClick={() => setOverviewRange('custom')} className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase ${overviewRange === 'custom' ? 'bg-amber-600 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>Custom</button>
                </div>
              </div>

              {overviewRange === 'custom' && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border dark:border-slate-800 shadow-sm">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-2">From Date</label>
                      <input type="date" value={overviewCustomStart} onChange={(e) => setOverviewCustomStart(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl outline-none text-xs font-bold dark:text-white shadow-inner" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-2">To Date</label>
                      <input type="date" value={overviewCustomEnd} onChange={(e) => setOverviewCustomEnd(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl outline-none text-xs font-bold dark:text-white shadow-inner" />
                    </div>
                  </div>
                </div>
              )}

              <div className="dashboard bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-sm border dark:border-slate-800">
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
                  <button onClick={openInboundKpi} className="p-4 rounded-2xl bg-indigo-50 dark:bg-slate-950 border border-indigo-100 dark:border-slate-800 text-left hover:shadow-md transition-all">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Inbound Today</p>
                    <div className="text-2xl font-black text-indigo-600 mt-2">{rangeKpi.inboundTotal}</div>
                  </button>
                  <button onClick={openOutboundKpi} className="p-4 rounded-2xl bg-emerald-50 dark:bg-slate-950 border border-emerald-100 dark:border-slate-800 text-left hover:shadow-md transition-all">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Outbound Today</p>
                    <div className="text-2xl font-black text-emerald-600 mt-2">{rangeKpi.outboundTotal}</div>
                  </button>
                  <button onClick={openHalfDayKpi} className="p-4 rounded-2xl bg-amber-50 dark:bg-slate-950 border border-amber-100 dark:border-slate-800 text-left hover:shadow-md transition-all">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Half Day Today</p>
                    <div className="text-2xl font-black text-amber-600 mt-2">{rangeKpi.halfDayCount}</div>
                  </button>
                  <button onClick={openFullDayKpi} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-left hover:shadow-md transition-all">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Full Day Today</p>
                    <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">{rangeKpi.fullDayCount}</div>
                  </button>
                  <button onClick={openUnderShiftFullDayKpi} className="p-4 rounded-2xl bg-rose-50 dark:bg-slate-950 border border-rose-100 dark:border-slate-800 text-left hover:shadow-md transition-all">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Under Shift Full Day</p>
                    <div className="text-2xl font-black text-rose-600 mt-2">{rangeKpi.underShiftFullDay}</div>
                  </button>
                  <button onClick={openUnderShiftHalfDayKpi} className="p-4 rounded-2xl bg-orange-50 dark:bg-slate-950 border border-orange-100 dark:border-slate-800 text-left hover:shadow-md transition-all">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Under Shift Half Day</p>
                    <div className="text-2xl font-black text-orange-600 mt-2">{rangeKpi.underShiftHalfDay}</div>
                  </button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                  <button onClick={openTotalLoginUsers} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-left hover:shadow-md transition-all">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total Login Users</p>
                    <div className="text-2xl font-black text-indigo-600 mt-2">{overviewDerived.stats.totalUsers}</div>
                  </button>
                  <button onClick={openNeedsAttentionKpi} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-left hover:shadow-md transition-all">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Needs Attention</p>
                    <div className="text-2xl font-black text-rose-600 mt-2">{overviewDerived.stats.needsUsers}</div>
                  </button>
                  <button onClick={openTopPerformersKpi} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-left hover:shadow-md transition-all">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Top Performers</p>
                    <div className="text-2xl font-black text-emerald-600 mt-2">{overviewDerived.stats.topUsers}</div>
                  </button>
                  <button onClick={openPendingOtKpi} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-left hover:shadow-md transition-all">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">OT Requests Pending</p>
                    <div className="text-2xl font-black text-amber-600 mt-2">{overviewDerived.stats.pendingOtCount}</div>
                  </button>
                  <button onClick={openTotalOtKpi} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-left hover:shadow-md transition-all">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total OTs</p>
                    <div className="text-2xl font-black text-amber-600 mt-2">{rangeKpi.otCount}</div>
                  </button>
                  <button onClick={openBreakExceededKpi} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-left hover:shadow-md transition-all">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Break Exceeded Users</p>
                    <div className="text-2xl font-black text-rose-600 mt-2">{overviewDerived.stats.breakExceededUsers}</div>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
                  <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[9px] font-black uppercase tracking-widest text-rose-500">Needs Attention</p>
                      <button onClick={openNeedsAttention} className="text-[9px] font-black uppercase text-rose-600">View All</button>
                    </div>
                    {overviewDerived.needsAttention.length === 0 ? (
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">No records found</div>
                    ) : (
                      <div className="space-y-3">
                        {overviewDerived.needsAttention.slice(0, 5).map(item => {
                          const reasonText = item.entry.reason && item.entry.reason.trim()
                            ? (item.entry.reason.trim().length > 18 ? `${item.entry.reason.trim().slice(0, 18)}...` : item.entry.reason.trim())
                            : 'No Reason';
                          return (
                            <div key={item.entry.id} className="flex items-center justify-between">
                              <div>
                                <div className="text-xs font-black uppercase dark:text-white">{item.entry.userName || item.entry.userId}</div>
                                <div className="text-[9px] text-slate-400 font-bold uppercase">{new Date(item.entry.date).toLocaleDateString()}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs font-black text-rose-600 font-mono">{secondsToTime(item.breakSec)}</div>
                                <div className="text-[9px] text-slate-400 font-bold">Login {secondsToTime(item.loginSec)}</div>
                              </div>
                              <span className="px-2 py-1 rounded-full text-[8px] font-black uppercase bg-rose-100 text-rose-600">{reasonText}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Top Performers</p>
                      <button onClick={openTopPerformers} className="text-[9px] font-black uppercase text-emerald-600">View All</button>
                    </div>
                    {overviewDerived.topPerformers.length === 0 ? (
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">No records found</div>
                    ) : (
                      <div className="space-y-3">
                        {overviewDerived.topPerformers.slice(0, 5).map(item => (
                          <div key={item.entry.id} className="flex items-center justify-between">
                            <div>
                              <div className="text-xs font-black uppercase dark:text-white">{item.entry.userName || item.entry.userId}</div>
                              <div className="text-[9px] text-slate-400 font-bold uppercase">Inbound {item.entry.inbound || 0} · Outbound {item.entry.outbound || 0}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-black text-emerald-600 font-mono">{secondsToTime(item.breakSec)}</div>
                              <div className="text-[9px] text-slate-400 font-bold">Break Time</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[9px] font-black uppercase tracking-widest text-amber-500">Pending OT</p>
                      <button onClick={openPendingOt} className="text-[9px] font-black uppercase text-amber-600">View All</button>
                    </div>
                    {overviewDerived.pendingOt.length === 0 ? (
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">No records found</div>
                    ) : (
                      <div className="space-y-3">
                        {overviewDerived.pendingOt.slice(0, 5).map(item => (
                          <div key={item.entry.id} className="flex items-center justify-between">
                            <div>
                              <div className="text-xs font-black uppercase dark:text-white">{item.entry.userName || item.entry.userId}</div>
                              <div className="text-[9px] text-slate-400 font-bold uppercase">{new Date(item.entry.date).toLocaleDateString()} {new Date(item.entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-black text-amber-600 font-mono">{secondsToTime(Math.max(0, item.loginSec - item.shiftBase))}</div>
                              <div className="text-[9px] text-slate-400 font-bold">OT Requested</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'admin' && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-black uppercase dark:text-white">Team Hub</h2>
                <div className="flex items-center gap-3">
                  <button onClick={() => exportConsolidatedExcel(masterDataServer)} className="bg-amber-600 px-6 py-4 text-white rounded-xl font-black text-[10px] uppercase shadow-xl hover:bg-amber-700 transition-all">Master Analysis Report</button>
                  <button onClick={() => { fetchMigrations(); setActiveTab('migrations'); }} className="bg-slate-200 dark:bg-slate-800 px-4 py-3 rounded-xl text-[10px] font-black uppercase">Migration Reports</button>
                  <button onClick={() => setShowMigrationModal(true)} disabled={isMigrating} className="bg-emerald-600 px-4 py-3 rounded-xl text-[10px] font-black uppercase text-white">{isMigrating ? 'Migrating...' : 'Run migration now'}</button>
                  <button onClick={() => setShowPasswords(p => !p)} className="bg-slate-200 dark:bg-slate-800 px-4 py-3 rounded-xl text-[10px] font-black uppercase">{showPasswords ? 'Hide Passwords' : 'Show Passwords'}</button>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-sm border dark:border-slate-800">
                <div className="relative mb-8 group"><SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-amber-500 transition-colors" size={16} /><input type="text" placeholder="Search team by ID or name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full py-5 bg-slate-50 dark:bg-slate-950 rounded-3xl outline-none pl-14 pr-8 text-xs font-bold border focus:border-amber-500/20 dark:text-white shadow-inner" /></div>
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-4">
                    <button onClick={() => { setSelectedUsers(allUsers.filter(u => u.role !== 'admin').map(u => u.id)); }} className="px-4 py-2 bg-slate-200 dark:bg-slate-800 rounded-xl text-[10px] font-black uppercase">Select All</button>
                    <button onClick={() => { setSelectedUsers([]); }} className="px-4 py-2 bg-slate-200 dark:bg-slate-800 rounded-xl text-[10px] font-black uppercase">Clear Selection</button>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">{selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected</span>
                  </div>
                  <button
                    onClick={() => {
                      if (selectedUsers.length === 0) {
                        pushToast('Please select at least one user', 'warning');
                        return;
                      }
                      setAdminViewingUserId(null);
                      setActiveTab('details');
                    }}
                    className="px-6 py-3 bg-amber-600 text-white rounded-xl font-black text-[10px] uppercase shadow-xl hover:bg-amber-700 transition-all"
                  >
                    View Selected Data
                  </button>
                </div>
                <div className="space-y-8">
                  {(() => {
                    const filteredUsers = allUsers.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.empId.toLowerCase().includes(searchQuery.toLowerCase()));
                    const admins = filteredUsers.filter(u => u.role === 'admin');
                    const users = filteredUsers.filter(u => u.role !== 'admin');

                    const renderUserCard = (u: User) => {
                      const isSelected = selectedUsers.includes(u.id);
                      return (
                        <div key={u.id} className={`p-6 bg-slate-50 dark:bg-slate-950 rounded-3xl flex items-center justify-between hover:ring-2 hover:ring-amber-500 transition-all cursor-pointer group shadow-sm ${isSelected ? 'ring-2 ring-amber-500 bg-amber-50 dark:bg-amber-950/20' : ''}`} onClick={() => { setAdminViewingUserId(u.id); setActiveTab('details'); }}>
                          <div className="flex items-center gap-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                if (isSelected) {
                                  setSelectedUsers(prev => prev.filter(id => id !== u.id));
                                } else {
                                  setSelectedUsers(prev => [...prev, u.id]);
                                }
                              }}
                              className="w-4 h-4 text-amber-600 bg-slate-100 border-slate-300 rounded focus:ring-amber-500 dark:focus:ring-amber-600 dark:ring-offset-slate-800 focus:ring-2 dark:bg-slate-700 dark:border-slate-600"
                            />
                            <div className="w-12 h-12 bg-amber-600/10 text-amber-600 rounded-2xl flex items-center justify-center font-black text-sm group-hover:bg-amber-600 group-hover:text-white transition-all shadow-inner">{u.name.charAt(0)}</div>
                            <div className="overflow-hidden"><p className="text-sm font-black dark:text-white uppercase truncate">{u.name}</p><p className="text-[11px] font-mono text-slate-400 uppercase tracking-tighter mt-1">{u.empId}</p>{showPasswords && <p className="text-xs font-mono text-slate-500 mt-1">Password: <span className="font-black uppercase">{u.password || '-'}</span></p>}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <button onClick={(ev) => { ev.stopPropagation(); if (!confirm('Delete user and all their entries?')) return; deleteUser(u.id); }} title="Delete User" className="p-2 bg-rose-50/20 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-all"><TrashIcon size={14} /></button>
                            <ChevronRightIcon size={18} className="text-slate-300 group-hover:translate-x-2 transition-all" />
                          </div>
                        </div>
                      );
                    };

                    return (
                      <>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Admins</p>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">{admins.length} admin{admins.length !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {admins.map(renderUserCard)}
                            {admins.length === 0 && (
                              <div className="col-span-full text-[10px] font-black uppercase tracking-widest text-slate-400 opacity-60">No admins match your search</div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Users</p>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">{users.length} user{users.length !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {users.map(renderUserCard)}
                            {users.length === 0 && (
                              <div className="col-span-full text-[10px] font-black uppercase tracking-widest text-slate-400 opacity-60">No users match your search</div>
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'migrations' && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-black uppercase dark:text-white">Migration Reports</h2>
                <div className="flex items-center gap-3">
                  <button onClick={() => fetchMigrations()} className="bg-amber-600 px-6 py-4 text-white rounded-xl font-black text-[10px] uppercase shadow-xl hover:bg-amber-700 transition-all">Refresh</button>
                  <button onClick={() => { setActiveTab('admin'); }} className="bg-slate-200 px-4 py-3 rounded-xl text-[10px] font-black uppercase">Back to Team Hub</button>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border dark:border-slate-800 shadow-sm">
                {migrations.length === 0 ? (
                  <div className="px-6 py-24 text-center text-slate-400 font-bold uppercase tracking-widest opacity-30">No migration reports found</div>
                ) : (
                  <div className="space-y-4">
                    <table className="w-full text-left text-sm">
                      <thead className="text-slate-400 uppercase text-[10px] font-black">
                        <tr>
                          <th className="px-4 py-3">Timestamp</th>
                          <th className="px-4 py-3">Users</th>
                          <th className="px-4 py-3">Entries</th>
                          <th className="px-4 py-3">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {migrations.map(m => (
                          <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                            <td className="px-4 py-4">{new Date(m.created_at).toLocaleString()}</td>
                            <td className="px-4 py-4 font-black">{m.migrated_users}</td>
                            <td className="px-4 py-4 font-black">{m.migrated_entries}</td>
                            <td className="px-4 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button onClick={() => setExpandedMigrationId(expandedMigrationId === m.id ? null : m.id)} className="px-4 py-2 rounded-xl bg-indigo-500 text-white text-sm font-bold">{expandedMigrationId === m.id ? 'Hide' : 'View'}</button>
                                <button onClick={() => downloadMigrationMapping(m.mapping, m.id, 'csv')} className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-sm font-bold">CSV</button>
                                <button onClick={() => downloadMigrationMapping(m.mapping, m.id, 'zip')} className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-sm font-bold">ZIP</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {expandedMigrationId && (() => {
                      const mi = migrations.find(x => x.id === expandedMigrationId); return mi ? (
                        <div className="mt-4">
                          <div className="flex justify-end gap-3 mb-2">
                            <button onClick={() => downloadMigrationMapping(mi.mapping, mi.id, 'csv')} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold">Download CSV</button>
                            <button onClick={() => downloadMigrationMapping(mi.mapping, mi.id, 'zip')} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold">Download ZIP</button>
                            <button onClick={() => { navigator.clipboard?.writeText(JSON.stringify(mi.mapping || {}, null, 2)); pushToast('Mapping copied to clipboard', 'success'); }} className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold">Copy</button>
                          </div>
                          <pre className="p-4 bg-slate-50 dark:bg-slate-950 rounded-lg text-xs font-mono overflow-auto">{JSON.stringify(mi.mapping || {}, null, 2)}</pre>
                        </div>
                      ) : null;
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'all-logs' && (
            <div className="animate-in fade-in duration-700 space-y-8">
              <div className="flex justify-between items-center">
                <div><h2 className="text-xl font-black uppercase dark:text-white">Master Property Stream</h2><p className="text-[10px] text-slate-400 font-bold mt-1">Enterprise audit of all extracted session properties (Excel Pattern)</p></div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const today = formatDateInput(new Date());
                      const hasDateFilter = Boolean(masterDateStart || masterDateEnd);
                      const source = hasDateFilter ? filteredMasterData : masterDataServer;
                      const daily = hasDateFilter
                        ? source
                        : source.filter(e => formatDateInput(new Date(e.date)) === today);
                      exportDailyPerformanceReport(daily);
                    }}
                    className="bg-indigo-600 px-6 py-4 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-indigo-700 transition-all shadow-indigo-600/20"
                  >
                    <FileSpreadsheetIcon size={16} className="mr-2 inline" /> Download Daily Report
                  </button>
                  <button onClick={() => exportConsolidatedExcel(masterDataServer)} className="bg-emerald-600 px-6 py-4 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-emerald-700 transition-all shadow-emerald-600/20"><FileSpreadsheetIcon size={16} className="mr-2 inline" /> Generate Team Report</button>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border dark:border-slate-800 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="relative group flex-1">
                    <SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
                    <input
                      type="text"
                      placeholder="Smart search: Agent, 2026-02-04, keyword in reason"
                      value={masterFiltersDraft.searchQuery}
                      onChange={(e) => setMasterFiltersDraft(prev => ({ ...prev, searchQuery: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleMasterSearchApply();
                        }
                      }}
                      list="master-search-list"
                      className="w-full py-4 bg-slate-50 dark:bg-slate-950 rounded-2xl outline-none pl-12 pr-6 text-xs font-bold border border-transparent focus:border-indigo-500/20 dark:text-white transition-all shadow-inner"
                    />
                    <datalist id="master-search-list">
                      {allUsers.map(u => (
                        <option key={u.id} value={`${u.name} (${u.empId})`} />
                      ))}
                    </datalist>
                  </div>
                  <button
                    onClick={resetMasterFilters}
                    className="px-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    Clear Filters
                  </button>
                  <button
                    onClick={handleMasterSearchApply}
                    className="px-5 py-3 rounded-2xl bg-indigo-600 text-white text-[10px] font-black uppercase hover:bg-indigo-700 transition-colors"
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => exportDailyPerformanceReport(filteredMasterData)}
                    className="px-5 py-3 rounded-2xl bg-indigo-600 text-white text-[10px] font-black uppercase hover:bg-indigo-700 transition-colors"
                  >
                    Export Current View (CSV)
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border dark:border-slate-800 shadow-sm space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Quick Views</span>
                    <button
                      onClick={() => {
                        const today = formatDateInput(new Date());
                        const next = { ...masterFiltersDraft, searchQuery: '', dateStart: today, dateEnd: today };
                        setMasterFiltersDraft(next);
                        applyMasterFilters(next);
                        fetchMasterData(true);
                      }}
                      className="px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase hover:bg-indigo-50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      type="button"
                    >
                      Today
                    </button>
                    <button
                      onClick={() => {
                        const next = {
                          ...masterFiltersDraft,
                          searchQuery: '',
                          sortBy: 'productivity',
                          breakViolationFilter: 'All',
                          overtimeFilter: 'All',
                          statusFilter: 'All'
                        };
                        setMasterFiltersDraft(next);
                        applyMasterFilters(next);
                        fetchMasterData(true);
                      }}
                      className="px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase hover:bg-indigo-50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      type="button"
                    >
                      Low Performers
                    </button>
                    <button
                      onClick={() => {
                        const next = { ...masterFiltersDraft, searchQuery: '', breakViolationFilter: 'Yes', overtimeFilter: 'All' };
                        setMasterFiltersDraft(next);
                        applyMasterFilters(next);
                        fetchMasterData(true);
                      }}
                      className="px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase hover:bg-indigo-50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      type="button"
                    >
                      Break Violations
                    </button>
                    <button
                      onClick={() => {
                        const next = { ...masterFiltersDraft, searchQuery: '', overtimeFilter: 'Yes' };
                        setMasterFiltersDraft(next);
                        applyMasterFilters(next);
                        fetchMasterData(true);
                      }}
                      className="px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase hover:bg-indigo-50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      type="button"
                    >
                      Overtime Review
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowMasterAdvancedFilters(v => !v)}
                      className="px-4 py-2 rounded-2xl bg-slate-900 text-white text-[9px] font-black uppercase hover:bg-slate-800 transition-colors"
                      type="button"
                    >
                      {showMasterAdvancedFilters ? 'Hide Advanced Filters' : 'Advanced Filters'}
                    </button>
                  </div>
                </div>
                {showMasterAdvancedFilters && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Agent</label>
                      <input
                        type="text"
                        value={masterFiltersDraft.agentFilter}
                        onChange={(e) => setMasterFiltersDraft(prev => ({ ...prev, agentFilter: e.target.value }))}
                        placeholder="Search agent name or ID"
                        list="agent-list"
                        className="w-full py-3 px-4 bg-slate-50 dark:bg-slate-950 rounded-2xl outline-none text-xs font-bold border focus:border-indigo-500/20 dark:text-white shadow-inner"
                      />
                      <datalist id="agent-list">
                        {allUsers.map(u => (
                          <option key={u.id} value={`${u.name} (${u.empId})`} />
                        ))}
                      </datalist>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-2">From</label>
                      <input
                        type="date"
                        value={masterFiltersDraft.dateStart}
                        onChange={(e) => setMasterFiltersDraft(prev => ({ ...prev, dateStart: e.target.value }))}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl outline-none text-xs font-bold dark:text-white shadow-inner"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-2">To</label>
                      <input
                        type="date"
                        value={masterFiltersDraft.dateEnd}
                        onChange={(e) => setMasterFiltersDraft(prev => ({ ...prev, dateEnd: e.target.value }))}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl outline-none text-xs font-bold dark:text-white shadow-inner"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Status</label>
                      <select
                        value={masterFiltersDraft.statusFilter}
                        onChange={(e) => setMasterFiltersDraft(prev => ({ ...prev, statusFilter: e.target.value as any }))}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl outline-none text-xs font-bold border focus:border-indigo-500/20 dark:text-white shadow-inner appearance-none cursor-pointer"
                      >
                        <option value="All">All</option>
                        <option value="Approved">Green</option>
                        <option value="Pending">Yellow</option>
                        <option value="Rejected">Red</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Break Violation</label>
                      <select
                        value={masterFiltersDraft.breakViolationFilter}
                        onChange={(e) => setMasterFiltersDraft(prev => ({ ...prev, breakViolationFilter: e.target.value as any }))}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl outline-none text-xs font-bold border focus:border-indigo-500/20 dark:text-white shadow-inner appearance-none cursor-pointer"
                      >
                        <option value="All">All</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Overtime</label>
                      <select
                        value={masterFiltersDraft.overtimeFilter}
                        onChange={(e) => setMasterFiltersDraft(prev => ({ ...prev, overtimeFilter: e.target.value as any }))}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl outline-none text-xs font-bold border focus:border-indigo-500/20 dark:text-white shadow-inner appearance-none cursor-pointer"
                      >
                        <option value="All">All</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto rounded-[2.5rem] border dark:border-slate-800">
                  <table className="w-full text-left text-[13px] min-w-[1300px]">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-400 uppercase font-black tracking-[0.1em] text-[10px] sticky top-0 z-10 border-b dark:border-slate-800">
                      <tr>
                        <th className="px-4 py-5">Agent Identity</th>
                        <th className="px-4 py-5">Timeline</th>
                        <th className="px-4 py-5">Shift</th>
                        <th className="px-4 py-5">Login Dur.</th>
                        <th className="px-4 py-5">Talk Time</th>
                        <th className="px-4 py-5">Pause</th>
                        <th className="px-4 py-5">Dispo</th>
                        <th className="px-4 py-5">Dead</th>
                        <th className="px-4 py-5 font-black text-indigo-500">Total Break</th>
                        <th className="px-4 py-5 text-center">Inbound</th>
                        <th className="px-4 py-5 text-center">Outbound</th>
                        <th className="px-4 py-5">Reason</th>
                        <th className="px-4 py-5 text-center">Status / OT</th>
                        <th className="px-4 py-5 text-right">Master Control</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-800/50">
                      {paginatedMasterData.map(log => {
                        const lSec = timeToSeconds(log.currentLogin);
                        const sBase = log.shiftType === 'Full Day' ? 9 * 3600 : 4.5 * 3600;
                        const tBrk = timeToSeconds(log.pause) + timeToSeconds(log.dispo) + timeToSeconds(log.dead);
                        const bLimit = log.shiftType === 'Full Day' ? 7200 : 2700;
                        const bExceed = tBrk > bLimit;
                        const isOvertime = lSec > sBase;
                        const isRejected = log.status === 'Rejected';
                        const isPending = log.status === 'Pending';
                        const rowClass = bExceed || isOvertime || isRejected
                          ? 'bg-rose-50/60 dark:bg-rose-950/20'
                          : isPending
                            ? 'bg-amber-50/60 dark:bg-amber-950/20'
                            : '';

                        return (
                          <tr key={log.id} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors ${rowClass}`}>
                            <td className="px-4 py-5">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-black text-xs shadow-sm">{log.userName?.charAt(0)}</div>
                                <button
                                  onClick={() => setDrillUserId(log.userId)}
                                  className="text-left"
                                >
                                  <div className="font-black dark:text-slate-200 uppercase">{log.userName}</div>
                                  <div className="text-[11px] font-mono text-slate-400 mt-0.5 uppercase">{log.userId}</div>
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-5">
                              <span className="font-bold text-slate-600 dark:text-slate-400 text-sm">{new Date(log.date).toLocaleDateString()}</span>
                              <span className="block text-[11px] text-indigo-500 font-black mt-1 uppercase tracking-widest">{log.shiftType}</span>
                            </td>
                            <td className="px-4 py-5"><span className="text-[10px] text-indigo-500 font-black uppercase">{log.shiftType}</span></td>
                            <td className="px-4 py-5 font-mono font-black text-indigo-500">{log.currentLogin}</td>
                            <td className="px-4 py-5 font-mono dark:text-slate-300">{log.talk}</td>
                            <td className="px-4 py-5 font-mono dark:text-slate-400">{log.pause}</td>
                            <td className="px-4 py-5 font-mono dark:text-slate-400">{log.dispo}</td>
                            <td className="px-4 py-5 font-mono dark:text-slate-400">{log.dead}</td>
                            <td className={`px-4 py-5 font-mono font-black ${bExceed ? 'text-rose-600' : 'text-emerald-600'}`}>{secondsToTime(tBrk)}</td>
                            <td className="px-4 py-5 text-center font-black dark:text-slate-200">{log.inbound}</td>
                            <td className="px-4 py-5 text-center font-black dark:text-slate-200">{log.outbound }</td>
                            <td className="px-4 py-5 text-sm text-slate-600">{log.reason ? (log.reason.length > 80 ? log.reason.slice(0, 77) + '...' : log.reason) : '-'}</td>
                            <td className="px-4 py-5 text-center">
                              <div className="flex flex-col items-center gap-2">
                                <StatusBadge status={log.status} />
                                {bExceed && <span className="text-[10px] font-black text-rose-600 uppercase">Break Violation</span>}
                                {isOvertime && <span className="text-[10px] font-black text-amber-600 uppercase">OT: {secondsToTime(lSec - sBase)}</span>}
                              </div>
                            </td>
                            <td className="px-4 py-5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {log.status === 'Pending' && (
                                  <div className="flex gap-1.5">
                                    <button onClick={(e) => { e.stopPropagation(); setActionedEntry(log); setApprovalModalOpen(true); }} className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm" title="Approve"><CheckCircleIcon size={16} /></button>
                                    <button onClick={(e) => { e.stopPropagation(); setActionedEntry(log); setRejectionModalOpen(true); }} className="p-2 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm" title="Reject"><XIcon size={16} /></button>
                                  </div>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); const internalUser = allUsers.find(u => u.empId.toLowerCase() === log.userId.toLowerCase()); if (internalUser) { setAdminViewingUserId(internalUser.id); startEdit(log); } }} className="p-2.5 text-slate-300 hover:text-indigo-500 transition-all" title="Edit Entry"><EditIcon size={16} /></button>
                                <button onClick={(e) => { e.stopPropagation(); deleteEntry(log.id, log.userId); }} className="p-2.5 text-slate-300 hover:text-rose-500 transition-all" title="Wipe Session"><TrashIcon size={16} /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {masterTotalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-950 rounded-2xl mt-4">
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      Showing {((masterCurrentPage - 1) * masterPageSize) + 1}-{Math.min(masterCurrentPage * masterPageSize, filteredMasterData.length)} of {filteredMasterData.length} entries
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setMasterCurrentPage(1)} disabled={masterCurrentPage === 1} className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed">First</button>
                      <button onClick={() => setMasterCurrentPage(p => p - 1)} disabled={masterCurrentPage === 1} className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed">Prev</button>
                      <span className="px-4 py-2 text-xs font-bold dark:text-white">Page {masterCurrentPage} of {masterTotalPages}</span>
                      <button onClick={() => setMasterCurrentPage(p => p + 1)} disabled={masterCurrentPage === masterTotalPages} className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed">Next</button>
                      <button onClick={() => setMasterCurrentPage(masterTotalPages)} disabled={masterCurrentPage === masterTotalPages} className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed">Last</button>
                    </div>
                  </div>
                )}
              </div>

              {drillUserId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" onClick={() => setDrillUserId(null)}>
                  <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-black uppercase dark:text-white">{drillEntries[0]?.userName || 'Agent Drilldown'}</h3>
                        <p className="text-[10px] font-mono text-slate-400 uppercase mt-1">{drillUserId}</p>
                      </div>
                      <button onClick={() => setDrillUserId(null)} className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase">Close</button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950">
                        <div className="text-[9px] font-black uppercase text-slate-400">Entries</div>
                        <div className="text-lg font-black text-indigo-600 mt-1">{drillSummary?.total || 0}</div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950">
                        <div className="text-[9px] font-black uppercase text-slate-400">Break Flags</div>
                        <div className="text-lg font-black text-rose-600 mt-1">{drillSummary?.breakViolations || 0}</div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950">
                        <div className="text-[9px] font-black uppercase text-slate-400">OT Flags</div>
                        <div className="text-lg font-black text-amber-600 mt-1">{drillSummary?.otCount || 0}</div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950">
                        <div className="text-[9px] font-black uppercase text-slate-400">Latest</div>
                        <div className="text-sm font-black text-slate-600 dark:text-slate-300 mt-2">{drillSummary?.latestDate || 'N/A'}</div>
                      </div>
                    </div>

                    <div className="mt-6">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Recent Sessions</h4>
                      <div className="space-y-2">
                        {drillEntries.length === 0 && (
                          <div className="text-xs text-slate-400 uppercase">No entries found.</div>
                        )}
                        {drillEntries.map(entry => {
                          const loginSec = timeToSeconds(entry.currentLogin || '00:00:00');
                          const shiftBase = entry.shiftType === 'Full Day' ? 9 * 3600 : 4.5 * 3600;
                          const breakSec = timeToSeconds(entry.pause || '00:00:00') + timeToSeconds(entry.dispo || '00:00:00') + timeToSeconds(entry.dead || '00:00:00');
                          const breakLimit = entry.shiftType === 'Full Day' ? 7200 : 2700;
                          const bExceed = breakSec > breakLimit;
                          const isOvertime = loginSec > shiftBase;
                          return (
                            <div key={entry.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950">
                              <div>
                                <div className="text-sm font-black dark:text-slate-200">{new Date(entry.date).toLocaleDateString()}</div>
                                <div className="text-[10px] font-bold uppercase text-slate-400">{entry.shiftType} - Login {entry.currentLogin}</div>
                              </div>
                              <div className="flex items-center gap-3">
                                {bExceed && <span className="text-[10px] font-black text-rose-600 uppercase">Break</span>}
                                {isOvertime && <span className="text-[10px] font-black text-amber-600 uppercase">OT</span>}
                                <StatusBadge status={entry.status} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
                      <button
                        onClick={() => {
                          const target = allUsers.find(u => u.empId.toLowerCase() === drillUserId.toLowerCase());
                          if (target) { setAdminViewingUserId(target.id); setActiveTab('details'); }
                          setDrillUserId(null);
                        }}
                        className="px-4 py-3 rounded-2xl bg-indigo-600 text-white text-[10px] font-black uppercase"
                      >
                        Open Details
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'ot-admin' && (
            <div className="animate-in fade-in duration-700 space-y-8">
              <div className="flex justify-between items-center">
                <div><h2 className="text-2xl font-black uppercase dark:text-white">OT Requests</h2><p className="text-xs text-slate-400 font-bold mt-1">Pending OT requests and approved/rejected history</p></div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border dark:border-slate-800 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black uppercase dark:text-white">OT Requests</h3>
                    <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest">Pending approvals with reasons</p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-[2.5rem] border dark:border-slate-800">
                  <table className="w-full table-fixed text-left text-[12px]">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-400 uppercase font-black tracking-[0.08em] text-[10px] sticky top-0 z-10 border-b dark:border-slate-800">
                      <tr>
                        <th className="px-2 py-2">User</th>
                        <th className="px-2 py-2">Date</th>
                        <th className="px-2 py-2">Shift</th>
                        <th className="px-2 py-2">Login</th>
                        <th className="px-2 py-2">OT</th>
                        <th className="px-2 py-2">Reason</th>
                        <th className="px-2 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-800/50">
                      {pendingOtApprovals.map(log => {
                        const lSec = timeToSeconds(log.currentLogin || '00:00:00');
                        const sBase = log.shiftType === 'Full Day' ? 9 * 3600 : 4.5 * 3600;
                        return (
                          <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                            <td className="px-2 py-2 align-top">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-black text-xs shadow-sm">{log.userName?.charAt(0)}</div>
                                <div className="min-w-0">
                                  <div className="font-black dark:text-slate-200 uppercase truncate">{log.userName}</div>
                                  <div className="text-[10px] font-mono text-slate-400 mt-0.5 uppercase truncate">{log.userId}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-2 py-2 align-top">
                              <div className="font-bold text-slate-600 dark:text-slate-400 text-sm">{new Date(log.date).toLocaleDateString('en-GB')}</div>
                              <div className="text-[9px] text-slate-400 font-bold uppercase">{new Date(log.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                            </td>
                            <td className="px-2 py-2 align-top"><span className="text-[10px] text-indigo-500 font-black uppercase">{log.shiftType}</span></td>
                            <td className="px-2 py-2 align-top font-mono font-black text-indigo-500">{log.currentLogin}</td>
                            <td className="px-2 py-2 align-top font-mono font-black text-amber-600">{secondsToTime(Math.max(0, lSec - sBase))}</td>
                            <td className="px-2 py-2 align-top text-[12px] text-slate-600 break-words whitespace-normal">{log.reason ? (log.reason.length > 80 ? log.reason.slice(0, 77) + '...' : log.reason) : '-'}</td>
                            <td className="px-2 py-2 align-top text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button onClick={() => { setActionedEntry(log); setApprovalReason(''); setApprovalModalOpen(true); }} className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm" title="Approve"><CheckCircleIcon size={16} /></button>
                                <button onClick={() => { setActionedEntry(log); setRejectionReason(''); setRejectionModalOpen(true); }} className="p-2 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm" title="Reject"><XIcon size={16} /></button>
                                <button onClick={() => startEditAsAdmin(log)} className="p-2.5 text-slate-300 hover:text-indigo-500 transition-all" title="Edit Entry"><EditIcon size={16} /></button>
                                <button onClick={() => deleteEntry(log.id, log.userId)} className="p-2.5 text-slate-300 hover:text-rose-500 transition-all" title="Delete Entry"><TrashIcon size={16} /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {pendingOtApprovals.length === 0 && (
                        <tr><td colSpan={7} className="px-6 py-24 text-center text-slate-400 font-bold uppercase tracking-[0.2em] opacity-30">No pending OT approvals</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border dark:border-slate-800 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black uppercase dark:text-white">OT Records</h3>
                    <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest">All approved and rejected overtime entries with user details</p>
                  </div>
                </div>

                <div className="relative group max-w-lg">
                  <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                  <input
                    type="text"
                    placeholder="Search OT records by name, employee ID, or date (DD/MM/YYYY)..."
                    value={otRecordFiltersDraft.searchQuery}
                    onChange={(e) => setOtRecordFiltersDraft(prev => ({ ...prev, searchQuery: e.target.value }))}
                    className="w-full py-5 bg-slate-50 dark:bg-slate-950 rounded-3xl outline-none pl-14 pr-8 text-xs font-bold border focus:border-indigo-500/20 dark:text-white shadow-inner"
                  />
                </div>

                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">From Date</label>
                    <input type="date" value={otRecordFiltersDraft.dateStart} onChange={(e) => setOtRecordFiltersDraft(prev => ({ ...prev, dateStart: e.target.value }))} className="w-full p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl outline-none text-xs font-bold dark:text-white shadow-inner" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">To Date</label>
                    <input type="date" value={otRecordFiltersDraft.dateEnd} onChange={(e) => setOtRecordFiltersDraft(prev => ({ ...prev, dateEnd: e.target.value }))} className="w-full p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl outline-none text-xs font-bold dark:text-white shadow-inner" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Shift</label>
                    <select value={otRecordFiltersDraft.shiftFilter} onChange={(e) => setOtRecordFiltersDraft(prev => ({ ...prev, shiftFilter: e.target.value as any }))} className="w-full p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl outline-none text-xs font-bold dark:text-white shadow-inner appearance-none cursor-pointer">
                      <option value="All">All Shifts</option>
                      <option value="Full Day">Full Day</option>
                      <option value="Half Day">Half Day</option>
                    </select>
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Status</label>
                    <select value={otRecordFiltersDraft.statusFilter} onChange={(e) => setOtRecordFiltersDraft(prev => ({ ...prev, statusFilter: e.target.value as any }))} className="w-full p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl outline-none text-xs font-bold dark:text-white shadow-inner appearance-none cursor-pointer">
                      <option value="All">All</option>
                      <option value="Approved">Approved</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => { applyOtRecordFilters(); fetchMasterData(true); }}
                      className="px-5 py-3 rounded-2xl bg-indigo-600 text-white text-[10px] font-black uppercase hover:bg-indigo-700 transition-colors"
                    >
                      Search
                    </button>
                    <button
                      onClick={() => exportDailyPerformanceReport(filteredOtRecords.filter(e => e.status === 'Approved'))}
                      className="px-5 py-3 rounded-2xl bg-emerald-600 text-white text-[10px] font-black uppercase hover:bg-emerald-700 transition-colors"
                    >
                      Download Approved
                    </button>
                    <button
                      onClick={() => exportDailyPerformanceReport(filteredOtRecords.filter(e => e.status === 'Rejected'))}
                      className="px-5 py-3 rounded-2xl bg-rose-600 text-white text-[10px] font-black uppercase hover:bg-rose-700 transition-colors"
                    >
                      Download Rejected
                    </button>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest">
                    <span className="px-3 py-2 rounded-2xl bg-emerald-50 text-emerald-600">Approved: {otRecordTotals.approved}</span>
                    <span className="px-3 py-2 rounded-2xl bg-rose-50 text-rose-600">Rejected: {otRecordTotals.rejected}</span>
                  </div>
                </div>

                <div className="overflow-hidden rounded-[2.5rem] border dark:border-slate-800">
                  <table className="w-full table-fixed text-left text-[12px]">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-400 uppercase font-black tracking-[0.08em] text-[10px] sticky top-0 z-10 border-b dark:border-slate-800">
                      <tr>
                        <th className="px-2 py-2">User</th>
                        <th className="px-2 py-2">Date</th>
                        <th className="px-2 py-2">Shift</th>
                        <th className="px-2 py-2">Login</th>
                        <th className="px-2 py-2">OT</th>
                        <th className="px-2 py-2">Reason</th>
                        <th className="px-2 py-2 text-center">Status</th>
                        <th className="px-2 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-800/50">
                      {filteredOtRecords.map(log => {
                        const lSec = timeToSeconds(log.currentLogin);
                        const sBase = log.shiftType === 'Full Day' ? 9 * 3600 : 4.5 * 3600;
                        const isEmergency = !!log.emergencyOt;
                        const otValue = isEmergency ? lSec : Math.max(0, lSec - sBase);

                        return (
                          <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                            <td className="px-2 py-2 align-top">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-black text-xs shadow-sm">{log.userName?.charAt(0)}</div>
                                <div className="min-w-0">
                                  <div className="font-black dark:text-slate-200 uppercase truncate">{log.userName}</div>
                                  <div className="text-[10px] font-mono text-slate-400 mt-0.5 uppercase truncate">{log.userId}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-2 py-2 align-top">
                              <div className="font-bold text-slate-600 dark:text-slate-400 text-sm">{new Date(log.date).toLocaleDateString('en-GB')}</div>
                              <div className="text-[9px] text-slate-400 font-bold uppercase">{new Date(log.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                            </td>
                            <td className="px-2 py-2 align-top"><span className={`text-[10px] font-black uppercase ${isEmergency ? 'text-amber-500' : 'text-indigo-500'}`}>{isEmergency ? 'Emergency OT' : log.shiftType}</span></td>
                            <td className="px-2 py-2 align-top font-mono font-black text-indigo-500">{log.currentLogin}</td>
                            <td className="px-2 py-2 align-top font-mono font-black text-amber-600">{secondsToTime(otValue)}</td>
                            <td className="px-2 py-2 align-top text-[12px] text-slate-600 break-words whitespace-normal">{log.reason ? (log.reason.length > 80 ? log.reason.slice(0, 77) + '...' : log.reason) : '-'}</td>
                            <td className="px-2 py-2 align-top text-center">
                              <StatusBadge status={log.status} />
                            </td>
                            <td className="px-2 py-2 align-top text-right">
                              <div className="flex items-center justify-end gap-2">
                                {log.status === 'Pending' && (
                                  <div className="flex gap-1.5">
                                    <button onClick={(e) => { e.stopPropagation(); setActionedEntry(log); setApprovalModalOpen(true); }} className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm" title="Approve"><CheckCircleIcon size={16} /></button>
                                    <button onClick={(e) => { e.stopPropagation(); setActionedEntry(log); setRejectionModalOpen(true); }} className="p-2 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm" title="Reject"><XIcon size={16} /></button>
                                  </div>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); const internalUser = allUsers.find(u => u.empId.toLowerCase() === log.userId.toLowerCase()); if (internalUser) { setAdminViewingUserId(internalUser.id); startEdit(log); } }} className="p-2.5 text-slate-300 hover:text-indigo-500 transition-all" title="Edit Entry"><EditIcon size={16} /></button>
                                <button onClick={(e) => { e.stopPropagation(); deleteEntry(log.id, log.userId); }} className="p-2.5 text-slate-300 hover:text-rose-500 transition-all" title="Wipe Session"><TrashIcon size={16} /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredOtRecords.length === 0 && (
                        <tr><td colSpan={8} className="px-6 py-24 text-center text-slate-400 font-bold uppercase tracking-[0.2em] opacity-30">No OT records found matching search criteria</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Toast container */}
        <div className="fixed bottom-6 right-6 z-[200] flex flex-col-reverse gap-3">
          {toasts.map(t => (
            <div key={t.id} className={`max-w-sm w-full px-4 py-3 rounded-lg shadow-lg text-sm flex items-start gap-3 ${t.type === 'success' ? 'bg-emerald-600 text-white' : t.type === 'error' ? 'bg-rose-600 text-white' : t.type === 'warning' ? 'bg-amber-500 text-black' : 'bg-slate-900 text-white'}`}>
              <div className="font-black text-xs uppercase leading-tight mr-2">{t.type === 'success' ? 'Success' : t.type === 'error' ? 'Error' : t.type === 'warning' ? 'Warning' : 'Info'}</div>
              <div className="flex-1 text-[13px]">{t.message}</div>
              <button onClick={() => setToasts(ts => ts.filter(x => x.id !== t.id))} className="text-white opacity-80 ml-3 font-black">×</button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
