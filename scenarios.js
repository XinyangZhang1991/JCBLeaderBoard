// Scenario definitions for JCB Leadership Challenge

const round1Scenarios = [
  // SCENARIO 1: THE INHERITANCE
  {
    id: 'inheritance',
    title: 'THE INHERITANCE',
    subtitle: 'Month 1 - Q1',
    month: 1,
    quarter: 1,
    description: 'Your predecessor left behind a strategic plan for the year. Your leadership team is divided: some want to continue the existing plan, others want fresh direction. You have 5 major initiatives proposed, but only resources for 3 this quarter.',
    
    decisions: [
      {
        title: 'Part 1: Priority Ranking - Drag to Prioritize (Top 3 will be funded)',
        type: 'ranking',
        items: [
          'Launch aggressive marketing campaign for new Lonsdale model',
          'Implement comprehensive staff training program',
          'Overhaul dealer network relationships',
          'Fast-track new product innovation project',
          'Optimize supply chain efficiency'
        ]
      },
      {
        title: 'Part 2: Communication Approach',
        type: 'choice',
        options: [
          { text: 'A) "I\'ve analyzed the situation and we\'ll keep what we\'re doing"', style: 'authoritative', color: 'BLUE' },
          { text: 'B) "Let\'s workshop this together as a team"', style: 'democratic', color: 'YELLOW' },
          { text: 'C) "I need to understand your perspectives first"', style: 'coaching', color: 'GREEN' },
          { text: 'D) "We need your focus - here are your targets"', style: 'pacesetting', color: 'RED' },
          { text: 'E) "I trust you all - you know what\'s best for your team"', style: 'affiliative', color: 'YELLOW' }
        ]
      }
    ],
    
    additionalInfo: [
      {
        label: 'Last year\'s performance data',
        type: 'useful',
        content: 'Shows marketing had poor ROI last year - training and dealer relationships yielded better results'
      },
      {
        label: 'Staff survey from predecessor\'s tenure',
        type: 'red-herring',
        content: 'Focuses on office facilities and parking - not strategically relevant'
      },
      {
        label: 'Market trend analysis',
        type: 'trap',
        content: 'Emphasizes competitors\' aggressive tactics, encourages risky choices that look good short-term'
      }
    ],
    
    consequenceText: 'Your team responds to your leadership approach. First month metrics are being calculated...',

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
        affiliative: { morale: 3, growth: -2 }
      }
    }
  },
  
  // SCENARIO 2: THE SAFETY CRISIS
  {
    id: 'safety-crisis',
    title: 'THE SAFETY CRISIS',
    subtitle: 'Month 3 - Q1',
    month: 3,
    quarter: 1,
    description: 'A near‑miss safety incident occurred at your main distribution facility involving a Telescopic Handler. No injuries, but HSE regulations were nearly breached. Three departments are pointing fingers. Your ops director wants immediate disciplinary action. Your HR director advocates for retraining, Your safety officer wants a full operational shutdown for review (costing £400k and 2 weeks)',
    
    decisions: [
      {
        title: 'Part 1: Stakeholder Alignment - who do you primarily support?',
        type: 'choice',
        options: [
          { text: 'Ops Director (Discipline + move on quickly)', style: 'coercive', color: 'RED' },
          { text: 'HR Director (Training + supportive approach)', style: 'coaching', color: 'GREEN' },
          { text: 'Safety Officer (Full investigation + comprehensive)', style: 'coaching', color: 'YELLOW' },
          { text: 'Split approach (Investigate thoroughly, then decide)', style: 'democratic', color: 'YELLOW' }
        ]
      },
      {
        title: 'Part 2: Timeline - When do you act?',
        type: 'timeline',
        options: ['Immediate action (today)', '1 week investigation', '3 week comprehensive review'],
        styleMapping: ['coercive', 'democratic', 'coaching'],
        colorMapping: ['RED', 'YELLOW', 'GREEN']
      },
      {
        title: 'Part 3: Team Communication',
        type: 'choice',
        options: [
          { text: 'Firm warning about standards', style: 'coercive', color: 'RED' },
          { text: 'Learning opportunity focus', style: 'coaching', color: 'GREEN' },
          { text: "We're all in this together", style: 'affiliative', color: 'YELLOW' },
          { text: 'Shared excellence going forward', style: 'pacesetting', color: 'RED' }
        ]
      }
    ],

    additionalInfo: [
      {
        label: 'Previous safety record data',
        type: 'useful',
        content: 'This is the first incident in 3 years - suggests systemic issue, not individual fault'
      },
      {
        label: 'Speak with employee involved',
        type: 'useful',
        content: 'Reveals training gap in new equipment protocols'
      },
      {
        label: 'Legal team memo on liability',
        type: 'trap',
        content: 'Emphasizes HSE disciplining approach, creates fear culture'
      },
      {
        label: 'Cost‑benefit analysis of shutdown',
        type: 'red‑herring',
        content: 'Focuses only on short‑term costs, misses long‑term safety culture value'
      }
    ],

    consequenceText: 'Word of your crisis response spreads through the organization. Team morale shifts...',

    scoreTemplates: {
      punitive: { morale: -15, attrition: 12, growth: 2 }, // Quick discipline
      balanced: { morale: 8, growth: -2, attrition: -3 }, // Investigation + coaching
      excessive: {morale: -5, growth: -5 } // Full Shutdown
    }
  },

  // SCENARIO 3: THE COMPETITOR THREAT
  {
    id: 'competitor-threat',
    title: 'THE COMPETITOR THREAT',
    subtitle: 'Month 6 - Q2',
    month: 6,
    quarter: 2,
    description: 'Major competitor just launched a Backhoe with features that match your flagship model at 15% lower price. Three key dealers are threatening to reduce JCB shelf space. Market share is slipping (-2.3% this month). You have £3M emergency budget to respond.',
    
    decisions: [
        {
            title: 'Part 1: Resource Allocation - Distribute £3M',
            type: 'slider',
            sliders: [
                { label: 'Price matching / discounts', max: 1.5, budgetConstraint: 3.0, color: 'RED' },
                { label: 'Accelerated R&D for next-gen features', max: 2.0, color: 'BLUE' },
                { label: 'Dealer incentive program', max: 1.5, color: 'YELLOW' },
                { label: 'Marketing counteroffensive', max: 1.2, color: 'RED' },
                { label: 'Customer loyalty program', max: 0.8, color: 'YELLOW' }
            ]
        },
        {
            title: 'Part 2: Dealer Negotiation Approach',
            type: 'timeline',
            options: ['Aggressive', 'Firm but Fair', 'Collaborative', 'Concede Ground'],
            styleMapping: ['coercive', 'authoritative', 'democratic', 'affiliative'],
            colorMapping: ['RED', 'BLUE', 'YELLOW', 'YELLOW']
        },
        {
            title: 'Part 3: Team Mobilization',
            type: 'choice',
            options: [
                { text: '"We\'re going to crush this competitor"', style: 'pacesetting', color: 'RED' },
                { text: '"Here\'s our vision to stay ahead"', style: 'authoritative', color: 'BLUE' },
                { text: '"Let\'s brainstorm solutions together"', style: 'democratic', color: 'YELLOW' },
                { text: '"I need you to step up individually"', style: 'coaching', color: 'GREEN' }
            ]
        }
    ],

    additionalInfo: [
        {
        label: 'Competitor intelligence report',
        type: 'trap',
        content: 'Exaggerates competitor threat, encourages panic spending on price matching'
      },
      {
        label: 'Customer feedback on what they truly value',
        type: 'useful',
        content: 'Reveals features matter less than service and relationships'
      },
      {
        label: 'CFO perspective on margin protection',
        type: 'useful',
        content: 'Shows long‑term danger of price wars, recommends value differentiation'
      },
      {
        label: 'Sales team sentiment survey',
        type: 'red‑herring',
        content: 'Shows anger with aggressive discounts, but it\'s short‑sighted'
      }
    ],

    consequenceText: 'Market responds to your strategy. Dealer relationships and profit margins adjust...',

    scoreTemplates: {
      predatory: { growth: 5, profitMargin: -8, marketShare: 3 }, // Heavy discounting
      balanced: { growth: 3, profitMargin: 2, marketShare: 2, futureGrowth: 12 }, // Invest in R&D + relationships
      reactive: { growth: -5, morale: -1 } // Panic response
    }
  },

  // SCENARIO 4: THE TALENT EXODUS
  {
    id: 'talent‑exodus',
    title: 'THE TALENT EXODUS',
    subtitle: 'Month 8 - Q3',
    month: 8,
    quarter: 3,
    description: 'Your top‑performing regional sales manager just resigned, citing "unsustainable pressure and lack of support." Two other high‑performers are rumored to be interviewing elsewhere. Team attrition is now at 18% (healthy is <10%). You\'ve hit 22% growth but morale is critical. An anonymous employee survey reveals burnout and feeling undervalued.',
    
    decisions: [
        {
            title: 'Part 1: Root Cause Assessment',
            type: 'choice',
            options: [
                { text: 'Compensation not competitive (fix with £500K retention bonuses)', impact: 'money', style: 'affiliative', color: 'YELLOW' },
                { text: 'Leadership style mismatch (change your approach)', impact: 'selfaware', style: 'coaching', color: 'GREEN' },
                { text: 'Unrealistic targets inherited from your decisions (adjust expectations)', impact: 'targets', style: 'democratic', color: 'YELLOW' },
                { text: 'Natural turnover, nothing to worry about (stay the course)', impact: 'denial', style: 'coercive', color: 'RED' },
                { text: 'Lack of development opportunities (invest in career growth)', impact: 'development', style: 'coaching', color: 'GREEN' }
            ]
        },
        {
            title: 'Part 2: Immediate Response',
            type: 'choice',
            options: [
                { text: 'Emergency team meeting with open forum', style: 'democratic', color: 'YELLOW' },
                { text: 'One-on-one conversations with key players', style: 'coaching', color: 'GREEN' },
                { text: 'Announce new retention program and benefits', style: 'affiliative', color: 'YELLOW' },
                { text: 'Double down on performance standards', style: 'pacesetting', color: 'RED' },
                { text: 'Reset vision and reconnect to purpose', style: 'authoritative', color: 'BLUE' }
            ]
        },
        {
            title: 'Part 3: Q4 Targets Adjustment',
            type: 'timeline',
            options: ['Maintain aggressive targets', 'Reduce by 10%', 'Reduce by 20%', 'Reduce by 30%'],
            styleMapping: ['pacesetting', 'authoritative', 'democratic', 'coaching'],
            colorMapping: ['RED', 'BLUE', 'YELLOW', 'GREEN']
        }
    ],

    additionalInfo: [
      {
        label: 'Exit interview data from departed employee',
        type: 'useful',
        content: 'Confirms pace and pressure issues - "felt like numbers, not people"'
      },
      {
        label: 'Industry salary benchmarking',
        type: 'trap',
        content: 'Suggests money is the answer - but culture is the real issue'
      },
      {
        label: 'HR recommendation memo',
        type: 'useful',
        content: 'Identifies specific leadership behaviors causing issues: lack of recognition, unrealistic deadlines'
      },
      {
        label: 'Retention case studies from other divisions',
        type: 'red‑herring',
        content: 'Different contexts, not directly applicable to your situation'
      }
    ],

    consequenceText: 'Your team watches closely to see if you genuinely change or just talk about it...',

    scoreTemplates: {
      moneyOnly: { attrition: 20, morale: -10, growth: -8 }, // Retention bounuses fail
      connect: { attrition: -8, morale: 15, growth: -5, agility: 25 }, // Admit and adjust
      denial: { attrition: 30, morale: -30, growth: -15 } // Failure path
    },

    isCriticalMoment: true // This is a reckoning for aggressive players
  },

  // SCENARIO 5: THE INNOVATION GAMBLE
  {
    id: 'innovation_gamble',
    title: 'THE INNOVATION GAMBLE',
    subtitle: 'Month 10 - Q3/Q4',
    month: 10,
    quarter: 3,
    description: 'Your R&D team presents a breakthrough: hybrid-electric Loadall prototype 8 months ahead of schedule. Early customer feedback is phenomenal. You could rush to market in Q6 (risky but game-changing) or wait for Q1 next year (safer, proven approach). Marketing wants £1.2M for launch campaign. Operations says rushing could compromise quality.',

    decisions: [
        {
            title: 'Part 1: Launch Timeline',
            type: 'choice',
            options: [
                { text: 'Immediate (6 weeks, high risk, maximum impact)', timing: 'immediate', style: 'pacesetting', color: 'RED' },
                { text: 'Accelerated Q4 (10 weeks, moderate risk, strong impact)', timing: 'accelerated', style: 'authoritative', color: 'BLUE' },
                { text: 'Planned Q4 launch (18 weeks, low risk, miss year-end)', timing: 'planned', style: 'coaching', color: 'GREEN' },
                { text: 'Pilot program first (8 weeks pilot + delayed launch)', timing: 'pilot', style: 'democratic', color: 'YELLOW' }
            ]
        },
        {
            title: 'Part 2: Decision-Making Process',
            type: 'choice',
            options: [
                { text: 'Trust your gut and decide', style: 'authoritative', color: 'BLUE' },
                { text: 'Convene cross-functional team vote', style: 'democratic', color: 'YELLOW' },
                { text: 'Deep dive with R&D and operations leaders', style: 'coaching', color: 'GREEN' },
                { text: 'Set the target and let teams figure it out', style: 'pacesetting', color: 'RED' }
            ]
        },
        {
            title: 'Part 3: Risk Mitigation - Allocate £1.5M',
            type: 'slider',
            sliders: [
                { label: 'Quality assurance testing', max: 0.6, budgetConstraint: 1.5, color: 'BLUE' },
                { label: 'Customer pilot program', max: 0.5, color: 'YELLOW' },
                { label: 'Warranty reserves', max: 0.4, color: 'GREEN' },
                { label: 'Marketing push', max: 0.8, color: 'RED' },
                { label: 'Operational contingency', max: 0.3, color: 'BLUE' }
            ]
        }
    ],

    additionalInfo: [
        {
            label: 'Customer pilot feedback verbatims',
            type: 'useful',
            content: 'Reveals specific concerns about battery life in cold weather - addressable with testing'
        },
        {
            label: 'Competitor timeline intelligence',
            type: 'trap',
            content: 'Suggests competitor is 6 months away - creates false urgency to rush'
        },
        {
            label: 'Technical risk assessment',
            type: 'useful',
            content: 'Identifies specific failure modes that need attention before full launch'
        },
        {
            label: 'Board pressure memo',
            type: 'trap',
            content: 'Emphasizes year-end politics over sound decision-making'
        }
    ],

    consequenceText: 'Product launch begins. Quality control and market response will determine success...',

    scoreTemplates: {
        rush: { growth: 18, futureGrowth: -25 }, // Spectacular short-term, disaster long-term
        balanced: { growth: 9, morale: 5, futureGrowth: 15 }, // Accelerated with testing
        tooSlow: { growth: 3, missTarget: true } // Safe but miss escape threshold
    }
},

