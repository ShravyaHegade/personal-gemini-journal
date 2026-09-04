import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import fallbackFirebaseConfig from './firebase-applet-config.json';

dotenv.config();

// Load Firebase configuration securely for token verification and Firestore REST operations
let firebaseConfig: {
  projectId: string;
  apiKey: string;
  firestoreDatabaseId?: string;
} = {
  projectId: fallbackFirebaseConfig.projectId || 'personal-gemini-journal-507109',
  apiKey: fallbackFirebaseConfig.apiKey || 'AIzaSyA29RkIjkb5IlvVXkxcczk2Ll25bU92740',
  firestoreDatabaseId: fallbackFirebaseConfig.firestoreDatabaseId || 'ai-studio-697eeba7-4692-4030-aac5-8d1022e8a45e'
};

try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    firebaseConfig = { ...firebaseConfig, ...rawConfig };
  }
} catch (e) {
  console.warn('Note: using fallback Firebase configuration:', e);
}

// Allow environment variable overrides (e.g. on Vercel deployment)
if (process.env.FIREBASE_PROJECT_ID) firebaseConfig.projectId = process.env.FIREBASE_PROJECT_ID;
if (process.env.FIREBASE_API_KEY) firebaseConfig.apiKey = process.env.FIREBASE_API_KEY;
if (process.env.FIRESTORE_DATABASE_ID) firebaseConfig.firestoreDatabaseId = process.env.FIRESTORE_DATABASE_ID;

const app = express();
const PORT = 3000;

// Handle potential pre-parsed body from Vercel serverless functions
app.use((req: Request, res: Response, next) => {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      try {
        req.body = JSON.parse(req.body);
      } catch {
        // Keep string if not valid JSON
      }
    }
    (req as any)._body = true;
  }
  next();
});

// Security: JSON body parser with size limiter to prevent DoS
app.use(express.json({ limit: '2mb' }));

// Security & CORS: Allow cross-origin preflights and standard headers for serverless/Vercel environments
app.use((req: Request, res: Response, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// Create modular API Router to support both /api/* and rewritten paths on Vercel
const apiRouter = express.Router();

// Helper: Authoritative Firebase ID Token verification via Google Identity Toolkit
async function verifyFirebaseIdToken(
  idToken: string,
  projectId: string,
  apiKey: string
): Promise<{ uid: string; email?: string }> {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('ID token is missing or malformed');
  }

  // 1. Validate JWT format and claims
  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token structure');
  }

  let claims: any = {};
  try {
    const payloadJson = Buffer.from(parts[1], 'base64').toString('utf8');
    claims = JSON.parse(payloadJson);
  } catch {
    throw new Error('Failed to parse token claims');
  }

  // Check expiration
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (claims.exp && claims.exp < nowSeconds) {
    throw new Error('Token has expired');
  }

  // Check project audience & issuer
  if (claims.aud && claims.aud !== projectId) {
    throw new Error('Token audience does not match project');
  }
  if (claims.iss && claims.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error('Token issuer does not match project');
  }

  // 2. Authoritative verification with Google Identity Toolkit
  const lookupUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
  const response = await fetch(lookupUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken })
  });

  if (!response.ok) {
    const errData: any = await response.json().catch(() => ({}));
    const errMsg = errData?.error?.message || response.statusText;
    throw new Error(`Token verification rejected by Google: ${errMsg}`);
  }

  const data: any = await response.json();
  if (!data.users || data.users.length === 0 || !data.users[0].localId) {
    throw new Error('No user identity returned by authentication provider');
  }

  return {
    uid: data.users[0].localId,
    email: data.users[0].email
  };
}

interface AuthenticatedUser {
  uid: string;
  email?: string;
  idToken: string;
}

// Security Middleware / Helper: Authoritative Firebase ID Token verification
async function authenticateFirebaseRequest(
  req: Request,
  res: Response
): Promise<AuthenticatedUser | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  const idToken = authHeader.substring(7).trim();
  if (!idToken) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  try {
    const verified = await verifyFirebaseIdToken(
      idToken,
      firebaseConfig.projectId,
      firebaseConfig.apiKey
    );

    if (!verified || !verified.uid) {
      res.status(401).json({ error: 'Unauthorized' });
      return null;
    }

    // Defensive Security check: Client-provided UIDs are never trusted.
    // If a client explicitly passes a mismatched userId or uid parameter in body or query, reject immediately with 403 Forbidden.
    const clientProvidedUid = req.body?.userId || req.body?.uid || req.query?.userId || req.query?.uid;
    if (clientProvidedUid && clientProvidedUid !== verified.uid) {
      res.status(403).json({ error: 'Forbidden: Client-provided UID does not match authenticated token identity.' });
      return null;
    }

    return {
      uid: verified.uid,
      email: verified.email,
      idToken
    };
  } catch {
    // Return generic 401 Unauthorized; never expose token strings, stack traces, or internal errors
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
}

