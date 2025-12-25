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

// Liste des joueurs (sera synchronisée avec Firebase)
let players = [];

// Variable pour savoir si on utilise Firebase
let isUsingFirebase = false;

// Noms aléatoires pour les bots
const botNames = ['RoboMax', 'CyberBot', 'MegaTron', 'NanoBot', 'TechBot', 'PixelBot', 'ByteBot'];
const botEmojis = ['🤖', '👾', '💀', '👻', '👽', '🤡', '🤓', '🤠', '😈', '👹'];
let usedBotNames = [];
let usedBotEmojis = [];

// Fonction pour démarrer la synchronisation temps réel avec Firebase
function startRealtimeSync() {
    isUsingFirebase = true;

    // Écouter les changements de joueurs en temps réel
    window.firebaseManager.listenToPlayers(gameCode, (firebasePlayers) => {
        players = firebasePlayers;
        displayPlayers();
        console.log('👥 Joueurs synchronisés:', firebasePlayers.length);

        // Afficher le bouton de démarrage seulement pour l'hôte
        const currentPlayerId = localStorage.getItem('currentPlayerId');
        const isHost = firebasePlayers.some(p => p.id === currentPlayerId && p.isHost);

        if (isHost) {
            document.getElementById('btn-add-bot').style.display = 'block';
            document.querySelector('.money-selector-section').style.display = 'block';
            document.querySelector('.event-selector-section').style.display = 'block';
            document.getElementById('btn-start').style.display = 'block';
        }
    });

    console.log('🔄 Synchronisation temps réel activée');
}

// Initialiser Firebase après que gameCode soit défini
(async function initFirebase() {
    try {
        if (window.firebaseManager) {
            await window.firebaseManager.init();
            console.log('✅ Firebase prêt pour le lobby');

            // Démarrer l'écoute des joueurs en temps réel
            if (window.firebaseManager.isAvailable() && gameCode) {
                startRealtimeSync();
                console.log('🔄 Synchronisation démarrée pour le code:', gameCode);
            }
        }
    } catch (error) {
        console.warn('⚠️ Firebase non disponible, mode local activé:', error.message);
    }
})();

// Mode local: charger depuis localStorage si Firebase n'est pas disponible
if (!window.firebaseManager || !window.firebaseManager.isAvailable()) {
    // Mode local
    players = [currentPlayer];

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
}

