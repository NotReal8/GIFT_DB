// js/firebase-config.js
// TODO: Replace with your actual Firebase project config
const firebaseConfig = {
  
  apiKey: "AIzaSyBV84ua2Dye4h3ZiFRbGrIjih6Rlg_xZD4",
  authDomain: "attendo-4192d.firebaseapp.com",
  projectId: "attendo-4192d",
  storageBucket: "attendo-4192d.firebasestorage.app",
  messagingSenderId: "1071634729761",
  appId: "1:1071634729761:web:be0b8d2d95d6bbc981cc60",
  measurementId: "G-GRWYPSKJP4"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
console.log('[Firebase] initialized');
