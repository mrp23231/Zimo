import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { enableWebPush, disableWebPush } from '../lib/push';
import { app, db } from '../lib/firebase';

interface PushNotificationsProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  userId?: string;
  className?: string;
}

export const PushNotifications: React.FC<PushNotificationsProps> = ({
  enabled,
  onToggle,
  userId,
  className
}) => {
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const handleToggle = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      if (enabled) {
        await disableWebPush({ db: db as any, userUid: userId });
        onToggle(false);
      } else {
        const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';
        const result = await enableWebPush({
          app: app as any,
          db: db as any,
          userUid: userId,
          vapidKey
        });
        if (result.ok) {
          setPermission('granted');
          onToggle(true);
        } else {
          setPermission(Notification.permission);
        }
      }
    } catch (err) {
      console.error('Push notification toggle failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusText = () => {
    if (permission === 'granted') return enabled ? 'Notifications enabled' : 'Notifications disabled';
    if (permission === 'denied') return 'Notifications blocked';
    return 'Click to enable notifications';
  };

  return (
    <div className={cn('flex items-center justify-between p-4 border dark:border-zinc-800 rounded-xl', className)}>
      <div className="flex items-center gap-3">
        <div className={cn(
          'p-2 rounded-full',
          enabled ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'bg-gray-100 dark:bg-zinc-800 text-gray-400'
        )}>
          {enabled ? <Bell size={20} /> : <BellOff size={20} />}
        </div>
        <div>
          <div className="font-medium text-sm">Push Notifications</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{getStatusText()}</div>
        </div>
      </div>

      <button
        onClick={handleToggle}
        disabled={loading || permission === 'denied'}
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
          enabled ? 'bg-blue-500' : 'bg-gray-200 dark:bg-zinc-700',
          (loading || permission === 'denied') && 'opacity-50 cursor-not-allowed'
        )}
        aria-label={enabled ? 'Disable notifications' : 'Enable notifications'}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
            enabled ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
    </div>
  );
};
