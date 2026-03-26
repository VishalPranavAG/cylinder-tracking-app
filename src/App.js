import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword
} from 'firebase/auth';
import {
  getFirestore, collection, doc, setDoc, getDoc, getDocs,
  addDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, Timestamp
} from 'firebase/firestore';
import {
  Users, Package, BarChart2, LogOut, Eye, EyeOff, Plus, Edit2,
  Trash2, Download, ChevronUp, ChevronDown, ArrowLeft, X,
  CheckSquare, Settings, Truck, TrendingUp, AlertTriangle,
  Clock, Filter, Search, RefreshCw, FileText
} from 'lucide-react';
import './App.css';

// ─── FIREBASE CONFIG ───────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyAeVgWXO2tsP4QozFaOxRYAfgURGkV8CvI",
  authDomain: "cylinder-tracking-8b128.firebaseapp.com",
  projectId: "cylinder-tracking-8b128",
  storageBucket: "cylinder-tracking-8b128.firebasestorage.app",
  messagingSenderId: "3374622360",
  appId: "1:3374622360:web:270d65c986f7e6afce12ed",
  measurementId: "G-KSQV4483WL"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ─── DEFAULT SETTINGS ──────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  overdueWarningDays: 30,
  overdueCriticalDays: 60,
  tatFastDays: 20,
  tatMediumDays: 35,
  usageHighTrips: 15,
  usageMediumTrips: 8,
  driverEditHours: 24,
  adminEditHours: 48,
};

// ─── HELPERS ───────────────────────────────────────────────────────────────────
const daysBetween = (date1, date2) => {
  const d1 = date1 instanceof Date ? date1 : date1?.toDate ? date1.toDate() : new Date(date1);
  const d2 = date2 instanceof Date ? date2 : date2?.toDate ? date2.toDate() : new Date(date2);
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
};

