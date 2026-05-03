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
const fbApp = getApps().find(a => a.name === '[DEFAULT]') || initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);

const DEFAULT_SETTINGS = {
  overdueWarningDays: 30, overdueCriticalDays: 60,
  tatFastDays: 20, tatMediumDays: 35,
  usageHighTrips: 15, usageMediumTrips: 8,
  driverEditHours: 24, adminEditHours: 48,
};

const toDate = ts => ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
const daysSince = ts => { const d = toDate(ts); return d ? Math.floor((Date.now() - d) / 86400000) : 0; };
const fmtDate = ts => { const d = toDate(ts); return d ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; };
const fmtDT = ts => { const d = toDate(ts); return d ? d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; };
const pad3 = n => String(n).padStart(3, '0');
const nextQR = list => list.length ? pad3(Math.max(...list.map(c => parseInt(c.qrCode) || 0)) + 1) : '001';

// ── CHANGE 1: CCPL display format ─────────────────────────────────────────
// Formats QR code for display: "001" → "CCPL-00001"
const fmtQR = qr => {
  if (!qr) return qr;
  const n = parseInt(qr);
  if (isNaN(n)) return qr;
  return `CCPL-${String(n).padStart(5, '0')}`;
};

const Svg = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d={d} />
  </svg>
);

const IC = {
  dash: "M3 12h4l3 8 4-16 3 8h4", users: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
  pkg: "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z",
  chart: "M18 20V10M12 20V4M6 20v-6", trend: "M23 6l-9.5 9.5-5-5L1 18",
  truck: "M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5.5 21a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM18.5 21a1.5 1.5 0 100-3 1.5 1.5 0 000 3z",
  alert: "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01",
  clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0",
  cog: "M12 15a3 3 0 100-6 3 3 0 000 6M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",
  plus: "M12 5v14M5 12h14", edit: "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6", eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8M12 9a3 3 0 100 6 3 3 0 000-6",
  eyeoff: "M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22",
  x: "M18 6L6 18M6 6l12 12", dl: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3",
  search: "M11 17a6 6 0 100-12 6 6 0 000 12zM21 21l-4.35-4.35", logout: "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
  check: "M20 6L9 17l-5-5", back: "M19 12H5M12 19l-7-7 7-7",
  camera: "M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2zM12 17a4 4 0 100-8 4 4 0 000 8z",
  history2: "M3 3h18v18H3zM3 9h18M9 21V9",
  pin: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zM12 11.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z",
};

const Btn = ({ children, variant = 'primary', danger, sm, full, disabled, onClick, type = 'button' }) => (
  <button type={type} disabled={disabled} onClick={onClick}
    className={['btn', `btn-${danger ? 'danger' : variant}`, sm && 'btn-sm', full && 'btn-full'].filter(Boolean).join(' ')}>
    {children}
  </button>
);

const Tag = ({ children, color }) => <span className={`tag tag-${color}`}>{children}</span>;

const Modal = ({ open, title, onClose, children }) => {
  if (!open) return null;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hd">
          <span className="modal-ttl">{title}</span>
          <button className="modal-x" onClick={onClose}><Svg d={IC.x} /></button>
        </div>
        {children}
      </div>
    </div>
  );
};

const Field = ({ label, req, children }) => (
  <div className="field">
    <label className="field-lbl">{label}{req && <span className="req"> *</span>}</label>
    {children}
  </div>
);

const Inp = p => <input className="inp" {...p} />;
const Sel = ({ children, ...p }) => <select className="inp" {...p}>{children}</select>;

const KPI = ({ label, value, color, sub, onClick }) => (
  <div className="kpi-card" style={{ borderTopColor: color }} onClick={onClick} data-click={!!onClick}>
    <div className="kpi-value" style={{ color }}>{value}</div>
    <div className="kpi-label">{label}</div>
    {sub && <div className="kpi-sub">{sub}</div>}
    {onClick && <div className="kpi-cta">View details →</div>}
  </div>
);

const SortTh = ({ label, k, sortK, sortD, onSort }) => (
  <th className="th-s" onClick={() => onSort(k)}>
    {label} <span className="sort-ic">{sortK === k ? (sortD === 'asc' ? '▲' : '▼') : '⇅'}</span>
  </th>
);

const Tbl = ({ cols, rows, onRow, empty = 'No data.' }) => (
  <div className="tbl-wrap">
    <table className="tbl">
      <thead><tr>{cols.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
      <tbody>
        {rows.length === 0
          ? <tr><td colSpan={cols.length} className="tbl-empty">{empty}</td></tr>
          : rows.map((r, i) => (
            <tr key={i} className={onRow ? 'tbl-link' : ''} onClick={() => onRow?.(i)}>
              {r.map((cell, j) => <td key={j}>{cell}</td>)}
            </tr>
          ))}
      </tbody>
    </table>
  </div>
);

const BackBtn = ({ onClick }) => (
  <button className="back-btn" onClick={onClick}><Svg d={IC.back} /> Back</button>
);

const SearchBar = ({ placeholder, value, onChange }) => (
  <div className="search-bar">
    <Svg d={IC.search} size={15} />
    <input placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
  </div>
);

// ── CHANGE 2: GPS distance helper ─────────────────────────────────────────
const gpsDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState('dashboard');

  useEffect(() => auth.onAuthStateChanged(async u => {
    if (u) {
      const snap = await getDoc(doc(db, 'users', u.uid));
      if (snap.exists()) setProfile({ uid: u.uid, ...snap.data() });
      const ss = await getDoc(doc(db, 'appSettings', 'thresholds'));
      if (ss.exists()) setSettings(s => ({ ...s, ...ss.data() }));
    } else { setProfile(null); }
    setUser(u); setReady(true);
  }), []);

  if (!ready) return <div className="splash">Loading…</div>;
  if (!user || !profile) return <LoginScreen />;

  const role = profile.role;
  const isAdmin = role === 'admin' || role === 'superadmin';
  const isSA = role === 'superadmin';
  const isDrv = role === 'driver';

  const NAV = [
    { id: 'dashboard', label: 'Dashboard', icon: IC.dash, show: true },
    { id: 'record', label: 'Record Trip', icon: IC.truck, show: isDrv },
    { id: 'my-trips', label: 'My Trips', icon: IC.history2, show: isDrv },
    { id: 'vehicles', label: 'Vehicles', icon: IC.truck, show: isAdmin },
    { id: 'customers', label: 'Customers', icon: IC.users, show: isAdmin },
    { id: 'cust-analytics', label: 'Customer Analytics', icon: IC.trend, show: isAdmin },
    { id: 'cylinders', label: 'Cylinders', icon: IC.pkg, show: isAdmin },
    { id: 'cyl-analytics', label: 'Cylinder Analytics', icon: IC.alert, show: isAdmin },
    { id: 'history', label: 'Trip History', icon: IC.clock, show: isAdmin },
    { id: 'driver-analytics', label: 'Driver Analytics', icon: IC.chart, show: isSA },
    { id: 'users', label: 'Users', icon: IC.users, show: isSA },
    { id: 'settings', label: 'Settings', icon: IC.cog, show: isSA },
  ].filter(n => n.show);

  const PAGES = {
    dashboard: <Dashboard settings={settings} isAdmin={isAdmin} goTo={setPage} />,
    record: <RecordTrip profile={profile} />,
    'my-trips': <MyTrips profile={profile} settings={settings} />,
    customers: <Customers isSA={isSA} />,
    vehicles: <Vehicles />,
    'cust-analytics': <CustAnalytics settings={settings} />,
    cylinders: <Cylinders />,
    'cyl-analytics': <CylAnalytics settings={settings} />,
    history: <TripHistory />,
    'driver-analytics': <DriverAnalytics />,
    users: <Users />,
    settings: <SettingsPage settings={settings} setSettings={setSettings} />,
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">⬡</span>
          <div>
            <div className="brand-name">CylTrack</div>
            <div className="brand-sub">Gas Cylinder System</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(n => (
            <button key={n.id} className={`nav-item${page === n.id ? ' nav-item-active' : ''}`} onClick={() => setPage(n.id)}>
              <Svg d={n.icon} size={15} /><span>{n.label}</span>
            </button>
          ))}
          <button className="nav-item nav-item-signout-mobile" onClick={() => signOut(auth)}>
            <Svg d={IC.logout} size={15} /><span>Sign out</span>
          </button>
        </nav>
        <div className="sidebar-foot">
          <div className="sidebar-user">
            <div className="su-name">{profile.name || profile.email}</div>
            <Tag color={role}>{role}</Tag>
          </div>
          <button className="logout-btn" onClick={() => signOut(auth)}>
            <Svg d={IC.logout} size={14} /> Sign out
          </button>
        </div>
      </aside>
      <main className="main-content">
        <div className="page-inner">{PAGES[page] || PAGES.dashboard}</div>
      </main>
    </div>
  );
}

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
        <h1 className="login-h">CylTrack</h1>
        <p className="login-sub">Gas Cylinder Management System</p>
        <form onSubmit={submit} style={{ marginTop: '1.75rem' }}>
          <Field label="Email"><Inp type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@cylinder.local" required /></Field>
          <Field label="Password">
            <div className="pw-wrap">
              <Inp type={show ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••" required />
              <button type="button" className="pw-eye" onClick={() => setShow(s => !s)}><Svg d={show ? IC.eyeoff : IC.eye} size={16} /></button>
            </div>
          </Field>
          {err && <div className="login-err">{err}</div>}
          <Btn type="submit" full>Sign In</Btn>
        </form>
        <button className="forgot-link" onClick={() => setForgot(true)}>Forgot password?</button>
      </div>
      <Modal open={forgot} title="Password Reset" onClose={() => setForgot(false)}>
        <div className="modal-body">
          <p>Contact the administrator for a password reset:</p>
          <div className="contact-box">vishalpranav23@gmail.com</div>
          <p style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: '#888' }}>Include your login email in the message.</p>
        </div>
        <div className="modal-ft"><Btn onClick={() => setForgot(false)}>Close</Btn></div>
      </Modal>
    </div>
  );
}

