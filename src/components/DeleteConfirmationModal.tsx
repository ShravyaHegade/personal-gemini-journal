import React, { useEffect } from 'react';
import { Trash2, AlertTriangle, Loader2, X } from 'lucide-react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  itemSnippet?: string;
  isDeleting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  deleteLabel?: string;
  cancelLabel?: string;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  title,
  description = 'This action will permanently remove this item from your private journal database. It cannot be recovered.',
  itemSnippet,
  isDeleting = false,
  onConfirm,
  onCancel,
  deleteLabel = 'Delete',
  cancelLabel = 'Cancel'
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) {
        onCancel();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDeleting, onCancel]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      onClick={() => {
        if (!isDeleting) onCancel();
      }}
    >
      <div 
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E5E1DD] space-y-5 text-[#2D2D2D]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 id="delete-dialog-title" className="font-serif text-lg font-bold text-[#2D2D2D]">
                {title}
              </h3>
              <p className="text-xs text-[#8A847E]">
                Permanent action
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="p-1 rounded-lg text-[#8A847E] hover:text-[#2D2D2D] hover:bg-[#F4F1EE] transition-colors disabled:opacity-50 cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Description / Content */}
        <div className="space-y-3">
          <p className="text-xs sm:text-sm text-[#5C5651] font-sans leading-relaxed">
            {description}
          </p>

          {itemSnippet && (
            <div className="p-3 bg-[#F4F1EE]/80 rounded-xl border border-[#E5E1DD] text-xs font-serif italic text-[#2D2D2D] max-h-24 overflow-y-auto line-clamp-3">
              "{itemSnippet}"
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-[#5C5651] hover:text-[#2D2D2D] hover:bg-[#F4F1EE] border border-[#E5E1DD] transition-all disabled:opacity-50 cursor-pointer"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 transition-all shadow-xs flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleteLabel}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
