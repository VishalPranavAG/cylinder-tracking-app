import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, orderBy, Timestamp, setDoc } from 'firebase/firestore';
import { Package, Users, BarChart3, LogOut, Camera, ArrowRight, Plus, Download, Trash2, Edit2, Save, X, UserPlus, Upload, FileText, Eye, EyeOff, Search, TrendingUp, Clock } from 'lucide-react';
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
  const [editingCylinder, setEditingCylinder] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  
  const [customerForm, setCustomerForm] = useState({ name: '', contact: '', address: '', gstNumber: '' });
  const [cylinderForm, setCylinderForm] = useState({ qrCode: '', physicalId: '', size: '5m³', gasType: 'CO2', useAutoQR: true });
  const [movementForm, setMovementForm] = useState({ type: 'outward', customerId: '', quantity: 1, currentStep: 'setup', qrCodes: [] });
  const [userForm, setUserForm] = useState({ email: '', password: '', role: 'driver', name: '' });

  const [qrGenerateCount, setQrGenerateCount] = useState(10);
  const [qrRangeFrom, setQrRangeFrom] = useState('');
  const [qrRangeTo, setQrRangeTo] = useState('');
  const [selectedCylinders, setSelectedCylinders] = useState([]);

  const [customerSearch, setCustomerSearch] = useState({ name: '', gst: '' });
  const [cylinderSearch, setCylinderSearch] = useState({ qr: '', physical: '' });
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedCylinderDetail, setSelectedCylinderDetail] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

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
    if (cylinderForm.useAutoQR && !editingCylinder) {
      const nextQR = getNextAvailableQR();
      setCylinderForm(prev => ({ ...prev, qrCode: nextQR }));
    }
  }, [cylinderForm.useAutoQR, cylinders, editingCylinder]);

  const fetchData = async () => {
    try {
      const customersSnap = await getDocs(collection(db, 'customers'));
      setCustomers(customersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const cylindersSnap = await getDocs(collection(db, 'cylinders'));
      setCylinders(cylindersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const movementsSnap = await getDocs(query(collection(db, 'movements'), orderBy('timestamp', 'desc')));
      setMovements(movementsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      if (user && (user.role === 'admin' || user.role === 'superadmin')) {
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

  const getDaysOut = (deliveryDate) => {
    if (!deliveryDate) return 0;
    const today = new Date();
    const delivery = deliveryDate.toDate ? deliveryDate.toDate() : new Date(deliveryDate);
    return Math.floor((today - delivery) / (1000 * 60 * 60 * 24));
  };

  const getStatusColor = (days) => {
    if (days === 0) return 'green';
    if (days < 30) return 'green';
    if (days <= 45) return 'yellow';
    return 'red';
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

    try {
      if (editingCylinder) {
        const changes = [];
        const oldCyl = cylinders.find(c => c.id === editingCylinder.id);
        
        if (oldCyl.gasType !== cylinderForm.gasType) {
          changes.push({ field: 'gasType', from: oldCyl.gasType, to: cylinderForm.gasType });
        }
        if (oldCyl.physicalId !== cylinderForm.physicalId) {
          changes.push({ field: 'physicalId', from: oldCyl.physicalId, to: cylinderForm.physicalId });
        }
        if (oldCyl.size !== cylinderForm.size) {
          changes.push({ field: 'size', from: oldCyl.size, to: cylinderForm.size });
        }

        await updateDoc(doc(db, 'cylinders', editingCylinder.id), {
          qrCode: cylinderForm.qrCode,
          physicalId: cylinderForm.physicalId,
          size: cylinderForm.size,
          gasType: cylinderForm.gasType,
          updatedAt: Timestamp.now(),
          changeHistory: [...(oldCyl.changeHistory || []), {
            timestamp: Timestamp.now(),
            changes: changes,
            updatedBy: user.email
          }]
        });

        if (changes.some(c => c.field === 'gasType')) {
          alert('Cylinder updated! Remember to reprint QR sticker with new gas type.');
        } else {
          alert('Cylinder updated successfully!');
        }
      } else {
        const existing = cylinders.find(c => c.qrCode === cylinderForm.qrCode);
        if (existing) {
          alert('QR code already exists!');
          return;
        }

        await addDoc(collection(db, 'cylinders'), {
          qrCode: cylinderForm.qrCode,
          physicalId: cylinderForm.physicalId,
          size: cylinderForm.size,
          gasType: cylinderForm.gasType,
          status: 'available',
          createdAt: Timestamp.now(),
          changeHistory: []
        });
        alert('Cylinder added successfully!');
      }
      
      setCylinderForm({ qrCode: '', physicalId: '', size: '5m³', gasType: 'CO2', useAutoQR: true });
      setShowCylinderForm(false);
      setEditingCylinder(null);
      fetchData();
    } catch (error) {
      alert('Error saving cylinder: ' + error.message);
    }
  };

  const editCylinder = (cylinder) => {
    setCylinderForm({
      qrCode: cylinder.qrCode,
      physicalId: cylinder.physicalId,
      size: cylinder.size,
      gasType: cylinder.gasType,
      useAutoQR: false
    });
    setEditingCylinder(cylinder);
    setShowCylinderForm(true);
  };

  const addUser = async () => {
    if (!userForm.email || !userForm.name) {
      alert('Email and name are required');
      return;
    }
    if (!editingUser && !userForm.password) {
      alert('Password is required for new users');
      return;
    }

    try {
      if (editingUser) {
        await updateDoc(doc(db, 'users', editingUser.id), {
          email: userForm.email,
          role: userForm.role,
          name: userForm.name,
          updatedAt: Timestamp.now()
        });
        alert('User updated successfully!');
        setEditingUser(null);
      } else {
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
      password: '',
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
      alert('User deleted!');
    } catch (error) {
      alert('Error deleting user: ' + error.message);
    }
  };

  const startScanning = () => {
    setMovementForm(prev => ({ ...prev, currentStep: 'scanning' }));
  };

  const addScannedQR = (qrCode) => {
    const cylinder = cylinders.find(c => c.qrCode === qrCode);
    
    if (!cylinder) {
      alert(`QR Code ${qrCode} not found in system`);
      return false;
    }

    if (movementForm.qrCodes.includes(qrCode)) {
      alert(`QR Code ${qrCode} already added`);
      return false;
    }

    if (movementForm.type === 'outward' && cylinder.status === 'out') {
      alert(`Cylinder ${qrCode} is already out`);
      return false;
    }

    if (movementForm.type === 'inward' && cylinder.status === 'available') {
      alert(`Cylinder ${qrCode} is already available`);
      return false;
    }

    setMovementForm(prev => ({
      ...prev,
      qrCodes: [...prev.qrCodes, qrCode]
    }));
    return true;
  };

  const removeScannedQR = (index) => {
    setMovementForm(prev => ({
      ...prev,
      qrCodes: prev.qrCodes.filter((_, i) => i !== index)
    }));
  };

  const saveMovement = async () => {
    if (movementForm.qrCodes.length !== parseInt(movementForm.quantity)) {
      alert(`Please scan all ${movementForm.quantity} cylinders. Currently: ${movementForm.qrCodes.length}`);
      return;
    }

    try {
      await addDoc(collection(db, 'movements'), {
        type: movementForm.type,
        customerId: movementForm.customerId,
        customerName: customers.find(c => c.id === movementForm.customerId)?.name,
        qrCodes: movementForm.qrCodes,
        driverEmail: user.email,
        driverName: user.displayName,
        timestamp: Timestamp.now()
      });

      for (const qrCode of movementForm.qrCodes) {
        const cylinder = cylinders.find(c => c.qrCode === qrCode);
        await updateDoc(doc(db, 'cylinders', cylinder.id), {
          status: movementForm.type === 'outward' ? 'out' : 'available',
          customerId: movementForm.type === 'outward' ? movementForm.customerId : null,
          lastMovement: Timestamp.now()
        });
      }

      alert(`${movementForm.type === 'outward' ? 'Delivery' : 'Return'} recorded successfully!`);
      setMovementForm({ type: 'outward', customerId: '', quantity: 1, currentStep: 'setup', qrCodes: [] });
      fetchData();
    } catch (error) {
      alert('Error recording movement: ' + error.message);
    }
  };

  const generateQRCodesPDF = async (qrCodes) => {
    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const qrSize = 50;
      const cols = 2;
      const rows = 2;
      const marginX = (pageWidth - (cols * qrSize)) / (cols + 1);
      const marginY = 30;
      const spacingY = (pageHeight - marginY - (rows * qrSize) - 40) / (rows - 1);

      for (let i = 0; i < qrCodes.length; i++) {
        if (i > 0 && i % (cols * rows) === 0) {
          pdf.addPage();
        }

        const posInPage = i % (cols * rows);
        const row = Math.floor(posInPage / cols);
        const col = posInPage % cols;
        
        const x = marginX + col * (qrSize + marginX);
        const y = marginY + row * (qrSize + spacingY);

        const cylinder = cylinders.find(c => c.qrCode === qrCodes[i]);
        const qrDataUrl = await QRCode.toDataURL(qrCodes[i], { width: 300, margin: 1 });
        
        pdf.addImage(qrDataUrl, 'PNG', x, y, qrSize, qrSize);
        pdf.setFontSize(12);
        pdf.text(qrCodes[i], x + qrSize / 2, y + qrSize + 5, { align: 'center' });
        
        if (cylinder) {
          pdf.setFontSize(10);
          pdf.text(`${cylinder.gasType} - ${cylinder.size}`, x + qrSize / 2, y + qrSize + 10, { align: 'center' });
        }
      }

      pdf.save(`QR_Codes_${qrCodes[0]}_to_${qrCodes[qrCodes.length - 1]}.pdf`);
      alert(`Generated ${qrCodes.length} QR codes`);
    } catch (error) {
      alert('Error generating QR codes: ' + error.message);
    }
  };

  const generateSelectedQRs = () => {
    if (selectedCylinders.length === 0) {
      alert('Please select cylinders first');
      return;
    }
    const qrCodes = selectedCylinders.map(id => cylinders.find(c => c.id === id)?.qrCode).filter(Boolean);
    generateQRCodesPDF(qrCodes);
  };

  const generateRangeQRs = () => {
    if (!qrRangeFrom || !qrRangeTo) {
      alert('Please enter both from and to QR codes');
      return;
    }

    const from = parseInt(qrRangeFrom);
    const to = parseInt(qrRangeTo);

    if (isNaN(from) || isNaN(to) || from > to) {
      alert('Invalid range');
      return;
    }

    const qrCodes = [];
    for (let i = from; i <= to; i++) {
      const qr = i.toString().padStart(3, '0');
      if (cylinders.some(c => c.qrCode === qr)) {
        qrCodes.push(qr);
      }
    }

    if (qrCodes.length === 0) {
      alert('No cylinders found in this range');
      return;
    }

    generateQRCodesPDF(qrCodes);
  };

  const generateBulkNewQRs = async () => {
    const lastQR = cylinders.length > 0 ? Math.max(...cylinders.map(c => parseInt(c.qrCode) || 0)) : 0;
    const codes = [];
    for (let i = 1; i <= qrGenerateCount; i++) {
      codes.push((lastQR + i).toString().padStart(3, '0'));
    }
    await generateQRCodesPDF(codes);
  };

  const toggleCylinderSelection = (cylinderId) => {
    setSelectedCylinders(prev =>
      prev.includes(cylinderId)
        ? prev.filter(id => id !== cylinderId)
        : [...prev, cylinderId]
    );
  };

  const selectAllCylinders = () => {
    setSelectedCylinders(cylinders.map(c => c.id));
  };

  const deselectAllCylinders = () => {
    setSelectedCylinders([]);
  };

  const sortData = (data, key) => {
    if (!key) return data;
    
    const direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, direction });

    return [...data].sort((a, b) => {
      let aVal = a[key];
      let bVal = b[key];

      if (key === 'co2Count' || key === 'o2Count' || key === 'totalCount') {
        aVal = aVal || 0;
        bVal = bVal || 0;
      }

      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const getCustomerAnalytics = () => {
    return customers.map(customer => {
      const customerCylinders = cylinders.filter(c => c.customerId === customer.id && c.status === 'out');
      const co2Count = customerCylinders.filter(c => c.gasType === 'CO2').length;
      const o2Count = customerCylinders.filter(c => c.gasType === 'O2').length;
      
      const maxDays = Math.max(...customerCylinders.map(c => {
        const lastMovement = movements.find(m => m.qrCodes.includes(c.qrCode) && m.type === 'outward');
        return lastMovement ? getDaysOut(lastMovement.timestamp) : 0;
      }), 0);

      return {
        ...customer,
        co2Count,
        o2Count,
        totalCount: co2Count + o2Count,
        maxDaysOut: maxDays,
        statusColor: getStatusColor(maxDays)
      };
    });
  };

  const getFilteredCustomers = () => {
    let filtered = getCustomerAnalytics();

    if (customerSearch.name) {
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(customerSearch.name.toLowerCase())
      );
    }

    if (customerSearch.gst) {
      filtered = filtered.filter(c => 
        c.gstNumber && c.gstNumber.toLowerCase().includes(customerSearch.gst.toLowerCase())
      );
    }

    return filtered;
  };

  const getFilteredCylinders = () => {
    let filtered = cylinders;

    if (cylinderSearch.qr) {
      filtered = filtered.filter(c => 
        c.qrCode.includes(cylinderSearch.qr)
      );
    }

    if (cylinderSearch.physical) {
      filtered = filtered.filter(c => 
        c.physicalId.includes(cylinderSearch.physical)
      );
    }

    return filtered;
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
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
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
                  padding: '5px'
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
          <div className="modal-overlay" onClick={() => setShowForgotPassword(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2>Forgot Your Password?</h2>
              <p>Please contact the developer for password reset:</p>
              <div className="contact-info">
                <strong>vishalpranav23@gmail.com</strong>
              </div>
              <p style={{fontSize: '0.9rem', color: '#999'}}>Include your login email when contacting.</p>
              <button onClick={() => setShowForgotPassword(false)} className="btn-primary">Close</button>
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
              <button className={activeTab === 'customer-analytics' ? 'active' : ''} onClick={() => setActiveTab('customer-analytics')}>
                <TrendingUp size={20} /> Customer Analytics
              </button>
              <button className={activeTab === 'cylinders' ? 'active' : ''} onClick={() => setActiveTab('cylinders')}>
                <Package size={20} /> Cylinders
              </button>
              <button className={activeTab === 'cylinder-analytics' ? 'active' : ''} onClick={() => setActiveTab('cylinder-analytics')}>
                <Clock size={20} /> Cylinder Analytics
              </button>
              <button className={activeTab === 'movements' ? 'active' : ''} onClick={() => setActiveTab('movements')}>
                <ArrowRight size={20} /> All Movements
              </button>
            </>
          )}
          
          {user.role === 'superadmin' && (
            <button className={activeTab === 'users' ? 'active' : ''} onClick={() => setActiveTab('users')}>
              <UserPlus size={20} /> Users
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
              
              {movementForm.currentStep === 'setup' && (
                <div className="form">
                  <div className="form-group">
                    <label>Type</label>
                    <select value={movementForm.type} onChange={(e) => setMovementForm({...movementForm, type: e.target.value})}>
                      <option value="outward">🔴 OUTWARD (Delivery)</option>
                      <option value="inward">🟢 INWARD (Return)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Customer</label>
                    <select value={movementForm.customerId} onChange={(e) => setMovementForm({...movementForm, customerId: e.target.value})}>
                      <option value="">Select Customer</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Number of Cylinders</label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={movementForm.quantity}
                      onChange={(e) => setMovementForm({...movementForm, quantity: e.target.value})}
                    />
                  </div>

                  <button 
                    onClick={startScanning}
                    className="btn-primary"
                    disabled={!movementForm.customerId || !movementForm.quantity}
                  >
                    Continue to Scanning
                  </button>
                </div>
              )}

              {movementForm.currentStep === 'scanning' && (
                <div className="scanning-interface">
                  <div className="scanning-header">
                    <h3>Scan {movementForm.quantity} Cylinders</h3>
                    <p>{movementForm.type === 'outward' ? 'OUTWARD' : 'INWARD'} - {customers.find(c => c.id === movementForm.customerId)?.name}</p>
                  </div>

                  <div className="progress-bar">
                    <div className="progress-fill" style={{width: `${(movementForm.qrCodes.length / movementForm.quantity) * 100}%`}}></div>
                    <span className="progress-text">{movementForm.qrCodes.length} / {movementForm.quantity}</span>
                  </div>

                  <div className="scan-buttons">
                    <button className="btn-scan" onClick={() => {
                      const qr = prompt('Enter QR Code:');
                      if (qr) addScannedQR(qr);
                    }}>
                      <Camera size={24} /> Scan/Enter QR
                    </button>
                  </div>

                  <div className="scanned-list">
                    <h4>Scanned Cylinders:</h4>
                    {movementForm.qrCodes.map((qr, idx) => {
                      const cyl = cylinders.find(c => c.qrCode === qr);
                      return (
                        <div key={idx} className="scanned-item">
                          <span>✅ {idx + 1}. [{qr}] {cyl?.gasType} - {cyl?.size}</span>
                          <button onClick={() => removeScannedQR(idx)} className="btn-remove">
                            <X size={16} />
                          </button>
                        </div>
                      );
                    })}
                    {Array.from({ length: parseInt(movementForm.quantity) - movementForm.qrCodes.length }).map((_, idx) => (
                      <div key={`pending-${idx}`} className="scanned-item pending">
                        <span>⬜ {movementForm.qrCodes.length + idx + 1}. Pending...</span>
                      </div>
                    ))}
                  </div>

                  <div className="scan-actions">
                    <button 
                      onClick={() => setMovementForm({...movementForm, currentStep: 'setup', qrCodes: []})}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={saveMovement}
                      className="btn-primary"
                      disabled={movementForm.qrCodes.length !== parseInt(movementForm.quantity)}
                    >
                      Save Movement
                    </button>
                  </div>
                </div>
              )}
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
                  <label className="btn-secondary" style={{cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px'}}>
                    <Upload size={20} /> Import
                    <input type="file" accept=".csv" onChange={handleExcelImport} style={{display: 'none'}} />
                  </label>
                  <button onClick={() => { 
                    setShowCustomerForm(true); 
                    setEditingCustomer(null); 
                    setCustomerForm({ name: '', contact: '', address: '', gstNumber: '' }); 
                  }} className="btn-primary">
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
                    <button onClick={addCustomer} className="btn-primary"><Save size={20} /> Save</button>
                    <button onClick={() => { setShowCustomerForm(false); setEditingCustomer(null); }} className="btn-secondary"><X size={20} /> Cancel</button>
                  </div>
                </div>
              )}

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Contact</th>
                    <th>Address</th>
                    <th>GST</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(customer => (
                    <tr key={customer.id}>
                      <td>{customer.name}</td>
                      <td>{customer.contact}</td>
                      <td>{customer.address}</td>
                      <td>{customer.gstNumber}</td>
                      <td>
                        <button onClick={() => editCustomer(customer)} className="btn-icon"><Edit2 size={16} /></button>
                        <button onClick={() => deleteCustomer(customer.id, customer.name)} className="btn-icon"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'customer-analytics' && (user.role === 'admin' || user.role === 'superadmin') && (
            <div className="section">
              {!selectedCustomer ? (
                <>
                  <h2>Customer Analytics</h2>
                  
                  <div className="search-section">
                    <input
                      type="text"
                      placeholder="Search by name..."
                      value={customerSearch.name}
                      onChange={(e) => setCustomerSearch({...customerSearch, name: e.target.value})}
                    />
                    <input
                      type="text"
                      placeholder="Search by GST..."
                      value={customerSearch.gst}
                      onChange={(e) => setCustomerSearch({...customerSearch, gst: e.target.value})}
                    />
                    <button onClick={() => setCustomerSearch({ name: '', gst: '' })} className="btn-secondary">Clear</button>
                  </div>

                  <table className="data-table sortable">
                    <thead>
                      <tr>
                        <th onClick={() => sortData(getFilteredCustomers(), 'name')}>
                          Customer {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                        </th>
                        <th onClick={() => sortData(getFilteredCustomers(), 'co2Count')}>
                          CO2 {sortConfig.key === 'co2Count' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                        </th>
                        <th onClick={() => sortData(getFilteredCustomers(), 'o2Count')}>
                          O2 {sortConfig.key === 'o2Count' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                        </th>
                        <th onClick={() => sortData(getFilteredCustomers(), 'totalCount')}>
                          Total {sortConfig.key === 'totalCount' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {getFilteredCustomers().map(customer => (
                        <tr key={customer.id} onClick={() => setSelectedCustomer(customer)} style={{cursor: 'pointer'}}>
                          <td>
                            <span className={`status-indicator status-${customer.statusColor}`}>●</span>
                            {customer.name}
                          </td>
                          <td>{customer.co2Count}</td>
                          <td>{customer.o2Count}</td>
                          <td><strong>{customer.totalCount}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : (
                <div className="detail-view">
                  <button onClick={() => setSelectedCustomer(null)} className="btn-back">
                    ← Back to All Customers
                  </button>
                  
                  <h2>{selectedCustomer.name}</h2>
                  <p>Contact: {selectedCustomer.contact} | GST: {selectedCustomer.gstNumber}</p>
                  
                  <div className="summary-cards">
                    <div className="summary-card">
                      <h4>CO2 Cylinders</h4>
                      <p className="big-number">{selectedCustomer.co2Count}</p>
                    </div>
                    <div className="summary-card">
                      <h4>O2 Cylinders</h4>
                      <p className="big-number">{selectedCustomer.o2Count}</p>
                    </div>
                    <div className="summary-card">
                      <h4>Total</h4>
                      <p className="big-number">{selectedCustomer.totalCount}</p>
                    </div>
                  </div>

                  <h3>Cylinders Currently Out</h3>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>QR</th>
                        <th>Physical</th>
                        <th>Size</th>
                        <th>Gas</th>
                        <th>Days Out</th>
                        <th>Delivered On</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cylinders
                        .filter(c => c.customerId === selectedCustomer.id && c.status === 'out')
                        .map(cyl => {
                          const lastMovement = movements.find(m => m.qrCodes.includes(cyl.qrCode) && m.type === 'outward' && m.customerId === selectedCustomer.id);
                          const days = lastMovement ? getDaysOut(lastMovement.timestamp) : 0;
                          return (
                            <tr key={cyl.id}>
                              <td><strong>{cyl.qrCode}</strong></td>
                              <td>{cyl.physicalId}</td>
                              <td>{cyl.size}</td>
                              <td>{cyl.gasType}</td>
                              <td>
                                <span className={`status-badge status-${getStatusColor(days)}`}>
                                  {days} days {days > 45 && '🔴'}
                                </span>
                              </td>
                              <td>{lastMovement?.timestamp.toDate().toLocaleDateString()}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'cylinders' && (user.role === 'admin' || user.role === 'superadmin') && (
            <div className="section">
              <div className="section-header">
                <h2>Cylinders</h2>
                <button onClick={() => {
                  setShowCylinderForm(true);
                  setEditingCylinder(null);
                  setCylinderForm({ qrCode: '', physicalId: '', size: '5m³', gasType: 'CO2', useAutoQR: true });
                }} className="btn-primary">
                  <Plus size={20} /> Add Cylinder
                </button>
              </div>

              {showCylinderForm && (
                <div className="form">
                  <h3>{editingCylinder ? 'Edit Cylinder' : 'New Cylinder'}</h3>
                  {!editingCylinder && (
                    <div style={{marginBottom: '1rem'}}>
                      <label style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                        <input 
                          type="checkbox" 
                          checked={cylinderForm.useAutoQR} 
                          onChange={(e) => setCylinderForm({...cylinderForm, useAutoQR: e.target.checked})} 
                        />
                        Use Next Available QR Number
                      </label>
                    </div>
                  )}
                  <input 
                    type="text" 
                    placeholder="QR Code" 
                    value={cylinderForm.qrCode} 
                    onChange={(e) => setCylinderForm({...cylinderForm, qrCode: e.target.value})} 
                    disabled={cylinderForm.useAutoQR && !editingCylinder}
                  />
                  <input 
                    type="text" 
                    placeholder="Physical Cylinder ID" 
                    value={cylinderForm.physicalId} 
                    onChange={(e) => setCylinderForm({...cylinderForm, physicalId: e.target.value})} 
                  />
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
                    <button onClick={() => { setShowCylinderForm(false); setEditingCylinder(null); }} className="btn-secondary"><X size={20} /> Cancel</button>
                  </div>
                </div>
              )}

              <div className="qr-generation-section">
                <h3>QR Code Generation</h3>
                
                <div className="qr-gen-method">
                  <h4>Method 1: Generate for Selected</h4>
                  <div style={{display: 'flex', gap: '10px', marginBottom: '10px'}}>
                    <button onClick={selectAllCylinders} className="btn-secondary">Select All</button>
                    <button onClick={deselectAllCylinders} className="btn-secondary">Deselect All</button>
                    <button 
                      onClick={generateSelectedQRs} 
                      className="btn-primary"
                      disabled={selectedCylinders.length === 0}
                    >
                      <Download size={20} /> Generate PDF for Selected ({selectedCylinders.length})
                    </button>
                  </div>
                </div>

                <div className="qr-gen-method">
                  <h4>Method 2: Generate by Range</h4>
                  <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                    <span>From:</span>
                    <input 
                      type="text" 
                      placeholder="001" 
                      value={qrRangeFrom}
                      onChange={(e) => setQrRangeFrom(e.target.value)}
                      style={{width: '80px'}}
                    />
                    <span>To:</span>
                    <input 
                      type="text" 
                      placeholder="010" 
                      value={qrRangeTo}
                      onChange={(e) => setQrRangeTo(e.target.value)}
                      style={{width: '80px'}}
                    />
                    <button onClick={generateRangeQRs} className="btn-primary">
                      <Download size={20} /> Generate Range
                    </button>
                  </div>
                </div>

                <div className="qr-gen-method">
                  <h4>Method 3: Generate New QR Codes (Bulk)</h4>
                  <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                    <span>Generate:</span>
                    <input 
                      type="number" 
                      value={qrGenerateCount}
                      onChange={(e) => setQrGenerateCount(parseInt(e.target.value) || 1)}
                      style={{width: '80px'}}
                      min="1"
                      max="100"
                    />
                    <span>codes</span>
                    <button onClick={generateBulkNewQRs} className="btn-primary">
                      <Download size={20} /> Generate New
                    </button>
                    <span style={{marginLeft: '10px', color: '#666'}}>Next: <strong>{getNextAvailableQR()}</strong></span>
                  </div>
                </div>
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{width: '40px'}}>
                      <input 
                        type="checkbox" 
                        checked={selectedCylinders.length === cylinders.length && cylinders.length > 0}
                        onChange={(e) => e.target.checked ? selectAllCylinders() : deselectAllCylinders()}
                      />
                    </th>
                    <th>QR</th>
                    <th>Physical ID</th>
                    <th>Size</th>
                    <th>Gas</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cylinders.map(cylinder => (
                    <tr key={cylinder.id}>
                      <td>
                        <input 
                          type="checkbox"
                          checked={selectedCylinders.includes(cylinder.id)}
                          onChange={() => toggleCylinderSelection(cylinder.id)}
                        />
                      </td>
                      <td><strong>{cylinder.qrCode}</strong></td>
                      <td>{cylinder.physicalId}</td>
                      <td>{cylinder.size}</td>
                      <td>{cylinder.gasType}</td>
                      <td>
                        <button onClick={() => editCylinder(cylinder)} className="btn-icon"><Edit2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'cylinder-analytics' && (user.role === 'admin' || user.role === 'superadmin') && (
            <div className="section">
              {!selectedCylinderDetail ? (
                <>
                  <h2>Cylinder Analytics</h2>
                  
                  <div className="search-section">
                    <input
                      type="text"
                      placeholder="Search by QR..."
                      value={cylinderSearch.qr}
                      onChange={(e) => setCylinderSearch({...cylinderSearch, qr: e.target.value})}
                    />
                    <input
                      type="text"
                      placeholder="Search by Physical ID..."
                      value={cylinderSearch.physical}
                      onChange={(e) => setCylinderSearch({...cylinderSearch, physical: e.target.value})}
                    />
                    <button onClick={() => setCylinderSearch({ qr: '', physical: '' })} className="btn-secondary">Clear</button>
                  </div>

                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>QR</th>
                        <th>Physical</th>
                        <th>Size</th>
                        <th>Gas</th>
                        <th>Status</th>
                        <th>Customer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getFilteredCylinders().map(cylinder => {
                        const customer = customers.find(c => c.id === cylinder.customerId);
                        const lastMovement = movements.find(m => m.qrCodes.includes(cylinder.qrCode) && m.type === 'outward');
                        const days = lastMovement && cylinder.status === 'out' ? getDaysOut(lastMovement.timestamp) : 0;
                        
                        return (
                          <tr key={cylinder.id} onClick={() => setSelectedCylinderDetail(cylinder)} style={{cursor: 'pointer'}}>
                            <td><strong>{cylinder.qrCode}</strong></td>
                            <td>{cylinder.physicalId}</td>
                            <td>{cylinder.size}</td>
                            <td>{cylinder.gasType}</td>
                            <td>
                              {cylinder.status === 'out' ? (
                                <span className={`status-badge status-${getStatusColor(days)}`}>
                                  OUT ({days}d)
                                </span>
                              ) : (
                                <span className="status-badge status-green">AVAILABLE</span>
                              )}
                            </td>
                            <td>{customer ? customer.name : '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              ) : (
                <div className="detail-view">
                  <button onClick={() => setSelectedCylinderDetail(null)} className="btn-back">
                    ← Back to All Cylinders
                  </button>
                  
                  <h2>Cylinder QR: {selectedCylinderDetail.qrCode} | Physical: {selectedCylinderDetail.physicalId}</h2>
                  <p>Size: {selectedCylinderDetail.size} | Gas: {selectedCylinderDetail.gasType}</p>
                  
                  {selectedCylinderDetail.status === 'out' && (() => {
                    const customer = customers.find(c => c.id === selectedCylinderDetail.customerId);
                    const lastMovement = movements.find(m => 
                      m.qrCodes.includes(selectedCylinderDetail.qrCode) && 
                      m.type === 'outward' && 
                      m.customerId === selectedCylinderDetail.customerId
                    );
                    const days = lastMovement ? getDaysOut(lastMovement.timestamp) : 0;
                    
                    return (
                      <div className="current-location">
                        <h3>Current Location:</h3>
                        <p>Customer: <strong>{customer?.name || 'Unknown'}</strong></p>
                        <p>Delivered: {lastMovement?.timestamp.toDate().toLocaleDateString()}</p>
                        <p>Days Out: <span className={`status-badge status-${getStatusColor(days)}`}>{days} days</span></p>
                      </div>
                    );
                  })()}

                  <h3>Movement History</h3>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Customer</th>
                        <th>Driver</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements
                        .filter(m => m.qrCodes.includes(selectedCylinderDetail.qrCode))
                        .map(movement => (
                          <tr key={movement.id}>
                            <td>{movement.timestamp.toDate().toLocaleString()}</td>
                            <td>
                              <span className={`status-badge ${movement.type === 'outward' ? 'status-red' : 'status-green'}`}>
                                {movement.type === 'outward' ? '🔴 OUTWARD' : '🟢 INWARD'}
                              </span>
                            </td>
                            <td>{movement.customerName}</td>
                            <td>{movement.driverName || movement.driverEmail}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>

                  {selectedCylinderDetail.changeHistory && selectedCylinderDetail.changeHistory.length > 0 && (
                    <>
                      <h3>Change History</h3>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Changes</th>
                            <th>Updated By</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedCylinderDetail.changeHistory.map((change, idx) => (
                            <tr key={idx}>
                              <td>{change.timestamp.toDate().toLocaleString()}</td>
                              <td>
                                {change.changes.map((c, i) => (
                                  <div key={i}>
                                    {c.field}: {c.from} → {c.to}
                                  </div>
                                ))}
                              </td>
                              <td>{change.updatedBy}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              )}
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
                        <span className={`status-badge ${movement.type === 'outward' ? 'status-red' : 'status-green'}`}>
                          {movement.type === 'outward' ? '🔴 OUTWARD' : '🟢 INWARD'}
                        </span>
                      </td>
                      <td>{movement.customerName}</td>
                      <td>{movement.qrCodes?.join(', ')}</td>
                      <td>{movement.driverName || movement.driverEmail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'users' && user.role === 'superadmin' && (
            <div className="section">
              <div className="section-header">
                <h2>User Management</h2>
                <button onClick={() => { 
                  setShowUserForm(true); 
                  setEditingUser(null); 
                  setUserForm({ email: '', password: '', role: 'driver', name: '' }); 
                }} className="btn-primary">
                  <UserPlus size={20} /> Create User
                </button>
              </div>

              {showUserForm && (
                <div className="form">
                  <h3>{editingUser ? 'Edit User' : 'Create New User'}</h3>
                  <input 
                    type="email" 
                    placeholder="Email" 
                    value={userForm.email} 
                    onChange={(e) => setUserForm({...userForm, email: e.target.value})} 
                  />
                  {!editingUser && (
                    <input 
                      type="password" 
                      placeholder="Password (min 6 chars)" 
                      value={userForm.password} 
                      onChange={(e) => setUserForm({...userForm, password: e.target.value})} 
                    />
                  )}
                  {editingUser && (
                    <p style={{fontSize: '0.9rem', color: '#666', fontStyle: 'italic'}}>
                      Password cannot be changed here. Contact developer for password reset.
                    </p>
                  )}
                  <input 
                    type="text" 
                    placeholder="Full Name" 
                    value={userForm.name} 
                    onChange={(e) => setUserForm({...userForm, name: e.target.value})} 
                  />
                  <select value={userForm.role} onChange={(e) => setUserForm({...userForm, role: e.target.value})}>
                    <option value="driver">Driver</option>
                    <option value="admin">Admin</option>
                    <option value="superadmin">Super Admin</option>
                  </select>
                  <div className="form-buttons">
                    <button onClick={addUser} className="btn-primary">
                      {editingUser ? <><Save size={20} /> Update</> : <><UserPlus size={20} /> Create</>}
                    </button>
                    <button onClick={() => { setShowUserForm(false); setEditingUser(null); }} className="btn-secondary">
                      <X size={20} /> Cancel
                    </button>
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
                      <td><span className={`status-badge status-${u.role}`}>{u.role}</span></td>
                      <td>{u.createdAt?.toDate().toLocaleDateString()}</td>
                      <td>
                        <button onClick={() => editUser(u)} className="btn-icon"><Edit2 size={16} /></button>
                        {u.email !== user.email && (
                          <button onClick={() => deleteUser(u.id, u.email)} className="btn-icon"><Trash2 size={16} /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