function Dashboard({ settings, isAdmin, goTo }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, 'trips'));
      const trips = snap.docs.map(d => ({ ...d.data() }));
      const held = {};
      trips.sort((a, b) => toDate(a.createdAt) - toDate(b.createdAt)).forEach(t => {
        (t.delivered || []).forEach(qr => { held[qr] = { since: t.createdAt, gas: t.gasTypes?.[qr] }; });
        (t.collected || []).forEach(qr => { delete held[qr]; });
      });
      let totalOut = 0, warn = 0, crit = 0, co2 = 0, o2 = 0;
      Object.values(held).forEach(c => {
        totalOut++;
        const d = daysSince(c.since);
        if (d >= settings.overdueCriticalDays) crit++;
        else if (d >= settings.overdueWarningDays) warn++;
        if (c.gas === 'CO2') co2++; else if (c.gas === 'O2') o2++;
      });
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tripsToday = trips.filter(t => toDate(t.createdAt) >= today).length;
      setStats({ totalOut, warn, crit, co2, o2, tripsToday });
    })();
  }, [settings]);

  if (!stats) return <div className="pg-load">Loading dashboard…</div>;

  return (
    <div>
      <div className="pg-hd">
        <div><h1>Dashboard</h1><p className="pg-sub">Live overview of your cylinder operations</p></div>
      </div>
      <div className="kpi-grid">
        <KPI label="Cylinders Currently Out" value={stats.totalOut} color="#2563eb" onClick={isAdmin ? () => goTo('cyl-analytics') : undefined} />
        <KPI label={`Warning — ≥${settings.overdueWarningDays} days out`} value={stats.warn} color="#d97706" onClick={isAdmin ? () => goTo('cyl-analytics') : undefined} />
        <KPI label={`Critical — ≥${settings.overdueCriticalDays} days out`} value={stats.crit} color="#dc2626" onClick={isAdmin ? () => goTo('cyl-analytics') : undefined} />
        <KPI label="CO₂ Currently Out" value={stats.co2} color="#0891b2" />
        <KPI label="O₂ Currently Out" value={stats.o2} color="#7c3aed" />
        <KPI label="Trips Recorded Today" value={stats.tripsToday} color="#059669" />
      </div>
      {isAdmin && stats.crit > 0 && (
        <div className="alert-banner">
          <Svg d={IC.alert} size={16} />
          <strong>{stats.crit} cylinder{stats.crit > 1 ? 's' : ''}</strong> critically overdue (≥{settings.overdueCriticalDays} days).
          <button onClick={() => goTo('cyl-analytics')}>View →</button>
        </div>
      )}
      {isAdmin && <div className="dash-tip"><strong>Tip:</strong> Click any metric card to jump to the relevant analytics page.</div>}
    </div>
  );
}

