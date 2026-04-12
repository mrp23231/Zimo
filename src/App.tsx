/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  serverTimestamp,
  Timestamp,
  where,
  limit,
  getDocFromServer,
  updateDoc,
  arrayUnion,
  arrayRemove,
  deleteDoc,
  getDocs
} from './lib/firebase';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL,
  uploadBytesResumable
} from 'firebase/storage';
import { auth, db, storage } from './lib/firebase';
import { firestore, db as awDb } from './lib/appwrite';

import { cn } from './lib/utils';
import { 
  Home, 
  User, 
  MessageSquare, 
  PlusCircle, 
  LogOut, 
  Moon, 
  Sun, 
  Heart, 
  Send,
  ArrowLeft,
  Bell,
  Image as ImageIcon,
  X,
  Search,
  Camera,
  MoreVertical,
  Plus,
  MessageCircle,
  Compass,
  Bookmark,
  Share2,
  Check,
  Info,
  Trash2,
  Flag,
  Repeat,
  Edit3,
  Smile,
  WifiOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow, format, isSameDay } from 'date-fns';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

function handleStorageError(error: unknown, path: string) {
  console.error(`Storage Error at ${path}:`, error);
  const message = error instanceof Error ? error.message : String(error);
  return message;
}

const normalizeUsername = (value: string) => value.trim().replace(/^@+/, '');

const formatUsername = (value?: string) => {
  if (!value) return '';
  return `@${value.replace(/^@+/, '')}`;
};

const getAgeFromBirthdate = (birthdate?: string) => {
  if (!birthdate) return null;
  const date = new Date(birthdate);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const m = now.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < date.getDate())) age -= 1;
  return age >= 0 ? age : null;
};

const formatBirthdateWithAge = (birthdate?: string, t?: (key: TranslationKey) => string) => {
  if (!birthdate) return '';
  const date = new Date(birthdate);
  if (Number.isNaN(date.getTime())) return '';
  const age = getAgeFromBirthdate(birthdate);
  const dateLabel = format(date, 'dd.MM.yyyy');
  if (age === null) return dateLabel;
  const ageLabel = t ? t('ageYears').replace('{age}', String(age)) : `${age}`;
  return `${dateLabel} (${ageLabel})`;
};

const getEmailDisplay = (user: UserProfile, viewerUid: string | undefined, t: (key: TranslationKey) => string) => {
  if (!user.email) return '';
  if (user.hideEmail && viewerUid !== user.uid) return t('emailHidden');
  return user.email;
};

const getUserSecondaryLabel = (user: UserProfile, viewerUid: string | undefined, t: (key: TranslationKey) => string) => {
  const handle = formatUsername(user.username);
  if (handle) return handle;
  const email = getEmailDisplay(user, viewerUid, t);
  return email || t('emailHidden');
};

const syncUserPosts = async (uid: string, updates: Partial<Post>) => {
  const q = query(collection(db, 'posts'), where('authorUid', '==', uid));
  const snap = await getDocs(q);
  if (snap.empty) return;
  await Promise.all(snap.docs.map(d => updateDoc(d.ref, updates)));
};

const MESSAGE_REACTIONS = [
  { key: 'like', emoji: '👍' },
  { key: 'love', emoji: '❤️' },
  { key: 'fire', emoji: '🔥' },
  { key: 'laugh', emoji: '😂' },
  { key: 'wow', emoji: '😮' },
];

// --- Types ---

interface UserProfile {
  uid: string;
  username?: string;
  usernameLower?: string;
  displayName: string;
  email: string;
  photoURL: string;
  headerURL?: string;
  bio?: string;
  birthdate?: string;
  city?: string;
  hideEmail?: boolean;
  typing?: boolean;
  typingTo?: string;
  typingAt?: Timestamp;
  createdAt: Timestamp;
  followersCount?: number;
  followingCount?: number;
  bookmarks?: string[];
  isOnline?: boolean;
  lastSeen?: Timestamp;
  blockedUsers?: string[];
  isPrivate?: boolean;
}

interface Follow {
  id: string;
  followerUid: string;
  followingUid: string;
  status?: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp;
}

interface Post {
  id: string;
  authorUid: string;
  authorName: string;
  authorPhoto: string;
  authorUsername?: string;
  content: string;
  imageUrl?: string;
  imageUrls?: string[];
  createdAt: Timestamp;
  likes: number;
  likedBy: string[];
  repostId?: string;
  repostCount?: number;
}

interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'repost' | 'follow_request';
  fromUid: string;
  fromName: string;
  fromPhoto: string;
  toUid: string;
  postId?: string;
  createdAt: Timestamp;
  read: boolean;
}

interface Comment {
  id: string;
  authorUid: string;
  authorName: string;
  authorPhoto: string;
  text: string;
  createdAt: Timestamp;
  likes: number;
  likedBy: string[];
  parentId?: string;
}

interface Message {
  id: string;
  senderUid: string;
  receiverUid: string;
  text: string;
  imageUrl?: string;
  replyToId?: string;
  replyToText?: string;
  replyToSenderName?: string;
  createdAt: Timestamp;
  editedAt?: Timestamp;
  deletedFor?: string[];
  deletedForAll?: boolean;
  pinned?: boolean;
  reactions?: Record<string, string[]>;
  read?: boolean;
}

type Language = 'en' | 'ru';

const translations = {
  en: {
    searchUsers: 'Search users...',
    noUsersFound: 'No users found',
    feed: 'Feed',
    explore: 'Explore',
    notifications: 'Notifications',
    bookmarks: 'Bookmarks',
    messages: 'Messages',
    profile: 'Profile',
    posts: 'Posts',
    followers: 'Followers',
    following: 'Following',
    settings: 'Settings',
    appearance: 'Appearance',
    theme: 'Theme',
    language: 'Language',
    light: 'Light',
    dark: 'Dark',
    appSettings: 'App settings',
    loginTitle: 'ZIMO',
    loginSubtitle: 'A social space for clear thoughts and real connections.',
    continueGoogle: 'Continue with Google',
    logout: 'Log out',
    pushNotifications: 'Push notifications',
    pushNotificationsHint: 'Browser desktop notifications',
    privateAccount: 'Private account',
    privateAccountHint: 'Only approved followers can see your posts',
    followRequested: 'Follow requested',
    followApprove: 'Approve',
    followReject: 'Reject',
    followRequest: 'Follow request',
    deleteAccount: 'Delete account',
    deleteAccountConfirm: 'Are you sure you want to delete your account? This cannot be undone.',
    welcome: 'Welcome to Zimo',
    onboardingSubtitle: 'Let’s finish your profile in a few quick steps.',
    next: 'Next',
    back: 'Back',
    step: 'Step',
    stepWelcome: 'Welcome',
    stepUsername: 'Username',
    stepName: 'Name',
    stepMedia: 'Media',
    chooseUsername: 'Choose a unique username',
    usernameHint: 'Only letters, numbers, and underscore. 3–20 chars. You can start with @.',
    usernamePlaceholder: 'e.g. zimo_user',
    checking: 'Checking...',
    usernameTaken: 'That username is taken',
    usernameAvailable: 'Username is available',
    yourName: 'Your name',
    namePlaceholder: 'How should we call you?',
    optionalMedia: 'Optional profile media',
    avatarUrl: 'Avatar image URL (optional)',
    bannerUrl: 'Banner image URL (optional)',
    skip: 'Skip',
    finish: 'Finish',
    welcomeDone: 'All set!',
    welcomeMessage: 'Welcome to Zimo.',
    uploadNote: 'Uploads are stored locally in posts (limited size).',
    uploadLimitsTitle: 'Photo limits',
    uploadLimitsBody: 'Max {size} and {dim}px per image. Larger photos are compressed.',
    uploadLimitsNote: 'Storage is disabled. Images are saved inside posts.',
    urlInvalid: 'URL must start with http:// or https://',
    imageTooLarge: 'Image is too large after compression',
    fileReadFailed: 'Could not read the file',
    imageDecodeFailed: 'Could not process the image',
    canvasNotSupported: 'Your browser does not support image processing',
    uploadFailed: 'Upload failed',
    add: 'Add',
    post: 'Post',
    uploading: 'Uploading...',
    uploadingImages: 'Uploading images...',
    postPlaceholder: "What's on your mind?",
    dismiss: 'Dismiss',
    clear: 'Clear',
    save: 'Save',
    cancel: 'Cancel',
    on: 'On',
    off: 'Off',
    bioPlaceholder: 'Tell us about yourself...',
    global: 'Global',
    followingTab: 'Following',
    results: 'results',
    postsCount: '{count} posts',
    trending: 'Trending',
    noTrends: 'No trends yet',
    proTip: 'Pro Tip',
    proTipText: 'Use hashtags to make your posts discoverable by everyone in the community!',
    bookmarksEmpty: 'No bookmarks yet. Save posts to see them here!',
    editBio: 'Edit Bio',
    noBio: 'No bio yet',
    follow: 'Follow',
    followingBtn: 'Following',
    block: 'Block',
    blocked: 'Blocked',
    userNotFound: 'User not found',
    noPosts: 'No posts yet',
    noFollowers: 'No followers yet',
    noFollowing: 'Not following anyone yet',
    likedBy: 'Liked by',
    noLikes: 'No likes yet',
    notificationsTitle: 'Notifications',
    markAllRead: 'Mark all as read',
    clearAll: 'Clear all',
    notificationsEmpty: 'No notifications yet',
    clearNotificationsConfirm: 'Clear all notifications?',
    notificationsCleared: 'Notifications cleared',
    markAllReadSuccess: 'All marked as read',
    commentPlaceholder: 'Write a comment...',
    replyPlaceholder: 'Write a reply...',
    reply: 'Reply',
    delete: 'Delete',
    confirmDeleteComment: 'Delete this comment?',
    replyingTo: 'Replying to',
    commentsTitle: 'Comments ({count})',
    cancelReply: 'Cancel reply',
    reacted: 'Reacted',
    editMessage: 'Edit message',
    deleteMessage: 'Delete message',
    deleteForMe: 'Delete for me',
    deleteForAll: 'Delete for everyone',
    messageDeleted: 'Message deleted',
    messageEdited: 'Message edited',
    messageRemoved: 'Message removed',
    pinMessage: 'Pin message',
    unpinMessage: 'Unpin message',
    pinnedMessages: 'Pinned messages',
    typing: 'typing...',
    edited: 'edited',
    shareCopied: 'Link copied to clipboard!',
    bookmarkAdded: 'Added to bookmarks',
    bookmarkRemoved: 'Removed from bookmarks',
    bookmarkFailed: 'Failed to bookmark',
    repostConfirm: 'Repost this post?',
    reposted: 'Post reposted!',
    quoteReposted: 'Quote reposted!',
    repostedLabel: 'Reposted',
    repostDialog: 'Repost',
    reposting: 'Reposting...',
    quoteRepost: 'Quote Repost',
    repostAction: 'Repost',
    addCommentOptional: 'Add a comment (optional)',
    uploadAvatar: 'Upload avatar',
    uploadBanner: 'Upload banner',
    reportConfirm: 'Report this post for inappropriate content?',
    reportPost: 'Report Post',
    reportSuccess: 'Post reported. Thank you for keeping our community safe.',
    reportFailed: 'Failed to report post',
    deletePostConfirm: 'Delete this post?',
    postDeleted: 'Post deleted',
    deletePostFailed: 'Failed to delete post',
    updatePostSuccess: 'Post updated',
    updatePostFailed: 'Failed to update post',
    repostFailed: 'Failed to repost',
    commentDeleted: 'Comment deleted',
    commentDeleteFailed: 'Failed to delete comment',
    postFailed: 'Failed to post: {error}',
    bioUpdateFailed: 'Failed to update bio: {error}',
    avatarUploadFailed: 'Avatar upload failed: {error}',
    headerUploadFailed: 'Header upload failed: {error}',
    online: 'Online',
    lastSeen: 'Last seen',
    recently: 'recently',
    typeMessage: 'Type a message...',
    startConversation: 'Start a conversation with',
    recentChats: 'Recent chats',
    sent: 'Sent',
    read: 'Read',
    communityStats: 'Community Stats',
    members: 'Members',
    postsStat: 'Posts',
    popularPosts: 'Popular Posts',
    likeMessage: 'liked your post',
    commentMessage: 'commented on your post',
    followMessage: 'started following you',
    followRequestMessage: 'wants to follow you',
    followApproved: 'Follow request approved',
    followRejected: 'Follow request rejected',
    approve: 'Approve',
    reject: 'Reject',
    repostMessage: 'reposted your post',
    interactedMessage: 'interacted with you',
    searchPeople: 'Search people...',
    noComments: 'No comments yet. Be the first to comment!',
    justNow: 'Just now',
    failedClearNotifications: 'Failed to clear notifications',
    failedMarkRead: 'Failed to mark as read',
    blockConfirm: 'Block {name}? This user’s posts will be hidden from your feed.',
    unblockConfirm: 'Unblock {name}?',
    blockedToast: 'Blocked {name}',
    unblockedToast: 'Unblocked {name}',
    blockFailed: 'Failed to block user',
    unblockFailed: 'Failed to unblock user',
    whoToFollow: 'Who to follow',
    followingTitle: 'Following',
    imageUrlPlaceholder: 'https://example.com/image.jpg',
    googleAccount: 'Google Account',
    settingsShort: 'SET',
    profileInfo: 'Profile info',
    displayNameLabel: 'Name',
    bioLabel: 'Bio',
    birthdateLabel: 'Birthday',
    cityLabel: 'City',
    ageYears: '{age} yrs',
    emailHidden: 'Email hidden',
    hideEmailLabel: 'Hide my email',
    hideEmailHint: 'Other users will not see your email in lists or profiles.',
    notificationsToggle: 'Notifications',
    notificationsHint: 'Show badges and in-app notification popups.',
    toastsToggle: 'Pop-up messages',
    toastsHint: 'Show quick success/error banners at the top.',
    profileSaved: 'Profile updated',
    messagesSubtitle: 'Stay close to your people and keep the conversation flowing.',
    noRecentChats: 'No recent chats yet',
    oops: 'Oops!',
    somethingWrong: 'Something went wrong.',
    securityError: "Security Error: You don't have permission to {operation} at {path}. Please check your rules.",
    reloadApp: 'Reload app',
    genericError: 'Something went wrong. Please try again.',
  },
  ru: {
    searchUsers: 'Поиск пользователей...',
    noUsersFound: 'Пользователи не найдены',
    feed: 'Лента',
    explore: 'Обзор',
    notifications: 'Уведомления',
    bookmarks: 'Закладки',
    messages: 'Сообщения',
    profile: 'Профиль',
    posts: 'Посты',
    followers: 'Подписчики',
    following: 'Подписки',
    settings: 'Настройки',
    appearance: 'Оформление',
    theme: 'Тема',
    language: 'Язык',
    light: 'Светлая',
    dark: 'Тёмная',
    appSettings: 'Настройки приложения',
    loginTitle: 'ZIMO',
    loginSubtitle: 'Соцсеть для ясных мыслей и настоящих связей.',
    continueGoogle: 'Войти через Google',
    logout: 'Выйти',
    pushNotifications: 'Push-уведомления',
    pushNotificationsHint: 'Уведомления в браузере',
    privateAccount: 'Закрытый аккаунт',
    privateAccountHint: 'Только одобренные подписчики видят посты',
    followRequested: 'Запрос на подписку',
    followApprove: 'Одобрить',
    followReject: 'Отклонить',
    followRequest: 'Запрос на подписку',
    deleteAccount: 'Удалить аккаунт',
    deleteAccountConfirm: 'Вы уверены, что хотите удалить аккаунт? Это действие необратимо.',
    welcome: 'Добро пожаловать в Zimo',
    onboardingSubtitle: 'Давайте оформим профиль за пару шагов.',
    next: 'Далее',
    back: 'Назад',
    step: 'Шаг',
    stepWelcome: 'Старт',
    stepUsername: 'Юзернейм',
    stepName: 'Имя',
    stepMedia: 'Медиа',
    chooseUsername: 'Придумайте уникальный юзернейм',
    usernameHint: 'Только буквы, цифры и _. 3–20 символов. Можно начать с @.',
    usernamePlaceholder: 'например: zimo_user',
    checking: 'Проверяем...',
    usernameTaken: 'Юзернейм занят',
    usernameAvailable: 'Юзернейм свободен',
    yourName: 'Как вас зовут',
    namePlaceholder: 'Как к вам обращаться?',
    optionalMedia: 'Фото и баннер (необязательно)',
    avatarUrl: 'URL аватара (необязательно)',
    bannerUrl: 'URL баннера (необязательно)',
    skip: 'Пропустить',
    finish: 'Готово',
    welcomeDone: 'Готово!',
    welcomeMessage: 'Добро пожаловать в Zimo.',
    uploadNote: 'Загрузка хранится прямо в постах (ограниченный размер).',
    uploadLimitsTitle: 'Лимиты фото',
    uploadLimitsBody: 'Максимум {size} и {dim}px на фото. Большие изображения сжимаются.',
    uploadLimitsNote: 'Storage выключен. Картинки сохраняются внутри постов.',
    urlInvalid: 'URL должен начинаться с http:// или https://',
    imageTooLarge: 'Изображение слишком большое после сжатия',
    fileReadFailed: 'Не удалось прочитать файл',
    imageDecodeFailed: 'Не удалось обработать изображение',
    canvasNotSupported: 'Ваш браузер не поддерживает обработку изображений',
    uploadFailed: 'Не удалось загрузить',
    add: 'Добавить',
    post: 'Опубликовать',
    uploading: 'Загрузка...',
    uploadingImages: 'Загружаем изображения...',
    postPlaceholder: 'О чём хотите рассказать?',
    dismiss: 'Скрыть',
    clear: 'Очистить',
    save: 'Сохранить',
    cancel: 'Отмена',
    on: 'Вкл',
    off: 'Выкл',
    bioPlaceholder: 'Расскажите о себе...',
    global: 'Все',
    followingTab: 'Подписки',
    results: 'результаты',
    postsCount: '{count} постов',
    trending: 'Тренды',
    noTrends: 'Пока нет трендов',
    proTip: 'Подсказка',
    proTipText: 'Используйте хэштеги, чтобы ваши посты было проще найти!',
    bookmarksEmpty: 'Пока нет закладок. Сохраняйте посты, чтобы видеть их здесь!',
    editBio: 'Редактировать',
    noBio: 'Пока нет описания',
    follow: 'Подписаться',
    followingBtn: 'Подписки',
    block: 'Заблокировать',
    blocked: 'Заблокирован',
    userNotFound: 'Пользователь не найден',
    noPosts: 'Пока нет постов',
    noFollowers: 'Пока нет подписчиков',
    noFollowing: 'Пока нет подписок',
    likedBy: 'Понравилось',
    noLikes: 'Пока нет лайков',
    notificationsTitle: 'Уведомления',
    markAllRead: 'Прочитать все',
    clearAll: 'Очистить всё',
    notificationsEmpty: 'Пока нет уведомлений',
    clearNotificationsConfirm: 'Очистить все уведомления?',
    notificationsCleared: 'Уведомления очищены',
    markAllReadSuccess: 'Все отмечены прочитанными',
    commentPlaceholder: 'Написать комментарий...',
    replyPlaceholder: 'Написать ответ...',
    commentsTitle: 'Комментарии ({count})',
    reply: 'Ответить',
    delete: 'Удалить',
    confirmDeleteComment: 'Удалить этот комментарий?',
    replyingTo: 'Ответ на',
    cancelReply: 'Отменить ответ',
    reacted: 'Реакция',
    editMessage: 'Редактировать',
    deleteMessage: 'Удалить',
    deleteForMe: 'Удалить у меня',
    deleteForAll: 'Удалить у всех',
    messageDeleted: 'Сообщение удалено',
    messageEdited: 'Сообщение изменено',
    messageRemoved: 'Сообщение удалено',
    pinMessage: 'Закрепить',
    unpinMessage: 'Открепить',
    pinnedMessages: 'Закреплённые',
    typing: 'печатает...',
    edited: 'изменено',
    shareCopied: 'Ссылка скопирована!',
    bookmarkAdded: 'Добавлено в закладки',
    bookmarkRemoved: 'Удалено из закладок',
    bookmarkFailed: 'Не удалось добавить в закладки',
    repostConfirm: 'Сделать репост?',
    reposted: 'Репост опубликован!',
    quoteReposted: 'Цитата опубликована!',
    repostedLabel: 'Репост',
    repostDialog: 'Репост',
    reposting: 'Репостим...',
    quoteRepost: 'Цитата',
    repostAction: 'Репост',
    addCommentOptional: 'Добавьте комментарий (необязательно)',
    uploadAvatar: 'Загрузить аватар',
    uploadBanner: 'Загрузить баннер',
    reportConfirm: 'Пожаловаться на этот пост?',
    reportPost: 'Пожаловаться',
    reportSuccess: 'Пост отправлен на проверку. Спасибо!',
    reportFailed: 'Не удалось отправить жалобу',
    deletePostConfirm: 'Удалить этот пост?',
    postDeleted: 'Пост удалён',
    deletePostFailed: 'Не удалось удалить пост',
    updatePostSuccess: 'Пост обновлён',
    updatePostFailed: 'Не удалось обновить пост',
    repostFailed: 'Не удалось сделать репост',
    commentDeleted: 'Комментарий удалён',
    commentDeleteFailed: 'Не удалось удалить комментарий',
    postFailed: 'Не удалось опубликовать: {error}',
    bioUpdateFailed: 'Не удалось обновить био: {error}',
    avatarUploadFailed: 'Не удалось загрузить аватар: {error}',
    headerUploadFailed: 'Не удалось загрузить баннер: {error}',
    online: 'В сети',
    lastSeen: 'Был(а)',
    recently: 'недавно',
    typeMessage: 'Написать сообщение...',
    startConversation: 'Начните диалог с',
    recentChats: 'Недавние чаты',
    sent: 'Отправлено',
    read: 'Прочитано',
    communityStats: 'Статистика сообщества',
    members: 'Участники',
    postsStat: 'Посты',
    popularPosts: 'Популярные посты',
    likeMessage: 'лайкнул ваш пост',
    commentMessage: 'оставил комментарий',
    followMessage: 'подписался на вас',
    followRequestMessage: 'хочет подписаться',
    followApproved: 'Подписка одобрена',
    followRejected: 'Подписка отклонена',
    approve: 'Принять',
    reject: 'Отклонить',
    repostMessage: 'сделал репост вашего поста',
    interactedMessage: 'взаимодействовал с вами',
    searchPeople: 'Поиск людей...',
    noComments: 'Пока нет комментариев. Будьте первым!',
    justNow: 'Только что',
    failedClearNotifications: 'Не удалось очистить уведомления',
    failedMarkRead: 'Не удалось отметить прочитанными',
    blockConfirm: 'Заблокировать {name}? Его посты будут скрыты.',
    unblockConfirm: 'Разблокировать {name}?',
    blockedToast: 'Пользователь заблокирован: {name}',
    unblockedToast: 'Пользователь разблокирован: {name}',
    blockFailed: 'Не удалось заблокировать пользователя',
    unblockFailed: 'Не удалось разблокировать пользователя',
    whoToFollow: 'Кого читать',
    followingTitle: 'Подписки',
    imageUrlPlaceholder: 'https://example.com/image.jpg',
    googleAccount: 'Аккаунт Google',
    settingsShort: 'НАСТ',
    profileInfo: 'Профиль',
    displayNameLabel: 'Имя',
    bioLabel: 'Био',
    birthdateLabel: 'Дата рождения',
    cityLabel: 'Город',
    ageYears: '{age} лет',
    emailHidden: 'Почта скрыта',
    hideEmailLabel: 'Скрыть мою почту',
    hideEmailHint: 'Другие пользователи не увидят вашу почту в списках и профиле.',
    notificationsToggle: 'Уведомления',
    notificationsHint: 'Показывать бейджи и всплывающие уведомления.',
    toastsToggle: 'Всплывающие сообщения',
    toastsHint: 'Показывать быстрые подсказки вверху.',
    profileSaved: 'Профиль обновлён',
    messagesSubtitle: 'Оставайтесь на связи и продолжайте диалоги.',
    noRecentChats: 'Пока нет недавних чатов',
    oops: 'Упс!',
    somethingWrong: 'Что-то пошло не так.',
    securityError: 'Ошибка доступа: нет прав на {operation} по пути {path}. Проверьте правила.',
    reloadApp: 'Перезагрузить',
    genericError: 'Что-то пошло не так. Попробуйте снова.',
  },
} as const;

