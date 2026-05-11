// Scoring Engine - Calculates decision impacts and final results

class ScoringEngine {
  constructor() {
    this.styleWeights = {
      coercive: 0,
      authoritative: 0,
      affiliative: 0,
      democratic: 0,
      pacesetting: 0,
      coaching: 0,
    };
  }

  calculateDecisionImpact(scenario, decision, gameState) {
    const impact = {
      growth: 0,
      marketShare: 0,
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
      case 'safety_crisis':
        this.scoreSafetyCrisis(scenario, decision, impact, gameState);
        break;
      case 'competitor_threat':
        this.scoreCompetitorThreat(scenario, decision, impact, gameState);
        break;
      case 'talent_exodus':
        this.scoreTalentExodus(scenario, decision, impact, gameState);
        break;
      case 'innovation_gamble':
        this.scoreInnovationGamble(scenario, decision, impact, gameState);
        break;
      case 'year_end':
        this.scoreYearEnd(scenario, decision, impact, gameState);
        break;
    }

    return impact;
  }

  scoreInheritance(scenario, decision, impact, gameState) {
    // Part 1: Ranking analysis
    const ranking = decision.choices[0].order;
    const top3 = ranking.slice(0, 3);

    // 0=Marketing, 1=Training, 2=Dealer, 3=Innovation, 4=Supply
    const aggressiveChoices = [0, 3]; // Marketing, Innovation
    const balancedChoices = [1, 2, 4]; // Training, Dealer, Supply

    const aggressiveCount = top3.filter(i => aggressiveChoices.includes(i)).length;
    const balancedCount = top3.filter(i => balancedChoices.includes(i)).length;

    if (balancedCount >= 2) {
      impact.growth += 6;
      impact.morale += 5;
      impact.leadership += 15;
      impact.excellence += 10;
    } else if (aggressiveCount >= 2) {
      impact.growth += 12;
      impact.morale -= 8;
      impact.attrition += 4;
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
          impact.growth += 2;
          impact.leadership += 15;
          break;
        case 'democratic':
          impact.morale += 5;
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
          impact.growth += 5;
          impact.attrition += 5;
          break;
        case 'affiliative':
          impact.morale += 3;
          impact.growth -= 2;
          break;
      }
    }
  }

  scoreSafetyCrisis(scenario, decision, impact, gameState) {
    // Part 1: Stakeholder choice
    const stakeholderChoice = decision.choices[0].index;
    const option = scenario.decisions[0].options[stakeholderChoice];

    if (option) {
      const style = option.style;
      impact.leadershipStyles[style] += 20;

      if (stakeholderChoice === 0) {
        // Ops Director - punitive
        impact.morale -= 15;
        impact.attrition += 12;
        impact.growth += 2;
        impact.leadershipStyles.coercive += 10;
      } else if (stakeholderChoice === 3) {
        // Split approach - balanced
        impact.morale += 8;
        impact.growth -= 2;
        impact.attrition -= 3;
        impact.excellence += 20;
        impact.leadershipStyles.democratic += 10;
      } else {
        // HR or Safety - coaching approaches
        impact.morale += 5;
        impact.growth -= 1;
        impact.excellence += 15;
      }
    }

    // Part 2: Timeline
    const timeline = decision.choices[1].value;
    const timelineDecision = scenario.decisions[1];

    // Apply style mapping if it exists
    if (timelineDecision.styleMapping && timelineDecision.styleMapping[timeline]) {
      impact.leadershipStyles[timelineDecision.styleMapping[timeline]] += 15;
    }

    if (timeline === 0) {
      // Immediate - appears decisive but misses root cause
      impact.morale -= 5;
      impact.leadershipStyles.coercive += 10;
    } else if (timeline === 1) {
      // 1 week - balanced
      impact.excellence += 10;
      impact.agility += 10;
    } else {
      // 3 weeks - thorough but slow
      impact.growth -= 3;
      impact.excellence += 15;
    }

    // Part 3: Communication
    const commChoice = decision.choices[2].index;
    const commOption = scenario.decisions[2].options[commChoice];

    if (commOption) {
      impact.leadershipStyles[commOption.style] += 15;

      if (commOption.style === 'coaching') {
        impact.morale += 10;
        impact.excellence += 10;
      } else if (commOption.style === 'coercive') {
        impact.morale -= 10;
        impact.attrition += 5;
      }
    }
  }

  scoreCompetitorThreat(scenario, decision, impact, gameState) {
    // Part 1: Resource allocation
    const allocation = decision.choices[0].values;
    // [priceMatch, r&d, dealers, marketing, loyalty]

    const priceMatch = allocation[0] || 0;
    const rnd = allocation[1] || 0;
    const dealers = allocation[2] || 0;
    const marketing = allocation[3] || 0;
    const loyalty = allocation[4] || 0;

    // Heavy price matching is trap
    if (priceMatch >= 1.0) {
      impact.growth += 5;
      impact.profitMargin -= 8;
      impact.marketShare += 3;
      // Sets up long-term damage
    }

    // Balanced investment in R&D and relationships
    if (rnd >= 1.0 && dealers >= 0.8) {
      impact.growth -= 3;
      impact.profitMargin -= 1;
      impact.marketShare -= 1;
      // But sets up Q3-Q4 gains
      impact.leadership += 20;
      impact.excellence += 15;
    }

    // Part 2: Negotiation approach
    const negotiation = decision.choices[1].value;
    const negotiationDecision = scenario.decisions[1];

    // Apply style mapping if it exists
    if (negotiationDecision.styleMapping && negotiationDecision.styleMapping[negotiation]) {
      impact.leadershipStyles[negotiationDecision.styleMapping[negotiation]] += 15;
    }

    if (negotiation === 0) {
      // Aggressive
      impact.marketShare += 2;
      impact.morale -= 3;
    } else if (negotiation === 2) {
      // Collaborative
      impact.marketShare += 1;
      impact.leadership += 15;
    }

    // Part 3: Team mobilization
    const mobilization = decision.choices[2].index;
    const mobOption = scenario.decisions[2].options[mobilization];

    if (mobOption) {
      impact.leadershipStyles[mobOption.style] += 20;

      if (mobOption.style === 'authoritative') {
        impact.morale += 5;
        impact.leadership += 15;
      } else if (mobOption.style === 'pacesetting') {
        impact.morale -= 8;
        impact.growth += 3;
      }
    }
  }

  scoreTalentExodus(scenario, decision, impact, gameState) {
    // CRITICAL SCENARIO - reckoning for aggressive leadership

    // Part 1: Root cause assessment
    const rootCause = decision.choices[0].index;

    if (rootCause === 0) {
      // Money - TRAP
      impact.attrition += 20;
      impact.morale -= 10;
      impact.growth -= 8;
    } else if (rootCause === 1) {
      // Leadership style mismatch - CORRECT + AGILITY
      impact.attrition -= 8;
      impact.morale += 15;
      impact.growth -= 5;
      impact.agility += 25;
      impact.leadershipStyles.coaching += 15;
    } else if (rootCause === 2) {
      // Unrealistic targets - CORRECT + AGILITY
      impact.attrition -= 6;
      impact.morale += 12;
      impact.growth -= 8;
      impact.agility += 20;
    } else if (rootCause === 3) {
      // Denial - FAILURE PATH
      impact.attrition += 30;
      impact.morale -= 20;
      impact.growth -= 15;
    } else if (rootCause === 4) {
      // Development - GOOD
      impact.morale += 10;
      impact.attrition -= 5;
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

  scoreInnovationGamble(scenario, decision, impact, gameState) {
    // Part 1: Launch timing
    const timing = decision.choices[0].index;
    const timingOption = scenario.decisions[0].options[timing];

    // Apply style mapping from choice options
    if (timingOption && timingOption.style) {
      impact.leadershipStyles[timingOption.style] += 20;
    }

    if (timing === 0) {
      // Immediate - TRAP
      impact.growth += 18;
      // But creates future disaster (quality issues)
      impact.excellence -= 25;
    } else if (timing === 1) {
      // Accelerated Q4 - BALANCED
      impact.growth += 9;
      impact.morale += 5;
      impact.excellence += 10;
    } else if (timing === 2) {
      // Q1 next year - TOO SLOW
      impact.growth -= 3;
      impact.excellence += 15;
    } else if (timing === 3) {
      // Pilot first - OPTIMAL
      impact.growth += 7;
      impact.morale += 8;
      impact.excellence += 20;
      impact.leadership += 15;
    }

    // Part 2: Decision process
    const process = decision.choices[1].index;
    const processOption = scenario.decisions[1].options[process];

    if (processOption) {
      impact.leadershipStyles[processOption.style] += 20;

      if (processOption.style === 'democratic' || processOption.style === 'coaching') {
        impact.morale += 5;
        impact.leadership += 10;
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
      impact.growth += 5;
      impact.excellence -= 10;
    }
  }

   scoreYearEnd(scenario, decision, impact, gameState) {
    // FINALE - highly dependent on previous performance

    // Part A: Customer crisis
    const customerChoice = decision.choices[0].index;
    const customerOption = scenario.decisions[0].options[customerChoice];

    // Apply style mapping from choice options
    if (customerOption && customerOption.style) {
      impact.leadershipStyles[customerOption.style] += 20;
    }

    if (customerChoice === 2 && gameState.morale >= 70) {
      // Empower team if morale is good
      impact.growth += 5;
      impact.morale += 8;
      impact.leadershipStyles.democratic += 10;
    } else if (customerChoice === 0 && gameState.morale < 65) {
      // Assign best people when they're already exhausted
      impact.morale -= 12;
      impact.attrition += 10;
    } else if (customerChoice === 1) {
      // Personal leadership
      impact.growth += 3;
      impact.leadership += 10;
    }

    // Part B: Team investment
    const investment = decision.choices[1].values;
    // [bonuses, celebration, capability, savings]

    const bonuses = investment[0] || 0;
    const celebration = investment[1] || 0;
    const capability = investment[2] || 0;

    if (capability >= 0.4) {
      // Invest in Year 2 capabilities
      impact.morale += 10;
      impact.leadership += 15;
    }

    if (bonuses > 0.5 && capability < 0.2) {
      // Money without investment in development
      impact.morale += 3;
    }

    // Part C: Year 2 strategy
    const strategy = decision.choices[2].index;
    const strategyOption = scenario.decisions[2].options[strategy];

    // Apply style mapping from choice options
    if (strategyOption && strategyOption.style) {
      impact.leadershipStyles[strategyOption.style] += 20;
    }

    if (strategy === 0 && gameState.morale < 70) {
      // Aggressive growth with exhausted team
      impact.morale -= 15;
      impact.attrition += 15;
    } else if (strategy === 3) {
      // Balanced approach
      impact.morale += 10;
      impact.leadership += 20;
      impact.growth += 5;
    } else if (strategy === 1 && gameState.attrition > 15) {
      // Consolidation when needed
      impact.morale += 15;
      impact.attrition -= 5;
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
      recommendations: []
    };

    // Check win conditions
    const meetsGrowth = gameState.growth >= 20;
    const healthyAttrition = gameState.attrition < 25;
    const healthyProfit = gameState.profitMargin > 15;

    // Balanced leadership gets slightly relaxed growth requirements
    const isBalanced = this.isBalancedLeadership(gameState);
    const balancedGrowthBonus = isBalanced && gameState.growth >= 18 && gameState.morale >= 70;

    results.escaped = (meetsGrowth || balancedGrowthBonus) && healthyAttrition && healthyProfit;

    const optimalGrowth = gameState.growth >= 28;
    const highMorale = gameState.morale >= 75;
    const lowAttrition = gameState.attrition < 12;

    results.optimal = optimalGrowth && highMorale && lowAttrition && this.isBalancedLeadership(gameState);

    // Calculate leadership style percentages
    const totalStylePoints = Object.values(gameState.leadershipStyles).reduce((a, b) => a + b, 0);

    Object.keys(gameState.leadershipStyles).forEach(style => {
      results.leadershipProfile[style] = totalStylePoints > 0
        ? Math.round((gameState.leadershipStyles[style] / totalStylePoints) * 100) : 0;
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

    // Recalculate win conditions for feedback
    const meetsGrowth = gameState.growth >= 20;

    const dominantStyle = this.getDominantStyle(results.leadershipProfile);
    const underusedStyle = this.getUnderusedStyle(results.leadershipProfile);

    let feedback = '<div class="feedback-section">';

    if (escaped) {
      feedback += '<h4>What You Did Well:</h4>';
      feedback += '<p>';

      if (growth >= 28) {
        feedback += `You achieved exceptional growth (${growth.toFixed(1)}%) while maintaining team performance. `;
      } else {
        feedback += `You successfully achieved ${growth.toFixed(1)}% growth and met your target. `;
      }

      if (morale >= 75) {
        feedback += 'Your team morale remained strong, demonstrating that you brought people with you. ';
      }

      if (gameState.agility > 20) {
        feedback += 'You showed genuine agility, particularly in adapting your approach when faced with challenges. ';
      }

      feedback += '</p>';

      if (!results.optimal) {
        feedback += '</div><div class="feedback-section">';
        feedback += '<h4>Where You Left Performance on the Table:</h4>';
        feedback += '<p>';

        if (dominantStyle.percentage > 60) {
          feedback += `Your overreliance on ${dominantStyle.name} leadership (${dominantStyle.percentage}%) limited your effectiveness. `;
          feedback += `More balanced use of ${underusedStyle.name} (only ${underusedStyle.percentage}%) could have unlocked higher performance. `;
        }

        if (growth < 28) {
          feedback += `You achieved ${growth.toFixed(1)}% when 30% was possible with more strategic choices. `;
        }

        if (morale < 75) {
          feedback += `Team morale at ${morale.toFixed(0)}% suggests room for improvement in people-centered leadership. `;
        }

        feedback += '</p>';
      }

      feedback += '</div><div class="feedback-section">';
      feedback += '<h4>The Key Insight:</h4>';
      feedback += '<p>';

      if (results.optimal) {
        feedback += 'You demonstrated balanced leadership, adapting your style to context while keeping both results and people in focus. This is sustainable high performance.';
      } else if (dominantStyle.name === 'pacesetting') {
        feedback += "You're a strong driver who sometimes forgets that sustainable leadership requires bringing people with you, not just pushing them forward. Your team delivered despite pressure, not because of it.";
      } else if (dominantStyle.name === 'affiliative') {
        feedback += 'Your people-first approach built goodwill, but sometimes avoided necessary tough decisions. Great leaders care personally AND challenge directly.';
      } else {
        feedback += 'You have strong leadership instincts. The next level is consciously adapting your style to what each situation requires, rather than defaulting to your comfort zone.';
      }

      feedback += '</p></div>';

    } else {
      // Failure feedback
      feedback += '<h4>Let\'s Be Direct:</h4>';
      feedback += '<p>';

      if (!meetsGrowth) {
        feedback += `You did not meet your target because growth reached only ${growth.toFixed(1)}% against a 20% target. `;
      }

      if (attrition > 25) {
        feedback += `Your team attrition rate of ${attrition.toFixed(0)}% made sustained performance impossible. `;
      }

      feedback += '</p>';

      feedback += '</div><div class="feedback-section">';
      feedback += '<h4>What Happened:</h4>';
      feedback += '<p>';

      if (dominantStyle.name === 'pacesetting' && dominantStyle.percentage >= 70) {
        feedback += `Your pacesetting approach (${dominantStyle.percentage}% of decisions) created early wins that masked a morale crisis. `;
        feedback += 'When talented people started leaving, you tried to power through instead of addressing the root cause: your leadership style.';
      } else if (dominantStyle.name === 'affiliative' && growth < 15) {
        feedback += 'Your desire to maintain harmony prevented you from making tough decisions when needed.';
        feedback += `Avoiding conflict doesn't make it go away - it just delays the consequences. `;
      } else {
        feedback += 'You optimized for what seemed immediately important but missed the systemic patterns.';
      }

      feedback += '</p>';

      feedback += '</div><div class="feedback-section">';
      feedback += '<h4>The Hard Truth:</h4>';
      feedback += '<p>';

      if (attrition > 25) {
        feedback += 'Leadership isn\'t about being the smartest or hardest-driving person in the room. ';
        feedback += 'It\'s about creating conditions where others thrive. You optimized for metrics, not people. ';
        feedback += 'In the real world, that\'s a recipe for burnout and failure.';
      } else {
        feedback += 'You had the capability to succeed but made choices that prioritized short-term gains over sustainable performance. ';
        feedback += 'Leadership requires patience and the courage to do what\'s right, not what\'s easy.';
      }

      feedback += '</p></div>';
    }

    return feedback;
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
            d.scenario < 2 // Early scenarios
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
        // Growth Score (30%)
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
            (growthScore * 0.30) +
            (teamScore * 0.30) +
            (balanceScore * 0.25) +
            (qualityScore * 0.15)
        );

        return finalScore;
    }
}

// Initialize scoring engine
const scoringEngine = new ScoringEngine();

if (typeof window !== 'undefined') {
    window.scoringEngine = scoringEngine;
}