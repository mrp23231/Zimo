import React, { useState } from 'react';
import { Search, TrendingUp, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { TrendingHashtags } from './TrendingHashtags';
import { UserRecommendations } from './UserRecommendations';

interface ExplorePageProps {
  currentUserId: string;
  followingIds: string[];
  onFollow: (userId: string) => void;
  onUnfollow: (userId: string) => void;
  onViewProfile: (userId: string) => void;
  onSelectTag: (tag: string) => void;
  className?: string;
}

export const ExplorePage: React.FC<ExplorePageProps> = ({
  currentUserId,
  followingIds,
  onFollow,
  onUnfollow,
  onViewProfile,
  onSelectTag,
  className
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'trending' | 'users'>('trending');

  return (
    <div className={cn('max-w-2xl mx-auto', className)}>
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-zinc-800">
        <h1 className="text-xl font-bold text-center py-3">Explore</h1>

        <div className="px-4 pb-3">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search hashtags, users..."
              className="w-full bg-gray-100 dark:bg-zinc-800 border-0 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex border-b border-gray-200 dark:border-zinc-800">
          <button
            onClick={() => setActiveTab('trending')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors relative',
              activeTab === 'trending'
                ? 'text-blue-500'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            <TrendingUp size={18} />
            Trending
            {activeTab === 'trending' && (
              <motion.div
                layoutId="exploreTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
              />
            )}
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors relative',
              activeTab === 'users'
                ? 'text-blue-500'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            <Users size={18} />
            Who to Follow
            {activeTab === 'users' && (
              <motion.div
                layoutId="exploreTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
              />
            )}
          </button>
        </div>
      </div>

      <div className="p-4">
        {activeTab === 'trending' ? (
          <TrendingHashtags onSelectTag={onSelectTag} />
        ) : (
          <UserRecommendations
            currentUserId={currentUserId}
            followingIds={followingIds}
            onFollow={onFollow}
            onUnfollow={onUnfollow}
            onViewProfile={onViewProfile}
          />
        )}
      </div>
    </div>
  );
};
