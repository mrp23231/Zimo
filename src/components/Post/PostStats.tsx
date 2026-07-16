import * as React from 'react';
import { BarChart2, Eye, Heart, MessageCircle, Share2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface PostStatsProps {
  views: number;
  likes: number;
  comments: number;
  reposts: number;
  className?: string;
}

export const PostStats: React.FC<PostStatsProps> = ({ 
  views, 
  likes, 
  comments, 
  reposts, 
  className 
}) => {
  return (
    <div className={cn("flex items-center justify-between text-xs text-gray-500 dark:text-gray-400", className)}>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <Eye size={14} />
          <span>{views.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1">
          <Heart size={14} />
          <span>{likes.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1">
          <MessageCircle size={14} />
          <span>{comments.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1">
          <Share2 size={14} />
          <span>{reposts.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};

// Hook for tracking post views
export const usePostViewTracking = (postId: string | undefined) => {
  React.useEffect(() => {
    if (!postId) return;
    
    const trackView = async () => {
      try {
        // View tracking is handled in App.tsx via safeViewIncrement
        // This hook is for future analytics integration
      } catch (error) {
        console.error('Failed to track view:', error);
      }
    };
    
    // Track view after 2 seconds of viewing
    const timer = setTimeout(trackView, 2000);
    return () => clearTimeout(timer);
  }, [postId]);
};