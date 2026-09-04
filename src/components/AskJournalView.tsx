import React, { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Brain, 
  Sparkles, 
  Send, 
  Loader2, 
  Copy, 
  Check, 
  Lock, 
  HelpCircle, 
  Compass, 
  Calendar, 
  BookOpen, 
  Bookmark, 
  AlertCircle,
  RefreshCw,
  Clock,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  Target
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { saveSmartMemory } from '../lib/firebase';
import { AskJournalMessage, GroundingMetadata } from '../types';

const SUGGESTED_QUESTIONS = [
  'What have I accomplished this month?',
  'What has been stressing me lately?',
  'What goals have I not completed?',
  'When was I most confident?',
  "What did I say I wanted to do but haven't done?",
  'What changed in my life recently?',
  'What have I been spending most of my time on?',
  'What patterns do you notice in my life?',
  'What should I focus on next?'
];

export const AskJournalView: React.FC = () => {
  const { user } = useAuth();
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<AskJournalMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [savedMemoryIndex, setSavedMemoryIndex] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleAsk = async (queryText?: string) => {
    const textToAsk = (queryText || question).trim();
    if (!textToAsk || !user || loading) return;

    setErrorMsg(null);
    setQuestion('');

    const userMessage: AskJournalMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: textToAsk,
      timestamp: Date.now()
    };

    const currentHistory = [...messages, userMessage];
    setMessages(currentHistory);
    setLoading(true);

    try {
      // 1. Obtain authenticated Firebase ID Token directly from user session
      const idToken = await user.getIdToken();

      // 2. Query server-side Ask My Journal endpoint with Bearer token
      const response = await fetch('/api/ask-journal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          question: textToAsk,
          chatHistory: currentHistory.slice(-6).map(m => ({
            role: m.role,
            content: m.content
          })),
          userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status ${response.status}`);
      }

      const data = await response.json();

      const modelMessage: AskJournalMessage = {
        id: `gemini-${Date.now()}`,
        role: 'model',
        content: data.answer,
        timestamp: Date.now(),
        groundingMetadata: data.groundingMetadata
      };

      setMessages(prev => [...prev, modelMessage]);
    } catch (err: any) {
      console.error('Ask My Journal error:', err);
      const errMsg = err?.message || 'Failed to search your journal. Please try again.';
      setErrorMsg(errMsg);
      
      const errorResponse: AskJournalMessage = {
        id: `err-${Date.now()}`,
        role: 'model',
        content: `I encountered an issue querying your journal: ${errMsg}`,
        timestamp: Date.now(),
        error: true
      };
      setMessages(prev => [...prev, errorResponse]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSaveAsMemory = async (text: string, index: number) => {
    if (!user) return;
    try {
      await saveSmartMemory(user.uid, {
        userId: user.uid,
        text: `Insight from Ask My Journal: ${text.slice(0, 180)}...`,
        category: 'milestone',
        createdAt: Date.now(),
        approvedByUser: true
      });
      setSavedMemoryIndex(index);
      setTimeout(() => setSavedMemoryIndex(null), 2500);
    } catch (e) {
      console.error('Failed to save memory:', e);
    }
  };

  const handleClearSession = () => {
    setMessages([]);
    setErrorMsg(null);
    setQuestion('');
  };

  return (
    <div className="flex-1 overflow-y-auto py-8 px-4 sm:px-6 lg:px-8 max-w-4xl w-full mx-auto space-y-8 animate-fade-in text-[#2D2D2D]">
      
      {/* Distinctive Intelligence Layer Header */}
      <div className="bg-[#F4F1EE] rounded-3xl p-6 sm:p-8 border border-[#E5E1DD] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2 text-xs font-semibold text-[#5C5651]">
              <span className="w-2 h-2 rounded-full bg-[#7C8B82]"></span>
              <span>Private Sanctuary • Verified Firestore Intelligence</span>
            </div>
            
            <div className="flex items-center space-x-3 pt-1">
              <span className="text-3xl select-none" role="img" aria-label="Brain">🧠</span>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#2D2D2D]">
                Ask My Journal
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white text-[#5C5651] border border-[#E5E1DD] shadow-2xs">
                <Lock className="w-2.5 h-2.5 mr-1 text-[#7C8B82]" />
                Private
              </span>
            </div>
          </div>

          {messages.length > 0 && (
            <button
              id="btn-clear-ask-session"
              onClick={handleClearSession}
              className="self-start sm:self-center flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-[#6B655F] hover:text-[#2D2D2D] bg-white hover:bg-[#FAF9F7] border border-[#D5D1CC] shadow-2xs transition-all cursor-pointer"
              title="Start a new inquiry"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1 text-[#7C8B82]" />
              <span>New Inquiry</span>
            </button>
          )}
        </div>

        {/* Emotionally Engaging & Specific Intelligence Copy */}
        <div className="space-y-1 pt-1 border-t border-[#EAE6E1]">
          <p className="font-serif text-base sm:text-lg font-medium text-[#2D2D2D] leading-snug">
            Your journal remembers the story you've written.
          </p>
          <p className="text-xs sm:text-sm text-[#5C5651] font-sans leading-relaxed">
            Ask questions about your goals, accomplishments, emotions, patterns, important moments, and how your life is changing over time.
          </p>
        </div>
      </div>

      {/* Prominent Question Input Card */}
      <div className="bg-white rounded-2xl border border-[#E5E1DD] shadow-sm p-3.5 sm:p-4 focus-within:border-[#7C8B82] focus-within:ring-2 focus-within:ring-[#7C8B82]/15 transition-all space-y-3">
        <textarea
          id="input-ask-journal"
          ref={inputRef}
          rows={3}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about your journal history... (e.g. 'What have I accomplished this month?')"
          disabled={loading}
          className="w-full bg-transparent resize-none border-none text-sm text-[#2D2D2D] placeholder-[#8A847E] focus:outline-hidden p-1 leading-relaxed"
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-[#F4F1EE]">
          <div className="flex items-center space-x-1.5 text-[11px] text-[#8A847E]">
            <Lock className="w-3 h-3 text-[#7C8B82] shrink-0" />
            <span className="hidden sm:inline">Press</span>
            <kbd className="px-1.5 py-0.5 text-[10px] bg-[#F4F1EE] rounded border border-[#E5E1DD] font-mono text-[#5C5651]">Enter ↵</kbd>
            <span className="hidden sm:inline">to ask • answers isolated to your private account</span>
          </div>

          <button
            id="btn-submit-ask-journal"
            onClick={() => handleAsk()}
            disabled={!question.trim() || loading}
            className={`flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer shrink-0 ${
              question.trim() && !loading
                ? 'bg-[#7C8B82] hover:bg-[#68766E] text-white shadow-xs ring-1 ring-[#7C8B82]/20'
                : 'bg-[#F4F1EE] text-[#A6A09A] cursor-not-allowed'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Analyzing Journal...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Ask Journal</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Suggested Questions Grid */}
      <div className="space-y-2">
        <div className="flex items-center space-x-1.5 text-xs font-medium text-[#8A847E]">
          <Sparkles className="w-3.5 h-3.5 text-[#7C8B82]" />
          <span>Try asking:</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map((q, idx) => (
            <button
              key={idx}
              id={`btn-suggested-question-${idx}`}
              onClick={() => handleAsk(q)}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#FAF9F7] text-xs font-medium text-[#4A4540] hover:text-[#2D2D2D] border border-[#E5E1DD] hover:border-[#7C8B82]/60 transition-all shadow-2xs cursor-pointer text-left"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2 shadow-2xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Loading State Banner */}
      {loading && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E5E1DD] shadow-sm space-y-4">
          <div className="flex items-center space-x-3 text-sm font-semibold text-[#2D2D2D]">
            <div className="w-8 h-8 rounded-xl bg-[#EEF2F0] text-[#7C8B82] flex items-center justify-center border border-[#D9E2DC]">
              <Brain className="w-4 h-4 animate-pulse text-[#7C8B82]" />
            </div>
            <div>
              <p className="font-serif">Searching your journal & synthesizing insights...</p>
              <p className="text-xs text-[#8A847E] font-sans font-normal">
                Reasoning across your conversations, summaries, smart memories, and reminders.
              </p>
            </div>
          </div>
          <div className="w-full bg-[#F4F1EE] rounded-full h-1.5 overflow-hidden">
            <div className="bg-[#7C8B82] h-1.5 rounded-full animate-pulse w-2/3"></div>
          </div>
        </div>
      )}

      {/* Structured Reports / Answer Stream */}
      {messages.length > 0 && (
        <div className="space-y-8 pt-2">
          {messages.map((msg, index) => {
            if (msg.role === 'user') {
              return (
                <div key={msg.id || index} className="flex items-center space-x-3 py-2 px-4 rounded-xl bg-[#F4F1EE] border border-[#E5E1DD]">
                  <span className="text-xs font-semibold text-[#7C8B82] font-mono shrink-0">Inquiry:</span>
                  <span className="text-sm font-serif font-medium text-[#2D2D2D]">{msg.content}</span>
                </div>
              );
            }

            return (
              <div 
                key={msg.id || index}
                className="bg-white rounded-3xl border border-[#E5E1DD] shadow-sm p-6 sm:p-8 space-y-6"
              >
                {/* Answer Header */}
                <div className="flex items-center justify-between pb-4 border-b border-[#F0ECE7]">
                  <div className="flex items-center space-x-2.5">
                    <span className="text-xl select-none" role="img" aria-label="Open Book">📖</span>
                    <h2 className="font-serif text-lg sm:text-xl font-bold text-[#2D2D2D]">
                      Your Journal Says
                    </h2>
                  </div>

                  <span className="text-[11px] text-[#8A847E]">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Structured Markdown Answer Content */}
                <div className="markdown-body space-y-4 text-sm leading-relaxed text-[#2D2D2D]">
                  <Markdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children }) => (
                        <h1 className="text-lg sm:text-xl font-serif font-bold text-[#2D2D2D] mt-4 mb-2 pb-1.5 border-b border-[#F0ECE7] flex items-center gap-2">
                          {children}
                        </h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="text-base sm:text-lg font-serif font-bold text-[#2D2D2D] mt-4 mb-2 pb-1 border-b border-[#F0ECE7] flex items-center gap-2">
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-sm sm:text-base font-semibold text-[#2D2D2D] mt-3.5 mb-1.5 flex items-center gap-1.5">
                          {children}
                        </h3>
                      ),
                      h4: ({ children }) => (
                        <h4 className="text-xs sm:text-sm font-semibold text-[#5C5651] mt-2.5 mb-1">
                          {children}
                        </h4>
                      ),
                      p: ({ children }) => (
                        <p className="text-sm text-[#3D3A36] leading-relaxed my-2">
                          {children}
                        </p>
                      ),
                      ul: ({ children }) => (
                        <ul className="list-disc pl-5 my-2.5 space-y-1.5 text-sm text-[#3D3A36] marker:text-[#7C8B82]">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="list-decimal pl-5 my-2.5 space-y-2 text-sm text-[#3D3A36] marker:font-semibold marker:text-[#7C8B82]">
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => (
                        <li className="text-sm text-[#3D3A36] leading-relaxed pl-1">
                          {children}
                        </li>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-semibold text-[#1A1918]">
                          {children}
                        </strong>
                      ),
                      em: ({ children }) => (
                        <em className="italic text-[#4A4642]">
                          {children}
                        </em>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-3 border-[#7C8B82] bg-[#FAF9F7] px-4 py-2.5 my-3 rounded-r-xl text-sm text-[#5C5651] italic">
                          {children}
                        </blockquote>
                      ),
                      table: ({ children }) => (
                        <div className="overflow-x-auto my-4 rounded-xl border border-[#E5E1DD] shadow-2xs">
                          <table className="w-full text-xs sm:text-sm text-left border-collapse bg-white">
                            {children}
                          </table>
                        </div>
                      ),
                      thead: ({ children }) => (
                        <thead className="bg-[#FAF9F7] border-b border-[#E5E1DD] text-[#5C5651]">
                          {children}
                        </thead>
                      ),
                      tbody: ({ children }) => (
                        <tbody className="divide-y divide-[#EBE7E2]">
                          {children}
                        </tbody>
                      ),
                      tr: ({ children }) => (
                        <tr className="hover:bg-[#FAF9F7] transition-colors">
                          {children}
                        </tr>
                      ),
                      th: ({ children }) => (
                        <th className="py-2.5 px-3.5 font-semibold text-[#2D2D2D] border-r border-[#E5E1DD] last:border-r-0">
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td className="py-2.5 px-3.5 text-[#3D3A36] border-r border-[#E5E1DD] last:border-r-0 align-top">
                          {children}
                        </td>
                      ),
                      code: ({ children }) => (
                        <code className="bg-[#F4F1EE] text-[#5C5651] px-1.5 py-0.5 rounded text-xs font-mono font-medium border border-[#EBE7E2]">
                          {children}
                        </code>
                      ),
                      hr: () => <hr className="my-4 border-[#F0ECE7]" />
                    }}
                  >
                    {msg.content}
                  </Markdown>
                </div>

                {/* Evidence & Grounding Card ("Based on Your Journal") */}
                {msg.groundingMetadata && (
                  <div className="space-y-3.5 bg-[#FAF9F7] p-5 rounded-2xl border border-[#E5E1DD] shadow-2xs">
                    <div className="flex items-center justify-between pb-2.5 border-b border-[#EBE7E2]">
                      <div className="flex items-center space-x-2 font-bold text-[#2D2D2D] text-sm font-serif">
                        <span className="text-base select-none" role="img" aria-label="Books">📚</span>
                        <span>Based on Your Journal</span>
                      </div>
                      <span className="text-[10px] font-medium text-[#7C8B82] bg-[#EEF2F0] px-2.5 py-0.5 rounded-full border border-[#D9E2DC]">
                        Verified Real Data
                      </span>
                    </div>

                    {/* 4 Clean Metric Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 bg-white rounded-xl border border-[#E5E1DD] shadow-2xs flex flex-col justify-between">
                        <span className="font-bold font-serif text-[#2D2D2D] text-xl">
                          {msg.groundingMetadata.entriesAnalyzed}
                        </span>
                        <span className="text-[#8A847E] text-[11px] font-medium mt-1">
                          Entries & Chats
                        </span>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-[#E5E1DD] shadow-2xs flex flex-col justify-between">
                        <span className="font-bold font-serif text-[#2D2D2D] text-xl">
                          {msg.groundingMetadata.summariesAnalyzed}
                        </span>
                        <span className="text-[#8A847E] text-[11px] font-medium mt-1">
                          Deep Summaries
                        </span>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-[#E5E1DD] shadow-2xs flex flex-col justify-between">
                        <span className="font-bold font-serif text-[#2D2D2D] text-xl">
                          {msg.groundingMetadata.memoriesAnalyzed}
                        </span>
                        <span className="text-[#8A847E] text-[11px] font-medium mt-1">
                          Smart Memories
                        </span>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-[#E5E1DD] shadow-2xs flex flex-col justify-between">
                        <span className="font-bold font-serif text-[#2D2D2D] text-xl">
                          {msg.groundingMetadata.remindersAnalyzed}
                        </span>
                        <span className="text-[#8A847E] text-[11px] font-medium mt-1">
                          Reminders
                        </span>
                      </div>
                    </div>

                    {/* Timeline */}
                    {msg.groundingMetadata.dateRange && (
                      <div className="flex items-center space-x-2 text-xs text-[#5C5651] bg-white p-2.5 rounded-xl border border-[#E5E1DD]">
                        <Calendar className="w-3.5 h-3.5 text-[#7C8B82] shrink-0" />
                        <span className="text-[#8A847E] font-medium">Timeline:</span>
                        <strong className="text-[#2D2D2D] font-medium">{msg.groundingMetadata.dateRange}</strong>
                      </div>
                    )}

                    {/* Key Themes */}
                    {msg.groundingMetadata.keyThemes && msg.groundingMetadata.keyThemes.length > 0 && (
                      <div className="space-y-1.5 pt-1 border-t border-[#EBE7E2]">
                        <span className="text-[10px] font-semibold text-[#8A847E] uppercase tracking-wider block">
                          Key Themes:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.groundingMetadata.keyThemes.map((theme, tIdx) => (
                            <span 
                              key={tIdx}
                              className="px-2.5 py-0.5 bg-[#EEF2F0] text-[#3D4741] border border-[#D9E2DC] rounded-full text-xs font-medium shadow-2xs"
                            >
                              {theme}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Report Action Toolbar */}
                <div className="flex items-center justify-between pt-3 border-t border-[#F0ECE7] text-xs">
                  <div className="flex items-center space-x-2">
                    <button
                      id={`btn-copy-answer-${index}`}
                      onClick={() => handleCopy(msg.content, index)}
                      className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-[#6B655F] hover:text-[#2D2D2D] hover:bg-[#F4F1EE] border border-[#E5E1DD] transition-colors cursor-pointer text-xs"
                      title="Copy report"
                    >
                      {copiedIndex === index ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700 font-medium">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Answer</span>
                        </>
                      )}
                    </button>

                    <button
                      id={`btn-save-memory-${index}`}
                      onClick={() => handleSaveAsMemory(msg.content, index)}
                      className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-[#6B655F] hover:text-[#7C8B82] hover:bg-[#EEF2F0] border border-[#E5E1DD] transition-colors cursor-pointer text-xs"
                      title="Save key insight to Smart Memories"
                    >
                      {savedMemoryIndex === index ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700 font-medium">Saved to Memories</span>
                        </>
                      ) : (
                        <>
                          <Bookmark className="w-3.5 h-3.5" />
                          <span>Save to Memory</span>
                        </>
                      )}
                    </button>
                  </div>

                  <span className="text-[11px] text-[#A6A09A]">
                    Private • Isolated to UID
                  </span>
                </div>
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>
      )}

    </div>
  );
};
