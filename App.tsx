
import React, { useState, useEffect } from 'react';
import { 
  PlusIcon, 
  TrashIcon, 
  DownloadIcon, 
  RefreshCcwIcon, 
  SparklesIcon,
  ClockIcon,
  CoffeeIcon,
  LogOutIcon,
  LayoutDashboardIcon,
  AlertCircleIcon,
  SunIcon,
  MoonIcon,
  ClipboardCheckIcon,
  ZapIcon,
  ZapOffIcon,
  PhoneIncomingIcon,
  PhoneOutgoingIcon,
  UserCheckIcon,
  TimerIcon,
  KeyIcon,
  UserIcon,
  MailIcon,
  ArrowRightIcon,
  ChevronLeftIcon,
  IdCardIcon
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { TimeData, CalculationResult, AIExtractionLog, User } from './types';
import { timeToSeconds, secondsToTime, isValidTimeFormat, formatDate, autoCorrectTime } from './utils';
import { parseRawTimeData } from './services/geminiService';
import { exportToExcel } from './services/excelService';

const COLORS = ['#10b981', '#f43f5e']; 
const TARGET_LOGIN = 9 * 3600; 
const TARGET_BREAK = 2 * 3600; 

const App: React.FC = () => {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authView, setAuthView] = useState<'login' | 'register' | 'forgot'>('login');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // App State
  const [entries, setEntries] = useState<TimeData[]>([]);
  const [aiHistory, setAiHistory] = useState<AIExtractionLog[]>([]);
  const [formData, setFormData] = useState({
    pause: '00:00:00',
    dispo: '00:00:00',
    dead: '00:00:00',
    currentLogin: '00:00:00',
    wait: '00:00:00',
    talk: '00:00:00',
    hold: '00:00:00',
    customerTalk: '00:00:00',
    inbound: 0,
    outbound: 0
  });
  const [isParsing, setIsParsing] = useState(false);
  const [rawText, setRawText] = useState('');
  const [activeTab, setActiveTab] = useState<'calc' | 'history' | 'aiHistory'>('calc');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  const [autoApplyAi, setAutoApplyAi] = useState<boolean>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('auto_apply_ai') === 'true';
    return false;
  });

  useEffect(() => {
    const session = localStorage.getItem('current_session');
    if (session) {
      try { setUser(JSON.parse(session)); } catch (e) { localStorage.removeItem('current_session'); }
    }
    theme === 'dark' ? document.documentElement.classList.add('dark') : document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (user) {
      const savedEntries = localStorage.getItem(`entries_${user.id}`);
      if (savedEntries) try { setEntries(JSON.parse(savedEntries)); } catch (e) {}
      const savedAiHistory = localStorage.getItem(`ai_history_${user.id}`);
      if (savedAiHistory) try { setAiHistory(JSON.parse(savedAiHistory)); } catch (e) {}
    }
  }, [user]);

  useEffect(() => { if (user) localStorage.setItem(`entries_${user.id}`, JSON.stringify(entries)); }, [entries, user]);
  useEffect(() => { if (user) localStorage.setItem(`ai_history_${user.id}`, JSON.stringify(aiHistory)); }, [aiHistory, user]);

  const handleAuthSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    const data = new FormData(e.currentTarget);
    const empId = data.get('empId') as string;
    const password = data.get('password') as string;
    const name = data.get('name') as string;
    const email = data.get('email') as string;

    setTimeout(() => {
      const users: User[] = JSON.parse(localStorage.getItem('registered_users') || '[]');

      if (authView === 'login') {
        const found = users.find(u => u.empId === empId && u.password === password);
        if (found) {
          const { password: _, ...safeUser } = found;
          setUser(safeUser);
          localStorage.setItem('current_session', JSON.stringify(safeUser));
        } else {
          setAuthError('Invalid Employee ID or password.');
        }
      } else if (authView === 'register') {
        if (users.find(u => u.empId === empId)) {
          setAuthError('Employee ID already registered.');
        } else {
          const newUser = { id: Math.random().toString(36).substr(2, 9), empId, name, email, password };
          localStorage.setItem('registered_users', JSON.stringify([...users, newUser]));
          const { password: _, ...safeUser } = newUser;
          setUser(safeUser);
          localStorage.setItem('current_session', JSON.stringify(safeUser));
        }
      } else {
        alert('Reset requested (Simulation).');
        setAuthView('login');
      }
      setAuthLoading(false);
    }, 600);
  };

  const handleLogout = () => {
    localStorage.removeItem('current_session');
    setUser(null);
    setAuthView('login');
  };

  const results = (() => {
    const pause = timeToSeconds(formData.pause);
    const dispo = timeToSeconds(formData.dispo);
    const dead = timeToSeconds(formData.dead);
    const current = timeToSeconds(formData.currentLogin);
    const totalPause = pause + dispo + dead;
    const loginRem = TARGET_LOGIN - current;
    const breakRem = TARGET_BREAK - totalPause;
    return {
      totalPauseTime: secondsToTime(totalPause),
      loginRemaining: secondsToTime(loginRem),
      breakRemaining: secondsToTime(breakRem),
      breakUsedSeconds: totalPause,
      breakLeftSeconds: Math.max(0, breakRem),
      loginRemainingSeconds: Math.max(0, loginRem),
      totalBreakSeconds: totalPause
    };
  })();

  const breakChartData = [
    { name: 'Remaining', value: results.breakLeftSeconds },
    { name: 'Used', value: results.breakUsedSeconds }
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseInt(value) || 0 : value }));
  };

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    if (type !== 'number' && value.trim() !== '' && !isValidTimeFormat(value)) {
      setFormData(prev => ({ ...prev, [name]: autoCorrectTime(value) }));
    }
  };

  const handleAddEntry = () => {
    setEntries([{ id: crypto.randomUUID(), date: formatDate(new Date()), ...formData }, ...entries]);
    alert("Session data saved successfully!");
  };

  const handleAIParsing = async () => {
    if (!rawText.trim()) return;
    setIsParsing(true);
    try {
      const parsed = await parseRawTimeData(rawText);
      if (parsed) {
        setFormData(parsed);
        setAiHistory([{ id: crypto.randomUUID(), timestamp: formatDate(new Date()), rawText, parsedData: parsed }, ...aiHistory]);
        setRawText('');
      }
    } catch (error) { alert("AI extraction failed."); } finally { setIsParsing(false); }
  };

  const isFormValid = isValidTimeFormat(formData.pause) && 
                      isValidTimeFormat(formData.dispo) && 
                      isValidTimeFormat(formData.dead) && 
                      isValidTimeFormat(formData.currentLogin);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 relative overflow-hidden">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-10 relative z-10 border border-slate-100 dark:border-slate-800">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-indigo-600 p-4 rounded-3xl shadow-lg mb-4 text-white">
              <LayoutDashboardIcon size={32} />
            </div>
            <h1 className="text-2xl font-bold">Performance Tracker</h1>
            <p className="text-slate-500 text-sm mt-1">
              {authView === 'login' ? 'Enter Emp ID to login' : 'Create new employee account'}
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authView === 'register' && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-slate-500">Full Name</label>
                  <div className="relative">
                    <UserIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input required name="name" type="text" placeholder="John Doe" className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-950 rounded-2xl outline-none" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-slate-500">Email</label>
                  <div className="relative">
                    <MailIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input required name="email" type="email" placeholder="john@company.com" className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-950 rounded-2xl outline-none" />
                  </div>
                </div>
              </>
            )}
            
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500">Employee ID</label>
              <div className="relative">
                <IdCardIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input required name="empId" type="text" placeholder="EMP123" className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-950 rounded-2xl outline-none" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500">Password</label>
              <div className="relative">
                <KeyIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input required name="password" type="password" placeholder="••••••••" className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-950 rounded-2xl outline-none" />
              </div>
            </div>

            {authError && <p className="text-rose-500 text-xs text-center">{authError}</p>}

            <button disabled={authLoading} type="submit" className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg flex items-center justify-center gap-2">
              {authLoading ? 'Loading...' : authView === 'login' ? 'Login Now' : 'Create Account'}
              {!authLoading && <ArrowRightIcon size={18} />}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button onClick={() => setAuthView(authView === 'login' ? 'register' : 'login')} className="text-sm text-indigo-600 font-bold hover:underline">
              {authView === 'login' ? 'New here? Register' : 'Already have an account? Login'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <aside className="w-full md:w-64 bg-slate-900 text-white flex flex-col shadow-xl z-20">
        <div className="p-6 flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg"><LayoutDashboardIcon size={24} /></div>
          <h1 className="text-xl font-bold tracking-tight">WorkFlow Pro</h1>
        </div>
        
        <div className="px-6 py-2">
          <div className="bg-slate-800 p-3 rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center font-bold">{user.name.charAt(0)}</div>
            <div className="overflow-hidden text-xs">
              <p className="font-bold truncate">{user.name}</p>
              <p className="text-slate-400 truncate">ID: {user.empId}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          <button onClick={() => setActiveTab('calc')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'calc' ? 'bg-indigo-600' : 'hover:bg-slate-800'}`}><ClockIcon size={20} /> Calc Dashboard</button>
          <button onClick={() => setActiveTab('history')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'history' ? 'bg-indigo-600' : 'hover:bg-slate-800'}`}><RefreshCcwIcon size={20} /> History Logs</button>
          <button onClick={() => setActiveTab('aiHistory')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'aiHistory' ? 'bg-indigo-600' : 'hover:bg-slate-800'}`}><SparklesIcon size={20} /> AI History</button>
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2">
          <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 text-xs hover:text-white transition-all">
            {theme === 'light' ? <MoonIcon size={20} /> : <SunIcon size={20} />} {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
          </button>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-400 text-xs hover:bg-rose-500/10 transition-all">
            <LogOutIcon size={20} /> Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'calc' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 space-y-6">
                <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800">
                  <h2 className="text-lg font-semibold flex items-center gap-2 mb-4"><SparklesIcon className="text-indigo-500" /> AI Data Import</h2>
                  <textarea value={rawText} onChange={(e) => setRawText(e.target.value)} placeholder="Paste dialer summary here..." className="w-full h-32 p-4 rounded-3xl bg-slate-50 dark:bg-slate-950 text-sm outline-none border-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                  <button onClick={handleAIParsing} disabled={isParsing || !rawText} className="mt-4 w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg disabled:opacity-50">
                    {isParsing ? 'Extracting Data...' : 'Auto-Extract All Metrics'}
                  </button>
                </div>

                <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800">
                  <h2 className="text-lg font-semibold mb-6">Dialer Performance Details</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[
                      { label: 'Login Time', name: 'currentLogin', icon: <ClockIcon /> },
                      { label: 'Pause Time', name: 'pause', icon: <CoffeeIcon /> },
                      { label: 'Dispo Time', name: 'dispo', icon: <RefreshCcwIcon /> },
                      { label: 'Dead Time', name: 'dead', icon: <TrashIcon /> },
                      { label: 'Wait Time', name: 'wait', icon: <TimerIcon /> },
                      { label: 'Talk Time', name: 'talk', icon: <UserCheckIcon /> },
                      { label: 'Hold Time', name: 'hold', icon: <LogOutIcon /> },
                      { label: 'Customer Talk', name: 'customerTalk', icon: <UserCheckIcon /> },
                      { label: 'Inbound', name: 'inbound', type: 'number', icon: <PhoneIncomingIcon /> },
                      { label: 'Outbound', name: 'outbound', type: 'number', icon: <PhoneOutgoingIcon /> },
                    ].map((field) => (
                      <div key={field.name} className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                          {React.cloneElement(field.icon as React.ReactElement, { size: 12 })} {field.label}
                        </label>
                        <input type={field.type || 'text'} name={field.name} value={(formData as any)[field.name]} onChange={handleInputChange} onBlur={handleInputBlur} className="w-full p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border-2 border-transparent focus:border-indigo-500 outline-none font-mono text-sm transition-all" />
                      </div>
                    ))}
                  </div>
                  <button onClick={handleAddEntry} disabled={!isFormValid} className="mt-10 w-full py-4 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl">
                    <PlusIcon size={20} /> Save Final Report
                  </button>
                </div>
              </div>

              <div className="lg:col-span-4 space-y-6">
                <div className={`p-8 rounded-[2.5rem] shadow-xl transition-all duration-500 ${results.totalBreakSeconds > TARGET_BREAK ? 'bg-rose-500 ring-4 ring-rose-200 animate-pulse' : 'bg-indigo-600'} text-white`}>
                  <h2 className="text-sm opacity-80 mb-1">Session Live Summary</h2>
                  <div className="text-3xl font-bold mb-6">2h Break Target</div>
                  <div className="space-y-3">
                    <div className="flex justify-between p-4 bg-white/10 rounded-2xl"><span>Break Used</span> <b className="font-mono">{results.totalPauseTime}</b></div>
                    <div className="flex justify-between p-4 bg-white/10 rounded-2xl"><span>Break Left</span> <b className="font-mono">{results.breakRemaining}</b></div>
                    <div className="flex justify-between p-4 bg-white/10 rounded-2xl"><span>Login Rem.</span> <b className="font-mono">{results.loginRemaining}</b></div>
                  </div>
                  {results.totalBreakSeconds > TARGET_BREAK && <div className="mt-4 text-[10px] font-bold bg-white/20 p-2.5 rounded-xl text-center uppercase tracking-widest">⚠️ 2H BREAK EXCEEDED (CRITICAL)</div>}
                </div>
                
                <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center">
                  <div className="h-44 w-full">
                    <ResponsiveContainer><PieChart><Pie data={breakChartData} innerRadius={55} outerRadius={75} paddingAngle={5} dataKey="value">{breakChartData.map((e,i)=><Cell key={i} fill={COLORS[i]} stroke="none" />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-4">Break Allowance Meter</p>
                </div>
              </div>
            </div>
          ) : activeTab === 'history' ? (
            <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Performance History</h2>
                  <p className="text-sm text-slate-500">Detailed records for Employee: {user.empId}</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => exportToExcel(entries, user, TARGET_LOGIN, TARGET_BREAK)} className="bg-emerald-600 hover:bg-emerald-700 px-6 py-3 rounded-2xl text-white font-bold flex items-center gap-2 shadow-lg transition-all"><DownloadIcon size={18}/> Export Excel</button>
                  <button onClick={() => { if (confirm("Clear history?")) setEntries([]); }} className="bg-slate-200 dark:bg-slate-800 hover:bg-rose-500/10 px-4 py-3 rounded-2xl transition-all"><TrashIcon size={18}/></button>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950/50">
                        <th className="p-5 font-bold uppercase text-slate-400">Date</th>
                        <th className="p-5 font-bold uppercase text-slate-400">Total Login</th>
                        <th className="p-5 font-bold uppercase text-slate-400">Total Break (P+D+D)</th>
                        <th className="p-5 font-bold uppercase text-slate-400">Wait / Talk</th>
                        <th className="p-5 font-bold uppercase text-slate-400 text-center">In / Out</th>
                        <th className="p-5 font-bold uppercase text-slate-400 text-right">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {entries.map(e => {
                        const brk = timeToSeconds(e.pause) + timeToSeconds(e.dispo) + timeToSeconds(e.dead);
                        const log = timeToSeconds(e.currentLogin);
                        const isCritical = brk > TARGET_BREAK;

                        return (
                          <tr key={e.id} className={`transition-colors group ${isCritical ? 'bg-rose-50/70 dark:bg-rose-900/10' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'}`}>
                            <td className="p-5 font-medium">{e.date}</td>
                            <td className={`p-5 font-mono font-bold ${log < TARGET_LOGIN ? 'text-rose-500' : 'text-emerald-500'}`}>{e.currentLogin}</td>
                            <td className={`p-5 font-mono font-bold ${isCritical ? 'text-rose-600' : 'text-emerald-500'}`}>
                              {secondsToTime(brk)} {isCritical && "(RED ALERT)"}
                            </td>
                            <td className="p-5 font-mono opacity-60">{e.wait} / {e.talk}</td>
                            <td className="p-5 text-center font-bold">{e.inbound} / {e.outbound}</td>
                            <td className="p-5 text-right"><button onClick={()=>setEntries(entries.filter(x=>x.id!==e.id))} className="text-slate-300 hover:text-rose-500 p-2"><TrashIcon size={16}/></button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in zoom-in-95 duration-500">
              {aiHistory.map(log => (
                <div key={log.id} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-4 hover:shadow-xl transition-all group">
                  <div className="flex justify-between items-start">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{log.timestamp}</div>
                    <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg"><SparklesIcon size={12} className="text-indigo-500" /></div>
                  </div>
                  <div className="text-[11px] italic line-clamp-3 text-slate-500 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl">"{log.rawText}"</div>
                  <button onClick={()=>{setFormData(log.parsedData); setActiveTab('calc');}} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all">
                    <ClipboardCheckIcon size={14}/> RESTORE DATA
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
