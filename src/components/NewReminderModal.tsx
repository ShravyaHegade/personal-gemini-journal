import React, { useState } from 'react';
import { X, Calendar, Clock, Plus } from 'lucide-react';
import { SmartReminder } from '../types';

interface NewReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (reminder: Omit<SmartReminder, 'id'>) => Promise<void>;
  userId: string;
}

export const NewReminderModal: React.FC<NewReminderModalProps> = ({
  isOpen,
  onClose,
  onSave,
  userId
}) => {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [category, setCategory] = useState<SmartReminder['category']>('deadline');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) return;

    setSaving(true);
    try {
      await onSave({
        userId,
        title: title.trim(),
        dueDate,
        dueTime: dueTime.trim() || undefined,
        category,
        notes: notes.trim() || '',
        completed: false,
        createdAt: Date.now()
      });
      setTitle('');
      setDueDate('');
      setDueTime('');
      setNotes('');
      onClose();
    } catch (err) {
      console.error('Failed to create reminder:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E5E1DD] space-y-4 animate-fade-in text-[#2D2D2D]">
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-[#EEF2F0] text-[#7C8B82] flex items-center justify-center">
              <Calendar className="w-4 h-4 text-[#7C8B82]" />
            </div>
            <h3 className="font-serif text-base font-bold text-[#2D2D2D]">Create Date Reminder</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[#8A847E] hover:text-[#2D2D2D] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-[#5C5651] mb-1">
              Reminder Title / Commitment
            </label>
            <input
              type="text"
              required
              placeholder="e.g., SQL Exam, Submit Ideathon pitch"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#F4F1EE] border border-[#E5E1DD] rounded-xl text-[#2D2D2D] placeholder-[#8A847E] focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#7C8B82]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#5C5651] mb-1">
                Due Date
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#F4F1EE] border border-[#E5E1DD] rounded-xl text-[#2D2D2D] focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#7C8B82]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5C5651] mb-1">
                Time (Optional)
              </label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#F4F1EE] border border-[#E5E1DD] rounded-xl text-[#2D2D2D] focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#7C8B82]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#5C5651] mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full px-3 py-2 text-xs bg-[#F4F1EE] border border-[#E5E1DD] rounded-xl text-[#2D2D2D] focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#7C8B82]"
            >
              <option value="deadline">Project Deadline</option>
              <option value="exam">Exam / Test</option>
              <option value="meeting">Meeting / Presentation</option>
              <option value="health">Health / Self-Care</option>
              <option value="personal">Personal Commitment</option>
              <option value="habit">Habit Check</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#5C5651] mb-1">
              Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g., Review chapter 4 & 5 before 2 PM"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#F4F1EE] border border-[#E5E1DD] rounded-xl text-[#2D2D2D] placeholder-[#8A847E] focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#7C8B82]"
            />
          </div>

          <div className="pt-2 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#5C5651] bg-[#F4F1EE] hover:bg-[#E5E1DD] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim() || !dueDate}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#7C8B82] hover:bg-[#64736A] transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Saving...' : 'Set Reminder'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
