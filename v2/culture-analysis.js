// Company Culture Analysis Engine for JCB Leadership Game
// Analyzes aggregate leadership data from multiple players

class CultureAnalysis {
    constructor() {
        this.highPerformanceBenchmark = {
            avgGrowth: 28,
            avgMorale: 80,
            avgAttrition: 8,
            styleBalance: {
                threshold: 30, // No style should be > 30% in aggregate
                diversity: 0.7 // Diversity index (0-1 scale)
            },
            leadScores: {
                leadership: 75,
                excellence: 65,
                agility: 45,
                determination: 40
            }
        };
    }

    analyzeCulture(leaderboardData) {
        if (!leaderboardData || leaderboardData.length < 3) {
            return {
                error: 'Insufficient data',
                message: 'Company Culture Analysis requires at least 3 leaders to have completed the game.',
                playerCount: leaderboardData ? leaderboardData.length : 0
            };
        }

        const analysis = {
            playerCount: leaderboardData.length,
            metrics: this.calculateAggregateMetrics(leaderboardData),
            leadership: this.analyzeLeadershipDistribution(leaderboardData),
            decisions: this.analyzeDecisionPatterns(leaderboardData),
            lead: this.analyzeLEADScores(leaderboardData),
            colors: this.analyzePersonalityColors(leaderboardData),
            strengths: [],
            weaknesses: [],
            culturalRisks: [],
            recommendations: [],
            comparisonToHighPerformance: {}
        };

        // Calculate gaps vs high-performance benchmark
        analysis.comparisonToHighPerformance = this.compareToBenchmark(analysis);

        // Identify cultural patterns
        this.identifyStrengthsAndWeaknesses(analysis);

        // Generate recommendations
        this.generateCulturalRecommendations(analysis);

        return analysis;
    }

    calculateAggregateMetrics(data) {
        const metrics = {
            avgGrowth: 0,
            avgMorale: 0,
            avgAttrition: 0,
            avgProfitMargin: 0,
            successRate: 0,
            optimalRate: 0,
            growthDistribution: { high: 0, medium: 0, low: 0 },
            moraleDistribution: { high: 0, medium: 0, low: 0 },
            attritionDistribution: { healthy: 0, concerning: 0, critical: 0 }
        };

        let growthSum = 0, moraleSum = 0, attritionSum = 0, profitSum = 0;
        let escapeCount = 0, optimalCount = 0;

        data.forEach(player => {
            growthSum += player.growth || 0;
            moraleSum += player.morale || 0;
            attritionSum += player.attrition || 0;
            profitSum += player.profitMargin || 20;

            if (player.escaped) escapeCount++;
            if (player.optimal) optimalCount++;

            // Distribution buckets
            if (player.growth >= 25) metrics.growthDistribution.high++;
            else if (player.growth >= 18) metrics.growthDistribution.medium++;
            else metrics.growthDistribution.low++;

            if (player.morale >= 75) metrics.moraleDistribution.high++;
            else if (player.morale >= 65) metrics.moraleDistribution.medium++;
            else metrics.moraleDistribution.low++;

            if (player.attrition < 10) metrics.attritionDistribution.healthy++;
            else if (player.attrition < 15) metrics.attritionDistribution.concerning++;
            else metrics.attritionDistribution.critical++;
        });

        const count = data.length;
        metrics.avgGrowth = growthSum / count;
        metrics.avgMorale = moraleSum / count;
        metrics.avgAttrition = attritionSum / count;
        metrics.avgProfitMargin = profitSum / count;
        metrics.successRate = (escapeCount / count) * 100;
        metrics.optimalRate = (optimalCount / count) * 100;

        return metrics;
    }

    analyzeLeadershipDistribution(data) {
        const styleAggregate = {
            coercive: 0,
            authoritative: 0,
            affiliative: 0,
            democratic: 0,
            pacesetting: 0,
            coaching: 0
        };

        const dominantStyles = {};

        data.forEach(player => {
            // Aggregate style percentages
            if (player.leadershipProfile) {
                Object.keys(player.leadershipProfile).forEach(style => {
                    styleAggregate[style] += player.leadershipProfile[style] || 0;
                });
            }

            // Count dominant styles
            const style = player.leadershipStyle || 'Unknown';
            dominantStyles[style] = (dominantStyles[style] || 0) + 1;
        });

        // Calculate average percentages
        const count = data.length;
        Object.keys(styleAggregate).forEach(style => {
            styleAggregate[style] = styleAggregate[style] / count;
        });

        // Calculate diversity index (entropy-based)
        const diversity = this.calculateDiversityIndex(Object.values(styleAggregate));

        // Find most/least used styles
        const sortedStyles = Object.entries(styleAggregate).sort((a, b) => b[1] - a[1]);

        return {
            aggregate: styleAggregate,
            dominantStyles: dominantStyles,
            diversity: diversity,
            mostUsed: sortedStyles[0],
            leastUsed: sortedStyles[sortedStyles.length - 1],
            balanced: diversity > 0.7
        };
    }

