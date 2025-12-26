// Initialiser Firebase et la synchronisation du jeu
(async function initGameSync() {
    try {
        if (window.firebaseManager) {
            await window.firebaseManager.init();

            // Initialiser la synchronisation du jeu
            const gameCode = currentPlayer.gameCode;
            const isHost = currentPlayer.isHost;
            const playerId = localStorage.getItem('currentPlayerId');

            // 🆕 Configurer la présence
            if (playerId) {
                window.firebaseManager.setupPresence(gameCode, playerId);
            }

            if (window.gameSyncHelper) {
                await window.gameSyncHelper.init(gameCode, isHost);

                // Si on est l'hôte, démarrer la synchronisation automatique
                if (isHost) {
                    window.gameSyncHelper.startAutoSync();
                }
            }

            // 🆕 Détection de reconnexion
            window.addEventListener('online', async () => {
                console.log('🌐 Connexion rétablie');
                showNotification('🌐 Connexion rétablie, reconnexion...', 'success');

                try {
                    await window.firebaseManager.reconnect(gameCode, playerId);
                    if (window.gameSyncHelper) {
                        await window.gameSyncHelper.loadGameState();
                    }
                    showNotification('✅ Reconnecté avec succès !', 'success');
                } catch (error) {
                    showNotification('❌ Erreur de reconnexion', 'error');
                }
            });

            window.addEventListener('offline', () => {
                console.log('📡 Connexion perdue');
                showNotification('📡 Connexion perdue...', 'error');
            });
        }
    } catch (error) {
        console.warn('⚠️ Firebase non disponible pour le jeu:', error.message);
    }
})();

// Récupérer les informations du joueur
let currentPlayer = JSON.parse(localStorage.getItem('currentPlayer'));

// Si pas de joueur connecté, retour à l'accueil
if (!currentPlayer) {
    window.location.href = 'index.html';
}

// Appliquer le skin sélectionné
const selectedSkin = currentPlayer.skin || 'default';
if (selectedSkin === 'mecha') {
    document.body.classList.add('skin-mecha');
} else {
    // Retirer le lien du skin-mecha si skin par défaut
    const skinLink = document.getElementById('skin-stylesheet');
    if (skinLink) {
        skinLink.remove();
    }
}

// Charger les joueurs depuis le lobby (incluant les bots)
let savedPlayers = JSON.parse(localStorage.getItem('gamePlayers')) || [
    {
        prenom: currentPlayer.prenom,
        emoji: currentPlayer.emoji,
        gameCode: currentPlayer.gameCode,
        isHost: currentPlayer.isHost,
        isBot: false
    }
];

// Récupérer l'argent de départ choisi
const startingMoney = currentPlayer.startingMoney || 1500;

// Initialiser les joueurs avec l'argent et la position
let players = savedPlayers.map(player => ({
    prenom: player.prenom,
    emoji: player.emoji,
    money: startingMoney,
    position: 0,
    isActive: true,
    isBot: player.isBot || false,
    difficulty: player.difficulty || null,
    lastMoneyAlert: null, // Pour éviter les alertes répétées
    inJail: false, // Si le joueur est en prison
    jailTurns: 0, // Nombre de tours restants en prison
    jailFreeCards: 0, // Nombre de cartes "Sortie de prison" possédées
    eventType: currentPlayer.eventType || 'christmas' // Transférer le type d'événement
}));

let currentPlayerIndex = 0;
let diceRolling = false;

// Seuils d'alerte pour l'argent
const moneyAlertThresholds = [1200, 1000, 700, 500, 200];

// Messages automatiques des bots toutes les 20 secondes
const botAutoMessages = [
    "🤖 C'est les bots qui vont gagner !",
    "😏 Les humains sont nuls !",
    "💪 On est trop forts !",
    "🎯 Aucune chance face à nous !",
    "🏆 La victoire sera pour les bots !",
    "😎 Vous n'avez aucune chance !",
    "🤓 Notre intelligence artificielle domine !",
    "⚡ Les bots sont imbattables !"
];

// Fonction pour envoyer un message automatique des bots
function sendBotAutoMessage() {
    const bots = players.filter(p => p.isBot);
    if (bots.length > 0) {
        const randomBot = bots[Math.floor(Math.random() * bots.length)];
        const randomMessage = botAutoMessages[Math.floor(Math.random() * botAutoMessages.length)];
        addChatMessage(randomMessage, randomBot.prenom, false, true);
    }
}

// Démarrer les messages automatiques des bots toutes les 20 secondes
setInterval(sendBotAutoMessage, 20000);

// Fonction pour vérifier et envoyer une alerte d'argent
function checkMoneyAlert(player) {
    for (let threshold of moneyAlertThresholds) {
        if (player.money <= threshold && (player.lastMoneyAlert === null || player.lastMoneyAlert > threshold)) {
            player.lastMoneyAlert = threshold;

            // Si c'est un bot qui a moins de 1000€, il se plaint
            if (player.isBot && player.money < 1000) {
                addChatMessage('😰 Je suis dans la mouise !', player.prenom, false, true);
            }

            // Choisir un bot aléatoire pour envoyer le message (mais pas le joueur lui-même s'il est un bot)
            const bots = players.filter(p => p.isBot && p.prenom !== player.prenom);
            if (bots.length > 0) {
                const randomBot = bots[Math.floor(Math.random() * bots.length)];
                const message = `⚠️ Attention ${player.prenom} ! Tu n'as plus que ${player.money}€`;
                addChatMessage(message, randomBot.prenom, false, true);
            }
            break;
        }
    }
}

// Afficher les joueurs
// Afficher le tour actuel
function updateCurrentTurn() {
    const currentTurnDiv = document.getElementById('current-turn');
    const currentPlayer = players[currentPlayerIndex];
    currentTurnDiv.textContent = `Tour de ${currentPlayer.emoji} ${currentPlayer.prenom}`;
}

// Positionner les pions sur le plateau
function displayTokens() {
    // Retirer tous les pions existants
    document.querySelectorAll('.player-token').forEach(token => token.remove());

    // Grouper les joueurs par position
    const playersByPosition = {};
    players.forEach((player, index) => {
        if (!playersByPosition[player.position]) {
            playersByPosition[player.position] = [];
        }
        playersByPosition[player.position].push({ player, originalIndex: index });
    });

    // Afficher les pions groupés par position
    Object.keys(playersByPosition).forEach(position => {
        const cell = document.querySelector(`[data-position="${position}"]`);
        if (cell) {
            const playersOnCell = playersByPosition[position];
            playersOnCell.forEach((playerData, indexOnCell) => {
                const token = document.createElement('div');
                token.className = 'player-token';
                token.textContent = playerData.player.emoji;

                // Disposer les pions en grille 2x2
                token.style.left = `${(indexOnCell % 2) * 30}px`;
                token.style.top = `${Math.floor(indexOnCell / 2) * 30}px`;

                cell.appendChild(token);
            });
        }
    });
}

// Vérifier si c'est le tour du joueur actuel
function isMyTurn() {
    const myPlayerId = localStorage.getItem('currentPlayerId');
    if (!myPlayerId) return false;

    const currentTurnPlayer = players[currentPlayerIndex];
    return currentTurnPlayer && currentTurnPlayer.id === myPlayerId;
}

// Mettre à jour l'interface selon le tour
function updateTurnUI() {
    const rollButton = document.getElementById('btn-roll-dice');
    const turnIndicator = document.getElementById('current-turn');

    if (isMyTurn()) {
        // C'est mon tour
        rollButton.disabled = false;
        rollButton.style.opacity = '1';
        rollButton.style.cursor = 'pointer';
        rollButton.textContent = '🎲 À VOUS DE JOUER !';
        rollButton.style.background = 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)';
        rollButton.style.animation = 'pulse 1.5s infinite';

        if (turnIndicator) {
            turnIndicator.innerHTML = `<div style="color: #11998e; font-weight: bold; font-size: 1.2em;">✨ C'est votre tour !</div>`;
        }
    } else {
        // Ce n'est pas mon tour
        const currentTurnPlayer = players[currentPlayerIndex];
        rollButton.disabled = true;
        rollButton.style.opacity = '0.5';
        rollButton.style.cursor = 'not-allowed';
        rollButton.textContent = `⏰ Tour de ${currentTurnPlayer.prenom}`;
        rollButton.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        rollButton.style.animation = 'none';

        if (turnIndicator) {
            turnIndicator.innerHTML = `<div style="color: #667eea;">En attente de ${currentTurnPlayer.emoji} ${currentTurnPlayer.prenom}...</div>`;
        }
    }
}

// Lancer les dés
function rollDice() {
    if (diceRolling) return;

    // 🆕 VÉRIFICATION : Est-ce mon tour ?
    if (!isMyTurn()) {
        showNotification('⏰ Ce n\'est pas votre tour !', 'error');
        return;
    }

    const currentPlayer = players[currentPlayerIndex];

    // Vérifier si le joueur est en prison
    if (currentPlayer.inJail && currentPlayer.jailTurns > 0) {
        showJailDialog(currentPlayerIndex);
        return;
    }

    diceRolling = true;
    const btn = document.getElementById('btn-roll-dice');
    btn.disabled = true;

    const diceResult = document.getElementById('dice-result');
    let rolls = 0;
    const maxRolls = 10;

    // Vérifier si c'est un bot qui joue
    const isBot = currentPlayer.isBot;

    // Animation du lancer de dés
    const diceEmojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    const interval = setInterval(() => {
        const dice1 = Math.floor(Math.random() * 6) + 1;
        const dice2 = Math.floor(Math.random() * 6) + 1;
        diceResult.innerHTML = `<span style="display: inline-block; animation: spin 0.1s linear;">${diceEmojis[dice1-1]}</span> + <span style="display: inline-block; animation: spin 0.1s linear;">${diceEmojis[dice2-1]}</span>`;

        rolls++;

        if (rolls >= maxRolls) {
            clearInterval(interval);
            let finalDice1, finalDice2, total;

            if (isBot) {
                // Pour les bots: générer un nombre entre 2 et 12
                total = Math.floor(Math.random() * 11) + 2;
                // Simuler deux dés qui donnent ce total
                finalDice1 = Math.min(6, Math.floor(Math.random() * (total - 1)) + 1);
                finalDice2 = total - finalDice1;
                if (finalDice2 > 6) {
                    finalDice1 = total - 6;
                    finalDice2 = 6;
                }
            } else {
                // Pour les humains: lancer normal
                finalDice1 = Math.floor(Math.random() * 6) + 1;
                finalDice2 = Math.floor(Math.random() * 6) + 1;
                total = finalDice1 + finalDice2;
            }

            diceResult.innerHTML = `<div style="font-size: 1.5em; margin-bottom: 10px;">${diceEmojis[finalDice1-1]} + ${diceEmojis[finalDice2-1]}</div><div style="font-size: 1.2em; color: #667eea; font-weight: bold;">= ${total}</div>`;

            // 🆕 Si Firebase est actif et que je ne suis pas un bot, envoyer l'action
            if (window.gameSyncHelper && window.gameSyncHelper.isUsingFirebase && !isBot) {
                // Envoyer l'action de lancer de dés
                window.gameSyncHelper.sendAction('ROLL_DICE', {
                    dice1: finalDice1,
                    dice2: finalDice2
                });
            } else {
                // Mode local ou bot : déplacer directement
                movePlayer(currentPlayerIndex, total);
            }

            // Réinitialiser le diceRolling après un court délai
            setTimeout(() => {
                diceRolling = false;
                btn.disabled = false;
                diceResult.innerHTML = '';
            }, 3000);
        }
    }, 100);
}

// Déplacer un joueur
function movePlayer(playerIndex, steps) {
    const player = players[playerIndex];
    const startPosition = player.position;
    let newPosition = player.position + steps;
    let passedStart = false;

    // Si on passe par la case départ (sans s'arrêter dessus)
    if (newPosition >= 40) {
        newPosition = newPosition % 40;
        passedStart = true;

        // Afficher le dialog animé pour le passage par la case départ (+200€)
        setTimeout(() => {
            showPassStartDialog(playerIndex, () => {
                // Callback appelé après la fermeture du dialogue
                checkLanding(playerIndex);
            });
        }, 1000);

        // Messages des bots pour le passage à la case départ
        setTimeout(() => {
            const bots = players.filter(p => p.isBot && p.prenom !== player.prenom);
            if (bots.length > 0) {
                const randomBot = bots[Math.floor(Math.random() * bots.length)];
                let message = '';

                // Choisir le message en fonction de l'argent du joueur
                if (player.money > 1500 * 1.7) { // Plus de 170% de l'argent de départ
                    message = `😱 Il est trop en avance ${player.prenom} !`;
                } else {
                    const messages = [
                        `✅ Déjà un tour de fait pour ${player.prenom} !`,
                        `💰 +200€ pour ${player.prenom} !`,
                        `🎉 ${player.prenom} a complété un tour !`
                    ];
                    message = messages[Math.floor(Math.random() * messages.length)];
                }

                addChatMessage(message, randomBot.prenom, false, true);
            }
        }, 1000);
    }

    // Animation du déplacement case par case
    let currentStep = 0;
    const moveInterval = setInterval(() => {
        currentStep++;
        const tempPosition = (startPosition + currentStep) % 40;

        // Mettre à jour temporairement la position pour l'animation
        const tempPlayers = [...players];
        tempPlayers[playerIndex] = { ...player, position: tempPosition };

        // Retirer tous les pions et afficher avec la position temporaire
        document.querySelectorAll('.player-token').forEach(token => token.remove());

        // Grouper les joueurs par position pour l'animation
        const playersByPosition = {};
        tempPlayers.forEach((p, index) => {
            if (!playersByPosition[p.position]) {
                playersByPosition[p.position] = [];
            }
            playersByPosition[p.position].push({ player: p, originalIndex: index });
        });

        // Afficher les pions groupés
        Object.keys(playersByPosition).forEach(position => {
            const cell = document.querySelector(`[data-position="${position}"]`);
            if (cell) {
                const playersOnCell = playersByPosition[position];
                playersOnCell.forEach((playerData, indexOnCell) => {
                    const token = document.createElement('div');
                    token.className = 'player-token';
                    token.textContent = playerData.player.emoji;
                    token.style.left = `${(indexOnCell % 2) * 30}px`;
                    token.style.top = `${Math.floor(indexOnCell / 2) * 30}px`;
                    cell.appendChild(token);
                });
            }
        });

        if (currentStep === steps) {
            clearInterval(moveInterval);
            player.position = newPosition;
            displayTokens();
            displayPlayers();
            // Ne pas appeler checkLanding si on a passé par départ
            // car il sera appelé après la fermeture du dialogue
            if (!passedStart) {
                checkLanding(playerIndex);
            }
        }
    }, 200);
}

