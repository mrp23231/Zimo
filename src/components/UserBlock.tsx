import React, { useState } from 'react';
import { UserX, UserCheck, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface UserBlockProps {
  isBlocked?: boolean;
  onBlock?: () => void;
  onUnblock?: () => void;
  className?: string;
}

export const UserBlock: React.FC<UserBlockProps> = ({
  isBlocked = false,
  onBlock,
  onUnblock,
  className
}) => {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleAction = () => {
    if (isBlocked) {
      onUnblock?.();
    } else {
      setShowConfirm(true);
    }
  };

  const confirmBlock = () => {
    onBlock?.();
    setShowConfirm(false);
  };

  return (
    <>
      <button
        onClick={handleAction}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
          isBlocked
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
        )}
      >
        {isBlocked ? (
          <>
            <UserCheck size={16} />
            Unblock User
          </>
        ) : (
          <>
            <UserX size={16} />
            Block User
          </>
        )}
      </button>

      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowConfirm(false)}
          >
            <motion.div
              initial={{ y: 20, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600">
                  <AlertTriangle size={24} />
                </div>
                <h3 className="font-bold text-lg">Block User?</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
                This will prevent them from seeing your posts and messaging you. You can unblock them anytime.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmBlock}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  Block
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