    analyzeDecisionPatterns(data) {
        if (!data[0].decisions) {
            return {
                available: false,
                message: 'Decision history not available for this leaderboard data'
            };
        }

        const patterns = {
            available: true,
            scenarioFailureRates: {},
            commonTraps: {
                priceWar: 0,
                moneySolution: 0,
                marketTrend: 0,
                competitorPanic: 0
            },
            infoSeekingBehavior: {
                avgRequestsPerPlayer: 0,
                usefulInfoRate: 0,
                trapInfoRate: 0
            },
            aggressiveDecisionRate: 0,
            collaborativeDecisionRate: 0
        };

        let totalAggressiveDecisions = 0;
        let totalCollaborativeDecisions = 0;
        let totalInfoRequests = 0;
        let totalUsefulInfo = 0;
        let totalTrapInfo = 0;

        data.forEach(player => {
            if (!player.decisions) return;

            player.decisions.forEach(decision => {
                // Count aggressive decisions
                if (decision.stylesUsed) {
                    if (decision.stylesUsed.includes('pacesetting') ||
                        decision.stylesUsed.includes('coercive')) {
                        totalAggressiveDecisions++;
                    }
                    if (decision.stylesUsed.includes('democratic') ||
                        decision.stylesUsed.includes('coaching') ||
                        decision.stylesUsed.includes('affiliative')) {
                        totalCollaborativeDecisions++;
                    }
                }

                // Track common traps (based on scenario and choice patterns)
                if (decision.scenarioId === 'competitor_threat') {
                    // Check for price war trap
                    if (decision.choices[0]?.values && decision.choices[0].values[0] >= 1.0) {
                        patterns.commonTraps.priceWar++;
                    }
                }

                if (decision.scenarioId === 'talent_exodus') {
                    // Check for money solution trap
                    if (decision.choices[1]?.index === 2) {
                        patterns.commonTraps.moneySolution++;
                    }
                }
            });

            // Analyze info requests
            if (player.infoRequests) {
                totalInfoRequests += player.infoRequests.length;
                player.infoRequests.forEach(req => {
                    if (req.type === 'useful') totalUsefulInfo++;
                    if (req.type === 'trap') totalTrapInfo++;
                });
            }
        });

        const totalDecisions = data.reduce((sum, p) => sum + (p.decisions?.length || 0), 0);
        patterns.aggressiveDecisionRate = (totalAggressiveDecisions / totalDecisions) * 100;
        patterns.collaborativeDecisionRate = (totalCollaborativeDecisions / totalDecisions) * 100;

        patterns.infoSeekingBehavior.avgRequestsPerPlayer = totalInfoRequests / data.length;
        patterns.infoSeekingBehavior.usefulInfoRate = totalInfoRequests > 0 ?
            (totalUsefulInfo / totalInfoRequests) * 100 : 0;
        patterns.infoSeekingBehavior.trapInfoRate = totalInfoRequests > 0 ?
            (totalTrapInfo / totalInfoRequests) * 100 : 0;

        return patterns;
    }

    analyzeLEADScores(data) {
        const lead = {
            avgLeadership: 0,
            avgExcellence: 0,
            avgAgility: 0,
            avgDetermination: 0,
            distribution: {
                leadership: { high: 0, medium: 0, low: 0 },
                excellence: { high: 0, medium: 0, low: 0 },
                agility: { high: 0, medium: 0, low: 0 },
                determination: { high: 0, medium: 0, low: 0 }
            }
        };

        let lSum = 0, eSum = 0, aSum = 0, dSum = 0;

        data.forEach(player => {
            const l = player.leadership || 0;
            const e = player.excellence || 0;
            const a = player.agility || 0;
            const d = player.determination || 0;

            lSum += l; eSum += e; aSum += a; dSum += d;

            // Distribution buckets
            lead.distribution.leadership[l >= 60 ? 'high' : l >= 30 ? 'medium' : 'low']++;
            lead.distribution.excellence[e >= 60 ? 'high' : e >= 30 ? 'medium' : 'low']++;
            lead.distribution.agility[a >= 40 ? 'high' : a >= 20 ? 'medium' : 'low']++;
            lead.distribution.determination[d >= 40 ? 'high' : d >= 20 ? 'medium' : 'low']++;
        });

        const count = data.length;
        lead.avgLeadership = lSum / count;
        lead.avgExcellence = eSum / count;
        lead.avgAgility = aSum / count;
        lead.avgDetermination = dSum / count;

        return lead;
    }

