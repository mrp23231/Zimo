import React, { useState, useEffect } from 'react';
import { FileText, Trash2, Clock, Edit3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface Draft {
  id: string;
  text: string;
  imageUrl?: string;
  gifUrl?: string;
  poll?: any;
  createdAt: number;
}

interface DraftsProps {
  drafts: Draft[];
  onSelect: (draft: Draft) => void;
  onDelete: (id: string) => void;
  className?: string;
}

export const Drafts: React.FC<DraftsProps> = ({ drafts, onSelect, onDelete, className }) => {
  const [isOpen, setIsOpen] = useState(false);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  if (drafts.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
          'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
        )}
      >
        <FileText size={16} />
        Drafts ({drafts.length})
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ y: 20, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className={cn('w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden', className)}
            >
              <div className="p-4 border-b dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText size={20} className="text-blue-500" />
                  <h3 className="font-bold text-lg">Your Drafts</h3>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                  aria-label="Close"
                >
                  <Edit3 size={20} />
                </button>
              </div>

              <div className="p-4 max-h-[60vh] overflow-y-auto">
                <div className="space-y-3">
                  {drafts.map((draft) => (
                    <div
                      key={draft.id}
                      className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 dark:text-gray-100 line-clamp-2">
                          {draft.text || 'Empty draft'}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock size={12} className="text-gray-400" />
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(draft.createdAt)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { onSelect(draft); setIsOpen(false); }}
                          className="p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 transition-colors"
                          aria-label="Edit draft"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => onDelete(draft.id)}
                          className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 transition-colors"
                          aria-label="Delete draft"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
