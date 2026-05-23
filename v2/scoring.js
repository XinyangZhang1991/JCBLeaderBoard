  // Scoring Engine - Calculates decision impacts and final results

class ScoringEngine {
    constructor() {
        this.styleWeights = {
            coercive: 0,
            authoritative: 0,
            affiliative: 0,
            democratic: 0,
            pacesetting: 0,
            coaching: 0
        };
    } 

    calculateDecisionImpact(scenario, decision, gameState) {
        const impact = {
            growth: 0,
            profitMargin: 0,
            morale: 0,
            attrition: 0,
            leadershipStyles: { ...this.styleWeights },
            leadership: 0,
            excellence: 0,
            agility: 0,
            determination: 0
        };

        // Scenario-specific impact calculations
        switch (scenario.id) {
            case 'inheritance':
                this.scoreInheritance(scenario, decision, impact, gameState);
                break;
            case 'data_dilemma':
                this.scoreDataDilemma(scenario, decision, impact, gameState);
                break;
            case 'safety_crisis':
                this.scoreSafetyCrisis(scenario, decision, impact, gameState);
                break;
            case 'ambiguous_signal':
                this.scoreAmbiguousSignal(scenario, decision, impact, gameState);
                break;
            case 'competitor_threat':
                this.scoreCompetitorThreat(scenario, decision, impact, gameState);
                break;
            case 'talent_exodus':
                this.scoreTalentExodus(scenario, decision, impact, gameState);
                break;
            case 'difficult_conversation':
                this.scoreDifficultConversation(scenario, decision, impact, gameState);
                break;
            case 'innovation_gamble':
                this.scoreInnovationGamble(scenario, decision, impact, gameState);
                break;
            case 'year_end':
                this.scoreYearEnd(scenario, decision, impact, gameState);
                break;
            // Round 2 scenarios
            case 'merger_integration':
                this.scoreMergerIntegration(scenario, decision, impact, gameState);
                break;
            case 'ethical_dilemma':
                this.scoreEthicalDilemma(scenario, decision, impact, gameState);
                break;
            case 'remote_work_debate':
                this.scoreRemoteWorkDebate(scenario, decision, impact, gameState);
                break;
            case 'succession_crisis':
                this.scoreSuccessionCrisis(scenario, decision, impact, gameState);
                break;
            case 'market_disruption':
                this.scoreMarketDisruption(scenario, decision, impact, gameState);
                break;
            case 'year_end_round2':
                this.scoreYearEndRound2(scenario, decision, impact, gameState);
                break;
        }

        // CRITICAL: Apply LEAD-based modifiers to reward high company values
        this.applyLEADModifiers(impact, gameState);

        return impact;
    }

  applyLEADModifiers(impact, gameState) {
    // Calculate LEAD strength (0-1 scale)
    // High LEAD scores should buffer negative impacts and amplify positive ones
    const totalLEAD = gameState.leadership + gameState.excellence + gameState.agility + gameState.determination;
    const leadStrength = Math.min(totalLEAD / 200, 1); // 200 is "excellent" total LEAD

    // Calculate balance (0-1 scale)
    const styles = Object.values(gameState.leadershipStyles);
    const total = styles.reduce((a, b) => a + b, 0);
    let balanceStrength = 0;
    if (total > 0) {
      const maxStyle = Math.max(...styles);
      const maxPercentage = (maxStyle / total) * 100;
            // More balanced = higher strength (60% max → 1.0, 100% max → 0.0)
      balanceStrength = Math.max(0, (100 - maxPercentage) / 40);
    }

    // Combined modifier: LEAD quality + leadership balance
    const qualityModifier = (leadStrength * 0.6) + (balanceStrength * 0.4);

    // 1. Buffer negative attrition impacts (high LEAD reduces people leaving)
    if (impact.attrition > 0) {
      const buffer = qualityModifier * 0.4; // Up to 40% reduction
      impact.attrition *= (1 - buffer);
      console.log(`LEAD buffer reduced attrition from ${impact.attrition/(1-buffer)} to ${impact.attrition}`);
    }

    // 2. Buffer negative morale impacts (high LEAD maintains culture)
    if (impact.morale < 0) {
      const buffer = qualityModifier * 0.3; // Up to 30% reduction
      impact.morale *= (1 - buffer);
      console.log(`LEAD buffer reduced morale penalty from ${impact.morale/(1-buffer)} to ${impact.morale}`);
    }

    // 3. Amplify positive growth (high LEAD makes good decisions even better)
    if (impact.growth > 0) {
      const amplifier = qualityModifier * 0.25; // Up to 25% boost
      impact.growth *= (1 + amplifier);
      console.log(`LEAD amplified growth from ${impact.growth/(1+amplifier)} to ${impact.growth}`);
    }

    // 4. Amplify positive morale (high LEAD makes team-building more effective)
    if (impact.morale > 0) {
      const amplifier = qualityModifier * 0.2; // Up to 20% boost
      impact.morale *= (1 + amplifier);
    }

    // 5. Reduce negative growth impacts (high LEAD provides resilience)
    if (impact.growth < 0) {
      const buffer = qualityModifier * 0.2; // Up to 20% reduction
      impact.growth *= (1 - buffer);
    }
  }

  scoreInheritance(scenario, decision, impact, gameState) {
    // CRITICAL FIX: Award Excellence points for info requests WITH decision-to-info mapping
    if (decision.infoRequested && decision.infoRequested.length > 0) {
      const decisionChoice = decision.choices[0].index; // Which initiative they cut

      decision.infoRequested.forEach(info => {
        // Base points for requesting info (research habit)
                let points = 0;
        if (info.type === 'useful') {
          points = 8; // Base for useful
        } else if (info.type === 'red_herring') {
          points = 2; // Minimal for irrelevant
        } else if (info.type === 'trap') {
          points = 3; // Shows research but misleading
        }

        // BONUS: Check if they requested info that validates their decision
        if (info.validatesDecision && info.validatesDecision.includes(decisionChoice)) {
          points += 7; // Bonus for using info correctly
          console.log(`Bonus: Requested info that validates decision choice ${decisionChoice}`);
        } else if (info.type === 'trap' && info.validatesDecision === null) {
          // Penalty if they fell for trap (requested trap info but can't tell if they fell for it yet)
          // We'll apply this penalty in the decision scoring below
        }

        impact.excellence += points;
      });

      // Bonus for requesting multiple sources (triangulating data)
      if (decision.infoRequested.length >= 2) {
        impact.excellence += 5;
      }
    }

    // BUFFIX: Add safety checks for decision structure
    if (!decision.choices || decision.choices.length === 0) {
      console.error('ERROR: decision.choices is undefined or empty in scoreInheritance');
      return; // Early return to prevent crash
    }

    // Part 1: Which initiative to CUT
    const cutChoice = decision.choices[0]?.index ?? 0; // Use optional chaining and nullish coalescing
    const cutOption = scenario.decisions?.[0]?.options?.[cutChoice];

    if (cutOption) {
      const style = cutOption.style;
      impact.leadershipStyles[style] += 20;

      switch (cutChoice) {
        case 0: // Cut Marketing (keep Training + Dealer) - BALANCED, PEOPLE-FIRST
          // REBALANCE FIX 2026-05-17: Increased from +2% to +3% (50% increase)
          impact.growth += 3;
          // MORALE REBALANCE 2026-05-17: Reduced from +8% to +5% (38% reduction)
          impact.morale += 5; // Team appreciates investment in them (not coaching, so reduced)
          impact.leadership += 20;
                    impact.excellence += 15; // Data-driven decision (marketing had poor ROI)
          impact.determination += 10;
          impact.organizationalCapability += 15; // Training builds capability
          break;
        case 1: // Cut Training (keep Marketing + Dealer) - AGGRESSIVE, SHORT-TERM
          // REBALANCE FIX 2026-05-17: Increased from +4% to +5.5% (38% increase)
          impact.growth += 5.5;
          // MORALE REBALANCE 2026-05-17: Reduced from -12% to -8% (33% reduction in penalty)
          impact.morale -= 8; // Team feels undervalued
          // ATTRITION REBALANCE 2026-05-17: Reduced from +8% to +5% (38% reduction)
          impact.attrition += 5; // People leave when not developed
          impact.determination += 20; // Growth-focused
          impact.excellence -= 5; // Ignored attrition data
          break;
        case 2: // Cut Dealer Network (keep Marketing + Training) - RISKY
          // REBALANCE FIX 2026-05-17: Increased from +3% to +4% (33% increase)
          impact.growth += 4;
          // MORALE REBALANCE 2026-05-17: Reduced from +5% to +3% (40% reduction)
          impact.morale += 3;
          impact.profitMargin -= 3; // Dealers are critical distribution channel
          impact.determination += 12;
          impact.excellence -= 8; // Ignoring dealer relationship importance
          break;
        case 3: // Partially fund all three - INDECISIVE
          // REBALANCE FIX 2026-05-17: Increased from +1% to +1.5% (50% increase)
          impact.growth += 1.5;
          // MORALE REBALANCE 2026-05-17: Reduced from -5% to -3% (40% reduction in penalty)
          impact.morale -= 3; // Team frustrated by under-resourcing
          impact.leadership -= 10; // Looks weak/indecisive
          impact.agility -= 8; // Not adapting to constraint
          break;
        case 4: // Request additional budget - COLLABORATIVE BUT RISKY
          // MORALE REBALANCE 2026-05-17: Reduced from +3% to +2% (33% reduction)
          impact.morale += 2;
          impact.leadership += 10; // Shows initiative
          impact.agility += 5;
          // REBALANCE FIX 2026-05-17: Increased from -1% to -0.5% (50% reduction in penalty)
          impact.growth -= 0.5;
          break;
      }
    }

    // Part 2: Communication style
    const commChoice = decision.choices[1].index;
    const commOption = scenario.decisions[1].options[commChoice];

    if (commOption) {
      const style = commOption.style;
            impact.leadershipStyles[style] += 20;

      switch (style) {
        case 'authoritative':
          impact.morale += 0;
          // AUDIT FIX: Reduced from +2% to +1%
          impact.growth += 1;
          impact.leadership += 15;
          impact.determination += 15; // Confident vision
          break;
        case 'democratic':
          impact.morale += 5;
          // AUDIT FIX: Growth stays at +1% (already realistic)
          impact.growth += 1;
          impact.leadership += 10;
          break;
        case 'coaching':
          impact.morale += 8;
          impact.growth += 0;
          impact.leadership += 12;
          break;
        case 'pacesetting':
          impact.morale -= 10;
          // AUDIT FIX: Reduced from +5% to +2%
          impact.growth += 2;
          impact.attrition += 5;
          impact.determination += 20; // Relentless drive
          break;
        case 'affiliative':
          impact.morale += 6; // ENHANCED from +3
          impact.growth += 0; // ENHANCED from -2 (neutral now)
          impact.attrition -= 2; // NEW: Reduces turnover risk
          impact.leadership += 8; // NEW: People-first leadership
          break;
      }
    }
  }

  scoreDataDilemma(scenario, decision, impact, gameState) {
    // CRITICAL FIX: Award Excellence points for info requests FIRST
    if (decision.infoRequested && decision.infoRequested.length > 0) {
      decision.infoRequested.forEach(info => {
        if (info.type === 'useful') {
          impact.excellence += 10; // Requested valuable data
        } else if (info.type === 'red_herring') {
          impact.excellence += 3; // Requested irrelevant data (still shows research mindset)
        } else if (info.type === 'trap') {
          impact.excellence += 5; // Requested data, but it misleads them
        }
        });
      
      // Bonus for requesting multiple sources (triangulating data)
        if (decision.infoRequested.length >= 2) {
            impact.excellence += 5;
        }
    }

    // Part 1: Reconciliation approach
    const approach = decision.choices[0].index;

    if (approach === 0) { // Deep dive methodology
      impact.excellence += 25; // Critical thinking
      impact.agility += 10;
      impact.morale += 3;
      impact.determination += 10; // Persistence in finding truth
    } else if (approach === 1) { // Interview customers
      impact.leadership += 15; // Going to source
      impact.excellence += 15;
      impact.agility += 10;
      impact.determination += 15; // Proactive investigation
    } else if (approach === 2) { // Joint meeting
      impact.leadership += 20; // Collaboration
      impact.excellence += 10;
      impact.morale += 8;
    } else if (approach === 3) { // Trust satisfaction metric
      impact.determination += 10;
      impact.excellence -= 10; // Oversimplifying
    }

    // Part 2: Board presentation
    if (decision.choices.length > 1) {
      const presentation = decision.choices[1].index;

      if (presentation === 0) { // Honest complexity
        impact.excellence += 20; // Intellectual honesty
        impact.leadership += 10;
      } else if (presentation === 1) { // Synthesize
        impact.excellence += 30; // High critical thinking
        impact.leadership += 15;
        impact.agility += 15;
      } else if (presentation === 2) { // Frame as opportunity
        impact.excellence += 25;
        impact.agility += 20; // Reframing
        impact.leadership += 15;
      } else if (presentation === 3) { // Request more time
                impact.excellence += 5;
        impact.determination -= 10;
      }
    }

    // Track styles from choices
    decision.choices.forEach((choice, idx) => {
      const decisionPart = scenario.decisions[idx];
      if (decisionPart && decisionPart.options && decisionPart.options[choice.index]) {
        const option = decisionPart.options[choice.index];
        if (option.style) {
          impact.leadershipStyles[option.style] += 15;
        }
      }
    });
  }

