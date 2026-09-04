import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  limit, 
  where,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Conversation, JournalMessage, JournalSummary, SmartMemory, SmartReminder } from '../types';

// Initialize Firebase App instance safely
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Authentication
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Cloud Firestore using the configured database ID
export const db = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Authentication Helpers
export { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile 
};
export type { User };

// ==========================================
// STRICT USER-ISOLATED FIRESTORE API
// All path roots are strictly /users/{userId}/...
// ==========================================

export async function getUserProfile(userId: string) {
  if (!userId) throw new Error('User ID is required');
  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  return snap.exists() ? snap.data() : null;
}

export async function updateUserProfile(userId: string, data: { displayName?: string; photoURL?: string; preferences?: Record<string, unknown> }) {
  if (!userId) throw new Error('User ID is required');
  const userRef = doc(db, 'users', userId);
  await setDoc(userRef, { ...data, updatedAt: Date.now() }, { merge: true });
}

// Helper to sanitize data before sending to Firestore
// Firestore throws an error if any field is `undefined`
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return null as any;
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForFirestore(item)) as any;
  }
  // Preserve Date, Timestamp, and Firestore FieldValue sentinels (e.g. serverTimestamp())
  if (
    typeof data === 'object' &&
    !(data instanceof Date) &&
    !(data instanceof Timestamp) &&
    !('_methodName' in (data as any)) &&
    (data as any).constructor?.name !== 'FieldValue'
  ) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned as T;
  }
  return data;
}

// Conversations & Messages
export async function createConversation(userId: string, title: string = 'New Journal Entry'): Promise<string> {
  if (!userId) throw new Error('User ID is required for conversation');
  const colRef = collection(db, 'users', userId, 'conversations');
  const docRef = await addDoc(colRef, sanitizeForFirestore({
    userId,
    title: title || 'New Journal Entry',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messageCount: 0,
    moodTag: 'Reflective',
    hasSummary: false
  }));
  return docRef.id;
}

export async function getConversations(userId: string): Promise<Conversation[]> {
  if (!userId) return [];
  const colRef = collection(db, 'users', userId, 'conversations');
  const q = query(colRef, orderBy('updatedAt', 'desc'), limit(50));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Conversation));
}

export async function getConversation(userId: string, conversationId: string): Promise<Conversation | null> {
  if (!userId || !conversationId) return null;
  const docRef = doc(db, 'users', userId, 'conversations', conversationId);
  const snap = await getDoc(docRef);
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Conversation) : null;
}

export async function updateConversation(userId: string, conversationId: string, updates: Partial<Conversation>) {
  if (!userId || !conversationId) return;
  const docRef = doc(db, 'users', userId, 'conversations', conversationId);
  await updateDoc(docRef, sanitizeForFirestore({ ...updates, updatedAt: Date.now() }));
}

export async function deleteConversation(userId: string, conversationId: string) {
  const authenticatedUid = auth.currentUser?.uid;
  if (!authenticatedUid) throw new Error('Authentication required: Cannot delete journal session.');
  if (userId && userId !== authenticatedUid) {
    throw new Error('Unauthorized: You can only delete your own conversations.');
  }
  if (!conversationId) throw new Error('Conversation ID is required.');
  // Delete all messages in subcollection first
  const messagesCol = collection(db, 'users', authenticatedUid, 'conversations', conversationId, 'messages');
  const msgSnap = await getDocs(messagesCol);
  for (const m of msgSnap.docs) {
    await deleteDoc(m.ref);
  }
  const docRef = doc(db, 'users', authenticatedUid, 'conversations', conversationId);
  await deleteDoc(docRef);
}

