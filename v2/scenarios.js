//Scenario definitions for JCB Leadership Challenge

const round1Scenarios = [
  // Scenario 1: THE INHERITANCE
  {
    id: "inheritance",
    title: "THE INHERITANCE",
    subtitle: "Week 3 - Q1",
    month: 1,
    quarter: 1,
    description: `**WEEK 3:** Your predecessor promised three Q1 initiatives: a Loadall campaign, staff training and a dealer overhaul. You can fund only TWO.

Marketing, HR and Sales each insist theirs is essential. Exec update in 2 weeks. Which do you cut?`,

    decisions: [
      {
        title: "Part 1: Which initiative do you cut?",
        type: "choice",
        options: [
          {
            text: "A) Cut marketing (keep training and dealers)",
            style: "coaching",
            color: "GREEN",
          },
          {
            text: "B) Cut training (keep marketing and dealers)",
            style: "pacesetting",
            color: "RED",
          },
          {
            text: "C) Cut the dealer overhaul (keep marketing and training)",
            style: "pacesetting",
            color: "BLUE",
          },
          {
            text: "D) Part-fund all three (£2M split 3 ways = £667K each)",
            style: "affiliative",
            color: "YELLOW",
          },
          {
            text: "E) Ask the CFO for more budget",
            style: "democratic",
            color: "YELLOW",
          },
        ],
      },
      {
        title: "Part 2: How do you communicate it?",
        type: "choice",
        options: [
          {
            text: 'A) "This is hard - let\'s support each other"',
            style: "affiliative",
            color: "BLUE",
          },
          {
            text: 'B) "This is the plan - I need full commitment"',
            style: "coercive",
            color: "YELLOW",
          },
          {
            text: 'C) "Decision made - execute it now"',
            style: "coercive",
            color: "RED",
          },
          {
            text: 'D) "We need results fast - here are your targets"',
            style: "pacesetting",
            color: "RED",
          },
          {
            text: 'E) "I trust you - you know your areas best"',
            style: "affiliative",
            color: "YELLOW",
          },
        ],
      },
      {
        title: "Part 3: How do you announce the priorities?",
        type: "choice",
        options: [
          {
            text: "Detailed presentation with data and rationale",
            style: "pacesetting",
            color: "BLUE",
          },
          {
            text: "Open forum on how to implement",
            style: "democratic",
            color: "YELLOW",
          },
          {
            text: 'Direct mandate - "Here are your assignments, start now"',
            style: "coercive",
            color: "RED",
          },
          {
            text: "Individual check-ins to keep everyone supported",
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
        content: "ROI: marketing 8%, training 35%, dealers 42%.",
        validatesDecision: [0], // Validates cutting marketing (choice A in Part 1)
      },
      {
        label: "Marketing Director's track record",
        type: "trap",
        content: "Strong campaign metrics, but no sales growth.",
        validatesDecision: null, // Trap - misleads into keeping marketing
      },
      {
        label: "Attrition data by department",
        type: "useful",
        content:
          "Attrition: sales 22%, operations 18%, marketing 12%. Could hit 30%+.",
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
    description: `Two reports contradict each other. Marketing: satisfaction at an all-time high (92% positive). Operations: complaints up 35%, response times worsening.

Both defend their methods. The Exec wants clarity on customer health within 48 hours.`,

    decisions: [
      {
        title: "Part 1: How do you reconcile the findings?",
        type: "choice",
        options: [
          {
            text: "Deep dive into both methods to find the disconnect",
            style: "pacesetting",
            color: "BLUE",
          },
          {
            text: "Decide now on business priorities - no time to debate",
            style: "coercive",
            color: "YELLOW",
          },
          {
            text: "Hold a joint meeting so both teams debate",
            style: "democratic",
            color: "YELLOW",
          },
          {
            text: "Trust the metric closest to business outcomes (satisfaction)",
            style: "coercive",
            color: "RED",
          },
        ],
      },
      {
        title:
          "Part 2: Both are right - Marketing surveys loyal customers, Operations tracks all complaints. How do you present to the Exec?",
        type: "choice",
        options: [
          {
            text: "Acknowledge complexity and present both views honestly",
            style: "affiliative",
            color: "GREEN",
          },
          {
            text: 'One story: "Core customers happy, growth segments need work"',
            style: "pacesetting",
            color: "BLUE",
          },
          {
            text: "Frame as opportunity: high satisfaction plus rising complaints equals growth",
            style: "authoritative",
            color: "BLUE",
          },
          {
            text: "Ask for more time to investigate before presenting",
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
          "Surveys only go to customers who bought in the last 12 months.",
      },
      {
        label: "Operations complaint data",
        type: "useful",
        content:
          "Tracks all inquiries, including new segments with different expectations.",
      },
      {
        label: "CFO perspective",
        type: "trap",
        content: "Wants a simple answer for the Exec - risks oversimplifying.",
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
    description: `A near-miss with a Telescopic Handler at your main distribution site. No injuries, but HSE rules were nearly breached.

Operations wants suspension, HR retraining (2 days), Safety a full audit (1 week). An HSE inspector visits next week. What now?`,

    decisions: [
      {
        title: "Part 1: What action do you take today?",
        type: "choice",
        options: [
          {
            text: "A) Suspend the employee pending investigation",
            style: "coercive",
            color: "RED",
          },
          {
            text: "B) Retrain the employee and team (£15k, 2 days)",
            style: "coaching",
            color: "GREEN",
          },
          {
            text: "C) Facility-wide safety audit (£85k, 1 week downtime)",
            style: "authoritative",
            color: "BLUE",
          },
          {
            text: "D) Issue a safety reminder and carry on (zero cost)",
            style: "affiliative",
            color: "YELLOW",
          },
          {
            text: "E) Find the root cause first, then decide (1 week)",
            style: "democratic",
            color: "YELLOW",
          },
        ],
      },
      {
        title: "Part 2: How do you tell the wider team?",
        type: "choice",
        options: [
          {
            text: "A) Firm warning on safety standards and consequences",
            style: "coercive",
            color: "RED",
          },
          {
            text: 'B) Learning opportunity - "Let\'s use this to improve"',
            style: "coaching",
            color: "GREEN",
          },
          {
            text: 'C) Empathetic - "We\'re all in this together"',
            style: "affiliative",
            color: "YELLOW",
          },
          {
            text: 'D) Clear expectations - "Safety excellence is non-negotiable"',
            style: "pacesetting",
            color: "RED",
          },
          {
            text: 'E) Open discussion - "What can we do to prevent this?"',
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
          "First incident in 3 years - points to a system issue, not an individual.",
        validatesDecision: [1, 4], // Validates retraining or investigation (choices B, E)
      },
      {
        label: "Speak with employee involved",
        type: "useful",
        content:
          "New equipment protocols: employee had 1 day of training, not the recommended 3.",
        validatesDecision: [1], // Validates retraining (choice B)
      },
      {
        label: "Legal team memo on liability",
        type: "trap",
        content:
          'Pushes a blame-first approach and immediate suspension to "protect the company."',
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
    description: `Sales velocity has slowed 8% month-over-month and nobody knows why. Three theories: a competitor's new hydraulic feature, economic uncertainty, or our team losing its customer focus.

Data is incomplete. Your CFO wants action now; your strategy lead wants 3 weeks.`,

    decisions: [
      {
        title: "Part 1: How do you read the incomplete picture?",
        type: "choice",
        options: [
          {
            text: "Assume based on experience and act decisively",
            style: "authoritative",
            color: "RED",
          },
          {
            text: "Invest time to gather comprehensive data",
            style: "authoritative",
            color: "BLUE",
          },
          {
            text: "Consult dealers, customers and the team",
            style: "democratic",
            color: "YELLOW",
          },
          {
            text: "Run small regional experiments to test the theories",
            style: "democratic",
            color: "GREEN",
          },
        ],
      },
      {
        title: "Part 2: All three theories turn out partly true. What now?",
        type: "choice",
        options: [
          {
            text: "Focus resources on the biggest factor (competitor feature)",
            style: "authoritative",
            color: "BLUE",
          },
          {
            text: "Address all three at once with one strategy",
            style: "democratic",
            color: "YELLOW",
          },
          {
            text: "Test different approaches in different regions",
            style: "democratic",
            color: "GREEN",
          },
          {
            text: "Make a decisive call on the root cause",
            style: "pacesetting",
            color: "RED",
          },
        ],
      },
      {
        title:
          "Part 3: It's still ambiguous after analysis. How do you move forward?",
        type: "choice",
        options: [
          {
            text: "Make the call and commit fully",
            style: "authoritative",
            color: "GREEN",
          },
          {
            text: "Commit to a direction, reassess in 90 days",
            style: "authoritative",
            color: "BLUE",
          },
          {
            text: "Keep gathering data until the picture clears",
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
          'Mixed: some cite the competitor, some the economy, some say "you stopped asking us."',
      },
      {
        label: "Competitor intelligence report",
        type: "trap",
        content:
          "Exaggerates the competitor threat and pressures a hasty reaction.",
      },
      {
        label: "Your team's perspective",
        type: "useful",
        content:
          "Frontline staff say customers feel rushed and conversations are less consultative.",
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
    description: `A major competitor launched a Backhoe matching your flagship at 15% lower price. Three key dealers may cut JCB shelf space. Market share is slipping (-2.3% this month). You have a £400K emergency budget.`,

    decisions: [
      {
        title: "Part 1: How do you allocate the £400K?",
        type: "slider",
        sliders: [
          {
            label: "Price matching / discounts",
            max: 0.2,
            budgetConstraint: 0.4,
            color: "RED",
          },
          {
            label: "Accelerated R&D for next-gen features",
            max: 0.3,
            color: "BLUE",
          },
          { label: "Dealer incentive program", max: 0.2, color: "YELLOW" },
          { label: "Marketing counteroffensive", max: 0.2, color: "RED" },
          { label: "Customer loyalty program", max: 0.1, color: "YELLOW" },
          {
            label: "Dealer partnership strengthening (relationship-first)",
            max: 0.1,
            color: "GREEN",
          },
        ],
      },
      {
        title: "Part 2: Your dealer negotiation approach",
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
        title: "Part 3: How do you mobilise the team?",
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
            text: "\"We're strongest together - let's unite as one team\"",
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
          "Exaggerates the threat and encourages panic spending on price matching.",
      },
      {
        label: "Customer feedback on what they truly value",
        type: "useful",
        content: "Features matter less than service and relationships.",
      },
      {
        label: "CFO perspective on margin protection",
        type: "useful",
        content:
          "Warns of long-term price wars; recommends value differentiation.",
      },
      {
        label: "Sales team sentiment survey",
        type: "red_herring",
        content: "They want aggressive discounts - short-sighted.",
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
    description: `Your top regional sales manager resigned, citing unsustainable pressure and no support. Two more high-performers may follow. Staff cite unrealistic targets, no work-life balance and feeling like a number.

HR warns losing all three would trigger a confidence crisis.`,

    decisions: [
      {
        title: "Part 1: What's the root cause?",
        type: "choice",
        options: [
          {
            text: "Review external factors (pay, market conditions)",
            impact: "external",
            style: "authoritative",
            color: "BLUE",
          },
          {
            text: "Assess my own leadership - what must I change?",
            impact: "selfaware",
            style: "coaching",
            color: "GREEN",
          },
          {
            text: "Increase team support and development",
            impact: "development",
            style: "coaching",
            color: "GREEN",
          },
          {
            text: "Headhunt rivals' high flyers as replacements",
            impact: "harsh",
            style: "coercive",
            color: "RED",
          },
        ],
      },
      {
        title: "Part 2: Your immediate response",
        type: "choice",
        options: [
          {
            text: "Emergency team meeting with open forum",
            style: "democratic",
            color: "YELLOW",
          },
          {
            text: "Performance warnings for underperformers",
            style: "coercive",
            color: "GREEN",
          },
          {
            text: "Announce a new retention programme and benefits",
            style: "affiliative",
            color: "YELLOW",
          },
          {
            text: "Double down on performance standards",
            style: "pacesetting",
            color: "RED",
          },
          {
            text: "Reset the vision and reconnect to purpose",
            style: "authoritative",
            color: "BLUE",
          },
        ],
      },
      {
        title: "Part 3: How do you adjust Q4 targets?",
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
          'Confirms pace and pressure issues - "felt like numbers, not people."',
      },
      {
        label: "Industry salary benchmarking",
        type: "trap",
        content:
          "Suggests money is the answer - but culture is the real issue.",
      },
      {
        label: "HR recommendation memo",
        type: "useful",
        content:
          "Names the causes: little recognition and unrealistic deadlines.",
      },
      {
        label: "Retention case studies from other divisions",
        type: "red_herring",
        content: "Different contexts - not directly applicable to you.",
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
    description: `Your most senior team member (20 years at JCB) is 25% below target for two quarters. They resist feedback but are widely respected, and their team's morale is dropping. This must be addressed.`,

    decisions: [
      {
        title: "Part 1: How do you prepare?",
        type: "choice",
        options: [
          {
            text: "Document the issues formally with HR",
            style: "authoritative",
            color: "BLUE",
          },
          {
            text: "Understand their perspective first",
            style: "coaching",
            color: "GREEN",
          },
          {
            text: "Rehearse the conversation with a trusted advisor",
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
        title: "Part 2: They become emotional and defensive. You:",
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
            text: "Explore what's beneath the defensiveness",
            style: "coaching",
            color: "YELLOW",
          },
          {
            text: "Take a break and reschedule",
            style: "affiliative",
            color: "BLUE",
          },
        ],
      },
      {
        title: "Part 3: They reveal personal issues. You:",
        type: "choice",
        options: [
          {
            text: "Offer support but keep performance expectations",
            style: "democratic",
            color: "YELLOW",
          },
          {
            text: "Give 6 weeks' grace to address personal issues",
            style: "affiliative",
            color: "GREEN",
          },
          {
            text: "Refer to HR/EAP, keep performance separate",
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
        content: "25% below target, declining over 6 months.",
      },
      {
        label: "Team feedback",
        type: "useful",
        content: "Team respects them but wants more direction.",
      },
      {
        label: "HR guidance",
        type: "trap",
        content: "Suggests a formal PIP - may damage the relationship.",
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
    description: `R&D has a hybrid-electric Loadall prototype 8 months early, with excellent customer feedback. Launch in Q4 (risky, game-changing) or Q1 (safer, proven)? Marketing wants £350K; Operations warns rushing risks quality.`,

    decisions: [
      {
        title: "Part 1: When do you launch?",
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
            text: "Pilot first (8 weeks, then delayed launch)",
            timing: "pilot",
            style: "democratic",
            color: "YELLOW",
          },
        ],
      },
      {
        title: "Part 2: How do you decide?",
        type: "choice",
        options: [
          {
            text: "Trust your gut and decide",
            style: "authoritative",
            color: "BLUE",
          },
          {
            text: "Hold a cross-functional team vote",
            style: "democratic",
            color: "YELLOW",
          },
          {
            text: "Deep dive with R&D and operations leaders",
            style: "coaching",
            color: "GREEN",
          },
          {
            text: "Set the target and let teams work it out",
            style: "pacesetting",
            color: "RED",
          },
          {
            text: "Team workshop to decide launch readiness",
            style: "affiliative",
            color: "YELLOW",
          },
        ],
      },
      {
        title: "Part 3: How do you allocate £500K?",
        type: "slider",
        sliders: [
          {
            label: "Quality assurance testing",
            max: 0.2,
            budgetConstraint: 0.5,
            color: "BLUE",
          },
          { label: "Customer pilot program", max: 0.2, color: "YELLOW" },
          { label: "Warranty reserves", max: 0.1, color: "GREEN" },
          { label: "Marketing push", max: 0.3, color: "RED" },
          { label: "Operational contingency", max: 0.1, color: "BLUE" },
        ],
      },
    ],

    additionalInfo: [
      {
        label: "Customer pilot feedback verbatims",
        type: "useful",
        content:
          "Concerns about cold-weather battery life - fixable with testing.",
      },
      {
        label: "Competitor timeline intelligence",
        type: "trap",
        content: "Claims the competitor is 6 months away - false urgency.",
      },
      {
        label: "Technical risk assessment",
        type: "useful",
        content: "Flags failure modes to fix before full launch.",
      },
      {
        label: "Exec pressure memo",
        type: "trap",
        content: "Puts year-end politics above sound decisions.",
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
    description: `December. Exec meeting in 3 weeks. Three challenges: a major customer (15% of revenue) may leave over service issues, your exhausted team needs direction, and the Exec want your Year 2 plan.`,

    decisions: [
      {
        title: "Part 0: What was your most important learning?",
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
            text: "I learned to adapt my approach to each situation",
            style: "coaching",
            color: "GREEN",
          },
        ],
      },
      {
        title: "Part 1: The customer crisis",
        type: "choice",
        options: [
          {
            text: "Assign your best people (risks burnout)",
            impact: "burnout",
            style: "pacesetting",
            color: "RED",
          },
          {
            text: "Lead the recovery yourself (time away from priorities)",
            impact: "personal",
            style: "coaching",
            color: "GREEN",
          },
          {
            text: "Empower the regional team with resources",
            impact: "empower",
            style: "democratic",
            color: "YELLOW",
          },
          {
            text: "Negotiate a compromise (reduce scope, keep the relationship)",
            impact: "compromise",
            style: "affiliative",
            color: "YELLOW",
          },
        ],
      },
      {
        title: "Part 2: How do you allocate £250K?",
        type: "slider",
        sliders: [
          {
            label: "Year-end bonuses for performance",
            max: 0.2,
            budgetConstraint: 0.25,
            color: "RED",
          },
          {
            label: "Team celebration and recognition event",
            max: 0.1,
            color: "YELLOW",
          },
          {
            label: "Year 2 capability investment (training, tools)",
            max: 0.2,
            color: "GREEN",
          },
          {
            label: "Roll budget to Year 2 targets (save money)",
            max: 0.2,
            color: "BLUE",
          },
        ],
      },
      {
        title: "Part 3: Your Year 2 proposal",
        type: "choice",
        options: [
          {
            text: "Aggressive growth (30%+ target)",
            impact: "aggressive",
            style: "pacesetting",
            color: "RED",
          },
          {
            text: "Consolidate (15% growth, build culture)",
            impact: "consolidate",
            style: "coaching",
            color: "GREEN",
          },
          {
            text: "Innovation leadership (new products, disruption)",
            impact: "innovation",
            style: "authoritative",
            color: "BLUE",
          },
          {
            text: "Balanced growth (20% growth, build capabilities)",
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
        content: "Shows specific service gaps - solvable with resources.",
      },
      {
        label: "Team sentiment in final month",
        type: "useful",
        content: "Some are recharged, others near breaking point.",
      },
      {
        label: "Exec member individual priorities",
        type: "trap",
        content: "Encourages politics over sound strategy.",
      },
      {
        label: "Year 2 market forecast",
        type: "red_herring",
        content: "Macro trends matter less than internal capability.",
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

// ============================================
// ROUND 2 SCENARIOS - THE ADVANCED ROUND
// ============================================
// A returning player (same name) reaches these harder, more strategic
// dilemmas. Figures stay on the £2M engineering budget scale (£100K-£500K
// per scenario). Each scenario's decision shape is matched exactly to the
// corresponding Round 2 scoring method in scoring.js.
const round2Scenarios = [
  // ROUND 2 SCENARIO 1: THE MERGER
  {
    id: "merger_integration",
    title: "THE MERGER",
    subtitle: "Month 2 - Q1",
    month: 2,
    quarter: 1,
    description: `JCB has acquired a rival compact-equipment maker. Two cultures, two product lines and 400 nervous staff must become one company. The board wants integration complete within 12 months.`,

    decisions: [
      {
        title: "Part 1: What integration philosophy do you lead with?",
        type: "choice",
        options: [
          {
            text: "Impose our systems fast - one company, one way",
            style: "coercive",
            color: "RED",
          },
          {
            text: "Co-design the new operating model with both leadership teams",
            style: "democratic",
            color: "YELLOW",
          },
          {
            text: "Invest in coaching both teams through the change",
            style: "coaching",
            color: "GREEN",
          },
          {
            text: "Keep both cultures running separately for now",
            style: "affiliative",
            color: "BLUE",
          },
        ],
      },
      {
        title: "Part 2: Both product lines overlap. What do you do?",
        type: "choice",
        options: [
          {
            text: "Keep our flagship line, phase out theirs",
            style: "coercive",
            color: "RED",
          },
          {
            text: "Keep their line, migrate our customers onto it",
            style: "authoritative",
            color: "BLUE",
          },
          {
            text: "Combine the best features of both into one platform",
            style: "democratic",
            color: "YELLOW",
          },
          {
            text: "Run a customer pilot to decide the winning platform",
            style: "coaching",
            color: "GREEN",
          },
        ],
      },
      {
        title: "Part 3: Allocate the £500K cultural integration budget",
        type: "slider",
        sliders: [
          {
            label: "Joint team-building programme",
            max: 0.2,
            budgetConstraint: 0.5,
            color: "GREEN",
          },
          { label: "Leadership alignment workshops", max: 0.15, color: "BLUE" },
          {
            label: "Retention packages for key talent",
            max: 0.3,
            color: "YELLOW",
          },
          { label: "Internal communications", max: 0.1, color: "BLUE" },
          {
            label: "Cross-skilling and training",
            max: 0.25,
            color: "GREEN",
          },
        ],
      },
    ],

    additionalInfo: [
      {
        label: "Acquired company culture audit",
        type: "useful",
        content: "Their engineers fear losing autonomy and being absorbed.",
      },
      {
        label: "Customer overlap analysis",
        type: "useful",
        content:
          "70% of their customers also buy from us - consolidation risk.",
      },
      {
        label: "Investment bank integration memo",
        type: "trap",
        content: "Pushes rapid cost-cutting to hit short-term synergy targets.",
      },
      {
        label: "Key talent flight risk list",
        type: "useful",
        content: "12 senior engineers are actively interviewing elsewhere.",
      },
    ],

    consequenceText:
      "Integration begins. How you blend the two cultures will define the next decade...",
  },

  // ROUND 2 SCENARIO 2: THE ETHICAL LINE
  {
    id: "ethical_dilemma",
    title: "THE ETHICAL LINE",
    subtitle: "Month 4 - Q2",
    month: 4,
    quarter: 2,
    description: `A lucrative £500K export order hinges on a local agent's payment to an overseas official. Legal flags it as a likely bribe. The order would hit this year's target; refusing may cost the region.`,

    decisions: [
      {
        title: "Part 1: What do you do about the payment?",
        type: "choice",
        options: [
          {
            text: "Walk away from the deal on principle",
            style: "authoritative",
            color: "BLUE",
          },
          {
            text: "Escalate to the board and legal immediately",
            style: "democratic",
            color: "YELLOW",
          },
          {
            text: "Find a compliant route to win the order",
            style: "coaching",
            color: "GREEN",
          },
          {
            text: "Approve it - the agent handles local customs",
            style: "coercive",
            color: "RED",
          },
        ],
      },
      {
        title: "Part 2: How do you brief your team?",
        type: "choice",
        options: [
          {
            text: "State our standards clearly - no grey areas",
            style: "authoritative",
            color: "BLUE",
          },
          {
            text: "Coach the team through the dilemma and lessons",
            style: "coaching",
            color: "GREEN",
          },
          {
            text: "Keep it confidential to protect the deal",
            style: "coercive",
            color: "RED",
          },
          {
            text: "Open forum on how we compete ethically",
            style: "democratic",
            color: "YELLOW",
          },
        ],
      },
      {
        title: "Part 3: How do you prevent this recurring?",
        type: "choice",
        options: [
          {
            text: "Commission an independent anti-bribery audit",
            style: "authoritative",
            color: "BLUE",
          },
          {
            text: "Train all regional agents on our code of conduct",
            style: "coaching",
            color: "GREEN",
          },
          {
            text: "Tighten approval thresholds for agent payments",
            style: "pacesetting",
            color: "RED",
          },
          {
            text: "Build an ethics hotline and speak-up culture",
            style: "democratic",
            color: "YELLOW",
          },
        ],
      },
    ],

    additionalInfo: [
      {
        label: "Legal counsel opinion",
        type: "useful",
        content:
          "The payment breaches the Bribery Act - personal liability risk.",
      },
      {
        label: "Regional sales director's view",
        type: "trap",
        content: '"Everyone does it here - we will lose the region."',
      },
      {
        label: "Compliance precedent from a peer firm",
        type: "useful",
        content:
          "A rival refused a similar deal and won a larger contract later.",
      },
    ],

    consequenceText:
      "Your integrity is being tested. The market and your people are watching...",
  },

  // ROUND 2 SCENARIO 3: THE REMOTE WORK REVOLT
  {
    id: "remote_work_debate",
    title: "THE REMOTE WORK REVOLT",
    subtitle: "Month 6 - Q2",
    month: 6,
    quarter: 2,
    description: `The board mandates three days a week in the office. Your engineering team threatens resignations, citing a 90-minute commute and lost focus time. Two senior engineers have already quit.`,

    decisions: [
      {
        title: "Part 1: How do you respond to the mandate?",
        type: "choice",
        options: [
          {
            text: "Enforce the policy - the board has decided",
            style: "coercive",
            color: "RED",
          },
          {
            text: "Fight for your team - propose a flexible exception",
            style: "authoritative",
            color: "BLUE",
          },
          {
            text: "Design a hybrid workaround that meets both needs",
            style: "democratic",
            color: "YELLOW",
          },
          {
            text: "Let teams self-organise their office days",
            style: "coaching",
            color: "GREEN",
          },
        ],
      },
      {
        title: "Part 2: Two engineers resign over it. What now?",
        type: "choice",
        options: [
          {
            text: "Hold exit conversations and coach them to stay",
            style: "coaching",
            color: "GREEN",
          },
          {
            text: "Accept the resignations - no exceptions",
            style: "coercive",
            color: "RED",
          },
          {
            text: "Offer tailored retention deals to key people",
            style: "affiliative",
            color: "YELLOW",
          },
          {
            text: "Escalate the retention risk to the board",
            style: "authoritative",
            color: "BLUE",
          },
        ],
      },
      {
        title: "Part 3: How do you communicate the outcome?",
        type: "choice",
        options: [
          {
            text: "Explain the business rationale honestly to everyone",
            style: "authoritative",
            color: "BLUE",
          },
          {
            text: "Co-create the final policy with team representatives",
            style: "democratic",
            color: "YELLOW",
          },
          {
            text: "Coach managers to handle concerns one-to-one",
            style: "coaching",
            color: "GREEN",
          },
          {
            text: "Announce it firmly and move on",
            style: "coercive",
            color: "RED",
          },
        ],
      },
    ],

    additionalInfo: [
      {
        label: "Productivity data by location",
        type: "useful",
        content: "Remote engineers ship 15% more code with fewer defects.",
      },
      {
        label: "HR legal advice on policy change",
        type: "useful",
        content: "Contract changes need consultation to avoid tribunal risk.",
      },
      {
        label: "Board member's private view",
        type: "trap",
        content: '"Presence equals performance - hold the line."',
      },
      {
        label: "Competitor hiring activity",
        type: "useful",
        content: "Rivals are actively targeting our remote-first engineers.",
      },
    ],

    consequenceText:
      "Your team is watching whether you back them or the mandate...",
  },

  // ROUND 2 SCENARIO 4: THE SUCCESSION CRISIS
  {
    id: "succession_crisis",
    title: "THE SUCCESSION CRISIS",
    subtitle: "Month 8 - Q3",
    month: 8,
    quarter: 3,
    description: `Your operations director suffers a sudden illness and will be out for six months. There is no named successor. Three internal candidates and one external option are on the table.`,

    decisions: [
      {
        title: "Part 1: Rank the criteria for choosing a successor",
        type: "ranking",
        items: [
          "Proven people development and team building",
          "Operational excellence and delivery track record",
          "Strategic thinking and long-term vision",
          "Cultural fit and loyalty to JCB",
        ],
      },
      {
        title: "Part 2: How do you run the selection?",
        type: "choice",
        options: [
          {
            text: "Open, transparent process with the leadership team",
            style: "democratic",
            color: "YELLOW",
          },
          {
            text: "Coach the strongest candidate into the role",
            style: "coaching",
            color: "GREEN",
          },
          {
            text: "Make the call yourself and announce it",
            style: "authoritative",
            color: "BLUE",
          },
          {
            text: "Bring in an external interim to steady the ship",
            style: "coercive",
            color: "RED",
          },
        ],
      },
      {
        title: "Part 3: How do you support the unsuccessful candidates?",
        type: "choice",
        options: [
          {
            text: "Coach them on a development plan for next time",
            style: "coaching",
            color: "GREEN",
          },
          {
            text: "Give them a stretch project to prove themselves",
            style: "democratic",
            color: "YELLOW",
          },
          {
            text: "Tell them clearly where they fell short",
            style: "authoritative",
            color: "BLUE",
          },
          {
            text: "Reassure them their future is secure here",
            style: "affiliative",
            color: "YELLOW",
          },
        ],
      },
    ],

    additionalInfo: [
      {
        label: "Internal candidate assessments",
        type: "useful",
        content: "One candidate develops people brilliantly but lacks scale.",
      },
      {
        label: "External headhunter shortlist",
        type: "trap",
        content: "Impressive CVs, but each would need 12 months to learn JCB.",
      },
      {
        label: "Team sentiment survey",
        type: "useful",
        content: "Staff want a leader who invests in their development.",
      },
      {
        label: "Operations director's own recommendation",
        type: "useful",
        content: "Backs the candidate with the strongest people skills.",
      },
    ],

    consequenceText:
      "Your succession decision will shape the bench strength for years...",
  },

  // ROUND 2 SCENARIO 5: THE MARKET DISRUPTION
  {
    id: "market_disruption",
    title: "THE MARKET DISRUPTION",
    subtitle: "Month 10 - Q3/Q4",
    month: 10,
    quarter: 3,
    description: `A tech start-up launches an electric compact loader at 30% below your cost base. Analysts call it a category killer. You have one year and a £500K war chest to respond.`,

    decisions: [
      {
        title: "Part 1: What is your immediate response?",
        type: "choice",
        options: [
          {
            text: "Cut prices to defend market share now",
            style: "pacesetting",
            color: "RED",
          },
          {
            text: "Accelerate our next-generation electric programme",
            style: "authoritative",
            color: "BLUE",
          },
          {
            text: "Partner with or acquire the start-up",
            style: "democratic",
            color: "YELLOW",
          },
          {
            text: "Differentiate on service, support and uptime",
            style: "coaching",
            color: "GREEN",
          },
        ],
      },
      {
        title: "Part 2: Allocate the £500K response budget",
        type: "slider",
        sliders: [
          {
            label: "R&D acceleration for next-gen electric",
            max: 0.3,
            budgetConstraint: 0.5,
            color: "BLUE",
          },
          { label: "Price defence and discounts", max: 0.2, color: "RED" },
          { label: "Dealer and channel support", max: 0.15, color: "YELLOW" },
          {
            label: "Innovation lab and rapid prototyping",
            max: 0.2,
            color: "GREEN",
          },
          {
            label: "Talent acquisition and upskilling",
            max: 0.2,
            color: "GREEN",
          },
        ],
      },
      {
        title: "Part 3: How do you reflect on the disruption?",
        type: "choice",
        options: [
          {
            text: "Run a post-mortem on why we missed the shift",
            style: "democratic",
            color: "YELLOW",
          },
          {
            text: "Move on fast - focus on winning the next year",
            style: "pacesetting",
            color: "RED",
          },
          {
            text: "Restructure how we make innovation decisions",
            style: "authoritative",
            color: "BLUE",
          },
          {
            text: "Coach the leadership team on disruptive thinking",
            style: "coaching",
            color: "GREEN",
          },
        ],
      },
    ],

    additionalInfo: [
      {
        label: "Start-up funding and burn rate",
        type: "useful",
        content: "Burning cash fast - likely to need a partner within a year.",
      },
      {
        label: "Customer willingness-to-pay study",
        type: "useful",
        content: "Buyers value uptime and service over the lowest price.",
      },
      {
        label: "Analyst hype report",
        type: "trap",
        content:
          "Predicts total market takeover - overstates the near-term threat.",
      },
      {
        label: "Internal R&D capability review",
        type: "useful",
        content: "Our electric prototype is 9 months from production-ready.",
      },
    ],

    consequenceText:
      "The market is shifting under your feet. Your response defines the next chapter...",
  },

  // ROUND 2 SCENARIO 6: THE YEAR-END RECKONING (ROUND 2)
  {
    id: "year_end_round2",
    title: "THE SECOND RECKONING",
    subtitle: "Month 12 - Q4",
    month: 12,
    quarter: 4,
    description: `Year two closes. The board reviews your leadership of the advanced agenda: merger, ethics, people and disruption. They want your honest reflection and your Year 3 priorities.`,

    decisions: [
      {
        title: "Part 1: What did this year teach you about yourself?",
        type: "choice",
        options: [
          {
            text: "I grew most by adapting fast to constant change",
            impact: "agility",
            style: "democratic",
            color: "YELLOW",
          },
          {
            text: "I grew most by holding firm on what matters",
            impact: "determination",
            style: "authoritative",
            color: "BLUE",
          },
          {
            text: "I grew most by investing in the people around me",
            impact: "leadership",
            style: "coaching",
            color: "GREEN",
          },
          {
            text: "I grew most by raising the standard of our delivery",
            impact: "excellence",
            style: "pacesetting",
            color: "RED",
          },
        ],
      },
      {
        title: "Part 2: What is the biggest lesson you will carry forward?",
        type: "choice",
        options: [
          {
            text: "Develop people relentlessly - they deliver the results",
            style: "coaching",
            color: "GREEN",
          },
          {
            text: "Decide faster and trust the team to execute",
            style: "democratic",
            color: "YELLOW",
          },
          {
            text: "Set a clear standard and hold everyone to it",
            style: "authoritative",
            color: "BLUE",
          },
          {
            text: "Protect the culture above short-term wins",
            style: "affiliative",
            color: "YELLOW",
          },
        ],
      },
      {
        title: "Part 3: Rank your Year 3 strategic priorities",
        type: "ranking",
        items: [
          "Developing our leadership bench and talent",
          "Driving innovation and new product leadership",
          "Strengthening culture and engagement",
          "Driving commercial growth and market expansion",
        ],
      },
    ],

    additionalInfo: [
      {
        label: "Year 2 performance scorecard",
        type: "useful",
        content: "Strong on delivery, mixed on culture and retention.",
      },
      {
        label: "Board's private succession concerns",
        type: "useful",
        content: "They want a deeper bench behind you for Year 3.",
      },
      {
        label: "Executive coach's debrief notes",
        type: "useful",
        content: "Highlights your growth in balancing pace with people.",
      },
      {
        label: "Rival's Year 3 strategy leak",
        type: "trap",
        content: "Tempts a reactive plan rather than your own priorities.",
      },
    ],

    consequenceText:
      "Final calculations underway. Your second year of leadership is being evaluated...",
  },
];

// Make scenarios available to game engine
if (typeof window !== "undefined") {
  window.scenarios = {
    round1: round1Scenarios,
    round2: round2Scenarios,
  };
}