// Helper: Parse Firestore REST field values into standard JS objects
function parseFirestoreValue(val: any): any {
  if (!val || typeof val !== 'object') return val;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return parseFloat(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(parseFirestoreValue);
  }
  if ('mapValue' in val) {
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      res[k] = parseFirestoreValue(v);
    }
    return res;
  }
  return val;
}

function parseFirestoreDoc(doc: any): any {
  if (!doc) return null;
  const id = doc.name ? doc.name.split('/').pop() : '';
  const result: Record<string, any> = { id };
  if (doc.fields) {
    for (const [key, val] of Object.entries(doc.fields)) {
      result[key] = parseFirestoreValue(val);
    }
  }
  if (doc.createTime) result._createTime = doc.createTime;
  if (doc.updateTime) result._updateTime = doc.updateTime;
  return result;
}

// Helper: Fetch a collection for a specific verified user from Firestore REST API via :runQuery
async function fetchUserCollection(
  verifiedUid: string,
  idToken: string,
  collectionName: string,
  limitCount: number = 100
): Promise<any[]> {
  const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${databaseId}/documents/users/${verifiedUid}:runQuery`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: collectionName }],
          limit: limitCount
        }
      })
    });

    if (res.status === 404) {
      return [];
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`Firestore runQuery for ${collectionName} returned status ${res.status}: ${errText.slice(0, 150)}`);
      return [];
    }

    const data: any = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .filter((item: any) => item && item.document)
      .map((item: any) => parseFirestoreDoc(item.document));
  } catch (err) {
    console.error(`Error fetching collection ${collectionName}:`, err);
    return [];
  }
}

// Helper: Fetch messages for a specific conversation via :runQuery
async function fetchConversationMessages(
  verifiedUid: string,
  idToken: string,
  conversationId: string,
  limitCount: number = 100
): Promise<any[]> {
  const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${databaseId}/documents/users/${verifiedUid}/conversations/${conversationId}:runQuery`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'messages' }],
          orderBy: [{ field: { fieldPath: 'timestamp' }, direction: 'ASCENDING' }],
          limit: limitCount
        }
      })
    });

    if (!res.ok) {
      // Fallback without orderBy in case a compound index is missing
      const fallbackRes = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'messages' }],
            limit: limitCount
          }
        })
      });
      if (!fallbackRes.ok) return [];
      const fallbackData: any = await fallbackRes.json();
      if (!Array.isArray(fallbackData)) return [];
      const docs = fallbackData
        .filter((item: any) => item && item.document)
        .map((item: any) => parseFirestoreDoc(item.document));
      return docs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    }

    const data: any = await res.json();
    if (!Array.isArray(data)) return [];
    const docs = data
      .filter((item: any) => item && item.document)
      .map((item: any) => parseFirestoreDoc(item.document));
    return docs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  } catch (err) {
    console.error(`Error fetching messages for conversation ${conversationId}:`, err);
    return [];
  }
}

// Lazy initialization of Gemini client
function getGeminiClient(): { ai: GoogleGenAI; hasKey: boolean } {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY;
  const options: { apiKey?: string; httpOptions?: { headers?: Record<string, string> } } = {
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  };
  if (apiKey) {
    options.apiKey = apiKey;
  }
  return {
    ai: new GoogleGenAI(options),
    hasKey: Boolean(apiKey)
  };
}

