# 🎲 Monopoly en Ligne - Multijoueur Temps Réel

Un jeu de Monopoly jouable en ligne avec support multijoueur en temps réel grâce à Firebase!

## ✨ Fonctionnalités

### Mode Multijoueur (Firebase)
- ✅ **Parties en temps réel** - Jouez avec de vrais joueurs via Internet
- ✅ **Synchronisation automatique** - Tous les joueurs voient les mêmes actions en temps réel
- ✅ **Codes de partie simples** - Partagez un code à 3 chiffres pour inviter vos amis
- ✅ **Lobbies synchronisés** - Voyez qui rejoint votre partie en direct

### Mode Solo/Local
- ✅ **Jouez sans Internet** - Le jeu fonctionne aussi en mode local
- ✅ **Bots intelligents** - Ajoutez des adversaires IA
- ✅ **Sauvegarde locale** - Vos données restent sur votre navigateur

### Fonctionnalités de Jeu
- 🎮 Plateau de Monopoly complet (40 cases)
- 💰 Système d'argent et propriétés
- 🏠 Construction de maisons
- 🎲 Cartes Chance et Caisse de Communauté
- 🔒 Système de prison
- 💬 Chat en temps réel
- 😀 Personnalisation avec emojis
- 🎨 Skins multiples (Classique, Mecha)

## 🚀 Installation et Configuration

### Prérequis
- Un navigateur web moderne (Chrome, Firefox, Safari, Edge)
- Un compte Firebase (gratuit)
- Optionnel: Un serveur web local ou un hébergement web

### Étape 1: Cloner le Projet
```bash
git clone https://github.com/adamledams-prog/monopoli.git
cd monopoli
```

### Étape 2: Configurer Firebase

#### 2.1 Créer un Projet Firebase
1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Cliquez sur **"Ajouter un projet"**
3. Donnez un nom à votre projet (ex: "monopoly-online")
4. Suivez les étapes (Analytics optionnel)

#### 2.2 Activer Realtime Database
1. Dans votre projet Firebase, allez dans **"Build" > "Realtime Database"**
2. Cliquez sur **"Créer une base de données"**
3. Choisissez un emplacement (proche de vous)
4. Commencez en **mode test** (pour le développement)
   - ⚠️ Mode test: Règles ouvertes pendant 30 jours
   - 📝 Règles de sécurité recommandées après tests:
   ```json
   {
     "rules": {
       "games": {
         "$gameCode": {
           ".read": true,
           ".write": "auth == null || true"
         }
       }
     }
   }
   ```

#### 2.3 Obtenir les Identifiants Firebase
1. Dans Firebase Console, cliquez sur l'icône **⚙️** > **Paramètres du projet**
2. Descendez jusqu'à **"Vos applications"**
3. Cliquez sur **"</> Web"** pour ajouter une application web
4. Donnez un nom (ex: "Monopoly Web")
5. **Copiez la configuration** qui s'affiche

#### 2.4 Configurer le Projet
1. Ouvrez le fichier `firebase-config.js`
2. Remplacez la configuration par la vôtre:
```javascript
const firebaseConfig = {
    apiKey: "VOTRE_API_KEY",
    authDomain: "VOTRE_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://VOTRE_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "VOTRE_PROJECT_ID",
    storageBucket: "VOTRE_PROJECT_ID.appspot.com",
    messagingSenderId: "VOTRE_SENDER_ID",
    appId: "VOTRE_APP_ID"
};
```

### Étape 3: Lancer le Jeu

#### Option A: Serveur Web Local Simple
```bash
# Avec Python 3
python3 -m http.server 8000

# Avec Python 2
python -m SimpleHTTPServer 8000

# Avec Node.js (npx)
npx serve

# Avec PHP
php -S localhost:8000
```

Puis ouvrez: `http://localhost:8000`

#### Option B: Hébergement Gratuit

##### GitHub Pages
1. Créez un repo GitHub avec les fichiers
2. Allez dans Settings > Pages
3. Sélectionnez la branche `main`
4. Votre jeu sera accessible à: `https://USERNAME.github.io/REPO_NAME`

