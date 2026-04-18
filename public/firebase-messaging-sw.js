/* eslint-disable no-undef */
// Firebase Cloud Messaging service worker (background notifications).
//
// IMPORTANT:
// 1) Paste your Firebase config below (must include messagingSenderId).
// 2) Ensure you set `VITE_FCM_VAPID_KEY` in your environment for getToken().
//
// Docs: https://firebase.google.com/docs/cloud-messaging/js/receive

importScripts('https://www.gstatic.com/firebasejs/12.11.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.11.0/firebase-messaging-compat.js');

// TODO: replace with your firebase config (same values as firebase-applet-config.json).
firebase.initializeApp({
  apiKey: 'AIzaSyANZPuiuoRZUNieYLBDh9HkKuM7Tv8S2Ws',
  authDomain: 'zimo-554fd.firebaseapp.com',
  projectId: 'zimo-554fd',
  storageBucket: 'zimo-554fd.appspot.com',
  messagingSenderId: '795043346925',
  appId: '1:795043346925:web:a0a8962383ae28d08e8fe4',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || 'Zimo';
  const options = {
    body: payload?.notification?.body || '',
    icon: '/favicon.ico',
    data: payload?.data || {},
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || '/';
  event.waitUntil(clients.openWindow(url));
});
