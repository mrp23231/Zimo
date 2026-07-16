import * as React from 'react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Medal, Award, TrendingUp, Users, X } from 'lucide-react';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface LeaderboardUser {
  uid: string;
  displayName: string;
  photoURL?: string;
  score: number;
  rank: number;
  postsCount: number;
  likesCount: number;
  commentsCount: number;
}

interface LeaderboardProps {
  isOpen: boolean;
  onClose: () => void;
  period: 'weekly' | 'monthly' | 'allTime';
}

const periodLabels = {
  weekly: 'This Week',
  monthly: 'This Month',
  allTime: 'All Time',
};

export const Leaderboard: React.FC<LeaderboardProps> = ({ isOpen, onClose, period = 'weekly' }) => {
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPeriod, setCurrentPeriod] = useState(period);

  useEffect(() => {
    if (!isOpen) return;

    const loadLeaderboard = async () => {
      setLoading(true);
      try {
        const now = new Date();
        let startDate: Date;

        if (currentPeriod === 'weekly') {
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (currentPeriod === 'monthly') {
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        } else {
          startDate = new Date(0);
        }

        const q = query(
          collection(db, 'users'),
          where('lastActive', '>=', startDate),
          orderBy('lastActive', 'desc'),
          limit(100)
        );

        const snapshot = await getDocs(q);
        const usersData = snapshot.docs.map((doc) => doc.data() as any);

        // Calculate scores based on activity
        const scoredUsers = usersData
          .map((user) => {
            const postsScore = (user.postsCount || 0) * 10;
            const likesScore = (user.likesReceived || 0) * 2;
            const commentsScore = (user.commentsCount || 0) * 5;
            const followersScore = (user.followersCount || 0) * 3;
            const totalScore = postsScore + likesScore + commentsScore + followersScore;

            return {
              uid: user.uid,
              displayName: user.displayName || 'Anonymous',
              photoURL: user.photoURL,
              score: totalScore,
              rank: 0,
              postsCount: user.postsCount || 0,
              likesCount: user.likesReceived || 0,
              commentsCount: user.commentsCount || 0,
            };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, 50)
          .map((user, index) => ({ ...user, rank: index + 1 }));

        setUsers(scoredUsers);
      } catch (error) {
        console.error('Error loading leaderboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadLeaderboard();
  }, [isOpen, currentPeriod]);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy size={20} className="text-yellow-500" />;
    if (rank === 2) return <Medal size={20} className="text-gray-400" />;
    if (rank === 3) return <Award size={20} className="text-amber-600" />;
    return <span className="text-sm font-medium text-gray-500">#{rank}</span>;
  };

  const getRankBg = (rank: number) => {
    if (rank === 1) return 'bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-200 dark:border-yellow-800';
    if (rank === 2) return 'bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800/50 dark:to-slate-800/50 border-gray-200 dark:border-gray-700';
    if (rank === 3) return 'bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-orange-200 dark:border-orange-800';
    return 'bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800';
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
            className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                  <Trophy size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Leaderboard</h2>
                  <p className="text-sm text-gray-500">Top active users</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Period Selector */}
            <div className="flex gap-2 p-4 border-b border-gray-100 dark:border-zinc-800">
              {(['weekly', 'monthly', 'allTime'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setCurrentPeriod(p)}
                  className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all ${
                    currentPeriod === p
                      ? 'bg-black dark:bg-white text-white dark:text-black'
                      : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200'
                  }`}
                >
                  {periodLabels[p]}
                </button>
              ))}
            </div>

            <div className="p-4 overflow-y-auto max-h-[50vh]">
              {loading ? (
                <div className="flex justify-center py-10">
                  <div className="w-6 h-6 border-2 border-black dark:border-white border-t-transparent animate-spin rounded-full" />
                </div>
              ) : users.length > 0 ? (
                <div className="space-y-2">
                  {users.map((user) => (
                    <motion.div
                      key={user.uid}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex items-center gap-3 p-3 rounded-2xl border ${getRankBg(user.rank)}`}
                    >
                      <div className="w-8 flex justify-center">
                        {getRankIcon(user.rank)}
                      </div>
                      <img
                        src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{user.displayName}</p>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <TrendingUp size={12} />
                            {user.postsCount} posts
                          </span>
                          <span>{user.likesCount} likes</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">{user.score.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">points</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <Users size={48} className="mx-auto text-gray-200 dark:text-zinc-800 mb-4" />
                  <p className="text-gray-500">No users yet. Be the first!</p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