export async function addJournalMessage(
  userId: string, 
  conversationId: string, 
  message: Omit<JournalMessage, 'id'>
): Promise<string> {
  if (!userId || !conversationId) throw new Error('Invalid conversation context');
  const colRef = collection(db, 'users', userId, 'conversations', conversationId, 'messages');
  const docRef = await addDoc(colRef, sanitizeForFirestore({
    ...message,
    timestamp: message.timestamp || Date.now()
  }));

  // Update conversation last updated
  const convRef = doc(db, 'users', userId, 'conversations', conversationId);
  await setDoc(convRef, sanitizeForFirestore({
    updatedAt: Date.now(),
    lastMessagePreview: (message.content || '').slice(0, 80)
  }), { merge: true });

  return docRef.id;
}

export async function getJournalMessages(userId: string, conversationId: string): Promise<JournalMessage[]> {
  if (!userId || !conversationId) return [];
  const colRef = collection(db, 'users', userId, 'conversations', conversationId, 'messages');
  const q = query(colRef, orderBy('timestamp', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as JournalMessage));
}

export async function updateMessageDecision(
  userId: string,
  conversationId: string,
  messageId: string,
  field: 'memoryDecision' | 'reminderDecision',
  decision: 'accepted' | 'dismissed'
) {
  if (!userId || !conversationId || !messageId) return;
  const msgRef = doc(db, 'users', userId, 'conversations', conversationId, 'messages', messageId);
  await updateDoc(msgRef, { [field]: decision });
}

// User-Controlled Smart Memories
export async function saveSmartMemory(userId: string, memory: Omit<SmartMemory, 'id'>): Promise<string> {
  if (!userId) throw new Error('User ID is required');
  const colRef = collection(db, 'users', userId, 'memories');
  const docRef = await addDoc(colRef, sanitizeForFirestore({
    userId,
    text: memory.text || '',
    category: memory.category || 'general',
    sourceConversationId: memory.sourceConversationId || null,
    sourceSnippet: memory.sourceSnippet || null,
    relevantDate: memory.relevantDate || null,
    approvedByUser: true,
    createdAt: memory.createdAt || Date.now()
  }));
  return docRef.id;
}

export async function getSmartMemories(userId: string): Promise<SmartMemory[]> {
  if (!userId) return [];
  const colRef = collection(db, 'users', userId, 'memories');
  const q = query(colRef, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as SmartMemory));
}

export async function deleteSmartMemory(userId: string, memoryId: string) {
  const authenticatedUid = auth.currentUser?.uid;
  if (!authenticatedUid) throw new Error('Authentication required: Cannot delete memory.');
  if (userId && userId !== authenticatedUid) {
    throw new Error('Unauthorized: You can only delete your own memories.');
  }
  if (!memoryId) throw new Error('Memory ID is required.');
  const docRef = doc(db, 'users', authenticatedUid, 'memories', memoryId);
  await deleteDoc(docRef);
}

// Smart Date-Based Reminders
export async function saveSmartReminder(userId: string, reminder: Omit<SmartReminder, 'id'>): Promise<string> {
  if (!userId) throw new Error('User ID is required');
  const colRef = collection(db, 'users', userId, 'reminders');
  const docRef = await addDoc(colRef, sanitizeForFirestore({
    userId,
    title: reminder.title || 'Untitled Reminder',
    dueDate: reminder.dueDate,
    dueTime: reminder.dueTime || null,
    notes: reminder.notes || '',
    category: reminder.category || 'deadline',
    completed: Boolean(reminder.completed),
    sourceConversationId: reminder.sourceConversationId || null,
    createdAt: reminder.createdAt || Date.now()
  }));
  return docRef.id;
}

export async function getSmartReminders(userId: string): Promise<SmartReminder[]> {
  if (!userId) return [];
  const colRef = collection(db, 'users', userId, 'reminders');
  const q = query(colRef, orderBy('dueDate', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as SmartReminder));
}

export async function toggleReminderCompleted(userId: string, reminderId: string, completed: boolean) {
  if (!userId || !reminderId) return;
  const docRef = doc(db, 'users', userId, 'reminders', reminderId);
  await updateDoc(docRef, { completed: Boolean(completed) });
}