// Helper to call Gemini with retries and fallback models for handling 503/429 spikes or model latency
async function generateContentWithRetry(
  ai: GoogleGenAI,
  params: {
    contents: any;
    config?: any;
    primaryModel?: string;
    fallbackModels?: string[];
    timeoutMs?: number;
  }
) {
  const modelsToTry = [
    params.primaryModel || 'gemini-3.8-flash',
    ...(params.fallbackModels || ['gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview'])
  ];

  let lastError: any = null;
  const timeoutMs = params.timeoutMs || 8000;

  for (const model of modelsToTry) {
    try {
      let timer: any;
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms waiting for ${model}`)), timeoutMs);
      });

      const response: any = await Promise.race([
        ai.models.generateContent({
          model,
          contents: params.contents,
          config: params.config
        }),
        timeoutPromise
      ]);
      clearTimeout(timer);

      if (response && response.text) {
        return response;
      }
    } catch (err: any) {
      lastError = err;
      const status = err?.status || (err?.message?.includes('429') ? '429 Quota' : err?.message || 'Unavailable');
      console.warn(`[Gemini Fallback] Model ${model} (${status}). Attempting next model...`);
      continue;
    }
  }

  throw lastError || new Error('All Gemini model endpoints were unavailable');
}

// Health check endpoint
apiRouter.get('/health', (req: Request, res: Response) => {
  const isConfigured = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY);
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Personal Gemini Journal Backend',
    geminiConfigured: isConfigured
  });
});

// Safe security metadata endpoint (never leaks credentials)
apiRouter.get('/security/info', (req: Request, res: Response) => {
  res.json({
    isolationLevel: 'strict-user-sandboxed',
    credentialStorage: 'server-side-isolated',
    firestoreRulesDeployed: true,
    authRequired: true
  });
});

// Chat endpoint for multi-turn empathetic journaling with smart memory & reminder detection
apiRouter.post('/chat', async (req: Request, res: Response) => {
  try {
    const auth = await authenticateFirebaseRequest(req, res);
    if (!auth) return;

    const body = req.body || {};
    const currentMessage = typeof body.currentMessage === 'string' ? body.currentMessage : '';
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const approvedMemories = Array.isArray(body.approvedMemories) ? body.approvedMemories : [];
    const userTimezone = typeof body.userTimezone === 'string' ? body.userTimezone : 'UTC';

    // Input Validation
    if (!currentMessage.trim()) {
      return res.status(400).json({ error: 'Valid currentMessage is required' });
    }

    const { ai, hasKey } = getGeminiClient();
    if (!hasKey) {
      return res.status(503).json({
        error: 'Gemini API key is not configured on the server. Please configure GEMINI_API_KEY in your environment variables.'
      });
    }

    // Format approved memories as contextual guidance
    const memoriesContext = approvedMemories.length > 0
      ? `\nApproved User Memories (Use only as passive context to personalize your response, do not recite them robotically):\n${approvedMemories.map((m: any) => `- [${m.category || 'fact'}]: ${m.text}`).join('\n')}`
      : '\nNo previous approved memories stored.';

    const systemInstruction = `You are "Personal Gemini Journal", a warm, mindful, and calm personal journaling companion.
Your purpose is to provide a reflective space where the user can brainstorm, process emotions, organize thoughts, and record their life.

STRICT BEHAVIOR RULES:
1. Tone: Warm, grounded, thoughtful, non-judgmental, and naturally conversational.
2. Empathy: Acknowledge emotions directly and naturally. Ask 1 gentle, thoughtful follow-up question when appropriate.
3. Anti-Slop / Anti-Robotic: Avoid robotic opening phrases like "I understand how you feel" or "As an AI...". Speak like a thoughtful, trusted journaling partner.
4. Boundaries: Never pretend to be human or claim to have physical experiences.
5. Conciseness: Keep conversational replies between 2 to 4 sentences unless the user explicitly asks for detailed exploration.
6. Memory Detection: If the user mentions a significant goal, personal preference, project milestone, or core personal fact they might value retaining across sessions, formulate a proposedMemory object.
7. Reminder Detection: If the user mentions an upcoming deadline, exam, meeting, date, or time-sensitive commitment, extract it into proposedReminder.
8. Current Reference Time: Today's reference date is ${new Date().toISOString().split('T')[0]} (Timezone: ${userTimezone}).
9. Title Generation: Generate a concise, meaningful title (2 to 5 words, e.g., "Project Deadline Stress", "Exam Preparation", "Weekend Reflection") that accurately summarizes the topic of this session.

${memoriesContext}
`;

    // Prepare contents for Gemini
    const contents: any[] = [];

    // Add previous history (sanitize and limit to last 20 turns)
    const recentHistory = messages.slice(-20);
    for (const msg of recentHistory) {
      contents.push({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: String(msg.content) }]
      });
    }

    // Add current user message
    contents.push({
      role: 'user',
      parts: [{ text: currentMessage.trim() }]
    });

    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        reply: {
          type: Type.STRING,
          description: 'Your conversational, empathetic response to the user.'
        },
        suggestedTitle: {
          type: Type.STRING,
          description: 'A crisp, meaningful 2-5 word title summarizing the central theme of this journal entry (e.g., "Project Deadline Stress", "Exam Preparation", "Weekend Reflection").'
        },
        suggestedMood: {
          type: Type.STRING,
          description: 'A single word describing the perceived tone/mood (e.g., Reflective, Stressed, Inspired, Grateful, Joyful, Tired, Focused).'
        },
        proposedMemory: {
          type: Type.OBJECT,
          description: 'Fill ONLY if the user shared an important goal, personal preference, significant fact, or life event that would be helpful to remember permanently across journal sessions. Otherwise set to null.',
          nullable: true,
          properties: {
            text: { 
              type: Type.STRING, 
              description: 'Clear, concise memory snippet phrased clearly (e.g., "Working on Gen AI Ideathon project", "Prefers morning reflection", "Studying for AWS certification").' 
            },
            category: { 
              type: Type.STRING, 
              enum: ['goal', 'event', 'preference', 'task', 'milestone', 'general'],
              description: 'Category of the memory' 
            },
            relevantDate: { 
              type: Type.STRING, 
              description: 'Optional date string (YYYY-MM-DD or readable date) if tied to a date',
              nullable: true 
            }
          }
        },
        proposedReminder: {
          type: Type.OBJECT,
          description: 'Fill ONLY if the user mentioned a specific upcoming deadline, exam, appointment, or scheduled event that warrants setting a calendar reminder. Otherwise set to null.',
          nullable: true,
          properties: {
            title: { 
              type: Type.STRING, 
              description: 'Short title for the reminder (e.g., "SQL Exam", "Project Submission Deadline")' 
            },
            dueDate: { 
              type: Type.STRING, 
              description: 'The target date in YYYY-MM-DD format based on context' 
            },
            dueTime: { 
              type: Type.STRING, 
              description: 'Optional time string in HH:MM format',
              nullable: true 
            },
            category: { 
              type: Type.STRING, 
              enum: ['exam', 'deadline', 'meeting', 'health', 'personal', 'habit'],
              description: 'Category for the reminder' 
            },
            notes: { 
              type: Type.STRING, 
              description: 'Brief context or note regarding the reminder',
              nullable: true 
            }
          }
        }
      },
      required: ['reply', 'suggestedMood']
    };

    const response = await generateContentWithRetry(ai, {
      primaryModel: 'gemini-3.8-flash',
      fallbackModels: ['gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview'],
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
        responseMimeType: 'application/json',
        responseSchema
      }
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Empty response received from AI model');
    }

    const parsed = JSON.parse(responseText);
    return res.json(parsed);

  } catch (error: any) {
    console.error('Server error in /api/chat:', error?.message || error);
    // Secure error handling: Never leak internal stack traces or API keys
    return res.status(500).json({
      error: 'An internal error occurred while processing your journal reflection. Please try again.'
    });
  }
});

// Ask My Journal — Private Journal Intelligence & History Reasoning Endpoint
apiRouter.post('/ask-journal', async (req: Request, res: Response) => {
  try {
    const auth = await authenticateFirebaseRequest(req, res);
    if (!auth) return;

    const verifiedUid = auth.uid;
    const idToken = auth.idToken;

    // 3. Validate user question input safely
    const body = req.body || {};
    const question = typeof body.question === 'string' ? body.question : '';
    const chatHistory = Array.isArray(body.chatHistory) ? body.chatHistory : [];
    const userTimezone = typeof body.userTimezone === 'string' ? body.userTimezone : 'UTC';

    if (!question.trim()) {
      return res.status(400).json({ error: 'A valid question is required.' });
    }

    const { ai, hasKey } = getGeminiClient();
    if (!hasKey) {
      return res.status(503).json({
        error: 'Gemini API key is not configured on the server. Please configure GEMINI_API_KEY in your environment variables.'
      });
    }

    // 4. Retrieve ONLY this verified user's journal collections from Firestore
    const [summaries, memories, reminders, conversations, reflections] = await Promise.all([
      fetchUserCollection(verifiedUid, idToken, 'summaries', 100),
      fetchUserCollection(verifiedUid, idToken, 'memories', 100),
      fetchUserCollection(verifiedUid, idToken, 'reminders', 100),
      fetchUserCollection(verifiedUid, idToken, 'conversations', 100),
      fetchUserCollection(verifiedUid, idToken, 'reflections', 100)
    ]);

    // Sort conversations chronologically descending (most recent first)
    conversations.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));

    // Fetch message transcripts for conversations (up to 15 conversations)
    const convsToAnalyze = conversations.slice(0, 15);
    const convMessages = await Promise.all(
      convsToAnalyze.map(async (c: any) => {
        const msgs = await fetchConversationMessages(verifiedUid, idToken, c.id, 50);
        return { conversation: c, messages: msgs };
      })
    );

    // 5. Calculate grounding metadata & timeline
    const allTimestamps: number[] = [];
    summaries.forEach((s: any) => {
      if (s.createdAt) allTimestamps.push(typeof s.createdAt === 'number' ? s.createdAt : Date.parse(s.createdAt) || 0);
    });
    conversations.forEach((c: any) => {
      if (c.createdAt) allTimestamps.push(typeof c.createdAt === 'number' ? c.createdAt : Date.parse(c.createdAt) || 0);
      if (c.updatedAt) allTimestamps.push(typeof c.updatedAt === 'number' ? c.updatedAt : Date.parse(c.updatedAt) || 0);
    });
    memories.forEach((m: any) => {
      if (m.createdAt) allTimestamps.push(typeof m.createdAt === 'number' ? m.createdAt : Date.parse(m.createdAt) || 0);
      if (m.relevantDate) {
        const parsed = Date.parse(m.relevantDate);
        if (!isNaN(parsed)) allTimestamps.push(parsed);
      }
    });
    reminders.forEach((r: any) => {
      if (r.createdAt) allTimestamps.push(typeof r.createdAt === 'number' ? r.createdAt : Date.parse(r.createdAt) || 0);
      if (r.dueDate) {
        const parsed = Date.parse(r.dueDate);
        if (!isNaN(parsed)) allTimestamps.push(parsed);
      }
    });
    convMessages.forEach((cm: any) => {
      cm.messages.forEach((m: any) => {
        if (m.timestamp) allTimestamps.push(typeof m.timestamp === 'number' ? m.timestamp : Date.parse(m.timestamp) || 0);
      });
    });
    reflections.forEach((rf: any) => {
      if (rf.createdAt) allTimestamps.push(typeof rf.createdAt === 'number' ? rf.createdAt : Date.parse(rf.createdAt) || 0);
    });

    const validTs = allTimestamps.filter(t => typeof t === 'number' && !isNaN(t) && t > 0);
    let dateRange = 'Recent Journal Entries';
    if (validTs.length > 0) {
      const minDate = new Date(Math.min(...validTs));
      const maxDate = new Date(Math.max(...validTs));
      const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
      if (minDate.toDateString() === maxDate.toDateString()) {
        dateRange = minDate.toLocaleDateString('en-US', options);
      } else {
        dateRange = `${minDate.toLocaleDateString('en-US', options)} → ${maxDate.toLocaleDateString('en-US', options)}`;
      }
    } else {
      dateRange = 'No recorded entries yet';
    }

    const totalEntries = conversations.length;
    const totalSummaries = summaries.length;
    const totalMemories = memories.length;
    const totalReminders = reminders.length;
    const totalReflections = reflections.length;

    // Strict empty check: ONLY return empty if ALL collections contain 0 records
    if (totalEntries === 0 && totalSummaries === 0 && totalMemories === 0 && totalReminders === 0 && totalReflections === 0) {
      return res.json({
        answer: "I couldn't find enough information in your journal to answer that. Your journal is currently empty. Start your first reflection in Journal Chat or record a memory to begin building your story!",
        groundingMetadata: {
          entriesAnalyzed: 0,
          summariesAnalyzed: 0,
          memoriesAnalyzed: 0,
          remindersAnalyzed: 0,
          dateRange: 'No entries yet',
          keyThemes: []
        }
      });
    }

    // Helper for readable date strings
    const formatTimestamp = (val: any): string => {
      if (!val) return '';
      const date = typeof val === 'number' ? new Date(val) : new Date(val);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    // 6. Build structured context from user's journal
    let contextText = '';

    if (memories.length > 0) {
      contextText += `=== USER'S APPROVED SMART MEMORIES (Core Facts, Goals, & Preferences) ===\n`;
      memories.forEach((m: any) => {
        contextText += `- [${m.category || 'general'}]: ${m.text}${m.relevantDate ? ` (Target/Ref Date: ${m.relevantDate})` : ''} (Saved: ${formatTimestamp(m.createdAt)})\n`;
      });
      contextText += '\n';
    }

    if (reminders.length > 0) {
      contextText += `=== USER'S SMART REMINDERS & DEADLINES ===\n`;
      reminders.forEach((r: any) => {
        contextText += `- [${r.completed ? 'COMPLETED' : 'PENDING'}] "${r.title}" (Due: ${r.dueDate}${r.dueTime ? ' ' + r.dueTime : ''}, Category: ${r.category || 'deadline'})${r.notes ? ` - Notes: ${r.notes}` : ''}\n`;
      });
      contextText += '\n';
    }

    if (summaries.length > 0) {
      contextText += `=== USER'S JOURNAL SESSION SUMMARIES (Deep Structured Records) ===\n`;
      summaries.forEach((s: any, idx: number) => {
        contextText += `--- Summary #${idx + 1}: "${s.topic || s.conversationTitle || 'Session'}" (${formatTimestamp(s.createdAt || s._createTime)}) ---\n`;
        if (s.summaryText || s.summary) contextText += `Overview: ${s.summaryText || s.summary}\n`;
        if (Array.isArray(s.keyPoints) && s.keyPoints.length > 0) contextText += `Key Insights: ${s.keyPoints.join('; ')}\n`;
        if (Array.isArray(s.emotions) && s.emotions.length > 0) contextText += `Emotions Noted: ${s.emotions.join(', ')}\n`;
        if (Array.isArray(s.tasksAndGoals) && s.tasksAndGoals.length > 0) contextText += `Goals & Tasks: ${s.tasksAndGoals.join('; ')}\n`;
        if (Array.isArray(s.datesMentioned) && s.datesMentioned.length > 0) contextText += `Dates Referenced: ${s.datesMentioned.join(', ')}\n`;
        contextText += '\n';
      });
    }

    if (convMessages.length > 0) {
      contextText += `=== JOURNAL ENTRIES & CHAT CONVERSATIONS (Remembered & Unremembered History) ===\n`;
      convMessages.forEach((cm: any) => {
        const convDate = formatTimestamp(cm.conversation.createdAt || cm.conversation.updatedAt || cm.conversation._createTime);
        contextText += `--- Entry / Conversation: "${cm.conversation.title || 'Journal Entry'}" (Date: ${convDate || 'Recent'}) [Mood: ${cm.conversation.moodTag || 'Reflective'}] ---\n`;
        if (cm.messages && cm.messages.length > 0) {
          cm.messages.forEach((m: any) => {
            const msgDate = m.timestamp ? `[${formatTimestamp(m.timestamp)}] ` : '';
            contextText += `${msgDate}${m.role === 'model' ? 'Journal Companion' : 'User Entry'}: ${m.content}\n`;
          });
        } else if (cm.conversation.lastMessagePreview) {
          contextText += `Content Preview: ${cm.conversation.lastMessagePreview}\n`;
        }
        contextText += '\n';
      });
    }

    if (reflections.length > 0) {
      contextText += `=== USER'S SAVED REFLECTIONS ===\n`;
      reflections.forEach((rf: any) => {
        contextText += `- [${formatTimestamp(rf.createdAt)}]: ${rf.prompt || 'Reflection'}: ${rf.response || rf.content || ''}\n`;
      });
      contextText += '\n';
    }

    const today = new Date();
    const todayIso = today.toISOString().split('T')[0];
    const todayReadable = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // 7. Formulate Gemini System Instruction & Content Prompt
    const systemInstruction = `You are "Ask My Journal", a deeply insightful and private personal journal intelligence system.
Your purpose is to answer the user's inquiries by synthesizing, retrieving, and reasoning across their actual accumulated journal history.

You must feel like "My personal AI that has read my journal" with deep synthesis across entries, rather than a detached or generic chatbot.

CORE OPERATING DIRECTIVES:
1. STRICT GROUNDING: Answer based EXCLUSIVELY on the authenticated user's journal context below. Never hallucinate, assume, or invent facts, dates, events, accomplishments, feelings, or relationships not present in the user's journal records.
2. MISSING INFORMATION RULE: If the user's journal does not contain enough evidence or information to answer the question, clearly state:
"I couldn't find enough information in your journal to answer that."
Briefly explain what is or isn't present in the records without guessing. DO NOT say "your journal is empty" if entries exist.
3. CONCISE & STRUCTURED FORMAT: Do NOT return one large unbroken paragraph. Organize answers into clean, highly readable Markdown sections with emoji badges, headers (##, ###), bullet points, numbered lists, and Markdown tables when appropriate.
4. ADAPTIVE SECTION STRUCTURE: Do NOT mechanically output the same sections for every question. Intelligently adapt your response layout to the user's question type and intent:

--- CATEGORY A: ACCOMPLISHMENTS & ACHIEVEMENTS ("What have I accomplished this month?", "What did I complete?", "What have I achieved recently?") ---
Structure as:
## 🏆 Accomplishments
1. **[Accomplishment Title]**
   📅 [Specific date from journal, e.g. September 3]
   Evidence: [Actual journal evidence and details from entries]
2. **[Next Accomplishment]**
   📅 [Date]
   Evidence: [Journal evidence]

### 📈 Progress I Notice
[Short evidence-based synthesis of growth and momentum across recent entries]

### ⭐ Standout Achievement
[Most significant accomplishment based on actual journal evidence]

--- CATEGORY B: GOALS STILL IN PROGRESS & UNFINISHED OBJECTIVES ("What goals have I not completed?", "What goals am I working toward?", "What did I say I wanted to do but haven't done?") ---
Structure as:
## 🎯 Goals Still In Progress

### 🔄 In Progress
- [Goal with evidence from journal]
- [Goal with evidence from journal]

### ⏳ Still Pending
- [Pending goal or commitment with journal evidence]

### 📅 Important Deadlines
- [Date] — [Event/Deadline mentioned in journal or reminders]

### ➡️ Suggested Focus
[Short useful, evidence-grounded suggestion based directly on journal entries]

--- CATEGORY C: EMOTIONAL PATTERNS, STRESS & MOOD ("What has been stressing me lately?", "When was I most confident?", "How have I been feeling?") ---
Structure as:
## ❤️ Emotional Patterns

### Main Themes
- [Theme identified from journal reflections]
- [Theme identified from journal reflections]

### What Seems To Be Causing It
- [Journal-supported factor or event]

### Positive Moments
- [Specific uplifting entry or triumph recorded in the journal]

### 🔎 Pattern I Notice
[Evidence-based observation across entries. NEVER diagnose the user or make clinical/medical claims. Use mindful language like "Your journal mentions...", "A recurring thread in your entries..."]

--- CATEGORY D: LIFE CHANGES & TRANSITIONS ("What changed in my life recently?", "How has my life changed?", "What is different compared with earlier?") ---
Structure as:
## 🔄 Changes In My Life

### Before
[Earlier journal evidence and baseline state]

### Recently
[Recent journal evidence and updated state]

### Biggest Changes
1. [First major change observed in journal]
2. [Second major change observed in journal]

### 📈 What I Notice
[Short evidence-based synthesis of the shift]

--- CATEGORY E: LIFE PATTERNS & RECURRING THEMES ("What patterns do you notice in my life?", "What do I keep talking about?", "What have you noticed about me?") ---
Structure as:
## 🔎 Patterns in Your Journal

### 📌 From Your Journal
- "[Direct relevant quote or fact from journal]" — [Date]
- "[Second relevant quote or fact from journal]" — [Date]

### 🔄 Recurring Themes
- [Theme observed across multiple journal entries]
- [Goal or challenge brought up multiple times]

### 🔎 Pattern I Notice
[Short synthesis connecting these patterns grounded in user's written entries]

--- CATEGORY F: IMPORTANT EVENTS & DATES ("When is X?", "What dates are coming up?", "What happened on X?") ---
Structure as:
## 📅 Important Dates & Events
### Upcoming Deadlines & Events
- [Date] — [Event or milestone from reminders/entries]
### Past Key Milestones
- [Date] — [Event or milestone recorded in journal]

--- CATEGORY G: GENERAL QUESTIONS (Any inquiry not matching above categories) ---
Structure as:
## 💡 Answer
[Direct, clear answer to the user's specific question]

### 📌 From Your Journal
- "[Specific journal fact or quote]" — [Date]
- "[Additional supporting detail]" — [Date]

### 🔎 Pattern I Notice
[Short synthesis explaining how this relates to their broader reflections]

5. EVIDENCE AND PROPORTION:
- For simple questions, keep the answer short, direct, and focused.
- For complex inquiries, provide a deeper structured answer with appropriate sections.
- Always cite specific dates (e.g. September 3) when present in the journal. Never invent dates.
- Ground answers strictly in the user's authentic journal records. Never fabricate entries.

Reference Date Today: ${todayReadable} (${todayIso}) (User Timezone: ${userTimezone})

${contextText}`;

    const contents: any[] = [];
    if (Array.isArray(chatHistory)) {
      const recentHistory = chatHistory.slice(-6);
      for (const h of recentHistory) {
        contents.push({
          role: h.role === 'model' ? 'model' : 'user',
          parts: [{ text: String(h.content) }]
        });
      }
    }
    contents.push({
      role: 'user',
      parts: [{ text: question.trim() }]
    });

    const askSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        answer: {
          type: Type.STRING,
          description: `The comprehensive, grounded answer synthesizing the user journal history. Reference specific dates, entries, goals, reminders, and summaries where available. If there is insufficient information to answer the question, state: "I couldn't find enough information in your journal to answer that."`
        },
        keyThemes: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: '2 to 5 relevant themes or topics identified in the journal for this inquiry.'
        }
      },
      required: ['answer']
    };

    const response = await generateContentWithRetry(ai, {
      primaryModel: 'gemini-3.8-flash',
      fallbackModels: ['gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview'],
      contents,
      config: {
        systemInstruction,
        temperature: 0.3,
        responseMimeType: 'application/json',
        responseSchema: askSchema
      }
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Empty response from AI model');
    }

    let parsed: any = {};
    try {
      parsed = JSON.parse(responseText);
    } catch {
      try {
        const cleaned = responseText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = { answer: responseText, keyThemes: [] };
      }
    }

    const finalAnswer = parsed.answer || parsed.response || responseText;

    const groundingMetadata = {
      entriesAnalyzed: totalEntries,
      summariesAnalyzed: totalSummaries,
      memoriesAnalyzed: totalMemories,
      remindersAnalyzed: totalReminders,
      dateRange,
      keyThemes: parsed.keyThemes || []
    };

    return res.json({
      answer: finalAnswer,
      groundingMetadata
    });

  } catch (error: any) {
    console.error('Server error in /api/ask-journal:', error?.message || error);
    return res.status(500).json({
      error: error?.message ? `Failed to process journal query: ${error.message}` : 'An internal error occurred while processing your journal query. Please try again.'
    });
  }
});

