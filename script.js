// Initialiser Firebase au chargement de la page
(async function initFirebase() {
    try {
        if (window.firebaseManager) {
            await window.firebaseManager.init();
            console.log('✅ Firebase prêt pour le multijoueur');
        }
    } catch (error) {
        console.warn('⚠️ Firebase non disponible, mode local activé:', error.message);
    }
})();

// Gestion de la sélection d'emoji
let selectedEmoji = '😀';
let selectedSkin = 'default';

document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        // Retirer la sélection précédente
        document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));

        // Ajouter la sélection au bouton cliqué
        this.classList.add('selected');

        // Mettre à jour l'emoji sélectionné
        selectedEmoji = this.getAttribute('data-emoji');
        document.getElementById('selected-emoji').textContent = selectedEmoji;
    });
});

// Sélectionner le premier emoji par défaut
document.querySelector('.emoji-btn').classList.add('selected');

// Gestion de la sélection de skin
document.querySelectorAll('.skin-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        // Retirer la sélection précédente
        document.querySelectorAll('.skin-btn').forEach(b => b.classList.remove('active'));

        // Ajouter la sélection au bouton cliqué
        this.classList.add('active');

        // Mettre à jour le skin sélectionné
        selectedSkin = this.getAttribute('data-skin');
    });
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

// Fonction pour générer un code de partie aléatoire
function generateGameCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Bouton Créer une partie
document.getElementById('btn-creer').addEventListener('click', async function() {
    const prenom = document.getElementById('prenom').value.trim();

    if (!prenom) {
        showMessage('⚠️ Veuillez entrer votre prénom', 'error');
        return;
    }

    if (prenom.length < 2) {
        showMessage('⚠️ Le prénom doit contenir au moins 2 caractères', 'error');
        return;
    }

    // Désactiver le bouton pendant le traitement
    this.disabled = true;
    this.textContent = '⏳ Création...';

    try {
        // Préparer les données du joueur
        const player = {
            prenom: prenom,
            emoji: selectedEmoji,
            skin: selectedSkin,
            startingMoney: 1500,
            isHost: true
        };

        // Utiliser Firebase si disponible, sinon localStorage
        if (window.firebaseManager && window.firebaseManager.isAvailable()) {
            const gameCode = await window.firebaseManager.createGame(player);
            showMessage(`✅ Partie créée ! Code : ${gameCode}`, 'success');
        } else {
            // Fallback: mode local avec localStorage
            const gameCode = generateGameCode();
            player.gameCode = gameCode;
            localStorage.setItem('currentPlayer', JSON.stringify(player));
            showMessage(`✅ Partie créée (mode local) ! Code : ${gameCode}`, 'success');
            console.warn('⚠️ Mode local activé - Firebase non disponible');
        }

        // Rediriger vers la salle d'attente
        setTimeout(() => {
            window.location.href = 'lobby.html';
        }, 1500);
    } catch (error) {
        console.error('Erreur création partie:', error);
        showMessage(`❌ Erreur: ${error.message}`, 'error');
        this.disabled = false;
        this.textContent = '🎮 Créer une partie';
    }
});

// Bouton Rejoindre une partie
document.getElementById('btn-rejoindre').addEventListener('click', async function() {
    const prenom = document.getElementById('prenom').value.trim();
    const codePartie = document.getElementById('code-partie').value.trim().toUpperCase();

    if (!prenom) {
        showMessage('⚠️ Veuillez entrer votre prénom', 'error');
        return;
    }

    if (prenom.length < 2) {
        showMessage('⚠️ Le prénom doit contenir au moins 2 caractères', 'error');
        return;
    }

    if (!codePartie) {
        showMessage('⚠️ Veuillez entrer un code de partie', 'error');
        return;
    }

    if (codePartie.length !== 3 && codePartie.length !== 6) {
        showMessage('⚠️ Le code de partie doit contenir 3 ou 6 caractères', 'error');
        return;
    }

    // Désactiver le bouton pendant le traitement
    this.disabled = true;
    this.textContent = '⏳ Connexion...';

    try {
        // Préparer les données du joueur
        const player = {
            prenom: prenom,
            emoji: selectedEmoji,
            skin: selectedSkin,
            startingMoney: 1500,
            isHost: false
        };

        // Utiliser Firebase si disponible, sinon localStorage
        if (window.firebaseManager && window.firebaseManager.isAvailable()) {
            await window.firebaseManager.joinGame(codePartie, player);
            showMessage(`✅ Connexion à la partie ${codePartie}...`, 'success');
        } else {
            // Fallback: mode local avec localStorage
            player.gameCode = codePartie;
            localStorage.setItem('currentPlayer', JSON.stringify(player));
            showMessage(`✅ Connexion à la partie (mode local) ${codePartie}...`, 'success');
            console.warn('⚠️ Mode local activé - Firebase non disponible');
        }

        // Rediriger vers la salle d'attente
        setTimeout(() => {
            window.location.href = 'lobby.html';
        }, 1500);
    } catch (error) {
        console.error('Erreur rejoindre partie:', error);
        showMessage(`❌ ${error.message}`, 'error');
        this.disabled = false;
        this.textContent = '🚪 Rejoindre une partie';
    }
});

// Permettre de rejoindre en appuyant sur Entrée
document.getElementById('code-partie').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        document.getElementById('btn-rejoindre').click();
    }
});

document.getElementById('prenom').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        document.getElementById('btn-creer').click();
    }
});