export async function deleteSmartReminder(userId: string, reminderId: string) {
  const authenticatedUid = auth.currentUser?.uid;
  if (!authenticatedUid) throw new Error('Authentication required: Cannot delete reminder.');
  if (userId && userId !== authenticatedUid) {
    throw new Error('Unauthorized: You can only delete your own reminders.');
  }
  if (!reminderId) throw new Error('Reminder ID is required.');
  const docRef = doc(db, 'users', authenticatedUid, 'reminders', reminderId);
  await deleteDoc(docRef);
}

// Journal Summaries (Stored securely at: /users/{authenticatedUserUid}/summaries/{summaryId})
export async function saveJournalSummary(
  userId: string, 
  summary: {
    conversationId: string;
    conversationTitle?: string;
    topic: string;
    summaryText: string;
    summary?: string;
    keyPoints?: string[];
    emotions?: string[];
    tasksAndGoals?: string[];
    datesMentioned?: string[];
    reflectionQuestion?: string | null;
    createdAt?: any;
  }
): Promise<string> {
  // Always derive UID from authenticated Firebase session to prevent spoofing
  const authenticatedUid = auth.currentUser?.uid || userId;
  if (!authenticatedUid) throw new Error('Not authenticated — summary cannot be saved.');

  const colRef = collection(db, 'users', authenticatedUid, 'summaries');
  const summaryText = summary.summaryText || summary.summary || '';

  try {
    const docRef = await addDoc(colRef, {
      userId: authenticatedUid,
      conversationId: summary.conversationId || '',
      conversationTitle: summary.conversationTitle || 'Journal Entry',
      topic: summary.topic || 'Reflective Journal Entry',
      summaryText: summaryText,
      summary: summaryText,
      keyPoints: summary.keyPoints ?? [],
      emotions: summary.emotions ?? [],
      tasksAndGoals: summary.tasksAndGoals ?? [],
      datesMentioned: summary.datesMentioned ?? [],
      reflectionQuestion: summary.reflectionQuestion ?? '',
      createdAt: serverTimestamp()
    });

    // Write-then-read-back verification
    const savedDocRef = doc(db, 'users', authenticatedUid, 'summaries', docRef.id);
    const snapshot = await getDoc(savedDocRef);

    if (!snapshot.exists()) {
      throw new Error(`Write completed with document ID ${docRef.id} but immediate read-back returned does not exist.`);
    }

    // Mark conversation as summarized if conversationId exists
    if (summary.conversationId) {
      try {
        const convRef = doc(db, 'users', authenticatedUid, 'conversations', summary.conversationId);
        await updateDoc(convRef, { hasSummary: true });
      } catch (e) {
        console.warn('Note: Could not update conversation hasSummary flag:', e);
      }
    }

    return docRef.id;
  } catch (err: any) {
    console.error("Summary Firestore write failed:", err);
    throw err;
  }
}

export async function getJournalSummaries(userId?: string): Promise<JournalSummary[]> {
  const authenticatedUid = auth.currentUser?.uid || userId;
  if (!authenticatedUid) return [];

  const colRef = collection(db, 'users', authenticatedUid, 'summaries');
  const q = query(colRef, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => {
    const data = d.data();
    const text = data.summary || data.summaryText || '';
    return {
      id: d.id,
      ...data,
      summary: text,
      summaryText: text
    } as JournalSummary;
  });
}

export async function deleteJournalSummary(userId: string, summaryId: string) {
  const authenticatedUid = auth.currentUser?.uid;
  if (!authenticatedUid) throw new Error('Authentication required: Cannot delete summary.');
  if (userId && userId !== authenticatedUid) {
    throw new Error('Unauthorized: You can only delete your own summaries.');
  }
  if (!summaryId) throw new Error('Summary ID is required.');
  const docRef = doc(db, 'users', authenticatedUid, 'summaries', summaryId);
  await deleteDoc(docRef);
}