// Afficher un message flottant
function showFloatingMessage(text, type) {
    const message = document.createElement('div');
    message.textContent = text;
    message.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: ${type === 'success' ? 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' : type === 'error' ? 'linear-gradient(135deg, #ee0979 0%, #ff6a00 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};
        color: white;
        padding: 30px 50px;
        border-radius: 20px;
        font-size: 2.5em;
        font-weight: bold;
        z-index: 1000;
        box-shadow: 0 15px 40px rgba(0, 0, 0, 0.4), 0 0 60px ${type === 'success' ? 'rgba(56, 239, 125, 0.5)' : type === 'error' ? 'rgba(238, 9, 121, 0.5)' : 'rgba(102, 126, 234, 0.5)'};
        animation: floatUp 2.5s ease-out forwards;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
        border: 3px solid rgba(255, 255, 255, 0.3);
    `;
    document.body.appendChild(message);

    setTimeout(() => message.remove(), 2500);
}

// Vérifier la case d'arrivée
function checkLanding(playerIndex) {
    const player = players[playerIndex];
    const position = player.position;
    const cell = document.querySelector(`[data-position="${position}"]`);

    // Effet visuel sur la case
    if (cell) {
        cell.style.transform = 'scale(1.1)';
        cell.style.boxShadow = '0 0 30px rgba(102, 126, 234, 0.8)';
        setTimeout(() => {
            cell.style.transform = '';
            cell.style.boxShadow = '';
        }, 1000);
    }

    console.log(`${player.prenom} arrive sur la case ${position}`);

    // Logique des cases spéciales
    if (position === 0) {
        // Tomber pile sur la case DÉPART = bonus de 250€ avec animation
        showStartBonusDialog(playerIndex);
    } else if (position === 10) {
        showNotification(`${player.emoji} ${player.prenom} visite la prison`, 'info');

        // Passer au joueur suivant
        setTimeout(() => {
            checkNextPlayer();
        }, 2000);
    } else if (position === 20) {
        showNotification(`${player.emoji} ${player.prenom} profite du parc gratuit!`, 'success');
        const bonus = Math.floor(Math.random() * 100) + 50;
        player.money += bonus;
        showFloatingMessage(`+${bonus}€ BONUS PARC`, 'success');

        // Passer au joueur suivant
        setTimeout(() => {
            checkNextPlayer();
        }, 2000);
    } else if (position === 30) {
        // Déterminer le nombre de tours en prison selon le nombre de joueurs
        const jailTurns = players.length <= 3 ? 2 : 3;
        player.inJail = true;
        player.jailTurns = jailTurns;

        showNotification(`${player.emoji} ${player.prenom} va en prison pour ${jailTurns} tour(s)!`, 'error');
        showFloatingMessage(`🚔 EN PRISON ${jailTurns} TOUR(S)!`, 'error');

        // Message du bot s'il va en prison
        if (player.isBot) {
            setTimeout(() => {
                const jailMessages = [
                    `😱 Non je suis en prison !`,
                    `😭 Noooon pas la prison !`,
                    `🚔 C'est pas juste !`,
                    `😡 Je vais sortir et me venger !`
                ];
                const randomMessage = jailMessages[Math.floor(Math.random() * jailMessages.length)];
                addChatMessage(randomMessage, player.prenom, false, true);
            }, 500);
        }

        setTimeout(() => {
            player.position = 10;
            displayTokens();

            // Passer au joueur suivant après être allé en prison
            setTimeout(() => {
                checkNextPlayer();
            }, 1000);
        }, 1000);
    } else if ([4, 38].includes(position)) {
        // Cases d'impôts
        const taxAmount = parseInt(cell.getAttribute('data-tax') || 0);
        player.money -= taxAmount;
        showNotification(`${player.emoji} ${player.prenom} paie ${taxAmount}€ d'impôts!`, 'error');
        showFloatingMessage(`-${taxAmount}€ IMPÔTS`, 'error');

        // Passer au joueur suivant après avoir payé les impôts
        setTimeout(() => {
            checkNextPlayer();
        }, 2000);
    } else if ([2, 17, 33].includes(position)) {
        // Cases Caisse de Communauté
        drawCommunityCard(playerIndex);
    } else if ([7, 22, 36].includes(position)) {
        // Cases Chance
        drawChanceCard(playerIndex);
    } else {
        // Vérifier si c'est une propriété achetable
        checkPropertyPurchase(playerIndex, position, cell);
    }

    displayPlayers();
}

// Gérer l'achat de propriété
function checkPropertyPurchase(playerIndex, position, cell) {
    const player = players[playerIndex];

    // Positions des propriétés achetables (pas les coins, chance, communauté, impôts)
    const specialPositions = [0, 2, 4, 7, 10, 17, 20, 22, 30, 33, 36, 38];
    if (specialPositions.includes(position)) return;

    // Récupérer les infos de la propriété
    const propertyName = cell.querySelector('.cell-name')?.textContent || 'Propriété';
    const propertyPrice = cell.querySelector('.cell-price')?.textContent || '0€';
    const price = parseInt(propertyPrice.replace('€', ''));

    // Vérifier si la propriété est déjà achetée
    if (cell.hasAttribute('data-owner')) {
        const owner = cell.getAttribute('data-owner');
        if (owner === player.prenom) {
            if (!player.isBot) {
                showNotification(`${player.emoji} Vous êtes sur votre propriété`, 'info');
            }
            // Passer au joueur suivant après un court délai
            setTimeout(() => {
                checkNextPlayer();
            }, 1500);
        } else {
            // Vérifier si la propriété a une maison
            const hasHouse = cell.hasAttribute('data-has-house');
            const rentPercent = hasHouse ? 1.0 : 0.70; // 100% si maison, 70% sinon
            const rent = Math.floor(price * rentPercent);
            player.money -= rent;

            // Trouver le propriétaire et lui donner l'argent
            const ownerPlayer = players.find(p => p.prenom === owner);
            if (ownerPlayer) {
                ownerPlayer.money += rent;
            }

            const houseEmoji = hasHouse ? '🏠 ' : '';
            showNotification(`${player.emoji} ${player.prenom} paie ${rent}€ de loyer ${houseEmoji}à ${owner}`, 'error');
            showFloatingMessage(`-${rent}€ ${houseEmoji}LOYER`, 'error');

            // Passer au joueur suivant après le paiement du loyer
            setTimeout(() => {
                checkNextPlayer();
            }, 2000);
        }
        return;
    }

    // Si c'est un bot, décider automatiquement
    if (player.isBot) {
        if (player.money >= price && botDecideToBuy(player, price)) {
            // Le bot décide d'acheter
            player.money -= price;
            cell.setAttribute('data-owner', player.prenom);
            cell.style.borderColor = '#667eea';
            cell.style.borderWidth = '4px';

            // Ajouter un indicateur de propriétaire
            const ownerBadge = document.createElement('div');
            ownerBadge.textContent = player.emoji;
            ownerBadge.style.cssText = `
                position: absolute;
                top: 2px;
                right: 2px;
                font-size: 1.2em;
                z-index: 5;
            `;
            cell.appendChild(ownerBadge);

            showNotification(`${player.emoji} ${player.prenom} a acheté ${propertyName}!`, 'success');
            displayPlayers();

            // Passer au joueur suivant après l'achat du bot
            setTimeout(() => {
                checkNextPlayer();
            }, 2000);
        } else {
            showNotification(`${player.emoji} ${player.prenom} n'achète pas ${propertyName}`, 'info');

            // Passer au joueur suivant si le bot n'achète pas
            setTimeout(() => {
                checkNextPlayer();
            }, 2000);
        }
    } else {
        // Proposer l'achat aux joueurs humains
        showPropertyPurchaseDialog(playerIndex, position, cell, propertyName, price);
    }
}

// Afficher la boîte de dialogue d'achat
function showPropertyPurchaseDialog(playerIndex, position, cell, propertyName, price) {
    const player = players[playerIndex];

    const dialog = document.createElement('div');
    dialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
        padding: 40px;
        border-radius: 25px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        z-index: 3000;
        text-align: center;
        border: 3px solid rgba(102, 126, 234, 0.3);
        min-width: 400px;
    `;

    dialog.innerHTML = `
        <h2 style="color: #333; margin-bottom: 20px; font-size: 2em;">🏠 ${propertyName}</h2>
        <p style="color: #555; font-size: 1.5em; margin-bottom: 30px; font-weight: 600;">Prix: ${price}€</p>
        <p style="color: #666; margin-bottom: 30px; font-size: 1.1em;">Votre argent: ${player.money}€</p>
        <div style="display: flex; gap: 15px; justify-content: center;">
            <button id="btn-buy" style="
                padding: 15px 30px;
                background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
                color: white;
                border: none;
                border-radius: 12px;
                font-size: 1.2em;
                font-weight: 700;
                cursor: pointer;
                box-shadow: 0 5px 15px rgba(56, 239, 125, 0.3);
            ">✅ Acheter</button>
            <button id="btn-pass" style="
                padding: 15px 30px;
                background: linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%);
                color: white;
                border: none;
                border-radius: 12px;
                font-size: 1.2em;
                font-weight: 700;
                cursor: pointer;
                box-shadow: 0 5px 15px rgba(127, 140, 141, 0.3);
            ">❌ Passer</button>
        </div>
    `;

    document.body.appendChild(dialog);

    // Bouton Acheter
    dialog.querySelector('#btn-buy').addEventListener('click', () => {
        if (player.money >= price) {
            player.money -= price;
            cell.setAttribute('data-owner', player.prenom);
            cell.style.borderColor = '#11998e';
            cell.style.borderWidth = '4px';

            // Ajouter un indicateur de propriétaire
            const ownerBadge = document.createElement('div');
            ownerBadge.textContent = player.emoji;
            ownerBadge.className = 'owner-badge';
            ownerBadge.style.cssText = `
                position: absolute;
                top: 2px;
                right: 2px;
                font-size: 1.2em;
                z-index: 5;
            `;
            cell.appendChild(ownerBadge);

            showNotification(`${player.emoji} ${player.prenom} a acheté ${propertyName}!`, 'success');
            showFloatingMessage(`🏠 PROPRIÉTÉ ACHETÉE!`, 'success');
            displayPlayers();
        } else {
            showNotification(`${player.emoji} Pas assez d'argent!`, 'error');
            showFloatingMessage(`💰 FONDS INSUFFISANTS!`, 'error');
        }
        dialog.remove();

        // Passer automatiquement au joueur suivant
        setTimeout(() => {
            checkNextPlayer();
        }, 1000);
    });

    // Bouton Passer
    dialog.querySelector('#btn-pass').addEventListener('click', () => {
        showNotification(`${player.emoji} ${player.prenom} n'achète pas ${propertyName}`, 'info');
        dialog.remove();

        // Passer automatiquement au joueur suivant
        setTimeout(() => {
            checkNextPlayer();
        }, 1000);
    });
}

// Cartes Caisse de Communauté
const communityCards = [
    { text: "Vous héritez de 100€", amount: 100, type: 'success' },
    { text: "Erreur de la banque en votre faveur, recevez 200€", amount: 200, type: 'success' },
    { text: "Recevez votre revenu annuel de 100€", amount: 100, type: 'success' },
    { text: "Les contributions vous remboursent 20€", amount: 20, type: 'success' },
    { text: "Vous gagnez le deuxième prix de beauté, recevez 10€", amount: 10, type: 'success' },
    { text: "C'est votre anniversaire, recevez 10€", amount: 10, type: 'success' },
    { text: "Amende pour excès de vitesse, payez 15€", amount: -15, type: 'error' },
    { text: "Payez votre prime d'assurance de 50€", amount: -50, type: 'error' },
    { text: "Payez les frais de scolarité de 50€", amount: -50, type: 'error' },
    { text: "Payez la note du médecin de 50€", amount: -50, type: 'error' },
    { text: "Payez les frais d'hôpital de 100€", amount: -100, type: 'error' },
    { text: "🎫 Carte Sortie de Prison - Conservez cette carte pour sortir de prison gratuitement!", amount: 0, type: 'info', special: 'get-jail-card' },
    { text: "Allez en prison directement", amount: 0, type: 'error', special: 'go-jail' },
    { text: "Avancez jusqu'à la case DÉPART", amount: 0, type: 'success', special: 'go-start' }
];

// Cartes Chance
const chanceCards = [
    { text: "Avancez jusqu'à la case DÉPART, recevez 200€", amount: 200, type: 'success', special: 'go-start' },
    { text: "La banque vous verse un dividende de 50€", amount: 50, type: 'success' },
    { text: "C'est votre anniversaire, gagnez 50€", amount: 50, type: 'success' },
    { text: "Amende pour ivresse, payez 20€", amount: -20, type: 'error' },
    { text: "Faites des réparations dans toutes vos maisons, payez 25€", amount: -25, type: 'error' },
    { text: "Faites des réparations dans tous vos hôtels, payez 100€", amount: -100, type: 'error' },
    { text: "Vous gagnez un voyage gratuit, avancez jusqu'au prochain gare", amount: 0, type: 'info', special: 'next-station' },
    { text: "Votre immeuble rapporte des revenus, recevez 150€", amount: 150, type: 'success' },
    { text: "Reculez de 3 cases", amount: 0, type: 'info', special: 'back-3' },
    { text: "🎫 Carte Sortie de Prison - Conservez cette carte pour sortir de prison gratuitement!", amount: 0, type: 'info', special: 'get-jail-card' },
    { text: "Allez en prison directement", amount: 0, type: 'error', special: 'go-jail' },
    { text: "Rendez-vous Rue de la Paix", amount: 0, type: 'info', special: 'go-39' },
    { text: "Votre prêt de construction échoit, recevez 150€", amount: 150, type: 'success' }
];

