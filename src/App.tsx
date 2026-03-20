/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  setPersistence,
  browserLocalPersistence,
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  addDoc, 
  getDocs,
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  limit, 
  Timestamp,
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';
import { UserProfile, VisitorLog, COLLEGES_OFFICES, VISIT_REASONS, UserRole } from './types';
import { 
  LogOut, 
  LayoutDashboard, 
  UserCheck, 
  QrCode, 
  Users, 
  Clock, 
  ShieldAlert, 
  ShieldCheck,
  CheckCircle2, 
  XCircle,
  BarChart3,
  ChevronRight,
  UserCircle,
  Search,
  Filter,
  ArrowRightLeft,
  UserMinus,
  ExternalLink,
  Moon,
  Sun
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';
import { format, differenceInMinutes, startOfDay, endOfDay, startOfWeek, startOfMonth } from 'date-fns';

const LIBRARY_LOGO = "https://img.icons8.com/fluency/240/library.png";
const ADMIN_EMAILS = ['m.carl4243@gmail.com', 'jermainecarl.miranda@neu.edu.ph', 'jcesperanza@neu.edu.ph'];

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: any[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Components ---

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.error?.message?.includes('Firestore Error')) {
        setHasError(true);
        try {
          const info = JSON.parse(event.error.message);
          setErrorMessage(`Database Error: ${info.error} during ${info.operationType} at ${info.path}`);
        } catch {
          setErrorMessage(event.error.message);
        }
      }
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-red-100">
          <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-6">{errorMessage}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors"
          >
            Reload Application
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : true; // Default to dark mode as requested
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);
  const [activeTab, setActiveTab] = useState<'log' | 'admin' | 'profile'>('log');
  const [showScanner, setShowScanner] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [occupancy, setOccupancy] = useState(0);
  const [sessionRole, setSessionRole] = useState<UserRole | null>(null);
  const [checkoutResult, setCheckoutResult] = useState<{ success: boolean, message: string } | null>(null);

  // Handle direct URL checkouts (e.g., scanning with native camera app)
  useEffect(() => {
    const handleUrlCheckout = async () => {
      const params = new URLSearchParams(window.location.search);
      const logId = params.get('checkout');
      
      if (!logId) return;

      try {
        const logRef = doc(db, 'logs', logId);
        
        // Attempt a "blind" update first to support unauthenticated check-outs
        await updateDoc(logRef, {
          checkOutTime: serverTimestamp()
        });
        
        setCheckoutResult({ success: true, message: 'Check-out successful!' });
        // Clear the URL after processing
        window.history.replaceState({}, '', window.location.pathname);
      } catch (err: any) {
        console.error("URL Checkout error:", err);
        
        // If update failed, it might be already checked out or a real error
        if (err.code === 'permission-denied') {
          // If we are logged in as admin, we can try to get more details
          if (profile?.role === 'Admin' && sessionRole === 'Admin') {
            try {
              const logSnap = await getDoc(doc(db, 'logs', logId));
              if (logSnap.exists() && logSnap.data().checkOutTime) {
                setCheckoutResult({ success: false, message: 'Visitor already checked out.' });
              } else {
                setCheckoutResult({ success: false, message: 'Check-out failed. Permission denied.' });
              }
            } catch {
              setCheckoutResult({ success: false, message: 'Check-out failed. Invalid or already processed.' });
            }
          } else {
            setCheckoutResult({ success: false, message: 'Check-out failed. This may happen if the visitor is already checked out.' });
          }
        } else {
          setCheckoutResult({ success: false, message: 'Error processing check-out.' });
        }
        window.history.replaceState({}, '', window.location.pathname);
      }
    };

    if (isAuthReady) {
      handleUrlCheckout();
    }
  }, [isAuthReady, profile, sessionRole]);

  // Test Connection
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  const [intendedRole, setIntendedRole] = useState<UserRole>('Student');

  useEffect(() => {
    // Set persistence once at startup
    setPersistence(auth, browserLocalPersistence).catch(err => console.error("Persistence error:", err));

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Domain Whitelisting
        const isAdminEmail = ADMIN_EMAILS.includes(firebaseUser.email || '');
        if (!firebaseUser.email?.endsWith('@neu.edu.ph') && !isAdminEmail) {
          await signOut(auth);
          alert('Access restricted to @neu.edu.ph accounts only.');
          setLoading(false);
          setIsAuthReady(true);
          return;
        }

        const userDoc = doc(db, 'users', firebaseUser.uid);
        try {
          const docSnap = await getDoc(userDoc);
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            setProfile(null);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  // Global Occupancy Listener
  useEffect(() => {
    if (!isAuthReady || !user) return;
    
    const q = query(
      collection(db, 'logs'),
      where('checkOutTime', '==', null)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOccupancy(snapshot.size);
    }, (error) => {
      console.error("Occupancy listener error:", error);
    });

    return () => unsubscribe();
  }, [isAuthReady, user]);

  const handleLogin = async (role: UserRole = 'Student') => {
    try {
      // Force account selection to satisfy "log-in every single time"
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      
      // Call popup FIRST to ensure it's triggered by user gesture
      await signInWithPopup(auth, googleProvider);
      
      // Update state AFTER successful login
      setIntendedRole(role);
      setSessionRole(role);
    } catch (error: any) {
      console.error('Login failed', error);
      setSessionRole(null);
      
      // Handle the specific "missing initial state" error which is common in iframes
      if (error.message?.includes('missing initial state') || error.code === 'auth/internal-error') {
        alert('Login failed due to browser storage restrictions. Please try opening the app in a new tab or allowing third-party cookies for this site.');
      } else if (error.code === 'auth/popup-blocked') {
        alert('Login popup was blocked by your browser. Please allow popups for this site or use the "Open in New Tab" button at the bottom of the page to log in.');
      } else if (error.code !== 'auth/popup-closed-by-user') {
        alert(`Login failed: ${error.message || 'Unknown error'}`);
      }
    }
  };

  const handleLogout = async () => {
    try {
      setSessionRole(null);
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'dark bg-dark-bg' : 'bg-slate-50'}`}>
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className={`min-h-screen ${darkMode ? 'dark' : ''} bg-slate-50 dark:bg-dark-bg text-slate-900 dark:text-dark-text font-sans transition-colors duration-300`}>
        {!user || !sessionRole ? (
          <LoginView onLogin={handleLogin} darkMode={darkMode} setDarkMode={setDarkMode} />
        ) : !profile || !profile.isSetupComplete || isEditingProfile ? (
          <SetupProfileView 
            user={user} 
            initialProfile={profile} 
            intendedRole={intendedRole}
            onComplete={(p) => {
              setProfile(p);
              setIsEditingProfile(false);
            }} 
            onCancel={profile?.isSetupComplete ? () => setIsEditingProfile(false) : undefined}
          />
        ) : (
          <div className="max-w-5xl mx-auto px-4 py-8">
            <Header 
              profile={profile} 
              sessionRole={sessionRole}
              onLogout={handleLogout} 
              activeTab={activeTab} 
              setActiveTab={setActiveTab} 
              onOpenScanner={() => setShowScanner(true)}
              onEditProfile={() => setActiveTab('profile')}
              occupancy={occupancy}
              darkMode={darkMode}
              setDarkMode={setDarkMode}
            />
            <main className="mt-8">
              <AnimatePresence mode="wait">
                {activeTab === 'log' ? (
                  <VisitorLogView key="log" profile={profile} sessionRole={sessionRole} darkMode={darkMode} />
                ) : activeTab === 'admin' && profile.role === 'Admin' && sessionRole === 'Admin' ? (
                  <AdminDashboardView key="admin" profile={profile} darkMode={darkMode} />
                ) : (
                  <ProfileSettingsView key="profile" profile={profile} onUpdate={(p) => setProfile(p)} />
                )}
              </AnimatePresence>
            </main>

            <AnimatePresence>
              {showScanner && (
                <QRScannerModal onClose={() => setShowScanner(false)} />
              )}
            </AnimatePresence>
          </div>
        )}

        {/* URL Checkout Result Modal - Outside conditional to work on Login page */}
        <AnimatePresence>
          {checkoutResult && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center space-y-6"
              >
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${checkoutResult.success ? 'bg-blue-100' : 'bg-red-100'}`}>
                  {checkoutResult.success ? (
                    <CheckCircle2 className="w-12 h-12 text-blue-600" />
                  ) : (
                    <ShieldAlert className="w-12 h-12 text-red-600" />
                  )}
                </div>
                <h3 className={`text-2xl font-black ${checkoutResult.success ? 'text-blue-600' : 'text-red-600'}`}>
                  {checkoutResult.message}
                </h3>
                <button 
                  onClick={() => setCheckoutResult(null)}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all"
                >
                  Dismiss
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}

// --- Sub-Views ---

const LoginView = ({ onLogin, darkMode, setDarkMode }: { 
  onLogin: (role?: UserRole) => void,
  darkMode: boolean,
  setDarkMode: React.Dispatch<React.SetStateAction<boolean>>
}) => {
  const params = new URLSearchParams(window.location.search);
  const isCheckout = params.has('checkout');

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-white dark:bg-dark-bg relative overflow-hidden transition-colors duration-300">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50 dark:bg-blue-900/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-50 dark:bg-blue-900/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />
      
      {/* Dark mode toggle */}
      <button 
        onClick={() => setDarkMode(prev => !prev)}
        className="absolute top-8 right-8 p-3 bg-white dark:bg-dark-card border border-slate-100 dark:border-dark-border rounded-2xl shadow-sm z-20 hover:scale-110 transition-transform"
      >
        {darkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-slate-600" />}
      </button>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white dark:bg-dark-card rounded-3xl p-12 text-center relative z-10 border border-slate-100 dark:border-dark-border shadow-xl dark:shadow-none"
      >
        <div className="w-24 h-24 bg-white dark:bg-dark-bg rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-slate-200 dark:shadow-none p-2 border dark:border-dark-border">
          <img src={LIBRARY_LOGO} alt="Library Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
        </div>
        <h1 className="text-4xl font-bold text-slate-900 dark:text-dark-text mb-2 tracking-tight">NEU Library</h1>
        <p className="text-slate-500 dark:text-dark-muted mb-10 text-sm">Digital Access & Visitor Management System</p>
        
        {isCheckout && (
          <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800 text-left">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
              <ShieldAlert className="w-4 h-4" />
              <p className="text-xs font-bold uppercase tracking-wider">Check-out Detected</p>
            </div>
            <p className="text-xs text-slate-600 dark:text-dark-muted leading-relaxed">
              Please <strong>Admin Login</strong> to process this visitor's check-out.
            </p>
          </div>
        )}

        <div className="space-y-4">
          <button 
            onClick={() => onLogin('Student')}
            className="w-full flex items-center justify-center gap-4 py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none active:scale-95 group"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 brightness-0 invert" />
            Visitor Login
          </button>

          <button 
            onClick={() => onLogin('Admin')}
            className="w-full flex items-center justify-center gap-4 py-4 bg-slate-900 dark:bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-700 transition-all shadow-lg shadow-slate-200 dark:shadow-none active:scale-95 group"
          >
            <ShieldAlert className="w-5 h-5" />
            Admin Login
          </button>

          <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 dark:text-dark-muted font-bold uppercase tracking-widest pt-4">
            <ShieldAlert className="w-3 h-3" />
            <span>@neu.edu.ph accounts only</span>
          </div>

          {/* Open in New Tab helper for iframe issues */}
          <div className="pt-6 border-t border-slate-50 dark:border-dark-border">
            <button 
              onClick={() => window.open(window.location.href, '_blank')}
              className="flex items-center justify-center gap-2 mx-auto text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-bold uppercase tracking-widest transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Open in New Tab if login fails</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const SetupProfileView = ({ 
  user, 
  initialProfile,
  intendedRole,
  onComplete,
  onCancel
}: { 
  user: FirebaseUser, 
  initialProfile?: UserProfile | null,
  intendedRole: UserRole,
  onComplete: (p: UserProfile) => void,
  onCancel?: () => void
}) => {
  const isEmailAdmin = ADMIN_EMAILS.includes(user.email || '');
  const [role] = useState<UserRole>(isEmailAdmin ? 'Admin' : (initialProfile?.role || intendedRole));
  const [college, setCollege] = useState(initialProfile?.college_office || COLLEGES_OFFICES[0]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    const profile: UserProfile = {
      uid: user.uid,
      email: user.email!,
      fullName: user.displayName || '',
      role,
      college_office: college,
      isSetupComplete: true,
      isBlocked: initialProfile?.isBlocked || false
    };

    try {
      await setDoc(doc(db, 'users', user.uid), profile);
      onComplete(profile);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-dark-bg transition-colors duration-300">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-lg w-full bg-white dark:bg-dark-card rounded-3xl shadow-xl p-10 border border-slate-100 dark:border-dark-border"
      >
        <div className="flex justify-between items-start mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-dark-text mb-1">
              {initialProfile ? 'Update Profile' : 'Complete Profile'}
            </h2>
            <p className="text-slate-500 dark:text-dark-muted text-sm">Provide your details to continue.</p>
          </div>
          {onCancel && (
            <button onClick={onCancel} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all">
              <XCircle className="w-6 h-6 text-slate-400 dark:text-dark-muted" />
            </button>
          )}
        </div>
        
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-400 dark:text-dark-muted uppercase tracking-widest mb-1">Account Role</label>
            <p className="text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-xl inline-block">{role}</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 dark:text-dark-muted uppercase tracking-widest mb-3">College / Office</label>
            <select 
              value={college}
              onChange={(e) => setCollege(e.target.value)}
              className="w-full p-4 bg-slate-50 dark:bg-dark-bg border border-slate-100 dark:border-dark-border rounded-xl text-slate-700 dark:text-dark-text focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-bold"
            >
              {COLLEGES_OFFICES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <button 
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-200 dark:shadow-none"
          >
            {submitting ? 'Saving...' : initialProfile ? 'Update Profile' : 'Get Started'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const Header = ({ 
  profile, 
  sessionRole,
  onLogout, 
  activeTab, 
  setActiveTab, 
  onOpenScanner,
  onEditProfile,
  occupancy,
  darkMode,
  setDarkMode
}: { 
  profile: UserProfile, 
  sessionRole: UserRole,
  onLogout: () => void,
  activeTab: string,
  setActiveTab: (t: 'log' | 'admin' | 'profile') => void,
  onOpenScanner: () => void,
  onEditProfile: () => void,
  occupancy: number,
  darkMode: boolean,
  setDarkMode: React.Dispatch<React.SetStateAction<boolean>>
}) => {
  return (
    <header className="flex flex-col gap-8 mb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-white dark:bg-dark-card rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100 dark:shadow-none p-1.5 border dark:border-dark-border">
            <img src={LIBRARY_LOGO} alt="Library Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-dark-text tracking-tight">NEU Library</h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <p className="text-[10px] font-bold text-slate-400 dark:text-dark-muted uppercase tracking-widest">{occupancy} Active Visitors</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setDarkMode(prev => !prev)}
            className="p-3 bg-white dark:bg-dark-card border border-slate-100 dark:border-dark-border rounded-2xl shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {darkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-slate-600 dark:text-dark-muted" />}
          </button>

          <div className="flex items-center gap-3 bg-white dark:bg-dark-card p-1.5 rounded-2xl shadow-sm border border-slate-100 dark:border-dark-border">
            <div className="flex items-center gap-3 px-3 py-1.5">
              <div className="w-9 h-9 bg-slate-50 dark:bg-dark-bg rounded-full flex items-center justify-center overflow-hidden border border-slate-100 dark:border-dark-border">
                <UserCircle className="w-6 h-6 text-slate-300 dark:text-dark-muted" />
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-bold text-slate-900 dark:text-dark-text leading-none">{profile.fullName}</p>
                <p className="text-[9px] font-bold text-slate-400 dark:text-dark-muted uppercase tracking-wider mt-1">{sessionRole}</p>
              </div>
            </div>
            <div className="w-px h-6 bg-slate-100 dark:bg-dark-border" />
            <button 
              onClick={onLogout}
              className="p-2.5 text-slate-400 dark:text-dark-muted hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <nav className="flex items-center gap-1 bg-slate-100 dark:bg-dark-bg p-1 rounded-xl w-fit border dark:border-dark-border">
        <button 
          onClick={() => setActiveTab('log')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'log' 
            ? 'bg-white dark:bg-dark-card text-blue-600 dark:text-blue-400 shadow-sm' 
            : 'text-slate-500 dark:text-dark-muted hover:text-slate-900 dark:hover:text-dark-text'
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          Dashboard
        </button>
        {profile.role === 'Admin' && sessionRole === 'Admin' && (
          <button 
            onClick={() => setActiveTab('admin')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'admin' 
              ? 'bg-white dark:bg-dark-card text-blue-600 dark:text-blue-400 shadow-sm' 
              : 'text-slate-500 dark:text-dark-muted hover:text-slate-900 dark:hover:text-dark-text'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Admin Panel
          </button>
        )}
        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'profile' 
            ? 'bg-white dark:bg-dark-card text-blue-600 dark:text-blue-400 shadow-sm' 
            : 'text-slate-500 dark:text-dark-muted hover:text-slate-900 dark:hover:text-dark-text'
          }`}
        >
          <UserCircle className="w-3.5 h-3.5" />
          Profile
        </button>
        {profile.role === 'Admin' && sessionRole === 'Admin' && (
          <button 
            onClick={onOpenScanner}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-sm dark:shadow-none ml-1"
          >
            <QrCode className="w-3.5 h-3.5" />
            Scan QR
          </button>
        )}
      </nav>
    </header>
  );
};

const ProfileSettingsView = ({ profile, onUpdate }: { profile: UserProfile, onUpdate: (p: UserProfile) => void, key?: string }) => {
  const [college, setCollege] = useState(profile.college_office);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleUpdate = async () => {
    setSubmitting(true);
    setSuccess(false);
    const updatedProfile: UserProfile = {
      ...profile,
      college_office: college
    };

    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        college_office: college
      });
      onUpdate(updatedProfile);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-2xl mx-auto"
    >
      <div className="bg-white dark:bg-dark-card rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-dark-border">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400">
            <UserCircle className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-dark-text">Profile Settings</h2>
            <p className="text-slate-500 dark:text-dark-muted text-xs">Manage your library account information</p>
          </div>
        </div>

        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 dark:text-dark-muted uppercase tracking-widest ml-1">Full Name</label>
              <div className="p-4 bg-slate-50 dark:bg-dark-bg rounded-xl text-slate-500 dark:text-dark-muted border border-slate-100 dark:border-dark-border cursor-not-allowed text-sm font-medium">
                {profile.fullName}
              </div>
              <p className="text-[10px] text-slate-400 dark:text-dark-muted ml-1 italic">Synced with Google account</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 dark:text-dark-muted uppercase tracking-widest ml-1">Email Address</label>
              <div className="p-4 bg-slate-50 dark:bg-dark-bg rounded-xl text-slate-500 dark:text-dark-muted border border-slate-100 dark:border-dark-border cursor-not-allowed text-sm font-medium">
                {profile.email}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 dark:text-dark-muted uppercase tracking-widest ml-1">Account Role</label>
            <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30 text-sm font-bold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              {profile.role}
            </div>
            <p className="text-[10px] text-slate-400 dark:text-dark-muted ml-1 italic">Role is fixed based on your initial login</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 dark:text-dark-muted uppercase tracking-widest ml-1">College / Office</label>
            <select 
              value={college}
              onChange={(e) => setCollege(e.target.value)}
              className="w-full p-4 bg-slate-50 dark:bg-dark-bg border border-slate-100 dark:border-dark-border rounded-xl text-slate-700 dark:text-dark-text focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-bold"
            >
              {COLLEGES_OFFICES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="pt-4 flex items-center gap-4">
            <button 
              onClick={handleUpdate}
              disabled={submitting}
              className="flex-1 py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-200 dark:shadow-none"
            >
              {submitting ? 'Updating...' : 'Save Changes'}
              {!submitting && <CheckCircle2 className="w-5 h-5" />}
            </button>
            
            {success && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-blue-600 font-bold text-sm flex items-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                Updated!
              </motion.div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 p-6 bg-slate-900 rounded-3xl text-white flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-bold">Account Security</p>
            <p className="text-xs text-slate-400">Your account is protected by Google Authentication</p>
          </div>
        </div>
        <div className="text-[10px] text-slate-500 font-mono">
          UID: {profile.uid.substring(0, 8)}...
        </div>
      </div>
    </motion.div>
  );
};

const QRScannerModal = ({ onClose }: { onClose: () => void }) => {
  const [scanning, setScanning] = useState(true);
  const [result, setResult] = useState<{ success: boolean, message: string } | null>(null);
  const [mode, setMode] = useState<'camera' | 'file' | 'manual'>('camera');
  const [manualCode, setManualCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const scannerRef = React.useRef<Html5Qrcode | null>(null);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.length !== 4) return;

    setIsProcessing(true);
    try {
      const q = query(
        collection(db, 'logs'),
        where('shortCode', '==', manualCode),
        where('checkOutTime', '==', null),
        limit(1)
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        setResult({ success: false, message: 'Invalid or expired code.' });
        setScanning(false);
      } else {
        const logDoc = snapshot.docs[0];
        await updateDoc(doc(db, 'logs', logDoc.id), {
          checkOutTime: serverTimestamp()
        });
        setResult({ success: true, message: `Successfully checked out ${logDoc.data().userName || 'Visitor'}` });
        setScanning(false);
      }
    } catch (err) {
      console.error("Manual checkout error:", err);
      setResult({ success: false, message: 'Error processing check-out.' });
      setScanning(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const processDecodedText = async (decodedText: string) => {
    try {
      let logId = '';
      
      if (decodedText.includes('/checkout/')) {
        try {
          const url = new URL(decodedText);
          const pathParts = url.pathname.split('/');
          logId = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2];
        } catch (e) {
          logId = decodedText.split('/checkout/').pop()?.split('?')[0] || '';
        }
      } else if (decodedText.includes('?checkout=')) {
        try {
          const url = new URL(decodedText);
          logId = url.searchParams.get('checkout') || '';
        } catch (e) {
          logId = decodedText.split('checkout=').pop()?.split('&')[0] || '';
        }
      } else {
        try {
          const data = JSON.parse(decodedText);
          if (data.type === 'checkout' && data.logId) {
            logId = data.logId;
          }
        } catch (e) {
          if (decodedText.trim().length >= 15 && /^[a-zA-Z0-9_-]+$/.test(decodedText.trim())) {
            logId = decodedText.trim();
          }
        }
      }

      if (logId) {
        if (scannerRef.current && scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        setScanning(false);
        setIsProcessing(true);
        
        const logRef = doc(db, 'logs', logId);
        const logSnap = await getDoc(logRef);
        
        if (logSnap.exists()) {
          const logData = logSnap.data();
          if (logData.checkOutTime) {
            setResult({ success: false, message: 'Visitor already checked out.' });
          } else {
            await updateDoc(logRef, {
              checkOutTime: serverTimestamp()
            });
            setResult({ success: true, message: 'Check-out successful!' });
          }
        } else {
          setResult({ success: false, message: 'Invalid log entry.' });
        }
        setIsProcessing(false);
      } else {
        setResult({ success: false, message: 'Could not find a valid check-out ID in this QR code.' });
        setScanning(false);
      }
    } catch (err) {
      console.error("Scan processing error:", err);
      setResult({ success: false, message: 'Error processing scan. Please try again.' });
      setScanning(false);
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (!scanning || mode !== 'camera') return;

    const html5QrCode = new Html5Qrcode("reader");
    scannerRef.current = html5QrCode;

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    html5QrCode.start(
      { facingMode: "environment" },
      config,
      (decodedText) => {
        processDecodedText(decodedText);
      },
      (errorMessage) => {
        // Ignore errors during scanning
      }
    ).catch((err) => {
      console.error("Camera start error:", err);
    });

    return () => {
      if (html5QrCode.isScanning) {
        html5QrCode.stop().catch(e => console.error("Stop error:", e));
      }
    };
  }, [scanning, mode]);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setFilePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleFileSelect(file);
    }
  };

  const scanSelectedFile = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    const html5QrCode = new Html5Qrcode("reader-hidden");
    
    try {
      const decodedText = await html5QrCode.scanFile(selectedFile, true);
      await processDecodedText(decodedText);
    } catch (err) {
      console.error("File scan error:", err);
      setResult({ success: false, message: 'Could not find a valid QR code in this image.' });
      setScanning(false);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-dark-card rounded-3xl p-8 max-w-md w-full shadow-2xl dark:shadow-none border dark:border-dark-border"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-slate-900 dark:text-dark-text">QR Scanner</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all">
            <XCircle className="w-6 h-6 text-slate-400 dark:text-dark-muted" />
          </button>
        </div>

        {scanning ? (
          <div className="space-y-6">
            <div className="flex p-1 bg-slate-100 dark:bg-dark-bg rounded-2xl">
              <button 
                onClick={() => {
                  setMode('camera');
                  setSelectedFile(null);
                  setFilePreview(null);
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${mode === 'camera' ? 'bg-white dark:bg-dark-card text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-dark-muted'}`}
              >
                Camera
              </button>
              <button 
                onClick={() => setMode('file')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${mode === 'file' ? 'bg-white dark:bg-dark-card text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-dark-muted'}`}
              >
                Upload Image
              </button>
              <button 
                onClick={() => {
                  setMode('manual');
                  setScanning(false);
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${mode === 'manual' ? 'bg-white dark:bg-dark-card text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-dark-muted'}`}
              >
                Code
              </button>
            </div>

            {mode === 'camera' ? (
              <div className="space-y-4">
                <div id="reader" className="overflow-hidden rounded-2xl border-2 border-slate-100 dark:border-dark-border aspect-square bg-slate-50 dark:bg-dark-bg relative">
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center p-8">
                      <Clock className="w-10 h-10 text-slate-300 dark:text-dark-muted mx-auto mb-2 animate-pulse" />
                      <p className="text-xs text-slate-400 dark:text-dark-muted">Initializing camera...</p>
                    </div>
                  </div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                  <p className="text-[10px] text-blue-700 dark:text-blue-300 leading-relaxed">
                    <strong>Tip:</strong> If scanning with your phone's native camera shows a "403 Forbidden" error, please use the <strong>"Code"</strong> tab above to enter the 4-digit code manually.
                  </p>
                </div>
                <p className="text-center text-sm text-slate-500 dark:text-dark-muted">Position the visitor's QR code within the frame</p>
              </div>
            ) : (
              <div className="space-y-4">
                {!selectedFile ? (
                  <label 
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-slate-200 dark:border-dark-border rounded-2xl bg-slate-50 dark:bg-dark-bg/50 hover:bg-slate-100 dark:hover:bg-dark-bg transition-all cursor-pointer group"
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <QrCode className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                      </div>
                      <p className="mb-2 text-sm text-slate-700 dark:text-dark-text font-bold px-4 text-center">Click to upload or drag and drop QR image</p>
                      <p className="text-xs text-slate-500 dark:text-dark-muted">PNG, JPG or SVG</p>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                  </label>
                ) : (
                  <div className="space-y-4">
                    <div className="relative w-full h-64 bg-slate-50 dark:bg-dark-bg rounded-2xl overflow-hidden border-2 border-blue-100 dark:border-blue-900/30">
                      {filePreview && (
                        <img src={filePreview} alt="QR Preview" className="w-full h-full object-contain p-4" />
                      )}
                      <button 
                        onClick={() => {
                          setSelectedFile(null);
                          setFilePreview(null);
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-white/80 dark:bg-dark-card/80 backdrop-blur shadow-sm rounded-full text-slate-500 dark:text-dark-muted hover:text-red-500 transition-all"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                    <button 
                      onClick={scanSelectedFile}
                      disabled={isProcessing}
                      className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none flex items-center justify-center gap-2"
                    >
                      <Search className="w-5 h-5" />
                      {isProcessing ? 'Processing...' : 'Scan Image Now'}
                    </button>
                  </div>
                )}
                <div id="reader-hidden" className="hidden"></div>
              </div>
            )}
          </div>
        ) : mode === 'manual' && !result ? (
          <div className="space-y-6 py-8">
            <div className="text-center">
              <p className="text-sm text-slate-500 dark:text-dark-muted mb-4">Enter the 4-digit code from the visitor's pass</p>
              <form onSubmit={handleManualSubmit} className="flex flex-col items-center gap-6">
                <input 
                  type="text"
                  maxLength={4}
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="0000"
                  className="w-40 text-center text-4xl font-black tracking-[0.5em] py-4 bg-slate-50 dark:bg-dark-bg border-2 border-slate-200 dark:border-dark-border rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all dark:text-dark-text"
                  autoFocus
                />
                <button 
                  type="submit"
                  disabled={manualCode.length !== 4 || isProcessing}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-200 dark:shadow-none"
                >
                  {isProcessing ? 'Verifying...' : 'Confirm Check-out'}
                </button>
              </form>
            </div>
            <button 
              onClick={() => {
                setScanning(true);
                setMode('camera');
              }}
              className="w-full text-sm font-bold text-slate-400 dark:text-dark-muted hover:text-slate-600 dark:hover:text-dark-text transition-all"
            >
              Back to Camera
            </button>
          </div>
        ) : (
          <div className="py-8 text-center space-y-4">
            {isProcessing ? (
              <div className="space-y-4">
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-slate-600 dark:text-dark-muted font-bold">Processing check-out...</p>
              </div>
            ) : (
              <>
                {result?.success ? (
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                  </div>
                ) : (
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto">
                    <ShieldAlert className="w-10 h-10 text-red-600 dark:text-red-400" />
                  </div>
                )}
                <h4 className={`text-lg font-bold ${result?.success ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                  {result?.message}
                </h4>
                <button 
                  onClick={() => {
                    setResult(null);
                    setScanning(true);
                    setMode('camera');
                    setSelectedFile(null);
                    setFilePreview(null);
                  }}
                  className="px-6 py-3 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl font-bold hover:bg-slate-800 dark:hover:bg-slate-700 transition-all w-full"
                >
                  Scan Another
                </button>
              </>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};

const VisitorLogView = ({ profile, sessionRole, darkMode }: { profile: UserProfile, sessionRole: UserRole, darkMode: boolean, key?: string }) => {
  const [activeLog, setActiveLog] = useState<VisitorLog | null>(null);
  const [history, setHistory] = useState<VisitorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectingReason, setSelectingReason] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    // Active Log Listener
    const qActive = query(
      collection(db, 'logs'),
      where('uid', '==', profile.uid),
      where('checkOutTime', '==', null),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    const unsubscribeActive = onSnapshot(qActive, (snapshot) => {
      if (!snapshot.empty) {
        setActiveLog({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as VisitorLog);
      } else {
        setActiveLog(null);
      }
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, 'logs');
    });

    // History Listener (Last 5 visits)
    const qHistory = query(
      collection(db, 'logs'),
      where('uid', '==', profile.uid),
      where('checkOutTime', '!=', null),
      orderBy('checkOutTime', 'desc'),
      limit(5)
    );

    const unsubscribeHistory = onSnapshot(qHistory, (snapshot) => {
      setHistory(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as VisitorLog)));
    }, (error) => {
      console.error("History listener error:", error);
    });

    return () => {
      unsubscribeActive();
      unsubscribeHistory();
    };
  }, [profile.uid]);

  const handleCheckIn = async (reason: string) => {
    if (profile.isBlocked) {
      alert('Your account is currently blocked. Please contact the administrator.');
      return;
    }

    const newLog: VisitorLog = {
      uid: profile.uid,
      timestamp: serverTimestamp(),
      checkOutTime: null,
      reason,
      userEmail: profile.email,
      college_office: profile.college_office,
      shortCode: Math.floor(1000 + Math.random() * 9000).toString() // Generate 4-digit code
    };

    try {
      await addDoc(collection(db, 'logs'), newLog);
      setSelectingReason(false);
      setShowSuccess(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'logs');
    }
  };

  const handleCheckOut = async () => {
    if (!activeLog?.id) return;
    try {
      await updateDoc(doc(db, 'logs', activeLog.id), {
        checkOutTime: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `logs/${activeLog.id}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="grid lg:grid-cols-3 gap-8"
    >
      <div className="lg:col-span-2 space-y-8">
        <div className="bg-white dark:bg-dark-card rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-dark-border relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 dark:bg-blue-900/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl opacity-50" />
          
          <h3 className="text-xl font-bold text-slate-900 dark:text-dark-text mb-8 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            Library Status
          </h3>
          
          {activeLog ? (
            <div className="space-y-8">
              <div className="flex items-center gap-6 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
                <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-none">
                  <CheckCircle2 className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="text-lg font-bold text-blue-700 dark:text-blue-400">You are Checked In</p>
                  <p className="text-[10px] text-blue-500 dark:text-blue-300 font-bold uppercase tracking-widest">
                    Since {activeLog.timestamp?.toDate ? format(activeLog.timestamp.toDate(), 'hh:mm a') : 'Just now'}
                  </p>
                </div>
              </div>
              
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-5 bg-slate-50 dark:bg-dark-bg rounded-2xl border border-slate-100 dark:border-dark-border">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-dark-muted uppercase tracking-widest mb-1">Purpose</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-dark-text">{activeLog.reason}</p>
                </div>
                <div className="p-5 bg-slate-50 dark:bg-dark-bg rounded-2xl border border-slate-100 dark:border-dark-border">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-dark-muted uppercase tracking-widest mb-1">Location</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-dark-text">Main Library</p>
                </div>
              </div>

              <button 
                onClick={handleCheckOut}
                className="w-full py-4 bg-slate-900 dark:bg-slate-800 text-white rounded-xl font-bold text-base hover:bg-slate-800 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-3 shadow-lg active:scale-[0.98]"
              >
                <LogOut className="w-5 h-5" />
                Check Out of Library
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex items-center gap-6 p-6 bg-slate-50 dark:bg-dark-bg rounded-2xl border border-slate-100 dark:border-dark-border">
                <div className="w-14 h-14 bg-slate-200 dark:bg-slate-800 rounded-xl flex items-center justify-center">
                  <XCircle className="w-7 h-7 text-slate-400 dark:text-dark-muted" />
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-900 dark:text-dark-text">Not Checked In</p>
                  <p className="text-[10px] text-slate-400 dark:text-dark-muted font-bold uppercase tracking-widest">Ready for your visit</p>
                </div>
              </div>

              {selectingReason ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                >
                  {VISIT_REASONS.map(reason => (
                    <button
                      key={reason}
                      onClick={() => handleCheckIn(reason)}
                      className="p-4 text-left bg-white dark:bg-dark-card hover:bg-blue-600 dark:hover:bg-blue-600 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-100 dark:border-dark-border hover:border-blue-600 shadow-sm hover:shadow-lg hover:shadow-blue-200 dark:shadow-none group"
                    >
                      <div className="flex items-center justify-between dark:text-dark-text group-hover:text-white">
                        {reason}
                        <ArrowRightLeft className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-all" />
                      </div>
                    </button>
                  ))}
                  <button 
                    onClick={() => setSelectingReason(false)}
                    className="sm:col-span-2 py-2 text-[10px] text-slate-400 dark:text-dark-muted hover:text-slate-600 dark:hover:text-dark-text font-bold uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                </motion.div>
              ) : (
                <button 
                  onClick={() => setSelectingReason(true)}
                  disabled={profile.isBlocked}
                  className="w-full py-5 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none disabled:opacity-50 active:scale-[0.98]"
                >
                  {profile.isBlocked ? 'Access Denied' : 'Check In to Library'}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-dark-card rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-dark-border relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 dark:bg-blue-900/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl opacity-30" />
          <h4 className="text-lg font-bold text-slate-900 dark:text-dark-text mb-6 flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Library Guidelines
          </h4>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="space-y-2">
              <p className="text-blue-600 dark:text-blue-400 font-bold text-base">01</p>
              <p className="text-xs text-slate-500 dark:text-dark-muted font-medium leading-relaxed">Maintain silence at all times for fellow researchers.</p>
            </div>
            <div className="space-y-2">
              <p className="text-blue-600 dark:text-blue-400 font-bold text-base">02</p>
              <p className="text-xs text-slate-500 dark:text-dark-muted font-medium leading-relaxed">Food and drinks are strictly prohibited inside.</p>
            </div>
            <div className="space-y-2">
              <p className="text-blue-600 dark:text-blue-400 font-bold text-base">03</p>
              <p className="text-xs text-slate-500 dark:text-dark-muted font-medium leading-relaxed">Always check out before leaving the premises.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {history.length > 0 && (
          <div className="bg-white dark:bg-dark-card rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-dark-border">
            <h4 className="text-lg font-black text-slate-900 dark:text-dark-text mb-6 flex items-center gap-3">
              <Clock className="w-5 h-5 text-slate-400 dark:text-dark-muted" />
              Recent Visits
            </h4>
            <div className="space-y-4">
              {history.map(log => (
                <div key={log.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-dark-bg rounded-[20px] border border-slate-100 dark:border-dark-border group hover:bg-white dark:hover:bg-dark-card hover:shadow-md transition-all">
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-dark-text">{log.reason}</p>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-dark-muted uppercase tracking-widest mt-1">
                      {log.timestamp?.toDate ? format(log.timestamp.toDate(), 'MMM d, yyyy') : '---'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-library uppercase">
                      {log.timestamp?.toDate && log.checkOutTime?.toDate ? 
                        `${differenceInMinutes(log.checkOutTime.toDate(), log.timestamp.toDate())}m` : '---'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Success Message */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-blue-900/20 backdrop-blur-md"
          >
            <div className="bg-white dark:bg-dark-card rounded-[40px] p-12 shadow-2xl border-4 border-blue-500 text-center max-w-lg w-full">
              <div className="w-24 h-24 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-8">
                <CheckCircle2 className="w-12 h-12 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-4xl font-black text-slate-900 dark:text-dark-text mb-4">Welcome to Library!</h2>
              <p className="text-slate-500 dark:text-dark-muted text-lg mb-6">Your entry has been recorded. Enjoy your stay!</p>
              
              {activeLog && (
                <div className="bg-blue-50 dark:bg-dark-bg p-6 rounded-3xl border-2 border-blue-100 dark:border-dark-border mb-8">
                  <p className="text-[10px] font-black text-blue-400 dark:text-blue-500 uppercase tracking-[0.2em] mb-2">Your Check-out Code</p>
                  <p className="text-4xl font-black text-blue-600 dark:text-blue-400 font-mono tracking-widest">
                    {activeLog.shortCode}
                  </p>
                  <p className="text-[10px] text-blue-500 dark:text-blue-300 mt-2 font-bold">Show this or the QR code when you leave</p>
                </div>
              )}

              <button 
                onClick={() => setShowSuccess(false)}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 dark:shadow-none"
              >
                Continue
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white dark:bg-dark-card rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-dark-border flex flex-col items-center justify-center text-center">
        <h3 className="text-xl font-bold text-slate-900 dark:text-dark-text mb-2">Your Access Pass</h3>
        <p className="text-sm text-slate-500 dark:text-dark-muted mb-8">Scan this QR code at the counter for quick check-out.</p>
        
        <div className="p-6 bg-white rounded-3xl border-2 border-slate-100 dark:border-dark-border mb-8 shadow-inner">
          {activeLog ? (
            <div className="flex flex-col items-center gap-6">
              <div className="relative group cursor-pointer" onClick={() => {
                const svg = document.querySelector('.qr-svg') as SVGElement;
                if (svg) {
                  const svgData = new XMLSerializer().serializeToString(svg);
                  const canvas = document.createElement("canvas");
                  const ctx = canvas.getContext("2d");
                  const img = new Image();
                  img.onload = () => {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    if (ctx) {
                      ctx.fillStyle = "white";
                      ctx.fillRect(0, 0, canvas.width, canvas.height);
                      ctx.drawImage(img, 0, 0);
                    }
                    const pngFile = canvas.toDataURL("image/png");
                    const downloadLink = document.createElement("a");
                    downloadLink.download = `NEU_Pass_${profile.fullName.replace(/\s+/g, '_')}.png`;
                    downloadLink.href = pngFile;
                    downloadLink.click();
                  };
                  img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
                }
              }}>
                <QRCodeSVG 
                  value={`${window.location.origin}/?checkout=${activeLog.id}`}
                  size={220}
                  level="H"
                  includeMargin={true}
                  className="rounded-lg qr-svg"
                />
                <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/40 flex items-center justify-center rounded-lg transition-all opacity-0 group-hover:opacity-100">
                  <div className="text-white text-xs font-bold flex flex-col items-center gap-2">
                    <QrCode className="w-6 h-6" />
                    <span>Click to Download</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-50 dark:bg-dark-bg px-6 py-3 rounded-2xl border border-slate-200 dark:border-dark-border shadow-sm">
                <p className="text-[10px] font-black text-slate-400 dark:text-dark-muted uppercase tracking-[0.2em] mb-1">Manual Check-out Code</p>
                <p className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono tracking-widest">
                  {activeLog.shortCode}
                </p>
              </div>
            </div>
          ) : (
            <div className="w-[220px] h-[220px] flex items-center justify-center bg-slate-50 dark:bg-dark-bg rounded-lg text-slate-300 dark:text-dark-muted">
              <QrCode className="w-20 h-20 opacity-20" />
            </div>
          )}
        </div>

        <div className="space-y-1">
          <p className="text-lg font-bold text-slate-900 dark:text-dark-text">{profile.fullName}</p>
          <p className="text-sm text-slate-500 dark:text-dark-muted font-medium">{profile.role} • {profile.college_office}</p>
        </div>
        
        {!activeLog && (
          <p className="mt-6 text-xs text-slate-400 font-medium italic">
            Check in to activate your pass
          </p>
        )}
      </div>
    </motion.div>
  );
};

const AdminDashboardView = ({ profile, darkMode }: { profile: UserProfile, darkMode: boolean, key?: string }) => {
  const [stats, setStats] = useState({
    totalToday: 0,
    activeNow: 0,
    mostCommonReason: '---',
    byDept: [] as { name: string, value: number }[],
    peakHours: [] as { hour: string, count: number }[]
  });
  const [dateRange, setDateRange] = useState<'today' | 'weekly' | 'monthly' | 'custom'>('today');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [logs, setLogs] = useState<VisitorLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [logSearchTerm, setLogSearchTerm] = useState('');
  const [selectedUserHistory, setSelectedUserHistory] = useState<{ user: UserProfile, logs: VisitorLog[] } | null>(null);

  useEffect(() => {
    let startDate: Date;
    const now = new Date();

    switch (dateRange) {
      case 'weekly':
        startDate = startOfWeek(now);
        break;
      case 'monthly':
        startDate = startOfMonth(now);
        break;
      case 'custom':
        startDate = customRange.start ? new Date(customRange.start) : startOfDay(now);
        break;
      default:
        startDate = startOfDay(now);
    }

    let q = query(
      collection(db, 'logs'),
      where('timestamp', '>=', Timestamp.fromDate(startDate)),
      orderBy('timestamp', 'desc')
    );

    if (dateRange === 'custom' && customRange.end) {
      const endDate = new Date(customRange.end);
      endDate.setHours(23, 59, 59, 999);
      q = query(q, where('timestamp', '<=', Timestamp.fromDate(endDate)));
    }

    const unsubscribeLogs = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as VisitorLog));
      setLogs(logsData);
      
      const deptMap: Record<string, number> = {};
      const hourMap: Record<string, number> = {};
      const reasonMap: Record<string, number> = {};
      let activeCount = 0;

      logsData.forEach(log => {
        // Dept stats
        deptMap[log.college_office] = (deptMap[log.college_office] || 0) + 1;
        
        // Reason stats
        reasonMap[log.reason] = (reasonMap[log.reason] || 0) + 1;
        
        // Hour stats
        if (log.timestamp?.toDate) {
          const hour = format(log.timestamp.toDate(), 'HH:00');
          hourMap[hour] = (hourMap[hour] || 0) + 1;
        }

        // Active count
        if (!log.checkOutTime) activeCount++;
      });

      const mostCommon = Object.entries(reasonMap).sort((a, b) => b[1] - a[1])[0]?.[0] || '---';

      setStats({
        totalToday: logsData.length,
        activeNow: activeCount,
        mostCommonReason: mostCommon,
        byDept: Object.entries(deptMap).map(([name, value]) => ({ name, value })),
        peakHours: Object.entries(hourMap).map(([hour, count]) => ({ hour, count })).sort((a, b) => a.hour.localeCompare(b.hour))
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'logs');
    });

    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(d => ({ ...d.data(), uid: d.id } as UserProfile)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => {
      unsubscribeLogs();
      unsubscribeUsers();
    };
  }, []);

  const toggleBlock = async (user: UserProfile) => {
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        isBlocked: !user.isBlocked
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const filteredUsers = users.filter(u => 
    u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredLogs = logs.filter(l => 
    l.userEmail.toLowerCase().includes(logSearchTerm.toLowerCase()) ||
    l.reason.toLowerCase().includes(logSearchTerm.toLowerCase()) ||
    l.college_office.toLowerCase().includes(logSearchTerm.toLowerCase())
  );

  const exportToCSV = () => {
    const headers = ['Email', 'Department', 'Reason', 'Check-In', 'Check-Out'];
    const rows = logs.map(l => [
      l.userEmail,
      l.college_office,
      l.reason,
      l.timestamp?.toDate ? format(l.timestamp.toDate(), 'yyyy-MM-dd HH:mm:ss') : '',
      l.checkOutTime?.toDate ? format(l.checkOutTime.toDate(), 'yyyy-MM-dd HH:mm:ss') : 'Active'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `NEU_Library_Logs_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const COLORS = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#2563eb', '#1d4ed8'];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      {/* Date Range Filter */}
      <div className="bg-white dark:bg-dark-card p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-dark-border flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-dark-text">Analytics Range</h3>
          <p className="text-xs text-slate-500 dark:text-dark-muted">Filter statistics and logs by period</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['today', 'weekly', 'monthly', 'custom'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                dateRange === r 
                ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-lg' 
                : 'bg-slate-50 dark:bg-dark-bg text-slate-500 dark:text-dark-muted hover:bg-slate-100 dark:hover:bg-dark-border'
              }`}
            >
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
          {dateRange === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <input 
                type="date" 
                value={customRange.start}
                onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                className="px-3 py-2 bg-slate-50 dark:bg-dark-bg border border-slate-100 dark:border-dark-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 dark:text-dark-text"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input 
                type="date" 
                value={customRange.end}
                onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                className="px-3 py-2 bg-slate-50 dark:bg-dark-bg border border-slate-100 dark:border-dark-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 dark:text-dark-text"
              />
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-dark-card p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-dark-border hover:shadow-lg hover:shadow-blue-500/5 transition-all group">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-dark-muted uppercase tracking-widest">Total Visitors</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-dark-text font-mono">{stats.totalToday}</p>
            </div>
          </div>
          <div className="w-full h-1 bg-slate-100 dark:bg-dark-border rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 w-[70%]" />
          </div>
        </div>

        <div className="bg-white dark:bg-dark-card p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-dark-border hover:shadow-lg hover:shadow-blue-500/5 transition-all group">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <UserCheck className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-dark-muted uppercase tracking-widest">Active Now</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-dark-text font-mono">{stats.activeNow}</p>
            </div>
          </div>
          <div className="w-full h-1 bg-slate-100 dark:bg-dark-border rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 w-[40%] animate-pulse" />
          </div>
        </div>

        <div className="bg-white dark:bg-dark-card p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-dark-border hover:shadow-lg hover:shadow-blue-500/5 transition-all group">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <BarChart3 className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-dark-muted uppercase tracking-widest">Departments</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-dark-text font-mono">{stats.byDept.length}</p>
            </div>
          </div>
          <div className="w-full h-1 bg-slate-100 dark:bg-dark-border rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 w-[85%]" />
          </div>
        </div>

        <div className="bg-white dark:bg-dark-card p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-dark-border hover:shadow-lg hover:shadow-blue-500/5 transition-all group">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-dark-muted uppercase tracking-widest">Top Reason</p>
              <p className="text-lg font-bold text-slate-900 dark:text-dark-text truncate max-w-[120px]" title={stats.mostCommonReason}>
                {stats.mostCommonReason}
              </p>
            </div>
          </div>
          <div className="w-full h-1 bg-slate-100 dark:bg-dark-border rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 w-[60%]" />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-dark-card p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-dark-border">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-slate-900 dark:text-dark-text flex items-center gap-3">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Peak Hours
            </h3>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 dark:text-dark-muted uppercase tracking-widest">
              Today's Traffic
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.peakHours}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? '#1e293b' : '#f1f5f9'} />
                <XAxis 
                  dataKey="hour" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: darkMode ? '#64748b' : '#94a3b8', fontSize: 10, fontWeight: 700 }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: darkMode ? '#64748b' : '#94a3b8', fontSize: 10, fontWeight: 700 }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: darkMode ? '#0f172a' : '#ffffff',
                    borderRadius: '16px', 
                    border: darkMode ? '1px solid #1e293b' : 'none', 
                    boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
                    padding: '12px 20px',
                    color: darkMode ? '#f8fafc' : '#0f172a'
                  }}
                  itemStyle={{ color: darkMode ? '#f8fafc' : '#0f172a' }}
                  cursor={{ fill: darkMode ? '#1e293b' : '#f8fafc' }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-card p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-dark-border">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-slate-900 dark:text-dark-text flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Department Breakdown
            </h3>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 dark:text-dark-muted uppercase tracking-widest">
              Distribution
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.byDept}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {stats.byDept.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: darkMode ? '#0f172a' : '#ffffff',
                    borderRadius: '16px', 
                    border: darkMode ? '1px solid #1e293b' : 'none', 
                    boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
                    padding: '12px 20px',
                    color: darkMode ? '#f8fafc' : '#0f172a'
                  }}
                  itemStyle={{ color: darkMode ? '#f8fafc' : '#0f172a' }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  iconType="circle" 
                  wrapperStyle={{ 
                    fontSize: '10px', 
                    fontWeight: 'bold',
                    color: darkMode ? '#f8fafc' : '#0f172a'
                  }} 
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Logs Table */}
      <div className="bg-white dark:bg-dark-card rounded-3xl shadow-sm border border-slate-100 dark:border-dark-border overflow-hidden">
        <div className="p-8 border-b border-slate-50 dark:border-dark-border">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-dark-text">Today's Activity Logs</h3>
              <p className="text-xs text-slate-500 dark:text-dark-muted font-medium mt-1">Real-time monitoring of library entries and exits</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  placeholder="Filter logs..." 
                  value={logSearchTerm}
                  onChange={(e) => setLogSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-dark-bg border border-slate-100 dark:border-dark-border rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-56 transition-all font-bold dark:text-dark-text"
                />
              </div>
              <button 
                onClick={exportToCSV}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none active:scale-[0.98]"
              >
                <LogOut className="w-3.5 h-3.5 rotate-90" />
                Export CSV
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-dark-bg text-slate-400 dark:text-dark-muted text-[10px] uppercase tracking-widest">
                <th className="px-8 py-5 font-bold">Visitor Email</th>
                <th className="px-8 py-5 font-bold">Department</th>
                <th className="px-8 py-5 font-bold">Purpose</th>
                <th className="px-8 py-5 font-bold">Check-In</th>
                <th className="px-8 py-5 font-bold">Check-Out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-dark-border">
              {filteredLogs.length > 0 ? filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50/30 dark:hover:bg-dark-border/30 transition-colors group">
                  <td className="px-10 py-6">
                    <p className="text-sm font-black text-slate-900 dark:text-dark-text group-hover:text-library transition-colors">{log.userEmail}</p>
                  </td>
                  <td className="px-10 py-6">
                    <span className="text-xs text-slate-500 dark:text-dark-muted font-bold">{log.college_office}</span>
                  </td>
                  <td className="px-10 py-6">
                    <span className="px-4 py-1.5 bg-slate-100 dark:bg-dark-bg rounded-full text-[10px] font-black text-slate-600 dark:text-dark-muted uppercase tracking-widest">
                      {log.reason}
                    </span>
                  </td>
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-dark-muted font-bold">
                      <Clock className="w-3 h-3 text-library" />
                      {log.timestamp?.toDate ? format(log.timestamp.toDate(), 'hh:mm a') : '---'}
                    </div>
                  </td>
                  <td className="px-10 py-6">
                    {log.checkOutTime ? (
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-dark-muted font-bold">
                        <Clock className="w-3 h-3 text-slate-400 dark:text-dark-muted" />
                        {log.checkOutTime.toDate ? format(log.checkOutTime.toDate(), 'hh:mm a') : '---'}
                      </div>
                    ) : (
                      <span className="px-4 py-1.5 bg-library/10 text-library rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse border border-library/20">
                        Active
                      </span>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-10 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-slate-50 dark:bg-dark-bg rounded-full flex items-center justify-center">
                        <Search className="w-8 h-8 text-slate-200 dark:text-dark-muted" />
                      </div>
                      <p className="text-slate-400 dark:text-dark-muted text-sm font-bold">No logs found for today.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Management */}
      <div className="bg-white dark:bg-dark-card rounded-3xl shadow-sm border border-slate-100 dark:border-dark-border overflow-hidden">
        <div className="p-8 border-b border-slate-50 dark:border-dark-border">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-dark-text">User Management</h3>
              <p className="text-xs text-slate-500 dark:text-dark-muted font-medium mt-1">Manage library access and view profiles</p>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search users..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-dark-bg border border-slate-100 dark:border-dark-border rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-64 transition-all font-bold dark:text-dark-text"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-dark-bg text-slate-400 dark:text-dark-muted text-[10px] uppercase tracking-widest">
                <th className="px-8 py-5 font-bold">User</th>
                <th className="px-8 py-5 font-bold">Role</th>
                <th className="px-8 py-5 font-bold">Department</th>
                <th className="px-8 py-5 font-bold">Status</th>
                <th className="px-8 py-5 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-dark-border">
              {filteredUsers.map(user => (
                <tr key={user.uid} className="hover:bg-slate-50/30 dark:hover:bg-dark-border/30 transition-all group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center font-bold text-blue-600 dark:text-blue-400">
                        {user.fullName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-dark-text">{user.fullName}</p>
                        <p className="text-[10px] text-slate-400 dark:text-dark-muted font-bold">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border ${
                      user.role === 'Admin' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30' : 'bg-slate-50 dark:bg-dark-bg text-slate-600 dark:text-dark-muted border-slate-100 dark:border-dark-border'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-xs font-bold text-slate-600 dark:text-dark-muted">{user.college_office}</p>
                  </td>
                  <td className="px-8 py-5">
                    {user.isBlocked ? (
                      <span className="px-3 py-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full text-[9px] font-bold uppercase tracking-widest border border-red-100 dark:border-red-900/30">Blocked</span>
                    ) : (
                      <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full text-[9px] font-bold uppercase tracking-widest border border-blue-100 dark:border-blue-900/30">Active</span>
                    )}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button 
                        onClick={() => {
                          const userLogs = logs.filter(l => l.userEmail === user.email);
                          setSelectedUserHistory({ user, logs: userLogs });
                        }}
                        className="p-2 bg-white dark:bg-dark-card text-slate-600 dark:text-dark-muted rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm border border-slate-100 dark:border-dark-border"
                        title="View History"
                      >
                        <Clock className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => toggleBlock(user)}
                        className={`p-2 rounded-lg transition-all shadow-sm border ${
                          user.isBlocked 
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30 hover:bg-blue-600 dark:hover:bg-blue-600 hover:text-white dark:hover:text-white' 
                          : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900/30 hover:bg-red-600 dark:hover:bg-red-600 hover:text-white dark:hover:text-white'
                        }`}
                        title={user.isBlocked ? 'Unblock User' : 'Block User'}
                      >
                        {user.isBlocked ? <UserCheck className="w-3.5 h-3.5" /> : <UserMinus className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User History Modal */}
      <AnimatePresence>
        {selectedUserHistory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-dark-card rounded-3xl p-8 max-w-2xl w-full shadow-2xl max-h-[80vh] overflow-hidden flex flex-col border border-slate-100 dark:border-dark-border"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-dark-text">Visit History</h3>
                  <p className="text-sm text-slate-500 dark:text-dark-muted">{selectedUserHistory.user.fullName} ({selectedUserHistory.user.email})</p>
                </div>
                <button 
                  onClick={() => setSelectedUserHistory(null)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-dark-border rounded-full transition-all"
                >
                  <XCircle className="w-6 h-6 text-slate-400 dark:text-dark-muted" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 pr-2">
                <div className="space-y-4">
                  {selectedUserHistory.logs.length > 0 ? selectedUserHistory.logs.map(log => (
                    <div key={log.id} className="p-4 bg-slate-50 dark:bg-dark-bg rounded-2xl border border-slate-100 dark:border-dark-border flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-dark-text">{log.reason}</p>
                        <p className="text-[10px] text-slate-500 dark:text-dark-muted font-bold">
                          {log.timestamp?.toDate ? format(log.timestamp.toDate(), 'MMM d, yyyy • hh:mm a') : '---'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-600 dark:text-dark-muted">
                          {log.checkOutTime ? (
                            <span className="text-blue-600 dark:text-blue-400">
                              Duration: {differenceInMinutes(log.checkOutTime.toDate(), log.timestamp.toDate())} mins
                            </span>
                          ) : (
                            <span className="text-blue-600 dark:text-blue-400 animate-pulse">Currently Inside</span>
                          )}
                        </p>
                      </div>
                    </div>
                  )) : (
                    <div className="py-12 text-center text-slate-400 dark:text-dark-muted italic text-sm">
                      No visit records found for this user.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
