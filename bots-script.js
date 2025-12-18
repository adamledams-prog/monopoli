// Récupérer les bots du localStorage
let bots = JSON.parse(localStorage.getItem('gameBots')) || [];

// Emoji sélectionné
let selectedEmoji = '🤖';

// Sélection d'emoji
document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
        this.classList.add('selected');
        selectedEmoji = this.getAttribute('data-emoji');
        document.getElementById('selected-emoji').textContent = selectedEmoji;
    });
});

// Sélectionner le premier emoji par défaut
document.querySelector('.emoji-btn').classList.add('selected');

// Afficher les bots
function displayBots() {
    const botsContainer = document.getElementById('available-bots');
    botsContainer.innerHTML = '';
    
    if (bots.length === 0) {
        botsContainer.innerHTML = '<div class="no-bots">Aucun bot ajouté pour le moment</div>';
        return;
    }
    
    bots.forEach((bot, index) => {
        const botCard = document.createElement('div');
        botCard.className = 'bot-card';
        
        const difficultyClass = bot.difficulty;
        const difficultyText = {
            'facile': 'Facile 😊',
            'moyen': 'Moyen 😐',
            'difficile': 'Difficile 😈'
        };
        
        botCard.innerHTML = `
            <div class="bot-info">
                <div class="bot-emoji">${bot.emoji}</div>
                <div class="bot-details">
                    <div class="bot-name">${bot.name}</div>
                    <div class="bot-difficulty ${difficultyClass}">${difficultyText[difficultyClass]}</div>
                </div>
            </div>
            <button class="btn-remove-bot" data-index="${index}">❌ Retirer</button>
        `;
        
        botsContainer.appendChild(botCard);
    });
    
    // Ajouter événements sur les boutons retirer
    document.querySelectorAll('.btn-remove-bot').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            removeBot(index);
        });
    });
}

// Ajouter un bot
document.getElementById('btn-add-bot').addEventListener('click', function() {
    const botName = document.getElementById('bot-name').value.trim();
    const botDifficulty = document.getElementById('bot-difficulty').value;
    
    if (!botName) {
        alert('⚠️ Veuillez entrer un nom pour le bot');
        return;
    }
    
    if (botName.length < 2) {
        alert('⚠️ Le nom du bot doit contenir au moins 2 caractères');
        return;
    }
    
    if (bots.length >= 3) {
        alert('⚠️ Vous ne pouvez pas ajouter plus de 3 bots');
        return;
    }
    
    // Créer le bot
    const newBot = {
        name: botName,
        emoji: selectedEmoji,
        difficulty: botDifficulty,
        isBot: true
    };
    
    bots.push(newBot);
    localStorage.setItem('gameBots', JSON.stringify(bots));
    
    // Réinitialiser le formulaire
    document.getElementById('bot-name').value = '';
    document.getElementById('bot-difficulty').value = 'moyen';
    selectedEmoji = '🤖';
    document.getElementById('selected-emoji').textContent = selectedEmoji;
    document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
    document.querySelector('.emoji-btn').classList.add('selected');
    
    // Afficher les bots
    displayBots();
    
    // Message de succès
    showMessage(`✅ ${newBot.emoji} ${newBot.name} ajouté avec succès!`);
});

// Retirer un bot
function removeBot(index) {
    const bot = bots[index];
    if (confirm(`Voulez-vous vraiment retirer ${bot.emoji} ${bot.name} ?`)) {
        bots.splice(index, 1);
        localStorage.setItem('gameBots', JSON.stringify(bots));
        displayBots();
        showMessage(`❌ Bot retiré`);
    }
}

// Retour au lobby
document.getElementById('btn-back').addEventListener('click', function() {
    window.location.href = 'lobby.html';
});

// Afficher un message
function showMessage(text) {
    const message = document.createElement('div');
    message.textContent = text;
    message.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 15px 25px;
        border-radius: 12px;
        font-size: 1.1em;
        font-weight: 600;
        z-index: 2000;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        animation: slideInRight 0.5s ease-out;
    `;
    document.body.appendChild(message);
    
    setTimeout(() => {
        message.style.animation = 'slideOutRight 0.5s ease-out';
        setTimeout(() => message.remove(), 500);
    }, 3000);
}

// Initialisation
displayBots();
