// USL Pro/Rel Simulator - Browser Bundle (auto-generated)

// ---- fixtures.js ----
function generateDoubleRoundRobin(clubs) {
  const n0 = clubs.length;
  if (n0 < 2) return [];
  let clubsList = [...clubs];
  let bye = null;
  let n = n0;
  if (n % 2 === 1) {
    bye = "__BYE__";
    clubsList.push(bye);
    n += 1;
  }
  const roundsFirstHalf = [];
  const fixed = clubsList[0];
  let rotating = clubsList.slice(1);
  for (let roundNum = 0; roundNum < n - 1; roundNum++) {
    let pairings = [[fixed, rotating[0]]];
    for (let i = 1; i < Math.floor(n / 2); i++) {
      pairings.push([rotating[i], rotating[rotating.length - i]]);
    }
    if (roundNum % 2 === 1) pairings = pairings.map(([h, a]) => [a, h]);
    pairings = pairings.filter(([h, a]) => h !== bye && a !== bye);
    roundsFirstHalf.push(pairings);
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
  }
  const roundsSecondHalf = roundsFirstHalf.map((r) => r.map(([h, a]) => [a, h]));
  return [...roundsFirstHalf, ...roundsSecondHalf];
}

function validateSchedule(clubs, schedule) {
  const problems = [];
  const clubSet = new Set(clubs);
  const matchupCount = {};
  for (const roundPairings of schedule) {
    const seenThisRound = new Set();
    for (const [home, away] of roundPairings) {
      if (home === away) problems.push(`Club ${home} scheduled to play itself.`);
      if (seenThisRound.has(home) || seenThisRound.has(away)) {
        problems.push(`Club plays twice in the same round: ${home} vs ${away}`);
      }
      seenThisRound.add(home);
      seenThisRound.add(away);
      const key = `${home}|${away}`;
      matchupCount[key] = (matchupCount[key] || 0) + 1;
    }
  }
  for (const a of clubSet) {
    for (const b of clubSet) {
      if (a === b) continue;
      const homeCount = matchupCount[`${a}|${b}`] || 0;
      if (homeCount !== 1) problems.push(`${a} hosted ${b} ${homeCount} time(s), expected exactly 1.`);
    }
  }
  return problems;
}



// ---- match_simulation.js ----
const HOME_ADVANTAGE_GOALS = 0.35;
const BASE_EXPECTED_GOALS = 1.35;

function ratingToExpectedGoals(ownRating, oppRating, isHome) {
  const ratingDiff = (ownRating - oppRating) / 100.0;
  let expected = BASE_EXPECTED_GOALS + ratingDiff * 1.5;
  if (isHome) expected += HOME_ADVANTAGE_GOALS;
  return Math.max(0.15, expected);
}

function poissonSample(lam, rng) {
  const L = Math.exp(-lam);
  let k = 0;
  let p = 1.0;
  do {
    k += 1;
    p *= rng.random();
  } while (p > L);
  return k - 1;
}

function simulateScore(homeRating, awayRating, rng = { random: Math.random }) {
  const homeXg = ratingToExpectedGoals(homeRating, awayRating, true);
  const awayXg = ratingToExpectedGoals(awayRating, homeRating, false);
  return [poissonSample(homeXg, rng), poissonSample(awayXg, rng)];
}



