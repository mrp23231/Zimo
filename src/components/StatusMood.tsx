import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Smile, Coffee, Plane, Briefcase, Heart, Star, Zap } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface UserStatus {
  text: string;
  emoji: string;
  expiresAt?: number;
}

const presetStatuses: { text: string; emoji: string }[] = [
  { text: 'Available', emoji: '🟢' },
  { text: 'Busy', emoji: '🔴' },
  { text: 'In a meeting', emoji: '📅' },
  { text: 'Working', emoji: '💼' },
  { text: 'Traveling', emoji: '✈️' },
  { text: 'On vacation', emoji: '🏖️' },
  { text: 'Studying', emoji: '📚' },
  { text: 'Gaming', emoji: '🎮' },
  { text: 'At the gym', emoji: '💪' },
  { text: 'Cooking', emoji: '👨‍🍳' },
  { text: 'Sleeping', emoji: '😴' },
  { text: 'Listening to music', emoji: '🎵' },
];

const emojiOptions = ['😀', '😂', '🥰', '😎', '🤔', '😴', '🤗', '😇', '🥳', '😋', '🤓', '🧐'];

interface StatusMoodProps {
  isOpen: boolean;
  onClose: () => void;
  currentStatus?: UserStatus;
  onStatusChange: (status: UserStatus | null) => void;
  userId: string;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const StatusMood: React.FC<StatusMoodProps> = ({
  isOpen,
  onClose,
  currentStatus,
  onStatusChange,
  userId,
  showToast,
}) => {
  const [selectedText, setSelectedText] = useState(currentStatus?.text || '');
  const [selectedEmoji, setSelectedEmoji] = useState(currentStatus?.emoji || '😀');
  const [customText, setCustomText] = useState('');
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiryHours, setExpiryHours] = useState(24);

  useEffect(() => {
    if (currentStatus) {
      setSelectedText(currentStatus.text);
      setSelectedEmoji(currentStatus.emoji);
    }
  }, [currentStatus]);

  const handleSave = async () => {
    const text = customText || selectedText;
    if (!text) {
      showToast('Please select or enter a status', 'error');
      return;
    }

    try {
      const statusData: any = {
        text,
        emoji: selectedEmoji,
        updatedAt: serverTimestamp(),
      };

      if (hasExpiry) {
        statusData.expiresAt = Date.now() + expiryHours * 60 * 60 * 1000;
      }

      await updateDoc(doc(db, 'users', userId), {
        status: statusData,
      });

      onStatusChange({
        text,
        emoji: selectedEmoji,
        expiresAt: statusData.expiresAt,
      });

      showToast('Status updated!', 'success');
      onClose();
    } catch (error) {
      console.error('Error updating status:', error);
      showToast('Failed to update status', 'error');
    }
  };

  const handleClear = async () => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        status: null,
      });
      onStatusChange(null as any);
      showToast('Status cleared', 'success');
      onClose();
    } catch (error) {
      console.error('Error clearing status:', error);
      showToast('Failed to clear status', 'error');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                  <Smile size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Set Status</h2>
                  <p className="text-sm text-gray-500">Let others know what you're up to</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
              {/* Current Status Preview */}
              {(selectedText || customText) && (
                <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-zinc-800 rounded-2xl">
                  <span className="text-3xl">{selectedEmoji}</span>
                  <div>
                    <p className="font-medium">{customText || selectedText}</p>
                    {hasExpiry && (
                      <p className="text-xs text-gray-500">Expires in {expiryHours}h</p>
                    )}
                  </div>
                </div>
              )}

              {/* Emoji Picker */}
              <div>
                <label className="block text-sm font-medium mb-2">Choose Emoji</label>
                <div className="flex flex-wrap gap-2">
                  {emojiOptions.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => setSelectedEmoji(emoji)}
                      className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${
                        selectedEmoji === emoji
                          ? 'bg-black dark:bg-white text-white dark:text-black scale-110'
                          : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preset Statuses */}
              <div>
                <label className="block text-sm font-medium mb-2">Quick Status</label>
                <div className="flex flex-wrap gap-2">
                  {presetStatuses.map((preset) => (
                    <button
                      key={preset.text}
                      onClick={() => {
                        setSelectedText(preset.text);
                        setSelectedEmoji(preset.emoji);
                        setCustomText('');
                      }}
                      className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                        selectedText === preset.text && !customText
                          ? 'bg-black dark:bg-white text-white dark:text-black'
                          : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200'
                      }`}
                    >
                      {preset.emoji} {preset.text}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Status */}
              <div>
                <label className="block text-sm font-medium mb-2">Custom Status</label>
                <input
                  type="text"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="What's on your mind?"
                  maxLength={50}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent outline-none transition-all"
                />
              </div>

              {/* Expiry Options */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasExpiry}
                    onChange={(e) => setHasExpiry(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-sm">Set expiration time</span>
                </label>
                {hasExpiry && (
                  <select
                    value={expiryHours}
                    onChange={(e) => setExpiryHours(Number(e.target.value))}
                    className="mt-2 w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                  >
                    <option value={1}>1 hour</option>
                    <option value={4}>4 hours</option>
                    <option value={8}>8 hours</option>
                    <option value={24}>24 hours</option>
                    <option value={72}>3 days</option>
                    <option value={168}>1 week</option>
                  </select>
                )}
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-100 dark:border-zinc-800">
              {currentStatus && (
                <button
                  onClick={handleClear}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Clear
                </button>
              )}
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-3 rounded-xl bg-black dark:bg-white text-white dark:text-black font-medium hover:opacity-90 transition-opacity"
              >
                Save Status
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