// ── CHANGE 3: RecordTrip with GPS nearest customer ─────────────────────────
function RecordTrip({ profile }) {
  const [step, setStep] = useState(1);
  const [customers, setCustomers] = useState([]);
  const [cylinders, setCylinders] = useState([]);
  const [custId, setCustId] = useState('');
  const [deliverQty, setDeliverQty] = useState('');
  const [collectQty, setCollectQty] = useState('');
  const [delivered, setDelivered] = useState([]);
  const [collected, setCollected] = useState([]);
  const [manualD, setManualD] = useState('');
  const [manualC, setManualC] = useState('');
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const [savedTripId, setSavedTripId] = useState(null);
  const [savedCustId, setSavedCustId] = useState(null);
  const [notes, setNotes] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [scanning, setScanning] = useState(null);
  const [nearbyCustomers, setNearbyCustomers] = useState([]);
  const [gpsStatus, setGpsStatus] = useState('idle'); // idle | loading | done | error
  const videoRef = React.useRef(null);
  const streamRef = React.useRef(null);

  useEffect(() => {
    getDocs(collection(db, 'customers')).then(s => setCustomers(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    getDocs(collection(db, 'cylinders')).then(s => setCylinders(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    getDocs(collection(db, 'vehicles')).then(s => setVehicles(s.docs.map(d => ({ id: d.id, ...d.data() })).filter(v => v.active !== false)));
  }, []);

  // Get nearby customers on mount
  useEffect(() => {
    if (!navigator.geolocation) return;
    setGpsStatus('loading');
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude, longitude } = pos.coords;
      getDocs(collection(db, 'customers')).then(s => {
        const all = s.docs.map(d => ({ id: d.id, ...d.data() }));
        const withDist = all
          .filter(c => c.lat && c.lng)
          .map(c => ({ ...c, dist: gpsDistance(latitude, longitude, c.lat, c.lng) }))
          .sort((a, b) => a.dist - b.dist)
          .slice(0, 3);
        setNearbyCustomers(withDist);
        setGpsStatus('done');
      });
    }, () => setGpsStatus('error'));
  }, []);

  useEffect(() => {
    if (!scanning) { stopCamera(); return; }
    startCamera();
  }, [scanning]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      scanLoop();
    } catch (e) { setErr('Camera not available: ' + e.message); setScanning(null); }
  };

  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  };

  const scanLoop = async () => {
    if (!('BarcodeDetector' in window)) {
      setErr('Camera scanning not supported on this browser. Use Chrome on Android or Safari 17+ on iOS. Please type QR codes manually.');
      setScanning(null); stopCamera(); return;
    }
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    const detect = async () => {
      if (!videoRef.current || !streamRef.current) return;
      try {
        const codes = await detector.detect(videoRef.current);
        if (codes.length > 0) {
          const raw = codes[0].rawValue;
          if (scanning === 'delivered') addCode(raw, delivered, setDelivered, parseInt(deliverQty), 'delivered');
          else addCode(raw, collected, setCollected, parseInt(collectQty), 'collected');
          setTimeout(detect, 1500);
        } else { requestAnimationFrame(detect); }
      } catch { requestAnimationFrame(detect); }
    };
    detect();
  };

  const cylInfo = qr => cylinders.find(c => c.qrCode === qr);

  const addCode = (code, list, setList, maxQty, label) => {
    const c = code.trim(); if (!c) return;
    if (list.includes(c)) { setErr(`QR ${c} already added`); return; }
    if (!cylinders.find(x => x.qrCode === c)) { setErr(`QR ${c} not found in system`); return; }
    if (list.length >= parseInt(maxQty)) { setErr(`Limit reached (${maxQty})`); return; }
    setList(p => [...p, c]);
    if (label === 'delivered') setManualD(''); else setManualC('');
    setErr('');
  };

  const save = async () => {
    if (delivered.length !== parseInt(deliverQty)) { setErr(`Need ${deliverQty} delivered QR codes`); return; }
    if (collectQty && parseInt(collectQty) > 0 && collected.length !== parseInt(collectQty)) { setErr(`Need ${collectQty} collected QR codes`); return; }
    const cust = customers.find(c => c.id === custId);
    const gasTypes = {};
    [...delivered, ...collected].forEach(qr => { const c = cylInfo(qr); if (c) gasTypes[qr] = c.gasType; });
    stopCamera(); setScanning(null);
    const ref = await addDoc(collection(db, 'trips'), {
      customerId: custId, customerName: cust?.name || '',
      driverId: profile.uid, driverName: profile.name || profile.email,
      delivered, collected: parseInt(collectQty) > 0 ? collected : [],
      gasTypes, deliverQty: parseInt(deliverQty), collectQty: parseInt(collectQty) || 0,
      notes, vehicle, createdAt: serverTimestamp(), _timestamp: new Date().toISOString(),
    });
    setSavedTripId(ref.id);
    setSavedCustId(custId);
    setDone(true);
  };

  const reset = () => {
    stopCamera(); setScanning(null);
    setStep(1); setCustId(''); setDeliverQty(''); setCollectQty('');
    setDelivered([]); setCollected([]); setManualD(''); setManualC('');
    setErr(''); setNotes(''); setVehicle(''); setDone(false);
    setSavedTripId(null); setSavedCustId(null);
  };

  if (done) {
    const cust = customers.find(c => c.id === custId || c.id === savedCustId);
    return (
      <TripDoneScreen
        cust={cust}
        deliverQty={deliverQty}
        collectQty={collectQty}
        vehicle={vehicle}
        onReset={reset}
      />
    );
  }

  if (step === 1) return (
    <div>
      <div className="pg-hd"><h1>Record Trip</h1><p className="pg-sub">Log a delivery and collection in one entry</p></div>
      <div className="card">
        {/* ── Nearby customers suggestion ── */}
        {nearbyCustomers.length > 0 && (
          <div className="nearby-box">
            <div className="nearby-label"><Svg d={IC.pin} size={13} /> Nearby customers</div>
            <div className="nearby-chips">
              {nearbyCustomers.map(c => (
                <button key={c.id} className={`nearby-chip${custId === c.id ? ' nearby-chip-active' : ''}`}
                  onClick={() => setCustId(c.id)}>
                  {c.name}
                  <span className="nearby-dist">{c.dist < 1000 ? `${Math.round(c.dist)}m` : `${(c.dist / 1000).toFixed(1)}km`}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <Field label="Customer" req>
          <Sel value={custId} onChange={e => setCustId(e.target.value)}>
            <option value="">Select customer…</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Sel>
        </Field>
        <Field label="Vehicle Number" req>
          {vehicles.length > 0
            ? <Sel value={vehicle} onChange={e => setVehicle(e.target.value)}>
                <option value="">Select vehicle…</option>
                {vehicles.map(v => <option key={v.id} value={v.number}>{v.number}{v.description ? ` — ${v.description}` : ''}</option>)}
              </Sel>
            : <Inp value={vehicle} onChange={e => setVehicle(e.target.value.toUpperCase())} placeholder="No vehicles registered yet — type manually" />
          }
        </Field>
        <div className="two-col">
          <Field label="Full cylinders to DELIVER" req>
            <Inp type="number" min="0" value={deliverQty} onChange={e => setDeliverQty(e.target.value)} placeholder="e.g. 3" />
          </Field>
          <Field label="Empty cylinders to COLLECT">
            <Inp type="number" min="0" value={collectQty} onChange={e => setCollectQty(e.target.value)} placeholder="e.g. 2 (or 0)" />
          </Field>
        </div>
        <Field label="Notes (optional)">
          <Inp value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any extra info…" />
        </Field>
        <Btn disabled={!custId || !vehicle || !deliverQty || parseInt(deliverQty) < 1}
          onClick={() => { setStep(2); setDelivered([]); setCollected([]); setErr(''); }} full>
          Continue →
        </Btn>
      </div>
    </div>
  );

  const dQty = parseInt(deliverQty) || 0;
  const cQty = parseInt(collectQty) || 0;
  const cust = customers.find(c => c.id === custId);
  const allDone = delivered.length === dQty && (cQty === 0 || collected.length === cQty);

  if (scanning) return (
    <div className="camera-overlay">
      <div className="camera-hd">
        <span>{scanning === 'delivered' ? '↑ Scanning deliveries' : '↓ Scanning collections'} — {scanning === 'delivered' ? delivered.length : collected.length}/{scanning === 'delivered' ? dQty : cQty}</span>
        <button className="camera-close" onClick={() => setScanning(null)}><Svg d={IC.x} size={20} /> Done</button>
      </div>
      <video ref={videoRef} autoPlay playsInline className="camera-video" />
      <div className="camera-guide"><div className="camera-frame" /></div>
      {err && <div className="camera-err">{err}</div>}
      <div className="camera-scanned">
        {(scanning === 'delivered' ? delivered : collected).map(qr => {
          const info = cylInfo(qr);
          return <div key={qr} className="camera-tag">✓ {fmtQR(qr)} · {info?.gasType} · {String(info?.size||'').replace('m³','')}m³</div>;
        })}
        {(scanning === 'delivered' ? delivered.length < dQty : collected.length < cQty) && <div className="camera-waiting">Point camera at QR code…</div>}
      </div>
    </div>
  );

  const ScanSection = ({ title, color, codes, manualVal, setManual, onAdd, onRemove, qty, hint, scanLabel }) => (
    <div className="scan-section" style={{ borderLeftColor: color }}>
      <div className="scan-sec-hd">
        <span className="scan-sec-title" style={{ color }}>{title}</span>
        <span className="scan-progress">{codes.length} / {qty}</span>
      </div>
      <div className="prog-bar"><div className="prog-fill" style={{ width: `${qty > 0 ? (codes.length / qty) * 100 : 100}%`, background: color }} /></div>
      <p className="scan-hint">{hint}</p>
      <div className="scan-input-row">
        <Inp placeholder="Type QR code and press Enter…" value={manualVal} autoFocus
          onChange={e => { setManual(e.target.value); setErr(''); }}
          onKeyDown={e => e.key === 'Enter' && onAdd(manualVal)} />
        <Btn sm onClick={() => onAdd(manualVal)}>Add</Btn>
        <button className="cam-btn" onClick={() => { setErr(''); setScanning(scanLabel); }} title="Scan with camera">
          <Svg d={IC.camera} size={18} />
        </button>
      </div>
      <div className="scan-codes">
        {Array.from({ length: qty }).map((_, i) => {
          const qr = codes[i];
          const info = qr ? cylInfo(qr) : null;
          return (
            <div key={i} className={`scan-row ${qr ? 'scan-row-filled' : 'scan-row-empty'}`}>
              <span className="scan-row-num">{i + 1}</span>
              {/* CHANGE 1: show CCPL-XXXXX format */}
              <span className="scan-row-code">{qr ? `${fmtQR(qr)}  ·  ${info?.gasType || '?'}  ·  ${String(info?.size||'?').replace('m³','')}m³` : 'Pending…'}</span>
              {qr && <button className="scan-row-rm" onClick={() => onRemove(qr)}><Svg d={IC.x} size={13} /></button>}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div>
      <BackBtn onClick={() => setStep(1)} />
      <div className="pg-hd">
        <div><h1>Scan Cylinders</h1><p className="pg-sub">Customer: <strong>{cust?.name}</strong> · Vehicle: <strong>{vehicle}</strong></p></div>
      </div>
      {err && <div className="inline-err">{err}</div>}
      <ScanSection title="↑ Delivering (Full Cylinders Out)" color="#2563eb"
        codes={delivered} manualVal={manualD} setManual={setManualD}
        onAdd={c => addCode(c, delivered, setDelivered, dQty, 'delivered')}
        onRemove={c => setDelivered(p => p.filter(x => x !== c))} qty={dQty}
        hint="Type QR code and press Enter, or tap the camera icon to scan."
        scanLabel="delivered" />
      {cQty > 0 && (
        <ScanSection title="↓ Collecting (Empty Cylinders Back)" color="#059669"
          codes={collected} manualVal={manualC} setManual={setManualC}
          onAdd={c => addCode(c, collected, setCollected, cQty, 'collected')}
          onRemove={c => setCollected(p => p.filter(x => x !== c))} qty={cQty}
          hint="Type QR code and press Enter, or tap the camera icon to scan."
          scanLabel="collected" />
      )}
      <Btn disabled={!allDone} onClick={save} full>
        {allDone ? 'Save Trip Record' : `Complete all scans first (${delivered.length}/${dQty} delivered${cQty > 0 ? `, ${collected.length}/${cQty} collected` : ''})`}
      </Btn>
    </div>
  );
}

// ── CHANGE 3: Trip done screen with Save Location button ──────────────────
function TripDoneScreen({ cust, deliverQty, collectQty, vehicle, onReset }) {
  const [locSaved, setLocSaved] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [hasLoc, setHasLoc] = useState(null); // null=checking, true=already has, false=no loc

  useEffect(() => {
    if (!cust) return;
    getDoc(doc(db, 'customers', cust.id)).then(snap => {
      const d = snap.data();
      setHasLoc(!!(d?.lat && d?.lng));
    });
  }, [cust]);

  const saveLocation = () => {
    if (!navigator.geolocation) return alert('GPS not available on this device');
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(async pos => {
      await updateDoc(doc(db, 'customers', cust.id), {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });
      setLocLoading(false);
      setLocSaved(true);
    }, () => {
      setLocLoading(false);
      alert('Could not get GPS location. Please try again.');
    });
  };

  return (
    <div className="done-wrap">
      <div className="done-icon"><Svg d={IC.check} size={28} /></div>
      <h2>Trip Recorded!</h2>
      <p>Delivered <strong>{deliverQty}</strong> cylinder{deliverQty > 1 ? 's' : ''} to <strong>{cust?.name}</strong></p>
      {parseInt(collectQty) > 0 && <p>Collected <strong>{collectQty}</strong> empty cylinder{collectQty > 1 ? 's' : ''}</p>}
      {vehicle && <p>Vehicle: <strong>{vehicle}</strong></p>}

      {/* Save location button — only show if customer has no location saved yet */}
      {cust && hasLoc === false && !locSaved && (
        <button className="save-loc-btn" onClick={saveLocation} disabled={locLoading}>
          <Svg d={IC.pin} size={15} />
          {locLoading ? 'Getting location…' : `Save location for ${cust.name}`}
        </button>
      )}
      {locSaved && (
        <div className="loc-saved-msg"><Svg d={IC.check} size={14} /> Location saved for {cust?.name}</div>
      )}

      <Btn onClick={onReset}>Record Another Trip</Btn>
    </div>
  );
}

function MyTrips({ profile, settings }) {
  const [trips, setTrips] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cylinders, setCylinders] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editDelivered, setEditDelivered] = useState([]);
  const [editCollected, setEditCollected] = useState([]);
  const [editNotes, setEditNotes] = useState('');
  const [editVehicle, setEditVehicle] = useState('');
  const [manualD, setManualD] = useState('');
  const [manualC, setManualC] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const [ts, cs, cyls, vs] = await Promise.all([
      getDocs(collection(db, 'trips')),
      getDocs(collection(db, 'customers')),
      getDocs(collection(db, 'cylinders')),
      getDocs(collection(db, 'vehicles')),
    ]);
    const allTrips = ts.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(t => t.driverId === profile.uid)
      .sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt));
    setTrips(allTrips);
    setCustomers(cs.docs.map(d => ({ id: d.id, ...d.data() })));
    setCylinders(cyls.docs.map(d => ({ id: d.id, ...d.data() })));
    setVehicles(vs.docs.map(d => ({ id: d.id, ...d.data() })).filter(v => v.active !== false));
    setLoading(false);
  }, [profile.uid]);

  useEffect(() => { load(); }, [load]);

  const canEdit = (trip) => {
    const created = toDate(trip.createdAt);
    if (!created) return false;
    const hoursAgo = (Date.now() - created.getTime()) / 3600000;
    return hoursAgo <= (settings.driverEditHours || 24);
  };

  const openEdit = (trip) => {
    setEditing(trip);
    setEditDelivered([...(trip.delivered || [])]);
    setEditCollected([...(trip.collected || [])]);
    setEditNotes(trip.notes || '');
    setEditVehicle(trip.vehicle || '');
    setErr('');
  };

  const cylInfo = qr => cylinders.find(c => c.qrCode === qr);

  const addEditCode = (code, list, setList, label) => {
    const c = code.trim(); if (!c) return;
    if (list.includes(c)) { setErr(`QR ${c} already added`); return; }
    if (!cylinders.find(x => x.qrCode === c)) { setErr(`QR ${c} not found in system`); return; }
    setList(p => [...p, c]);
    if (label === 'delivered') setManualD(''); else setManualC('');
    setErr('');
  };

  const saveEdit = async () => {
    if (!editDelivered.length) { setErr('Must have at least 1 delivered cylinder'); return; }
    const gasTypes = {};
    [...editDelivered, ...editCollected].forEach(qr => { const c = cylInfo(qr); if (c) gasTypes[qr] = c.gasType; });
    await updateDoc(doc(db, 'trips', editing.id), {
      delivered: editDelivered,
      collected: editCollected,
      gasTypes,
      deliverQty: editDelivered.length,
      collectQty: editCollected.length,
      notes: editNotes,
      vehicle: editVehicle,
      _editedAt: new Date().toISOString(),
    });
    setEditing(null); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    load();
  };

  if (editing) {
    const cust = customers.find(c => c.id === editing.customerId);
    return (
      <div>
        <BackBtn onClick={() => setEditing(null)} />
        <div className="pg-hd"><h1>Edit Trip</h1><p className="pg-sub">{cust?.name} · {fmtDT(editing.createdAt)}</p></div>
        {err && <div className="inline-err">{err}</div>}
        <div className="card">
          <div className="two-col">
            <Field label="Vehicle Number">
              {vehicles.length > 0
                ? <Sel value={editVehicle} onChange={e => setEditVehicle(e.target.value)}>
                    <option value="">Select vehicle…</option>
                    {vehicles.map(v => <option key={v.id} value={v.number}>{v.number}{v.description ? ` — ${v.description}` : ''}</option>)}
                  </Sel>
                : <Inp value={editVehicle} onChange={e => setEditVehicle(e.target.value.toUpperCase())} />
              }
            </Field>
            <Field label="Notes"><Inp value={editNotes} onChange={e => setEditNotes(e.target.value)} /></Field>
          </div>
        </div>
        <div className="scan-section" style={{ borderLeftColor: '#2563eb' }}>
          <div className="scan-sec-hd">
            <span className="scan-sec-title" style={{ color: '#2563eb' }}>↑ Delivered Cylinders</span>
            <span className="scan-progress">{editDelivered.length}</span>
          </div>
          <div className="scan-input-row">
            <Inp placeholder="Add QR code…" value={manualD} onChange={e => { setManualD(e.target.value); setErr(''); }}
              onKeyDown={e => e.key === 'Enter' && addEditCode(manualD, editDelivered, setEditDelivered, 'delivered')} />
            <Btn sm onClick={() => addEditCode(manualD, editDelivered, setEditDelivered, 'delivered')}>Add</Btn>
          </div>
          <div className="scan-codes">
            {editDelivered.map(qr => {
              const info = cylInfo(qr);
              return (
                <div key={qr} className="scan-row scan-row-filled">
                  <span className="scan-row-code">{fmtQR(qr)} · {info?.gasType || '?'} · {String(info?.size||'?').replace('m³','')}m³</span>
                  <button className="scan-row-rm" onClick={() => setEditDelivered(p => p.filter(x => x !== qr))}><Svg d={IC.x} size={13} /></button>
                </div>
              );
            })}
          </div>
        </div>
        <div className="scan-section" style={{ borderLeftColor: '#059669' }}>
          <div className="scan-sec-hd">
            <span className="scan-sec-title" style={{ color: '#059669' }}>↓ Collected Cylinders</span>
            <span className="scan-progress">{editCollected.length}</span>
          </div>
          <div className="scan-input-row">
            <Inp placeholder="Add QR code…" value={manualC} onChange={e => { setManualC(e.target.value); setErr(''); }}
              onKeyDown={e => e.key === 'Enter' && addEditCode(manualC, editCollected, setEditCollected, 'collected')} />
            <Btn sm onClick={() => addEditCode(manualC, editCollected, setEditCollected, 'collected')}>Add</Btn>
          </div>
          <div className="scan-codes">
            {editCollected.map(qr => {
              const info = cylInfo(qr);
              return (
                <div key={qr} className="scan-row scan-row-filled" style={{ borderColor: '#86efac', background: '#f0fdf4' }}>
                  <span className="scan-row-code">{fmtQR(qr)} · {info?.gasType || '?'} · {String(info?.size||'?').replace('m³','')}m³</span>
                  <button className="scan-row-rm" onClick={() => setEditCollected(p => p.filter(x => x !== qr))}><Svg d={IC.x} size={13} /></button>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Btn onClick={saveEdit} full>Save Changes</Btn>
          <Btn variant="ghost" onClick={() => setEditing(null)} full>Cancel</Btn>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="pg-hd"><h1>My Trips</h1><p className="pg-sub">Your recent trip records · Editable within {settings.driverEditHours || 24} hours</p></div>
      {saved && <div className="success-bar"><Svg d={IC.check} size={15} /> Trip updated successfully.</div>}
      {loading ? <div className="pg-load">Loading…</div> : (
        <Tbl cols={['Date', 'Customer', 'Delivered', 'Collected', 'Vehicle', '']}
          rows={trips.map(t => [
            fmtDT(t.createdAt),
            t.customerName,
            // CHANGE 1: show CCPL format in My Trips
            (t.delivered || []).map(fmtQR).join(', ') || '—',
            (t.collected || []).map(fmtQR).join(', ') || '—',
            t.vehicle || '—',
            canEdit(t)
              ? <Btn sm onClick={() => openEdit(t)}><Svg d={IC.edit} size={13} /> Edit</Btn>
              : <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Locked</span>
          ])}
          empty="No trips recorded yet."
        />
      )}
    </div>
  );
}

// ── CHANGE 3: Customers with delete location (Admin/SA) ───────────────────
function Customers({ isSA }) {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ name: '', contact: '', address: '', gst: '' });
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState(null);
  const [delLoc, setDelLoc] = useState(null);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    const s = await getDocs(collection(db, 'customers'));
    setList(s.docs.map(d => ({ id: d.id, ...d.data() })));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm({ name: '', contact: '', address: '', gst: '' }); setEditing(null); setOpen(true); };
  const openEdit = c => { setForm({ name: c.name, contact: c.contact || '', address: c.address || '', gst: c.gst || '' }); setEditing(c); setOpen(true); };

  const save = async () => {
    if (!form.name.trim()) return alert('Name required');
    if (!editing && list.find(c => c.name.toLowerCase() === form.name.toLowerCase())) return alert('Customer already exists');
    if (editing) await updateDoc(doc(db, 'customers', editing.id), form);
    else await addDoc(collection(db, 'customers'), { ...form, createdAt: serverTimestamp() });
    setOpen(false); load();
  };

  const confirmDel = async () => {
    const tSnap = await getDocs(collection(db, 'trips'));
    const held = {};
    tSnap.docs.map(d => d.data()).sort((a, b) => toDate(a.createdAt) - toDate(b.createdAt)).forEach(t => {
      if (t.customerId === del.id) {
        (t.delivered || []).forEach(qr => held[qr] = true);
        (t.collected || []).forEach(qr => delete held[qr]);
      }
    });
    if (Object.keys(held).length) { alert(`Cannot delete: ${del.name} has ${Object.keys(held).length} cylinder(s) out.`); setDel(null); return; }
    await deleteDoc(doc(db, 'customers', del.id)); setDel(null); load();
  };

  const confirmDelLoc = async () => {
    await updateDoc(doc(db, 'customers', delLoc.id), { lat: null, lng: null });
    setDelLoc(null); load();
  };

  const importCSV = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = async ev => {
      const lines = ev.target.result.split('\n').filter(l => l.trim()).slice(1);
      let added = 0;
      for (const line of lines) {
        const [name, contact, address, gst] = line.split(',').map(x => x.trim().replace(/"/g, ''));
        if (!name || list.find(c => c.name.toLowerCase() === name.toLowerCase())) continue;
        await addDoc(collection(db, 'customers'), { name, contact: contact || '', address: address || '', gst: gst || 'N/A', createdAt: serverTimestamp() });
        added++;
      }
      alert(`Imported ${added} customers`); load();
    };
    r.readAsText(f);
  };

  const dlTemplate = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['Customer Name,Contact,Address,GST Number\nExample Company,9876543210,123 Main Street,29ABCDE1234F1Z5'], { type: 'text/csv' }));
    a.download = 'customer_template.csv'; a.click();
  };

  const filtered = list.filter(c => c.name?.toLowerCase().includes(q.toLowerCase()) || (c.gst || '').toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <div className="pg-hd">
        <div><h1>Customers</h1><p className="pg-sub">{list.length} total</p></div>
        <div className="pg-actions">
          <Btn variant="ghost" sm onClick={dlTemplate}><Svg d={IC.dl} size={14} /> Template</Btn>
          <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}><Svg d={IC.dl} size={14} /> Import CSV<input type="file" accept=".csv" hidden onChange={importCSV} /></label>
          <Btn sm onClick={openAdd}><Svg d={IC.plus} size={14} /> Add Customer</Btn>
        </div>
      </div>
      <SearchBar placeholder="Search by name or GST…" value={q} onChange={setQ} />
      <Tbl cols={['Name', 'Contact', 'Address', 'GST', 'Location', '']}
        rows={filtered.map(c => [
          c.name,
          c.contact || '—',
          c.address || '—',
          c.gst || 'N/A',
          // Show GPS status + delete button for admin/SA
          c.lat && c.lng
            ? <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Tag color="green">📍 Saved</Tag>
                <button className="icon-btn icon-del" title="Delete location" onClick={() => setDelLoc(c)}><Svg d={IC.trash} size={13} /></button>
              </div>
            : <Tag color="amber">No location</Tag>,
          <div className="row-acts">
            <button className="icon-btn" onClick={() => openEdit(c)}><Svg d={IC.edit} size={14} /></button>
            <button className="icon-btn icon-del" onClick={() => setDel(c)}><Svg d={IC.trash} size={14} /></button>
          </div>
        ])} />
      <Modal open={open} title={editing ? 'Edit Customer' : 'Add Customer'} onClose={() => setOpen(false)}>
        <div className="modal-body">
          <Field label="Customer Name" req><Inp value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Company or person name" /></Field>
          <Field label="Contact"><Inp value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} placeholder="Phone number" /></Field>
          <Field label="Address"><Inp value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Address" /></Field>
          <Field label="GST Number"><Inp value={form.gst} onChange={e => setForm({ ...form, gst: e.target.value })} placeholder="GST or N/A" /></Field>
        </div>
        <div className="modal-ft"><Btn onClick={save}>Save</Btn><Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn></div>
      </Modal>
      <Modal open={!!del} title="Delete Customer" onClose={() => setDel(null)}>
        <div className="modal-body"><p>Delete <strong>{del?.name}</strong>? This cannot be undone.</p></div>
        <div className="modal-ft"><Btn danger onClick={confirmDel}>Delete</Btn><Btn variant="ghost" onClick={() => setDel(null)}>Cancel</Btn></div>
      </Modal>
      <Modal open={!!delLoc} title="Delete Location" onClose={() => setDelLoc(null)}>
        <div className="modal-body"><p>Remove saved GPS location for <strong>{delLoc?.name}</strong>? The driver will be prompted to save it again on next visit.</p></div>
        <div className="modal-ft"><Btn danger onClick={confirmDelLoc}>Delete Location</Btn><Btn variant="ghost" onClick={() => setDelLoc(null)}>Cancel</Btn></div>
      </Modal>
    </div>
  );
}

