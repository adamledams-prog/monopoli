/**
 * Firebase Game Sync Helper
 * Module pour synchroniser l'état du jeu en temps réel
 * À inclure dans map-script.js
 */

class GameSyncHelper {
    constructor() {
        this.gameCode = null;
        this.isHost = false;
        this.isUsingFirebase = false;
        this.syncInterval = null;
    }

    /**
     * Initialiser la synchronisation
     */
    async init(gameCode, isHost) {
        this.gameCode = gameCode;
        this.isHost = isHost;

        // Vérifier si Firebase est disponible
        if (window.firebaseManager && window.firebaseManager.isAvailable()) {
            this.isUsingFirebase = true;
            console.log('✅ Synchronisation Firebase activée pour le jeu');

            // Charger l'état initial du jeu
            await this.loadGameState();

            // Écouter les changements en temps réel si on n'est pas l'hôte
            if (!this.isHost) {
                this.startListening();
            }
        } else {
            console.warn('⚠️ Mode local - Pas de synchronisation multijoueur');
        }
    }

    /**
     * Charger l'état du jeu depuis Firebase
     */
    async loadGameState() {
        try {
            const gameState = await window.firebaseManager.getGameState(this.gameCode);

            if (gameState && gameState.gameState) {
                // Appliquer l'état du jeu
                const state = gameState.gameState;

                // Mettre à jour les joueurs
                if (state.players && window.players) {
                    window.players = state.players.map(p => ({
                        ...p,
                        // Conserver les fonctions locales si nécessaire
                    }));
                }

                // Mettre à jour le joueur actuel
                if (typeof gameState.currentPlayerIndex !== 'undefined' && window.currentPlayerIndex !== undefined) {
                    window.currentPlayerIndex = gameState.currentPlayerIndex;
                }

                // Mettre à jour les propriétés
                if (state.properties) {
                    this.applyPropertyUpdates(state.properties);
                }

                // Rafraîchir l'affichage
                if (window.displayPlayers) window.displayPlayers();
                if (window.displayTokens) window.displayTokens();
                if (window.updateCurrentTurn) window.updateCurrentTurn();

                console.log('✅ État du jeu chargé depuis Firebase');
            }
        } catch (error) {
            console.error('❌ Erreur chargement état du jeu:', error);
        }
    }

    /**
     * Écouter les changements en temps réel
     */
    startListening() {
        if (!this.isUsingFirebase) return;

        // Écouter les changements d'état du jeu
        window.firebaseManager.listenToGameState(this.gameCode, (gameState) => {
            if (gameState && gameState.players) {
                // Mettre à jour l'état local
                window.players = gameState.players;

                // Mettre à jour l'affichage
                if (window.displayPlayers) window.displayPlayers();
                if (window.displayTokens) window.displayTokens();

                // Mettre à jour les propriétés si nécessaire
                if (gameState.properties) {
                    this.applyPropertyUpdates(gameState.properties);
                }
            }
        });

        // 🆕 Écouter les actions des joueurs en temps réel
        this.listenToActions();

        // 🆕 Écouter les changements de tour
        this.listenToCurrentPlayer();

        console.log('🔄 Écoute des changements en temps réel activée');
    }

    /**
     * 🆕 Écouter les changements de tour
     */
    listenToCurrentPlayer() {
        if (!this.isUsingFirebase) return;

        const currentPlayerRef = window.firebaseManager.db.ref(`games/${this.gameCode}/currentPlayerIndex`);

        currentPlayerRef.on('value', (snapshot) => {
            const newPlayerIndex = snapshot.val();
            if (typeof newPlayerIndex === 'number' && newPlayerIndex !== window.currentPlayerIndex) {
                window.currentPlayerIndex = newPlayerIndex;

                // Mettre à jour l'affichage
                if (window.displayPlayers) window.displayPlayers();
                if (window.updateCurrentTurn) window.updateCurrentTurn();
                if (window.updateTurnUI) window.updateTurnUI();

                console.log(`🔄 Tour changé: joueur ${newPlayerIndex}`);
            }
        });
    }

    /**
     * 🆕 Écouter les actions des joueurs
     */
    listenToActions() {
        if (!this.isUsingFirebase) return;

        const actionsRef = window.firebaseManager.db.ref(`games/${this.gameCode}/actions`);

        actionsRef.on('child_added', (snapshot) => {
            const action = snapshot.val();

            // Appliquer l'action localement
            this.applyAction(action);

            // Supprimer l'action après traitement (évite de la rejouer)
            snapshot.ref.remove();
        });

        console.log('👂 Écoute des actions activée');
    }

    /**
     * 🆕 Envoyer une action à Firebase
     */
    async sendAction(actionType, data) {
        if (!this.isUsingFirebase) return;

        try {
            const actionsRef = window.firebaseManager.db.ref(`games/${this.gameCode}/actions`);
            const newActionRef = actionsRef.push();

            const action = {
                type: actionType,
                playerId: localStorage.getItem('currentPlayerId'),
                data: data,
                timestamp: Date.now()
            };

            await newActionRef.set(action);
            console.log(`📤 Action envoyée: ${actionType}`, data);
        } catch (error) {
            console.error('❌ Erreur envoi action:', error);
        }
    }

