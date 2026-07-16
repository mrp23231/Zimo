import React, { useState, useEffect } from 'react';
import { TrendingUp, Hash } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface TrendingTopic {
  tag: string;
  posts: number;
  trend: 'up' | 'down' | 'stable';
}

interface TrendingHashtagsProps {
  onSelectTag?: (tag: string) => void;
  className?: string;
}

export const TrendingHashtags: React.FC<TrendingHashtagsProps> = ({
  onSelectTag,
  className
}) => {
  const [trending, setTrending] = useState<TrendingTopic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real app, this would fetch from Firestore
    // For now, we'll use mock data
    const mockTrending: TrendingTopic[] = [
      { tag: 'photography', posts: 1250, trend: 'up' },
      { tag: 'travel', posts: 980, trend: 'up' },
      { tag: 'foodie', posts: 850, trend: 'stable' },
      { tag: 'fitness', posts: 720, trend: 'up' },
      { tag: 'tech', posts: 650, trend: 'down' },
      { tag: 'art', posts: 540, trend: 'up' },
      { tag: 'music', posts: 480, trend: 'stable' },
      { tag: 'nature', posts: 420, trend: 'up' }
    ];

    setTrending(mockTrending);
    setLoading(false);
  }, []);

  const getTrendIcon = (trend: TrendingTopic['trend']) => {
    switch (trend) {
      case 'up':
        return <TrendingUp size={14} className="text-green-500" />;
      case 'down':
        return <TrendingUp size={14} className="text-red-500 rotate-180" />;
      default:
        return <div className="w-3.5 h-0.5 bg-gray-400 rounded-full" />;
    }
  };

  const formatPosts = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  if (loading) {
    return (
      <div className={cn('space-y-3', className)}>
        <h3 className="font-bold text-lg flex items-center gap-2">
          <TrendingUp size={20} className="text-orange-500" />
          Trending
        </h3>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-zinc-800" />
              <div className="flex-1 space-y-1">
                <div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-20" />
                <div className="h-3 bg-gray-200 dark:bg-zinc-800 rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <h3 className="font-bold text-lg flex items-center gap-2">
        <TrendingUp size={20} className="text-orange-500" />
        Trending
      </h3>

      <div className="space-y-1">
        {trending.map((topic, index) => (
          <motion.button
            key={topic.tag}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onSelectTag?.(topic.tag)}
            className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors text-left group"
          >
            <span className="w-6 text-center text-sm font-bold text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300">
              {index + 1}
            </span>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <Hash size={14} className="text-gray-400 flex-shrink-0" />
                <span className="font-semibold text-sm truncate">
                  {topic.tag}
                </span>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatPosts(topic.posts)} posts
              </span>
            </div>

            <div className="flex-shrink-0">
              {getTrendIcon(topic.trend)}
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};