// Afficher le bonus de la case DÉPART avec animation
function showStartBonusDialog(playerIndex) {
    const player = players[playerIndex];

    // Créer un fond sombre avec effet
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0);
        z-index: 2998;
        transition: background 0.5s ease;
    `;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.style.background = 'rgba(0, 0, 0, 0.85)', 50);

    // Créer des particules d'étoiles
    for (let i = 0; i < 30; i++) {
        const star = document.createElement('div');
        const x = Math.random() * window.innerWidth;
        const y = Math.random() * window.innerHeight;
        const size = Math.random() * 4 + 2;
        const delay = Math.random() * 0.5;

        star.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            width: ${size}px;
            height: ${size}px;
            background: radial-gradient(circle, #fff 0%, transparent 70%);
            border-radius: 50%;
            z-index: 2998;
            pointer-events: none;
            opacity: 0;
            animation: starTwinkle 2s ease-in-out ${delay}s infinite;
        `;
        document.body.appendChild(star);
        setTimeout(() => star.remove(), 5000);
    }

    // Ajouter animation CSS pour les étoiles
    if (!document.getElementById('star-animation')) {
        const style = document.createElement('style');
        style.id = 'star-animation';
        style.textContent = `
            @keyframes starTwinkle {
                0%, 100% { opacity: 0; transform: scale(0); }
                50% { opacity: 1; transform: scale(1.5); }
            }
            @keyframes rainbowGlow {
                0% { box-shadow: 0 0 40px rgba(255, 0, 0, 0.8), 0 0 80px rgba(255, 0, 0, 0.4); }
                16% { box-shadow: 0 0 40px rgba(255, 165, 0, 0.8), 0 0 80px rgba(255, 165, 0, 0.4); }
                33% { box-shadow: 0 0 40px rgba(255, 255, 0, 0.8), 0 0 80px rgba(255, 255, 0, 0.4); }
                50% { box-shadow: 0 0 40px rgba(0, 255, 0, 0.8), 0 0 80px rgba(0, 255, 0, 0.4); }
                66% { box-shadow: 0 0 40px rgba(0, 0, 255, 0.8), 0 0 80px rgba(0, 0, 255, 0.4); }
                83% { box-shadow: 0 0 40px rgba(128, 0, 255, 0.8), 0 0 80px rgba(128, 0, 255, 0.4); }
                100% { box-shadow: 0 0 40px rgba(255, 0, 0, 0.8), 0 0 80px rgba(255, 0, 0, 0.4); }
            }
            @keyframes flagWave {
                0%, 100% { transform: rotate(-5deg); }
                50% { transform: rotate(5deg); }
            }
        `;
        document.head.appendChild(style);
    }

    // Animation de la carte avec effet arc-en-ciel
    const animatedCard = document.createElement('div');
    animatedCard.style.cssText = `
        position: fixed;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%) scale(0);
        width: 180px;
        height: 250px;
        background: linear-gradient(135deg, #11998e 0%, #38ef7d 50%, #ffbe0b 100%);
        border-radius: 25px;
        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.9);
        z-index: 2999;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 6em;
        transition: all 1.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        border: 6px solid rgba(255, 255, 255, 0.7);
        animation: rainbowGlow 3s linear infinite;
    `;
    animatedCard.innerHTML = `<span style="filter: drop-shadow(0 0 30px rgba(255,255,255,1)); animation: flagWave 0.5s ease-in-out infinite;">🏁</span>`;
    document.body.appendChild(animatedCard);

    // Animation d'apparition explosive
    setTimeout(() => {
        animatedCard.style.transform = 'translate(-50%, -50%) scale(3) rotate(720deg)';
    }, 100);

    // Afficher le contenu
    setTimeout(() => {
        animatedCard.remove();

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.5);
            background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
            padding: 50px;
            border-radius: 25px;
            box-shadow: 0 30px 80px rgba(0, 0, 0, 0.8), 0 0 50px rgba(17, 153, 142, 0.5);
            z-index: 3000;
            text-align: center;
            border: 4px solid rgba(17, 153, 142, 0.8);
            min-width: 500px;
            max-width: 600px;
            transition: transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        `;

        dialog.innerHTML = `
            <div style="font-size: 6em; margin-bottom: 20px; animation: bounce 0.8s ease infinite; filter: drop-shadow(0 0 20px rgba(255,215,0,0.8));">🏁</div>
            <h2 style="
                background: linear-gradient(135deg, #11998e 0%, #38ef7d 50%, #ffbe0b 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                margin-bottom: 25px;
                font-size: 3em;
                text-shadow: 0 0 30px rgba(17, 153, 142, 0.5);
                font-weight: 900;
                letter-spacing: 3px;
            ">JACKPOT!</h2>
            <div style="
                background: linear-gradient(135deg, #11998e 0%, #38ef7d 50%, #ffbe0b 100%);
                color: white;
                padding: 50px;
                border-radius: 25px;
                margin-bottom: 30px;
                font-size: 1.8em;
                font-weight: 800;
                line-height: 2;
                box-shadow: 0 15px 40px rgba(0, 0, 0, 0.5), inset 0 0 30px rgba(255,255,255,0.2);
                border: 3px solid rgba(255, 255, 255, 0.5);
                position: relative;
                overflow: hidden;
            ">
                <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.2) 50%, transparent 70%); animation: shine 2s infinite;"></div>
                <div style="position: relative; z-index: 1;">
                    ✨ FÉLICITATIONS ! ✨<br>
                    <span style="font-size: 2.5em; margin: 20px 0; display: block; text-shadow: 0 0 30px rgba(255,255,255,0.8); animation: pulse 1s ease-in-out infinite;">+250€</span>
                    🎯 CASE DÉPART PARFAITE ! 🎯
                </div>
            </div>
            <button id="btn-start-ok" style="
                padding: 20px 60px;
                background: linear-gradient(135deg, #ffbe0b 0%, #fb5607 50%, #ff006e 100%);
                color: white;
                border: none;
                border-radius: 20px;
                font-size: 1.6em;
                font-weight: 900;
                cursor: pointer;
                box-shadow: 0 10px 30px rgba(255, 190, 11, 0.6), 0 0 40px rgba(255, 0, 110, 0.4);
                transition: all 0.3s ease;
                border: 3px solid rgba(255, 255, 255, 0.5);
                text-transform: uppercase;
                letter-spacing: 2px;
            ">🎉 RÉCUPÉRER 🎉</button>
        `;

        // Ajouter animations supplémentaires
        const shineStyle = document.createElement('style');
        shineStyle.textContent = `
            @keyframes shine {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(200%); }
            }
            @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.1); }
            }
        `;
        document.head.appendChild(shineStyle);

        document.body.appendChild(dialog);

        // Animation d'apparition du dialogue
        setTimeout(() => {
            dialog.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 50);

        // Effet hover sur le bouton
        const btnOk = dialog.querySelector('#btn-start-ok');
        btnOk.addEventListener('mouseenter', () => {
            btnOk.style.transform = 'scale(1.1)';
            btnOk.style.boxShadow = '0 10px 30px rgba(17, 153, 142, 0.6)';
        });
        btnOk.addEventListener('mouseleave', () => {
            btnOk.style.transform = 'scale(1)';
            btnOk.style.boxShadow = '0 8px 20px rgba(17, 153, 142, 0.4)';
        });

        // Appliquer le bonus
        btnOk.addEventListener('click', () => {
            dialog.style.transform = 'translate(-50%, -50%) scale(0)';
            overlay.style.background = 'rgba(0, 0, 0, 0)';
            setTimeout(() => {
                dialog.remove();
                overlay.remove();
            }, 300);

            player.money += 250;
            showFloatingMessage('+250€ CASE DÉPART!', 'success');
            displayPlayers();

            // Passer au joueur suivant
            setTimeout(() => {
                checkNextPlayer();
            }, 1500);
        });

        // Si c'est un bot, cliquer automatiquement après 2 secondes
        if (player.isBot) {
            setTimeout(() => {
                btnOk.click();
            }, 2000);
        }
    }, 1200);
}

// Afficher le bonus pour passage par la case DÉPART (+200€) avec animation
function showPassStartDialog(playerIndex, onClose) {
    const player = players[playerIndex];

    // Créer un fond sombre avec effet
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0);
        z-index: 2998;
        transition: background 0.5s ease;
    `;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.style.background = 'rgba(0, 0, 0, 0.75)', 50);

    // Créer des particules d'étoiles (moins que pour le jackpot)
    for (let i = 0; i < 20; i++) {
        const star = document.createElement('div');
        star.textContent = '⭐';
        star.style.cssText = `
            position: fixed;
            left: ${Math.random() * window.innerWidth}px;
            top: ${Math.random() * window.innerHeight}px;
            font-size: ${Math.random() * 1.5 + 0.5}em;
            z-index: 2999;
            animation: starTwinkle ${Math.random() * 2 + 1}s ease-in-out ${Math.random()}s infinite;
            pointer-events: none;
        `;
        document.body.appendChild(star);
        setTimeout(() => star.remove(), 4000);
    }

    // Animation de la carte
    const animatedCard = document.createElement('div');
    animatedCard.style.cssText = `
        position: fixed;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%) scale(0);
        width: 160px;
        height: 220px;
        background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
        border-radius: 20px;
        box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8);
        z-index: 2999;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 5em;
        transition: all 1s cubic-bezier(0.34, 1.56, 0.64, 1);
        border: 5px solid rgba(255, 255, 255, 0.6);
    `;
    animatedCard.innerHTML = `<span style="filter: drop-shadow(0 0 20px rgba(255,255,255,0.8));">🏁</span>`;
    document.body.appendChild(animatedCard);

    // Animation d'apparition
    setTimeout(() => {
        animatedCard.style.transform = 'translate(-50%, -50%) scale(2.5) rotate(360deg)';
    }, 100);

    // Afficher le contenu
    setTimeout(() => {
        animatedCard.remove();

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.5);
            background: linear-gradient(135deg, rgba(22, 33, 62, 0.98) 0%, rgba(26, 26, 46, 0.98) 100%);
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 25px 60px rgba(0, 0, 0, 0.7), 0 0 40px rgba(17, 153, 142, 0.4);
            z-index: 3000;
            text-align: center;
            border: 3px solid rgba(17, 153, 142, 0.6);
            min-width: 450px;
            max-width: 550px;
            transition: transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        `;

        dialog.innerHTML = `
            <div style="font-size: 5em; margin-bottom: 20px; animation: bounce 0.8s ease infinite; filter: drop-shadow(0 0 15px rgba(17,153,142,0.8));">🏁</div>
            <h2 style="
                color: #00d9ff;
                margin-bottom: 20px;
                font-size: 2.5em;
                text-shadow: 0 0 20px rgba(0, 217, 255, 0.8);
                font-weight: 800;
                letter-spacing: 2px;
            ">PASSAGE RÉUSSI!</h2>
            <div style="
                background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
                color: white;
                padding: 35px;
                border-radius: 20px;
                margin-bottom: 25px;
                font-size: 1.5em;
                font-weight: 700;
                line-height: 1.8;
                box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4), inset 0 0 20px rgba(255,255,255,0.15);
                border: 2px solid rgba(255, 255, 255, 0.4);
                position: relative;
                overflow: hidden;
            ">
                <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.15) 50%, transparent 70%); animation: shine 2s infinite;"></div>
                <div style="position: relative; z-index: 1;">
                    ✨ BRAVO ! ✨<br>
                    <span style="font-size: 2em; margin: 15px 0; display: block; text-shadow: 0 0 20px rgba(255,255,255,0.7); animation: pulse 1s ease-in-out infinite;">+200€</span>
                    🎯 Passage par la case DÉPART ! 🎯
                </div>
            </div>
            <button id="btn-pass-ok" style="
                padding: 18px 50px;
                background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
                color: white;
                border: none;
                border-radius: 18px;
                font-size: 1.4em;
                font-weight: 800;
                cursor: pointer;
                box-shadow: 0 8px 25px rgba(17, 153, 142, 0.5), 0 0 30px rgba(56, 239, 125, 0.3);
                transition: all 0.3s ease;
                border: 2px solid rgba(255, 255, 255, 0.4);
                text-transform: uppercase;
                letter-spacing: 1.5px;
            ">💰 RÉCUPÉRER 💰</button>
        `;

        document.body.appendChild(dialog);

        // Animation d'apparition du dialogue
        setTimeout(() => {
            dialog.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 50);

        // Effet hover sur le bouton
        const btnOk = dialog.querySelector('#btn-pass-ok');
        btnOk.addEventListener('mouseenter', () => {
            btnOk.style.transform = 'scale(1.1)';
            btnOk.style.boxShadow = '0 10px 30px rgba(17, 153, 142, 0.7)';
        });
        btnOk.addEventListener('mouseleave', () => {
            btnOk.style.transform = 'scale(1)';
            btnOk.style.boxShadow = '0 8px 25px rgba(17, 153, 142, 0.5)';
        });

        // Action du bouton
        btnOk.addEventListener('click', () => {
            dialog.style.transform = 'translate(-50%, -50%) scale(0)';
            overlay.style.background = 'rgba(0, 0, 0, 0)';
            setTimeout(() => {
                dialog.remove();
                overlay.remove();

                // Appeler le callback pour continuer le flux du jeu
                if (onClose) {
                    onClose();
                }
            }, 300);

            player.money += 200;
            showFloatingMessage('+200€ PASSAGE!', 'success');
            displayPlayers();
        });

        // Si c'est un bot, cliquer automatiquement après 1.5 secondes
        if (player.isBot) {
            setTimeout(() => {
                btnOk.click();
            }, 1500);
        }
    }, 1000);
}

// Tirer une carte Caisse de Communauté
function drawCommunityCard(playerIndex) {
    const player = players[playerIndex];
    const card = communityCards[Math.floor(Math.random() * communityCards.length)];

    // Messages des bots quand quelqu'un tire une carte
    setTimeout(() => {
        const otherBots = players.filter(p => p.isBot && p.prenom !== player.prenom);
        if (otherBots.length > 0) {
            const randomBot = otherBots[Math.floor(Math.random() * otherBots.length)];
            let message = '';

            if (player.isBot) {
                const messages = [
                    `🎲 La chance va tourner pour ${player.prenom} !`,
                    `📦 Voyons ce que ça donne...`,
                    `🤞 Espérons que c'est bon !`
                ];
                message = messages[Math.floor(Math.random() * messages.length)];
            } else {
                const messages = [
                    `🙏 On espère que t'as pas de chance ${player.prenom} !`,
                    `😏 Attention, qu'est-ce qui va arriver ?`,
                    `🎲 Voyons voir ta chance ${player.prenom}...`,
                    `👀 J'espère que c'est pas bon pour toi !`
                ];
                message = messages[Math.floor(Math.random() * messages.length)];
            }

            addChatMessage(message, randomBot.prenom, false, true);
        }
    }, 300);

    if (player.isBot) {
        // Pour les bots, juste afficher un message et appliquer l'effet
        showNotification(`${player.emoji} ${player.prenom} tire une carte Caisse: ${card.text}`, 'success');
        setTimeout(() => {
            applyCardEffect(playerIndex, card);
        }, 1500);
    } else {
        showCardDialog(playerIndex, card, '📦 Caisse de Communauté');
    }
}

// Tirer une carte Chance
function drawChanceCard(playerIndex) {
    const player = players[playerIndex];
    const card = chanceCards[Math.floor(Math.random() * chanceCards.length)];

    // Messages des bots quand quelqu'un tire une carte Chance
    setTimeout(() => {
        const otherBots = players.filter(p => p.isBot && p.prenom !== player.prenom);
        if (otherBots.length > 0) {
            const randomBot = otherBots[Math.floor(Math.random() * otherBots.length)];
            let message = '';

            if (player.isBot) {
                const messages = [
                    `✨ La chance va sourire à ${player.prenom} !`,
                    `🎲 Voyons ce que le destin réserve...`,
                    `🍀 J'espère que c'est une bonne carte !`
                ];
                message = messages[Math.floor(Math.random() * messages.length)];
            } else {
                const messages = [
                    `😈 On espère que t'as pas de chance ${player.prenom} !`,
                    `⚠️ Attention, qu'est-ce qui va avoir ?`,
                    `🎲 La chance d'avoir une carte Chance ${player.prenom}...`,
                    `👀 Ça va être intéressant !`,
                    `🙏 Pourvu que ce soit mauvais pour toi !`
                ];
                message = messages[Math.floor(Math.random() * messages.length)];
            }

            addChatMessage(message, randomBot.prenom, false, true);
        }
    }, 300);

    if (player.isBot) {
        // Pour les bots, juste afficher un message et appliquer l'effet
        showNotification(`${player.emoji} ${player.prenom} tire une carte Chance: ${card.text}`, 'success');
        setTimeout(() => {
            applyCardEffect(playerIndex, card);
        }, 1500);
    } else {
        showCardDialog(playerIndex, card, '🎲 Chance');
    }
}