// Fonction pour afficher les joueurs
function displayPlayers() {
    const playersList = document.getElementById('players-list');
    playersList.innerHTML = '';

    players.forEach((player, index) => {
        const playerCard = document.createElement('div');
        playerCard.className = 'player-card' + (player.isHost ? ' host' : '');
        
        // Ajouter un attribut pour identifier si c'est un bot ou non
        if (!player.isBot) {
            playerCard.style.cursor = 'pointer';
            playerCard.setAttribute('data-player-index', index);
        }

        playerCard.innerHTML = `
            <div class="player-emoji">${player.emoji}</div>
            <div class="player-info">
                <div class="player-name">${player.prenom}</div>
                ${player.isHost ? '<span class="player-badge">👑 Hôte</span>' : ''}
                ${player.isBot ? '<span class="player-badge bot-badge">🤖 Bot</span>' : ''}
            </div>
            ${player.isBot && currentPlayer.isHost ? '<button class="delete-bot-btn" data-index="' + index + '">🗑️</button>' : ''}
        `;

        // Ajouter l'événement de clic pour ouvrir le chat (sauf pour les bots)
        if (!player.isBot) {
            playerCard.addEventListener('click', function(e) {
                // Ne pas ouvrir le chat si on clique sur le bouton de suppression
                if (e.target.classList.contains('delete-bot-btn')) return;
                openChatWithPlayer(player, index);
            });
        }

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
    document.querySelector('.event-selector-section').style.display = 'block';
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

// Gestion de la sélection d'événement
let selectedEvent = currentPlayer.eventType || 'none';

document.querySelectorAll('.event-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        // Retirer la sélection précédente
        document.querySelectorAll('.event-btn').forEach(b => b.classList.remove('active'));
        
        // Ajouter la sélection au bouton cliqué
        this.classList.add('active');
        
        // Mettre à jour l'événement sélectionné
        selectedEvent = this.getAttribute('data-event');
        
        console.log('✅ Événement sélectionné:', selectedEvent);
        
        // Mettre à jour dans localStorage
        currentPlayer.eventType = selectedEvent;
        localStorage.setItem('currentPlayer', JSON.stringify(currentPlayer));
        
        console.log('💾 Sauvegardé dans localStorage:', currentPlayer);
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
document.getElementById('btn-add-bot').addEventListener('click', async function() {
    if (players.length >= 10) {
        showMessage('⚠️ Maximum 10 joueurs (joueurs + bots)', 'error');
        return;
    }

    const botName = getRandomBotName();
    const botEmoji = getRandomBotEmoji();
    usedBotNames.push(botName);
    usedBotEmojis.push(botEmoji);

    const newBot = {
        name: botName,
        emoji: botEmoji,
        difficulty: 'normal'
    };

    try {
        // Utiliser Firebase si disponible
        if (isUsingFirebase && window.firebaseManager) {
            await window.firebaseManager.addBot(gameCode, newBot);
            showMessage(`✅ ${newBot.emoji} ${newBot.name} ajouté !`, 'success');
        } else {
            // Mode local
            players.push({
                prenom: newBot.name,
                emoji: newBot.emoji,
                gameCode: gameCode,
                isHost: false,
                isBot: true
            });

            // Sauvegarder dans localStorage
            const botsToSave = players.filter(p => p.isBot).map(p => ({
                name: p.prenom,
                emoji: p.emoji
            }));
            localStorage.setItem('gameBots', JSON.stringify(botsToSave));

            displayPlayers();
            showMessage(`✅ ${newBot.emoji} ${newBot.name} ajouté !`, 'success');
        }
    } catch (error) {
        console.error('Erreur ajout bot:', error);
        showMessage(`❌ Erreur: ${error.message}`, 'error');
    }
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
document.getElementById('btn-start').addEventListener('click', async function() {
    if (!currentPlayer.isHost) {
        showMessage('⚠️ Seul l\'hôte peut lancer la partie', 'error');
        return;
    }

    if (players.length < 1) {
        showMessage('⚠️ Il faut au moins 1 joueur pour commencer', 'error');
        return;
    }

    // Désactiver le bouton pendant le traitement
    this.disabled = true;
    this.textContent = '⏳ Démarrage...';

    try {
        showMessage('🚀 Lancement de la partie...', 'success');

        // Toujours sauvegarder dans localStorage pour que map.html puisse charger les joueurs
        localStorage.setItem('gamePlayers', JSON.stringify(players));
        console.log('💾 Joueurs sauvegardés:', players);

        // Utiliser Firebase si disponible
        if (isUsingFirebase && window.firebaseManager) {
            await window.firebaseManager.startGame(gameCode);
        }

        // Rediriger vers le jeu
        setTimeout(() => {
            window.location.href = 'map.html';
        }, 1500);
    } catch (error) {
        console.error('Erreur démarrage partie:', error);
        showMessage(`❌ Erreur: ${error.message}`, 'error');
        this.disabled = false;
        this.textContent = '🚀 Lancer la partie';
    }
});

// Bouton Quitter
document.getElementById('btn-leave').addEventListener('click', async function() {
    if (confirm('Êtes-vous sûr de vouloir quitter la partie ?')) {
        // Si Firebase est utilisé, signaler la déconnexion
        if (isUsingFirebase && window.firebaseManager) {
            const playerId = localStorage.getItem('currentPlayerId');
            if (playerId) {
                await window.firebaseManager.leaveGame(gameCode, playerId);
            }
            window.firebaseManager.cleanup();
        }

        localStorage.removeItem('currentPlayer');
        localStorage.removeItem('currentPlayerId');
        localStorage.removeItem('currentGameCode');
        window.location.href = 'index.html';
    }
});

// === JEU DE MORPION ===
let tttBoard = ['', '', '', '', '', '', '', '', ''];
let tttCurrentPlayer = 'X'; // X = joueur (rouge), O = IA (bleu)
let tttGameActive = true;
let tttPlayerScore = 0;
let tttAiScore = 0;
let tttDifficulty = 'easy'; // Niveau de difficulté (pas encore implémenté)

const tttCells = document.querySelectorAll('.ttt-cell');
const tttStatus = document.getElementById('ttt-status');
const tttResetBtn = document.getElementById('ttt-reset');
const playerScoreEl = document.getElementById('player-score');
const aiScoreEl = document.getElementById('ai-score');
const diffBtns = document.querySelectorAll('.diff-btn');

// Gestion des boutons de difficulté
diffBtns.forEach(btn => {
    btn.addEventListener('click', function() {
        diffBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        tttDifficulty = this.getAttribute('data-diff');
        console.log('Difficulté sélectionnée:', tttDifficulty, '(pas encore implémenté)');
    });
});

const winningConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // lignes
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // colonnes
    [0, 4, 8], [2, 4, 6]              // diagonales
];

function handleCellClick(e) {
    const clickedCell = e.target;
    const clickedCellIndex = parseInt(clickedCell.getAttribute('data-index'));

    if (tttBoard[clickedCellIndex] !== '' || !tttGameActive || tttCurrentPlayer !== 'X') {
        return;
    }

    tttBoard[clickedCellIndex] = 'X';
    clickedCell.textContent = 'X';
    clickedCell.classList.add('taken', 'player');

    if (checkWin('X')) {
        tttStatus.textContent = '🎉 Vous avez gagné !';
        tttStatus.style.color = '#06ffa5';
        tttGameActive = false;
        tttPlayerScore++;
        playerScoreEl.textContent = tttPlayerScore;
        highlightWinner('X');
        return;
    }

    if (checkDraw()) {
        tttStatus.textContent = '🤝 Match nul !';
        tttStatus.style.color = '#667eea';
        tttGameActive = false;
        return;
    }

    tttCurrentPlayer = 'O';
    tttStatus.textContent = 'Tour de l\'IA (Bleu)...';
    tttStatus.style.color = '#667eea';

    // L'IA joue après un court délai
    setTimeout(aiMove, 500);
}

function aiMove() {
    if (!tttGameActive) return;

    // Stratégie de l'IA: 1) Gagner, 2) Bloquer, 3) Centre, 4) Coin, 5) Aléatoire
    let move = findBestMove();

    if (move !== -1) {
        tttBoard[move] = 'O';
        const cell = document.querySelector(`.ttt-cell[data-index="${move}"]`);
        cell.textContent = 'O';
        cell.classList.add('taken', 'ai');

        if (checkWin('O')) {
            tttStatus.textContent = '😞 L\'IA a gagné !';
            tttStatus.style.color = '#e63946';
            tttGameActive = false;
            tttAiScore++;
            aiScoreEl.textContent = tttAiScore;
            highlightWinner('O');
            return;
        }

        if (checkDraw()) {
            tttStatus.textContent = '🤝 Match nul !';
            tttStatus.style.color = '#667eea';
            tttGameActive = false;
            return;
        }

        tttCurrentPlayer = 'X';
        tttStatus.textContent = 'Votre tour (Rouge)';
        tttStatus.style.color = '#e63946';
    }
}

function findBestMove() {
    // Stratégie selon la difficulté
    if (tttDifficulty === 'easy') {
        // FACILE : 60% gagner, 40% bloquer, 0% stratégie
        
        // 1. Essayer de gagner (60% de chance)
        if (Math.random() < 0.60) {
            for (let i = 0; i < 9; i++) {
                if (tttBoard[i] === '') {
                    tttBoard[i] = 'O';
                    if (checkWin('O')) {
                        tttBoard[i] = '';
                        return i;
                    }
                    tttBoard[i] = '';
                }
            }
        }

        // 2. Bloquer le joueur (40% de chance)
        if (Math.random() < 0.40) {
            for (let i = 0; i < 9; i++) {
                if (tttBoard[i] === '') {
                    tttBoard[i] = 'X';
                    if (checkWin('X')) {
                        tttBoard[i] = '';
                        return i;
                    }
                    tttBoard[i] = '';
                }
            }
        }

        // 3. Jouer aléatoirement
        const availableCells = tttBoard.map((cell, index) => cell === '' ? index : null).filter(i => i !== null);
        if (availableCells.length > 0) {
            return availableCells[Math.floor(Math.random() * availableCells.length)];
        }
        
    } else if (tttDifficulty === 'medium') {
        // MOYEN : 80% gagner, 70% bloquer, 50% centre
        
        // 1. Essayer de gagner (80% de chance)
        if (Math.random() < 0.80) {
            for (let i = 0; i < 9; i++) {
                if (tttBoard[i] === '') {
                    tttBoard[i] = 'O';
                    if (checkWin('O')) {
                        tttBoard[i] = '';
                        return i;
                    }
                    tttBoard[i] = '';
                }
            }
        }

        // 2. Bloquer le joueur (70% de chance)
        if (Math.random() < 0.70) {
            for (let i = 0; i < 9; i++) {
                if (tttBoard[i] === '') {
                    tttBoard[i] = 'X';
                    if (checkWin('X')) {
                        tttBoard[i] = '';
                        return i;
                    }
                    tttBoard[i] = '';
                }
            }
        }

        // 3. Prendre le centre (50% de chance)
        if (Math.random() < 0.50 && tttBoard[4] === '') {
            return 4;
        }

        // 4. Jouer aléatoirement
        const availableCells = tttBoard.map((cell, index) => cell === '' ? index : null).filter(i => i !== null);
        if (availableCells.length > 0) {
            return availableCells[Math.floor(Math.random() * availableCells.length)];
        }
        
    } else {
        // DIFFICILE : 100% gagner et bloquer, pas de stratégie centre/coins
        
        // 1. Essayer de gagner
        for (let i = 0; i < 9; i++) {
            if (tttBoard[i] === '') {
                tttBoard[i] = 'O';
                if (checkWin('O')) {
                    tttBoard[i] = '';
                    return i;
                }
                tttBoard[i] = '';
            }
        }

        // 2. Bloquer le joueur
        for (let i = 0; i < 9; i++) {
            if (tttBoard[i] === '') {
                tttBoard[i] = 'X';
                if (checkWin('X')) {
                    tttBoard[i] = '';
                    return i;
                }
                tttBoard[i] = '';
            }
        }

        // 3. Jouer aléatoirement
        const availableCells = tttBoard.map((cell, index) => cell === '' ? index : null).filter(i => i !== null);
        if (availableCells.length > 0) {
            return availableCells[Math.floor(Math.random() * availableCells.length)];
        }
    }

    return -1;
}

function checkWin(player) {
    return winningConditions.some(condition => {
        return condition.every(index => tttBoard[index] === player);
    });
}

function checkDraw() {
    return tttBoard.every(cell => cell !== '');
}

function highlightWinner(player) {
    winningConditions.forEach(condition => {
        if (condition.every(index => tttBoard[index] === player)) {
            condition.forEach(index => {
                document.querySelector(`.ttt-cell[data-index="${index}"]`).classList.add('winner');
            });
        }
    });
}

function resetGame() {
    tttBoard = ['', '', '', '', '', '', '', '', ''];
    tttCurrentPlayer = 'X';
    tttGameActive = true;
    tttStatus.textContent = 'Votre tour (Rouge)';
    tttStatus.style.color = '#e63946';

    tttCells.forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('taken', 'player', 'ai', 'winner');
    });
}

// Event listeners pour le morpion
tttCells.forEach(cell => cell.addEventListener('click', handleCellClick));
tttResetBtn.addEventListener('click', resetGame);

// === CHAT PRIVÉ ===
let chatMessages = {}; // Stocker les messages par joueur

function openChatWithPlayer(player, playerIndex) {
    // Ne pas ouvrir le chat avec soi-même
    if (player.prenom === currentPlayer.prenom) {
        showMessage('💬 Vous ne pouvez pas discuter avec vous-même !', 'info');
        return;
    }

    // Créer l'overlay
    const overlay = document.createElement('div');
    overlay.className = 'chat-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        z-index: 5000;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease;
    `;

    // Créer la fenêtre de chat
    const chatBox = document.createElement('div');
    chatBox.className = 'chat-box';
    chatBox.style.cssText = `
        background: rgba(255, 255, 255, 0.97);
        backdrop-filter: blur(25px);
        border-radius: 25px;
        padding: 30px;
        width: 90%;
        max-width: 500px;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.5);
        border: 2px solid rgba(102, 126, 234, 0.5);
        animation: slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    `;

    const chatKey = [currentPlayer.prenom, player.prenom].sort().join('_');
    if (!chatMessages[chatKey]) chatMessages[chatKey] = [];

    chatBox.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid rgba(102, 126, 234, 0.3);">
            <div style="display: flex; align-items: center; gap: 15px;">
                <span style="font-size: 2.5em;">${player.emoji}</span>
                <div>
                    <h3 style="margin: 0; color: #333; font-size: 1.5em;">${player.prenom}</h3>
                    <p style="margin: 5px 0 0 0; color: #667eea; font-size: 0.9em;">💬 Chat privé</p>
                </div>
            </div>
            <button id="close-chat" style="
                background: none;
                border: none;
                font-size: 2em;
                color: #667eea;
                cursor: pointer;
                padding: 5px 10px;
                transition: all 0.3s ease;
            ">×</button>
        </div>
        <div id="chat-messages" style="
            flex: 1;
            overflow-y: auto;
            padding: 15px;
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-radius: 15px;
            margin-bottom: 20px;
            min-height: 300px;
            max-height: 400px;
        ">
            ${chatMessages[chatKey].length === 0 ? '<p style="text-align: center; color: #6c757d; padding: 20px;">Aucun message. Commencez la conversation !</p>' : ''}
        </div>
        <div style="display: flex; gap: 10px;">
            <input type="text" id="chat-input" placeholder="Écrivez votre message..." style="
                flex: 1;
                padding: 15px 20px;
                border: 3px solid #e0e0e0;
                border-radius: 15px;
                font-size: 1em;
                background: white;
                transition: all 0.3s ease;
            ">
            <button id="send-message" style="
                padding: 15px 30px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 15px;
                font-size: 1em;
                font-weight: 700;
                cursor: pointer;
                box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
                transition: all 0.3s ease;
            ">Envoyer</button>
        </div>
    `;

    overlay.appendChild(chatBox);
    document.body.appendChild(overlay);

    // Charger les messages existants
    const messagesContainer = document.getElementById('chat-messages');
    chatMessages[chatKey].forEach(msg => {
        addMessageToChat(messagesContainer, msg.author, msg.text, msg.isMe);
    });

    // Scroll vers le bas
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Événements
    const closeBtn = document.getElementById('close-chat');
    const sendBtn = document.getElementById('send-message');
    const chatInput = document.getElementById('chat-input');

    closeBtn.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.transform = 'scale(1.2)';
        closeBtn.style.color = '#e63946';
    });
    closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.transform = 'scale(1)';
        closeBtn.style.color = '#667eea';
    });

    sendBtn.addEventListener('mouseenter', () => {
        sendBtn.style.transform = 'translateY(-2px)';
        sendBtn.style.boxShadow = '0 8px 20px rgba(102, 126, 234, 0.6)';
    });
    sendBtn.addEventListener('mouseleave', () => {
        sendBtn.style.transform = 'translateY(0)';
        sendBtn.style.boxShadow = '0 5px 15px rgba(102, 126, 234, 0.4)';
    });

    chatInput.addEventListener('focus', () => {
        chatInput.style.borderColor = '#667eea';
        chatInput.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.1)';
    });
    chatInput.addEventListener('blur', () => {
        chatInput.style.borderColor = '#e0e0e0';
        chatInput.style.boxShadow = 'none';
    });

    function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        // Ajouter le message à l'historique
        chatMessages[chatKey].push({
            author: currentPlayer.prenom,
            text: text,
            isMe: true,
            timestamp: Date.now()
        });

        // Afficher le message
        addMessageToChat(messagesContainer, currentPlayer.prenom, text, true);

        // Vider l'input
        chatInput.value = '';
        chatInput.focus();

        // Scroll vers le bas
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // Focus sur l'input
    chatInput.focus();
}

function addMessageToChat(container, author, text, isMe) {
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
        margin-bottom: 15px;
        display: flex;
        justify-content: ${isMe ? 'flex-end' : 'flex-start'};
        animation: messageSlideIn 0.3s ease;
    `;

    messageDiv.innerHTML = `
        <div style="
            max-width: 70%;
            padding: 12px 18px;
            border-radius: ${isMe ? '18px 18px 5px 18px' : '18px 18px 18px 5px'};
            background: ${isMe ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white'};
            color: ${isMe ? 'white' : '#333'};
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            border: ${isMe ? 'none' : '2px solid #e0e0e0'};
        ">
            ${!isMe ? `<div style="font-size: 0.85em; color: #667eea; font-weight: 700; margin-bottom: 5px;">${author}</div>` : ''}
            <div style="word-wrap: break-word;">${text}</div>
        </div>
    `;

    container.appendChild(messageDiv);
}

// Ajouter les animations CSS
const chatStyle = document.createElement('style');
chatStyle.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    @keyframes slideUp {
        from {
            opacity: 0;
            transform: translateY(50px) scale(0.9);
        }
        to {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
    }
    @keyframes messageSlideIn {
        from {
            opacity: 0;
            transform: translateY(10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(chatStyle);

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

