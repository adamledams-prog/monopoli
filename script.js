// Gestion de la sélection d'emoji
let selectedEmoji = '😀';
let selectedSkin = 'default';
let selectedMoney = 1500; // Argent de départ par défaut

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

// Gestion de la sélection d'argent
document.querySelectorAll('.money-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        // Retirer la sélection précédente
        document.querySelectorAll('.money-btn').forEach(b => b.classList.remove('active'));
        
        // Ajouter la sélection au bouton cliqué
        this.classList.add('active');
        
        // Mettre à jour l'argent sélectionné
        selectedMoney = parseInt(this.getAttribute('data-money'));
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
document.getElementById('btn-creer').addEventListener('click', function() {
    const prenom = document.getElementById('prenom').value.trim();
    
    if (!prenom) {
        showMessage('⚠️ Veuillez entrer votre prénom', 'error');
        return;
    }
    
    if (prenom.length < 2) {
        showMessage('⚠️ Le prénom doit contenir au moins 2 caractères', 'error');
        return;
    }
    
    // Générer un code de partie
    const gameCode = generateGameCode();
    
    // Sauvegarder les informations du joueur
    const player = {
        prenom: prenom,
        emoji: selectedEmoji,
        gameCode: gameCode,
        isHost: true,
        skin: selectedSkin,
        startingMoney: selectedMoney
    };
    
    localStorage.setItem('currentPlayer', JSON.stringify(player));
    
    showMessage(`✅ Partie créée ! Code : ${gameCode}`, 'success');
    
    // Rediriger vers la salle d'attente
    setTimeout(() => {
        window.location.href = 'lobby.html';
    }, 2000);
});

// Bouton Rejoindre une partie
document.getElementById('btn-rejoindre').addEventListener('click', function() {
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
    
    if (codePartie.length !== 6) {
        showMessage('⚠️ Le code de partie doit contenir 6 caractères', 'error');
        return;
    }
    
    // Sauvegarder les informations du joueur
    const player = {
        prenom: prenom,
        emoji: selectedEmoji,
        gameCode: codePartie,
        isHost: false,
        skin: selectedSkin,
        startingMoney: selectedMoney
    };
    
    localStorage.setItem('currentPlayer', JSON.stringify(player));
    
    showMessage(`✅ Connexion à la partie ${codePartie}...`, 'success');
    
    // Rediriger vers la salle d'attente
    setTimeout(() => {
        window.location.href = 'lobby.html';
    }, 2000);
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