const formatDate = (ts) => {
  if (!ts) return '-';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatDateTime = (ts) => {
  if (!ts) return '-';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const nextQRNumber = (cylinders) => {
  if (!cylinders.length) return '001';
  const max = Math.max(...cylinders.map(c => parseInt(c.qrCode) || 0));
  return String(max + 1).padStart(3, '0');
};

// ─── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState('dashboard');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (u) {
        const snap = await getDoc(doc(db, 'users', u.uid));
        if (snap.exists()) {
          setUserRole(snap.data().role);
          setUserName(snap.data().name || snap.data().email);
        }
        setUser(u);
        // load settings
        const sSnap = await getDoc(doc(db, 'appSettings', 'thresholds'));
        if (sSnap.exists()) setSettings({ ...DEFAULT_SETTINGS, ...sSnap.data() });
      } else {
        setUser(null); setUserRole(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) return <div className="loading">Loading...</div>;
  if (!user) return <LoginPage />;

  const isAdmin = userRole === 'admin' || userRole === 'superadmin';
  const isSuperAdmin = userRole === 'superadmin';
  const isDriver = userRole === 'driver';

  const navItems = [
    { key: 'dashboard', label: 'Dashboard', icon: <BarChart2 size={18} />, show: true },
    { key: 'customers', label: 'Customers', icon: <Users size={18} />, show: isAdmin },
    { key: 'customerAnalytics', label: 'Customer Analytics', icon: <TrendingUp size={18} />, show: isAdmin },
    { key: 'cylinders', label: 'Cylinders', icon: <Package size={18} />, show: isAdmin },
    { key: 'cylinderAnalytics', label: 'Cylinder Analytics', icon: <BarChart2 size={18} />, show: isAdmin },
    { key: 'movements', label: 'Record Movement', icon: <Truck size={18} />, show: isDriver },
    { key: 'movementHistory', label: 'Movement History', icon: <FileText size={18} />, show: isAdmin },
    { key: 'driverAnalytics', label: 'Driver Analytics', icon: <Users size={18} />, show: isSuperAdmin },
    { key: 'userManagement', label: 'Users', icon: <Users size={18} />, show: isSuperAdmin },
    { key: 'appSettings', label: 'Settings', icon: <Settings size={18} />, show: isSuperAdmin },
  ];

  return (
    <div className="app">
      <nav className="navbar">
        <h1>🧪 Cylinder Tracker</h1>
        <div className="nav-right">
          <span className="nav-user">{userName} <span className={`role-badge ${userRole}`}>{userRole}</span></span>
          <button className="logout-btn" onClick={() => signOut(auth)}><LogOut size={16} /> Logout</button>
        </div>
      </nav>
      <div className="main-container">
        <aside className="sidebar">
          {navItems.filter(n => n.show).map(n => (
            <button key={n.key} className={activePage === n.key ? 'active' : ''} onClick={() => setActivePage(n.key)}>
              {n.icon} {n.label}
            </button>
          ))}
        </aside>
        <main className="content">
          {activePage === 'dashboard' && <DashboardPage settings={settings} userRole={userRole} setActivePage={setActivePage} />}
          {activePage === 'customers' && <CustomersPage />}
          {activePage === 'customerAnalytics' && <CustomerAnalyticsPage settings={settings} />}
          {activePage === 'cylinders' && <CylindersPage />}
          {activePage === 'cylinderAnalytics' && <CylinderAnalyticsPage settings={settings} />}
          {activePage === 'movements' && <RecordMovementPage userId={user.uid} userName={userName} settings={settings} />}
          {activePage === 'movementHistory' && <MovementHistoryPage userRole={userRole} settings={settings} />}
          {activePage === 'driverAnalytics' && <DriverAnalyticsPage />}
          {activePage === 'userManagement' && <UserManagementPage />}
          {activePage === 'appSettings' && <AppSettingsPage settings={settings} setSettings={setSettings} />}
        </main>
      </div>
    </div>
  );
}

// ─── LOGIN ─────────────────────────────────────────────────────────────────────
function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [showForgot, setShowForgot] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setError('Invalid email or password. Please try again.');
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>🧪 Cylinder Tracker</h1>
        <form onSubmit={handleLogin}>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <div className="pw-field">
            <input type={showPw ? 'text' : 'password'} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
            <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)}>
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit">Login</button>
          <button type="button" className="forgot-link" onClick={() => setShowForgot(true)}>Forgot Password?</button>
        </form>
      </div>
      {showForgot && (
        <div className="modal-overlay" onClick={() => setShowForgot(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Forgot Password?</h2>
            <p>Please contact the administrator for a password reset:</p>
            <div className="contact-info">
              <strong>vishalpranav23@gmail.com</strong>
              <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>Include your login email when contacting.</p>
            </div>
            <button className="btn-primary" onClick={() => setShowForgot(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DASHBOARD ─────────────────────────────────────────────────────────────────
function DashboardPage({ settings, userRole, setActivePage }) {
  const [stats, setStats] = useState({ totalOut: 0, warning: 0, critical: 0, co2Out: 0, o2Out: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStats(); }, [settings]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const movSnap = await getDocs(collection(db, 'movements'));
      const movements = movSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Find currently out cylinders
      const cylinderStatus = {};
      movements.sort((a, b) => {
        const ta = a.createdAt?.toDate?.() || new Date(0);
        const tb = b.createdAt?.toDate?.() || new Date(0);
        return ta - tb;
      }).forEach(m => {
        (m.qrCodes || []).forEach(qr => {
          if (m.type === 'outward') {
            cylinderStatus[qr] = { customer: m.customerName, deliveredAt: m.createdAt, gasType: m.gasTypes?.[qr] };
          } else if (m.type === 'inward') {
            delete cylinderStatus[qr];
          }
        });
      });

      const now = new Date();
      let totalOut = 0, warning = 0, critical = 0, co2Out = 0, o2Out = 0;
      Object.values(cylinderStatus).forEach(c => {
        totalOut++;
        const days = daysBetween(c.deliveredAt?.toDate?.() || new Date(), now);
        if (days >= settings.overdueCriticalDays) critical++;
        else if (days >= settings.overdueWarningDays) warning++;
        if (c.gasType === 'CO2') co2Out++;
        else if (c.gasType === 'O2') o2Out++;
      });

      setStats({ totalOut, warning, critical, co2Out, o2Out });
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const isAdmin = userRole === 'admin' || userRole === 'superadmin';

  const cards = [
    { label: 'Total Cylinders Out', value: stats.totalOut, color: '#3498db', filter: 'all', icon: '📦' },
    { label: `Warning (≥${settings.overdueWarningDays} & <${settings.overdueCriticalDays} days)`, value: stats.warning, color: '#f39c12', filter: 'warning', icon: '⚠️' },
    { label: `Critical Overdue (≥${settings.overdueCriticalDays} days)`, value: stats.critical, color: '#e74c3c', filter: 'critical', icon: '🔴' },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: '1.5rem', color: '#1a1a2e' }}>Dashboard</h2>
      {loading ? <p>Loading...</p> : (
        <>
          <div className="stats">
            {cards.map(card => (
              <div key={card.label} className="stat-card" style={{ borderTop: `4px solid ${card.color}`, cursor: isAdmin ? 'pointer' : 'default' }}
                onClick={() => isAdmin && setActivePage('cylinderAnalytics')}>
                <h3>{card.icon} {card.label}</h3>
                <p className="stat-number" style={{ color: card.color }}>{card.value}</p>
                {isAdmin && <p className="stat-hint">Click to view details →</p>}
              </div>
            ))}
          </div>
          <div className="stats" style={{ marginTop: '1rem' }}>
            <div className="stat-card" style={{ borderTop: '4px solid #16a085' }}>
              <h3>🟡 CO2 Cylinders Out</h3>
              <p className="stat-number" style={{ color: '#16a085' }}>{stats.co2Out}</p>
            </div>
            <div className="stat-card" style={{ borderTop: '4px solid #8e44ad' }}>
              <h3>🔵 O2 Cylinders Out</h3>
              <p className="stat-number" style={{ color: '#8e44ad' }}>{stats.o2Out}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── CUSTOMERS PAGE ────────────────────────────────────────────────────────────
function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [form, setForm] = useState({ name: '', contact: '', address: '', gst: '' });
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => { loadCustomers(); }, []);

  const loadCustomers = async () => {
    const snap = await getDocs(collection(db, 'customers'));
    setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const saveCustomer = async () => {
    if (!form.name.trim()) return alert('Customer name is required');
    if (editCustomer) {
      await updateDoc(doc(db, 'customers', editCustomer.id), form);
    } else {
      const exists = customers.find(c => c.name.toLowerCase() === form.name.toLowerCase());
      if (exists) return alert('Customer with this name already exists');
      await addDoc(collection(db, 'customers'), { ...form, createdAt: serverTimestamp() });
    }
    setForm({ name: '', contact: '', address: '', gst: '' });
    setShowForm(false); setEditCustomer(null);
    loadCustomers();
  };

  const deleteCustomer = async (customer) => {
    // Check if they have cylinders out
    const movSnap = await getDocs(collection(db, 'movements'));
    const movements = movSnap.docs.map(d => ({ ...d.data() }));
    const cylinderStatus = {};
    movements.sort((a, b) => (a.createdAt?.toDate?.() || 0) - (b.createdAt?.toDate?.() || 0)).forEach(m => {
      (m.qrCodes || []).forEach(qr => {
        if (m.type === 'outward' && m.customerId === customer.id) cylinderStatus[qr] = true;
        else if (m.type === 'inward' && m.customerId === customer.id) delete cylinderStatus[qr];
      });
    });
    if (Object.keys(cylinderStatus).length > 0) {
      return alert(`⚠️ Cannot delete: ${customer.name} currently has ${Object.keys(cylinderStatus).length} cylinder(s) out.`);
    }
    await deleteDoc(doc(db, 'customers', customer.id));
    setConfirmDelete(null);
    loadCustomers();
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target.result;
      const lines = text.split('\n').filter(l => l.trim());
      let imported = 0;
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
        const name = cols[0];
        if (!name) continue;
        const exists = customers.find(c => c.name.toLowerCase() === name.toLowerCase());
        if (exists) continue;
        await addDoc(collection(db, 'customers'), {
          name, contact: cols[1] || '', address: cols[2] || '', gst: cols[3] || 'N/A', createdAt: serverTimestamp()
        });
        imported++;
      }
      alert(`Imported ${imported} customers (duplicates skipped)`);
      loadCustomers();
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const csv = 'Customer Name,Contact,Address,GST Number\nExample Company,9876543210,123 Main St,29ABCDE1234F1Z5';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'customer_template.csv'; a.click();
  };

  const filtered = customers.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="section">
      <div className="section-header">
        <h2>Customer Management</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn-secondary" onClick={downloadTemplate}><Download size={16} /> Template</button>
          <label className="btn-secondary" style={{ cursor: 'pointer' }}>
            <Download size={16} /> Import Excel
            <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImport} />
          </label>
          <button className="btn-primary" onClick={() => { setShowForm(true); setEditCustomer(null); setForm({ name: '', contact: '', address: '', gst: '' }); }}>
            <Plus size={16} /> Add Customer
          </button>
        </div>
      </div>

      {showForm && (
        <div className="form">
          <h3>{editCustomer ? 'Edit Customer' : 'Add New Customer'}</h3>
          <input placeholder="Customer Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Contact Number" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} />
          <input placeholder="Address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
          <input placeholder="GST Number (or N/A)" value={form.gst} onChange={e => setForm({ ...form, gst: e.target.value })} />
          <div className="form-buttons">
            <button className="btn-primary" onClick={saveCustomer}>Save</button>
            <button className="btn-secondary" onClick={() => { setShowForm(false); setEditCustomer(null); }}>Cancel</button>
          </div>
        </div>
      )}

      <input className="search-input" placeholder="Search customers..." value={search} onChange={e => setSearch(e.target.value)} />

      <table className="data-table">
        <thead><tr><th>Name</th><th>Contact</th><th>Address</th><th>GST</th><th>Actions</th></tr></thead>
        <tbody>
          {filtered.map(c => (
            <tr key={c.id}>
              <td>{c.name}</td><td>{c.contact || '-'}</td><td>{c.address || '-'}</td><td>{c.gst || 'N/A'}</td>
              <td>
                <button className="btn-icon" onClick={() => { setEditCustomer(c); setForm({ name: c.name, contact: c.contact || '', address: c.address || '', gst: c.gst || '' }); setShowForm(true); }}><Edit2 size={14} /></button>
                <button className="btn-icon danger" onClick={() => setConfirmDelete(c)}><Trash2 size={14} /></button>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: '#999' }}>No customers found</td></tr>}
        </tbody>
      </table>

      {confirmDelete && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>⚠️ Delete Customer</h3>
            <p>Are you sure you want to delete <strong>{confirmDelete.name}</strong>? This cannot be undone.</p>
            <div className="form-buttons" style={{ marginTop: '1rem' }}>
              <button className="btn-primary" style={{ background: '#e74c3c' }} onClick={() => deleteCustomer(confirmDelete)}>Delete</button>
              <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CUSTOMER ANALYTICS ────────────────────────────────────────────────────────
function CustomerAnalyticsPage({ settings }) {
  const [customers, setCustomers] = useState([]);
  const [movements, setMovements] = useState([]);
  const [searchName, setSearchName] = useState('');
  const [searchGST, setSearchGST] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [cSnap, mSnap] = await Promise.all([getDocs(collection(db, 'customers')), getDocs(collection(db, 'movements'))]);
    setCustomers(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setMovements(mSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  const getCustomerStats = (customerId) => {
    const custMovements = movements.filter(m => m.customerId === customerId);
    const sorted = [...custMovements].sort((a, b) => (a.createdAt?.toDate?.() || 0) - (b.createdAt?.toDate?.() || 0));

    const cylinderStatus = {};
    sorted.forEach(m => {
      (m.qrCodes || []).forEach(qr => {
        if (m.type === 'outward') cylinderStatus[qr] = { deliveredAt: m.createdAt, gasType: m.gasTypes?.[qr] };
        else if (m.type === 'inward') delete cylinderStatus[qr];
      });
    });

    const co2Out = Object.values(cylinderStatus).filter(c => c.gasType === 'CO2').length;
    const o2Out = Object.values(cylinderStatus).filter(c => c.gasType === 'O2').length;
    const totalOut = Object.keys(cylinderStatus).length;

    // Calculate average TAT from completed trips
    const tats = [];
    const tripMap = {};
    sorted.forEach(m => {
      (m.qrCodes || []).forEach(qr => {
        if (m.type === 'outward') tripMap[qr] = m.createdAt;
        else if (m.type === 'inward' && tripMap[qr]) {
          tats.push(daysBetween(tripMap[qr]?.toDate?.() || new Date(), m.createdAt?.toDate?.() || new Date()));
          delete tripMap[qr];
        }
      });
    });
    const avgTAT = tats.length ? Math.round(tats.reduce((a, b) => a + b, 0) / tats.length) : null;

    // Max days currently out
    const now = new Date();
    const maxDaysOut = Object.values(cylinderStatus).reduce((max, c) => {
      const days = daysBetween(c.deliveredAt?.toDate?.() || now, now);
      return Math.max(max, days);
    }, 0);

    let statusColor = 'green';
    if (maxDaysOut >= settings.overdueCriticalDays) statusColor = 'red';
    else if (maxDaysOut >= settings.overdueWarningDays) statusColor = 'yellow';

    return { co2Out, o2Out, totalOut, avgTAT, maxDaysOut, statusColor, currentCylinders: cylinderStatus };
  };

  const getTATGroup = (avgTAT) => {
    if (avgTAT === null) return '-';
    if (avgTAT < settings.tatFastDays) return '🟢 Fast';
    if (avgTAT <= settings.tatMediumDays) return '🟡 Medium';
    return '🔴 Slow';
  };

  const statusIndicator = { green: '🟢', yellow: '🟡', red: '🔴' };

  const enriched = customers.map(c => ({ ...c, ...getCustomerStats(c.id) }));

  const filtered = enriched.filter(c =>
    c.name?.toLowerCase().includes(searchName.toLowerCase()) &&
    (c.gst || '').toLowerCase().includes(searchGST.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    let va = a[sortKey], vb = b[sortKey];
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ k }) => sortKey === k ? (sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : null;

  if (selectedCustomer) {
    const stats = getCustomerStats(selectedCustomer.id);
    const cylDetails = Object.entries(stats.currentCylinders).map(([qr, info]) => ({
      qr, gasType: info.gasType, deliveredAt: info.deliveredAt,
      daysOut: daysBetween(info.deliveredAt?.toDate?.() || new Date(), new Date())
    }));

    const history = movements.filter(m => m.customerId === selectedCustomer.id)
      .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));

    return (
      <div className="section">
        <button className="btn-back" onClick={() => setSelectedCustomer(null)}><ArrowLeft size={16} /> Back to All Customers</button>
        <h2>{selectedCustomer.name}</h2>
        <p style={{ color: '#666', marginBottom: '1rem' }}>
          {selectedCustomer.contact} | GST: {selectedCustomer.gst || 'N/A'} | {selectedCustomer.address}
        </p>
        <div className="summary-cards">
          <div className="summary-card" style={{ borderTop: '4px solid #16a085' }}><h4>CO2 Out</h4><p className="big-number">{stats.co2Out}</p></div>
          <div className="summary-card" style={{ borderTop: '4px solid #8e44ad' }}><h4>O2 Out</h4><p className="big-number">{stats.o2Out}</p></div>
          <div className="summary-card" style={{ borderTop: '4px solid #2980b9' }}><h4>Total Out</h4><p className="big-number">{stats.totalOut}</p></div>
          <div className="summary-card" style={{ borderTop: '4px solid #e67e22' }}><h4>Avg TAT</h4><p className="big-number">{stats.avgTAT ?? '-'} {stats.avgTAT ? 'days' : ''}</p></div>
        </div>

        {cylDetails.length > 0 && (
          <>
            <h3 style={{ margin: '1.5rem 0 0.75rem' }}>Currently Out</h3>
            <table className="data-table">
              <thead><tr><th>QR</th><th>Gas Type</th><th>Delivered On</th><th>Days Out</th><th>Status</th></tr></thead>
              <tbody>
                {cylDetails.map(c => (
                  <tr key={c.qr}>
                    <td>{c.qr}</td><td>{c.gasType}</td><td>{formatDate(c.deliveredAt)}</td>
                    <td>{c.daysOut}</td>
                    <td>
                      {c.daysOut >= settings.overdueCriticalDays ? <span className="status-badge status-red">Critical</span>
                        : c.daysOut >= settings.overdueWarningDays ? <span className="status-badge status-yellow">Warning</span>
                          : <span className="status-badge status-green">OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <h3 style={{ margin: '1.5rem 0 0.75rem' }}>Movement History</h3>
        <table className="data-table">
          <thead><tr><th>Date</th><th>Type</th><th>Cylinders</th><th>Driver</th></tr></thead>
          <tbody>
            {history.map(m => (
              <tr key={m.id}>
                <td>{formatDate(m.createdAt)}</td>
                <td><span className={`status-badge ${m.type}`}>{m.type === 'outward' ? '🔴 Outward' : '🟢 Inward'}</span></td>
                <td>{(m.qrCodes || []).join(', ')}</td>
                <td>{m.driverName}</td>
              </tr>
            ))}
            {history.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: '#999' }}>No movements</td></tr>}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="section">
      <h2>Customer Analytics</h2>
      <div className="search-row">
        <input className="search-input" placeholder="Search by name..." value={searchName} onChange={e => setSearchName(e.target.value)} />
        <input className="search-input" placeholder="Search by GST..." value={searchGST} onChange={e => setSearchGST(e.target.value)} />
        <button className="btn-secondary" onClick={() => { setSearchName(''); setSearchGST(''); }}>Clear</button>
      </div>
      {loading ? <p>Loading...</p> : (
        <table className="data-table sortable">
          <thead>
            <tr>
              <th onClick={() => handleSort('name')}>Customer <SortIcon k="name" /></th>
              <th onClick={() => handleSort('co2Out')}>CO2 Out <SortIcon k="co2Out" /></th>
              <th onClick={() => handleSort('o2Out')}>O2 Out <SortIcon k="o2Out" /></th>
              <th onClick={() => handleSort('totalOut')}>Total Out <SortIcon k="totalOut" /></th>
              <th onClick={() => handleSort('avgTAT')}>Avg TAT <SortIcon k="avgTAT" /></th>
              <th>TAT Group</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(c => (
              <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedCustomer(c)}>
                <td>{statusIndicator[c.statusColor]} {c.name}</td>
                <td>{c.co2Out}</td><td>{c.o2Out}</td><td>{c.totalOut}</td>
                <td>{c.avgTAT !== null ? `${c.avgTAT} days` : '-'}</td>
                <td>{getTATGroup(c.avgTAT)}</td>
                <td>
                  {c.statusColor === 'red' ? <span className="status-badge status-red">Critical</span>
                    : c.statusColor === 'yellow' ? <span className="status-badge status-yellow">Warning</span>
                      : <span className="status-badge status-green">OK</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── CYLINDERS PAGE ────────────────────────────────────────────────────────────
function CylindersPage() {
  const [cylinders, setCylinders] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editCyl, setEditCyl] = useState(null);
  const [autoQR, setAutoQR] = useState(true);
  const [form, setForm] = useState({ qrCode: '', physicalId: '', size: '5', gasType: 'CO2' });
  const [selected, setSelected] = useState([]);
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [bulkCount, setBulkCount] = useState(10);
  const [confirmDeleteCyl, setConfirmDeleteCyl] = useState(null);

  useEffect(() => { loadCylinders(); }, []);

  const loadCylinders = async () => {
    const snap = await getDocs(collection(db, 'cylinders'));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => parseInt(a.qrCode) - parseInt(b.qrCode));
    setCylinders(data);
  };

  const saveCylinder = async () => {
    const qr = autoQR && !editCyl ? nextQRNumber(cylinders) : form.qrCode.trim();
    if (!qr) return alert('QR Code is required');
    if (!form.physicalId.trim()) return alert('Physical ID is required');
    if (!editCyl) {
      const exists = cylinders.find(c => c.qrCode === qr);
      if (exists) return alert(`QR Code ${qr} already exists`);
      await addDoc(collection(db, 'cylinders'), { qrCode: qr, physicalId: form.physicalId, size: form.size, gasType: form.gasType, createdAt: serverTimestamp() });
    } else {
      await updateDoc(doc(db, 'cylinders', editCyl.id), { physicalId: form.physicalId, size: form.size, gasType: form.gasType });
    }
    setShowForm(false); setEditCyl(null); setForm({ qrCode: '', physicalId: '', size: '5', gasType: 'CO2' });
    loadCylinders();
  };

  const deleteCylinder = async (cyl) => {
    await deleteDoc(doc(db, 'cylinders', cyl.id));
    setConfirmDeleteCyl(null);
    loadCylinders();
  };

  const generateQRPDF = async (qrList) => {
    if (!qrList.length) return alert('No QR codes to generate');
    try {
      const { default: QRCode } = await import('qrcode');
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = 210, pageH = 297, margin = 15, qrSize = 60, gap = 15;
      const cols = 3, rows = 4;
      let x = margin, y = margin, count = 0;

      for (const item of qrList) {
        const url = await QRCode.toDataURL(item.qrCode, { width: 300, margin: 1 });
        pdf.addImage(url, 'PNG', x, y, qrSize, qrSize);
        pdf.setFontSize(10);
        pdf.text(item.qrCode, x + qrSize / 2, y + qrSize + 5, { align: 'center' });
        pdf.setFontSize(8);
        pdf.text(`${item.gasType} - ${item.size}m³`, x + qrSize / 2, y + qrSize + 10, { align: 'center' });

        count++;
        if (count % cols === 0) { x = margin; y += qrSize + gap + 15; }
        else x += qrSize + gap;
        if (count % (cols * rows) === 0 && count < qrList.length) { pdf.addPage(); x = margin; y = margin; }
      }

      pdf.save('cylinder_qr_codes.pdf');
    } catch (e) {
      alert('Error generating PDF: ' + e.message);
    }
  };

  const generateSelected = () => {
    const items = cylinders.filter(c => selected.includes(c.id));
    generateQRPDF(items);
  };

  const generateRange = () => {
    const from = parseInt(rangeFrom), to = parseInt(rangeTo);
    if (isNaN(from) || isNaN(to) || from > to) return alert('Enter valid range');
    const items = cylinders.filter(c => { const n = parseInt(c.qrCode); return n >= from && n <= to; });
    if (!items.length) return alert('No cylinders found in this range');
    generateQRPDF(items);
  };

  const generateBulk = async () => {
    try {
      const { default: QRCode } = await import('qrcode');
      const { jsPDF } = await import('jspdf');
      const start = cylinders.length ? Math.max(...cylinders.map(c => parseInt(c.qrCode) || 0)) + 1 : 1;
      const items = Array.from({ length: parseInt(bulkCount) }, (_, i) => ({
        qrCode: String(start + i).padStart(3, '0'), gasType: '---', size: '---'
      }));
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const margin = 15, qrSize = 60, gap = 15, cols = 3;
      let x = margin, y = margin, count = 0;
      for (const item of items) {
        const url = await QRCode.toDataURL(item.qrCode, { width: 300, margin: 1 });
        pdf.addImage(url, 'PNG', x, y, qrSize, qrSize);
        pdf.setFontSize(12); pdf.text(item.qrCode, x + qrSize / 2, y + qrSize + 6, { align: 'center' });
        count++;
        if (count % cols === 0) { x = margin; y += qrSize + gap + 10; }
        else x += qrSize + gap;
      }
      pdf.save(`bulk_qr_${start}_to_${start + parseInt(bulkCount) - 1}.pdf`);
    } catch (e) { alert('Error: ' + e.message); }
  };

  const toggleSelect = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const toggleAll = () => setSelected(selected.length === cylinders.length ? [] : cylinders.map(c => c.id));

  return (
    <div className="section">
      <div className="section-header">
        <h2>Cylinder Management</h2>
        <button className="btn-primary" onClick={() => { setShowForm(true); setEditCyl(null); setAutoQR(true); setForm({ qrCode: '', physicalId: '', size: '5', gasType: 'CO2' }); }}>
          <Plus size={16} /> Add Cylinder
        </button>
      </div>

      {showForm && (
        <div className="form">
          <h3>{editCyl ? 'Edit Cylinder' : 'Add New Cylinder'}</h3>
          {!editCyl && (
            <label className="checkbox-label">
              <input type="checkbox" checked={autoQR} onChange={e => setAutoQR(e.target.checked)} />
              Use Next Available QR Number (next: {nextQRNumber(cylinders)})
            </label>
          )}
          {(!autoQR || editCyl) && (
            <input placeholder="QR Code" value={editCyl ? editCyl.qrCode : form.qrCode}
              onChange={e => setForm({ ...form, qrCode: e.target.value })} disabled={!!editCyl} />
          )}
          <input placeholder="Physical Cylinder ID" value={form.physicalId} onChange={e => setForm({ ...form, physicalId: e.target.value })} />
          <select value={form.gasType} onChange={e => setForm({ ...form, gasType: e.target.value })}>
            <option value="CO2">CO2</option><option value="O2">O2</option>
          </select>
          <select value={form.size} onChange={e => setForm({ ...form, size: e.target.value })}>
            {['2', '5', '10', '15', '20', '25', '30'].map(s => <option key={s} value={s}>{s} m³</option>)}
          </select>
          <div className="form-buttons">
            <button className="btn-primary" onClick={saveCylinder}>Save</button>
            <button className="btn-secondary" onClick={() => { setShowForm(false); setEditCyl(null); }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="qr-generation-section">
        <h3>📄 Generate QR Codes</h3>
        <div className="qr-gen-methods">
          <div className="qr-gen-method">
            <h4>Selected Cylinders ({selected.length})</h4>
            <button className="btn-primary" disabled={!selected.length} onClick={generateSelected}>
              <Download size={16} /> Generate PDF for Selected
            </button>
          </div>
          <div className="qr-gen-method">
            <h4>By Range</h4>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input placeholder="From" value={rangeFrom} onChange={e => setRangeFrom(e.target.value)} style={{ width: '80px' }} />
              <span>to</span>
              <input placeholder="To" value={rangeTo} onChange={e => setRangeTo(e.target.value)} style={{ width: '80px' }} />
              <button className="btn-primary" onClick={generateRange}><Download size={16} /> Generate</button>
            </div>
          </div>
          <div className="qr-gen-method">
            <h4>Bulk New QR Codes</h4>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="number" value={bulkCount} onChange={e => setBulkCount(e.target.value)} style={{ width: '80px' }} />
              <span>codes (starting from {nextQRNumber(cylinders)})</span>
              <button className="btn-primary" onClick={generateBulk}><Download size={16} /> Generate PDF</button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <button className="btn-secondary" onClick={toggleAll}>{selected.length === cylinders.length ? 'Deselect All' : 'Select All'}</button>
        {selected.length > 0 && <span style={{ alignSelf: 'center', color: '#666' }}>{selected.length} selected</span>}
      </div>

      <table className="data-table">
        <thead><tr><th></th><th>QR Code</th><th>Physical ID</th><th>Gas Type</th><th>Size</th><th>Actions</th></tr></thead>
        <tbody>
          {cylinders.map(c => (
            <tr key={c.id}>
              <td><input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggleSelect(c.id)} /></td>
              <td><strong>{c.qrCode}</strong></td><td>{c.physicalId}</td><td>{c.gasType}</td><td>{c.size} m³</td>
              <td>
                <button className="btn-icon" onClick={() => { setEditCyl(c); setForm({ physicalId: c.physicalId, size: c.size, gasType: c.gasType }); setShowForm(true); }}><Edit2 size={14} /></button>
                <button className="btn-icon danger" onClick={() => setConfirmDeleteCyl(c)}><Trash2 size={14} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {confirmDeleteCyl && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>⚠️ Delete Cylinder</h3>
            <p>Delete cylinder QR <strong>{confirmDeleteCyl.qrCode}</strong>?</p>
            <div className="form-buttons" style={{ marginTop: '1rem' }}>
              <button className="btn-primary" style={{ background: '#e74c3c' }} onClick={() => deleteCylinder(confirmDeleteCyl)}>Delete</button>
              <button className="btn-secondary" onClick={() => setConfirmDeleteCyl(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CYLINDER ANALYTICS ────────────────────────────────────────────────────────
function CylinderAnalyticsPage({ settings }) {
  const [cylinders, setCylinders] = useState([]);
  const [movements, setMovements] = useState([]);
  const [searchQR, setSearchQR] = useState('');
  const [searchPhysical, setSearchPhysical] = useState('');
  const [filterGas, setFilterGas] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterOverdue, setFilterOverdue] = useState('All');
  const [sortKey, setSortKey] = useState('qrCode');
  const [sortDir, setSortDir] = useState('asc');
  const [selectedCyl, setSelectedCyl] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [cSnap, mSnap] = await Promise.all([getDocs(collection(db, 'cylinders')), getDocs(collection(db, 'movements'))]);
    setCylinders(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setMovements(mSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  const getCylStats = (qrCode) => {
    const sorted = [...movements].sort((a, b) => (a.createdAt?.toDate?.() || 0) - (b.createdAt?.toDate?.() || 0));
    let status = 'available', currentCustomer = null, deliveredAt = null, trips = 0;
    const history = [];

    sorted.forEach(m => {
      if ((m.qrCodes || []).includes(qrCode)) {
        if (m.type === 'outward') {
          status = 'out'; currentCustomer = m.customerName; deliveredAt = m.createdAt; trips++;
          history.push({ date: m.createdAt, type: 'outward', customer: m.customerName, driver: m.driverName });
        } else {
          status = 'available'; currentCustomer = null;
          history.push({ date: m.createdAt, type: 'inward', customer: m.customerName, driver: m.driverName });
          deliveredAt = null;
        }
      }
    });

    const daysOut = status === 'out' && deliveredAt ? daysBetween(deliveredAt?.toDate?.() || new Date(), new Date()) : 0;
    let overdueStatus = 'ok';
    if (status === 'out') {
      if (daysOut >= settings.overdueCriticalDays) overdueStatus = 'critical';
      else if (daysOut >= settings.overdueWarningDays) overdueStatus = 'warning';
    }

    return { status, currentCustomer, daysOut, trips, overdueStatus, history: history.reverse() };
  };

  const enriched = cylinders.map(c => ({ ...c, ...getCylStats(c.qrCode) }));

  const filtered = enriched.filter(c => {
    if (!c.qrCode.includes(searchQR)) return false;
    if (!c.physicalId?.includes(searchPhysical)) return false;
    if (filterGas !== 'All' && c.gasType !== filterGas) return false;
    if (filterStatus !== 'All' && c.status !== filterStatus.toLowerCase()) return false;
    if (filterOverdue === 'Warning' && c.overdueStatus !== 'warning') return false;
    if (filterOverdue === 'Critical' && c.overdueStatus !== 'critical') return false;
    return true;
  });

  const sorted2 = [...filtered].sort((a, b) => {
    let va = a[sortKey], vb = b[sortKey];
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (k) => { if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(k); setSortDir('asc'); } };
  const SortIcon = ({ k }) => sortKey === k ? (sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : null;

  // Split by gas type
  const co2 = sorted2.filter(c => c.gasType === 'CO2');
  const o2 = sorted2.filter(c => c.gasType === 'O2');

  if (selectedCyl) {
    const stats = getCylStats(selectedCyl.qrCode);
    return (
      <div className="section">
        <button className="btn-back" onClick={() => setSelectedCyl(null)}><ArrowLeft size={16} /> Back</button>
        <h2>Cylinder QR: {selectedCyl.qrCode}</h2>
        <p style={{ color: '#666', marginBottom: '1rem' }}>Physical ID: {selectedCyl.physicalId} | Gas: {selectedCyl.gasType} | Size: {selectedCyl.size} m³</p>
        <div className="summary-cards">
          <div className="summary-card"><h4>Status</h4><p className="big-number">{stats.status === 'out' ? '🔴 OUT' : '🟢 Available'}</p></div>
          <div className="summary-card"><h4>Current Customer</h4><p className="big-number" style={{ fontSize: '1.2rem' }}>{stats.currentCustomer || '-'}</p></div>
          <div className="summary-card"><h4>Days Out</h4><p className="big-number">{stats.status === 'out' ? stats.daysOut : '-'}</p></div>
          <div className="summary-card"><h4>Total Trips</h4><p className="big-number">{stats.trips}</p></div>
        </div>
        <h3 style={{ margin: '1.5rem 0 0.75rem' }}>Movement History</h3>
        <table className="data-table">
          <thead><tr><th>Date</th><th>Type</th><th>Customer</th><th>Driver</th></tr></thead>
          <tbody>
            {stats.history.map((h, i) => (
              <tr key={i}>
                <td>{formatDate(h.date)}</td>
                <td><span className={`status-badge ${h.type}`}>{h.type === 'outward' ? '🔴 Outward' : '🟢 Inward'}</span></td>
                <td>{h.customer}</td><td>{h.driver}</td>
              </tr>
            ))}
            {stats.history.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: '#999' }}>No history</td></tr>}
          </tbody>
        </table>
      </div>
    );
  }

  const CylTable = ({ data, title }) => (
    <>
      <h3 style={{ margin: '1.5rem 0 0.75rem' }}>{title} ({data.length})</h3>
      <table className="data-table sortable">
        <thead>
          <tr>
            <th onClick={() => handleSort('qrCode')}>QR <SortIcon k="qrCode" /></th>
            <th onClick={() => handleSort('physicalId')}>Physical ID <SortIcon k="physicalId" /></th>
            <th onClick={() => handleSort('size')}>Size <SortIcon k="size" /></th>
            <th onClick={() => handleSort('status')}>Status <SortIcon k="status" /></th>
            <th onClick={() => handleSort('currentCustomer')}>Customer <SortIcon k="currentCustomer" /></th>
            <th onClick={() => handleSort('daysOut')}>Days Out <SortIcon k="daysOut" /></th>
            <th onClick={() => handleSort('trips')}>Trips <SortIcon k="trips" /></th>
          </tr>
        </thead>
        <tbody>
          {data.map(c => (
            <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedCyl(c)}>
              <td><strong>{c.qrCode}</strong></td>
              <td>{c.physicalId}</td>
              <td>{c.size} m³</td>
              <td>{c.status === 'out' ? <span className="status-badge out">Out</span> : <span className="status-badge available">Available</span>}</td>
              <td>{c.currentCustomer || '-'}</td>
              <td>
                {c.status === 'out' ? (
                  c.overdueStatus === 'critical' ? <span className="status-badge status-red">{c.daysOut}d 🔴</span>
                    : c.overdueStatus === 'warning' ? <span className="status-badge status-yellow">{c.daysOut}d ⚠️</span>
                      : <span className="status-badge status-green">{c.daysOut}d</span>
                ) : '-'}
              </td>
              <td>{c.trips}</td>
            </tr>
          ))}
          {data.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#999' }}>No cylinders found</td></tr>}
        </tbody>
      </table>
    </>
  );

  return (
    <div className="section">
      <h2>Cylinder Analytics</h2>
      <div className="filter-bar">
        <input className="search-input" placeholder="Search QR..." value={searchQR} onChange={e => setSearchQR(e.target.value)} />
        <input className="search-input" placeholder="Search Physical ID..." value={searchPhysical} onChange={e => setSearchPhysical(e.target.value)} />
        <select value={filterGas} onChange={e => setFilterGas(e.target.value)}>
          <option>All</option><option>CO2</option><option>O2</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option>All</option><option>Out</option><option>Available</option>
        </select>
        <select value={filterOverdue} onChange={e => setFilterOverdue(e.target.value)}>
          <option value="All">All Statuses</option>
          <option value="Warning">Warning Only</option>
          <option value="Critical">Critical Only</option>
        </select>
        <button className="btn-secondary" onClick={() => { setSearchQR(''); setSearchPhysical(''); setFilterGas('All'); setFilterStatus('All'); setFilterOverdue('All'); }}>Clear</button>
      </div>
      {loading ? <p>Loading...</p> : (
        <>
          <CylTable data={co2} title="🟡 CO2 Cylinders" />
          <CylTable data={o2} title="🔵 O2 Cylinders" />
        </>
      )}
    </div>
  );
}

// ─── RECORD MOVEMENT ───────────────────────────────────────────────────────────
function RecordMovementPage({ userId, userName, settings }) {
  const [step, setStep] = useState(1);
  const [type, setType] = useState('outward');
  const [customers, setCustomers] = useState([]);
  const [cylinders, setCylinders] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [quantity, setQuantity] = useState('');
  const [scannedCodes, setScannedCodes] = useState([]);
  const [manualInput, setManualInput] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    getDocs(collection(db, 'customers')).then(s => setCustomers(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    getDocs(collection(db, 'cylinders')).then(s => setCylinders(s.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  const addCode = (code) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    if (scannedCodes.includes(trimmed)) { setError(`QR ${trimmed} already added`); return; }
    const cyl = cylinders.find(c => c.qrCode === trimmed);
    if (!cyl) { setError(`QR ${trimmed} not found in system`); return; }
    if (scannedCodes.length >= parseInt(quantity)) { setError('Already reached the quantity limit'); return; }
    setScannedCodes(prev => [...prev, trimmed]);
    setManualInput('');
    setError('');
  };

  const removeCode = (code) => setScannedCodes(prev => prev.filter(c => c !== code));

  const saveMovement = async () => {
    if (scannedCodes.length !== parseInt(quantity)) return setError(`Please scan all ${quantity} cylinders`);
    const customer = customers.find(c => c.id === selectedCustomer);
    if (!customer) return setError('Please select a customer');

    const gasTypes = {};
    scannedCodes.forEach(qr => {
      const cyl = cylinders.find(c => c.qrCode === qr);
      if (cyl) gasTypes[qr] = cyl.gasType;
    });

    await addDoc(collection(db, 'movements'), {
      type,
      customerId: selectedCustomer,
      customerName: customer.name,
      driverId: userId,
      driverName: userName,
      qrCodes: scannedCodes,
      gasTypes,
      quantity: parseInt(quantity),
      createdAt: serverTimestamp(),
      timestamp: new Date().toISOString(), // captured for future investigations
    });

    setSuccess(true);
    setStep(1); setType('outward'); setSelectedCustomer(''); setQuantity(''); setScannedCodes([]);
  };

  if (success) return (
    <div className="section" style={{ textAlign: 'center', padding: '3rem' }}>
      <div style={{ fontSize: '4rem' }}>✅</div>
      <h2>Movement Saved!</h2>
      <p style={{ color: '#666', margin: '1rem 0' }}>{quantity} cylinders {type === 'outward' ? 'delivered to' : 'returned from'} {customers.find(c => c.id === selectedCustomer)?.name}</p>
      <button className="btn-primary" onClick={() => setSuccess(false)} style={{ margin: '0 auto' }}>Record Another</button>
    </div>
  );

  if (step === 1) return (
    <div className="section">
      <h2>Record Movement</h2>
      <div className="form">
        <div className="form-group">
          <label>Movement Type</label>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className={`type-btn ${type === 'outward' ? 'active-outward' : ''}`} onClick={() => setType('outward')}>🔴 OUTWARD (Delivery)</button>
            <button className={`type-btn ${type === 'inward' ? 'active-inward' : ''}`} onClick={() => setType('inward')}>🟢 INWARD (Return)</button>
          </div>
        </div>
        <div className="form-group">
          <label>Customer</label>
          <select value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)}>
            <option value="">Select Customer...</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Number of Cylinders</label>
          <input type="number" min="1" placeholder="Enter quantity..." value={quantity} onChange={e => setQuantity(e.target.value)} />
        </div>
        <button className="btn-primary" disabled={!selectedCustomer || !quantity || parseInt(quantity) < 1}
          onClick={() => { setStep(2); setScannedCodes([]); setError(''); }}>
          Continue →
        </button>
      </div>
    </div>
  );

  return (
    <div className="section">
      <button className="btn-back" onClick={() => setStep(1)}><ArrowLeft size={16} /> Back</button>
      <h2>{type === 'outward' ? '🔴 Outward Delivery' : '🟢 Inward Return'}</h2>
      <p style={{ color: '#666', marginBottom: '1rem' }}>Customer: <strong>{customers.find(c => c.id === selectedCustomer)?.name}</strong></p>

      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${(scannedCodes.length / parseInt(quantity)) * 100}%` }} />
        <span className="progress-text">{scannedCodes.length} / {quantity}</span>
      </div>

      {error && <p className="error" style={{ marginBottom: '1rem' }}>{error}</p>}

      <div className="scan-buttons" style={{ marginBottom: '1.5rem' }}>
        <button className="btn-secondary" onClick={() => setShowManual(!showManual)}>
          ✏️ Manual Entry
        </button>
      </div>

      {showManual && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input placeholder="Enter QR code..." value={manualInput} onChange={e => setManualInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCode(manualInput)} style={{ flex: 1, padding: '0.75rem', border: '1px solid #ddd', borderRadius: '6px' }} />
          <button className="btn-primary" onClick={() => addCode(manualInput)}>Add</button>
        </div>
      )}

      <div className="scanned-list">
        <h4>Cylinders ({scannedCodes.length}/{quantity})</h4>
        {Array.from({ length: parseInt(quantity) || 0 }, (_, i) => (
          <div key={i} className={`scanned-item ${scannedCodes[i] ? '' : 'pending'}`}>
            <span>{scannedCodes[i] ? `✅ ${scannedCodes[i]} — ${cylinders.find(c => c.qrCode === scannedCodes[i])?.gasType || ''} ${cylinders.find(c => c.qrCode === scannedCodes[i])?.size || ''}m³` : `⬜ ${i + 1}. Pending...`}</span>
            {scannedCodes[i] && <button className="btn-remove" onClick={() => removeCode(scannedCodes[i])}><X size={14} /></button>}
          </div>
        ))}
      </div>

      <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}
        disabled={scannedCodes.length !== parseInt(quantity)} onClick={saveMovement}>
        💾 Save Movement ({scannedCodes.length}/{quantity})
      </button>
    </div>
  );
}

// ─── MOVEMENT HISTORY ──────────────────────────────────────────────────────────
function MovementHistoryPage({ userRole, settings }) {
  const [movements, setMovements] = useState([]);
  const [filterType, setFilterType] = useState('All');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadMovements(); }, []);

  const loadMovements = async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, 'movements'));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
    setMovements(data);
    setLoading(false);
  };

  const filtered = movements.filter(m => {
    if (filterType !== 'All' && m.type !== filterType.toLowerCase()) return false;
    if (filterCustomer && !m.customerName?.toLowerCase().includes(filterCustomer.toLowerCase())) return false;
    if (dateFrom) { const d = m.createdAt?.toDate?.(); if (!d || d < new Date(dateFrom)) return false; }
    if (dateTo) { const d = m.createdAt?.toDate?.(); if (!d || d > new Date(dateTo + 'T23:59:59')) return false; }
    return true;
  });

  return (
    <div className="section">
      <h2>Movement History</h2>
      <div className="filter-bar">
        <select value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option>All</option><option>Outward</option><option>Inward</option>
        </select>
        <input className="search-input" placeholder="Customer name..." value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)} />
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        <button className="btn-secondary" onClick={() => { setFilterType('All'); setFilterCustomer(''); setDateFrom(''); setDateTo(''); }}>Clear</button>
      </div>
      {loading ? <p>Loading...</p> : (
        <table className="data-table">
          <thead><tr><th>Date & Time</th><th>Type</th><th>Customer</th><th>QR Codes</th><th>Driver</th></tr></thead>
          <tbody>
            {filtered.map(m => (
              <tr key={m.id}>
                <td>{formatDateTime(m.createdAt)}</td>
                <td><span className={`status-badge ${m.type}`}>{m.type === 'outward' ? '🔴 Outward' : '🟢 Inward'}</span></td>
                <td>{m.customerName}</td>
                <td>{(m.qrCodes || []).join(', ')}</td>
                <td>{m.driverName}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: '#999' }}>No movements found</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── DRIVER ANALYTICS ──────────────────────────────────────────────────────────
function DriverAnalyticsPage() {
  const [movements, setMovements] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [mSnap, uSnap] = await Promise.all([getDocs(collection(db, 'movements')), getDocs(collection(db, 'users'))]);
    setMovements(mSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setUsers(uSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.role === 'driver'));
    setLoading(false);
  };

  const getDriverStats = (driverId, driverName) => {
    const driverMovements = movements.filter(m => m.driverId === driverId || m.driverName === driverName);
    const deliveries = driverMovements.filter(m => m.type === 'outward');
    const returns = driverMovements.filter(m => m.type === 'inward');
    const totalCylinders = driverMovements.reduce((sum, m) => sum + (m.qrCodes?.length || 0), 0);

    // Customer frequency
    const customerCount = {};
    driverMovements.forEach(m => {
      if (m.customerName) customerCount[m.customerName] = (customerCount[m.customerName] || 0) + 1;
    });
    const topCustomers = Object.entries(customerCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return { deliveries: deliveries.length, returns: returns.length, totalCylinders, topCustomers, totalTrips: driverMovements.length };
  };

  if (selectedDriver) {
    const stats = getDriverStats(selectedDriver.id, selectedDriver.name);
    const driverMovements = movements.filter(m => m.driverId === selectedDriver.id || m.driverName === selectedDriver.name)
      .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));

    return (
      <div className="section">
        <button className="btn-back" onClick={() => setSelectedDriver(null)}><ArrowLeft size={16} /> Back to All Drivers</button>
        <h2>Driver: {selectedDriver.name}</h2>
        <p style={{ color: '#666', marginBottom: '1rem' }}>{selectedDriver.email}</p>
        <div className="summary-cards">
          <div className="summary-card" style={{ borderTop: '4px solid #e74c3c' }}><h4>Total Deliveries</h4><p className="big-number">{stats.deliveries}</p></div>
          <div className="summary-card" style={{ borderTop: '4px solid #27ae60' }}><h4>Total Returns</h4><p className="big-number">{stats.returns}</p></div>
          <div className="summary-card" style={{ borderTop: '4px solid #2980b9' }}><h4>Total Cylinders</h4><p className="big-number">{stats.totalCylinders}</p></div>
          <div className="summary-card" style={{ borderTop: '4px solid #8e44ad' }}><h4>Total Trips</h4><p className="big-number">{stats.totalTrips}</p></div>
        </div>

        <h3 style={{ margin: '1.5rem 0 0.75rem' }}>Top Customers Visited</h3>
        <table className="data-table">
          <thead><tr><th>Customer</th><th>Trips</th><th>% of Total</th></tr></thead>
          <tbody>
            {stats.topCustomers.map(([name, count]) => (
              <tr key={name}>
                <td>{name}</td>
                <td>{count}</td>
                <td>{stats.totalTrips ? Math.round((count / stats.totalTrips) * 100) : 0}%</td>
              </tr>
            ))}
            {stats.topCustomers.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', color: '#999' }}>No data</td></tr>}
          </tbody>
        </table>

        <h3 style={{ margin: '1.5rem 0 0.75rem' }}>Recent Activity</h3>
        <table className="data-table">
          <thead><tr><th>Date</th><th>Type</th><th>Customer</th><th>Cylinders</th></tr></thead>
          <tbody>
            {driverMovements.slice(0, 20).map(m => (
              <tr key={m.id}>
                <td>{formatDate(m.createdAt)}</td>
                <td><span className={`status-badge ${m.type}`}>{m.type === 'outward' ? '🔴 Outward' : '🟢 Inward'}</span></td>
                <td>{m.customerName}</td>
                <td>{m.qrCodes?.length || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const allStats = users.map(u => ({ ...u, ...getDriverStats(u.id, u.name) }))
    .sort((a, b) => b.totalTrips - a.totalTrips);

  return (
    <div className="section">
      <h2>Driver Analytics</h2>
      {loading ? <p>Loading...</p> : (
        <>
          <p style={{ color: '#666', marginBottom: '1rem' }}>Click a driver to see detailed activity and customer visits.</p>
          <table className="data-table">
            <thead>
              <tr><th>Driver</th><th>Deliveries</th><th>Returns</th><th>Total Cylinders</th><th>Total Trips</th><th>Top Customer</th></tr>
            </thead>
            <tbody>
              {allStats.map(d => (
                <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedDriver(d)}>
                  <td><strong>{d.name}</strong></td>
                  <td>{d.deliveries}</td>
                  <td>{d.returns}</td>
                  <td>{d.totalCylinders}</td>
                  <td>{d.totalTrips}</td>
                  <td>{d.topCustomers[0]?.[0] || '-'}</td>
                </tr>
              ))}
              {allStats.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#999' }}>No driver data</td></tr>}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

// ─── USER MANAGEMENT ───────────────────────────────────────────────────────────
function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'driver' });
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    const snap = await getDocs(collection(db, 'users'));
    setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const createUser = async () => {
    if (!form.email || !form.password || !form.name) return alert('All fields required');
    setLoading(true);
    try {
      const secondaryApp = initializeApp(firebaseConfig, 'secondary_' + Date.now());
      const secondaryAuth = getAuth(secondaryApp);
      const cred = await createUserWithEmailAndPassword(secondaryAuth, form.email, form.password);
      await setDoc(doc(db, 'users', cred.user.uid), { email: form.email, name: form.name, role: form.role, createdAt: serverTimestamp() });
      await signOut(secondaryAuth);
      setForm({ email: '', password: '', name: '', role: 'driver' });
      setShowForm(false);
      loadUsers();
    } catch (e) { alert('Error: ' + e.message); }
    setLoading(false);
  };

  const saveEdit = async () => {
    await updateDoc(doc(db, 'users', editUser.id), { name: form.name, role: form.role, email: form.email });
    setEditUser(null); setShowForm(false);
    loadUsers();
  };

  const deleteUser = async (u) => {
    if (!window.confirm(`Delete user ${u.name}?`)) return;
    await deleteDoc(doc(db, 'users', u.id));
    loadUsers();
  };

  return (
    <div className="section">
      <div className="section-header">
        <h2>User Management</h2>
        <button className="btn-primary" onClick={() => { setShowForm(true); setEditUser(null); setForm({ email: '', password: '', name: '', role: 'driver' }); }}>
          <Plus size={16} /> Create User
        </button>
      </div>

      {showForm && (
        <div className="form">
          <h3>{editUser ? 'Edit User' : 'Create New User'}</h3>
          <input placeholder="Full Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Email (e.g. driver1@cylinder.local)" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          {!editUser && <input type="password" placeholder="Password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />}
          <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
            <option value="driver">Driver</option>
            <option value="admin">Admin</option>
            <option value="superadmin">Super Admin</option>
          </select>
          {editUser && <p style={{ color: '#888', fontSize: '0.9rem' }}>Password can only be reset by the developer via Firebase Console.</p>}
          <div className="form-buttons">
            <button className="btn-primary" disabled={loading} onClick={editUser ? saveEdit : createUser}>{loading ? 'Saving...' : 'Save'}</button>
            <button className="btn-secondary" onClick={() => { setShowForm(false); setEditUser(null); }}>Cancel</button>
          </div>
        </div>
      )}

      <table className="data-table">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Actions</th></tr></thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.name}</td><td>{u.email}</td>
              <td><span className={`status-badge ${u.role}`}>{u.role}</span></td>
              <td>
                <button className="btn-icon" onClick={() => { setEditUser(u); setForm({ email: u.email, name: u.name, role: u.role, password: '' }); setShowForm(true); }}><Edit2 size={14} /></button>
                <button className="btn-icon danger" onClick={() => deleteUser(u)}><Trash2 size={14} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── APP SETTINGS ──────────────────────────────────────────────────────────────
function AppSettingsPage({ settings, setSettings }) {
  const [form, setForm] = useState({ ...settings });
  const [showConfirm, setShowConfirm] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    await setDoc(doc(db, 'appSettings', 'thresholds'), form);
    setSettings(form);
    setShowConfirm(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const Field = ({ label, field, suffix = 'days', min = 1 }) => (
    <div className="settings-field">
      <label>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input type="number" min={min} value={form[field]} onChange={e => setForm({ ...form, [field]: parseInt(e.target.value) || 0 })} style={{ width: '80px' }} />
        <span style={{ color: '#666' }}>{suffix}</span>
      </div>
    </div>
  );

  return (
    <div className="section">
      <h2>⚙️ App Settings</h2>
      <p style={{ color: '#666', marginBottom: '2rem' }}>These thresholds affect all analytics and alerts across the app.</p>

      <div className="settings-group">
        <h3>🔴 Overdue Thresholds</h3>
        <Field label="Warning threshold" field="overdueWarningDays" />
        <Field label="Critical threshold" field="overdueCriticalDays" />
      </div>

      <div className="settings-group">
        <h3>📊 Turnaround Time (TAT) Groups</h3>
        <Field label="Fast TAT (under X days)" field="tatFastDays" />
        <Field label="Medium TAT (X to Y days)" field="tatMediumDays" />
        <p style={{ color: '#888', fontSize: '0.85rem' }}>Slow TAT = anything above Medium threshold</p>
      </div>

      <div className="settings-group">
        <h3>⚙️ Cylinder Usage Groups</h3>
        <Field label="High usage (more than X trips in 90 days)" field="usageHighTrips" suffix="trips" />
        <Field label="Medium usage (X to Y trips in 90 days)" field="usageMediumTrips" suffix="trips" />
        <p style={{ color: '#888', fontSize: '0.85rem' }}>Low usage = anything below Medium threshold</p>
      </div>

      <div className="settings-group">
        <h3>✏️ Edit Windows</h3>
        <Field label="Driver can edit movement for" field="driverEditHours" suffix="hours" />
        <Field label="Admin can edit movement for" field="adminEditHours" suffix="hours" />
      </div>

      {saved && <p style={{ color: '#27ae60', fontWeight: 'bold', marginBottom: '1rem' }}>✅ Settings saved successfully!</p>}

      <button className="btn-primary" onClick={() => setShowConfirm(true)}>Save Settings</button>

      {showConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>⚠️ Confirm Settings Change</h3>
            <p>These changes will apply immediately across all analytics and alerts in the app. Are you sure?</p>
            <div className="form-buttons" style={{ marginTop: '1rem' }}>
              <button className="btn-primary" onClick={handleSave}>Yes, Save</button>
              <button className="btn-secondary" onClick={() => setShowConfirm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
