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

// ⚠️ IMPORTANT: Remplacer par votre configuration Firebase
const firebaseConfig = {
    apiKey: "VOTRE_API_KEY",
    authDomain: "VOTRE_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://VOTRE_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "VOTRE_PROJECT_ID",
    storageBucket: "VOTRE_PROJECT_ID.appspot.com",
    messagingSenderId: "VOTRE_SENDER_ID",
    appId: "VOTRE_APP_ID"
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
