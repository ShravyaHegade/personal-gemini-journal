import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Plus, 
  Search, 
  CheckCircle2, 
  Circle, 
  Trash2, 
  Clock, 
  AlertCircle,
  Tag,
  Check,
  CalendarDays
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db, getSmartReminders, saveSmartReminder, toggleReminderCompleted, deleteSmartReminder } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { SmartReminder } from '../types';
import { NewReminderModal } from './NewReminderModal';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

export const RemindersView: React.FC = () => {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<SmartReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'upcoming' | 'completed' | 'all'>('upcoming');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reminderToDelete, setReminderToDelete] = useState<SmartReminder | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    loadReminders();

    // Attach real-time listener to /users/{user.uid}/reminders
    const colRef = collection(db, 'users', user.uid, 'reminders');
    const q = query(colRef, orderBy('dueDate', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const liveReminders = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as SmartReminder));
      setReminders(liveReminders);
      setLoading(false);
    }, (error) => {
      console.warn('Real-time reminders listener notice:', error);
    });

    return () => unsubscribe();
  }, [user]);

  const loadReminders = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getSmartReminders(user.uid);
      setReminders(data);
    } catch (err) {
      console.error('Failed to load reminders:', err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3200);
  };

  const handleToggle = async (id: string, currentStatus: boolean) => {
    if (!user) return;
    try {
      await toggleReminderCompleted(user.uid, id, !currentStatus);
      setReminders(prev => prev.map(r => r.id === id ? { ...r, completed: !currentStatus } : r));
      showToast(!currentStatus ? '✓ Reminder completed!' : 'Reminder reopened', 'success');
    } catch (err) {
      console.error('Failed to toggle reminder:', err);
    }
  };

  const handleConfirmDelete = async () => {
    if (!user || !reminderToDelete) return;
    setIsDeleting(true);
    const id = reminderToDelete.id;

    try {
      await deleteSmartReminder(user.uid, id);
      setReminders(prev => prev.filter(r => r.id !== id));
      setReminderToDelete(null);
      showToast('Reminder deleted', 'success');
    } catch (err) {
      console.error('Failed to delete reminder:', err);
      showToast("Couldn't delete this item. Please try again.", 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const getDaysDiff = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const filteredReminders = reminders.filter(r => {
    const matchesFilter = 
      filter === 'all' ? true :
      filter === 'completed' ? r.completed :
      !r.completed;
    
    const q = (searchQuery || '').toLowerCase();
    const matchesSearch = 
      (r.title || '').toLowerCase().includes(q) ||
      Boolean(r.notes && r.notes.toLowerCase().includes(q));

    return matchesFilter && matchesSearch;
  });

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
            <Calendar className="w-4 h-4 text-[#7C8B82]" />
            <span>Date-Based Journal Reminders</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#2D2D2D]">
            Scheduled Commitments & Deadlines
          </h1>
          <p className="text-xs sm:text-sm text-[#5C5651] font-sans max-w-2xl">
            Keep track of deadlines, exams, and milestones extracted from your reflections or created directly.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-1.5 px-4 py-2.5 bg-[#7C8B82] hover:bg-[#64736A] text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-xs cursor-pointer self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Reminder</span>
        </button>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-[#E5E1DD]">
        
        {/* Filter Pills */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setFilter('upcoming')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === 'upcoming'
                ? 'bg-[#7C8B82] text-white shadow-2xs'
                : 'text-[#5C5651] hover:text-[#2D2D2D] hover:bg-[#F4F1EE]'
            }`}
          >
            Upcoming ({reminders.filter(r => !r.completed).length})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === 'completed'
                ? 'bg-[#7C8B82] text-white shadow-2xs'
                : 'text-[#5C5651] hover:text-[#2D2D2D] hover:bg-[#F4F1EE]'
            }`}
          >
            Completed ({reminders.filter(r => r.completed).length})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === 'all'
                ? 'bg-[#7C8B82] text-white shadow-2xs'
                : 'text-[#5C5651] hover:text-[#2D2D2D] hover:bg-[#F4F1EE]'
            }`}
          >
            All ({reminders.length})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#8A847E]" />
          <input
            type="text"
            placeholder="Search reminders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F4F1EE] border border-[#E5E1DD] rounded-lg text-[#2D2D2D] placeholder-[#8A847E] focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#7C8B82]"
          />
        </div>

      </div>

      {/* Reminders List */}
      <div className="space-y-3">
        {filteredReminders.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-[#E5E1DD] p-8 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#EEF2F0] text-[#7C8B82] flex items-center justify-center mx-auto">
              <CalendarDays className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-base font-bold text-[#2D2D2D]">
              {searchQuery ? 'No reminders match your search' : 'No reminders scheduled'}
            </h3>
            <p className="text-xs text-[#8A847E] max-w-sm mx-auto">
              Mention an upcoming date (e.g. "My project deadline is Friday") in Journal Chat, and the AI will offer to set a reminder.
            </p>
          </div>
        ) : (
          filteredReminders.map((rem) => {
            const diffDays = getDaysDiff(rem.dueDate);
            const isOverdue = diffDays < 0 && !rem.completed;
            const isToday = diffDays === 0;

            return (
              <div
                key={rem.id}
                className={`p-4 rounded-2xl bg-white border transition-all flex items-start justify-between group ${
                  rem.completed 
                    ? 'border-[#E5E1DD] opacity-60' 
                    : isOverdue 
                    ? 'border-rose-200 bg-rose-50/20' 
                    : 'border-[#E5E1DD] hover:border-[#7C8B82] shadow-xs'
                }`}
              >
                <div className="flex items-start space-x-3 flex-1 min-w-0 pr-4">
                  <button
                    onClick={() => handleToggle(rem.id, rem.completed)}
                    className="mt-0.5 text-[#8A847E] hover:text-[#7C8B82] transition-colors shrink-0 cursor-pointer"
                  >
                    {rem.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <Circle className="w-5 h-5 text-[#8A847E] hover:text-[#7C8B82]" />
                    )}
                  </button>

                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h3 className={`text-sm font-semibold truncate ${
                        rem.completed ? 'line-through text-[#8A847E]' : 'text-[#2D2D2D]'
                      }`}>
                        {rem.title}
                      </h3>
                      <span className="capitalize px-2 py-0.2 rounded text-[10px] font-medium bg-[#EEF2F0] text-[#5C5651] border border-[#E5E1DD]">
                        {rem.category}
                      </span>
                    </div>

                    {rem.notes && (
                      <p className="text-xs text-[#5C5651] font-sans">
                        {rem.notes}
                      </p>
                    )}

                    <div className="flex items-center space-x-3 text-xs text-[#8A847E] pt-1">
                      <span className="flex items-center space-x-1 font-medium text-[#5C5651]">
                        <Clock className="w-3 h-3 text-[#7C8B82]" />
                        <span>Due: {rem.dueDate} {rem.dueTime ? `at ${rem.dueTime}` : ''}</span>
                      </span>

                      {/* Countdown badge */}
                      {!rem.completed && (
                        <span className={`px-2 py-0.2 rounded text-[10px] font-bold ${
                          isOverdue 
                            ? 'bg-rose-100 text-rose-800' 
                            : isToday 
                            ? 'bg-[#EEF2F0] text-[#7C8B82] animate-pulse border border-[#7C8B82]/30' 
                            : 'bg-[#EEF2F0] text-[#5C5651] border border-[#E5E1DD]'
                        }`}>
                          {isOverdue 
                            ? `Overdue (${Math.abs(diffDays)}d ago)` 
                            : isToday 
                            ? 'Due Today' 
                            : `In ${diffDays} days`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setReminderToDelete(rem);
                  }}
                  disabled={isDeleting && reminderToDelete?.id === rem.id}
                  className="p-1.5 text-[#8A847E] hover:text-red-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  title="Delete reminder"
                  aria-label="Delete reminder"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      {isModalOpen && user && (
        <NewReminderModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={async (newRem) => {
            await saveSmartReminder(user.uid, newRem);
            await loadReminders();
            showToast('✓ Reminder added to your schedule');
          }}
          userId={user.uid}
        />
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={Boolean(reminderToDelete)}
        title="Delete this reminder?"
        description="Are you sure you want to delete this reminder? This will permanently remove it from your schedule and private database."
        itemSnippet={reminderToDelete ? `${reminderToDelete.title} (Due: ${reminderToDelete.dueDate})` : undefined}
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (!isDeleting) setReminderToDelete(null);
        }}
        deleteLabel="Delete"
        cancelLabel="Cancel"
      />

    </div>
  );
};
