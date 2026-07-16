import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, BarChart3, Users, Globe, Clock, TrendingUp, Heart, MessageCircle } from 'lucide-react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface AudienceInsightsProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userPosts: any[];
}

interface InsightData {
  totalFollowers: number;
  totalFollowing: number;
  demographics: {
    ageGroups: { label: string; count: number; percentage: number }[];
    topCountries: { country: string; count: number }[];
  };
  activity: {
    bestPostingTime: string;
    bestPostingDay: string;
    hourlyActivity: { hour: number; count: number }[];
  };
  topPosts: {
    id: string;
    likes: number;
    comments: number;
    engagement: number;
  }[];
  growth: {
    weekly: number;
    monthly: number;
  };
}

export const AudienceInsights: React.FC<AudienceInsightsProps> = ({
  isOpen,
  onClose,
  userId,
  userPosts,
}) => {
  const [insights, setInsights] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    const loadInsights = async () => {
      setLoading(true);
      try {
        // Get followers count
        const followersQuery = query(
          collection(db, 'follows'),
          where('following', '==', userId)
        );
        const followersSnapshot = await getDocs(followersQuery);
        const totalFollowers = followersSnapshot.size;

        // Get following count
        const followingQuery = query(
          collection(db, 'follows'),
          where('follower', '==', userId)
        );
        const followingSnapshot = await getDocs(followingQuery);
        const totalFollowing = followingSnapshot.size;

        // Calculate post engagement
        const postsWithEngagement = userPosts.map((post) => ({
          id: post.id,
          likes: post.likes?.length || 0,
          comments: post.comments?.length || 0,
          engagement: (post.likes?.length || 0) + (post.comments?.length || 0) * 2,
        }));

        const topPosts = postsWithEngagement
          .sort((a, b) => b.engagement - a.engagement)
          .slice(0, 5);

        // Calculate best posting time (simplified)
        const hourlyActivity = Array.from({ length: 24 }, (_, i) => ({
          hour: i,
          count: Math.floor(Math.random() * 10),
        }));

        const bestHour = hourlyActivity.reduce((max, curr) =>
          curr.count > max.count ? curr : max
        );
        const bestPostingTime = `${bestHour.hour}:00`;
        const bestPostingDay = 'Wednesday';

        // Mock demographics (in real app, this would come from analytics)
        const demographics = {
          ageGroups: [
            { label: '13-17', count: 15, percentage: 10 },
            { label: '18-24', count: 45, percentage: 30 },
            { label: '25-34', count: 50, percentage: 33 },
            { label: '35-44', count: 25, percentage: 17 },
            { label: '45+', count: 15, percentage: 10 },
          ],
          topCountries: [
            { country: 'USA', count: 120 },
            { country: 'UK', count: 80 },
            { country: 'Germany', count: 60 },
            { country: 'France', count: 45 },
            { country: 'Other', count: 95 },
          ],
        };

        setInsights({
          totalFollowers,
          totalFollowing,
          demographics,
          activity: {
            bestPostingTime,
            bestPostingDay,
            hourlyActivity,
          },
          topPosts,
          growth: {
            weekly: Math.floor(Math.random() * 20) - 5,
            monthly: Math.floor(Math.random() * 50) - 10,
          },
        });
      } catch (error) {
        console.error('Error loading insights:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInsights();
  }, [isOpen, userId, userPosts]);

  const StatCard = ({ icon: Icon, label, value, trend }: any) => (
    <div className="bg-gray-50 dark:bg-zinc-800 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className="text-gray-500" />
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {trend !== undefined && (
        <p className={`text-xs mt-1 ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {trend >= 0 ? '+' : ''}{trend}% this period
        </p>
      )}
    </div>
  );

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
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                  <BarChart3 size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Audience Insights</h2>
                  <p className="text-sm text-gray-500">Understand your audience</p>
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
              {loading ? (
                <div className="flex justify-center py-10">
                  <div className="w-6 h-6 border-2 border-black dark:border-white border-t-transparent animate-spin rounded-full" />
                </div>
              ) : insights ? (
                <div className="space-y-6">
                  {/* Overview Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <StatCard
                      icon={Users}
                      label="Followers"
                      value={insights.totalFollowers}
                      trend={insights.growth.weekly}
                    />
                    <StatCard
                      icon={Heart}
                      label="Total Likes"
                      value={userPosts.reduce((sum, p) => sum + (p.likes?.length || 0), 0)}
                    />
                    <StatCard
                      icon={MessageCircle}
                      label="Comments"
                      value={userPosts.reduce((sum, p) => sum + (p.comments?.length || 0), 0)}
                    />
                    <StatCard
                      icon={TrendingUp}
                      label="Engagement"
                      value={`${((insights.totalFollowers > 0 ? (userPosts.reduce((sum, p) => sum + (p.likes?.length || 0) + (p.comments?.length || 0), 0) / insights.totalFollowers) * 100 : 0)).toFixed(1)}%`}
                    />
                  </div>

                  {/* Best Posting Time */}
                  <div className="bg-gray-50 dark:bg-zinc-800 rounded-2xl p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Clock size={16} />
                      Best Time to Post
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Your audience is most active on <strong>{insights.activity.bestPostingDay}</strong> at <strong>{insights.activity.bestPostingTime}</strong>
                    </p>
                  </div>

                  {/* Demographics */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-gray-50 dark:bg-zinc-800 rounded-2xl p-4">
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Users size={16} />
                        Age Groups
                      </h3>
                      <div className="space-y-2">
                        {insights.demographics.ageGroups.map((group) => (
                          <div key={group.label} className="flex items-center gap-2">
                            <span className="text-sm w-12">{group.label}</span>
                            <div className="flex-1 bg-gray-200 dark:bg-zinc-700 rounded-full h-2">
                              <div
                                className="bg-black dark:bg-white rounded-full h-2"
                                style={{ width: `${group.percentage}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 w-12 text-right">{group.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-zinc-800 rounded-2xl p-4">
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Globe size={16} />
                        Top Countries
                      </h3>
                      <div className="space-y-2">
                        {insights.demographics.topCountries.map((country) => (
                          <div key={country.country} className="flex items-center justify-between">
                            <span className="text-sm">{country.country}</span>
                            <span className="text-sm font-medium">{country.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Top Posts */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <TrendingUp size={16} />
                      Top Performing Posts
                    </h3>
                    <div className="space-y-2">
                      {insights.topPosts.map((post, index) => (
                        <div
                          key={post.id}
                          className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-zinc-800 rounded-xl"
                        >
                          <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
                          <div className="flex-1">
                            <p className="text-sm font-medium">Post {post.id.slice(0, 8)}</p>
                            <div className="flex gap-3 text-xs text-gray-500">
                              <span>{post.likes} likes</span>
                              <span>{post.comments} comments</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{post.engagement}</p>
                            <p className="text-xs text-gray-500">engagement</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10">
                  <BarChart3 size={48} className="mx-auto text-gray-200 dark:text-zinc-800 mb-4" />
                  <p className="text-gray-500">No insights available yet</p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
