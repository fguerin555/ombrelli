// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCYzvnN0B92BTXOe5ADkn0Eao0gcqou2-0",
  authDomain: "ombrelli-e333a.firebaseapp.com",
  projectId: "ombrelli-e333a",
  storageBucket: "ombrelli-e333a.firebasestorage.app",
  messagingSenderId: "579907100870",
  appId: "1:579907100870:web:babe491cd8d0047767f7c7",
  measurementId: "G-S7SG3QVTFT",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
