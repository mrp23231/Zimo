import React, { useState, useEffect } from 'react';
import { UserPlus, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface User {
  id: string;
  displayName: string;
  photoURL: string;
  bio?: string;
  isVerified?: boolean;
}

interface UserRecommendationsProps {
  currentUserId: string;
  followingIds: string[];
  onFollow: (userId: string) => void;
  onUnfollow: (userId: string) => void;
  onViewProfile: (userId: string) => void;
  className?: string;
}

export const UserRecommendations: React.FC<UserRecommendationsProps> = ({
  currentUserId,
  followingIds,
  onFollow,
  onUnfollow,
  onViewProfile,
  className
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real app, this would fetch from Firestore
    // For now, we'll use mock data
    const mockUsers: User[] = [
      {
        id: 'user1',
        displayName: 'Alice Johnson',
        photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice',
        bio: 'Photography enthusiast',
        isVerified: true
      },
      {
        id: 'user2',
        displayName: 'Bob Smith',
        photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob',
        bio: 'Travel blogger'
      },
      {
        id: 'user3',
        displayName: 'Carol White',
        photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Carol',
        bio: 'Food lover',
        isVerified: true
      }
    ];

    // Filter out current user and already followed users
    const filtered = mockUsers.filter(
      (u) => u.id !== currentUserId && !followingIds.includes(u.id)
    );

    setUsers(filtered);
    setLoading(false);
  }, [currentUserId, followingIds]);

  if (loading) {
    return (
      <div className={cn('space-y-3', className)}>
        <h3 className="font-bold text-lg">Who to Follow</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-zinc-800" />
              <div className="flex-1 space-y-1">
                <div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-24" />
                <div className="h-3 bg-gray-200 dark:bg-zinc-800 rounded w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (users.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-3', className)}>
      <h3 className="font-bold text-lg">Who to Follow</h3>
      <div className="space-y-3">
        <AnimatePresence>
          {users.map((user) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <button
                onClick={() => onViewProfile(user.id)}
                className="flex-shrink-0"
                aria-label={`View ${user.displayName}'s profile`}
              >
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  className="w-10 h-10 rounded-full object-cover"
                />
              </button>

              <div className="flex-1 min-w-0">
                <button
                  onClick={() => onViewProfile(user.id)}
                  className="flex items-center gap-1 font-semibold text-sm hover:underline truncate"
                >
                  {user.displayName}
                  {user.isVerified && (
                    <svg className="w-4 h-4 text-blue-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                  )}
                </button>
                {user.bio && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {user.bio}
                  </p>
                )}
              </div>

              <button
                onClick={() => onFollow(user.id)}
                className="flex-shrink-0 p-2 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                aria-label={`Follow ${user.displayName}`}
              >
                <UserPlus size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
