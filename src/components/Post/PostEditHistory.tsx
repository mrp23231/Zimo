import * as React from 'react';
import { X, History } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../../lib/utils';

interface PostEdit {
  id: string;
  content: string;
  editedAt: Date;
  editorName: string;
}

interface PostEditHistoryProps {
  edits: PostEdit[];
  onClose: () => void;
  className?: string;
}

export const PostEditHistory: React.FC<PostEditHistoryProps> = ({
  edits,
  onClose,
  className
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 12, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 12, opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.18 }}
        onClick={(e) => e.stopPropagation()}
        className={cn("w-full max-w-md bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl p-5 shadow-xl max-h-[80vh] flex flex-col", className)}
      >
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <History size={20} className="text-blue-500" />
            <h3 className="font-bold text-lg">Edit History</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3">
          {edits.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">No edit history available</p>
          ) : (
            edits.map((edit, index) => (
              <div
                key={edit.id}
                className="p-3 rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/30"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-500">
                    {index === edits.length - 1 ? 'Current version' : `Version ${edits.length - index}`}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {formatDistanceToNow(edit.editedAt, { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {edit.content}
                </p>
                {edit.editorName && (
                  <p className="text-[10px] text-gray-400 mt-2">
                    Edited by {edit.editorName}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
