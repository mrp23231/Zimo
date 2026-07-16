import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Palette } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface ProfileTheme {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  preview: string;
}

const themes: ProfileTheme[] = [
  {
    id: 'default',
    name: 'Default',
    primaryColor: '#000000',
    secondaryColor: '#666666',
    backgroundColor: '#ffffff',
    textColor: '#000000',
    fontFamily: 'Inter, sans-serif',
    preview: 'Clean and minimal',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    primaryColor: '#0ea5e9',
    secondaryColor: '#6366f1',
    backgroundColor: '#f0f9ff',
    textColor: '#0c4a6e',
    fontFamily: 'Inter, sans-serif',
    preview: 'Calm blue tones',
  },
  {
    id: 'forest',
    name: 'Forest',
    primaryColor: '#16a34a',
    secondaryColor: '#84cc16',
    backgroundColor: '#f0fdf4',
    textColor: '#14532d',
    fontFamily: 'Inter, sans-serif',
    preview: 'Natural green vibes',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    primaryColor: '#f97316',
    secondaryColor: '#ef4444',
    backgroundColor: '#fff7ed',
    textColor: '#7c2d12',
    fontFamily: 'Inter, sans-serif',
    preview: 'Warm orange sunset',
  },
  {
    id: 'purple',
    name: 'Purple',
    primaryColor: '#a855f7',
    secondaryColor: '#ec4899',
    backgroundColor: '#faf5ff',
    textColor: '#581c87',
    fontFamily: 'Inter, sans-serif',
    preview: 'Creative purple',
  },
  {
    id: 'dark',
    name: 'Dark Mode',
    primaryColor: '#ffffff',
    secondaryColor: '#a1a1aa',
    backgroundColor: '#18181b',
    textColor: '#fafafa',
    fontFamily: 'Inter, sans-serif',
    preview: 'Easy on the eyes',
  },
  {
    id: 'elegant',
    name: 'Elegant',
    primaryColor: '#1c1917',
    secondaryColor: '#78716c',
    backgroundColor: '#fafaf9',
    textColor: '#1c1917',
    fontFamily: 'Georgia, serif',
    preview: 'Classic serif style',
  },
  {
    id: 'modern',
    name: 'Modern',
    primaryColor: '#3b82f6',
    secondaryColor: '#8b5cf6',
    backgroundColor: '#ffffff',
    textColor: '#1e293b',
    fontFamily: 'system-ui, sans-serif',
    preview: 'Bold and modern',
  },
];

interface ProfileThemesProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme?: string;
  onThemeChange: (theme: ProfileTheme) => void;
  userId: string;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const ProfileThemes: React.FC<ProfileThemesProps> = ({
  isOpen,
  onClose,
  currentTheme = 'default',
  onThemeChange,
  userId,
  showToast,
}) => {
  const handleSelectTheme = async (theme: ProfileTheme) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        profileTheme: theme.id,
        themeSettings: {
          primaryColor: theme.primaryColor,
          secondaryColor: theme.secondaryColor,
          backgroundColor: theme.backgroundColor,
          textColor: theme.textColor,
          fontFamily: theme.fontFamily,
        },
      });
      onThemeChange(theme);
      showToast('Theme applied!', 'success');
      onClose();
    } catch (error) {
      console.error('Error updating theme:', error);
      showToast('Failed to update theme', 'error');
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
            className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-violet-500 flex items-center justify-center">
                  <Palette size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Profile Theme</h2>
                  <p className="text-sm text-gray-500">Customize your profile appearance</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {themes.map((theme) => (
                  <motion.button
                    key={theme.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelectTheme(theme)}
                    className={`relative p-4 rounded-2xl border-2 transition-all ${
                      currentTheme === theme.id
                        ? 'border-black dark:border-white'
                        : 'border-gray-200 dark:border-zinc-700 hover:border-gray-300'
                    }`}
                    style={{
                      backgroundColor: theme.backgroundColor,
                      color: theme.textColor,
                      fontFamily: theme.fontFamily,
                    }}
                  >
                    {currentTheme === theme.id && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-black dark:bg-white rounded-full flex items-center justify-center">
                        <Check size={14} className="text-white dark:text-black" />
                      </div>
                    )}
                    <div className="space-y-2">
                      <div className="flex gap-1">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: theme.primaryColor }}
                        />
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: theme.secondaryColor }}
                        />
                      </div>
                      <h3 className="font-semibold text-sm">{theme.name}</h3>
                      <p className="text-xs opacity-70">{theme.preview}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
