import * as React from 'react';
import { BarChart2, TrendingUp, Users, Heart, MessageCircle, Clock, Eye } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ProfileAnalyticsProps {
  totalPosts: number;
  totalFollowers: number;
  totalFollowing: number;
  weeklyGrowth: number;
  bestPostingTime: string;
  totalLikes?: number;
  totalComments?: number;
  engagementRate?: number;
  className?: string;
}

export const ProfileAnalytics: React.FC<ProfileAnalyticsProps> = ({
  totalPosts,
  totalFollowers,
  totalFollowing,
  weeklyGrowth,
  bestPostingTime,
  totalLikes = 0,
  totalComments = 0,
  engagementRate = 0,
  className
}) => {
  const growthColor = weeklyGrowth >= 0 ? 'text-green-500' : 'text-red-500';

  return (
    <div className={cn("bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-gray-100 dark:border-zinc-800", className)}>
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 size={20} className="text-blue-500" />
        <h3 className="font-bold text-lg">Аналитика</h3>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="text-center p-3 bg-gray-50 dark:bg-zinc-800 rounded-xl">
          <div className="text-2xl font-bold">{totalPosts}</div>
          <div className="text-xs text-gray-500">Постов</div>
        </div>
        
        <div className="text-center p-3 bg-gray-50 dark:bg-zinc-800 rounded-xl">
          <div className="text-2xl font-bold">{totalFollowers}</div>
          <div className="text-xs text-gray-500">Подписчиков</div>
        </div>
        
        <div className="text-center p-3 bg-gray-50 dark:bg-zinc-800 rounded-xl">
          <div className="text-2xl font-bold">{totalLikes}</div>
          <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
            <Heart size={12} className="text-red-400" />
            Лайков
          </div>
        </div>
        
        <div className="text-center p-3 bg-gray-50 dark:bg-zinc-800 rounded-xl">
          <div className="text-2xl font-bold">{totalComments}</div>
          <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
            <MessageCircle size={12} className="text-blue-400" />
            Комментариев
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="text-center p-3 bg-gray-50 dark:bg-zinc-800 rounded-xl">
          <div className={cn("text-2xl font-bold flex items-center justify-center gap-1", growthColor)}>
            <TrendingUp size={18} />
            {weeklyGrowth >= 0 ? '+' : ''}{weeklyGrowth}%
          </div>
          <div className="text-xs text-gray-500">Рост за неделю</div>
        </div>
        
        <div className="text-center p-3 bg-gray-50 dark:bg-zinc-800 rounded-xl">
          <div className="text-2xl font-bold">{engagementRate}</div>
          <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
            <Eye size={12} className="text-purple-400" />
            Вовлечённость
          </div>
        </div>
      </div>
      
      {bestPostingTime && (
        <div className="mt-4 pt-4 border-t dark:border-zinc-800">
          <div className="flex items-center gap-2 text-sm">
            <Clock size={16} className="text-amber-500" />
            <span className="text-gray-500">Лучшее время:</span>
            <span className="font-medium">{bestPostingTime}</span>
          </div>
        </div>
      )}
    </div>
  );
};