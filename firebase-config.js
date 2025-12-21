/**
 * Firebase Configuration
 *
 * INSTRUCTIONS POUR CONFIGURER FIREBASE:
 *
 * 1. Aller sur https://console.firebase.google.com/
 * 2. Créer un nouveau projet (ou utiliser un existant)
 * 3. Aller dans "Build" > "Realtime Database" et créer une base
 * 4. Choisir le mode "Test" pour les règles (à sécuriser plus tard)
 * 5. Dans "Project Settings" > "General", créer une Web App
 * 6. Copier la configuration Firebase et remplacer ci-dessous
 */

// ✅ Configuration Firebase - Projet monopoli-636b1
const firebaseConfig = {
    apiKey: "AIzaSyAgblqMINaMJXHfeR_gVzTiBirxqOnobTc",
    authDomain: "monopoli-636b1.firebaseapp.com",
    databaseURL: "https://monopoli-636b1-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "monopoli-636b1",
    storageBucket: "monopoli-636b1.firebasestorage.app",
    messagingSenderId: "718261114252",
    appId: "1:718261114252:web:7b2263f855905bd89e32a9",
    measurementId: "G-CY8SFECBVG"
};

// Initialiser Firebase (sera fait dans firebase-manager.js)
let app = null;
let database = null;

// Fonction pour vérifier si Firebase est configuré
function isFirebaseConfigured() {
    return firebaseConfig.apiKey !== "VOTRE_API_KEY";
}

// Exporter la configuration
window.FIREBASE_CONFIG = firebaseConfig;
window.isFirebaseConfigured = isFirebaseConfigured;
