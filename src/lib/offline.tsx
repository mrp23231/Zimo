import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

export type QueuedAction = {
  id: string;
  type: "create_post" | "like" | "comment" | "follow" | "delete_post" | "update_profile";
  data: any;
  timestamp: number;
  retryCount: number;
};

interface OfflineContextType {
  isOnline: boolean;
  queue: QueuedAction[];
  queueSize: number;
  addToQueue: (action: Omit<QueuedAction, "id" | "timestamp" | "retryCount">) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  syncQueue: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | null>(null);

export const OfflineProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queue, setQueue] = useState<QueuedAction[]>([]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const saved = localStorage.getItem("offlineQueue");
    if (saved) {
      try {
        setQueue(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse offline queue:", e);
      }
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("offlineQueue", JSON.stringify(queue));
  }, [queue]);

  const addToQueue = useCallback((action: Omit<QueuedAction, "id" | "timestamp" | "retryCount">) => {
    const newAction: QueuedAction = {
      ...action,
      id: Date.now() + "_" + Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      retryCount: 0,
    };
    setQueue(prev => [...prev, newAction]);
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    setQueue(prev => prev.filter(action => action.id !== id));
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  const syncQueue = useCallback(async () => {
    if (!isOnline || queue.length === 0) return;

    const actionsToSync = [...queue];
    const successIds: string[] = [];

    for (const action of actionsToSync) {
      try {
        successIds.push(action.id);
      } catch (err) {
        console.error("Failed to sync action:", action.id, err);
      }
    }

    if (successIds.length > 0) {
      setQueue(prev => prev.filter(action => !successIds.includes(action.id)));
    }
  }, [isOnline, queue]);

  return (
    <OfflineContext.Provider value={{
      isOnline,
      queue,
      queueSize: queue.length,
      addToQueue,
      removeFromQueue,
      clearQueue,
      syncQueue,
    }}>
      {children}
    </OfflineContext.Provider>
  );
};

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error("useOffline must be used within OfflineProvider");
  }
  return context;
};
