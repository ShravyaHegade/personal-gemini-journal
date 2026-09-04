import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Sparkles, 
  Brain, 
  Calendar, 
  BookOpen, 
  ShieldCheck, 
  ArrowRight, 
  Clock, 
  CheckCircle2, 
  Circle, 
  Trash2, 
  Tag, 
  MessageSquare,
  Lock,
  ChevronRight,
  TrendingUp,
  HeartHandshake,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { 
  db,
  getConversations, 
  getSmartMemories, 
  getSmartReminders, 
  getJournalSummaries, 
  toggleReminderCompleted,
  deleteSmartMemory,
  saveSmartMemory,
  saveSmartReminder
} from '../lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Conversation, JournalSummary, SmartMemory, SmartReminder } from '../types';
import { NewMemoryModal } from './NewMemoryModal';
import { NewReminderModal } from './NewReminderModal';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

interface DashboardViewProps {
  onStartNewJournal: (title?: string, initialMessage?: string) => void;
  onOpenConversation: (convId: string) => void;
  onOpenTab: (tab: 'dashboard' | 'journal' | 'ask-journal' | 'memories' | 'reminders' | 'summaries') => void;
  onOpenSecuritySuite: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onStartNewJournal,
  onOpenConversation,
  onOpenTab,
  onOpenSecuritySuite,
}) => {
  const { user } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [memories, setMemories] = useState<SmartMemory[]>([]);
  const [reminders, setReminders] = useState<SmartReminder[]>([]);
  const [summaries, setSummaries] = useState<JournalSummary[]>([]);
  const [dailyPrompts, setDailyPrompts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [memoryToDelete, setMemoryToDelete] = useState<SmartMemory | null>(null);
  const [isDeletingMemory, setIsDeletingMemory] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3200);
  };

  useEffect(() => {
    if (!user) return;
    loadDashboardData();
    loadPrompts();

    // Attach real-time listeners so counts and widgets update automatically upon deletion/creation
    const convsRef = collection(db, 'users', user.uid, 'conversations');
    const qConvs = query(convsRef, orderBy('updatedAt', 'desc'));
    const unsubConvs = onSnapshot(qConvs, (snap) => {
      setConversations(snap.docs.map(d => ({ id: d.id, ...d.data() } as Conversation)));
    }, (err) => console.warn('Dashboard convs listener:', err));

    const memsRef = collection(db, 'users', user.uid, 'memories');
    const qMems = query(memsRef, orderBy('createdAt', 'desc'));
    const unsubMems = onSnapshot(qMems, (snap) => {
      setMemories(snap.docs.map(d => ({ id: d.id, ...d.data() } as SmartMemory)));
    }, (err) => console.warn('Dashboard mems listener:', err));

    const remsRef = collection(db, 'users', user.uid, 'reminders');
    const qRems = query(remsRef, orderBy('dueDate', 'asc'));
    const unsubRems = onSnapshot(qRems, (snap) => {
      setReminders(snap.docs.map(d => ({ id: d.id, ...d.data() } as SmartReminder)));
    }, (err) => console.warn('Dashboard rems listener:', err));

    const sumsRef = collection(db, 'users', user.uid, 'summaries');
    const qSums = query(sumsRef, orderBy('createdAt', 'desc'));
    const unsubSums = onSnapshot(qSums, (snap) => {
      setSummaries(snap.docs.map(d => {
        const data = d.data();
        const text = data.summary || data.summaryText || '';
        return { id: d.id, ...data, summary: text, summaryText: text } as JournalSummary;
      }));
    }, (err) => console.warn('Dashboard sums listener:', err));

    return () => {
      unsubConvs();
      unsubMems();
      unsubRems();
      unsubSums();
    };
  }, [user]);

  const loadDashboardData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [convs, mems, rems, sums] = await Promise.all([
        getConversations(user.uid),
        getSmartMemories(user.uid),
        getSmartReminders(user.uid),
        getJournalSummaries(user.uid)
      ]);
      setConversations(convs);
      setMemories(mems);
      setReminders(rems);
      setSummaries(sums);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPrompts = async () => {
    try {
      const res = await fetch('/api/daily-prompt');
      const data = await res.json();
      if (data.prompts) setDailyPrompts(data.prompts);
    } catch (err) {
      // safe fallback
    }
  };

  const handleToggleReminder = async (id: string, currentStatus: boolean) => {
    if (!user) return;
    try {
      await toggleReminderCompleted(user.uid, id, !currentStatus);
      setReminders(prev => prev.map(r => r.id === id ? { ...r, completed: !currentStatus } : r));
    } catch (err) {
      console.error('Failed to toggle reminder:', err);
    }
  };

  const handleConfirmDeleteMemory = async () => {
    if (!user || !memoryToDelete) return;
    setIsDeletingMemory(true);
    const id = memoryToDelete.id;
    try {
      await deleteSmartMemory(user.uid, id);
      setMemories(prev => prev.filter(m => m.id !== id));
      setMemoryToDelete(null);
      showToast('Memory deleted', 'success');
    } catch (err) {
      console.error('Failed to delete memory:', err);
      showToast("Couldn't delete this item. Please try again.", 'error');
    } finally {
      setIsDeletingMemory(false);
    }
  };

  // Determine greeting based on current hour
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const userName = user?.displayName || user?.email?.split('@')[0] || 'there';

  const upcomingReminders = reminders.filter(r => !r.completed).slice(0, 4);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in text-[#2D2D2D]">
      
      {/* Welcome Banner */}
      <div className="bg-[#F4F1EE] rounded-3xl p-6 sm:p-8 lg:p-10 border border-[#E5E1DD] shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
        <div className="space-y-3 max-w-3xl">
          <div className="flex items-center space-x-2 text-xs font-semibold text-[#5C5651]">
            <span className="w-2 h-2 rounded-full bg-[#7C8B82]"></span>
            <span>Private Sanctuary • User-Isolated Session</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-4xl lg:text-[42px] font-bold tracking-tight text-[#2D2D2D] leading-tight">
            {greeting}, {userName}.
          </h1>
          <p className="font-serif text-base sm:text-lg lg:text-xl font-medium text-[#2D2D2D] leading-snug">
            Your thoughts deserve more than a place to be stored — turn them into insight, progress, and a story that grows with you.
          </p>
          <p className="text-xs sm:text-sm text-[#5C5651] font-sans leading-relaxed">
            Reflect freely, let Gemini uncover patterns in your journey, and keep your most meaningful moments in one private space.
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
          <button
            id="btn-dash-ask-journal"
            onClick={() => onOpenTab('ask-journal')}
            className="flex items-center space-x-2 px-5 py-3.5 rounded-xl bg-[#7C8B82] hover:bg-[#68766E] text-white text-xs sm:text-sm font-semibold transition-all shadow-sm ring-1 ring-[#7C8B82]/30 hover:shadow-md cursor-pointer group"
            title="Ask questions across your entire accumulated journal history"
          >
            <Brain className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
            <span>Ask My Journal</span>
            <ArrowRight className="w-3.5 h-3.5 text-white/80 group-hover:translate-x-0.5 transition-transform" />
          </button>

          <button
            id="btn-dash-new-journal"
            onClick={() => onStartNewJournal()}
            className="flex items-center space-x-2 px-4 py-3.5 rounded-xl bg-white hover:bg-[#FAF9F7] text-[#2D2D2D] hover:text-[#1F1E1D] text-xs sm:text-sm font-semibold transition-all border border-[#D5D1CC] shadow-2xs hover:border-[#7C8B82] cursor-pointer"
            title="Start a new separate journal conversation"
          >
            <Plus className="w-4 h-4 text-[#7C8B82]" />
            <span>New Entry</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div 
          role="button"
          tabIndex={0}
          onClick={() => onOpenTab('journal')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenTab('journal'); } }}
          className="p-5 rounded-2xl bg-white border border-[#E5E1DD] shadow-xs space-y-1.5 cursor-pointer hover:border-[#7C8B82] hover:shadow-xs transition-all flex flex-col justify-between"
          aria-label={`Journal Entries: ${conversations.length}. Total reflections stored.`}
        >
          <div className="flex items-center justify-between text-[#8A847E] text-xs">
            <span className="font-medium">Journal Entries</span>
            <BookOpen className="w-4 h-4 text-[#7C8B82]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-serif text-[#2D2D2D] my-0.5">
            {conversations.length}
          </div>
          <div className="text-xs text-[#8A847E]">Total reflections stored</div>
        </div>

        <div 
          role="button"
          tabIndex={0}
          onClick={() => onOpenTab('memories')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenTab('memories'); } }}
          className="p-5 rounded-2xl bg-white border border-[#E5E1DD] shadow-xs space-y-1.5 cursor-pointer hover:border-[#7C8B82] hover:shadow-xs transition-all flex flex-col justify-between"
          aria-label={`Smart Memories: ${memories.length}. Things you've asked Gemini to remember.`}
        >
          <div className="flex items-center justify-between text-[#8A847E] text-xs">
            <span className="font-medium">Smart Memories</span>
            <Brain className="w-4 h-4 text-[#7C8B82]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-serif text-[#2D2D2D] my-0.5">
            {memories.length}
          </div>
          <div className="text-xs text-[#8A847E]">Things you've asked Gemini to remember</div>
        </div>

        <div 
          role="button"
          tabIndex={0}
          onClick={() => onOpenTab('reminders')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenTab('reminders'); } }}
          className="p-5 rounded-2xl bg-white border border-[#E5E1DD] shadow-xs space-y-1.5 cursor-pointer hover:border-[#7C8B82] hover:shadow-xs transition-all flex flex-col justify-between"
          aria-label={`Active Reminders: ${reminders.filter(r => !r.completed).length}. Scheduled dates and deadlines.`}
        >
          <div className="flex items-center justify-between text-[#8A847E] text-xs">
            <span className="font-medium">Active Reminders</span>
            <Calendar className="w-4 h-4 text-[#7C8B82]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-serif text-[#2D2D2D] my-0.5">
            {reminders.filter(r => !r.completed).length}
          </div>
          <div className="text-xs text-[#8A847E]">Scheduled dates & deadlines</div>
        </div>

        <div 
          role="button"
          tabIndex={0}
          onClick={onOpenSecuritySuite}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenSecuritySuite(); } }}
          className="p-5 rounded-2xl bg-white border border-[#E5E1DD] shadow-xs space-y-1.5 cursor-pointer hover:border-[#7C8B82] hover:shadow-xs transition-all flex flex-col justify-between"
          aria-label="Security Status: Sandboxed. Private user-isolated session."
        >
          <div className="flex items-center justify-between text-[#8A847E] text-xs">
            <span className="font-medium">Security Status</span>
            <div className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-[#7C8B82]"></span>
              <ShieldCheck className="w-4 h-4 text-[#7C8B82]" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-serif text-[#2D2D2D] my-0.5">
            Sandboxed
          </div>
          <div className="text-xs text-[#8A847E]">Private user-isolated session</div>
        </div>

      </div>

      {/* Daily Reflection Prompts */}
      {dailyPrompts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-[#7C8B82]" />
              <h2 className="font-serif text-base font-bold text-[#2D2D2D]">Today's Mindful Prompts</h2>
            </div>
            <span className="text-xs text-[#8A847E]">1-click to begin reflection</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {dailyPrompts.map((prompt, idx) => (
              <div
                key={idx}
                onClick={() => onStartNewJournal(prompt.title, prompt.starterText)}
                className="group p-4 bg-white hover:bg-[#F4F1EE] rounded-2xl border border-[#E5E1DD] hover:border-[#7C8B82] shadow-xs transition-all cursor-pointer flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F4F1EE] text-[#5C5651] group-hover:bg-[#EEF2F0] group-hover:text-[#2D2D2D]">
                      {prompt.category}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#8A847E] group-hover:text-[#7C8B82] group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <h3 className="font-serif text-sm font-semibold text-[#2D2D2D] group-hover:text-[#7C8B82]">
                    {prompt.title}
                  </h3>
                  <p className="text-xs text-[#5C5651] font-sans leading-relaxed">
                    {prompt.subtitle}
                  </p>
                </div>
                <div className="mt-3 text-[11px] text-[#7C8B82] font-medium italic">
                  "{prompt.starterText.slice(0, 40)}..."
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main 2-Column Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left 7 Columns: Recent Conversations & Summaries */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Recent Conversations */}
          <div className="bg-white rounded-2xl p-5 border border-[#E5E1DD] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-[#7C8B82]" />
                <h3 className="font-serif text-base font-bold text-[#2D2D2D]">Recent Journal Sessions</h3>
              </div>
              <button
                onClick={() => onOpenTab('journal')}
                className="text-xs font-semibold text-[#7C8B82] hover:underline flex items-center space-x-1"
              >
                <span>View All</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {conversations.length === 0 ? (
                <div className="text-center py-8 text-xs text-[#8A847E]">
                  No journal entries yet. Click "New Entry" to begin!
                </div>
              ) : (
                conversations.slice(0, 4).map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => onOpenConversation(conv.id)}
                    className="p-3.5 rounded-xl bg-[#F4F1EE]/80 hover:bg-[#EEF2F0] border border-[#E5E1DD] transition-all cursor-pointer flex items-center justify-between"
                  >
                    <div className="space-y-1 flex-1 min-w-0 pr-3">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-xs text-[#2D2D2D] truncate">
                          {conv.title}
                        </span>
                        {conv.moodTag && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-[#EEF2F0] text-[#5C5651] border border-[#E5E1DD]">
                            {conv.moodTag}
                          </span>
                        )}
                        {conv.hasSummary && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-[#E5E1DD] text-[#5C5651]">
                            Digest
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#5C5651] truncate">
                        {conv.lastMessagePreview || 'Empty session...'}
                      </p>
                    </div>
                    <span className="text-[11px] text-[#8A847E] shrink-0">
                      {new Date(conv.updatedAt || conv.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent AI Summaries Digest */}
          {summaries.length > 0 && (
            <div className="bg-white rounded-2xl p-5 border border-[#E5E1DD] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-[#7C8B82]" />
                  <h3 className="font-serif text-base font-bold text-[#2D2D2D]">Recent Reflection Summaries</h3>
                </div>
                <button
                  onClick={() => onOpenTab('summaries')}
                  className="text-xs font-semibold text-[#7C8B82] hover:underline flex items-center space-x-1"
                >
                  <span>All Digests ({summaries.length})</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {summaries.slice(0, 2).map((sum) => {
                  let dateStr = 'Recent';
                  if (sum.createdAt) {
                    try {
                      const createdVal = sum.createdAt as any;
                      if (typeof createdVal?.toDate === 'function') dateStr = createdVal.toDate().toLocaleDateString();
                      else if (typeof createdVal?.seconds === 'number') dateStr = new Date(createdVal.seconds * 1000).toLocaleDateString();
                      else if (typeof createdVal === 'number') dateStr = new Date(createdVal).toLocaleDateString();
                    } catch {
                      dateStr = 'Recent';
                    }
                  }
                  return (
                    <div
                      key={sum.id}
                      onClick={() => onOpenTab('summaries')}
                      className="p-3.5 rounded-xl bg-[#F4F1EE]/80 border border-[#E5E1DD] hover:bg-[#EEF2F0] transition-colors cursor-pointer space-y-2 flex flex-col justify-between"
                    >
                      <div className="space-y-1">
                        <div className="text-[10px] text-[#8A847E]">
                          {dateStr}
                        </div>
                        <h4 className="font-serif text-xs font-bold text-[#2D2D2D] truncate">
                          {sum.topic || 'Journal Digest'}
                        </h4>
                        <p className="text-[11px] text-[#5C5651] line-clamp-2 leading-relaxed font-sans">
                          {sum.summaryText || sum.summary || 'Reflective digest'}
                        </p>
                      </div>

                      {sum.emotions?.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {sum.emotions.slice(0, 2).map((e, idx) => (
                            <span key={idx} className="px-1.5 py-0.2 rounded text-[9px] bg-[#EEF2F0] text-[#5C5651] font-medium border border-[#E5E1DD]">
                              {e}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Right 5 Columns: Reminders & Approved Memory Bank */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Date-Based Reminders Widget */}
          <div className="bg-white rounded-2xl p-5 border border-[#E5E1DD] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-[#7C8B82]" />
                <h3 className="font-serif text-base font-bold text-[#2D2D2D]">Upcoming Reminders</h3>
              </div>
              <button
                onClick={() => setIsReminderModalOpen(true)}
                className="p-1 text-[#7C8B82] hover:bg-[#F4F1EE] rounded-lg text-xs font-medium flex items-center space-x-1"
                title="Add Reminder"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>

            <div className="space-y-2">
              {upcomingReminders.length === 0 ? (
                <div className="text-center py-6 text-xs text-[#8A847E] bg-[#F4F1EE]/60 rounded-xl p-3">
                  No upcoming reminders. Gemini can detect dates from your journal!
                </div>
              ) : (
                upcomingReminders.map((rem) => (
                  <div
                    key={rem.id}
                    className="p-3 rounded-xl bg-[#F4F1EE]/80 border border-[#E5E1DD] flex items-center justify-between transition-all"
                  >
                    <div className="flex items-center space-x-2.5 flex-1 min-w-0 pr-2">
                      <button
                        onClick={() => handleToggleReminder(rem.id, rem.completed)}
                        className="text-[#8A847E] hover:text-[#7C8B82] transition-colors"
                      >
                        <Circle className="w-4 h-4 text-[#7C8B82]" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-[#2D2D2D] truncate">
                          {rem.title}
                        </div>
                        <div className="text-[10px] text-[#5C5651] font-medium">
                          📅 {rem.dueDate} {rem.dueTime ? `at ${rem.dueTime}` : ''}
                        </div>
                      </div>
                    </div>
                    <span className="capitalize px-1.5 py-0.5 rounded text-[9px] font-medium bg-[#EEF2F0] text-[#5C5651] border border-[#E5E1DD]">
                      {rem.category}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* User-Approved Smart Memory Bank */}
          <div className="bg-white rounded-2xl p-5 border border-[#E5E1DD] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Brain className="w-4 h-4 text-[#7C8B82]" />
                <h3 className="font-serif text-base font-bold text-[#2D2D2D]">Smart Memories</h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsMemoryModalOpen(true)}
                  className="p-1 text-[#7C8B82] hover:bg-[#F4F1EE] rounded-lg text-xs font-medium flex items-center space-x-1"
                  title="Add Memory"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
                <button
                  onClick={() => onOpenTab('memories')}
                  className="text-xs font-semibold text-[#7C8B82] hover:underline"
                >
                  All ({memories.length})
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {memories.length === 0 ? (
                <div className="text-center py-6 text-xs text-[#8A847E] bg-[#F4F1EE]/60 rounded-xl p-3">
                  No memories yet. The AI will ask before saving anything permanently.
                </div>
              ) : (
                memories.slice(0, 3).map((mem) => (
                  <div
                    key={mem.id}
                    className="p-3 rounded-xl bg-[#F4F1EE]/80 border border-[#E5E1DD] flex items-start justify-between group"
                  >
                    <div className="space-y-1 flex-1 pr-2">
                      <div className="text-xs font-medium text-[#2D2D2D] leading-snug">
                        "{mem.text}"
                      </div>
                      <div className="flex items-center space-x-2 text-[10px] text-[#5C5651]">
                        <span className="capitalize font-semibold">{mem.category}</span>
                        {mem.relevantDate && <span>• {mem.relevantDate}</span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMemoryToDelete(mem);
                      }}
                      disabled={isDeletingMemory && memoryToDelete?.id === mem.id}
                      className="p-1 text-[#8A847E] hover:text-red-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      title="Delete memory"
                      aria-label="Delete memory"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Modals */}
      {isMemoryModalOpen && user && (
        <NewMemoryModal
          isOpen={isMemoryModalOpen}
          onClose={() => setIsMemoryModalOpen(false)}
          onSave={async (mem) => {
            await saveSmartMemory(user.uid, mem);
            await loadDashboardData();
          }}
          userId={user.uid}
        />
      )}

      {isReminderModalOpen && user && (
        <NewReminderModal
          isOpen={isReminderModalOpen}
          onClose={() => setIsReminderModalOpen(false)}
          onSave={async (rem) => {
            await saveSmartReminder(user.uid, rem);
            await loadDashboardData();
          }}
          userId={user.uid}
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center space-x-2 px-4 py-2.5 rounded-xl shadow-lg border text-xs sm:text-sm animate-fade-in ${
          toastMessage.type === 'success' 
            ? 'bg-white border-emerald-200 text-emerald-800' 
            : 'bg-white border-rose-200 text-rose-800'
        }`}>
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={Boolean(memoryToDelete)}
        title="Delete this memory?"
        description="Are you sure you want to delete this memory? It will be permanently removed from your private Firestore database."
        itemSnippet={memoryToDelete?.text}
        isDeleting={isDeletingMemory}
        onConfirm={handleConfirmDeleteMemory}
        onCancel={() => {
          if (!isDeletingMemory) setMemoryToDelete(null);
        }}
        deleteLabel="Delete"
        cancelLabel="Cancel"
      />

    </div>
  );
};
