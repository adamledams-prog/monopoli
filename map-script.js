// Récupérer les informations du joueur
let currentPlayer = JSON.parse(localStorage.getItem('currentPlayer'));

// Si pas de joueur connecté, retour à l'accueil
if (!currentPlayer) {
    window.location.href = 'index.html';
}

// Afficher le code de partie
document.getElementById('game-code').textContent = currentPlayer.gameCode;

// Initialiser les joueurs (simulation)
let players = [
    {
        prenom: currentPlayer.prenom,
        emoji: currentPlayer.emoji,
        money: 1500,
        position: 0,
        isActive: true
    }
];

// Ajouter des joueurs de test
const testPlayers = [
    { prenom: 'Alice', emoji: '😎', money: 1500, position: 0, isActive: false },
    { prenom: 'Bob', emoji: '🤖', money: 1500, position: 0, isActive: false }
];

// Décommenter pour ajouter des joueurs de test
// players.push(...testPlayers);

let currentPlayerIndex = 0;
let diceRolling = false;

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
                <div class="player-item-name">${player.prenom}</div>
                <div class="player-item-money">${player.money}€</div>
            </div>
        `;
        
        playersInfo.appendChild(playerItem);
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
    
    players.forEach((player, index) => {
        const cell = document.querySelector(`[data-position="${player.position}"]`);
        if (cell) {
            const token = document.createElement('div');
            token.className = 'player-token';
            token.textContent = player.emoji;
            token.style.left = `${(index % 2) * 30}px`;
            token.style.top = `${Math.floor(index / 2) * 30}px`;
            cell.appendChild(token);
        }
    });
}

// Lancer les dés
function rollDice() {
    if (diceRolling) return;
    
    diceRolling = true;
    const btn = document.getElementById('btn-roll-dice');
    btn.disabled = true;
    
    const diceResult = document.getElementById('dice-result');
    let rolls = 0;
    const maxRolls = 10;
    
    // Animation du lancer de dés
    const diceEmojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    const interval = setInterval(() => {
        const dice1 = Math.floor(Math.random() * 6) + 1;
        const dice2 = Math.floor(Math.random() * 6) + 1;
        diceResult.innerHTML = `<span style="display: inline-block; animation: spin 0.1s linear;">${diceEmojis[dice1-1]}</span> + <span style="display: inline-block; animation: spin 0.1s linear;">${diceEmojis[dice2-1]}</span>`;
        
        rolls++;
        
        if (rolls >= maxRolls) {
            clearInterval(interval);
            const finalDice1 = Math.floor(Math.random() * 6) + 1;
            const finalDice2 = Math.floor(Math.random() * 6) + 1;
            const total = finalDice1 + finalDice2;
            
            diceResult.innerHTML = `<div style="font-size: 1.5em; margin-bottom: 10px;">${diceEmojis[finalDice1-1]} + ${diceEmojis[finalDice2-1]}</div><div style="font-size: 1.2em; color: #667eea; font-weight: bold;">= ${total}</div>`;
            
            // Déplacer le joueur
            movePlayer(currentPlayerIndex, total);
            
            // Passer au joueur suivant après un délai
            setTimeout(() => {
                nextPlayer();
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
    
    // Si on passe par la case départ
    if (newPosition >= 40) {
        player.money += 200;
        showFloatingMessage('+200€', 'success');
        console.log(`${player.prenom} passe par la case DÉPART et reçoit 200€`);
        newPosition = newPosition % 40;
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
        tempPlayers.forEach((p, index) => {
            const cell = document.querySelector(`[data-position="${p.position}"]`);
            if (cell) {
                const token = document.createElement('div');
                token.className = 'player-token';
                token.textContent = p.emoji;
                token.style.left = `${(index % 2) * 30}px`;
                token.style.top = `${Math.floor(index / 2) * 30}px`;
                cell.appendChild(token);
            }
        });
        
        if (currentStep === steps) {
            clearInterval(moveInterval);
            player.position = newPosition;
            displayTokens();
            displayPlayers();
            checkLanding(playerIndex);
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
        showNotification(`${player.emoji} ${player.prenom} est sur la case DÉPART!`, 'info');
        player.money += 200;
        showFloatingMessage('+200€ BONUS DÉPART', 'success');
    } else if (position === 10) {
        showNotification(`${player.emoji} ${player.prenom} visite la prison`, 'info');
    } else if (position === 20) {
        showNotification(`${player.emoji} ${player.prenom} profite du parc gratuit!`, 'success');
        const bonus = Math.floor(Math.random() * 100) + 50;
        player.money += bonus;
        showFloatingMessage(`+${bonus}€ BONUS PARC`, 'success');
    } else if (position === 30) {
        showNotification(`${player.emoji} ${player.prenom} va en prison!`, 'error');
        showFloatingMessage('🚔 EN PRISON!', 'error');
        setTimeout(() => {
            player.position = 10;
            displayTokens();
        }, 1000);
    } else if ([4, 38].includes(position)) {
        // Cases d'impôts
        const taxAmount = parseInt(cell.getAttribute('data-tax') || 0);
        player.money -= taxAmount;
        showNotification(`${player.emoji} ${player.prenom} paie ${taxAmount}€ d'impôts!`, 'error');
        showFloatingMessage(`-${taxAmount}€ IMPÔTS`, 'error');
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
            showNotification(`${player.emoji} Vous êtes sur votre propriété`, 'info');
        } else {
            const rent = Math.floor(price * 0.1);
            player.money -= rent;
            showNotification(`${player.emoji} Vous payez ${rent}€ de loyer à ${owner}`, 'error');
            showFloatingMessage(`-${rent}€ LOYER`, 'error');
        }
        return;
    }
    
    // Proposer l'achat
    showPropertyPurchaseDialog(playerIndex, position, cell, propertyName, price);
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
    });
    
    // Bouton Passer
    dialog.querySelector('#btn-pass').addEventListener('click', () => {
        showNotification(`${player.emoji} ${player.prenom} n'achète pas ${propertyName}`, 'info');
        dialog.remove();
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
    { text: "Vous êtes libéré de prison gratuitement", amount: 0, type: 'info', special: 'free-jail' },
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
    { text: "Vous êtes libéré de prison gratuitement", amount: 0, type: 'info', special: 'free-jail' },
    { text: "Allez en prison directement", amount: 0, type: 'error', special: 'go-jail' },
    { text: "Rendez-vous Rue de la Paix", amount: 0, type: 'info', special: 'go-39' },
    { text: "Votre prêt de construction échoit, recevez 150€", amount: 150, type: 'success' }
];

// Tirer une carte Caisse de Communauté
function drawCommunityCard(playerIndex) {
    const player = players[playerIndex];
    const card = communityCards[Math.floor(Math.random() * communityCards.length)];
    
    showCardDialog(playerIndex, card, '📦 Caisse de Communauté');
}

// Tirer une carte Chance
function drawChanceCard(playerIndex) {
    const player = players[playerIndex];
    const card = chanceCards[Math.floor(Math.random() * chanceCards.length)];
    
    showCardDialog(playerIndex, card, '🎲 Chance');
}

// Afficher la carte tirée
function showCardDialog(playerIndex, card, title) {
    const player = players[playerIndex];
    
    const dialog = document.createElement('div');
    dialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) scale(0.8);
        background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
        padding: 40px;
        border-radius: 25px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        z-index: 3000;
        text-align: center;
        border: 3px solid ${card.type === 'success' ? 'rgba(17, 153, 142, 0.5)' : card.type === 'error' ? 'rgba(238, 9, 121, 0.5)' : 'rgba(102, 126, 234, 0.5)'};
        min-width: 450px;
        animation: cardAppear 0.3s ease-out forwards;
    `;
    
    dialog.innerHTML = `
        <h2 style="color: ${card.type === 'success' ? '#11998e' : card.type === 'error' ? '#ee0979' : '#667eea'}; margin-bottom: 30px; font-size: 2.2em;">${title}</h2>
        <div style="
            background: ${card.type === 'success' ? 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' : card.type === 'error' ? 'linear-gradient(135deg, #ee0979 0%, #ff6a00 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};
            color: white;
            padding: 30px;
            border-radius: 15px;
            margin-bottom: 30px;
            font-size: 1.3em;
            font-weight: 600;
            line-height: 1.5;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
        ">${card.text}</div>
        <button id="btn-card-ok" style="
            padding: 15px 40px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 1.3em;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.3);
        ">OK</button>
    `;
    
    document.body.appendChild(dialog);
    
    // Appliquer l'effet de la carte
    dialog.querySelector('#btn-card-ok').addEventListener('click', () => {
        dialog.remove();
        applyCardEffect(playerIndex, card);
    });
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
    
    if (card.special) {
        switch (card.special) {
            case 'go-jail':
                setTimeout(() => {
                    player.position = 10;
                    displayTokens();
                    showNotification(`${player.emoji} Allez en prison!`, 'error');
                }, 500);
                break;
            case 'go-start':
                setTimeout(() => {
                    player.position = 0;
                    player.money += 200;
                    displayTokens();
                    showFloatingMessage('+200€ DÉPART', 'success');
                }, 500);
                break;
            case 'back-3':
                setTimeout(() => {
                    player.position = Math.max(0, player.position - 3);
                    displayTokens();
                    checkLanding(playerIndex);
                }, 500);
                break;
            case 'go-39':
                setTimeout(() => {
                    player.position = 39;
                    displayTokens();
                    checkLanding(playerIndex);
                }, 500);
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
                break;
        }
    }
    
    displayPlayers();
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

// Passer au joueur suivant
function nextPlayer() {
    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    displayPlayers();
    updateCurrentTurn();
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
    
    dialog.innerHTML = `
        <h2 style="color: #11998e; margin-bottom: 20px; font-size: 2em;">🏠 ${propertyName}</h2>
        <p style="color: #555; font-size: 1.3em; margin-bottom: 15px; font-weight: 600;">Cette propriété est à vous!</p>
        <p style="color: #666; margin-bottom: 15px; font-size: 1.1em;">Prix d'achat: ${price}€</p>
        <p style="color: #11998e; margin-bottom: 30px; font-size: 1.2em; font-weight: 600;">Prix de vente: ${sellPrice}€</p>
        <div style="display: flex; gap: 15px; justify-content: center;">
            <button id="btn-sell-property" style="
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
    `;
    
    document.body.appendChild(dialog);
    
    // Bouton Vendre
    dialog.querySelector('#btn-sell-property').addEventListener('click', () => {
        player.money += sellPrice;
        cell.removeAttribute('data-owner');
        cell.style.borderColor = '';
        cell.style.borderWidth = '';
        
        // Retirer l'emoji du propriétaire
        const ownerBadge = cell.querySelector('div[style*="position: absolute"]');
        if (ownerBadge) ownerBadge.remove();
        
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
