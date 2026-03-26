import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import './App.css';

const firebaseConfig = {
  apiKey: "AIzaSyAeVgWXO2tsP4QozFaOxRYAfgURGkV8CvI",
  authDomain: "cylinder-tracking-8b128.firebaseapp.com",
  projectId: "cylinder-tracking-8b128",
  storageBucket: "cylinder-tracking-8b128.firebasestorage.app",
  messagingSenderId: "3374622360",
  appId: "1:3374622360:web:270d65c986f7e6afce12ed"
};

const firebaseApp = getApps().find(a => a.name === '[DEFAULT]') || initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const DEFAULT_SETTINGS = {
  overdueWarningDays: 30, overdueCriticalDays: 60,
  tatFastDays: 20, tatMediumDays: 35,
  usageHighTrips: 15, usageMediumTrips: 8,
  driverEditHours: 24, adminEditHours: 48
};

const tsToDate = (ts) => ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
const daysSince = (ts) => { const d = tsToDate(ts); if (!d) return 0; return Math.floor((Date.now() - d.getTime()) / 86400000); };
const fmt = (ts) => { const d = tsToDate(ts); if (!d) return '—'; return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); };
const fmtTime = (ts) => { const d = tsToDate(ts); if (!d) return '—'; return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
const pad = (n) => String(n).padStart(3, '0');
const nextQR = (cyls) => { if (!cyls.length) return '001'; return pad(Math.max(...cyls.map(c => parseInt(c.qrCode) || 0)) + 1); };

// ── Icons ──────────────────────────────────────────────────────────────────────
const Ic = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d={d} /></svg>
);
const IC = {
  logout:   "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
  eye:      "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8M12 9a3 3 0 100 6 3 3 0 000-6",
  eyeoff:   "M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22",
  plus:     "M12 5v14M5 12h14",
  edit:     "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  trash:    "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
  back:     "M19 12H5M12 19l-7-7 7-7",
  dl:       "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3",
  search:   "M11 17a6 6 0 100-12 6 6 0 000 12zM21 21l-4.35-4.35",
  x:        "M18 6L6 18M6 6l12 12",
  settings: "M12 15a3 3 0 100-6 3 3 0 000 6M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",
  users:    "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
  truck:    "M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5.5 21a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM18.5 21a1.5 1.5 0 100-3 1.5 1.5 0 000 3z",
  chart:    "M18 20V10M12 20V4M6 20v-6",
  pkg:      "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12",
  alert:    "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01",
  clock:    "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0",
  trend:    "M23 6l-9.5 9.5-5-5L1 18M17 6h6v6"
};

// ── Primitives ─────────────────────────────────────────────────────────────────
const Btn = ({ children, variant='primary', danger, small, fullWidth, disabled, onClick, type='button' }) => (
  <button type={type} onClick={onClick} disabled={disabled}
    className={['btn',`btn--${danger?'danger':variant}`, small&&'btn--sm', fullWidth&&'btn--full'].filter(Boolean).join(' ')}>
    {children}
  </button>
);

const Badge = ({ children, variant }) => <span className={`badge badge--${variant}`}>{children}</span>;

const Modal = ({ open, title, onClose, children }) => {
  if (!open) return null;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}><Ic d={IC.x} size={18}/></button>
        </div>
        {children}
      </div>
    </div>
  );
};

const Fld = ({ label, required, children }) => (
  <div className="fld">
    <label className="fld-label">{label}{required&&<span className="req"> *</span>}</label>
    {children}
  </div>
);

const Inp = (props) => <input className="inp" {...props} />;
const Sel = ({ children, ...p }) => <select className="inp" {...p}>{children}</select>;

const SCard = ({ label, value, color, onClick, hint }) => (
  <div className="scard" style={{'--c':color}} onClick={onClick} data-clickable={!!onClick}>
    <div className="scard-val">{value}</div>
    <div className="scard-label">{label}</div>
    {onClick && <div className="scard-hint">{hint||'View details →'}</div>}
  </div>
);

const SortTh = ({ children, active, dir, onClick }) => (
  <th className="th-sort" onClick={onClick}>
    {children} <span className="sort-icon">{active ? (dir==='asc'?'▲':'▼') : '⇅'}</span>
  </th>
);

const DataTable = ({ cols, rows, onRowClick, empty='No records found.' }) => (
  <div className="tbl-scroll">
    <table className="tbl">
      <thead><tr>{cols.map((c,i)=><th key={i}>{c}</th>)}</tr></thead>
      <tbody>
        {rows.length===0
          ? <tr><td colSpan={cols.length} className="tbl-empty">{empty}</td></tr>
          : rows.map((r,i)=>(
            <tr key={i} className={onRowClick?'tbl-row--link':''} onClick={()=>onRowClick?.(i)}>
              {r.map((cell,j)=><td key={j}>{cell}</td>)}
            </tr>
          ))}
      </tbody>
    </table>
  </div>
);

// ── App Root ───────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('dashboard');

  useEffect(() => auth.onAuthStateChanged(async u => {
    if (u) {
      const snap = await getDoc(doc(db,'users',u.uid));
      if (snap.exists()) setProfile({ uid:u.uid, ...snap.data() });
      const ss = await getDoc(doc(db,'appSettings','thresholds'));
      if (ss.exists()) setSettings(s=>({...s,...ss.data()}));
    } else { setProfile(null); }
    setUser(u); setLoading(false);
  }), []);

  if (loading) return <div className="splash">Loading…</div>;
  if (!user||!profile) return <LoginScreen />;

  const role = profile.role;
  const isAdmin = role==='admin'||role==='superadmin';
  const isSA = role==='superadmin';
  const isDriver = role==='driver';

  const NAV = [
    { id:'dashboard',         label:'Dashboard',           icon:IC.chart,    show:true },
    { id:'record',            label:'Record Movement',     icon:IC.truck,    show:isDriver },
    { id:'customers',         label:'Customers',           icon:IC.users,    show:isAdmin },
    { id:'cust-analytics',    label:'Customer Analytics',  icon:IC.trend,    show:isAdmin },
    { id:'cylinders',         label:'Cylinders',           icon:IC.pkg,      show:isAdmin },
    { id:'cyl-analytics',     label:'Cylinder Analytics',  icon:IC.alert,    show:isAdmin },
    { id:'history',           label:'Movement History',    icon:IC.clock,    show:isAdmin },
    { id:'driver-analytics',  label:'Driver Analytics',    icon:IC.users,    show:isSA },
    { id:'users',             label:'Users',               icon:IC.users,    show:isSA },
    { id:'settings',          label:'Settings',            icon:IC.settings, show:isSA },
  ].filter(n=>n.show);

  const PAGES = {
    dashboard:        <DashPage settings={settings} isAdmin={isAdmin} goTo={setPage} />,
    record:           <RecordPage profile={profile} />,
    customers:        <CustomersPage />,
    'cust-analytics': <CustAnalytics settings={settings} />,
    cylinders:        <CylindersPage />,
    'cyl-analytics':  <CylAnalytics settings={settings} />,
    history:          <HistoryPage />,
    'driver-analytics':<DriverAnalytics />,
    users:            <UsersPage />,
    settings:         <SettingsPage settings={settings} setSettings={setSettings} />,
  };

  return (
    <div className="shell">
      <aside className="nav">
        <div className="nav-brand">⬡<span>CylTrack</span></div>
        <div className="nav-links">
          {NAV.map(n=>(
            <button key={n.id} className={`nav-item${page===n.id?' nav-item--active':''}`} onClick={()=>setPage(n.id)}>
              <Ic d={n.icon} size={15}/><span>{n.label}</span>
            </button>
          ))}
        </div>
        <div className="nav-foot">
          <div className="nav-user-name">{profile.name||profile.email}</div>
          <Badge variant={role}>{role}</Badge>
          <button className="nav-logout" onClick={()=>signOut(auth)}><Ic d={IC.logout} size={14}/> Sign out</button>
        </div>
      </aside>
      <main className="content">
        <div className="page-wrap">{PAGES[page]||PAGES.dashboard}</div>
      </main>
    </div>
  );
}

