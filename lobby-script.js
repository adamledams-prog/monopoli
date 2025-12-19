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

// Fonction pour générer un code à 3 chiffres
function generateGameCode3Digits() {
    return Math.floor(100 + Math.random() * 900).toString();
}

// Initialiser ou récupérer le code de partie
let gameCode = currentPlayer.gameCode;

// Si c'est l'hôte et le code n'est pas un code à 3 chiffres, en générer un nouveau
if (currentPlayer.isHost && gameCode.length !== 3) {
    gameCode = generateGameCode3Digits();
    currentPlayer.gameCode = gameCode;
    localStorage.setItem('currentPlayer', JSON.stringify(currentPlayer));
}

// Afficher le code de partie
document.getElementById('game-code').textContent = gameCode;

// Liste des joueurs (simulée pour l'instant)
let players = [currentPlayer];

// Noms aléatoires pour les bots
const botNames = ['RoboMax', 'CyberBot', 'MegaTron', 'NanoBot', 'TechBot', 'PixelBot', 'ByteBot'];
const botEmojis = ['🤖', '👾', '💀', '👻', '👽', '🤡', '🤓', '🤠', '😈', '👹'];
let usedBotNames = [];
let usedBotEmojis = [];

// Charger les bots depuis le localStorage
let savedBots = JSON.parse(localStorage.getItem('gameBots')) || [];

// Ajouter les bots à la liste des joueurs
savedBots.forEach(bot => {
    players.push({
        prenom: bot.name,
        emoji: bot.emoji || '🤖',
        gameCode: gameCode,
        isHost: false,
        isBot: true
    });
    usedBotNames.push(bot.name);
    usedBotEmojis.push(bot.emoji || '🤖');
});

// Fonction pour afficher les joueurs
function displayPlayers() {
    const playersList = document.getElementById('players-list');
    playersList.innerHTML = '';
    
    players.forEach((player, index) => {
        const playerCard = document.createElement('div');
        playerCard.className = 'player-card' + (player.isHost ? ' host' : '');
        
        playerCard.innerHTML = `
            <div class="player-emoji">${player.emoji}</div>
            <div class="player-info">
                <div class="player-name">${player.prenom}</div>
                ${player.isHost ? '<span class="player-badge">👑 Hôte</span>' : ''}
                ${player.isBot ? '<span class="player-badge bot-badge">🤖 Bot</span>' : ''}
            </div>
            ${player.isBot && currentPlayer.isHost ? '<button class="delete-bot-btn" data-index="' + index + '">🗑️</button>' : ''}
        `;
        
        playersList.appendChild(playerCard);
    });
    
    // Ajouter les gestionnaires d'événements pour les boutons de suppression
    if (currentPlayer.isHost) {
        document.querySelectorAll('.delete-bot-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const botIndex = parseInt(this.getAttribute('data-index'));
                const bot = players[botIndex];
                
                if (confirm(`Voulez-vous vraiment supprimer ${bot.emoji} ${bot.prenom} ?`)) {
                    // Retirer le bot de la liste
                    players.splice(botIndex, 1);
                    
                    // Retirer des listes d'utilisation
                    usedBotNames = usedBotNames.filter(name => name !== bot.prenom);
                    usedBotEmojis = usedBotEmojis.filter(emoji => emoji !== bot.emoji);
                    
                    // Mettre à jour localStorage
                    const botsToSave = players.filter(p => p.isBot).map(p => ({
                        name: p.prenom,
                        emoji: p.emoji
                    }));
                    localStorage.setItem('gameBots', JSON.stringify(botsToSave));
                    
                    displayPlayers();
                    showMessage(`✅ ${bot.emoji} ${bot.prenom} supprimé !`, 'success');
                }
            });
        });
    }
}

// Afficher les joueurs initiaux
displayPlayers();

// Afficher les boutons uniquement pour l'hôte
if (currentPlayer.isHost) {
    document.getElementById('btn-start').style.display = 'block';
    document.getElementById('btn-add-bot').style.display = 'block';
    document.querySelector('.money-selector-section').style.display = 'block';
}

// Gestion de la sélection d'argent
let selectedMoney = currentPlayer.startingMoney || 1500;