    /**
     * 🆕 Appliquer une action reçue
     */
    applyAction(action) {
        console.log(`📥 Action reçue: ${action.type}`, action.data);

        switch(action.type) {
            case 'ROLL_DICE':
                // L'hôte gère le déplacement et synchronise
                if (this.isHost) {
                    const playerIndex = window.players.findIndex(p => p.id === action.playerId);
                    if (playerIndex !== -1 && playerIndex === window.currentPlayerIndex) {
                        // Simuler le lancer de dés avec le résultat reçu
                        if (window.movePlayer) {
                            const total = action.data.dice1 + action.data.dice2;
                            window.movePlayer(playerIndex, total);
                        }
                    }
                }
                break;

            case 'BUY_PROPERTY':
                if (this.isHost) {
                    // Traiter l'achat
                    const playerIndex = window.players.findIndex(p => p.id === action.playerId);
                    if (playerIndex !== -1) {
                        // Logique d'achat sera gérée par le code existant
                        console.log(`💰 ${window.players[playerIndex].prenom} achète la propriété ${action.data.position}`);
                    }
                }
                break;

            case 'END_TURN':
                if (this.isHost) {
                    // Passer au joueur suivant
                    if (window.nextPlayer) {
                        window.nextPlayer();
                    }
                }
                break;

            default:
                console.warn(`⚠️ Action inconnue: ${action.type}`);
        }
    }

    /**
     * Synchroniser l'état des joueurs
     */
    async syncPlayers(players) {
        if (!this.isUsingFirebase || !this.isHost) return;

        try {
            // Mettre à jour tous les joueurs
            const gameRef = window.firebaseManager.db.ref(`games/${this.gameCode}/gameState/players`);
            await gameRef.set(players);
        } catch (error) {
            console.error('❌ Erreur sync joueurs:', error);
        }
    }

    /**
     * Synchroniser un joueur spécifique
     */
    async syncPlayer(playerId, updates) {
        if (!this.isUsingFirebase || !this.isHost) return;

        try {
            await window.firebaseManager.updatePlayerState(this.gameCode, playerId, updates);
        } catch (error) {
            console.error('❌ Erreur sync joueur:', error);
        }
    }

    /**
     * Synchroniser le tour actuel
     */
    async syncCurrentPlayer(currentPlayerIndex) {
        if (!this.isUsingFirebase || !this.isHost) return;

        try {
            await window.firebaseManager.updateCurrentPlayer(this.gameCode, currentPlayerIndex);
        } catch (error) {
            console.error('❌ Erreur sync tour:', error);
        }
    }

    /**
     * Synchroniser une propriété
     */
    async syncProperty(position, propertyData) {
        if (!this.isUsingFirebase || !this.isHost) return;

        try {
            await window.firebaseManager.updateProperty(this.gameCode, position, propertyData);
        } catch (error) {
            console.error('❌ Erreur sync propriété:', error);
        }
    }

    /**
     * Appliquer les mises à jour des propriétés
     */
    applyPropertyUpdates(properties) {
        Object.keys(properties).forEach(position => {
            const cell = document.querySelector(`[data-position="${position}"]`);
            if (cell) {
                const prop = properties[position];

                // Appliquer le propriétaire
                if (prop.owner) {
                    cell.setAttribute('data-owner', prop.owner);
                    cell.style.borderColor = '#11998e';
                    cell.style.borderWidth = '4px';

                    // Ajouter le badge du propriétaire si pas déjà présent
                    if (!cell.querySelector('.owner-badge')) {
                        const ownerPlayer = window.players.find(p => p.prenom === prop.owner);
                        if (ownerPlayer) {
                            const ownerBadge = document.createElement('div');
                            ownerBadge.textContent = ownerPlayer.emoji;
                            ownerBadge.className = 'owner-badge';
                            ownerBadge.style.cssText = `
                                position: absolute;
                                top: 2px;
                                right: 2px;
                                font-size: 1.2em;
                                z-index: 5;
                            `;
                            cell.appendChild(ownerBadge);
                        }
                    }
                }

                // Appliquer la maison
                if (prop.hasHouse) {
                    cell.setAttribute('data-has-house', 'true');

                    // Ajouter le badge maison si pas déjà présent
                    if (!cell.querySelector('.house-badge')) {
                        const houseBadge = document.createElement('div');
                        houseBadge.textContent = '🏠';
                        houseBadge.className = 'house-badge';
                        houseBadge.style.cssText = `
                            position: absolute;
                            top: 2px;
                            left: 2px;
                            font-size: 1.2em;
                            z-index: 5;
                            filter: drop-shadow(0 0 5px rgba(6, 255, 165, 0.8));
                        `;
                        cell.appendChild(houseBadge);
                    }
                }
            }
        });
    }

    /**
     * Démarrer la synchronisation automatique (pour l'hôte)
     */
    startAutoSync() {
        if (!this.isUsingFirebase || !this.isHost) return;

        // Synchroniser l'état toutes les 5 secondes
        this.syncInterval = setInterval(async () => {
            if (window.players) {
                await this.syncPlayers(window.players);
            }
            if (typeof window.currentPlayerIndex !== 'undefined') {
                await this.syncCurrentPlayer(window.currentPlayerIndex);
            }
        }, 5000);

        console.log('⏰ Synchronisation automatique démarrée (5s)');
    }

    /**
     * Arrêter la synchronisation
     */
    cleanup() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }

        if (this.isUsingFirebase && window.firebaseManager) {
            window.firebaseManager.cleanup();
        }
    }
}

// Instance globale
window.gameSyncHelper = new GameSyncHelper();