function CustAnalytics({ settings }) {
  const [customers, setCustomers] = useState([]);
  const [trips, setTrips] = useState([]);
  const [nameQ, setNameQ] = useState('');
  const [gstQ, setGstQ] = useState('');
  const [sortK, setSortK] = useState('totalOut');
  const [sortD, setSortD] = useState('desc');
  const [sel, setSel] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [cs, ts] = await Promise.all([getDocs(collection(db, 'customers')), getDocs(collection(db, 'trips'))]);
      setCustomers(cs.docs.map(d => ({ id: d.id, ...d.data() })));
      setTrips(ts.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    })();
  }, []);

  const calcStats = cid => {
    const cTrips = trips.filter(t => t.customerId === cid).sort((a, b) => toDate(a.createdAt) - toDate(b.createdAt));
    const held = {}, tatList = [], tripLog = {};
    cTrips.forEach(t => {
      (t.delivered || []).forEach(qr => { held[qr] = { since: t.createdAt, gas: t.gasTypes?.[qr] }; tripLog[qr] = t.createdAt; });
      (t.collected || []).forEach(qr => {
        if (tripLog[qr]) tatList.push(Math.floor((toDate(t.createdAt) - toDate(tripLog[qr])) / 86400000));
        delete held[qr]; delete tripLog[qr];
      });
    });
    const co2 = Object.values(held).filter(x => x.gas === 'CO2').length;
    const o2 = Object.values(held).filter(x => x.gas === 'O2').length;
    const avgTAT = tatList.length ? Math.round(tatList.reduce((a, b) => a + b, 0) / tatList.length) : null;
    const maxDays = Object.values(held).reduce((mx, c) => Math.max(mx, daysSince(c.since)), 0);
    const overdue = maxDays >= settings.overdueCriticalDays ? 'critical' : maxDays >= settings.overdueWarningDays ? 'warning' : 'ok';
    const tatGrp = avgTAT == null ? null : avgTAT < settings.tatFastDays ? 'fast' : avgTAT <= settings.tatMediumDays ? 'medium' : 'slow';
    return { co2, o2, totalOut: co2 + o2, avgTAT, overdue, tatGrp, held, trips: cTrips.reverse() };
  };

  const sort = k => { if (sortK === k) setSortD(d => d === 'asc' ? 'desc' : 'asc'); else { setSortK(k); setSortD('desc'); } };

  const enriched = customers
    .map(c => ({ ...c, _s: calcStats(c.id) }))
    .filter(c => c.name?.toLowerCase().includes(nameQ.toLowerCase()) && (c.gst || '').toLowerCase().includes(gstQ.toLowerCase()))
    .sort((a, b) => {
      const av = sortK === 'name' ? a.name : sortK === 'co2' ? a._s.co2 : sortK === 'o2' ? a._s.o2 : sortK === 'totalOut' ? a._s.totalOut : a._s.avgTAT ?? -1;
      const bv = sortK === 'name' ? b.name : sortK === 'co2' ? b._s.co2 : sortK === 'o2' ? b._s.o2 : sortK === 'totalOut' ? b._s.totalOut : b._s.avgTAT ?? -1;
      if (typeof av === 'string') return sortD === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortD === 'asc' ? av - bv : bv - av;
    });

  const OI = { ok: '🟢', warning: '🟡', critical: '🔴' };
  const TG = { fast: <Tag color="green">Fast</Tag>, medium: <Tag color="amber">Medium</Tag>, slow: <Tag color="red">Slow</Tag> };

  if (sel) {
    const s = sel._s;
    const cylRows = Object.entries(s.held).map(([qr, info]) => {
      const d = daysSince(info.since);
      const st = d >= settings.overdueCriticalDays ? 'critical' : d >= settings.overdueWarningDays ? 'warning' : 'ok';
      // CHANGE 1: show CCPL format in customer analytics
      return [fmtQR(qr), info.gas, fmtDate(info.since), `${d} days`,
        st === 'critical' ? <Tag color="red">Critical</Tag> : st === 'warning' ? <Tag color="amber">Warning</Tag> : <Tag color="green">OK</Tag>];
    });
    return (
      <div>
        <BackBtn onClick={() => setSel(null)} />
        <div className="pg-hd"><h1>{sel.name}</h1><p className="pg-sub">{sel.contact} · GST: {sel.gst || 'N/A'}</p></div>
        <div className="kpi-grid">
          <KPI label="CO₂ Currently Out" value={s.co2} color="#0891b2" />
          <KPI label="O₂ Currently Out" value={s.o2} color="#7c3aed" />
          <KPI label="Total Out" value={s.totalOut} color="#2563eb" />
          <KPI label="Avg Return Time" value={s.avgTAT != null ? `${s.avgTAT}d` : '—'} color="#d97706" />
        </div>
        {cylRows.length > 0 && (<><h3 className="sec-ttl">Cylinders Currently Out</h3><Tbl cols={['QR Code', 'Gas', 'Delivered On', 'Days Out', 'Status']} rows={cylRows} /></>)}
        <h3 className="sec-ttl">Trip History</h3>
        <Tbl cols={['Date', 'Delivered QRs', 'Collected QRs', 'Driver']}
          rows={s.trips.map(t => [fmtDate(t.createdAt), (t.delivered || []).map(fmtQR).join(', ') || '—', (t.collected || []).map(fmtQR).join(', ') || '—', t.driverName])} />
      </div>
    );
  }

  return (
    <div>
      <div className="pg-hd"><h1>Customer Analytics</h1><p className="pg-sub">Click any row to drill down into detail</p></div>
      <div className="filter-row">
        <SearchBar placeholder="Search by name…" value={nameQ} onChange={setNameQ} />
        <SearchBar placeholder="Search by GST…" value={gstQ} onChange={setGstQ} />
        <Btn variant="ghost" sm onClick={() => { setNameQ(''); setGstQ(''); }}>Clear</Btn>
      </div>
      {loading ? <div className="pg-load">Loading…</div> : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr>
              <SortTh label="Customer" k="name" sortK={sortK} sortD={sortD} onSort={sort} />
              <SortTh label="CO₂ Out" k="co2" sortK={sortK} sortD={sortD} onSort={sort} />
              <SortTh label="O₂ Out" k="o2" sortK={sortK} sortD={sortD} onSort={sort} />
              <SortTh label="Total Out" k="totalOut" sortK={sortK} sortD={sortD} onSort={sort} />
              <SortTh label="Avg TAT" k="avgTAT" sortK={sortK} sortD={sortD} onSort={sort} />
              <th>TAT Group</th><th>Status</th>
            </tr></thead>
            <tbody>
              {enriched.map(c => (
                <tr key={c.id} className="tbl-link" onClick={() => setSel(c)}>
                  <td>{OI[c._s.overdue]} <strong>{c.name}</strong></td>
                  <td>{c._s.co2}</td><td>{c._s.o2}</td><td>{c._s.totalOut}</td>
                  <td>{c._s.avgTAT != null ? `${c._s.avgTAT}d` : '—'}</td>
                  <td>{TG[c._s.tatGrp] || '—'}</td>
                  <td>{c._s.overdue === 'critical' ? <Tag color="red">Critical</Tag> : c._s.overdue === 'warning' ? <Tag color="amber">Warning</Tag> : <Tag color="green">OK</Tag>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Cylinders() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ physicalId: '', size: '5', gasType: 'CO2' });
  const [autoQR, setAutoQR] = useState(true);
  const [manualQR, setManualQR] = useState('');
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState([]);
  const [rf, setRf] = useState('');
  const [rt, setRt] = useState('');
  const [bulkN, setBulkN] = useState(10);
  const [del, setDel] = useState(null);

  const load = useCallback(async () => {
    const s = await getDocs(collection(db, 'cylinders'));
    setList(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => parseInt(a.qrCode) - parseInt(b.qrCode)));
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const qr = editing ? editing.qrCode : autoQR ? nextQR(list) : manualQR.trim();
    if (!qr) return alert('QR code required');
    if (!form.physicalId.trim()) return alert('Physical ID required');
    if (!editing && list.find(c => c.qrCode === qr)) return alert(`QR ${qr} already exists`);
    if (editing) await updateDoc(doc(db, 'cylinders', editing.id), { physicalId: form.physicalId, size: form.size, gasType: form.gasType });
    else await addDoc(collection(db, 'cylinders'), { qrCode: qr, ...form, createdAt: serverTimestamp() });
    setOpen(false); setEditing(null); load();
  };

  // ── CHANGE 1 + 2: PDF with CCPL format ───────────────────────────────────
  const genPDF = async items => {
    if (!items.length) { alert('Nothing selected'); return; }
    try {
      const QRC = (await import('qrcode')).default;
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
      const sz = 55, mg = 15, gap = 8, cols = 3;
      let x = mg, y = mg, n = 0;
      for (const c of items) {
        const img = await QRC.toDataURL(c.qrCode, { width: 300, margin: 1 });
        pdf.addImage(img, 'PNG', x, y, sz, sz);
        pdf.setFontSize(11); pdf.setFont('helvetica', 'bold');
        // CHANGE 1: show CCPL-XXXXX in PDF
        pdf.text(fmtQR(c.qrCode), x + sz / 2, y + sz + 5, { align: 'center' });
        pdf.setFontSize(8); pdf.setFont('helvetica', 'normal');
        if (c.gasType && c.gasType !== '---') pdf.text(`${c.gasType} · ${String(c.size||'').replace('m³','')}m³`, x + sz / 2, y + sz + 10, { align: 'center' });
        n++; x += sz + gap;
        if (n % cols === 0) { x = mg; y += sz + gap + 14; }
        if (n % (cols * 4) === 0 && n < items.length) { pdf.addPage(); x = mg; y = mg; }
      }
      pdf.save('qr_codes.pdf');
    } catch (e) { alert('PDF error: ' + e.message); }
  };

  // ── CHANGE 2: DXF Export ──────────────────────────────────────────────────
  const genDXF = async items => {
    if (!items.length) { alert('Nothing selected'); return; }
    try {
      const QRC = (await import('qrcode')).default;

      // DXF units = mm. Each tile: 150x150mm square
      const TILE = 150;
      const MARGIN = 20;
      const GAP = 15;
      const COLS = 4;
      const QR_SIZE = 110; // QR square inside the tile
      const QR_OFFSET_X = (TILE - QR_SIZE) / 2;
      const QR_OFFSET_Y = 10;
      const TEXT_Y_OFFSET = QR_OFFSET_Y + QR_SIZE + 10;

      let dxfEntities = '';

      const addLine = (x1, y1, x2, y2, layer = '0') => {
        dxfEntities += `0\nLINE\n8\n${layer}\n10\n${x1.toFixed(4)}\n20\n${y1.toFixed(4)}\n30\n0.0\n11\n${x2.toFixed(4)}\n21\n${y2.toFixed(4)}\n31\n0.0\n`;
      };

      const addText = (x, y, text, height = 5, layer = 'TEXT') => {
        dxfEntities += `0\nTEXT\n8\n${layer}\n10\n${x.toFixed(4)}\n20\n${y.toFixed(4)}\n30\n0.0\n40\n${height}\n1\n${text}\n72\n1\n11\n${x.toFixed(4)}\n21\n${y.toFixed(4)}\n`;
      };

      for (let idx = 0; idx < items.length; idx++) {
        const c = items[idx];
        const col = idx % COLS;
        const row = Math.floor(idx / COLS);
        const baseX = MARGIN + col * (TILE + GAP);
        const baseY = MARGIN + row * (TILE + GAP);

        // Outer border (150x150)
        addLine(baseX, baseY, baseX + TILE, baseY, 'BORDER');
        addLine(baseX + TILE, baseY, baseX + TILE, baseY + TILE, 'BORDER');
        addLine(baseX + TILE, baseY + TILE, baseX, baseY + TILE, 'BORDER');
        addLine(baseX, baseY + TILE, baseX, baseY, 'BORDER');

        // QR code as vector dots
        const matrix = await QRC.create(c.qrCode, { errorCorrectionLevel: 'M' });
        const modules = matrix.modules;
        const size = modules.size;
        const cellSize = QR_SIZE / size;

        for (let r = 0; r < size; r++) {
          for (let col2 = 0; col2 < size; col2++) {
            if (modules.get(r, col2)) {
              const px = baseX + QR_OFFSET_X + col2 * cellSize;
              const py = baseY + QR_OFFSET_Y + r * cellSize;
              // Draw filled square as 4 lines (CNC etching reads as filled region)
              addLine(px, py, px + cellSize, py, 'QR');
              addLine(px + cellSize, py, px + cellSize, py + cellSize, 'QR');
              addLine(px + cellSize, py + cellSize, px, py + cellSize, 'QR');
              addLine(px, py + cellSize, px, py, 'QR');
            }
          }
        }

        // Label text: CCPL-XXXXX  ·  CO2  ·  10m³
        const label = `${fmtQR(c.qrCode)}${c.gasType && c.gasType !== '---' ? `  ${c.gasType}  ${String(c.size||'').replace('m3','').replace('m³','')}m3` : ''}`;
        addText(baseX + TILE / 2, baseY + TEXT_Y_OFFSET, label, 6, 'TEXT');
      }

      const dxf = `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n0\nENDSEC\n0\nSECTION\n2\nLAYER\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${dxfEntities}0\nENDSEC\n0\nEOF\n`;

      const blob = new Blob([dxf], { type: 'application/dxf' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'qr_codes.dxf';
      a.click();
    } catch (e) { alert('DXF error: ' + e.message); }
  };

  const genSel = () => genPDF(list.filter(c => sel.includes(c.id)));
  const genSelDXF = () => genDXF(list.filter(c => sel.includes(c.id)));
  const genRange = () => {
    const f = parseInt(rf), t = parseInt(rt);
    if (isNaN(f) || isNaN(t) || f > t) { alert('Invalid range'); return; }
    genPDF(list.filter(c => { const n = parseInt(c.qrCode); return n >= f && n <= t; }));
  };
  const genRangeDXF = () => {
    const f = parseInt(rf), t = parseInt(rt);
    if (isNaN(f) || isNaN(t) || f > t) { alert('Invalid range'); return; }
    genDXF(list.filter(c => { const n = parseInt(c.qrCode); return n >= f && n <= t; }));
  };
  const genBulk = () => {
    const start = list.length ? Math.max(...list.map(c => parseInt(c.qrCode) || 0)) + 1 : 1;
    genPDF(Array.from({ length: parseInt(bulkN) }, (_, i) => ({ qrCode: pad3(start + i), gasType: '---', size: '---' })));
  };
  const genBulkDXF = () => {
    const start = list.length ? Math.max(...list.map(c => parseInt(c.qrCode) || 0)) + 1 : 1;
    genDXF(Array.from({ length: parseInt(bulkN) }, (_, i) => ({ qrCode: pad3(start + i), gasType: '---', size: '---' })));
  };

  const toggleSel = id => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const toggleAll = () => setSel(sel.length === list.length ? [] : list.map(c => c.id));

  return (
    <div>
      <div className="pg-hd">
        <div><h1>Cylinders</h1><p className="pg-sub">{list.length} total</p></div>
        <Btn sm onClick={() => { setEditing(null); setForm({ physicalId: '', size: '5', gasType: 'CO2' }); setAutoQR(true); setManualQR(''); setOpen(true); }}>
          <Svg d={IC.plus} size={14} /> Add Cylinder
        </Btn>
      </div>

      {/* CHANGE 2: QR panel with both PDF and DXF buttons */}
      <div className="qr-panel">
        <div className="qr-panel-title">Generate QR Codes</div>
        <div className="qr-panel-row">
          <div className="qr-block">
            <div className="qr-block-lbl">From selection ({sel.length})</div>
            <div className="qr-inline">
              <Btn variant="ghost" sm disabled={!sel.length} onClick={genSel}><Svg d={IC.dl} size={13} /> PDF</Btn>
              <Btn variant="ghost" sm disabled={!sel.length} onClick={genSelDXF}><Svg d={IC.dl} size={13} /> DXF</Btn>
            </div>
          </div>
          <div className="qr-divider" />
          <div className="qr-block">
            <div className="qr-block-lbl">By QR range</div>
            <div className="qr-inline">
              <Inp placeholder="From" value={rf} onChange={e => setRf(e.target.value)} style={{ width: 64 }} />
              <span>—</span>
              <Inp placeholder="To" value={rt} onChange={e => setRt(e.target.value)} style={{ width: 64 }} />
              <Btn variant="ghost" sm onClick={genRange}><Svg d={IC.dl} size={13} /> PDF</Btn>
              <Btn variant="ghost" sm onClick={genRangeDXF}><Svg d={IC.dl} size={13} /> DXF</Btn>
            </div>
          </div>
          <div className="qr-divider" />
          <div className="qr-block">
            <div className="qr-block-lbl">Bulk new (next: <strong>{fmtQR(nextQR(list))}</strong>)</div>
            <div className="qr-inline">
              <Inp type="number" value={bulkN} onChange={e => setBulkN(e.target.value)} style={{ width: 64 }} />
              <span>codes</span>
              <Btn variant="ghost" sm onClick={genBulk}><Svg d={IC.dl} size={13} /> PDF</Btn>
              <Btn variant="ghost" sm onClick={genBulkDXF}><Svg d={IC.dl} size={13} /> DXF</Btn>
            </div>
          </div>
        </div>
      </div>

      <div className="tbl-ctrl">
        <label className="chk-lbl"><input type="checkbox" checked={sel.length === list.length && list.length > 0} onChange={toggleAll} /> Select all</label>
        {sel.length > 0 && <span className="sel-count">{sel.length} selected</span>}
      </div>
      <Tbl cols={['', 'QR Code', 'Physical ID', 'Gas Type', 'Size', '']}
        rows={list.map(c => [
          <input type="checkbox" checked={sel.includes(c.id)} onChange={() => toggleSel(c.id)} onClick={e => e.stopPropagation()} />,
          // CHANGE 1: show CCPL format in table
          <strong>{fmtQR(c.qrCode)}</strong>, c.physicalId, c.gasType, `${c.size?.replace('m³','').trim()} m³`,
          <div className="row-acts">
            <button className="icon-btn" onClick={() => { setEditing(c); setForm({ physicalId: c.physicalId, size: c.size, gasType: c.gasType }); setOpen(true); }}><Svg d={IC.edit} size={14} /></button>
            <button className="icon-btn icon-del" onClick={() => setDel(c)}><Svg d={IC.trash} size={14} /></button>
          </div>
        ])} />
      <Modal open={open} title={editing ? 'Edit Cylinder' : 'Add Cylinder'} onClose={() => setOpen(false)}>
        <div className="modal-body">
          {!editing && (<label className="chk-lbl" style={{ marginBottom: '1rem' }}><input type="checkbox" checked={autoQR} onChange={e => setAutoQR(e.target.checked)} /> Auto-assign next QR: <strong>{fmtQR(nextQR(list))}</strong></label>)}
          {(!autoQR && !editing) && <Field label="QR Code"><Inp value={manualQR} onChange={e => setManualQR(e.target.value)} placeholder="e.g. 042" /></Field>}
          {editing && <Field label="QR Code"><Inp value={fmtQR(editing.qrCode)} disabled /></Field>}
          <Field label="Physical ID" req><Inp value={form.physicalId} onChange={e => setForm({ ...form, physicalId: e.target.value })} placeholder="e.g. CYL-553" /></Field>
          <Field label="Gas Type"><Sel value={form.gasType} onChange={e => setForm({ ...form, gasType: e.target.value })}><option value="CO2">CO₂</option><option value="O2">O₂</option></Sel></Field>
          <Field label="Size (m³)"><Sel value={form.size} onChange={e => setForm({ ...form, size: e.target.value })}>{['2', '5', '7', '10', '15', '20', '25', '30'].map(s => <option key={s}>{s}</option>)}</Sel></Field>
        </div>
        <div className="modal-ft"><Btn onClick={save}>Save</Btn><Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn></div>
      </Modal>
      <Modal open={!!del} title="Delete Cylinder" onClose={() => setDel(null)}>
        <div className="modal-body"><p>Delete cylinder <strong>{fmtQR(del?.qrCode)}</strong>? This cannot be undone.</p></div>
        <div className="modal-ft"><Btn danger onClick={async () => { await deleteDoc(doc(db, 'cylinders', del.id)); setDel(null); load(); }}>Delete</Btn><Btn variant="ghost" onClick={() => setDel(null)}>Cancel</Btn></div>
      </Modal>
    </div>
  );
}

function CylAnalytics({ settings }) {
  const [cyls, setCyls] = useState([]);
  const [trips, setTrips] = useState([]);
  const [qrQ, setQrQ] = useState('');
  const [physQ, setPhysQ] = useState('');
  const [statusF, setStatusF] = useState('All');
  const [overdueF, setOverdueF] = useState('All');
  const [sortK, setSortK] = useState('qrCode');
  const [sortD, setSortD] = useState('asc');
  const [sel, setSel] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [cs, ts] = await Promise.all([getDocs(collection(db, 'cylinders')), getDocs(collection(db, 'trips'))]);
      setCyls(cs.docs.map(d => ({ id: d.id, ...d.data() })));
      setTrips(ts.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    })();
  }, []);

  const calcStats = qr => {
    const sorted = [...trips].sort((a, b) => toDate(a.createdAt) - toDate(b.createdAt));
    let status = 'available', customer = null, deliveredAt = null, trips90 = 0, totalTrips = 0;
    const history = [];
    const cutoff = Date.now() - 90 * 86400000;
    sorted.forEach(t => {
      if ((t.delivered || []).includes(qr)) {
        status = 'out'; customer = t.customerName; deliveredAt = t.createdAt; totalTrips++;
        if (toDate(t.createdAt) > cutoff) trips90++;
        history.push({ date: t.createdAt, action: 'Delivered to', party: t.customerName, driver: t.driverName });
      }
      if ((t.collected || []).includes(qr)) {
        status = 'available'; customer = null; deliveredAt = null;
        history.push({ date: t.createdAt, action: 'Collected from', party: t.customerName, driver: t.driverName });
      }
    });
    const daysOut = status === 'out' ? daysSince(deliveredAt) : 0;
    const overdue = status === 'out' ? (daysOut >= settings.overdueCriticalDays ? 'critical' : daysOut >= settings.overdueWarningDays ? 'warning' : 'ok') : 'ok';
    const usageGrp = trips90 >= settings.usageHighTrips ? 'high' : trips90 >= settings.usageMediumTrips ? 'medium' : 'low';
    return { status, customer, daysOut, totalTrips, trips90, overdue, usageGrp, history: [...history].reverse() };
  };

  const sort = k => { if (sortK === k) setSortD(d => d === 'asc' ? 'desc' : 'asc'); else { setSortK(k); setSortD('asc'); } };

  const enriched = cyls.map(c => ({ ...c, _s: calcStats(c.qrCode) })).filter(c => {
    if (!c.qrCode.includes(qrQ)) return false;
    if (!c.physicalId?.includes(physQ)) return false;
    if (statusF === 'Out' && c._s.status !== 'out') return false;
    if (statusF === 'Available' && c._s.status !== 'available') return false;
    if (overdueF === 'Warning' && c._s.overdue !== 'warning') return false;
    if (overdueF === 'Critical' && c._s.overdue !== 'critical') return false;
    return true;
  }).sort((a, b) => {
    const av = sortK === 'qrCode' ? parseInt(a.qrCode) : sortK === 'daysOut' ? a._s.daysOut : sortK === 'trips90' ? a._s.trips90 : sortK === 'totalTrips' ? a._s.totalTrips : a[sortK] || '';
    const bv = sortK === 'qrCode' ? parseInt(b.qrCode) : sortK === 'daysOut' ? b._s.daysOut : sortK === 'trips90' ? b._s.trips90 : sortK === 'totalTrips' ? b._s.totalTrips : b[sortK] || '';
    return sortD === 'asc' ? av - bv : bv - av;
  });

  const co2 = enriched.filter(c => c.gasType === 'CO2');
  const o2 = enriched.filter(c => c.gasType === 'O2');
  const UG = { high: <Tag color="red">High Use</Tag>, medium: <Tag color="amber">Medium</Tag>, low: <Tag color="green">Low Use</Tag> };

  const CylTable = ({ rows, title }) => (
    <>
      <h3 className="sec-ttl">{title} <span className="sec-count">{rows.length}</span></h3>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr>
            <SortTh label="QR Code" k="qrCode" sortK={sortK} sortD={sortD} onSort={sort} />
            <th>Physical ID</th><th>Size</th>
            <SortTh label="Status" k="status" sortK={sortK} sortD={sortD} onSort={sort} />
            <th>With Customer</th>
            <SortTh label="Days Out" k="daysOut" sortK={sortK} sortD={sortD} onSort={sort} />
            <SortTh label="Trips (90d)" k="trips90" sortK={sortK} sortD={sortD} onSort={sort} />
            <SortTh label="Total Trips" k="totalTrips" sortK={sortK} sortD={sortD} onSort={sort} />
            <th>Usage</th>
          </tr></thead>
          <tbody>
            {rows.map(c => (
              <tr key={c.id} className="tbl-link" onClick={() => setSel(c)}>
                {/* CHANGE 1: CCPL format in cylinder analytics */}
                <td><strong>{fmtQR(c.qrCode)}</strong></td>
                <td>{c.physicalId}</td><td>{c.size?.replace('m³','').trim()} m³</td>
                <td>{c._s.status === 'out' ? <Tag color="amber">Out</Tag> : <Tag color="green">Available</Tag>}</td>
                <td>{c._s.customer || '—'}</td>
                <td>{c._s.status === 'out' ? (c._s.overdue === 'critical' ? <Tag color="red">{c._s.daysOut}d</Tag> : c._s.overdue === 'warning' ? <Tag color="amber">{c._s.daysOut}d</Tag> : `${c._s.daysOut}d`) : '—'}</td>
                <td>{c._s.trips90}</td><td>{c._s.totalTrips}</td>
                <td>{UG[c._s.usageGrp]}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={9} className="tbl-empty">No cylinders match.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );

  if (sel) {
    const s = sel._s;
    return (
      <div>
        <BackBtn onClick={() => setSel(null)} />
        <div className="pg-hd"><h1>Cylinder {fmtQR(sel.qrCode)}</h1><p className="pg-sub">Physical: {sel.physicalId} · {sel.gasType} · {sel.size?.replace('m³','').trim()} m³</p></div>
        <div className="kpi-grid">
          <KPI label="Status" value={s.status === 'out' ? 'OUT' : 'AVAILABLE'} color={s.status === 'out' ? '#d97706' : '#059669'} />
          <KPI label="With Customer" value={s.customer || '—'} color="#2563eb" />
          <KPI label="Days Out" value={s.status === 'out' ? `${s.daysOut}d` : '—'} color={s.overdue === 'critical' ? '#dc2626' : s.overdue === 'warning' ? '#d97706' : '#059669'} />
          <KPI label="Trips (last 90d)" value={s.trips90} color="#7c3aed" />
          <KPI label="Total Trips Ever" value={s.totalTrips} color="#0891b2" />
        </div>
        <h3 className="sec-ttl">Movement History</h3>
        <Tbl cols={['Date', 'Action', 'Customer', 'Driver']}
          rows={s.history.map(h => [fmtDate(h.date), h.action, h.party, h.driver])} />
      </div>
    );
  }

  return (
    <div>
      <div className="pg-hd"><h1>Cylinder Analytics</h1><p className="pg-sub">Click any cylinder for full history · Split by gas type</p></div>
      <div className="filter-row">
        <SearchBar placeholder="QR code…" value={qrQ} onChange={setQrQ} />
        <SearchBar placeholder="Physical ID…" value={physQ} onChange={setPhysQ} />
        <Sel value={statusF} onChange={e => setStatusF(e.target.value)} style={{ width: 'auto' }}><option>All</option><option>Out</option><option>Available</option></Sel>
        <Sel value={overdueF} onChange={e => setOverdueF(e.target.value)} style={{ width: 'auto' }}><option value="All">All Statuses</option><option value="Warning">Warning</option><option value="Critical">Critical</option></Sel>
        <Btn variant="ghost" sm onClick={() => { setQrQ(''); setPhysQ(''); setStatusF('All'); setOverdueF('All'); }}>Clear</Btn>
      </div>
      {loading ? <div className="pg-load">Loading…</div> : (<><CylTable rows={co2} title="CO₂ Cylinders" /><CylTable rows={o2} title="O₂ Cylinders" /></>)}
    </div>
  );
}

function TripHistory() {
  const [list, setList] = useState([]);
  const [custF, setCustF] = useState('');
  const [drvF, setDrvF] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocs(collection(db, 'trips')).then(s => {
      setList(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt)));
      setLoading(false);
    });
  }, []);

  const filtered = list.filter(t => {
    if (custF && !t.customerName?.toLowerCase().includes(custF.toLowerCase())) return false;
    if (drvF && !t.driverName?.toLowerCase().includes(drvF.toLowerCase())) return false;
    if (from) { const d = toDate(t.createdAt); if (!d || d < new Date(from)) return false; }
    if (to) { const d = toDate(t.createdAt); if (!d || d > new Date(to + 'T23:59:59')) return false; }
    return true;
  });

  return (
    <div>
      <div className="pg-hd"><h1>Trip History</h1><p className="pg-sub">{filtered.length} trips</p></div>
      <div className="filter-row">
        <SearchBar placeholder="Customer name…" value={custF} onChange={setCustF} />
        <SearchBar placeholder="Driver name…" value={drvF} onChange={setDrvF} />
        <Inp type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 'auto' }} />
        <Inp type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: 'auto' }} />
        <Btn variant="ghost" sm onClick={() => { setCustF(''); setDrvF(''); setFrom(''); setTo(''); }}>Clear</Btn>
      </div>
      {loading ? <div className="pg-load">Loading…</div> : (
        <Tbl cols={['Date & Time', 'Customer', 'Delivered QRs', 'Collected QRs', 'Driver', 'Notes']}
          // CHANGE 1: CCPL format in trip history
          rows={filtered.map(t => [fmtDT(t.createdAt), t.customerName, (t.delivered || []).map(fmtQR).join(', ') || '—', (t.collected || []).map(fmtQR).join(', ') || '—', t.driverName, t.notes || '—'])} />
      )}
    </div>
  );
}