type TranslationKey = keyof typeof translations.en;

const STORAGE_ENABLED = false;
const MAX_IMAGE_BYTES = 700 * 1024;
const MAX_IMAGE_DIM = 1280;

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes}B`;
  const kb = Math.round(bytes / 1024);
  if (kb < 1024) return `${kb}KB`;
  const mb = (kb / 1024).toFixed(1);
  return `${mb}MB`;
};

const readAndCompressImage = (file: File): Promise<{ dataUrl: string; bytes: number }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('file_read_failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('image_decode_failed'));
      img.onload = () => {
        const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(img.width, img.height));
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('canvas_not_supported'));
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        const bytes = Math.round((dataUrl.length * 3) / 4);
        resolve({ dataUrl, bytes });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
};

const getDefaultLanguage = (): Language => {
  if (typeof navigator !== 'undefined') {
    const lang = navigator.language?.toLowerCase();
    if (lang?.startsWith('ru')) return 'ru';
  }
  return 'en';
};

const getImageErrorMessage = (error: unknown, t: (key: TranslationKey) => string) => {
  const message = error instanceof Error ? error.message : String(error);
  switch (message) {
    case 'file_read_failed':
      return t('fileReadFailed');
    case 'image_decode_failed':
      return t('imageDecodeFailed');
    case 'canvas_not_supported':
      return t('canvasNotSupported');
    default:
      return t('genericError');
  }
};

function PhotoLimitsNotice({ className }: { className?: string }) {
  const { t } = useSettings();
  const sizeLabel = formatBytes(MAX_IMAGE_BYTES);
  const body = t('uploadLimitsBody')
    .replace('{size}', sizeLabel)
    .replace('{dim}', String(MAX_IMAGE_DIM));

  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border border-gray-100 dark:border-zinc-800 bg-gray-50/70 dark:bg-zinc-900/60 p-3", className)}>
      <div className="mt-0.5 w-7 h-7 rounded-xl bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 flex items-center justify-center text-gray-500 dark:text-gray-300">
        <Info size={14} />
      </div>
      <div>
        <div className="text-xs font-semibold text-gray-800 dark:text-gray-100">{t('uploadLimitsTitle')}</div>
        <div className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">{body}</div>
        <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{t('uploadLimitsNote')}</div>
      </div>
    </div>
  );
}

type View = 'feed' | 'profile' | 'messages' | 'chat' | 'notifications' | 'post_detail' | 'user_profile' | 'explore' | 'bookmarks';

// --- Context ---

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

const ToastContext = createContext<{
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
} | null>(null);

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const { toastsEnabled } = useSettings();

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (!toastsEnabled) return;
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-20 md:top-24 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-xs px-4">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-md border",
                toast.type === 'success' ? "bg-green-500/90 border-green-400 text-white" :
                toast.type === 'error' ? "bg-red-500/90 border-red-400 text-white" :
                "bg-zinc-900/90 border-zinc-800 text-white"
              )}
            >
              {toast.type === 'success' && <Check size={18} />}
              {toast.type === 'error' && <X size={18} />}
              {toast.type === 'info' && <Info size={18} />}
              <span className="text-sm font-bold">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};

const AuthContext = createContext<{
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  needsOnboarding: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
} | null>(null);

const SettingsContext = createContext<{
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
  language: Language;
  setLanguage: (l: Language) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (v: boolean) => void;
  toastsEnabled: boolean;
  setToastsEnabled: (v: boolean) => void;
  t: (key: TranslationKey) => string;
} | null>(null);

const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsContext');
  return context;
};

function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('app_theme');
    return stored ? stored === 'dark' : false;
  });
  const [language, setLanguage] = useState<Language>(() => {
    const stored = localStorage.getItem('app_language');
    if (stored === 'en' || stored === 'ru') return stored;
    return getDefaultLanguage();
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    const stored = localStorage.getItem('app_notifications');
    return stored ? stored === 'on' : true;
  });
  const [toastsEnabled, setToastsEnabled] = useState(() => {
    const stored = localStorage.getItem('app_toasts');
    return stored ? stored === 'on' : true;
  });

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('app_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('app_language', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('app_notifications', notificationsEnabled ? 'on' : 'off');
  }, [notificationsEnabled]);

  useEffect(() => {
    localStorage.setItem('app_toasts', toastsEnabled ? 'on' : 'off');
  }, [toastsEnabled]);

  const t = (key: TranslationKey) => translations[language][key] || translations.en[key] || key;

  return (
    <SettingsContext.Provider value={{ darkMode, setDarkMode, language, setLanguage, notificationsEnabled, setNotificationsEnabled, toastsEnabled, setToastsEnabled, t }}>
      {children}
    </SettingsContext.Provider>
  );
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const lastProfileSync = useRef<{ photo?: string; name?: string; username?: string }>({});

  // Skip connection test - Supabase handles errors automatically
  useEffect(() => {}, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setProfile(null);
        setNeedsOnboarding(false);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const userDocRef = doc(db, 'users', user.uid);

    // Use Firebase to update user (Appwrite migration has issues)
    updateDoc(userDocRef, { isOnline: true, lastSeen: serverTimestamp() }).catch(() => {});

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateDoc(userDocRef, { isOnline: true, lastSeen: serverTimestamp() }).catch(() => {});
      } else {
        updateDoc(userDocRef, { isOnline: false, lastSeen: serverTimestamp() }).catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const unsubProfile = onSnapshot(
      userDocRef,
      async (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfile;
          const normalizedUsername = data.username ? normalizeUsername(data.username) : '';
          const needsNormalization = data.username && data.username !== normalizedUsername;
          if (needsNormalization) {
            // Only normalize once - skip if already normalized
            setTimeout(() => {
              updateDoc(userDocRef, {
                username: normalizedUsername,
                usernameLower: normalizedUsername.toLowerCase()
              }).catch(console.error);
            }, 1000);
          }
          setProfile(data);
          const nextSync = {
            photo: data.photoURL || '',
            name: data.displayName || '',
            username: normalizedUsername
          };
          const shouldSync =
            nextSync.photo !== lastProfileSync.current.photo ||
            nextSync.name !== lastProfileSync.current.name ||
            nextSync.username !== lastProfileSync.current.username;
          if (shouldSync && data.uid) {
            syncUserPosts(data.uid, {
              authorPhoto: data.photoURL || '',
              authorName: data.displayName || '',
              authorUsername: normalizedUsername
            }).catch(console.error);
            lastProfileSync.current = nextSync;
          }
          setNeedsOnboarding(!data.username);
        } else {
          setProfile(null);
          setNeedsOnboarding(true);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Firestore profile listener failed:", err);
        setProfile(null);
        setNeedsOnboarding(true);
        setLoading(false);
      }
    );

    return () => {
      unsubProfile();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      updateDoc(userDocRef, { isOnline: false, lastSeen: serverTimestamp() }).catch(console.error);
    };
  }, [user]);

  const signIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Sign in error:", error);
      alert("Ошибка входа: " + (error.message || "Неизвестная ошибка"));
    }
  };

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, profile, loading, needsOnboarding, signIn, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// --- Components ---

function Lightbox({ url, onClose }: { url: string, onClose: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
      >
        <X size={24} />
      </button>
      <motion.img 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        src={url} 
        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
        referrerPolicy="no-referrer"
        onClick={(e) => e.stopPropagation()}
      />
    </motion.div>
  );
}

function Explore({ onOpenPost, onOpenProfile, onOpenImage, onShowLikes }: { 
  onOpenPost: (post: Post) => void, 
  onOpenProfile: (uid: string) => void,
  onOpenImage: (url: string) => void,
  onShowLikes: (postId: string) => void,
  key?: string
}) {
  const { profile } = useAuth();
  const { t } = useSettings();
  const [trendingPosts, setTrendingPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<UserProfile[]>([]);
  const [isUserSearching, setIsUserSearching] = useState(false);
  const [privateAccountUids, setPrivateAccountUids] = useState<string[]>([]);

  // Load private account UIDs
  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const privateUids = snapshot.docs
        .map(doc => doc.data() as UserProfile)
        .filter(u => u.isPrivate === true)
        .map(u => u.uid);
      setPrivateAccountUids(privateUids);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('likes', 'desc'), limit(20));
    const unsubscribe = onSnapshot(q, (s) => {
      let allPosts = s.docs.map(d => ({ id: d.id, ...d.data() } as Post));
      if (profile?.blockedUsers && profile.blockedUsers.length > 0) {
        allPosts = allPosts.filter(p => !profile.blockedUsers?.includes(p.authorUid));
      }
      // Filter out private account posts
      allPosts = allPosts.filter(p => !privateAccountUids.includes(p.authorUid));
      setTrendingPosts(allPosts.slice(0, 10));
      setLoading(false);
    });
    return unsubscribe;
  }, [profile?.blockedUsers, privateAccountUids]);

  useEffect(() => {
    if (userSearch.length < 2) {
      setUserResults([]);
      return;
    }
    setUserResults([]);
    const normalized = normalizeUsername(userSearch).toLowerCase();
    const qName = query(
      collection(db, 'users'),
      where('displayName', '>=', userSearch),
      where('displayName', '<=', userSearch + '\uf8ff'),
      limit(6)
    );
    const qUsername = query(
      collection(db, 'users'),
      where('usernameLower', '>=', normalized),
      where('usernameLower', '<=', normalized + '\uf8ff'),
      limit(6)
    );
    const unsubName = onSnapshot(qName, (s) => {
      const nameResults = s.docs.map(d => d.data() as UserProfile);
      setUserResults((prev) => {
        const merged = [...nameResults, ...prev].reduce<UserProfile[]>((acc, u) => {
          if (!acc.find(p => p.uid === u.uid)) acc.push(u);
          return acc;
        }, []);
        return merged.slice(0, 8);
      });
    });
    const unsubUsername = onSnapshot(qUsername, (s) => {
      const userResults = s.docs.map(d => d.data() as UserProfile);
      setUserResults((prev) => {
        const merged = [...userResults, ...prev].reduce<UserProfile[]>((acc, u) => {
          if (!acc.find(p => p.uid === u.uid)) acc.push(u);
          return acc;
        }, []);
        return merged.slice(0, 8);
      });
    });
    return () => { unsubName(); unsubUsername(); };
  }, [userSearch]);

  return (
    <div className="max-w-4xl mx-auto py-20 px-4">
      <h2 className="text-3xl font-bold mb-6 tracking-tight">{t('explore')}</h2>

      <div className="md:hidden mb-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            onFocus={() => setIsUserSearching(true)}
            placeholder={t('searchUsers')}
            className="w-full bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl pl-12 pr-4 py-3 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition-all shadow-sm"
          />
        </div>
        {isUserSearching && userSearch.length >= 2 && (
          <div className="mt-2 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
            {userResults.length > 0 ? userResults.map(u => (
              <button
                key={u.uid}
                onClick={() => {
                  onOpenProfile(u.uid);
                  setUserSearch('');
                  setIsUserSearching(false);
                }}
                className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors text-left"
              >
                <img src={u.photoURL} className="w-9 h-9 rounded-full object-cover" referrerPolicy="no-referrer" />
                <div className="min-w-0">
                  <div className="text-sm font-bold truncate">{u.displayName}</div>
                  <div className="text-[10px] text-gray-400 truncate">{getUserSecondaryLabel(u, profile?.uid, t)}</div>
                </div>
              </button>
            )) : (
              <div className="p-4 text-center text-xs text-gray-400">{t('noUsersFound')}</div>
            )}
          </div>
        )}
        {isUserSearching && (
          <div className="fixed inset-0 z-[-1]" onClick={() => setIsUserSearching(false)} />
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('popularPosts')}</h3>
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-black dark:border-white border-t-transparent animate-spin rounded-full" />
            </div>
          ) : (
            trendingPosts.map(post => (
              <PostCard 
                key={post.id} 
                post={post} 
                onOpen={onOpenPost} 
                onOpenProfile={onOpenProfile} 
                onOpenImage={onOpenImage}
                onShowLikes={onShowLikes}
              />
            ))
          )}
        </div>
        
        <aside className="space-y-6">
          <WhoToFollow onOpenProfile={onOpenProfile} />
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm">
            <h3 className="font-bold text-lg mb-4 tracking-tight">{t('communityStats')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-2xl">
                <div className="text-2xl font-bold">1.2k</div>
                <div className="text-[10px] text-gray-400 uppercase tracking-widest">{t('members')}</div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-2xl">
                <div className="text-2xl font-bold">8.5k</div>
                <div className="text-[10px] text-gray-400 uppercase tracking-widest">{t('postsStat')}</div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Bookmarks({ onOpenPost, onOpenProfile, onOpenImage, onShowLikes }: { 
  onOpenPost: (post: Post) => void, 
  onOpenProfile: (uid: string) => void,
  onOpenImage: (url: string) => void,
  onShowLikes: (postId: string) => void,
  key?: string
}) {
  const { profile } = useAuth();
  const { t } = useSettings();
  const [bookmarkedPosts, setBookmarkedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.bookmarks?.length) {
      setBookmarkedPosts([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'posts'), where('__name__', 'in', profile.bookmarks));
    const unsubscribe = onSnapshot(q, (s) => {
      setBookmarkedPosts(s.docs.map(d => ({ id: d.id, ...d.data() } as Post)));
      setLoading(false);
    });
    return unsubscribe;
  }, [profile]);

  return (
    <div className="max-w-xl mx-auto py-20 px-4">
      <h2 className="text-3xl font-bold mb-8 tracking-tight">{t('bookmarks')}</h2>
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-black dark:border-white border-t-transparent animate-spin rounded-full" />
        </div>
      ) : bookmarkedPosts.length > 0 ? (
        <div className="space-y-6">
          {bookmarkedPosts.map(post => (
            <PostCard 
              key={post.id} 
              post={post} 
              onOpen={onOpenPost} 
              onOpenProfile={onOpenProfile} 
              onOpenImage={onOpenImage}
              onShowLikes={onShowLikes}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-gray-200 dark:border-zinc-800">
          <Bookmark size={48} className="mx-auto text-gray-200 dark:text-zinc-800 mb-4" />
          <p className="text-gray-400">{t('bookmarksEmpty')}</p>
        </div>
      )}
    </div>
  );
}

function WhoToFollow({ onOpenProfile }: { onOpenProfile: (uid: string) => void }) {
  const { profile } = useAuth();
  const { t } = useSettings();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [followingUids, setFollowingUids] = useState<string[]>([]);

  useEffect(() => {
    if (!profile) return;
    
    // Get users I'm not following
    const qUsers = query(collection(db, 'users'), limit(20));
    const unsubUsers = onSnapshot(qUsers, (s) => {
      setUsers(s.docs.map(d => d.data() as UserProfile).filter(u => u.uid !== profile.uid));
    });

    const qFollows = query(collection(db, 'follows'), where('followerUid', '==', profile.uid));
    const unsubFollows = onSnapshot(qFollows, (s) => {
      const approved = s.docs
        .map(d => d.data() as Follow)
        .filter(f => f.status === 'approved')
        .map(f => f.followingUid);
      setFollowingUids(approved);
    });

    return () => { unsubUsers(); unsubFollows(); };
  }, [profile]);

  const suggestions = users
    .filter(u => !followingUids.includes(u.uid))
    .slice(0, 3);

  if (suggestions.length === 0) return null;

  const handleFollow = async (targetUid: string) => {
    if (!profile) return;
    await setDoc(doc(db, 'follows', profile.uid + '_' + targetUid), {
      followerUid: profile.uid,
      followingUid: targetUid,
      createdAt: serverTimestamp()
    });
    
    await addDoc(collection(db, 'notifications'), {
      type: 'follow',
      fromUid: profile.uid,
      fromName: profile.displayName,
      fromPhoto: profile.photoURL,
      toUid: targetUid,
      createdAt: serverTimestamp(),
      read: false
    });
  };

  return (
    <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm">
      <h3 className="font-bold text-lg mb-4 tracking-tight">{t('whoToFollow')}</h3>
      <div className="space-y-4">
        {suggestions.map(user => (
          <div key={user.uid} className="flex items-center justify-between gap-2">
            <button 
              onClick={() => onOpenProfile(user.uid)}
              className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity flex-1 min-w-0"
            >
              <img src={user.photoURL} className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
              <div className="min-w-0">
                <div className="text-sm font-bold truncate">{user.displayName}</div>
                <div className="text-[10px] text-gray-400 truncate">{getUserSecondaryLabel(user, profile?.uid, t)}</div>
              </div>
            </button>
            <button 
              onClick={() => handleFollow(user.uid)}
              className="bg-black dark:bg-white text-white dark:text-black px-4 py-1.5 rounded-full text-[10px] font-bold hover:opacity-80 transition-opacity"
            >
              {t('follow')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Navbar({ currentView, setView, darkMode, setDarkMode, onSearchUser }: { 
  currentView: View, 
  setView: (v: View) => void,
  darkMode: boolean,
  setDarkMode: (d: boolean) => void,
  onSearchUser: (uid: string) => void
}) {
  const { t, notificationsEnabled } = useSettings();
  const { logout, profile } = useAuth();
  const { showToast } = useToast();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const lastNotificationId = useRef<string | null>(null);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchResults([]);
    const normalized = normalizeUsername(searchQuery).toLowerCase();
    const qName = query(
      collection(db, 'users'),
      where('displayName', '>=', searchQuery),
      where('displayName', '<=', searchQuery + '\uf8ff'),
      limit(5)
    );
    const qUsername = query(
      collection(db, 'users'),
      where('usernameLower', '>=', normalized),
      where('usernameLower', '<=', normalized + '\uf8ff'),
      limit(5)
    );
    const unsubName = onSnapshot(qName, (s) => {
      const nameResults = s.docs.map(d => d.data() as UserProfile);
      setSearchResults((prev) => {
        const merged = [...nameResults, ...prev].reduce<UserProfile[]>((acc, u) => {
          if (!acc.find(p => p.uid === u.uid)) acc.push(u);
          return acc;
        }, []);
        return merged.slice(0, 7);
      });
    });
    const unsubUsername = onSnapshot(qUsername, (s) => {
      const userResults = s.docs.map(d => d.data() as UserProfile);
      setSearchResults((prev) => {
        const merged = [...userResults, ...prev].reduce<UserProfile[]>((acc, u) => {
          if (!acc.find(p => p.uid === u.uid)) acc.push(u);
          return acc;
        }, []);
        return merged.slice(0, 7);
      });
    });
    return () => { unsubName(); unsubUsername(); };
  }, [searchQuery]);

  useEffect(() => {
    if (!profile || !notificationsEnabled) {
      setUnreadCount(0);
      return;
    }
    const q = query(
      collection(db, 'notifications'), 
      where('toUid', '==', profile.uid),
      where('read', '==', false)
    );
    const unsubscribe = onSnapshot(q, (s) => setUnreadCount(s.size));
    return unsubscribe;
  }, [profile, notificationsEnabled]);

  useEffect(() => {
    if (!profile || !notificationsEnabled) {
      lastNotificationId.current = null;
      return;
    }
    const q = query(
      collection(db, 'notifications'),
      where('toUid', '==', profile.uid),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    const unsubscribe = onSnapshot(q, (s) => {
      const docSnap = s.docs[0];
      if (!docSnap) return;
      const id = docSnap.id;
      if (!lastNotificationId.current) {
        lastNotificationId.current = id;
        return;
      }
      if (id !== lastNotificationId.current) {
        const n = docSnap.data() as Notification;
        const message = n.type === 'like'
          ? t('likeMessage')
          : n.type === 'comment'
            ? t('commentMessage')
            : n.type === 'follow'
              ? t('followMessage')
              : n.type === 'repost'
                ? t('repostMessage')
                : t('interactedMessage');
        showToast(`${n.fromName} ${message}`, 'info');
        lastNotificationId.current = id;
      }
    });
    return unsubscribe;
  }, [profile, notificationsEnabled, showToast, t]);

  useEffect(() => {
    if (!profile) return;
    const q = query(
      collection(db, 'messages'),
      where('receiverUid', '==', profile.uid),
      where('read', '==', false)
    );
    const unsubscribe = onSnapshot(q, (s) => setUnreadMessagesCount(s.size));
    return unsubscribe;
  }, [profile]);

  const navItems = [
    { id: 'feed', icon: Home, label: t('feed') },
    { id: 'explore', icon: Compass, label: t('explore') },
    { id: 'notifications', icon: Bell, label: t('notifications'), badge: notificationsEnabled ? unreadCount : 0 },
    { id: 'bookmarks', icon: Bookmark, label: t('bookmarks') },
    { id: 'messages', icon: MessageSquare, label: t('messages'), badge: unreadMessagesCount },
    { id: 'profile', icon: profile?.photoURL ? () => <img src={profile.photoURL} className="w-6 h-6 rounded-full object-cover" referrerPolicy="no-referrer" /> : User, label: t('profile') },
  ];

  return (
    <>
    <nav className="fixed bottom-0 left-0 right-0 md:top-0 md:bottom-auto bg-white/80 dark:bg-black/80 backdrop-blur-md border-t md:border-t-0 md:border-b border-gray-200 dark:border-gray-800 z-50">
      <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <div className="hidden md:block font-bold text-xl tracking-tighter cursor-pointer" onClick={() => setView('feed')}>ZIMO</div>
        
        <div className="flex-1 max-w-xs relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder={t('searchUsers')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearching(true)}
            className="w-full bg-gray-100 dark:bg-zinc-900 border-none rounded-full py-2 pl-10 pr-4 text-sm focus:ring-1 focus:ring-black dark:focus:ring-white transition-all"
          />
          <AnimatePresence>
            {isSearching && searchQuery.length >= 2 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden z-50"
              >
                {searchResults.length > 0 ? searchResults.map(u => (
                  <button
                    key={u.uid}
                    onClick={() => {
                      onSearchUser(u.uid);
                      setSearchQuery('');
                      setIsSearching(false);
                    }}
                    className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors text-left"
                  >
                    <img src={u.photoURL} className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate">{u.displayName}</div>
                    <div className="text-[10px] text-gray-400 truncate">{getUserSecondaryLabel(u, profile?.uid, t)}</div>
                  </div>
                </button>
                )) : (
                  <div className="p-4 text-center text-xs text-gray-400">{t('noUsersFound')}</div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          {isSearching && (
            <div className="fixed inset-0 z-[-1]" onClick={() => setIsSearching(false)} />
          )}
        </div>

        <div className="flex flex-1 justify-around md:justify-center md:gap-8">
          {navItems.map((item) => {
            const hideOnMobile = item.id === 'notifications';
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id as View)}
                className={cn(
                  "p-2 transition-colors relative",
                  hideOnMobile ? "hidden md:inline-flex" : "inline-flex",
                  currentView === item.id ? "text-black dark:text-white" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                )}
              >
                {typeof item.icon === 'function' ? <item.icon /> : <item.icon size={24} />}
                {item.badge ? (
                  <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] border-2 border-white dark:border-black">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-4">
          {profile?.photoURL && (
            <img src={profile.photoURL} className="w-8 h-8 rounded-full object-cover cursor-pointer hidden md:block" referrerPolicy="no-referrer" onClick={() => setView('profile')} />
          )}
          <button onClick={() => setDarkMode(!darkMode)} className="p-2 text-gray-500 hover:text-black dark:hover:text-white transition-colors">
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button onClick={logout} className="p-2 text-gray-500 hover:text-red-500 transition-colors hidden sm:block">
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </nav>
    <button
      onClick={() => setDarkMode(!darkMode)}
      className="md:hidden fixed top-4 right-16 z-50 p-3 rounded-2xl border bg-white/90 dark:bg-black/90 backdrop-blur-md shadow-lg text-gray-700 dark:text-gray-200 border-gray-200 dark:border-zinc-800"
      aria-label={t('theme')}
    >
      {darkMode ? <Sun size={20} /> : <Moon size={20} />}
    </button>
    <button
      onClick={() => setView('notifications')}
      className={cn(
        "md:hidden fixed top-4 right-4 z-50 p-3 rounded-2xl border bg-white/90 dark:bg-black/90 backdrop-blur-md shadow-lg transition-colors",
        notificationsEnabled ? "border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-gray-200" : "border-gray-100 dark:border-zinc-900 text-gray-300 dark:text-gray-600"
      )}
      aria-label={t('notifications')}
    >
      <div className="relative">
        <Bell size={20} />
        {notificationsEnabled && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] border-2 border-white dark:border-black">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </div>
    </button>
    </>
  );
}

function PostCard({ post, onOpen, onOpenProfile, onHashtagClick, onOpenImage, onShowLikes }: { 
  post: Post, 
  onOpen?: (post: Post) => void, 
  onOpenProfile?: (uid: string) => void, 
  onHashtagClick?: (tag: string) => void, 
  onOpenImage?: (url: string) => void,
  onShowLikes?: (postId: string) => void,
  key?: string 
}) {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const { t } = useSettings();
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [repostedPost, setRepostedPost] = useState<Post | null>(null);
  const [showRepostDialog, setShowRepostDialog] = useState(false);
  const [repostText, setRepostText] = useState('');
  const [isReposting, setIsReposting] = useState(false);
  const isLiked = post.likedBy?.includes(profile?.uid || '');
  const isBookmarked = profile?.bookmarks?.includes(post.id);

  useEffect(() => {
    if (!showComments) return;
    const q = query(collection(db, 'posts', post.id, 'comments'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment)));
    });
    return unsubscribe;
  }, [showComments, post.id]);

  useEffect(() => {
    if (!post.repostId) return;
    const fetchReposted = async () => {
      const d = await getDoc(doc(db, 'posts', post.repostId!));
      if (d.exists()) {
        setRepostedPost({ id: d.id, ...d.data() } as Post);
      }
    };
    fetchReposted();
  }, [post.repostId]);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profile) return;
    try {
      if (isLiked) {
        await updateDoc(doc(db, 'posts', post.id), { likes: post.likes - 1 });
      } else {
        await updateDoc(doc(db, 'posts', post.id), { likes: post.likes + 1 });
        
        // Create notification
        if (post.authorUid !== profile.uid) {
          await addDoc(collection(db, 'notifications'), {
            type: 'like',
            fromUid: profile.uid,
            fromName: profile.displayName,
            fromPhoto: profile.photoURL,
            toUid: post.authorUid,
            postId: post.id,
            createdAt: serverTimestamp(),
            read: false
          });
        }
      }
    } catch (err) {
      console.error("Error liking post:", err);
    }
  };

  const handleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profile) return;
    const userRef = doc(db, 'users', profile.uid);
    try {
      if (isBookmarked) {
        await updateDoc(userRef, {
          bookmarks: arrayRemove(post.id)
        });
        showToast(t('bookmarkRemoved'), "info");
      } else {
        await updateDoc(userRef, {
          bookmarks: arrayUnion(post.id)
        });
        showToast(t('bookmarkAdded'), "success");
      }
    } catch (err) {
      console.error("Error bookmarking post:", err);
      showToast(t('bookmarkFailed'), "error");
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/post/${post.id}`;
    navigator.clipboard.writeText(url);
    showToast(t('shareCopied'), "success");
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!commentText.trim() || !profile) return;

    try {
      const commentData: any = {
        authorUid: profile.uid,
        authorName: profile.displayName,
        authorPhoto: profile.photoURL,
        text: commentText.trim(),
        createdAt: serverTimestamp(),
        likes: 0,
        likedBy: []
      };
      // Add parentId if replying
      if (replyTo) {
        commentData.parentId = replyTo;
      }
      await addDoc(collection(db, 'posts', post.id, 'comments'), commentData);
      
      // Create notification
      const notifyUid = replyTo ? comments.find(c => c.id === replyTo)?.authorUid : post.authorUid;
      if (notifyUid && notifyUid !== profile.uid) {
        await addDoc(collection(db, 'notifications'), {
          type: 'comment',
          fromUid: profile.uid,
          fromName: profile.displayName,
          fromPhoto: profile.photoURL,
          toUid: notifyUid,
          postId: post.id,
          createdAt: serverTimestamp(),
          read: false
        });
      }
      
      setCommentText('');
      setReplyTo(null);
    } catch (err) {
      console.error("Error commenting:", err);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(t('deletePostConfirm'))) {
      try {
        await deleteDoc(doc(db, 'posts', post.id));
        showToast(t('postDeleted'), "info");
      } catch (err) {
        showToast(t('deletePostFailed'), "error");
      }
    }
  };

  const handleUpdate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editContent.trim()) return;
    try {
      await updateDoc(doc(db, 'posts', post.id), { content: editContent.trim() });
      setIsEditing(false);
      showToast(t('updatePostSuccess'), "success");
    } catch (err) {
      showToast(t('updatePostFailed'), "error");
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteDoc(doc(db, 'posts', post.id, 'comments', commentId));
      showToast(t('commentDeleted'), "info");
    } catch (err) {
      showToast(t('commentDeleteFailed'), "error");
    }
  };
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const handleReply = (commentId: string) => {
    setReplyTo(commentId);
  };

  const handleCommentLike = async (commentId: string, currentLikes: number = 0, likedBy: string[] = []) => {
    if (!profile) return;
    try {
      const isLiked = likedBy.includes(profile.uid);
      await updateDoc(doc(db, 'posts', post.id, 'comments', commentId), {
        likes: isLiked ? currentLikes - 1 : currentLikes + 1,
        likedBy: isLiked 
          ? likedBy.filter(uid => uid !== profile.uid)
          : [...likedBy, profile.uid]
      });
    } catch (err) {
      console.error("Error liking comment:", err);
    }
  };

  const handleReport = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(t('reportConfirm'))) {
      try {
        await addDoc(collection(db, 'reports'), {
          postId: post.id,
          reporterUid: profile?.uid,
          authorUid: post.authorUid,
          createdAt: serverTimestamp(),
          status: 'pending'
        });
        showToast(t('reportSuccess'), "success");
      } catch (err) {
        showToast(t('reportFailed'), "error");
      }
    }
  };

  const handleRepost = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profile) return;
    setShowRepostDialog(true);
  };

  const handleConfirmRepost = async () => {
    if (!profile || isReposting) return;
    setIsReposting(true);
    try {
      await addDoc(collection(db, 'posts'), {
        authorUid: profile.uid,
        authorName: profile.displayName,
        authorPhoto: profile.photoURL,
        authorUsername: profile.username ? normalizeUsername(profile.username) : '',
        content: repostText.trim(),
        repostId: post.id,
        createdAt: serverTimestamp(),
        likes: 0,
        likedBy: [],
        repostCount: 0
      });
      
      await firestore.doc(awDb.DB_ID, 'posts', post.id).update({
        repostCount: (post.repostCount || 0) + 1
      });

      if (post.authorUid !== profile.uid) {
        await addDoc(collection(db, 'notifications'), {
          type: 'repost',
          fromUid: profile.uid,
          fromName: profile.displayName,
          fromPhoto: profile.photoURL,
          toUid: post.authorUid,
          postId: post.id,
          createdAt: serverTimestamp(),
          read: false
        });
      }
      
      setShowRepostDialog(false);
      setRepostText('');
      showToast(repostText.trim() ? t('quoteReposted') : t('reposted'), "success");
    } catch (err) {
      console.error("Error reposting:", err);
      showToast(t('repostFailed'), "error");
    } finally {
      setIsReposting(false);
    }
  };

  const handleCloseRepost = () => {
    if (isReposting) return;
    setShowRepostDialog(false);
    setRepostText('');
  };

  const renderContent = (text: string) => {
    const parts = text.split(/(\s+)/);
    return parts.map((part, i) => {
      if (part.startsWith('#') && part.length > 1) {
        return (
          <span 
            key={i} 
            onClick={(e) => {
              e.stopPropagation();
              onHashtagClick?.(part);
            }}
            className="text-blue-500 font-medium hover:underline cursor-pointer"
          >
            {part}
          </span>
        );
      }
      if (part.startsWith('@') && part.length > 1) {
        return (
          <span 
            key={i} 
            onClick={(e) => {
              e.stopPropagation();
              // In a real app, we'd find the user ID by username
              // For now, we'll just highlight it
            }}
            className="text-indigo-500 font-medium hover:underline cursor-pointer"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={() => !isEditing && onOpen?.(post)}
      className={cn(
        "bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm group transition-all",
        onOpen && !isEditing ? "hover:border-gray-300 dark:hover:border-zinc-600 cursor-pointer" : ""
      )}
    >
      {post.repostId && (
        <div className="mb-3 flex items-center gap-2 text-xs text-gray-400">
          <Repeat size={14} />
          <span>{t('repostedLabel')}</span>
        </div>
      )}
      <div className="flex justify-between items-start mb-4">
        <button 
          onClick={(e) => { e.stopPropagation(); onOpenProfile?.(post.authorUid); }}
          className="flex gap-3 text-left hover:opacity-80 transition-opacity"
        >
          <img src={post.authorPhoto || 'https://picsum.photos/seed/user/100/100'} className="w-11 h-11 rounded-full object-cover border border-gray-100 dark:border-zinc-800" referrerPolicy="no-referrer" />
          <div>
            <div className="font-bold text-sm tracking-tight">{post.authorName}</div>
            {post.authorUsername && (
              <div className="text-[10px] text-gray-400">{formatUsername(post.authorUsername)}</div>
            )}
            <div className="text-[11px] text-gray-400 font-medium">
              {post.createdAt ? formatDistanceToNow(post.createdAt.toDate(), { addSuffix: true }) : t('justNow')}
            </div>
          </div>
        </button>
        {profile?.uid === post.authorUid ? (
          <div className="flex gap-1">
            <button 
              onClick={(e) => { e.stopPropagation(); setIsEditing(!isEditing); }} 
              className="p-2 text-gray-300 hover:text-blue-500 transition-all rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20"
            >
              <Edit3 size={16} />
            </button>
            <button onClick={handleDelete} className="p-2 text-gray-300 hover:text-red-500 transition-all rounded-full hover:bg-red-50 dark:hover:bg-red-900/20">
              <Trash2 size={16} />
            </button>
          </div>
        ) : (
          <button 
            onClick={handleReport}
            className="p-2 text-gray-300 hover:text-orange-500 opacity-0 group-hover:opacity-100 transition-all rounded-full hover:bg-orange-50 dark:hover:bg-orange-900/20"
            title={t('reportPost')}
          >
            <Flag size={16} />
          </button>
        )}
      </div>
      
      {post.repostId && repostedPost && (
        <div className="mb-4 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/20">
          <div className="flex items-center gap-2 mb-2">
            <img src={repostedPost.authorPhoto} className="w-6 h-6 rounded-full object-cover" referrerPolicy="no-referrer" />
            <span className="font-bold text-xs">{repostedPost.authorName}</span>
            {repostedPost.authorUsername && (
              <span className="text-[10px] text-gray-400">{formatUsername(repostedPost.authorUsername)}</span>
            )}
            <span className="text-[10px] text-gray-400">
              {repostedPost.createdAt ? formatDistanceToNow(repostedPost.createdAt.toDate(), { addSuffix: true }) : ''}
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
            {repostedPost.content}
          </p>
          {(repostedPost.imageUrls?.[0] || repostedPost.imageUrl) && (
            <img 
              src={repostedPost.imageUrls?.[0] || repostedPost.imageUrl} 
              className="mt-2 w-full h-32 object-cover rounded-xl opacity-50" 
              referrerPolicy="no-referrer" 
            />
          )}
        </div>
      )}

      {isEditing ? (
        <div className="mb-4" onClick={e => e.stopPropagation()}>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full bg-gray-50 dark:bg-zinc-800 p-3 rounded-xl border dark:border-zinc-700 text-sm focus:outline-none"
            rows={3}
          />
          <div className="flex gap-2 mt-2">
            <button onClick={handleUpdate} className="flex-1 bg-black dark:bg-white text-white dark:text-black py-1.5 rounded-lg text-xs font-bold">{t('save')}</button>
            <button onClick={() => setIsEditing(false)} className="flex-1 bg-gray-100 dark:bg-zinc-800 py-1.5 rounded-lg text-xs font-bold">{t('cancel')}</button>
          </div>
        </div>
      ) : (
        <p className="text-[16px] sm:text-[15px] text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed mb-4">
          {renderContent(post.content)}
        </p>
      )}
      
      {post.imageUrls && post.imageUrls.length > 0 && (
        <div className={cn(
          "mb-4 grid gap-2 rounded-2xl overflow-hidden",
          post.imageUrls.length === 1 ? "grid-cols-1" : "grid-cols-2"
        )}>
          {post.imageUrls.map((url, idx) => (
            <div 
              key={idx} 
              className="aspect-square bg-gray-50 dark:bg-zinc-800 border dark:border-zinc-800 cursor-zoom-in overflow-hidden"
              onClick={(e) => { e.stopPropagation(); onOpenImage?.(url); }}
            >
              <img 
                src={url} 
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" 
                referrerPolicy="no-referrer" 
                alt={`Post image ${idx + 1}`}
              />
            </div>
          ))}
        </div>
      )}

      {post.imageUrl && !post.imageUrls && (
        <div 
          className="mb-4 rounded-2xl overflow-hidden border dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 cursor-zoom-in"
          onClick={(e) => { e.stopPropagation(); onOpenImage?.(post.imageUrl!); }}
        >
          <img src={post.imageUrl} className="w-full h-auto max-h-[400px] object-cover hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
        </div>
      )}
      <div className="flex items-center justify-between text-gray-400 border-t dark:border-zinc-800 pt-4">
        <div className="flex items-center gap-6">
          <button 
            onClick={handleLike}
            className={cn(
              "flex items-center gap-1.5 transition-all active:scale-125",
              isLiked ? "text-red-500" : "hover:text-red-500"
            )}
          >
            <motion.div
              animate={isLiked ? { scale: [1, 1.4, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              <Heart size={20} fill={isLiked ? "currentColor" : "none"} />
            </motion.div>
            <span 
              className="text-xs font-bold hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                onShowLikes?.(post.id);
              }}
            >
              {post.likes || 0}
            </span>
          </button>
          <button 
            onClick={handleRepost}
            className="flex items-center gap-1.5 hover:text-green-500 transition-colors"
          >
            <Repeat size={20} />
            <span className="text-xs font-bold">{post.repostCount || 0}</span>
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }}
            className="flex items-center gap-1.5 hover:text-blue-500 transition-colors"
          >
            <MessageCircle size={20} />
            <span className="text-xs font-bold">{comments.length || 0}</span>
          </button>
          <button 
            onClick={handleShare}
            className="flex items-center gap-1.5 hover:text-green-500 transition-colors"
          >
            <Share2 size={20} />
          </button>
        </div>
        <button 
          onClick={handleBookmark}
          className={cn(
            "p-2 rounded-full transition-all active:scale-125",
            isBookmarked ? "text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20" : "hover:bg-gray-100 dark:hover:bg-zinc-800"
          )}
        >
          <Bookmark size={20} fill={isBookmarked ? "currentColor" : "none"} />
        </button>
      </div>

      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t dark:border-zinc-800 space-y-4">
              {comments.filter(c => !c.parentId).map(comment => (
                <div key={comment.id} className="flex gap-3 group/comment">
                  <img src={comment.authorPhoto} className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                  <div className="flex-1 relative">
                    <div className="bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-2xl">
                      <div className="font-semibold text-xs mb-1">{comment.authorName}</div>
                      <p className="text-sm dark:text-gray-300">{comment.text}</p>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <button 
                        onClick={() => handleCommentLike(comment.id, comment.likes || 0, comment.likedBy || [])}
                        className={`flex items-center gap-1 text-xs ${(comment.likedBy || []).includes(profile?.uid || '') ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}
                      >
                        <Heart size={12} fill={(comment.likedBy || []).includes(profile?.uid || '') ? 'currentColor' : 'none'} />
                        <span>{comment.likes || 0}</span>
                      </button>
                      <button 
                        onClick={() => handleReply(comment.id)}
                        className="text-xs text-gray-400 hover:text-blue-500"
                      >
                        {t('reply')}
                      </button>
                    </div>
                    {(profile?.uid === comment.authorUid || profile?.uid === post.authorUid) && (
                      <button 
                        onClick={() => handleDeleteComment(comment.id)}
                        className="absolute -right-2 -top-2 p-1.5 bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-full text-gray-400 hover:text-red-500 opacity-0 group-hover/comment:opacity-100 transition-all shadow-sm"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              
              <form onSubmit={handleComment} className="flex gap-2 mt-4">
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={t('commentPlaceholder')}
                  className="flex-1 bg-gray-50 dark:bg-zinc-800 rounded-full px-4 py-2 text-sm focus:outline-none"
                />
                <button type="submit" disabled={!commentText.trim()} className="p-2 text-black dark:text-white disabled:opacity-30">
                  <Send size={18} />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRepostDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={handleCloseRepost}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b dark:border-zinc-800 flex justify-between items-center bg-gray-50/50 dark:bg-zinc-800/50">
                <h3 className="font-bold">{t('repostDialog')}</h3>
                <button onClick={handleCloseRepost} className="p-2 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-full transition-colors">
                  <X size={18} />
                </button>
              </div>
              <div className="p-4">
                <textarea
                  value={repostText}
                  onChange={(e) => setRepostText(e.target.value)}
                  placeholder={t('addCommentOptional')}
                  className="w-full bg-gray-50 dark:bg-zinc-800 p-3 rounded-2xl border dark:border-zinc-700 text-sm focus:outline-none min-h-[110px]"
                />
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={handleCloseRepost}
                    disabled={isReposting}
                    className="flex-1 bg-gray-100 dark:bg-zinc-800 py-2 rounded-xl text-xs font-bold disabled:opacity-50"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    onClick={handleConfirmRepost}
                    disabled={isReposting}
                    className="flex-1 bg-black dark:bg-white text-white dark:text-black py-2 rounded-xl text-xs font-bold disabled:opacity-50"
                  >
                    {isReposting ? t('reposting') : (repostText.trim() ? t('quoteRepost') : t('repostAction'))}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Feed({ onOpenPost, onOpenProfile, searchHashtag: externalHashtag, onClearHashtag, onOpenImage, onShowLikes }: { 
  onOpenPost: (post: Post) => void, 
  onOpenProfile: (uid: string) => void, 
  searchHashtag?: string | null, 
  onClearHashtag?: () => void,
  onOpenImage: (url: string) => void,
  onShowLikes: (postId: string) => void,
  key?: string 
}) {
  const { t } = useSettings();
  const [posts, setPosts] = useState<Post[]>([]);
  const [content, setContent] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);
  const [feedTab, setFeedTab] = useState<'global' | 'following'>('global');
  const [searchHashtag, setSearchHashtag] = useState<string | null>(null);
  const [followingUids, setFollowingUids] = useState<string[]>([]);
  const [privateAccountUids, setPrivateAccountUids] = useState<string[]>([]);
  const { profile } = useAuth();

  useEffect(() => {
    if (externalHashtag) {
      setSearchHashtag(externalHashtag);
    }
  }, [externalHashtag]);

  const handleClearHashtag = () => {
    setSearchHashtag(null);
    onClearHashtag?.();
  };

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'follows'), where('followerUid', '==', profile.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Only include approved follows
      const approved = snapshot.docs
        .map(doc => doc.data() as Follow)
        .filter(f => f.status === 'approved')
        .map(f => f.followingUid);
      setFollowingUids(approved);
    });
    return unsubscribe;
  }, [profile]);

  // Load all users to get isPrivate status
  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const privateUids = snapshot.docs
        .map(doc => doc.data() as UserProfile)
        .filter(u => u.isPrivate === true)
        .map(u => u.uid);
      console.log('Private accounts:', privateUids);
      setPrivateAccountUids(privateUids);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(100));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let allPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      
      // Filter blocked users
      if (profile?.blockedUsers && profile.blockedUsers.length > 0) {
        allPosts = allPosts.filter(p => !profile.blockedUsers?.includes(p.authorUid));
      }

      // In 'all' tab: show all posts from public accounts
      if (feedTab === 'all') {
        allPosts = allPosts.filter(p => {
          // Always show own posts
          if (p.authorUid === profile?.uid) return true;
          // Hide if author is in private list (meaning isPrivate)
          if (privateAccountUids.includes(p.authorUid)) return false;
          // Show all other posts
          return true;
        });
      }

      // Filter by following if tab is following - now only approved follows are in followingUids
      if (feedTab === 'following') {
        allPosts = allPosts.filter(p => followingUids.includes(p.authorUid) || p.authorUid === profile?.uid);
      }

      // Filter by hashtag if search is active
      if (searchHashtag) {
        allPosts = allPosts.filter(p => p.content.toLowerCase().includes(searchHashtag.toLowerCase()));
      }

      setPosts(allPosts.slice(0, 50));
    });
    return unsubscribe;
  }, [feedTab, followingUids, profile?.blockedUsers, searchHashtag, privateAccountUids]);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !profile || uploading) return;

    try {
      await addDoc(collection(db, 'posts'), {
        authorUid: profile.uid,
        authorName: profile.displayName,
        authorPhoto: profile.photoURL,
        authorUsername: profile.username ? normalizeUsername(profile.username) : '',
        content: content.trim(),
        imageUrls: imageUrls.filter(url => url.trim() !== ''),
        createdAt: serverTimestamp(),
        likes: 0,
        likedBy: []
      });
      setContent('');
      setImageUrls([]);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'posts');
      setError(t('postFailed').replace('{error}', t('genericError')));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !profile) return;

    setUploading(true);
    setUploadProgress(0);
    const newUrls: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const { dataUrl, bytes } = await readAndCompressImage(file);
        if (bytes > MAX_IMAGE_BYTES) {
          setError(t('imageTooLarge'));
          continue;
        }
        newUrls.push(dataUrl);
        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      }
      setImageUrls(prev => [...prev, ...newUrls]);
    } catch (err) {
      const msg = getImageErrorMessage(err, t);
      setError(`${t('uploadFailed')}: ${msg}`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const addImageUrl = () => {
    const value = imageUrlInput.trim();
    if (!value) return;
    if (!/^https?:\/\/.+/i.test(value)) {
      setError(t('urlInvalid'));
      return;
    }
    setImageUrls(prev => [...prev, value]);
    setImageUrlInput('');
  };

  const removeImageUrl = (index: number) => {
    setImageUrls(prev => prev.filter((_, i) => i !== index));
  };

  const clearImages = () => {
    setImageUrls([]);
    if (uploading) {
      // We can't easily cancel the uploadTask without keeping a ref to it, 
      // but we can at least clear the UI state.
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const getTrendingHashtags = () => {
    const counts: Record<string, number> = {};
    posts.forEach(p => {
      const tags = p.content.match(/#[a-zA-Z0-9_]+/g);
      if (tags) {
        tags.forEach(tag => {
          counts[tag] = (counts[tag] || 0) + 1;
        });
      }
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  };

  const trending = getTrendingHashtags();

  return (
    <div className="max-w-4xl mx-auto py-20 px-4 flex flex-col md:flex-row gap-8">
      <div className="flex-1 max-w-xl">
        {searchHashtag && (
          <div className="mb-6 flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <span className="font-bold text-lg">#{searchHashtag.replace('#', '')}</span>
              <span className="text-sm opacity-70">{t('results')}</span>
            </div>
            <button 
              onClick={handleClearHashtag}
              className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl text-red-600 dark:text-red-400 text-sm font-medium flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-600 dark:bg-red-400 rounded-full animate-pulse" />
              {error}
            </div>
            <button 
              onClick={() => setError(null)}
              className="text-xs underline hover:no-underline opacity-70"
            >
              {t('dismiss')}
            </button>
          </div>
        )}

        {uploading && (
          <div className="mb-6 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm">
            <div className="flex justify-between text-xs font-medium mb-2">
              <span className="text-gray-500">{t('uploadingImages')}</span>
              <span>{Math.round(uploadProgress)}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${uploadProgress}%` }}
                className="h-full bg-black dark:bg-white"
              />
            </div>
          </div>
        )}

        <div className="flex gap-4 mb-8 border-b dark:border-zinc-800">
          <button 
            onClick={() => setFeedTab('global')}
            className={cn(
              "pb-2 px-2 text-sm font-semibold transition-all",
              feedTab === 'global' ? "border-b-2 border-black dark:border-white text-black dark:text-white" : "text-gray-400"
            )}
          >
            {t('global')}
          </button>
          <button 
            onClick={() => setFeedTab('following')}
            className={cn(
              "pb-2 px-2 text-sm font-semibold transition-all",
              feedTab === 'following' ? "border-b-2 border-black dark:border-white text-black dark:text-white" : "text-gray-400"
            )}
          >
            {t('followingTab')}
          </button>
        </div>

        <form onSubmit={handlePost} className="mb-8 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t('postPlaceholder')}
            className="w-full bg-transparent resize-none focus:outline-none text-lg min-h-[100px]"
            maxLength={1000}
          />
          
          {imageUrls.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-2 mb-4">
              {imageUrls.map((url, idx) => (
                <div key={idx} className="relative group">
                  <img src={url} className="w-full h-32 object-cover rounded-xl border dark:border-zinc-800" referrerPolicy="no-referrer" />
                  <button 
                    type="button"
                    onClick={() => removeImageUrl(idx)}
                    className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3 mt-4 border-t border-gray-50 dark:border-zinc-800 pt-4">
            <div className="flex items-center gap-2">
              <label className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors flex items-center gap-1 cursor-pointer">
                <ImageIcon size={20} />
                <input 
                  type="file" 
                  multiple 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleFileChange}
                  disabled={uploading}
                />
                {imageUrls.length > 0 && <span className="text-xs font-bold">{imageUrls.length}</span>}
              </label>
              {imageUrls.length > 0 && !uploading && (
                <button 
                  type="button"
                  onClick={clearImages}
                  className="text-[10px] font-bold uppercase tracking-widest text-red-500 hover:underline"
                >
                {t('clear')}
                </button>
              )}
              {uploading && <div className="w-4 h-4 border-2 border-black dark:border-white border-t-transparent animate-spin rounded-full" />}
              <span className="text-xs text-gray-400">{content.length}/1000</span>
            </div>

            {!STORAGE_ENABLED && (
              <div className="flex gap-2">
                <input
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  placeholder={t('imageUrlPlaceholder')}
                  className="flex-1 bg-gray-50 dark:bg-zinc-800 rounded-full px-4 py-2 text-xs focus:outline-none border dark:border-zinc-700"
                />
                <button
                  type="button"
                  onClick={addImageUrl}
                  className="px-4 py-2 rounded-full text-xs font-bold border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800"
                >
                  {t('add')}
                </button>
              </div>
            )}

            <div className="flex justify-end">
            <button 
              type="submit"
              disabled={!content.trim() || uploading}
              className="bg-black dark:bg-white text-white dark:text-black px-6 py-2 rounded-full font-medium disabled:opacity-50 transition-opacity"
            >
              {uploading ? t('uploading') : t('post')}
            </button>
            </div>
          </div>
        </form>

        <div className="space-y-6">
          <AnimatePresence mode="popLayout">
            {posts.map((post) => (
              <PostCard 
                key={post.id} 
                post={post} 
                onOpen={onOpenPost} 
                onOpenProfile={onOpenProfile}
                onHashtagClick={(tag) => setSearchHashtag(tag)}
                onOpenImage={onOpenImage}
                onShowLikes={onShowLikes}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>

      <aside className="hidden lg:block w-64 space-y-6">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm">
          <h3 className="font-bold text-lg mb-4 tracking-tight">{t('trending')}</h3>
          <div className="space-y-4">
            {trending.length > 0 ? trending.map(([tag, count]) => (
              <div 
                key={tag} 
                onClick={() => setSearchHashtag(tag)}
                className="group cursor-pointer"
              >
                <div className="text-sm font-bold text-black dark:text-white group-hover:underline">{tag}</div>
                <div className="text-[10px] text-gray-400 uppercase tracking-widest">
                  {t('postsCount').replace('{count}', String(count))}
                </div>
              </div>
            )) : (
              <div className="text-sm text-gray-400">{t('noTrends')}</div>
            )}
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-3xl border border-blue-100 dark:border-blue-900/20">
          <h3 className="font-bold text-sm mb-2 text-blue-600 dark:text-blue-400">{t('proTip')}</h3>
          <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
            {t('proTipText')}
          </p>
        </div>

        <WhoToFollow onOpenProfile={onOpenProfile} />
      </aside>
    </div>
  );
}

function Profile({ userId, onOpenPost, onOpenProfile, onHashtagClick, onBack, onOpenImage, onShowLikes }: { 
  userId?: string, 
  onOpenPost: (post: Post) => void, 
  onOpenProfile?: (uid: string) => void, 
  onHashtagClick?: (tag: string) => void, 
  onBack?: () => void,
  onOpenImage: (url: string) => void,
  onShowLikes: (postId: string) => void,
  key?: string
}) {
  const { darkMode, setDarkMode, language, setLanguage, notificationsEnabled, setNotificationsEnabled, toastsEnabled, setToastsEnabled, t } = useSettings();
  const { profile: currentProfile, logout } = useAuth();
  const { showToast } = useToast();
  const [targetProfile, setTargetProfile] = useState<UserProfile | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [newBio, setNewBio] = useState('');
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editBirthdate, setEditBirthdate] = useState('');
  const [editHideEmail, setEditHideEmail] = useState(false);
  const [editIsPrivate, setEditIsPrivate] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission === 'granted';
    }
    return false;
  });
  const [stats, setStats] = useState({ followers: 0, following: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'posts' | 'followers' | 'following' | 'settings'>('posts');
  const [followerProfiles, setFollowerProfiles] = useState<UserProfile[]>([]);
  const [followingProfiles, setFollowingProfiles] = useState<UserProfile[]>([]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const effectiveUid = userId || currentProfile?.uid;
  const isOwnProfile = currentProfile?.uid === effectiveUid;

  useEffect(() => {
    if (!effectiveUid) return;
    setLoading(true);

    const fetchProfile = async () => {
      const docRef = doc(db, 'users', effectiveUid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        setTargetProfile(data);
        setNewBio(data.bio || '');
      }
    };

    fetchProfile();

    const q = query(
      collection(db, 'posts'), 
      where('authorUid', '==', effectiveUid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUserPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post)));
      setLoading(false);
    });

    const followersQ = query(collection(db, 'follows'), where('followingUid', '==', effectiveUid));
    const followingQ = query(collection(db, 'follows'), where('followerUid', '==', effectiveUid));
    
    const unsubFollowing = onSnapshot(followingQ, (s) => {
      setStats(prev => ({ ...prev, following: s.size }));
      const uids = s.docs.map(d => (d.data() as Follow).followingUid);
      if (uids.length > 0) {
        const q = query(collection(db, 'users'), where('uid', 'in', uids.slice(0, 10)));
        getDocs(q).then(snap => setFollowingProfiles(snap.docs.map(d => d.data() as UserProfile)));
      } else {
        setFollowingProfiles([]);
      }
    });

    const unsubFollowers = onSnapshot(followersQ, (s) => {
      setStats(prev => ({ ...prev, followers: s.size }));
      const uids = s.docs.map(d => (d.data() as Follow).followerUid);
      if (uids.length > 0) {
        const q = query(collection(db, 'users'), where('uid', 'in', uids.slice(0, 10)));
        getDocs(q).then(snap => setFollowerProfiles(snap.docs.map(d => d.data() as UserProfile)));
      } else {
        setFollowerProfiles([]);
      }
    });

    if (currentProfile && effectiveUid !== currentProfile.uid) {
      const followRef = doc(db, 'follows', currentProfile.uid + '_' + effectiveUid);
      const unsubFollowStatus = onSnapshot(followRef, (doc) => {
        if (!doc.exists()) {
          setIsFollowing(false);
        } else {
          const data = doc.data();
          // For private accounts, need approved status to be following
          const isApproved = data?.status === 'approved' || !targetProfile?.isPrivate;
          setIsFollowing(isApproved);
        }
      });
      return () => {
        unsubscribe();
        unsubFollowers();
        unsubFollowing();
        unsubFollowStatus();
      };
    }

    return () => {
      unsubscribe();
      unsubFollowers();
      unsubFollowing();
    };
  }, [effectiveUid, currentProfile]);

  useEffect(() => {
    if (!isOwnProfile || !targetProfile) return;
    setEditName(targetProfile.displayName || '');
    setEditBio(targetProfile.bio || '');
    setEditCity(targetProfile.city || '');
    setEditBirthdate(targetProfile.birthdate || '');
    setEditHideEmail(!!targetProfile.hideEmail);
    setEditIsPrivate(!!targetProfile.isPrivate);
  }, [isOwnProfile, targetProfile?.uid]);

  const handleUpdateBio = async () => {
    if (!currentProfile) return;
    try {
      await updateDoc(doc(db, 'users', currentProfile.uid), { bio: newBio });
      setTargetProfile(prev => prev ? { ...prev, bio: newBio } : null);
      setEditBio(newBio);
      setIsEditing(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${currentProfile.uid}`);
      setError(t('bioUpdateFailed').replace('{error}', t('genericError')));
    }
  };

  const syncAuthorPosts = async (updates: Partial<Post>) => {
    if (!currentProfile) return;
    const q = query(collection(db, 'posts'), where('authorUid', '==', currentProfile.uid));
    const snap = await getDocs(q);
    if (snap.empty) return;
    await Promise.all(snap.docs.map(d => updateDoc(d.ref, updates)));
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentProfile) return;
    setUploadingAvatar(true);
    setAvatarProgress(0);

    try {
      const { dataUrl, bytes } = await readAndCompressImage(file);
      if (bytes > MAX_IMAGE_BYTES) {
        setError(t('imageTooLarge'));
        return;
      }
      const userDocRef = doc(db, 'users', currentProfile.uid);
      await updateDoc(userDocRef, { photoURL: dataUrl });
      setTargetProfile(prev => prev ? { ...prev, photoURL: dataUrl } : null);
      await syncAuthorPosts({ authorPhoto: dataUrl });
      setAvatarProgress(100);
    } catch (err) {
      const msg = getImageErrorMessage(err, t);
      setError(t('avatarUploadFailed').replace('{error}', msg));
    } finally {
      setUploadingAvatar(false);
      setAvatarProgress(0);
    }
  };

  const [uploadingHeader, setUploadingHeader] = useState(false);
  const [headerProgress, setHeaderProgress] = useState(0);

  const handleHeaderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentProfile) return;
    setUploadingHeader(true);
    setHeaderProgress(0);

    try {
      const { dataUrl, bytes } = await readAndCompressImage(file);
      if (bytes > MAX_IMAGE_BYTES) {
        setError(t('imageTooLarge'));
        return;
      }
      const userDocRef = doc(db, 'users', currentProfile.uid);
      await updateDoc(userDocRef, { headerURL: dataUrl });
      setTargetProfile(prev => prev ? { ...prev, headerURL: dataUrl } : null);
      setHeaderProgress(100);
    } catch (err) {
      const msg = getImageErrorMessage(err, t);
      setError(t('headerUploadFailed').replace('{error}', msg));
    } finally {
      setUploadingHeader(false);
      setHeaderProgress(0);
    }
  };

  const handleSaveProfile = async () => {
    if (!currentProfile) return;
    if (!editName.trim()) {
      setError(t('namePlaceholder'));
      return;
    }
    setSavingProfile(true);
    try {
      const updates = {
        displayName: editName.trim(),
        bio: editBio.trim(),
        city: editCity.trim(),
        birthdate: editBirthdate || '',
        hideEmail: editHideEmail,
        isPrivate: editIsPrivate
      };
      await updateDoc(doc(db, 'users', currentProfile.uid), updates);
      setTargetProfile(prev => prev ? { ...prev, ...updates } : null);
      setNewBio(editBio.trim());
      if (currentProfile.displayName !== editName.trim()) {
        await syncAuthorPosts({ authorName: editName.trim() });
      }
      showToast(t('profileSaved'), 'success');
    } catch (err) {
      showToast(t('genericError'), 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleFollow = async () => {
    if (!currentProfile || !effectiveUid) return;
    const followId = currentProfile.uid + '_' + effectiveUid;
    if (isFollowing) {
      await deleteDoc(doc(db, 'follows', followId));
    } else {
      // If target account is private, create a pending request instead of direct follow
      const status = targetProfile?.isPrivate ? 'pending' : 'approved';
      await setDoc(doc(db, 'follows', followId), {
        followerUid: currentProfile.uid,
        followingUid: effectiveUid,
        status,
        createdAt: serverTimestamp()
      });
      
      // Notification - for both private and public accounts
      await addDoc(collection(db, 'notifications'), {
        type: targetProfile?.isPrivate ? 'follow_request' : 'follow',
        fromUid: currentProfile.uid,
        fromName: currentProfile.displayName,
        fromPhoto: currentProfile.photoURL,
        toUid: effectiveUid,
        createdAt: serverTimestamp(),
        read: false
      });
      
      if (targetProfile?.isPrivate) {
        showToast(t('followRequested'), "info");
      }
    }
  };

  const handleBlock = async () => {
    if (!currentProfile || !targetProfile) return;
    const isBlocked = currentProfile.blockedUsers?.includes(targetProfile.uid);
    
    if (isBlocked) {
      if (window.confirm(t('unblockConfirm').replace('{name}', targetProfile.displayName))) {
        try {
          await updateDoc(doc(db, 'users', currentProfile.uid), {
            blockedUsers: arrayRemove(targetProfile.uid)
          });
          showToast(t('unblockedToast').replace('{name}', targetProfile.displayName), "success");
        } catch (err) {
          showToast(t('unblockFailed'), "error");
        }
      }
    } else {
      if (window.confirm(t('blockConfirm').replace('{name}', targetProfile.displayName))) {
        try {
          await updateDoc(doc(db, 'users', currentProfile.uid), {
            blockedUsers: arrayUnion(targetProfile.uid)
          });
          showToast(t('blockedToast').replace('{name}', targetProfile.displayName), "info");
          if (isFollowing) handleFollow(); // Unfollow if blocking
        } catch (err) {
          showToast(t('blockFailed'), "error");
        }
      }
    }
  };

  if (loading) return (
    <div className="max-w-xl mx-auto py-40 flex justify-center">
      <div className="w-6 h-6 border-2 border-black dark:border-white border-t-transparent animate-spin rounded-full" />
    </div>
  );

  if (!targetProfile) return <div className="text-center py-40">{t('userNotFound')}</div>;
  const age = getAgeFromBirthdate(targetProfile.birthdate);
  const editAge = getAgeFromBirthdate(editBirthdate);
  const birthdateLabel = formatBirthdateWithAge(targetProfile.birthdate, t);
  const profileMetaParts = [
    birthdateLabel,
    targetProfile.city?.trim() || ''
  ].filter(Boolean);
  const usernameDisplay = formatUsername(targetProfile.username);
  const emailDisplay = getEmailDisplay(targetProfile, currentProfile?.uid, t);

  return (
    <div className="max-w-xl mx-auto py-20 px-4">
      {error && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl text-red-600 dark:text-red-400 text-sm font-medium shadow-xl flex items-center justify-between gap-4 backdrop-blur-md min-w-[300px]">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-600 dark:bg-red-400 rounded-full animate-pulse" />
            {error}
          </div>
          <button 
            onClick={() => setError(null)}
            className="text-xs underline hover:no-underline opacity-70 whitespace-nowrap"
          >
            {t('dismiss')}
          </button>
        </div>
      )}
      
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-black dark:hover:text-white mb-6 transition-colors group">
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">{t('back')}</span>
        </button>
      )}

      <div className="relative mb-16">
        <div className="h-40 w-full bg-gray-100 dark:bg-zinc-800 rounded-3xl overflow-hidden relative group border border-gray-100 dark:border-zinc-800 shadow-sm">
          {targetProfile.headerURL ? (
            <img src={targetProfile.headerURL} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-zinc-800 dark:to-zinc-900" />
          )}
          {isOwnProfile && (
            <label className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity backdrop-blur-[2px]">
              <div className="bg-white/20 p-2 rounded-full backdrop-blur-md border border-white/30">
                <Camera size={20} className="text-white" />
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handleHeaderChange} disabled={uploadingHeader} />
            </label>
          )}
          {uploadingHeader && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="w-6 h-6 border-2 border-white border-t-transparent animate-spin rounded-full mb-2" />
              <span className="text-[10px] text-white font-bold">{Math.round(headerProgress)}%</span>
            </div>
          )}
        </div>

        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2">
          <div className="relative w-24 h-24 group">
            <img 
              src={targetProfile.photoURL} 
              className={cn(
                "w-24 h-24 rounded-full border-4 border-white dark:border-zinc-900 shadow-lg object-cover transition-opacity",
                uploadingAvatar ? "opacity-50" : ""
              )} 
              referrerPolicy="no-referrer" 
            />
            {isOwnProfile && (
              <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                <ImageIcon size={24} className="text-white" />
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleAvatarChange}
                  disabled={uploadingAvatar}
                />
              </label>
            )}
            {uploadingAvatar && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm rounded-full">
                <div className="w-8 h-8 border-2 border-white border-t-transparent animate-spin rounded-full mb-2" />
                <span className="text-[10px] text-white font-bold">{Math.round(avatarProgress)}%</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {isOwnProfile && (
        <div className="mb-8" />
      )}

      <div className="text-center mb-12">
        <h1 className="text-2xl font-bold tracking-tight">{targetProfile.displayName}</h1>
        {usernameDisplay && (
          <p className="text-gray-500 text-sm mt-1">{usernameDisplay}</p>
        )}
        {emailDisplay && (
          <p className="text-[11px] text-gray-400 mt-1">{emailDisplay}</p>
        )}
        {profileMetaParts.length > 0 && (
          <p className="text-[11px] text-gray-400 mt-2">
            {profileMetaParts.join(' · ')}
          </p>
        )}
        
        {isOwnProfile ? (
          isEditing ? (
            <div className="mt-4 max-w-xs mx-auto">
              <textarea
                value={newBio}
                onChange={(e) => setNewBio(e.target.value)}
                className="w-full p-2 rounded-lg border dark:bg-zinc-900 dark:border-zinc-800 text-sm"
                placeholder={t('bioPlaceholder')}
              />
              <div className="flex gap-2 mt-2">
                <button onClick={handleUpdateBio} className="flex-1 bg-black dark:bg-white text-white dark:text-black py-1 rounded-lg text-sm font-bold">{t('save')}</button>
                <button onClick={() => setIsEditing(false)} className="flex-1 bg-gray-100 dark:bg-zinc-800 py-1 rounded-lg text-sm font-bold">{t('cancel')}</button>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-gray-700 dark:text-gray-300 italic">"{targetProfile.bio || t('noBio')}"</p>
              <button onClick={() => setIsEditing(true)} className="text-xs text-blue-500 mt-2 hover:underline">{t('editBio')}</button>
            </div>
          )
        ) : (
          <div className="mt-6 flex flex-col items-center gap-4">
            <p className="text-gray-700 dark:text-gray-300 italic">"{targetProfile.bio || t('noBio')}"</p>
            <div className="flex gap-2">
              <button 
                onClick={handleFollow}
                className={cn(
                  "px-8 py-2 rounded-full font-bold transition-all",
                  isFollowing 
                    ? "bg-gray-100 dark:bg-zinc-800 text-black dark:text-white border border-gray-200 dark:border-zinc-700" 
                    : "bg-black dark:bg-white text-white dark:text-black"
                )}
              >
                {isFollowing ? t('followingBtn') : t('follow')}
              </button>
              <button 
                onClick={handleBlock}
                className={cn(
                  "px-4 py-2 rounded-full font-bold transition-all text-xs",
                  currentProfile?.blockedUsers?.includes(targetProfile.uid)
                    ? "bg-red-500 text-white"
                    : "bg-gray-100 dark:bg-zinc-800 text-gray-400 hover:text-red-500"
                )}
              >
                {currentProfile?.blockedUsers?.includes(targetProfile.uid) ? t('blocked') : t('block')}
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 flex justify-center gap-12 border-y border-gray-100 dark:border-zinc-800 py-4 flex-wrap">
          <button 
            onClick={() => setActiveTab('posts')}
            className={cn(
              "text-center transition-all hover:scale-105",
              activeTab === 'posts' ? "opacity-100" : "opacity-50"
            )}
          >
            <div className="font-bold text-lg">{userPosts.length}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-widest">{t('posts')}</div>
          </button>
          <button 
            onClick={() => setActiveTab('followers')}
            className={cn(
              "text-center transition-all hover:scale-105",
              activeTab === 'followers' ? "opacity-100" : "opacity-50"
            )}
          >
            <div className="font-bold text-lg">{stats.followers}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-widest">{t('followers')}</div>
          </button>
          <button 
            onClick={() => setActiveTab('following')}
            className={cn(
              "text-center transition-all hover:scale-105",
              activeTab === 'following' ? "opacity-100" : "opacity-50"
            )}
          >
            <div className="font-bold text-lg">{stats.following}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-widest">{t('following')}</div>
          </button>
          {isOwnProfile && (
            <button 
              onClick={() => setActiveTab('settings')}
              className={cn(
                "text-center transition-all hover:scale-105",
                activeTab === 'settings' ? "opacity-100" : "opacity-50"
              )}
            >
              <div className="font-bold text-lg">{t('settingsShort')}</div>
              <div className="text-[10px] text-gray-400 uppercase tracking-widest">{t('settings')}</div>
            </button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'posts' && (
          <motion.div 
            key="posts"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 gap-4"
          >
            {/* Show private message for private accounts that viewer can't see */}
            {!isOwnProfile && targetProfile?.isPrivate && !isFollowing && (
              <div className="text-center py-20 text-gray-400">
                <div className="text-lg font-bold mb-2">{t('privateAccount')}</div>
                <div className="text-sm">{t('privateAccountHint')}</div>
              </div>
            )}
            {userPosts.filter(p => isOwnProfile || !targetProfile?.isPrivate || isFollowing).map(post => (
              <PostCard 
                key={post.id} 
                post={post} 
                onOpen={onOpenPost} 
                onOpenProfile={onBack ? (uid) => onOpenProfile?.(uid) : undefined} 
                onHashtagClick={onHashtagClick}
                onOpenImage={onOpenImage}
                onShowLikes={onShowLikes}
              />
            ))}
            {/* Only show no posts message if allowed to see */}
            {(isOwnProfile || !targetProfile?.isPrivate || isFollowing) && userPosts.length === 0 && (
              <div className="text-center py-20 text-gray-400">{t('noPosts')}</div>
            )}
          </motion.div>
        )}

        {activeTab === 'followers' && (
          <motion.div 
            key="followers"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {followerProfiles.map(u => (
              <div key={u.uid} className="flex items-center justify-between bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800">
                <button 
                  onClick={() => onOpenProfile?.(u.uid)}
                  className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                >
                  <img src={u.photoURL} className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                  <div className="text-left">
                    <div className="font-bold text-sm">{u.displayName}</div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-widest">{getUserSecondaryLabel(u, currentProfile?.uid, t)}</div>
                  </div>
                </button>
              </div>
            ))}
            {followerProfiles.length === 0 && (
              <div className="text-center py-20 text-gray-400">{t('noFollowers')}</div>
            )}
          </motion.div>
        )}

        {activeTab === 'following' && (
          <motion.div 
            key="following"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {followingProfiles.map(u => (
              <div key={u.uid} className="flex items-center justify-between bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800">
                <button 
                  onClick={() => onOpenProfile?.(u.uid)}
                  className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                >
                  <img src={u.photoURL} className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                  <div className="text-left">
                    <div className="font-bold text-sm">{u.displayName}</div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-widest">{getUserSecondaryLabel(u, currentProfile?.uid, t)}</div>
                  </div>
                </button>
              </div>
            ))}
            {followingProfiles.length === 0 && (
              <div className="text-center py-20 text-gray-400">{t('noFollowing')}</div>
            )}
          </motion.div>
        )}

        {activeTab === 'settings' && isOwnProfile && (
          <motion.div 
            key="settings"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-100 dark:border-zinc-800">
              <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-3">{t('profileInfo')}</div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest">{t('displayNameLabel')}</label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full mt-2 bg-gray-50 dark:bg-zinc-800 p-3 rounded-2xl border dark:border-zinc-700 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest">{t('bioLabel')}</label>
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    rows={3}
                    className="w-full mt-2 bg-gray-50 dark:bg-zinc-800 p-3 rounded-2xl border dark:border-zinc-700 text-sm focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 uppercase tracking-widest">{t('birthdateLabel')}</label>
                    <input
                      type="date"
                      value={editBirthdate}
                      onChange={(e) => setEditBirthdate(e.target.value)}
                      className="w-full mt-2 bg-gray-50 dark:bg-zinc-800 p-3 rounded-2xl border dark:border-zinc-700 text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 uppercase tracking-widest">{t('cityLabel')}</label>
                    <input
                      value={editCity}
                      onChange={(e) => setEditCity(e.target.value)}
                      className="w-full mt-2 bg-gray-50 dark:bg-zinc-800 p-3 rounded-2xl border dark:border-zinc-700 text-sm focus:outline-none"
                    />
                  </div>
                </div>
                {editAge !== null && (
                  <div className="text-[11px] text-gray-400">
                    {t('ageYears').replace('{age}', String(editAge))}
                  </div>
                )}
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-gray-100 dark:border-zinc-800 p-3">
                  <div>
                    <div className="text-sm font-bold">{t('hideEmailLabel')}</div>
                    <div className="text-[11px] text-gray-400">{t('hideEmailHint')}</div>
                  </div>
                  <button
                    onClick={() => setEditHideEmail(!editHideEmail)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-bold border transition-colors",
                      editHideEmail
                        ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"
                        : "border-gray-200 dark:border-zinc-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-800"
                    )}
                  >
                    {editHideEmail ? t('on') : t('off')}
                  </button>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-gray-100 dark:border-zinc-800 p-3">
                  <div>
                    <div className="text-sm font-bold">{t('privateAccount')}</div>
                    <div className="text-[11px] text-gray-400">{t('privateAccountHint')}</div>
                  </div>
                  <button
                    onClick={() => setEditIsPrivate(!editIsPrivate)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-bold border transition-colors",
                      editIsPrivate
                        ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"
                        : "border-gray-200 dark:border-zinc-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-800"
                    )}
                  >
                    {editIsPrivate ? t('on') : t('off')}
                  </button>
                </div>
                <button
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="w-full bg-black dark:bg-white text-white dark:text-black py-2 rounded-xl text-xs font-bold disabled:opacity-50"
                >
                  {savingProfile ? t('uploading') : t('save')}
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-100 dark:border-zinc-800">
              <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-3">{t('appSettings')}</div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm">{t('theme')}</div>
                  <div className="text-xs text-gray-400">{darkMode ? t('dark') : t('light')}</div>
                </div>
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="px-3 py-1.5 rounded-full text-xs font-bold border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  {darkMode ? t('dark') : t('light')}
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-100 dark:border-zinc-800">
              <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-3">{t('notifications')}</div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm">{t('notificationsToggle')}</div>
                    <div className="text-xs text-gray-400">{t('notificationsHint')}</div>
                  </div>
                  <button
                    onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-bold border transition-colors",
                      notificationsEnabled
                        ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"
                        : "border-gray-200 dark:border-zinc-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-800"
                    )}
                  >
                    {notificationsEnabled ? t('on') : t('off')}
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm">{t('pushNotifications')}</div>
                    <div className="text-xs text-gray-400">{t('pushNotificationsHint')}</div>
                  </div>
                  <button
                    onClick={async () => {
                      if (!pushEnabled) {
                        if (typeof window !== 'undefined' && 'Notification' in window) {
                          const perm = await Notification.requestPermission();
                          setPushEnabled(perm === 'granted');
                        } else {
                          alert('Push notifications not supported in this browser');
                        }
                      } else {
                        setPushEnabled(false);
                      }
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-bold border transition-colors",
                      pushEnabled
                        ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"
                        : "border-gray-200 dark:border-zinc-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-800"
                    )}
                  >
                    {pushEnabled ? t('on') : t('off')}
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm">{t('toastsToggle')}</div>
                    <div className="text-xs text-gray-400">{t('toastsHint')}</div>
                  </div>
                  <button
                    onClick={() => setToastsEnabled(!toastsEnabled)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-bold border transition-colors",
                      toastsEnabled
                        ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"
                        : "border-gray-200 dark:border-zinc-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-800"
                    )}
                  >
                    {toastsEnabled ? t('on') : t('off')}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-100 dark:border-zinc-800">
              <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-3">{t('language')}</div>
              <div className="flex gap-2">
                <button
                  onClick={() => setLanguage('ru')}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-bold border transition-colors",
                    language === 'ru'
                      ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"
                      : "border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800"
                  )}
                >
                  Русский
                </button>
                <button
                  onClick={() => setLanguage('en')}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-bold border transition-colors",
                    language === 'en'
                      ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"
                      : "border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800"
                  )}
                >
                  English
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-100 dark:border-zinc-800">
              <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-3">{t('appSettings')}</div>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    if (window.confirm(t('logout') + '?')) {
                      logout();
                    }
                  }}
                  className="w-full bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white py-3 rounded-xl font-bold hover:opacity-90 transition-opacity"
                >
                  {t('logout')}
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(t('deleteAccountConfirm'))) {
                      // TODO: Delete account logic here
                      alert('Delete account not implemented yet');
                    }
                  }}
                  className="w-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity"
                >
                  {t('deleteAccount')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Messages({ onSelectChat, onOpenProfile }: { onSelectChat: (uid: string) => void, onOpenProfile: (uid: string) => void, key?: string }) {
  const { profile } = useAuth();
  const { t } = useSettings();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [followingUids, setFollowingUids] = useState<string[]>([]);
  const [recentChats, setRecentChats] = useState<UserProfile[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => doc.data() as UserProfile).filter(u => u.uid !== profile?.uid));
    });
    
    if (profile) {
      const q = query(collection(db, 'follows'), where('followerUid', '==', profile.uid));
      const unsubFollows = onSnapshot(q, (snapshot) => {
        const approved = snapshot.docs
          .map(doc => doc.data() as Follow)
          .filter(f => f.status === 'approved')
          .map(f => f.followingUid);
        setFollowingUids(approved);
      });

      // Listen for unread messages
      const qUnread = query(
        collection(db, 'messages'),
        where('receiverUid', '==', profile.uid),
        where('read', '==', false)
      );
      const unsubUnread = onSnapshot(qUnread, (snapshot) => {
        const counts: Record<string, number> = {};
        snapshot.docs.forEach(doc => {
          const m = doc.data() as Message;
          counts[m.senderUid] = (counts[m.senderUid] || 0) + 1;
        });
        setUnreadCounts(counts);
      });

      // Get recent messages to find people you've chatted with
      const qMsgs = query(
        collection(db, 'messages'),
        where('senderUid', '==', profile.uid),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const unsubMsgs = onSnapshot(qMsgs, async (snapshot) => {
        const uids = Array.from(new Set(snapshot.docs.map(d => (d.data() as Message).receiverUid)));
        const chatUsers: UserProfile[] = [];
        for (const uid of uids) {
          const d = await getDoc(doc(db, 'users', uid));
          if (d.exists()) chatUsers.push(d.data() as UserProfile);
        }
        setRecentChats(chatUsers);
      });

      return () => { unsubscribe(); unsubFollows(); unsubMsgs(); unsubUnread(); };
    }
    return unsubscribe;
  }, [profile]);

  const normalizedSearch = search.toLowerCase().replace(/^@/, '');
  const filteredUsers = users.filter(u => {
    const haystack = [
      u.displayName,
      u.username,
      u.email
    ].filter(Boolean).map(v => v!.toLowerCase());
    return haystack.some(v => v.includes(normalizedSearch));
  });

  const followingUsers = users.filter(u => followingUids.includes(u.uid));

  return (
    <div className="max-w-3xl mx-auto pt-20 pb-24 px-4">
      <div className="mb-8 rounded-3xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
        <h2 className="text-3xl font-bold tracking-tight">{t('messages')}</h2>
        <p className="text-sm text-gray-400 mt-2">{t('messagesSubtitle')}</p>
      </div>
      
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPeople')}
          className="w-full bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl pl-12 pr-4 py-4 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition-all shadow-sm"
        />
      </div>

      {search.length === 0 && (
        <>
          {recentChats.length > 0 && (
            <div className="mb-10">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">{t('recentChats')}</h3>
              <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                {recentChats.map(user => (
                  <button
                    key={user.uid}
                    onClick={() => onSelectChat(user.uid)}
                    className="flex flex-col items-center gap-2 min-w-[80px] group"
                  >
                    <div className="relative">
                      <img src={user.photoURL} className="w-16 h-16 rounded-full object-cover border-2 border-transparent group-hover:border-black dark:group-hover:border-white transition-all" referrerPolicy="no-referrer" />
                      {user.isOnline && (
                        <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white dark:border-black rounded-full" />
                      )}
                      {unreadCounts[user.uid] > 0 && (
                        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white dark:border-black min-w-[20px] text-center">
                          {unreadCounts[user.uid]}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] font-bold truncate w-full text-center">{user.displayName.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {recentChats.length === 0 && (
            <div className="mb-10 text-center text-sm text-gray-400">
              {t('noRecentChats')}
            </div>
          )}

          {followingUsers.length > 0 && (
            <div className="mb-10">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">{t('followingTitle')}</h3>
              <div className="space-y-3">
                {followingUsers.map(user => (
                  <div
                    key={user.uid}
                    onClick={() => onSelectChat(user.uid)}
                    className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 hover:border-black dark:hover:border-white transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <img src={user.photoURL} className="w-12 h-12 rounded-full object-cover" referrerPolicy="no-referrer" />
                        {user.isOnline && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-black rounded-full" />
                        )}
                      </div>
                        <div>
                          <div className="font-bold text-sm flex items-center gap-2">
                            {user.displayName}
                            {unreadCounts[user.uid] > 0 && (
                              <span className="bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded-full">
                                {unreadCounts[user.uid]}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-400">{getUserSecondaryLabel(user, profile?.uid, t)}</div>
                        </div>
                    </div>
                    <MessageSquare size={18} className="text-gray-300 group-hover:text-black dark:group-hover:text-white transition-colors" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {search.length > 0 && (
        <div className="space-y-3">
          {filteredUsers.map(user => (
            <div
              key={user.uid}
              onClick={() => onSelectChat(user.uid)}
              className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 hover:border-black dark:hover:border-white transition-all cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <img src={user.photoURL} className="w-12 h-12 rounded-full object-cover" referrerPolicy="no-referrer" />
                <div>
                  <div className="font-bold text-sm">{user.displayName}</div>
                  <div className="text-[10px] text-gray-400">{getUserSecondaryLabel(user, profile?.uid, t)}</div>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectChat(user.uid);
                }}
                className="bg-black dark:bg-white text-white dark:text-black px-4 py-1.5 rounded-full text-[10px] font-bold"
              >
                Message
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Chat({ receiverUid, onBack, onOpenImage }: { receiverUid: string, onBack: () => void, onOpenImage: (url: string) => void, key?: string }) {
  const { profile } = useAuth();
  const { t } = useSettings();
  const { showToast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [receiver, setReceiver] = useState<UserProfile | null>(null);
  const receiverHandle = receiver ? formatUsername(receiver.username) : '';
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [reactionTarget, setReactionTarget] = useState<string | null>(null);
  const [deleteMenuId, setDeleteMenuId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const messageMenuRef = useRef<HTMLDivElement | null>(null);
  const typingTimeout = useRef<number | null>(null);

  useEffect(() => {
    const unsubReceiver = onSnapshot(doc(db, 'users', receiverUid), (d) => {
      setReceiver(d.data() as UserProfile);
    });
    
    if (!profile) return;
    
    const q = query(
      collection(db, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allMsgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      const filtered = allMsgs.filter(m => 
        (m.senderUid === profile.uid && m.receiverUid === receiverUid) ||
        (m.senderUid === receiverUid && m.receiverUid === profile.uid)
      );
      setMessages(filtered);

      // Mark unread messages as read
      filtered.forEach(m => {
        if (m.senderUid === receiverUid && m.receiverUid === profile.uid && !m.read) {
          updateDoc(doc(db, 'messages', m.id), { read: true }).catch(console.error);
        }
      });
    });
    return () => {
      unsubscribe();
      unsubReceiver();
    };
  }, [receiverUid, profile]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (selectedMessageId && messageMenuRef.current && !messageMenuRef.current.contains(e.target as Node)) {
        setSelectedMessageId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [selectedMessageId]);

  useEffect(() => {
    if (!receiver || !profile?.uid) return;
    const interval = window.setInterval(() => {
      if (!receiver.typing || receiver.typingTo !== profile.uid || !receiver.typingAt) {
        setIsTyping(false);
        return;
      }
      const age = Date.now() - receiver.typingAt.toDate().getTime();
      setIsTyping(age < 5000);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [receiver, profile?.uid]);

  useEffect(() => {
    return () => {
      if (!profile) return;
      updateDoc(doc(db, 'users', profile.uid), {
        typing: false,
        typingTo: '',
        typingAt: serverTimestamp()
      }).catch(console.error);
    };
  }, [profile, receiverUid]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const threshold = 80;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setIsAtBottom(atBottom);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!text.trim() && !uploading) || !profile) return;

    const messageData: any = {
      senderUid: profile.uid,
      receiverUid,
      text: text.trim(),
      replyToId: replyTo?.id || '',
      replyToText: replyTo?.text || '',
      replyToSenderName: replyTo?.senderUid === profile.uid ? profile.displayName : receiver?.displayName || '',
      createdAt: serverTimestamp(),
      read: false
    };

    await addDoc(collection(db, 'messages'), messageData);
    setText('');
    setReplyTo(null);
    if (typingTimeout.current) {
      window.clearTimeout(typingTimeout.current);
      typingTimeout.current = null;
    }
    updateDoc(doc(db, 'users', profile.uid), {
      typing: false,
      typingTo: '',
      typingAt: serverTimestamp()
    }).catch(console.error);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    if (!STORAGE_ENABLED) {
      try {
        const { dataUrl, bytes } = await readAndCompressImage(file);
        if (bytes > MAX_IMAGE_BYTES) {
          showToast(t('imageTooLarge'), 'error');
          return;
        }
        await addDoc(collection(db, 'messages'), {
          senderUid: profile.uid,
          receiverUid,
          text: '',
          imageUrl: dataUrl,
          createdAt: serverTimestamp(),
          read: false
        });
        return;
      } catch (err) {
        showToast(getImageErrorMessage(err, t), 'error');
        return;
      }
    }

    setUploading(true);
    const storageRef = ref(storage, `chats/${profile.uid}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed',
      (snapshot) => {
        setProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
      },
      (error) => {
        console.error("Upload error:", error);
        setUploading(false);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        await addDoc(collection(db, 'messages'), {
          senderUid: profile.uid,
          receiverUid,
          text: '',
          imageUrl: downloadURL,
          createdAt: serverTimestamp(),
          read: false
        });
        setUploading(false);
        setProgress(0);
      }
    );
  };

  const handleStartEdit = (m: Message) => {
    setEditingId(m.id);
    setEditText(m.text || '');
  };

  const handleSaveEdit = async (m: Message) => {
    if (!editText.trim()) return;
    try {
      await updateDoc(doc(db, 'messages', m.id), { text: editText.trim(), editedAt: serverTimestamp() });
      showToast(t('messageEdited'), 'success');
      setEditingId(null);
      setEditText('');
    } catch (err) {
      showToast(t('genericError'), 'error');
    }
  };

  const handleDelete = async (m: Message, forAll: boolean) => {
    if (!profile) return;
    try {
      if (forAll) {
        await firestore.doc(awDb.DB_ID, 'messages', m.id).update({
          deletedForAll: true,
          text: '',
          imageUrl: '',
          replyToText: '',
          replyToSenderName: ''
        });
      } else {
        await updateDoc(doc(db, 'messages', m.id), {
          deletedFor: arrayUnion(profile.uid)
        });
      }
      showToast(t('messageDeleted'), 'info');
    } catch (err) {
      showToast(t('genericError'), 'error');
    } finally {
      setDeleteMenuId(null);
    }
  };

  const togglePin = async (m: Message) => {
    try {
      await updateDoc(doc(db, 'messages', m.id), { pinned: !m.pinned });
    } catch (err) {
      showToast(t('genericError'), 'error');
    }
  };

  const toggleReaction = async (m: Message, key: string) => {
    if (!profile) return;
    const current = m.reactions?.[key] || [];
    const field = `reactions.${key}`;
    try {
      await updateDoc(doc(db, 'messages', m.id), {
        [field]: current.includes(profile.uid) ? arrayRemove(profile.uid) : arrayUnion(profile.uid)
      });
    } catch (err) {
      showToast(t('genericError'), 'error');
    }
  };

  const handleTypingChange = (value: string) => {
    setText(value);
    if (!profile) return;
    // Use Firebase for typing (Appwrite migration issues)
    updateDoc(doc(db, 'users', profile.uid), {
      typing: true,
      typingTo: receiverUid,
      typingAt: serverTimestamp()
    }).catch(console.error);
    if (typingTimeout.current) window.clearTimeout(typingTimeout.current);
    typingTimeout.current = window.setTimeout(() => {
      updateDoc(doc(db, 'users', profile.uid), {
        typing: false,
        typingTo: '',
        typingAt: serverTimestamp()
      }).catch(console.error);
      typingTimeout.current = null;
    }, 2500);
  };

  const pinnedMessages = messages.filter(m => m.pinned && !m.deletedForAll && !(m.deletedFor?.includes(profile?.uid || '')));

  return (
    <div className="w-full max-w-3xl mx-auto h-screen flex flex-col bg-white dark:bg-black">
      <div className="p-4 border-b dark:border-zinc-800 flex items-center justify-between bg-white/90 dark:bg-black/90 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </button>
          {receiver && (
            <div className="flex items-center gap-3">
              <img src={receiver.photoURL} className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
              <div>
                <div className="font-bold text-sm">{receiver.displayName}</div>
                {receiverHandle && (
                  <div className="text-[10px] text-gray-400">{receiverHandle}</div>
                )}
                {receiver.isOnline ? (
                  <div className="text-[10px] text-green-500 font-bold uppercase tracking-widest">{t('online')}</div>
                ) : (
                  <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                    {t('lastSeen')} {receiver.lastSeen ? formatDistanceToNow(receiver.lastSeen.toDate(), { addSuffix: true }) : t('recently')}
                  </div>
                )}
                <AnimatePresence>
                  {isTyping && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="text-[10px] text-blue-500 font-bold uppercase tracking-widest"
                    >
                      {t('typing')}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
        <button className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors">
          <MoreVertical size={20} />
        </button>
      </div>

      <AnimatePresence>
        {pinnedMessages.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 pt-3"
          >
            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-3 shadow-sm">
              <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">{t('pinnedMessages')}</div>
              <div className="space-y-2">
                {pinnedMessages.slice(0, 3).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => document.getElementById(`msg-${m.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    className="w-full text-left text-sm text-gray-700 dark:text-gray-300 line-clamp-1 hover:underline"
                  >
                    {m.text || t('messageRemoved')}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-gray-50/80 via-white to-white dark:from-zinc-900/40 dark:via-black dark:to-black"
      >
        {messages.map((m, idx) => {
          const isMe = m.senderUid === profile?.uid;
          const showAvatar = idx === 0 || messages[idx-1].senderUid !== m.senderUid;
          const prev = messages[idx - 1];
          const showDate = !prev?.createdAt || !m.createdAt
            ? idx === 0
            : !isSameDay(prev.createdAt.toDate(), m.createdAt.toDate());
          const showTail = idx === messages.length - 1 || messages[idx + 1].senderUid !== m.senderUid;
          const isDeletedForMe = m.deletedFor?.includes(profile?.uid || '');
          const isDeleted = m.deletedForAll || isDeletedForMe;
          
          return (
            <div key={m.id} id={`msg-${m.id}`} className="space-y-3">
              {showDate && m.createdAt && (
                <div className="flex justify-center">
                  <span className="text-[10px] uppercase tracking-widest text-gray-400 bg-white/80 dark:bg-black/60 px-3 py-1 rounded-full border border-gray-100 dark:border-zinc-800">
                    {format(m.createdAt.toDate(), 'dd MMM yyyy')}
                  </span>
                </div>
              )}
              <div className={cn("flex gap-2 items-end", isMe ? "flex-row-reverse" : "flex-row")}>
                <div className="w-8 flex-shrink-0">
                  {showAvatar && (
                    <img
                      src={isMe ? profile?.photoURL : receiver?.photoURL}
                      className="w-8 h-8 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isDeleted && editingId !== m.id) {
                      if (selectedMessageId === m.id) {
                        setSelectedMessageId(null);
                      } else {
                        setSelectedMessageId(m.id);
                      }
                    }
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (!isDeleted) {
                      toggleReaction(m, 'like');
                    }
                  }}
                  className={cn(
                    "max-w-[80%] p-3 rounded-2xl text-sm shadow-sm relative text-left transition-all active:scale-[0.99] hover:shadow-md hover:ring-1",
                    selectedMessageId === m.id && "ring-2 ring-blue-500",
                    isMe 
                      ? "bg-black dark:bg-white text-white dark:text-black rounded-tr-none hover:ring-white/20 dark:hover:ring-black/20" 
                      : "bg-white dark:bg-zinc-800 text-black dark:text-white rounded-tl-none border border-gray-100 dark:border-zinc-700 hover:ring-gray-200 dark:hover:ring-zinc-600"
                  )}
                >
                  {showTail && (
                    <span className={cn(
                      "absolute bottom-0 w-2 h-2 rotate-45",
                      isMe ? "right-[-2px] bg-black dark:bg-white" : "left-[-2px] bg-white dark:bg-zinc-800 border-l border-b border-gray-100 dark:border-zinc-700"
                    )} />
                  )}
                  {m.replyToText && !isDeleted && (
                    <div className={cn(
                      "mb-2 rounded-xl px-3 py-2 text-[11px] border",
                      isMe
                        ? "border-white/30 bg-white/10 text-white dark:border-black/10 dark:bg-black/5 dark:text-black"
                        : "border-gray-200 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800/70 text-gray-700 dark:text-gray-300"
                    )}>
                      <div className={cn(
                        "font-bold text-[10px] uppercase tracking-widest",
                        isMe ? "text-white/80 dark:text-black/70" : "text-gray-500 dark:text-gray-400"
                      )}>
                        {t('replyingTo')} {m.replyToSenderName || ''}
                      </div>
                      <div className={cn(
                        "line-clamp-2",
                        isMe ? "text-white/90 dark:text-black/80" : "text-gray-700 dark:text-gray-200"
                      )}>
                        {m.replyToText}
                      </div>
                    </div>
                  )}
                  {m.imageUrl && !isDeleted && (
                    <img 
                      src={m.imageUrl} 
                      className="rounded-xl mb-2 max-w-full h-auto cursor-zoom-in" 
                      referrerPolicy="no-referrer" 
                      onClick={() => onOpenImage(m.imageUrl!)}
                    />
                  )}
                  <AnimatePresence>
                    {editingId === m.id ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white/5 dark:bg-black/5 rounded-xl p-2 mt-2"
                      >
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full bg-transparent rounded-xl p-2 text-sm focus:outline-none"
                          rows={3}
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleSaveEdit(m)}
                            className="px-3 py-1.5 rounded-full text-xs font-bold bg-black dark:bg-white text-white dark:text-black hover:opacity-80 transition-opacity"
                          >
                            {t('save')}
                          </button>
                          <button
                            onClick={() => { setEditingId(null); setEditText(''); }}
                            className="px-3 py-1.5 rounded-full text-xs font-bold bg-gray-200 dark:bg-zinc-700"
                          >
                            {t('cancel')}
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                    <div className={cn(isDeleted ? "text-xs italic opacity-70" : "")}>
                      {isDeleted ? t('messageRemoved') : m.text}
                    </div>
                  )}
                  </AnimatePresence>
                  <div className={cn(
                    "text-[9px] mt-1 flex items-center gap-1",
                    isMe ? "justify-end" : "justify-start",
                    (m.reactions?.['like'] || []).length > 0 ? "opacity-100" : "opacity-30"
                  )}>
                    {(m.reactions?.['like'] || []).length > 0 && (
                      <span className="text-red-500">
                        <Heart size={10} fill="currentColor" />
                      </span>
                    )}
                    {m.createdAt ? format(m.createdAt.toDate(), 'HH:mm') : ''}
                    {isMe && (
                      <span className={cn(m.read ? "text-blue-500" : "text-gray-400")}>
                        {m.read ? t('read') : t('sent')}
                      </span>
                    )}
                    {m.editedAt && !isDeleted && <span>• {t('edited')}</span>}
                  </div>
                </button>
                <AnimatePresence>
                  {!isDeleted && selectedMessageId === m.id && (
                    <motion.div
                      initial={{ opacity: 0, x: isMe ? 20 : -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: isMe ? 20 : -20 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className={cn("flex items-center gap-1", isMe ? "justify-end" : "justify-start")}
                    >
                      <button
                        onClick={() => { setReplyTo(m); setSelectedMessageId(null); }}
                        className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-full transition-all active:scale-90"
                      >
                        <MessageCircle size={16} />
                      </button>
                      {isMe && (
                        <button
                          onClick={() => { setDeleteMenuId(deleteMenuId === m.id ? null : m.id); }}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-full transition-all active:scale-90"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => togglePin(m)}
                        className={cn(
                          "p-1.5 text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-500/10 rounded-full transition-all active:scale-90",
                          m.pinned ? "text-yellow-500 bg-yellow-50 dark:bg-yellow-500/20" : ""
                        )}
                        title={m.pinned ? t('unpinMessage') : t('pinMessage')}
                      >
                        <Bookmark size={16} />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
                <AnimatePresence>
                  {deleteMenuId === m.id && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8, y: 10 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      className="flex gap-2 text-[10px]"
                    >
                      <button
                        onClick={() => handleDelete(m, false)}
                        className="px-2 py-1 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                      >
                        {t('deleteForMe')}
                      </button>
                      {isMe && (
                        <button
                          onClick={() => handleDelete(m, true)}
                          className="px-2 py-1 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                        >
                          {t('deleteForAll')}
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
                <AnimatePresence>
                  {reactionTarget === m.id && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8, y: 10 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      className="flex gap-2 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-full px-2 py-1 shadow-lg"
                    >
                      {MESSAGE_REACTIONS.map((r) => (
                        <button
                          key={r.key}
                          onClick={() => toggleReaction(m, r.key)}
                          className={cn(
                            "text-lg p-1 transition-transform hover:scale-125 active:scale-95",
                            (m.reactions?.[r.key] || []).includes(profile?.uid || '') ? "opacity-100" : "opacity-60 hover:opacity-100"
                          )}
                        >
                          {r.emoji}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
                <AnimatePresence>
                  {selectedMessageId === m.id && !isDeleted && (
                    <motion.div
                      ref={messageMenuRef}
                      initial={{ opacity: 0, scale: 0.9, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: -10 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className="absolute z-50 mt-1 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl shadow-xl py-2 min-w-[140px]"
                      style={{
                        [isMe ? 'right' : 'left']: 0,
                        top: '100%'
                      }}
                    >
                    <div className="flex justify-around px-2 py-1 mb-1 border-b border-gray-100 dark:border-zinc-800">
                      {MESSAGE_REACTIONS.map((r) => (
                        <button
                          key={r.key}
                          onClick={(e) => { e.stopPropagation(); toggleReaction(m, r.key); }}
                          className={`text-lg p-1 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all active:scale-75 ${(m.reactions?.[r.key] || []).includes(profile?.uid || '') ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                        >
                          {r.emoji}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => { setReplyTo(m); setSelectedMessageId(null); }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 flex items-center gap-2"
                    >
                      <MessageCircle size={14} />
                      {t('reply')}
                    </button>
                    </motion.div>
                  )}
                </AnimatePresence>
                {m.reactions && Object.keys(m.reactions).length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {MESSAGE_REACTIONS.filter(r => (m.reactions?.[r.key] || []).length > 0).map(r => (
                      <div
                        key={r.key}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300"
                      >
                        {r.emoji} {(m.reactions?.[r.key] || []).length}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
            <div className="p-4 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl shadow-sm">
              <MessageSquare size={32} />
            </div>
            <p className="text-sm font-medium">{t('startConversation')} {receiver?.displayName}</p>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="p-4 bg-white dark:bg-black border-t dark:border-zinc-800">
        {replyTo && (
          <div className="mb-2 px-2">
            <div className="flex items-center justify-between bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl px-3 py-2">
              <div className="text-[11px] text-gray-500 dark:text-gray-300">
                {t('replyingTo')} {replyTo.senderUid === profile?.uid ? profile?.displayName : receiver?.displayName}
                <div className="text-[10px] text-gray-400 line-clamp-1">{replyTo.text}</div>
              </div>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="text-[10px] text-gray-400 hover:text-red-500"
              >
                {t('cancelReply')}
              </button>
            </div>
          </div>
        )}
        {uploading && (
          <div className="mb-2 px-2">
            <div className="h-1 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-black dark:bg-white"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
        <div className="flex gap-2 bg-gray-100 dark:bg-zinc-900 rounded-2xl p-2 items-center shadow-inner">
          <label className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer">
            <Plus size={20} />
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
          </label>
          <input
            value={text}
            onChange={(e) => handleTypingChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (text.trim()) {
                  // Call handleSend with a mock event
                  const mockEvent = { preventDefault: () => {} } as React.FormEvent;
                  handleSend(mockEvent);
                }
              }
            }}
            placeholder={t('typeMessage')}
            className="flex-1 bg-transparent border-none focus:outline-none text-sm px-2 placeholder:text-gray-400"
            disabled={uploading}
          />
          <button 
            type="submit"
            disabled={(!text.trim() && !uploading) || uploading}
            className="bg-black dark:bg-white text-white dark:text-black p-2 rounded-xl disabled:opacity-30 transition-all hover:scale-105 active:scale-95 shadow-md"
          >
            <Send size={18} />
          </button>
        </div>
      </form>
      {!isAtBottom && messages.length > 6 && (
        <button
          onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
          className="fixed bottom-24 right-4 md:right-8 z-20 bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-full text-xs font-bold shadow-lg"
        >
          ↓ {t('messages')}
        </button>
      )}
    </div>
  );
}

function Login() {
  const { signIn } = useAuth();
  const { t, language, setLanguage } = useSettings();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 via-white to-gray-100 dark:from-black dark:via-zinc-950 dark:to-black p-4">
      <div className="max-w-md w-full">
        <div className="bg-white/90 dark:bg-zinc-900/80 border border-gray-100 dark:border-zinc-800 rounded-3xl p-8 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between mb-6">
            <div className="w-12 h-12 bg-black dark:bg-white rounded-2xl flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-white dark:border-black rounded-full" />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setLanguage('ru')}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-bold border transition-colors",
                  language === 'ru'
                    ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"
                    : "border-gray-200 dark:border-zinc-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-800"
                )}
              >
                RU
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-bold border transition-colors",
                  language === 'en'
                    ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"
                    : "border-gray-200 dark:border-zinc-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-800"
                )}
              >
                EN
              </button>
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tighter mb-3">{t('loginTitle')}</h1>
          <p className="text-gray-500 mb-8">{t('loginSubtitle')}</p>
          <button 
            onClick={signIn}
            className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-2xl font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-3 shadow-xl"
          >
            {t('continueGoogle')}
          </button>
        </div>
      </div>
    </div>
  );
}

function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const { user, profile } = useAuth();
  const { t } = useSettings();
  const { showToast } = useToast();
  const [step, setStep] = useState(0);
  const [showDone, setShowDone] = useState(false);
  const [username, setUsername] = useState(profile?.username || '');
  const [displayName, setDisplayName] = useState(profile?.displayName || user?.displayName || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.photoURL || '');
  const [bannerUrl, setBannerUrl] = useState(profile?.headerURL || '');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const totalSteps = 4;
  const stepLabels = [t('stepWelcome'), t('stepUsername'), t('stepName'), t('stepMedia')];

  const validateUrl = (value: string) => {
    if (!value.trim()) return true;
    return /^https?:\/\/.+/i.test(value.trim());
  };

  const handleCheckUsername = async () => {
    const normalized = normalizeUsername(username);
    const value = normalized.toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(value)) {
      setError(t('usernameHint'));
      return false;
    }
    setChecking(true);
    try {
      const q = query(collection(db, 'users'), where('usernameLower', '==', value), limit(1));
      const qLegacy = query(collection(db, 'users'), where('usernameLower', '==', `@${value}`), limit(1));
      const [snap, snapLegacy] = await Promise.all([getDocs(q), getDocs(qLegacy)]);
      const taken =
        (!snap.empty && snap.docs[0].id !== user.uid) ||
        (!snapLegacy.empty && snapLegacy.docs[0].id !== user.uid);
      if (taken) {
        setError(t('usernameTaken'));
        return false;
      }
      setError(null);
      return true;
    } catch (err) {
      setError(t('genericError'));
      return false;
    } finally {
      setChecking(false);
    }
  };

  const handleNext = async () => {
    if (step === 1) {
      const ok = await handleCheckUsername();
      if (!ok) return;
    }
    if (step === 2) {
      if (!displayName.trim()) {
        setError(t('namePlaceholder'));
        return;
      }
      setError(null);
    }
    if (step === 3) {
      if (!validateUrl(avatarUrl) || !validateUrl(bannerUrl)) {
        setError(t('urlInvalid'));
        return;
      }
      setError(null);
      await handleFinish();
      return;
    }
    setStep(prev => Math.min(prev + 1, totalSteps - 1));
  };

  const handleFinish = async () => {
    try {
      const normalized = normalizeUsername(username);
      const usernameLower = normalized.toLowerCase();
      const photoURL = avatarUrl.trim() || user.photoURL || profile?.photoURL || '';
      const headerURL = bannerUrl.trim() || profile?.headerURL || '';
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        uid: user.uid,
        username: normalized,
        usernameLower,
        displayName: displayName.trim(),
        email: user.email || '',
        photoURL,
        headerURL,
        bio: profile?.bio || '',
        city: profile?.city || '',
        birthdate: profile?.birthdate || '',
        hideEmail: profile?.hideEmail ?? false,
        createdAt: profile?.createdAt || serverTimestamp(),
        isOnline: true,
        lastSeen: serverTimestamp()
      }, { merge: true });
      showToast(t('welcomeMessage'), 'success');
      setShowDone(true);
      setTimeout(() => onComplete(), 1600);
    } catch (err) {
      setError(t('genericError'));
    }
  };

  const handleAvatarFile = async (file: File) => {
    try {
      const { dataUrl, bytes } = await readAndCompressImage(file);
      if (bytes > MAX_IMAGE_BYTES) {
        setError(t('imageTooLarge'));
        return;
      }
      setAvatarUrl(dataUrl);
      setError(null);
    } catch (err) {
      setError(getImageErrorMessage(err, t));
    }
  };

  const handleBannerFile = async (file: File) => {
    try {
      const { dataUrl, bytes } = await readAndCompressImage(file);
      if (bytes > MAX_IMAGE_BYTES) {
        setError(t('imageTooLarge'));
        return;
      }
      setBannerUrl(dataUrl);
      setError(null);
    } catch (err) {
      setError(getImageErrorMessage(err, t));
    }
  };

  const renderIllustration = () => {
    if (step === 0) {
      return (
        <div className="relative overflow-hidden rounded-2xl border border-gray-100 dark:border-zinc-800 bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-gray-400">{t('welcome')}</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">ZIMO</div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-black dark:bg-white flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-white dark:border-black rounded-full" />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <div className="h-2 w-16 rounded-full bg-gray-200 dark:bg-zinc-700" />
            <div className="h-2 w-10 rounded-full bg-gray-200 dark:bg-zinc-700" />
            <div className="h-2 w-6 rounded-full bg-gray-200 dark:bg-zinc-700" />
          </div>
          <div className="absolute -right-8 -bottom-8 w-24 h-24 rounded-full bg-black/5 dark:bg-white/10 blur-2xl" />
        </div>
      );
    }
    if (step === 1) {
      return (
        <div className="rounded-2xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-widest">{t('stepUsername')}</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">{formatUsername(normalizeUsername(username) || 'zimo')}</div>
          </div>
          <div className="px-3 py-1.5 rounded-full text-xs font-bold bg-black text-white dark:bg-white dark:text-black">
            {t('checking')}
          </div>
        </div>
      );
    }
    if (step === 2) {
      return (
        <div className="rounded-2xl border border-gray-100 dark:border-zinc-800 bg-gradient-to-r from-gray-50 to-white dark:from-zinc-900 dark:to-zinc-900 p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-white/10 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full bg-black/20 dark:bg-white/20" />
          </div>
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-widest">{t('yourName')}</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">{displayName || t('namePlaceholder')}</div>
          </div>
        </div>
      );
    }
    return (
      <div className="rounded-2xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <div className="h-10 rounded-xl bg-gray-100 dark:bg-zinc-800 mb-3" />
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-zinc-800" />
          <div className="flex-1 space-y-2">
            <div className="h-2 w-24 rounded-full bg-gray-100 dark:bg-zinc-800" />
            <div className="h-2 w-16 rounded-full bg-gray-100 dark:bg-zinc-800" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 via-white to-gray-100 dark:from-black dark:via-zinc-950 dark:to-black p-4 relative overflow-hidden">
      <motion.div
        className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-gradient-to-br from-blue-200/40 via-transparent to-transparent dark:from-blue-500/10 blur-3xl"
        animate={{ y: [0, 12, 0], x: [0, 8, 0] }}
        transition={{ duration: 8, repeat: Infinity }}
      />
      <motion.div
        className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-gradient-to-br from-pink-200/40 via-transparent to-transparent dark:from-pink-500/10 blur-3xl"
        animate={{ y: [0, -10, 0], x: [0, -6, 0] }}
        transition={{ duration: 9, repeat: Infinity }}
      />
      <div className="max-w-xl w-full">
        <div className="bg-white/90 dark:bg-zinc-900/80 border border-gray-100 dark:border-zinc-800 rounded-3xl p-8 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between mb-6">
            <div className="w-12 h-12 bg-black dark:bg-white rounded-2xl flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-white dark:border-black rounded-full" />
            </div>
            <div className="text-xs text-gray-400 font-bold uppercase tracking-widest">
              {t('step')} {step + 1}/{totalSteps}
            </div>
          </div>

          <div className="flex items-center gap-2 mb-6">
            {stepLabels.map((label, idx) => (
              <div key={label} className="flex items-center gap-2 flex-1">
                <div
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors",
                    idx <= step
                      ? "bg-black text-white dark:bg-white dark:text-black"
                      : "bg-gray-200 text-gray-400 dark:bg-zinc-800 dark:text-zinc-500"
                  )}
                >
                  {idx + 1}
                </div>
                <span className={cn("text-[10px] uppercase tracking-widest", idx === step ? "text-gray-800 dark:text-gray-200" : "text-gray-400 dark:text-zinc-500")}>
                  {label}
                </span>
                {idx < stepLabels.length - 1 && (
                  <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-800" />
                )}
              </div>
            ))}
          </div>

          <div className="h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden mb-6">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${((step + 1) / totalSteps) * 100}%` }}
              transition={{ duration: 0.4 }}
              className="h-full bg-black dark:bg-white"
            />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={`illustration-${step}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="mb-6"
            >
              {renderIllustration()}
            </motion.div>
          </AnimatePresence>

          {showDone ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-8"
            >
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-black dark:bg-white flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-white dark:border-black rounded-full" />
              </div>
              <h2 className="text-2xl font-bold mb-2">{t('welcomeDone')}</h2>
              <p className="text-gray-500">{t('welcomeMessage')}</p>
            </motion.div>
          ) : step === 0 && (
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-3">{t('welcome')}</h1>
              <p className="text-gray-500 mb-6">{t('onboardingSubtitle')}</p>
              <div className="bg-gray-50 dark:bg-zinc-900/60 border border-gray-100 dark:border-zinc-800 rounded-2xl p-4 text-sm">
                <div className="font-bold">{user.email}</div>
                <div className="text-xs text-gray-400">{user.displayName || t('googleAccount')}</div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="text-2xl font-bold mb-2">{t('chooseUsername')}</h2>
              <p className="text-gray-500 text-sm mb-4">{t('usernameHint')}</p>
              <div className="flex items-center bg-gray-50 dark:bg-zinc-800 p-3 rounded-2xl border dark:border-zinc-700 text-sm focus-within:ring-1 focus-within:ring-black dark:focus-within:ring-white">
                <span className="text-gray-400 pr-1">@</span>
                <input
                  value={normalizeUsername(username)}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError(null);
                  }}
                  placeholder={t('usernamePlaceholder')}
                  className="flex-1 bg-transparent focus:outline-none"
                />
              </div>
              {checking && <div className="text-xs text-gray-400 mt-2">{t('checking')}</div>}
              {!checking && error === t('usernameTaken') && (
                <div className="text-xs text-red-500 mt-2">{t('usernameTaken')}</div>
              )}
              {!checking && !error && username.trim() && (
                <div className="text-xs text-green-600 mt-2">{t('usernameAvailable')}</div>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-2xl font-bold mb-2">{t('yourName')}</h2>
              <input
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setError(null);
                }}
                placeholder={t('namePlaceholder')}
                className="w-full bg-gray-50 dark:bg-zinc-800 p-3 rounded-2xl border dark:border-zinc-700 text-sm focus:outline-none"
              />
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-2xl font-bold mb-2">{t('optionalMedia')}</h2>
              <div className="space-y-3">
                <input
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder={t('avatarUrl')}
                  className="w-full bg-gray-50 dark:bg-zinc-800 p-3 rounded-2xl border dark:border-zinc-700 text-sm focus:outline-none"
                />
                <input
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  placeholder={t('bannerUrl')}
                  className="w-full bg-gray-50 dark:bg-zinc-800 p-3 rounded-2xl border dark:border-zinc-700 text-sm focus:outline-none"
                />
                <div className="flex gap-2 flex-wrap">
                  <label className="px-3 py-1.5 rounded-full text-xs font-bold border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer">
                    {t('uploadAvatar')}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleAvatarFile(f);
                      }}
                    />
                  </label>
                  <label className="px-3 py-1.5 rounded-full text-xs font-bold border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer">
                    {t('uploadBanner')}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleBannerFile(f);
                      }}
                    />
                  </label>
                </div>
                {(avatarUrl || bannerUrl) && (
                  <div className="grid grid-cols-2 gap-3">
                    {avatarUrl && (
                      <div className="bg-gray-50 dark:bg-zinc-800 rounded-2xl p-2 flex items-center justify-center">
                        <img src={avatarUrl} className="w-16 h-16 rounded-full object-cover" />
                      </div>
                    )}
                    {bannerUrl && (
                      <div className="bg-gray-50 dark:bg-zinc-800 rounded-2xl p-2">
                        <img src={bannerUrl} className="w-full h-16 rounded-xl object-cover" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 text-xs text-red-500">{error}</div>
          )}

          {!showDone && (
            <div className="mt-8 flex gap-2">
              {step > 0 && (
              <button
                onClick={() => setStep(prev => Math.max(prev - 1, 0))}
                className="flex-1 bg-gray-100 dark:bg-zinc-800 py-2 rounded-xl text-xs font-bold"
              >
                {t('back')}
              </button>
              )}
              <button
                onClick={handleNext}
                disabled={checking}
                className="flex-1 bg-black dark:bg-white text-white dark:text-black py-2 rounded-xl text-xs font-bold disabled:opacity-50"
              >
                {step === totalSteps - 1 ? t('finish') : t('next')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Main App ---

function PostDetail({ post, onBack, onOpenProfile, onHashtagClick, onOpenImage, onShowLikes }: { 
  post: Post, 
  onBack: () => void, 
  onOpenProfile: (uid: string) => void, 
  onHashtagClick?: (tag: string) => void,
  onOpenImage: (url: string) => void,
  onShowLikes: (postId: string) => void,
  key?: string
}) {
  const { profile } = useAuth();
  const { t } = useSettings();
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [likedByUsers, setLikedByUsers] = useState<UserProfile[]>([]);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'posts', post.id, 'comments'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment)));
    });
    return unsubscribe;
  }, [post.id]);

  useEffect(() => {
    if (!post.likedBy?.length) {
      setLikedByUsers([]);
      return;
    }
    // Fetch profiles of users who liked
    const fetchLikers = async () => {
      const likers: UserProfile[] = [];
      // Firestore 'in' query limit is 10, so we chunk or just take first 10 for preview
      const likerUids = post.likedBy!.slice(0, 10);
      const q = query(collection(db, 'users'), where('uid', 'in', likerUids));
      const s = await getDocs(q);
      setLikedByUsers(s.docs.map(d => d.data() as UserProfile));
    };
    fetchLikers();
  }, [post.likedBy]);

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !profile) return;

    try {
      const commentData: Record<string, unknown> = {
        authorUid: profile.uid,
        authorName: profile.displayName,
        authorPhoto: profile.photoURL,
        text: commentText.trim(),
        createdAt: serverTimestamp()
      };
      
      if (replyTo) {
        commentData.parentId = replyTo.id;
      }
      
      await addDoc(collection(db, 'posts', post.id, 'comments'), commentData);
      
      if (post.authorUid !== profile.uid) {
        await addDoc(collection(db, 'notifications'), {
          type: 'comment',
          fromUid: profile.uid,
          fromName: profile.displayName,
          fromPhoto: profile.photoURL,
          toUid: post.authorUid,
          postId: post.id,
          createdAt: serverTimestamp(),
          read: false
        });
      }
      
      setCommentText('');
      setReplyTo(null);
    } catch (err) {
      console.error("Error commenting:", err);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-20 px-4">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-gray-500 hover:text-black dark:hover:text-white mb-6 transition-colors group"
      >
        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
        <span className="font-medium">{t('back')}</span>
      </button>

      <PostCard post={post} onOpenProfile={onOpenProfile} onHashtagClick={onHashtagClick} onOpenImage={onOpenImage} onShowLikes={onShowLikes} />

      {likedByUsers.length > 0 && (
        <div className="mt-6 p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-50 dark:border-zinc-800">
          <div className="flex items-center gap-2 mb-3">
            <Heart size={14} className="text-red-500 fill-red-500" />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{t('likedBy')}</span>
          </div>
          <div className="flex -space-x-2 overflow-hidden">
            {likedByUsers.map(user => (
              <button 
                key={user.uid}
                onClick={() => onOpenProfile(user.uid)}
                className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-zinc-900 hover:scale-110 transition-transform"
                title={user.displayName}
              >
                <img src={user.photoURL} className="h-full w-full rounded-full object-cover" referrerPolicy="no-referrer" />
              </button>
            ))}
            {post.likes > likedByUsers.length && (
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-100 dark:bg-zinc-800 ring-2 ring-white dark:ring-zinc-900 text-[10px] font-bold">
                +{post.likes - likedByUsers.length}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-8">
        <h3 className="font-bold text-lg mb-4">
          {t('commentsTitle').replace('{count}', String(comments.length))}
        </h3>
        
        {replyTo && (
          <div className="flex items-center gap-2 mb-2 text-xs text-gray-500 bg-gray-50 dark:bg-zinc-800 p-2 rounded-full">
            <span>{t('replyingTo')} </span>
            <span className="font-bold">{replyTo.authorName}</span>
            <button type="button" onClick={() => setReplyTo(null)} className="ml-1 text-gray-400 hover:text-gray-600">×</button>
          </div>
        )}
        <form onSubmit={handleComment} className="flex gap-2 mb-8">
          <input
            id="comment-input"
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={replyTo ? t('replyPlaceholder') : t('commentPlaceholder')}
            className="flex-1 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-black dark:focus:border-white transition-colors"
          />
          <button 
            type="submit"
            disabled={!commentText.trim()}
            className="bg-black dark:bg-white text-white dark:text-black p-2 rounded-full disabled:opacity-50"
          >
            <Send size={18} />
          </button>
        </form>

        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3 p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-50 dark:border-zinc-800">
              <img src={comment.authorPhoto} className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-xs">{comment.authorName}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setReplyTo(comment);
                        document.getElementById('comment-input')?.focus();
                      }}
                      className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {t('reply')}
                    </button>
                    {(comment.authorUid === profile?.uid || post.authorUid === profile?.uid) && (
                      <button
                        onClick={async () => {
                          if (!window.confirm(t('confirmDeleteComment'))) return;
                          await deleteDoc(doc(db, 'comments', comment.id));
                          setComments(comments.filter(c => c.id !== comment.id));
                        }}
                        className="text-[10px] text-red-400 hover:text-red-600"
                      >
                        {t('delete')}
                      </button>
                    )}
                    <span className="text-[10px] text-gray-400">
                      {comment.createdAt ? formatDistanceToNow(comment.createdAt.toDate(), { addSuffix: true }) : t('justNow')}
                    </span>
                  </div>
                </div>
                {replyTo?.id === comment.id && (
                  <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                    <span>{t('replyingTo')} </span>
                    <span className="font-bold">{comment.authorName}</span>
                    <button onClick={() => setReplyTo(null)} className="ml-1 text-gray-400 hover:text-gray-600">×</button>
                  </div>
                )}
                <p className="text-sm text-gray-700 dark:text-gray-300">{comment.text}</p>
              </div>
            </div>
          ))}
          {comments.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">{t('noComments')}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function LikesModal({ postId, onClose, onOpenProfile }: { postId: string, onClose: () => void, onOpenProfile: (uid: string) => void }) {
  const [likes, setLikes] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useSettings();
  const { profile } = useAuth();

  useEffect(() => {
    const fetchLikes = async () => {
      const postDoc = await getDoc(doc(db, 'posts', postId));
      if (postDoc.exists()) {
        const likedBy = (postDoc.data() as Post).likedBy || [];
        const users: UserProfile[] = [];
        for (const uid of likedBy) {
          const uDoc = await getDoc(doc(db, 'users', uid));
          if (uDoc.exists()) users.push(uDoc.data() as UserProfile);
        }
        setLikes(users);
      }
      setLoading(false);
    };
    fetchLikes();
  }, [postId]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="p-4 border-b dark:border-zinc-800 flex justify-between items-center bg-gray-50/50 dark:bg-zinc-800/50">
          <h3 className="font-bold">{t('likedBy')}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="max-h-[400px] overflow-y-auto p-2">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-black dark:border-white border-t-transparent animate-spin rounded-full" />
            </div>
          ) : likes.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">{t('noLikes')}</div>
          ) : (
            likes.map(user => (
              <button
                key={user.uid}
                onClick={() => { onOpenProfile(user.uid); onClose(); }}
                className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-2xl transition-colors text-left"
              >
                <img src={user.photoURL} className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                <div>
                  <div className="font-bold text-sm">{user.displayName}</div>
                  <div className="text-[10px] text-gray-400">{getUserSecondaryLabel(user, profile?.uid, t)}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}

function Notifications({ onOpenPost }: { onOpenPost: (post: Post) => void, key?: string }) {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const { t } = useSettings();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!profile) return;
    const q = query(
      collection(db, 'notifications'), 
      where('toUid', '==', profile.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsubscribe = onSnapshot(q, (s) => {
      setNotifications(s.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification)));
    });
    return unsubscribe;
  }, [profile]);

  const handleNotificationClick = async (n: Notification) => {
    if (!n.read) {
      await updateDoc(doc(db, 'notifications', n.id), { read: true });
    }
    if (n.postId) {
      const postDoc = await getDoc(doc(db, 'posts', n.postId));
      if (postDoc.exists()) {
        onOpenPost({ id: postDoc.id, ...postDoc.data() } as Post);
      }
    }
  };

  const handleClearAll = async () => {
    if (window.confirm(t('clearNotificationsConfirm'))) {
      try {
        const batch = notifications.map(n => deleteDoc(doc(db, 'notifications', n.id)));
        await Promise.all(batch);
        showToast(t('notificationsCleared'), "info");
      } catch (err) {
        showToast(t('failedClearNotifications'), "error");
      }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const unread = notifications.filter(n => !n.read);
      const batch = unread.map(n => updateDoc(doc(db, 'notifications', n.id), { read: true }));
      await Promise.all(batch);
      showToast(t('markAllReadSuccess'), "success");
    } catch (err) {
      showToast(t('failedMarkRead'), "error");
    }
  };

  const getMessage = (n: Notification) => {
    switch(n.type) {
      case 'like': return t('likeMessage');
      case 'comment': return t('commentMessage');
      case 'follow': return t('followMessage');
      case 'follow_request': return t('followRequestMessage');
      case 'repost': return t('repostMessage');
      default: return t('interactedMessage');
    }
  };

  const handleApproveRequest = async (n: Notification) => {
    if (!profile) return;
    try {
      const followId = n.fromUid + '_' + profile.uid;
      await setDoc(doc(db, 'follows', followId), {
        followerUid: n.fromUid,
        followingUid: profile.uid,
        status: 'approved',
        createdAt: serverTimestamp()
      });
      await addDoc(collection(db, 'notifications'), {
        type: 'follow',
        fromUid: profile.uid,
        fromName: profile.displayName,
        fromPhoto: profile.photoURL,
        toUid: n.fromUid,
        createdAt: serverTimestamp(),
        read: false
      });
      await updateDoc(doc(db, 'notifications', n.id), { read: true });
      showToast(t('followApproved'), 'success');
    } catch (err) {
      showToast(t('genericError'), 'error');
    }
  };

  const handleRejectRequest = async (n: Notification) => {
    if (!profile) return;
    try {
      const followId = n.fromUid + '_' + profile.uid;
      await deleteDoc(doc(db, 'follows', followId));
      await updateDoc(doc(db, 'notifications', n.id), { read: true });
      showToast(t('followRejected'), 'info');
    } catch (err) {
      showToast(t('genericError'), 'error');
    }
  };

  return (
    <div className="max-w-xl mx-auto py-20 px-4">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold tracking-tight">{t('notificationsTitle')}</h2>
        {notifications.length > 0 && (
          <div className="flex gap-2">
            <button 
              onClick={handleMarkAllRead}
              className="text-xs font-bold text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-3 py-1.5 rounded-full transition-colors"
            >
              {t('markAllRead')}
            </button>
            <button 
              onClick={handleClearAll}
              className="text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-full transition-colors"
            >
              {t('clearAll')}
            </button>
          </div>
        )}
      </div>
      <div className="space-y-3">
        {notifications.length === 0 && (
          <div className="text-center py-10 text-gray-400">{t('notificationsEmpty')}</div>
        )}
        {notifications.map(n => (
          <div 
            key={n.id} 
            onClick={() => handleNotificationClick(n)}
            className={cn(
              "flex items-center gap-4 p-4 rounded-2xl border transition-all",
              n.postId ? "cursor-pointer hover:border-gray-300 dark:hover:border-zinc-700" : "",
              n.read ? "bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800" : "bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30"
            )}
          >
            <img src={n.fromPhoto} className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
            <div className="flex-1">
              <p className="text-sm">
                <span className="font-bold">{n.fromName}</span> {getMessage(n)}
              </p>
              <p className="text-[10px] text-gray-400 mt-1">
                {n.createdAt ? formatDistanceToNow(n.createdAt.toDate(), { addSuffix: true }) : t('justNow')}
              </p>
              {/* Show approve/reject buttons for follow requests */}
              {n.type === 'follow_request' && (
                <div className="flex gap-2 mt-2" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => handleApproveRequest(n)}
                    className="text-xs bg-blue-500 text-white px-3 py-1 rounded-full hover:bg-blue-600"
                  >
                    {t('approve')}
                  </button>
                  <button
                    onClick={() => handleRejectRequest(n)}
                    className="text-xs bg-gray-200 dark:bg-zinc-700 px-3 py-1 rounded-full hover:bg-gray-300 dark:hover:bg-zinc-600"
                  >
                    {t('reject')}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SocialApp() {
  const { user, loading, profile, logout, needsOnboarding } = useAuth();
  const { darkMode, setDarkMode } = useSettings();
  const [view, setView] = useState<View>('feed');
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [activeHashtag, setActiveHashtag] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [likesPostId, setLikesPostId] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(needsOnboarding);
  const isChatView = view === 'chat';

  useEffect(() => {
    setShowOnboarding(needsOnboarding);
  }, [needsOnboarding]);

  if (loading) return (
    <div className="h-screen flex items-center justify-center dark:bg-black">
      <div className="w-8 h-8 border-4 border-black dark:border-white border-t-transparent animate-spin rounded-full" />
    </div>
  );

  if (!user) return <Login />;

  if (showOnboarding) {
    return <OnboardingWizard onComplete={() => setShowOnboarding(false)} />;
  }

  const handleOpenPost = (post: Post) => {
    setSelectedPost(post);
    setView('post_detail');
  };

  const handleOpenProfile = (uid: string) => {
    if (uid === profile?.uid) {
      setView('profile');
    } else {
      setSelectedUser(uid);
      setView('user_profile');
    }
  };

  const handleHashtagClick = (tag: string) => {
    setActiveHashtag(tag);
    setView('feed');
  };

  const handleOpenImage = (url: string) => {
    setSelectedImage(url);
  };

  return (
      <div className="min-h-screen bg-gray-50 dark:bg-black text-black dark:text-white transition-colors">
      {!isChatView && (
        <Navbar 
          currentView={view} 
          setView={setView} 
          darkMode={darkMode} 
          setDarkMode={setDarkMode} 
          onSearchUser={handleOpenProfile}
        />
      )}
      
      <main className={cn(isChatView ? "pt-0 pb-0" : "pb-24 pt-6 md:pt-16")}>
        <AnimatePresence mode="wait">
          {view === 'feed' && (
            <Feed 
              key="feed"
              onOpenPost={handleOpenPost} 
              onOpenProfile={handleOpenProfile} 
              searchHashtag={activeHashtag}
              onClearHashtag={() => setActiveHashtag(null)}
              onOpenImage={handleOpenImage}
              onShowLikes={setLikesPostId}
            />
          )}
          {view === 'explore' && (
            <Explore 
              key="explore"
              onOpenPost={handleOpenPost} 
              onOpenProfile={handleOpenProfile} 
              onOpenImage={handleOpenImage}
              onShowLikes={setLikesPostId}
            />
          )}
          {view === 'bookmarks' && (
            <Bookmarks 
              key="bookmarks"
              onOpenPost={handleOpenPost} 
              onOpenProfile={handleOpenProfile} 
              onOpenImage={handleOpenImage}
              onShowLikes={setLikesPostId}
            />
          )}
          {view === 'notifications' && <Notifications key="notifications" onOpenPost={handleOpenPost} />}
          {view === 'profile' && (
            <Profile 
              key="profile"
              onOpenPost={handleOpenPost} 
              onOpenProfile={handleOpenProfile} 
              onHashtagClick={handleHashtagClick} 
              onOpenImage={handleOpenImage}
              onShowLikes={setLikesPostId}
            />
          )}
          {view === 'user_profile' && selectedUser && (
            <Profile 
              key={`user_${selectedUser}`}
              userId={selectedUser} 
              onOpenPost={handleOpenPost} 
              onOpenProfile={handleOpenProfile} 
              onHashtagClick={handleHashtagClick} 
              onBack={() => setView('feed')} 
              onOpenImage={handleOpenImage}
              onShowLikes={setLikesPostId}
            />
          )}
          {view === 'post_detail' && selectedPost && (
            <PostDetail 
              key={`post_${selectedPost.id}`}
              post={selectedPost} 
              onBack={() => setView('feed')} 
              onOpenProfile={handleOpenProfile} 
              onHashtagClick={handleHashtagClick} 
              onOpenImage={handleOpenImage}
              onShowLikes={setLikesPostId}
            />
          )}
          {view === 'messages' && (
            <Messages 
              key="messages"
              onSelectChat={(uid) => { setSelectedChat(uid); setView('chat'); }} 
              onOpenProfile={handleOpenProfile} 
            />
          )}
          {view === 'chat' && selectedChat && (
            <Chat 
              key={`chat_${selectedChat}`}
              receiverUid={selectedChat} 
              onBack={() => setView('messages')} 
              onOpenImage={handleOpenImage}
            />
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {selectedImage && (
          <Lightbox url={selectedImage} onClose={() => setSelectedImage(null)} />
        )}
        {likesPostId && (
          <LikesModal 
            postId={likesPostId} 
            onClose={() => setLikesPostId(null)} 
            onOpenProfile={handleOpenProfile} 
          />
        )}
      </AnimatePresence>
      </div>
  );
}

function ErrorFallback({ error, resetErrorBoundary }: { error: any, resetErrorBoundary: () => void }) {
  const { t } = useSettings();
  let displayMessage = t('somethingWrong');
  try {
    const parsed = JSON.parse(error.message || "");
    if (parsed.error && parsed.error.includes("insufficient permissions")) {
      displayMessage = t('securityError')
        .replace('{operation}', parsed.operationType)
        .replace('{path}', parsed.path);
    } else {
      displayMessage = t('genericError');
    }
  } catch (e) {
    displayMessage = t('genericError');
  }

  return (
    <div className="h-screen flex flex-col items-center justify-center p-4 bg-red-50 dark:bg-red-900/10 text-center">
      <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">{t('oops')}</h1>
      <p className="text-gray-700 dark:text-gray-300 mb-6 max-w-md">{displayMessage}</p>
      <button 
        onClick={() => window.location.reload()} 
        className="bg-red-600 text-white px-6 py-2 rounded-full font-bold hover:bg-red-700 transition-colors"
      >
        {t('reloadApp')}
      </button>
    </div>
  );
}

// Since standard ErrorBoundary requires a class, and we are having TS issues, 
// let's use a simpler approach for now or ensure the class is correctly defined.
// Actually, let's try one more time with a very standard class definition.

export default function App() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Check periodically using navigator.onLine only
    const interval = setInterval(() => {
      if (!navigator.onLine) {
        setIsOffline(true);
      }
    }, 5000);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return (
    <SettingsProvider>
      <AuthProvider>
        <ToastProvider>
          {/* Connection indicator - slides out when offline */}
          <AnimatePresence>
            {isOffline && (
              <motion.div
                initial={{ y: -60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -60, opacity: 0 }}
                className="fixed top-0 left-0 right-0 z-[100] bg-orange-500 text-white py-2 px-4 flex items-center justify-center gap-2 shadow-lg"
              >
                <WifiOff size={16} className="animate-pulse" />
                <span className="text-sm font-medium">Нет подключения. Попытка переподключения...</span>
              </motion.div>
            )}
          </AnimatePresence>
          <SocialApp />
        </ToastProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}
