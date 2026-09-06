// js/firebase-config.js
// TODO: Replace with your actual Firebase project config
const firebaseConfig = {
  
    apiKey: "AIzaSyC5u5bDABYcYrzIhDpikg4ltYECxkwFsMk",
    authDomain: "sentree-bdee7.firebaseapp.com",
    projectId: "sentree-bdee7",
    storageBucket: "sentree-bdee7.firebasestorage.app",
    messagingSenderId: "506288326530",
    appId: "1:506288326530:web:19a71eeca41f33382c319b",
    measurementId: "G-9Q3H4P2FJ1"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
console.log('[Firebase] initialized');
