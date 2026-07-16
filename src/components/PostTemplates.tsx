import React, { useState } from 'react';
import { FileText, Plus, X, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface PostTemplate {
  id: string;
  title: string;
  content: string;
  createdAt: number;
}

interface PostTemplatesProps {
  templates: PostTemplate[];
  onSelect: (template: PostTemplate) => void;
  onSave: (template: Omit<PostTemplate, 'id' | 'createdAt'>) => void;
  onDelete: (id: string) => void;
  className?: string;
}

export const PostTemplates: React.FC<PostTemplatesProps> = ({
  templates,
  onSelect,
  onSave,
  onDelete,
  className
}) => {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  const handleSave = () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    onSave({
      title: newTitle.trim(),
      content: newContent.trim()
    });
    setNewTitle('');
    setNewContent('');
    setShowSaveModal(false);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short'
    });
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <FileText size={20} className="text-purple-500" />
          Шаблоны постов
        </h3>
        <button
          onClick={() => setShowSaveModal(true)}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Save template"
        >
          <Plus size={20} className="text-gray-500" />
        </button>
      </div>

      <div className="space-y-2">
        <AnimatePresence>
          {templates.map((template) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="group relative p-3 rounded-xl border border-gray-100 dark:border-zinc-800 hover:border-purple-200 dark:hover:border-purple-800 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-all cursor-pointer"
              onClick={() => onSelect(template)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm truncate">{template.title}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
                    {template.content}
                  </p>
                  <span className="text-[10px] text-gray-400 mt-1 block">
                    {formatDate(template.createdAt)}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(template.id);
                  }}
                  className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-500 transition-all"
                  aria-label="Delete template"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {templates.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            Нет сохранённых шаблонов
          </div>
        )}
      </div>

      <AnimatePresence>
        {showSaveModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowSaveModal(false)}
          >
            <motion.div
              initial={{ y: 20, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">Сохранить шаблон</h3>
                <button
                  onClick={() => setShowSaveModal(false)}
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
                placeholder="Название шаблона"
                maxLength={50}
                className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 mb-3"
                autoFocus
              />

              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Содержание шаблона..."
                maxLength={500}
                rows={4}
                className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4 resize-none"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSave}
                  disabled={!newTitle.trim() || !newContent.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-purple-500 text-white hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Сохранить
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