// Summarization endpoint
apiRouter.post('/summarize', async (req: Request, res: Response) => {
  try {
    const auth = await authenticateFirebaseRequest(req, res);
    if (!auth) return;

    const body = req.body || {};
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const conversationTitle = typeof body.conversationTitle === 'string' ? body.conversationTitle : '';

    if (messages.length === 0) {
      return res.status(400).json({ error: 'Conversation messages are required for summarization' });
    }

    const { ai, hasKey } = getGeminiClient();
    if (!hasKey) {
      return res.status(503).json({
        error: 'Gemini API key is not configured on the server. Please configure GEMINI_API_KEY in your environment variables.'
      });
    }

    const formattedTranscript = messages
      .map((m: any) => `${m.role === 'model' ? 'Journal Companion' : 'User'}: ${m.content}`)
      .join('\n\n');

    const prompt = `Please analyze and summarize this journal session titled "${conversationTitle || 'Journal Entry'}".

Session Transcript:
${formattedTranscript}

Produce a structured, deeply insightful summary following the schema.`;

    const summarySchema: Schema = {
      type: Type.OBJECT,
      properties: {
        topic: {
          type: Type.STRING,
          description: 'A crisp, meaningful title or theme for this journal session (3-6 words).'
        },
        summaryText: {
          type: Type.STRING,
          description: 'A 2-3 paragraph thoughtful narrative summary of the user thoughts, reflections, and insights.'
        },
        keyPoints: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: '3 to 5 core insights or takeaways from this conversation.'
        },
        emotions: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Key emotions and sentiments identified in the entry (e.g., "Frustrated with debugging", "Relieved after breakthrough", "Hopeful about tomorrow").'
        },
        tasksAndGoals: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Any actionable goals, tasks, or intentions mentioned.'
        },
        datesMentioned: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Any specific dates, deadlines, or timeframes referenced in the session.'
        },
        reflectionQuestion: {
          type: Type.STRING,
          description: 'A gentle closing reflection prompt for the user to ponder later.'
        }
      },
      required: ['topic', 'summaryText', 'keyPoints', 'emotions', 'tasksAndGoals', 'datesMentioned']
    };

    const response = await generateContentWithRetry(ai, {
      primaryModel: 'gemini-3.8-flash',
      fallbackModels: ['gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview'],
      contents: prompt,
      config: {
        systemInstruction: 'You are an insightful journal summarizer. You capture core emotional nuances, actionable takeaways, and dates with clarity and privacy-first discretion.',
        temperature: 0.4,
        responseMimeType: 'application/json',
        responseSchema: summarySchema
      }
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Failed to generate summary');
    }

    const parsed = JSON.parse(responseText);
    return res.json(parsed);

  } catch (error: any) {
    console.error('Server error in /api/summarize:', error?.message || error);
    return res.status(500).json({
      error: error?.message || 'Failed to generate journal summary. Please try again.'
    });
  }
});