    analyzePersonalityColors(data) {
        const colors = {
            RED: 0,
            BLUE: 0,
            YELLOW: 0,
            GREEN: 0,
            BALANCED: 0
        };

        data.forEach(player => {
            const color = player.personalityColor || 'BALANCED';
            colors[color]++;
        });

        const total = data.length;
        const percentages = {};
        Object.keys(colors).forEach(color => {
            percentages[color] = (colors[color] / total) * 100;
        });

        return {
            counts: colors,
            percentages: percentages,
            dominant: Object.keys(colors).reduce((a, b) => colors[a] > colors[b] ? a : b)
        };
    }

    compareToBenchmark(analysis) {
        const benchmark = this.highPerformanceBenchmark;
        const gaps = {
            growth: analysis.metrics.avgGrowth - benchmark.avgGrowth,
            morale: analysis.metrics.avgMorale - benchmark.avgMorale,
            attrition: analysis.metrics.avgAttrition - benchmark.avgAttrition,
            leadership: analysis.lead.avgLeadership - benchmark.leadScores.leadership,
            excellence: analysis.lead.avgExcellence - benchmark.leadScores.excellence,
            agility: analysis.lead.avgAgility - benchmark.leadScores.agility,
            determination: analysis.lead.avgDetermination - benchmark.leadScores.determination,
            diversity: analysis.leadership.diversity - benchmark.styleBalance.diversity
        };

        return {
            gaps: gaps,
            performanceLevel: this.calculatePerformanceLevel(gaps),
            percentileEstimate: this.estimatePercentile(analysis)
        };
    }

    calculatePerformanceLevel(gaps) {
        const criticalGaps = [
            gaps.growth < -5,
            gaps.morale < -10,
            gaps.attrition > 5,
            gaps.diversity < -0.2
        ];

        const criticalCount = criticalGaps.filter(g => g).length;

        if (criticalCount >= 3) return 'NEEDS IMMEDIATE ATTENTION';
        if (criticalCount >= 2) return 'BELOW BENCHMARK';
        if (criticalCount === 1) return 'APPROACHING BENCHMARK';
        if (gaps.growth >= 0 && gaps.morale >= 0 && gaps.attrition <= 0) return 'AT BENCHMARK';
        return 'ABOVE BENCHMARK';
    }

    estimatePercentile(analysis) {
        // Heuristic estimation based on multiple factors
        const factors = [
            analysis.metrics.avgGrowth >= 28 ? 20 : analysis.metrics.avgGrowth >= 22 ? 10 : 0,
            analysis.metrics.avgMorale >= 80 ? 20 : analysis.metrics.avgMorale >= 70 ? 10 : 0,
            analysis.metrics.avgAttrition <= 8 ? 20 : analysis.metrics.avgAttrition <= 12 ? 10 : 0,
            analysis.leadership.diversity >= 0.75 ? 20 : analysis.leadership.diversity >= 0.6 ? 10 : 0,
            analysis.metrics.optimalRate >= 50 ? 20 : analysis.metrics.optimalRate >= 30 ? 10 : 0
        ];

        const score = factors.reduce((a, b) => a + b, 0);
        return Math.min(95, 50 + score); // 50-95 percentile range
    }

    calculateDiversityIndex(values) {
        // Shannon Entropy normalized to 0-1 scale
        const total = values.reduce((a, b) => a + b, 0);
        if (total === 0) return 0;

        const probabilities = values.map(v => v / total).filter(p => p > 0);
        const entropy = -probabilities.reduce((sum, p) => sum + p * Math.log2(p), 0);
        const maxEntropy = Math.log2(values.length);

        return entropy / maxEntropy; // 0 = no diversity, 1 = perfect diversity
    }