// Afficher la carte tirée avec animation améliorée
function showCardDialog(playerIndex, card, title) {
    const player = players[playerIndex];
    const isChance = title.includes('Chance');

    // Créer un fond sombre
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0);
        z-index: 2998;
        transition: background 0.5s ease;
    `;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.style.background = 'rgba(0, 0, 0, 0.7)', 50);

    // Créer la carte animée qui part du paquet
    const animatedCard = document.createElement('div');
    const deckElement = document.querySelector(isChance ? '.card-deck.chance' : '.card-deck.community');
    const deckRect = deckElement.getBoundingClientRect();

    // Ajouter des styles pour les animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes cardPulse {
            0%, 100% { filter: brightness(1) drop-shadow(0 0 20px rgba(255,255,255,0.6)); }
            50% { filter: brightness(1.3) drop-shadow(0 0 40px rgba(255,255,255,1)); }
        }
        @keyframes iconBounce {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.2); }
        }
    `;
    document.head.appendChild(style);

    animatedCard.style.cssText = `
        position: fixed;
        left: ${deckRect.left}px;
        top: ${deckRect.top}px;
        width: 140px;
        height: 200px;
        background: ${isChance ? 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};
        border-radius: 20px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8), 0 0 60px ${isChance ? 'rgba(17, 153, 142, 0.6)' : 'rgba(102, 126, 234, 0.6)'};
        z-index: 2999;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 4em;
        transition: all 1.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        transform-style: preserve-3d;
        border: 5px solid rgba(255, 255, 255, 0.5);
        animation: cardPulse 0.6s ease-in-out infinite;
    `;
    animatedCard.innerHTML = `<span style="display: inline-block; animation: iconBounce 0.6s ease-in-out infinite;">${isChance ? '🎲' : '📦'}</span>`;
    document.body.appendChild(animatedCard);

    // Créer des particules autour du paquet
    for (let i = 0; i < 12; i++) {
        const particle = document.createElement('div');
        const angle = (i / 12) * Math.PI * 2;
        const distance = 60;
        particle.style.cssText = `
            position: fixed;
            left: ${deckRect.left + deckRect.width/2}px;
            top: ${deckRect.top + deckRect.height/2}px;
            width: 8px;
            height: 8px;
            background: ${isChance ? '#38ef7d' : '#764ba2'};
            border-radius: 50%;
            box-shadow: 0 0 10px ${isChance ? '#38ef7d' : '#764ba2'};
            z-index: 2998;
            pointer-events: none;
            transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        `;
        document.body.appendChild(particle);
        setTimeout(() => {
            particle.style.left = (deckRect.left + deckRect.width/2 + Math.cos(angle) * distance) + 'px';
            particle.style.top = (deckRect.top + deckRect.height/2 + Math.sin(angle) * distance) + 'px';
            particle.style.opacity = '0';
        }, 50);
        setTimeout(() => particle.remove(), 500);
    }

    // Effet de lueur intense sur le paquet
    deckElement.style.transform = 'scale(1.2) rotate(10deg)';
    deckElement.style.boxShadow = `0 0 60px ${isChance ? 'rgba(17, 153, 142, 1)' : 'rgba(102, 126, 234, 1)'}, 0 0 120px ${isChance ? 'rgba(17, 153, 142, 0.6)' : 'rgba(102, 126, 234, 0.6)'}`;
    deckElement.style.filter = 'brightness(1.5)';
    setTimeout(() => {
        deckElement.style.transform = '';
        deckElement.style.boxShadow = '';
        deckElement.style.filter = '';
    }, 400);

    // Animation: déplacer vers le centre avec rotation 3D spectaculaire
    setTimeout(() => {
        animatedCard.style.left = '50%';
        animatedCard.style.top = '50%';
        animatedCard.style.transform = 'translate(-50%, -50%) scale(2.8) rotate(720deg) rotateX(15deg)';
        animatedCard.style.boxShadow = `0 40px 120px rgba(0, 0, 0, 1), 0 0 100px ${isChance ? 'rgba(17, 153, 142, 1)' : 'rgba(102, 126, 234, 1)'}`;
    }, 100);

    // Retourner la carte après 1.2s avec flip 3D
    setTimeout(() => {
        animatedCard.style.transition = 'all 0.7s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
        animatedCard.style.transform = 'translate(-50%, -50%) scale(2.8) rotateY(90deg)';
        animatedCard.style.animation = 'none';
    }, 1200);

    // Afficher le contenu de la carte
    setTimeout(() => {
        animatedCard.remove();

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotateY(90deg) scale(0.5);
            background: linear-gradient(135deg, rgba(22, 33, 62, 0.98) 0%, rgba(26, 26, 46, 0.98) 100%);
            padding: 50px;
            border-radius: 25px;
            box-shadow: 0 30px 80px rgba(0, 0, 0, 0.8), 0 0 50px ${card.type === 'success' ? 'rgba(17, 153, 142, 0.5)' : card.type === 'error' ? 'rgba(238, 9, 121, 0.5)' : 'rgba(102, 126, 234, 0.5)'};
            z-index: 3000;
            text-align: center;
            border: 4px solid ${card.type === 'success' ? 'rgba(17, 153, 142, 0.8)' : card.type === 'error' ? 'rgba(238, 9, 121, 0.8)' : 'rgba(102, 126, 234, 0.8)'};
            min-width: 500px;
            max-width: 600px;
            transition: transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        `;

        const cardIcon = isChance ? '🎲' : '📦';
        dialog.innerHTML = `
            <div style="font-size: 4em; margin-bottom: 20px; animation: bounce 1s ease infinite;">${cardIcon}</div>
            <h2 style="color: ${card.type === 'success' ? '#00d9ff' : card.type === 'error' ? '#ff006e' : '#00d9ff'}; margin-bottom: 25px; font-size: 2.5em; text-shadow: 0 0 20px ${card.type === 'success' ? 'rgba(0, 217, 255, 0.8)' : card.type === 'error' ? 'rgba(255, 0, 110, 0.8)' : 'rgba(0, 217, 255, 0.8)'};">${title}</h2>
            <div style="
                background: ${card.type === 'success' ? 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' : card.type === 'error' ? 'linear-gradient(135deg, #ee0979 0%, #ff6a00 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};
                color: white;
                padding: 35px;
                border-radius: 20px;
                margin-bottom: 30px;
                font-size: 1.4em;
                font-weight: 600;
                line-height: 1.6;
                box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
                border: 2px solid rgba(255, 255, 255, 0.3);
            ">${card.text}</div>
            <button id="btn-card-ok" style="
                padding: 18px 50px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 15px;
                font-size: 1.4em;
                font-weight: 700;
                cursor: pointer;
                box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
                transition: all 0.3s ease;
                border: 2px solid rgba(255, 255, 255, 0.3);
            ">✓ OK</button>
        `;

        document.body.appendChild(dialog);

        // Animation de retournement de la carte
        setTimeout(() => {
            dialog.style.transform = 'translate(-50%, -50%) rotateY(0deg) scale(1)';
        }, 50);

        // Effet hover sur le bouton
        const btnOk = dialog.querySelector('#btn-card-ok');
        btnOk.addEventListener('mouseenter', () => {
            btnOk.style.transform = 'scale(1.1)';
            btnOk.style.boxShadow = '0 10px 30px rgba(102, 126, 234, 0.6)';
        });
        btnOk.addEventListener('mouseleave', () => {
            btnOk.style.transform = 'scale(1)';
            btnOk.style.boxShadow = '0 8px 20px rgba(102, 126, 234, 0.4)';
        });

        // Appliquer l'effet de la carte
        btnOk.addEventListener('click', () => {
            dialog.style.transform = 'translate(-50%, -50%) scale(0)';
            overlay.style.background = 'rgba(0, 0, 0, 0)';
            setTimeout(() => {
                dialog.remove();
                overlay.remove();
            }, 300);
            applyCardEffect(playerIndex, card);

            // Passer automatiquement au joueur suivant après la carte
            setTimeout(() => {
                checkNextPlayer();
            }, 1500);
        });

        // Si c'est un bot, cliquer automatiquement sur OK après 2 secondes
        const player = players[playerIndex];
        if (player.isBot) {
            setTimeout(() => {
                btnOk.click();
            }, 2000);
        }
    }, 1700);
}

// Appliquer l'effet de la carte
function applyCardEffect(playerIndex, card) {
    const player = players[playerIndex];

    // Réactions des bots selon le type de carte
    setTimeout(() => {
        const otherBots = players.filter(p => p.isBot && p.prenom !== player.prenom);
        if (otherBots.length > 0) {
            const randomBot = otherBots[Math.floor(Math.random() * otherBots.length)];
            let message = '';

            // Cartes avec gains d'argent importants (150€+)
            if (card.amount >= 150) {
                const messages = [
                    `😱 Ouah la chance ${player.prenom} !`,
                    `💰 Trop chanceux ${player.prenom} !`,
                    `🤑 C'est injuste cette chance !`
                ];
                message = messages[Math.floor(Math.random() * messages.length)];
            }
            // Cartes avec pertes d'argent
            else if (card.amount < 0) {
                const messages = [
                    `😂 Pas de chance ${player.prenom} !`,
                    `🤣 Dommage pour toi !`,
                    `😏 Bien fait !`
                ];
                message = messages[Math.floor(Math.random() * messages.length)];
            }
            // Carte sortie de prison
            else if (card.special === 'get-jail-card') {
                const messages = [
                    `🎫 On verra si ${player.prenom} sera un jour en prison !`,
                    `👀 Cette carte va lui servir...`,
                    `😏 Garde-la bien ${player.prenom} !`
                ];
                message = messages[Math.floor(Math.random() * messages.length)];
            }
            // Cartes de déplacement nul (back-3, go-39, next-station)
            else if (card.special === 'back-3' || card.special === 'go-39' || card.special === 'next-station') {
                const messages = [
                    `😑 Nul cette carte !`,
                    `🤷 Ça sert à rien...`,
                    `😒 Carte inutile !`
                ];
                message = messages[Math.floor(Math.random() * messages.length)];
            }

            if (message) {
                addChatMessage(message, randomBot.prenom, false, true);
            }
        }
    }, 800);

    if (card.amount !== 0) {
        player.money += card.amount;
        if (card.amount > 0) {
            showFloatingMessage(`+${card.amount}€`, 'success');
        } else {
            showFloatingMessage(`${card.amount}€`, 'error');
        }
    }

    // Variable pour savoir s'il faut appeler checkNextPlayer à la fin
    let needsNextPlayer = true;

    if (card.special) {
        switch (card.special) {
            case 'get-jail-card':
                player.jailFreeCards++;
                showNotification(`${player.emoji} ${player.prenom} a reçu une carte Sortie de Prison! (${player.jailFreeCards})`, 'success');
                showFloatingMessage(`🎫 CARTE PRISON`, 'success');
                break;
            case 'go-jail':
                setTimeout(() => {
                    player.position = 10;
                    player.inJail = true;
                    player.jailTurns = players.length <= 3 ? 2 : 3;
                    displayTokens();
                    showNotification(`${player.emoji} ${player.prenom} va en prison pour ${player.jailTurns} tour(s)!`, 'error');

                    // Message du bot s'il va en prison
                    if (player.isBot) {
                        setTimeout(() => {
                            const jailMessages = [
                                `😱 Non je suis en prison !`,
                                `😭 Noooon pas la prison !`,
                                `🚔 C'est pas juste !`,
                                `😡 Je vais sortir et me venger !`
                            ];
                            const randomMessage = jailMessages[Math.floor(Math.random() * jailMessages.length)];
                            addChatMessage(randomMessage, player.prenom, false, true);
                        }, 300);
                    }

                    // Passer au joueur suivant après être allé en prison
                    if (player.isBot) {
                        setTimeout(() => checkNextPlayer(), 1000);
                    }
                }, 500);
                needsNextPlayer = false; // Déjà géré dans le setTimeout
                break;
            case 'go-start':
                setTimeout(() => {
                    player.position = 0;
                    player.money += 200;
                    displayTokens();
                    showFloatingMessage('+200€ DÉPART', 'success');

                    // Passer au joueur suivant
                    if (player.isBot) {
                        setTimeout(() => checkNextPlayer(), 1000);
                    }
                }, 500);
                needsNextPlayer = false; // Déjà géré dans le setTimeout
                break;
            case 'back-3':
                setTimeout(() => {
                    player.position = Math.max(0, player.position - 3);
                    displayTokens();
                    checkLanding(playerIndex);
                }, 500);
                needsNextPlayer = false; // checkLanding gérera le passage
                break;
            case 'go-39':
                setTimeout(() => {
                    player.position = 39;
                    displayTokens();
                    checkLanding(playerIndex);
                }, 500);
                needsNextPlayer = false; // checkLanding gérera le passage
                break;
            case 'next-station':
                const stations = [5, 15, 25, 35];
                const nextStation = stations.find(s => s > player.position) || stations[0];
                setTimeout(() => {
                    if (nextStation < player.position) {
                        player.money += 200; // Passe par la case départ
                        showFloatingMessage('+200€ DÉPART', 'success');
                    }
                    player.position = nextStation;
                    displayTokens();
                    checkLanding(playerIndex);
                }, 500);
                needsNextPlayer = false; // checkLanding gérera le passage
                break;
        }
    }

    displayPlayers();

    // Si c'est un bot et qu'on doit passer au joueur suivant
    if (player.isBot && needsNextPlayer) {
        setTimeout(() => {
            checkNextPlayer();
        }, 1500);
    }
}

// Afficher une notification
function showNotification(text, type) {
    const notification = document.createElement('div');
    notification.textContent = text;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' : type === 'error' ? 'linear-gradient(135deg, #ee0979 0%, #ff6a00 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};
        color: white;
        padding: 15px 25px;
        border-radius: 12px;
        font-size: 1.1em;
        font-weight: 600;
        z-index: 2000;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        animation: slideInRight 0.5s ease-out;
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.5s ease-out';
        setTimeout(() => notification.remove(), 500);
    }, 3000);
}

