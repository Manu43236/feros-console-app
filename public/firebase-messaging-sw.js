importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCdSvv97TTnn3lcZUs5OcG1Z3tCssZh_x0",
  authDomain: "feros-552b2.firebaseapp.com",
  projectId: "feros-552b2",
  storageBucket: "feros-552b2.firebasestorage.app",
  messagingSenderId: "206785700779",
  appId: "1:206785700779:web:ce5ed114dead74049768ee",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? 'FEROS';
  const body  = payload.notification?.body  ?? '';
  self.registration.showNotification(title, {
    body,
    icon: '/favicon.png',
  });
});
