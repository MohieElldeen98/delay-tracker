import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, where, orderBy, updateDoc } from 'firebase/firestore';

// ==========================================
// ⚙️ إعدادات النظام عبر متغيرات البيئة
// ==========================================
// Use a safe fallback if import.meta.env is not defined
const env = (import.meta as any).env || {};

const ENV_CONFIG = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  projectId: env.VITE_FIREBASE_PROJECT_ID
};

// --- Types ---
export interface AttendanceEntry {
  id: string;
  userId: string;
  date: string;
  time: string;
  lateMinutes: number;
  schedule?: '8am' | '9am'; // Work schedule used for this entry
  note?: string; // Added note field
}

export interface LeaveEntry {
  id: string;
  userId: string;
  date: string;
  type: 'annual' | 'casual' | 'permission';
  hours?: number; // Only for permissions (1, 2, or 3)
  note?: string; // Added note field
}

export interface NoteEntry {
  id: string;
  userId: string;
  date: string;
  content: string;
}

export interface User {
  id: string;
  name: string;
  password?: string; // New field for password
  role?: 'admin' | 'user'; // Role field
  biometricCredId?: string; // Stores the WebAuthn Credential ID
  annualBalance: number; // Default 21
  casualBalance: number; // Default 7
  defaultSchedule?: '8am' | '9am'; // Default schedule: '8am' or '9am'
}

interface FirebaseConfig {
  apiKey: string;
  projectId: string;
}