// Afficher le dialogue de prison avec les options
function showJailDialog(playerIndex) {
    const player = players[playerIndex];

    // Si c'est un bot, décider automatiquement
    if (player.isBot) {
        // Priorité: utiliser carte gratuite > payer si assez d'argent > attendre
        if (player.jailFreeCards > 0) {
            useJailCard(playerIndex);
        } else if (player.money >= 50 && Math.random() < 0.7) {
            payJailFee(playerIndex);
        } else {
            waitInJail(playerIndex);
        }
        return;
    }

    // Pour les joueurs humains, afficher le dialogue
    const dialog = document.createElement('div');
    dialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        padding: 40px;
        border-radius: 25px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(230, 57, 70, 0.5);
        z-index: 3000;
        text-align: center;
        border: 3px solid #e63946;
        min-width: 500px;
    `;

    dialog.innerHTML = `
        <h2 style="color: #e63946; margin-bottom: 20px; font-size: 2.5em; text-shadow: 0 0 20px rgba(230, 57, 70, 0.8);">🔒 PRISON</h2>
        <p style="color: #fff; font-size: 1.3em; margin-bottom: 10px;">Vous êtes en prison!</p>
        <p style="color: #ff6b6b; margin-bottom: 30px; font-size: 1.1em;">Tours restants: ${player.jailTurns}</p>
        <div style="background: rgba(230, 57, 70, 0.1); padding: 20px; border-radius: 15px; margin-bottom: 30px; border: 2px solid rgba(230, 57, 70, 0.3);">
            <p style="color: #00d9ff; font-size: 1.1em; line-height: 1.6;">
                💰 Votre argent: ${player.money}€<br>
                🎫 Cartes Sortie de Prison: ${player.jailFreeCards}
            </p>
        </div>
        <div style="display: flex; flex-direction: column; gap: 15px;">
            <button id="btn-use-card" style="
                padding: 15px 30px;
                background: linear-gradient(135deg, #06ffa5 0%, #00d9ff 100%);
                color: white;
                border: none;
                border-radius: 12px;
                font-size: 1.2em;
                font-weight: 700;
                cursor: pointer;
                box-shadow: 0 5px 15px rgba(6, 255, 165, 0.3);
                ${player.jailFreeCards === 0 ? 'opacity: 0.5; cursor: not-allowed;' : ''}
            " ${player.jailFreeCards === 0 ? 'disabled' : ''}>🎫 Utiliser une carte (Gratuit)</button>

            <button id="btn-pay-jail" style="
                padding: 15px 30px;
                background: linear-gradient(135deg, #ffbe0b 0%, #fb5607 100%);
                color: white;
                border: none;
                border-radius: 12px;
                font-size: 1.2em;
                font-weight: 700;
                cursor: pointer;
                box-shadow: 0 5px 15px rgba(255, 190, 11, 0.3);
                ${player.money < 50 ? 'opacity: 0.5; cursor: not-allowed;' : ''}
            " ${player.money < 50 ? 'disabled' : ''}>💰 Payer 50€ pour sortir</button>

            <button id="btn-wait-jail" style="
                padding: 15px 30px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 12px;
                font-size: 1.2em;
                font-weight: 700;
                cursor: pointer;
                box-shadow: 0 5px 15px rgba(102, 126, 234, 0.3);
            ">⏳ Attendre (Passer le tour)</button>
        </div>
    `;

    document.body.appendChild(dialog);

    // Bouton utiliser carte
    if (player.jailFreeCards > 0) {
        dialog.querySelector('#btn-use-card').addEventListener('click', () => {
            dialog.remove();
            useJailCard(playerIndex);
        });
    }

    // Bouton payer
    if (player.money >= 50) {
        dialog.querySelector('#btn-pay-jail').addEventListener('click', () => {
            dialog.remove();
            payJailFee(playerIndex);
        });
    }

    // Bouton attendre
    dialog.querySelector('#btn-wait-jail').addEventListener('click', () => {
        dialog.remove();
        waitInJail(playerIndex);
    });
}

// Utiliser une carte sortie de prison
function useJailCard(playerIndex) {
    const player = players[playerIndex];
    player.jailFreeCards--;
    player.inJail = false;
    player.jailTurns = 0;

    showNotification(`${player.emoji} ${player.prenom} utilise une carte et sort de prison!`, 'success');
    showFloatingMessage(`🎫 CARTE UTILISÉE`, 'success');
    displayPlayers();

    // Lancer les dés automatiquement
    setTimeout(() => {
        rollDice();
    }, 1500);
}

// Payer pour sortir de prison
function payJailFee(playerIndex) {
    const player = players[playerIndex];
    player.money -= 50;
    player.inJail = false;
    player.jailTurns = 0;

    showNotification(`${player.emoji} ${player.prenom} paie 50€ et sort de prison!`, 'success');
    showFloatingMessage(`-50€ CAUTION`, 'error');
    displayPlayers();

    // Lancer les dés automatiquement
    setTimeout(() => {
        rollDice();
    }, 1500);
}

// Attendre en prison (passer le tour)
function waitInJail(playerIndex) {
    const player = players[playerIndex];

    player.jailTurns--;
    if (player.jailTurns === 0) {
        player.inJail = false;
        showNotification(`${player.emoji} ${player.prenom} a purgé sa peine et sort de prison!`, 'success');
        showFloatingMessage(`✅ LIBÉRÉ`, 'success');
    } else {
        showNotification(`${player.emoji} ${player.prenom} attend en prison... Encore ${player.jailTurns} tour(s)`, 'info');
        showFloatingMessage(`⏳ EN ATTENTE`, 'info');
    }

    displayPlayers();

    setTimeout(() => {
        nextPlayer();
    }, 2000);
}

// Décision d'achat pour les bots
function botDecideToBuy(player, price) {
    // Si le bot a moins de 800€, il a 30% de chances d'acheter
    if (player.money < 800) {
        return Math.random() < 0.30;
    }

    // Si le bot a entre 800€ et 1200€, il a 60% de chances d'acheter
    if (player.money < 1200) {
        return Math.random() < 0.60;
    }

    // Si le bot a plus de 1200€, il a 85% de chances d'acheter
    return Math.random() < 0.85;
}

// Vérifier et passer au joueur suivant automatiquement
function checkNextPlayer() {
    nextPlayer();
}

// Passer au joueur suivant
function nextPlayer() {
    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    displayPlayers();
    updateCurrentTurn();

    // 🆕 Mettre à jour l'interface selon le tour
    updateTurnUI();

    // Synchroniser avec Firebase si on est l'hôte
    if (window.gameSyncHelper && window.gameSyncHelper.isHost) {
        window.gameSyncHelper.syncCurrentPlayer(currentPlayerIndex);
        window.gameSyncHelper.syncPlayers(players);
    }

    const currentPlayer = players[currentPlayerIndex];
    const diceButton = document.getElementById('btn-roll-dice');

    // Si c'est le tour d'un bot, désactiver le bouton et jouer automatiquement
    if (currentPlayer.isBot) {
        diceButton.disabled = true;
        diceButton.style.opacity = '0.5';
        diceButton.style.cursor = 'not-allowed';
        setTimeout(() => {
            rollDice();
        }, 1500);
    } else {
        // Pour les joueurs humains, l'interface est gérée par updateTurnUI()
        // Ne rien faire ici
    }
}

// Événement: Lancer les dés
document.getElementById('btn-roll-dice').addEventListener('click', rollDice);

// Événement: Quitter
document.getElementById('btn-quit').addEventListener('click', function() {
    if (confirm('Êtes-vous sûr de vouloir quitter la partie ?')) {
        localStorage.removeItem('currentPlayer');
        window.location.href = 'index.html';
    }
});

// Ajouter événement de clic sur les cellules
document.querySelectorAll('.cell').forEach(cell => {
    cell.addEventListener('click', function() {
        const position = parseInt(this.getAttribute('data-position'));
        const owner = this.getAttribute('data-owner');

        // Si la propriété appartient au joueur actuel
        if (owner && owner === players[currentPlayerIndex].prenom) {
            showPropertyManagementDialog(position, this);
        }
    });
});

// Afficher la boîte de dialogue de gestion de propriété
function showPropertyManagementDialog(position, cell) {
    const player = players[currentPlayerIndex];
    const propertyName = cell.querySelector('.cell-name')?.textContent || 'Propriété';
    const propertyPrice = cell.querySelector('.cell-price')?.textContent || '0€';
    const price = parseInt(propertyPrice.replace('€', ''));
    const sellPrice = Math.floor(price * 0.75);

    const dialog = document.createElement('div');
    dialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
        padding: 40px;
        border-radius: 25px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        z-index: 3000;
        text-align: center;
        border: 3px solid rgba(17, 153, 142, 0.5);
        min-width: 400px;
    `;

    const hasHouse = cell.hasAttribute('data-has-house');
    const houseStatus = hasHouse ? '✅ Maison construite' : '❌ Pas de maison';

    dialog.innerHTML = `
        <h2 style="color: #11998e; margin-bottom: 20px; font-size: 2em;">🏠 ${propertyName}</h2>
        <p style="color: #555; font-size: 1.3em; margin-bottom: 15px; font-weight: 600;">Cette propriété est à vous!</p>
        <p style="color: #666; margin-bottom: 10px; font-size: 1.1em;">Prix d'achat: ${price}€</p>
        <p style="color: #11998e; margin-bottom: 10px; font-size: 1.2em; font-weight: 600;">Prix de vente: ${sellPrice}€</p>
        <p style="color: ${hasHouse ? '#06ffa5' : '#ff6b6b'}; margin-bottom: 20px; font-size: 1.1em; font-weight: 600;">${houseStatus}</p>
        <div style="background: rgba(6, 255, 165, 0.1); padding: 15px; border-radius: 12px; margin-bottom: 20px; border: 2px solid rgba(6, 255, 165, 0.3);">
            <p style="color: #555; font-size: 0.95em; line-height: 1.5;">
                🏠 <strong>Maison:</strong> Coûte 50€<br>
                💰 <strong>Loyer:</strong> 70% → 100% du prix avec maison
            </p>
        </div>
        <div style="display: flex; flex-direction: column; gap: 12px;">
            <button id="btn-build-house" style="
                padding: 15px 30px;
                background: linear-gradient(135deg, #06ffa5 0%, #00d9ff 100%);
                color: white;
                border: none;
                border-radius: 12px;
                font-size: 1.2em;
                font-weight: 700;
                cursor: pointer;
                box-shadow: 0 5px 15px rgba(6, 255, 165, 0.3);
                ${hasHouse ? 'opacity: 0.5; cursor: not-allowed;' : ''}
                ${player.money < 50 ? 'opacity: 0.5; cursor: not-allowed;' : ''}
            " ${hasHouse || player.money < 50 ? 'disabled' : ''}>🏠 Construire une maison (50€)</button>
            <div style="display: flex; gap: 12px;">
                <button id="btn-sell-property" style="
                    flex: 1;
                    padding: 15px 30px;
                    background: linear-gradient(135deg, #ee0979 0%, #ff6a00 100%);
                    color: white;
                    border: none;
                    border-radius: 12px;
                    font-size: 1.2em;
                    font-weight: 700;
                    cursor: pointer;
                    box-shadow: 0 5px 15px rgba(238, 9, 121, 0.3);
                ">💰 Vendre</button>
                <button id="btn-close-dialog" style="
                    flex: 1;
                    padding: 15px 30px;
                    background: linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%);
                    color: white;
                    border: none;
                    border-radius: 12px;
                    font-size: 1.2em;
                    font-weight: 700;
                    cursor: pointer;
                    box-shadow: 0 5px 15px rgba(127, 140, 141, 0.3);
                ">❌ Fermer</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    // Bouton Construire une maison
    if (!hasHouse && player.money >= 50) {
        dialog.querySelector('#btn-build-house').addEventListener('click', () => {
            player.money -= 50;
            cell.setAttribute('data-has-house', 'true');

            // Ajouter un badge maison
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

            showNotification(`${player.emoji} ${player.prenom} a construit une maison sur ${propertyName}!`, 'success');
            showFloatingMessage(`🏠 MAISON CONSTRUITE`, 'success');
            displayPlayers();
            dialog.remove();
        });
    }

    // Bouton Vendre
    dialog.querySelector('#btn-sell-property').addEventListener('click', () => {
        player.money += sellPrice;
        cell.removeAttribute('data-owner');
        cell.removeAttribute('data-has-house');
        cell.style.borderColor = '';
        cell.style.borderWidth = '';

        // Retirer l'emoji du propriétaire et la maison
        const ownerBadge = cell.querySelector('.owner-badge');
        const houseBadge = cell.querySelector('.house-badge');
        if (ownerBadge) ownerBadge.remove();
        if (houseBadge) houseBadge.remove();

        showNotification(`${player.emoji} ${player.prenom} a vendu ${propertyName} pour ${sellPrice}€!`, 'success');
        showFloatingMessage(`+${sellPrice}€ VENTE`, 'success');
        displayPlayers();
        dialog.remove();
    });

    // Bouton Fermer
    dialog.querySelector('#btn-close-dialog').addEventListener('click', () => {
        dialog.remove();
    });
}

// Evenement "Casino Royal" - Se declenche au bout de 5 secondes
function scheduleCasinoEvent() {
    console.log('Casino planifie dans 5 secondes');
    setTimeout(() => {
        triggerCasinoEvent();
    }, 5000);
}

function triggerCasinoEvent() {
    console.log('Declenchement du Casino!');

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: radial-gradient(circle, rgba(139,0,0,0.98), rgba(0,0,0,0.98)); z-index: 9999; display: flex; align-items: center; justify-content: center; flex-direction: column; animation: fadeIn 0.5s; overflow: hidden;';
    document.body.appendChild(overlay);

    for (let i = 0; i < 50; i++) {
        const sparkle = document.createElement('div');
        sparkle.textContent = ['✨', '💰', '🪙', '💎', '⭐'][Math.floor(Math.random() * 5)];
        sparkle.style.cssText = 'position: absolute; left: ' + (Math.random() * 100) + '%; top: -50px; font-size: ' + (1.5 + Math.random() * 1.5) + 'em; animation: sparklefall ' + (3 + Math.random() * 4) + 's linear infinite; animation-delay: ' + (Math.random() * 5) + 's; opacity: ' + (0.4 + Math.random() * 0.4) + ';';
        overlay.appendChild(sparkle);
    }

    const title = document.createElement('div');
    title.innerHTML = '<div style="text-align: center; color: #ffd700; font-size: 6em; font-weight: 900; text-shadow: 0 0 40px #ffd700, 0 0 80px #ff8c00; margin-bottom: 20px;">🎰 CASINO ROYAL 🎰</div><div style="text-align: center; color: #fff; font-size: 2em; margin-bottom: 20px;">✨ Cliquez sur le de ! ✨</div><div style="text-align: center; color: #90ee90; font-size: 1.5em; margin-bottom: 30px;">💸 50 EUR • 💰 100 EUR • 💎 120 EUR • 👑 200 EUR</div><div id="current-player-info" style="text-align: center; color: #ffd700; font-size: 2.5em; margin-bottom: 40px; font-weight: 900;">🎲 ' + players[0].emoji + ' ' + players[0].prenom + ' 🎲</div>';
    overlay.appendChild(title);

    const container = document.createElement('div');
    container.style.cssText = 'display: flex; justify-content: center; align-items: center;';
    overlay.appendChild(container);

    const machine = document.createElement('div');
    machine.style.cssText = 'background: linear-gradient(135deg, #1a0000, #8b0000, #ff4500, #8b0000, #1a0000); background-size: 400% 400%; padding: 60px; border-radius: 40px; border: 8px solid #ffd700; text-align: center; width: 500px; box-shadow: 0 30px 80px rgba(0,0,0,0.9), 0 0 60px rgba(255,215,0,0.5); animation: machineglow 3s ease-in-out infinite;';
    machine.innerHTML = '<div class="result-display" style="font-size: 2.5em; color: #ffd700; min-height: 140px; margin-bottom: 40px; font-weight: 900; line-height: 1.4; display: flex; align-items: center; justify-content: center; flex-direction: column;"></div><div id="dice-clickable" style="background: linear-gradient(135deg, #000, #1a1a1a); padding: 50px; border-radius: 30px; font-size: 10em; color: #ffd700; border: 8px solid #ffd700; display: flex; align-items: center; justify-content: center; font-weight: 900; cursor: pointer; transition: all 0.3s;">🎲</div>';
    container.appendChild(machine);

    const style = document.createElement('style');
    style.textContent = '@keyframes sparklefall { from { transform: translateY(0) rotate(0); opacity: 0.8; } to { transform: translateY(100vh) rotate(720deg); opacity: 0; } } @keyframes machineglow { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } } @keyframes diceRoll { 0% { transform: rotate(0deg); } 25% { transform: rotate(90deg); } 50% { transform: rotate(180deg); } 75% { transform: rotate(270deg); } 100% { transform: rotate(360deg); } } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } @keyframes winFlash { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } } @keyframes shake { 0%, 100% { transform: translateX(0); } 10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); } 20%, 40%, 60%, 80% { transform: translateX(10px); } }';
    document.head.appendChild(style);

    const diceElement = machine.querySelector('#dice-clickable');
    const resultDisplay = machine.querySelector('.result-display');
    const playerInfo = document.getElementById('current-player-info');

    let currentIndex = 0;
    const stats = {};
    players.forEach((_, i) => { stats[i] = { gain: 0 }; });

    const playTurn = () => {
        const player = players[currentIndex];
        playerInfo.innerHTML = '🎲 ' + player.emoji + ' ' + player.prenom + ' 🎲';
        resultDisplay.innerHTML = '';
        diceElement.style.pointerEvents = 'auto';
        diceElement.style.opacity = '1';

        const rollDice = () => {
            diceElement.style.pointerEvents = 'none';
            diceElement.style.opacity = '0.5';
            diceElement.style.animation = 'diceRoll 1s ease-in-out 3';

            setTimeout(() => {
                diceElement.style.animation = '';

                const rand = Math.random();
                let gain = 0, result = '';

                if (rand < 0.20) {
                    gain = 0;
                    result = '<div style="font-size: 0.9em;">💔 PERDU 💔</div><div style="font-size: 1.2em; color: #ff0000; font-weight: 900; text-shadow: 0 0 20px #ff0000;">0 EUR</div>';
                } else if (rand < 0.55) {
                    gain = 50;
                    result = '<div style="font-size: 0.9em;">💸 GAGNE 💸</div><div style="font-size: 1.2em; color: #00ff00; font-weight: 900; text-shadow: 0 0 20px #00ff00;">+50 EUR</div>';
                } else if (rand < 0.80) {
                    gain = 100;
                    result = '<div style="font-size: 0.9em;">💰 GAGNE 💰</div><div style="font-size: 1.2em; color: #00ff00; font-weight: 900; text-shadow: 0 0 20px #00ff00;">+100 EUR</div>';
                } else if (rand < 0.95) {
                    gain = 120;
                    result = '<div style="font-size: 0.9em;">💎 SUPER GAGNE 💎</div><div style="font-size: 1.2em; color: #00ff00; font-weight: 900; text-shadow: 0 0 20px #00ff00;">+120 EUR</div>';
                } else {
                    gain = 200;
                    result = '<div style="font-size: 0.9em;">👑 JACKPOT 👑</div><div style="font-size: 1.2em; color: #00ff00; font-weight: 900; text-shadow: 0 0 20px #00ff00;">+200 EUR</div>';
                }

                resultDisplay.innerHTML = result;
                stats[currentIndex].gain = gain;

                if (gain > 0) {
                    player.money += gain;
                    displayPlayers();

                    if (gain >= 100) {
                        const confettiCount = gain >= 200 ? 40 : (gain >= 120 ? 30 : 20);
                        for (let i = 0; i < confettiCount; i++) {
                            const confetti = document.createElement('div');
                            confetti.textContent = ['🎉', '🎊', '✨', '💫', '🌟', '⭐'][Math.floor(Math.random() * 6)];
                            confetti.style.cssText = 'position: absolute; left: 50%; top: 50%; font-size: ' + (2 + Math.random() * 2) + 'em; animation: confettiExplode 2s ease-out forwards;';
                            overlay.appendChild(confetti);
                            setTimeout(() => confetti.remove(), 2000);
                        }
                    }

                    if (gain >= 120) {
                        machine.style.animation = 'shake 0.5s ease-in-out 2';
                        setTimeout(() => { machine.style.animation = 'machineglow 3s ease-in-out infinite'; }, 1000);
                    }
                }

                setTimeout(() => {
                    currentIndex++;

                    if (currentIndex < players.length) {
                        diceElement.textContent = '🎲';
                        diceElement.style.color = '#ffd700';
                        resultDisplay.innerHTML = '';

                        if (players[currentIndex].isBot) {
                            setTimeout(() => playTurn(), 1500);
                        } else {
                            playTurn();
                        }
                    } else {
                        setTimeout(() => {
                            overlay.style.opacity = '0';
                            overlay.style.transition = 'opacity 1s';

                            setTimeout(() => {
                                overlay.remove();
                                style.remove();

                                players.forEach((player, i) => {
                                    const gain = stats[i].gain;
                                    if (gain >= 200) {
                                        addChatMessage('👑 ' + player.emoji + ' ' + player.prenom + ' a remporte ' + gain + ' EUR au casino !', 'Systeme', true, false);
                                    } else if (gain > 0) {
                                        addChatMessage('💰 ' + player.emoji + ' ' + player.prenom + ' a gagne ' + gain + ' EUR au casino', 'Systeme', true, false);
                                    } else {
                                        addChatMessage('💔 ' + player.emoji + ' ' + player.prenom + ' n\'a rien gagne', 'Systeme', true, false);
                                    }
                                });
                            }, 1000);
                        }, 2500);
                    }
                }, 2000);
            }, 3000);
        };

        diceElement.onclick = rollDice;

        if (player.isBot) {
            setTimeout(rollDice, 1500);
        }
    };

    const confettiStyle = document.createElement('style');
    confettiStyle.textContent = '@keyframes confettiExplode { 0% { transform: translate(-50%, -50%) rotate(0deg) scale(0); opacity: 1; } 100% { transform: translate(' + (Math.random() * 600 - 300) + 'px, ' + (Math.random() * 600 - 300) + 'px) rotate(' + (Math.random() * 1080) + 'deg) scale(2); opacity: 0; } }';
    document.head.appendChild(confettiStyle);

    playTurn();
}

// Événement "Poulet" - Se déclenche entre 1 et 2 minutes
function scheduleChickenEvent() {
    console.log('Poulet planifie dans 5 secondes');
    setTimeout(() => {
        triggerChickenEvent();
    }, 5000);
}

function triggerChickenEvent() {
    // Créer l'overlay qui bloque les clics
    const overlay = document.createElement('div');
    overlay.className = 'chicken-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, rgba(255, 140, 0, 0) 0%, rgba(255, 69, 0, 0) 100%);
        z-index: 9999;
        transition: all 0.8s ease;
        pointer-events: all;
    `;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.style.background = 'linear-gradient(135deg, rgba(255, 140, 0, 0.4) 0%, rgba(255, 69, 0, 0.3) 100%)', 50);

    // Afficher le titre
    const titleDiv = document.createElement('div');
    titleDiv.style.cssText = `
        position: fixed;
        top: 15%;
        left: 50%;
        transform: translate(-50%, -50%) scale(0.5);
        background: linear-gradient(135deg, #ff8c00 0%, #ff4500 100%);
        padding: 35px 70px;
        border-radius: 30px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.9), 0 0 50px rgba(255, 140, 0, 0.7), inset 0 0 30px rgba(255, 255, 255, 0.2);
        z-index: 10001;
        text-align: center;
        border: 5px solid #ffd700;
        transition: transform 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        pointer-events: none;
        animation: titlePulse 2s ease infinite;
    `;
    titleDiv.innerHTML = `
        <div style="font-size: 5em; margin-bottom: 15px; animation: bounce 0.8s ease infinite; filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.5));">🐔</div>
        <h2 style="
            color: #fff;
            margin: 0;
            font-size: 3em;
            text-shadow: 0 5px 20px rgba(0, 0, 0, 0.9), 0 0 30px rgba(255, 215, 0, 0.8);
            font-weight: 900;
            letter-spacing: 4px;
        ">ATTRAPEZ LES POULETS !</h2>
        <div style="
            color: #ffd700;
            font-size: 1.5em;
            margin-top: 15px;
            font-weight: 700;
            text-shadow: 0 3px 10px rgba(0, 0, 0, 0.7);
        ">🐔 Cliquez rapidement = +10€ par poulet !</div>
    `;
    document.body.appendChild(titleDiv);
    setTimeout(() => titleDiv.style.transform = 'translate(-50%, -50%) scale(1)', 100);

    // Compteur en temps réel
    const scoreDiv = document.createElement('div');
    scoreDiv.style.cssText = `
        position: fixed;
        top: 10px;
        right: 20px;
        background: linear-gradient(135deg, rgba(255, 140, 0, 0.95) 0%, rgba(255, 69, 0, 0.95) 100%);
        padding: 20px 30px;
        border-radius: 20px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8), 0 0 30px rgba(255, 140, 0, 0.6);
        z-index: 10001;
        text-align: center;
        border: 3px solid #ffd700;
        pointer-events: none;
        font-size: 1.8em;
        font-weight: 900;
        color: #fff;
        text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
    `;
    scoreDiv.innerHTML = `
        <div style="font-size: 0.8em; color: #ffd700; margin-bottom: 5px;">SCORE</div>
        <div id="chicken-score" style="font-size: 2em; color: #00ff00;">0€</div>
    `;
    document.body.appendChild(scoreDiv);

    // Compteur de poulets attrapés et argent gagné par joueur
    const chickenCaught = {};
    const moneyEarned = {};
    let totalMoney = 0;
    players.forEach((player, index) => {
        chickenCaught[index] = 0;
        moneyEarned[index] = 0;
    });

    // Créer des étoiles de fond
    for (let i = 0; i < 30; i++) {
        setTimeout(() => {
            const star = document.createElement('div');
            star.textContent = ['⭐', '✨', '💫', '🌟'][Math.floor(Math.random() * 4)];
            star.style.cssText = `
                position: fixed;
                left: ${Math.random() * window.innerWidth}px;
                top: ${Math.random() * window.innerHeight}px;
                font-size: ${Math.random() * 1.5 + 0.5}em;
                z-index: 9998;
                pointer-events: none;
                animation: twinkle ${Math.random() * 2 + 1}s ease infinite;
                opacity: ${Math.random() * 0.5 + 0.3};
            `;
            overlay.appendChild(star);
        }, i * 100);
    }

    // Attendre 2 secondes avant de faire tomber les poulets
    setTimeout(() => {
        // Masquer le titre
        titleDiv.style.top = '5%';
        titleDiv.style.transform = 'translate(-50%, 0) scale(0.7)';

        // Créer et faire tomber 60 poulets
        const totalChickens = 60;
        const chickensCreated = [];

        for (let i = 0; i < totalChickens; i++) {
            setTimeout(() => {
                const chicken = document.createElement('div');
                chicken.textContent = '🐔';
                const randomSpeed = Math.random() * 2 + 2.5;
                chicken.style.cssText = `
                    position: fixed;
                    left: ${Math.random() * (window.innerWidth - 60)}px;
                    top: -60px;
                    font-size: ${Math.random() * 2 + 1.5}em;
                    z-index: 10000;
                    cursor: pointer;
                    transition: transform 0.2s ease;
                    user-select: none;
                    animation: chickenFall ${randomSpeed}s linear;
                    pointer-events: all;
                    filter: drop-shadow(0 5px 10px rgba(0, 0, 0, 0.5));
                `;

                // Gestion du clic sur le poulet
                chicken.addEventListener('click', function(e) {
                    if (!this.clicked) {
                        this.clicked = true;

                        // Trouver le joueur actuel
                        const currentIndex = currentPlayerIndex;
                        chickenCaught[currentIndex]++;
                        moneyEarned[currentIndex] += 10;
                        totalMoney += 10;

                        // Mettre à jour le score
                        const scoreElement = document.getElementById('chicken-score');
                        if (scoreElement) {
                            scoreElement.textContent = totalMoney + '€';
                            scoreElement.style.transform = 'scale(1.3)';
                            setTimeout(() => scoreElement.style.transform = 'scale(1)', 200);
                        }

                        // Ajouter l'argent
                        players[currentIndex].money += 10;
                        displayPlayers();

                        // Créer l'animation "+10€" à l'endroit du clic avec effet combo
                        const plusTen = document.createElement('div');
                        plusTen.textContent = '+10€';
                        plusTen.style.cssText = `
                            position: fixed;
                            left: ${e.clientX}px;
                            top: ${e.clientY}px;
                            color: #00ff00;
                            font-size: 2.5em;
                            font-weight: 900;
                            text-shadow: 0 0 20px rgba(0, 255, 0, 1), 0 0 40px rgba(0, 255, 0, 0.5);
                            z-index: 10002;
                            pointer-events: none;
                            animation: floatUp 1.2s ease forwards;
                        `;
                        document.body.appendChild(plusTen);

                        // Créer des particules d'explosion
                        for (let j = 0; j < 8; j++) {
                            const particle = document.createElement('div');
                            particle.textContent = ['💰', '✨', '⭐', '💫'][Math.floor(Math.random() * 4)];
                            particle.style.cssText = `
                                position: fixed;
                                left: ${e.clientX}px;
                                top: ${e.clientY}px;
                                font-size: 1.5em;
                                z-index: 10002;
                                pointer-events: none;
                                animation: explode${j} 0.8s ease forwards;
                            `;
                            document.body.appendChild(particle);
                            setTimeout(() => particle.remove(), 800);
                        }

                        // Supprimer le "+10€" après l'animation
                        setTimeout(() => plusTen.remove(), 1200);

                        // Faire disparaître le poulet avec effet
                        this.style.transition = 'all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
                        this.style.transform = 'scale(2) rotate(720deg)';
                        this.style.opacity = '0';

                        setTimeout(() => this.remove(), 400);
                    }
                });

                chicken.addEventListener('mouseover', function() {
                    if (!this.clicked) {
                        this.style.transform = 'scale(1.4) rotate(15deg)';
                        this.style.filter = 'drop-shadow(0 8px 15px rgba(255, 140, 0, 0.8))';
                    }
                });

                chicken.addEventListener('mouseout', function() {
                    if (!this.clicked) {
                        this.style.transform = 'scale(1) rotate(0deg)';
                        this.style.filter = 'drop-shadow(0 5px 10px rgba(0, 0, 0, 0.5))';
                    }
                });

                document.body.appendChild(chicken);
                chickensCreated.push(chicken);

                // Supprimer le poulet après l'animation
                setTimeout(() => {
                    if (!chicken.clicked) {
                        chicken.remove();
                    }
                }, randomSpeed * 1000 + 500);
            }, i * 120); // Un poulet tous les 120ms
        }
    }, 2000); // Attendre 2 secondes

    // Nettoyer après 19 secondes (2s attente + 17s événement)
    setTimeout(() => {
        titleDiv.style.transform = 'translate(-50%, 0) scale(0)';
        scoreDiv.style.transform = 'scale(0)';

        // Afficher le récapitulatif
        setTimeout(() => {
            titleDiv.remove();
            scoreDiv.remove();

            // Créer le message récapitulatif avec style amélioré
            const summaryDiv = document.createElement('div');
            summaryDiv.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) scale(0.5);
                background: linear-gradient(135deg, #ff8c00 0%, #ff4500 50%, #ff6347 100%);
                padding: 50px 80px;
                border-radius: 30px;
                box-shadow: 0 30px 80px rgba(0, 0, 0, 0.9), 0 0 60px rgba(255, 140, 0, 0.8), inset 0 0 50px rgba(255, 255, 255, 0.2);
                z-index: 10001;
                text-align: center;
                border: 6px solid #ffd700;
                transition: transform 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                pointer-events: none;
                max-width: 700px;
            `;

            let summaryHTML = `
                <div style="font-size: 4em; margin-bottom: 20px; animation: bounce 1s ease infinite; filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.5));">🎉</div>
                <h2 style="
                    color: #fff;
                    margin-bottom: 35px;
                    font-size: 2.8em;
                    text-shadow: 0 5px 20px rgba(0, 0, 0, 0.9), 0 0 30px rgba(255, 215, 0, 0.8);
                    font-weight: 900;
                    letter-spacing: 3px;
                ">RÉSULTATS FINAUX</h2>
            `;

            // Trier les joueurs par argent gagné
            const sortedPlayers = players.map((player, index) => ({
                player,
                index,
                caught: chickenCaught[index],
                earned: moneyEarned[index]
            })).filter(p => p.earned > 0).sort((a, b) => b.earned - a.earned);

            sortedPlayers.forEach((data, rank) => {
                const medal = rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : '🏅';
                summaryHTML += `
                    <div style="
                        margin: 20px 0;
                        padding: 20px 30px;
                        background: linear-gradient(135deg, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.15) 100%);
                        border-radius: 20px;
                        color: #fff;
                        font-size: 1.4em;
                        font-weight: 700;
                        border: 3px solid rgba(255, 215, 0, ${rank === 0 ? 1 : 0.5});
                        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(255, 255, 255, 0.1);
                        text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
                        animation: slideIn ${0.3 + rank * 0.1}s ease forwards;
                    ">
                        ${medal} ${data.player.emoji} <strong>${data.player.prenom}</strong><br>
                        <span style="color: #00ff00; font-size: 1.1em;">${data.caught} poulets 🐔</span>
                        =
                        <span style="color: #ffd700; font-size: 1.3em; text-shadow: 0 0 15px rgba(255, 215, 0, 0.9);">+${data.earned}€ 💰</span>
                    </div>
                `;
            });

            if (sortedPlayers.length === 0) {
                summaryHTML += `
                    <div style="color: #fff; font-size: 1.5em; margin: 20px 0;">
                        Aucun poulet attrapé... 😢
                    </div>
                `;
            }

            summaryDiv.innerHTML = summaryHTML;
            document.body.appendChild(summaryDiv);
            setTimeout(() => summaryDiv.style.transform = 'translate(-50%, -50%) scale(1)', 100);

            // Fermer après 4 secondes
            setTimeout(() => {
                summaryDiv.style.transform = 'translate(-50%, -50%) scale(0)';
                overlay.style.background = 'rgba(255, 140, 0, 0)';

                setTimeout(() => {
                    summaryDiv.remove();
                    overlay.remove();

                    // Messages dans le chat
                    sortedPlayers.forEach((data) => {
                        addChatMessage(`🐔 ${data.player.emoji} ${data.player.prenom} a attrapé ${data.caught} poulet(s) et gagné ${data.earned}€ !`, 'Système', true, false);
                    });
                }, 500);
            }, 4000);
        }, 500);
    }, 19000);
}

// Événement "Noël" - Se déclenche entre 1 et 2 minutes
function scheduleChristmasEvent() {
    console.log('Noel planifie dans 5 secondes');
    setTimeout(() => {
        triggerChristmasEvent();
    }, 5000);
}

function triggerChristmasEvent() {
    // Créer l'overlay de Noël
    const overlay = document.createElement('div');
    overlay.className = 'christmas-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(10, 50, 10, 0);
        z-index: 9999;
        transition: background 0.8s ease;
    `;
    document.body.appendChild(overlay);
    setTimeout(() => {
        overlay.style.background = 'rgba(10, 50, 10, 0.85)';
    }, 50);

    // Créer des flocons de neige
    for (let i = 0; i < 100; i++) {
        const snowflake = document.createElement('div');
        snowflake.textContent = '❄️';
        snowflake.style.cssText = `
            position: fixed;
            left: ${Math.random() * window.innerWidth}px;
            top: -20px;
            font-size: ${Math.random() * 1.5 + 0.5}em;
            z-index: 2999;
            animation: snowFall ${Math.random() * 3 + 2}s linear infinite;
            pointer-events: none;
            opacity: ${Math.random() * 0.7 + 0.3};
        `;
        document.body.appendChild(snowflake);
        setTimeout(() => snowflake.remove(), 15000);
    }

    // Afficher les cadeaux joueur par joueur
    showPlayerChristmasGifts(0, overlay);
}

function showPlayerChristmasGifts(playerIndex, overlay) {
    if (playerIndex >= players.length) {
        // Tous les joueurs ont ouvert leurs cadeaux
        overlay.style.background = 'rgba(0, 0, 0, 0)';
        setTimeout(() => overlay.remove(), 500);
        return;
    }

    const player = players[playerIndex];

    // Message de Noël pour ce joueur
    const christmasMessage = document.createElement('div');
    christmasMessage.className = 'christmas-dialog';
    christmasMessage.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) scale(0.5);
        background: linear-gradient(135deg, #1a4d1a 0%, #0d260d 100%);
        padding: 50px 70px;
        border-radius: 30px;
        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.9), 0 0 60px rgba(255, 100, 100, 0.5);
        z-index: 10000;
        text-align: center;
        border: 4px solid #d4af37;
        transition: transform 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        max-width: 900px;
        backdrop-filter: none;
        filter: none;
    `;

    // Créer 6 cadeaux
    let giftsHTML = '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 30px;">';
    for (let i = 0; i < 6; i++) {
        giftsHTML += `
            <button class="gift-choice-btn" data-gift-index="${i}" style="
                font-size: 5em;
                background: linear-gradient(135deg, rgba(212, 175, 55, 0.2) 0%, rgba(255, 215, 0, 0.1) 100%);
                border: 3px solid #d4af37;
                border-radius: 20px;
                padding: 30px;
                cursor: pointer;
                transition: all 0.3s ease;
                filter: drop-shadow(0 5px 10px rgba(0, 0, 0, 0.3));
            " onmouseover="this.style.transform='scale(1.15) rotate(5deg)'; this.style.borderColor='#ffd700'" onmouseout="this.style.transform='scale(1) rotate(0deg)'; this.style.borderColor='#d4af37'">🎁</button>
        `;
    }
    giftsHTML += '</div>';

    christmasMessage.innerHTML = `
        <div style="font-size: 5em; margin-bottom: 20px; animation: bounce 1s ease infinite;">🎄</div>
        <h2 style="
            color: #ffd700;
            margin-bottom: 25px;
            font-size: 3em;
            text-shadow: 0 0 30px rgba(255, 215, 0, 0.8);
            font-weight: 900;
            letter-spacing: 4px;
        ">JOYEUX NOËL ! 🎅</h2>
        <div style="
            color: #90ee90;
            font-size: 1.5em;
            margin-bottom: 10px;
            font-weight: 700;
        ">
            <span style="font-size: 2em;">${player.emoji}</span> ${player.prenom}
        </div>
        <div style="
            color: #ffbe0b;
            font-size: 1.3em;
            margin-bottom: 20px;
        ">
            🎁 Choisissez UN cadeau parmi les 6 !
        </div>
        ${giftsHTML}
    `;

    document.body.appendChild(christmasMessage);
    setTimeout(() => christmasMessage.style.transform = 'translate(-50%, -50%) scale(1)', 100);

    // Gestion des clics sur les cadeaux
    document.querySelectorAll('.gift-choice-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            // Désactiver tous les boutons
            document.querySelectorAll('.gift-choice-btn').forEach(b => {
                b.disabled = true;
                b.style.cursor = 'not-allowed';
            });

            // Animation du cadeau choisi
            this.style.transform = 'scale(1.3) rotate(360deg)';

            // Faire disparaître tous les cadeaux avec animation
            setTimeout(() => {
                const giftsGrid = this.parentElement;
                giftsGrid.style.transition = 'all 0.5s ease';
                giftsGrid.style.opacity = '0';
                giftsGrid.style.transform = 'scale(0.5)';

                setTimeout(() => {
                    giftsGrid.remove();

                    // Ouvrir le cadeau et afficher la récompense
                    openChristmasGift(playerIndex, this, christmasMessage);

                    // Passer au joueur suivant après 3 secondes
                    setTimeout(() => {
                        christmasMessage.style.transform = 'translate(-50%, -50%) scale(0)';
                        setTimeout(() => {
                            christmasMessage.remove();
                            showPlayerChristmasGifts(playerIndex + 1, overlay);
                        }, 500);
                    }, 3000);
                }, 500);
            }, 800);
        });
    });

    // Si c'est un bot, choisir automatiquement après un délai
    if (player.isBot) {
        setTimeout(() => {
            const randomGift = Math.floor(Math.random() * 6);
            const btn = document.querySelector(`.gift-choice-btn[data-gift-index="${randomGift}"]`);
            if (btn && !btn.disabled) {
                btn.click();
            }
        }, 1500);
    }
}

function openChristmasGift(playerIndex, btnElement, messageElement) {
    const player = players[playerIndex];

    // Types de récompenses
    const rewards = [
        { type: 'money', weight: 35 },
        { type: 'jail-card', weight: 15 },
        { type: 'teleport', weight: 20 },
        { type: 'chance-good', weight: 20 },
        { type: 'ultimate', weight: 10 }
    ];

    // Sélection aléatoire pondérée
    const totalWeight = rewards.reduce((sum, r) => sum + r.weight, 0);
    let random = Math.random() * totalWeight;
    let selectedReward = rewards[0];

    for (let reward of rewards) {
        random -= reward.weight;
        if (random <= 0) {
            selectedReward = reward;
            break;
        }
    }

    // Appliquer la récompense
    let rewardText = '';
    let rewardEmoji = '🎁';

    switch (selectedReward.type) {
        case 'money':
            const amount = Math.floor(Math.random() * 61) + 40; // 40-100€
            player.money += amount;
            rewardText = `Vous avez gagné ${amount}€ !`;
            rewardEmoji = '💰';
            showFloatingMessage(`${player.emoji} +${amount}€`, 'success');
            break;

        case 'jail-card':
            player.jailFreeCards++;
            rewardText = 'Carte Sortie de Prison';
            rewardEmoji = '🎫';
            showFloatingMessage(`${player.emoji} 🎫 CARTE PRISON`, 'success');
            break;

        case 'teleport':
            // Cases entre 13 et 19 (Rue de Paradis à Place Pigalle)
            const teleportPositions = [13, 14, 16, 18, 19];
            const newPosition = teleportPositions[Math.floor(Math.random() * teleportPositions.length)];
            const oldPosition = player.position;
            player.position = newPosition;
            displayTokens();
            rewardText = 'Téléportation magique !';
            rewardEmoji = '✨';
            showFloatingMessage(`${player.emoji} ✨ TÉLÉPORTATION`, 'info');
            setTimeout(() => checkLanding(playerIndex), 1000);
            break;

        case 'chance-good':
            // Cartes Chance positives uniquement
            const goodChanceCards = [
                { text: "La banque vous verse un dividende de 50€", amount: 50 },
                { text: "C'est votre anniversaire, gagnez 50€", amount: 50 },
                { text: "Votre immeuble rapporte des revenus, recevez 150€", amount: 150 },
                { text: "Votre prêt de construction échoit, recevez 150€", amount: 150 }
            ];
            const card = goodChanceCards[Math.floor(Math.random() * goodChanceCards.length)];
            player.money += card.amount;
            rewardText = card.text;
            rewardEmoji = '🎲';
            showFloatingMessage(`${player.emoji} +${card.amount}€`, 'success');
            break;

        case 'ultimate':
            rewardText = 'Carte ULTIME : Volez 50€ à un adversaire !';
            rewardEmoji = '⚡';
            // Pour les bots, choisir automatiquement
            if (player.isBot) {
                setTimeout(() => {
                    const victims = players.filter((p, i) => i !== playerIndex);
                    const victim = victims[Math.floor(Math.random() * victims.length)];
                    victim.money -= 50;
                    displayPlayers();
                    showFloatingMessage(`${victim.emoji} -50€ PAR ${player.emoji}`, 'error');
                    addChatMessage(`${player.emoji} ${player.prenom} a utilisé la carte ULTIME sur ${victim.emoji} ${victim.prenom} ! -50€`, 'Système', true, false);
                }, 1000);
            } else {
                // Pour les humains, afficher un sélecteur
                setTimeout(() => {
                    showUltimateCardDialog(playerIndex);
                }, 500);
            }
            break;
    }

    // Afficher la récompense en grand
    const rewardDiv = document.createElement('div');
    rewardDiv.style.cssText = `
        margin-top: 20px;
        color: #ffd700;
        font-weight: 800;
        font-size: 1.2em;
        text-shadow: 0 0 15px rgba(255, 215, 0, 0.9);
        animation: fadeIn 0.8s ease, pulse 1s ease infinite;
        padding: 20px;
        background: linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 100, 100, 0.2) 100%);
        border-radius: 15px;
        border: 2px solid #ffd700;
        box-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
    `;
    rewardDiv.innerHTML = `
        <div style="font-size: 2.5em; margin-bottom: 10px; animation: bounce 1s ease infinite;">${rewardEmoji}</div>
        <div style="font-size: 1.1em; line-height: 1.4;">${rewardText}</div>
    `;
    messageElement.appendChild(rewardDiv);

    displayPlayers();

    // Message au chat
    addChatMessage(`🎁 ${player.emoji} ${player.prenom} a ouvert son cadeau : ${rewardText}`, 'Système', true, false);
}

function showUltimateCardDialog(attackerIndex) {
    const attacker = players[attackerIndex];

    const dialog = document.createElement('div');
    dialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) scale(0.8);
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        padding: 40px;
        border-radius: 25px;
        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.9), 0 0 60px rgba(255, 0, 110, 0.6);
        z-index: 4000;
        text-align: center;
        border: 4px solid #ff006e;
        animation: scaleIn 0.3s ease forwards;
    `;

    let victimsHTML = '';
    players.forEach((player, index) => {
        if (index !== attackerIndex) {
            victimsHTML += `
                <button class="victim-btn" data-victim-index="${index}" style="
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    width: 100%;
                    padding: 20px;
                    margin: 10px 0;
                    background: linear-gradient(135deg, rgba(255, 0, 110, 0.2) 0%, rgba(251, 86, 7, 0.2) 100%);
                    border: 3px solid #ff006e;
                    border-radius: 15px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    color: white;
                    font-size: 1.2em;
                    font-weight: 700;
                " onmouseover="this.style.transform='scale(1.05)'; this.style.borderColor='#ff4d9e'" onmouseout="this.style.transform='scale(1)'; this.style.borderColor='#ff006e'">
                    <span style="font-size: 2em;">${player.emoji}</span>
                    <div style="text-align: left; flex: 1;">
                        <div>${player.prenom}</div>
                        <div style="font-size: 0.9em; color: #ffbe0b;">${player.money}€</div>
                    </div>
                </button>
            `;
        }
    });

    dialog.innerHTML = `
        <div style="font-size: 4em; margin-bottom: 20px;">⚡</div>
        <h2 style="
            color: #ff006e;
            margin-bottom: 25px;
            font-size: 2.5em;
            text-shadow: 0 0 20px rgba(255, 0, 110, 0.8);
            font-weight: 900;
        ">CARTE ULTIME</h2>
        <p style="color: #ffd700; font-size: 1.3em; margin-bottom: 30px;">
            Choisissez un joueur pour lui retirer 50€ !
        </p>
        <div style="max-height: 400px; overflow-y: auto;">
            ${victimsHTML}
        </div>
    `;

    document.body.appendChild(dialog);

    document.querySelectorAll('.victim-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const victimIndex = parseInt(this.getAttribute('data-victim-index'));
            const victim = players[victimIndex];

            victim.money -= 50;
            displayPlayers();
            showFloatingMessage(`${victim.emoji} -50€ PAR ${attacker.emoji}`, 'error');
            addChatMessage(`⚡ ${attacker.emoji} ${attacker.prenom} a utilisé la carte ULTIME sur ${victim.emoji} ${victim.prenom} ! -50€`, 'Système', true, false);

            dialog.style.transform = 'translate(-50%, -50%) scale(0)';
            setTimeout(() => dialog.remove(), 300);
        });
    });
}