function DriverAnalytics() {
  const [users, setUsers] = useState([]);
  const [trips, setTrips] = useState([]);
  const [sel, setSel] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [us, ts] = await Promise.all([getDocs(collection(db, 'users')), getDocs(collection(db, 'trips'))]);
      setUsers(us.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.role === 'driver'));
      setTrips(ts.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    })();
  }, []);

  const dStats = (uid, name) => {
    const mv = trips.filter(t => t.driverId === uid || t.driverName === name);
    const delivered = mv.reduce((s, t) => s + (t.delivered?.length || 0), 0);
    const collected = mv.reduce((s, t) => s + (t.collected?.length || 0), 0);
    const cc = {};
    mv.forEach(t => { if (t.customerName) cc[t.customerName] = (cc[t.customerName] || 0) + 1; });
    const top = Object.entries(cc).sort((a, b) => b[1] - a[1]);
    return { trips: mv.length, delivered, collected, top, mv: mv.sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt)) };
  };

  if (sel) {
    const s = dStats(sel.id, sel.name);
    return (
      <div>
        <BackBtn onClick={() => setSel(null)} />
        <div className="pg-hd"><h1>{sel.name}</h1><p className="pg-sub">{sel.email}</p></div>
        <div className="kpi-grid">
          <KPI label="Total Trips" value={s.trips} color="#2563eb" />
          <KPI label="Cylinders Delivered" value={s.delivered} color="#dc2626" />
          <KPI label="Cylinders Collected" value={s.collected} color="#059669" />
          <KPI label="Top Customer" value={s.top[0]?.[0] || '—'} color="#d97706" sub={s.top[0] ? `${s.trips ? Math.round(s.top[0][1] / s.trips * 100) : 0}% of trips` : undefined} />
        </div>
        <h3 className="sec-ttl">Customer Visit Breakdown</h3>
        <p className="sec-note">High concentration on one customer may indicate a routing preference worth reviewing.</p>
        <Tbl cols={['Customer', 'Trips', '% of Total']}
          rows={s.top.map(([n, c]) => [n, c, `${s.trips ? Math.round(c / s.trips * 100) : 0}%`])} />
        <h3 className="sec-ttl">Recent Trips</h3>
        <Tbl cols={['Date', 'Customer', 'Delivered', 'Collected']}
          rows={s.mv.slice(0, 30).map(t => [fmtDate(t.createdAt), t.customerName, t.delivered?.length || 0, t.collected?.length || 0])} />
      </div>
    );
  }

  const all = users.map(u => ({ ...u, _s: dStats(u.id, u.name) })).sort((a, b) => b._s.trips - a._s.trips);
  return (
    <div>
      <div className="pg-hd"><h1>Driver Analytics</h1><p className="pg-sub">Click a driver to see detailed activity and customer visits</p></div>
      {loading ? <div className="pg-load">Loading…</div> : (
        <Tbl cols={['Driver', 'Total Trips', 'Cylinders Delivered', 'Cylinders Collected', 'Top Customer']}
          rows={all.map(d => [<strong>{d.name}</strong>, d._s.trips, d._s.delivered, d._s.collected, d._s.top[0]?.[0] || '—'])}
          onRow={i => setSel(all[i])} />
      )}
    </div>
  );
}

