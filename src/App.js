import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { Package, Users, BarChart3, LogOut, Camera, ArrowRight, ArrowLeft, Plus, Download, Trash2, Edit2, Save, X } from 'lucide-react';
import './App.css';

// Firebase configuration - YOU NEED TO REPLACE THIS
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Data states
  const [customers, setCustomers] = useState([]);
  const [cylinders, setCylinders] = useState([]);
  const [movements, setMovements] = useState([]);
  const [users, setUsers] = useState([]);

  // Form states
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showCylinderForm, setShowCylinderForm] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [showMovementForm, setShowMovementForm] = useState(false);
  
  const [customerForm, setCustomerForm] = useState({ name: '', contact: '', address: '' });
  const [cylinderForm, setCylinderForm] = useState({ qrCode: '', physicalId: '', size: '5m³', gasType: 'CO2' });
  const [movementForm, setMovementForm] = useState({ type: 'outward', customerId: '', qrCodes: [''] });

  // QR Generation
  const [qrGenerateCount, setQrGenerateCount] = useState(10);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Get user role from Firestore
        const userDoc = await getDocs(query(collection(db, 'users'), where('email', '==', currentUser.email)));
        if (!userDoc.empty) {
          setUser({ ...currentUser, role: userDoc.docs[0].data().role });
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
      await addDoc(collection(db, 'customers'), customerForm);
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
    // Check if QR code already exists
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
          alert(`QR Code ${qrCode} not found`);
          return;
        }

        if (movementForm.type === 'outward' && cylinder.status === 'out') {
          alert(`Cylinder ${qrCode} is already out`);
          return;
        }

        if (movementForm.type === 'inward' && cylinder.status === 'available') {
          alert(`Cylinder ${qrCode} is already available`);
          return;
        }
      }

      // Add movement record
      await addDoc(collection(db, 'movements'), {
        type: movementForm.type,
        customerId: movementForm.customerId,
        qrCodes: validQRCodes,
        driverEmail: user.email,
        timestamp: Timestamp.now(),
        editable: true
      });

      // Update cylinder statuses
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
      alert('Movement recorded successfully!');
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

    // Generate PDF (simplified - in production use jsPDF or similar)
    const content = codes.map(code => `QR Code: ${code}`).join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QR_Codes_${codes[0]}-${codes[codes.length-1]}.txt`;
    a.click();
    
    alert(`Generated QR codes: ${codes[0]} to ${codes[codes.length-1]}`);
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
              placeholder="Email"
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
          <span>{user.email} ({user.role})</span>
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
            <button 
              className={activeTab === 'analytics' ? 'active' : ''}
              onClick={() => setActiveTab('analytics')}
            >
              <BarChart3 size={20} /> Analytics
            </button>
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
                    <option value="outward">Outward (Delivery)</option>
                    <option value="inward">Inward (Return)</option>
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
                  <label>QR Codes (Enter or Scan)</label>
                  {movementForm.qrCodes.map((qr, idx) => (
                    <input
                      key={idx}
                      type="text"
                      placeholder={`QR Code ${idx + 1}`}
                      value={qr}
                      onChange={(e) => {
                        const newQRs = [...movementForm.qrCodes];
                        newQRs[idx] = e.target.value;
                        setMovementForm({...movementForm, qrCodes: newQRs});
                      }}
                    />
                  ))}
                  <button 
                    onClick={() => setMovementForm({...movementForm, qrCodes: [...movementForm.qrCodes, '']})}
                    className="btn-secondary"
                  >
                    <Plus size={16} /> Add Another QR Code
                  </button>
                </div>

                <button onClick={addMovement} className="btn-primary">
                  <Save size={20} /> Save Movement
                </button>
              </div>
            </div>
          )}

          {activeTab === 'customers' && (user.role === 'admin' || user.role === 'superadmin') && (
            <div className="section">
              <div className="section-header">
                <h2>Customers</h2>
                <button onClick={() => setShowCustomerForm(true)} className="btn-primary">
                  <Plus size={20} /> Add Customer
                </button>
              </div>

              {showCustomerForm && (
                <div className="form">
                  <h3>New Customer</h3>
                  <input
                    type="text"
                    placeholder="Name"
                    value={customerForm.name}
                    onChange={(e) => setCustomerForm({...customerForm, name: e.target.value})}
                  />
                  <input
                    type="text"
                    placeholder="Contact"
                    value={customerForm.contact}
                    onChange={(e) => setCustomerForm({...customerForm, contact: e.target.value})}
                  />
                  <textarea
                    placeholder="Address"
                    value={customerForm.address}
                    onChange={(e) => setCustomerForm({...customerForm, address: e.target.value})}
                  />
                  <div className="form-buttons">
                    <button onClick={addCustomer} className="btn-primary">Save</button>
                    <button onClick={() => setShowCustomerForm(false)} className="btn-secondary">Cancel</button>
                  </div>
                </div>
              )}

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Contact</th>
                    <th>Address</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(customer => (
                    <tr key={customer.id}>
                      <td>{customer.name}</td>
                      <td>{customer.contact}</td>
                      <td>{customer.address}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'cylinders' && (user.role === 'admin' || user.role === 'superadmin') && (
            <div className="section">
              <div className="section-header">
                <h2>Cylinders</h2>
                <div>
                  <button onClick={() => setShowCylinderForm(true)} className="btn-primary">
                    <Plus size={20} /> Add Cylinder
                  </button>
                  <button onClick={generateQRCodes} className="btn-secondary" style={{marginLeft: '10px'}}>
                    <Download size={20} /> Generate QR Codes
                  </button>
                </div>
              </div>

              {showCylinderForm && (
                <div className="form">
                  <h3>New Cylinder</h3>
                  <input
                    type="text"
                    placeholder="QR Code (e.g., 001)"
                    value={cylinderForm.qrCode}
                    onChange={(e) => setCylinderForm({...cylinderForm, qrCode: e.target.value})}
                  />
                  <input
                    type="text"
                    placeholder="Physical Cylinder ID"
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
                    <button onClick={addCylinder} className="btn-primary">Save</button>
                    <button onClick={() => setShowCylinderForm(false)} className="btn-secondary">Cancel</button>
                  </div>
                </div>
              )}

              <div style={{marginBottom: '20px'}}>
                <label>Generate QR Codes: </label>
                <input 
                  type="number" 
                  value={qrGenerateCount}
                  onChange={(e) => setQrGenerateCount(parseInt(e.target.value))}
                  style={{width: '100px', marginLeft: '10px'}}
                />
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>QR Code</th>
                    <th>Physical ID</th>
                    <th>Size</th>
                    <th>Gas Type</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {cylinders.map(cylinder => (
                    <tr key={cylinder.id}>
                      <td>{cylinder.qrCode}</td>
                      <td>{cylinder.physicalId}</td>
                      <td>{cylinder.size}</td>
                      <td>{cylinder.gasType}</td>
                      <td>
                        <span className={`status-badge ${cylinder.status}`}>
                          {cylinder.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'analytics' && user.role === 'superadmin' && (
            <div className="section">
              <h2>Analytics</h2>
              <p>Analytics features coming soon...</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