// Événement "La nuit" - Se déclenche une fois entre 1 et 2 minutes
function scheduleNightEvent() {
    console.log('Nuit planifie dans 5 secondes');
    setTimeout(() => {
        triggerNightEvent();
        // Ne pas planifier un autre événement (une seule fois dans la partie)
    }, 5000);
}

function triggerNightEvent() {
    // Classer les joueurs du plus riche au plus pauvre
    const sortedPlayers = players.map((player, index) => ({
        player: player,
        originalIndex: index,
        reward: Math.floor(Math.random() * 61) + 40 // Entre 40 et 100
    })).sort((a, b) => b.player.money - a.player.money);

    // Créer l'overlay sombre
    const overlay = document.createElement('div');
    overlay.className = 'night-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0);
        z-index: 2998;
        transition: background 0.8s ease;
    `;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.style.background = 'rgba(0, 0, 20, 0.9)', 50);

    // Créer des étoiles et particules
    for (let i = 0; i < 80; i++) {
        const star = document.createElement('div');
        star.className = 'night-star';
        const emojis = ['⭐', '✨', '💫', '🌟'];
        star.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        star.style.cssText = `
            position: fixed;
            left: ${Math.random() * window.innerWidth}px;
            top: ${Math.random() * window.innerHeight}px;
            font-size: ${Math.random() * 2 + 0.5}em;
            z-index: 2999;
            animation: starTwinkle ${Math.random() * 2 + 1}s ease-in-out ${Math.random()}s infinite,
                       starFall ${Math.random() * 3 + 2}s linear ${Math.random() * 2}s infinite;
            pointer-events: none;
        `;
        document.body.appendChild(star);
        setTimeout(() => star.remove(), 12000);
    }

    // Message "La nuit"
    const nightMessage = document.createElement('div');
    nightMessage.className = 'night-dialog';
    nightMessage.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) scale(0.5);
        background: linear-gradient(135deg, #0a0e27 0%, #16213e 100%);
        padding: 50px 70px;
        border-radius: 30px;
        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.9), 0 0 60px rgba(100, 100, 255, 0.5);
        z-index: 3000;
        text-align: center;
        border: 4px solid rgba(100, 100, 255, 0.6);
        transition: transform 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        max-width: 600px;
    `;

    // Créer la liste des joueurs
    let playersListHTML = '';
    sortedPlayers.forEach((item, index) => {
        const medals = ['🥇', '🥈', '🥉'];
        const rankEmoji = index < 3 ? medals[index] : `${index + 1}.`;
        const borderColor = index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : '#9090ff';
        const glowColor = index === 0 ? 'rgba(255, 215, 0, 0.5)' : index === 1 ? 'rgba(192, 192, 192, 0.5)' : index === 2 ? 'rgba(205, 127, 50, 0.5)' : 'rgba(144, 144, 255, 0.3)';

        playersListHTML += `
            <div class="night-player-item" id="night-player-${index}" style="
                opacity: 0;
                transform: translateX(-50px) scale(0.9);
                padding: 18px 28px;
                margin: 12px 0;
                background: linear-gradient(135deg, rgba(50, 50, 80, 0.8) 0%, rgba(30, 30, 60, 0.9) 100%);
                border-radius: 18px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-left: 5px solid ${borderColor};
                box-shadow: 0 5px 20px ${glowColor}, inset 0 1px 0 rgba(255, 255, 255, 0.1);
                transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
                position: relative;
                overflow: hidden;
            ">
                <div style="
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
                    transform: translateX(-100%);
                    animation: shimmerEffect 2s infinite;
                "></div>
                <div style="display: flex; align-items: center; gap: 15px; position: relative; z-index: 1;">
                    <span style="
                        font-size: 2em;
                        font-weight: 900;
                        color: ${borderColor};
                        text-shadow: 0 0 10px ${glowColor};
                        min-width: 40px;
                        text-align: center;
                    ">${rankEmoji}</span>
                    <span style="font-size: 2.2em; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">${item.player.emoji}</span>
                    <div style="text-align: left;">
                        <div style="font-weight: 800; color: #e0e0ff; font-size: 1.2em; text-shadow: 0 0 10px rgba(224, 224, 255, 0.3);">${item.player.prenom}</div>
                        <div style="font-size: 1em; color: #a0a0d0; font-weight: 600;">💰 ${item.player.money}€</div>
                    </div>
                </div>
                <div class="night-reward" style="
                    font-size: 2em;
                    font-weight: 900;
                    background: linear-gradient(135deg, #4CAF50 0%, #8BC34A 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    text-shadow: 0 0 20px rgba(76, 175, 80, 0.8);
                    opacity: 0;
                    transform: scale(0) rotate(-20deg);
                    transition: all 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                    position: relative;
                    z-index: 1;
                ">+${item.reward}€</div>
            </div>
        `;
    });

    nightMessage.innerHTML = `
        <div class="night-icon" style="font-size: 4.5em; margin-bottom: 15px; animation: bounce 1s ease infinite;">🌙</div>
        <h2 class="night-title" style="
            color: #9090ff;
            margin-bottom: 20px;
            font-size: 2.8em;
            text-shadow: 0 0 30px rgba(144, 144, 255, 0.8);
            font-weight: 900;
            letter-spacing: 4px;
        ">LA NUIT</h2>
        <div class="night-message" style="
            color: #c0c0ff;
            font-size: 1.2em;
            margin-bottom: 25px;
        ">
            🏆 Classement et récompenses
        </div>
        <div style="max-height: 400px; overflow-y: auto;">
            ${playersListHTML}
        </div>
    `;

    document.body.appendChild(nightMessage);
    setTimeout(() => nightMessage.style.transform = 'translate(-50%, -50%) scale(1)', 100);

    // Animer l'apparition des joueurs et l'attribution des récompenses
    setTimeout(() => {
        sortedPlayers.forEach((item, index) => {
            setTimeout(() => {
                // Faire apparaître le joueur
                const playerItem = document.getElementById(`night-player-${index}`);
                if (playerItem) {
                    playerItem.style.opacity = '1';
                    playerItem.style.transform = 'translateX(0) scale(1)';

                    // Après 300ms, afficher la récompense
                    setTimeout(() => {
                        const rewardEl = playerItem.querySelector('.night-reward');
                        if (rewardEl) {
                            rewardEl.style.opacity = '1';
                            rewardEl.style.transform = 'scale(1.2) rotate(0deg)';
                            setTimeout(() => {
                                rewardEl.style.transform = 'scale(1) rotate(0deg)';
                            }, 200);
                        }

                        // Appliquer la récompense au joueur
                        item.player.money += item.reward;
                        displayPlayers();

                        // Message flottant
                        showFloatingMessage(`${item.player.emoji} +${item.reward}€`, 'success');
                    }, 300);
                }
            }, index * 800); // 800ms entre chaque joueur
        });

        // Ajouter message au chat après toutes les récompenses
        const totalDelay = sortedPlayers.length * 800 + 1000;
        setTimeout(() => {
            addChatMessage(`🌙 La nuit est tombée ! Tous les joueurs ont reçu leur récompense !`, 'Système', true, false);

            // Messages des bots
            setTimeout(() => {
                const bots = players.filter(p => p.isBot);
                if (bots.length > 0) {
                    const randomBot = bots[Math.floor(Math.random() * bots.length)];
                    const botReward = sortedPlayers.find(item => item.player.prenom === randomBot.prenom);

                    let message = '';
                    if (botReward && botReward.reward >= 80) {
                        const messages = [
                            `🤑 Super récompense !`,
                            `💰 J'ai eu beaucoup d'argent !`,
                            `🎉 Merci la nuit !`
                        ];
                        message = messages[Math.floor(Math.random() * messages.length)];
                    } else {
                        const messages = [
                            `😴 Bonne nuit tout le monde !`,
                            `🌙 C'était sympa la nuit !`,
                            `💤 J'ai bien dormi !`
                        ];
                        message = messages[Math.floor(Math.random() * messages.length)];
                    }

                    addChatMessage(message, randomBot.prenom, false, true);
                }
            }, 500);
        }, totalDelay);

        // Fermer le dialogue après tout
        setTimeout(() => {
            nightMessage.style.transform = 'translate(-50%, -50%) scale(0)';
            overlay.style.background = 'rgba(0, 0, 0, 0)';
            setTimeout(() => {
                nightMessage.remove();
                overlay.remove();
            }, 500);
        }, totalDelay + 2000);
    }, 1000);
}

