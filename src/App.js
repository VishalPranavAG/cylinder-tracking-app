import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, orderBy, Timestamp, setDoc } from 'firebase/firestore';
import { Package, Users, BarChart3, LogOut, Camera, ArrowRight, Plus, Download, Trash2, Edit2, Save, X, UserPlus } from 'lucide-react';
import './App.css';

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

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [customers, setCustomers] = useState([]);
  const [cylinders, setCylinders] = useState([]);
  const [movements, setMovements] = useState([]);
  const [users, setUsers] = useState([]);

  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showCylinderForm, setShowCylinderForm] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [showMovementForm, setShowMovementForm] = useState(false);
  
  const [customerForm, setCustomerForm] = useState({ name: '', contact: '', address: '' });
  const [cylinderForm, setCylinderForm] = useState({ qrCode: '', physicalId: '', size: '5m³', gasType: 'CO2' });
  const [movementForm, setMovementForm] = useState({ type: 'outward', customerId: '', qrCodes: [''] });
  const [userForm, setUserForm] = useState({ email: '', password: '', role: 'driver', name: '' });

  const [qrGenerateCount, setQrGenerateCount] = useState(10);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userDoc = await getDocs(query(collection(db, 'users'), where('email', '==', currentUser.email)));
        if (!userDoc.empty) {
          setUser({ ...currentUser, role: userDoc.docs[0].data().role, displayName: userDoc.docs[0].data().name });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const customersSnap = await getDocs(collection(db, 'customers'));
      setCustomers(customersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const cylindersSnap = await getDocs(collection(db, 'cylinders'));
      setCylinders(cylindersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const movementsSnap = await getDocs(query(collection(db, 'movements'), orderBy('timestamp', 'desc')));
      setMovements(movementsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      if (user.role === 'admin' || user.role === 'superadmin') {
        const usersSnap = await getDocs(collection(db, 'users'));
        setUsers(usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setLoginError('Invalid email or password');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
  };

  const addCustomer = async () => {
    if (!customerForm.name) {
      alert('Please enter customer name');
      return;
    }
    try {
      await addDoc(collection(db, 'customers'), {
        ...customerForm,
        createdAt: Timestamp.now()
      });
      setCustomerForm({ name: '', contact: '', address: '' });
      setShowCustomerForm(false);
      fetchData();
      alert('Customer added successfully!');
    } catch (error) {
      alert('Error adding customer: ' + error.message);
    }
  };

  const addCylinder = async () => {
    if (!cylinderForm.qrCode || !cylinderForm.physicalId) {
      alert('Please fill all required fields');
      return;
    }
    const existing = cylinders.find(c => c.qrCode === cylinderForm.qrCode);
    if (existing && user.role !== 'superadmin') {
      alert('QR code already exists. Only Super Admin can regenerate.');
      return;
    }
    try {
      await addDoc(collection(db, 'cylinders'), {
        ...cylinderForm,
        status: 'available',
        createdAt: Timestamp.now()
      });
      setCylinderForm({ qrCode: '', physicalId: '', size: '5m³', gasType: 'CO2' });
      setShowCylinderForm(false);
      fetchData();
      alert('Cylinder added successfully!');
    } catch (error) {
      alert('Error adding cylinder: ' + error.message);
    }
  };

  const addUser = async () => {
    if (!userForm.email || !userForm.password || !userForm.name) {
      alert('Please fill all required fields');
      return;
    }
    
    if (!userForm.email.includes('@')) {
      alert('Email must contain @');
      return;
    }

    try {
      // Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, userForm.email, userForm.password);
      
      // Add user details to Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        email: userForm.email,
        role: userForm.role,
        name: userForm.name,
        createdAt: Timestamp.now()
      });

      setUserForm({ email: '', password: '', role: 'driver', name: '' });
      setShowUserForm(false);
      fetchData();
      alert('User created successfully!');
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        alert('This email is already registered');
      } else if (error.code === 'auth/weak-password') {
        alert('Password should be at least 6 characters');
      } else {
        alert('Error creating user: ' + error.message);
      }
    }
  };

  const deleteUser = async (userId, userEmail) => {
    if (userEmail === user.email) {
      alert('You cannot delete yourself!');
      return;
    }
    
    if (!window.confirm(`Are you sure you want to delete user: ${userEmail}?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', userId));
      fetchData();
      alert('User deleted successfully! Note: User can still login with their credentials until you delete them from Authentication panel.');
    } catch (error) {
      alert('Error deleting user: ' + error.message);
    }
  };

  const addMovement = async () => {
    if (!movementForm.customerId || movementForm.qrCodes.filter(q => q).length === 0) {
      alert('Please select customer and scan at least one QR code');
      return;
    }

    try {
      const validQRCodes = movementForm.qrCodes.filter(q => q.trim() !== '');
      
      for (const qrCode of validQRCodes) {
        const cylinder = cylinders.find(c => c.qrCode === qrCode);
        if (!cylinder) {
          alert(`QR Code ${qrCode} not found in system`);
          return;
        }

        if (movementForm.type === 'outward' && cylinder.status === 'out') {
          alert(`Cylinder ${qrCode} is already out with a customer`);
          return;
        }

        if (movementForm.type === 'inward' && cylinder.status === 'available') {
          alert(`Cylinder ${qrCode} is already available (not out)`);
          return;
        }
      }

      await addDoc(collection(db, 'movements'), {
        type: movementForm.type,
        customerId: movementForm.customerId,
        customerName: customers.find(c => c.id === movementForm.customerId)?.name,
        qrCodes: validQRCodes,
        driverEmail: user.email,
        driverName: user.displayName,
        timestamp: Timestamp.now(),
        editable: true
      });

      for (const qrCode of validQRCodes) {
        const cylinder = cylinders.find(c => c.qrCode === qrCode);
        await updateDoc(doc(db, 'cylinders', cylinder.id), {
          status: movementForm.type === 'outward' ? 'out' : 'available',
          customerId: movementForm.type === 'outward' ? movementForm.customerId : null,
          lastMovement: Timestamp.now()
        });
      }

      setMovementForm({ type: 'outward', customerId: '', qrCodes: [''] });
      setShowMovementForm(false);
      fetchData();
      alert(`${movementForm.type === 'outward' ? 'Delivery' : 'Return'} recorded successfully!`);
    } catch (error) {
      alert('Error recording movement: ' + error.message);
    }
  };

  const generateQRCodes = () => {
    const lastQR = cylinders.length > 0 
      ? Math.max(...cylinders.map(c => parseInt(c.qrCode) || 0))
      : 0;
    
    const codes = [];
    for (let i = 1; i <= qrGenerateCount; i++) {
      const num = (lastQR + i).toString().padStart(3, '0');
      codes.push(num);
    }

    const content = codes.map(code => `
━━━━━━━━━━━━━━━━━━━━━━
   QR CODE: ${code}
━━━━━━━━━━━━━━━━━━━━━━

(Scan or enter manually)

`).join('\n\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QR_Codes_${codes[0]}_to_${codes[codes.length-1]}.txt`;
    a.click();
    
    alert(`Generated ${qrGenerateCount} QR codes: ${codes[0]} to ${codes[codes.length-1]}\n\nDownload the file and send to your tag creator.`);
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h1>Cylinder Tracking System</h1>
          <form onSubmit={handleLogin}>
            <input
              type="email"
              placeholder="Email (e.g., admin@cylinder.local)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {loginError && <p className="error">{loginError}</p>}
            <button type="submit">Login</button>
          </form>
        </div>
      </div>
    );
  }

  const canEdit = (movement) => {
    const hours = user.role === 'driver' ? 24 : 48;
    const createdAt = movement.timestamp?.toDate();
    if (!createdAt) return false;
    const hoursPassed = (new Date() - createdAt) / (1000 * 60 * 60);
    return hoursPassed <= hours;
  };

  return (
    <div className="app">
      <nav className="navbar">
        <h1>Cylinder Tracking</h1>
        <div className="nav-right">
          <span>{user.displayName || user.email} ({user.role})</span>
          <button onClick={handleLogout} className="logout-btn">
            <LogOut size={20} /> Logout
          </button>
        </div>
      </nav>

      <div className="main-container">
        <aside className="sidebar">
          <button 
            className={activeTab === 'dashboard' ? 'active' : ''}
            onClick={() => setActiveTab('dashboard')}
          >
            <BarChart3 size={20} /> Dashboard
          </button>

          {user.role === 'driver' && (
            <button 
              className={activeTab === 'movement' ? 'active' : ''}
              onClick={() => setActiveTab('movement')}
            >
              <Camera size={20} /> Record Movement
            </button>
          )}

          {(user.role === 'admin' || user.role === 'superadmin') && (
            <>
              <button 
                className={activeTab === 'customers' ? 'active' : ''}
                onClick={() => setActiveTab('customers')}
              >
                <Users size={20} /> Customers
              </button>
              <button 
                className={activeTab === 'cylinders' ? 'active' : ''}
                onClick={() => setActiveTab('cylinders')}
              >
                <Package size={20} /> Cylinders
              </button>
              <button 
                className={activeTab === 'movements' ? 'active' : ''}
                onClick={() => setActiveTab('movements')}
              >
                <ArrowRight size={20} /> All Movements
              </button>
            </>
          )}

          {user.role === 'superadmin' && (
            <>
              <button 
                className={activeTab === 'users' ? 'active' : ''}
                onClick={() => setActiveTab('users')}
              >
                <UserPlus size={20} /> User Management
              </button>
              <button 
                className={activeTab === 'analytics' ? 'active' : ''}
                onClick={() => setActiveTab('analytics')}
              >
                <BarChart3 size={20} /> Analytics
              </button>
            </>
          )}
        </aside>

        <main className="content">
          {activeTab === 'dashboard' && (
            <div className="dashboard">
              <h2>Dashboard</h2>
              <div className="stats">
                <div className="stat-card">
                  <h3>Total Cylinders</h3>
                  <p className="stat-number">{cylinders.length}</p>
                </div>
                <div className="stat-card">
                  <h3>Out with Customers</h3>
                  <p className="stat-number">{cylinders.filter(c => c.status === 'out').length}</p>
                </div>
                <div className="stat-card">
                  <h3>Available</h3>
                  <p className="stat-number">{cylinders.filter(c => c.status === 'available').length}</p>
                </div>
                <div className="stat-card">
                  <h3>Total Customers</h3>
                  <p className="stat-number">{customers.length}</p>
                </div>
              </div>

              {user.role === 'driver' && (
                <div style={{marginTop: '2rem'}}>
                  <h3>Quick Actions</h3>
                  <button 
                    onClick={() => setActiveTab('movement')} 
                    className="btn-primary"
                    style={{marginTop: '1rem'}}
                  >
                    <Camera size={20} /> Record New Movement
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'movement' && user.role === 'driver' && (
            <div className="section">
              <h2>Record Movement</h2>
              <div className="form">
                <div className="form-group">
                  <label>Type</label>
                  <select 
                    value={movementForm.type}
                    onChange={(e) => setMovementForm({...movementForm, type: e.target.value})}
                  >
                    <option value="outward">OUTWARD (Delivery to Customer)</option>
                    <option value="inward">INWARD (Return from Customer)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Customer</label>
                  <select 
                    value={movementForm.customerId}
                    onChange={(e) => setMovementForm({...movementForm, customerId: e.target.value})}
                  >
                    <option value="">Select Customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>QR Codes (Scan or Enter Manually)</label>
                  {movementForm.qrCodes.map((qr, idx) => (
                    <div key={idx} style={{display: 'flex', gap: '10px', marginBottom: '10px'}}>
                      <input
                        type="text"
                        placeholder={`QR Code ${idx + 1} (e.g., 001)`}
                        value={qr}
                        onChange={(e) => {
                          const newQRs = [...movementForm.qrCodes];
                          newQRs[idx] = e.target.value;
                          setMovementForm({...movementForm, qrCodes: newQRs});
                        }}
                        style={{flex: 1}}
                      />
                      {movementForm.qrCodes.length > 1 && (
                        <button 
                          type="button"
                          onClick={() => {
                            const newQRs = movementForm.qrCodes.filter((_, i) => i !== idx);
                            setMovementForm({...movementForm, qrCodes: newQRs});
                          }}
                          className="btn-secondary"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button 
                    type="button"
                    onClick={() => setMovementForm({...movementForm, qrCodes: [...movementForm.qrCodes, '']})}
                    className="btn-secondary"
                  >
                    <Plus size={16} /> Add Another Cylinder
                  </button>
                </div>

                <div style={{marginTop: '1.5rem', display: 'flex', gap: '1rem'}}>
                  <button onClick={addMovement} className="btn-primary">
                    <Save size={20} /> Save {movementForm.type === 'outward' ? 'Delivery' : 'Return'}
                  </button>
                  <button 
                    onClick={() => setMovementForm({ type: 'outward', customerId: '', qrCodes: [''] })} 
                    className="btn-secondary"
                  >
                    <X size={20} /> Clear
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'customers' && (user.role === 'admin' || user.role === 'superadmin') && (
            <div className="section">
              <div className="section-header">
                <h2>Customers</h2>
                <button onClick={() => setShowCustomerForm(!showCustomerForm)} className="btn-primary">
                  <Plus size={20} /> Add Customer
                </button>
              </div>

              {showCustomerForm && (
                <div className="form">
                  <h3>New Customer</h3>
                  <input
                    type="text"
                    placeholder="Customer Name"
                    value={customerForm.name}
                    onChange={(e) => setCustomerForm({...customerForm, name: e.target.value})}
                  />
                  <input
                    type="text"
                    placeholder="Contact Number"
                    value={customerForm.contact}
                    onChange={(e) => setCustomerForm({...customerForm, contact: e.target.value})}
                  />
                  <textarea
                    placeholder="Address"
                    value={customerForm.address}
                    onChange={(e) => setCustomerForm({...customerForm, address: e.target.value})}
                  />
                  <div className="form-buttons">
                    <button onClick={addCustomer} className="btn-primary"><Save size={20} /> Save</button>
                    <button onClick={() => setShowCustomerForm(false)} className="btn-secondary"><X size={20} /> Cancel</button>
                  </div>
                </div>
              )}

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Contact</th>
                    <th>Address</th>
                    <th>Cylinders Out</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(customer => (
                    <tr key={customer.id}>
                      <td>{customer.name}</td>
                      <td>{customer.contact}</td>
                      <td>{customer.address}</td>
                      <td>{cylinders.filter(c => c.customerId === customer.id).length}</td>
                    </tr>
                  ))}
                  {customers.length === 0 && (
                    <tr>
                      <td colSpan="4" style={{textAlign: 'center', padding: '2rem', color: '#999'}}>
                        No customers yet. Click "Add Customer" to create one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'cylinders' && (user.role === 'admin' || user.role === 'superadmin') && (
            <div className="section">
              <div className="section-header">
                <h2>Cylinders</h2>
                <div>
                  <button onClick={() => setShowCylinderForm(!showCylinderForm)} className="btn-primary">
                    <Plus size={20} /> Add Cylinder
                  </button>
                </div>
              </div>

              {showCylinderForm && (
                <div className="form">
                  <h3>New Cylinder</h3>
                  <input
                    type="text"
                    placeholder="QR Code (e.g., 001, 002, 003)"
                    value={cylinderForm.qrCode}
                    onChange={(e) => setCylinderForm({...cylinderForm, qrCode: e.target.value})}
                  />
                  <input
                    type="text"
                    placeholder="Physical Cylinder ID (e.g., 553)"
                    value={cylinderForm.physicalId}
                    onChange={(e) => setCylinderForm({...cylinderForm, physicalId: e.target.value})}
                  />
                  <select
                    value={cylinderForm.size}
                    onChange={(e) => setCylinderForm({...cylinderForm, size: e.target.value})}
                  >
                    <option value="5m³">5m³</option>
                    <option value="10m³">10m³</option>
                    <option value="15m³">15m³</option>
                    <option value="20m³">20m³</option>
                  </select>
                  <select
                    value={cylinderForm.gasType}
                    onChange={(e) => setCylinderForm({...cylinderForm, gasType: e.target.value})}
                  >
                    <option value="CO2">CO2</option>
                    <option value="O2">O2</option>
                  </select>
                  <div className="form-buttons">
                    <button onClick={addCylinder} className="btn-primary"><Save size={20} /> Save</button>
                    <button onClick={() => setShowCylinderForm(false)} className="btn-secondary"><X size={20} /> Cancel</button>
                  </div>
                </div>
              )}

              <div style={{background: '#f8f9fa', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem'}}>
                <h3 style={{marginBottom: '1rem'}}>Bulk QR Code Generation</h3>
                <div style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>
                  <label>Generate:</label>
                  <input 
                    type="number" 
                    value={qrGenerateCount}
                    onChange={(e) => setQrGenerateCount(parseInt(e.target.value) || 1)}
                    style={{width: '100px'}}
                    min="1"
                    max="100"
                  />
                  <span>QR codes</span>
                  <button onClick={generateQRCodes} className="btn-primary">
                    <Download size={20} /> Generate & Download
                  </button>
                </div>
                <p style={{fontSize: '0.9rem', color: '#666', marginTop: '0.5rem'}}>
                  Next available: <strong>{cylinders.length > 0 ? (Math.max(...cylinders.map(c => parseInt(c.qrCode) || 0)) + 1).toString().padStart(3, '0') : '001'}</strong>
                </p>
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>QR Code</th>
                    <th>Physical ID</th>
                    <th>Size</th>
                    <th>Gas Type</th>
                    <th>Status</th>
                    <th>Current Customer</th>
                  </tr>
                </thead>
                <tbody>
                  {cylinders.map(cylinder => {
                    const customer = customers.find(c => c.id === cylinder.customerId);
                    return (
                      <tr key={cylinder.id}>
                        <td><strong>{cylinder.qrCode}</strong></td>
                        <td>{cylinder.physicalId}</td>
                        <td>{cylinder.size}</td>
                        <td>{cylinder.gasType}</td>
                        <td>
                          <span className={`status-badge ${cylinder.status}`}>
                            {cylinder.status}
                          </span>
                        </td>
                        <td>{customer ? customer.name : '-'}</td>
                      </tr>
                    );
                  })}
                  {cylinders.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{textAlign: 'center', padding: '2rem', color: '#999'}}>
                        No cylinders yet. Add cylinders or generate QR codes.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'movements' && (user.role === 'admin' || user.role === 'superadmin') && (
            <div className="section">
              <h2>All Movements</h2>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Type</th>
                    <th>Customer</th>
                    <th>QR Codes</th>
                    <th>Driver</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map(movement => (
                    <tr key={movement.id}>
                      <td>{movement.timestamp?.toDate().toLocaleString()}</td>
                      <td>
                        <span className={`status-badge ${movement.type}`}>
                          {movement.type.toUpperCase()}
                        </span>
                      </td>
                      <td>{movement.customerName}</td>
                      <td>{movement.qrCodes?.join(', ')}</td>
                      <td>{movement.driverName || movement.driverEmail}</td>
                    </tr>
                  ))}
                  {movements.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{textAlign: 'center', padding: '2rem', color: '#999'}}>
                        No movements recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'users' && user.role === 'superadmin' && (
            <div className="section">
              <div className="section-header">
                <h2>User Management</h2>
                <button onClick={() => setShowUserForm(!showUserForm)} className="btn-primary">
                  <UserPlus size={20} /> Create New User
                </button>
              </div>

              {showUserForm && (
                <div className="form">
                  <h3>Create New User</h3>
                  <input
                    type="email"
                    placeholder="Email (e.g., driver2@cylinder.local)"
                    value={userForm.email}
                    onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                  />
                  <input
                    type="password"
                    placeholder="Password (min 6 characters)"
                    value={userForm.password}
                    onChange={(e) => setUserForm({...userForm, password: e.target.value})}
                  />
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={userForm.name}
                    onChange={(e) => setUserForm({...userForm, name: e.target.value})}
                  />
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({...userForm, role: e.target.value})}
                  >
                    <option value="driver">Driver</option>
                    <option value="admin">Admin</option>
                    <option value="superadmin">Super Admin</option>
                  </select>
                  <div className="form-buttons">
                    <button onClick={addUser} className="btn-primary"><UserPlus size={20} /> Create User</button>
                    <button onClick={() => setShowUserForm(false)} className="btn-secondary"><X size={20} /> Cancel</button>
                  </div>
                </div>
              )}

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`status-badge ${u.role}`}>
                          {u.role}
                        </span>
                      </td>
                      <td>{u.createdAt?.toDate().toLocaleDateString()}</td>
                      <td>
                        {u.email !== user.email && (
                          <button 
                            onClick={() => deleteUser(u.id, u.email)}
                            className="btn-secondary"
                            style={{padding: '0.5rem'}}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{textAlign: 'center', padding: '2rem', color: '#999'}}>
                        No users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'analytics' && user.role === 'superadmin' && (
            <div className="section">
              <h2>Analytics</h2>
              <p style={{color: '#666'}}>Advanced analytics features coming in next phase...</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
