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
            profitMargin: 20,
            morale: 65,  // UPDATED 2026-05-17: Reduced from 75 to 65 (inherited team with challenges)
            attrition: 10,  // UPDATED 2026-05-17: Increased from 5 to 10 (realistic industry baseline)

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
            organizationalCapability: 75, // Starting baseline - existing team capability

            criticalThinking: 0,
            teamImpact: 0,

            // Decision tracking
            decisions: [],
            infoRequests: [],

            // CRITICAL FIX #2: Delayed Payoffs Tracking
            // Strategic investments (R&D, dealer relationships) pay off in later months
            delayedGrowthPayoffs: [], // Array of {amount: X, triggerScenario: Y}

            // Timing
            startTime: null,
            timeRemaining: 900, // 15 minutes in seconds
            timerInterval: null,

            // Submission control
            isSubmitting: false
        };

        this.scenarios = null; // Will be loaded from scenarios.js
        this.finalResults = null; // BUGFIX: Initialize to prevent "No results available" error
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
            container.innerHTML = '<div class="leaderboard-empty">No players yet.<br/>Be the first to lead!</div>';
            return;
        }

        container.innerHTML = leaderboardData.map((player, index) => {
            // Status badge
            const statusBadge = player.optimal ? '✅ OPTIMAL' :
                                player.escaped ? '🎯 TARGET MET' :
                                '❌ MISSED TARGET';
            const statusClass = player.optimal ? 'optimal' :
                                player.escaped ? 'escaped' :
                                'failed';

            // LEAD total
            const leadTotal = (player.leadership || 0) + (player.excellence || 0) +
                             (player.agility || 0) + (player.determination || 0);

            return `
            <div class="leaderboard-item leaderboard-item-compact">
                <div class="leaderboard-rank">${index + 1}</div>
                <div class="leaderboard-player-info">
                    <div class="leaderboard-name">${player.name}</div>
                    <div style="display: flex; gap: 10px; align-items: center; margin-top: 5px;">
                        <div class="leaderboard-status ${statusClass}">${statusBadge}</div>
                        <button class="btn-secondary" style="padding: 4px 12px; font-size: 11px;" onclick="game.viewPlayerFeedback(${index})">
                            📊 VIEW FEEDBACK
                        </button>
                    </div>
                </div>
                <div class="leaderboard-metrics">
                    <div class="leaderboard-metrics-row">
                        <span class="metric-label">Growth:</span> <span class="metric-value">${player.growth.toFixed(1)}%</span>
                        <span class="metric-label">Capability:</span> <span class="metric-value">${(player.organizationalCapability || 75).toFixed(0)}</span>
                        <span class="metric-label">Morale:</span> <span class="metric-value">${(player.morale || 0).toFixed(0)}%</span>
                        <span class="metric-label">Attrition:</span> <span class="metric-value">${(player.attrition || 0).toFixed(0)}%</span>
                    </div>
                    <div class="leaderboard-metrics-row">
                        <span class="metric-label">LEAD:</span>
                        <span class="metric-value">L:${player.leadership || 0} E:${player.excellence || 0} A:${player.agility || 0} D:${player.determination || 0}</span>
                        <span class="metric-total">(Total: ${leadTotal})</span>
                    </div>
                </div>
                <div class="leaderboard-profile">
                    <div class="leaderboard-style">
                        <span class="style-icon">👤</span> ${player.leadershipStyle}
                    </div>
                    <div class="leaderboard-color">
                        <span class="color-badge color-${player.personalityColor?.toLowerCase() || 'balanced'}">${player.personalityColor || 'BALANCED'}</span>
                    </div>
                </div>
                <div class="leaderboard-improvement">
                    <div class="improvement-label">🎯 Key Development:</div>
                    <div class="improvement-text">${player.criticalImprovement || 'Continue developing leadership skills'}</div>
                </div>
            </div>
        `}).join('');
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
        document.getElementById('metric-profit').textContent =
            `${this.state.profitMargin.toFixed(0)}%`;
        document.getElementById('metric-attrition').textContent =
            `${this.state.attrition.toFixed(0)}%`;
        document.getElementById('metric-capability').textContent =
            `${this.state.organizationalCapability.toFixed(0)} pts`;

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

    adaptScenarioToState(scenario) {
        // Adapt scenarios based on current game state performance
        const state = this.state;

        // TALENT EXODUS - Only trigger if morale/attrition are actually poor
        if (scenario.id === 'talent_exodus') {
            const moraleThreshold = 65;
            const attritionThreshold = 12;

            if (state.morale >= moraleThreshold && state.attrition < attritionThreshold) {
                // Good performance - change to minor retention challenge
                scenario.description = `Your team is performing well overall (morale: ${Math.round(state.morale)}%, attrition: ${Math.round(state.attrition)}%). However, one regional sales manager has expressed interest in external opportunities, citing career growth concerns. This is a normal retention challenge, not a crisis. How do you proactively address it?`;

                // Adjust root cause options
                scenario.decisions[0].options = [
                    { text: 'Proactive career development conversations with key performers', impact: 'development', style: 'coaching', color: 'GREEN' },
                    { text: 'Review compensation to ensure competitiveness', impact: 'external', style: 'authoritative', color: 'BLUE' },
                    { text: 'Create more stretch assignments and growth opportunities', impact: 'development', style: 'coaching', color: 'GREEN' }
                ];
            } else if (state.morale < moraleThreshold && state.attrition >= attritionThreshold) {
                // Poor performance - keep original crisis scenario but make it clear
                scenario.description = `Your top-performing regional sales manager just resigned, citing "unsustainable pressure and lack of support." Two other high-performers are rumored to be interviewing elsewhere. Team attrition is now at ${Math.round(state.attrition)}% (healthy is <10%) and morale is ${Math.round(state.morale)}% (concerning). You've hit ${state.growth.toFixed(1)}% growth but at what cost? An anonymous employee survey reveals burnout and feeling undervalued.`;
            } else {
                // Mixed performance - moderate scenario
                scenario.description = `A valued regional sales manager has resigned, citing work-life balance concerns. While team morale (${Math.round(state.morale)}%) and attrition (${Math.round(state.attrition)}%) are in acceptable ranges, this departure has raised questions about your leadership approach. How do you respond?`;
            }
        }

        // DIFFICULT CONVERSATION - Adapt severity based on morale
        if (scenario.id === 'difficult_conversation') {
            if (state.morale >= 75) {
                // High morale - make it about coaching excellence, not crisis
                scenario.description = `Your team is thriving overall (morale: ${Math.round(state.morale)}%). However, one senior team member (20 years at JCB) is underperforming at 25% below target for two quarters. They're respected and well-liked, but their team's morale is starting to drop. This is about elevating performance, not damage control.`;
            } else if (state.morale < 60) {
                // Low morale - make it a symptom of broader issues
                scenario.description = `Your team morale is at ${Math.round(state.morale)}%, and now a senior team member (20 years at JCB) is underperforming at 25% below target. Others wonder if this is a sign of broader problems. This conversation could be a turning point - will you address only the individual, or the systemic issues?`;
            }
        }

        // AMBIGUOUS SIGNAL - Adapt based on growth trajectory
        if (scenario.id === 'ambiguous_signal') {
            if (state.growth > 15) {
                // Strong growth - frame as maintaining momentum
                scenario.description = `Despite strong growth of ${state.growth.toFixed(1)}%, your sales team reports that customer sentiment is "changing" but can't pinpoint why. Sales velocity has slowed 8% month-over-month. You need to address this before it impacts your momentum.

**Sales Director:** "Competitor launched new hydraulic feature we don't have"
**Finance Director:** "Economic uncertainty making buyers delay decisions"
**Your gut:** "Our team's approach has gone stale - we're not listening to customers"

Data is incomplete and contradictory. Your CFO demands immediate action. Your strategy lead wants 3 weeks to research properly.`;
            } else if (state.growth < 10) {
                // Poor growth - frame as critical pivot point
                scenario.description = `Your growth is only ${state.growth.toFixed(1)}%, well below target, and now customer sentiment is "changing." Sales velocity has slowed another 8%. You can't afford to get this wrong.

**Sales Director:** "Competitor launched new hydraulic feature we don't have"
**Finance Director:** "Economic uncertainty making buyers delay decisions"
**Your gut:** "Our team's approach has gone stale - we're not listening to customers"

Data is incomplete. Every week of delay costs £50K in lost sales. What do you do?`;
            }
        }

        // NEW: COMPETITOR THREAT - Adapt based on prior growth achievement
        if (scenario.id === 'competitor_threat') {
            if (state.growth > 15) {
                // Strong growth - competitor targets YOUR success
                scenario.description = `You've achieved strong ${state.growth.toFixed(1)}% growth, which has drawn competitive attention. A major competitor just announced aggressive price cuts (15% below JCB) and exclusive dealer incentives. They're specifically targeting YOUR top accounts.

Your Board wants immediate response. You have £2.5M to allocate. How do you defend your position?`;
            } else if (state.growth < 10) {
                // Poor growth - you're already vulnerable
                scenario.description = `Your growth is struggling at ${state.growth.toFixed(1)}%, and now a major competitor announces aggressive price cuts (15% below JCB) and exclusive dealer incentives. You're already behind - this could be devastating.

Your Board is concerned. You have £2.5M to allocate. How do you respond?`;
            }
        }

        // NEW: INNOVATION GAMBLE - Adapt based on team capacity (morale/attrition)
        if (scenario.id === 'innovation_gamble') {
            if (state.morale > 75 && state.attrition < 10) {
                // Strong team - ready for bold moves
                scenario.description = `Your energized team (morale: ${Math.round(state.morale)}%, attrition: ${Math.round(state.attrition)}%) has developed a revolutionary hydraulic innovation 9 months ahead of schedule. Market testing shows 40% efficiency gain - unprecedented. Board is thrilled but cautious.

**Engineering:** "Ready now - we've tested it thoroughly"
**Sales:** "Dealers want it immediately"
**Manufacturing:** "12-week delay gives us time to scale properly"
**CFO:** "Early launch = £8M revenue this year, delayed launch = £2M risk if competitor beats us"

Your team has the energy for a sprint. When do you launch?`;
            } else if (state.morale < 65 || state.attrition > 15) {
                // Exhausted team - risky to push them
                scenario.description = `Your exhausted team (morale: ${Math.round(state.morale)}%, attrition: ${Math.round(state.attrition)}%) has developed a hydraulic innovation that shows promise. Market testing suggests strong potential, but your people are burned out.

**Engineering:** "We can rush it, but we're stretched thin"
**Sales:** "Dealers want it, but honestly, our team needs a break"
**Manufacturing:** "We NEED 12 weeks to do this right and not kill our people"
**CFO:** "Early launch = £8M revenue this year, but if we break the team, what's next year worth?"

Your team is fragile. When do you launch?`;
            }
        }

        // NEW: SAFETY CRISIS - Acknowledge if player has pattern of coercive/pacesetting leadership
        if (scenario.id === 'safety_crisis') {
            // Count aggressive decisions in scenarios 1-2
            const priorDecisions = state.decisions.slice(0, 2);
            const aggressiveCount = priorDecisions.filter(d =>
                d.stylesUsed && (d.stylesUsed.includes('pacesetting') || d.stylesUsed.includes('coercive'))
            ).length;

            if (aggressiveCount >= 2) {
                // Pattern of pressure - make that explicit
                scenario.description = `After months of aggressive targets and pressure to deliver (growth: ${state.growth.toFixed(1)}%), a forklift operator at your Leicester depot suffered serious injuries loading equipment. Initial investigation suggests corners were cut to meet deadlines. HSE is investigating.

Your team is shaken. Some privately wonder if the relentless pace you set contributed to this. What's your response?`;
            }
        }
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

        // Reset submission flag for new scenario
        this.state.isSubmitting = false;

        this.state.currentScenario = scenarioIndex;
        const scenario = this.scenarios[scenarioIndex];

        // Adapt scenario based on current game state
        this.adaptScenarioToState(scenario);

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
                Budget Remaining: £${sliders[0].budgetConstraint}M
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
            const sliders = document.querySelectorAll(`input.slider[data-decision="${decisionIndex}"]`);
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
            const sliders = document.querySelectorAll(`input.slider[data-decision="${decisionIndex}"]`);
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
        // Prevent multiple submissions
        if (this.state.isSubmitting) {
            console.log('Submission already in progress, ignoring duplicate click');
            return;
        }

        const scenario = this.scenarios[this.state.currentScenario];

        console.log('Submit button clicked for scenario:', scenario.id);
        console.log('Scenario decisions count:', scenario.decisions.length);

        // Validate all decisions have been made
        if (!this.validateAllDecisionsMade(scenario)) {
            console.log('Validation failed: Not all decisions made');
            alert('Please make all decisions before continuing.');
            return;
        }

        console.log('All decisions validated successfully');

        // Validate budget constraints before submitting
        if (!this.validateBudgetConstraints(scenario)) {
            console.log('Validation failed: Budget constraint exceeded');
            alert('You have exceeded the allocated budget. Please adjust your spending allocation.');
            return;
        }

        console.log('Budget constraints validated successfully');

        // Set submitting flag to prevent duplicate submissions
        this.state.isSubmitting = true;

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

    validateAllDecisionsMade(scenario) {
        // Check each decision to ensure it has been made
        for (let decisionIndex = 0; decisionIndex < scenario.decisions.length; decisionIndex++) {
            const decision = scenario.decisions[decisionIndex];

            console.log(`Checking decision ${decisionIndex}: ${decision.title}, type: ${decision.type}`);

            switch (decision.type) {
                case 'choice':
                    const selected = document.querySelector(`.choice-option.selected[data-decision="${decisionIndex}"]`);
                    if (!selected) {
                        console.log(`Decision ${decisionIndex} (${decision.title}) - NO SELECTION FOUND`);
                        return false;
                    }
                    console.log(`Decision ${decisionIndex} - Choice selected`);
                    break;

                case 'slider':
                    // Sliders have default values, so they're always "made"
                    console.log(`Decision ${decisionIndex} - Slider (auto-valid)`);
                    break;

                case 'ranking':
                    // Rankings are pre-populated, so they're always "made"
                    console.log(`Decision ${decisionIndex} - Ranking (auto-valid)`);
                    break;

                case 'timeline':
                    // Timeline sliders have default values, so they're always "made"
                    console.log(`Decision ${decisionIndex} - Timeline (auto-valid)`);
                    break;
            }
        }

        return true;
    }

    validateBudgetConstraints(scenario) {
        // Check all slider-based decisions for budget constraints
        for (let decisionIndex = 0; decisionIndex < scenario.decisions.length; decisionIndex++) {
            const decision = scenario.decisions[decisionIndex];

            if (decision.type === 'slider' && decision.sliders[0].budgetConstraint) {
                const sliders = document.querySelectorAll(`input.slider[data-decision="${decisionIndex}"]`);
                let total = 0;

                sliders.forEach(slider => {
                    total += parseFloat(slider.value) / 10;
                });

                const budgetLimit = decision.sliders[0].budgetConstraint;

                console.log(`Budget validation - Decision ${decisionIndex}: total = ${total.toFixed(2)}, limit = ${budgetLimit}`);

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

            // BUGFIX 2026-05-17: Calculate organizational capability impact BEFORE storing
            // So it can be displayed in decision-by-decision feedback (like growth, morale, etc.)
            let capabilityGain = 0;

            // Calculate from leadership styles (coaching/democratic/affiliative)
            // BALANCING 2026-05-17: Reduced multipliers by 90% to prevent excessive accumulation
            // Goal: 6 coaching scenarios (18 parts) should give ~90 points (starting 75 + 90 = 165, just above 150 threshold)
            if (impact.leadershipStyles) {
                Object.keys(impact.leadershipStyles).forEach(style => {
                    if (style === 'coaching') {
                        capabilityGain += impact.leadershipStyles[style] * 0.25;  // Was 2.5 (10x reduction)
                    } else if (style === 'democratic') {
                        capabilityGain += impact.leadershipStyles[style] * 0.15;  // Was 1.5 (10x reduction)
                    } else if (style === 'affiliative') {
                        capabilityGain += impact.leadershipStyles[style] * 0.10;  // Was 1.0 (10x reduction)
                    }
                });
            }

            // Add explicit capability bonuses from specific decisions (training programs, etc.)
            if (impact.organizationalCapability) {
                capabilityGain += impact.organizationalCapability;
            }

            // Store total capability gain in impact object for display
            if (capabilityGain > 0) {
                impact.organizationalCapability = capabilityGain;
            }

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
                    if (option) {
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
            this.state.profitMargin += impact.profitMargin || 0;
            this.state.morale += impact.morale || 0;
            this.state.attrition += impact.attrition || 0;

            // REALISM CHECK: High attrition should damage remaining team morale
            // If attrition is high, it creates anxiety and reduces morale of those who remain
            if (this.state.attrition > 12) {
                const attritionMoralePenalty = Math.floor((this.state.attrition - 12) * 0.5);
                this.state.morale -= attritionMoralePenalty;
                console.log(`High attrition (${this.state.attrition.toFixed(0)}%) reduced morale by ${attritionMoralePenalty}%`);
            }

            // Similarly, very high morale should reduce attrition somewhat
            if (this.state.morale > 80 && this.state.attrition > 0) {
                const moraleRetentionBonus = Math.floor((this.state.morale - 80) * 0.1);
                this.state.attrition -= moraleRetentionBonus;
                console.log(`High morale (${this.state.morale.toFixed(0)}%) reduced attrition by ${moraleRetentionBonus}%`);
            }

            // PROFIT MARGIN REALISM: Link to attrition, morale, and growth
            // High attrition costs money (recruitment, training, knowledge loss)
            if (this.state.attrition > 15) {
                const attritionProfitPenalty = (this.state.attrition - 15) * 0.3;
                this.state.profitMargin -= attritionProfitPenalty;
                console.log(`High attrition (${this.state.attrition.toFixed(0)}%) reduced profit margin by ${attritionProfitPenalty.toFixed(1)}%`);
            }

            // Low morale reduces productivity and profit
            if (this.state.morale < 60) {
                const moraleProfitPenalty = (60 - this.state.morale) * 0.2;
                this.state.profitMargin -= moraleProfitPenalty;
                console.log(`Low morale (${this.state.morale.toFixed(0)}%) reduced profit margin by ${moraleProfitPenalty.toFixed(1)}%`);
            }

            // High growth can improve profit margin (economies of scale)
            if (this.state.growth > 25) {
                const growthProfitBonus = (this.state.growth - 25) * 0.15;
                this.state.profitMargin += growthProfitBonus;
                console.log(`High growth (${this.state.growth.toFixed(1)}%) improved profit margin by ${growthProfitBonus.toFixed(1)}%`);
            }

            // Update leadership style tracking
            if (impact.leadershipStyles) {
                Object.keys(impact.leadershipStyles).forEach(style => {
                    this.state.leadershipStyles[style] += impact.leadershipStyles[style];
                });
            }

            // Apply organizational capability (already calculated above and stored in impact.organizationalCapability)
            if (impact.organizationalCapability) {
                this.state.organizationalCapability += impact.organizationalCapability;
            }

            // Update quality metrics
            this.state.leadership += impact.leadership || 0;
            this.state.excellence += impact.excellence || 0;
            this.state.agility += impact.agility || 0;
            this.state.determination += impact.determination || 0;

            // CRITICAL FIX #2: Handle Delayed Payoffs
            // Strategic investments (R&D, dealer relationships) tracked for future benefit
            if (impact.delayedGrowth) {
                this.state.delayedGrowthPayoffs.push({
                    amount: impact.delayedGrowth,
                    triggerScenario: impact.delayedGrowth.triggerScenario || (this.state.currentScenario + 2) // Default: 2 scenarios later
                });
                console.log(`📅 Delayed growth payoff scheduled: +${impact.delayedGrowth}% growth at scenario ${impact.delayedGrowth.triggerScenario || (this.state.currentScenario + 2)}`);
            }

            // Apply any delayed payoffs that trigger at current scenario
            const currentScenario = this.state.currentScenario;
            const payoffsToApply = this.state.delayedGrowthPayoffs.filter(p => p.triggerScenario <= currentScenario);

            if (payoffsToApply.length > 0) {
                const totalDelayedGrowth = payoffsToApply.reduce((sum, p) => sum + p.amount, 0);
                this.state.growth += totalDelayedGrowth;
                console.log(`✅ STRATEGIC INVESTMENT PAYOFF: +${totalDelayedGrowth.toFixed(1)}% growth from prior R&D/dealer investments`);

                // Remove applied payoffs
                this.state.delayedGrowthPayoffs = this.state.delayedGrowthPayoffs.filter(p => p.triggerScenario > currentScenario);
            }

            // Bounds checking for visible metrics
            this.state.morale = Math.max(0, Math.min(100, this.state.morale));
            this.state.attrition = Math.max(0, Math.min(100, this.state.attrition));

            // Prevent LEAD scores from going negative
            this.state.leadership = Math.max(0, this.state.leadership);
            this.state.excellence = Math.max(0, this.state.excellence);
            this.state.agility = Math.max(0, this.state.agility);
            this.state.determination = Math.max(0, this.state.determination);

            // Profit margin should have reasonable bounds (can't be <0 or >100)
            this.state.profitMargin = Math.max(0, Math.min(100, this.state.profitMargin));
        }
    }

    applyLEADMultipliers() {
        // CRITICAL FIX: LEAD competencies should amplify business outcomes
        // AND poor LEAD competencies should penalize outcomes (unsustainable approaches)

        // Calculate LEAD performance ratios vs benchmarks
        // BENCHMARKS UPDATED 2026-05-16: Set to realistic values based on actual maximum achievable points
        // These represent "good but not perfect" performance (~70% of maximum per scenario)
        const benchmarks = {
            leadership: 25,    // Max ~35 per scenario, benchmark = 70% of max
            excellence: 35,    // Max ~50 per scenario, benchmark = 70% of max
            agility: 15,       // Max ~22 per scenario, benchmark = 70% of max
            determination: 20  // Max ~28 per scenario, benchmark = 70% of max
        };
        const avgScenarios = 6;

        const leadRatios = {
            leadership: (this.state.leadership / avgScenarios) / benchmarks.leadership,
            excellence: (this.state.excellence / avgScenarios) / benchmarks.excellence,
            agility: (this.state.agility / avgScenarios) / benchmarks.agility,
            determination: (this.state.determination / avgScenarios) / benchmarks.determination
        };

        // Calculate average LEAD quality (across all 4 dimensions)
        const avgLEADRatio = (leadRatios.leadership + leadRatios.excellence + leadRatios.agility + leadRatios.determination) / 4;

        console.log('=== LEAD MULTIPLIERS & PENALTIES ===');
        console.log(`Leadership ratio: ${leadRatios.leadership.toFixed(2)} (${(this.state.leadership / avgScenarios).toFixed(0)} vs ${benchmarks.leadership})`);
        console.log(`Excellence ratio: ${leadRatios.excellence.toFixed(2)} (${(this.state.excellence / avgScenarios).toFixed(0)} vs ${benchmarks.excellence})`);
        console.log(`Agility ratio: ${leadRatios.agility.toFixed(2)} (${(this.state.agility / avgScenarios).toFixed(0)} vs ${benchmarks.agility})`);
        console.log(`Determination ratio: ${leadRatios.determination.toFixed(2)} (${(this.state.determination / avgScenarios).toFixed(0)} vs ${benchmarks.determination})`);
        console.log(`Average LEAD quality: ${avgLEADRatio.toFixed(2)}`);

        // BONUSES: Apply LEAD-based multipliers to business outcomes
        // UPDATED 2026-05-17: Reduced by 75% to ensure realistic outcomes

        // 1. DETERMINATION drives GROWTH (determined leaders push for results)
        if (leadRatios.determination > 0.8) {
            const determinationBonus = (leadRatios.determination - 0.8) * 2; // REDUCED from 8 to 2 (max +2% growth)
            this.state.growth += determinationBonus;
            console.log(`✅ Determination bonus: +${determinationBonus.toFixed(1)}% growth`);
        }

        // 2. LEADERSHIP quality improves MORALE (people follow great leaders)
        if (leadRatios.leadership > 0.8) {
            const leadershipMoraleBonus = (leadRatios.leadership - 0.8) * 3; // REDUCED from 10 to 3 (max +3% morale)
            this.state.morale += leadershipMoraleBonus;
            console.log(`✅ Leadership morale bonus: +${leadershipMoraleBonus.toFixed(1)}% morale`);
        }

        // 3. EXCELLENCE reduces ATTRITION (good decision-making retains talent)
        if (leadRatios.excellence > 0.8) {
            const excellenceRetention = (leadRatios.excellence - 0.8) * 2; // REDUCED from 5 to 2 (max -2% attrition)
            this.state.attrition -= excellenceRetention;
            console.log(`✅ Excellence retention: -${excellenceRetention.toFixed(1)}% attrition`);
        }

        // 4. AGILITY improves PROFIT MARGIN (adaptability optimizes operations)
        if (leadRatios.agility > 0.8) {
            const agilityProfitBonus = (leadRatios.agility - 0.8) * 1; // REDUCED from 3 to 1 (max +1% profit margin)
            this.state.profitMargin += agilityProfitBonus;
            console.log(`✅ Agility profit bonus: +${agilityProfitBonus.toFixed(1)}% profit margin`);
        }

        // NEW: PENALTIES for poor LEAD quality (enforcement mechanism)
        // If average LEAD ratio < 0.5 (significantly below benchmark), apply sustainability penalties

        if (avgLEADRatio < 0.5) {
            // Poor leadership quality causes compounding problems
            const leadDeficit = 0.5 - avgLEADRatio; // How far below 50% of benchmark

            console.log(`⚠️ LOW LEAD QUALITY DETECTED (${(avgLEADRatio * 100).toFixed(0)}% of benchmark)`);

            // Penalty 1: Attrition increases (poor leadership drives talent away)
            const attritionPenalty = leadDeficit * 12; // Up to +6% attrition if LEAD ratio is 0
            this.state.attrition += attritionPenalty;
            console.log(`❌ Poor leadership attrition penalty: +${attritionPenalty.toFixed(1)}% attrition`);

            // Penalty 2: Morale decreases (people feel the pressure/lack of support)
            const moralePenalty = leadDeficit * 16; // Up to -8% morale
            this.state.morale -= moralePenalty;
            console.log(`❌ Poor leadership morale penalty: -${moralePenalty.toFixed(1)}% morale`);

            // Penalty 3: Growth degrades (unsustainable approaches fail to compound)
            // Even if you hit targets early, poor LEAD quality means execution degrades
            const growthPenalty = leadDeficit * 10; // Up to -5% growth
            this.state.growth -= growthPenalty;
            console.log(`❌ Unsustainable execution penalty: -${growthPenalty.toFixed(1)}% growth`);

            // Penalty 4: Profit margin suffers (firefighting, inefficiency, mistakes)
            const profitPenalty = leadDeficit * 6; // Up to -3% profit margin
            this.state.profitMargin -= profitPenalty;
            console.log(`❌ Poor decision quality penalty: -${profitPenalty.toFixed(1)}% profit margin`);
        }

        // NEW: SEVERE PENALTIES for extremely poor LEAD quality (< 0.3 of benchmark)
        if (avgLEADRatio < 0.3) {
            // This represents truly terrible leadership - near-certain failure
            console.log(`⚠️ EXTREMELY POOR LEAD QUALITY (${(avgLEADRatio * 100).toFixed(0)}% of benchmark) - SEVERE PENALTIES`);

            // Additional attrition from toxic environment
            this.state.attrition += 8;
            console.log(`❌ Toxic environment attrition: +8% attrition`);

            // Additional morale collapse
            this.state.morale -= 12;
            console.log(`❌ Leadership crisis morale collapse: -12% morale`);
        }

        // CRITICAL FIX #1: Team Health Multipliers (from AUDIT #4)
        // High-performing teams with strong morale and low attrition deliver superior results
        // This makes team health strategically valuable (fixes "balanced leader fails" bug)

        console.log('=== APPLYING TEAM HEALTH MULTIPLIERS ===');
        console.log(`Pre-multiplier - Growth: ${this.state.growth.toFixed(1)}%, Morale: ${this.state.morale.toFixed(0)}%, Attrition: ${this.state.attrition.toFixed(1)}%`);

        // Apply caps BEFORE multipliers to get accurate team health state
        let cappedMorale = Math.max(0, Math.min(95, this.state.morale));
        let cappedAttrition = Math.max(5, Math.min(100, this.state.attrition));

        // Check for exceptional team health (high morale + low attrition)
        if (cappedMorale >= 85 && cappedAttrition < 8) {
            // High-performing teams deliver 35% more results due to:
            // - Discretionary effort from engaged employees
            // - Lower friction/coordination costs
            // - Knowledge retention and compound learning
            const teamHealthMultiplier = 1.35;
            const growthBefore = this.state.growth;
            this.state.growth = this.state.growth * teamHealthMultiplier;
            console.log(`✅ EXCEPTIONAL TEAM HEALTH: ${teamHealthMultiplier}x growth multiplier (+${(this.state.growth - growthBefore).toFixed(1)}% growth)`);
            console.log(`   Morale: ${cappedMorale}% (≥85%), Attrition: ${cappedAttrition.toFixed(1)}% (<8%)`);
        } else if (cappedMorale >= 75 && cappedAttrition < 12) {
            // Healthy teams deliver 15% more results
            const teamHealthMultiplier = 1.15;
            const growthBefore = this.state.growth;
            this.state.growth = this.state.growth * teamHealthMultiplier;
            console.log(`✅ Healthy team multiplier: ${teamHealthMultiplier}x growth (+${(this.state.growth - growthBefore).toFixed(1)}% growth)`);
        }

        // CRITICAL FIX #4: Attrition Mechanically Constrains Growth
        // You cannot grow revenue with no employees (fixes "100% attrition wins" bug)
        if (cappedAttrition > 50) {
            // Severe talent hemorrhage prevents execution
            const attritionDrag = 0.5; // 50% reduction in growth capability
            const growthBefore = this.state.growth;
            this.state.growth = this.state.growth * attritionDrag;
            console.log(`❌ SEVERE ATTRITION PENALTY: ${cappedAttrition.toFixed(1)}% attrition → 50% growth reduction (-${(growthBefore - this.state.growth).toFixed(1)}% growth)`);
        } else if (cappedAttrition > 30) {
            // High attrition creates execution gaps
            const attritionDrag = 0.75; // 25% reduction in growth capability
            const growthBefore = this.state.growth;
            this.state.growth = this.state.growth * attritionDrag;
            console.log(`❌ High attrition penalty: ${cappedAttrition.toFixed(1)}% attrition → 25% growth reduction (-${(growthBefore - this.state.growth).toFixed(1)}% growth)`);
        }

        // Check for team collapse (morale <40% OR attrition >40%)
        if (cappedMorale < 40 || cappedAttrition > 40) {
            // Team collapse: Organization in crisis, execution severely impaired
            const crisisMultiplier = 0.5; // 50% reduction in growth
            const growthBefore = this.state.growth;
            this.state.growth = this.state.growth * crisisMultiplier;
            console.log(`❌ TEAM COLLAPSE: ${crisisMultiplier}x growth multiplier (-${(growthBefore - this.state.growth).toFixed(1)}% growth)`);
            console.log(`   Morale: ${cappedMorale}% (<40%), Attrition: ${cappedAttrition.toFixed(1)}% (>40%)`);
        }

        // CRITICAL FIX #3: Morale Cap Waste → Productivity Bonus
        // Excess morale above 95% converts to productivity (fixes "wasted people investment" bug)
        // Every 10 points of excess morale = 1% additional growth
        if (this.state.morale > 95) {
            const excessMorale = this.state.morale - 95;
            const productivityBonus = excessMorale * 0.1; // 10 morale = 1% growth
            this.state.growth += productivityBonus;
            console.log(`✅ Excess morale productivity bonus: ${excessMorale.toFixed(0)} excess morale → +${productivityBonus.toFixed(1)}% growth`);
        }

        // Re-apply bounds after multipliers and penalties
        // UPDATED 2026-05-17: Realistic caps for executive credibility
        this.state.morale = Math.max(0, Math.min(95, this.state.morale)); // Cap at 95% - 100% morale is impossible
        this.state.attrition = Math.max(5, Math.min(100, this.state.attrition)); // Minimum 5% - natural turnover (retirement, relocation, etc.)
        this.state.profitMargin = Math.max(0, Math.min(100, this.state.profitMargin));
        this.state.growth = Math.max(0, this.state.growth); // Growth can't go negative but no upper cap

        console.log('=== FINAL METRICS AFTER LEAD MULTIPLIERS ===');
        console.log(`Growth: ${this.state.growth.toFixed(1)}%`);
        console.log(`Morale: ${this.state.morale.toFixed(0)}%`);
        console.log(`Attrition: ${this.state.attrition.toFixed(1)}%`);
        console.log(`Profit Margin: ${this.state.profitMargin.toFixed(1)}%`);
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

        // Reset submitting flag to allow next scenario submission
        this.state.isSubmitting = false;

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

        // CRITICAL: Apply LEAD multipliers BEFORE calculating final score
        // This ensures LEAD competencies actually impact business outcomes
        this.applyLEADMultipliers();

        // Calculate final results using scoring engine
        if (window.scoringEngine) {
            console.log('Calculating final results...');
            try {
                const results = scoringEngine.calculateFinalScore(this.state);
                console.log('Results calculated:', results);
                this.finalResults = results; // Store for detailed feedback view
                console.log('this.finalResults set to:', this.finalResults);
                this.displayResults(results);
            } catch (error) {
                console.error('ERROR in calculateFinalScore:', error);
                console.error('Error message:', error.message);
                console.error('Error stack:', error.stack);
                alert('Error calculating results: ' + error.message);
            }
        } else {
            console.error('CRITICAL: window.scoringEngine is not defined!');
            alert('Error: Scoring engine not loaded. Please refresh the page.');
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
                <div class="result-metric-label">Organizational Capability</div>
                <div class="result-metric-value">${this.state.organizationalCapability.toFixed(0)}</div>
            </div>
            <div class="result-metric">
                <div class="result-metric-label">Team Morale</div>
                <div class="result-metric-value">${this.state.morale.toFixed(0)}%</div>
            </div>
            <div class="result-metric">
                <div class="result-metric-label">Staff Attrition</div>
                <div class="result-metric-value">${this.state.attrition.toFixed(0)}%</div>
            </div>
            <div class="result-metric">
                <div class="result-metric-label">Profit Margin</div>
                <div class="result-metric-value">${this.state.profitMargin.toFixed(1)}%</div>
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
                ${success ? '✓ TARGET MET' : '✗ TARGET NOT MET'}
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
        if (percentage >= 60) return '← OVERUSED ⚠️';
        if (percentage <= 20) return '← UNDERUSED';
        if (percentage >= 40) return '← PRIMARY';
        if (percentage >= 30) return '← SECONDARY';
        return '';
    }

    showFeedback(results) {
        const feedbackContainer = document.getElementById('results-feedback');

        // Extract critical improvement
        const criticalImprovement = this.extractCriticalImprovement(results);

        feedbackContainer.innerHTML = `
            <div class="most-important-improvement-highlight" style="background: linear-gradient(135deg, rgba(255, 203, 0, 0.2) 0%, rgba(255, 203, 0, 0.05) 100%); border: 3px solid var(--jcb-yellow); border-radius: 12px; padding: 25px; margin-bottom: 30px; text-align: center;">
                <div style="font-size: 14px; color: rgba(255, 255, 255, 0.7); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">Your #1 Development Priority</div>
                <h2 style="color: var(--jcb-yellow); margin: 0 0 15px 0; font-size: 24px;">🎯 MOST IMPORTANT IMPROVEMENT</h2>
                <div style="font-size: 18px; line-height: 1.6; color: white;">${criticalImprovement}</div>
            </div>
            <h3>RADICAL CANDOR FEEDBACK</h3>
            ${results.feedback}
            ${this.renderLEADScoreBreakdown(results)}
            ${this.renderDevelopmentRecommendations(results.recommendations)}
        `;

        // Save to leaderboard with comprehensive data
        this.saveToLeaderboard({
            name: this.state.playerName,
            // Game metrics
            growth: this.state.growth,
            morale: this.state.morale,
            attrition: this.state.attrition,
            profitMargin: this.state.profitMargin,
            // LEAD scores
            leadership: this.state.leadership,
            excellence: this.state.excellence,
            agility: this.state.agility,
            determination: this.state.determination,
            organizationalCapability: this.state.organizationalCapability,
            // Leadership analysis
            leadershipStyle: this.getDominantStyleName(results.leadershipProfile),
            leadershipProfile: results.leadershipProfile, // Full style distribution
            leadershipStyles: this.state.leadershipStyles, // Raw style points
            personalityColor: results.personalityColor,
            personalityDescription: results.personalityDescription,
            // Result status
            escaped: results.escaped,
            optimal: results.optimal,
            // Critical improvement (extract first sentence for compact display)
            criticalImprovement: this.extractCriticalImprovement(results),
            // Full decision history for culture analysis and detailed feedback
            decisions: this.state.decisions,
            infoRequests: this.state.infoRequests,
            selfIdentifiedStyle: this.state.selfIdentifiedStyle,
            round: this.state.round,
            // Store full results for detailed feedback reconstruction
            feedback: results.feedback,
            recommendations: results.recommendations,
            leadRatios: results.leadRatios,
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

    renderLEADScoreBreakdown(results) {
        // UPDATED 2026-05-17: TRUE MAXIMUM values calculated from code analysis
        // These represent the absolute maximum achievable points across all 6 scenarios
        // Excellence reduced from 495 to 300 to reflect realistic information gathering
        // (495 assumed requesting ALL info in ALL scenarios, which is analysis paralysis)
        const maximums = {
            leadership: 267,      // True maximum from optimal choices across 6 scenarios
            excellence: 300,      // Recalibrated - realistic info requests (not exhaustive)
            agility: 155,         // True maximum from optimal choices across 6 scenarios
            determination: 212    // True maximum from optimal choices across 6 scenarios
        };

        // Track cumulative totals
        const cumulativeScores = {
            leadership: this.state.leadership || 0,
            excellence: this.state.excellence || 0,
            agility: this.state.agility || 0,
            determination: this.state.determination || 0
        };

        let html = '<div class="lead-score-breakdown" style="margin: 30px 0; padding: 25px; background: rgba(0, 0, 0, 0.3); border-radius: 12px;">';
        html += '<h3 style="color: var(--jcb-yellow); margin-top: 0;">YOUR LEAD FRAMEWORK SCORES</h3>';
        html += '<p style="color: rgba(255, 255, 255, 0.7); margin-bottom: 20px;">Your performance across all scenarios</p>';

        html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">';

        Object.keys(maximums).forEach(dimension => {
            const totalScore = cumulativeScores[dimension];
            const maximum = maximums[dimension];
            const percentOfMaximum = ((totalScore / maximum) * 100).toFixed(0);
            const performanceColor = percentOfMaximum >= 70 ? '#00D084' :
                                    percentOfMaximum >= 50 ? '#FFCB00' : '#FFA500';

            html += `
                <div style="background: rgba(255, 255, 255, 0.05); padding: 20px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1);">
                    <div style="font-size: 16px; color: var(--jcb-yellow); margin-bottom: 10px; text-transform: uppercase; font-weight: bold;">${dimension}</div>
                    <div style="font-size: 32px; font-weight: bold; color: white; margin: 10px 0;">${totalScore}</div>
                    <div style="font-size: 14px; color: rgba(255, 255, 255, 0.6); margin-bottom: 8px;">out of ${maximum} maximum</div>
                    <div style="font-size: 18px; font-weight: bold; color: ${performanceColor};">${percentOfMaximum}%</div>
                </div>
            `;
        });

        html += '</div>';

        // Overall assessment
        const totalScore = Object.values(cumulativeScores).reduce((a, b) => a + b, 0);
        const totalMaximum = Object.values(maximums).reduce((a, b) => a + b, 0);
        const overallPercentage = ((totalScore / totalMaximum) * 100).toFixed(0);

        html += '<div style="margin-top: 20px; padding: 15px; background: rgba(255, 203, 0, 0.1); border-left: 4px solid var(--jcb-yellow); border-radius: 4px;">';
        html += `<strong>Overall LEAD Score:</strong> ${totalScore} out of ${totalMaximum} maximum → `;
        html += `<span style="color: #00D084;">${overallPercentage}% of maximum achievable</span>`;
        html += '</div>';

        html += '</div>';
        return html;
    }

    extractCriticalImprovement(results) {
        // Extract the critical improvement from the feedback
        // The "Most Important Improvement" section is in the feedback HTML
        const feedbackHTML = results.feedback;

        // Look for the Most Important Improvement section
        const improvementMatch = feedbackHTML.match(/🎯 Most Important Improvement:<\/h4>[\s\S]*?<p[^>]*>(.*?)<\/p>/);

        if (improvementMatch && improvementMatch[1]) {
            // Remove HTML tags and get first sentence
            let improvement = improvementMatch[1]
                .replace(/<[^>]*>/g, '') // Remove HTML tags
                .replace(/&nbsp;/g, ' ') // Replace &nbsp;
                .trim();

            // BUGFIX 2026-05-17: Get first sentence (period not followed by digit to avoid truncating decimals like "11.2%")
            // Old regex /^[^.]+\./ would match "but 11." and cut off at decimal point
            // New regex /^.+?\.(?!\d)/ uses negative lookahead to skip decimals
            const firstSentence = improvement.match(/^.+?\.(?!\d)/);
            if (firstSentence) {
                return firstSentence[0];
            }

            // Fallback: truncate at 150 chars
            if (improvement.length > 150) {
                return improvement.substring(0, 147) + '...';
            }

            return improvement;
        }

        return 'Continue developing balanced leadership';
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

    viewDetailedFeedback() {
        try {
            console.log('=== viewDetailedFeedback called ===');
            console.log('this:', this);
            console.log('this.finalResults:', this.finalResults);
            console.log('typeof this.finalResults:', typeof this.finalResults);

            if (!this.finalResults) {
                console.error('CRITICAL: this.finalResults is undefined!');
                console.log('this.state:', this.state);
                console.log('window.game:', window.game);
                console.log('window.game.finalResults:', window.game ? window.game.finalResults : 'N/A');
                alert('No results available. Please complete the game first.');
                return;
            }

            const modal = document.getElementById('consequence-modal');
            if (!modal) {
                alert('Modal element not found. Please refresh the page.');
                console.error('consequence-modal element not found');
                return;
            }

            const modalContent = modal.querySelector('.modal-content');
            if (!modalContent) {
                alert('Modal content element not found. Please refresh the page.');
                console.error('.modal-content element not found');
                return;
            }

            // Get scenarios from window object
            const allScenarios = this.state.round === 1 ?
                (window.scenarios?.round1 || []) :
                (window.scenarios?.round2 || window.round2Scenarios || []);

        // Build comprehensive detailed view
        let detailedView = '<h3>COMPREHENSIVE LEADERSHIP ANALYSIS</h3>';
        detailedView += '<div style="text-align: left; max-height: 70vh; overflow-y: auto;">';

        // Decision-by-Decision Breakdown
        detailedView += '<div style="margin-bottom: 30px; padding: 20px; background: rgba(255, 203, 0, 0.15); border-left: 4px solid var(--jcb-yellow);">';
        detailedView += '<h4 style="color: var(--jcb-yellow); margin-bottom: 20px;">DECISION-BY-DECISION ANALYSIS</h4>';

        this.state.decisions.forEach((decision, index) => {
            const scenario = allScenarios[decision.scenario];

            detailedView += `<div style="margin-bottom: 25px; padding: 15px; background: rgba(0, 0, 0, 0.3); border-left: 3px solid rgba(255, 203, 0, 0.5);">`;
            detailedView += `<h5 style="color: var(--jcb-yellow); margin-bottom: 10px;">Scenario ${index + 1}: ${decision.scenarioTitle || (scenario ? scenario.title : 'Unknown Scenario')}</h5>`;

            // Show leadership styles used
            if (decision.stylesUsed && decision.stylesUsed.length > 0) {
                const uniqueStyles = [...new Set(decision.stylesUsed)];
                detailedView += `<p style="margin-bottom: 8px;"><strong>Goleman Style(s):</strong> ${uniqueStyles.map(s => this.capitalizeFirst(s)).join(', ')}</p>`;
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
                if (impact.organizationalCapability && impact.organizationalCapability > 0) {
                    detailedView += `<li>Organizational Capability: +${impact.organizationalCapability.toFixed(0)} points</li>`;
                }

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
        detailedView += '<div style="margin-bottom: 30px; padding: 20px; background: rgba(255, 203, 0, 0.15); border-left: 4px solid var(--jcb-yellow);">';
        detailedView += '<h4 style="color: var(--jcb-yellow); margin-bottom: 15px;">JCB LEAD FRAMEWORK PERFORMANCE</h4>';

        detailedView += `<div style="margin-bottom: 15px; padding: 12px; background: rgba(0, 0, 0, 0.2);">`;
        detailedView += `<p style="margin-bottom: 5px;"><strong style="color: var(--jcb-yellow); font-size: 18px;">L</strong>eadership Quality: ${this.state.leadership} points</p>`;
        detailedView += `<p style="font-size: 13px; color: rgba(255,255,255,0.8); margin: 5px 0 0 0;">${this.getLeadFeedback('leadership', this.state.leadership)}</p>`;
        detailedView += `</div>`;

        detailedView += `<div style="margin-bottom: 15px; padding: 12px; background: rgba(0, 0, 0, 0.2);">`;
        detailedView += `<p style="margin-bottom: 5px;"><strong style="color: var(--jcb-yellow); font-size: 18px;">E</strong>xcellence Standards: ${this.state.excellence} points</p>`;
        detailedView += `<p style="font-size: 13px; color: rgba(255,255,255,0.8); margin: 5px 0 0 0;">${this.getLeadFeedback('excellence', this.state.excellence)}</p>`;
        detailedView += `</div>`;

        detailedView += `<div style="margin-bottom: 15px; padding: 12px; background: rgba(0, 0, 0, 0.2);">`;
        detailedView += `<p style="margin-bottom: 5px;"><strong style="color: var(--jcb-yellow); font-size: 18px;">A</strong>gility & Adaptability: ${this.state.agility} points</p>`;
        detailedView += `<p style="font-size: 13px; color: rgba(255,255,255,0.8); margin: 5px 0 0 0;">${this.getLeadFeedback('agility', this.state.agility)}</p>`;
        detailedView += `</div>`;

        detailedView += `<div style="margin-bottom: 15px; padding: 12px; background: rgba(0, 0, 0, 0.2);">`;
        detailedView += `<p style="margin-bottom: 5px;"><strong style="color: var(--jcb-yellow); font-size: 18px;">D</strong>etermination to Succeed: ${this.state.determination} points</p>`;
        detailedView += `<p style="font-size: 13px; color: rgba(255,255,255,0.8); margin: 5px 0 0 0;">${this.getLeadFeedback('determination', this.state.determination)}</p>`;
        detailedView += `</div>`;

        detailedView += '</div>';

        // Final Metrics
        detailedView += '<div style="margin-bottom: 30px; padding: 20px; background: rgba(255, 203, 0, 0.1); border-left: 4px solid var(--jcb-yellow);">';
        detailedView += '<h4 style="color: var(--jcb-yellow); margin-bottom: 15px;">Final Performance Metrics</h4>';
        detailedView += `<p><strong>Revenue Growth:</strong> ${this.state.growth.toFixed(1)}% (Target: 20%)</p>`;

        // Morale with explanatory note if at cap
        if (this.state.morale >= 95) {
            detailedView += `<p><strong>Team Morale:</strong> ${this.state.morale.toFixed(0)}% <span style="font-size: 13px; color: rgba(255,255,255,0.7);">(maximum achievable - top 1% of organizations)</span></p>`;
        } else {
            detailedView += `<p><strong>Team Morale:</strong> ${this.state.morale.toFixed(0)}%</p>`;
        }

        // Attrition with explanatory note if at minimum
        if (this.state.attrition <= 5) {
            detailedView += `<p><strong>Staff Attrition:</strong> ${this.state.attrition.toFixed(1)}% <span style="font-size: 13px; color: rgba(255,255,255,0.7);">(minimum achievable - reflects natural turnover: retirement, relocation, etc.)</span></p>`;
        } else {
            detailedView += `<p><strong>Staff Attrition:</strong> ${this.state.attrition.toFixed(1)}%</p>`;
        }

        detailedView += `<p><strong>Profit Margin:</strong> ${this.state.profitMargin.toFixed(1)}%</p>`;
        if (this.state.organizationalCapability > 0) {
            detailedView += `<p><strong>Organizational Capability:</strong> ${this.state.organizationalCapability.toFixed(0)} points</p>`;
        }
        detailedView += '</div>';

        // Leadership Profile Breakdown
        detailedView += '<div style="margin-bottom: 30px; padding: 20px; background: rgba(255, 203, 0, 0.1); border-left: 4px solid var(--jcb-yellow);">';
        detailedView += '<h4 style="color: var(--jcb-yellow); margin-bottom: 15px;">Leadership Style Analysis (Goleman Framework)</h4>';
        Object.keys(this.finalResults.leadershipProfile).forEach(style => {
            const percentage = this.finalResults.leadershipProfile[style];
            let annotation = '';
            if (percentage >= 60) annotation = ' ⚠️ OVERUSED';
            else if (percentage >= 40) annotation = ' (Primary)';
            else if (percentage >= 30) annotation = ' (Secondary)';
            else if (percentage <= 20) annotation = ' (Underused)';

            detailedView += `<p><strong>${style.charAt(0).toUpperCase() + style.slice(1)}:</strong> ${percentage}%${annotation}</p>`;
        });
        detailedView += `<p style="margin-top: 15px;"><strong>Personality Color:</strong> ${this.finalResults.personalityColor}</p>`;
        detailedView += `<p style="font-size: 14px; color: rgba(255,255,255,0.8);">${this.finalResults.personalityDescription}</p>`;
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
        detailedView += '<div style="margin-bottom: 30px;">';
        detailedView += this.finalResults.feedback;
        detailedView += '</div>';

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
        } catch (error) {
            console.error('Error in viewDetailedFeedback:', error);
            alert('An error occurred while loading detailed feedback. Please check the console for details.\n\nError: ' + error.message);
        }
    }

    viewPlayerFeedback(playerIndex) {
        try {
            const leaderboardData = this.getLeaderboardData();
            const player = leaderboardData[playerIndex];

            if (!player) {
                alert('Player data not found.');
                return;
            }

            // Reconstruct finalResults from stored player data
            const reconstructedResults = {
                escaped: player.escaped,
                optimal: player.optimal,
                leadershipProfile: player.leadershipProfile || {},
                personalityColor: player.personalityColor,
                personalityDescription: player.personalityDescription,
                feedback: player.feedback || '',
                recommendations: player.recommendations || [],
                leadRatios: player.leadRatios || {}
            };

            // Reconstruct state from stored player data
            const reconstructedState = {
                growth: player.growth,
                morale: player.morale,
                attrition: player.attrition,
                profitMargin: player.profitMargin,
                leadership: player.leadership,
                excellence: player.excellence,
                agility: player.agility,
                determination: player.determination,
                organizationalCapability: player.organizationalCapability || 0,
                infoRequests: player.infoRequests || [],
                decisions: player.decisions || [],
                leadershipStyles: player.leadershipStyles || {},
                round: player.round || 1
            };

            // Temporarily store current state
            const originalState = this.state;
            const originalResults = this.finalResults;

            // Replace with player's data
            this.state = reconstructedState;
            this.finalResults = reconstructedResults;

            // Call existing viewDetailedFeedback method
            this.viewDetailedFeedback();

            // Restore original state
            this.state = originalState;
            this.finalResults = originalResults;

        } catch (error) {
            console.error('Error in viewPlayerFeedback:', error);
            alert('An error occurred while loading player feedback. Error: ' + error.message);
        }
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
                high: "You demonstrated strong leadership by building positive relationships, showing commercial acumen, and considering the bigger picture. Your decisions showed courage in motivating and influencing your team while adapting your style to different situations.",
                medium: "You showed leadership potential in some areas, particularly in decision-making and stakeholder management. To strengthen this, focus on building more inclusive relationships and consistently adapting your style to inspire and influence others.",
                low: "Your leadership decisions were primarily transactional. To develop JCB leadership qualities, focus on: building positive relationships within and outside the organization, demonstrating commercial acumen by operating as if it's your own company, and being more ethical and sustainable in addressing both praise and performance issues."
            },
            excellence: {
                high: "You exemplified excellence through emotional intelligence, critical thinking, and informed decision-making. Your self-awareness and willingness to make courageous, data-driven decisions while owning the outcomes demonstrated mature leadership.",
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

    // COMPANY CULTURE ANALYSIS METHODS
    showCultureDashboard() {
        const leaderboard = this.getLeaderboardData();

        if (!window.CultureAnalysis) {
            alert('Culture analysis engine not loaded. Please refresh the page.');
            return;
        }

        const analyzer = new window.CultureAnalysis();
        const analysis = analyzer.analyzeCulture(leaderboard);

        if (analysis.error) {
            alert(analysis.message + '\n\nCurrent player count: ' + analysis.playerCount);
            return;
        }

        this.renderCultureDashboard(analysis);
        this.showScreen('culture-dashboard-screen');
    }

    renderCultureDashboard(analysis) {
        const container = document.getElementById('culture-content');

        let html = '';

        // Executive Summary Card
        html += '<div class="culture-summary-card">';
        html += `<h2>Executive Summary</h2>`;
        html += `<p style="margin-bottom: 20px; color: rgba(255, 255, 255, 0.85); line-height: 1.6;">This dashboard analyzes the collective leadership culture of your team based on ${analysis.playerCount} completed simulations. Scores compare your team's average performance against high-performance benchmarks.</p>`;
        html += `<div class="culture-stat-row">`;
        html += `<div class="culture-stat"><span class="culture-stat-label">Players Analyzed:</span><span class="culture-stat-value">${analysis.playerCount}</span></div>`;
        html += `<div class="culture-stat"><span class="culture-stat-label">Success Rate:</span><span class="culture-stat-value">${analysis.metrics.successRate.toFixed(0)}%</span></div>`;
        html += `<div class="culture-stat"><span class="culture-stat-label">Performance Level:</span><span class="culture-stat-value">${analysis.comparisonToHighPerformance.performanceLevel}</span></div>`;
        html += `<div class="culture-stat"><span class="culture-stat-label">Estimated Percentile:</span><span class="culture-stat-value" title="Estimated ranking compared to other companies (50th = average, 90th = top 10%)">${analysis.comparisonToHighPerformance.percentileEstimate}th</span></div>`;
        html += `</div>`;
        html += '</div>';

        // Aggregate Metrics
        html += '<div class="culture-section">';
        html += '<h2>📊 Aggregate Performance Metrics</h2>';
        html += '<div class="culture-metrics-grid">';
        html += `<div class="culture-metric-card">
            <div class="culture-metric-label">Average Growth</div>
            <div class="culture-metric-value ${analysis.metrics.avgGrowth >= 20 ? 'success' : 'warning'}">${analysis.metrics.avgGrowth.toFixed(1)}%</div>
            <div class="culture-metric-target">Target: 20%</div>
        </div>`;
        html += `<div class="culture-metric-card">
            <div class="culture-metric-label">Average Morale</div>
            <div class="culture-metric-value ${analysis.metrics.avgMorale >= 70 ? 'success' : 'warning'}">${analysis.metrics.avgMorale.toFixed(0)}%</div>
            <div class="culture-metric-target">Healthy: 70%+</div>
        </div>`;
        html += `<div class="culture-metric-card">
            <div class="culture-metric-label">Average Attrition</div>
            <div class="culture-metric-value ${analysis.metrics.avgAttrition < 15 ? 'success' : 'warning'}">${analysis.metrics.avgAttrition.toFixed(1)}%</div>
            <div class="culture-metric-target">Healthy: <15%</div>
        </div>`;
        html += `<div class="culture-metric-card">
            <div class="culture-metric-label">Optimal Rate</div>
            <div class="culture-metric-value">${analysis.metrics.optimalRate.toFixed(0)}%</div>
            <div class="culture-metric-target">% of players who achieved optimal</div>
        </div>`;
        html += '</div>';
        html += '</div>';

        // Leadership Style Distribution
        html += '<div class="culture-section">';
        html += '<h2>👥 Leadership Style Distribution</h2>';
        html += `<div class="culture-diversity-score ${analysis.leadership.balanced ? 'success' : 'warning'}">`;
        html += `<strong>Diversity Index:</strong> ${(analysis.leadership.diversity * 100).toFixed(0)}%`;
        html += `(${analysis.leadership.balanced ? 'BALANCED ✓' : 'NEEDS IMPROVEMENT'})`;
        html += `</div>`;
        html += '<div class="culture-style-bars">';

        Object.entries(analysis.leadership.aggregate).forEach(([style, percentage]) => {
            const warning = (style === 'pacesetting' && percentage > 30) || (style === 'coaching' && percentage < 15);
            html += `<div class="culture-style-bar">`;
            html += `<div class="culture-style-label">${this.capitalizeFirst(style)}</div>`;
            html += `<div class="culture-style-track">`;
            html += `<div class="culture-style-fill ${warning ? 'warning' : ''}" style="width: ${percentage}%"></div>`;
            html += `</div>`;
            html += `<div class="culture-style-percentage">${percentage.toFixed(0)}%</div>`;
            html += `</div>`;
        });

        html += '</div>';
        html += `<p class="culture-insight"><strong>Most Used:</strong> ${this.capitalizeFirst(analysis.leadership.mostUsed[0])} (${analysis.leadership.mostUsed[1].toFixed(0)}%) | `;
        html += `<strong>Least Used:</strong> ${this.capitalizeFirst(analysis.leadership.leastUsed[0])} (${analysis.leadership.leastUsed[1].toFixed(0)}%)</p>`;
        html += '</div>';

        // LEAD Scores
        html += '<div class="culture-section">';
        html += '<h2>🎯 LEAD Framework Scores</h2>';
        html += '<div class="culture-lead-grid">';
        html += this.renderLEADComparison('Leadership', analysis.lead.avgLeadership, 75);
        html += this.renderLEADComparison('Excellence', analysis.lead.avgExcellence, 65);
        html += this.renderLEADComparison('Agility', analysis.lead.avgAgility, 45);
        html += this.renderLEADComparison('Determination', analysis.lead.avgDetermination, 40);
        html += '</div>';
        html += '</div>';

        // Strengths
        if (analysis.strengths.length > 0) {
            html += '<div class="culture-section culture-strengths">';
            html += '<h2>✅ Cultural Strengths</h2>';
            analysis.strengths.forEach(strength => {
                html += `<div class="culture-strength-card">`;
                html += `<h3>${strength.area}</h3>`;
                html += `<div class="culture-strength-score">${strength.score}</div>`;
                html += `<p>${strength.insight}</p>`;
                html += `</div>`;
            });
            html += '</div>';
        }

        // Weaknesses
        if (analysis.weaknesses.length > 0) {
            html += '<div class="culture-section culture-weaknesses">';
            html += '<h2>⚠️ Cultural Weaknesses</h2>';
            analysis.weaknesses.forEach(weakness => {
                html += `<div class="culture-weakness-card">`;
                html += `<h3>${weakness.area}</h3>`;
                html += `<div class="culture-weakness-score">${weakness.score} <span class="culture-gap">${weakness.gap}</span></div>`;
                html += `<p>${weakness.insight}</p>`;
                html += `</div>`;
            });
            html += '</div>';
        }

        // Cultural Risks
        if (analysis.culturalRisks.length > 0) {
            html += '<div class="culture-section culture-risks">';
            html += '<h2>🚨 Cultural Risks</h2>';
            analysis.culturalRisks.forEach(risk => {
                const severityClass = risk.severity === 'CRITICAL' ? 'critical' : risk.severity === 'HIGH' ? 'high' : 'medium';
                html += `<div class="culture-risk-card ${severityClass}">`;
                html += `<div class="culture-risk-header">`;
                html += `<h3>${risk.risk}</h3>`;
                html += `<span class="culture-risk-severity">${risk.severity}</span>`;
                html += `</div>`;
                html += `<p><strong>Detail:</strong> ${risk.detail}</p>`;
                html += `<p><strong>Consequence:</strong> ${risk.consequence}</p>`;
                html += `</div>`;
            });
            html += '</div>';
        }

        // Recommendations
        if (analysis.recommendations.length > 0) {
            html += '<div class="culture-section culture-recommendations">';
            html += '<h2>💡 Prioritized Recommendations</h2>';
            analysis.recommendations.forEach((rec, index) => {
                const displayPriority = index + 1; // Use index for display (1, 2, 3...)
                html += `<div class="culture-rec-card priority-${displayPriority}">`;
                html += `<div class="culture-rec-header">`;
                html += `<h3><span class="culture-rec-number">Priority ${displayPriority}</span> ${rec.title}</h3>`;
                html += `</div>`;
                html += `<div class="culture-rec-body">`;
                html += `<h4>Actions:</h4>`;
                html += `<ul>`;
                rec.actions.forEach(action => {
                    html += `<li>${action}</li>`;
                });
                html += `</ul>`;
                html += `<p><strong>Timeline:</strong> ${rec.timeline}</p>`;
                html += `<p><strong>Expected Impact:</strong> ${rec.expectedImpact}</p>`;
                html += `</div>`;
                html += `</div>`;
            });
            html += '</div>';
        }

        container.innerHTML = html;
    }

    renderLEADComparison(dimension, avgScore, benchmark) {
        const gap = avgScore - benchmark;
        const gapClass = gap >= 0 ? 'positive' : 'negative';
        const gapText = gap >= 0 ? `+${gap.toFixed(0)}` : gap.toFixed(0);

        return `
            <div class="culture-lead-card">
                <div class="culture-lead-dimension">${dimension}</div>
                <div class="culture-lead-scores">
                    <div class="culture-lead-current" title="Average team score">${avgScore.toFixed(0)}</div>
                    <div class="culture-lead-vs">vs benchmark</div>
                    <div class="culture-lead-benchmark" title="High-performance benchmark score">${benchmark}</div>
                </div>
                <div class="culture-lead-gap ${gapClass}">${gapText} points</div>
            </div>
        `;
    }
}

// Initialize game immediately
const game = new GameEngine();
window.game = game; // Make it globally available

window.addEventListener('DOMContentLoaded', () => {
    game.init();
});
