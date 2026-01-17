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
            casualBalance: data.casualBalance ?? 7
        } as User;
    });
  },

  createUser: async (name: string, password: string): Promise<User> => {
    const db = DB.getDbInstance();
    if (!db) throw new Error("Missing Config");

    // All created users are standard 'user' role
    const docRef = await addDoc(collection(db, "users"), {
      name,
      password,
      role: 'user',
      annualBalance: 21,
      casualBalance: 7,
      createdAt: new Date().toISOString()
    });
    return { id: docRef.id, name, password, role: 'user', annualBalance: 21, casualBalance: 7 };
  },

  updateUserBalance: async (userId: string, annual: number, casual: number): Promise<void> => {
      const db = DB.getDbInstance();
      if (!db) throw new Error("Missing Config");
      await updateDoc(doc(db, "users", userId), {
          annualBalance: annual,
          casualBalance: casual
      });
  },

  updateUserBiometrics: async (userId: string, credId: string | null): Promise<void> => {
    const db = DB.getDbInstance();
    if (!db) throw new Error("Missing Config");
    await updateDoc(doc(db, "users", userId), {
        biometricCredId: credId || null
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
      note: entry.note || '', // Save note
      createdAt: new Date().toISOString()
    });
    return { ...entry, id: docRef.id };
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
  }
};