    identifyStrengthsAndWeaknesses(analysis) {
        const { metrics, leadership, lead, decisions, colors, comparisonToHighPerformance } = analysis;

        // STRENGTHS
        if (metrics.avgGrowth >= 25) {
            analysis.strengths.push({
                area: 'Revenue Growth',
                score: metrics.avgGrowth.toFixed(1) + '%',
                insight: 'Culture drives strong commercial performance - leaders consistently deliver above-target growth.'
            });
        }

        if (metrics.avgMorale >= 75) {
            analysis.strengths.push({
                area: 'Employee Engagement',
                score: metrics.avgMorale.toFixed(0) + '%',
                insight: 'High team morale indicates a supportive, values-driven culture where people feel valued.'
            });
        }

        if (metrics.avgAttrition < 10) {
            analysis.strengths.push({
                area: 'Talent Retention',
                score: metrics.avgAttrition.toFixed(1) + '%',
                insight: 'Low attrition suggests sustainable leadership practices and strong employee loyalty.'
            });
        }

        if (leadership.diversity >= 0.7) {
            analysis.strengths.push({
                area: 'Leadership Flexibility',
                score: (leadership.diversity * 100).toFixed(0) + '%',
                insight: 'Diverse leadership styles indicate adaptive culture - leaders can flex their approach based on context.'
            });
        }

        if (decisions.available && decisions.infoSeekingBehavior.avgRequestsPerPlayer >= 2.5) {
            analysis.strengths.push({
                area: 'Information Thoroughness',
                score: decisions.infoSeekingBehavior.avgRequestsPerPlayer.toFixed(1) + ' requests/player',
                insight: 'Leaders consistently seek additional information before deciding - evidence-based culture.'
            });
        }

        // WEAKNESSES
        if (metrics.avgGrowth < 20) {
            analysis.weaknesses.push({
                area: 'Revenue Growth',
                score: metrics.avgGrowth.toFixed(1) + '%',
                gap: (20 - metrics.avgGrowth).toFixed(1) + '% below target',
                insight: 'Leaders struggle to achieve growth targets - may indicate risk aversion or lack of commercial drive.'
            });
        }

        if (metrics.avgMorale < 65) {
            analysis.weaknesses.push({
                area: 'Employee Engagement',
                score: metrics.avgMorale.toFixed(0) + '%',
                gap: 'Below healthy threshold',
                insight: 'Low morale suggests unsustainable leadership practices - people may feel undervalued or overworked.'
            });
        }

        if (metrics.avgAttrition >= 15) {
            analysis.weaknesses.push({
                area: 'Talent Retention',
                score: metrics.avgAttrition.toFixed(1) + '%',
                gap: 'Critical level',
                insight: 'High attrition indicates cultural crisis - leaders are burning through talent to hit numbers.'
            });
        }

        if (leadership.diversity < 0.5) {
            analysis.weaknesses.push({
                area: 'Leadership Monoculture',
                score: leadership.mostUsed[0] + ' (' + leadership.mostUsed[1].toFixed(0) + '%)',
                gap: 'Low diversity (index: ' + (leadership.diversity * 100).toFixed(0) + '%)',
                insight: 'Homogeneous leadership style indicates groupthink risk - culture may lack adaptability.'
            });
        }

        if (lead.avgAgility < 25) {
            analysis.weaknesses.push({
                area: 'Organizational Agility',
                score: lead.avgAgility.toFixed(0) + ' points',
                gap: (45 - lead.avgAgility).toFixed(0) + ' points below benchmark',
                insight: 'Low agility scores suggest rigid culture - leaders struggle to adapt when circumstances change.'
            });
        }

        if (decisions.available && decisions.commonTraps.priceWar / analysis.playerCount > 0.5) {
            analysis.weaknesses.push({
                area: 'Strategic Short-Termism',
                score: Math.round((decisions.commonTraps.priceWar / analysis.playerCount) * 100) + '% fell into price war trap',
                gap: 'Reactive culture',
                insight: 'Majority of leaders chose short-term price matching over long-term differentiation - reactive culture.'
            });
        }

        // CULTURAL RISKS
        if (colors.percentages.RED > 50) {
            analysis.culturalRisks.push({
                risk: 'Aggressive Monoculture',
                severity: 'HIGH',
                detail: colors.percentages.RED.toFixed(0) + '% of leaders are RED (Dominant/Driven) personality',
                consequence: 'High burnout risk, potential for toxic competition, people may not speak up'
            });
        }

        if (leadership.aggregate.pacesetting > 35) {
            analysis.culturalRisks.push({
                risk: 'Pacesetting Overuse',
                severity: 'MEDIUM',
                detail: leadership.aggregate.pacesetting.toFixed(0) + '% pacesetting leadership (healthy: <25%)',
                consequence: 'Unsustainable pressure on teams, lack of development focus, short-term optimization'
            });
        }

        if (leadership.aggregate.coaching < 15) {
            analysis.culturalRisks.push({
                risk: 'Development Deficit',
                severity: 'MEDIUM',
                detail: leadership.aggregate.coaching.toFixed(0) + '% coaching leadership (healthy: >20%)',
                consequence: 'Talent pipeline at risk, low succession readiness, directing instead of developing'
            });
        }

        if (metrics.successRate < 50) {
            analysis.culturalRisks.push({
                risk: 'Widespread Failure Pattern',
                severity: 'CRITICAL',
                detail: metrics.successRate.toFixed(0) + '% of leaders failed to meet basic targets',
                consequence: 'Systemic leadership capability gap - cultural transformation needed'
            });
        }
    }

