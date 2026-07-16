import React, { useState } from 'react';
import { Flag, X, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface PostReportProps {
  postId: string;
  onClose: () => void;
  onSubmit?: (reason: string) => void;
  className?: string;
}

const REPORT_REASONS = [
  { id: 'spam', label: 'Spam', description: 'Repetitive or unwanted content' },
  { id: 'harassment', label: 'Harassment', description: 'Bullying or abusive behavior' },
  { id: 'hate', label: 'Hate Speech', description: 'Discriminatory or hateful content' },
  { id: 'violence', label: 'Violence', description: 'Threats or violent content' },
  { id: 'misinformation', label: 'Misinformation', description: 'False or misleading information' },
  { id: 'other', label: 'Other', description: 'Other policy violation' },
];

export const PostReport: React.FC<PostReportProps> = ({
  postId,
  onClose,
  onSubmit,
  className
}) => {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!selectedReason) return;
    setSubmitted(true);
    onSubmit?.(selectedReason);
    setTimeout(onClose, 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 20, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className={cn('w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden', className)}
      >
        <div className="p-4 border-b dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flag size={20} className="text-red-500" />
            <h3 className="font-bold text-lg">Report Post</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4">
          {!submitted ? (
            <>
              <div className="flex items-start gap-3 mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
                <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Please select a reason for reporting this post. Our team will review it as soon as possible.
                </p>
              </div>

              <div className="space-y-2">
                {REPORT_REASONS.map((reason) => (
                  <button
                    key={reason.id}
                    onClick={() => setSelectedReason(reason.id)}
                    className={cn(
                      'w-full text-left p-3 rounded-xl border transition-colors',
                      selectedReason === reason.id
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                        : 'border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800'
                    )}
                  >
                    <div className="font-medium text-sm">{reason.label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{reason.description}</div>
                  </button>
                ))}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!selectedReason}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Submit Report
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                <Flag size={24} className="text-green-600" />
              </div>
              <h4 className="font-bold text-lg mb-2">Report Submitted</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Thank you for helping keep our community safe. We will review this post shortly.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