document.querySelectorAll('.money-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        // Retirer la sélection précédente
        document.querySelectorAll('.money-btn').forEach(b => b.classList.remove('active'));
        
        // Ajouter la sélection au bouton cliqué
        this.classList.add('active');
        
        // Mettre à jour l'argent sélectionné
        selectedMoney = parseInt(this.getAttribute('data-money'));
        
        // Mettre à jour dans localStorage
        currentPlayer.startingMoney = selectedMoney;
        localStorage.setItem('currentPlayer', JSON.stringify(currentPlayer));
    });
});

// Fonction pour obtenir un nom de bot aléatoire non utilisé
function getRandomBotName() {
    const availableNames = botNames.filter(name => !usedBotNames.includes(name));
    if (availableNames.length === 0) {
        return 'Bot' + Math.floor(Math.random() * 1000);
    }
    return availableNames[Math.floor(Math.random() * availableNames.length)];
}

// Fonction pour obtenir un emoji de bot aléatoire non utilisé
function getRandomBotEmoji() {
    const availableEmojis = botEmojis.filter(emoji => !usedBotEmojis.includes(emoji));
    if (availableEmojis.length === 0) {
        // Si tous les emojis sont utilisés, réinitialiser et en choisir un
        usedBotEmojis = [];
        return botEmojis[Math.floor(Math.random() * botEmojis.length)];
    }
    return availableEmojis[Math.floor(Math.random() * availableEmojis.length)];
}

// Bouton Ajouter un bot
document.getElementById('btn-add-bot').addEventListener('click', function() {
    if (players.length >= 10) {
        showMessage('⚠️ Maximum 10 joueurs (joueurs + bots)', 'error');
        return;
    }
    
    const botName = getRandomBotName();
    const botEmoji = getRandomBotEmoji();
    usedBotNames.push(botName);
    usedBotEmojis.push(botEmoji);
    
    const newBot = {
        prenom: botName,
        emoji: botEmoji,
        gameCode: gameCode,
        isHost: false,
        isBot: true
    };
    
    players.push(newBot);
    
    // Sauvegarder dans localStorage
    const botsToSave = players.filter(p => p.isBot).map(p => ({
        name: p.prenom,
        emoji: p.emoji
    }));
    localStorage.setItem('gameBots', JSON.stringify(botsToSave));
    
    displayPlayers();
    showMessage(`✅ ${newBot.emoji} ${newBot.prenom} ajouté !`, 'success');
});



// Fonction pour afficher un message
function showMessage(text, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = text;
    messageDiv.className = 'message ' + type;
    messageDiv.style.display = 'block';
    
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
}

// Bouton Lancer la partie
document.getElementById('btn-start').addEventListener('click', function() {
    if (!currentPlayer.isHost) {
        showMessage('⚠️ Seul l\'hôte peut lancer la partie', 'error');
        return;
    }
    
    if (players.length < 1) {
        showMessage('⚠️ Il faut au moins 1 joueur pour commencer', 'error');
        return;
    }
    
    showMessage('🚀 Lancement de la partie...', 'success');
    
    // Sauvegarder les joueurs (y compris les bots) dans le localStorage
    localStorage.setItem('gamePlayers', JSON.stringify(players));
    
    // Rediriger vers le jeu
    setTimeout(() => {
        window.location.href = 'map.html';
    }, 2000);
});

// Bouton Quitter
document.getElementById('btn-leave').addEventListener('click', function() {
    if (confirm('Êtes-vous sûr de vouloir quitter la partie ?')) {
        localStorage.removeItem('currentPlayer');
        window.location.href = 'index.html';
    }
});

// Simulation : ajouter des joueurs aléatoires après quelques secondes (pour tester)
// Vous pouvez commenter cette partie en production
setTimeout(() => {
    const randomEmojis = ['😎', '🤩', '🥳', '🤖'];
    const randomNames = ['Alice', 'Bob', 'Charlie', 'Diana'];
    
    // Décommenter pour tester avec des joueurs simulés
    // const randomPlayer = {
    //     prenom: randomNames[Math.floor(Math.random() * randomNames.length)],
    //     emoji: randomEmojis[Math.floor(Math.random() * randomEmojis.length)],
    //     isHost: false
    // };
    // players.push(randomPlayer);
    // displayPlayers();
    // showMessage(`${randomPlayer.emoji} ${randomPlayer.prenom} a rejoint la partie`, 'info');
}, 3000);
