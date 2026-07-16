import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cake, X, PartyPopper } from 'lucide-react';
import { collection, query, where, getDocs, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface BirthdayRemindersProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userBirthdate?: string;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

interface BirthdayUser {
  uid: string;
  displayName: string;
  photoURL?: string;
  birthdate: string;
  daysUntil: number;
}

const confettiColors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ff8800', '#88ff00'];

export const BirthdayReminders: React.FC<BirthdayRemindersProps> = ({
  isOpen,
  onClose,
  userId,
  userBirthdate,
  showToast,
}) => {
  const [birthdays, setBirthdays] = useState<BirthdayUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [celebratingUserId, setCelebratingUserId] = useState<string | null>(null);

  const loadBirthdays = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date();
      const todayMonth = today.getMonth();
      const todayDay = today.getDate();

      // Get followers
      const followersQuery = query(
        collection(db, 'follows'),
        where('follower', '==', userId)
      );
      const followersSnapshot = await getDocs(followersQuery);
      const followingUids = followersSnapshot.docs.map(d => d.data().following);

      // Get user profiles
      const usersQuery = query(
        collection(db, 'users'),
        where('uid', 'in', followingUids.slice(0, 10))
      );
      const usersSnapshot = await getDocs(usersQuery);

      const birthdayUsers: BirthdayUser[] = [];
      usersSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.birthdate) {
          const birthdate = new Date(data.birthdate);
          const birthMonth = birthdate.getMonth();
          const birthDay = birthdate.getDate();

          if (birthMonth === todayMonth && birthDay === todayDay) {
            birthdayUsers.push({
              uid: data.uid,
              displayName: data.displayName || 'Anonymous',
              photoURL: data.photoURL,
              birthdate: data.birthdate,
              daysUntil: 0,
            });
          } else {
            // Calculate days until birthday
            const thisYearBirthday = new Date(today.getFullYear(), birthMonth, birthDay);
            if (thisYearBirthday < today) {
              thisYearBirthday.setFullYear(today.getFullYear() + 1);
            }
            const daysUntil = Math.ceil((thisYearBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            if (daysUntil <= 7) {
              birthdayUsers.push({
                uid: data.uid,
                displayName: data.displayName || 'Anonymous',
                photoURL: data.photoURL,
                birthdate: data.birthdate,
                daysUntil,
              });
            }
          }
        }
      });

      // Sort by days until (0 = today)
      birthdayUsers.sort((a, b) => a.daysUntil - b.daysUntil);
      setBirthdays(birthdayUsers);
    } catch (error) {
      console.error('Error loading birthdays:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen) {
      loadBirthdays();
    }
  }, [isOpen, loadBirthdays]);

  const handleCelebrate = async (birthdayUser: BirthdayUser) => {
    setCelebratingUserId(birthdayUser.uid);
    setShowConfetti(true);

    // Send birthday notification
    try {
      await updateDoc(doc(db, 'users', birthdayUser.uid), {
        birthdayWishes: Array.isArray((await getDocs(collection(db, 'users', birthdayUser.uid, 'birthdayWishes'))).docs) 
          ? [] 
          : undefined,
      });

      // Create birthday wish notification
      const notificationRef = doc(collection(db, 'notifications'));
      await updateDoc(notificationRef, {
        toUid: birthdayUser.uid,
        fromUid: userId,
        type: 'birthday',
        message: `🎂 Happy Birthday! 🎂`,
        createdAt: serverTimestamp(),
        read: false,
      });

      showToast(`Sent birthday wishes to ${birthdayUser.displayName}!`, 'success');
    } catch (error) {
      console.error('Error sending birthday wish:', error);
    }

    setTimeout(() => {
      setShowConfetti(false);
      setCelebratingUserId(null);
    }, 3000);
  };

  const Confetti = () => {
    const particles = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
      size: Math.random() * 10 + 5,
      rotation: Math.random() * 360,
    }));

    return (
      <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            initial={{
              x: `${particle.x}%`,
              y: '-10%',
              rotate: 0,
              opacity: 1,
            }}
            animate={{
              y: '110%',
              rotate: particle.rotation + 360,
              opacity: 0,
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              ease: 'linear',
            }}
            className="absolute"
            style={{
              left: `${particle.x}%`,
              width: particle.size,
              height: particle.size,
              backgroundColor: particle.color,
              borderRadius: Math.random() > 0.5 ? '50%' : '0',
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {showConfetti && <Confetti />}
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
              className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
                    <Cake size={20} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Birthdays</h2>
                    <p className="text-sm text-gray-500">Celebrate with friends</p>
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
                ) : birthdays.length > 0 ? (
                  <div className="space-y-3">
                    {birthdays.map((user) => (
                      <motion.div
                        key={user.uid}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex items-center gap-3 p-4 rounded-2xl border ${
                          user.daysUntil === 0
                            ? 'bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 border-pink-200 dark:border-pink-800'
                            : 'bg-gray-50 dark:bg-zinc-800 border-gray-100 dark:border-zinc-700'
                        }`}
                      >
                        <img
                          src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`}
                          alt=""
                          className="w-12 h-12 rounded-full object-cover"
                        />
                        <div className="flex-1">
                          <p className="font-medium">{user.displayName}</p>
                          <p className="text-sm text-gray-500">
                            {user.daysUntil === 0
                              ? '🎂 Birthday today!'
                              : `🎂 Birthday in ${user.daysUntil} day${user.daysUntil > 1 ? 's' : ''}`}
                          </p>
                        </div>
                        {user.daysUntil === 0 && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleCelebrate(user)}
                            className="px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl text-sm font-medium flex items-center gap-2"
                          >
                            <PartyPopper size={16} />
                            Celebrate
                          </motion.button>
                        )}
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <Cake size={48} className="mx-auto text-gray-200 dark:text-zinc-800 mb-4" />
                    <p className="text-gray-500">No upcoming birthdays</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