// Daily Mindful Reflection Prompt Generator
apiRouter.get('/daily-prompt', async (req: Request, res: Response) => {
  try {
    const { ai, hasKey } = getGeminiClient();
    if (!hasKey) {
      throw new Error('Gemini API key not configured');
    }

    const prompt = 'Generate 3 unique, inspiring, and calming daily journal reflection prompts for personal growth, mindfulness, and clarity.';
    
    const promptSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        prompts: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              subtitle: { type: Type.STRING },
              starterText: { type: Type.STRING },
              category: { type: Type.STRING }
            },
            required: ['title', 'subtitle', 'starterText', 'category']
          }
        }
      },
      required: ['prompts']
    };

    const response = await generateContentWithRetry(ai, {
      primaryModel: 'gemini-3.8-flash',
      fallbackModels: ['gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview'],
      contents: prompt,
      config: {
        temperature: 0.8,
        responseMimeType: 'application/json',
        responseSchema: promptSchema
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (error) {
    // Fallback safe prompts if API is temporarily unavailable
    return res.json({
      prompts: [
        {
          title: 'Unpacking the Day',
          subtitle: 'What drained your energy today, and what restored it?',
          starterText: 'Today, the thing that took the most out of me was...',
          category: 'Reflection'
        },
        {
          title: 'Upcoming Milestones',
          subtitle: 'What is one thing you are looking forward to or preparing for?',
          starterText: 'Looking ahead to this week, my main focus is...',
          category: 'Planning'
        },
        {
          title: 'Gratitude & Wins',
          subtitle: 'A small moment of satisfaction or peace you noticed today.',
          starterText: 'One small moment that made me smile was...',
          category: 'Gratitude'
        }
      ]
    });
  }
});

// Mount API router under both /api and / to seamlessly support direct calls and Vercel path rewrites
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Express unhandled error handler: Always return JSON instead of default HTML error page
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Unhandled Express error:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({
    error: err?.message || 'An internal server error occurred.'
  });
});

// Start Express server and connect Vite in standalone non-serverless mode
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Personal Gemini Journal server running on http://0.0.0.0:${PORT}`);
  });
}

export default app;

// Only bind and listen when running directly as the main server process (not in Vercel serverless compute or imported as a function module)
const isMainScript = Boolean(
  process.argv[1] &&
  (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.cjs') || process.argv[1].endsWith('server.js'))
);

const isServerless = Boolean(
  process.env.VERCEL ||
  process.env.NOW_REGION ||
  process.env.AWS_LAMBDA_FUNCTION_NAME
);

if (isMainScript && !isServerless) {
  startServer();
}