function Vehicles() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ number: '', description: '' });
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const s = await getDocs(collection(db, 'vehicles'));
    setList(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.number?.localeCompare(b.number)));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm({ number: '', description: '' }); setEditing(null); setOpen(true); };
  const openEdit = v => { setForm({ number: v.number, description: v.description || '' }); setEditing(v); setOpen(true); };

  const save = async () => {
    if (!form.number.trim()) return alert('Vehicle number required');
    const num = form.number.trim().toUpperCase();
    if (!editing && list.find(v => v.number === num)) return alert(`${num} is already registered`);
    if (editing) {
      await updateDoc(doc(db, 'vehicles', editing.id), { number: num, description: form.description });
    } else {
      await addDoc(collection(db, 'vehicles'), { number: num, description: form.description, active: true, createdAt: serverTimestamp() });
    }
    setOpen(false); load();
  };

  const toggleActive = async (v) => {
    await updateDoc(doc(db, 'vehicles', v.id), { active: !v.active });
    load();
  };

  const del = async (v) => {
    if (!window.confirm(`Delete vehicle ${v.number}?`)) return;
    await deleteDoc(doc(db, 'vehicles', v.id)); load();
  };

  return (
    <div>
      <div className="pg-hd">
        <div><h1>Vehicles</h1><p className="pg-sub">{list.length} registered · Drivers select from this list when recording a trip</p></div>
        <Btn sm onClick={openAdd}><Svg d={IC.plus} size={14} /> Add Vehicle</Btn>
      </div>
      <Tbl
        cols={['Vehicle Number', 'Description', 'Status', '']}
        rows={list.map(v => [
          <strong>{v.number}</strong>,
          v.description || '—',
          v.active !== false ? <Tag color="green">Active</Tag> : <Tag color="amber">Inactive</Tag>,
          <div className="row-acts">
            <button className="icon-btn" onClick={() => openEdit(v)}><Svg d={IC.edit} size={14} /></button>
            <button className="icon-btn" title={v.active !== false ? 'Deactivate' : 'Activate'}
              onClick={() => toggleActive(v)}
              style={{ color: v.active !== false ? 'var(--amber)' : 'var(--green)' }}>
              {v.active !== false ? '⏸' : '▶'}
            </button>
            <button className="icon-btn icon-del" onClick={() => del(v)}><Svg d={IC.trash} size={14} /></button>
          </div>
        ])}
        empty="No vehicles registered yet. Add one to get started."
      />
      <Modal open={open} title={editing ? 'Edit Vehicle' : 'Add Vehicle'} onClose={() => setOpen(false)}>
        <div className="modal-body">
          <Field label="Vehicle Number" req>
            <Inp value={form.number} onChange={e => setForm({ ...form, number: e.target.value.toUpperCase() })} placeholder="e.g. TN01AB1234" />
          </Field>
          <Field label="Description">
            <Inp value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="e.g. Tata Ace, Large Truck… (optional)" />
          </Field>
        </div>
        <div className="modal-ft">
          <Btn onClick={save}>Save</Btn>
          <Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn>
        </div>
      </Modal>
    </div>
  );
}

