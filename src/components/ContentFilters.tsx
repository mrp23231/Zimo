import React, { useState } from 'react';
import { Image, Film, FileText, Hash } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

type FilterType = 'all' | 'images' | 'videos' | 'text' | 'hashtags';

interface ContentFiltersProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  className?: string;
}

export const ContentFilters: React.FC<ContentFiltersProps> = ({
  activeFilter,
  onFilterChange,
  className
}) => {
  const filters: { id: FilterType; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: 'Все', icon: <Hash size={16} /> },
    { id: 'images', label: 'Фото', icon: <Image size={16} /> },
    { id: 'videos', label: 'Видео', icon: <Film size={16} /> },
    { id: 'text', label: 'Текст', icon: <FileText size={16} /> },
    { id: 'hashtags', label: 'Хэштеги', icon: <Hash size={16} /> }
  ];

  return (
    <div className={cn('flex items-center gap-1 p-1 bg-gray-100 dark:bg-zinc-800 rounded-xl', className)}>
      {filters.map((filter) => (
        <button
          key={filter.id}
          onClick={() => onFilterChange(filter.id)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
            activeFilter === filter.id
              ? 'bg-white dark:bg-zinc-700 text-black dark:text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          )}
        >
          {filter.icon}
          <span className="hidden sm:inline">{filter.label}</span>
        </button>
      ))}
    </div>
  );
};
