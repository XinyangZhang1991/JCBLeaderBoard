// Main Application Initialization

// Load scenarios when available
window.addEventListener("DOMContentLoaded", () => {
  // Initialize scenarios with the Round 1 default.
  // NOTE: This is only the startup default. For returning players the
  // round-routing in game.startRound() overrides game.scenarios with either
  // window.scenarios.round1 or window.scenarios.round2 as chosen.
  if (
    window.scenarios &&
    window.scenarios.round1 &&
    window.scenarios.round1.length > 0
  ) {
    game.scenarios = window.scenarios.round1;
    console.log(
      `Loaded ${window.scenarios.round1.length} scenarios successfully`,
    );
  } else {
    console.error("Scenarios not loaded or empty");
    alert("Failed to load game scenarios. Please refresh the page.");
  }

  // Add click handler to start button
  const startBtn = document.getElementById("start-btn");
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      console.log("Start button clicked");
      game.startRegistration();
    });
  }

  console.log("JCB Leadership in Action ready");
  console.log("Scenarios loaded:", game.scenarios ? game.scenarios.length : 0);
  console.log("Scoring engine ready:", !!window.scoringEngine);
});

// Touchscreen keyboard helper
document.addEventListener("DOMContentLoaded", () => {
  const nameInput = document.getElementById("player-name");
  if (nameInput) {
    // Force focus on touch
    nameInput.addEventListener(
      "touchstart",
      function (e) {
        e.stopPropagation();
        setTimeout(() => {
          this.focus();
          this.click();
        }, 100);
      },
      { passive: false },
    );

    // Auto-select text on focus for easy editing
    nameInput.addEventListener("focus", function () {
      setTimeout(() => {
        this.select();
      }, 50);
    });
  }
  // BUGFIX #2: Removed `registrationScreen.style.pointerEvents = 'none'`.
  // That line disabled all pointer input on the registration screen, blocking
  // the name field, style radios and continue button.
});

// Touch event optimization for large touchscreens
document.addEventListener("touchstart", function () {}, { passive: true });

// Prevent double-tap zoom on touchscreens
let lastTouchEnd = 0;
document.addEventListener(
  "touchend",
  function (event) {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  },
  false,
);

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
document.addEventListener("keydown", function (e) {
  if (e.key === "F11") {
    e.preventDefault();
    enterFullscreen();
  }
});

// Debug helpers (remove for production)
window.debugGame = function () {
  console.log("=== GAME STATE DEBUG ===");
  console.log("Player:", game.state.playerName);
  console.log("Self-identified style:", game.state.selfIdentifiedStyle);
  console.log("Current scenario:", game.state.currentScenario);
  console.log("Metrics:", {
    growth: game.state.growth,
    morale: game.state.morale,
    attrition: game.state.attrition,
    profitMargin: game.state.profitMargin,
  });
  console.log("Leadership styles:", game.state.leadershipStyles);
  console.log("Decisions made:", game.state.decisions.length);
  console.log("Time remaining:", game.state.timeRemaining);
};

window.skipToResults = function () {
  console.log("Skipping to results...");
  game.endGame();
};

window.setMetrics = function (growth, morale, attrition) {
  game.state.growth = growth || game.state.growth;
  game.state.morale = morale || game.state.morale;
  game.state.attrition = attrition || game.state.attrition;
  game.updateHUD();
  console.log("Metrics updated");
};

// Error handling
window.addEventListener("error", function (e) {
  console.error("Application error:", e.error);
  // In production, could send to logging service
});

// Performance monitoring
if (window.performance && window.performance.now) {
  window.addEventListener("load", function () {
    const loadTime = window.performance.now();
    console.log("Application loaded in:", Math.round(loadTime), "ms");
  });
}

// Service Worker for offline capability (optional enhancement)
if ("serviceWorker" in navigator) {
  // Uncomment to enable offline mode
  // navigator.serviceWorker.register('/sw.js').then(function(registration) {
  //   console.log('Service Worker registered:', registration.scope);
  // }).catch(function(error) {
  //   console.log('Service Worker registration failed:', error);
  // });
}

console.log("App.js loaded successfully");
