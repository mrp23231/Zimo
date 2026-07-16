import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, Image as ImageIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface GifPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  apiKey?: string;
}

interface GifResult {
  id: string;
  url: string;
  previewUrl: string;
  title: string;
}

export const GifPicker: React.FC<GifPickerProps> = ({
  isOpen,
  onClose,
  onSelect,
  apiKey
}) => {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchGifs = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setGifs([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Try provided API key first, then fallback to public beta key
      const keys = [apiKey, 'dc6zaTOxFJmzC'].filter(Boolean);
      let lastError: any = null;

      for (const key of keys) {
        try {
          const response = await fetch(
            `https://api.giphy.com/v1/gifs/search?api_key=${key}&q=${encodeURIComponent(searchQuery)}&limit=20&rating=g`
          );

          if (response.ok) {
            const data = await response.json();
            const results: GifResult[] = (data.data || []).map((item: any) => ({
              id: item.id,
              url: item.images?.original?.url || item.images?.fixed_height?.url || '',
              previewUrl: item.images?.fixed_height_small?.url || item.images?.fixed_height?.url || '',
              title: item.title || 'GIF'
            }));
            setGifs(results);
            return;
          }

          lastError = new Error(`Giphy API error: ${response.status}`);
        } catch (e) {
          lastError = e;
        }
      }

      throw lastError || new Error('Failed to fetch GIFs');
    } catch (err) {
      setError('GIF search is temporarily unavailable. Please try again later.');
      console.error('GIF search error:', err);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setGifs([]);
      setError(null);
      return;
    }

    const timeoutId = setTimeout(() => {
      searchGifs(query);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [isOpen, query, searchGifs]);

  const handleSelect = (url: string) => {
    onSelect(url);
    onClose();
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
        className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
      >
        <div className="p-4 border-b dark:border-zinc-800 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search GIFs..."
              className="w-full bg-gray-50 dark:bg-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!apiKey ? (
            <div className="text-center py-12 text-gray-400">
              <ImageIcon size={48} className="mx-auto mb-4 opacity-50" />
              <p>GIF search is not configured</p>
              <p className="text-xs mt-2">Add your Giphy API key to enable GIF search</p>
            </div>
          ) : loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-500">
              <p>{error}</p>
            </div>
          ) : gifs.length === 0 && query.trim() ? (
            <div className="text-center py-12 text-gray-400">
              <p>No GIFs found for "{query}"</p>
            </div>
          ) : gifs.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <ImageIcon size={48} className="mx-auto mb-4 opacity-50" />
              <p>Search for GIFs to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {gifs.map((gif) => (
                <button
                  key={gif.id}
                  onClick={() => handleSelect(gif.url)}
                  className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-zinc-800 hover:ring-2 hover:ring-blue-500 transition-all group"
                >
                  <img
                    src={gif.previewUrl}
                    alt={gif.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
