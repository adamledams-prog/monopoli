/**
 * Firebase Manager - Gestion du multijoueur en temps réel
 * Ce module gère toutes les interactions avec Firebase Realtime Database
 */

class FirebaseManager {
    constructor() {
        this.db = null;
        this.currentGame = null;
        this.currentPlayerId = null;
        this.listeners = {};
    }

    /**
     * Initialiser Firebase
     */
    async init() {
        try {
            if (!window.isFirebaseConfigured()) {
                throw new Error("Firebase n'est pas configuré. Voir firebase-config.js");
            }

            // Initialiser Firebase App
            this.app = firebase.initializeApp(window.FIREBASE_CONFIG);
            this.db = firebase.database();

            console.log("✅ Firebase initialisé avec succès");
            return true;
        } catch (error) {
            console.error("❌ Erreur d'initialisation Firebase:", error);
            // Fallback au localStorage si Firebase échoue
            return false;
        }
    }

    /**
     * 🆕 Configurer la présence en ligne
     */
    setupPresence(gameCode, playerId) {
        if (!this.db) return;

        try {
            const presenceRef = this.db.ref(`games/${gameCode}/presence/${playerId}`);
            const playerRef = this.db.ref(`games/${gameCode}/players/${playerId}`);

            // Marquer comme en ligne
            presenceRef.set({
                online: true,
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            });

            // Mettre à jour le statut du joueur
            playerRef.update({
                online: true,
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            });

            // Marquer comme déconnecté si le client perd la connexion
            presenceRef.onDisconnect().set({
                online: false,
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            });

            playerRef.onDisconnect().update({
                online: false,
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            });

            console.log('✅ Système de présence activé');
        } catch (error) {
            console.error('❌ Erreur configuration présence:', error);
        }
    }

    /**
     * 🆕 Reconnecter un joueur à une partie
     */
    async reconnect(gameCode, playerId) {
        try {
            const gameRef = this.db.ref(`games/${gameCode}`);
            const snapshot = await gameRef.once('value');

            if (!snapshot.exists()) {
                throw new Error("Cette partie n'existe plus");
            }

            const gameData = snapshot.val();

            // Vérifier que le joueur existe toujours dans la partie
            if (!gameData.players || !gameData.players[playerId]) {
                throw new Error("Vous n'êtes plus dans cette partie");
            }

            this.currentPlayerId = playerId;
            this.currentGame = gameCode;

            // Rétablir la présence
            this.setupPresence(gameCode, playerId);

            // Mettre à jour le joueur comme en ligne
            await gameRef.child(`players/${playerId}`).update({
                online: true,
                reconnectedAt: Date.now()
            });

            console.log(`✅ Reconnecté à la partie: ${gameCode}`);
            return gameData;
        } catch (error) {
            console.error("❌ Erreur reconnexion:", error);
            throw error;
        }
    }

    /**
     * Créer une nouvelle partie
     */
    async createGame(player) {
        try {
            const gameCode = this.generateGameCode();
            const gameRef = this.db.ref(`games/${gameCode}`);

            const playerId = this.generatePlayerId();
            this.currentPlayerId = playerId;
            this.currentGame = gameCode;

            const gameData = {
                code: gameCode,
                host: playerId,
                hostName: player.prenom,
                status: 'waiting', // waiting, playing, finished
                startingMoney: player.startingMoney || 1500,
                createdAt: Date.now(),
                players: {
                    [playerId]: {
                        id: playerId,
                        prenom: player.prenom,
                        emoji: player.emoji,
                        skin: player.skin || 'default',
                        isHost: true,
                        isBot: false,
                        joinedAt: Date.now()
                    }
                }
            };

            await gameRef.set(gameData);

            // 🆕 Configurer la présence
            this.setupPresence(gameCode, playerId);

            // Sauvegarder localement aussi
            localStorage.setItem('currentPlayerId', playerId);
            localStorage.setItem('currentGameCode', gameCode);
            localStorage.setItem('currentPlayer', JSON.stringify({
                ...player,
                gameCode: gameCode,
                playerId: playerId,
                isHost: true
            }));

            console.log(`✅ Partie créée: ${gameCode}`);
            return gameCode;
        } catch (error) {
            console.error("❌ Erreur création partie:", error);
            throw error;
        }
    }