// SCENARIO 6: THE YEAR-END RECKONING
{
    id: 'year_end',
    title: 'THE YEAR-END RECKONING',
    subtitle: 'Month 12 - Q4',
    month: 12,
    quarter: 4,
    description: 'It\'s December. Board meeting in 3 weeks. Three simultaneous challenges: (1) Major customer (15% of revenue) threatening to leave due to service issues. (2) Your exhausted team needs direction for next year. (3) Board wants your Year 2 strategic plan.',
    
    decisions: [
        {
            title: 'Part A: Customer Crisis',
            type: 'choice',
            options: [
                { text: 'Assign your best people to fix it (risks burning them out)', impact: 'burnout', style: 'pacesetting', color: 'RED' },
                { text: 'Personally lead the customer recovery (time away from other priorities)', impact: 'personal', style: 'coaching', color: 'GREEN' },
                { text: 'Empower regional team with resources (trust them)', impact: 'empower', style: 'democratic', color: 'YELLOW' },
                { text: 'Negotiate compromise solution (reduce scope, preserve relationship)', impact: 'compromise', style: 'affiliative', color: 'YELLOW' }
            ]
        },
        {
            title: 'Part B: Team Investment - Allocate £800K remaining budget',
            type: 'slider',
            sliders: [
                { label: 'Year-end bonuses for performance', max: 0.8, budgetConstraint: 0.8, color: 'RED' },
                { label: 'Team celebration and recognition event', max: 0.1, color: 'YELLOW' },
                { label: 'Year 2 capability investment (training, tools)', max: 0.7, color: 'GREEN' },
                { label: 'Roll budget to Year 2 targets (save money)', max: 0.8, color: 'BLUE' }
            ]
        },
        {
            title: 'Part C: Board Strategy - Year 2 Proposal',
            type: 'choice',
            options: [
                { text: 'Aggressive growth continuation (30%+ target)', impact: 'aggressive', style: 'pacesetting', color: 'RED' },
                { text: 'Consolidation and sustainability (15% growth, build culture)', impact: 'consolidate', style: 'coaching', color: 'GREEN' },
                { text: 'Innovation leadership (new products, market disruption)', impact: 'innovation', style: 'authoritative', color: 'BLUE' },
                { text: 'Balanced growth with team development (20% growth, capabilities)', impact: 'balanced', style: 'democratic', color: 'YELLOW' }
            ]
        }
    ],

    additionalInfo: [
        {
            label: 'Customer account history',
            type: 'useful',
            content: 'Shows specific service gaps - solvable with right resources'
        },
        {
            label: 'Team sentiment in final month',
            type: 'useful',
            content: 'Reveals energy levels - some recharged, others at breaking point depending on your leadership'
        },
        {
            label: 'Board member individual priorities',
            type: 'trap',
            content: 'Encourages political maneuvering instead of sound strategy'
        },
        {
            label: 'Year 2 market forecast',
            type: 'red herring',
            content: 'Macro trends less important than internal capability'
        }
    ],

    consequenceText: 'Final calculations underway. Your year of leadership is being evaluated...',

    scoreTemplates: {
        // Highly dependent on previous choices
        optimal: { growth: 28, morale: 78, attrition: 10 },
        recovery: { growth: 22, morale: 72, attrition: 15 },
        collapse: { growth: 15, morale: 45, attrition: 35 }
    },

    isFinale: true
}
];

// Round 2 scenarios (abbreviated - same structure, different challenges)
const round2Scenarios = [
    {
        id: 'merger_integration',
        title: 'THE MERGER INTEGRATION',
        subtitle: 'Month 1 - Q1',
        month: 1,
        quarter: 1,
        description: 'JCB acquired a smaller competitor. You must integrate 45 new employees, rationalize product lines, and maintain momentum...',
        // Similar structure to round 1 scenarios but different content
        decisions: [/* ... */],
        additionalInfo: [/* ... */]
    },
    // ... 5 more scenarios
];

// Make scenarios available to game engine
if (typeof window !== 'undefined') {
    window.scenarios = {
        round1: round1Scenarios,
        round2: round2Scenarios
    };
}