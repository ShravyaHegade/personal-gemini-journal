import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  Plus, 
  Search, 
  Trash2, 
  ShieldCheck, 
  Filter, 
  Sparkles, 
  Calendar, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Tag
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db, getSmartMemories, deleteSmartMemory, saveSmartMemory } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { MemoryCategory, SmartMemory } from '../types';
import { NewMemoryModal } from './NewMemoryModal';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

export const MemoriesView: React.FC = () => {
  const { user } = useAuth();
  const [memories, setMemories] = useState<SmartMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [memoryToDelete, setMemoryToDelete] = useState<SmartMemory | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    loadMemories();

    // Attach real-time listener to /users/{user.uid}/memories
    const colRef = collection(db, 'users', user.uid, 'memories');
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const liveMems = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as SmartMemory));
      setMemories(liveMems);
      setLoading(false);
    }, (error) => {
      console.warn('Real-time memories listener notice:', error);
    });

    return () => unsubscribe();
  }, [user]);

  const loadMemories = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getSmartMemories(user.uid);
      setMemories(data);
    } catch (err) {
      console.error('Failed to load memories:', err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3200);
  };

  const handleConfirmDelete = async () => {
    if (!user || !memoryToDelete) return;
    setIsDeleting(true);
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
      setIsDeleting(false);
    }
  };

  const filteredMemories = memories.filter(m => {
    const q = (searchQuery || '').toLowerCase();
    const matchesCat = selectedCategory === 'all' || m.category === selectedCategory;
    const matchesSearch = (m.text || '').toLowerCase().includes(q) ||
      Boolean(m.relevantDate && m.relevantDate.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  const categories: { id: string; label: string }[] = [
    { id: 'all', label: 'All Contexts' },
    { id: 'goal', label: 'Goals' },
    { id: 'milestone', label: 'Milestones' },
    { id: 'preference', label: 'Preferences' },
    { id: 'event', label: 'Events' },
    { id: 'task', label: 'Tasks' },
    { id: 'general', label: 'General' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in text-[#2D2D2D]">
      
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

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#E5E1DD] shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-[#7C8B82] text-xs font-semibold">
            <Brain className="w-4 h-4 text-[#7C8B82]" />
            <span>User-Controlled Smart Memory Bank</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#2D2D2D]">
            Approved AI Memories
          </h1>
          <p className="text-xs sm:text-sm text-[#5C5651] font-sans max-w-2xl">
            You retain absolute sovereignty over your context. Gemini only retains facts and goals that you explicitly approve.
          </p>
        </div>

        <button
          onClick={() => setIsNewModalOpen(true)}
          className="flex items-center space-x-1.5 px-4 py-2.5 bg-[#7C8B82] hover:bg-[#64736A] text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-xs cursor-pointer self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Custom Memory</span>
        </button>
      </div>

      {/* Privacy Notice Banner */}
      <div className="p-4 rounded-2xl bg-[#EEF2F0] border border-[#E5E1DD] flex items-start space-x-3 text-xs text-[#2D2D2D]">
        <ShieldCheck className="w-5 h-5 text-[#7C8B82] shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-bold text-[#2D2D2D]">Zero Silent Profiling Policy:</span>
          <p className="text-[#5C5651] leading-normal">
            During conversations, Gemini proposes memories via inline approval cards. Nothing is written to Firestore without your direct approval. You can delete any memory at any time.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-[#E5E1DD]">
        
        {/* Category Pills */}
        <div className="flex items-center space-x-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-[#7C8B82] text-white shadow-2xs'
                  : 'text-[#5C5651] hover:text-[#2D2D2D] hover:bg-[#F4F1EE]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#8A847E]" />
          <input
            type="text"
            placeholder="Search memories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F4F1EE] border border-[#E5E1DD] rounded-lg text-[#2D2D2D] placeholder-[#8A847E] focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#7C8B82]"
          />
        </div>

      </div>

      {/* Memories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMemories.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-dashed border-[#E5E1DD] p-8 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#EEF2F0] text-[#7C8B82] flex items-center justify-center mx-auto">
              <Brain className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-base font-bold text-[#2D2D2D]">
              {searchQuery ? 'No memories match your query' : 'No memories saved yet'}
            </h3>
            <p className="text-xs text-[#8A847E] max-w-sm mx-auto">
              When having a reflection in the Journal Chat, Gemini will spot key milestones and ask: "Would you like me to remember this?".
            </p>
          </div>
        ) : (
          filteredMemories.map((mem) => (
            <div
              key={mem.id}
              className="bg-white rounded-2xl p-5 border border-[#E5E1DD] shadow-xs flex flex-col justify-between space-y-4 hover:border-[#7C8B82] transition-all group"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="capitalize px-2 py-0.5 rounded text-[10px] font-semibold bg-[#EEF2F0] text-[#5C5651] border border-[#E5E1DD]">
                    {mem.category}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMemoryToDelete(mem);
                    }}
                    disabled={isDeleting && memoryToDelete?.id === mem.id}
                    className="p-1.5 text-[#8A847E] hover:text-red-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    title="Delete memory"
                    aria-label="Delete memory"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="font-serif text-sm font-medium text-[#2D2D2D] leading-relaxed">
                  "{mem.text}"
                </p>
              </div>

              <div className="pt-3 border-t border-[#E5E1DD] flex items-center justify-between text-[10px] text-[#8A847E]">
                {mem.relevantDate ? (
                  <span className="flex items-center space-x-1 text-[#7C8B82] font-medium">
                    <Calendar className="w-3 h-3" />
                    <span>Target: {mem.relevantDate}</span>
                  </span>
                ) : (
                  <span>General Knowledge</span>
                )}
                <span>Added {new Date(mem.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {isNewModalOpen && user && (
        <NewMemoryModal
          isOpen={isNewModalOpen}
          onClose={() => setIsNewModalOpen(false)}
          onSave={async (newMem) => {
            await saveSmartMemory(user.uid, newMem);
            await loadMemories();
            showToast('✓ Memory saved to private vault');
          }}
          userId={user.uid}
        />
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={Boolean(memoryToDelete)}
        title="Delete this memory?"
        description="Are you sure you want to delete this approved memory? Gemini will no longer use this context in your future journal reflections."
        itemSnippet={memoryToDelete?.text}
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (!isDeleting) setMemoryToDelete(null);
        }}
        deleteLabel="Delete"
        cancelLabel="Cancel"
      />

    </div>
  );
};
