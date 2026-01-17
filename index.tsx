import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Clock, Calendar, AlertTriangle, CheckCircle, Trash2, Plus, AlertOctagon, ChevronRight, ChevronLeft, CalendarDays, LogOut, User as UserIcon, Loader2, LayoutDashboard, Save, Flame, Settings, Briefcase, Plane, Timer, Edit3, X, Lock, KeyRound, Construction, ShieldCheck, Users, Shield, Eye, EyeOff, Fingerprint, ScanFace, StickyNote, PenTool } from 'lucide-react';
import { DB, type User, type AttendanceEntry, type LeaveEntry, type NoteEntry } from './services/firebase';

const MAX_ALLOWANCE = 360;
const MAX_MONTHLY_PERMISSIONS = 3;

// --- Admin Configuration ---
const ADMIN_CREDENTIALS = {
    username: "admin",
    password: "Mohie@2026"
};

const VIRTUAL_ADMIN_USER: User = {
    id: 'virtual-admin-id',
    name: 'المدير العام',
    role: 'admin',
    annualBalance: 0,
    casualBalance: 0,
    password: ''
};

// --- WebAuthn / Biometrics Utilities ---
// Utility to encode ArrayBuffer to Base64 (for storage)
const bufferToBase64 = (buffer: ArrayBuffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
};

// Utility to decode Base64 to ArrayBuffer (for checking)
const base64ToBuffer = (base64: string) => {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
};

// --- Components ---

// شاشة الانتظار (تظهر بدلاً من إدخال البيانات)
const ComingSoon = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <div className="bg-white p-8 rounded-full shadow-lg mb-8 animate-pulse">
            <Construction className="w-16 h-16 text-teal-600" />
        </div>
        <h1 className="text-4xl font-extrabold text-slate-800 mb-4">قريباً</h1>
        <p className="text-xl text-slate-500 max-w-md leading-relaxed">
            نظام متابعة الحضور قيد الإعداد حالياً.
            <br />
            سيتم تفعيل الخدمة بمجرد اكتمال التجهيزات.
        </p>
        <div className="mt-8 px-4 py-2 bg-teal-50 text-teal-700 rounded-lg text-sm font-medium border border-teal-100">
            مخصص لموظفي دار الشفاء
        </div>
    </div>
  );
};