    /**
     * Rejoindre une partie existante
     */
    async joinGame(gameCode, player) {
        try {
            const gameRef = this.db.ref(`games/${gameCode}`);
            const snapshot = await gameRef.once('value');

            if (!snapshot.exists()) {
                throw new Error("Cette partie n'existe pas");
            }

            const gameData = snapshot.val();

            if (gameData.status !== 'waiting') {
                throw new Error("Cette partie a déjà commencé");
            }

            const playerId = this.generatePlayerId();
            this.currentPlayerId = playerId;
            this.currentGame = gameCode;

            // Ajouter le joueur à la partie
            await gameRef.child(`players/${playerId}`).set({
                id: playerId,
                prenom: player.prenom,
                emoji: player.emoji,
                skin: player.skin || 'default',
                isHost: false,
                isBot: false,
                joinedAt: Date.now()
            });

            // 🆕 Configurer la présence
            this.setupPresence(gameCode, playerId);

            // Sauvegarder localement
            localStorage.setItem('currentPlayerId', playerId);
            localStorage.setItem('currentGameCode', gameCode);
            localStorage.setItem('currentPlayer', JSON.stringify({
                ...player,
                gameCode: gameCode,
                playerId: playerId,
                isHost: false
            }));

            console.log(`✅ Partie rejointe: ${gameCode}`);
            return gameCode;
        } catch (error) {
            console.error("❌ Erreur rejoindre partie:", error);
            throw error;
        }
    }

    /**
     * Ajouter un bot à la partie
     */
    async addBot(gameCode, botData) {
        try {
            const botId = this.generatePlayerId();
            const gameRef = this.db.ref(`games/${gameCode}/players/${botId}`);

            await gameRef.set({
                id: botId,
                prenom: botData.name,
                emoji: botData.emoji,
                skin: 'default',
                isHost: false,
                isBot: true,
                difficulty: botData.difficulty || 'normal',
                joinedAt: Date.now()
            });

            console.log(`✅ Bot ajouté: ${botData.name}`);
            return botId;
        } catch (error) {
            console.error("❌ Erreur ajout bot:", error);
            throw error;
        }
    }

    /**
     * Retirer un bot de la partie
     */
    async removeBot(gameCode, botId) {
        try {
            await this.db.ref(`games/${gameCode}/players/${botId}`).remove();
            console.log(`✅ Bot retiré: ${botId}`);
        } catch (error) {
            console.error("❌ Erreur retrait bot:", error);
            throw error;
        }
    }

    /**
     * Écouter les changements des joueurs dans le lobby
     */
    listenToPlayers(gameCode, callback) {
        const playersRef = this.db.ref(`games/${gameCode}/players`);

        const listener = playersRef.on('value', (snapshot) => {
            const players = [];
            snapshot.forEach((childSnapshot) => {
                players.push(childSnapshot.val());
            });
            callback(players);
        });

        this.listeners.players = { ref: playersRef, listener };
    }

    /**
     * Démarrer la partie
     */
    async startGame(gameCode) {
        try {
            const gameRef = this.db.ref(`games/${gameCode}`);

            // Récupérer les joueurs
            const playersSnapshot = await gameRef.child('players').once('value');
            const players = [];
            playersSnapshot.forEach((childSnapshot) => {
                const player = childSnapshot.val();
                players.push({
                    ...player,
                    money: 0, // Sera initialisé par startingMoney
                    position: 0,
                    isActive: true,
                    inJail: false,
                    jailTurns: 0,
                    jailFreeCards: 0,
                    lastMoneyAlert: null
                });
            });

            // Mettre à jour le statut et initialiser le jeu
            await gameRef.update({
                status: 'playing',
                startedAt: Date.now(),
                currentPlayerIndex: 0,
                gameState: {
                    players: players,
                    properties: {},
                    turnNumber: 1
                }
            });

            console.log(`✅ Partie démarrée: ${gameCode}`);
            return true;
        } catch (error) {
            console.error("❌ Erreur démarrage partie:", error);
            throw error;
        }
    }

