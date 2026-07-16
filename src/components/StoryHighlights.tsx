import React, { useState } from 'react';
import { Star, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface StoryHighlight {
  id: string;
  title: string;
  coverUrl: string;
  storyIds: string[];
}

interface StoryHighlightsProps {
  highlights: StoryHighlight[];
  onAdd?: () => void;
  onSelect?: (highlight: StoryHighlight) => void;
  className?: string;
}

export const StoryHighlights: React.FC<StoryHighlightsProps> = ({
  highlights,
  onAdd,
  onSelect,
  className
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    onAdd?.();
    setNewTitle('');
    setShowAddModal(false);
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Star size={20} className="text-yellow-500" />
          Story Highlights
        </h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Add highlight"
        >
          <Plus size={20} className="text-gray-500" />
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {highlights.map((highlight) => (
          <button
            key={highlight.id}
            onClick={() => onSelect?.(highlight)}
            className="flex-shrink-0 flex flex-col items-center gap-1.5 group"
          >
            <div className="w-20 h-20 rounded-full p-0.5 bg-gradient-to-tr from-yellow-400 via-pink-500 to-violet-600">
              <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-zinc-900 p-0.5">
                <img
                  src={highlight.coverUrl}
                  alt={highlight.title}
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
            </div>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate w-20 text-center">
              {highlight.title}
            </span>
          </button>
        ))}

        {highlights.length === 0 && (
          <div className="flex-shrink-0 flex flex-col items-center justify-center w-20 h-20 rounded-full border-2 border-dashed border-gray-300 dark:border-zinc-700 text-gray-400">
            <Star size={24} className="mb-1" />
            <span className="text-xs">No highlights yet</span>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ y: 20, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">New Highlight</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>

              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Highlight title"
                maxLength={30}
                className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 mb-4"
                autoFocus
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={!newTitle.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-yellow-500 text-white hover:bg-yellow-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
