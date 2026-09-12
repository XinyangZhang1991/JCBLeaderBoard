// Main Application Initialization

// Load scenarios when available
window.addEventListener('DOMContentLoaded', () => {
    // Initialize scenarios
    if (window.scenarios && window.scenarios.round1) {
        game.scenarios = window.scenarios.round1;
    } else {
        console.error('Scenarios not loaded');
    }

    // Add click handler to start button
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            console.log('Start button clicked');
            game.startRegistration();
        });
    }

    console.log('JCB Leadership in Action ready');
    console.log('Scenarios loaded:', game.scenarios ? game.scenarios.length : 0);
    console.log('Scoring engine ready:', !!window.scoringEngine);
});

// Touch event optimization for large touchscreens
document.addEventListener('touchstart', function() {}, { passive: true });

// Prevent double-tap zoom on touchscreens
let lastTouchEnd = 0;
document.addEventListener('touchend', function (event) {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
        event.preventDefault();
    }
    lastTouchEnd = now;
}, false);

// Fullscreen helper for kiosk mode
function enterFullscreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
        elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
    }
}

// Add fullscreen toggle (can be removed for production kiosk mode)
document.addEventListener('keydown', function(e) {
    if (e.key === 'F11') {
        e.preventDefault();
        enterFullscreen();
    }
});

// Debug helpers (remove for production)
window.debugGame = function() {
    console.log('=== GAME STATE DEBUG ===');
    console.log('Player:', game.state.playerName);
    console.log('Self-identified style:', game.state.selfIdentifiedStyle);
    console.log('Current scenario:', game.state.currentScenario);
    console.log('Metrics:', {
        growth: game.state.growth,
        morale: game.state.morale,
        attrition: game.state.attrition,
        profitMargin: game.state.profitMargin
    });
    console.log('Leadership styles:', game.state.leadershipStyles);
    console.log('Decisions made:', game.state.decisions.length);
    console.log('Time remaining:', game.state.timeRemaining);
};

window.skipToResults = function() {
    console.log('Skipping to results...');
    game.endGame();
};

window.setMetrics = function(growth, morale, attrition) {
    game.state.growth = growth || game.state.growth;
    game.state.morale = morale || game.state.morale;
    game.state.attrition = attrition || game.state.attrition;
    game.updateHUD();
    console.log('Metrics updated');
};

// Error handling
window.addEventListener('error', function(e) {
    console.error('Application error:', e.error);
    // In production, could send to logging service
});

// Performance monitoring
if (window.performance && window.performance.now) {
    window.addEventListener('load', function() {
        const loadTime = window.performance.now();
        console.log('Application loaded in:', Math.round(loadTime), 'ms');
    });
}

// Service Worker for offline capability (optional enhancement)
if ('serviceWorker' in navigator) {
    // Uncomment to enable offline mode
    // navigator.serviceWorker.register('/sw.js').then(function(registration) {
    //     console.log('Service Worker registered:', registration.scope);
    // }).catch(function(error) {
    //     console.log('Service Worker registration failed:', error);
    // });
}

console.log('App.js loaded successfully');