    generateCulturalRecommendations(analysis) {
        const { weaknesses, culturalRisks, comparisonToHighPerformance, leadership, metrics } = analysis;

        // Priority 1: Critical gaps
        if (metrics.avgAttrition >= 15 || culturalRisks.some(r => r.severity === 'CRITICAL')) {
            analysis.recommendations.push({
                priority: 1,
                title: 'URGENT: Cultural Intervention Required',
                actions: [
                    'Pause aggressive growth targets and conduct culture assessment',
                    'Implement 360-degree feedback for all leaders to identify blind spots',
                    'Bring in external facilitator for leadership team workshop on sustainable performance',
                    'Review and reset expectations around work-life balance and team capacity'
                ],
                timeline: 'Immediate (within 30 days)',
                expectedImpact: 'Stabilize attrition, prevent talent exodus, restore psychological safety'
            });
        }

        // Priority 2: Leadership development gaps
        if (leadership.diversity < 0.5 || leadership.aggregate.coaching < 15) {
            analysis.recommendations.push({
                priority: 2,
                title: 'Develop Leadership Flexibility',
                actions: [
                    'Mandate Goleman\'s "Primal Leadership" as required reading for leadership team',
                    'Implement leadership style assessment (360-degree) for all leaders',
                    'Create coaching circles - pair leaders with different dominant styles',
                    'Develop context-based leadership playbook: "When to use which style"'
                ],
                timeline: 'Q1-Q2 (3-6 months)',
                expectedImpact: 'Increase leadership diversity index from ' + (leadership.diversity * 100).toFixed(0) + '% to 75%+'
            });
        }

        // Priority 3: Commercial performance
        if (metrics.avgGrowth < 20) {
            analysis.recommendations.push({
                priority: 3,
                title: 'Strengthen Commercial Acumen',
                actions: [
                    'Implement strategic decision-making training (e.g., "Playing to Win" framework)',
                    'Create cross-functional teams to break down silos',
                    'Establish quarterly "strategic choices" reviews - force hard decisions',
                    'Bring in external business coach to work with underperforming leaders'
                ],
                timeline: 'Q2-Q3 (6-9 months)',
                expectedImpact: 'Close ' + (20 - metrics.avgGrowth).toFixed(1) + '% growth gap, improve strategic confidence'
            });
        }

        // Priority 4: Agility and adaptation
        if (analysis.lead.avgAgility < 30) {
            analysis.recommendations.push({
                priority: 4,
                title: 'Build Organizational Agility',
                actions: [
                    'Implement "fail fast" experimentation culture - celebrate learning from failures',
                    'Reduce approval layers for tactical decisions',
                    'Create rapid response teams for market changes',
                    'Train leaders on scenario planning and decision-making under uncertainty'
                ],
                timeline: 'Q3-Q4 (9-12 months)',
                expectedImpact: 'Increase agility score to 45+ (benchmark level)'
            });
        }

        // Priority 5: Sustain strengths
        if (analysis.strengths.length > 0) {
            analysis.recommendations.push({
                priority: 5,
                title: 'Sustain Cultural Strengths',
                actions: [
                    'Document and share success stories from high performers',
                    'Create internal case studies: "How [Leader] achieved 28% growth with 80% morale"',
                    'Establish recognition program for leaders who embody company values',
                    'Use top performers as coaches/mentors for others'
                ],
                timeline: 'Ongoing',
                expectedImpact: 'Lock in cultural gains, prevent regression, create role models'
            });
        }

        // Sort by priority
        analysis.recommendations.sort((a, b) => a.priority - b.priority);
    }
}

// Make available to game engine
if (typeof window !== 'undefined') {
    window.CultureAnalysis = CultureAnalysis;
}