// Initialisation
displayPlayers();
updateCurrentTurn();
displayTokens();

// 🆕 Mettre à jour l'interface selon le tour (pour multijoueur)
if (typeof updateTurnUI === 'function') {
    updateTurnUI();
}

// Démarrer l'événement selon le choix du joueur
const eventType = players[0].eventType || 'christmas';
console.log('🎯 Type d\'événement sélectionné:', eventType);
if (eventType === 'christmas') {
    scheduleChristmasEvent();
} else if (eventType === 'night') {
    scheduleNightEvent();
} else if (eventType === 'chicken') {
    scheduleChickenEvent();
} else if (eventType === 'casino') {
    scheduleCasinoEvent();
}

// Désactiver le bouton si le premier joueur est un bot
if (players[currentPlayerIndex].isBot) {
    const diceButton = document.getElementById('btn-roll-dice');
    diceButton.disabled = true;
    diceButton.style.opacity = '0.5';
    diceButton.style.cursor = 'not-allowed';
    setTimeout(() => {
        rollDice();
    }, 1500);
}

// Système de chat
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send');

// Messages d'accueil des bots
const botWelcomeMessages = ['Salut !', 'Je suis chaud ! 🔥', 'Bonne chance ! 🍀'];

// Fonction pour ajouter un message au chat
function addChatMessage(message, author = null, isSystem = false, isBot = false) {
    const messageDiv = document.createElement('div');

    if (isSystem) {
        messageDiv.className = 'chat-message system';
        messageDiv.textContent = message;
    } else {
        const isCurrentUser = author === currentPlayer.prenom;
        messageDiv.className = `chat-message ${isCurrentUser ? 'user' : isBot ? 'bot' : 'other'}`;

        const authorSpan = document.createElement('div');
        authorSpan.className = 'chat-message-author';
        authorSpan.textContent = `${author}:`;

        const textSpan = document.createElement('div');
        textSpan.textContent = message;

        messageDiv.appendChild(authorSpan);
        messageDiv.appendChild(textSpan);
    }

    chatMessages.appendChild(messageDiv);

    // Scroller automatiquement vers le bas
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Envoyer un message
function sendChatMessage() {
    const message = chatInput.value.trim();

    if (message === '') return;

    // Ajouter le message au chat
    addChatMessage(message, currentPlayer.prenom);

    // Réinitialiser l'input
    chatInput.value = '';

    // Simuler une réponse d'un autre joueur (pour la démo)
    // Dans une vraie app multijoueur, ce serait envoyé via WebSocket
}

// Événement: Envoyer avec le bouton
chatSendBtn.addEventListener('click', sendChatMessage);

// Événement: Envoyer avec la touche Entrée
chatInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendChatMessage();
    }
});

