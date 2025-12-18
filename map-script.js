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
    jailFreeCards: 0 // Nombre de cartes "Sortie de prison" possédées
}));

let currentPlayerIndex = 0;
let diceRolling = false;

// Seuils d'alerte pour l'argent
const moneyAlertThresholds = [1200, 1000, 700, 500, 200];

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
        
        playersInfo.appendChild(playerItem);
    });
    
    // Vérifier les alertes d'argent pour chaque joueur
    players.forEach(player => {
        checkMoneyAlert(player);
    });
}

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

// Lancer les dés
function rollDice() {
    if (diceRolling) return;
    
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
            
            // Déplacer le joueur
            movePlayer(currentPlayerIndex, total);
            
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
        const jailTurns = players.length <= 3 ? 1 : 2;
        player.inJail = true;
        player.jailTurns = jailTurns;
        
        showNotification(`${player.emoji} ${player.prenom} va en prison pour ${jailTurns} tour(s)!`, 'error');
        showFloatingMessage(`🚔 EN PRISON ${jailTurns} TOUR(S)!`, 'error');
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
            background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
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
                background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                margin-bottom: 20px;
                font-size: 2.5em;
                text-shadow: 0 0 20px rgba(17, 153, 142, 0.4);
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
            background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
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
            <h2 style="color: ${card.type === 'success' ? '#11998e' : card.type === 'error' ? '#ee0979' : '#667eea'}; margin-bottom: 25px; font-size: 2.5em; text-shadow: 2px 2px 4px rgba(0,0,0,0.1);">${title}</h2>
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
                    player.jailTurns = players.length <= 3 ? 1 : 2;
                    displayTokens();
                    showNotification(`${player.emoji} ${player.prenom} va en prison pour ${player.jailTurns} tour(s)!`, 'error');
                    
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
        // Réactiver le bouton pour les joueurs humains
        diceButton.disabled = false;
        diceButton.style.opacity = '1';
        diceButton.style.cursor = 'pointer';
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

// Initialisation
displayPlayers();
updateCurrentTurn();
displayTokens();

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
