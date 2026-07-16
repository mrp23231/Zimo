import React, { useState, useEffect } from 'react';
import { Bookmark, BookmarkCheck, Trash2, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface SavedPost {
  id: string;
  content: string;
  authorName: string;
  authorPhoto: string;
  savedAt: number;
}

interface ReadingListProps {
  posts: SavedPost[];
  onViewPost: (postId: string) => void;
  onUnsave: (postId: string) => void;
  className?: string;
}

export const ReadingList: React.FC<ReadingListProps> = ({
  posts,
  onViewPost,
  onUnsave,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short'
    });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          'relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors',
          className
        )}
        aria-label="Reading list"
      >
        <BookmarkCheck size={20} className="text-gray-600 dark:text-gray-400" />
        {posts.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {posts.length}
          </span>
        )}
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
              className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl max-h-[80vh] flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-zinc-800">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <BookmarkCheck size={20} className="text-blue-500" />
                  Список для чтения
                </h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                  aria-label="Close"
                >
                  <ExternalLink size={18} className="rotate-45" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <AnimatePresence>
                  {posts.map((post) => (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="p-3 rounded-xl border border-gray-100 dark:border-zinc-800 hover:border-blue-200 dark:hover:border-blue-800 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <img
                          src={post.authorPhoto}
                          alt={post.authorName}
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-sm truncate">
                              {post.authorName}
                            </span>
                            <button
                              onClick={() => onUnsave(post.id)}
                              className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 text-red-500 transition-colors flex-shrink-0"
                              aria-label="Remove from reading list"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <p
                            className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mt-1 cursor-pointer hover:underline"
                            onClick={() => {
                              onViewPost(post.id);
                              setIsOpen(false);
                            }}
                          >
                            {post.content}
                          </p>
                          <span className="text-[10px] text-gray-400 mt-1 block">
                            {formatDate(post.savedAt)}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {posts.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    <Bookmark size={48} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Список для чтения пуст</p>
                    <p className="text-xs mt-1">Сохраняйте посты, чтобы читать их позже</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