##### Netlify (Recommandé)
1. Allez sur [netlify.com](https://netlify.com)
2. Glissez-déposez le dossier du projet
3. Configuration automatique!

##### Firebase Hosting
```bash
# Installer Firebase CLI
npm install -g firebase-tools

# Se connecter
firebase login

# Initialiser
firebase init hosting

# Déployer
firebase deploy
```

## 🎮 Comment Jouer

### Mode Multijoueur

#### Créer une Partie
1. Entrez votre prénom
2. Choisissez votre emoji
3. Sélectionnez un skin
4. Cliquez sur **"🎮 Créer une partie"**
5. Partagez le **code à 3 chiffres** avec vos amis

#### Rejoindre une Partie
1. Entrez votre prénom
2. Choisissez votre emoji
3. Entrez le **code de partie** reçu
4. Cliquez sur **"🚪 Rejoindre une partie"**

#### Dans le Lobby
- **L'hôte** peut:
  - Ajouter des bots
  - Choisir l'argent de départ
  - Lancer la partie quand tout le monde est prêt
- **Les autres joueurs** voient les joueurs rejoindre en temps réel

### Pendant le Jeu

#### À Votre Tour
1. Cliquez sur **"🎲 Lancer les dés"**
2. Votre pion se déplace automatiquement
3. Suivez les instructions à l'écran (acheter, payer, etc.)

#### Actions Possibles
- **Acheter une propriété** - Quand vous atterrissez sur une propriété libre
- **Payer un loyer** - Quand vous atterrissez sur une propriété adverse
- **Construire une maison** - Cliquez sur votre propriété
- **Vendre une propriété** - Cliquez sur votre propriété
- **Utiliser le chat** - Communiquez avec les autres joueurs

#### Cases Spéciales
- **Case DÉPART** - Recevez 200€ en passant, 250€ si vous tombez pile dessus
- **Prison** - 3 options: payer 50€, utiliser une carte, ou attendre
- **Chance / Caisse de Communauté** - Tirez une carte
- **Impôts** - Payez le montant indiqué
- **Parc Gratuit** - Recevez un bonus aléatoire

## 📁 Structure du Projet

```
monopoli/
├── index.html              # Page d'accueil (connexion)
├── lobby.html              # Salle d'attente
├── map.html                # Plateau de jeu
├── script.js               # Logique page d'accueil
├── lobby-script.js         # Logique du lobby
├── map-script.js           # Logique du jeu principal
├── style.css               # Styles page d'accueil
├── lobby-style.css         # Styles du lobby
├── map-style.css           # Styles du plateau
├── skin-mecha.css          # Skin alternatif
├── bots.html               # Configuration des bots
├── bots-script.js          # Logique des bots
├── bots.css                # Styles des bots
├── firebase-config.js      # 🔥 Configuration Firebase
├── firebase-manager.js     # 🔥 Gestionnaire Firebase
└── game-sync-helper.js     # 🔥 Helper synchronisation jeu
```

## 🔧 Mode de Fonctionnement

### Architecture Firebase

```
Firebase Realtime Database
├── games/
│   ├── 123/                    # Code de partie
│   │   ├── code: "123"
│   │   ├── host: "player_xxx"
│   │   ├── status: "playing"
│   │   ├── startingMoney: 1500
│   │   ├── currentPlayerIndex: 0
│   │   ├── players/
│   │   │   ├── player_xxx/
│   │   │   │   ├── id: "player_xxx"
│   │   │   │   ├── prenom: "Alice"
│   │   │   │   ├── emoji: "😀"
│   │   │   │   └── isHost: true
│   │   │   └── player_yyy/
│   │   │       └── ...
│   │   └── gameState/
│   │       ├── players/        # État des joueurs en jeu
│   │       │   ├── 0/
│   │       │   │   ├── money: 1500
│   │       │   │   ├── position: 5
│   │       │   │   ├── inJail: false
│   │       │   │   └── ...
│   │       │   └── ...
│   │       └── properties/     # État des propriétés
│   │           ├── 1/
│   │           │   ├── owner: "Alice"
│   │           │   └── hasHouse: false
│   │           └── ...
│   └── 456/
│       └── ...
```

### Synchronisation Temps Réel

1. **L'hôte** est le maître du jeu:
   - Calcule les actions (dés, déplacements, transactions)
   - Synchronise l'état vers Firebase
   - Les autres joueurs reçoivent les mises à jour

2. **Les autres joueurs** sont en lecture seule:
   - Écoutent les changements Firebase
   - Mettent à jour leur affichage local
   - Peuvent uniquement agir à leur tour

3. **Synchronisation automatique**:
   - État du jeu synchronisé toutes les 5 secondes
   - Changements de tour synchronisés immédiatement
   - Propriétés synchronisées après chaque achat/vente

### Fallback Mode Local

Si Firebase n'est pas configuré ou échoue:
- ✅ Le jeu passe automatiquement en mode local
- ✅ Utilise localStorage pour sauvegarder
- ✅ Permet de jouer solo avec des bots
- ⚠️ Pas de multijoueur en ligne

## 🐛 Dépannage

### Firebase ne se connecte pas
- Vérifiez que vous avez bien remplacé `VOTRE_API_KEY` dans `firebase-config.js`
- Vérifiez que Realtime Database est activée dans Firebase Console
- Vérifiez les règles de sécurité (doivent autoriser la lecture/écriture en mode test)
- Ouvrez la console du navigateur (F12) pour voir les erreurs

### Le multijoueur ne fonctionne pas
- Vérifiez que tous les joueurs utilisent le même code de partie
- Vérifiez votre connexion Internet
- Rechargez la page
- Mode local activé? Vérifiez la configuration Firebase

### Le jeu est lent
- Réduisez la fréquence de synchronisation dans `game-sync-helper.js` (ligne 197)
- Vérifiez votre connexion Internet
- Choisissez une région Firebase proche de vous

### Erreur "Mode local activé"
- C'est normal si Firebase n'est pas configuré
- Le jeu fonctionne en solo
- Pour activer le multijoueur: suivez les étapes de configuration Firebase

## 📊 Limites du Plan Gratuit Firebase

Le plan **Spark (gratuit)** de Firebase Realtime Database offre:
- ✅ 1 GB de stockage
- ✅ 10 GB de téléchargement par mois
- ✅ 100 connexions simultanées

**Pour un jeu Monopoly:**
- Chaque partie = ~10 KB
- Chaque joueur = ~1 KB
- ✅ Suffisant pour **plusieurs milliers de parties par mois**
- ✅ Suffisant pour **100 joueurs en simultané**

Si vous dépassez ces limites, Firebase passera automatiquement en mode lecture seule jusqu'au mois suivant.

## 🔒 Sécurité et Production

### Pour un environnement de production:

1. **Règles Firebase recommandées** (`firebase.rules.json`):
```json
{
  "rules": {
    "games": {
      "$gameCode": {
        ".read": "auth != null || true",
        ".write": "auth != null || !data.exists() || data.child('players').child(auth.uid).exists()",
        "players": {
          "$playerId": {
            ".write": "$playerId === auth.uid || !data.exists()"
          }
        },
        "gameState": {
          ".write": "root.child('games').child($gameCode).child('host').val() === auth.uid"
        }
      }
    }
  }
}
```

2. **Ajouter Firebase Authentication** (optionnel):
   - Anonyme: Connexion automatique sans compte
   - Email: Authentification classique
   - Google/Facebook: OAuth

3. **Variables d'environnement**:
   - Ne commitez JAMAIS vos vraies clés API sur GitHub public
   - Utilisez des variables d'environnement pour la production

## 🤝 Contribution

Les contributions sont les bienvenues! N'hésitez pas à:
- 🐛 Signaler des bugs
- 💡 Proposer des fonctionnalités
- 🔧 Soumettre des pull requests

## 📝 Licence

Ce projet est libre d'utilisation pour un usage personnel et éducatif.

## 🎯 Roadmap Future

- [ ] Authentication Firebase pour plus de sécurité
- [ ] Système de classement/leaderboard
- [ ] Skins de plateau supplémentaires
- [ ] Mode tournoi
- [ ] Statistiques de jeu
- [ ] Replay des parties
- [ ] Support mobile amélioré
- [ ] Sons et musique
- [ ] Règles personnalisables

## 📞 Support

Pour toute question ou problème:
- Ouvrez une issue sur GitHub
- Consultez les logs de la console (F12)
- Vérifiez la configuration Firebase

---

**Bon jeu! 🎲🎉**