function Users() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'driver' });
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const s = await getDocs(collection(db, 'users'));
    setList(s.docs.map(d => ({ id: d.id, ...d.data() })));
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.name || !form.email) return alert('Name and email required');
    setBusy(true);
    try {
      if (editing) {
        await updateDoc(doc(db, 'users', editing.id), { name: form.name, email: form.email, role: form.role });
      } else {
        if (!form.password) { alert('Password required'); setBusy(false); return; }
        const sec = initializeApp(firebaseConfig, 'sec_' + Date.now());
        const sa = getAuth(sec);
        const cr = await createUserWithEmailAndPassword(sa, form.email, form.password);
        await setDoc(doc(db, 'users', cr.user.uid), { name: form.name, email: form.email, role: form.role, createdAt: serverTimestamp() });
        await signOut(sa);
      }
      setOpen(false); setEditing(null); load();
    } catch (e) { alert(e.message); }
    setBusy(false);
  };

  return (
    <div>
      <div className="pg-hd">
        <div><h1>Users</h1><p className="pg-sub">{list.length} total</p></div>
        <Btn sm onClick={() => { setEditing(null); setForm({ name: '', email: '', password: '', role: 'driver' }); setOpen(true); }}>
          <Svg d={IC.plus} size={14} /> Create User
        </Btn>
      </div>
      <Tbl cols={['Name', 'Email', 'Role', '']}
        rows={list.map(u => [u.name, u.email, <Tag color={u.role}>{u.role}</Tag>,
          <div className="row-acts">
            <button className="icon-btn" onClick={() => { setEditing(u); setForm({ name: u.name, email: u.email, role: u.role, password: '' }); setOpen(true); }}><Svg d={IC.edit} size={14} /></button>
            <button className="icon-btn icon-del" onClick={async () => { if (window.confirm(`Delete ${u.name}?`)) { await deleteDoc(doc(db, 'users', u.id)); load(); } }}><Svg d={IC.trash} size={14} /></button>
          </div>
        ])} />
      <Modal open={open} title={editing ? 'Edit User' : 'Create User'} onClose={() => setOpen(false)}>
        <div className="modal-body">
          <Field label="Full Name" req><Inp value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" /></Field>
          <Field label="Email" req><Inp type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="user@cylinder.local" /></Field>
          {!editing && <Field label="Password" req><Inp type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Min. 6 characters" /></Field>}
          <Field label="Role"><Sel value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}><option value="driver">Driver</option><option value="admin">Admin</option><option value="superadmin">Super Admin</option></Sel></Field>
          {editing && <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.5rem' }}>Password resets are handled via Firebase Console.</p>}
        </div>
        <div className="modal-ft"><Btn onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Btn><Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn></div>
      </Modal>
    </div>
  );
}

