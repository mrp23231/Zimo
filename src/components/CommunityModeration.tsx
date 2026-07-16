import * as React from 'react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Shield, Flag, Users, Settings, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { collection, query, where, getDocs, updateDoc, doc, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface Report {
  id: string;
  reporterUid: string;
  reporterName: string;
  reportedUid: string;
  reportedName: string;
  reason: string;
  description: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  createdAt: number;
  postId?: string;
}

export interface CommunityRule {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

const defaultRules: CommunityRule[] = [
  {
    id: '1',
    title: 'Be respectful',
    description: 'Treat others with kindness and respect',
    severity: 'high',
  },
  {
    id: '2',
    title: 'No spam',
    description: 'Do not post repetitive or promotional content',
    severity: 'medium',
  },
  {
    id: '3',
    title: 'No harassment',
    description: 'Do not harass, bully, or threaten other users',
    severity: 'high',
  },
  {
    id: '4',
    title: 'No hate speech',
    description: 'Do not post content that promotes hatred or discrimination',
    severity: 'high',
  },
  {
    id: '5',
    title: 'No explicit content',
    description: 'Do not post NSFW or explicit content',
    severity: 'high',
  },
];

interface CommunityModerationProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  isAdmin: boolean;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const CommunityModeration: React.FC<CommunityModerationProps> = ({
  isOpen,
  onClose,
  userId,
  isAdmin,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'reports' | 'rules' | 'moderators'>('reports');
  const [reports, setReports] = useState<Report[]>([]);
  const [rules, setRules] = useState<CommunityRule[]>(defaultRules);
  const [moderators, setModerators] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setLoading(true);
      try {
        // Load reports
        const reportsQuery = query(
          collection(db, 'reports'),
          where('status', '==', 'pending')
        );
        const reportsSnapshot = await getDocs(reportsQuery);
        const reportsData = reportsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as Report));
        setReports(reportsData);

        // Load moderators
        const modsQuery = query(
          collection(db, 'users'),
          where('role', '==', 'moderator')
        );
        const modsSnapshot = await getDocs(modsQuery);
        setModerators(modsSnapshot.docs.map(d => d.data().uid));
      } catch (error) {
        console.error('Error loading moderation data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen]);

  const handleResolveReport = async (reportId: string, action: 'warn' | 'ban' | 'dismiss') => {
    try {
      const report = reports.find(r => r.id === reportId);
      if (!report) return;

      await updateDoc(doc(db, 'reports', reportId), {
        status: action === 'dismiss' ? 'dismissed' : 'resolved',
        resolvedBy: userId,
        resolvedAt: serverTimestamp(),
        action,
      });

      if (action === 'ban') {
        await updateDoc(doc(db, 'users', report.reportedUid), {
          accountStatus: 'blocked',
        });
      } else if (action === 'warn') {
        await addDoc(collection(db, 'users', report.reportedUid, 'warnings'), {
          reason: report.reason,
          description: report.description,
          createdAt: serverTimestamp(),
          createdBy: userId,
        });
      }

      setReports(reports.filter(r => r.id !== reportId));
      setSelectedReport(null);
      showToast(`Report ${action === 'dismiss' ? 'dismissed' : 'resolved'}`, 'success');
    } catch (error) {
      console.error('Error resolving report:', error);
      showToast('Failed to resolve report', 'error');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-500 bg-red-50 dark:bg-red-900/20';
      case 'medium': return 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
      case 'low': return 'text-green-500 bg-green-50 dark:bg-green-900/20';
      default: return 'text-gray-500 bg-gray-50 dark:bg-gray-900/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <AlertTriangle size={16} className="text-yellow-500" />;
      case 'resolved': return <CheckCircle size={16} className="text-green-500" />;
      case 'dismissed': return <XCircle size={16} className="text-gray-500" />;
      default: return <AlertTriangle size={16} className="text-gray-500" />;
    }
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
            className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                  <Shield size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Community Moderation</h2>
                  <p className="text-sm text-gray-500">Manage reports and rules</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 p-4 border-b border-gray-100 dark:border-zinc-800">
              {[
                { id: 'reports', label: 'Reports', icon: Flag },
                { id: 'rules', label: 'Rules', icon: Settings },
                { id: 'moderators', label: 'Moderators', icon: Users },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    activeTab === tab.id
                      ? 'bg-black dark:bg-white text-white dark:text-black'
                      : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200'
                  }`}
                >
                  <tab.icon size={16} />
                  {tab.label}
                  {tab.id === 'reports' && reports.length > 0 && (
                    <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                      {reports.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {loading ? (
                <div className="flex justify-center py-10">
                  <div className="w-6 h-6 border-2 border-black dark:border-white border-t-transparent animate-spin rounded-full" />
                </div>
              ) : (
                <>
                  {activeTab === 'reports' && (
                    <div className="space-y-3">
                      {reports.length > 0 ? (
                        reports.map((report) => (
                          <motion.div
                            key={report.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`p-4 rounded-2xl border ${
                              selectedReport?.id === report.id
                                ? 'border-black dark:border-white'
                                : 'border-gray-200 dark:border-zinc-700'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                  <Flag size={20} className="text-red-500" />
                                </div>
                                <div>
                                  <p className="font-medium">Report #{report.id.slice(0, 8)}</p>
                                  <p className="text-sm text-gray-500">
                                    {report.reporterName} reported {report.reportedName}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-1">{report.reason}</p>
                                </div>
                              </div>
                              {getStatusIcon(report.status)}
                            </div>

                            {selectedReport?.id === report.id && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="mt-4 pt-4 border-t border-gray-100 dark:border-zinc-800"
                              >
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                  {report.description}
                                </p>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleResolveReport(report.id, 'warn')}
                                    className="flex-1 py-2 rounded-xl bg-yellow-500 text-white text-sm font-medium hover:opacity-90"
                                  >
                                    Warn User
                                  </button>
                                  <button
                                    onClick={() => handleResolveReport(report.id, 'ban')}
                                    className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:opacity-90"
                                  >
                                    Ban User
                                  </button>
                                  <button
                                    onClick={() => handleResolveReport(report.id, 'dismiss')}
                                    className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-800"
                                  >
                                    Dismiss
                                  </button>
                                </div>
                              </motion.div>
                            )}

                            {selectedReport?.id !== report.id && (
                              <button
                                onClick={() => setSelectedReport(report)}
                                className="mt-3 text-sm text-blue-500 hover:underline"
                              >
                                View details
                              </button>
                            )}
                          </motion.div>
                        ))
                      ) : (
                        <div className="text-center py-10">
                          <Shield size={48} className="mx-auto text-gray-200 dark:text-zinc-800 mb-4" />
                          <p className="text-gray-500">No pending reports</p>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'rules' && (
                    <div className="space-y-3">
                      {rules.map((rule) => (
                        <div
                          key={rule.id}
                          className={`p-4 rounded-2xl border ${getSeverityColor(rule.severity)}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-semibold">{rule.title}</h3>
                              <p className="text-sm opacity-80">{rule.description}</p>
                            </div>
                            <span className="text-xs font-medium uppercase px-2 py-1 rounded-full bg-white/50">
                              {rule.severity}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === 'moderators' && (
                    <div className="space-y-3">
                      {moderators.length > 0 ? (
                        moderators.map((modUid) => (
                          <div
                            key={modUid}
                            className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-zinc-800 rounded-2xl"
                          >
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                              <Shield size={20} className="text-white" />
                            </div>
                            <div>
                              <p className="font-medium">Moderator</p>
                              <p className="text-sm text-gray-500">{modUid}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-10">
                          <Users size={48} className="mx-auto text-gray-200 dark:text-zinc-800 mb-4" />
                          <p className="text-gray-500">No moderators assigned</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
