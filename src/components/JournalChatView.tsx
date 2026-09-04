import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Sparkles, 
  Brain, 
  Calendar, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  Mic, 
  MicOff, 
  BookOpen, 
  Clock, 
  ChevronRight, 
  AlertCircle,
  MessageSquare,
  Search,
  CheckCircle2,
  Share2,
  FileText,
  Loader2,
  ArrowLeft,
  ArrowDown,
  ListFilter,
  Layers
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { 
  db,
  createConversation, 
  getConversations, 
  getJournalMessages, 
  addJournalMessage, 
  updateConversation, 
  deleteConversation,
  saveSmartMemory,
  getSmartMemories,
  saveSmartReminder,
  saveJournalSummary,
  updateMessageDecision
} from '../lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Conversation, JournalMessage, JournalSummary, SmartMemory, SmartReminder } from '../types';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

interface JournalChatViewProps {
  initialConversationId?: string | null;
  newSessionTrigger?: number;
  initialPromptData?: { title?: string; message?: string } | null;
  onOpenSummaryView?: (summaryId?: string) => void;
  onOpenMemoriesView?: () => void;
  onOpenRemindersView?: () => void;
}

export const JournalChatView: React.FC<JournalChatViewProps> = ({
  initialConversationId,
  newSessionTrigger,
  initialPromptData,
  onOpenSummaryView,
  onOpenMemoriesView,
  onOpenRemindersView
}) => {
  const { user } = useAuth();
  
  // State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(initialConversationId || null);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<JournalMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loadingList, setLoadingList] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [approvedMemories, setApprovedMemories] = useState<SmartMemory[]>([]);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [showMobileHistory, setShowMobileHistory] = useState(false);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  
  // Summarization State
  const [summarizing, setSummarizing] = useState(false);
  const [activeSummary, setActiveSummary] = useState<JournalSummary | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  // Status feedback toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [convToDelete, setConvToDelete] = useState<Conversation | null>(null);
  const [isDeletingConv, setIsDeletingConv] = useState(false);

  // Ref to message list container and user scroll state
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUp = useRef<boolean>(false);
  const recognitionRef = useRef<any>(null);

  // Target the chat container directly for scrolling without shifting the page
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior
      });
    }
  };

  // Track user scroll position in message list
  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    
    // User is considered deliberately scrolled up if more than 80px from bottom
    const isUp = distanceFromBottom > 80;
    isUserScrolledUp.current = isUp;
    setShowScrollBottomBtn(isUp);
  };

  // Auto-scroll ONLY when user is already near bottom or sending a message
  useEffect(() => {
    if (!isUserScrolledUp.current) {
      scrollToBottom('smooth');
    }
  }, [messages, sending]);

  // Load conversations list and approved memories for context (with real-time listener for memory sync)
  useEffect(() => {
    if (!user) return;
    loadConversations(initialConversationId || undefined, true);
    loadMemories();

    const memsRef = collection(db, 'users', user.uid, 'memories');
    const qMems = query(memsRef, orderBy('createdAt', 'desc'));
    const unsubMems = onSnapshot(qMems, (snap) => {
      setApprovedMemories(snap.docs.map(d => ({ id: d.id, ...d.data() } as SmartMemory)));
    }, (err) => console.warn('Chat memories listener notice:', err));

    return () => unsubMems();
  }, [user]);

  // Handle explicit new session triggers (from Navbar, Dashboard, or props)
  useEffect(() => {
    if (newSessionTrigger && newSessionTrigger > 0) {
      startFreshSessionDraft(initialPromptData?.title, initialPromptData?.message);
    }
  }, [newSessionTrigger]);

  // When initialConversationId changes
  useEffect(() => {
    if (initialConversationId) {
      switchToConversation(initialConversationId);
    } else if (initialConversationId === null && newSessionTrigger === undefined) {
      startFreshSessionDraft();
    }
  }, [initialConversationId]);

  const loadConversations = async (targetActiveId?: string, autoSelectFirst: boolean = false) => {
    if (!user) return;
    try {
      setLoadingList(true);
      const list = await getConversations(user.uid);
      setConversations(list);

      let idToSelect = targetActiveId !== undefined ? targetActiveId : activeConvId;

      // Automatically select the most recent conversation if one exists on initial load
      if (!idToSelect && autoSelectFirst && list.length > 0 && !newSessionTrigger) {
        idToSelect = list[0].id;
      }

      if (idToSelect) {
        const found = list.find(c => c.id === idToSelect);
        if (found) {
          setActiveConvId(idToSelect);
          setActiveConv(found);
          setTitleInput(found.title);
          await loadMessagesForConversation(idToSelect);
        }
      } else if (list.length === 0) {
        startFreshSessionDraft();
      }
    } catch (err) {
      console.error('Error loading conversations:', err);
    } finally {
      setLoadingList(false);
    }
  };

  const loadMemories = async () => {
    if (!user) return;
    try {
      const mems = await getSmartMemories(user.uid);
      setApprovedMemories(mems);
    } catch (err) {
      console.error('Error loading memories:', err);
    }
  };

  const loadMessagesForConversation = async (convId: string) => {
    if (!user || !convId) return;
    try {
      setLoadingMessages(true);
      const msgs = await getJournalMessages(user.uid, convId);
      setMessages(msgs);
      
      // When a conversation first loads, scroll to bottom and reset scroll state
      isUserScrolledUp.current = false;
      setShowScrollBottomBtn(false);
      setTimeout(() => scrollToBottom('auto'), 50);
    } catch (err) {
      console.error('Error loading messages for conversation:', err);
      showToast('Could not load messages for this conversation');
    } finally {
      setLoadingMessages(false);
    }
  };

  const switchToConversation = async (convId: string) => {
    if (!user) return;
    setActiveConvId(convId);
    setMessages([]); // Clear previous messages immediately to avoid visual mixing
    setShowMobileHistory(false);
    isUserScrolledUp.current = false;
    setShowScrollBottomBtn(false);

    const found = conversations.find(c => c.id === convId);
    if (found) {
      setActiveConv(found);
      setTitleInput(found.title);
    }
    await loadMessagesForConversation(convId);
  };

  const startFreshSessionDraft = (customTitle?: string, initialText?: string) => {
    setActiveConvId(null);
    setActiveConv(null);
    setMessages([]);
    setInputMessage(initialText || '');
    setTitleInput(customTitle || `Journal: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`);
    setShowMobileHistory(false);
    isUserScrolledUp.current = false;
    setShowScrollBottomBtn(false);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Single primary action: "+ New Entry"
  const handleStartNewJournalSession = async (customTitle?: string, starterText?: string) => {
    if (!user) return;
    
    // Clear UI state to a clean new session
    startFreshSessionDraft(customTitle, starterText);
    showToast('Starting a new separate journal entry');

    if (starterText) {
      // Create conversation immediately and send starter text
      try {
        const title = customTitle || `Journal: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        const newConvId = await createConversation(user.uid, title);
        setActiveConvId(newConvId);
        await loadConversations(newConvId);
        await sendMessageWithText(newConvId, starterText, []);
      } catch (err) {
        console.error('Error initializing starter conversation:', err);
      }
    }
  };

  const handleConfirmDeleteConversation = async () => {
    if (!user || !convToDelete) return;
    setIsDeletingConv(true);
    const convId = convToDelete.id;
    
    try {
      await deleteConversation(user.uid, convId);
      const updated = conversations.filter(c => c.id !== convId);
      setConversations(updated);

      if (activeConvId === convId) {
        if (updated.length > 0) {
          switchToConversation(updated[0].id);
        } else {
          startFreshSessionDraft();
        }
      }
      setConvToDelete(null);
      showToast('Journal entry deleted');
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      showToast("Couldn't delete this item. Please try again.");
    } finally {
      setIsDeletingConv(false);
    }
  };

  const handleUpdateTitle = async () => {
    if (!user || !activeConvId || !titleInput.trim()) {
      setEditingTitle(false);
      return;
    }
    try {
      await updateConversation(user.uid, activeConvId, { title: titleInput.trim() });
      setActiveConv(prev => prev ? { ...prev, title: titleInput.trim() } : null);
      setConversations(prev => prev.map(c => c.id === activeConvId ? { ...c, title: titleInput.trim() } : c));
      setEditingTitle(false);
      showToast('Title updated');
    } catch (err) {
      console.error('Failed to update title:', err);
    }
  };

  // Send message to Gemini through secure backend
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !user || sending) return;
    
    const text = inputMessage.trim();
    setInputMessage('');

    let convId = activeConvId;
    let currentMsgs = messages;

    // If there is no active conversation (new session), create one in Firestore now!
    if (!convId) {
      try {
        const formattedDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        // Create title from text snippet or default
        const titleSnippet = text.length > 30 ? `${text.slice(0, 30)}...` : text;
        const newTitle = titleInput.trim() || `Journal: ${formattedDate} — ${titleSnippet}`;
        
        convId = await createConversation(user.uid, newTitle);
        setActiveConvId(convId);
        currentMsgs = []; // Brand new conversation has no prior messages
        setMessages([]);
        await loadConversations(convId);
      } catch (err) {
        console.error('Failed to create new conversation document:', err);
        showToast('Error initializing conversation session');
        return;
      }
    }

    // User explicitly sent a message, so reset scrolled-up state and scroll to bottom
    isUserScrolledUp.current = false;
    setShowScrollBottomBtn(false);

    await sendMessageWithText(convId, text, currentMsgs);
  };

  const sendMessageWithText = async (convId: string, text: string, existingMessagesList: JournalMessage[]) => {
    if (!user) {
      showToast('Authentication required. Please sign in to continue.');
      return;
    }
    if (!convId) return;

    let idToken = '';
    try {
      idToken = await user.getIdToken();
    } catch {
      showToast('Authentication session expired. Please sign in again.');
      return;
    }

    if (!idToken) {
      showToast('Authentication required. Please sign in to continue.');
      return;
    }

    // 1. Add user message locally and to Firestore
    const userMsgData = {
      role: 'user' as const,
      content: text,
      timestamp: Date.now()
    };

    const tempUserMsgId = `temp-${Date.now()}`;
    const newMessagesList = [...existingMessagesList, { id: tempUserMsgId, ...userMsgData }];
    setMessages(newMessagesList);
    setSending(true);
    
    // Smooth scroll down for the new user message
    setTimeout(() => scrollToBottom('smooth'), 30);

    try {
      // Save user message to Firestore subcollection: users/{uid}/conversations/{convId}/messages
      await addJournalMessage(user.uid, convId, userMsgData);
      
      // 2. Call Server-Side Gemini endpoint with conversation history ONLY for this session
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          messages: newMessagesList.map(m => ({ role: m.role, content: m.content })),
          currentMessage: text,
          approvedMemories: approvedMemories.map(m => ({ text: m.text, category: m.category })),
          userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || 'Failed to get response from companion');
      }

      const aiResult = await response.json();

      // 3. Save AI response to Firestore subcollection
      const aiMsgData = {
        role: 'model' as const,
        content: aiResult.reply,
        timestamp: Date.now(),
        proposedMemory: aiResult.proposedMemory || null,
        proposedReminder: aiResult.proposedReminder || null
      };

      await addJournalMessage(user.uid, convId, aiMsgData);

      // Refresh message list strictly for this conversation
      await loadMessagesForConversation(convId);
      
      // Update mood tag, title, and conversation list
      const convUpdates: Partial<Conversation> = {};
      if (aiResult.suggestedMood) {
        convUpdates.moodTag = aiResult.suggestedMood;
      }
      if (aiResult.suggestedTitle && (existingMessagesList.length === 0 || activeConv?.title?.startsWith('Journal:'))) {
        convUpdates.title = aiResult.suggestedTitle;
        setTitleInput(aiResult.suggestedTitle);
      }

      if (Object.keys(convUpdates).length > 0) {
        await updateConversation(user.uid, convId, convUpdates);
        setActiveConv(prev => prev ? { ...prev, ...convUpdates } : null);
      }

      // Update sidebar preview
      await loadConversations(convId);

    } catch (err: any) {
      console.error('Error in chat loop:', err);
      const errorMsg: JournalMessage = {
        id: `err-${Date.now()}`,
        role: 'model',
        content: "I'm having a little trouble connecting right now, but your thoughts have been safely recorded. Please try reflecting with me again in a moment.",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  };

  // Memory Approval Flow
  const handleApproveMemory = async (msgId: string, proposed: NonNullable<JournalMessage['proposedMemory']>) => {
    if (!user || !activeConvId) return;
    try {
      await saveSmartMemory(user.uid, {
        userId: user.uid,
        text: proposed.text,
        category: proposed.category || 'general',
        sourceConversationId: activeConvId,
        relevantDate: proposed.relevantDate || null,
        createdAt: Date.now(),
        approvedByUser: true
      });

      await updateMessageDecision(user.uid, activeConvId, msgId, 'memoryDecision', 'accepted');
      
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, memoryDecision: 'accepted' } : m));
      await loadMemories();
      showToast('✓ Memory safely saved to your private bank!');
    } catch (err) {
      console.error('Failed to save memory:', err);
    }
  };

  const handleDismissMemory = async (msgId: string) => {
    if (!user || !activeConvId) return;
    try {
      await updateMessageDecision(user.uid, activeConvId, msgId, 'memoryDecision', 'dismissed');
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, memoryDecision: 'dismissed' } : m));
      showToast('Memory suggestion dismissed');
    } catch (err) {
      console.error('Failed to dismiss memory:', err);
    }
  };

  // Reminder Approval Flow
  const handleApproveReminder = async (msgId: string, proposed: NonNullable<JournalMessage['proposedReminder']>) => {
    if (!user || !activeConvId) return;
    try {
      await saveSmartReminder(user.uid, {
        userId: user.uid,
        title: proposed.title,
        dueDate: proposed.dueDate,
        dueTime: proposed.dueTime,
        category: proposed.category || 'deadline',
        notes: proposed.notes || `Created from journal session on ${new Date().toLocaleDateString()}`,
        completed: false,
        sourceConversationId: activeConvId,
        createdAt: Date.now()
      });

      await updateMessageDecision(user.uid, activeConvId, msgId, 'reminderDecision', 'accepted');
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reminderDecision: 'accepted' } : m));
      showToast(`✓ Reminder scheduled for ${proposed.dueDate}!`);
    } catch (err) {
      console.error('Failed to save reminder:', err);
    }
  };

  const handleDismissReminder = async (msgId: string) => {
    if (!user || !activeConvId) return;
    try {
      await updateMessageDecision(user.uid, activeConvId, msgId, 'reminderDecision', 'dismissed');
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reminderDecision: 'dismissed' } : m));
      showToast('Reminder suggestion dismissed');
    } catch (err) {
      console.error('Failed to dismiss reminder:', err);
    }
  };

  // Summarize Conversation Flow
  const handleSummarizeSession = async () => {
    console.log("REAL HANDLE SUMMARIZE SESSION EXECUTED");

    // 1. Check that user is authenticated & conversation context is valid
    if (!user) {
      showToast('Please sign in to summarize your journal session.');
      return;
    }
    // 2. Check that the conversation contains messages
    if (messages.length === 0) {
      showToast('Write an entry first before summarizing.');
      return;
    }

    let idToken = '';
    try {
      idToken = await user.getIdToken();
    } catch {
      showToast('Authentication session expired. Please sign in again.');
      return;
    }

    if (!idToken) {
      showToast('Authentication required. Please sign in to summarize your journal.');
      return;
    }
    
    // 3. Set summarizing/loading state
    setSummarizing(true);
    let geminiSucceeded = false;
    try {
      let convId = activeConvId;
      // Ensure conversation document exists in Firestore
      if (!convId) {
        const fallbackTitle = titleInput.trim() || `Journal: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        convId = await createConversation(user.uid, fallbackTitle);
        setActiveConvId(convId);
      }

      // 4. Call POST /api/summarize with messages and conversationTitle
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          conversationTitle: activeConv?.title || titleInput || 'Journal Entry'
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to generate summary');
      }

      // 5. Receive the structured Gemini response
      const data = await res.json();
      geminiSucceeded = true;

      // 6. Validate that summaryText exists
      const summaryTextContent = data.summaryText || '';
      if (!summaryTextContent) {
        throw new Error('Received empty summary text from AI service');
      }

      // 7. Save the COMPLETE summary object to: users/{authenticatedUser.uid}/summaries/{summaryId}
      const summaryPayload = {
        conversationId: convId,
        conversationTitle: activeConv?.title || titleInput || data.topic || 'Journal Entry',
        topic: data.topic || 'Reflective Journal Entry',
        summaryText: summaryTextContent,
        keyPoints: Array.isArray(data.keyPoints) ? data.keyPoints : [],
        emotions: Array.isArray(data.emotions) ? data.emotions : [],
        tasksAndGoals: Array.isArray(data.tasksAndGoals) ? data.tasksAndGoals : [],
        datesMentioned: Array.isArray(data.datesMentioned) ? data.datesMentioned : [],
        reflectionQuestion: data.reflectionQuestion ?? ''
      };

      // 8. Wait for the Firestore write to successfully complete
      const summaryId = await saveJournalSummary(user.uid, summaryPayload);

      // 9. Only AFTER Firestore succeeds: update the Summaries UI and show success message
      setActiveSummary({
        id: summaryId,
        userId: user.uid,
        ...summaryPayload,
        summary: summaryTextContent,
        createdAt: Date.now()
      });
      setShowSummaryModal(true);
      
      // Update conversation hasSummary
      if (convId) {
        setActiveConv(prev => prev ? { ...prev, hasSummary: true } : null);
        setConversations(prev => prev.map(c => c.id === convId ? { ...c, hasSummary: true } : c));
      }
      showToast('Summary saved successfully.');
    } catch (err: any) {
      console.error('Error during summarization or Firestore save:', err);
      if (geminiSucceeded) {
        showToast('Summary generated, but could not be saved. Please try again.');
      } else {
        showToast("Sorry, I couldn't create the summary. Please try again.");
      }
    } finally {
      // 10. Stop loading state
      setSummarizing(false);
    }
  };

  // Audio Speech Recognition Toggle
  const toggleSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInputMessage(prev => prev ? `${prev} ${transcript}` : transcript);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
      recognition.start();
    }
  };

  const filteredConversations = conversations.filter(c => {
    const q = (searchQuery || '').toLowerCase();
    return (c.title || '').toLowerCase().includes(q) ||
      Boolean(c.lastMessagePreview && c.lastMessagePreview.toLowerCase().includes(q));
  });

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6 h-[calc(100vh-4.25rem)] sm:h-[calc(100vh-5rem)] w-full flex-1 flex flex-col min-h-0 text-[#2D2D2D]">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-[#2D2D2D] text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-medium flex items-center space-x-2 animate-fade-in border border-[#5C5651]">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-6 min-h-0 h-full bg-white rounded-2xl border border-[#E5E1DD] shadow-xs overflow-hidden relative">
        
        {/* Left Sidebar: Recent Journals (Desktop) */}
        <div className="hidden lg:flex lg:col-span-4 border-r border-[#E5E1DD] flex-col h-full min-h-0 bg-[#F4F1EE]/50 overflow-hidden">
          
          {/* Sidebar Header: Single Primary '+ New Entry' Action & Search */}
          <div className="shrink-0 p-3.5 border-b border-[#E5E1DD] space-y-2.5 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-[#7C8B82]" />
                <h2 className="font-serif text-sm font-bold text-[#2D2D2D]">Recent Journals</h2>
              </div>
              <span className="text-[11px] text-[#8A847E] font-medium">{conversations.length} total</span>
            </div>

            {/* THE ONLY PRIMARY NEW ENTRY ACTION ON DESKTOP */}
            <button
              id="btn-sidebar-new-journal"
              onClick={() => handleStartNewJournalSession()}
              className="w-full py-2.5 px-3 bg-[#7C8B82] hover:bg-[#64736A] text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition-all shadow-xs cursor-pointer"
              title="Start a new separate journal entry"
            >
              <Plus className="w-4 h-4" />
              <span>+ New Entry</span>
            </button>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#8A847E]" />
              <input
                type="text"
                placeholder="Search journal entries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F4F1EE] border border-[#E5E1DD] rounded-lg text-[#2D2D2D] placeholder-[#8A847E] focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#7C8B82]"
              />
            </div>
          </div>

          {/* Conversations List with Independent Scroll */}
          <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-1.5 overscroll-contain">
            {loadingList ? (
              <div className="flex items-center justify-center py-8 text-xs text-[#8A847E] space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#7C8B82]" />
                <span>Loading journals...</span>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="text-center py-10 px-4 text-xs text-[#8A847E]">
                {searchQuery ? 'No entries match your search' : 'No previous journal entries yet. Click "+ New Entry" above to begin!'}
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isActive = conv.id === activeConvId;
                return (
                  <div
                    key={conv.id}
                    onClick={() => switchToConversation(conv.id)}
                    className={`group relative p-3 rounded-xl cursor-pointer transition-all ${
                      isActive
                        ? 'bg-[#EEF2F0] border border-[#7C8B82]/50 shadow-2xs'
                        : 'hover:bg-[#F4F1EE] border border-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center space-x-1.5 mb-1">
                          <h3 className={`text-xs font-semibold truncate ${isActive ? 'text-[#2D2D2D] font-bold' : 'text-[#5C5651]'}`}>
                            {conv.title}
                          </h3>
                          {conv.moodTag && (
                            <span className="shrink-0 px-1.5 py-0.2 rounded text-[9px] font-medium bg-[#EEF2F0] text-[#5C5651] border border-[#E5E1DD]">
                              {conv.moodTag}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#8A847E] truncate">
                          {conv.lastMessagePreview || 'Empty journal session...'}
                        </p>
                      </div>

                      <div className="flex items-center space-x-1">
                        <span className="text-[10px] text-[#8A847E] shrink-0">
                          {new Date(conv.updatedAt || conv.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConvToDelete(conv);
                          }}
                          disabled={isDeletingConv && convToDelete?.id === conv.id}
                          className="p-1 text-[#8A847E] hover:text-red-600 hover:bg-rose-50 rounded transition-colors cursor-pointer disabled:opacity-50"
                          title="Delete entry"
                          aria-label="Delete entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {conv.hasSummary && (
                      <div className="mt-1.5 flex items-center space-x-1 text-[10px] text-[#7C8B82] font-medium">
                        <BookOpen className="w-3 h-3 text-[#7C8B82]" />
                        <span>Summarized Digest</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Active Memories Indicator in Sidebar */}
          <div className="shrink-0 p-3 border-t border-[#E5E1DD] bg-white/70">
            <div className="flex items-center justify-between text-xs text-[#5C5651]">
              <span className="flex items-center space-x-1.5">
                <Brain className="w-3.5 h-3.5 text-[#7C8B82]" />
                <span>Active Memory Context:</span>
              </span>
              <button
                onClick={onOpenMemoriesView}
                className="font-semibold text-[#7C8B82] hover:underline cursor-pointer"
              >
                {approvedMemories.length} Approved
              </button>
            </div>
          </div>

        </div>

        {/* Mobile History Drawer Overlay */}
        {showMobileHistory && (
          <div className="lg:hidden absolute inset-0 z-30 bg-white flex flex-col animate-fade-in">
            <div className="p-4 border-b border-[#E5E1DD] flex items-center justify-between bg-[#F4F1EE]">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-[#7C8B82]" />
                <h3 className="font-serif text-base font-bold text-[#2D2D2D]">Recent Journals</h3>
              </div>
              <button
                onClick={() => setShowMobileHistory(false)}
                className="p-1 rounded-lg text-[#8A847E] hover:bg-[#E5E1DD]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 border-b border-[#E5E1DD]">
              <button
                onClick={() => {
                  handleStartNewJournalSession();
                  setShowMobileHistory(false);
                }}
                className="w-full py-2.5 bg-[#7C8B82] text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>+ New Entry</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredConversations.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => switchToConversation(conv.id)}
                  className={`p-3 rounded-xl border ${
                    conv.id === activeConvId ? 'bg-[#EEF2F0] border-[#7C8B82]' : 'bg-[#F4F1EE]/60 border-[#E5E1DD]'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="font-semibold text-xs text-[#2D2D2D]">{conv.title}</div>
                    <span className="text-[10px] text-[#8A847E]">
                      {new Date(conv.updatedAt || conv.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8A847E] truncate mt-1">
                    {conv.lastMessagePreview || 'Empty session...'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Right Main Chat Area */}
        <div className="lg:col-span-8 flex flex-col h-full min-h-0 bg-white min-w-0 overflow-hidden relative">
          
          {/* Chat Header */}
          <div className="shrink-0 p-3 sm:p-4 border-b border-[#E5E1DD] flex items-center justify-between bg-[#F4F1EE]/40 gap-2">
            <div className="flex items-center space-x-2.5 sm:space-x-3 flex-1 min-w-0">
              
              {/* Mobile Sessions Toggle Button */}
              <button
                id="btn-mobile-sessions"
                onClick={() => setShowMobileHistory(true)}
                className="lg:hidden p-2 rounded-xl bg-[#EEF2F0] text-[#5C5651] border border-[#E5E1DD] shrink-0 hover:bg-[#E5E1DD]"
                title="View All Journal Entries"
              >
                <Layers className="w-4 h-4 text-[#7C8B82]" />
              </button>

              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#EEF2F0] text-[#7C8B82] flex items-center justify-center border border-[#E5E1DD] shrink-0">
                <Sparkles className="w-4 h-4 text-[#7C8B82]" />
              </div>

              <div className="flex-1 min-w-0">
                {editingTitle && activeConvId ? (
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={titleInput}
                      onChange={(e) => setTitleInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleUpdateTitle()}
                      className="text-xs sm:text-sm font-semibold text-[#2D2D2D] border border-[#E5E1DD] rounded px-2 py-0.5"
                      autoFocus
                    />
                    <button onClick={handleUpdateTitle} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setEditingTitle(false)} className="p-1 text-[#8A847E] hover:bg-[#F4F1EE] rounded cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <h2 
                      onClick={() => activeConvId && setEditingTitle(true)}
                      className={`font-serif text-sm sm:text-base font-bold text-[#2D2D2D] truncate flex items-center space-x-1 ${
                        activeConvId ? 'cursor-pointer hover:text-[#7C8B82]' : ''
                      }`}
                      title={activeConvId ? "Click to rename entry" : "New Journal Entry"}
                    >
                      <span>{activeConv?.title || (activeConvId === null ? 'New Journal Entry' : 'Journal Entry')}</span>
                    </h2>
                    {activeConv?.moodTag ? (
                      <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#EEF2F0] text-[#5C5651] border border-[#E5E1DD]">
                        {activeConv.moodTag}
                      </span>
                    ) : activeConvId === null ? (
                      <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#EEF2F0] text-[#7C8B82] border border-[#E5E1DD]">
                        Fresh Entry
                      </span>
                    ) : null}
                  </div>
                )}
                <p className="text-[10px] sm:text-[11px] text-[#8A847E] truncate">
                  {activeConvId 
                    ? 'Isolated session • Context scoped to this entry' 
                    : 'Clean slate • Starts a separate conversation'}
                </p>
              </div>
            </div>

            {/* Header Action: 'Wrap Up & Summarize' */}
            <div className="flex items-center space-x-2 shrink-0">
              <button
                id="btn-summarize-session"
                onClick={handleSummarizeSession}
                disabled={summarizing || messages.length === 0}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-2xs cursor-pointer ${
                  summarizing
                    ? 'bg-[#F4F1EE] text-[#8A847E] cursor-not-allowed opacity-80'
                    : messages.length === 0
                    ? 'bg-[#F4F1EE] text-[#8A847E] opacity-50 cursor-not-allowed border border-[#E5E1DD]'
                    : 'bg-[#EEF2F0] hover:bg-[#E5E1DD] text-[#2D2D2D] border border-[#7C8B82]/50 hover:border-[#7C8B82]'
                }`}
                title={
                  summarizing
                    ? 'Generating summary...'
                    : messages.length === 0
                    ? 'Write something first to summarize'
                    : 'Summarize and save this journal conversation'
                }
              >
                {summarizing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#7C8B82]" />
                    <span className="hidden sm:inline">Wrapping up...</span>
                    <span className="sm:hidden">Wrapping up...</span>
                  </>
                ) : (
                  <>
                    <BookOpen className="w-3.5 h-3.5 text-[#7C8B82]" />
                    <span className="hidden sm:inline">Wrap Up & Summarize</span>
                    <span className="sm:hidden">Summarize</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Messages Stream Container with Independent Scroll */}
          <div 
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-5 bg-[#FDFCFB] overscroll-contain"
          >
            {loadingMessages ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-3">
                <Loader2 className="w-6 h-6 animate-spin text-[#7C8B82]" />
                <p className="text-xs text-[#8A847E]">Loading session messages...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto p-6 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-[#EEF2F0] text-[#7C8B82] flex items-center justify-center border border-[#E5E1DD] shadow-xs">
                  <Sparkles className="w-6 h-6 text-[#7C8B82]" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-serif text-lg font-bold text-[#2D2D2D]">
                    {activeConvId ? 'Ready for your reflection' : 'How is your mind feeling today?'}
                  </h3>
                  <p className="text-xs text-[#5C5651] leading-relaxed font-sans">
                    {activeConvId 
                      ? 'Type a thought below to continue this journal session.'
                      : 'This is a clean, separate journal session. Share your thoughts, untangle a challenge, or brainstorm a goal.'}
                  </p>
                </div>

                {/* Starters */}
                <div className="grid grid-cols-1 gap-2 w-full pt-2">
                  <button
                    onClick={() => {
                      setInputMessage("I had a pretty demanding day and need to unpack what happened...");
                    }}
                    className="p-2.5 text-left text-xs bg-white hover:bg-[#F4F1EE] border border-[#E5E1DD] rounded-xl text-[#5C5651] transition-colors shadow-2xs cursor-pointer"
                  >
                    💭 "I had a pretty demanding day and need to unpack what happened..."
                  </button>
                  <button
                    onClick={() => {
                      setInputMessage("I'm preparing for an important project milestone on September 5th...");
                    }}
                    className="p-2.5 text-left text-xs bg-white hover:bg-[#F4F1EE] border border-[#E5E1DD] rounded-xl text-[#5C5651] transition-colors shadow-2xs cursor-pointer"
                  >
                    🎯 "I'm preparing for an important project milestone on September 5th..."
                  </button>
                  <button
                    onClick={() => {
                      setInputMessage("I noticed a recurring habit I'd like to reflect on this week...");
                    }}
                    className="p-2.5 text-left text-xs bg-white hover:bg-[#F4F1EE] border border-[#E5E1DD] rounded-xl text-[#5C5651] transition-colors shadow-2xs cursor-pointer"
                  >
                    🌱 "I noticed a recurring habit I'd like to reflect on..."
                  </button>
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-start space-x-2 max-w-[88%] sm:max-w-[80%]">
                      {!isUser && (
                        <div className="w-7 h-7 rounded-lg bg-[#EEF2F0] text-[#7C8B82] flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5 border border-[#E5E1DD]">
                          <Sparkles className="w-3.5 h-3.5 text-[#7C8B82]" />
                        </div>
                      )}

                      <div className="space-y-2">
                        <div
                          className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                            isUser
                              ? 'bg-[#7C8B82] text-white rounded-tr-xs shadow-xs'
                              : 'bg-white text-[#2D2D2D] rounded-tl-xs border border-[#E5E1DD] shadow-xs'
                          }`}
                        >
                          <p className="whitespace-pre-wrap font-sans">{msg.content}</p>
                          <span className={`block text-[10px] mt-1.5 ${isUser ? 'text-white/70 text-right' : 'text-[#8A847E]'}`}>
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {/* INTERACTIVE SMART MEMORY PROPOSAL CARD */}
                        {msg.proposedMemory && (
                          <div className="bg-[#EEF2F0] border border-[#7C8B82]/40 rounded-xl p-3 shadow-xs space-y-2 max-w-md animate-fade-in">
                            <div className="flex items-center space-x-1.5 text-xs font-semibold text-[#2D2D2D]">
                              <Brain className="w-4 h-4 text-[#7C8B82]" />
                              <span>Would you like me to remember this?</span>
                            </div>
                            
                            <div className="p-2 bg-white rounded-lg border border-[#E5E1DD] text-xs text-[#2D2D2D]">
                              <div className="font-medium text-[#2D2D2D]">"{msg.proposedMemory.text}"</div>
                              <div className="flex items-center space-x-2 mt-1 text-[10px] text-[#8A847E]">
                                <span className="capitalize px-1.5 py-0.2 bg-[#EEF2F0] text-[#5C5651] rounded font-medium border border-[#E5E1DD]">
                                  {msg.proposedMemory.category}
                                </span>
                                {msg.proposedMemory.relevantDate && (
                                  <span>Date: {msg.proposedMemory.relevantDate}</span>
                                )}
                              </div>
                            </div>

                            {msg.memoryDecision === 'accepted' ? (
                              <div className="flex items-center space-x-1.5 text-xs text-[#5C5651] font-semibold bg-[#E5E1DD]/50 px-2.5 py-1 rounded-lg">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Saved to your private memory bank</span>
                              </div>
                            ) : msg.memoryDecision === 'dismissed' ? (
                              <div className="text-[11px] text-[#8A847E] italic">
                                Memory suggestion dismissed
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2 pt-1">
                                <button
                                  onClick={() => handleApproveMemory(msg.id, msg.proposedMemory!)}
                                  className="flex items-center space-x-1 px-3 py-1.5 bg-[#7C8B82] hover:bg-[#64736A] text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Remember This</span>
                                </button>
                                <button
                                  onClick={() => handleDismissMemory(msg.id)}
                                  className="px-2.5 py-1.5 text-xs font-medium text-[#8A847E] hover:text-[#2D2D2D] hover:bg-[#E5E1DD]/50 rounded-lg transition-colors cursor-pointer"
                                >
                                  Don't remember
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* INTERACTIVE DATE-BASED REMINDER PROPOSAL CARD */}
                        {msg.proposedReminder && (
                          <div className="bg-[#F4F1EE] border border-[#E5E1DD] rounded-xl p-3 shadow-xs space-y-2 max-w-md animate-fade-in">
                            <div className="flex items-center space-x-1.5 text-xs font-semibold text-[#2D2D2D]">
                              <Calendar className="w-4 h-4 text-[#7C8B82]" />
                              <span>You mentioned a date. Would you like a reminder?</span>
                            </div>

                            <div className="p-2 bg-white rounded-lg border border-[#E5E1DD] text-xs text-[#2D2D2D] space-y-1">
                              <div className="font-semibold text-[#2D2D2D]">{msg.proposedReminder.title}</div>
                              <div className="flex items-center space-x-3 text-[11px] text-[#5C5651]">
                                <span className="font-medium text-[#7C8B82]">
                                  📅 {msg.proposedReminder.dueDate} {msg.proposedReminder.dueTime ? `at ${msg.proposedReminder.dueTime}` : ''}
                                </span>
                                <span className="capitalize px-1.5 py-0.2 bg-[#EEF2F0] text-[#5C5651] border border-[#E5E1DD] rounded text-[10px]">
                                  {msg.proposedReminder.category}
                                </span>
                              </div>
                            </div>

                            {msg.reminderDecision === 'accepted' ? (
                              <div className="flex items-center space-x-1.5 text-xs text-[#5C5651] font-semibold bg-[#E5E1DD]/50 px-2.5 py-1 rounded-lg">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Reminder created on your dashboard</span>
                              </div>
                            ) : msg.reminderDecision === 'dismissed' ? (
                              <div className="text-[11px] text-[#8A847E] italic">
                                Reminder suggestion dismissed
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2 pt-1">
                                <button
                                  onClick={() => handleApproveReminder(msg.id, msg.proposedReminder!)}
                                  className="flex items-center space-x-1 px-3 py-1.5 bg-[#7C8B82] hover:bg-[#64736A] text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Create Reminder</span>
                                </button>
                                <button
                                  onClick={() => handleDismissReminder(msg.id)}
                                  className="px-2.5 py-1.5 text-xs font-medium text-[#8A847E] hover:text-[#2D2D2D] hover:bg-[#E5E1DD]/50 rounded-lg transition-colors cursor-pointer"
                                >
                                  Dismiss
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {sending && (
              <div className="flex items-start space-x-2">
                <div className="w-7 h-7 rounded-lg bg-[#EEF2F0] text-[#7C8B82] flex items-center justify-center text-xs shrink-0 border border-[#E5E1DD]">
                  <Sparkles className="w-3.5 h-3.5 text-[#7C8B82]" />
                </div>
                <div className="bg-white p-3.5 rounded-2xl rounded-tl-xs border border-[#E5E1DD] shadow-xs flex items-center space-x-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#7C8B82] animate-bounce"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#7C8B82] animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#7C8B82] animate-bounce [animation-delay:0.4s]"></div>
                </div>
              </div>
            )}
          </div>

          {/* Floating Jump to Latest Button when Scrolled Up */}
          {showScrollBottomBtn && (
            <button
              type="button"
              onClick={() => {
                isUserScrolledUp.current = false;
                setShowScrollBottomBtn(false);
                scrollToBottom('smooth');
              }}
              className="absolute bottom-20 right-6 z-20 flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-[#2D2D2D] hover:bg-[#1E1E1E] text-white text-xs font-medium shadow-lg backdrop-blur-xs transition-all cursor-pointer border border-[#5C5651] animate-fade-in"
              title="Jump to latest message"
            >
              <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
              <span>Jump to newest</span>
            </button>
          )}

          {/* Chat Input Bar - Fixed at Bottom */}
          <div className="shrink-0 p-3 sm:p-4 border-t border-[#E5E1DD] bg-white">
            <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
              {/* Audio Dictation button */}
              <button
                type="button"
                onClick={toggleSpeechRecognition}
                className={`p-2.5 rounded-xl border transition-colors cursor-pointer shrink-0 ${
                  isListening 
                    ? 'bg-red-500 text-white border-red-600 animate-pulse' 
                    : 'bg-[#F4F1EE] hover:bg-[#EEF2F0] text-[#5C5651] border-[#E5E1DD]'
                }`}
                title={isListening ? 'Stop Voice Recording' : 'Voice Dictate Thoughts'}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Text Input */}
              <input
                type="text"
                id="input-journal-message"
                placeholder={isListening ? 'Listening to your voice...' : activeConvId ? 'Continue your journal reflection...' : 'Type your reflection to start this new journal session...'}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={sending}
                className="flex-1 px-4 py-2.5 text-xs sm:text-sm bg-[#F4F1EE] border border-[#E5E1DD] rounded-xl text-[#2D2D2D] placeholder-[#8A847E] focus:outline-none focus:ring-2 focus:ring-[#7C8B82]/30 focus:border-[#7C8B82] focus:bg-white transition-all"
              />

              {/* Send Button */}
              <button
                type="submit"
                id="btn-send-journal-message"
                disabled={sending || !inputMessage.trim()}
                className="p-2.5 bg-[#7C8B82] hover:bg-[#64736A] text-white rounded-xl transition-all shadow-xs disabled:opacity-40 cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <div className="flex items-center justify-between text-[11px] text-[#8A847E] mt-2 px-1">
              <span>Press Enter to reflect • Context isolated to current session</span>
              <span className="hidden sm:inline">Protected by Firebase ABAC Rules</span>
            </div>
          </div>

        </div>

      </div>

      {/* SUMMARY MODAL */}
      {showSummaryModal && activeSummary && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-[#E5E1DD] overflow-hidden animate-fade-in">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#E5E1DD] flex items-center justify-between bg-[#F4F1EE]">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#EEF2F0] text-[#7C8B82] flex items-center justify-center border border-[#E5E1DD]">
                  <BookOpen className="w-4 h-4 text-[#7C8B82]" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-bold text-[#2D2D2D]">
                    {activeSummary.topic}
                  </h3>
                  <p className="text-xs text-[#8A847E]">
                    Session Reflection Digest • Saved to your summaries
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSummaryModal(false)}
                className="p-1 rounded-lg text-[#8A847E] hover:text-[#2D2D2D] hover:bg-[#F4F1EE] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-white text-xs sm:text-sm">
              
              {/* Narrative Summary */}
              <div className="space-y-1.5">
                <h4 className="font-serif text-xs font-bold text-[#5C5651] uppercase tracking-wider">
                  Narrative Reflection
                </h4>
                <p className="text-[#2D2D2D] leading-relaxed bg-[#F4F1EE]/60 p-3.5 rounded-xl border border-[#E5E1DD] font-sans">
                  {activeSummary.summaryText}
                </p>
              </div>

              {/* Key Takeaways & Emotions Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Key Takeaways */}
                <div className="p-3.5 rounded-xl bg-[#EEF2F0] border border-[#E5E1DD] space-y-2">
                  <h4 className="font-serif text-xs font-bold text-[#2D2D2D] flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#7C8B82]" />
                    <span>Key Takeaways</span>
                  </h4>
                  <ul className="space-y-1.5 text-xs text-[#5C5651] list-disc list-inside">
                    {activeSummary.keyPoints.map((pt, idx) => (
                      <li key={idx} className="leading-snug">{pt}</li>
                    ))}
                  </ul>
                </div>

                {/* Emotions Identified */}
                <div className="p-3.5 rounded-xl bg-[#F4F1EE] border border-[#E5E1DD] space-y-2">
                  <h4 className="font-serif text-xs font-bold text-[#2D2D2D] flex items-center space-x-1.5">
                    <Brain className="w-3.5 h-3.5 text-[#7C8B82]" />
                    <span>Emotional Themes</span>
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {activeSummary.emotions.map((em, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-[#EEF2F0] text-[#5C5651] border border-[#E5E1DD] rounded-md text-xs font-medium">
                        {em}
                      </span>
                    ))}
                  </div>
                </div>

              </div>

              {/* Actionable Goals & Dates */}
              {(activeSummary.tasksAndGoals?.length > 0 || activeSummary.datesMentioned?.length > 0) && (
                <div className="p-3.5 rounded-xl bg-[#F4F1EE] border border-[#E5E1DD] space-y-3">
                  {activeSummary.tasksAndGoals?.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-xs text-[#2D2D2D] mb-1">Goals & Intentions:</h4>
                      <ul className="space-y-1 text-xs text-[#5C5651] list-disc list-inside">
                        {activeSummary.tasksAndGoals.map((t, idx) => (
                          <li key={idx}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {activeSummary.datesMentioned?.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-xs text-[#2D2D2D] mb-1">Dates & Deadlines Mentioned:</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {activeSummary.datesMentioned.map((d, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-[#EEF2F0] text-[#5C5651] border border-[#E5E1DD] rounded text-xs font-medium">
                            📅 {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Reflection Question */}
              {activeSummary.reflectionQuestion && (
                <div className="p-4 bg-[#EEF2F0] rounded-xl border border-[#E5E1DD] text-xs sm:text-sm text-[#2D2D2D] italic font-serif">
                  " {activeSummary.reflectionQuestion} "
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-[#E5E1DD] bg-[#F4F1EE] flex items-center justify-between">
              <span className="text-xs text-[#8A847E]">
                Created on {new Date(activeSummary.createdAt).toLocaleDateString()}
              </span>
              <div className="flex items-center space-x-2">
                {onOpenSummaryView && (
                  <button
                    onClick={() => {
                      setShowSummaryModal(false);
                      onOpenSummaryView(activeSummary.id);
                    }}
                    className="px-3.5 py-1.5 bg-white text-[#5C5651] border border-[#E5E1DD] rounded-lg text-xs font-medium hover:bg-[#EEF2F0] transition-colors cursor-pointer"
                  >
                    View in Summaries Tab
                  </button>
                )}
                <button
                  onClick={() => setShowSummaryModal(false)}
                  className="px-4 py-1.5 bg-[#7C8B82] text-white rounded-lg text-xs font-medium hover:bg-[#64736A] transition-colors cursor-pointer shadow-2xs"
                >
                  Done
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Delete Conversation Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={Boolean(convToDelete)}
        title="Delete this journal entry?"
        description="Are you sure you want to delete this journal entry? This will permanently remove the conversation and its messages from your private database."
        itemSnippet={convToDelete?.title}
        isDeleting={isDeletingConv}
        onConfirm={handleConfirmDeleteConversation}
        onCancel={() => {
          if (!isDeletingConv) setConvToDelete(null);
        }}
        deleteLabel="Delete"
        cancelLabel="Cancel"
      />

    </div>
  );
};
