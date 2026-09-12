
// Game Engine - Core game logic and state management
class GameEngine {
  constructor() {
    this.state = {
      playerName: '',
      selfIdentifiedStyle: '',
      consentGiven: false,
      currentScenario: 0,
      round: 1,

      // Visible metrics
      growth: 0,
      marketShare: 0,
      profitMargin: 20,
      morale: 75,
      attrition: 5,

      // Hidden tracking
      leadershipStyles: {
        coercive: 0,
        authoritative: 0,
        affiliative: 0,
        democratic: 0,
        pacesetting: 0,
        coaching: 0
      },

      // Quality metrics
      leadership: 0,
      excellence: 0,
      agility: 0,
      determination: 0,

      criticalThinking: 0,
      teamImpact: 0,

      // Decision tracking
      decisions: [],
      infoRequests: [],

      // Timing
      startTime: null,
      timeRemaining: 900, // 15 minutes in seconds
      timerInterval: null
    };

    this.scenarios = null; // Will be loaded from scenarios.js
  }

  init() {
    console.log('JCB Leadership in Action initialized');
    this.loadLeaderboard();
    this.showScreen('welcome-screen');
  }

  loadLeaderboard() {
    const leaderboardData = this.getLeaderboardData();
    const container = document.getElementById('leaderboard-container');

    if (!container) return;

    if (leaderboardData.length === 0) {
      container.innerHTML = '<div class="leaderboard-empty">No players yet. <br/>Be the first to lead!</div>';
      return;
    }

    container.innerHTML = leaderboardData.map((player, index) => `
      <div class="leaderboard-item">
        <div class="leaderboard-rank">${index + 1}</div>
        <div class="leaderboard-info">
          <div class="leaderboard-name">${player.name}</div>
          <div class="leaderboard-details">${player.leadershipStyle} • ${player.personalityColor}</div>
        </div>
        <div class="leaderboard-score">${player.growth.toFixed(1)}%</div>
      </div>
    `).join('');
  }

  getLeaderboardData() {
    try {
      const data = localStorage.getItem('jcb_leaderboard');
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error loading leaderboard:', e);
      return [];
    }
  }