// User Login Modal
const LoginModal = ({ user, onClose, onSuccess }: { user: User, onClose: () => void, onSuccess: () => void }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [bioLoading, setBioLoading] = useState(false);

    // Check if biometric login is available for this user
    const hasBiometrics = !!user.biometricCredId;
    const canUseBiometrics = hasBiometrics && window.PublicKeyCredential;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (user.password && user.password === password) {
            onSuccess();
        } else if (!user.password) {
            onSuccess();
        } else {
            setError('كلمة المرور غير صحيحة');
        }
    };

    const handleBiometricLogin = async () => {
        if (!user.biometricCredId) return;
        setBioLoading(true);
        setError('');
        try {
            // Retrieve credentials from the authenticator
            const credential = await navigator.credentials.get({
                publicKey: {
                    challenge: new Uint8Array(32), // In a real app, this comes from server
                    allowCredentials: [{
                        id: base64ToBuffer(user.biometricCredId),
                        type: 'public-key',
                    }],
                    userVerification: 'required',
                },
            });

            if (credential) {
                // In a client-only app, successful retrieval is our "proof"
                onSuccess();
            }
        } catch (e) {
            console.error(e);
            setError('فشلت المصادقة بالبصمة. استخدم كلمة المرور.');
        } finally {
            setBioLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-sm p-6 rounded-2xl shadow-xl">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-3 text-teal-600 relative">
                        <UserIcon className="w-8 h-8" />
                        {canUseBiometrics && <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-sm"><ScanFace className="w-4 h-4 text-teal-600" /></div>}
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">تسجيل دخول موظف</h3>
                    <p className="text-slate-500 text-sm mt-1">المستخدم: <strong>{user.name}</strong></p>
                </div>
                
                <div className="space-y-4">
                    {/* Biometric Button */}
                    {canUseBiometrics && (
                        <button 
                            onClick={handleBiometricLogin}
                            disabled={bioLoading}
                            className="w-full py-4 mb-2 bg-teal-50 border-2 border-dashed border-teal-200 text-teal-700 rounded-xl flex items-center justify-center gap-3 font-bold hover:bg-teal-100 hover:border-teal-300 transition-all"
                        >
                            {bioLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <ScanFace className="w-6 h-6" />}
                            دخول باستخدام FaceID / البصمة
                        </button>
                    )}

                    {canUseBiometrics && <div className="text-center text-xs text-slate-400 font-medium relative py-2">
                        <span className="bg-white px-2 relative z-10">أو باستخدام كلمة المرور</span>
                        <div className="absolute top-1/2 left-0 right-0 h-px bg-slate-100 -z-0"></div>
                    </div>}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <input 
                            type="password" 
                            autoFocus={!canUseBiometrics}
                            value={password}
                            onChange={e => {setPassword(e.target.value); setError('');}}
                            placeholder="كلمة المرور..."
                            className={`w-full p-3 border rounded-xl outline-none text-center text-lg tracking-widest ${error ? 'border-red-500 bg-red-50' : 'border-slate-300 focus:border-teal-500'}`}
                        />
                        {error && <p className="text-red-500 text-sm text-center font-bold">{error}</p>}
                        
                        <div className="grid grid-cols-2 gap-3">
                            <button type="button" onClick={onClose} className="p-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition">إلغاء</button>
                            <button type="submit" className="p-3 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition">دخول</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

// Admin Login Modal
const AdminLoginModal = ({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [showPass, setShowPass] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
            onSuccess();
        } else {
            setError('بيانات الدخول غير صحيحة');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-sm p-8 rounded-2xl shadow-2xl border-t-4 border-orange-500">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-3 text-orange-600">
                        <ShieldCheck className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">لوحة تحكم المدير</h3>
                    <p className="text-slate-400 text-xs mt-1">منطقة محظورة لغير المصرح لهم</p>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">اسم المستخدم</label>
                        <input 
                            type="text" 
                            autoFocus
                            value={username}
                            onChange={e => {setUsername(e.target.value); setError('');}}
                            className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-200"
                            dir="ltr"
                        />
                    </div>
                    <div className="relative">
                        <label className="block text-xs font-bold text-slate-500 mb-1">كلمة المرور</label>
                        <input 
                            type={showPass ? "text" : "password"}
                            value={password}
                            onChange={e => {setPassword(e.target.value); setError('');}}
                            className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-200"
                            dir="ltr"
                        />
                        <button type="button" onClick={() => setShowPass(!showPass)} className="absolute top-8 right-3 text-slate-400 hover:text-orange-500">
                            {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>

                    {error && <p className="text-red-500 text-sm text-center font-bold bg-red-50 p-2 rounded-lg">{error}</p>}
                    
                    <div className="grid grid-cols-2 gap-3 mt-4">
                        <button type="button" onClick={onClose} className="p-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition">إلغاء</button>
                        <button type="submit" className="p-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition shadow-lg shadow-orange-200">دخول</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const UserSelection = ({ onSelect }: { onSelect: (u: User) => void }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create User State
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  // Login State
  const [loginTarget, setLoginTarget] = useState<User | null>(null);
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  const [needsSetup, setNeedsSetup] = useState(false);

  const loadUsers = useCallback(async () => {
    const db = DB.getDbInstance();
    if (!db) { setNeedsSetup(true); setLoading(false); return; }
    setLoading(true);
    try { const data = await DB.getUsers(); setUsers(data); } 
    catch (e) { console.error(e); setNeedsSetup(true); } 
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPassword.trim()) return;
    
    setIsCreating(true);
    try { 
        // Always create user with 'user' role
        const newUser = await DB.createUser(newName.trim(), newPassword.trim()); 
        setUsers(prev => [...prev, newUser]); 
        setNewName('');
        setNewPassword('');
    }
    catch (e) { alert('فشل إنشاء المستخدم'); } finally { setIsCreating(false); }
  };

  if (needsSetup) return <ComingSoon />;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans relative" dir="rtl">
      
      {/* Admin Trigger Button */}
      <button 
        onClick={() => setShowAdminLogin(true)}
        className="absolute top-4 left-4 p-2 bg-white/50 hover:bg-white text-slate-300 hover:text-orange-500 rounded-full transition-all"
        title="دخول المدير"
      >
        <Shield className="w-6 h-6" />
      </button>

      {loginTarget && (
          <LoginModal 
            user={loginTarget} 
            onClose={() => setLoginTarget(null)} 
            onSuccess={() => onSelect(loginTarget)} 
          />
      )}

      {showAdminLogin && (
          <AdminLoginModal
            onClose={() => setShowAdminLogin(false)}
            onSuccess={() => onSelect(VIRTUAL_ADMIN_USER)}
          />
      )}

      <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-lg border border-slate-100">
        <div className="text-center mb-8">
            <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-sm"><UserIcon className="w-8 h-8" /></div>
            <h1 className="text-2xl font-bold text-slate-800">مرحباً بك</h1>
        </div>
        
        {loading ? <div className="py-12 flex justify-center text-teal-600"><Loader2 className="w-8 h-8 animate-spin" /></div> : (
            <div className="space-y-3 mb-8 max-h-60 overflow-y-auto custom-scrollbar">
                {users.map(user => (
                    <button key={user.id} onClick={() => setLoginTarget(user)} className="w-full p-4 flex justify-between items-center bg-slate-50 hover:bg-teal-50 rounded-xl transition-all group border border-slate-200 hover:border-teal-200">
                        <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 text-slate-500 relative">
                                <UserIcon className="w-4 h-4" />
                                {user.biometricCredId && (
                                    <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
                                        <ScanFace className="w-3 h-3 text-teal-600" />
                                    </div>
                                )}
                             </div>
                             <span className="font-bold text-lg text-slate-700">{user.name}</span>
                        </div>
                        {user.password ? <Lock className="w-4 h-4 text-slate-300 group-hover:text-teal-500" /> : <ChevronLeft className="w-5 h-5 text-slate-300 group-hover:text-teal-500" />}
                    </button>
                ))}
                {users.length === 0 && <p className="text-center text-slate-400 py-4">لا يوجد مستخدمين. أضف مستخدم جديد.</p>}
            </div>
        )}

        <form onSubmit={handleCreate} className="relative mt-4 pt-6 border-t border-slate-100">
             <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1"><Plus className="w-4 h-4" /> إنشاء حساب جديد</h3>
             <div className="space-y-3">
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="الاسم..." disabled={isCreating} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
                
                <div className="relative">
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="كلمة المرور..." disabled={isCreating} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none pl-10" />
                    <KeyRound className="absolute left-3 top-3.5 w-5 h-5 text-slate-300" />
                </div>

                <button type="submit" disabled={!newName.trim() || !newPassword.trim() || isCreating} className="w-full p-3 bg-teal-600 text-white rounded-xl disabled:opacity-50 flex items-center justify-center font-bold mt-2">
                    {isCreating ? <Loader2 className="w-6 h-6 animate-spin" /> : "إنشاء الحساب"}
                </button>
             </div>
        </form>
      </div>
    </div>
  )
};

// --- Sub-components for Dashboard ---

const UserSettingsModal = ({ user, onClose, onUpdateUser }: { user: User, onClose: () => void, onUpdateUser: (u: User) => void }) => {
    const [enabling, setEnabling] = useState(false);
    const hasBiometrics = !!user.biometricCredId;
    const isSupported = !!(window.PublicKeyCredential);

    const handleEnableBiometrics = async () => {
        if (!isSupported) return alert("جهازك لا يدعم المصادقة البيومترية");
        
        setEnabling(true);
        try {
            const publicKey: PublicKeyCredentialCreationOptions = {
                challenge: new Uint8Array(32), // Random challenge
                rp: { name: "نظام الحضور", id: window.location.hostname },
                user: {
                    id: new TextEncoder().encode(user.id),
                    name: user.name,
                    displayName: user.name,
                },
                pubKeyCredParams: [{ alg: -7, type: "public-key" }],
                authenticatorSelection: { userVerification: "preferred" },
                timeout: 60000,
                attestation: "none"
            };

            const credential = await navigator.credentials.create({ publicKey }) as PublicKeyCredential;
            
            if (credential) {
                // Save Credential ID to Firestore
                const credId = bufferToBase64(credential.rawId);
                await DB.updateUserBiometrics(user.id, credId);
                onUpdateUser({ ...user, biometricCredId: credId });
                alert("تم تفعيل الدخول بالبصمة/FaceID بنجاح");
            }
        } catch (e) {
            console.error(e);
            alert("فشل تفعيل البصمة. تأكد من إعداد جهازك.");
        } finally {
            setEnabling(false);
        }
    };

    const handleDisableBiometrics = async () => {
        if (confirm("هل تريد إلغاء الدخول بالبصمة؟")) {
            setEnabling(true);
            try {
                await DB.updateUserBiometrics(user.id, null);
                onUpdateUser({ ...user, biometricCredId: undefined });
            } catch (e) {
                alert("فشل الإلغاء");
            } finally {
                setEnabling(false);
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Settings className="w-5 h-5 text-slate-500" />
                        الإعدادات
                    </h3>
                    <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                
                <div className="space-y-6">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center">
                                <ScanFace className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-sm">FaceID / بصمة الإصبع</h4>
                                <p className="text-xs text-slate-500">تسجيل دخول أسرع وأكثر أماناً</p>
                            </div>
                        </div>

                        {!isSupported ? (
                            <div className="text-xs text-red-500 bg-red-50 p-2 rounded-lg">
                                هذا المتصفح لا يدعم المصادقة البيومترية.
                            </div>
                        ) : (
                            hasBiometrics ? (
                                <button 
                                    onClick={handleDisableBiometrics}
                                    disabled={enabling}
                                    className="w-full py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-bold hover:bg-red-100 transition"
                                >
                                    {enabling ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "إلغاء التفعيل"}
                                </button>
                            ) : (
                                <button 
                                    onClick={handleEnableBiometrics}
                                    disabled={enabling}
                                    className="w-full py-2 bg-teal-600 text-white rounded-lg text-sm font-bold hover:bg-teal-700 transition shadow-sm"
                                >
                                    {enabling ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "تفعيل الآن"}
                                </button>
                            )
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const BalanceEditor = ({ user, onClose, onUpdate }: { user: User, onClose: () => void, onUpdate: (a: number, c: number) => void }) => {
    const [annual, setAnnual] = useState(user.annualBalance);
    const [casual, setCasual] = useState(user.casualBalance);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await DB.updateUserBalance(user.id, annual, casual);
            onUpdate(annual, casual);
            onClose();
        } catch (e) {
            alert("فشل تحديث الرصيد");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-slate-800">تعديل رصيد الإجازات</h3>
                    <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-600 mb-1">الرصيد الاعتيادي (سنوي)</label>
                        <input type="number" value={annual} onChange={e => setAnnual(Number(e.target.value))} className="w-full p-3 border rounded-xl" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-600 mb-1">الرصيد العارضة</label>
                        <input type="number" value={casual} onChange={e => setCasual(Number(e.target.value))} className="w-full p-3 border rounded-xl" />
                    </div>
                    <button onClick={handleSave} disabled={saving} className="w-full py-3 bg-teal-600 text-white font-bold rounded-xl flex justify-center gap-2">
                        {saving ? <Loader2 className="animate-spin" /> : <Save className="w-5 h-5" />} حفظ
                    </button>
                </div>
            </div>
        </div>
    );
};

const SmartSuggestion = ({ lateMinutes, permissionsUsed }: { lateMinutes: number, permissionsUsed: number }) => {
    if (lateMinutes <= MAX_ALLOWANCE) return null;

    const excess = lateMinutes - MAX_ALLOWANCE;
    const permissionsLeft = MAX_MONTHLY_PERMISSIONS - permissionsUsed;
    
    // Calculate needed hours. 1 hour permission covers 60 mins of lateness conceptually (returns you to safe zone)
    const hoursNeededToCover = Math.ceil(excess / 60);

    let message = "";
    let actionType = "info";

    if (permissionsLeft <= 0) {
        message = `تجاوزت الحد بـ ${excess} دقيقة. للأسف استنفذت جميع الأذونات هذا الشهر. سيتم تطبيق الخصم.`;
        actionType = "danger";
    } else if (hoursNeededToCover > 3) { // Assuming max hours/permission is usually capped or practically hard to take multiple big permissions
         message = `تجاوزت الحد بـ ${excess} دقيقة. تحتاج لأذونات بـ ${hoursNeededToCover} ساعات لتغطية ذلك، وهو رقم كبير قد لا يقبل كإذن واحد.`;
         actionType = "warning";
    } else {
        message = `تجاوزت الحد المسموح بـ ${excess} دقيقة. 
        بما أن لديك ${permissionsLeft} أذونات متبقية، نقترح عليك تقديم **إذن تأخير لمدة ${hoursNeededToCover} ساعة** في أحد أيام التأخير ليعود رصيدك للمنطقة الآمنة.`;
        actionType = "success";
    }

    const bg = actionType === 'danger' ? 'bg-red-50 border-red-200 text-red-800' 
             : actionType === 'warning' ? 'bg-orange-50 border-orange-200 text-orange-800'
             : 'bg-blue-50 border-blue-200 text-blue-800';
             
    const icon = actionType === 'success' ? <Briefcase className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />;

    return (
        <div className={`p-4 rounded-xl border ${bg} flex gap-3 items-start mt-4 shadow-sm`}>
            {icon}
            <div className="text-sm leading-relaxed font-medium">
                <span className="font-bold block mb-1">اقتراح النظام:</span>
                {message.split('\n').map((line, i) => <p key={i}>{line}</p>)}
            </div>
        </div>
    );
};

const AdminPanel = ({ currentUser }: { currentUser: User }) => {
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        const users = await DB.getUsers();
        setAllUsers(users);
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const handleDeleteUser = async (userToDelete: User) => {
        if (confirm(`هل أنت متأكد من حذف المستخدم "${userToDelete.name}" وجميع بياناته؟ هذا الإجراء لا يمكن التراجع عنه.`)) {
            try {
                await DB.deleteUser(userToDelete.id);
                setAllUsers(prev => prev.filter(u => u.id !== userToDelete.id));
            } catch (e) {
                alert("حدث خطأ أثناء الحذف");
            }
        }
    };

    return (
        <div className="space-y-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Shield className="w-5 h-5 text-orange-500" />
                إدارة المستخدمين
            </h3>
            {loading ? <div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto text-orange-500" /></div> : (
                <div className="grid gap-3">
                    {allUsers.length === 0 && <p className="text-slate-400 text-center py-4">لا يوجد مستخدمين مسجلين.</p>}
                    {allUsers.map(u => (
                        <div key={u.id} className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold bg-slate-100 text-slate-500 relative">
                                    <UserIcon className="w-5 h-5" />
                                    {u.biometricCredId && <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5"><ScanFace className="w-3 h-3 text-teal-600" /></div>}
                                </div>
                                <div>
                                    <div className="font-bold text-slate-800">{u.name}</div>
                                    <div className="text-xs text-slate-400">مستخدم</div>
                                </div>
                            </div>
                            <button onClick={() => handleDeleteUser(u)} className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition" title="حذف المستخدم">
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const Dashboard = ({ user: initialUser, onLogout }: { user: User, onLogout: () => void }) => {
  const [user, setUser] = useState(initialUser);
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [leaves, setLeaves] = useState<LeaveEntry[]>([]);
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form States
  // Default to admin tab if admin
  const [activeTab, setActiveTab] = useState<'attendance' | 'leaves' | 'notes' | 'admin'>(user.role === 'admin' ? 'admin' : 'attendance');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBalanceEditor, setShowBalanceEditor] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Attendance Form
  const [attDate, setAttDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [attTime, setAttTime] = useState<string>('');
  const [attNote, setAttNote] = useState<string>(''); // Added Note state
  
  // Leave Form
  const [leaveDate, setLeaveDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [leaveType, setLeaveType] = useState<'annual' | 'casual' | 'permission'>('permission');
  const [permHours, setPermHours] = useState<number>(1);
  const [leaveNote, setLeaveNote] = useState<string>(''); // Added Note state

  // Note Form
  const [noteDate, setNoteDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [noteContent, setNoteContent] = useState<string>('');

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  });

  const fetchData = useCallback(async () => {
    // Skip fetching specific user data if it's the virtual admin, as they have no data in DB
    if (user.role === 'admin') {
        setLoading(false);
        return;
    }

    setLoading(true);
    try {
        const [attData, leaveData, noteData] = await Promise.all([
            DB.getEntries(user.id),
            DB.getLeaves(user.id),
            DB.getNotes(user.id)
        ]);
        setEntries(attData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        setLeaves(leaveData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        setNotes(noteData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (e) {
        alert('فشل تحميل البيانات');
    } finally {
        setLoading(false);
    }
  }, [user.id, user.role]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const calculateLate = (timeStr: string): number => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;
    return totalMinutes <= (8 * 60 + 30) ? 0 : totalMinutes - (8 * 60);
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (entries.some(e => e.date === attDate)) return alert('يوجد تسجيل مسبق');
    setIsSubmitting(true);
    try {
        await DB.addEntry({ 
            id: 'temp', 
            userId: user.id, 
            date: attDate, 
            time: attTime, 
            lateMinutes: calculateLate(attTime),
            note: attNote // Include note
        });
        await fetchData();
        setAttTime('');
        setAttNote('');
    } catch (e) { alert('فشل الحفظ'); } finally { setIsSubmitting(false); }
  };

  const handleAddLeave = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      try {
          await DB.addLeave({ 
              id: 'temp', userId: user.id, date: leaveDate, type: leaveType, 
              hours: leaveType === 'permission' ? permHours : undefined,
              note: leaveNote // Include note
          });
          await fetchData();
          setLeaveNote('');
      } catch (e) { alert('فشل الحفظ'); } finally { setIsSubmitting(false); }
  };

  const handleAddNote = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!noteContent.trim()) return;
      setIsSubmitting(true);
      try {
          await DB.addNote({
              id: 'temp', userId: user.id, date: noteDate, content: noteContent
          });
          await fetchData();
          setNoteContent('');
      } catch (e) { alert('فشل الحفظ'); } finally { setIsSubmitting(false); }
  };

  const handleDeleteEntry = async (id: string) => {
      if (confirm('حذف السجل؟')) { await DB.deleteEntry(id); setEntries(prev => prev.filter(e => e.id !== id)); }
  };

  const handleDeleteLeave = async (id: string) => {
      if (confirm('حذف الإجازة؟')) { await DB.deleteLeave(id); setLeaves(prev => prev.filter(e => e.id !== id)); }
  };

  const handleDeleteNote = async (id: string) => {
      if (confirm('حذف الملاحظة؟')) { await DB.deleteNote(id); setNotes(prev => prev.filter(e => e.id !== id)); }
  };

  const handleReset = async () => {
      if (confirm('مسح جميع البيانات للمستخدم؟')) { await DB.clearEntries(user.id); setEntries([]); setLeaves([]); setNotes([]); }
  };

  // Calculations
  const monthEntries = entries.filter(e => e.date.startsWith(selectedMonth));
  const totalLateMinutes = monthEntries.reduce((sum, e) => sum + e.lateMinutes, 0);
  const remainingLateBalance = MAX_ALLOWANCE - totalLateMinutes;
  const isOverLimit = remainingLateBalance < 0;

  // Leave Calculations
  const annualUsed = leaves.filter(l => l.type === 'annual').length;
  const casualUsed = leaves.filter(l => l.type === 'casual').length;
  // Permissions are monthly limited
  const monthPermissions = leaves.filter(l => l.type === 'permission' && l.date.startsWith(selectedMonth));
  const permissionsUsedCount = monthPermissions.length; 
  
  const formatMonth = (m: string) => {
      const d = new Date(Number(m.split('-')[0]), Number(m.split('-')[1]) - 1);
      return d.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
  };

  const handleMonthChange = (inc: number) => {
      const [y, m] = selectedMonth.split('-').map(Number);
      const d = new Date(y, m - 1 + inc);
      setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const isAdmin = user.role === 'admin';

  return (
    <div className="min-h-screen bg-slate-50 pb-12 font-sans">
      {showBalanceEditor && !isAdmin && (
          <BalanceEditor 
            user={user} 
            onClose={() => setShowBalanceEditor(false)} 
            onUpdate={(a, c) => setUser({...user, annualBalance: a, casualBalance: c})} 
          />
      )}

      {showSettings && !isAdmin && (
          <UserSettingsModal 
            user={user}
            onClose={() => setShowSettings(false)}
            onUpdateUser={setUser}
          />
      )}

      {/* Header */}
      <div className={`text-white p-6 pb-12 rounded-b-[2.5rem] shadow-xl relative overflow-hidden transition-colors ${isAdmin ? 'bg-slate-800' : 'bg-teal-700'}`}>
         <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 opacity-50"></div>
         <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12 opacity-50"></div>
         
         <div className="max-w-3xl mx-auto relative z-10">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm relative">
                        {isAdmin && <ShieldCheck className="absolute -top-2 -right-2 w-5 h-5 text-orange-400 bg-slate-800 rounded-full border border-slate-700" />}
                        <UserIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg opacity-90">مرحباً، {user.name}</h1>
                        <p className="text-xs text-white/70">{isAdmin ? 'لوحة تحكم المدير' : 'نظام متابعة الحضور'}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                     {!isAdmin && (
                         <button onClick={() => setShowSettings(true)} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white/80 transition"><Settings className="w-5 h-5" /></button>
                    )}
                    {!isAdmin && (
                         <button onClick={handleReset} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white/80 transition"><Trash2 className="w-5 h-5" /></button>
                    )}
                    <button onClick={onLogout} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white/80 transition"><LogOut className="w-5 h-5" /></button>
                </div>
            </div>

            {/* Quick Stats Row (Hidden for Admin) */}
            {!isAdmin && (
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 text-center border border-white/10">
                        <span className="text-xs text-white/70 block mb-1">رصيد التأخير</span>
                        <span className={`text-xl font-bold ${remainingLateBalance < 0 ? 'text-red-300' : 'text-white'}`}>{remainingLateBalance} <span className="text-xs font-normal">د</span></span>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 text-center border border-white/10 relative group">
                        <button onClick={() => setShowBalanceEditor(true)} className="absolute top-1 right-1 p-1 opacity-0 group-hover:opacity-100 transition"><Edit3 className="w-3 h-3 text-white/70" /></button>
                        <span className="text-xs text-white/70 block mb-1">اعتيادي متبقي</span>
                        <span className="text-xl font-bold text-white">{user.annualBalance - annualUsed}</span>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 text-center border border-white/10 relative group">
                        <button onClick={() => setShowBalanceEditor(true)} className="absolute top-1 right-1 p-1 opacity-0 group-hover:opacity-100 transition"><Edit3 className="w-3 h-3 text-white/70" /></button>
                        <span className="text-xs text-white/70 block mb-1">عارضة متبقي</span>
                        <span className="text-xl font-bold text-white">{user.casualBalance - casualUsed}</span>
                    </div>
                </div>
            )}
         </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 -mt-6 relative z-20 space-y-6">
        
        {/* Month Selector (Not needed for Admin Dashboard usually, but keeping layout consistent) */}
        {!isAdmin && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-2 flex items-center justify-between">
                <button onClick={() => handleMonthChange(-1)} className="p-2 hover:bg-slate-50 rounded-lg text-slate-500"><ChevronRight /></button>
                <div className="flex items-center gap-2 font-bold text-slate-700">
                    <CalendarDays className="w-5 h-5 text-teal-600" />
                    {formatMonth(selectedMonth)}
                </div>
                <button onClick={() => handleMonthChange(1)} className="p-2 hover:bg-slate-50 rounded-lg text-slate-500"><ChevronLeft /></button>
            </div>
        )}

        {/* Permissions & Late Status (Not for Admin) */}
        {!isAdmin && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Timer className="w-5 h-5 text-indigo-500" />
                        حالة الشهر
                    </h3>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${isOverLimit ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                        {isOverLimit ? 'تجاوزت الحد' : 'في الأمان'}
                    </span>
                </div>
                
                <div className="space-y-4">
                    {/* Permissions Progress */}
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-500">أذونات الشهر (الحد الأقصى 3)</span>
                            <span className="font-bold text-slate-700">{permissionsUsedCount} / 3</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 transition-all" style={{ width: `${(permissionsUsedCount/3)*100}%` }}></div>
                        </div>
                    </div>

                    {/* Late Progress */}
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-500">دقائق التأخير (الحد 360)</span>
                            <span className="font-bold text-slate-700">{totalLateMinutes} / 360</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full transition-all ${isOverLimit ? 'bg-red-500' : 'bg-teal-500'}`} style={{ width: `${Math.min(100, (totalLateMinutes/360)*100)}%` }}></div>
                        </div>
                    </div>

                    {/* Smart Suggestion */}
                    <SmartSuggestion lateMinutes={totalLateMinutes} permissionsUsed={permissionsUsedCount} />
                </div>
            </div>
        )}

        {/* Tabs & Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="flex border-b border-slate-100">
                {!isAdmin && (
                    <>
                        <button 
                            onClick={() => setActiveTab('attendance')} 
                            className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'attendance' ? 'bg-white text-teal-700 border-b-2 border-teal-600' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                        >
                            <Clock className="w-4 h-4" /> تسجيل حضور
                        </button>
                        <button 
                            onClick={() => setActiveTab('leaves')} 
                            className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'leaves' ? 'bg-white text-indigo-700 border-b-2 border-indigo-600' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                        >
                            <Plane className="w-4 h-4" /> طلب إجازة
                        </button>
                        <button 
                            onClick={() => setActiveTab('notes')} 
                            className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'notes' ? 'bg-white text-amber-600 border-b-2 border-amber-500' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                        >
                            <StickyNote className="w-4 h-4" /> ملاحظات
                        </button>
                    </>
                )}
                {isAdmin && (
                    <button 
                        onClick={() => setActiveTab('admin')} 
                        className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'admin' ? 'bg-white text-orange-700 border-b-2 border-orange-600' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                    >
                        <Shield className="w-4 h-4" /> الإدارة
                    </button>
                )}
            </div>
            
            <div className="p-6">
                {activeTab === 'attendance' ? (
                    <form onSubmit={handleAddEntry} className="flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">التاريخ</label>
                                <input type="date" value={attDate} onChange={e => setAttDate(e.target.value)} required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-teal-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">الوقت</label>
                                <input type="time" value={attTime} onChange={e => setAttTime(e.target.value)} required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-teal-500 text-left dir-ltr" style={{direction: 'ltr'}} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">ملاحظات (اختياري)</label>
                            <input type="text" value={attNote} onChange={e => setAttNote(e.target.value)} placeholder="مثلاً: سبب التأخير..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-teal-500" />
                        </div>
                        <button disabled={isSubmitting} className="w-full py-3 bg-teal-600 text-white font-bold rounded-xl flex justify-center gap-2 disabled:opacity-70">
                            {isSubmitting ? <Loader2 className="animate-spin" /> : <Plus />} تسجيل
                        </button>
                    </form>
                ) : activeTab === 'leaves' ? (
                    <form onSubmit={handleAddLeave} className="flex flex-col gap-4">
                         <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">نوع الطلب</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button type="button" onClick={() => setLeaveType('permission')} className={`p-2 rounded-lg text-sm border font-medium transition ${leaveType === 'permission' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'border-slate-200 text-slate-600'}`}>إذن</button>
                                    <button type="button" onClick={() => setLeaveType('casual')} className={`p-2 rounded-lg text-sm border font-medium transition ${leaveType === 'casual' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'border-slate-200 text-slate-600'}`}>عارضة</button>
                                    <button type="button" onClick={() => setLeaveType('annual')} className={`p-2 rounded-lg text-sm border font-medium transition ${leaveType === 'annual' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'border-slate-200 text-slate-600'}`}>اعتيادي</button>
                                </div>
                            </div>
                            
                            {leaveType === 'permission' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">عدد الساعات</label>
                                    <div className="flex gap-2">
                                        {[1, 2, 3].map(h => (
                                            <button key={h} type="button" onClick={() => setPermHours(h)} className={`flex-1 p-2 rounded-lg border text-sm font-bold transition ${permHours === h ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                                {h} ساعة
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">التاريخ</label>
                                <input type="date" value={leaveDate} onChange={e => setLeaveDate(e.target.value)} required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500" />
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">ملاحظات (اختياري)</label>
                                <input type="text" value={leaveNote} onChange={e => setLeaveNote(e.target.value)} placeholder="مثلاً: سبب الإجازة..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500" />
                            </div>
                        </div>
                        <button disabled={isSubmitting} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl flex justify-center gap-2 disabled:opacity-70">
                            {isSubmitting ? <Loader2 className="animate-spin" /> : <Save className="w-5 h-5" />} حفظ الطلب
                        </button>
                    </form>
                ) : activeTab === 'notes' ? (
                    <form onSubmit={handleAddNote} className="flex flex-col gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">التاريخ</label>
                            <input type="date" value={noteDate} onChange={e => setNoteDate(e.target.value)} required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">الملاحظة</label>
                            <textarea 
                                value={noteContent} 
                                onChange={e => setNoteContent(e.target.value)} 
                                required 
                                rows={4}
                                placeholder="اكتب ملاحظاتك هنا..." 
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500 resize-none" 
                            />
                        </div>
                        <button disabled={isSubmitting} className="w-full py-3 bg-amber-600 text-white font-bold rounded-xl flex justify-center gap-2 disabled:opacity-70">
                            {isSubmitting ? <Loader2 className="animate-spin" /> : <Save className="w-5 h-5" />} حفظ الملاحظة
                        </button>
                    </form>
                ) : (
                    <AdminPanel currentUser={user} />
                )}
            </div>
        </div>

        {/* Lists */}
        {activeTab !== 'admin' && (
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-800 px-1">سجل النشاط</h3>
                
                {loading ? <div className="flex justify-center p-8"><Loader2 className="animate-spin text-teal-600 w-8 h-8" /></div> : (
                    <div className="space-y-3">
                        {[
                            ...monthEntries.map(e => ({...e, sortDate: e.date, itemType: 'attendance'})),
                            ...leaves.filter(l => l.date.startsWith(selectedMonth)).map(l => ({...l, sortDate: l.date, itemType: 'leave'})),
                            ...notes.filter(n => n.date.startsWith(selectedMonth)).map(n => ({...n, sortDate: n.date, itemType: 'note'}))
                        ].sort((a,b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime()).map((item: any) => (
                            <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-start justify-between group">
                                <div className="flex items-start gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-1 ${
                                        item.itemType === 'attendance' ? (item.lateMinutes > 0 ? 'bg-red-50 text-red-500' : 'bg-teal-50 text-teal-500') 
                                        : item.itemType === 'leave' ? 'bg-indigo-50 text-indigo-500'
                                        : 'bg-amber-50 text-amber-500'
                                    }`}>
                                        {item.itemType === 'attendance' ? <Clock className="w-5 h-5" /> 
                                         : item.itemType === 'leave' ? <Plane className="w-5 h-5" />
                                         : <StickyNote className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-800 text-sm">
                                            {new Date(item.date).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1">
                                            {item.itemType === 'attendance' 
                                                ? (item.lateMinutes > 0 ? `تأخير ${item.lateMinutes} دقيقة (${item.time})` : `حضور ${item.time}`)
                                                : item.itemType === 'leave' ? (item.type === 'permission' ? `إذن ${item.hours} ساعة` : `إجازة ${item.type === 'annual' ? 'اعتيادي' : 'عارضة'}`)
                                                : 'ملاحظة شخصية'
                                            }
                                        </div>
                                        {(item.note || item.content) && (
                                            <div className={`text-xs mt-2 p-2 rounded-lg leading-relaxed ${item.itemType === 'note' ? 'bg-amber-50 text-amber-800' : 'bg-slate-50 text-slate-600'}`}>
                                                {item.content || item.note}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <button 
                                    onClick={() => {
                                        if (item.itemType === 'attendance') handleDeleteEntry(item.id);
                                        else if (item.itemType === 'leave') handleDeleteLeave(item.id);
                                        else handleDeleteNote(item.id);
                                    }}
                                    className="text-slate-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        
                        {monthEntries.length === 0 && leaves.filter(l => l.date.startsWith(selectedMonth)).length === 0 && notes.filter(n => n.date.startsWith(selectedMonth)).length === 0 && (
                            <div className="text-center py-8 text-slate-400">لا توجد سجلات لهذا الشهر</div>
                        )}
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
};

const App = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    return currentUser ? <Dashboard user={currentUser} onLogout={() => setCurrentUser(null)} /> : <UserSelection onSelect={setCurrentUser} />;
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);