// ---- standings.js ----
function computeStandings(clubs, completedMatches, rng = { random: Math.random }) {
const stats = {};
for (const c of clubs) {
stats[c] = { club: c, pld: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
}
const h2hPoints = {};
const h2hGd = {};
for (const c of clubs) {
h2hPoints[c] = {};
h2hGd[c] = {};
}
const clubSet = new Set(clubs);
for (const m of completedMatches) {
const { home, away, home_goals: hg, away_goals: ag } = m;
const homeTracked = clubSet.has(home);
const awayTracked = clubSet.has(away);
if (homeTracked) {
stats[home].pld += 1;
stats[home].gf += hg;
stats[home].ga += ag;
}
if (awayTracked) {
stats[away].pld += 1;
stats[away].gf += ag;
stats[away].ga += hg;
}
let homePts, awayPts;
if (hg > ag) {
if (homeTracked) stats[home].w += 1;
if (awayTracked) stats[away].l += 1;
homePts = 3; awayPts = 0;
} else if (ag > hg) {
if (awayTracked) stats[away].w += 1;
if (homeTracked) stats[home].l += 1;
homePts = 0; awayPts = 3;
} else {
if (homeTracked) stats[home].d += 1;
if (awayTracked) stats[away].d += 1;
homePts = 1; awayPts = 1;
}
if (homeTracked) stats[home].pts += homePts;
if (awayTracked) stats[away].pts += awayPts;
if (homeTracked && awayTracked) {
h2hPoints[home][away] = (h2hPoints[home][away] || 0) + homePts;
h2hPoints[away][home] = (h2hPoints[away][home] || 0) + awayPts;
h2hGd[home][away] = (h2hGd[home][away] || 0) + (hg - ag);
h2hGd[away][home] = (h2hGd[away][home] || 0) + (ag - hg);
}
}
 
for (const c of clubs) {
stats[c].gd = stats[c].gf - stats[c].ga;
}
 
const lottery = {};
for (const c of clubs) lottery[c] = rng.random();
 
let orderedClubs = [...clubs].sort((a, b) => {
if (stats[b].pts !== stats[a].pts) return stats[b].pts - stats[a].pts;
if (stats[b].w !== stats[a].w) return stats[b].w - stats[a].w;
if (stats[b].gd !== stats[a].gd) return stats[b].gd - stats[a].gd;
if (stats[b].gf !== stats[a].gf) return stats[b].gf - stats[a].gf;
return lottery[a] - lottery[b];
});
 
orderedClubs = applyHeadToHeadTiebreak(orderedClubs, stats, h2hPoints, h2hGd);
return orderedClubs.map((c) => stats[c]);
}
 
function applyHeadToHeadTiebreak(orderedClubs, stats, h2hPoints, h2hGd) {
const result = [];
let i = 0;
while (i < orderedClubs.length) {
let j = i;
const ptsI = stats[orderedClubs[i]].pts;
while (j < orderedClubs.length && stats[orderedClubs[j]].pts === ptsI) {
j += 1;
}
let group = orderedClubs.slice(i, j);
 
if (group.length > 1) {
const h2hKey = (club) => {
let ptsVsGroup = 0, gdVsGroup = 0;
for (const other of group) {
if (other === club) continue;
ptsVsGroup += h2hPoints[club][other] || 0;
gdVsGroup += h2hGd[club][other] || 0;
}
return [-ptsVsGroup, -gdVsGroup];
};
group = [...group].sort((a, b) => {
const [aPts, aGd] = h2hKey(a);
const [bPts, bGd] = h2hKey(b);
if (aPts !== bPts) return aPts - bPts;
return aGd - bGd;
});
}
 
result.push(...group);
i = j;
}
return result;
}
 

// ---- performance_rating.js ----
const PYTHAGOREAN_EXPONENT = 1.35;
const DECAY_RATE = 0.70;
const REVERSION_RATE = 0.275;

function pythagoreanWinPct(gf, ga, exponent = PYTHAGOREAN_EXPONENT) {
  if (gf === 0 && ga === 0) return 0.5;
  return Math.pow(gf, exponent) / (Math.pow(gf, exponent) + Math.pow(ga, exponent));
}

function seedPerformanceRating(seasonHistory, currentYear, decayRate = DECAY_RATE, maxLookbackYears = 10) {
  const relevant = seasonHistory.filter((s) => {
    const yearsAgo = currentYear - s.season;
    return yearsAgo >= 0 && yearsAgo < maxLookbackYears;
  });
  if (relevant.length === 0) return 50.0;

  let totalWeight = 0.0;
  let weightedSum = 0.0;
  for (const s of relevant) {
    const yearsAgo = currentYear - s.season;
    const weight = Math.pow(decayRate, yearsAgo);
    const winPct = pythagoreanWinPct(s.gf, s.ga);
    totalWeight += weight;
    weightedSum += weight * winPct;
  }
  return (weightedSum / totalWeight) * 100.0;
}

function evolvePerformanceRating(currentRating, stabilityScore, reversionRate = REVERSION_RATE) {
  const gap = stabilityScore - currentRating;
  return currentRating + gap * reversionRate;
}



// ---- promotion_relegation.js ----
function applyPromotionRelegation(higherStandings, lowerStandings, numPromoted, numRelegated) {
  if (numPromoted > lowerStandings.length) {
    throw new Error(`Cannot promote ${numPromoted} clubs - lower division only has ${lowerStandings.length}.`);
  }
  if (numRelegated > higherStandings.length) {
    throw new Error(`Cannot relegate ${numRelegated} clubs - higher division only has ${higherStandings.length}.`);
  }

  const promoted = lowerStandings.slice(0, numPromoted).map((row) => row.club);
  const relegated = numRelegated > 0
    ? higherStandings.slice(higherStandings.length - numRelegated).map((row) => row.club)
    : [];

  const higherStaying = higherStandings.filter((row) => !relegated.includes(row.club)).map((row) => row.club);
  const lowerStaying = lowerStandings.filter((row) => !promoted.includes(row.club)).map((row) => row.club);

  return {
    promoted,
    relegated,
    newHigherDivisionClubs: [...higherStaying, ...promoted],
    newLowerDivisionClubs: [...lowerStaying, ...relegated],
  };
}



// ---- promotion_priority.js ----
function resolvePromotionSlots(standings, numSlots, rankedPriority, playoffChampion = null, playoffRunnerUp = null, otherConferenceWinner = null) {
  const shieldWinner = standings[0].club;
  const alreadySelected = [];

  const tryAdd = (club) => {
    if (club !== null && club !== undefined && !alreadySelected.includes(club)) {
      alreadySelected.push(club);
      return true;
    }
    return false;
  };

  for (const rule of rankedPriority) {
    if (alreadySelected.length >= numSlots) break;

    if (rule === "playoff_champion") {
      tryAdd(playoffChampion);
    } else if (rule === "shield_winner") {
      tryAdd(shieldWinner);
    } else if (rule === "playoff_runner_up") {
      tryAdd(playoffRunnerUp);
    } else if (rule === "other_conference_winner") {
      tryAdd(otherConferenceWinner);
    } else if (rule === "regular_season_position") {
      for (const row of standings) {
        if (alreadySelected.length >= numSlots) break;
        tryAdd(row.club);
      }
    } else {
      throw new Error(`Unknown promotion priority rule: ${rule}`);
    }
  }

  if (alreadySelected.length < numSlots) {
    throw new Error(
      `Could not fill all ${numSlots} promotion slots using ranked_priority=` +
      `${JSON.stringify(rankedPriority)} - only found ${alreadySelected.length} distinct clubs.`
    );
  }
  return alreadySelected;
}



// ---- playoffs.js ----

function resolveQualifierCount(divisionSize, initialQualifiers, expandedQualifiers, sizeThreshold) {
  return divisionSize >= sizeThreshold ? expandedQualifiers : initialQualifiers;
}

function validateQualifierCount(qualifierCount) {
  if (qualifierCount < 2) throw new Error("Qualifier count must be at least 2.");
  if ((qualifierCount & (qualifierCount - 1)) !== 0) {
    throw new Error(`Qualifier count ${qualifierCount} is not a power of 2.`);
  }
}

function seedPlayoffBracket(standings, qualifierCount) {
  validateQualifierCount(qualifierCount);
  if (qualifierCount > standings.length) {
    throw new Error(`Cannot seed ${qualifierCount} qualifiers - division only has ${standings.length} clubs.`);
  }
  const qualified = standings.slice(0, qualifierCount).map((row) => row.club);
  const matchups = [];
  for (let i = 0; i < qualifierCount / 2; i++) {
    matchups.push([qualified[i], qualified[qualifierCount - 1 - i]]);
  }
  return matchups;
}

function resolveKnockoutMatch(clubA, clubB, ratingA, ratingB, rng) {
  let [homeGoals, awayGoals] = simulateScore(ratingA, ratingB, rng);
  while (homeGoals === awayGoals) {
    const compressedA = 50 + (ratingA - 50) * 0.3;
    const compressedB = 50 + (ratingB - 50) * 0.3;
    [homeGoals, awayGoals] = simulateScore(compressedA, compressedB, rng);
  }
  return homeGoals > awayGoals ? clubA : clubB;
}

function runPlayoffBracket(standings, qualifierCount, ratings, rng, returnRunnerUp = false) {
  const matchups = seedPlayoffBracket(standings, qualifierCount);
  let roundParticipants = matchups.flat();
  let lastFinalPair = null;

  while (roundParticipants.length > 1) {
    const nextRound = [];
    if (roundParticipants.length === 2) {
      lastFinalPair = [...roundParticipants];
    }
    for (let i = 0; i < roundParticipants.length; i += 2) {
      const a = roundParticipants[i];
      const b = roundParticipants[i + 1];
      nextRound.push(resolveKnockoutMatch(a, b, ratings[a], ratings[b], rng));
    }
    roundParticipants = nextRound;
  }

  const champion = roundParticipants[0];
  if (returnRunnerUp && lastFinalPair) {
    const runnerUp = lastFinalPair[0] === champion ? lastFinalPair[1] : lastFinalPair[0];
    return [champion, runnerUp];
  }
  return champion;
}

function getShieldWinner(standings) {
  return standings[0].club;
}

function determineLeagueChampion(standings, playoffChampion, designationMode) {
  const shieldWinner = getShieldWinner(standings);
  let official;
  if (designationMode === "shield_winner" || playoffChampion === null || playoffChampion === undefined) {
    official = shieldWinner;
  } else if (designationMode === "playoff_champion") {
    official = playoffChampion;
  } else if (designationMode === "co_recognized") {
    official = [...new Set([shieldWinner, playoffChampion])].sort();
  } else {
    throw new Error(`Unknown designation_mode: ${designationMode}`);
  }
  return { officialChampion: official, shieldWinner, playoffChampion };
}



// ---- buildup_mechanics.js ----
function resolveBuildupCounts(currentSize, targetSize, buildupPromoted, buildupRelegated, steadyStatePromoted, steadyStateRelegated) {
  if (currentSize >= targetSize) {
    return {
      promoted: steadyStatePromoted,
      relegated: steadyStateRelegated,
      capped: false,
      message: null,
    };
  }

  const roomForPromotion = targetSize - currentSize + buildupRelegated;
  const effectivePromoted = Math.min(buildupPromoted, Math.max(0, roomForPromotion));
  const wasCapped = effectivePromoted < buildupPromoted;

  return {
    promoted: effectivePromoted,
    relegated: buildupRelegated,
    capped: wasCapped,
    message: wasCapped
      ? `Only ${effectivePromoted} team${effectivePromoted === 1 ? " was" : "s were"} promoted this year in order to reach target league size of ${targetSize}.`
      : null,
  };
}



// ---- cup_simulation.js ----
const DAMPENING_EXPONENT = 0.4;

function dampenedWeightedChoice(candidates, ratings, rng) {
  const weights = candidates.map((c) => Math.pow(Math.max(0.01, ratings[c]), DAMPENING_EXPONENT));
  const total = weights.reduce((a, b) => a + b, 0);
  const r = rng.random() * total;
  let cumulative = 0.0;
  for (let i = 0; i < candidates.length; i++) {
    cumulative += weights[i];
    if (r <= cumulative) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

function simulateUslCup(premierClubs, championshipClubs, ratings, rng) {
  const roll = rng.random();
  if (roll < 0.90) {
    const winner = dampenedWeightedChoice(premierClubs, ratings, rng);
    return { winner, winningDivision: "premier" };
  } else {
    const winner = dampenedWeightedChoice(championshipClubs, ratings, rng);
    return { winner, winningDivision: "championship" };
  }
}

function simulateUsOpenCup(premierClubs, ratings, rng) {
  const top5 = [...premierClubs].sort((a, b) => ratings[b] - ratings[a]).slice(0, 5);
  const winner = dampenedWeightedChoice(top5, ratings, rng);
  return { winner, winningDivision: "premier" };
}



// ---- reputation_momentum.js ----
const DIVISION_WEIGHTS = { premier: 1.0, championship: 0.6, league_one: 0.35 };
const LEAGUE_TRIGGER_POINTS = {
  title_or_shield: 6, promoted: 5, top3_not_promoted: 2,
  mid_table: 0, bottom3_not_relegated: -2, relegated: -5,
};
const CUP_TRIGGER_POINTS = { usl_cup_win: 6, open_cup_deep_run: 2 };
const ROLLING_WINDOW_YEARS = 5;
const HARD_CEILING = 15;

function determineLeagueTrigger(finalPosition, divisionSize, promoted, relegated, wonTitleOrShield) {
  if (wonTitleOrShield) return "title_or_shield";
  if (promoted) return "promoted";
  if (relegated) return "relegated";
  if (finalPosition <= 3) return "top3_not_promoted";
  if (finalPosition > divisionSize - 3) return "bottom3_not_relegated";
  return "mid_table";
}

function buildSeasonEvent(year, division, leagueTrigger, cupTriggers = []) {
  return { year, division, leagueTrigger, cupTriggers };
}

function computeReputationMomentum(events, currentYear, windowYears = ROLLING_WINDOW_YEARS, ceiling = HARD_CEILING) {
  const relevantEvents = events.filter((e) => {
    const age = currentYear - e.year;
    return age >= 0 && age < windowYears;
  });

  let total = 0.0;
  for (const event of relevantEvents) {
    const weight = DIVISION_WEIGHTS[event.division];
    total += LEAGUE_TRIGGER_POINTS[event.leagueTrigger] * weight;
    for (const cupTrigger of event.cupTriggers) {
      total += CUP_TRIGGER_POINTS[cupTrigger] * weight;
    }
  }
  return Math.max(-ceiling, Math.min(ceiling, total));
}



// ---- stability_score.js ----
function computeStadiumScore(controlStatus, capacity, utilizationPct, plannedCapacity = null, planConfidence = "none") {
  const controlBaseMap = { owned: 70, leased_dedicated: 55, groundshare: 35 };
  const controlBase = controlBaseMap[controlStatus];
  const capacityScore = Math.max(0.0, Math.min(1.0, (capacity - 3000) / (15000 - 3000))) * 30;
  const utilizationFactor = Math.max(0.0, Math.min(1.0, utilizationPct / 60));
  const capacityBonus = capacityScore * utilizationFactor;

  let planBonus = 0.0;
  if (plannedCapacity) {
    const planCapacityScore = Math.max(0.0, Math.min(1.0, (plannedCapacity - 3000) / (15000 - 3000))) * 30;
    const confidenceMultiplierMap = {
      funded_confirmed: 1.0, under_construction: 1.0, proposed: 0.5, none: 0.0,
    };
    planBonus = planCapacityScore * confidenceMultiplierMap[planConfidence];
  }
  return Math.min(100.0, controlBase + capacityBonus + planBonus);
}

function computeMarketAttendanceBaseScore(clubAttendance, allClubsAttendance, utilizationPct) {
  const values = Object.values(allClubsAttendance);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const base = hi > lo ? ((clubAttendance - lo) / (hi - lo)) * 100 : 50.0;

  let multiplier;
  if (utilizationPct <= 90) {
    multiplier = 1.0;
  } else {
    const ramp = Math.max(0.0, Math.min(1.0, (utilizationPct - 90) / (130 - 90)));
    multiplier = 1.0 + ramp * 0.15;
  }
  return Math.min(100.0, base * multiplier);
}

function computeContinuityScore(tier) {
  const map = { high: 90, moderate: 65, new_club: 50, low: 30 };
  return map[tier];
}

function computeLongevityScore(yearsInOperation) {
  if (yearsInOperation <= 10) return (yearsInOperation / 10) * 80;
  return 80 + 20 * (1 - Math.exp(-(yearsInOperation - 10) / 22));
}

function computeStabilityScore(stadiumScore, marketAttendanceScore, continuityScore, longevityScore) {
  return 0.30 * stadiumScore + 0.30 * marketAttendanceScore + 0.20 * continuityScore + 0.20 * longevityScore;
}

function computeFinalMarketAttendanceWithMomentum(baseMarketScore, reputationMomentum) {
  return Math.max(0.0, Math.min(100.0, baseMarketScore + reputationMomentum));
}



// ---- expansion_engine.js ----
function getEligibleEntryDivisions(year, isInauguralSeason, candidateTargetDivision, championshipDirectEligible) {
  if (isInauguralSeason) return [candidateTargetDivision];
  if ((year === 2028 || year === 2029) && championshipDirectEligible) return ["Championship", "League One"];
  return ["League One"];
}

function filterEligibleCandidates(candidates, year, isInauguralSeason) {
  const eligible = [];
  for (const c of candidates) {
    const divisions = getEligibleEntryDivisions(
      year, isInauguralSeason, c.target_division, c.championship_direct_eligible || false
    );
    if (divisions.includes(c.target_division)) {
      eligible.push({ ...c, entry_division: c.target_division });
    } else if (divisions.includes("League One") && !isInauguralSeason) {
      eligible.push({ ...c, entry_division: "League One" });
    }
  }
  return eligible;
}

const SELECTION_WEIGHTS = {
  automatic_mode: { baseline: 1, announced: 3, announced_and_due: 15 },
  manual_mode_dealt_hand: { baseline: 1, announced: 3, announced_and_due: 6 },
};

function weightedDraw(candidates, mode, rng, count = 1) {
  const weightsConfig = SELECTION_WEIGHTS[mode];
  const pool = [...candidates];
  const drawn = [];
  const n = Math.min(count, pool.length);
  for (let iter = 0; iter < n; iter++) {
    const weights = pool.map((c) => weightsConfig[c.tier] ?? weightsConfig.baseline);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const r = rng.random() * totalWeight;
    let cumulative = 0;
    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i];
      if (r <= cumulative) {
        drawn.push(pool.splice(i, 1)[0]);
        break;
      }
    }
  }
  return drawn;
}

function dealManualModeHand(candidates, rng, minSize = 3, maxSize = 5) {
  const handSize = minSize + Math.floor(rng.random() * (maxSize - minSize + 1));
  return weightedDraw(candidates, "manual_mode_dealt_hand", rng, handSize);
}

const PACE_WEIGHTS = { 0: 30, 1: 35, 2: 20, 3: 10, 4: 4, 5: 1 };

function drawSeasonsNewClubCount(rng) {
  const outcomes = Object.keys(PACE_WEIGHTS).map(Number);
  const weights = Object.values(PACE_WEIGHTS);
  const total = weights.reduce((a, b) => a + b, 0);
  const r = rng.random() * total;
  let cumulative = 0;
  for (let i = 0; i < outcomes.length; i++) {
    cumulative += weights[i];
    if (r <= cumulative) return outcomes[i];
  }
  return outcomes[outcomes.length - 1];
}

const STADIUM_CONTROL_ODDS = { groundshare: 0.62, owned: 0.19, leased_dedicated: 0.19 };
const GROUNDSHARE_PLAN_ODDS = { none: 0.58, proposed: 0.31, funded_confirmed: 0.08, under_construction: 0.04 };

function weightedChoice(oddsDict, rng) {
  const outcomes = Object.keys(oddsDict);
  const weights = Object.values(oddsDict);
  const total = weights.reduce((a, b) => a + b, 0);
  const r = rng.random() * total;
  let cumulative = 0;
  for (let i = 0; i < outcomes.length; i++) {
    cumulative += weights[i];
    if (r <= cumulative) return outcomes[i];
  }
  return outcomes[outcomes.length - 1];
}

function generateHypotheticalStadium(rng) {
  const controlStatus = weightedChoice(STADIUM_CONTROL_ODDS, rng);
  let planStatus = null;
  if (controlStatus === "groundshare") {
    planStatus = weightedChoice(GROUNDSHARE_PLAN_ODDS, rng);
  }
  return { control_status: controlStatus, plan_status: planStatus };
}

const ATTENDANCE_RATIO_BY_STADIUM_STATUS = {
  owned: 5529.1 / 4281.6,
  leased_dedicated: 4384.2 / 4281.6,
  groundshare: 3866.2 / 4281.6,
};
const ATTENDANCE_NOISE_STDDEV_PCT = 0.15;

function gaussianSample(rng, mean = 0, stddev = 1) {
  const u1 = Math.max(rng.random(), 1e-12);
  const u2 = rng.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + z0 * stddev;
}

function generateHypotheticalClub(cityName, currentActiveAttendanceValues, rng) {

  const stadium = generateHypotheticalStadium(rng);
  const globalAvgAttendance =
    currentActiveAttendanceValues.reduce((a, b) => a + b, 0) / currentActiveAttendanceValues.length;
  const ratio = ATTENDANCE_RATIO_BY_STADIUM_STATUS[stadium.control_status];
  const noiseMultiplier = 1.0 + gaussianSample(rng, 0, ATTENDANCE_NOISE_STDDEV_PCT);
  const avgAttendance = Math.max(500, globalAvgAttendance * ratio * noiseMultiplier);

  const controlBasePointsMap = { owned: 70, leased_dedicated: 55, groundshare: 35 };
  const controlBasePoints = controlBasePointsMap[stadium.control_status];
  const stabilityScore = computeStabilityScore(controlBasePoints, 50.0, 50.0, 0.0);
  const performanceRating = stabilityScore;

  return {
    name: `${cityName} USL Team`,
    city: cityName,
    stadium,
    seed_attendance: avgAttendance,
    stability_score: stabilityScore,
    performance_rating: performanceRating,
    continuity_tier: "new_club",
    is_hypothetical: true,
  };
}



// ---- league_one_conferences.js ----

const TOTAL_GAME_CAP = 38;

function splitIntoConferences(clubs, rng) {
  const shuffled = [...clubs];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const mid = Math.floor(shuffled.length / 2);
  return { east: shuffled.slice(0, mid), west: shuffled.slice(mid) };
}

function computeInterconferenceGameCount(eastSize, westSize) {
  const eastIntra = Math.max(0, (eastSize - 1)) * 2;
  const westIntra = Math.max(0, (westSize - 1)) * 2;
  const eastRoom = Math.max(0, TOTAL_GAME_CAP - eastIntra);
  const westRoom = Math.max(0, TOTAL_GAME_CAP - westIntra);
  const sharedRoom = Math.min(eastRoom, westRoom);
  return Math.min(sharedRoom, eastSize, westSize);
}

function buildBalancedInterconferenceSchedule(eastClubs, westClubs, gamesPerClub, rng) {
  if (gamesPerClub <= 0) return [];

  const largerIsEast = eastClubs.length >= westClubs.length;
  const largerList = largerIsEast ? eastClubs : westClubs;
  const smallerList = largerIsEast ? westClubs : eastClubs;

  function shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  const largerAssignedCount = {};
  for (const c of largerList) largerAssignedCount[c] = 0;

  const matches = [];
  const shuffledSmaller = shuffle(smallerList);
  let homeToggle = 0;

  for (const smallerClub of shuffledSmaller) {
    const ranked = shuffle(largerList).sort((a, b) => largerAssignedCount[a] - largerAssignedCount[b]);
    const partners = ranked.slice(0, gamesPerClub);

    for (const largerClub of partners) {
      largerAssignedCount[largerClub] += 1;
      const eastClub = largerIsEast ? largerClub : smallerClub;
      const westClub = largerIsEast ? smallerClub : largerClub;
      if (homeToggle % 2 === 0) matches.push([eastClub, westClub]);
      else matches.push([westClub, eastClub]);
      homeToggle += 1;
    }
  }

  return matches;
}

function generateLeagueOneSchedule(eastClubs, westClubs, rng) {
  const eastSchedule = generateDoubleRoundRobin(eastClubs);
  const westSchedule = generateDoubleRoundRobin(westClubs);

  const interconferenceGamesPerClub = computeInterconferenceGameCount(eastClubs.length, westClubs.length);
  const interconferenceMatches = buildBalancedInterconferenceSchedule(
    eastClubs, westClubs, interconferenceGamesPerClub, rng
  );

  return {
    rounds: [...eastSchedule, ...westSchedule, interconferenceMatches],
    interconferenceGamesPerClub,
  };
}

function reconcileConferenceAssignment(allClubs, conferenceAssignment, rng) {
  const allClubsSet = new Set(allClubs);
  let east = conferenceAssignment.east.filter((c) => allClubsSet.has(c));
  let west = conferenceAssignment.west.filter((c) => allClubsSet.has(c));
  const alreadyPlaced = new Set([...east, ...west]);

  for (const club of allClubs) {
    if (!alreadyPlaced.has(club)) {
      if (east.length <= west.length) east.push(club);
      else west.push(club);
      alreadyPlaced.add(club);
    }
  }

  // NEW: active rebalancing. Promotion/relegation can remove clubs from
  // one conference more than the other (e.g., both promoted clubs
  // happened to come from the same conference), leaving an imbalance
  // that new arrivals alone don't always fully close. If the two
  // conferences differ by MORE than 1 club after placing new arrivals,
  // move clubs from the larger side to the smaller side (chosen
  // randomly, for variety) until they're within 1 of each other.
  const r = rng || { random: Math.random };
  function shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(r.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
  while (Math.abs(east.length - west.length) > 1) {
    if (east.length > west.length) {
      const moving = shuffle(east)[0];
      east = east.filter((c) => c !== moving);
      west.push(moving);
    } else {
      const moving = shuffle(west)[0];
      west = west.filter((c) => c !== moving);
      east.push(moving);
    }
  }

  return { east, west };
}

function countGamesPlayed(completedMatches, club) {
  return completedMatches.filter((m) => m.home === club || m.away === club).length;
}

function runLeagueOneSeason(allClubs, ratings, rng, conferenceAssignment = null) {
  let assignment = conferenceAssignment === null
    ? splitIntoConferences(allClubs, rng)
    : reconcileConferenceAssignment(allClubs, conferenceAssignment, rng);

  const eastClubs = assignment.east;
  const westClubs = assignment.west;

  const { rounds: schedule, interconferenceGamesPerClub } = generateLeagueOneSchedule(eastClubs, westClubs, rng);

  const completedMatches = [];
  for (const roundPairings of schedule) {
    for (const [home, away] of roundPairings) {
      const [hg, ag] = simulateScore(ratings[home], ratings[away], rng);
      completedMatches.push({ home, away, home_goals: hg, away_goals: ag });
    }
  }

  const standings = computeStandings(allClubs, completedMatches, rng);

  const eastSet = new Set(eastClubs);
  const taggedStandings = standings.map((row) => ({
    ...row,
    conference: eastSet.has(row.club) ? "east" : "west",
  }));

  const eastStandings = taggedStandings.filter((row) => row.conference === "east");
  const westStandings = taggedStandings.filter((row) => row.conference === "west");

  return {
    standings: taggedStandings,
    eastStandings, westStandings,
    eastClubs, westClubs,
    interconferenceGamesPerClub,
    gamesPlayedByClub: Object.fromEntries(allClubs.map((c) => [c, countGamesPlayed(completedMatches, c)])),
  };
}

function getPlayerShieldWinner(leagueOneResult) {
  return leagueOneResult.standings[0].club;
}

function getOtherConferenceWinner(leagueOneResult) {
  const shieldWinner = leagueOneResult.standings[0].club;
  const shieldWinnerRow = leagueOneResult.standings.find((r) => r.club === shieldWinner);
  const otherConference = shieldWinnerRow.conference === "east" ? "west" : "east";
  const otherStandings = otherConference === "east" ? leagueOneResult.eastStandings : leagueOneResult.westStandings;
  return otherStandings.length > 0 ? otherStandings[0].club : null;
}

function runLeagueOnePlayoff(leagueOneResult, ratings, rng, qualifiersPerConference, returnRunnerUp = false) {
  validateQualifierCount(qualifiersPerConference * 2);

  const eastQualifiers = leagueOneResult.eastStandings.slice(0, qualifiersPerConference).map((r) => r.club);
  const westQualifiers = leagueOneResult.westStandings.slice(0, qualifiersPerConference).map((r) => r.club);

  const combinedSeeded = [];
  for (let i = 0; i < qualifiersPerConference; i++) {
    combinedSeeded.push({ club: eastQualifiers[i] });
    combinedSeeded.push({ club: westQualifiers[i] });
  }

  return runPlayoffBracket(combinedSeeded, qualifiersPerConference * 2, ratings, rng, returnRunnerUp);
}



// ---- simulation_run.js ----

function runSeasonForSingleTableDivision(clubs, ratings, rng) {
  const schedule = generateDoubleRoundRobin(clubs);
  const completedMatches = [];
  for (const roundPairings of schedule) {
    for (const [home, away] of roundPairings) {
      const [hg, ag] = simulateScore(ratings[home], ratings[away], rng);
      completedMatches.push({ home, away, home_goals: hg, away_goals: ag });
    }
  }
  return computeStandings(clubs, completedMatches, rng);
}

const DEFAULT_CONFIG = {
  premier_playoff_enabled: true,
  premier_qualifiers_initial: 4,
  premier_qualifiers_expanded: 8,
  premier_qualifiers_threshold: 16,
  premier_champion_designation: "playoff_champion",
  championship_promotion_priority: ["playoff_champion", "shield_winner", "playoff_runner_up", "regular_season_position"],
  championship_playoff_enabled: true,
  championship_qualifiers_initial: 4,
  championship_qualifiers_expanded: 8,
  championship_qualifiers_threshold: 16,
  championship_champion_designation: "shield_winner",
  league_one_promotion_priority: ["playoff_champion", "shield_winner", "other_conference_winner", "playoff_runner_up", "regular_season_position"],
  league_one_qualifiers_initial: 4,
  league_one_qualifiers_expanded: 8,
  league_one_qualifiers_threshold: 10,
  premier_championship_promo_releg: [2, 2],
  championship_league_one_promo_releg: [2, 2],
  expansion_mode: "automatic_mode",
  named_candidate_pool: [],
  premier_buildup: { target_size: null, buildup_promoted: 0, buildup_relegated: 0 },
  championship_buildup: { target_size: null, buildup_promoted: 0, buildup_relegated: 0 },
};

class SimulationRun {
  constructor(premierClubs, championshipClubs, leagueOneClubs, stabilityScores, rngSeed = 2028, config = {}) {
    this.premierClubs = [...premierClubs];
    this.championshipClubs = [...championshipClubs];
    this.leagueOneClubs = [...leagueOneClubs];

    this.stabilityScores = { ...stabilityScores };
    this.ratings = { ...stabilityScores };
    this.eventHistory = {};
    for (const c of Object.keys(stabilityScores)) this.eventHistory[c] = [];
    this.attendance = {};
    for (const c of Object.keys(stabilityScores)) this.attendance[c] = 4281.6;

    this.rng = SimulationRun.seededRng(rngSeed);
    this.currentYear = 2028;
    this.isFirstSeason = true;
    this.seasonHistory = [];
    this.leagueOneConferenceAssignment = null;

    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      premier_buildup: { ...DEFAULT_CONFIG.premier_buildup, ...(config.premier_buildup || {}) },
      championship_buildup: { ...DEFAULT_CONFIG.championship_buildup, ...(config.championship_buildup || {}) },
    };
    this.nextExpansionTeamNumber = 1;
    this.namedCandidatePool = [...(this.config.named_candidate_pool || [])];

    if (this.leagueOneClubs.length % 2 !== 0) {
      console.warn(
        `WARNING: League One starts with an ODD number of clubs (${this.leagueOneClubs.length}). ` +
        `The "always even" expansion rule will only defer FUTURE odd-numbered additions - it does ` +
        `not retroactively fix an odd STARTING roster. Consider adjusting the starting roster if a ` +
        `perfectly even count is required from Season 1 onward.`
      );
    }
  }

  static seededRng(seed) {
    let a = seed;
    return {
      random: function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      },
      randint: function (min, max) {
        return min + Math.floor(this.random() * (max - min + 1));
      },
    };
  }

  _evolveAllRatings() {
    for (const club of Object.keys(this.ratings)) {
      this.ratings[club] = evolvePerformanceRating(this.ratings[club], this.stabilityScores[club]);
    }
  }

  _runPremierSeason() {
    const standings = runSeasonForSingleTableDivision(this.premierClubs, this.ratings, this.rng);
    let playoffChampion = null, playoffRunnerUp = null, playoffQualifierCount = null;
    if (this.config.premier_playoff_enabled) {
      playoffQualifierCount = resolveQualifierCount(
        this.premierClubs.length, this.config.premier_qualifiers_initial,
        this.config.premier_qualifiers_expanded, this.config.premier_qualifiers_threshold
      );
      [playoffChampion, playoffRunnerUp] = runPlayoffBracket(standings, playoffQualifierCount, this.ratings, this.rng, true);
    }
    const championInfo = determineLeagueChampion(standings, playoffChampion, this.config.premier_champion_designation);
    return { standings, playoffChampion, playoffRunnerUp, championInfo, playoffQualifierCount };
  }

  _runChampionshipSeason() {
    const standings = runSeasonForSingleTableDivision(this.championshipClubs, this.ratings, this.rng);
    let playoffChampion = null, playoffRunnerUp = null, playoffQualifierCount = null;
    if (this.config.championship_playoff_enabled) {
      playoffQualifierCount = resolveQualifierCount(
        this.championshipClubs.length, this.config.championship_qualifiers_initial,
        this.config.championship_qualifiers_expanded, this.config.championship_qualifiers_threshold
      );
      [playoffChampion, playoffRunnerUp] = runPlayoffBracket(standings, playoffQualifierCount, this.ratings, this.rng, true);
    }
    const championInfo = determineLeagueChampion(standings, playoffChampion, this.config.championship_champion_designation);
    return { standings, playoffChampion, playoffRunnerUp, championInfo, playoffQualifierCount };
  }

  _runLeagueOneSeason() {
    const result = runLeagueOneSeason(this.leagueOneClubs, this.ratings, this.rng, this.leagueOneConferenceAssignment);
    if (this.leagueOneConferenceAssignment === null) {
      this.leagueOneConferenceAssignment = { east: result.eastClubs, west: result.westClubs };
    }
    const shieldWinner = getPlayerShieldWinner(result);
    const otherConferenceWinner = getOtherConferenceWinner(result);
    const qualifiersPerConf = Math.floor(
      resolveQualifierCount(
        result.eastClubs.length, this.config.league_one_qualifiers_initial,
        this.config.league_one_qualifiers_expanded, this.config.league_one_qualifiers_threshold
      ) / 2
    );
    const [playoffChampion, playoffRunnerUp] = runLeagueOnePlayoff(result, this.ratings, this.rng, qualifiersPerConf, true);
    return {
      standings: result.standings, shieldWinner, otherConferenceWinner, playoffChampion, playoffRunnerUp,
      eastStandings: result.eastStandings, westStandings: result.westStandings,
      gamesPlayedByClub: result.gamesPlayedByClub,
      interconferenceGamesPerClub: result.interconferenceGamesPerClub,
    };
  }

  _resolveBoundaryCounts(currentSize, buildupConfig, steadyStateCounts) {
    const [steadyPromoted, steadyRelegated] = steadyStateCounts;
    if (buildupConfig.target_size === null || buildupConfig.target_size === undefined) {
      return { promoted: steadyPromoted, relegated: steadyRelegated, message: null };
    }
    const result = resolveBuildupCounts(
      currentSize, buildupConfig.target_size,
      buildupConfig.buildup_promoted, buildupConfig.buildup_relegated,
      steadyPromoted, steadyRelegated
    );
    return { promoted: result.promoted, relegated: result.relegated, message: result.message };
  }

  _buildReputationEventsForDivision(divisionName, standings, promoted, relegated, shieldWinner, uslCupWinner, openCupWinner) {
    standings.forEach((row, i) => {
      const club = row.club;
      const position = i + 1;
      const trigger = determineLeagueTrigger(
        position, standings.length,
        promoted.includes(club), relegated.includes(club),
        club === shieldWinner
      );
      const cupTriggers = [];
      if (club === uslCupWinner) cupTriggers.push("usl_cup_win");
      if (club === openCupWinner) cupTriggers.push("open_cup_deep_run");
      this.eventHistory[club].push(buildSeasonEvent(this.currentYear, divisionName, trigger, cupTriggers));
    });
  }

  _recomputeAllStabilityScores() {
    for (const club of Object.keys(this.stabilityScores)) {
      const momentum = computeReputationMomentum(this.eventHistory[club], this.currentYear);
      const baseMarketShare = this.stabilityScores[club] * 0.30 * (100 / 30);
      const newMarket = computeFinalMarketAttendanceWithMomentum(baseMarketShare, momentum);
      const stadiumContinuityLongevityShare = this.stabilityScores[club] * 0.70;
      this.stabilityScores[club] = stadiumContinuityLongevityShare + newMarket * 0.30;
    }
  }

  _runExpansion() {
    const newCount = drawSeasonsNewClubCount(this.rng);
    if (newCount === 0) return { addedClubs: [], deferredMessage: null };

    let eligibleNamed = filterEligibleCandidates(this.namedCandidatePool, this.currentYear, this.isFirstSeason);
    const pendingAdditions = [];

    for (let i = 0; i < newCount; i++) {
      const drawn = weightedDraw(eligibleNamed, this.config.expansion_mode, this.rng, 1);
      let clubName, newStability, entryDivision, source, candidate = null;

      if (drawn.length > 0) {
        candidate = drawn[0];
        eligibleNamed = eligibleNamed.filter((c) => c.name !== candidate.name);
        entryDivision = candidate.entry_division;
        clubName = candidate.name;
        newStability = candidate.stability_score ?? 50.0;
        source = "named";
      } else {
        clubName = `Expansion Team ${this.nextExpansionTeamNumber}`;
        this.nextExpansionTeamNumber += 1;
        const hypo = generateHypotheticalClub(
          clubName.replace(" USL Team", ""),
          Object.values(this.attendance),
          this.rng
        );
        newStability = hypo.stability_score;
        entryDivision = this.isFirstSeason ? "Championship" : "League One";
        source = "hypothetical";
      }

      pendingAdditions.push({ source, candidate, clubName, newStability, entryDivision });
    }

    let deferredMessage = null;
    const leagueOneAdditions = pendingAdditions.filter((a) => a.entryDivision === "League One");
    if (leagueOneAdditions.length % 2 === 1) {
      const deferred = leagueOneAdditions[leagueOneAdditions.length - 1];
      const idx = pendingAdditions.indexOf(deferred);
      pendingAdditions.splice(idx, 1);

      if (deferred.source === "hypothetical") {
        this.nextExpansionTeamNumber -= 1;
      }

      deferredMessage = `${deferred.clubName} was ready to join League One this season, but entry was held back one year to keep both conferences an even size.`;
    }

    const addedClubs = [];
    for (const add of pendingAdditions) {
      if (add.source === "named") {
        this.namedCandidatePool = this.namedCandidatePool.filter((c) => c.name !== add.candidate.name);
      }

      this.stabilityScores[add.clubName] = add.newStability;
      this.ratings[add.clubName] = add.newStability;
      this.eventHistory[add.clubName] = [];
      this.attendance[add.clubName] = 4281.6;

      if (add.entryDivision === "Premier") this.premierClubs.push(add.clubName);
      else if (add.entryDivision === "Championship") this.championshipClubs.push(add.clubName);
      else this.leagueOneClubs.push(add.clubName);

      addedClubs.push([add.clubName, add.entryDivision]);
    }

    return { addedClubs, deferredMessage };
  }

  runSeason() {
    const year = this.currentYear;
    this._evolveAllRatings();

    const premierResult = this._runPremierSeason();
    const championshipResult = this._runChampionshipSeason();
    const leagueOneResult = this._runLeagueOneSeason();

    const uslCup = simulateUslCup(this.premierClubs, this.championshipClubs, this.ratings, this.rng);
    const openCup = simulateUsOpenCup(this.premierClubs, this.ratings, this.rng);

    const premierBoundary = this._resolveBoundaryCounts(
      this.premierClubs.length, this.config.premier_buildup, this.config.premier_championship_promo_releg
    );
    const promotedToPremier = resolvePromotionSlots(
      championshipResult.standings, premierBoundary.promoted, this.config.championship_promotion_priority,
      championshipResult.playoffChampion, championshipResult.playoffRunnerUp
    );
    const relegatedFromPremier = premierBoundary.relegated > 0
      ? premierResult.standings.slice(premierResult.standings.length - premierBoundary.relegated).map((r) => r.club)
      : [];

    const championshipBoundary = this._resolveBoundaryCounts(
      this.championshipClubs.length, this.config.championship_buildup, this.config.championship_league_one_promo_releg
    );
    const promotedToChampionship = resolvePromotionSlots(
      leagueOneResult.standings, championshipBoundary.promoted, this.config.league_one_promotion_priority,
      leagueOneResult.playoffChampion, leagueOneResult.playoffRunnerUp, leagueOneResult.otherConferenceWinner
    );
    const relegatedFromChampionship = championshipBoundary.relegated > 0
      ? championshipResult.standings.slice(championshipResult.standings.length - championshipBoundary.relegated).map((r) => r.club)
      : [];

    this._buildReputationEventsForDivision(
      "premier", premierResult.standings, promotedToPremier, relegatedFromPremier,
      premierResult.championInfo.shieldWinner, uslCup.winner, openCup.winner
    );
    this._buildReputationEventsForDivision(
      "championship", championshipResult.standings, promotedToChampionship, relegatedFromChampionship,
      championshipResult.championInfo.shieldWinner, uslCup.winner, openCup.winner
    );
    this._buildReputationEventsForDivision(
      "league_one", leagueOneResult.standings, promotedToChampionship, [],
      leagueOneResult.shieldWinner, uslCup.winner, openCup.winner
    );

    this._recomputeAllStabilityScores();

    this.premierClubs = this.premierClubs.filter((c) => !relegatedFromPremier.includes(c)).concat(promotedToPremier);

    const stayedInChamp = this.championshipClubs.filter(
      (c) => !promotedToPremier.includes(c) && !relegatedFromChampionship.includes(c)
    );
    this.championshipClubs = [...stayedInChamp, ...relegatedFromPremier, ...promotedToChampionship];

    this.leagueOneClubs = this.leagueOneClubs.filter((c) => !promotedToChampionship.includes(c)).concat(relegatedFromChampionship);

    const { addedClubs: expansionAdditions, deferredMessage } = this._runExpansion();

    this.seasonHistory.push({
      year,
      premier: premierResult, championship: championshipResult, leagueOne: leagueOneResult,
      uslCup, openCup,
      promotedToPremier, relegatedFromPremier,
      promotedToChampionship, relegatedFromChampionship,
      expansionAdditions,
      deferredMessage,
      divisionSizes: {
        premier: this.premierClubs.length,
        championship: this.championshipClubs.length,
        leagueOne: this.leagueOneClubs.length,
      },
      buildupMessages: [premierBoundary.message, championshipBoundary.message].filter((m) => m !== null),
    });

    this.isFirstSeason = false;
    this.currentYear += 1;
  }

  runFullSimulation(numSeasons) {
    for (let i = 0; i < numSeasons; i++) this.runSeason();
    return this.seasonHistory;
  }
}



