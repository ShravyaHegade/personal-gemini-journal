import React, { useState } from 'react';
import { X, Brain, Plus } from 'lucide-react';
import { MemoryCategory, SmartMemory } from '../types';

interface NewMemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (memory: Omit<SmartMemory, 'id'>) => Promise<void>;
  userId: string;
}

export const NewMemoryModal: React.FC<NewMemoryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  userId
}) => {
  const [text, setText] = useState('');
  const [category, setCategory] = useState<MemoryCategory>('goal');
  const [relevantDate, setRelevantDate] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setSaving(true);
    try {
      await onSave({
        userId,
        text: text.trim(),
        category,
        relevantDate: relevantDate.trim() || null,
        createdAt: Date.now(),
        approvedByUser: true
      });
      setText('');
      setRelevantDate('');
      onClose();
    } catch (err) {
      console.error('Failed to create memory:', err);
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
              <Brain className="w-4 h-4 text-[#7C8B82]" />
            </div>
            <h3 className="font-serif text-base font-bold text-[#2D2D2D]">Add Approved Memory</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[#8A847E] hover:text-[#2D2D2D] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-[#5C5651] mb-1">
              Memory Detail / Fact / Goal
            </label>
            <textarea
              required
              rows={3}
              placeholder="e.g., Working on building a Gen AI Ideathon project with Cloud Run and Gemini."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#F4F1EE] border border-[#E5E1DD] rounded-xl text-[#2D2D2D] placeholder-[#8A847E] focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#7C8B82]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#5C5651] mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as MemoryCategory)}
                className="w-full px-3 py-2 text-xs bg-[#F4F1EE] border border-[#E5E1DD] rounded-xl text-[#2D2D2D] focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#7C8B82]"
              >
                <option value="goal">Goal</option>
                <option value="milestone">Milestone</option>
                <option value="preference">Preference</option>
                <option value="event">Event</option>
                <option value="task">Task</option>
                <option value="general">General Fact</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5C5651] mb-1">
                Relevant Date (Optional)
              </label>
              <input
                type="date"
                value={relevantDate}
                onChange={(e) => setRelevantDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#F4F1EE] border border-[#E5E1DD] rounded-xl text-[#2D2D2D] focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#7C8B82]"
              />
            </div>
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
              disabled={saving || !text.trim()}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#7C8B82] hover:bg-[#64736A] transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save to Memory Bank'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