  scoreSafetyCrisis(scenario, decision, impact, gameState) {
    // CRITICAL FIX: Award Excellence points for info requests WITH decision-to-info mapping
    if (decision.infoRequested && decision.infoRequested.length > 0) {
      const decisionChoice = decision.choices[0].index; // Which immediate response they chose

      decision.infoRequested.forEach(info => {
        // Base points for requesting info (research habit)
        let points = 0;
        if (info.type === 'useful') {
          points = 8;
        } else if (info.type === 'red_herring') {
          points = 2;
        } else if (info.type === 'trap') {
          points = 3;
        }

        // BONUS: Check if they requested info that validates their decision
        if (info.validatesDecision && info.validatesDecision.includes(decisionChoice)) {
          points += 7; // Bonus for using info correctly
          console.log(`Bonus: Requested info that validates decision choice ${decisionChoice}`);
        }

        impact.excellence += points;
      });

      // Bonus for requesting multiple sources (triangulating data)
      if (decision.infoRequested.length >= 2) {
        impact.excellence += 5;
      }
      }

  // Part 1: Immediate Response - What action do you take TODAY?
  const immediateChoice = decision.choices[0].index;
  const option = scenario.decisions[0].options[immediateChoice];

  if (option) {
    const style = option.style;
    impact.leadershipStyles[style] += 20;

    switch (immediateChoice) {
      case 0: // Suspend employee - PUNITIVE, damages morale
        // MORALE REBALANCE 2026-05-17: Reduced from -18% to -12% (33% reduction)
        impact.morale -= 12;
        // ATTRITION REBALANCE 2026-05-17: Reduced from +15% to +10% (33% reduction)
        impact.attrition += 10;
        // REBALANCE FIX 2026-05-17: Increased from +1% to +1.3% (30% increase)
        impact.growth += 1.3;
        impact.determination += 15;
        impact.excellence -= 10; // Ignored root cause data
        break;

      case 1: // Immediate retraining (£15K, 2 days) - BALANCED, addresses gap (COACHING STYLE)
        // MORALE: Keep full impact for coaching decision
        impact.morale += 10;
        // REBALANCE FIX 2026-05-17: Reduced penalty from -0.3% to -0.2%
        // £15K training for 2 days downtime should NOT reduce annual growth significantly
        // For £2B company, 2 days = 0.5% of year, realistic impact = -0.2%
        impact.growth -= 0.2;
        impact.excellence += 20; // Evidence-based response
        impact.leadership += 15;
        impact.organizationalCapability += 20; // Training builds capability
        break;

      case 2: // Facility-wide audit (£85K, 1 week) - THOROUGH but expensive
        // MORALE REBALANCE 2026-05-17: Reduced from +5% to +3% (40% reduction)
        impact.morale += 3;
        // REBALANCE FIX 2026-05-17: Reduced penalty from -1.5% to -1% (1 week downtime)
        impact.growth -= 1;
        impact.excellence += 25; // Comprehensive approach
        impact.determination += 10;
        impact.agility -= 5; // Slow response
        break;

      case 3: // Safety reminder (zero cost) - RISKY, may not prevent recurrence
        // MORALE REBALANCE 2026-05-17: Reduced from +2% to +1% (50% reduction)
        impact.morale += 1;
                // REBALANCE FIX 2026-05-17: Increased from +1% to +1.3% (30% increase)
        impact.growth += 1.3;
        impact.excellence -= 15; // Inadequate response
        impact.determination -= 10; // Avoiding tough decision
        break;

      case 4: // Investigate root cause first (1 week) - THOUGHTFUL
        impact.excellence += 30; // Evidence-based approach
        impact.agility += 15; // Adaptive thinking
        // REBALANCE FIX 2026-05-17: Reduced penalty from -1% to -0.7% (investigation delay)
        impact.growth -= 0.7;
        impact.leadership += 20;
        break;
    }
  }

  // Part 2: Communication to broader team
  if (decision.choices.length > 1) {
    const commChoice = decision.choices[1].index;
    const commOption = scenario.decisions[1].options[commChoice];

    if (commOption) {
      impact.leadershipStyles[commOption.style] += 15;

      switch (commChoice) {
        case 0: // Firm warning - coercive
          // MORALE REBALANCE 2026-05-17: Reduced from -12% to -8% (33% reduction)
          impact.morale -= 8;
          // ATTRITION REBALANCE 2026-05-17: Reduced from +8% to +5% (38% reduction)
          impact.attrition += 5;
          impact.determination += 10;
          break;

        case 1: // Learning opportunity - coaching (KEEP FULL IMPACT)
          impact.morale += 15;
          impact.excellence += 15;
          impact.leadership += 20;
          impact.organizationalCapability += 15;
          break;

        case 2: // Empathetic - affiliative (KEEP FULL IMPACT)
          impact.morale += 12;
          impact.leadership += 10;
          impact.determination -= 5; // May appear soft
          break;

        case 3: // Set clear expectations - pacesetting
                  // MORALE REBALANCE 2026-05-17: Reduced from -5% to -3% (40% reduction)
          impact.morale -= 3;
          impact.determination += 15;
          impact.excellence += 10;
          break;

        case 4: // Facilitated discussion - democratic
          // MORALE REBALANCE 2026-05-17: Reduced from +10% to +6% (40% reduction)
          impact.morale += 6;
          impact.leadership += 15;
          impact.agility += 10;
          impact.organizationalCapability += 10;
          break;

      }
    }
  }

  scoreAmbiguousSignal(scenario, decision, impact, gameState) {
    // CRITICAL FIX: Award Excellence points for info requests FIRST
    if (decision.infoRequested && decision.infoRequested.length > 0) {
      decision.infoRequested.forEach(info => {
        if (info.type === 'useful') {
          impact.excellence += 10;
        } else if (info.type === 'red_herring') {
          impact.excellence += 3;
        } else if (info.type === 'trap') {
          impact.excellence += 5;
        }
      });
      if (decision.infoRequested.length >= 2) {
        impact.excellence += 5;
      }
    }

    // Part 1: Interpreting incomplete information
    const interpretation = decision.choices[0].index;

    if (interpretation === 0) { // Assumptions + act
      impact.determination += 15;
      impact.agility -= 5; // Not enough exploration
    } else if (interpretation === 1) { // Gather data
      impact.excellence += 20;
      impact.agility += 15;
    } else if (interpretation === 2) { // Consult stakeholders
      impact.leadership += 20;
      impact.agility += 20; // Collaborative approach to uncertainty
      impact.excellence += 10;
          } else if (interpretation === 3) { // Run experiments
      impact.agility += 30; // Highest - testing approach
      impact.excellence += 25;
      impact.leadership += 10;
    }

    // Part 2: All three theories true
    if (decision.choices.length > 1) {
      const response = decision.choices[1].index;

      if (response === 0) { // Focus on biggest
        impact.determination += 15;
        impact.excellence += 10;
      } else if (response === 1) { // Address all three
        impact.agility += 20;
        impact.leadership += 15;
        impact.excellence += 15;
      } else if (response === 2) { // Pilot approaches
        impact.agility += 30; // Experimental mindset
        impact.excellence += 20;
        impact.leadership += 15;
      } else if (response === 3) { // Decisive call
        impact.determination += 20;
        impact.agility -= 10; // Not embracing complexity
      }
    }

    // Part 3: Continuing ambiguity
    if (decision.choices.length > 2) {
      const forward = decision.choices[2].index;

      if (forward === 0) { // Accept uncertainty, adapt
        impact.agility += 35; // HIGHEST - comfort with ambiguity
        impact.excellence += 20;
        impact.leadership += 15;
      } else if (forward === 1) { // Commit 90 days
        impact.determination += 20;
        impact.agility += 15;
        impact.leadership += 10;
      } else if (forward === 2) { // Continue gathering data
        impact.excellence += 10;
        impact.determination -= 15; // Analysis paralysis
        impact.agility -= 10;
      } else if (forward === 3) { // Trust instincts
        impact.determination += 25;
        impact.excellence -= 10;
        impact.agility -= 5;
         }
    }

    // Track styles from choices
  decision.choices.forEach((choice, idx) => {
    const decisionPart = scenario.decisions[idx];
    if (decisionPart && decisionPart.options && decisionPart.options[choice.index]) {
      const option = decisionPart.options[choice.index];
      if (option.style) {
        impact.leadershipStyles[option.style] += 15;
      }
    }
  });
  }

  scoreCompetitorThreat(scenario, decision, impact, gameState) {
    // CRITICAL FIX: Award Excellence points for info requests FIRST
    if (decision.infoRequested && decision.infoRequested.length > 0) {
      decision.infoRequested.forEach(info => {
        if (info.type === 'useful') {
          impact.excellence += 10;
        } else if (info.type === 'red_herring') {
          impact.excellence += 3;
        } else if (info.type === 'trap') {
          impact.excellence += 5;
        }
      });
      if (decision.infoRequested.length >= 2) {
        impact.excellence += 5;
      }
    }

    // Part 1: Resource allocation
    const allocation = decision.choices[0].values;
    // [priceMatch, r&d, dealers, marketing, loyalty, dealerPartnership]

    const priceMatch = allocation[0] || 0;
    const rnd = allocation[1] || 0;
    const dealers = allocation[2] || 0;
    const marketing = allocation[3] || 0;
    const loyalty = allocation[4] || 0;
    const dealerPartnership = allocation[5] || 0; // NEW: Affiliative option

    // Heavy price matching is trap
    if (priceMatch >= 1.0) {
      // REBALANCE FIX 2026-05-17: Increased from +2% to +2.7% (35% increase)
      impact.growth += 2.7;
      impact.profitMargin -= 8;
         // Short-term gain, long-term damage
      impact.determination += 12; // Aggressive competitive response
    }

  // CRITICAL FIX #2: Balanced investment in R&D and relationships
  // Strategic investments pay off in later scenarios (not immediate)
  if (rnd >= 1.0 && dealers >= 0.8) {
    // REBALANCE FIX 2026-05-17: Increased delayed payoff from +8% to +10% (25% increase)
    // This further rewards long-term thinking
    impact.delayedGrowth = {
      amount: 10,
      triggerScenario: 5 // Pays off at scenario 5 (Year-End)
    };
    impact.profitMargin -= 1; // Small immediate cost
    impact.leadership += 20;
    impact.excellence += 15;
    impact.determination += 18; // Playing long game under pressure
    console.log('📈 R&D + Dealer investment: Will pay off +10% growth at Year-End scenario');
  }

  // NEW: Dealer partnership strengthening (affiliative approach - KEEP FULL IMPACT)
  if (dealerPartnership >= 0.6) {
    impact.morale += 6; // Team feels supported in relationship-building
    impact.attrition -= 2; // Reduces pressure on sales team
    impact.leadership += 12; // Shows people-first approach
    impact.leadershipStyles.affiliative += 15;
    // Long-term benefit, modest short-term cost
    if (dealerPartnership >= 0.8) {
      // REBALANCE FIX 2026-05-17: Increased from +1% to +1.3% (30% increase)
      impact.growth += 1.3; // Dealer loyalty pays off
    }
  }

  // Part 2: Negotiation approach
  const negotiation = decision.choices[1].value;
  const negotiationDecision = scenario.decisions[1];

  // Apply style mapping if it exists
  if (negotiationDecision.styleMapping && negotiationDecision.styleMapping[negotiation]) {
    impact.leadershipStyles[negotiationDecision.styleMapping[negotiation]] += 15;
  }

  if (negotiation === 0) {
    // Aggressive (non-coaching - reduce)
    // MORALE REBALANCE 2026-05-17: Reduced from -3% to -2% (33% reduction)
    impact.morale -= 2;
  } else if (negotiation === 2) {
        // Collaborative
    impact.leadership += 15;
  }

  // Part 3: Team mobilization
  const mobilization = decision.choices[2].index;
  const mobOption = scenario.decisions[2].options[mobilization];

  if (mobOption) {
    impact.leadershipStyles[mobOption.style] += 20;

    if (mobOption.style === 'authoritative') {
      // MORALE REBALANCE 2026-05-17: Reduced from +5% to +3% (40% reduction)
      impact.morale += 3;
      impact.leadership += 15;
    } else if (mobOption.style === 'pacesetting') {
      // MORALE REBALANCE 2026-05-17: Reduced from -8% to -5% (38% reduction)
      impact.morale -= 5;
      // REBALANCE FIX 2026-05-17: Increased from +3% to +4% (33% increase)
      impact.growth += 4;
    } else if (mobOption.style === 'affiliative') {
      // NEW: "We're strongest when we support each other" (KEEP FULL IMPACT)
      impact.morale += 8; // Team unity boosts morale
      impact.attrition -= 3; // People feel valued
      impact.leadership += 10;
    }
  }
}

  scoreTalentExodus(scenario, decision, impact, gameState) {
    // CRITICAL FIX: Award Excellence points for info requests FIRST
    if (decision.infoRequested && decision.infoRequested.length > 0) {
      decision.infoRequested.forEach(info => {
        if (info.type === 'useful') {
          impact.excellence += 10;
        } else if (info.type === 'red_herring') {
          impact.excellence += 3;
        } else if (info.type === 'trap') {
          impact.excellence += 5;
        }
      });
      if (decision.infoRequested.length >= 2) {
        impact.excellence += 5;
      }
    }

    // CRITICAL SCENARIO - reckoning for aggressive leadership 

      // Part 1: Root cause assessment
  const rootCause = decision.choices[0].index;

  if (rootCause === 0) { // External factors
    impact.leadership += 5;
    impact.excellence -= 10; // Missing real issue
    impact.attrition += 3;
  } else if (rootCause === 1) { // MY LEADERSHIP - SELF-AWARENESS ⭐⭐⭐
    impact.agility += 40; // MAXIMUM AGILITY SCORE
    impact.excellence += 35; // Emotional intelligence
    impact.leadership += 25;
    impact.morale += 15;
    impact.attrition -= 12;
    impact.leadershipStyles.coaching += 25;
    // This is THE key self-awareness moment
  } else if (rootCause === 2) { // Team needs support
    impact.excellence += 20;
    impact.leadership += 15;
    impact.morale += 12;
    impact.attrition -= 8;
    impact.leadershipStyles.coaching += 20;
  }

  // Part 2: Immediate response
  const response = decision.choices[1].index;
  const respOption = scenario.decisions[1].options[response];

  if (respOption) {
    impact.leadershipStyles[respOption.style] += 20;

    if (respOption.style === 'coaching') {
      impact.morale += 12;
      impact.leadership += 15;
    } else if (respOption.style === 'pacesetting') {
      // Double down - disaster
      impact.morale -= 15;
      impact.attrition += 15;
    }
  }

  // Part 3: Target adjustment
  const adjustment = decision.choices[2].value;
  const adjustmentDecision = scenario.decisions[2];

  // Apply style mapping if it exists
  if (adjustmentDecision.styleMapping && adjustmentDecision.styleMapping[adjustment]) {
    impact.leadershipStyles[adjustmentDecision.styleMapping[adjustment]] += 15;
  }

  // 0=Maintain, 1=10%, 2=20%, 3=30%
  if (adjustment === 0 && gameState.morale < 65) {
    // Maintain with low morale = catastrophe
    impact.attrition += 20;
    impact.morale -= 15;
  } else if (adjustment === 2 || adjustment === 3) {
    // Significant reduction shows genuine change
    impact.morale += 15;
    impact.attrition -= 10;
    impact.growth -= 5;
    impact.agility += 15;
  }

  // COMPOUNDING EFFECT: If player was pacesetting heavy in previous scenarios
  const paceSettingUsage = gameState.leadershipStyles.pacesetting || 0;
  if (paceSettingUsage > 50) {
    // Amplify negative impacts
    impact.attrition += 10;
    impact.morale -= 10;
  }
}

  scoreDifficultConversation(scenario, decision, impact, gameState) {
    // CRITICAL FIX: Award Excellence points for info requests FIRST
    if (decision.infoRequested && decision.infoRequested.length > 0) {
      decision.infoRequested.forEach(info => {
        if (info.type === 'useful') {
          impact.excellence += 10;
        } else if (info.type === 'red_herring') {
          impact.excellence += 3;
        } else if (info.type === 'trap') {
          impact.excellence += 5;
        }
      });
      if (decision.infoRequested.length >= 2) {
        impact.excellence += 5;
      }
    }

    // Part 1: Preparation
    const prep = decision.choices[0].index;

    if (prep === 0) { // Document formally
      impact.excellence += 10;
      impact.leadership -= 5; // Less personal touch
        } else if (prep === 1) { // Understand perspective
            impact.excellence += 30; // High EQ
            impact.leadership += 20;
            impact.agility += 10;
        } else if (prep === 2) { // Practice conversation
            impact.excellence += 20; // Self-awareness
            impact.leadership += 10;
        } else if (prep === 3) { // Focus on outcomes
            impact.determination += 15;
            impact.excellence += 5;
        }

        // Part 2: Emotional response
        if (decision.choices.length > 1) {
            const response = decision.choices[1].index;

            if (response === 0) { // Stay firm
                impact.determination += 15;
                impact.excellence -= 10; // Not responsive to emotion
                impact.morale -= 5;
            } else if (response === 1) { // Acknowledge + refocus
                impact.excellence += 35; // HIGHEST EQ - balance
                impact.leadership += 25;
                impact.agility += 15;
                impact.morale += 8;
            } else if (response === 2) { // Explore underneath
                impact.excellence += 30;
                impact.leadership += 20;
                impact.agility += 10;
            } else if (response === 3) { // Take break
                impact.excellence += 15;
                impact.leadership += 10;
                impact.determination -= 5;
            }
        }

        // Part 3: Personal issues revealed
        if (decision.choices.length > 2) {
            const handling = decision.choices[2].index;

            if (handling === 0) { // Support + expectations
                impact.excellence += 30; // Balance empathy + accountability
                impact.leadership += 25;
                impact.agility += 15;
                impact.morale += 10;
            } else if (handling === 1) { // 6 weeks grace
                impact.excellence += 10; // Empathy
                impact.determination -= 10;
                impact.morale += 8;
            } else if (handling === 2) { // Refer to HR
                impact.excellence += 15;
                impact.leadership -= 5;
                impact.morale += 3;
            } else if (handling === 3) { // Co-create plan
                impact.excellence += 35; // Highest - collaborative problem-solving
                impact.leadership += 30;
                impact.agility += 20;
                impact.morale += 12;
            }
        }

        // Track styles from choices
        decision.choices.forEach((choice, idx) => {
            const decisionPart = scenario.decisions[idx];
            if (decisionPart && decisionPart.options && decisionPart.options[choice.index]) {
                const option = decisionPart.options[choice.index];
                if (option.style) {
                    impact.leadershipStyles[option.style] += 15;
                }
            }
        });
    }

    scoreInnovationGamble(scenario, decision, impact, gameState) {
        // CRITICAL FIX: Award Excellence points for info requests FIRST
        if (decision.infoRequested && decision.infoRequested.length > 0) {
            decision.infoRequested.forEach(info => {
                if (info.type === 'useful') {
                    impact.excellence += 10;
                } else if (info.type === 'red_herring') {
                    impact.excellence += 3;
                } else if (info.type === 'trap') {
                    impact.excellence += 5;
                }
            });
            if (decision.infoRequested.length >= 2) {
                impact.excellence += 5;
            }
        }

        // Part 1: Launch timing
        const timing = decision.choices[0].index;
        const timingOption = scenario.decisions[0].options[timing];

        // Apply style mapping from choice options
        if (timingOption && timingOption.style) {
            impact.leadershipStyles[timingOption.style] += 20;
        }

        if (timing === 0) {
            // Immediate launch - CRITICAL AUDIT FIX
            // Q4 decision (October/November) cannot affect full Year 1 growth
            // Only affects 1-2 months of Year 1, most impact is Year 2
            impact.growth += 2; // REDUCED from +8% - only 2 months of Year 1
            // But creates future disaster (quality issues)
            impact.excellence -= 25;
            impact.determination += 25; // Bold, aggressive move
        } else if (timing === 1) {
            // Accelerated Q4 - BALANCED
            // CRITICAL AUDIT FIX: Q4 launch mostly affects Year 2
            impact.growth += 1.5; // REDUCED from +6% - realistic for 1-2 months
            impact.morale += 5;
            impact.excellence += 10;
            impact.determination += 18; // Ambitious but measured
            impact.agility += 12; // NEW: Fast adaptation to market opportunity
        } else if (timing === 2) {
            // Q1 next year - TOO SLOW
            // AUDIT FIX: Reduced penalty from -3% to -1%
            impact.growth -= 1; // Small penalty for delay
            impact.excellence += 15;
            impact.determination += 5; // Conservative, low risk-tolerance
        } else if (timing === 3) {
            // Pilot first - BALANCED
            // AUDIT FIX: Reduced from +4% to +1%
            impact.growth += 1; // Minimal Year 1 impact, sets up Year 2
            impact.morale += 6;
            impact.excellence += 15;
            impact.leadership += 12;
            impact.determination += 10;
            impact.agility += 15; // Rewards experimental approach
        }

        // Part 2: Decision process
        const process = decision.choices[1].index;
        const processOption = scenario.decisions[1].options[process];

        if (processOption) {
            impact.leadershipStyles[processOption.style] += 20;

            if (processOption.style === 'democratic' || processOption.style === 'coaching') {
                impact.morale += 5;
                impact.leadership += 10;
            } else if (processOption.style === 'affiliative') {
                // NEW: "Team workshop - collaboratively decide launch readiness"
                impact.morale += 8; // Team feels valued in major decision
                impact.leadership += 12; // Inclusive leadership
                impact.attrition -= 2; // Reduces turnover risk
                impact.growth += 1; // Small boost from team buy-in
            }
        }

        // Part 3: Risk mitigation allocation
        const mitigation = decision.choices[2].values;
        // [qa, pilot, warranty, marketing, contingency]

        const qa = mitigation[0] || 0;
        const pilot = mitigation[1] || 0;
        const marketing = mitigation[3] || 0;

        if (qa >= 0.5 && pilot >= 0.4) {
            // Good risk management
            impact.excellence += 15;
            impact.growth += 2;
        }

        if (marketing > 0.6 && qa < 0.3) {
            // Marketing over quality - risky
            // AUDIT FIX: Reduced from +5% to +2%
            impact.growth += 2;
            impact.excellence -= 10;
        }
    }

    scoreYearEnd(scenario, decision, impact, gameState) {
        // CRITICAL FIX: Award Excellence points for info requests FIRST
        if (decision.infoRequested && decision.infoRequested.length > 0) {
            decision.infoRequested.forEach(info => {
                if (info.type === 'useful') {
                    impact.excellence += 10;
                } else if (info.type === 'red_herring') {
                    impact.excellence += 3;
                } else if (info.type === 'trap') {
                    impact.excellence += 5;
                }
            });
            if (decision.infoRequested.length >= 2) {
                impact.excellence += 5;
            }
        }

        // FINALE - highly dependent on previous performance

        // Part 0: Reflection (added - skip for scoring, it's for player insight)
        const reflectionChoice = decision.choices[0].index;
        const reflectionOption = scenario.decisions[0].options[reflectionChoice];
        if (reflectionOption && reflectionOption.style) {
            impact.leadershipStyles[reflectionOption.style] += 15;
        }

        // Part 1: Customer crisis
        const customerChoice = decision.choices[1].index;
        const customerOption = scenario.decisions[1].options[customerChoice];

        // Apply style mapping from choice options
        if (customerOption && customerOption.style) {
            impact.leadershipStyles[customerOption.style] += 20;
        }

        if (customerChoice === 2 && gameState.morale >= 70) {
            // Empower team if morale is good (DEMOCRATIC - keep full morale impact)
            // REBALANCE FIX 2026-05-17: Increased from +2% to +2.7% (35% increase)
            impact.growth += 2.7;
            impact.morale += 8;
            impact.leadershipStyles.democratic += 10;
        } else if (customerChoice === 0 && gameState.morale < 65) {
            // Assign best people when they're already exhausted
            // MORALE REBALANCE 2026-05-17: Reduced from -12% to -8% (33% reduction)
            impact.morale -= 8;
            // ATTRITION REBALANCE 2026-05-17: Reduced from +10% to +6% (40% reduction)
            impact.attrition += 6;
        } else if (customerChoice === 1) {
            // Personal leadership
            // REBALANCE FIX 2026-05-17: Increased from +1% to +1.3% (30% increase)
            impact.growth += 1.3;
            impact.leadership += 10;
        }

        // Part 2: Team investment
        const investment = decision.choices[2].values;
        // [bonuses, celebration, capability, savings]

        const bonuses = investment[0] || 0;
        const celebration = investment[1] || 0;
        const capability = investment[2] || 0;

        if (capability >= 0.4) {
        // Invest in Year 2 capabilities (COACHING/STRATEGIC - keep full morale impact)
            impact.morale += 10;
            impact.leadership += 15;
            impact.determination += 15; // Long-term investment mindset
        }

        if (bonuses > 0.5 && capability < 0.2) {
            // Money without investment in development (non-coaching - reduce)
            // MORALE REBALANCE 2026-05-17: Reduced from +3% to +2% (33% reduction)
            impact.morale += 2;
        }

        // Part 3: Year 2 strategy
        const strategy = decision.choices[3].index;
        const strategyOption = scenario.decisions[3].options[strategy];

        // Apply style mapping from choice options
        if (strategyOption && strategyOption.style) {
            impact.leadershipStyles[strategyOption.style] += 20;
        }

        if (strategy === 0 && gameState.morale < 70) {
            // Aggressive growth with exhausted team
            // MORALE REBALANCE 2026-05-17: Reduced from -15% to -10% (33% reduction)
            impact.morale -= 10;
            // ATTRITION REBALANCE 2026-05-17: Reduced from +15% to +10% (33% reduction)
            impact.attrition += 10;
            impact.determination += 20; // Relentless ambition
        } else if (strategy === 3) {
            // Balanced approach (DEMOCRATIC - keep full morale impact)
            impact.morale += 10;
            impact.leadership += 20;
            // REBALANCE FIX 2026-05-17: Increased from +2% to +2.7% (35% increase)
            impact.growth += 2.7;
            impact.determination += 15; // Sustainable ambition
        } else if (strategy === 1 && gameState.attrition > 15) {
            // Consolidation when needed (COACHING - keep full impact)
            impact.morale += 15;
            impact.attrition -= 5;
            impact.determination += 8; // Measured restraint
        } else if (strategy === 2) {
            // Innovation leadership
            impact.determination += 22; // Bold vision for future
        }
    }

    calculateFinalScore(gameState) {
        const results = {
                escaped: false,
                optimal: false,
                finalScore: 0,
                leadershipProfile: {},
                personalityColor: '',
                personalityDescription: '',
                feedback: '',
                recommendations: [],
                leadRatios: {} // Add leadRatios to results object for use in generateFeedback
            };

            // Check win conditions
            // REBALANCED 2026-05-17: Lowered growth threshold from 20% to 15% based on simulation data
            // Analysis showed best growth strategy (Pure Pacesetting) only achieved 17.1% average
            // NOTE: Business metrics (meetsGrowth, meetsCapability, etc.) calculated below after LEAD analysis
            const healthyAttrition = gameState.attrition < 15; // TIGHTENED from 25% (was too lenient)
            const healthyProfit = gameState.profitMargin > 15;
            const healthyMorale = gameState.morale >= 65; // NEW REQUIREMENT (sustainable leadership)

            // NEW: LEAD Quality Threshold - prevent Pyrrhic victories
            // Calculate average LEAD performance vs benchmarks
            const scenarioCount = 6;
            const avgLeadership = (gameState.leadership || 0) / scenarioCount;
            const avgExcellence = (gameState.excellence || 0) / scenarioCount;
            const avgAgility = (gameState.agility || 0) / scenarioCount;
            const avgDetermination = (gameState.determination || 0) / scenarioCount;

            // BENCHMARKS UPDATED 2026-05-16: Set to realistic values based on actual maximum achievable points
            // These represent "good but not perfect" performance (~70% of maximum per scenario)
            const benchmarks = {
                leadership: 25,    // Max ~35 per scenario, benchmark = 70% of max
                excellence: 35,    // Max ~50 per scenario, benchmark = 70% of max
                agility: 15,       // Max ~22 per scenario, benchmark = 70% of max
                determination: 20  // Max ~28 per scenario, benchmark = 70% of max
            };

            const leadRatios = {
                leadership: avgLeadership / benchmarks.leadership,
                excellence: avgExcellence / benchmarks.excellence,
                agility: avgAgility / benchmarks.agility,
                determination: avgDetermination / benchmarks.determination
            };

            // Store leadRatios in results for use in generateFeedback
            results.leadRatios = leadRatios;

            const avgLEADRatio = (leadRatios.leadership + leadRatios.excellence + leadRatios.agility + leadRatios.determination) / 4;

        // CRITICAL: Minimum LEAD quality threshold
        // You CANNOT succeed with terrible leadership quality (< 40% of benchmark average)
        // UPDATED 2026-05-17: Added individual dimension minimums to prevent ignoring entire LEAD dimensions
        // (e.g., can't succeed with zero info requests by compensating with high other dimensions)
        const meetsLEADQuality = avgLEADRatio >= 0.40 &&
                                 leadRatios.leadership >= 0.30 &&
                                 leadRatios.excellence >= 0.30 &&
                                 leadRatios.agility >= 0.30 &&
                                 leadRatios.determination >= 0.30;

        // NEW: Leadership Balance Requirement
        // Calculate balance score (no single style should dominate)
        const totalStylePoints = Object.values(gameState.leadershipStyles).reduce((a, b) => a + b, 0);
        const stylePercentages = {};

        if (totalStylePoints > 0) {
            // Calculate percentages with rounding
            const styles = Object.keys(gameState.leadershipStyles);
            styles.forEach(style => {
                stylePercentages[style] = Math.round((gameState.leadershipStyles[style] / totalStylePoints) * 100);
            });

            // Fix rounding errors to ensure sum is exactly 100%
            const sum = Object.values(stylePercentages).reduce((a, b) => a + b, 0);
            if (sum !== 100) {
                // Find the largest style and adjust it to make total exactly 100
                const largestStyle = styles.reduce((a, b) =>
                    stylePercentages[a] > stylePercentages[b] ? a : b
                );
                stylePercentages[largestStyle] += (100 - sum);
            }
        } else {
            // If no style points, set all to 0
            Object.keys(gameState.leadershipStyles).forEach(style => {
                stylePercentages[style] = 0;
            });
        }

        // Find most dominant style
        const maxStylePercentage = Math.max(...Object.values(stylePercentages));

        // Balance requirement: No single style above 70% (allows some specialization but prevents extremes)
        const meetsBalanceRequirement = maxStylePercentage <= 70;

        // Store these for use in generateFeedback
        results.avgLEADRatio = avgLEADRatio;
        results.meetsLEADQuality = meetsLEADQuality;
        results.meetsBalanceRequirement = meetsBalanceRequirement;
        results.stylePercentages = stylePercentages;
        results.maxStylePercentage = maxStylePercentage;

        // REBALANCED 2026-05-17 v2: LEAD Quality and Balance-Focused Win Conditions
        // Philosophy: Reward high LEAD scores and balanced leadership, not extreme strategies

        // Calculate LEAD excellence tiers
        const exceptionalLEAD = avgLEADRatio >= 0.78;  // Top 78% of benchmark (truly exceptional) - RAISED v9 to reduce Random/Pure Democratic
        const strongLEAD = avgLEADRatio >= 0.50;      // Top 50% of benchmark (strong leadership)
        const minimumLEAD = avgLEADRatio >= 0.40;     // Minimum 40% of benchmark (baseline)

        // Calculate balance score (0-100, where 100 = perfectly balanced, 0 = single style dominates)
        const balanceScore = 100 - maxStylePercentage;  // If max is 40%, balance = 60
        const wellBalanced = maxStylePercentage <= 50;  // No single style > 50%
        const reasonablyBalanced = maxStylePercentage <= 70;  // No single style > 70%

        // Business metrics
        const meetsGrowth = gameState.growth >= 15;
        const meetsCapability = gameState.organizationalCapability >= 145;
        const capabilityPath = meetsCapability && gameState.growth >= 8;
        const meetsTeamHealth = healthyAttrition && healthyProfit && healthyMorale;
        const meetsBalancedPath = gameState.organizationalCapability >= 125 &&
                                  gameState.growth >= 8 &&
                                  meetsTeamHealth;

        // Store for use in generateFeedback
        results.meetsCapability = meetsCapability;
        results.capabilityPath = capabilityPath;
        results.meetsGrowth = meetsGrowth;
        results.meetsBalancedPath = meetsBalancedPath;
        results.exceptionalLEAD = exceptionalLEAD;
        results.strongLEAD = strongLEAD;
        results.balanceScore = balanceScore;

        // REBALANCED WIN CONDITIONS v3: LEAD Quality PRIMARY, Balance SECONDARY
        // User feedback: "It is acceptable to win via less balanced methods if they score exceptionally well in LEAD"

        // TIER 1: Excellence Path (Exceptional LEAD overrides balance requirement)
        // - Exceptional LEAD leaders (70%+) can win even with unbalanced styles - RAISED v5
        // - Requires: LEAD 70%, Growth 6%, Team Health - LOWERED growth v5
        // - Balance: NO REQUIREMENT (exceptional LEAD proves effectiveness)

        // TIER 2: Balanced Leadership Path (Well-Balanced + Strong LEAD)
        // - Rewards balanced, quality leadership
        // - Requires: LEAD 50%, Well Balanced (max 50% single style), Growth 8%, Team Health

        // TIER 3: Capability Path (People Focused Excellence)
        // Build organizational capability through coaching/development
        // - Requires: Capability 145+, LEAD 50%+, Growth 6%+, Team Health
        // - Balance reasonably Balanced (max 70% single style)

        // REBALANCED WIN CONDITIONS v9: Five-tier system (Reduce Overpowered Strategies)
        // User feedback: "Balanced 46.5% (below target), Pure Democratic 55.6%, Random 54.9%, Coaching+Democratic 52.1%"
        // Issue: THREE strategies beating Balanced - need to make Excellence and People Paths harder

        // TIER 1: Excellence Path (Exceptional LEAD + Modest Growth)
        // - Exceptional LEAD lenders (78%+) can win with modest growth - RAISED v9
        // - Requires: LEAD 78%, Growth 7%, Team Health 
        // - Balance: NO REQUIREMENT (exceptional LEAD proves effectiveness)
        // - Target: Pure Democratic (reduce from 55.6%), exceptional players
        //
        // TIER 2: People Path (High Capability + People Focus)
        // - Build organizational capability through people development
        // - Requires: Capability 140+, LEAD 65%, Growth 7%+, Team Health - RAISED v9
        // - NO balance requirement (if you achieve 140+ cap, that proves effectiveness)
        // - Same growth requirement as Excellence/Balanced (7%)
        // - Target: Coaching+Democratic (reduce from 52.1%), Capability-Focused
        //
        // TIER 3: Balanced Leadership Path (Well-Balanced + Strong LEAD)
        // - Rewards balanced, quality leadership
        // - Requires: LEAD 50%, Well Balanced (max 50% single style), Growth 7%, Team Health
        // - Target: Balanced strategy (~50% win rate, should be top)
        //
        // TIER 4: Capability Path (People-Focused Excellence)
        // - Build organizational capability through coaching/development
        // - Requires: Capability 145+, LEAD 50%+, Growth 6%+, Team Health, Reasonably Balanced
        //
        // TIER 5: Growth Path (Results-Focused, accepts trade-offs but not burnout)
        // - High growth with acceptable LEAD quality and sustainable team impact
        // - Requires: Growth 15%+, LEAD 40%+ (minimum)
        // - Partial Team Health: Morale >45%, Attrition <30% (survivable but not ideal)
        // - Balance: NO REQUIREMENT (aggressive strategies allowed)
        // - Philosophy: You can push hard for growth, but can't completely destroy your team

        const winsViaExcellencePath = exceptionalLEAD &&
                                        gameState.growth >= 7 && // RAISED from 6% v6 - was too easy
                                        meetsTeamHealth;
                                        // NO balance requirement - exceptional LEAD proves capability

        const peopleLEAD = avgLEADRatio >= 0.65; // Strong but not exceptional LEAD - NEW v6
        const winsViaPeoplePath = gameState.organizationalCapability >= 140 &&
                                   peopleLEAD &&
                                   gameState.growth >= 7 && // RAISED from 6% v9 - reduce Coaching+Democratic dominance
                                   meetsTeamHealth;
                                       // NO balance requirement - if you achieve 140+ cap through people focus, that proves effectiveness

        const winsViaBalancedPath = strongLEAD &&
                                     wellBalanced &&
                                     gameState.growth >= 7 && // LOWERED from 8% v8 - Balanced strategy at 7.4% avg needs to win
                                     meetsTeamHealth;

        const winsViaCapabilityPath = meetsCapability &&
                                       strongLEAD &&
                                       gameState.growth >= 6 &&
                                       meetsTeamHealth &&
                                       reasonablyBalanced;

        const acceptableTeamImpact = gameState.morale >= 45 && gameState.attrition < 30;  // LOWERED morale from 50% v5

        const winsViaGrowthPath = gameState.growth >= 15 &&
                                   minimumLEAD &&
                                   acceptableTeamImpact;
                                   // Accepts profit trade-offs, NO balance requirement

        results.escaped = winsViaExcellencePath || winsViaPeoplePath || winsViaBalancedPath || winsViaCapabilityPath || winsViaGrowthPath;

        const optimalGrowth = gameState.growth >= 28;
        const highMorale = gameState.morale >= 75;
        const lowAttrition = gameState.attrition < 12;

        results.optimal = optimalGrowth && highMorale && lowAttrition && this.isBalancedLeadership(gameState);

        // Use already-calculated leadership style percentages from balance requirement above
        Object.keys(gameState.leadershipStyles).forEach(style => {
            results.leadershipProfile[style] = stylePercentages[style];
        });

        // Determine personality color
        results.personalityColor = this.calculatePersonalityColor(gameState);
        results.personalityDescription = this.getPersonalityDescription(results.personalityColor);

        // Generate feedback
        results.feedback = this.generateFeedback(gameState, results);

        // Generate recommendations
        results.recommendations = this.generateRecommendations(gameState, results);

        // Calculate final numerical score
        results.finalScore = this.calculateNumericalScore(gameState, results);

        return results;
    }
        
    isBalancedLeadership(gameState) {
        const styles = Object.values(gameState.leadershipStyles);
        const total = styles.reduce((a, b) => a + b, 0);

        if (total === 0) return false;

        // Check if any single style is > 60%
        const maxStyle = Math.max(...styles);
        const maxPercentage = (maxStyle / total) * 100;

        return maxPercentage <= 60;
    }

    calculatePersonalityColor(gameState) {
        const styles = gameState.leadershipStyles;

        let red = (styles.coercive + styles.pacesetting) / 2; // Driven
        let blue = (styles.authoritative) / 1; // Analytical/Visionary
        let yellow = (styles.affiliative + styles.democratic) / 2; // Creative/Collaborative
        let green = (styles.coaching) / 1; // Empathetic

        const total = red + blue + yellow + green;
        if (total === 0) return 'YELLOW'; // Default

        red = (red / total) * 100;
        blue = (blue / total) * 100;
        yellow = (yellow / total) * 100;
        green = (green / total) * 100;

        // Determine dominant color(s)
        const max = Math.max(red, blue, yellow, green);

        if (max === red && red > 40) {
            return yellow > 25 ? 'RED/YELLOW' : 'RED';
        } else if (max === blue && blue > 40) {
            return green > 25 ? 'BLUE/GREEN' : 'BLUE';
        } else if (max === yellow && yellow > 40) {
            return red > 25 ? 'YELLOW/RED' : 'YELLOW';
        } else if (max === green && green > 40) {
            return blue > 25 ? 'GREEN/BLUE' : 'GREEN';
        } else {
            return 'BALANCED';
        }
    }

    getPersonalityDescription(color) {
        const descriptions = {
            'RED': 'Results-focused, decisive, competitive. You drive for outcomes and set high standards.',
            'BLUE': 'Analytical, systematic, visionary. You provide clear direction and strategic thinking.',
            'YELLOW': 'Optimistic, enthusiastic, collaborative. You energize teams and build connections.',
            'GREEN': 'Supportive, patient, empathetic. You develop people and create psychological safety.',
            'RED/YELLOW': 'The Driven Innovator - You combine results focus with creative energy.',
            'BLUE/GREEN': 'The Thoughtful Coach - You blend strategic vision with people development.',
            'YELLOW/RED': 'The Energetic Achiever - You inspire teams toward ambitious goals.',
            'GREEN/BLUE': 'The Developmental Strategist - You build capability with clear direction.',
            'BALANCED': 'The Adaptive Leader - You flexibly apply different styles as needed.'
        };

        return descriptions[color] || descriptions['BALANCED'];
    }

    generateFeedback(gameState, results) {
        const escaped = results.escaped;
        const growth = gameState.growth;
        const morale = gameState.morale;
        const attrition = gameState.attrition;
        const leadRatios = results.leadRatios; // Get leadRatios from results object

        // Get calculated values from results object
        const avgLEADRatio = results.avgLEADRatio;
        const meetsLEADQuality = results.meetsLEADQuality;
        const meetsBalanceRequirement = results.meetsBalanceRequirement;
        const stylePercentages = results.stylePercentages;
        const maxStylePercentage = results.maxStylePercentage;

        // BUGFIX: Get capability path and growth check from results object
        const capabilityPath = results.capabilityPath;
        const meetsGrowth = results.meetsGrowth;

        // Recalculate win conditions for feedback (REMOVED - now using results object values above)

        const dominantStyle = this.getDominantStyle(results.leadershipProfile);
        const underusedStyle = this.getUnderusedStyle(results.leadershipProfile);

        let feedback = '<div class="feedback-section">';

        if (escaped) {
            feedback += '<h4>What You Did Well:</h4>';
            feedback += '<p>';

            // Check which win path they used
            // REBALANCED 2026-05-17: Updated thresholds to match new win conditions (145 cap, 8% growth, vs 15% growth target)
            const wonViaCapability = gameState.organizationalCapability >= 145 && gameState.growth >= 8 && meetsGrowth;

            if (wonViaCapability) {
                feedback += '<strong>Organizational Capability Path:</strong> You achieved ${growth.toFixed(1)}% growth - below the 15% growth target, but you built exceptional organizational capability (${gameState.organizationalCapability.toFixed(0)} points). ';
                feedback += 'This coaching-focused approach invests in long-term team development. ';
                feedback += 'While Year 1 growth is moderate, you\'ve built a strong foundation for sustainable performance. ';

                // WARN if growth is on the low end of viable (8-10%)
                if (growth >= 8 && growth < 10) {
                    feedback += '<br><br><b>⚠️ <em>Note:</em> Your ${growth.toFixed(1)}% growth is at the minimum threshold for organizational viability. ';
                    feedback += 'While investing in capability is valuable, ensure you\'re generating sufficient revenue to sustain the team you\'re developing.</em>';
                }
        } else if (growth >= 28) {
            feedback += 'You achieved exceptional growth (${growth.toFixed(1)}%) while maintaining team performance. ';
        } else {
            feedback += 'You successfully achieved ${growth.toFixed(1)}% growth and met your target. ';
        }

        if (morale >= 75) {
            feedback += 'Your team morale remained strong, demonstrating that you brought people with you. ';
        }

        if (gameState.agility > 20) {
            feedback += 'You showed genuine agility, particularly in adapting your approach when faced with challenges. ';
        }

        feedback += '</p>';

        // NEW: Warning if they succeeded with terrible LEAD scores (Pyrrhic victory)
        const scenarioCount = 6;
        const avgLeadership = (gameState.leadership || 0) / scenarioCount;
        const avgExcellence = (gameState.excellence || 0) / scenarioCount;
        const avgAgility = (gameState.agility || 0) / scenarioCount;
        const avgDetermination = (gameState.determination || 0) / scenarioCount;

        // BENCHMARKS UPDATED 2026-05-16: Set to realistic values based on actual maximum achievable points
        const benchmarks = {
            leadership: 25,    // Max ~35 per scenario, benchmark = 70% of max
            excellence: 35,    // Max ~50 per scenario, benchmark = 70% of max
            agility: 15,       // Max ~22 per scenario, benchmark = 70% of max
            determination: 20  // Max ~28 per scenario, benchmark = 70% of max
        };

        const leadDeficits = [];
        if (avgLeadership < benchmarks.leadership * 0.9) leadDeficits.push(`Leadership (${avgLeadership.toFixed(0)} vs ${benchmarks.leadership})`);
        if (avgExcellence < benchmarks.excellence * 0.9) leadDeficits.push(`Excellence (${avgExcellence.toFixed(0)} vs ${benchmarks.excellence})`);
        if (avgAgility < benchmarks.agility * 0.6) leadDeficits.push(`Agility (${avgAgility.toFixed(0)} vs ${benchmarks.agility})`);
        if (avgDetermination < benchmarks.determination * 0.6) leadDeficits.push(`Determination (${avgDetermination.toFixed(0)} vs ${benchmarks.determination})`);

        // Only warn about Pyrrhic Victory if they won via GROWTH path (not capability path)
        // Coaching/capability players may have low LEAD scores in some LEAD dimensions but that's intentional
        // (wonViaCapability is already calculated above when checking win conditions)
        if (leadDeficits.length >= 3 && !wonViaCapability) {
            // Pyrrhic victory - succeeded with terrible leadership quality
            feedback += '</div><div class="feedback-section">';
            feedback += '<h4>⚠️ Warning: Pyrrhic Victory</h4>';
            feedback += '<p>';
            feedback += `You achieved the growth target (${growth.toFixed(1)}%), but your LEAD competency scores are concerningly low across multiple dimensions: ${leadDeficits.join(', ')}. `;
            feedback += '<strong>This suggests you drove results through pressure and instinct rather than through quality leadership.</strong> ';

            const dataRequestCount = gameState.infoRequests ? gameState.infoRequests.length : 0;
            if (dataRequestCount === 0) {
                feedback += 'You never requested additional information, suggesting decisions were made on gut instinct rather than evidence. ';
            }

            if (dominantStyle.percentage >= 60 && (dominantStyle.name === 'pacesetting' || dominantStyle.name === 'coercive')) {
                feedback += `Your reliance on ${dominantStyle.name} (${dominantStyle.percentage}%) achieved short-term results but didn't develop leadership capability. `;
            }

            feedback += '<strong>Year 1 success, but what about Year 2?</strong> This approach is unsustainable - you haven\'t built the LEAD competencies that drive long-term organizational success.';
            feedback += '</p>';
        }

        // NEW 2026-05-17: LEAD Competencies Explanation - what do the scores mean?
        feedback += '</div><div class="feedback-section">';
        feedback += '<h4>Your LEAD Competencies Explained:</h4>';

        // Calculate percentages of MAXIMUM POSSIBLE (not benchmark) for credibility
        // UPDATED 2026-05-17: TRUE maximums from code analysis
        const maximums = {
            leadership: 267,    // True maximum from optimal choices across 6 scenarios
            excellence: 300,    // Recalibrated - realistic info requests (not exhaustive at 495)
            agility: 155,       // True maximum from optimal choices across 6 scenarios
            determination: 212  // True maximum from optimal choices across 6 scenarios
        };

        const leadershipPercent = Math.round((gameState.leadership / maximums.leadership) * 100);
        const excellencePercent = Math.round((gameState.excellence / maximums.excellence) * 100);
        const agilityPercent = Math.round((gameState.agility / maximums.agility) * 100);
        const determinationPercent = Math.round((gameState.determination / maximums.determination) * 100);

        const dataRequestCount = gameState.infoRequests ? gameState.infoRequests.length : 0;

        // Leadership
        if (leadershipPercent >= 80) {
            feedback += `<p><strong>Leadership (${leadershipPercent}%):</strong> Excellent - You demonstrated strong style variety and contextual adaptation.</p>`;
        } else if (leadershipPercent >= 60) {
            feedback += `<p><strong>Leadership (${leadershipPercent}%):</strong> Good - You used multiple leadership styles but could be more adaptive.</p>`;
        } else if (leadershipPercent >= 40) {
            feedback += `<p><strong>Leadership (${leadershipPercent}%):</strong> Adequate - Limited style variety suggests some over-reliance on comfort zone.</p>`;
        } else {
            feedback += `<p><strong>Leadership (${leadershipPercent}%):</strong> Needs development - Very limited style variety, overly rigid approach.</p>`;
        }

        // Excellence
        if (excellencePercent >= 80) {
            feedback += `<p><strong>Excellence (${excellencePercent}%):</strong> Excellent - You sought information ${dataRequestCount} times and made evidence-based decisions.</p>`;
        } else if (excellencePercent >= 60) {
            feedback += `<p><strong>Excellence (${excellencePercent}%):</strong> Good - Moderate information seeking (${dataRequestCount} requests) shows decision-making rigor.</p>`;
        } else if (excellencePercent >= 40) {
            feedback += `<p><strong>Excellence (${excellencePercent}%):</strong> Adequate - Only ${dataRequestCount} info requests suggests some reliance on gut-feel decision making.</p>`;
        } else {
            feedback += `<p><strong>Excellence (${excellencePercent}%):</strong> Needs development - ${dataRequestCount} info requests indicates decisions made on instinct rather than evidence.</p>`;
        }

        // Agility
        if (agilityPercent >= 80) {
            feedback += `<p><strong>Agility (${agilityPercent}%):</strong> Excellent - You navigated ambiguity and adapted to changing contexts effectively.</p>`;
        } else if (agilityPercent >= 60) {
            feedback += `<p><strong>Agility (${agilityPercent}%):</strong> Good - Demonstrated some adaptability but room for improvement in ambiguous situations.</p>`;
        } else if (agilityPercent >= 40) {
            feedback += `<p><strong>Agility (${agilityPercent}%):</strong> Adequate - Struggled somewhat with ambiguous situations or changing priorities.</p>`;
        } else {
            feedback += `<p><strong>Agility (${agilityPercent}%):</strong> Needs development - Difficulty adapting to uncertainty or changing contexts.</p>`;
        }

        // Determination
        if (determinationPercent >= 80) {
            feedback += `<p><strong>Determination (${determinationPercent}%):</strong> Excellent - Strong growth orientation and persistence facing challenges.</p>`;
        }else if (determinationPercent >= 60) {
            feedback += `<p><strong>Determination (${determinationPercent}%):</strong> Good - Moderate drive for results and willingness to tackle obstacles.</p>`;
        } else if (determinationPercent >= 40) {
            feedback += `<p><strong>Determination (${determinationPercent}%):</strong> Adequate - Limited growth focus or persistence when facing obstacles.</p>`;
        } else {
            feedback += `<p><strong>Determination (${determinationPercent}%):</strong> Needs development - Insufficient drive for results or resilience under pressure.</p>`;
        }

        // NEW: Self-identified style comparison
        if (gameState.selfIdentifiedStyle) {
            feedback += '</div><div class="feedback-section">';
            feedback += '<h4>Self-Awareness Check:</h4>';
            feedback += '<p>';

            const selfIdentified = gameState.selfIdentifiedStyle.toLowerCase();
            const actualDominant = dominantStyle.name.toLowerCase();
            const actualPercentage = results.leadershipProfile[actualDominant];

            if (selfIdentified === actualDominant) {
                feedback += `✅ <strong>Accurate self-awareness:</strong> You identified as ${gameState.selfIdentifiedStyle} and indeed used it ${actualPercentage.toFixed(0)}% of the time. `;
                if (actualPercentage > 60) {
                    feedback += 'However, you\'re <em>overusing</em> this style - even strengths become weaknesses when overplayed. ';
                } else {
                    feedback += 'This alignment between self-perception and behavior suggests good self-awareness.';
                }
            } else {
                const selfIdentifiedPercentage = results.leadershipProfile[selfIdentified] || 0;
                feedback += `⚠️ <strong>Self-awareness gap:</strong> You identified as ${gameState.selfIdentifiedStyle} but actually used it only ${selfIdentifiedPercentage.toFixed(0)}% of the time. `;
                feedback += `Your dominant style was ${dominantStyle.name} (${actualPercentage.toFixed(0)}%). `;
                feedback += 'This gap suggests you may not recognize how others experience your leadership. Consider seeking 360-degree feedback.';
            }

            feedback += '</p>';
        }

        // Information thoroughness analysis (dataRequestCount already calculated above in LEAD explanation)

        feedback += '</div><div class="feedback-section">';
        feedback += '<h4>Decision-Making Rigor:</h4>';
        feedback += '<p>';

        if (dataRequestCount === 0) {
            feedback += '⚠️ You requested <strong>zero additional information</strong> across all ${gameState.decisions.length} scenarios. ';
            feedback += 'This "decide on instinct" approach is fast but dangerous - you\'re operating with incomplete data. ';
        if (escaped) {
            feedback += 'You succeeded despite this, but won\'t always be lucky. Evidence-based leaders outperform gut-decision makers over time.';
        } else {
            feedback += 'This likely contributed to your challenges - key decisions lacked the information needed for success.';
        }
        } else if (dataRequestCount > 8) {
            feedback += '✅ Excellent thoroughness: You requested additional information ${dataRequestCount} times. ';
            feedback += 'This evidence-based approach strengthens decision quality and demonstrates intellectual curiosity. ';
            if (gameState.excellence > 50) {
            feedback += 'Your high excellence score (${gameState.excellence}) reflects this systematic thinking.';
            }
        } else if (dataRequestCount > 4) {
            feedback += 'Good: You requested information ${dataRequestCount} times (moderate thoroughness). ';
            feedback += 'You balance speed with due diligence. Consider: did you request info on the <em>right</em> decisions - the high-stakes, irreversible ones?';
        } else {
            feedback += 'You requested information ${dataRequestCount} times (low thoroughness). ';
            feedback += 'Leaders who seek more data before major decisions tend to make better choices. Ask yourself: "What would I need to know to be 90% confident in this decision?"';
        }

        feedback += '</p>';

        if (!results.optimal) {
            feedback += '</div><div class="feedback-section">';
            feedback += '<h4>Where You Left Performance on the Table:</h4>';
            feedback += '<p>';

            if (dominantStyle.percentage >= 60) {
                feedback += 'Your overreliance on ${dominantStyle.name} leadership (${dominantStyle.percentage}%) limited your effectiveness. ';
                feedback += 'More balanced use of ${underusedStyle.name} (only ${underusedStyle.percentage}%) could have unlocked higher performance. ';
            }

            if (growth < 28) {
                feedback += 'You achieved ${growth.toFixed(1)}% when 30%+ was possible with more strategic choices. ';
            }

            if (morale < 75) {
                feedback += 'Team morale at ${morale.toFixed(0)}% suggests room for improvement in people-centered leadership. ';
            }

            feedback += '</p>';
        }

        // NEW 2026-05-17: Connect Jung personality model to expected LEAD profile
        feedback += '</div><div class="feedback-section">';
        feedback += '<h4>Your Leadership Personality (Jung Model):</h4>';
        feedback += '<p>';

        feedback += `Your dominant color is <strong>${results.personalityColor}</strong>: ${results.personalityDescription}`;

        // Connect Jung color to expected LEAD strengths/weaknesses
        if (results.personalityColor === 'RED' || results.personalityColor.includes('RED')) {
            feedback += '<br><br><strong>Typical RED strengths:</strong> High Determination (results-focus), decisiveness, competitive drive. ';
            feedback += '<strong>Watch out for:</strong> Lower Excellence (acting on instinct), limited Leadership style variety. ';
        if (leadRatios.determination >= 0.80 && leadRatios.excellence < 0.60) {
            feedback += '✅ This matches your profile - strong drive but could benefit from more evidence-based decisions.';
        } else if (leadRatios.excellence >= 0.80) {
            feedback += 'Interestingly, your Excellence score is higher than typical for RED - you\'ve developed beyond your natural preference.';
        }
    } else if (results.personalityColor === 'BLUE' || results.personalityColor.includes('BLUE')) {
        feedback += '<br><br><strong>Typical BLUE strengths:</strong> High Excellence (systematic analysis), clear vision, strategic thinking. ';
        feedback += '<strong>Watch out for:</strong> Lower Agility (rigid plans), lower people-focus. ';
        if (leadRatios.excellence >= 0.80 && leadRatios.agility < 0.60) {
            feedback += '✅ This matches your profile - analytical strength but could be more adaptive to changing contexts.';
        } else if (leadRatios.agility >= 0.80) {
            feedback += 'Interestingly, your Agility score is higher than typical for BLUE - you\'ve developed flexibility beyond your natural preference.';
        }
    } else if (results.personalityColor === 'YELLOW' || results.personalityColor.includes('YELLOW')) {
        feedback += '<br><br><strong>Typical YELLOW strengths:</strong> High Leadership (collaborative), High Agility (adaptable), energizing teams. ';
        feedback += '<strong>Watch out for:</strong> Lower Determination (conflict avoidance), scattered focus. ';
        if (leadRatios.leadership >= 0.80 && leadRatios.determination < 0.60) {
            feedback += '✅ This matches your profile - great people skills but could be more results-focused when needed.';
        } else if (leadRatios.determination >= 0.80) {
            feedback += 'Interestingly, your Determination score is higher than typical for YELLOW - you\'ve developed drive beyond your natural preference.';
        }
    } else if (results.personalityColor === 'GREEN' || results.personalityColor.includes('GREEN')) {
        feedback += '<br><br><strong>Typical GREEN strengths:</strong> High Leadership (coaching), people development, building organizational capability. ';
        feedback += '<strong>Watch out for:</strong> Lower Determination (slow to act), lower Agility (comfort with status quo). ';
        if (leadRatios.leadership >= 0.80 && leadRatios.determination < 0.60) {
            feedback += '✅ This matches your profile - exceptional people development but could be more action-oriented when urgency demands it.';
        } else if (leadRatios.determination >= 0.80) {
            feedback += 'Interestingly, your Determination score is higher than typical for GREEN - you\'ve developed urgency beyond your natural preference.';
        }
    } else if (results.personalityColor === 'BALANCED') {
        feedback += '<br><br><strong>Balanced Leadership Profile:</strong> You don\'t show a strong preference for any single Jung temperament. ';
        feedback += 'This suggests high adaptability - you can shift between different leadership modes as context requires. ';
        feedback += 'Your LEAD scores likely show relatively even development across all four dimensions.';
    }

    feedback += '</p>';

    feedback += '</div><div class="feedback-section">';
    feedback += '<h4>The Key Insight:</h4>';
    feedback += '<p>';

    if (results.optimal) {
        feedback += 'You demonstrated balanced leadership, adapting your style to context while keeping both results and people in focus. This is sustainable high performance.';
    } else if (dominantStyle.name === 'pacesetting') {
        feedback += 'You\'re a strong driver who sometimes forgets that sustainable leadership requires bringing people with you, not just pushing them forward. Your team delivered despite pressure, not because of inspiration.';
    } else if (dominantStyle.name === 'affiliative') {
        feedback += 'Your people-first approach built goodwill, but sometimes avoided necessary tough decisions. Great leaders care personally AND challenge directly.';
    } else {
        feedback += 'You have strong leadership instincts. The next level is consciously adapting your style to what each situation requires, rather than defaulting to your comfort zone.';
    }

    feedback += '</p></div>';

} else {
    // Failure feedback - BE SPECIFIC ABOUT WHY THEY FAILED
    feedback += '<h4>Let\'s Be Direct:</h4>';
    feedback += '<p>';

    // Build specific failure reasons
    const failureReasons = [];

    if (!meetsGrowth && !capabilityPath) {
        failureReasons.push(`growth of ${growth.toFixed(1)}% fell short of the 15% target`);
    }

    if (attrition >= 15) {
        failureReasons.push(`team attrition of ${attrition.toFixed(0)}% exceeded the healthy threshold of 15%`);
    }

    if (morale < 65) {
        failureReasons.push(`team morale of ${morale.toFixed(0)}% was below the required 65%`);
    }

    if (gameState.profitMargin <= 15) {
  failureReasons.push(`profit margin of ${gameState.profitMargin.toFixed(1)}% was below the required 15%`);
    }

    // NEW: LEAD quality failure - check both average AND individual dimensions
    if (!meetsLEADQuality) {
        // Check if it's average failure or individual dimension failure
        const dimensionFailures = [];
        if (leadRatios.leadership < 0.30) dimensionFailures.push(`Leadership ${(leadRatios.leadership * 100).toFixed(0)}%`);
        if (leadRatios.excellence < 0.30) dimensionFailures.push(`Excellence ${(leadRatios.excellence * 100).toFixed(0)}%`);
        if (leadRatios.agility < 0.30) dimensionFailures.push(`Agility ${(leadRatios.agility * 100).toFixed(0)}%`);
        if (leadRatios.determination < 0.30) dimensionFailures.push(`Determination ${(leadRatios.determination * 100).toFixed(0)}%`);

        if (dimensionFailures.length > 0) {
            failureReasons.push(`critical LEAD dimension(s) below 30% minimum: ${dimensionFailures.join(', ')}`);
        } else {
            failureReasons.push(`average LEAD competency score was only ${(avgLEADRatio * 100).toFixed(0)}% of benchmark (minimum 40% required)`);
        }
    }

    // NEW: Leadership balance failure
    if (!meetsBalanceRequirement) {
        // Find which style was overused
        const overusedStyle = Object.keys(stylePercentages).find(s => stylePercentages[s] === maxStylePercentage);
        failureReasons.push(`over-reliance on ${overusedStyle} leadership (${maxStylePercentage.toFixed(0)}% of decisions, maximum 70% allowed)`);
    }

    // Clear explanation of failure
    // NEW: Special case for high organizational capability that narrowly missed
    // REBALANCED 2026-05-17: Updated to new thresholds (120-145 cap, 8%+ growth)
    const nearCapabilityPath = gameState.organizationalCapability >= 120 && gameState.organizationalCapability < 145 && gameState.growth >= 8;

    if (nearCapabilityPath) {
        // They were close to the capability path - acknowledge the good leadership
        feedback += '<strong>Target not met - but you were close to an alternative win path.</strong> ';
        feedback += `You built strong organizational capability (${gameState.organizationalCapability.toFixed(0)} points, need 145) through coaching and people development. `;
        feedback += 'With slightly more focus on team capability building, you could have succeeded via the Organizational Capability path (which requires 145+ capability and 8% growth). ';
        feedback += `You achieved ${growth.toFixed(1)}% growth which shows potential, but didn\'t quite reach the threshold for either path. `;
    } else if (meetsGrowth && failureReasons.length > 0) {
        // They hit growth but failed on other metrics - THIS WAS THE BUG SCENARIO
        feedback += '<strong>Target not met.</strong> While you achieved ${growth.toFixed(1)}% growth (exceeding the 15% target), you failed because: ';
        feedback += failureReasons.join(', and ') + '.';
        feedback += '<strong>Leadership isn\'t just about results - it\'s about sustainable performance.</strong> ';
    } else if (!meetsGrowth && failureReasons.length > 1) {
        // Multiple failures
        feedback += '<strong>Target not met.</strong> The issues: ';
        feedback += failureReasons.join('; ') + '.';
    } else {
        // Single failure (just growth)
        feedback += `<strong>Target not met.</strong> Growth reached only ${growth.toFixed(1)}% against a 15% target.`;
    }

    feedback += '</p>';

    feedback += '</div><div class="feedback-section">';
    feedback += '<h4>What Happened:</h4>';
    feedback += '<p>';

    // Analyze decision patterns from actual gameplay
    const aggressiveCount = this.countAggressiveDecisions(gameState.decisions);
    const collaborativeCount = this.countCollaborativeDecisions(gameState.decisions);
    const dataRequestCount = gameState.infoRequests ? gameState.infoRequests.length : 0;

    // Generate scenario-specific feedback based on actual decisions
    if (dominantStyle.name === 'pacesetting' && dominantStyle.percentage >= 70 && morale < 65) {
        feedback += `Your pacesetting approach (${dominantStyle.percentage}% of decisions) created early wins that masked a morale crisis (${morale.toFixed(0)}%). `;

        // Reference specific scenarios
        const talentExodusDecision = gameState.decisions.find(d => d.scenarioId === 'talent_exodus');
        if (talentExodusDecision && aggressiveCount > 4) {
            feedback += 'In Month 8 (Talent Exodus), your aggressive response came too late - the damage was already done by relentless pressure in earlier scenarios. ';
        } else {
            feedback += 'When talented people started leaving, you tried to power through instead of addressing the root cause: your leadership style. ';
        }
    } else if (dominantStyle.name === 'affiliative' && growth < 15) {
        feedback += 'Your desire to maintain harmony prevented you from making tough decisions when needed. ';

        // Reference specific low-growth scenarios
        const competitorDecision = gameState.decisions.find(d => d.scenarioId === 'competitor_threat');
        if (competitorDecision && growth < 15) {
            feedback += 'In Month 6 (Competitor Threat), a more aggressive response could have captured market share. ';
        }
        feedback += 'Avoiding conflict doesn\'t make it go away - it just delays the consequences. ';
    } else {
        // New: More dynamic fallback that references actual patterns
        if (aggressiveCount >= 6) {
            feedback += `You took aggressive approaches in ${aggressiveCount} out of ${gameState.decisions.length} decisions. `;
        if (attrition >= 15) {
            feedback += `This drive-first mentality created ${growth.toFixed(1)}% growth but burned through your team (${attrition.toFixed(0)}% attrition). `;
        } else if (morale < 65) {
            feedback += `This created ${growth.toFixed(1)}% growth but at the cost of team morale (${morale.toFixed(0)}%). `;
        } else {
            feedback += `This resulted in ${growth.toFixed(1)}% growth. `;
    }
} else if (collaborativeCount >= 6) {
    feedback += `You favored collaborative approaches in ${collaborativeCount} decisions, building team morale (${morale.toFixed(0)}%). `;
    if (meetsGrowth) {
        feedback += `However, this left growth opportunities on the table (${growth.toFixed(1)}% vs. 15% target). `;
    }else if (attrition >= 15) {
        feedback += `Despite this, high attrition (${attrition.toFixed(0)}%) suggests the collaborative approach wasn't genuine or came too late. `;
    }
} else if (dataRequestCount === 0) {
    feedback += 'You never requested additional information, making all decisions with incomplete data. ';
    if (meetsGrowth) {
        feedback += `This "trust your gut" approach led to only ${growth.toFixed(1)}% growth, falling short of the 15% target. `;
    } else {
        feedback += `This "trust your gut" approach achieved ${growth.toFixed(1)}% growth but likely contributed to ${attrition >= 15 ? 'high attrition' : 'team issues'}. `;
    }
} else {
    feedback += `You used a mixed approach across ${gameState.decisions.length} scenarios. `;
    if (!meetsGrowth) {
        feedback += `Growth (${growth.toFixed(1)}%) fell short because key early decisions didn't compound effectively. `;
    } else if (attrition >= 15) {
        feedback += `While you achieved ${growth.toFixed(1)}% growth, team attrition (${attrition.toFixed(0)}%) became unsustainable. `;
    } else if (morale < 65) {
        feedback += `While you achieved ${growth.toFixed(1)}% growth, team morale (${morale.toFixed(0)}%) suffered. `;
    }
    }
    }

feedback += '</p>';

feedback += '</div><div class="feedback-section">';
feedback += '<h4>The Hard Truth:</h4>';
feedback += '<p>';

if (attrition > 25) {
feedback += 'Leadership isn\'t about being the smartest or hardest-driving person in the room. ';
feedback += 'It\'s about creating conditions where others thrive. You optimized for metrics, not people. ';
feedback += 'In the real world, that\'s a recipe for burnout and failure.';
} else if (!meetsGrowth && results.leadershipProfile.coaching < 20) {
    // New: Address specific gap
feedback += 'In important growth targets (${growth.toFixed(1)}% vs. 28%) while barely using coaching leadership (${results.leadershipProfile.coaching}%). ';
feedback += 'In JCB\'s reality, sustainable growth requires developing your people\'s capabilities, not just directing their efforts. ';

// Reference Year-End reflection if it exists
const yearEndDecision = gameState.decisions.find(d => d.scenarioId === 'year_end');
if (yearEndDecision && yearEndDecision.choices[0]) {
    const reflectionChoice = yearEndDecision.choices[0].index;
    if (reflectionChoice === 2) { // "Should have pushed harder"
        feedback += 'Even at the end, you reflected that you "should have pushed harder" - missing the real insight that you needed to develop, not drive, your team.';
    }
}
else if (!meetsGrowth && gameState.leadership < 30) {
    // New: Low leadership score
    feedback += 'You achieved ${growth.toFixed(1)}% growth against a 15% target. Your leadership quality score (${gameState.leadership}) suggests you managed tasks but didn\'t truly lead people. ';
    feedback += 'The gap between management and leadership is the gap between your result and success.';
}
else {
    feedback += 'You had the capability to succeed but made choices that prioritized short-term gains over sustainable performance. ';
    feedback += 'Leadership requires patience and the courage to do what\'s right, not what\'s easy.';
}

feedback += '</p>';

// NEN: Add "Most Important Improvement" section for scoreboard
feedback += '<div><div class="feedback-section" style="margin-top: 20px; padding: 15px; background: rgba(255, 203, 0, 0.1); border-left: 4px solid var(--jcb-yellow);">';
feedback += '<h4 style="color: var(--jcb-yellow);"> ⚠️ Most Important Improvement:</h4>';
feedback += '<p style="font-size: 1.1em; font-weight: 500;">';

// Determine single most critical improvement
const criticalImprovement = this.getCriticalImprovement(gameState, results);
feedback += criticalImprovement;

feedback += '</p>';

feedback += '</div>';
}
return feedback;
}

countAggressiveDecisions(decisions) {
// Count decisions using RED-coded or pacesetting/coercive styles
// Only count each decision once (don't double-count style + color)
let count = 0;
decisions.forEach(decision => {
  let isAggressive = false;

  if (decision.stylesUsed) {
    if (decision.stylesUsed.includes('pacesetting') || decision.stylesUsed.includes('coercive')) {
      isAggressive = true;
    }
  }

  if (!isAggressive && decision.colorsUsed) {
    if (decision.colorsUsed.includes('RED')) {
      isAggressive = true;
    }
  }

  if (isAggressive) count++;
});
return count;
}

countCollaborativeDecisions(decisions) {
  // Count decisions using GREEN/YELLOW-coded or democratic/affiliative/coaching styles
  // Only count each decision once (don't double-count style + color)
  let count = 0;
  decisions.forEach(decision => {
    let isCollaborative = false;

    if (decision.stylesUsed) {
      if (decision.stylesUsed.includes('democratic') ||
          decision.stylesUsed.includes('affiliative') ||
          decision.stylesUsed.includes('coaching')) {
        isCollaborative = true;
      }
    }

    if (!isCollaborative && decision.colorsUsed) {
      if (decision.colorsUsed.includes('GREEN') || decision.colorsUsed.includes('YELLOW')) {
        isCollaborative = true;
      }
    }

    if (isCollaborative) count++;
  });
  return count;
}

getCriticalImprovement(gameState, results) {
  const growth = gameState.growth;
  const morale = gameState.morale;
  const attrition = gameState.attrition;
  const profitMargin = gameState.profitMargin;
  const profile = results.leadershipProfile;
  const lead = {
    leadership: gameState.leadership,
    excellence: gameState.excellence,
    agility: gameState.agility,
    determination: gameState.determination
  };

  // Find LEAD gaps for personalization
  const leadBenchmarks = { leadership: 75, excellence: 65, agility: 45, determination: 40 };
  const leadGaps = {
    leadership: lead.leadership - leadBenchmarks.leadership,
    excellence: lead.excellence - leadBenchmarks.excellence,
    agility: lead.agility - leadBenchmarks.agility,
    determination: lead.determination - leadBenchmarks.determination
  };
  const biggestLEADGap = Object.entries(leadGaps).reduce((a, b) => a[1] < b[1] ? a : b);

  // Find dominant and underused styles for contextual feedback
  const dominantStyle = this.getDominantStyle(profile);
  const underusedStyle = this.getUnderusedStyle(profile);
  const secondMostUsed = this.getSecondMostUsedStyle(profile);

  // Build personalized feedback with varied structures to avoid formulaic repetition

  // PRIORITY 1: Failed growth by significant margin (catastrophic commercial failure)
  if (growth < 15) {
    const shortfall = 20 - growth;

    if (profile.authoritative < 20 && profile.pacesetting < 30) {
      // Too passive overall
      const mostUsedStyle = dominantStyle.name === 'democratic' ? 'consensus-seeking' :
                            dominantStyle.name === 'affiliative' ? 'harmony-focused' :
                            dominantStyle.name === 'coaching' ? 'developmental' : dominantStyle.name;
      return `Your ${mostUsedStyle} approach (${dominantStyle.percentage.toFixed(0)}%) might feel comfortable, but ${growth.toFixed(1)}% growth says you're playing not to lose rather than playing to win. Where's the ambition? Start with "Primal Leadership" by Goleman - learn when to inspire bold action, not just maintain relationships.`;
    } else if (profile.pacesetting > 59) {
      // Driving too hard without direction
      const moraleImpact = morale < 65 ? ` and morale is suffering (${morale.toFixed(0)}%)` : '';
const attritionImpact = attrition > 15 ? `, with ${attrition.toFixed(0)}% of your team already walking out the door` : '';
return `You're running hard (${profile.pacesetting.toFixed(0)}% pacesetting) but in the wrong direction - ${growth.toFixed(1)}% growth proves effort without strategy fails${moraleImpact}${attritionImpact}. Learn to channel that drive: read "Playing to Win" by Lafley to understand strategy, then "The Coaching Habit" to develop your team (currently ${profile.coaching.toFixed(0)}%) instead of doing everything yourself.`;
} else if (profile.coaching > 40) {
  // Over-coaching without driving results
  return `Coaching is noble (${profile.coaching.toFixed(0)}% of your decisions), but ${growth.toFixed(1)}% growth means you're developing people for someone else's business. You need commercial edge - read "Good to Great" by Collins to understand the paradox: develop people AND drive relentless results simultaneously.`;
} else {
  // General lack of strategic aggression
  return `${shortfall.toFixed(1)}% below target tells me you're managing the status quo, not leading transformation. JCB doesn't need careful administrators - it needs bold builders. Read "Playing to Win" by Lafley: learn how P&G leaders make high-stakes strategic choices when competitors are circling.`;
}
}

// PRIORITY 2: Culture crisis (high attrition = talent exodus)
if (attrition >= 20) {
const attritionRounded = attrition.toFixed(0);

if (profile.affiliative < 20 && profile.coaching < 20) {
  // Task-focused, people are just resources
  const taskFocusedStyle = profile.pacesetting > profile.authoritative ? 'pacesetting' :
                          profile.authoritative > 30 ? 'authoritative' :
                          profile.coercive > 10 ? 'coercive' : 'directive';
  return `${attritionRounded}% attrition - people are fleeing, not following. Your ${taskFocusedStyle} leadership treats them as resources to extract value from, not humans to develop. Read "Dare to Lead" by Brené Brown and confront this truth: you can't lead people you don't genuinely value.`;
} else if (profile.coaching < 20) {
  // People like you but don't grow with you
  const moraleNote = morale > 70 ? ' (ironic, given morale is decent)' : '';
  return `Losing ${attritionRounded}% of your team${moraleNote} means talented people hit a ceiling with you. They need growth, not just warmth. Your coaching muscle (${profile.coaching.toFixed(0)}%) is underdeveloped - read "The Coaching Habit" by Stanier and commit to one 15-min development conversation per person, weekly.`;
} else if (profile.pacesetting > 50) {
  // Burning people out despite good intentions
  const moraleQualifier = morale < 65 ? 'abysmal' : morale < 75 ? 'fragile' : 'surprisingly resilient';
  return `${attritionRounded}% attrition with ${moraleQualifier} morale (${morale.toFixed(0)}%) - you're burning through people like fuel. Your pacesetting intensity (${profile.pacesetting.toFixed(0)}%) might deliver short-term wins, but the cost is unsustainable. Read "Radical Candor" by Scott: care personally while challenging directly, don't just drive harder.`;
} else {
  // Balanced but not authentic
  return `${attritionRounded}% of your people left despite balanced-looking leadership. The issue isn't your style mix - it's authenticity. Are you going through the motions or genuinely invested in their success? Read "The Culture Code" by Coyle: understand how trust is built through hundreds of small moments, not grand gestures.`;
}
}

// PRIORITY 3: Moderate-high attrition (15-20%) - warning sign
if (attrition >= 15) {
  if (profile.affiliative < 15 && morale < 70) {
    return `Attrition is creeping toward dangerous levels (${attrition.toFixed(0)}%) and morale isn't great either (${morale.toFixed(0)}%). You're treating leadership like a chess game - strategic but cold. People aren't pieces to move; they're the game. Build your affiliative capacity from ${profile.affiliative.toFixed(0)}%: start with "Dare to Lead" by Brené Brown.`;
  } else if (dominantStyle.percentage > 65) {
    const styleLabel = dominantStyle.name === 'pacesetting' ? 'relentless drive' :
                      dominantStyle.name === 'authoritative' ? 'visionary intensity' :
                      dominantStyle.name === 'democratic' ? 'endless consultation' :
                      `${dominantStyle.name} approach`;
    return `Your ${styleLabel} (${dominantStyle.percentage.toFixed(0)}% ${dominantStyle.name}) is becoming predictable - ${attrition.toFixed(0)}% attrition suggests people are tuning out. Overusing any style creates diminishing returns. Diversify: read "Primal Leadership" (Goleman) to master situational leadership across all six styles.`;
  }
}

// PRIORITY 4: Win conditions met but low morale (pyrrhic victory)
if (results.growth && morale < 65) {
  const growthNote = growth > 30 ? `aggressive ${growth.toFixed(1)}% growth` : `${growth.toFixed(1)}% growth`;
  if (profile.pacesetting > 40) {
    return `You hit ${growthNote} and ${gameState.profitMargin.toFixed(1)}% margins, but morale is ${morale.toFixed(0)}% - this victory is temporary. Your pacesetting drive (${profile.pacesetting.toFixed(0)}%) creates sprints, not marathons. Read "The Culture Code" by Coyle: high-performing teams thrive, they don't just survive quarter to quarter.`;
  } else {
    return `Targets met, team morale at ${morale.toFixed(0)}% - you're winning battles but losing hearts. This isn't sustainable leadership; it's extraction. What happens when these people leave? Read "Multipliers" by Wiseman: learn to amplify your team, not deplete them.`;
  }
} else if (results.escaped && morale < 70) {
  return `You cleared the bar (growth: ${growth.toFixed(1)}%, profit: ${profitMargin.toFixed(1)}%) but morale is only ${morale.toFixed(0)}% - this is a ticking time bomb. Success that exhausts people isn't leadership mastery. Read "The Culture Code" to understand how elite teams sustain peak performance without burnout.`;
}

// PRIORITY 5: Win conditions met but profit margin weak (<18%)
if (results.escaped && profitMargin < 18) {
  return `You hit growth (${growth.toFixed(1)}%) and culture targets, but profit margins are thin (${profitMargin.toFixed(1)}%). This suggests operational inefficiency or poor strategic choices. You need sharper commercial judgment - read "Playing to Win" by Lafley to understand how great leaders balance growth with profitability.`;
}

// PRIORITY 6: Balanced leadership but fell short on growth
// BUGFIX 2026-05-17: Catch more balanced scenarios (no single style >35%, not just results.isBalanced)
const maxStylePercentage = Math.max(...Object.values(profile));
const isBalancedPlay = maxStylePercentage < 35;

if (results.escaped === false && (results.isBalanced || isBalancedPlay)) {
  const shortfall = 20 - growth;
  const excellenceGap = leadGaps.excellence;
  if (excellenceGap < -15) {
    return `Balanced leadership, ${shortfall.toFixed(1)}% growth shortfall - the issue is decision quality (Excellence score: ${lead.excellence} vs 65 benchmark). You have range but lack rigor. Read "Thinking in Bets" by Duke: learn to make better calls when you can't predict outcomes, or study your decision-by-decision breakdown to see where you would have changed results.`;
  } else {
    return `Your leadership style is balanced, but you missed growth by ${shortfall.toFixed(1)}%. That's not a style problem - it's a judgment problem. When did you choose comfort over courage? Read "Primal Leadership" and ask: did you match the style to the situation, or match it to your mood?`;
  }
}

// PRIORITY 7: Failed due to SINGLE dominant style (>60% usage)
if (results.escaped === false && dominantStyle.percentage > 60) {
  const styleOveruse = dominantStyle.percentage.toFixed(0);

  if (dominantStyle.name === 'pacesetting') {
    const attritionNote = attrition > 15 ? ` and burned through your team (${attrition.toFixed(0)}% attrition)` : '';
    const moraleNote = morale < 65 ? `, crushing morale to ${morale.toFixed(0)}%` : '';
    return `${styleOveruse}% pacesetting - you drove relentlessly${attritionNote}${moraleNote}. Here's the hard truth: your intensity is your superpower AND your ceiling. You need balance, not more effort. Read "Multipliers" by Wiseman: learn when to step back so your team can step up.`;
  } else if (dominantStyle.name === 'democratic') {
    const growthNote = growth < 15 ? 'catastrophic' : growth < 20 ? 'insufficient' : 'modest';
    return `${styleOveruse}% democratic leadership, ${growthNote} growth (${growth.toFixed(1)}%) - you consulted your way to mediocrity. Consensus is valuable, but so is decisive action. Read "The Five Dysfunctions of a Team" by Lencioni: understand when debate must end and commitment must begin.`;
  } else if (dominantStyle.name === 'affiliative') {
    return `${styleOveruse}% affiliative - you prioritized harmony over hard truths and delivered ${growth.toFixed(1)}% growth. People might like you, but they're not following you toward anything meaningful. Read "Radical Candor" by Scott: learn to care personally AND challenge directly.`;
  } else if (dominantStyle.name === 'coaching') {
    return `${styleOveruse}% coaching - noble intent, ${growth.toFixed(1)}% growth reality. You're developing people for a future that's not arriving. Balance development work with driving results: read "Good to Great" by Collins to see how elite leaders do both simultaneously.`;
  } else if (dominantStyle.name === 'authoritative') {
    const moraleNote = morale < 65 ? `, morale is suffering (${morale.toFixed(0)}%)` : '';
    const underusedNote = underusedStyle.percentage < 15 ? ` while neglecting ${underusedStyle.name} (${underusedStyle.percentage.toFixed(0)}%)` : '';
    return `${styleOveruse}% authoritative${underusedNote}${moraleNote}. Vision without collaboration becomes dictatorship. Your team needs to be part of the solution, not just recipients of your brilliance. Read "Primal Leadership" to learn when to inspire and when to involve.`;
  } else if (dominantStyle.name === 'coercive') {
    return `${styleOveruse}% coercive - congratulations, you've created compliance through fear. This might work in a genuine crisis, but ${growth.toFixed(1)}% growth suggests it's just your default mode. Read "Dare to Lead" by Brené Brown and examine why you lead through control rather than trust.`;
  }
}

// PRIORITY 8: Critical underuse of coaching (<15%)
if (underusedStyle.name === 'coaching' && underusedStyle.percentage < 15) {
  const dominantNote = dominantStyle.percentage > 50 ? ` (you're ${dominantStyle.percentage.toFixed(0)}% ${dominantStyle.name})` : '';
  if (results.escaped) {
    return `You succeeded this time${dominantNote}, but coaching capability is only ${underusedStyle.percentage.toFixed(0)}%. That's your constraint for scaling - your team can't solve problems you haven't personally encountered. Read "The Coaching Habit" by Stanier: 7 questions that develop your team's capability daily.`;
  } else {
    return `Coaching skills at ${underusedStyle.percentage.toFixed(0)}%${dominantNote} means you're the bottleneck. Your team can't scale beyond your personal capacity. Read "Multipliers" by Wiseman: understand how great leaders amplify their team's intelligence instead of being the sole problem-solver.`;
  }
}

// PRIORITY 9: Biggest LEAD dimension gap
if (biggestLEADGap[1] < -20) {
  const dimension = biggestLEADGap[0];
  const score = lead[dimension];
  const benchmark = leadBenchmarks[dimension];
  const gap = Math.abs(biggestLEADGap[1]);

  if (dimension === 'leadership') {
    const taskFocus = profile.pacesetting > 40 ? 'You set the pace but don\'t inspire the team' :
                    profile.authoritative > 40 ? 'You cast vision but don\'t connect it to people\'s hearts' :
                    'You manage tasks effectively but don\'t lead people meaningfully';
    return `Leadership capability is ${gap} points below benchmark (${score} vs ${benchmark}). ${taskFocus}. Read "Primal Leadership" by Goleman: understand the emotional intelligence foundation that separates managers from leaders.`;
  } else if (dimension === 'excellence') {
    const decisionCount = gameState.decisions?.length || 6;
    const infoRequestRate = (gameState.infoRequests?.length / (decisionCount * 2) * 100).toFixed(0) || 6;
    return `Excellence score is ${gap} points below benchmark (${score} vs ${benchmark}) - you made ${decisionCount} decisions without gathering enough evidence (info request rate: ${infoRequestRate}%). Fast decisions aren't always good decisions. Read "Thinking in Bets" by Duke: learn to improve decision quality in uncertain environments.`;
  } else if (dimension === 'agility') {
    return `Agility is ${gap} points below benchmark (${score} vs ${benchmark}) - you're uncomfortable with ambiguity and change. JCB's environment demands adaptability; rigidity is a liability. Read "The Lean Startup" by Ries: learn to pivot based on evidence, or "Antifragile" by Taleb to understand how to gain from uncertainty.`;
  } else if (dimension === 'determination') {
    return `Determination is ${gap} points below benchmark (${score} vs ${benchmark}) - when faced with tough choices, you took the path of least resistance. JCB needs leaders who push through discomfort. Read "Grit" by Duckworth: understand what separates high achievers from everyone else (hint: it's not talent).`;
  }
}

// PRIORITY 10: Moderate LEAD gap with specific underused style
if (underusedStyle.percentage < 20) {
  if (underusedStyle.name === 'democratic') {
    const dominantNote = dominantStyle.percentage > 55 ? `Your ${dominantStyle.name} dominance (${dominantStyle.percentage.toFixed(0)}%)` : 'You';
    return `${dominantNote} rarely invite genuine input (democratic: ${underusedStyle.percentage.toFixed(0)}%). Innovation and buy-in require collaboration, not just decisive action. Read "The Five Dysfunctions of a Team" by Lencioni: learn how to build trust-based decision-making.`;
  } else if (underusedStyle.name === 'affiliative') {
    const moraleContext = morale < 70 ? ` explains your morale challenges (${morale.toFixed(0)}%)` : '';
    return `Affiliative leadership at ${underusedStyle.percentage.toFixed(0)}%${moraleContext} limits your cultural resilience; you're focused on tasks and results while people need connection and belonging. Read "The Culture Code" by Coyle: understand how belonging fuels performance.`;
  } else if (underusedStyle.name === 'authoritative') {
    return `Your authoritative leadership is only ${underusedStyle.percentage.toFixed(0)}% - teams need direction and inspiration, not just execution. Where's the compelling vision? Read "Start With Why" by Sinek: learn to articulate purpose that mobilizes people toward ambitious goals.`;
  }
}

// PRIORITY 11: Achieved optimal - focus on what could make them world-class
if (results.optimal) {
  const strongestLEAD = Object.entries(lead).reduce((a, b) => a[1] > b[1] ? a : b);
  const weakestLEAD = Object.entries(lead).reduce((a, b) => a[1] < b[1] ? a : b);

  if (weakestLEAD[1] < leadBenchmarks[weakestLEAD[0]]) {
    return `You achieved optimal performance, but ${weakestLEAD[0]} (${weakestLEAD[1]} vs ${leadBenchmarks[weakestLEAD[0]]}) is your constraint for world-class leadership. Even excellence has room to grow. Read "Good to Great" by Collins: understand what separates good leaders from truly great ones.`;
  } else {
    const styleRange = Math.max(...Object.values(profile)) - Math.min(...Object.values(profile));
    if (styleRange > 40) {
      return `Optimal result achieved, but uneven style distribution. Your leadership would be more resilient if every style was a genuine option, not just ${dominantStyle.name} (${dominantStyle.percentage.toFixed(0)}%). Read "Primal Leadership" to master all six styles fluently.`;
    } else {
      return `You achieved optimal - well done. Now the question is: can you do it again? Consistent excellence requires deep mastery. Read "The Score Takes Care of Itself" by Bill Walsh: learn how process discipline creates repeatable success.`;
    }
  }
}

// DEFAULT: General development with personalization
if (profile.coaching < 25) {
  const constraintNote = `growth < 25 ? 'Growth is limited' : attrition > 12 ? 'Talent retention suffers' : 'Team capability is capped'`;
  return `${constraintNote} because coaching capability is only ${profile.coaching.toFixed(0)}%. In fast-growth environments like JCB, your constraint isn't ideas or effort - it's whether your team can execute without you. Read "The Coaching Habit" by Stanier and commit to 7 essential questions that develop people daily.`;
} else if (dominantStyle.percentage > 50) {
  return `${dominantStyle.percentage.toFixed(0)}% ${dominantStyle.name} leadership - you've found your comfort zone and stopped growing. Leadership mastery requires fluency across all styles. Challenge yourself: read "Primal Leadership" by Goleman and intentionally practice your underused styles.`;
} else {
  const decisionQualityNote = lead.excellence < 65 ? 'sharpen your decision quality' :
                             lead.agility < 45 ? 'increase your comfort with ambiguity' :
                             lead.determination < 40 ? 'develop your resilience under pressure' :
                             'refine your contextual judgment';
  return `You have balanced skills but need to ${decisionQualityNote}. Study your decision-by-decision breakdown: identify where you chose comfort over what the situation needed. Read "Primal Leadership" by Goleman to master contextual leadership.`;
}
}

// Helper function to get second most used style for richer context
getSecondMostUsedStyle(profile) {
  const sortedStyles = Object.entries(profile)
    .sort((a, b) => b[1] - a[1]);

  return sortedStyles.length > 1 ?
    { name: sortedStyles[1][0], percentage: sortedStyles[1][1] } :
    { name: sortedStyles[0][0], percentage: sortedStyles[0][1] };
}

getDominantStyle(profile) {
  let maxStyle = { name: 'authoritative', percentage: 0 };

  Object.keys(profile).forEach(style => {
    if (profile[style] > maxStyle.percentage) {
      maxStyle = { name: style, percentage: profile[style] };
    }
  });

  return maxStyle;
}

getUnderusedStyle(profile) {
  let minStyle = { name: 'coaching', percentage: 100 };

  Object.keys(profile).forEach(style => {
    if (profile[style] < minStyle.percentage) {
      minStyle = { name: style, percentage: profile[style] };
    }
  });

  return minStyle;
}

generateRecommendations(gameState, results) {
  const recommendations = [];
  const profile = results.leadershipProfile;

  // Identify development areas
  if (profile.coaching < 30) {
    recommendations.push({
      title: 'DEVELOP YOUR COACHING MUSCLE (Critical)',
      description: `Current usage: ${profile.coaching}% | Optimal: 35-40%. Recommended: Read "The Coaching Habit" by Michael Bungay Stanier. Practice: Spend 30 min weekly in development conversations. Why: Your team needs growth opportunities, not just targets.`
    });
  }

  if (profile.pacesetting > 60) {
    recommendations.push({
      title: 'BALANCE PACESETTING WITH AFFILIATIVE (Important)',
      description: `You're ${profile.pacesetting}% pacesetting, ${profile.affiliative}% affiliative. Risk: Burning out high performers. Recommended: Study "Primal Leadership" (Goleman) Chapter 4. Practice: Recognize effort, not just results.`
    });
  }

  if (profile.democratic < 25) {
    recommendations.push({
      title: 'IMPROVE DEMOCRATIC DECISION-MAKING (Opportunity)',
      description: `You made most major decisions unilaterally. Recommended: Implement peer problem-solving techniques. Resource: "The Five Dysfunctions of a Team" (Lencioni).`
    });
  }

  // Check for short-term thinking
  const shortTermDecisions = gameState.decisions.filter(d =>
    d.scenario <= 2 // Early scenarios
  ).length;

  if (shortTermDecisions > 0) {
    recommendations.push({
      title: 'STRENGTHEN STRATEGIC PATIENCE (Foundation)',
      description: `You favored short-term options frequently. Recommended: Develop decision-making frameworks. Resource: "Thinking in Bets" by Annie Duke.`
    });
  }

  return recommendations.slice(0, 4); // Max 4 recommendations
}

calculateNumericalScore(gameState, results) {
  // Growth Score (38%)
  let growthScore = 0;
  if (gameState.growth >= 30) {
    growthScore = 100;
  } else if (gameState.growth >= 25) {
    growthScore = 85;
  } else if (gameState.growth >= 20) {
    growthScore = 70;
  } else {
    growthScore = (gameState.growth / 20) * 70;
  }

  // Team Score (30%)
  let teamScore = 0;
  if (gameState.morale >= 80 && gameState.attrition < 10) {
    teamScore = 100;
  } else if (gameState.morale >= 70 && gameState.attrition < 15) {
    teamScore = 80;
  } else if (gameState.morale >= 60 && gameState.attrition < 20) {
    teamScore = 60;
  } else {
    teamScore = 40;
  }

  // Leadership Balance Score (25%)
  let balanceScore = 0;
  if (results.optimal) {
    balanceScore = 100;
  } else if (this.isBalancedLeadership(gameState)) {
    balanceScore = 85;
  } else {
    const dominant = this.getDominantStyle(results.leadershipProfile);
    if (dominant.percentage <= 50) {
      balanceScore = 70;
    } else if (dominant.percentage <= 60) {
      balanceScore = 55;
    } else {
      balanceScore = 40;
    }
  }

  // Quality Metrics (15%)
  const qualityScore = (
    (gameState.leadership / 100) * 25 +
    (gameState.excellence / 100) * 25 +
    (gameState.agility / 100) * 25 +
    (gameState.determination / 100) * 25
  );

  // Final weighted score
  const finalScore = Math.round(
    (growthScore * 0.38) +
    (teamScore * 0.30) +
    (balanceScore * 0.25) +
    (qualityScore * 0.15)
  );

  return finalScore;
}

// ==============================================
// ROUND 2 SCENARIO SCORING METHODS
// ==============================================

scoreMergerIntegration(scenario, decision, impact, gameState) {
  // CRITICAL FIX: Award Excellence points for info requests FIRST
  if (decision.infoRequested && decision.infoRequested.length > 0) {
    decision.infoRequested.forEach(info => {
      if (info.type === 'useful') impact.excellence += 10;
      else if (info.type === 'red herring') impact.excellence += 3;
      else if (info.type === 'trap') impact.excellence += 5;
    });
    if (decision.infoRequested.length >= 2) impact.excellence += 5;
  }

  // Part 1: Integration philosophy
  const philosophy = decision.choices[0].index;
  const philOption = scenario.decisions[0].options[philosophy];

  if (philOption) {
    impact.leadershipStyles[philOption.style] += 20;

    if (philOption.style === 'coercive') {
      impact.morale -= 12;
      impact.attrition += 8;
      impact.growth += 6;
      impact.leadership -= 15;
    } else if (philOption.style === 'democratic') {
      impact.morale += 10;
      impact.attrition -= 3;
      impact.leadership += 25;
      impact.excellence += 20;
      impact.agility += 15;
    } else if (philOption.style === 'coaching') {
    impact.morale += 8;
    impact.leadership += 20;
    impact.excellence += 15;
    impact.growth -= 2; 
    }// Slower but sustainable
  }

 // Part 2: Product line decision
  const product = decision.choices[1].index;
  const prodOption = scenario.decisions[1].options[product];

  if (prodOption) {
    impact.leadershipStyles[prodOption.style] += 15;

    if (product === 3) { // Customer pilot - data-driven
      impact.excellence += 30;
      impact.agility += 20;
      impact.growth += 5;
    } else if (product === 2) { // Combine best features
      impact.excellence += 25;
      impact.leadership += 15;
      impact.determination += 18;
    }
  }

  // Part 3: Cultural integration budget
  const budget = decision.choices[2].values;
  const teamBuilding = budget[0] || 0;
  const retention = budget[2] || 0;
  const training = budget[4] || 0;

  if (retention >= 0.3) {
    impact.attrition -= 8;
    impact.morale += 10;
  }
  if (teamBuilding >= 0.2 && training >= 0.2) {
    impact.leadership += 20;
    impact.morale += 8;
  }
}

scoreEthicalDilemma(scenario, decision, impact, gameState) {
  // CRITICAL FIX: Award Excellence points for Info requests FIRST
  if (decision.infoRequested && decision.infoRequested.length > 0) {
    decision.infoRequested.forEach(info => {
      if (info.type === 'useful') impact.excellence += 10;
      else if (info.type === 'red herring') impact.excellence += 3;  
    else if (info.type === 'trap') impact.excellence += 5;
  });
  if (decision.infoRequested.length >= 2) impact.excellence += 5;
}

// Part 1: The decision - CRITICAL ETHICS TEST
const ethicsChoice = decision.choices[0].index;
const ethicsOption = scenario.decisions[0].options[ethicsChoice];

if (ethicsOption) {
  impact.leadershipStyles[ethicsOption.style] += 25;

  if (ethicsChoice === 0) { // Walk away - principled
    impact.leadership += 35;
    impact.excellence += 30;
    impact.growth -= 12;
    impact.morale += 15;
    impact.determination += 25;
  } else if (ethicsChoice === 1) { // Escalate
    impact.leadership += 25;
    impact.excellence += 20;
    impact.growth -= 8;
    impact.determination += 15;
  } else if (ethicsChoice === 2) { // Alternative solution
    impact.leadership += 30;
    impact.excellence += 25;
    impact.agility += 25;
    impact.growth -= 3;
  } else if (ethicsChoice === 3) { // Approve it - DISASTER
    impact.leadership -= 40;
    impact.excellence -= 30;
    impact.growth += 18;
    impact.any -= 20;
    impact.attrition += 10;
  }
}

// Part 2: Team communication
const comm = decision.choices[1].index;
const commOption = scenario.decisions[1].options[comm];

if (commOption) {
  impact.leadershipStyles[commOption.style] += 15;

  if (commOption.style === 'authoritative') {
    impact.leadership += 20;
    impact.excellence += 15;
  } else if (commOption.style === 'coaching') {
        impact.leadership += 18;
    impact.morale += 10;
  }
}

// Part 3: Long-term response
const longTerm = decision.choices[2].index;
const ltoOption = scenario.decisions[2].options[longTerm];

if (ltoOption) {
  impact.leadershipStyles[ltoOption.style] += 15;
  impact.excellence += 20;
  impact.determination += 15;
}
}

scoreRemoteWorkDebate(scenario, decision, impact, gameState) {
  // CRITICAL FIX: Award Excellence points for info requests FIRST
  if (decision.infoRequested && decision.infoRequested.length > 0) {
    decision.infoRequested.forEach(info => {
      if (info.type === 'useful') impact.excellence += 10;
      else if (info.type === 'red herring') impact.excellence += 3;
      else if (info.type === 'trap') impact.excellence += 5;
    });
    if (decision.infoRequested.length >= 2) impact.excellence += 5;
  }

  // Part 1: Your approach
  const approach = decision.choices[0].index;
  const approachOption = scenario.decisions[0].options[approach];

  if (approachOption) {
    impact.leadershipStyles[approachOption.style] += 20;

    if (approach === 1) { // Fight for your team - advocate
      impact.leadership += 30;
      impact.morale += 15;
      impact.attrition -= 8;
      impact.determination += 20;
    } else if (approach === 0) { // Comply
      impact.morale -= 12;
      impact.attrition += 8;
      impact.leadership -= 10;
    } else if (approach === 2) { // Creative workaround
      impact.leadership += 25;
      impact.agility += 30;
      impact.morale += 12;
  }
}

// Part 2: Managing resignations
const manage = decision.choices[1].index;
const manageOption = scenario.decisions[1].options[manage];

if (manageOption) {
  impact.leadershipStyles[manageOption.style] += 20;

  if (manageOption.style === 'coaching') {
    impact.leadership += 20;
    impact.morale += 18;
    impact.attrition -= 5;
  } else if (manageOption.style === 'coercive') {
    impact.morale -= 15;
    impact.attrition += 12;
  }
}

// Part 3: Communication
const comm = decision.choices[2].index;
const commOption = scenario.decisions[2].options[comm];

if (commOption) {
  impact.leadershipStyles[commOption.style] += 15;
  impact.leadership += 15;
}
}

scoreSuccessionCrisis(scenario, decision, impact, gameState) {
  // CRITICAL FIX: Award Excellence points for info requests FIRST
  if (decision.infoRequested && decision.infoRequested.length > 0) {
    decision.infoRequested.forEach(info => {
      if (info.type === 'useful') impact.excellence += 10;
      else if (info.type === 'red herring') impact.excellence += 3;
      else if (info.type === 'trap') impact.excellence += 5;
    });
    if (decision.infoRequested.length >= 2) impact.excellence += 5;
  }

  // Part 1: Selection criteria (ranking)
  const ranking = decision.choices[0].ranking;

  // Award points based on what they prioritized
  if (ranking && ranking.length > 0) {
    // Top priority gets most weight
if (ranking[0].includes('people development')) {
  impact.leadership += 30;
  impact.excellence += 20;
  impact.determination += 15;
} else if (ranking[0].includes('Operational excellence')) {
  impact.excellence += 25;
  impact.leadership += 15;
} else if (ranking[0].includes('Strategic thinking')) {
  impact.agility += 25;
  impact.leadership += 20;
}
  }

// Part 2: Decision process
const process = decision.choices[1].index;
const processOption = scenario.decisions[1].options[process];

if (processOption) {
  impact.leadershipStyles[processOption.style] += 20;

  if (processOption.style === 'democratic') {
    impact.leadership += 25;
    impact.morale += 12;
    impact.excellence += 20;
  } else if (processOption.style === 'coaching') {
    impact.leadership += 30;
    impact.morale += 15;
    impact.determination += 18;
  } else if (processOption.style === 'authoritative') {
    impact.leadership += 20;
    impact.excellence += 15;
  }
}

// Part 3: Communication after decision
const comm = decision.choices[2].index;
const commOption = scenario.decisions[2].options[comm];

if (commOption) {
  impact.leadershipStyles[commOption.style] += 15;

  if (commOption.style === 'coaching') {
    impact.leadership += 25;
    impact.morale += 10;
    impact.attrition -= 5;
  }
}  
}  

scoreMarketDisruption(scenario, decision, impact, gameState) {
  // CRITICAL FIX: Award Excellence points for info requests FIRST
  if (decision.infoRequested && decision.infoRequested.length > 0) {
    decision.infoRequested.forEach(info => {
      if (info.type === 'useful') impact.excellence += 10;
      else if (info.type === 'red herring') impact.excellence += 3;
      else if (info.type === 'trap') impact.excellence += 5;
    });
    if (decision.infoRequested.length >= 2) impact.excellence += 5;
  }

  // Part 1: Immediate response
  const response = decision.choices[0].index;
  const responseOption = scenario.decisions[0].options[response];

  if (responseOption) {
    impact.leadershipStyles[responseOption.style] += 20;

    if (response === 0) { // Price cuts - reactive trap
      impact.growth -= 5;
      impact.profitMargin -= 8;
      impact.leadership -= 10;
      impact.agility -= 15;
    } else if (response === 1) { // Accelerate next-gen
      impact.growth += 10;
      impact.leadership += 25;
      impact.agility += 30;
      impact.excellence += 20;
      impact.determination += 25;
    } else if (response === 2) { // Partnership/acquisition
      impact.agility += 35;
      impact.leadership += 30;
      impact.excellence += 25;
    } else if (response === 3) { // Differentiate on service
      impact.leadership += 20;
      impact.agility += 20;
      impact.growth += 5;
    }
  }

  // Part 2: ESM investment allocation
  const investment = decision.choices[1].values;
  const rd = investment[0] || 0;
  const innovation = investment[3] || 0;
  const talent = investment[4] || 0;

  if (rd >= 2.0) {
    impact.excellence += 25;
    impact.agility += 20;
    impact.determination += 20;
  }
  if (innovation >= 1.0) {
    impact.agility += 25;
    impact.leadership += 20;
  }
  if (talent >= 1.5) {
    impact.excellence += 20;
    impact.agility += 15;
  }

  // Part 3: Organizational reflection
  const reflection = decision.choices[2].index;
  const reflectOption = scenario.decisions[2].options[reflection];

  if (reflectOption) {
    impact.leadershipStyles[reflectOption.style] += 20;

    if (reflection === 0) { // Post-mortem - learning culture
      impact.agility += 40;
      impact.excellence += 35;
      impact.leadership += 30;
    } else if (reflection === 1) { // Move forward - pacesetting
      impact.growth += 5;
      impact.agility -= 10;
      impact.morale -= 5;
    } else if (reflection === 2) { // Restructure decision-making
      impact.agility += 35;
      impact.leadership += 25;
      impact.morale += 10;
    }
  }
}

scoreYearEndRound2(scenario, decision, impact, gameState) {
  // CRITICAL FIX: Award Excellence points for info requests FIRST
  if (decision.infoRequested && decision.infoRequested.length > 0) {
    decision.infoRequested.forEach(info => {
      if (info.type === 'useful') impact.excellence += 10;
      else if (info.type === 'red herring') impact.excellence += 3;
      else if (info.type === 'trap') impact.excellence += 5;
    });
    if (decision.infoRequested.length >= 2) impact.excellence += 5;
  }  

// Part 1: Leadership growth reflection
const reflection = decision.choices[0].index;
const reflectOption = scenario.decisions[0].options[reflection];

if (reflectOption && reflectOption.impact) {
  const dimension = reflectOption.impact;
  impact.leadershipStyles[reflectOption.style] += 15;

  if (dimension === 'agility') {
    impact.agility += 30;
    impact.excellence += 20;
  } else if (dimension === 'determination') {
    impact.determination += 30;
    impact.leadership += 20;
  } else if (dimension === 'leadership') {
    impact.leadership += 30;
    impact.morale += 15;
  } else if (dimension === 'excellence') {
    impact.excellence += 30;
    impact.leadership += 20;
  }
}

// Part 2: Biggest lesson
const lesson = decision.choices[1].index;
const lessonOption = scenario.decisions[1].options[lesson];

if (lessonOption) {
  impact.leadershipStyles[lessonOption.style] += 20;

  if (lessonOption.style === 'coaching') {
    impact.leadership += 25;
    impact.excellence += 20;
  } else if (lessonOption.style === 'democratic') {
    impact.excellence += 20;
    impact.agility += 25;
  } else if (lessonOption.style === 'authoritative') {
    impact.excellence += 25;
    impact.determination += 20;
  }
}

// Part 3: Year 3 focus (ranking)
const ranking = decision.choices[2].ranking;

if (ranking && ranking.length > 0) {
  // Award based on top priority  
   if (ranking[0].includes('Developing')) {
    impact.leadership += 30;
    impact.morale += 15;
  } else if (ranking[0].includes('innovation')) {
    impact.agility += 30;
    impact.excellence += 20;
  } else if (ranking[0].includes('culture')) {
    impact.leadership += 25;
    impact.morale += 20;
  } else if (ranking[0].includes('commercial')) {
    impact.determination += 30;
    impact.growth += 8;
  }
}

// Bonus for Round 2 completion
impact.leadership += 20;
impact.excellence += 20;
impact.agility += 20;
impact.determination += 20;
}
    }

// Initialize scoring engine
const scoringEngine = new ScoringEngine();

if (typeof window !== 'undefined') {
  window.scoringEngine = scoringEngine;
} 