// ── Login ──────────────────────────────────────────────────────────────────────
function LoginScreen() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [forgot, setForgot] = useState(false);

  const submit = async e => {
    e.preventDefault(); setErr('');
    try { await signInWithEmailAndPassword(auth, email, pw); }
    catch { setErr('Invalid email or password.'); }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">⬡</div>
        <h1 className="login-h1">Cylinder Tracker</h1>
        <p className="login-sub">Sign in to your account</p>
        <form onSubmit={submit}>
          <Fld label="Email"><Inp type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="user@cylinder.local" required/></Fld>
          <Fld label="Password">
            <div className="pw-wrap">
              <Inp type={show?'text':'password'} value={pw} onChange={e=>setPw(e.target.value)} placeholder="••••••••" required/>
              <button type="button" className="pw-eye" onClick={()=>setShow(s=>!s)}><Ic d={show?IC.eyeoff:IC.eye} size={16}/></button>
            </div>
          </Fld>
          {err && <div className="login-err">{err}</div>}
          <Btn type="submit" fullWidth>Sign In</Btn>
        </form>
        <button className="login-forgot" onClick={()=>setForgot(true)}>Forgot password?</button>
      </div>
      <Modal open={forgot} title="Password Reset" onClose={()=>setForgot(false)}>
        <div className="modal-body">
          <p>Contact the developer to reset your password:</p>
          <div className="contact-box">vishalpranav23@gmail.com</div>
          <p style={{marginTop:'0.5rem',fontSize:'0.8rem',color:'var(--muted)'}}>Include your login email.</p>
        </div>
        <div className="modal-foot"><Btn onClick={()=>setForgot(false)}>Close</Btn></div>
      </Modal>
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────────
function DashPage({ settings, isAdmin, goTo }) {
  const [stats, setStats] = useState(null);

  useEffect(()=>{
    (async()=>{
      const ms = await getDocs(collection(db,'movements'));
      const out={};
      ms.docs.map(d=>d.data()).sort((a,b)=>tsToDate(a.createdAt)-tsToDate(b.createdAt)).forEach(m=>{
        (m.qrCodes||[]).forEach(qr=>{
          if(m.type==='outward') out[qr]={at:m.createdAt,gas:m.gasTypes?.[qr]};
          else delete out[qr];
        });
      });
      let total=0,warn=0,crit=0,co2=0,o2=0;
      Object.values(out).forEach(c=>{
        total++;
        const d=daysSince(c.at);
        if(d>=settings.overdueCriticalDays) crit++;
        else if(d>=settings.overdueWarningDays) warn++;
        if(c.gas==='CO2') co2++; else if(c.gas==='O2') o2++;
      });
      setStats({total,warn,crit,co2,o2});
    })();
  },[settings]);

  if(!stats) return <div className="pg-loading">Loading dashboard…</div>;

  return (
    <div>
      <div className="ph"><h1>Dashboard</h1><p className="ph-sub">Cylinder activity at a glance</p></div>
      <div className="cards-grid">
        <SCard label="Total Cylinders Out" value={stats.total} color="var(--blue)"
          onClick={isAdmin?()=>goTo('cyl-analytics'):undefined}/>
        <SCard label={`Warning ≥${settings.overdueWarningDays}d`} value={stats.warn} color="var(--amber)"
          onClick={isAdmin?()=>goTo('cyl-analytics'):undefined}/>
        <SCard label={`Critical ≥${settings.overdueCriticalDays}d`} value={stats.crit} color="var(--red)"
          onClick={isAdmin?()=>goTo('cyl-analytics'):undefined}/>
        <SCard label="CO₂ Out" value={stats.co2} color="var(--teal)"/>
        <SCard label="O₂ Out" value={stats.o2} color="var(--purple)"/>
      </div>
      {isAdmin && stats.crit>0 && (
        <div className="alert-strip">
          <Ic d={IC.alert} size={16}/>
          <span>{stats.crit} cylinder{stats.crit>1?'s':''} critically overdue (≥{settings.overdueCriticalDays} days).</span>
          <button onClick={()=>goTo('cyl-analytics')}>View →</button>
        </div>
      )}
    </div>
  );
}

// ── Record Movement ────────────────────────────────────────────────────────────
function RecordPage({ profile }) {
  const [step, setStep] = useState(1);
  const [type, setType] = useState('outward');
  const [customers, setCustomers] = useState([]);
  const [cylinders, setCylinders] = useState([]);
  const [custId, setCustId] = useState('');
  const [qty, setQty] = useState('');
  const [codes, setCodes] = useState([]);
  const [manual, setManual] = useState('');
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  useEffect(()=>{
    getDocs(collection(db,'customers')).then(s=>setCustomers(s.docs.map(d=>({id:d.id,...d.data()}))));
    getDocs(collection(db,'cylinders')).then(s=>setCylinders(s.docs.map(d=>({id:d.id,...d.data()}))));
  },[]);

  const addCode = raw => {
    const code=raw.trim(); if(!code) return;
    if(codes.includes(code)){setErr(`QR ${code} already added`);return;}
    if(!cylinders.find(c=>c.qrCode===code)){setErr(`QR ${code} not found in system`);return;}
    if(codes.length>=parseInt(qty)){setErr('Quantity limit reached');return;}
    setCodes(p=>[...p,code]); setManual(''); setErr('');
  };

  const save = async () => {
    if(codes.length!==parseInt(qty)){setErr(`Need ${qty} cylinders`);return;}
    const cust=customers.find(c=>c.id===custId);
    const gasTypes={};
    codes.forEach(qr=>{const c=cylinders.find(x=>x.qrCode===qr);if(c)gasTypes[qr]=c.gasType;});
    await addDoc(collection(db,'movements'),{
      type, customerId:custId, customerName:cust?.name||'',
      driverId:profile.uid, driverName:profile.name||profile.email,
      qrCodes:codes, gasTypes, quantity:parseInt(qty),
      createdAt:serverTimestamp(), _timestamp:new Date().toISOString()
    });
    setDone(true);
  };

  const reset = () => { setStep(1);setType('outward');setCustId('');setQty('');setCodes([]);setErr('');setDone(false); };

  if(done) return (
    <div className="done-screen">
      <div className="done-icon">✓</div>
      <h2>Saved!</h2>
      <p>{qty} cylinder{qty>1?'s':''} {type==='outward'?'delivered to':'returned from'} <strong>{customers.find(c=>c.id===custId)?.name}</strong></p>
      <Btn onClick={reset}>Record Another</Btn>
    </div>
  );

  if(step===1) return (
    <div>
      <div className="ph"><h1>Record Movement</h1></div>
      <div className="card">
        <div className="type-row">
          <button className={`type-btn type-btn--out${type==='outward'?' type-btn--active':''}`} onClick={()=>setType('outward')}>
            <span className="type-btn-arrow">↑</span>
            <span className="type-btn-main">OUTWARD</span>
            <span className="type-btn-sub">Delivery to customer</span>
          </button>
          <button className={`type-btn type-btn--in${type==='inward'?' type-btn--active':''}`} onClick={()=>setType('inward')}>
            <span className="type-btn-arrow">↓</span>
            <span className="type-btn-main">INWARD</span>
            <span className="type-btn-sub">Return from customer</span>
          </button>
        </div>
        <Fld label="Customer" required>
          <Sel value={custId} onChange={e=>setCustId(e.target.value)}>
            <option value="">Select customer…</option>
            {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </Sel>
        </Fld>
        <Fld label="Number of cylinders" required>
          <Inp type="number" min="1" max="100" value={qty} onChange={e=>setQty(e.target.value)} placeholder="How many cylinders?"/>
        </Fld>
        <Btn disabled={!custId||!qty||parseInt(qty)<1} onClick={()=>{setStep(2);setCodes([]);setErr('');}} fullWidth>
          Continue →
        </Btn>
      </div>
    </div>
  );

  const pct = Math.round((codes.length/parseInt(qty))*100);
  return (
    <div>
      <button className="back-link" onClick={()=>setStep(1)}><Ic d={IC.back} size={15}/> Back</button>
      <div className="ph">
        <h1>{type==='outward'?'↑ Outward':'↓ Inward'}</h1>
        <p className="ph-sub">{customers.find(c=>c.id===custId)?.name}</p>
      </div>
      <div className="card">
        <div className="prog-wrap">
          <div className="prog-bar"><div className="prog-fill" style={{width:`${pct}%`}}/></div>
          <div className="prog-label">{codes.length} / {qty} cylinders</div>
        </div>
        {err && <div className="inline-err">{err}</div>}
        <div className="manual-row">
          <Inp placeholder="Type QR code and press Enter…" value={manual}
            onChange={e=>{setManual(e.target.value);setErr('');}}
            onKeyDown={e=>e.key==='Enter'&&addCode(manual)}/>
          <Btn onClick={()=>addCode(manual)} small>Add</Btn>
        </div>
        <div className="scan-list">
          {Array.from({length:parseInt(qty)}).map((_,i)=>{
            const code=codes[i];
            const cyl=code?cylinders.find(c=>c.qrCode===code):null;
            return (
              <div key={i} className={`scan-row ${code?'scan-row--done':'scan-row--empty'}`}>
                <span className="scan-num">{i+1}</span>
                <span className="scan-code">{code?`${code} — ${cyl?.gasType||''} ${cyl?.size||''}m³`:'Pending…'}</span>
                {code && <button className="scan-rm" onClick={()=>setCodes(c=>c.filter(x=>x!==code))}><Ic d={IC.x} size={13}/></button>}
              </div>
            );
          })}
        </div>
        <Btn disabled={codes.length!==parseInt(qty)} onClick={save} fullWidth>
          Save Movement ({codes.length}/{qty})
        </Btn>
      </div>
    </div>
  );
}

// ── Customers ──────────────────────────────────────────────────────────────────
function CustomersPage() {
  const [list,setList]=useState([]);
  const [form,setForm]=useState({name:'',contact:'',address:'',gst:''});
  const [editing,setEditing]=useState(null);
  const [open,setOpen]=useState(false);
  const [del,setDel]=useState(null);
  const [q,setQ]=useState('');

  const load=useCallback(async()=>{
    const s=await getDocs(collection(db,'customers'));
    setList(s.docs.map(d=>({id:d.id,...d.data()})));
  },[]);
  useEffect(()=>{load();},[load]);

  const openAdd=()=>{setForm({name:'',contact:'',address:'',gst:''});setEditing(null);setOpen(true);};
  const openEdit=c=>{setForm({name:c.name,contact:c.contact||'',address:c.address||'',gst:c.gst||''});setEditing(c);setOpen(true);};

  const save=async()=>{
    if(!form.name.trim()) return alert('Name is required');
    if(!editing&&list.find(c=>c.name.toLowerCase()===form.name.toLowerCase())) return alert('Customer already exists');
    if(editing) await updateDoc(doc(db,'customers',editing.id),form);
    else await addDoc(collection(db,'customers'),{...form,createdAt:serverTimestamp()});
    setOpen(false); load();
  };

  const confirmDel=async()=>{
    const ms=await getDocs(collection(db,'movements'));
    const out={};
    ms.docs.map(d=>d.data()).sort((a,b)=>tsToDate(a.createdAt)-tsToDate(b.createdAt)).forEach(m=>{
      (m.qrCodes||[]).forEach(qr=>{
        if(m.type==='outward'&&m.customerId===del.id) out[qr]=true;
        else if(m.type==='inward'&&m.customerId===del.id) delete out[qr];
      });
    });
    if(Object.keys(out).length){alert(`Cannot delete: ${del.name} has ${Object.keys(out).length} cylinder(s) currently out.`);setDel(null);return;}
    await deleteDoc(doc(db,'customers',del.id)); setDel(null); load();
  };

  const importCSV=e=>{
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=async ev=>{
      const lines=ev.target.result.split('\n').filter(l=>l.trim()).slice(1);
      let added=0;
      for(const line of lines){
        const [name,contact,address,gst]=line.split(',').map(x=>x.trim().replace(/"/g,''));
        if(!name) continue;
        if(list.find(c=>c.name.toLowerCase()===name.toLowerCase())) continue;
        await addDoc(collection(db,'customers'),{name,contact:contact||'',address:address||'',gst:gst||'N/A',createdAt:serverTimestamp()});
        added++;
      }
      alert(`Imported ${added} customers`); load();
    };
    reader.readAsText(file);
  };

  const dlTemplate=()=>{
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob(['Customer Name,Contact,Address,GST Number\nExample Co,9876543210,123 Street,29ABCDE1234F1Z5'],{type:'text/csv'}));
    a.download='customer_template.csv'; a.click();
  };

  const filtered=list.filter(c=>c.name?.toLowerCase().includes(q.toLowerCase())||c.gst?.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <div className="ph">
        <div><h1>Customers</h1><p className="ph-sub">{list.length} total</p></div>
        <div className="ph-actions">
          <Btn variant="secondary" onClick={dlTemplate} small><Ic d={IC.dl} size={14}/> Template</Btn>
          <label className="btn btn--secondary btn--sm" style={{cursor:'pointer'}}><Ic d={IC.dl} size={14}/> Import CSV<input type="file" accept=".csv" hidden onChange={importCSV}/></label>
          <Btn onClick={openAdd} small><Ic d={IC.plus} size={14}/> Add</Btn>
        </div>
      </div>
      <div className="search-wrap"><Ic d={IC.search} size={15}/><input placeholder="Search name or GST…" value={q} onChange={e=>setQ(e.target.value)}/></div>
      <DataTable cols={['Name','Contact','Address','GST','']}
        rows={filtered.map(c=>[c.name,c.contact||'—',c.address||'—',c.gst||'N/A',
          <div className="row-acts">
            <button className="icon-btn" onClick={()=>openEdit(c)}><Ic d={IC.edit} size={14}/></button>
            <button className="icon-btn icon-btn--del" onClick={()=>setDel(c)}><Ic d={IC.trash} size={14}/></button>
          </div>])}/>
      <Modal open={open} title={editing?'Edit Customer':'Add Customer'} onClose={()=>setOpen(false)}>
        <div className="modal-body">
          <Fld label="Customer Name" required><Inp value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Name"/></Fld>
          <Fld label="Contact"><Inp value={form.contact} onChange={e=>setForm({...form,contact:e.target.value})} placeholder="Phone"/></Fld>
          <Fld label="Address"><Inp value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="Address"/></Fld>
          <Fld label="GST Number"><Inp value={form.gst} onChange={e=>setForm({...form,gst:e.target.value})} placeholder="GST or N/A"/></Fld>
        </div>
        <div className="modal-foot"><Btn onClick={save}>Save</Btn><Btn variant="secondary" onClick={()=>setOpen(false)}>Cancel</Btn></div>
      </Modal>
      <Modal open={!!del} title="Delete Customer" onClose={()=>setDel(null)}>
        <div className="modal-body"><p>Delete <strong>{del?.name}</strong>? This cannot be undone.</p></div>
        <div className="modal-foot"><Btn danger onClick={confirmDel}>Delete</Btn><Btn variant="secondary" onClick={()=>setDel(null)}>Cancel</Btn></div>
      </Modal>
    </div>
  );
}

// ── Customer Analytics ─────────────────────────────────────────────────────────
function CustAnalytics({ settings }) {
  const [customers,setCustomers]=useState([]);
  const [movements,setMovements]=useState([]);
  const [nameQ,setNameQ]=useState('');
  const [gstQ,setGstQ]=useState('');
  const [sortK,setSortK]=useState('name');
  const [sortD,setSortD]=useState('asc');
  const [sel,setSel]=useState(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    (async()=>{
      const [cs,ms]=await Promise.all([getDocs(collection(db,'customers')),getDocs(collection(db,'movements'))]);
      setCustomers(cs.docs.map(d=>({id:d.id,...d.data()})));
      setMovements(ms.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);
    })();
  },[]);

  const calcStats=cid=>{
    const mv=movements.filter(m=>m.customerId===cid).sort((a,b)=>tsToDate(a.createdAt)-tsToDate(b.createdAt));
    const out={},tats={},tatList=[];
    mv.forEach(m=>{
      (m.qrCodes||[]).forEach(qr=>{
        if(m.type==='outward'){out[qr]={at:m.createdAt,gas:m.gasTypes?.[qr]};tats[qr]=m.createdAt;}
        else{if(tats[qr]) tatList.push(Math.floor((tsToDate(m.createdAt)-tsToDate(tats[qr]))/86400000));delete out[qr];delete tats[qr];}
      });
    });
    const co2=Object.values(out).filter(x=>x.gas==='CO2').length;
    const o2=Object.values(out).filter(x=>x.gas==='O2').length;
    const avgTAT=tatList.length?Math.round(tatList.reduce((a,b)=>a+b,0)/tatList.length):null;
    const maxD=Object.values(out).reduce((mx,c)=>Math.max(mx,daysSince(c.at)),0);
    const overdue=maxD>=settings.overdueCriticalDays?'critical':maxD>=settings.overdueWarningDays?'warning':'ok';
    const tatGrp=avgTAT==null?null:avgTAT<settings.tatFastDays?'fast':avgTAT<=settings.tatMediumDays?'medium':'slow';
    return{co2,o2,total:co2+o2,avgTAT,overdue,tatGrp,currentOut:out,history:[...mv].reverse()};
  };

  const sort=k=>{if(sortK===k)setSortD(d=>d==='asc'?'desc':'asc');else{setSortK(k);setSortD('asc');}};

  const enriched=customers
    .map(c=>({...c,_s:calcStats(c.id)}))
    .filter(c=>c.name?.toLowerCase().includes(nameQ.toLowerCase())&&(c.gst||'').toLowerCase().includes(gstQ.toLowerCase()))
    .sort((a,b)=>{
      const av=sortK==='name'?a.name:sortK==='co2'?a._s.co2:sortK==='o2'?a._s.o2:sortK==='total'?a._s.total:a._s.avgTAT??-1;
      const bv=sortK==='name'?b.name:sortK==='co2'?b._s.co2:sortK==='o2'?b._s.o2:sortK==='total'?b._s.total:b._s.avgTAT??-1;
      return sortD==='asc'?(av<bv?-1:1):(av>bv?-1:1);
    });

  const OI={ok:'🟢',warning:'🟡',critical:'🔴'};
  const TG={'fast':<Badge variant="success">Fast</Badge>,'medium':<Badge variant="warning">Medium</Badge>,'slow':<Badge variant="danger">Slow</Badge>};

  if(sel){
    const s=sel._s;
    const cylRows=Object.entries(s.currentOut).map(([qr,info])=>{
      const days=daysSince(info.at);
      const st=days>=settings.overdueCriticalDays?'critical':days>=settings.overdueWarningDays?'warning':'ok';
      return[qr,info.gas,fmt(info.at),`${days}d`,st==='critical'?<Badge variant="danger">Critical</Badge>:st==='warning'?<Badge variant="warning">Warning</Badge>:<Badge variant="success">OK</Badge>];
    });
    return (
      <div>
        <button className="back-link" onClick={()=>setSel(null)}><Ic d={IC.back} size={15}/> All Customers</button>
        <div className="ph"><h1>{sel.name}</h1><p className="ph-sub">{sel.contact} · GST: {sel.gst||'N/A'}</p></div>
        <div className="cards-grid">
          <SCard label="CO₂ Out" value={s.co2} color="var(--teal)"/>
          <SCard label="O₂ Out" value={s.o2} color="var(--purple)"/>
          <SCard label="Total Out" value={s.total} color="var(--blue)"/>
          <SCard label="Avg TAT" value={s.avgTAT!=null?`${s.avgTAT}d`:'—'} color="var(--amber)"/>
        </div>
        {cylRows.length>0&&<><h3 className="sec-title">Currently Out</h3><DataTable cols={['QR','Gas','Delivered','Days Out','Status']} rows={cylRows}/></>}
        <h3 className="sec-title">Movement History</h3>
        <DataTable cols={['Date','Type','QR Codes','Driver']}
          rows={s.history.map(m=>[fmt(m.createdAt),m.type==='outward'?<Badge variant="danger">Out</Badge>:<Badge variant="success">In</Badge>,(m.qrCodes||[]).join(', '),m.driverName])}/>
      </div>
    );
  }

  return (
    <div>
      <div className="ph"><h1>Customer Analytics</h1></div>
      <div className="filter-row">
        <div className="search-wrap"><Ic d={IC.search} size={15}/><input placeholder="Search by name…" value={nameQ} onChange={e=>setNameQ(e.target.value)}/></div>
        <div className="search-wrap"><Ic d={IC.search} size={15}/><input placeholder="Search by GST…" value={gstQ} onChange={e=>setGstQ(e.target.value)}/></div>
        <Btn variant="secondary" small onClick={()=>{setNameQ('');setGstQ('');}}>Clear</Btn>
      </div>
      {loading?<div className="pg-loading">Loading…</div>:(
        <div className="tbl-scroll">
          <table className="tbl">
            <thead><tr>
              <SortTh active={sortK==='name'} dir={sortD} onClick={()=>sort('name')}>Customer</SortTh>
              <SortTh active={sortK==='co2'} dir={sortD} onClick={()=>sort('co2')}>CO₂ Out</SortTh>
              <SortTh active={sortK==='o2'} dir={sortD} onClick={()=>sort('o2')}>O₂ Out</SortTh>
              <SortTh active={sortK==='total'} dir={sortD} onClick={()=>sort('total')}>Total</SortTh>
              <SortTh active={sortK==='tat'} dir={sortD} onClick={()=>sort('tat')}>Avg TAT</SortTh>
              <th>TAT Group</th><th>Status</th>
            </tr></thead>
            <tbody>
              {enriched.map(c=>(
                <tr key={c.id} className="tbl-row--link" onClick={()=>setSel(c)}>
                  <td>{OI[c._s.overdue]} {c.name}</td>
                  <td>{c._s.co2}</td><td>{c._s.o2}</td><td>{c._s.total}</td>
                  <td>{c._s.avgTAT!=null?`${c._s.avgTAT}d`:'—'}</td>
                  <td>{TG[c._s.tatGrp]||'—'}</td>
                  <td>{c._s.overdue==='critical'?<Badge variant="danger">Critical</Badge>:c._s.overdue==='warning'?<Badge variant="warning">Warning</Badge>:<Badge variant="success">OK</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Cylinders ──────────────────────────────────────────────────────────────────
function CylindersPage() {
  const [list,setList]=useState([]);
  const [form,setForm]=useState({physicalId:'',size:'5',gasType:'CO2'});
  const [autoQR,setAutoQR]=useState(true);
  const [manualQR,setManualQR]=useState('');
  const [editing,setEditing]=useState(null);
  const [open,setOpen]=useState(false);
  const [selected,setSelected]=useState([]);
  const [rangeFrom,setRangeFrom]=useState('');
  const [rangeTo,setRangeTo]=useState('');
  const [bulkN,setBulkN]=useState(10);
  const [del,setDel]=useState(null);

  const load=useCallback(async()=>{
    const s=await getDocs(collection(db,'cylinders'));
    setList(s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>parseInt(a.qrCode)-parseInt(b.qrCode)));
  },[]);
  useEffect(()=>{load();},[load]);

  const save=async()=>{
    const qr=editing?editing.qrCode:autoQR?nextQR(list):manualQR.trim();
    if(!qr) return alert('QR code required');
    if(!form.physicalId.trim()) return alert('Physical ID required');
    if(!editing&&list.find(c=>c.qrCode===qr)) return alert(`QR ${qr} already exists`);
    if(editing) await updateDoc(doc(db,'cylinders',editing.id),{physicalId:form.physicalId,size:form.size,gasType:form.gasType});
    else await addDoc(collection(db,'cylinders'),{qrCode:qr,...form,createdAt:serverTimestamp()});
    setOpen(false);setEditing(null);load();
  };

  const genPDF=async items=>{
    if(!items.length){alert('Nothing to generate');return;}
    try{
      const QRC=(await import('qrcode')).default;
      const {jsPDF}=await import('jspdf');
      const pdf=new jsPDF({unit:'mm',format:'a4'});
      const sz=55,mg=15,gap=8,cols=3;
      let x=mg,y=mg,n=0;
      for(const c of items){
        const img=await QRC.toDataURL(c.qrCode,{width:300,margin:1});
        pdf.addImage(img,'PNG',x,y,sz,sz);
        pdf.setFontSize(12);pdf.setFont('helvetica','bold');
        pdf.text(c.qrCode,x+sz/2,y+sz+5,{align:'center'});
        pdf.setFontSize(8);pdf.setFont('helvetica','normal');
        if(c.gasType!=='---') pdf.text(`${c.gasType} · ${c.size}m³`,x+sz/2,y+sz+10,{align:'center'});
        n++;x+=sz+gap;
        if(n%cols===0){x=mg;y+=sz+gap+14;}
        if(n%(cols*4)===0&&n<items.length){pdf.addPage();x=mg;y=mg;}
      }
      pdf.save('qr_codes.pdf');
    }catch(e){alert('PDF error: '+e.message);}
  };

  const genSel=()=>genPDF(list.filter(c=>selected.includes(c.id)));
  const genRange=()=>{
    const f=parseInt(rangeFrom),t=parseInt(rangeTo);
    if(isNaN(f)||isNaN(t)||f>t){alert('Invalid range');return;}
    genPDF(list.filter(c=>{const n=parseInt(c.qrCode);return n>=f&&n<=t;}));
  };
  const genBulk=async()=>{
    const start=list.length?Math.max(...list.map(c=>parseInt(c.qrCode)||0))+1:1;
    genPDF(Array.from({length:parseInt(bulkN)},(_,i)=>({qrCode:pad(start+i),gasType:'---',size:'---'})));
  };

  const toggleSel=id=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
  const toggleAll=()=>setSelected(selected.length===list.length?[]:list.map(c=>c.id));

  return (
    <div>
      <div className="ph">
        <div><h1>Cylinders</h1><p className="ph-sub">{list.length} total</p></div>
        <Btn small onClick={()=>{setEditing(null);setForm({physicalId:'',size:'5',gasType:'CO2'});setAutoQR(true);setManualQR('');setOpen(true);}}><Ic d={IC.plus} size={14}/> Add</Btn>
      </div>

      <div className="card card--inset">
        <div className="qr-gen-title">Generate QR Code PDFs</div>
        <div className="qr-gen-row">
          <div className="qr-gen-item">
            <div className="qg-label">Selected ({selected.length})</div>
            <Btn variant="secondary" small disabled={!selected.length} onClick={genSel}><Ic d={IC.dl} size={14}/> Download PDF</Btn>
          </div>
          <div className="qg-divider"/>
          <div className="qr-gen-item">
            <div className="qg-label">By Range</div>
            <div className="qg-inline">
              <Inp placeholder="From" value={rangeFrom} onChange={e=>setRangeFrom(e.target.value)} style={{width:64}}/>
              <span>—</span>
              <Inp placeholder="To" value={rangeTo} onChange={e=>setRangeTo(e.target.value)} style={{width:64}}/>
              <Btn variant="secondary" small onClick={genRange}><Ic d={IC.dl} size={14}/> Get PDF</Btn>
            </div>
          </div>
          <div className="qg-divider"/>
          <div className="qr-gen-item">
            <div className="qg-label">Bulk New (next: <strong>{nextQR(list)}</strong>)</div>
            <div className="qg-inline">
              <Inp type="number" value={bulkN} onChange={e=>setBulkN(e.target.value)} style={{width:64}}/>
              <span>codes</span>
              <Btn variant="secondary" small onClick={genBulk}><Ic d={IC.dl} size={14}/> Get PDF</Btn>
            </div>
          </div>
        </div>
      </div>

      <div className="tbl-ctrl">
        <label className="chk-label"><input type="checkbox" checked={selected.length===list.length&&list.length>0} onChange={toggleAll}/> Select all</label>
        {selected.length>0&&<span className="tbl-sel-count">{selected.length} selected</span>}
      </div>

      <DataTable cols={['','QR','Physical ID','Gas','Size','']}
        rows={list.map(c=>[
          <input type="checkbox" checked={selected.includes(c.id)} onChange={()=>toggleSel(c.id)} onClick={e=>e.stopPropagation()}/>,
          <strong>{c.qrCode}</strong>,c.physicalId,c.gasType,`${c.size} m³`,
          <div className="row-acts">
            <button className="icon-btn" onClick={()=>{setEditing(c);setForm({physicalId:c.physicalId,size:c.size,gasType:c.gasType});setOpen(true);}}><Ic d={IC.edit} size={14}/></button>
            <button className="icon-btn icon-btn--del" onClick={()=>setDel(c)}><Ic d={IC.trash} size={14}/></button>
          </div>])}/>

      <Modal open={open} title={editing?'Edit Cylinder':'Add Cylinder'} onClose={()=>setOpen(false)}>
        <div className="modal-body">
          {!editing&&(
            <label className="chk-label" style={{marginBottom:'1rem',display:'flex',gap:'0.5rem',alignItems:'center'}}>
              <input type="checkbox" checked={autoQR} onChange={e=>setAutoQR(e.target.checked)}/>
              Auto QR — next available: <strong>{nextQR(list)}</strong>
            </label>
          )}
          {(!autoQR&&!editing)&&<Fld label="QR Code"><Inp value={manualQR} onChange={e=>setManualQR(e.target.value)} placeholder="e.g. 042"/></Fld>}
          {editing&&<Fld label="QR Code"><Inp value={editing.qrCode} disabled/></Fld>}
          <Fld label="Physical ID" required><Inp value={form.physicalId} onChange={e=>setForm({...form,physicalId:e.target.value})} placeholder="e.g. CYL-553"/></Fld>
          <Fld label="Gas Type"><Sel value={form.gasType} onChange={e=>setForm({...form,gasType:e.target.value})}><option value="CO2">CO₂</option><option value="O2">O₂</option></Sel></Fld>
          <Fld label="Size (m³)"><Sel value={form.size} onChange={e=>setForm({...form,size:e.target.value})}>{['2','5','7','10','15','20','25','30'].map(s=><option key={s}>{s}</option>)}</Sel></Fld>
        </div>
        <div className="modal-foot"><Btn onClick={save}>Save</Btn><Btn variant="secondary" onClick={()=>setOpen(false)}>Cancel</Btn></div>
      </Modal>
      <Modal open={!!del} title="Delete Cylinder" onClose={()=>setDel(null)}>
        <div className="modal-body"><p>Delete cylinder <strong>{del?.qrCode}</strong>?</p></div>
        <div className="modal-foot"><Btn danger onClick={async()=>{await deleteDoc(doc(db,'cylinders',del.id));setDel(null);load();}}>Delete</Btn><Btn variant="secondary" onClick={()=>setDel(null)}>Cancel</Btn></div>
      </Modal>
    </div>
  );
}

// ── Cylinder Analytics ─────────────────────────────────────────────────────────
function CylAnalytics({ settings }) {
  const [cyls,setCyls]=useState([]);
  const [movements,setMovements]=useState([]);
  const [qrQ,setQrQ]=useState('');
  const [physQ,setPhysQ]=useState('');
  const [gasF,setGasF]=useState('All');
  const [statusF,setStatusF]=useState('All');
  const [overdueF,setOverdueF]=useState('All');
  const [sortK,setSortK]=useState('qrCode');
  const [sortD,setSortD]=useState('asc');
  const [sel,setSel]=useState(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    (async()=>{
      const [cs,ms]=await Promise.all([getDocs(collection(db,'cylinders')),getDocs(collection(db,'movements'))]);
      setCyls(cs.docs.map(d=>({id:d.id,...d.data()})));
      setMovements(ms.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);
    })();
  },[]);

  const calcStats=qr=>{
    const sorted=[...movements].sort((a,b)=>tsToDate(a.createdAt)-tsToDate(b.createdAt));
    let status='available',customer=null,deliveredAt=null,trips=0;
    const history=[];
    sorted.forEach(m=>{
      if((m.qrCodes||[]).includes(qr)){
        if(m.type==='outward'){status='out';customer=m.customerName;deliveredAt=m.createdAt;trips++;}
        else{status='available';customer=null;deliveredAt=null;}
        history.push({date:m.createdAt,type:m.type,customer:m.customerName,driver:m.driverName});
      }
    });
    const daysOut=status==='out'?daysSince(deliveredAt):0;
    const overdue=status==='out'?(daysOut>=settings.overdueCriticalDays?'critical':daysOut>=settings.overdueWarningDays?'warning':'ok'):'ok';
    return{status,customer,daysOut,trips,overdue,history:[...history].reverse()};
  };

  const sort=k=>{if(sortK===k)setSortD(d=>d==='asc'?'desc':'asc');else{setSortK(k);setSortD('asc');}};

  const enriched=cyls.map(c=>({...c,_s:calcStats(c.qrCode)})).filter(c=>{
    if(!c.qrCode.includes(qrQ)) return false;
    if(!c.physicalId?.includes(physQ)) return false;
    if(gasF!=='All'&&c.gasType!==gasF) return false;
    if(statusF==='Out'&&c._s.status!=='out') return false;
    if(statusF==='Available'&&c._s.status!=='available') return false;
    if(overdueF==='Warning'&&c._s.overdue!=='warning') return false;
    if(overdueF==='Critical'&&c._s.overdue!=='critical') return false;
    return true;
  }).sort((a,b)=>{
    const av=sortK==='qrCode'?parseInt(a.qrCode):sortK==='daysOut'?a._s.daysOut:sortK==='trips'?a._s.trips:a[sortK]||'';
    const bv=sortK==='qrCode'?parseInt(b.qrCode):sortK==='daysOut'?b._s.daysOut:sortK==='trips'?b._s.trips:b[sortK]||'';
    return sortD==='asc'?(av<bv?-1:1):(av>bv?-1:1);
  });

  const co2=enriched.filter(c=>c.gasType==='CO2');
  const o2=enriched.filter(c=>c.gasType==='O2');

  const CylTable=({rows,title})=>(
    <>
      <h3 className="sec-title">{title} <span className="sec-count">{rows.length}</span></h3>
      <div className="tbl-scroll">
        <table className="tbl">
          <thead><tr>
            <SortTh active={sortK==='qrCode'} dir={sortD} onClick={()=>sort('qrCode')}>QR</SortTh>
            <th>Physical ID</th>
            <SortTh active={sortK==='size'} dir={sortD} onClick={()=>sort('size')}>Size</SortTh>
            <SortTh active={sortK==='status'} dir={sortD} onClick={()=>sort('status')}>Status</SortTh>
            <th>Customer</th>
            <SortTh active={sortK==='daysOut'} dir={sortD} onClick={()=>sort('daysOut')}>Days Out</SortTh>
            <SortTh active={sortK==='trips'} dir={sortD} onClick={()=>sort('trips')}>Trips</SortTh>
          </tr></thead>
          <tbody>
            {rows.map(c=>(
              <tr key={c.id} className="tbl-row--link" onClick={()=>setSel(c)}>
                <td><strong>{c.qrCode}</strong></td>
                <td>{c.physicalId}</td>
                <td>{c.size} m³</td>
                <td>{c._s.status==='out'?<Badge variant="warning">Out</Badge>:<Badge variant="success">Available</Badge>}</td>
                <td>{c._s.customer||'—'}</td>
                <td>{c._s.status==='out'?(c._s.overdue==='critical'?<Badge variant="danger">{c._s.daysOut}d</Badge>:c._s.overdue==='warning'?<Badge variant="warning">{c._s.daysOut}d</Badge>:`${c._s.daysOut}d`):'—'}</td>
                <td>{c._s.trips}</td>
              </tr>
            ))}
            {rows.length===0&&<tr><td colSpan={7} className="tbl-empty">No cylinders match filters</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );

  if(sel){
    const s=sel._s;
    return (
      <div>
        <button className="back-link" onClick={()=>setSel(null)}><Ic d={IC.back} size={15}/> All Cylinders</button>
        <div className="ph"><h1>Cylinder {sel.qrCode}</h1><p className="ph-sub">Physical: {sel.physicalId} · {sel.gasType} · {sel.size} m³</p></div>
        <div className="cards-grid">
          <SCard label="Status" value={s.status==='out'?'OUT':'AVAILABLE'} color={s.status==='out'?'var(--amber)':'var(--teal)'}/>
          <SCard label="With Customer" value={s.customer||'—'} color="var(--blue)"/>
          <SCard label="Days Out" value={s.status==='out'?`${s.daysOut}d`:'—'} color={s.overdue==='critical'?'var(--red)':s.overdue==='warning'?'var(--amber)':'var(--teal)'}/>
          <SCard label="Total Trips" value={s.trips} color="var(--purple)"/>
        </div>
        <h3 className="sec-title">Movement History</h3>
        <DataTable cols={['Date','Type','Customer','Driver']}
          rows={s.history.map(h=>[fmt(h.date),h.type==='outward'?<Badge variant="danger">Out</Badge>:<Badge variant="success">In</Badge>,h.customer,h.driver])}/>
      </div>
    );
  }

  return (
    <div>
      <div className="ph"><h1>Cylinder Analytics</h1></div>
      <div className="filter-row">
        <div className="search-wrap"><Ic d={IC.search} size={15}/><input placeholder="QR code…" value={qrQ} onChange={e=>setQrQ(e.target.value)}/></div>
        <div className="search-wrap"><Ic d={IC.search} size={15}/><input placeholder="Physical ID…" value={physQ} onChange={e=>setPhysQ(e.target.value)}/></div>
        <Sel value={statusF} onChange={e=>setStatusF(e.target.value)} style={{width:'auto'}}><option>All</option><option>Out</option><option>Available</option></Sel>
        <Sel value={overdueF} onChange={e=>setOverdueF(e.target.value)} style={{width:'auto'}}><option value="All">All Statuses</option><option value="Warning">Warning</option><option value="Critical">Critical</option></Sel>
        <Btn variant="secondary" small onClick={()=>{setQrQ('');setPhysQ('');setGasF('All');setStatusF('All');setOverdueF('All');}}>Clear</Btn>
      </div>
      {loading?<div className="pg-loading">Loading…</div>:<><CylTable rows={co2} title="CO₂ Cylinders"/><CylTable rows={o2} title="O₂ Cylinders"/></>}
    </div>
  );
}

// ── Movement History ───────────────────────────────────────────────────────────
function HistoryPage() {
  const [list,setList]=useState([]);
  const [typeF,setTypeF]=useState('All');
  const [custF,setCustF]=useState('');
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    getDocs(collection(db,'movements')).then(s=>{
      setList(s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>tsToDate(b.createdAt)-tsToDate(a.createdAt)));
      setLoading(false);
    });
  },[]);

  const filtered=list.filter(m=>{
    if(typeF!=='All'&&m.type!==typeF.toLowerCase()) return false;
    if(custF&&!m.customerName?.toLowerCase().includes(custF.toLowerCase())) return false;
    if(from){const d=tsToDate(m.createdAt);if(!d||d<new Date(from)) return false;}
    if(to){const d=tsToDate(m.createdAt);if(!d||d>new Date(to+'T23:59:59')) return false;}
    return true;
  });

  return (
    <div>
      <div className="ph"><h1>Movement History</h1><p className="ph-sub">{filtered.length} entries</p></div>
      <div className="filter-row">
        <Sel value={typeF} onChange={e=>setTypeF(e.target.value)} style={{width:'auto'}}><option>All</option><option>Outward</option><option>Inward</option></Sel>
        <div className="search-wrap"><Ic d={IC.search} size={15}/><input placeholder="Customer…" value={custF} onChange={e=>setCustF(e.target.value)}/></div>
        <Inp type="date" value={from} onChange={e=>setFrom(e.target.value)} style={{width:'auto'}}/>
        <Inp type="date" value={to} onChange={e=>setTo(e.target.value)} style={{width:'auto'}}/>
        <Btn variant="secondary" small onClick={()=>{setTypeF('All');setCustF('');setFrom('');setTo('');}}>Clear</Btn>
      </div>
      {loading?<div className="pg-loading">Loading…</div>:(
        <DataTable cols={['Date & Time','Type','Customer','QR Codes','Qty','Driver']}
          rows={filtered.map(m=>[fmtTime(m.createdAt),m.type==='outward'?<Badge variant="danger">Outward</Badge>:<Badge variant="success">Inward</Badge>,m.customerName,(m.qrCodes||[]).join(', '),m.quantity||(m.qrCodes||[]).length,m.driverName])}/>
      )}
    </div>
  );
}

// ── Driver Analytics ───────────────────────────────────────────────────────────
function DriverAnalytics() {
  const [users,setUsers]=useState([]);
  const [movements,setMovements]=useState([]);
  const [sel,setSel]=useState(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    (async()=>{
      const [us,ms]=await Promise.all([getDocs(collection(db,'users')),getDocs(collection(db,'movements'))]);
      setUsers(us.docs.map(d=>({id:d.id,...d.data()})).filter(u=>u.role==='driver'));
      setMovements(ms.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);
    })();
  },[]);

  const dStats=(uid,name)=>{
    const mv=movements.filter(m=>m.driverId===uid||m.driverName===name);
    const del=mv.filter(m=>m.type==='outward').length;
    const ret=mv.filter(m=>m.type==='inward').length;
    const cyls=mv.reduce((s,m)=>s+(m.qrCodes?.length||0),0);
    const cc={};
    mv.forEach(m=>{if(m.customerName) cc[m.customerName]=(cc[m.customerName]||0)+1;});
    const top=Object.entries(cc).sort((a,b)=>b[1]-a[1]);
    return{del,ret,cyls,total:mv.length,top,mv:mv.sort((a,b)=>tsToDate(b.createdAt)-tsToDate(a.createdAt))};
  };

  if(sel){
    const s=dStats(sel.id,sel.name);
    return (
      <div>
        <button className="back-link" onClick={()=>setSel(null)}><Ic d={IC.back} size={15}/> All Drivers</button>
        <div className="ph"><h1>{sel.name}</h1><p className="ph-sub">{sel.email}</p></div>
        <div className="cards-grid">
          <SCard label="Deliveries" value={s.del} color="var(--red)"/>
          <SCard label="Returns" value={s.ret} color="var(--teal)"/>
          <SCard label="Cylinders Handled" value={s.cyls} color="var(--blue)"/>
          <SCard label="Total Trips" value={s.total} color="var(--purple)"/>
        </div>
        <h3 className="sec-title">Customer Visits</h3>
        <p className="sec-note">High concentration on one customer may indicate a preference or bias.</p>
        <DataTable cols={['Customer','Trips','% of Total']}
          rows={s.top.map(([name,n])=>[name,n,`${s.total?Math.round(n/s.total*100):0}%`])}/>
        <h3 className="sec-title">Recent Activity</h3>
        <DataTable cols={['Date','Type','Customer','Cylinders']}
          rows={s.mv.slice(0,30).map(m=>[fmt(m.createdAt),m.type==='outward'?<Badge variant="danger">Out</Badge>:<Badge variant="success">In</Badge>,m.customerName,m.qrCodes?.length||0])}/>
      </div>
    );
  }

  const all=users.map(u=>({...u,_s:dStats(u.id,u.name)})).sort((a,b)=>b._s.total-a._s.total);
  return (
    <div>
      <div className="ph"><h1>Driver Analytics</h1><p className="ph-sub">Click a driver for detailed breakdown</p></div>
      {loading?<div className="pg-loading">Loading…</div>:(
        <DataTable cols={['Driver','Deliveries','Returns','Cylinders Handled','Total Trips','Top Customer']}
          rows={all.map(d=>[<strong>{d.name}</strong>,d._s.del,d._s.ret,d._s.cyls,d._s.total,d._s.top[0]?.[0]||'—'])}
          onRowClick={i=>setSel(all[i])}/>
      )}
    </div>
  );
}

// ── Users ──────────────────────────────────────────────────────────────────────
function UsersPage() {
  const [list,setList]=useState([]);
  const [form,setForm]=useState({name:'',email:'',password:'',role:'driver'});
  const [editing,setEditing]=useState(null);
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);

  const load=useCallback(async()=>{
    const s=await getDocs(collection(db,'users'));
    setList(s.docs.map(d=>({id:d.id,...d.data()})));
  },[]);
  useEffect(()=>{load();},[load]);

  const save=async()=>{
    if(!form.name||!form.email) return alert('Name and email required');
    setBusy(true);
    try{
      if(editing){
        await updateDoc(doc(db,'users',editing.id),{name:form.name,email:form.email,role:form.role});
      }else{
        if(!form.password) return alert('Password required');
        const secondary=initializeApp(firebaseConfig,'helper_'+Date.now());
        const sa=getAuth(secondary);
        const cred=await createUserWithEmailAndPassword(sa,form.email,form.password);
        await setDoc(doc(db,'users',cred.user.uid),{name:form.name,email:form.email,role:form.role,createdAt:serverTimestamp()});
        await signOut(sa);
      }
      setOpen(false);setEditing(null);load();
    }catch(e){alert(e.message);}
    setBusy(false);
  };

  return (
    <div>
      <div className="ph">
        <div><h1>Users</h1><p className="ph-sub">{list.length} total</p></div>
        <Btn small onClick={()=>{setEditing(null);setForm({name:'',email:'',password:'',role:'driver'});setOpen(true);}}><Ic d={IC.plus} size={14}/> Create User</Btn>
      </div>
      <DataTable cols={['Name','Email','Role','']}
        rows={list.map(u=>[u.name,u.email,<Badge variant={u.role}>{u.role}</Badge>,
          <div className="row-acts">
            <button className="icon-btn" onClick={()=>{setEditing(u);setForm({name:u.name,email:u.email,role:u.role,password:''});setOpen(true);}}><Ic d={IC.edit} size={14}/></button>
            <button className="icon-btn icon-btn--del" onClick={async()=>{if(window.confirm(`Delete ${u.name}?`)){await deleteDoc(doc(db,'users',u.id));load();}}}><Ic d={IC.trash} size={14}/></button>
          </div>])}/>
      <Modal open={open} title={editing?'Edit User':'Create User'} onClose={()=>setOpen(false)}>
        <div className="modal-body">
          <Fld label="Full Name" required><Inp value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Full name"/></Fld>
          <Fld label="Email" required><Inp type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="user@cylinder.local"/></Fld>
          {!editing&&<Fld label="Password" required><Inp type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Min. 6 characters"/></Fld>}
          <Fld label="Role"><Sel value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="driver">Driver</option><option value="admin">Admin</option><option value="superadmin">Super Admin</option></Sel></Fld>
          {editing&&<p style={{fontSize:'0.8rem',color:'var(--muted)',marginTop:'0.5rem'}}>Password resets are done via Firebase Console.</p>}
        </div>
        <div className="modal-foot"><Btn onClick={save} disabled={busy}>{busy?'Saving…':'Save'}</Btn><Btn variant="secondary" onClick={()=>setOpen(false)}>Cancel</Btn></div>
      </Modal>
    </div>
  );
}

// ── Settings ───────────────────────────────────────────────────────────────────
function SettingsPage({ settings, setSettings }) {
  const [form,setForm]=useState({...settings});
  const [confirm,setConfirm]=useState(false);
  const [saved,setSaved]=useState(false);

  const doSave=async()=>{
    await setDoc(doc(db,'appSettings','thresholds'),form);
    setSettings(form);setConfirm(false);setSaved(true);
    setTimeout(()=>setSaved(false),3000);
  };

  const NF=({label,k,suffix})=>(
    <div className="setting-row">
      <span className="setting-label">{label}</span>
      <div className="setting-ctrl">
        <Inp type="number" min={1} value={form[k]} onChange={e=>setForm({...form,[k]:parseInt(e.target.value)||0})} style={{width:72}}/>
        <span className="setting-suffix">{suffix}</span>
      </div>
    </div>
  );

  return (
    <div>
      <div className="ph"><h1>Settings</h1><p className="ph-sub">Changes apply immediately across all analytics</p></div>
      {saved&&<div className="success-bar">✓ Settings saved.</div>}
      <div className="settings-block">
        <div className="settings-block-title">Overdue Thresholds</div>
        <NF label="Warning threshold" k="overdueWarningDays" suffix="days"/>
        <NF label="Critical threshold" k="overdueCriticalDays" suffix="days"/>
      </div>
      <div className="settings-block">
        <div className="settings-block-title">Turnaround Time Groups</div>
        <NF label="Fast — under" k="tatFastDays" suffix="days"/>
        <NF label="Medium — up to" k="tatMediumDays" suffix="days"/>
        <p className="setting-note">Slow = above medium threshold</p>
      </div>
      <div className="settings-block">
        <div className="settings-block-title">Cylinder Usage Groups (per 90 days)</div>
        <NF label="High usage — over" k="usageHighTrips" suffix="trips"/>
        <NF label="Medium usage — over" k="usageMediumTrips" suffix="trips"/>
        <p className="setting-note">Low = below medium threshold</p>
      </div>
      <div className="settings-block">
        <div className="settings-block-title">Edit Windows</div>
        <NF label="Driver can edit entry for" k="driverEditHours" suffix="hours"/>
        <NF label="Admin can edit entry for" k="adminEditHours" suffix="hours"/>
      </div>
      <Btn onClick={()=>setConfirm(true)}>Save Settings</Btn>
      <Modal open={confirm} title="Confirm" onClose={()=>setConfirm(false)}>
        <div className="modal-body"><p>These changes apply immediately across the whole app. Continue?</p></div>
        <div className="modal-foot"><Btn onClick={doSave}>Yes, Save</Btn><Btn variant="secondary" onClick={()=>setConfirm(false)}>Cancel</Btn></div>
      </Modal>
    </div>
  );
}