// ---- data_loader.js ----

function computeRealStabilityScore(club, allClubsAttendance, currentYear = 2028) {
  const stadiumScore = computeStadiumScore(
    club.stadium.status,
    club.stadium.capacity,
    club.stadium.utilization_pct,
    club.stadium.planned_capacity,
    club.stadium.plan_confidence || "none"
  );

  const marketScore = computeMarketAttendanceBaseScore(
    club.market_attendance.avg_2yr,
    allClubsAttendance,
    club.stadium.utilization_pct
  );

  const continuityScore = computeContinuityScore(club.continuity.tier);

  const yearsInOperation = currentYear - club.continuity.founded_year;
  const longevityScore = computeLongevityScore(yearsInOperation);

  return computeStabilityScore(stadiumScore, marketScore, continuityScore, longevityScore);
}

function computeRealPerformanceRatingSeed(clubId, performanceHistory, currentYear = 2028) {
  const clubHistory = performanceHistory
    .filter((h) => h.club_id === clubId)
    .map((h) => ({ season: h.season, gf: h.gf, ga: h.ga }));
  return seedPerformanceRating(clubHistory, currentYear);
}

function loadSimulationInputs(exportData, currentYear = 2028) {
  const clubs = exportData.clubs;

  const allClubsAttendance = {};
  for (const c of clubs) {
    allClubsAttendance[c.club_id] = c.market_attendance.avg_2yr;
  }

  const stabilityScores = {};
  const performanceRatings = {};
  const attendance = {};
  const premierClubs = [];
  const championshipClubs = [];
  const leagueOneClubs = [];
  const clubIdToName = {};
  const clubNameToId = {};

  for (const c of clubs) {
    const name = c.display_name;
    clubIdToName[c.club_id] = name;
    clubNameToId[name] = c.club_id;

    stabilityScores[name] = computeRealStabilityScore(c, allClubsAttendance, currentYear);
    performanceRatings[name] = computeRealPerformanceRatingSeed(c.club_id, exportData.performance_history, currentYear);
    attendance[name] = c.market_attendance.avg_2yr;

    if (c.current_division === "Championship") championshipClubs.push(name);
    else if (c.current_division === "League One") leagueOneClubs.push(name);
  }

  const namedCandidatePool = exportData.candidate_pool
    .filter((c) => c.pool_status !== "candidate (reclassify down)")
    .map((c) => ({
      name: c.display_name,
      target_division: c.target_division,
      championship_direct_eligible: c.championship_direct_eligible,
      tier: c.pool_status === "announced" ? "announced" : "candidate",
      stability_score: 50.0,
    }));

  return {
    premierClubs, championshipClubs, leagueOneClubs,
    stabilityScores, performanceRatings, attendance,
    namedCandidatePool,
    clubIdToName, clubNameToId,
    candidateCities: exportData.candidate_cities,
    config: exportData.config,
  };
}