  saveToLeaderboard(playerData) {
    try {
      const leaderboard = this.getLeaderboardData();
      leaderboard.push(playerData);

      // Sort by growth percentage (descending)
      leaderboard.sort((a, b) => b.growth - a.growth);

      // Keep only top 10
      const top10 = leaderboard.slice(0, 10);

      localStorage.setItem('jcb_leaderboard', JSON.stringify(top10));
    } catch (e) {
      console.error('Error saving to leaderboard:', e);
    }
  }

  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
  }

  startRegistration() {
    console.log('startRegistration called');
    this.showScreen('registration-screen');
    console.log('registration screen should now be visible');
  }

  selectLeadershipStyle(style) {
    this.state.selfIdentifiedStyle = style;
    document.querySelectorAll('.radio-option').forEach(opt => {
      opt.classList.remove('selected');
    });

    // Use event if available, otherwise find the element
    const targetOption = window.event ?
      window.event.target.closest('.radio-option') :
      document.querySelector(`.radio-option input[value="${style}"]`)?.closest('.radio-option');

    if (targetOption) {
      targetOption.classList.add('selected');
    }

    const radioInput = document.querySelector(`input[value="${style}"]`);
    if (radioInput) {
      radioInput.checked = true;
    }
  }

  validateAndStartBriefing() {
    const nameInput = document.getElementById('player-name');
    const consentCheckbox = document.getElementById('consent-checkbox');

    if (!nameInput.value.trim()) {
      alert('Please enter your name');
      return;
    }

    if (!this.state.selfIdentifiedStyle) {
      alert('Please select your primary leadership style');
      return;
    }

    if (!consentCheckbox.checked) {
      alert('Please consent to public results display');
      return;
    }

    this.state.playerName = nameInput.value.trim();
    this.state.consentGiven = true;

    this.startBriefing();
  }

  startBriefing() {
    this.showScreen('briefing-screen');

    // Start countdown
    let countdown = 90;
    const countdownEl = document.querySelector('#briefing-countdown span');

    if (!countdownEl) {
      console.error('Countdown element not found!');
      // Skip to gameplay if element missing
      this.startGameplay();
      return;
    }

    const countdownInterval = setInterval(() => {
      countdown--;
      countdownEl.textContent = countdown;

      if (countdown <= 0) {
        clearInterval(countdownInterval);
        this.startGameplay();
      }
    }, 1000);

    // Store interval for skip function
    this.briefingInterval = countdownInterval;
  }

  skipBriefing() {
    if (this.briefingInterval) {
      clearInterval(this.briefingInterval);
    }
    this.startGameplay();
  }

  startGameplay() {
    this.state.startTime = Date.now();
    this.showScreen('gameplay-screen');
    this.startTimer();
    this.loadScenario(0);
  }

  startTimer() {
    this.state.timerInterval = setInterval(() => {
      this.state.timeRemaining--;
      this.updateTimerDisplay();

      if (this.state.timeRemaining <= 0) {
        this.endGame();
      }
    }, 1000);
  }

  updateTimerDisplay() {
    const minutes = Math.floor(this.state.timeRemaining / 60);
    const seconds = this.state.timeRemaining % 60;
    const timerEl = document.getElementById('game-timer');
    timerEl.textContent = `Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;

    if (this.state.timeRemaining < 60) {
      timerEl.style.color = 'var(--jcb-red)';
    }
  }

  updateHUD() {
    // Update visible metrics
    document.getElementById('metric-growth').textContent =
      `+${this.state.growth.toFixed(1)}%`;
    document.getElementById('metric-market').textContent =
      `+${this.state.marketShare.toFixed(1)}%`;
    document.getElementById('metric-profit').textContent =
      `${this.state.profitMargin.toFixed(0)}%`;
    document.getElementById('metric-attrition').textContent =
      `${this.state.attrition.toFixed(0)}%`;

    // Update morale bar
    const moraleFill = document.querySelector('.morale-fill');
    const moraleValue = document.querySelector('.morale-value');
    moraleFill.style.width = `${this.state.morale}%`;
    moraleValue.textContent = `${this.state.morale.toFixed(0)}%`;

    // Color coding for morale
    if (this.state.morale >= 75) {
      moraleFill.style.background = 'linear-gradient(to right, var(--jcb-green), var(--jcb-yellow))';
    } else if (this.state.morale >= 60) {
      moraleFill.style.background = 'linear-gradient(to right, var(--jcb-yellow), orange)';
    } else {
      moraleFill.style.background = 'linear-gradient(to right, orange, var(--jcb-red))';
    }
  }

  updatePeriod(month, quarter) {
    const periodEl = document.getElementById('game-period');
    periodEl.textContent = `Q${quarter} Month ${month}`;
  }

  loadScenario(scenarioIndex) {
    if (!this.scenarios) {
      console.error('ERROR: Scenarios not loaded!');
      alert('Game error: Scenarios not loaded. Please refresh the page.');
      return;
    }

    if (scenarioIndex >= this.scenarios.length) {
      console.log('All scenarios complete, ending game');
      this.endGame();
      return;
    }

    this.state.currentScenario = scenarioIndex;
    const scenario = this.scenarios[scenarioIndex];

    console.log('Loading scenario:', scenario.id);

    // Scroll to top of scenario container
    const scenarioContainer = document.getElementById('scenario-container');
    if (scenarioContainer) {
      scenarioContainer.scrollTop = 0;
    }

    // Update period
    this.updatePeriod(scenario.month, scenario.quarter);

    // Render scenario
    const container = document.getElementById('scenario-container');
    if (!container) {
      console.error('ERROR: scenario-container not found!');
      return;
    }

    container.innerHTML = this.renderScenario(scenario);

    // Initialize scenario-specific interactions
    this.initScenarioInteractions(scenario);
  }

  renderScenario(scenario) {
    return `
      <div class="scenario-header">
        <h2 class="scenario-title">${scenario.title}</h2>
        <h3 class="scenario-subtitle">${scenario.subtitle}</h3>
      </div>

      <div class="scenario-brief">
        <div class="jcb-logo-small"></div>
        <h4>SCENARIO BRIEFING</h4>
        <div class="scenario-brief-text">
          <p>${scenario.description}</p>
        </div>
      </div>

      <div class="scenario-content">
        ${this.renderDecisionInterface(scenario)}

        <div class="action-buttons">
          <button class="btn-primary" onclick="game.submitDecision()">
            CONFIRM DECISION
          </button>
        </div>
      </div>
    `;
  }

  renderDecisionInterface(scenario) {
    let html = '';

    scenario.decisions.forEach((decision, index) => {
      html += `
        <div class="decision-interface" data-decision-index="${index}">
          <h3 class="decision-title">${decision.title}</h3>
          ${this.renderDecisionType(decision, index)}
        </div>
      `;
    });

    return html;
  }

  renderDecisionType(decision, decisionIndex) {
    switch (decision.type) {
      case 'choice':
        return this.renderChoiceOptions(decision.options, decisionIndex);
      case 'slider':
        return this.renderSliders(decision.sliders, decisionIndex);
      case 'ranking':
        return this.renderRanking(decision.items, decisionIndex);
      case 'timeline':
        return this.renderTimeline(decision.options, decisionIndex);
      default:
        return '';
    }
  }

  renderChoiceOptions(options, decisionIndex) {
    let html = '<div class="choice-options">';
    options.forEach((option, i) => {
      html += `
        <div class="choice-option"
          data-decision="${decisionIndex}"
          data-option="${i}"
          onclick="game.selectChoice(${decisionIndex}, ${i})">
          ${option.text}
        </div>
      `;
    });
    html += '</div>';
    return html;
  }

  renderSliders(sliders, decisionIndex) {
    let html = '<div class="slider-container">';
    sliders.forEach((slider, i) => {
      html += `
        <div class="slider-item">
          <div class="slider-label">
            <span class="slider-name">${slider.label}</span>
            <span class="slider-value" id="slider-value-${decisionIndex}-${i}">
              £0M
            </span>
          </div>
          <input type="range"
            class="slider"
            min="0"
            max="${slider.max * 10}"
            value="0"
            data-decision="${decisionIndex}"
            data-slider="${i}"
            oninput="game.updateSlider(${decisionIndex}, ${i}, this.value)">
        </div>
      `;
    });

    if (sliders[0].budgetConstraint) {
      html += `<div class="budget-remaining" id="budget-remaining-${decisionIndex}">
          Budget remaining: £${sliders[0].budgetConstraint}M
        </div>`;
    }

    html += '</div>';
    return html;
  }

  renderRanking(items, decisionIndex) {
    let html = '<div class="ranking-container" id="ranking-container-${decisionIndex}">';
    items.forEach((item, i) => {
      html += `
        <div class="ranking-item" draggable="true" data-decision="${decisionIndex}" data-item="${i}">
          <div class="ranking-number">${i + 1}</div>
          <div class="ranking-text">${item}</div>
        </div>
      `;
    });
    html += '</div>';
    return html;
  }

  renderTimeline(options, decisionIndex) {
    let html = `
      <div class="timeline-slider-container">
        <div class="timeline-labels">
          ${options.map((opt, i) => `
            <div class="timeline-label ${i === 0 ? 'active' : ''}" id="timeline-label-${decisionIndex}-${i}">
              ${opt}
            </div>
          `).join('')}
        </div>
        <div class="timeline-track">
          <input type="range"
            class="slider"
            min="0"
            max="${options.length - 1}"
            value="0"
            data-decision="${decisionIndex}"
            oninput="game.updateTimeline(${decisionIndex}, this.value, ${options.length})">
        </div>
      </div>
    `;
    return html;
  }

  initScenarioInteractions(scenario) {
    // Initialize drag and drop for rankings if present
    const rankings = document.querySelectorAll('.ranking-item');
    rankings.forEach(item => {
      item.addEventListener('dragstart', this.handleDragStart.bind(this));
      item.addEventListener('dragover', this.handleDragOver.bind(this));
      item.addEventListener('drop', this.handleDrop.bind(this));
      item.addEventListener('dragend', this.handleDragEnd.bind(this));
    });
  }

  // Interaction handlers
  selectChoice(decisionIndex, optionIndex) {
    const container = document.querySelector(`[data-decision-index="${decisionIndex}"]`);
    container.querySelectorAll('.choice-option').forEach(opt => {
      opt.classList.remove('selected');
    });
    event.target.classList.add('selected');
  }

  updateSlider(decisionIndex, sliderIndex, value) {
    const scenario = this.scenarios[this.state.currentScenario];
    const decision = scenario.decisions[decisionIndex];

    // Check if budget constraint exists
    if (decision.type === 'slider' && decision.sliders[0].budgetConstraint) {
      const budgetLimit = decision.sliders[0].budgetConstraint;
      const sliders = document.querySelectorAll(`[data-decision="${decisionIndex}"]`);
      let total = 0;

      sliders.forEach(slider => {
        total += parseFloat(slider.value) / 10;
      });

      // If this change would exceed the budget, prevent it
      if (total > budgetLimit + 0.01) {
        // Revert the slider to its previous value
        const currentSlider = sliders[sliderIndex];
        const maxAllowed = budgetLimit - (total - parseFloat(value) / 10);
        currentSlider.value = Math.floor(maxAllowed * 10);
        value = currentSlider.value;
      }
    }

    const actualValue = (value / 10).toFixed(1);
    document.getElementById(`slider-value-${decisionIndex}-${sliderIndex}`).textContent =
      `£${actualValue}M`;

    // Update budget if constraint exists
    this.updateBudgetRemaining(decisionIndex);
  }

  updateBudgetRemaining(decisionIndex) {
    const scenario = this.scenarios[this.state.currentScenario];
    const decision = scenario.decisions[decisionIndex];

    if (decision.type === 'slider' && decision.sliders[0].budgetConstraint) {
      const sliders = document.querySelectorAll(`[data-decision="${decisionIndex}"]`);
      let total = 0;

      sliders.forEach(slider => {
        total += parseFloat(slider.value) / 10;
      });

      const remaining = decision.sliders[0].budgetConstraint - total;
      const budgetEl = document.getElementById(`budget-remaining-${decisionIndex}`);
      budgetEl.textContent = `Budget Remaining: £${remaining.toFixed(1)}M`;

      if (remaining < 0) {
        budgetEl.style.color = 'var(--jcb-red)';
      } else {
        budgetEl.style.color = 'var(--jcb-yellow)';
      }
    }
  }

  updateTimeline(decisionIndex, value, optionsCount) {
    // Update active label
    for (let i = 0; i < optionsCount; i++) {
      const label = document.getElementById(`timeline-label-${decisionIndex}-${i}`);
      if (i === parseInt(value)) {
        label.classList.add('active');
      } else {
        label.classList.remove('active');
      }
    }
  }

  // Drag and drop handlers
  handleDragStart(e) {
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.innerHTML);
  }

  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
  }

  handleDrop(e) {
    e.stopPropagation();
    e.preventDefault();

    const dragging = document.querySelector('.dragging');
    const dropTarget = e.target.closest('.ranking-item');

    if (dragging && dropTarget && dragging !== dropTarget) {
      const parent = dragging.parentNode;
      const items = Array.from(parent.children);
      const dragIndex = items.indexOf(dragging);
      const dropIndex = items.indexOf(dropTarget);

      if (dragIndex < dropIndex) {
        parent.insertBefore(dragging, dropTarget.nextSibling);
      } else {
        parent.insertBefore(dragging, dropTarget);
      }

      this.updateRankingNumbers(parent);
    }

    return false;
  }

  handleDragEnd(e) {
    e.target.classList.remove('dragging');
  }

  updateRankingNumbers(container) {
    const items = container.querySelectorAll('.ranking-item');
    items.forEach((item, index) => {
      item.querySelector('.ranking-number').textContent = index + 1;
    });
  }

  requestInfo() {
    const scenario = this.scenarios[this.state.currentScenario];
    if (!scenario.additionalInfo) return;

    const modal = document.getElementById('info-modal');

    // Reset modal to original structure
    const modalContent = modal.querySelector('.modal-content');
    modalContent.innerHTML = `
      <h3>ADDITIONAL INFORMATION</h3>
      <p>Available sources:</p>
      <div id="info-options"></div>
      <div class="modal-actions">
        <button class="btn-primary" onclick="game.confirmInfoRequest()">REQUEST SELECTED</button>
        <button class="btn-secondary" onclick="game.closeInfoModal()">CANCEL</button>
      </div>
    `;

    const optionsContainer = document.getElementById('info-options');
    optionsContainer.innerHTML = scenario.additionalInfo.map((info, i) => `
      <div class="info-option" onclick="game.selectInfoOption(${i})">
        <input type="checkbox" id="info-${i}">
        <label for="info-${i}">${info.label}</label>
      </div>
    `).join('');

    modal.classList.add('active');
  }

  selectInfoOption(index) {
    event.target.closest('.info-option').classList.toggle('selected');
    const checkbox = document.getElementById(`info-${index}`);
    checkbox.checked = !checkbox.checked;
  }

  confirmInfoRequest() {
    const selected = [];
    document.querySelectorAll('#info-options input:checked').forEach(cb => {
      const index = parseInt(cb.id.split('-')[1]);
      selected.push(index);
    });

    console.log('Selected info requests:', selected);

    if (selected.length === 0) {
      alert('Please select at least one information source.');
      return;
    }

    const scenario = this.scenarios[this.state.currentScenario];
    console.log('Current scenario:', scenario.title);

    this.state.infoRequests.push({
      scenario: this.state.currentScenario,
      requests: selected
    });

    // Show the actual information content
    let infoContent = '<h3>ADDITIONAL INFORMATION</h3><div style="text-align: left;">';
    selected.forEach(index => {
      const info = scenario.additionalInfo[index];
      console.log('Showing info:', info.label, info.content);
      infoContent += `
        <div style="margin-bottom: 20px; padding: 15px; background: rgba(255, 203, 0, 0.1); border-left: 3px solid var(--jcb-yellow);">
          <h4 style="color: var(--jcb-yellow); margin-bottom: 10px;">${info.label}</h4>
          <p style="line-height: 1.6; color: rgba(255, 255, 255, 0.9);">${info.content}</p>
        </div>
      `;
    });
    infoContent += '</div>';

    // Display in modal
    const infoModal = document.getElementById('info-modal');
    const modalContent = infoModal.querySelector('.modal-content');
    modalContent.innerHTML = infoContent + `
      <div class="modal-actions">
        <button class="btn-primary" onclick="game.closeInfoModal()" style="position: relative; z-index: 9999; pointer-events: auto;">UNDERSTOOD</button>
      </div>
    `;

    console.log('Info modal updated with content');
  }

  closeInfoModal() {
    document.getElementById('info-modal').classList.remove('active');
  }

  closeConsequenceModal() {
    document.getElementById('consequence-modal').classList.remove('active');
  }

  submitDecision() {
    const scenario = this.scenarios[this.state.currentScenario];

    // Validate budget constraints before submitting
    if (!this.validateBudgetConstraints(scenario)) {
      alert('You have exceeded the allocated budget. Please adjust your spending allocation.');
      return;
    }

    const decision = this.collectDecisionData(scenario);

    // Store decision
    this.state.decisions.push(decision);

    // Calculate impacts
    this.applyDecisionImpact(scenario, decision);

    // Update HUD
    this.updateHUD();

    // Show consequence
    this.showConsequence(scenario, decision);
  }

  validateBudgetConstraints(scenario) {
    // Check all slider-based decisions for budget constraints
    for (let decisionIndex = 0; decisionIndex < scenario.decisions.length; decisionIndex++) {
      const decision = scenario.decisions[decisionIndex];

      if (decision.type === 'slider' && decision.sliders[0].budgetConstraint) {
        const sliders = document.querySelectorAll(`[data-decision="${decisionIndex}"]`);
        let total = 0;

        sliders.forEach(slider => {
          total += parseFloat(slider.value) / 10;
        });

        const budgetLimit = decision.sliders[0].budgetConstraint;

        // Allow a tiny margin for floating point errors
        if (total > budgetLimit + 0.01) {
          return false;
        }
      }
    }
    return true;
  }

  collectDecisionData(scenario) {
    const data = {
      scenario: this.state.currentScenario,
      timestamp: Date.now(),
      choices: []
    };

    scenario.decisions.forEach((decision, index) => {
      switch (decision.type) {
        case 'choice':
          const selected = document.querySelector(`.choice-option.selected[data-decision="${index}"]`);
          data.choices.push({
            type: 'choice',
            index: selected ? parseInt(selected.dataset.option) : -1
          });
          break;

        case 'slider':
          const sliders = document.querySelectorAll(`input.slider[data-decision="${index}"]`);
          const values = Array.from(sliders).map(s => parseFloat(s.value) / 10);
          data.choices.push({
            type: 'slider',
            values: values
          });
          break;

        case 'ranking':
          const items = document.querySelectorAll(`.ranking-item[data-decision="${index}"]`);
          const ranking = Array.from(items).map(item => parseInt(item.dataset.item));
          data.choices.push({
            type: 'ranking',
            order: ranking
          });
          break;

        case 'timeline':
          const timeline = document.querySelector(`input.slider[data-decision="${index}"]`);
          data.choices.push({
            type: 'timeline',
            value: parseInt(timeline.value)
          });
          break;
      }
    });

    return data;
  }

  applyDecisionImpact(scenario, decision) {
    // This will use the scoring engine to calculate impact
    if (window.scoringEngine) {
      const impact = scoringEngine.calculateDecisionImpact(scenario, decision, this.state);

      // Store the impact details with the decision for feedback later
      decision.impact = impact;
      decision.scenarioTitle = scenario.title;
      decision.scenarioId = scenario.id;

      // Extract style and color info from decisions
      decision.stylesUsed = [];
      decision.colorsUsed = [];

      scenario.decisions.forEach((decisionDef, index) => {
        const choice = decision.choices[index];

        if (decisionDef.type === 'choice' && choice.index >= 0) {
          const option = decisionDef.options[choice.index];
          if (option){
              if (option.style) decision.stylesUsed.push(option.style);
              if (option.color) decision.colorsUsed.push(option.color);
          }
        } else if (decisionDef.type === 'timeline' && choice.value !== undefined) {
          if (decisionDef.styleMapping && decisionDef.styleMapping[choice.value]) {
            decision.stylesUsed.push(decisionDef.styleMapping[choice.value]);
          }
          if (decisionDef.colorMapping && decisionDef.colorMapping[choice.value]) {
            decision.colorsUsed.push(decisionDef.colorMapping[choice.value]);
          }
        }
      });

      // Apply impacts to state
      this.state.growth += impact.growth || 0;
      this.state.marketShare += impact.marketShare || 0;
      this.state.profitMargin += impact.profitMargin || 0;
      this.state.morale += impact.morale || 0;
      this.state.attrition += impact.attrition || 0;

      // Update leadership style tracking
      if (impact.leadershipStyles) {
        Object.keys(impact.leadershipStyles).forEach(style => {
          this.state.leadershipStyles[style] += impact.leadershipStyles[style];
        });
      }

      // Update quality metrics
      this.state.leadership += impact.leadership || 0;
      this.state.excellence += impact.excellence || 0;
      this.state.agility += impact.agility || 0;
      this.state.determination += impact.determination || 0;

      // Bounds checking
      this.state.morale = Math.max(0, Math.min(100, this.state.morale));
      this.state.attrition = Math.max(0, Math.min(100, this.state.attrition));
    }
  }

  showConsequence(scenario, decision) {
    const modal = document.getElementById('consequence-modal');
    const textEl = document.getElementById('consequence-text');

    // Get consequence text from scenario
    const consequenceText = scenario.consequenceText ||
      "Your decision has been recorded. The situation evolves...";

    textEl.textContent = consequenceText;
    modal.classList.add('active');

    // Auto-continue after 5 seconds
    let countdown = 5;
    const timerEl = document.getElementById('consequence-timer');

    const countdownInterval = setInterval(() => {
      countdown--;
      timerEl.textContent = countdown;

      if (countdown <= 0) {
        clearInterval(countdownInterval);
        this.skipConsequence();
      }
    }, 1000);

    this.consequenceInterval = countdownInterval;
  }

  skipConsequence() {
    if (this.consequenceInterval) {
      clearInterval(this.consequenceInterval);
    }

    document.getElementById('consequence-modal').classList.remove('active');

    // Move to next scenario
    this.state.currentScenario++;

    if (this.state.currentScenario < this.scenarios.length) {
      this.loadScenario(this.state.currentScenario);
    } else {
      this.endGame();
    }
  }

  endGame() {
    if (this.state.timerInterval) {
      clearInterval(this.state.timerInterval);
    }

    this.showResults();
  }

  showResults() {
    this.showScreen('results-screen');

    // Calculate final results using scoring engine
    if (window.scoringEngine) {
      const results = scoringEngine.calculateFinalScore(this.state);
      this.finalResults = results; // Store for detailed feedback view
      this.displayResults(results);
    }
  }

  displayResults(results) {
    // Animate metrics counting up
    setTimeout(() => {
      this.animateResultsReveal(results);
    }, 2000);
  }

  animateResultsReveal(results) {
    const metricsContainer = document.getElementById('results-metrics');
    metricsContainer.innerHTML = `
      <div class="result-metric">
        <div class="result-metric-label">Revenue Growth</div>
        <div class="result-metric-value">${this.state.growth.toFixed(1)}%</div>
      </div>
      <div class="result-metric">
        <div class="result-metric-label">Team Morale</div>
        <div class="result-metric-value">${this.state.morale.toFixed(0)}%</div>
      </div>
      <div class="result-metric">
        <div class="result-metric-label">Staff Attrition</div>
        <div class="result-metric-value">${this.state.attrition.toFixed(0)}%</div>
      </div>
    `;

    setTimeout(() => {
      this.showOutcome(results);
    }, 1500);
  }

  showOutcome(results) {
    const outcomeContainer = document.getElementById('results-outcome');
    const success = results.escaped;

    outcomeContainer.innerHTML = `
      <div class="outcome-status ${success ? 'success' : 'failure'}">
        ${success ? '✓ TARGET MET' : 'X TARGET NOT MET'}
      </div>
      <div class="outcome-message">
        ${success ?
          `You achieved ${this.state.growth.toFixed(1)}% growth and met your target!` :
          `You achieved ${this.state.growth.toFixed(1)}% growth. Target was 20%.`}
      </div>
    `;

    setTimeout(() => {
      this.showLeadershipBreakdown(results);
    }, 1500);
  }

  showLeadershipBreakdown(results) {
    const breakdownContainer = document.getElementById('results-breakdown');
    breakdownContainer.innerHTML = this.renderLeadershipChart(results);

    setTimeout(() => {
      this.showFeedback(results);
    }, 2000);
  }

  renderLeadershipChart(results) {
    const styles = results.leadershipProfile;

    let html = '<div class="leadership-chart"><h3>YOUR LEADERSHIP STYLE PROFILE</h3>';

    Object.keys(styles).forEach(style => {
      const percentage = styles[style];
      const annotation = this.getStyleAnnotation(style, percentage);

      html += `
        <div class="leadership-bar">
          <div class="leadership-bar-label">
            <span class="leadership-bar-name">${this.capitalizeFirst(style)}</span>
            <span class="leadership-bar-percentage">${percentage}%</span>
          </div>
          <div class="leadership-bar-track">
            <div class="leadership-bar-fill" style="width: ${percentage}%"></div>
          </div>
          ${annotation ? `<div class="leadership-annotation">${annotation}</div>` : ''}
        </div>
      `;
    });

    html += `
      <div class="personality-color">
        <h4>YOUR LEADERSHIP COLOR: ${results.personalityColor}</h4>
        <p>${results.personalityDescription}</p>
      </div>
    </div>`;

    return html;
  }

  getStyleAnnotation(style, percentage) {
    if (percentage >= 60) return '⚠️ OVERUSED ⚠️';
    if (percentage <= 20) return '🔽 UNDERUSED 🔽';
    if (percentage >= 40) return '✅ PRIMARY';
    if (percentage >= 30) return '🔹 SECONDARY';
    return '';
  }

  showFeedback(results) {
    const feedbackContainer = document.getElementById('results-feedback');
    feedbackContainer.innerHTML = `
      <h3>RADICAL CANDOR FEEDBACK</h3>
      ${results.feedback}
      ${this.renderDevelopmentRecommendations(results.recommendations)}
    `;

    // Save to leaderboard
    this.saveToLeaderboard({
      name: this.state.playerName,
      growth: this.state.growth,
      leadershipStyle: this.getDominantStyleName(results.leadershipProfile),
      personalityColor: results.personalityColor,
      timestamp: Date.now()
    });

    // Reload leaderboard for next player
    this.loadLeaderboard();
  }

  renderDevelopmentRecommendations(recommendations) {
    if (!recommendations || recommendations.length === 0) return '';

    let html = '<div class="development-recommendations"><h4>YOUR DEVELOPMENT PRIORITIES</h4>';

    recommendations.forEach((rec, index) => {
      html += `
        <div class="recommendation-item">
          <h5>${index + 1}. ${rec.title}</h5>
          <p>${rec.description}</p>
        </div>
      `;
    });

    html += '</div>';
    return html;
  }

  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  getDominantStyleName(leadershipProfile) {
    // Sort styles by percentage (descending)
    const sortedStyles = Object.keys(leadershipProfile)
      .map(style => ({
        name: style,
        percentage: leadershipProfile[style]
      }))
      .sort((a, b) => b.percentage - a.percentage);

    const highest = sortedStyles[0].percentage;

    // If all styles are relatively even (none above 25%), it's truly balanced
    if (highest < 25) {
      return 'Agile Balanced Leadership';
    }

    // Collect styles within 10% of the highest
    const dominantStyles = sortedStyles
      .filter(style => style.percentage >= highest - 10 && style.percentage >= 20)
      .map(style => this.capitalizeFirst(style.name));

    // If 4+ styles are close, it's balanced leadership
    if (dominantStyles.length >= 4) {
      return 'Agile Balanced Leadership';
    }

    // If 2-3 styles are dominant, list them
    if (dominantStyles.length > 1) {
      return dominantStyles.join(' / ');
    }

    // Single dominant style
    return dominantStyles[0];
  }

  playRound2() {
    // Reset for round 2
    this.state.round = 2;
    this.state.currentScenario = 0;
    this.state.decisions = [];
    this.state.infoRequests = [];

    // Reset metrics but keep some impacts
    this.state.growth = 0;
    this.state.marketShare = 0;
    this.state.morale = 75;
    this.state.attrition = 5;

    // Reset leadership tracking
    Object.keys(this.state.leadershipStyles).forEach(style => {
      this.state.leadershipStyles[style] = 0;
    });

    this.state.timeRemaining = 900;

    alert('Round 2 will present new scenarios. Use what you learned!');
    this.startGameplay();
  }

  viewDetailedFeedback() {
    if (!this.finalResults) {
      alert('No results available');
      return;
    }

    const modal = document.getElementById('consequence-modal');
    const modalContent = modal.querySelector('.modal-content');

    // Build comprehensive detailed view
    let detailedView = '<h3>COMPREHENSIVE LEADERSHIP ANALYSIS</h3>';
    detailedView += '<div style="text-align: left; max-height: 70vh; overflow-y: auto;">';

    // Decision-by-Decision Breakdown
    detailedView += '<div style="margin-bottom: 30px; padding: 20px; background: rgba(255, 203, 0, 0.15); border-left: 4px solid var(--jcb-yellow);">';
    detailedView += '<h4 style="color: var(--jcb-yellow); margin-bottom: 20px;">DECISION-BY-DECISION ANALYSIS</h4>';

    this.state.decisions.forEach((decision, index) => {
      const scenario = this.scenarios[decision.scenario];
      
      detailedView += `<div style="margin-bottom: 25px; padding: 15px; background: rgba(0, 0, 0, 0.3); border-left: 3px solid rgba(225,203,0,0.5);">`;
      detailedView += `<h5 style="color: var(--jcb-yellow); margin-bottom: 10px;">Scenario ${index + 1}: ${decision.scenarioTitle||scenario.title}</h5>`;

      // Show leadership styles used
      if (decision.stylesUsed && decision.stylesUsed.length > 0) {
        const uniqueStyles = [...new Set(decision.stylesUsed)];
        detailedView += `<p style="margin-bottom: 8px;"><strong>Golenman Style(s):</strong> ${uniqueStyles.map(s => this.capitalizeFirst(s)).join(', ')}</p>`;
      }

      // Show personality colors used
      if (decision.colorsUsed && decision.colorsUsed.length > 0) {
        const uniqueColors = [...new Set(decision.colorsUsed)];
        const colorLabels = uniqueColors.map(c => {
          const label = this.getColorLabel(c);
          return `<span style="color: ${this.getColorHex(c)}; font-weight: bold;">${c} (${label})</span>`;
        }).join(', ');
        detailedView += `<p style="margin-bottom: 8px;"><strong>Personality Color(s):</strong> ${colorLabels}</p>`;
      }

      // Show impacts
        if (decision.impact) {
            const impact = decision.impact;
            detailedView += '<p style="margin-top: 10px; margin-bottom: 5px; font-size: 14px; color: rgba(255, 255, 255, 0.9);"><strong>Impact on Metrics:</strong></p>';
            detailedView += '<ul style="margin: 0; padding-left: 20px; font-size: 14px; color: rgba(255, 255, 255, 0.8);">';

            if (impact.growth) detailedView += `<li>Growth: ${impact.growth > 0 ? '+' : ''}${impact.growth.toFixed(1)}%</li>`;
            if (impact.morale) detailedView += `<li>Morale: ${impact.morale > 0 ? '+' : ''}${impact.morale.toFixed(0)}%</li>`;
            if (impact.attrition) detailedView += `<li>Attrition: ${impact.attrition > 0 ? '+' : ''}${impact.attrition.toFixed(0)}%</li>`;
            if (impact.profitMargin) detailedView += `<li>Profit Margin: ${impact.profitMargin > 0 ? '+' : ''}${impact.profitMargin.toFixed(0)}%</li>`;

            detailedView += '</ul>';

            // Show LEAD framework impacts
            const leadImpacts = [];
            if (impact.leadership) leadImpacts.push(`Leadership: +${impact.leadership}`);
            if (impact.excellence) leadImpacts.push(`Excellence: +${impact.excellence}`);
            if (impact.agility) leadImpacts.push(`Agility: +${impact.agility}`);
            if (impact.determination) leadImpacts.push(`Determination: +${impact.determination}`);

            if (leadImpacts.length > 0) {
                detailedView += `<p style="margin-top: 10px; font-size: 14px; color: rgba(255, 203, 0, 0.9);"><strong>JCB LEAD Framework:</strong> ${leadImpacts.join(' | ')}</p>`;
            }
        }

        detailedView += '</div>';
      });

        detailedView += '</div>';

        // JCB LEAD Framework Summary with North Star alignment
        detailedView += `<div style="margin-bottom: 30px; padding: 20px; background: rgba(255, 203, 0, 0.15); border-left: 4px solid var(--jcb-yellow);">`;
        detailedView += `<h4 style="color: var(--jcb-yellow); margin-bottom: 15px;">JCB LEAD FRAMEWORK PERFORMANCE</h4>`;

        detailedView += `<div style="margin-bottom: 5px; padding: 12px; background: rgba(0, 0, 0, 0.2);">`;
        detailedView += `<p><strong style="color: var(--jcb-yellow); font-size: 18px;">A</strong><strong>Leadership Quality: ${this.state.leadership} points</p>`;
        detailedView += `<p style="font-size: 13px; color: rgba(255,255,255,0.8); margin: 5px 0 0;">${this.getLeadFeedback('leadership', this.state.leadership)}</p>`;
        detailedView += `</div>`;

        detailedView += `<div style="margin-bottom: 5px; padding: 12px; background: rgba(0, 0, 0, 0.2);">`;
        detailedView += `<p><strong style="color: var(--jcb-yellow); font-size: 18px;">E</strong><strong>Excellence Standards: ${this.state.excellence} points</p>`;
        detailedView += `<p style="font-size: 13px; color: rgba(255,255,255,0.8); margin: 5px 0 0;">${this.getLeadFeedback('excellence', this.state.excellence)}</p>`;
        detailedView += `</div>`;

        detailedView += `<div style="margin-bottom: 5px; padding: 12px; background: rgba(0, 0, 0, 0.2);">`;
        detailedView += `<p><strong style="color: var(--jcb-yellow); font-size: 18px;">A</strong><strong>Agility & Adaptability: ${this.state.agility} points</p>`;
        detailedView += `<p style="font-size: 13px; color: rgba(255,255,255,0.8); margin: 5px 0 0;">${this.getLeadFeedback('agility', this.state.agility)}</p>`;
        detailedView += `</div>`;

        detailedView += `<div style="margin-bottom: 5px; padding: 12px; background: rgba(0, 0, 0, 0.2);">`;
        detailedView += `<p><strong style="color: var(--jcb-yellow); font-size: 18px;">D</strong><strong>Determination to Succeed: ${this.state.determination} points</p>`;
        detailedView += `<p style="font-size: 13px; color: rgba(255,255,255,0.8); margin: 5px 0 0;">${this.getLeadFeedback('determination', this.state.determination)}</p>`;
        detailedView += `</div>`;

        detailedView += '</div>';

        // Final Metrics
        detailedView += '<div style="margin-bottom: 30px; padding: 20px; background: rgba(255, 203, 0, 0.1); border-left: 4px solid var(--jcb-yellow);">';
        detailedView += '<h4 style="color: var(--jcb-yellow); margin-bottom: 15px;"><strong>Final Performance Metrics</h4>';
        detailedView += `<p><strong>Revenue Growth:</strong> ${this.state.growth.toFixed(1)}% (Target: 20%)</p>`;
        detailedView += `<p><strong>Team Morale:</strong> ${this.state.morale}%</p>`;
        detailedView += `<p><strong>Staff Attrition:</strong> ${this.state.attrition.toFixed(1)}%</p>`;
        detailedView += `<p><strong>Profit Margin:</strong> ${this.state.profitMargin}%</p>`;
        detailedView += `<p><strong>Market Share:</strong> ${this.state.marketShare.toFixed(1)}%</p>`;
        detailedView += '</div>';

        // Leadership Profile Breakdown
        detailedView += '<div style="margin-bottom: 30px; padding: 20px; background: rgba(255, 203, 0, 0.1); border-left: 4px solid var(--jcb-yellow);">';
        detailedView += '<h4 style="color: var(--jcb-yellow); margin-bottom: 15px;">Leadership Style Analysis (Goleman Framework)</h4>';
          Object.keys(this.finalResults.leadershipProfile).forEach(style => {
            const percentage = this.finalResults.leadershipProfile[style];
            let annotation = '';
            if (percentage >= 60) annotation = ' ▲ OVERUSED';
            else if (percentage >= 40) annotation = ' (Primary)';
            else if (percentage >= 30) annotation = ' (Secondary)';
            else if (percentage <= 20) annotation = ' (Underused)';

            detailedView += `<p><strong>${style.charAt(0).toUpperCase() + style.slice(1)}:</strong> ${percentage}%${annotation}</p>`;
        });
        detailedView += `<p style="margin-top: 15px;"><strong>Personality Color:</strong> ${this.finalResults.personalityColor}</p>`;
        detailedView += `<p style="margin-top: 15px; font-size: 14px; color: rgba(255,255,255,0.8);">${this.finalResults.personalityDescription}</p>`;
        detailedView += '</div>';

        // Information Requests
        if (this.state.infoRequests.length > 0) {
            detailedView += '<div style="margin-bottom: 30px; padding: 20px; background: rgba(255, 203, 0, 0.1); border-left: 4px solid var(--jcb-yellow);">';
            detailedView += '<h4 style="color: var(--jcb-yellow); margin-bottom: 15px;">Information Gathering Behavior</h4>';
            detailedView += `<p>You requested additional information ${this.state.infoRequests.length} times during the game.</p>`;
            detailedView += '<p style="font-size: 14px; color: rgba(255,255,255,0.8);">This demonstrates thoroughness in decision-making and willingness to seek data before acting.</p>';
            detailedView += '</div>';
        }

        // Full Feedback
        detailedView += `<div style="margin-bottom: 30px;">`;
        detailedView += this.finalResults.feedback;
        detailedView += `</div>`;

        // Development Recommendations
        if (this.finalResults.recommendations && this.finalResults.recommendations.length > 0) {
            detailedView += '<div style="margin-bottom: 20px; padding: 20px; background: rgba(255, 203, 0, 0.1); border-left: 4px solid var(--jcb-yellow);">';
            detailedView += '<h4 style="color: var(--jcb-yellow); margin-bottom: 15px;">Development Recommendations</h4>';
            this.finalResults.recommendations.forEach((rec, i) => {
                detailedView += `<p style="margin-bottom: 15px;"><strong>${i + 1}. ${rec.title}</strong><br/><span style="font-size: 14px; color: rgba(255,255,255,0.8);">${rec.description}</span></p>`;
            });
            detailedView += '</div>';
        }

        detailedView += '</div>';

        modalContent.innerHTML = detailedView + `
        <div class="modal-actions" style="margin-top: 30px;">
            <button class="btn-primary" onclick="game.closeConsequenceModal()" style="position: relative; z-index: 9999; pointer-events: auto;">CLOSE</button>
        </div>
        `;

        modal.classList.add('active');
    }

    getColorLabel(color) {
        const labels = {
            'RED': 'Driven',
            'BLUE': 'Analytical',
            'YELLOW': 'Collaborative',
            'GREEN': 'Supportive'
        };
        return labels[color] || color;
    }

    getColorHex(color) {
        const hexColors = {
            'RED': '#E31C23',
            'BLUE': '#0066CC',
            'YELLOW': '#FFCB00',
            'GREEN': '#008E4C'
        };
        return hexColors[color] || '#FFFFFF';
    }

    getLeadFeedback(attribute, score) {
        const feedback = {
            leadership: {
                high: "You demonstrated strong leadership by building positive relationships, showing commercial acumen, and considering the bigger picture. Your decisions showed courage in motivating and influencing your style to inspire and influence others.",
                medium: "You showed good leadership potential in some areas, particularly in decision-making and stakeholder management. To strengthen this, focus on building more inclusive relationships and consistently adapting style to inspire and influence others.",
                low: "Your leadership decisions were primarily transactional. To develop JCB leadership qualities, focus on: building positive relationships within and outside the organization, demonstrating commercial acumen by operating as if it's your own company, and being more ethical and sustainable in addressing both praise and performance issues."
            },
            excellence: {
                high: "You exemplified excellence through emotional intelligence, critical thinking, and informed decision-making. Your self-awareness and willingness to make courageous, data-driven decisions while owning outcomes demonstrated mature leadership.",
                medium: "You showed good analytical capability in some decisions. To reach excellence, develop stronger self-awareness of your shadow as a leader, improve critical thinking by balancing short-term priorities with long-term strategic goals, and be more courageous in speaking up and learning from mistakes.",
                low: "Your decisions lacked the critical thinking and emotional intelligence that define excellence at JCB. Focus on: developing self-awareness of your strengths and development areas, making more informed data-driven decisions, owning your choices, and creating allies by standing by others even when they're not present."
            },
            agility: {
                high: "You demonstrated exceptional agility by navigating ambiguity, adapting quickly to changing situations, and showing resilience in the face of setbacks. Your proactive approach and creative problem-solving reflected JCB's values of not giving up and moving quickly.",
                medium: "You showed some adaptability but could improve in handling ambiguity and recovering from setbacks. To strengthen agility, be more pragmatic in driving change quickly, don't overthink in evolving situations, and be more proactive in taking initiative without being asked.",
                low: "Your decisions showed rigidity when faced with ambiguity and change. To develop agility: practice handling unclear situations without all the information, consider VUCA (volatility, uncertainty, complexity, ambiguity) impacts, build resilience to recover from setbacks, and take more initiative proactively."
            },
            determination: {
                high: "You displayed relentless determination through your drive to excel, growth mindset, and willingness to innovate. Your passion for achieving goals, openness to feedback, and view of failure as a learning opportunity embodied JCB's values.",
                medium: "You showed drive in pursuing goals but could demonstrate more determination. To improve: communicate more openly and frequently, actively seek feedback to improve performance, challenge the way things are done more often, and maintain a more positive outlook when facing challenges.",
                low: "Your approach lacked the relentless determination to learn and grow that JCB values. Focus on: developing a stronger growth mindset, fostering continuous learning opportunities, innovating by challenging established ways, accepting that failure from innovation is a learning tool, and being a more positive thinking performer."
            }
        };

        const category = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low';
        return feedback[attribute][category];
    }

    restart() {
        location.reload();
    }
}

// Initialize game immediately
const game = new GameEngine();
window.game = game; // Make it globally available

window.addEventListener('DOMContentLoaded', () => {
    game.init();
});