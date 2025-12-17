// Récupérer les informations du joueur
let currentPlayer = JSON.parse(localStorage.getItem('currentPlayer'));

// Si pas de joueur connecté, retour à l'accueil
if (!currentPlayer) {
    window.location.href = 'index.html';
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
            </div>
        `;
        
        playersList.appendChild(playerCard);
    });
}

// Afficher les joueurs initiaux
displayPlayers();

// Afficher le bouton "Lancer la partie" uniquement pour l'hôte
if (currentPlayer.isHost) {
    document.getElementById('btn-start').style.display = 'block';
}

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
