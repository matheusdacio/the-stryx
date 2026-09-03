importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDZfIAY7nEIzY7-tGoEDkLmp-Gu20sHpQE",
  authDomain: "the-stryx.firebaseapp.com",
  projectId: "the-stryx",
  storageBucket: "the-stryx.firebasestorage.app",
  messagingSenderId: "544479308598",
  appId: "1:544479308598:web:69ef136c14fbe8d9de6197",
});

// Só isso: o SDK do Firebase já mostra a notificação sozinho (usando
// notification.icon/badge/vibrate que os scripts de envio já mandam) e, no
// toque, foca a aba aberta ou abre o link. Um onBackgroundMessage +
// notificationclick próprios aqui duplicavam a notificação com o app fechado
// (o SDK mostra a dele, e este handler mostrava outra por cima).
firebase.messaging();
