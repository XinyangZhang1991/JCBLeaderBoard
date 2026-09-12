//Scenario definitions for JCB Leadership Challenge

const round1Scenarios = [
  // Scenario 1: THE INHERITANCE
  {
    id: "inheritance",
    title: "THE INHERITANCE",
    subtitle: "Week 3 - Q1",
    month: 1,
    quarter: 1,
    description: `**WEEK 3 IN ROLE:** Your predecessor promised the Exec three Q1 initiatives:

• Aggressive marketing campaign for a new Loadall
• Comprehensive staff training program
• Dealer network overhaul

**The Problem:** Capacity exists for only TWO. Resources are stretched, timelines conflict, and the Exec expects all three.

**The Politics:**
• Marketing Director (close to CEO): "Marketing is non-negotiable"
• HR Director (your ally): "Training is essential - we're hemorrhaging talent"
• Sales Director (skeptical of you): "Dealer relationships are deteriorating"

**The Complication:** Exec update in 2 weeks. Which do you cut, and how do you explain it?`,

    decisions: [
      {
        title: "Part 1: Which initiative do you CUT? (Select ONE to eliminate)",
        type: "choice",
        options: [
          {
            text: "A) Cut the Marketing Campaign (keep Training + Dealer relationships)",
            style: "coaching",
            color: "GREEN",
          },
          {
            text: "B) Cut the Training Program (keep Marketing + Dealer relationships)",
            style: "pacesetting",
            color: "RED",
          },
          {
            text: "C) Cut the Dealer Network Overhaul (keep Marketing + Training)",
            style: "pacesetting",
            color: "BLUE",
          },
          {
            text: "D) Try to partially fund all three (£8M split 3 ways = £2.67M each)",
            style: "affiliative",
            color: "YELLOW",
          },
          {
            text: "E) Request additional budget approval from CFO",
            style: "democratic",
            color: "YELLOW",
          },
        ],
      },
      {
        title: "Part 2: Communication Approach",
        type: "choice",
        options: [
          {
            text: 'A) "I know this is hard - let\'s support each other through it"',
            style: "affiliative",
            color: "BLUE",
          },
          {
            text: 'B) "This is what we\'re doing - I need 100% commitment"',
            style: "coercive",
            color: "YELLOW",
          },
          {
            text: 'C) "This is the decision - execute it immediately"',
            style: "coercive",
            color: "RED",
          },
          {
            text: 'D) "We need results fast - here are your targets"',
            style: "pacesetting",
            color: "RED",
          },
          {
            text: 'E) "I trust you all - you know what\'s best for your areas"',
            style: "affiliative",
            color: "YELLOW",
          },
        ],
      },
      {
        title: "Part 3: How do you announce these priorities to the team?",
        type: "choice",
        options: [
          {
            text: "Detailed presentation with data and rationale",
            style: "pacesetting",
            color: "BLUE",
          },
          {
            text: "Open forum discussion on implementation",
            style: "democratic",
            color: "YELLOW",
          },
          {
            text: 'Direct mandate - "These are your assignments, get started now"',
            style: "coercive",
            color: "RED",
          },
          {
            text: "Individual check-ins to ensure everyone feels supported",
            style: "affiliative",
            color: "YELLOW",
          },
        ],
      },
    ],

    additionalInfo: [
      {
        label: "Last year's performance data",
        type: "useful",
        content:
          "Shows marketing had poor ROI last year (8% return vs 35% from training, 42% from dealer relationships). Training and dealer relationships yielded significantly better results.",
        validatesDecision: [0], // Validates cutting marketing (choice A in Part 1)
      },
      {
        label: "Marketing Director's track record",
        type: "trap",
        content:
          "Shows impressive campaign metrics but fails to mention that last year's campaign didn't translate to sales growth. Designed to make you think marketing is essential.",
        validatesDecision: null, // Trap - misleads into keeping marketing
      },
      {
        label: "Attrition data by department",
        type: "useful",
        content:
          "22% attrition in sales (highest in division), 18% in operations, 12% in marketing. HR warns that without training investment, attrition could reach 30%+.",
        validatesDecision: [1], // Shows you should NOT cut training (avoid choice B in Part 1)
      },
    ],

    consequenceText:
      "Your team responds to your leadership approach. First month metrics are being calculated...",

    // Scoring impacts (will be calculated by scoring engine)
    scoreTemplates: {
      // Ranking: 0=Marketing, 1=Training, 2=Dealer, 3=Innovation, 4=Supply
      balancedRanking: [1, 2, 4], // Training, Dealer, Supply
      aggressiveRanking: [0, 3], // Marketing, Innovation
      // Communication style impacts
      communicationImpacts: {
        authoritative: { morale: 0, growth: 2 },
        democratic: { morale: 5, growth: 1 },
        coaching: { morale: 8, growth: 0 },
        pacesetting: { morale: -10, growth: 5 },
        affiliative: { morale: 3, growth: -2 },
      },
    },
  },

  // SCENARIO 2: THE DATA DILEMMA
  {
    id: "data_dilemma",
    title: "THE DATA DILEMMA",
    subtitle: "Month 2 - Q1",
    month: 2,
    quarter: 1,
    description: `Two reports land on your desk with contradictory conclusions:

**Marketing:** "Customer satisfaction at all-time high (92% positive sentiment)"
**Operations:** "Service complaints up 35%, response times deteriorating"

Both teams defend their methodology. Your CFO is confused. The Exec wants clarity on customer health in 48 hours.`,

    decisions: [
      {
        title: "Part 1: How do you reconcile these contradictory findings?",
        type: "choice",
        options: [
          {
            text: "Deep dive into both methodologies to find the disconnect",
            style: "pacesetting",
            color: "BLUE",
          },
          {
            text: "Make immediate decision based on business priorities - no time for debate",
            style: "coercive",
            color: "YELLOW",
          },
          {
            text: "Convene joint meeting with both teams to debate findings",
            style: "democratic",
            color: "YELLOW",
          },
          {
            text: "Trust the metric most aligned to business outcomes (satisfaction)",
            style: "coercive",
            color: "RED",
          },
        ],
      },
      {
        title:
          "Part 2: You discover both are technically correct - Marketing surveys loyal customers, Operations tracks all complaints including new segments. How do you present to the Exec?",
        type: "choice",
        options: [
          {
            text: "Acknowledge complexity and present both viewpoints honestly",
            style: "affiliative",
            color: "GREEN",
          },
          {
            text: 'Synthesize into single narrative: "Core customers happy, growth segments need attention"',
            style: "pacesetting",
            color: "BLUE",
          },
          {
            text: "Frame as strategic opportunity: satisfaction high + complaints rising = growth opportunity",
            style: "authoritative",
            color: "BLUE",
          },
          {
            text: "Request more time to investigate fully before presenting",
            style: "affiliative",
            color: "YELLOW",
          },
        ],
      },
    ],

    additionalInfo: [
      {
        label: "Marketing survey methodology",
        type: "useful",
        content:
          "Surveys sent to customers who purchased in last 12 months - skews to loyal base",
      },
      {
        label: "Operations complaint data",
        type: "useful",
        content:
          "Tracks all inquiries including new customer segments with different expectations",
      },
      {
        label: "CFO perspective",
        type: "trap",
        content: "Wants simple answer for Exec, encourages oversimplification",
      },
    ],

    consequenceText:
      "Your analytical approach to conflicting data influences team's trust in your judgment...",
  },

  // SCENARIO 3: THE SAFETY CRISIS
  {
    id: "safety_crisis",
    title: "THE SAFETY NEAR-MISS",
    subtitle: "Month 3 - Q1",
    month: 3,
    quarter: 1,
    description: `A near-miss incident at your main distribution facility involving a Telescopic Handler. No injuries, but HSE regulations were nearly breached.

**The Finger-Pointing:**
• Operations Director: "Suspend the employee - protect the company from liability"
• HR Director: "This is a training gap - immediate retraining (2 days downtime)"
• Safety Officer: "Facility-wide safety audit before resuming (1 week downtime)"

**The Pressure:** An HSE inspector visits next week. Doing nothing risks severe regulatory consequences; overreacting damages morale and delays Q1 targets.

**What do you do?**`,

    decisions: [
      {
        title: "Part 1: Immediate Response - What action do you take TODAY?",
        type: "choice",
        options: [
          {
            text: "A) Suspend employee pending investigation (HR recommendation)",
            style: "coercive",
            color: "RED",
          },
          {
            text: "B) Immediate retraining for employee and team (£15k, 2 days)",
            style: "coaching",
            color: "GREEN",
          },
          {
            text: "C) Facility-wide safety audit (£85k, 1 week downtime)",
            style: "authoritative",
            color: "BLUE",
          },
          {
            text: "D) Issue safety reminder and continue operations (zero cost)",
            style: "affiliative",
            color: "YELLOW",
          },
          {
            text: "E) Investigate root cause first, then decide (1 week)",
            style: "democratic",
            color: "YELLOW",
          },
        ],
      },
      {
        title: "Part 2: How do you communicate this to the broader team?",
        type: "choice",
        options: [
          {
            text: "A) Firm warning about safety standards and consequences",
            style: "coercive",
            color: "RED",
          },
          {
            text: 'B) Frame as learning opportunity - "Let\'s use this to improve"',
            style: "coaching",
            color: "GREEN",
          },
          {
            text: 'C) Empathetic approach - "We\'re all in this together"',
            style: "affiliative",
            color: "YELLOW",
          },
          {
            text: 'D) Set clear expectations - "Excellence in safety is non-negotiable"',
            style: "pacesetting",
            color: "RED",
          },
          {
            text: 'E) Facilitated discussion - "What can WE do to prevent this?"',
            style: "democratic",
            color: "YELLOW",
          },
        ],
      },
    ],

    additionalInfo: [
      {
        label: "Previous safety record data",
        type: "useful",
        content:
          "This is the first incident in 3 years - suggests systemic issue, not individual fault. Strong safety culture historically.",
        validatesDecision: [1, 4], // Validates retraining or investigation (choices B, E)
      },
      {
        label: "Speak with employee involved",
        type: "useful",
        content:
          "Reveals training gap in new equipment protocols introduced 2 months ago. Employee had only 1 day training vs recommended 3 days.",
        validatesDecision: [1], // Validates retraining (choice B)
      },
      {
        label: "Legal team memo on liability",
        type: "trap",
        content:
          'Emphasizes CYA discipline approach, creates fear culture. Recommends immediate suspension to "protect the company."',
        validatesDecision: null, // Trap - misleads into suspension
      },
    ],

    consequenceText:
      "Word of your crisis response spreads through the organization. Team morale shifts...",

    scoreTemplates: {
      punitive: { morale: -15, attrition: 12, growth: 2 }, // Quick discipline
      balanced: { morale: 8, growth: -2, attrition: -3 }, // Investigation + coaching
      excessive: { morale: -5, growth: -5 }, // Full shutdown
    },
  },

  // SCENARIO 4: THE AMBIGUOUS SIGNAL
  {
    id: "ambiguous_signal",
    title: "THE AMBIGUOUS SIGNAL",
    subtitle: "Month 5 - Q2",
    month: 5,
    quarter: 2,
    description: `Customer sentiment is "changing" but nobody can pinpoint why. Sales velocity has slowed 8% month-over-month. Three conflicting theories:

**Sales Director:** "Competitor launched a new hydraulic feature we don't have"
**Finance Director:** "Economic uncertainty is making buyers delay"
**Your gut:** "Our team's approach has gone stale - we're not listening to customers"

Data is incomplete and contradictory. Your CFO demands immediate action; your strategy lead wants 3 weeks to research.`,

    decisions: [
      {
        title: "Part 1: How do you interpret this incomplete information?",
        type: "choice",
        options: [
          {
            text: "Make reasonable assumptions based on experience and act decisively",
            style: "authoritative",
            color: "RED",
          },
          {
            text: "Invest time to gather comprehensive data systematically",
            style: "authoritative",
            color: "BLUE",
          },
          {
            text: "Consult with wider stakeholder group (dealers, customers, team)",
            style: "democratic",
            color: "YELLOW",
          },
          {
            text: "Run small experiments in different regions to test theories",
            style: "democratic",
            color: "GREEN",
          },
        ],
      },
      {
        title:
          "Part 2: After investigation, you discover ALL THREE theories are partially true. What's your approach?",
        type: "choice",
        options: [
          {
            text: "Focus resources on the biggest factor (competitor feature)",
            style: "authoritative",
            color: "BLUE",
          },
          {
            text: "Address all three simultaneously with integrated strategy",
            style: "democratic",
            color: "YELLOW",
          },
          {
            text: "Test different approaches in different regions to learn",
            style: "democratic",
            color: "GREEN",
          },
          {
            text: "Make decisive call on root cause based on judgment",
            style: "pacesetting",
            color: "RED",
          },
        ],
      },
      {
        title:
          "Part 3: The situation remains ambiguous even after analysis. How do you move forward?",
        type: "choice",
        options: [
          {
            text: "Make executive decision and commit to it fully",
            style: "authoritative",
            color: "GREEN",
          },
          {
            text: "Commit to a direction and give it 90 days before reassessing",
            style: "authoritative",
            color: "BLUE",
          },
          {
            text: "Continue gathering data until picture is clearer",
            style: "affiliative",
            color: "YELLOW",
          },
          {
            text: "Trust my instincts and act now",
            style: "pacesetting",
            color: "RED",
          },
        ],
      },
    ],

    additionalInfo: [
      {
        label: "Customer interviews (sample of 12)",
        type: "useful",
        content:
          'Mixed signals - some mention competitor, some mention economy, some say "you stopped asking us what we need"',
      },
      {
        label: "Competitor intelligence report",
        type: "trap",
        content:
          "Exaggerates competitor threat, creates pressure to react hastily",
      },
      {
        label: "Your team's perspective",
        type: "useful",
        content:
          "Frontline staff notice customers feel rushed, less consultative conversations",
      },
    ],

    consequenceText:
      "How you handle ambiguity and uncertainty shapes team's confidence in your leadership...",
  },

  // SCENARIO 5: THE COMPETITOR THREAT
  {
    id: "competitor_threat",
    title: "THE COMPETITOR THREAT",
    subtitle: "Month 6 - Q2",
    month: 6,
    quarter: 2,
    description: `Major competitor just launched a Backhoe with features that match your flagship model at 15% lower price. Three key dealers are threatening to reduce JCB shelf space. Market share is slipping (-2.3% this month). You have £3M emergency budget to respond.`,

    decisions: [
      {
        title: "Part 1: Resource Allocation - Distribute £3M",
        type: "slider",
        sliders: [
          {
            label: "Price matching / discounts",
            max: 1.5,
            budgetConstraint: 3.0,
            color: "RED",
          },
          {
            label: "Accelerated R&D for next-gen features",
            max: 2.0,
            color: "BLUE",
          },
          { label: "Dealer incentive program", max: 1.5, color: "YELLOW" },
          { label: "Marketing counteroffensive", max: 1.2, color: "RED" },
          { label: "Customer loyalty program", max: 0.8, color: "YELLOW" },
          {
            label: "Dealer partnership strengthening (relationship-first)",
            max: 1.0,
            color: "GREEN",
          },
        ],
      },
      {
        title: "Part 2: Dealer Negotiation Approach",
        type: "timeline",
        options: [
          "Aggressive",
          "Firm but Fair",
          "Collaborative",
          "Concede Ground",
        ],
        styleMapping: [
          "coercive",
          "authoritative",
          "democratic",
          "affiliative",
        ],
        colorMapping: ["RED", "BLUE", "YELLOW", "YELLOW"],
      },
      {
        title: "Part 3: Team Mobilization",
        type: "choice",
        options: [
          {
            text: '"We\'re going to crush this competitor"',
            style: "pacesetting",
            color: "RED",
          },
          {
            text: '"Here\'s our vision to stay ahead"',
            style: "authoritative",
            color: "BLUE",
          },
          {
            text: '"Let\'s brainstorm solutions together"',
            style: "democratic",
            color: "YELLOW",
          },
          {
            text: '"I need you to step up individually"',
            style: "coaching",
            color: "GREEN",
          },
          {
            text: "\"We're strongest when we support each other - let's unite as one team\"",
            style: "affiliative",
            color: "YELLOW",
          },
        ],
      },
    ],

    additionalInfo: [
      {
        label: "Competitor intelligence report",
        type: "trap",
        content:
          "Exaggerates competitor threat, encourages panic spending on price matching",
      },
      {
        label: "Customer feedback on what they truly value",
        type: "useful",
        content: "Reveals features matter less than service and relationships",
      },
      {
        label: "CFO perspective on margin protection",
        type: "useful",
        content:
          "Shows long-term danger of price wars, recommends value differentiation",
      },
      {
        label: "Sales team sentiment survey",
        type: "red_herring",
        content: "They want aggressive discounts, but it's short-sighted",
      },
    ],

    consequenceText:
      "Market responds to your strategy. Dealer relationships and profit margins adjust...",

    scoreTemplates: {
      priceWar: { growth: 5, profitMargin: -8, marketShare: 3 }, // Heavy discounting
      balanced: {
        growth: -3,
        profitMargin: -1,
        marketShare: -1,
        futureGrowth: 12,
      }, // Invest in R&D + relationships
      reactive: { growth: 2, morale: -5 }, // Panic response
    },
  },

  // SCENARIO 4: THE TALENT EXODUS
  {
    id: "talent_exodus",
    title: "THE TALENT EXODUS",
    subtitle: "Month 8 - Q3",
    month: 8,
    quarter: 3,
    description: `Your top regional sales manager just resigned, citing "unsustainable pressure and lack of support." Two other high-performers are rumoured to be interviewing elsewhere. An anonymous survey reveals: "unrealistic targets without resources", "no work-life balance", "feeling like a number, not a person." HR warns that losing all three would trigger a crisis of confidence.

**What do you do?**`,

    decisions: [
      {
        title: "Part 1: Root Cause Assessment",
        type: "choice",
        options: [
          {
            text: "Review external factors (compensation, market conditions, etc.)",
            impact: "external",
            style: "authoritative",
            color: "BLUE",
          },
          {
            text: "Assess leadership approach and what isn't working - I need to change",
            impact: "selfaware",
            style: "coaching",
            color: "GREEN",
          },
          {
            text: "Increase team support and development opportunities",
            impact: "development",
            style: "coaching",
            color: "GREEN",
          },
          {
            text: "Headhunt for high flyers at competition, prepare replacements",
            impact: "harsh",
            style: "coercive",
            color: "RED",
          },
        ],
      },
      {
        title: "Part 2: Immediate Response",
        type: "choice",
        options: [
          {
            text: "Emergency team meeting with open forum",
            style: "democratic",
            color: "YELLOW",
          },
          {
            text: "Individual performance warnings for underperformers",
            style: "coercive",
            color: "GREEN",
          },
          {
            text: "Announce new retention program and benefits",
            style: "affiliative",
            color: "YELLOW",
          },
          {
            text: "Double down on performance standards",
            style: "pacesetting",
            color: "RED",
          },
          {
            text: "Reset vision and reconnect to purpose",
            style: "authoritative",
            color: "BLUE",
          },
        ],
      },
      {
        title: "Part 3: Q4 Targets Adjustment",
        type: "timeline",
        options: [
          "Maintain aggressive targets",
          "Reduce by 10%",
          "Reduce by 20%",
          "Reduce by 30%",
        ],
        styleMapping: ["coercive", "pacesetting", "democratic", "coaching"],
        colorMapping: ["RED", "BLUE", "YELLOW", "GREEN"],
      },
    ],

    additionalInfo: [
      {
        label: "Exit interview data from departed employees",
        type: "useful",
        content:
          'Confirms pace and pressure issues - "felt like numbers, not people"',
      },
      {
        label: "Industry salary benchmarking",
        type: "trap",
        content: "Suggests money is the answer - but culture is the real issue",
      },
      {
        label: "HR recommendation memo",
        type: "useful",
        content:
          "Identifies specific leadership behaviors causing issues: lack of recognition, unrealistic deadlines",
      },
      {
        label: "Retention case studies from other divisions",
        type: "red_herring",
        content:
          "Different contexts, not directly applicable to your situation",
      },
    ],

    consequenceText:
      "Your team watches closely to see if you genuinely change or just talk about it...",

    scoreTemplates: {
      moneyOnly: { attrition: 20, morale: -10, growth: -8 }, // Retention bonuses fail
      courseCorrect: { attrition: -8, morale: 15, growth: -5, agility: 25 }, // Admit and adjust
      denial: { attrition: 30, morale: -20, growth: -15 }, // Failure path
    },

    isCriticalMoment: true, // This is the reckoning for aggressive players
  },

  // SCENARIO 7: THE DIFFICULT CONVERSATION
  {
    id: "difficult_conversation",
    title: "THE DIFFICULT CONVERSATION",
    subtitle: "Month 9 - Q3",
    month: 9,
    quarter: 3,
    description: `Your most senior team member (20 years at JCB) is underperforming - 25% below target for two quarters. They're defensive to feedback and resistant to change, but widely respected and well-liked. Their team's morale is starting to drop. This must be addressed.`,

    decisions: [
      {
        title: "Part 1: How do you prepare for this conversation?",
        type: "choice",
        options: [
          {
            text: "Document performance issues formally with HR",
            style: "authoritative",
            color: "BLUE",
          },
          {
            text: "Seek to understand their perspective first",
            style: "coaching",
            color: "GREEN",
          },
          {
            text: "Practice the difficult conversation with a trusted advisor",
            style: "democratic",
            color: "YELLOW",
          },
          {
            text: "Focus on outcomes and clear expectations",
            style: "pacesetting",
            color: "RED",
          },
        ],
      },
      {
        title:
          "Part 2: During the conversation, they become emotional and defensive. You:",
        type: "choice",
        options: [
          {
            text: "Stay firm on performance expectations",
            style: "coercive",
            color: "RED",
          },
          {
            text: "Acknowledge their feelings, then refocus on performance",
            style: "coaching",
            color: "GREEN",
          },
          {
            text: "Explore what's really going on beneath the defensiveness",
            style: "coaching",
            color: "YELLOW",
          },
          {
            text: "Suggest taking a break to cool down and reschedule",
            style: "affiliative",
            color: "BLUE",
          },
        ],
      },
      {
        title: "Part 3: They reveal personal issues affecting work. You:",
        type: "choice",
        options: [
          {
            text: "Offer support but maintain performance expectations",
            style: "democratic",
            color: "YELLOW",
          },
          {
            text: "Give them 6 weeks grace period to address personal issues",
            style: "affiliative",
            color: "GREEN",
          },
          {
            text: "Refer to HR/EAP, keep performance discussion separate",
            style: "authoritative",
            color: "BLUE",
          },
          {
            text: "Co-create a recovery plan together",
            style: "coaching",
            color: "YELLOW",
          },
        ],
      },
    ],

    additionalInfo: [
      {
        label: "Performance data",
        type: "useful",
        content: "25% below target, declining trend over 6 months",
      },
      {
        label: "Team feedback",
        type: "useful",
        content: "Team respects them but frustrated with lack of direction",
      },
      {
        label: "HR guidance",
        type: "trap",
        content:
          "Suggests formal PIP process - may damage relationship unnecessarily",
      },
    ],

    consequenceText:
      "Your ability to balance empathy and accountability becomes clear...",
  },

  // SCENARIO 8: THE INNOVATION GAMBLE
  {
    id: "innovation_gamble",
    title: "THE INNOVATION GAMBLE",
    subtitle: "Month 10 - Q3/Q4",
    month: 10,
    quarter: 3,
    description: `Your R&D team presents a breakthrough: a hybrid-electric Loadall prototype 8 months ahead of schedule. Early customer feedback is phenomenal. Rush to market in Q4 (risky, game-changing) or wait for Q1 (safer, proven)? Marketing wants £1.2M for launch; Operations warns rushing could compromise quality.`,

    decisions: [
      {
        title: "Part 1: Launch Timeline",
        type: "choice",
        options: [
          {
            text: "Immediate (6 weeks, high risk, maximum impact)",
            timing: "immediate",
            style: "pacesetting",
            color: "RED",
          },
          {
            text: "Accelerated Q4 (10 weeks, moderate risk, strong impact)",
            timing: "accelerated",
            style: "authoritative",
            color: "BLUE",
          },
          {
            text: "Planned Q1 launch (18 weeks, low risk, miss year-end)",
            timing: "planned",
            style: "coaching",
            color: "GREEN",
          },
          {
            text: "Pilot program first (8 weeks pilot + delayed launch)",
            timing: "pilot",
            style: "democratic",
            color: "YELLOW",
          },
        ],
      },
      {
        title: "Part 2: Decision-Making Process",
        type: "choice",
        options: [
          {
            text: "Trust your gut and decide",
            style: "authoritative",
            color: "BLUE",
          },
          {
            text: "Convene cross-functional team vote",
            style: "democratic",
            color: "YELLOW",
          },
          {
            text: "Deep dive with R&D and operations leaders",
            style: "coaching",
            color: "GREEN",
          },
          {
            text: "Set the target and let teams figure it out",
            style: "pacesetting",
            color: "RED",
          },
          {
            text: "Team workshop - collaboratively decide launch readiness",
            style: "affiliative",
            color: "YELLOW",
          },
        ],
      },
      {
        title: "Part 3: Risk Mitigation - Allocate £1.5M",
        type: "slider",
        sliders: [
          {
            label: "Quality assurance testing",
            max: 0.6,
            budgetConstraint: 1.5,
            color: "BLUE",
          },
          { label: "Customer pilot program", max: 0.5, color: "YELLOW" },
          { label: "Warranty reserves", max: 0.4, color: "GREEN" },
          { label: "Marketing push", max: 0.8, color: "RED" },
          { label: "Operational contingency", max: 0.3, color: "BLUE" },
        ],
      },
    ],

    additionalInfo: [
      {
        label: "Customer pilot feedback verbatims",
        type: "useful",
        content:
          "Reveals specific concerns about battery life in cold weather - addressable with testing",
      },
      {
        label: "Competitor timeline intelligence",
        type: "trap",
        content:
          "Suggests competitor is 6 months away - creates false urgency to rush",
      },
      {
        label: "Technical risk assessment",
        type: "useful",
        content:
          "Identifies specific failure modes that need attention before full launch",
      },
      {
        label: "Exec pressure memo",
        type: "trap",
        content: "Emphasizes year-end politics over sound decision-making",
      },
    ],

    consequenceText:
      "Product launch begins. Quality control and market response will determine success...",

    scoreTemplates: {
      rush: { growth: 18, futureGrowth: -25 }, // Spectacular short-term, disaster long-term
      balanced: { growth: 9, morale: 5, futureGrowth: 15 }, // Accelerated with testing
      tooSlow: { growth: -3, missTarget: true }, // Safe but miss escape threshold
    },
  },

  // SCENARIO 6: THE YEAR-END RECKONING
  {
    id: "year_end",
    title: "THE YEAR-END RECKONING",
    subtitle: "Month 12 - Q4",
    month: 12,
    quarter: 4,
    description: `It's December. Exec meeting in 3 weeks. Three simultaneous challenges: (1) a major customer (15% of revenue) threatening to leave over service issues, (2) your exhausted team needs direction for next year, (3) the Exec want your Year 2 strategic plan.`,

    decisions: [
      {
        title:
          "Part 0: Reflecting on Your Year - What was your most important learning?",
        type: "choice",
        options: [
          {
            text: "I should have been more decisive from day one",
            style: "pacesetting",
            color: "RED",
          },
          {
            text: "I should have listened to my team more",
            style: "coaching",
            color: "GREEN",
          },
          {
            text: "I should have pushed harder for results",
            style: "pacesetting",
            color: "RED",
          },
          {
            text: "I learned to adapt my approach based on what each situation needed",
            style: "coaching",
            color: "GREEN",
          },
        ],
      },
      {
        title: "Part 1: Customer Crisis",
        type: "choice",
        options: [
          {
            text: "Assign your best people to fix it (risks burning them out)",
            impact: "burnout",
            style: "pacesetting",
            color: "RED",
          },
          {
            text: "Personally lead the customer recovery (time away from other priorities)",
            impact: "personal",
            style: "coaching",
            color: "GREEN",
          },
          {
            text: "Empower regional team with resources (trust them)",
            impact: "empower",
            style: "democratic",
            color: "YELLOW",
          },
          {
            text: "Negotiate compromise solution (reduce scope, preserve relationship)",
            impact: "compromise",
            style: "affiliative",
            color: "YELLOW",
          },
        ],
      },
      {
        title: "Part 2: Team Investment - Allocate £800K remaining budget",
        type: "slider",
        sliders: [
          {
            label: "Year-end bonuses for performance",
            max: 0.8,
            budgetConstraint: 0.8,
            color: "RED",
          },
          {
            label: "Team celebration and recognition event",
            max: 0.1,
            color: "YELLOW",
          },
          {
            label: "Year 2 capability investment (training, tools)",
            max: 0.7,
            color: "GREEN",
          },
          {
            label: "Roll budget to Year 2 targets (save money)",
            max: 0.8,
            color: "BLUE",
          },
        ],
      },
      {
        title: "Part 3: Exec Strategy - Year 2 Proposal",
        type: "choice",
        options: [
          {
            text: "Aggressive growth continuation (30%+ target)",
            impact: "aggressive",
            style: "pacesetting",
            color: "RED",
          },
          {
            text: "Consolidation and sustainability (15% growth, build culture)",
            impact: "consolidate",
            style: "coaching",
            color: "GREEN",
          },
          {
            text: "Innovation leadership (new products, market disruption)",
            impact: "innovation",
            style: "authoritative",
            color: "BLUE",
          },
          {
            text: "Balanced growth with team development (20% growth, capabilities)",
            impact: "balanced",
            style: "democratic",
            color: "YELLOW",
          },
        ],
      },
    ],

    additionalInfo: [
      {
        label: "Customer account history",
        type: "useful",
        content: "Shows specific service gaps - solvable with right resources",
      },
      {
        label: "Team sentiment in final month",
        type: "useful",
        content:
          "Reveals energy levels - some recharged, others at breaking point depending on your leadership",
      },
      {
        label: "Exec member individual priorities",
        type: "trap",
        content: "Encourages political maneuvering instead of sound strategy",
      },
      {
        label: "Year 2 market forecast",
        type: "red_herring",
        content: "Macro trends less important than internal capability",
      },
    ],

    consequenceText:
      "Final calculations underway. Your year of leadership is being evaluated...",

    scoreTemplates: {
      // Highly dependent on previous choices
      optimal: { growth: 28, morale: 78, attrition: 10 },
      recovery: { growth: 22, morale: 72, attrition: 15 },
      collapse: { growth: 15, morale: 45, attrition: 35 },
    },

    isFinale: true,
  },
];

// Make scenarios available to game engine
if (typeof window !== "undefined") {
  window.scenarios = {
    round1: round1Scenarios,
    // BUGFIX #9: Round 2 scenarios are not defined in this build. Export an empty
    // array so `window.scenarios.round2` is always defined and the Round 2 code
    // paths (scoring.js, game-engine.js) degrade gracefully instead of hitting
    // `undefined`. Add the real Round 2 scenarios here when they are authored.
    round2: [],
  };
}