// --- Database Adapter ---
export const DB = {
  getConfig: (): FirebaseConfig | null => {
    // 1. استخدام متغيرات البيئة (.env)
    if (ENV_CONFIG.apiKey && ENV_CONFIG.projectId) {
        return ENV_CONFIG as FirebaseConfig;
    }

    // 2. محاولة قراءة البيانات من المتصفح (للمطور فقط)
    const saved = localStorage.getItem('app_firebase_config');
    return saved ? JSON.parse(saved) : null;
  },

  getDbInstance: () => {
    const config = DB.getConfig();
    if (!config) return null;

    try {
      let app;
      try {
        app = initializeApp(config, "AttendanceApp");
      } catch (e: any) {
        if (e.code === 'app/duplicate-app') {
             // @ts-ignore
             app = undefined; 
             return getFirestore(); 
        } else {
            throw e;
        }
      }
      return getFirestore(app);
    } catch (e) {
      console.error("Firebase Init Error:", e);
      return null;
    }
  },

  // Users
  getUsers: async (): Promise<User[]> => {
    const db = DB.getDbInstance();
    if (!db) throw new Error("Missing Config");
    
    const q = query(collection(db, "users"), orderBy("name"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return { 
            id: doc.id, 
            name: data.name,
            password: data.password || '', 
            role: 'user', // Always return 'user' from DB since Admin is virtual
            biometricCredId: data.biometricCredId || undefined,
            annualBalance: data.annualBalance ?? 21,
            casualBalance: data.casualBalance ?? 7,
            defaultSchedule: data.defaultSchedule || '8am'
        } as User;
    });
  },

  createUser: async (name: string, password: string, defaultSchedule: '8am' | '9am' = '8am'): Promise<User> => {
    const db = DB.getDbInstance();
    if (!db) throw new Error("Missing Config");

    // All created users are standard 'user' role
    const docRef = await addDoc(collection(db, "users"), {
      name,
      password,
      role: 'user',
      annualBalance: 21,
      casualBalance: 7,
      defaultSchedule,
      createdAt: new Date().toISOString()
    });
    return { id: docRef.id, name, password, role: 'user', annualBalance: 21, casualBalance: 7, defaultSchedule };
  },

  updateUserBalance: async (userId: string, annual: number, casual: number): Promise<void> => {
      const db = DB.getDbInstance();
      if (!db) throw new Error("Missing Config");
      await updateDoc(doc(db, "users", userId), {
          annualBalance: annual,
          casualBalance: casual
      });
  },

  updateUserSchedule: async (userId: string, schedule: '8am' | '9am'): Promise<void> => {
      const db = DB.getDbInstance();
      if (!db) throw new Error("Missing Config");
      await updateDoc(doc(db, "users", userId), {
          defaultSchedule: schedule
      });
  },

  updateUserBiometrics: async (userId: string, credId: string | null): Promise<void> => {
    const db = DB.getDbInstance();
    if (!db) throw new Error("Missing Config");
    await updateDoc(doc(db, "users", userId), {
        biometricCredId: credId || null
    });
  },

  updateUserPassword: async (userId: string, newPassword: string): Promise<void> => {
    const db = DB.getDbInstance();
    if (!db) throw new Error("Missing Config");
    await updateDoc(doc(db, "users", userId), {
      password: newPassword
    });
  },

  deleteUser: async (userId: string): Promise<void> => {
      const db = DB.getDbInstance();
      if (!db) throw new Error("Missing Config");
      
      // First delete all their entries
      await DB.clearEntries(userId);
      
      // Then delete the user document
      await deleteDoc(doc(db, "users", userId));
  },

  // Entries
  getEntries: async (userId: string): Promise<AttendanceEntry[]> => {
    const db = DB.getDbInstance();
    if (!db) throw new Error("Missing Config");

    const q = query(collection(db, "attendance"), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceEntry));
  },

  addEntry: async (entry: AttendanceEntry): Promise<AttendanceEntry> => {
    const db = DB.getDbInstance();
    if (!db) throw new Error("Missing Config");

    const docRef = await addDoc(collection(db, "attendance"), {
      userId: entry.userId,
      date: entry.date,
      time: entry.time,
      lateMinutes: entry.lateMinutes,
      schedule: entry.schedule || '8am',
      note: entry.note || '', // Save note
      createdAt: new Date().toISOString()
    });
    return { ...entry, id: docRef.id };
  },

  updateEntry: async (id: string, data: Partial<AttendanceEntry>): Promise<void> => {
    const db = DB.getDbInstance();
    if (!db) throw new Error("Missing Config");
    await updateDoc(doc(db, "attendance", id), data);
  },

  deleteEntry: async (id: string): Promise<void> => {
    const db = DB.getDbInstance();
    if (!db) throw new Error("Missing Config");
    await deleteDoc(doc(db, "attendance", id));
  },
  
  clearEntries: async (userId: string): Promise<void> => {
      const db = DB.getDbInstance();
      if (!db) throw new Error("Missing Config");
      
      // Clear attendance
      const q = query(collection(db, "attendance"), where("userId", "==", userId));
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      
      // Clear leaves
      const qL = query(collection(db, "leaves"), where("userId", "==", userId));
      const snapshotL = await getDocs(qL);
      const deletePromisesL = snapshotL.docs.map(doc => deleteDoc(doc.ref));

      // Clear notes
      const qN = query(collection(db, "notes"), where("userId", "==", userId));
      const snapshotN = await getDocs(qN);
      const deletePromisesN = snapshotN.docs.map(doc => deleteDoc(doc.ref));

      await Promise.all([...deletePromises, ...deletePromisesL, ...deletePromisesN]);
  },

  // Leaves & Permissions
  getLeaves: async (userId: string): Promise<LeaveEntry[]> => {
      const db = DB.getDbInstance();
      if (!db) throw new Error("Missing Config");
      const q = query(collection(db, "leaves"), where("userId", "==", userId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveEntry));
  },

  addLeave: async (leave: LeaveEntry): Promise<LeaveEntry> => {
      const db = DB.getDbInstance();
      if (!db) throw new Error("Missing Config");
      const docRef = await addDoc(collection(db, "leaves"), {
          userId: leave.userId,
          date: leave.date,
          type: leave.type,
          hours: leave.hours || 0,
          note: leave.note || '', // Save note
          createdAt: new Date().toISOString()
      });
      return { ...leave, id: docRef.id };
  },

  deleteLeave: async (id: string): Promise<void> => {
      const db = DB.getDbInstance();
      if (!db) throw new Error("Missing Config");
      await deleteDoc(doc(db, "leaves", id));
  },

  // General Notes
  getNotes: async (userId: string): Promise<NoteEntry[]> => {
    const db = DB.getDbInstance();
    if (!db) throw new Error("Missing Config");
    const q = query(collection(db, "notes"), where("userId", "==", userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NoteEntry));
  },

  addNote: async (note: NoteEntry): Promise<NoteEntry> => {
      const db = DB.getDbInstance();
      if (!db) throw new Error("Missing Config");
      const docRef = await addDoc(collection(db, "notes"), {
          userId: note.userId,
          date: note.date,
          content: note.content,
          createdAt: new Date().toISOString()
      });
      return { ...note, id: docRef.id };
  },

  deleteNote: async (id: string): Promise<void> => {
      const db = DB.getDbInstance();
      if (!db) throw new Error("Missing Config");
      await deleteDoc(doc(db, "notes", id));
  },

  // Manager Bonuses / Exceptional Minutes
  getManagerBonuses: async (userId: string): Promise<Record<string, number>> => {
    let localMap: Record<string, number> = {};
    try {
      const raw = localStorage.getItem(`manager_bonuses_${userId}`);
      if (raw) localMap = JSON.parse(raw);
    } catch (e) {
      // ignore
    }

    const db = DB.getDbInstance();
    if (!db) return localMap;

    try {
      const q = query(collection(db, "manager_bonuses"), where("userId", "==", userId));
      const snapshot = await getDocs(q);
      const result: Record<string, number> = { ...localMap };
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        const month = data.month as string;
        // If minutes field exists, use it; otherwise fallback to 300 for legacy records
        result[month] = typeof data.minutes === 'number' ? data.minutes : 300;
      });
      try {
        localStorage.setItem(`manager_bonuses_${userId}`, JSON.stringify(result));
      } catch (e) {}
      return result;
    } catch (e) {
      console.warn("Could not fetch manager bonuses from cloud, using local fallback", e);
      return localMap;
    }
  },

  setManagerBonus: async (userId: string, month: string, minutes: number): Promise<void> => {
    try {
      const raw = localStorage.getItem(`manager_bonuses_${userId}`);
      const map: Record<string, number> = raw ? JSON.parse(raw) : {};
      if (minutes > 0) {
        map[month] = minutes;
      } else {
        delete map[month];
      }
      localStorage.setItem(`manager_bonuses_${userId}`, JSON.stringify(map));
    } catch (e) {
      console.warn("Could not save manager bonus to localStorage", e);
    }

    const db = DB.getDbInstance();
    if (!db) return;
    
    const q = query(collection(db, "manager_bonuses"), where("userId", "==", userId), where("month", "==", month));
    const snapshot = await getDocs(q);
    
    if (minutes > 0) {
      if (snapshot.empty) {
        await addDoc(collection(db, "manager_bonuses"), {
          userId,
          month,
          minutes,
          createdAt: new Date().toISOString()
        });
      } else {
        const firstDoc = snapshot.docs[0];
        await updateDoc(firstDoc.ref, { minutes, updatedAt: new Date().toISOString() });
        for (let i = 1; i < snapshot.docs.length; i++) {
          await deleteDoc(snapshot.docs[i].ref);
        }
      }
    } else {
      const deletePromises = snapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
      await Promise.all(deletePromises);
    }
  }
};