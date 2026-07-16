import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";

export type QueuedAction = {
  id: string;
  type: "create_post" | "like" | "comment" | "follow" | "delete_post" | "update_profile";
  data: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
};

type OfflineContextType = {
  isOnline: boolean;
  queue: QueuedAction[];
  queueSize: number;
  addToQueue: (action: Omit<QueuedAction, "id" | "timestamp" | "retryCount">) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  syncQueue: () => Promise<void>;
};

const OfflineContext = createContext<OfflineContextType | null>(null);

const STORAGE_KEY = "offlineQueue";

export const OfflineProvider: React.FC<{
  children: ReactNode;
  onSyncAction: (action: QueuedAction) => Promise<void>;
}> = ({ children, onSyncAction }) => {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [queue, setQueue] = useState<QueuedAction[]>([]);
  const onSyncRef = useRef(onSyncAction);
  const syncingRef = useRef(false);

  onSyncRef.current = onSyncAction;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setQueue(JSON.parse(saved));
    } catch (e) {
      console.error("Failed to parse offline queue:", e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.error("Failed to save offline queue:", e);
    }
  }, [queue]);

  const syncQueue = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    if (syncingRef.current) return;

    setQueue((current) => {
      if (current.length === 0) return current;
      return current;
    });

    const snapshot = await new Promise<QueuedAction[]>((resolve) => {
      setQueue((current) => {
        resolve([...current]);
        return current;
      });
    });

    if (snapshot.length === 0) return;

    syncingRef.current = true;
    const successIds: string[] = [];

    for (const action of snapshot) {
      try {
        await onSyncRef.current(action);
        successIds.push(action.id);
      } catch (err) {
        console.error("Failed to sync action:", action.id, err);
      }
    }

    if (successIds.length > 0) {
      setQueue((prev) => prev.filter((a) => !successIds.includes(a.id)));
    }
    syncingRef.current = false;
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void syncQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const interval = window.setInterval(() => {
      if (!navigator.onLine) setIsOnline(false);
    }, 5000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.clearInterval(interval);
    };
  }, [syncQueue]);

  useEffect(() => {
    if (isOnline && queue.length > 0) {
      void syncQueue();
    }
  }, [isOnline, queue.length, syncQueue]);

  const addToQueue = useCallback(
    (action: Omit<QueuedAction, "id" | "timestamp" | "retryCount">) => {
      const newAction: QueuedAction = {
        ...action,
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
        timestamp: Date.now(),
        retryCount: 0,
      };
      setQueue((prev) => [...prev, newAction]);
    },
    []
  );

  const removeFromQueue = useCallback((id: string) => {
    setQueue((prev) => prev.filter((action) => action.id !== id));
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        queue,
        queueSize: queue.length,
        addToQueue,
        removeFromQueue,
        clearQueue,
        syncQueue,
      }}
    >
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

/** Safe hook when provider may be absent (returns online + no-op queue). */
export const useOfflineOptional = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    return {
      isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
      queue: [] as QueuedAction[],
      queueSize: 0,
      addToQueue: () => {},
      removeFromQueue: () => {},
      clearQueue: () => {},
      syncQueue: async () => {},
    };
  }
  return context;
};