function SettingsPage({ settings, setSettings }) {
  const [form, setForm] = useState({ ...settings });
  const [confirm, setConfirm] = useState(false);
  const [saved, setSaved] = useState(false);

  const doSave = async () => {
    await setDoc(doc(db, 'appSettings', 'thresholds'), form);
    setSettings(form); setConfirm(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const NF = ({ label, k, suffix, note }) => (
    <div className="setting-row">
      <div><div className="setting-lbl">{label}</div>{note && <div className="setting-note">{note}</div>}</div>
      <div className="setting-ctrl">
        <Inp type="number" min={1} value={form[k]} onChange={e => setForm({ ...form, [k]: parseInt(e.target.value) || 0 })} style={{ width: 72 }} />
        <span className="setting-sfx">{suffix}</span>
      </div>
    </div>
  );

  return (
    <div>
      <div className="pg-hd"><h1>Settings</h1><p className="pg-sub">All thresholds apply immediately on save</p></div>
      {saved && <div className="success-bar"><Svg d={IC.check} size={15} /> Settings saved successfully.</div>}
      <div className="settings-card"><div className="settings-card-title">Overdue Thresholds</div>
        <NF label="Warning — cylinder out for more than" k="overdueWarningDays" suffix="days" note="Shown as amber in analytics" />
        <NF label="Critical — cylinder out for more than" k="overdueCriticalDays" suffix="days" note="Shown as red + dashboard alert" />
      </div>
      <div className="settings-card"><div className="settings-card-title">Customer Turnaround Time (TAT) Groups</div>
        <NF label="Fast — average return under" k="tatFastDays" suffix="days" />
        <NF label="Medium — average return under" k="tatMediumDays" suffix="days" note="Slow = anything above this" />
      </div>
      <div className="settings-card"><div className="settings-card-title">Cylinder Usage Groups (last 90 days)</div>
        <NF label="High use — more than" k="usageHighTrips" suffix="trips" note="Flag for wear and tear inspection" />
        <NF label="Medium use — more than" k="usageMediumTrips" suffix="trips" note="Low = below this" />
      </div>
      <div className="settings-card"><div className="settings-card-title">Edit Windows</div>
        <NF label="Drivers can edit a trip for" k="driverEditHours" suffix="hours" />
        <NF label="Admins can edit a trip for" k="adminEditHours" suffix="hours" />
      </div>
      <Btn onClick={() => setConfirm(true)}>Save Settings</Btn>
      <Modal open={confirm} title="Confirm Changes" onClose={() => setConfirm(false)}>
        <div className="modal-body"><p>These changes apply immediately across all analytics and alerts. Continue?</p></div>
        <div className="modal-ft"><Btn onClick={doSave}>Yes, Save</Btn><Btn variant="ghost" onClick={() => setConfirm(false)}>Cancel</Btn></div>
      </Modal>
    </div>
  );
}
