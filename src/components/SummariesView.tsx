import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Search, 
  Trash2, 
  Copy, 
  Check, 
  Sparkles, 
  Brain, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  MessageSquare,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { 
  db, 
  getJournalSummaries, 
  deleteJournalSummary 
} from '../lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { JournalSummary } from '../types';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

interface SummariesViewProps {
  onOpenConversation?: (conversationId: string) => void;
}

const formatSummaryDate = (createdAt: any) => {
  if (!createdAt) return new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const ms = typeof createdAt === 'object' && createdAt !== null && 'toMillis' in createdAt
    ? createdAt.toMillis()
    : typeof createdAt === 'object' && createdAt !== null && 'seconds' in createdAt
    ? createdAt.seconds * 1000
    : typeof createdAt === 'number'
    ? createdAt
    : Date.parse(createdAt) || Date.now();
  return new Date(ms).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

export const SummariesView: React.FC<SummariesViewProps> = ({ onOpenConversation }) => {
  const { user } = useAuth();
  const [summaries, setSummaries] = useState<JournalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [summaryToDelete, setSummaryToDelete] = useState<JournalSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3200);
  };

  useEffect(() => {
    if (!user) return;
    loadSummaries();

    // Attach real-time listener to /users/{user.uid}/summaries
    const colRef = collection(db, 'users', user.uid, 'summaries');
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const liveSummaries = snapshot.docs.map(d => {
        const data = d.data();
        const text = data.summary || data.summaryText || '';
        return {
          id: d.id,
          ...data,
          summary: text,
          summaryText: text
        } as JournalSummary;
      });
      setSummaries(liveSummaries);
      if (liveSummaries.length > 0) {
        setExpandedId(prev => prev || liveSummaries[0].id);
      }
      setLoading(false);
    }, (error) => {
      console.warn('Real-time summaries subscription notice:', error);
    });

    return () => unsubscribe();
  }, [user]);

  const loadSummaries = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getJournalSummaries(user.uid);
      setSummaries(data);
      if (data.length > 0) {
        setExpandedId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load summaries:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!user || !summaryToDelete) return;
    setIsDeleting(true);
    const id = summaryToDelete.id;

    try {
      await deleteJournalSummary(user.uid, id);
      setSummaries(prev => prev.filter(s => s.id !== id));
      if (expandedId === id) {
        setExpandedId(null);
      }
      setSummaryToDelete(null);
      showToast('Summary deleted', 'success');
    } catch (err) {
      console.error('Failed to delete summary:', err);
      showToast("Couldn't delete this item. Please try again.", 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyMarkdown = (summary: JournalSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    const md = `# Journal Digest: ${summary.topic || 'Reflective Summary'}
Date: ${formatSummaryDate(summary.createdAt)}

## Narrative Reflection
${summary.summaryText || summary.summary || 'No narrative text available.'}

## Key Takeaways
${summary.keyPoints?.map(p => `- ${p}`).join('\n') || 'None'}

## Emotions Identified
${summary.emotions?.join(', ') || 'None'}

${summary.tasksAndGoals?.length ? `## Goals & Tasks\n${summary.tasksAndGoals.map(t => `- ${t}`).join('\n')}` : ''}

${summary.datesMentioned?.length ? `## Dates Mentioned\n${summary.datesMentioned.map(d => `- ${d}`).join('\n')}` : ''}

${summary.reflectionQuestion ? `## Reflection Prompt\n> "${summary.reflectionQuestion}"` : ''}
`;

    navigator.clipboard.writeText(md);
    setCopiedId(summary.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const filteredSummaries = summaries.filter(s => {
    const q = (searchQuery || '').toLowerCase();
    const topic = (s.topic || '').toLowerCase();
    const summaryText = (s.summaryText || s.summary || '').toLowerCase();
    const title = (s.conversationTitle || '').toLowerCase();
    const keyPointsMatch = s.keyPoints?.some(k => (k || '').toLowerCase().includes(q));

    return topic.includes(q) || summaryText.includes(q) || title.includes(q) || Boolean(keyPointsMatch);
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in text-[#2D2D2D]">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#E5E1DD] shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-[#7C8B82] text-xs font-semibold">
            <BookOpen className="w-4 h-4 text-[#7C8B82]" />
            <span>Automated AI Reflection Summaries</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#2D2D2D]">
            Journal Digests & Takeaways
          </h1>
          <p className="text-xs sm:text-sm text-[#5C5651] font-sans max-w-2xl">
            Synthesized insights, key realizations, emotional themes, and future contemplation prompts from your past reflections.
          </p>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 self-start md:self-auto w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#8A847E]" />
            <input
              type="text"
              placeholder="Search digests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs bg-[#F4F1EE] border border-[#E5E1DD] rounded-xl text-[#2D2D2D] placeholder-[#8A847E] focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#7C8B82]"
            />
          </div>
        </div>
      </div>

      {/* Summaries Stream */}
      <div className="space-y-4">
        {filteredSummaries.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-[#E5E1DD] p-8 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#EEF2F0] text-[#7C8B82] flex items-center justify-center mx-auto">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-base font-bold text-[#2D2D2D]">
              {searchQuery ? 'No summaries match your search' : 'No journal summaries generated yet'}
            </h3>
            <p className="text-xs text-[#8A847E] max-w-sm mx-auto">
              Click "Wrap Up & Summarize" in any Journal Chat session to generate a private, structured digest here.
            </p>
          </div>
        ) : (
          filteredSummaries.map((sum) => {
            const isExpanded = expandedId === sum.id;
            return (
              <div
                key={sum.id}
                className="bg-white rounded-2xl border border-[#E5E1DD] shadow-xs overflow-hidden transition-all hover:border-[#7C8B82]"
              >
                {/* Header Row */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : sum.id)}
                  className="p-5 flex items-start justify-between cursor-pointer bg-[#F4F1EE]/40 hover:bg-[#F4F1EE] transition-colors"
                >
                  <div className="space-y-1.5 flex-1 pr-4">
                    <div className="flex items-center space-x-2 text-xs text-[#8A847E]">
                      <span>{formatSummaryDate(sum.createdAt)}</span>
                      <span>•</span>
                      <span className="text-[#5C5651] font-medium">{sum.conversationTitle || 'Journal Entry'}</span>
                    </div>

                    <h3 className="font-serif text-base sm:text-lg font-bold text-[#2D2D2D]">
                      {sum.topic || 'Reflective Journal Entry'}
                    </h3>

                    {sum.emotions?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {sum.emotions.map((em, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#EEF2F0] text-[#5C5651] border border-[#E5E1DD]">
                            {em}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => handleCopyMarkdown(sum, e)}
                      className="p-2 text-[#5C5651] hover:text-[#2D2D2D] hover:bg-[#E5E1DD]/60 rounded-lg transition-colors text-xs flex items-center space-x-1"
                      title="Copy as Markdown"
                    >
                      {copiedId === sum.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-[10px] text-emerald-700 font-medium">Copied</span>
                        </>
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSummaryToDelete(sum);
                      }}
                      disabled={isDeleting && summaryToDelete?.id === sum.id}
                      className="p-2 text-[#8A847E] hover:text-red-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      title="Delete summary"
                      aria-label="Delete summary"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <div className="p-1 text-[#8A847E]">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="p-6 border-t border-[#E5E1DD] space-y-6 text-xs sm:text-sm bg-white animate-fade-in">
                    
                    {/* Narrative */}
                    <div className="space-y-1.5">
                      <h4 className="font-serif text-xs font-bold text-[#5C5651] uppercase tracking-wider">
                        Synthesized Narrative
                      </h4>
                      <p className="text-[#2D2D2D] leading-relaxed font-sans bg-[#F4F1EE]/60 p-4 rounded-xl border border-[#E5E1DD] whitespace-pre-wrap">
                        {sum.summaryText || sum.summary || 'No narrative text recorded.'}
                      </p>
                    </div>

                    {/* Key Takeaways */}
                    {sum.keyPoints?.length > 0 && (
                      <div className="p-4 rounded-xl bg-[#EEF2F0] border border-[#E5E1DD] space-y-2">
                        <h4 className="font-serif text-xs font-bold text-[#2D2D2D] flex items-center space-x-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-[#7C8B82]" />
                          <span>Key Takeaways & Insights</span>
                        </h4>
                        <ul className="space-y-1.5 text-[#5C5651] list-disc list-inside">
                          {sum.keyPoints.map((pt, idx) => (
                            <li key={idx} className="leading-snug">{pt}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Tasks & Dates Grid */}
                    {(sum.tasksAndGoals?.length > 0 || sum.datesMentioned?.length > 0) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {sum.tasksAndGoals?.length > 0 && (
                          <div className="p-4 rounded-xl bg-[#F4F1EE] border border-[#E5E1DD] space-y-1.5">
                            <h4 className="font-semibold text-xs text-[#2D2D2D]">Identified Goals & Intentions</h4>
                            <ul className="space-y-1 text-xs text-[#5C5651] list-disc list-inside">
                              {sum.tasksAndGoals.map((t, idx) => (
                                <li key={idx}>{t}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {sum.datesMentioned?.length > 0 && (
                          <div className="p-4 rounded-xl bg-[#F4F1EE] border border-[#E5E1DD] space-y-1.5">
                            <h4 className="font-semibold text-xs text-[#2D2D2D]">Dates & Deadlines Noted</h4>
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {sum.datesMentioned.map((d, idx) => (
                                <span key={idx} className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#EEF2F0] text-[#5C5651] border border-[#E5E1DD]">
                                  📅 {d}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Reflection Question */}
                    {sum.reflectionQuestion && (
                      <div className="p-4 rounded-xl bg-[#EEF2F0] border border-[#E5E1DD] text-[#2D2D2D] font-serif italic">
                        " {sum.reflectionQuestion} "
                      </div>
                    )}

                    {/* Action to Jump to Conversation */}
                    {sum.conversationId && onOpenConversation && (
                      <div className="pt-2 flex justify-end">
                        <button
                          onClick={() => onOpenConversation(sum.conversationId)}
                          className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#7C8B82] hover:bg-[#64736A] text-white transition-colors shadow-2xs"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Open in Journal Chat</span>
                        </button>
                      </div>
                    )}

                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

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
        isOpen={Boolean(summaryToDelete)}
        title="Delete this summary?"
        description="Are you sure you want to delete this journal summary digest? This will permanently remove it from your private Firestore database."
        itemSnippet={summaryToDelete?.topic || summaryToDelete?.summaryText || summaryToDelete?.summary}
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (!isDeleting) setSummaryToDelete(null);
        }}
        deleteLabel="Delete"
        cancelLabel="Cancel"
      />
    </div>
  );
};
