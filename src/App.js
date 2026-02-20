import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword, updateEmail } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, orderBy, Timestamp, setDoc } from 'firebase/firestore';
import { Package, Users, BarChart3, LogOut, Camera, ArrowRight, Plus, Download, Trash2, Edit2, Save, X, UserPlus, Upload, FileText, Eye, EyeOff } from 'lucide-react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
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
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const [customers, setCustomers] = useState([]);
  const [cylinders, setCylinders] = useState([]);
  const [movements, setMovements] = useState([]);
  const [users, setUsers] = useState([]);

  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showCylinderForm, setShowCylinderForm] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  
  const [customerForm, setCustomerForm] = useState({ name: '', contact: '', address: '', gstNumber: '' });
  const [cylinderForm, setCylinderForm] = useState({ qrCode: '', physicalId: '', size: '5m³', gasType: 'CO2', useAutoQR: true });
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

  useEffect(() => {
    if (cylinderForm.useAutoQR) {
      const nextQR = getNextAvailableQR();
      setCylinderForm(prev => ({ ...prev, qrCode: nextQR }));
    }
  }, [cylinderForm.useAutoQR, cylinders]);

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

  const getNextAvailableQR = () => {
    if (cylinders.length === 0) return '001';
    const maxQR = Math.max(...cylinders.map(c => parseInt(c.qrCode) || 0));
    return (maxQR + 1).toString().padStart(3, '0');
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

  const downloadExcelTemplate = () => {
    const csvContent = "Customer Name,Contact,Address,GST Number\nABC Industries,9876543210,123 Main Street,29ABCDE1234F1Z5\nXYZ Corp,8765432109,456 Park Avenue,N/A\n";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customer_import_template.csv';
    a.click();
  };

  const handleExcelImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const rows = text.split('\n').filter(row => row.trim());
        const headers = rows[0].split(',');
        
        let imported = 0;
        let skipped = 0;

        for (let i = 1; i < rows.length; i++) {
          const values = rows[i].split(',');
          const customerName = values[0]?.trim();
          
          if (!customerName) continue;

          const exists = customers.some(c => c.name.toLowerCase() === customerName.toLowerCase());
          if (exists) {
            skipped++;
            continue;
          }

          await addDoc(collection(db, 'customers'), {
            name: customerName,
            contact: values[1]?.trim() || '',
            address: values[2]?.trim() || '',
            gstNumber: values[3]?.trim() || 'N/A',
            createdAt: Timestamp.now()
          });
          imported++;
        }

        fetchData();
        alert(`Import complete!\nImported: ${imported}\nSkipped (duplicates): ${skipped}`);
      } catch (error) {
        alert('Error importing file: ' + error.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const addCustomer = async () => {
    if (!customerForm.name) {
      alert('Customer name is required');
      return;
    }
    try {
      if (editingCustomer) {
        await updateDoc(doc(db, 'customers', editingCustomer.id), {
          name: customerForm.name,
          contact: customerForm.contact,
          address: customerForm.address,
          gstNumber: customerForm.gstNumber || 'N/A',
          updatedAt: Timestamp.now()
        });
        alert('Customer updated successfully!');
      } else {
        await addDoc(collection(db, 'customers'), {
          ...customerForm,
          gstNumber: customerForm.gstNumber || 'N/A',
          createdAt: Timestamp.now()
        });
        alert('Customer added successfully!');
      }
      setCustomerForm({ name: '', contact: '', address: '', gstNumber: '' });
      setShowCustomerForm(false);
      setEditingCustomer(null);
      fetchData();
    } catch (error) {
      alert('Error saving customer: ' + error.message);
    }
  };

  const editCustomer = (customer) => {
    setCustomerForm({
      name: customer.name,
      contact: customer.contact || '',
      address: customer.address || '',
      gstNumber: customer.gstNumber || ''
    });
    setEditingCustomer(customer);
    setShowCustomerForm(true);
  };

  const deleteCustomer = async (customerId, customerName) => {
    const cylindersOut = cylinders.filter(c => c.customerId === customerId && c.status === 'out');
    
    if (cylindersOut.length > 0) {
      const confirm = window.confirm(
        `WARNING: ${customerName} currently has ${cylindersOut.length} cylinder(s) out.\n\n` +
        `Cylinders: ${cylindersOut.map(c => c.qrCode).join(', ')}\n\n` +
        `Are you sure you want to delete this customer?`
      );
      if (!confirm) return;
    } else {
      if (!window.confirm(`Delete customer: ${customerName}?`)) return;
    }

    try {
      await deleteDoc(doc(db, 'customers', customerId));
      fetchData();
      alert('Customer deleted successfully!');
    } catch (error) {
      alert('Error deleting customer: ' + error.message);
    }
  };

  const addCylinder = async () => {
    if (!cylinderForm.qrCode || !cylinderForm.physicalId) {
      alert('QR Code and Physical ID are required');
      return;
    }
    const existing = cylinders.find(c => c.qrCode === cylinderForm.qrCode);
    if (existing && user.role !== 'superadmin') {
      alert('QR code already exists. Only Super Admin can regenerate.');
      return;
    }
    try {
      await addDoc(collection(db, 'cylinders'), {
        qrCode: cylinderForm.qrCode,
        physicalId: cylinderForm.physicalId,
        size: cylinderForm.size,
        gasType: cylinderForm.gasType,
        status: 'available',
        createdAt: Timestamp.now()
      });
      setCylinderForm({ qrCode: '', physicalId: '', size: '5m³', gasType: 'CO2', useAutoQR: true });
      setShowCylinderForm(false);
      fetchData();
      alert('Cylinder added successfully!');
    } catch (error) {
      alert('Error adding cylinder: ' + error.message);
    }
  };

  const addUser = async () => {
    if (!userForm.email || !userForm.password || !userForm.name) {
      alert('All fields are required');
      return;
    }
    try {
      if (editingUser) {
        // Update existing user
        await updateDoc(doc(db, 'users', editingUser.id), {
          email: userForm.email,
          role: userForm.role,
          name: userForm.name,
          updatedAt: Timestamp.now()
        });
        alert('User updated successfully!\n\nNote: Email change will take effect on next login. Password cannot be changed here - contact developer.');
        setEditingUser(null);
      } else {
        // Create new user
        const userCredential = await createUserWithEmailAndPassword(auth, userForm.email, userForm.password);
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          email: userForm.email,
          role: userForm.role,
          name: userForm.name,
          createdAt: Timestamp.now()
        });
        alert('User created successfully!');
      }
      setUserForm({ email: '', password: '', role: 'driver', name: '' });
      setShowUserForm(false);
      fetchData();
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        alert('This email is already registered');
      } else if (error.code === 'auth/weak-password') {
        alert('Password should be at least 6 characters');
      } else {
        alert('Error saving user: ' + error.message);
      }
    }
  };

  const editUser = (u) => {
    setUserForm({
      email: u.email,
      password: '', // Don't show password
      role: u.role,
      name: u.name
    });
    setEditingUser(u);
    setShowUserForm(true);
  };

  const deleteUser = async (userId, userEmail) => {
    if (userEmail === user.email) {
      alert('You cannot delete yourself!');
      return;
    }
    if (!window.confirm(`Delete user: ${userEmail}?`)) return;
    try {
      await deleteDoc(doc(db, 'users', userId));
      fetchData();
      alert('User deleted from database. Note: They can still login until removed from Authentication.');
    } catch (error) {
      alert('Error deleting user: ' + error.message);
    }
  };

  const addMovement = async () => {
    if (!movementForm.customerId || movementForm.qrCodes.filter(q => q).length === 0) {
      alert('Please select customer and enter at least one QR code');
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
          alert(`Cylinder ${qrCode} is already out`);
          return;
        }
        if (movementForm.type === 'inward' && cylinder.status === 'available') {
          alert(`Cylinder ${qrCode} is already available`);
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
        timestamp: Timestamp.now()
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
      fetchData();
      alert(`${movementForm.type === 'outward' ? 'Delivery' : 'Return'} recorded successfully!`);
    } catch (error) {
      alert('Error recording movement: ' + error.message);
    }
  };

  const generateQRCodesPDF = async () => {
    try {
      const lastQR = cylinders.length > 0 ? Math.max(...cylinders.map(c => parseInt(c.qrCode) || 0)) : 0;
      const codes = [];
      for (let i = 1; i <= qrGenerateCount; i++) {
        codes.push((lastQR + i).toString().padStart(3, '0'));
      }

      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const qrSize = 50;
      const cols = 2;
      const rows = 2;
      const marginX = (pageWidth - (cols * qrSize)) / (cols + 1);
      const marginY = 30;
      const spacingY = (pageHeight - marginY - (rows * qrSize) - 40) / (rows - 1);

      for (let i = 0; i < codes.length; i++) {
        if (i > 0 && i % (cols * rows) === 0) {
          pdf.addPage();
        }

        const posInPage = i % (cols * rows);
        const row = Math.floor(posInPage / cols);
        const col = posInPage % cols;
        
        const x = marginX + col * (qrSize + marginX);
        const y = marginY + row * (qrSize + spacingY);

        const qrDataUrl = await QRCode.toDataURL(codes[i], { width: 300, margin: 1 });
        pdf.addImage(qrDataUrl, 'PNG', x, y, qrSize, qrSize);
        pdf.setFontSize(12);
        pdf.text(codes[i], x + qrSize / 2, y + qrSize + 5, { align: 'center' });
      }

      pdf.save(`QR_Codes_${codes[0]}_to_${codes[codes.length - 1]}.pdf`);
      alert(`Generated ${qrGenerateCount} QR codes: ${codes[0]} to ${codes[codes.length - 1]}`);
    } catch (error) {
      alert('Error generating QR codes: ' + error.message);
    }
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
            <div style={{position: 'relative'}}>
              <input 
                type={showPassword ? "text" : "password"}
                placeholder="Password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                style={{paddingRight: '40px'}}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '5px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {showPassword ? <EyeOff size={20} color="#666" /> : <Eye size={20} color="#666" />}
              </button>
            </div>
            {loginError && <p className="error">{loginError}</p>}
            <button type="submit">Login</button>
            <button 
              type="button" 
              onClick={() => setShowForgotPassword(true)}
              style={{
                background: 'transparent',
                color: '#667eea',
                marginTop: '10px',
                fontSize: '0.9rem'
              }}
            >
              Forgot Password?
            </button>
          </form>
        </div>

        {showForgotPassword && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}>
            <div style={{
              background: 'white',
              padding: '2rem',
              borderRadius: '12px',
              maxWidth: '400px',
              width: '90%'
            }}>
              <h2 style={{marginBottom: '1rem'}}>Forgot Your Password?</h2>
              <p style={{color: '#666', marginBottom: '1.5rem'}}>
                Please contact the developer for password reset:
              </p>
              <div style={{
                background: '#f0f0f0',
                padding: '1rem',
                borderRadius: '8px',
                marginBottom: '1.5rem',
                textAlign: 'center'
              }}>
                <strong style={{fontSize: '1.1rem'}}>vishalpranav23@gmail.com</strong>
              </div>
              <p style={{color: '#999', fontSize: '0.9rem', marginBottom: '1.5rem'}}>
                Include your login email when contacting.
              </p>
              <button 
                onClick={() => setShowForgotPassword(false)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app">
      <nav className="navbar">
        <h1>Cylinder Tracking</h1>
        <div className="nav-right">
          <span>{user.displayName || user.email} ({user.role})</span>
          <button onClick={handleLogout} className="logout-btn"><LogOut size={20} /> Logout</button>
        </div>
      </nav>

      <div className="main-container">
        <aside className="sidebar">
          <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>
            <BarChart3 size={20} /> Dashboard
          </button>
          {user.role === 'driver' && (
            <button className={activeTab === 'movement' ? 'active' : ''} onClick={() => setActiveTab('movement')}>
              <Camera size={20} /> Record Movement
            </button>
          )}
          {(user.role === 'admin' || user.role === 'superadmin') && (
            <>
              <button className={activeTab === 'customers' ? 'active' : ''} onClick={() => setActiveTab('customers')}>
                <Users size={20} /> Customers
              </button>
              <button className={activeTab === 'cylinders' ? 'active' : ''} onClick={() => setActiveTab('cylinders')}>
                <Package size={20} /> Cylinders
              </button>
              <button className={activeTab === 'movements' ? 'active' : ''} onClick={() => setActiveTab('movements')}>
                <ArrowRight size={20} /> All Movements
              </button>
            </>
          )}
          {user.role === 'superadmin' && (
            <>
              <button className={activeTab === 'users' ? 'active' : ''} onClick={() => setActiveTab('users')}>
                <UserPlus size={20} /> Users
              </button>
              <button className={activeTab === 'analytics' ? 'active' : ''} onClick={() => setActiveTab('analytics')}>
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
                <div className="stat-card"><h3>Total Cylinders</h3><p className="stat-number">{cylinders.length}</p></div>
                <div className="stat-card"><h3>Out with Customers</h3><p className="stat-number">{cylinders.filter(c => c.status === 'out').length}</p></div>
                <div className="stat-card"><h3>Available</h3><p className="stat-number">{cylinders.filter(c => c.status === 'available').length}</p></div>
                <div className="stat-card"><h3>Total Customers</h3><p className="stat-number">{customers.length}</p></div>
              </div>
            </div>
          )}

          {activeTab === 'movement' && user.role === 'driver' && (
            <div className="section">
              <h2>Record Movement</h2>
              <div className="form">
                <div className="form-group">
                  <label>Type</label>
                  <select value={movementForm.type} onChange={(e) => setMovementForm({...movementForm, type: e.target.value})}>
                    <option value="outward">OUTWARD (Delivery)</option>
                    <option value="inward">INWARD (Return)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Customer</label>
                  <select value={movementForm.customerId} onChange={(e) => setMovementForm({...movementForm, customerId: e.target.value})}>
                    <option value="">Select Customer</option>
                    {customers.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                  </select>
                </div>
                <div className="form-group">
                  <label>QR Codes</label>
                  {movementForm.qrCodes.map((qr, idx) => (
                    <div key={idx} style={{display: 'flex', gap: '10px', marginBottom: '10px'}}>
                      <input type="text" placeholder={`QR ${idx + 1}`} value={qr} onChange={(e) => {
                        const newQRs = [...movementForm.qrCodes];
                        newQRs[idx] = e.target.value;
                        setMovementForm({...movementForm, qrCodes: newQRs});
                      }} style={{flex: 1}} />
                      {movementForm.qrCodes.length > 1 && (
                        <button type="button" onClick={() => {
                          setMovementForm({...movementForm, qrCodes: movementForm.qrCodes.filter((_, i) => i !== idx)});
                        }} className="btn-secondary"><X size={16} /></button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => setMovementForm({...movementForm, qrCodes: [...movementForm.qrCodes, '']})} className="btn-secondary">
                    <Plus size={16} /> Add Cylinder
                  </button>
                </div>
                <button onClick={addMovement} className="btn-primary"><Save size={20} /> Save</button>
              </div>
            </div>
          )}

          {activeTab === 'customers' && (user.role === 'admin' || user.role === 'superadmin') && (
            <div className="section">
              <div className="section-header">
                <h2>Customers</h2>
                <div style={{display: 'flex', gap: '10px'}}>
                  <button onClick={downloadExcelTemplate} className="btn-secondary">
                    <FileText size={20} /> Template
                  </button>
                  <label className="btn-secondary" style={{cursor: 'pointer'}}>
                    <Upload size={20} /> Import
                    <input type="file" accept=".csv,.xlsx" onChange={handleExcelImport} style={{display: 'none'}} />
                  </label>
                  <button onClick={() => { setShowCustomerForm(!showCustomerForm); setEditingCustomer(null); setCustomerForm({ name: '', contact: '', address: '', gstNumber: '' }); }} className="btn-primary">
                    <Plus size={20} /> Add
                  </button>
                </div>
              </div>

              {showCustomerForm && (
                <div className="form">
                  <h3>{editingCustomer ? 'Edit Customer' : 'New Customer'}</h3>
                  <input type="text" placeholder="Customer Name *" value={customerForm.name} onChange={(e) => setCustomerForm({...customerForm, name: e.target.value})} />
                  <input type="text" placeholder="Contact" value={customerForm.contact} onChange={(e) => setCustomerForm({...customerForm, contact: e.target.value})} />
                  <textarea placeholder="Address" value={customerForm.address} onChange={(e) => setCustomerForm({...customerForm, address: e.target.value})} />
                  <input type="text" placeholder="GST Number" value={customerForm.gstNumber} onChange={(e) => setCustomerForm({...customerForm, gstNumber: e.target.value})} />
                  <div className="form-buttons">
                    <button onClick={addCustomer} className="btn-primary"><Save size={20} /> {editingCustomer ? 'Update' : 'Save'}</button>
                    <button onClick={() => { setShowCustomerForm(false); setEditingCustomer(null); }} className="btn-secondary"><X size={20} /> Cancel</button>
                  </div>
                </div>
              )}

              <table className="data-table">
                <thead>
                  <tr><th>Name</th><th>Contact</th><th>Address</th><th>GST</th><th>Cylinders Out</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {customers.map(customer => (
                    <tr key={customer.id}>
                      <td>{customer.name}</td>
                      <td>{customer.contact}</td>
                      <td>{customer.address}</td>
                      <td>{customer.gstNumber}</td>
                      <td>{cylinders.filter(c => c.customerId === customer.id).length}</td>
                      <td>
                        <button onClick={() => editCustomer(customer)} className="btn-secondary" style={{padding: '0.5rem', marginRight: '5px'}}>
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => deleteCustomer(customer.id, customer.name)} className="btn-secondary" style={{padding: '0.5rem'}}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {customers.length === 0 && (<tr><td colSpan="6" style={{textAlign: 'center', padding: '2rem', color: '#999'}}>No customers yet</td></tr>)}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'cylinders' && (user.role === 'admin' || user.role === 'superadmin') && (
            <div className="section">
              <div className="section-header">
                <h2>Cylinders</h2>
                <button onClick={() => setShowCylinderForm(!showCylinderForm)} className="btn-primary">
                  <Plus size={20} /> Add Cylinder
                </button>
              </div>

              {showCylinderForm && (
                <div className="form">
                  <h3>New Cylinder</h3>
                  <div style={{marginBottom: '1rem'}}>
                    <label style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                      <input type="checkbox" checked={cylinderForm.useAutoQR} onChange={(e) => setCylinderForm({...cylinderForm, useAutoQR: e.target.checked})} />
                      Use Next Available QR Number
                    </label>
                  </div>
                  <input type="text" placeholder="QR Code" value={cylinderForm.qrCode} onChange={(e) => setCylinderForm({...cylinderForm, qrCode: e.target.value})} disabled={cylinderForm.useAutoQR} />
                  <input type="text" placeholder="Physical Cylinder ID" value={cylinderForm.physicalId} onChange={(e) => setCylinderForm({...cylinderForm, physicalId: e.target.value})} />
                  <select value={cylinderForm.size} onChange={(e) => setCylinderForm({...cylinderForm, size: e.target.value})}>
                    <option value="5m³">5m³</option>
                    <option value="10m³">10m³</option>
                    <option value="15m³">15m³</option>
                    <option value="20m³">20m³</option>
                  </select>
                  <select value={cylinderForm.gasType} onChange={(e) => setCylinderForm({...cylinderForm, gasType: e.target.value})}>
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
                <h3>Bulk QR Code Generation</h3>
                <div style={{display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '1rem'}}>
                  <label>Generate:</label>
                  <input type="number" value={qrGenerateCount} onChange={(e) => setQrGenerateCount(parseInt(e.target.value) || 1)} style={{width: '100px'}} min="1" max="100" />
                  <span>codes</span>
                  <button onClick={generateQRCodesPDF} className="btn-primary"><Download size={20} /> Generate PDF</button>
                </div>
                <p style={{fontSize: '0.9rem', color: '#666', marginTop: '0.5rem'}}>Next: <strong>{getNextAvailableQR()}</strong></p>
              </div>

              <table className="data-table">
                <thead>
                  <tr><th>QR</th><th>Physical ID</th><th>Size</th><th>Gas</th><th>Status</th><th>Customer</th></tr>
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
                        <td><span className={`status-badge ${cylinder.status}`}>{cylinder.status}</span></td>
                        <td>{customer ? customer.name : '-'}</td>
                      </tr>
                    );
                  })}
                  {cylinders.length === 0 && (<tr><td colSpan="6" style={{textAlign: 'center', padding: '2rem', color: '#999'}}>No cylinders yet</td></tr>)}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'movements' && (user.role === 'admin' || user.role === 'superadmin') && (
            <div className="section">
              <h2>All Movements</h2>
              <table className="data-table">
                <thead>
                  <tr><th>Date & Time</th><th>Type</th><th>Customer</th><th>QR Codes</th><th>Driver</th></tr>
                </thead>
                <tbody>
                  {movements.map(movement => (
                    <tr key={movement.id}>
                      <td>{movement.timestamp?.toDate().toLocaleString()}</td>
                      <td><span className={`status-badge ${movement.type}`}>{movement.type.toUpperCase()}</span></td>
                      <td>{movement.customerName}</td>
                      <td>{movement.qrCodes?.join(', ')}</td>
                      <td>{movement.driverName || movement.driverEmail}</td>
                    </tr>
                  ))}
                  {movements.length === 0 && (<tr><td colSpan="5" style={{textAlign: 'center', padding: '2rem', color: '#999'}}>No movements yet</td></tr>)}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'users' && user.role === 'superadmin' && (
            <div className="section">
              <div className="section-header">
                <h2>User Management</h2>
                <button onClick={() => { setShowUserForm(!showUserForm); setEditingUser(null); setUserForm({ email: '', password: '', role: 'driver', name: '' }); }} className="btn-primary">
                  <UserPlus size={20} /> Create User
                </button>
              </div>

              {showUserForm && (
                <div className="form">
                  <h3>{editingUser ? 'Edit User' : 'Create New User'}</h3>
                  <input type="email" placeholder="Email" value={userForm.email} onChange={(e) => setUserForm({...userForm, email: e.target.value})} />
                  {!editingUser && (
                    <input type="password" placeholder="Password (min 6 chars)" value={userForm.password} onChange={(e) => setUserForm({...userForm, password: e.target.value})} />
                  )}
                  {editingUser && (
                    <p style={{fontSize: '0.9rem', color: '#666', fontStyle: 'italic'}}>Password cannot be changed here. Contact developer for password reset.</p>
                  )}
                  <input type="text" placeholder="Full Name" value={userForm.name} onChange={(e) => setUserForm({...userForm, name: e.target.value})} />
                  <select value={userForm.role} onChange={(e) => setUserForm({...userForm, role: e.target.value})}>
                    <option value="driver">Driver</option>
                    <option value="admin">Admin</option>
                    <option value="superadmin">Super Admin</option>
                  </select>
                  <div className="form-buttons">
                    <button onClick={addUser} className="btn-primary">
                      {editingUser ? <><Save size={20} /> Update</> : <><UserPlus size={20} /> Create</>}
                    </button>
                    <button onClick={() => { setShowUserForm(false); setEditingUser(null); }} className="btn-secondary"><X size={20} /> Cancel</button>
                  </div>
                </div>
              )}

              <table className="data-table">
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Role</th><th>Created</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td><span className={`status-badge ${u.role}`}>{u.role}</span></td>
                      <td>{u.createdAt?.toDate().toLocaleDateString()}</td>
                      <td>
                        <button onClick={() => editUser(u)} className="btn-secondary" style={{padding: '0.5rem', marginRight: '5px'}}>
                          <Edit2 size={16} />
                        </button>
                        {u.email !== user.email && (
                          <button onClick={() => deleteUser(u.id, u.email)} className="btn-secondary" style={{padding: '0.5rem'}}>
                            <Trash2 size={16} />
                          </button>
                        )}
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
              <p style={{color: '#666'}}>Advanced analytics coming soon...</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