    /**
     * Écouter l'état du jeu en temps réel
     */
    listenToGameState(gameCode, callback) {
        const gameStateRef = this.db.ref(`games/${gameCode}/gameState`);

        const listener = gameStateRef.on('value', (snapshot) => {
            const gameState = snapshot.val();
            if (gameState) {
                callback(gameState);
            }
        });

        this.listeners.gameState = { ref: gameStateRef, listener };
    }

    /**
     * Mettre à jour l'état d'un joueur
     */
    async updatePlayerState(gameCode, playerId, updates) {
        try {
            const playerRef = this.db.ref(`games/${gameCode}/gameState/players`);
            const snapshot = await playerRef.once('value');
            const players = snapshot.val() || [];

            // Trouver l'index du joueur
            const playerIndex = players.findIndex(p => p.id === playerId);
            if (playerIndex !== -1) {
                const updatedPlayer = { ...players[playerIndex], ...updates };
                await playerRef.child(playerIndex.toString()).update(updatedPlayer);
            }
        } catch (error) {
            console.error("❌ Erreur mise à jour joueur:", error);
            throw error;
        }
    }

    /**
     * Mettre à jour le joueur actuel (tour suivant)
     */
    async updateCurrentPlayer(gameCode, currentPlayerIndex) {
        try {
            await this.db.ref(`games/${gameCode}`).update({
                currentPlayerIndex: currentPlayerIndex
            });
        } catch (error) {
            console.error("❌ Erreur mise à jour tour:", error);
            throw error;
        }
    }

    /**
     * Mettre à jour une propriété
     */
    async updateProperty(gameCode, position, propertyData) {
        try {
            await this.db.ref(`games/${gameCode}/gameState/properties/${position}`).set(propertyData);
        } catch (error) {
            console.error("❌ Erreur mise à jour propriété:", error);
            throw error;
        }
    }

    /**
     * Récupérer l'état de la partie
     */
    async getGameState(gameCode) {
        try {
            const snapshot = await this.db.ref(`games/${gameCode}`).once('value');
            return snapshot.val();
        } catch (error) {
            console.error("❌ Erreur récupération état:", error);
            return null;
        }
    }

    /**
     * Quitter la partie
     */
    async leaveGame(gameCode, playerId) {
        try {
            await this.db.ref(`games/${gameCode}/players/${playerId}`).remove();

            // Si c'est dans une partie en cours, marquer comme inactif
            const gameState = await this.getGameState(gameCode);
            if (gameState && gameState.status === 'playing') {
                const players = gameState.gameState.players || [];
                const playerIndex = players.findIndex(p => p.id === playerId);
                if (playerIndex !== -1) {
                    await this.db.ref(`games/${gameCode}/gameState/players/${playerIndex}`).update({
                        isActive: false
                    });
                }
            }

            console.log(`✅ Partie quittée: ${gameCode}`);
        } catch (error) {
            console.error("❌ Erreur quitter partie:", error);
        }
    }

    /**
     * Nettoyer les listeners
     */
    cleanup() {
        Object.values(this.listeners).forEach(({ ref, listener }) => {
            ref.off('value', listener);
        });
        this.listeners = {};
    }

    /**
     * Générer un code de partie unique (3 chiffres)
     */
    generateGameCode() {
        return Math.floor(100 + Math.random() * 900).toString();
    }

    /**
     * Générer un ID de joueur unique
     */
    generatePlayerId() {
        return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Vérifier si Firebase est disponible
     */
    isAvailable() {
        return this.db !== null;
    }
}

// Instance globale
window.firebaseManager = new FirebaseManager();