// Messages d'accueil des bots au démarrage
function sendBotWelcomeMessages() {
    const bots = players.filter(p => p.isBot);

    bots.forEach((bot, index) => {
        if (index < botWelcomeMessages.length) {
            setTimeout(() => {
                addChatMessage(botWelcomeMessages[index], bot.prenom, false, true);
            }, (index + 1) * 1000); // 1 seconde entre chaque message
        }
    });
}

// Lancer les messages d'accueil après 0.5 seconde
setTimeout(() => {
    sendBotWelcomeMessages();
}, 500);

// ==================== CHAT PRIVÉ ====================
const privateChatOverlay = document.getElementById('private-chat-overlay');
const closePrivateChatBtn = document.getElementById('close-private-chat');
const privateChatInput = document.getElementById('private-chat-input');
const sendPrivateChatBtn = document.getElementById('send-private-chat-btn');
const privateChatMessages = document.getElementById('private-chat-messages');
const privateChatTitle = document.getElementById('private-chat-title');

let currentChatPartner = null; // Le joueur avec qui on discute

// Rendre les joueurs cliquables pour ouvrir un chat privé
function displayPlayers() {
    const playersInfo = document.getElementById('players-info');
    playersInfo.innerHTML = '';

    players.forEach((player, index) => {
        const playerItem = document.createElement('div');
        playerItem.className = 'player-item' + (index === currentPlayerIndex ? ' active' : '');

        playerItem.innerHTML = `
            <div class="player-item-emoji">${player.emoji}</div>
            <div class="player-item-info">
                <div class="player-item-name">${player.prenom}${player.isBot ? ' 🤖' : ''}</div>
                <div class="player-item-money">${player.money}€</div>
            </div>
        `;

        // Ajouter le clic pour ouvrir le chat privé (sauf pour soi-même)
        if (index !== currentPlayerIndex) {
            playerItem.style.cursor = 'pointer';
            playerItem.addEventListener('click', () => {
                openPrivateChat(player);
            });
        }

        playersInfo.appendChild(playerItem);
    });

    // Vérifier les alertes d'argent pour chaque joueur
    players.forEach(player => {
        checkMoneyAlert(player);
    });
}

// Ouvrir le chat privé avec un joueur
function openPrivateChat(player) {
    currentChatPartner = player;
    privateChatTitle.textContent = `💬 Chat avec ${player.emoji} ${player.prenom}`;
    privateChatOverlay.classList.remove('hidden');
    privateChatInput.focus();

    // Charger les messages existants
    loadPrivateChatMessages(player);
}

// Charger les messages du chat privé
function loadPrivateChatMessages(player) {
    privateChatMessages.innerHTML = '<p class="chat-welcome">Élaborez vos stratégies en privé ! 🤝</p>';

    const currentPlayer = players[currentPlayerIndex];
    const gameCode = JSON.parse(localStorage.getItem('currentPlayer'))?.gameCode;

    if (window.firebaseManager && gameCode) {
        // Charger depuis Firebase
        const chatKey = getChatKey(currentPlayer.prenom, player.prenom);
        firebase.database().ref(`games/${gameCode}/privateChats/${chatKey}`).once('value', (snapshot) => {
            const messages = snapshot.val();
            if (messages) {
                Object.values(messages).forEach(msg => {
                    addPrivateChatMessage(msg.from, msg.message, msg.from === currentPlayer.prenom);
                });
            }
        });
    }
}

// Créer une clé unique pour le chat entre deux joueurs
function getChatKey(player1, player2) {
    return [player1, player2].sort().join('_');
}

// Fermer le chat privé
if (closePrivateChatBtn) {
    closePrivateChatBtn.addEventListener('click', () => {
        privateChatOverlay.classList.add('hidden');
        currentChatPartner = null;
    });
}

// Envoyer un message privé
function sendPrivateChatMessage() {
    if (!currentChatPartner) return;

    const message = privateChatInput.value.trim();
    if (message === '') return;

    const currentPlayer = players[currentPlayerIndex];
    addPrivateChatMessage(currentPlayer.prenom, message, true);

    privateChatInput.value = '';

    // Sauvegarder dans Firebase
    const gameCode = JSON.parse(localStorage.getItem('currentPlayer'))?.gameCode;
    if (window.firebaseManager && gameCode) {
        const chatKey = getChatKey(currentPlayer.prenom, currentChatPartner.prenom);
        firebase.database().ref(`games/${gameCode}/privateChats/${chatKey}`).push({
            from: currentPlayer.prenom,
            to: currentChatPartner.prenom,
            message: message,
            timestamp: Date.now()
        });
    }
}

// Ajouter un message au chat privé
function addPrivateChatMessage(from, message, isOwn) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'private-chat-message' + (isOwn ? ' own' : '');

    const authorSpan = document.createElement('strong');
    authorSpan.textContent = from;

    const textSpan = document.createElement('span');
    textSpan.textContent = message;

    messageDiv.appendChild(authorSpan);
    messageDiv.appendChild(document.createElement('br'));
    messageDiv.appendChild(textSpan);

    privateChatMessages.appendChild(messageDiv);

    // Scroll automatique
    privateChatMessages.scrollTop = privateChatMessages.scrollHeight;
}

// Bouton envoyer
if (sendPrivateChatBtn) {
    sendPrivateChatBtn.addEventListener('click', sendPrivateChatMessage);
}

// Touche Entrée pour envoyer
if (privateChatInput) {
    privateChatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendPrivateChatMessage();
        }
    });
}

// Écouter les nouveaux messages privés en temps réel
const gameCodeForChat = JSON.parse(localStorage.getItem('currentPlayer'))?.gameCode;
if (window.firebaseManager && gameCodeForChat) {
    const currentPlayer = players[currentPlayerIndex];

    // Écouter tous les chats où on est impliqué
    players.forEach(player => {
        if (player.prenom !== currentPlayer.prenom) {
            const chatKey = getChatKey(currentPlayer.prenom, player.prenom);
            firebase.database().ref(`games/${gameCodeForChat}/privateChats/${chatKey}`).on('child_added', (snapshot) => {
                const msg = snapshot.val();

                // Si on est dans le chat avec ce joueur, afficher le message
                if (currentChatPartner && currentChatPartner.prenom === player.prenom && msg.from !== currentPlayer.prenom) {
                    addPrivateChatMessage(msg.from, msg.message, false);
                }
            });
        }
    });
}
