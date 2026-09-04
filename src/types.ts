export type MemoryCategory = 'goal' | 'event' | 'preference' | 'task' | 'milestone' | 'general';

export interface SmartMemory {
  id: string;
  userId: string;
  text: string;
  category: MemoryCategory;
  sourceConversationId?: string;
  sourceSnippet?: string;
  relevantDate?: string | null;
  createdAt: number;
  approvedByUser: boolean;
}

export interface SmartReminder {
  id: string;
  userId: string;
  title: string;
  dueDate: string; // ISO format or YYYY-MM-DD
  dueTime?: string; // HH:mm
  notes?: string;
  category: 'exam' | 'deadline' | 'meeting' | 'health' | 'personal' | 'habit';
  completed: boolean;
  sourceConversationId?: string;
  createdAt: number;
}

export interface JournalMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  // Detected smart memory proposal from AI
  proposedMemory?: {
    text: string;
    category: MemoryCategory;
    relevantDate?: string;
  } | null;
  memoryDecision?: 'accepted' | 'dismissed';
  // Detected reminder proposal from AI
  proposedReminder?: {
    title: string;
    dueDate: string;
    dueTime?: string;
    category: SmartReminder['category'];
    notes?: string;
  } | null;
  reminderDecision?: 'accepted' | 'dismissed';
}

export interface JournalSummary {
  id: string;
  userId: string;
  conversationId: string;
  conversationTitle: string;
  topic: string;
  summary?: string;
  summaryText: string;
  keyPoints: string[];
  emotions: string[];
  tasksAndGoals: string[];
  datesMentioned: string[];
  reflectionQuestion?: string;
  createdAt: number;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  lastMessagePreview?: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  moodTag?: string;
  hasSummary?: boolean;
}

export interface ChatResponsePayload {
  reply: string;
  suggestedTitle?: string;
  proposedMemory?: {
    text: string;
    category: MemoryCategory;
    relevantDate?: string;
  } | null;
  proposedReminder?: {
    title: string;
    dueDate: string;
    dueTime?: string;
    category: SmartReminder['category'];
    notes?: string;
  } | null;
  suggestedMood?: string;
}

export interface SecurityTestResult {
  testId: string;
  title: string;
  description: string;
  status: 'passed' | 'failed' | 'running' | 'idle';
  details: string;
  timestamp?: number;
}

export interface GroundingMetadata {
  entriesAnalyzed: number;
  summariesAnalyzed: number;
  memoriesAnalyzed: number;
  remindersAnalyzed: number;
  dateRange?: string;
  keyThemes?: string[];
}

export interface AskJournalMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  groundingMetadata?: GroundingMetadata;
  error?: boolean;
}

export interface AskJournalResponsePayload {
  answer: string;
  groundingMetadata: GroundingMetadata;
}
