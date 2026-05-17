// ============================================================
// Captain Talks — Main Application Logic
// ============================================================

import { initGemini, getDecision, chatWithCaptain, generateMatchState, simulateOver } from './gemini.js';
import { initSupabase, isConnected, createSession, saveDecision, saveChatMessage } from './supabase.js';

// ── State ───────────────────────────────────────────────────

const state = {
  persona: 'auto',
  sessionId: null,
  chatHistory: [],
  matchState: null,
  isLoading: false,
  isChatLoading: false,
  strategyLog: [],
  ballLog: [],
  isSimulating: false,
};

// No hardcoded API key — users enter their own via Settings ⚙️

// ── Presets ──────────────────────────────────────────────────

const PRESETS = {
  'death-chase': {
    teamBatting: 'CSK', teamBowling: 'MI', runs: '142', wickets: '4', overs: '16.2',
    innings: '2', target: '185', batsman1: 'Jadeja', batsman1Runs: '38',
    batsman2: 'Dhoni', batsman2Runs: '12', lastBowler: 'Archer',
    availableBowlers: 'Bumrah (1ov), Archer (1ov), Pandya (2ov), Pollard (1ov)',
    venue: 'Wankhede Stadium', pitchCondition: 'Batting Friendly', dew: 'Heavy',
    recentOvers: '14, 8, 12, 6', extras: 'Jadeja just hit Archer for a six over long-on. Dew is making it hard to grip.',
  },
  'powerplay-collapse': {
    teamBatting: 'RCB', teamBowling: 'KKR', runs: '22', wickets: '3', overs: '3.4',
    innings: '1', batsman1: 'Maxwell', batsman1Runs: '4',
    batsman2: 'Patidar', batsman2Runs: '8', lastBowler: 'Starc',
    availableBowlers: 'Starc (1ov left in PP), Narine (4ov), Varun (4ov), Rana (2ov), Russell (3ov)',
    venue: 'Eden Gardens', pitchCondition: 'Pace Friendly', dew: 'None',
    recentOvers: '4, 2, 10', extras: 'New ball is seaming. Top 3 back in pavilion. Maxwell looks edgy.',
  },
  'middle-stall': {
    teamBatting: 'GT', teamBowling: 'SRH', runs: '55', wickets: '1', overs: '8.0',
    innings: '1', batsman1: 'Gill', batsman1Runs: '32',
    batsman2: 'Sudharsan', batsman2Runs: '15', lastBowler: 'Bhuvneshwar',
    availableBowlers: 'Natarajan (3ov), Bhuvneshwar (2ov), Markram (2ov), Sundar (4ov), Abbott (4ov)',
    venue: 'Narendra Modi Stadium', pitchCondition: 'Balanced', dew: 'None',
    recentOvers: '5, 7, 6, 8, 4', extras: 'Run rate dropping. Gill playing dots against spin. Need to accelerate.',
  },
  'last-over': {
    teamBatting: 'DC', teamBowling: 'RR', runs: '172', wickets: '6', overs: '19.0',
    innings: '2', target: '186', batsman1: 'Axar', batsman1Runs: '22',
    batsman2: 'Kuldeep', batsman2Runs: '3', lastBowler: 'Boult',
    availableBowlers: 'Sandeep Sharma (to bowl 20th)',
    venue: 'Arun Jaitley Stadium', pitchCondition: 'Batting Friendly', dew: 'Light',
    recentOvers: '18, 9, 14, 11', extras: '14 needed off 6 balls. Axar is hot. Kuldeep can bat a bit. Sandeep Sharma bowling last over.',
  },
};

// ── DOM References ──────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ── Init ────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  bindEvents();
});

// Keyboard shortcut: Ctrl + , to open Settings
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === ',') {
    e.preventDefault();
    $('#settingsModal').classList.add('open');
  }
  if (e.key === 'Escape') {
    $('#settingsModal').classList.remove('open');
  }
});

function loadSettings() {
  const geminiKey = localStorage.getItem('ct_gemini_key') || '';
  const sbUrl = localStorage.getItem('ct_supabase_url') || '';
  const sbKey = localStorage.getItem('ct_supabase_key') || '';
  const cricketKey = localStorage.getItem('ct_cricket_api_key') || '';

  if (geminiKey) {
    initGemini(geminiKey);
  } else {
    // No key found — prompt user to enter one
    setTimeout(() => {
      $('#settingsModal').classList.add('open');
      showToast('Please enter your Gemini API key to get started 🔑', 'error');
    }, 500);
  }
  if (sbUrl && sbKey) initSupabase(sbUrl, sbKey);

  // Populate settings modal
  $('#geminiKeyInput').value = geminiKey;
  $('#supabaseUrlInput').value = sbUrl;
  $('#supabaseKeyInput').value = sbKey;
  $('#cricketApiKeyInput').value = cricketKey;
}

// ── Event Binding ───────────────────────────────────────────

function bindEvents() {
  // Auto-fetch match data when both teams are selected
  $('#teamBatting').addEventListener('change', tryAutoFetch);
  $('#teamBowling').addEventListener('change', tryAutoFetch);

  // Side toggle (Match State / Strategy Log)
  $$('.side-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('active')) return;
      $$('.side-toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.side;
      const views = { matchState: '#viewMatchState', strategyLog: '#viewStrategyLog' };
      // Hide all views
      Object.values(views).forEach(sel => { $(sel).classList.remove('active'); $(sel).style.animation = 'none'; });
      // Force reflow then show target with fresh animation
      const targetView = $(views[target]);
      void targetView.offsetHeight;
      targetView.style.animation = '';
      targetView.classList.add('active');
    });
  });

  // Settings modal
  $('#settingsBtn').addEventListener('click', () => $('#settingsModal').classList.add('open'));
  $('#modalCancelBtn').addEventListener('click', () => $('#settingsModal').classList.remove('open'));
  $('#settingsModal').addEventListener('click', (e) => { if (e.target === $('#settingsModal')) $('#settingsModal').classList.remove('open'); });
  $('#modalSaveBtn').addEventListener('click', saveSettings);

  // Simulate Next Over button
  $('#bbbSimulateBtn').addEventListener('click', handleSimulateOver);

  // Innings toggle
  $('#innings').addEventListener('change', (e) => {
    const is2nd = e.target.value === '2';
    $('#targetGroup').style.display = is2nd ? 'block' : 'none';
    $('#inningsBadge').textContent = is2nd ? '2nd Innings' : '1st Innings';
  });

  // Match form submit
  $('#matchForm').addEventListener('submit', handleGetDecision);

  // Presets
  $$('.preset-chip').forEach(chip => {
    chip.addEventListener('click', () => applyPreset(chip.dataset.preset));
  });

  // Chat
  $('#chatSendBtn').addEventListener('click', handleChatSend);
  $('#chatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend(); } });

  // Mobile tabs
  $$('#mobileTabs button').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('#mobileTabs button').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      $$('.panel').forEach(p => p.classList.add('hidden'));
      $(`[data-panel="${tab.dataset.tab}"]`).classList.remove('hidden');
    });
  });
}

// ── Auto-Fetch Match Data ────────────────────────────────────

// IPL team short-name → full-name mapping for matching API data
const TEAM_NAMES = {
  CSK: ['Chennai Super Kings', 'Chennai', 'CSK'],
  MI:  ['Mumbai Indians', 'Mumbai', 'MI'],
  RCB: ['Royal Challengers Bengaluru', 'Royal Challengers Bangalore', 'Bengaluru', 'Bangalore', 'RCB'],
  KKR: ['Kolkata Knight Riders', 'Kolkata', 'KKR'],
  DC:  ['Delhi Capitals', 'Delhi', 'DC'],
  PBKS:['Punjab Kings', 'Punjab', 'PBKS', 'KXIP'],
  RR:  ['Rajasthan Royals', 'Rajasthan', 'RR'],
  SRH: ['Sunrisers Hyderabad', 'Hyderabad', 'SRH'],
  GT:  ['Gujarat Titans', 'Gujarat', 'GT'],
  LSG: ['Lucknow Super Giants', 'Lucknow', 'LSG'],
};

function teamMatches(apiTeamName, shortCode) {
  const aliases = TEAM_NAMES[shortCode] || [];
  const lower = apiTeamName.toLowerCase();
  return aliases.some(a => lower.includes(a.toLowerCase()));
}

async function tryAutoFetch() {
  const teamBatting = $('#teamBatting').value;
  const teamBowling = $('#teamBowling').value;
  if (!teamBatting || !teamBowling) return;
  if (teamBatting === teamBowling) {
    showFetchStatus('Same team selected for both — pick different teams', true);
    return;
  }

  const cricketApiKey = localStorage.getItem('ct_cricket_api_key') || '';

  if (cricketApiKey) {
    // Try live data first
    showFetchStatus('<div class="fetch-spinner"></div> Fetching live match data for ' + teamBatting + ' vs ' + teamBowling + '...');
    try {
      const liveData = await fetchLiveMatchData(cricketApiKey, teamBatting, teamBowling);
      if (liveData) {
        populateFormFromAI(liveData);
        showFetchStatus('🟢 Live match data loaded — ' + teamBatting + ' vs ' + teamBowling);
        setTimeout(() => { $('#fetchStatus').innerHTML = ''; }, 5000);
        autoTriggerDecision();
        return;
      }
      // No live match found — fall through to Gemini
      showFetchStatus('<div class="fetch-spinner"></div> No live match found. Generating scenario with AI...');
    } catch (err) {
      console.error('[LiveFetch]', err);
      showFetchStatus('<div class="fetch-spinner"></div> Live API error. Generating scenario with AI...');
    }
  } else {
    showFetchStatus('<div class="fetch-spinner"></div> Generating match state for ' + teamBatting + ' vs ' + teamBowling + '...');
  }

  // Fallback to Gemini-generated data
  try {
    const data = await generateMatchState(teamBatting, teamBowling);
    populateFormFromAI(data);
    const label = cricketApiKey ? '🤖 AI-generated scenario (no live match found)' : '🤖 AI-generated scenario — add CricketData API key in ⚙️ for live data';
    showFetchStatus(label);
    setTimeout(() => { $('#fetchStatus').innerHTML = ''; }, 5000);
    autoTriggerDecision();
  } catch (err) {
    console.error('[AutoFetch]', err);
    showFetchStatus('⚠️ ' + formatApiError(err), true);
  }
}

// Auto-trigger the Captain's Decision after form is populated
function autoTriggerDecision() {
  if (state.isLoading) return;
  // Small delay so the user sees the populated form briefly before the decision fires
  setTimeout(() => {
    $('#matchForm').dispatchEvent(new Event('submit', { cancelable: true }));
  }, 600);
}

// ── CricketData.org Live API ────────────────────────────────

async function fetchLiveMatchData(apiKey, teamBatting, teamBowling) {
  const url = `https://api.cricapi.com/v1/currentMatches?apikey=${apiKey}&offset=0`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`API returned ${resp.status}`);
  const json = await resp.json();

  if (json.status !== 'success' || !json.data) {
    throw new Error(json.info || 'API error');
  }

  // Find matching match between the two teams
  const match = json.data.find(m => {
    if (!m.teams || m.teams.length < 2) return false;
    if (m.matchEnded) return false; // skip finished matches
    const t0 = m.teams[0], t1 = m.teams[1];
    const hasTeam1 = teamMatches(t0, teamBatting) || teamMatches(t1, teamBatting);
    const hasTeam2 = teamMatches(t0, teamBowling) || teamMatches(t1, teamBowling);
    return hasTeam1 && hasTeam2;
  });

  if (!match) return null;

  // Parse score data from the match
  return parseLiveMatch(match, teamBatting, teamBowling);
}

function parseLiveMatch(match, teamBatting, teamBowling) {
  const result = {
    runs: 0, wickets: 0, overs: '0', innings: 1,
    target: null, batsman1: '', batsman1Runs: 0,
    batsman2: '', batsman2Runs: 0, lastBowler: '',
    availableBowlers: '', venue: '', pitchCondition: '',
    dew: 'None', recentOvers: '', extras: '',
  };

  // Venue
  result.venue = match.venue || '';

  // Status as context
  result.extras = match.status || '';

  // Parse score array — find the innings matching the batting team
  if (match.score && match.score.length > 0) {
    // Determine innings count
    result.innings = match.score.length >= 2 ? 2 : 1;

    // Find the batting team's current innings score (last entry for that team)
    let battingScore = null;
    let bowlingScore = null;
    for (const s of match.score) {
      const inningStr = (s.inning || '').toLowerCase();
      if (TEAM_NAMES[teamBatting]?.some(a => inningStr.includes(a.toLowerCase()))) {
        battingScore = s;
      }
      if (TEAM_NAMES[teamBowling]?.some(a => inningStr.includes(a.toLowerCase()))) {
        bowlingScore = s;
      }
    }

    if (battingScore) {
      result.runs = battingScore.r ?? 0;
      result.wickets = battingScore.w ?? 0;
      result.overs = String(battingScore.o ?? 0);
    }

    // If 2nd innings, the bowling team's score is the target
    if (result.innings === 2 && bowlingScore) {
      result.target = (bowlingScore.r ?? 0) + 1;
    }
  }

  // Extract batsman/bowler names from match data if available
  if (match.batsman && match.batsman.length > 0) {
    const b1 = match.batsman[0];
    result.batsman1 = b1.name || b1.batName || '';
    result.batsman1Runs = b1.r ?? b1.runs ?? 0;
    if (match.batsman.length > 1) {
      const b2 = match.batsman[1];
      result.batsman2 = b2.name || b2.batName || '';
      result.batsman2Runs = b2.r ?? b2.runs ?? 0;
    }
  }

  if (match.bowler && match.bowler.length > 0) {
    const bw = match.bowler[0];
    result.lastBowler = bw.name || bw.bowlName || '';
  }

  return result;
}

function showFetchStatus(msg, isError = false) {
  const el = $('#fetchStatus');
  el.innerHTML = `<div class="fetch-status-inner${isError ? ' error' : ''}">${msg}</div>`;
}

function populateFormFromAI(data) {
  if (data.runs != null) $('#runs').value = data.runs;
  if (data.wickets != null) $('#wickets').value = data.wickets;
  if (data.overs) $('#overs').value = data.overs;

  if (data.innings) {
    $('#innings').value = data.innings;
    const is2nd = data.innings === 2;
    $('#targetGroup').style.display = is2nd ? 'block' : 'none';
    $('#inningsBadge').textContent = is2nd ? '2nd Innings' : '1st Innings';
    if (is2nd && data.target) $('#target').value = data.target;
  }

  if (data.batsman1) $('#batsman1').value = data.batsman1;
  if (data.batsman1Runs != null) $('#batsman1Runs').value = data.batsman1Runs;
  if (data.batsman2) $('#batsman2').value = data.batsman2;
  if (data.batsman2Runs != null) $('#batsman2Runs').value = data.batsman2Runs;
  if (data.lastBowler) $('#lastBowler').value = data.lastBowler;
  if (data.availableBowlers) $('#availableBowlers').value = data.availableBowlers;

  // Set venue if it matches an option
  if (data.venue) {
    const venueSelect = $('#venue');
    const match = [...venueSelect.options].find(o => o.value && data.venue.includes(o.value.split(' ')[0]));
    if (match) venueSelect.value = match.value;
  }

  // Set pitch condition
  if (data.pitchCondition) {
    const pitchSelect = $('#pitchCondition');
    const match = [...pitchSelect.options].find(o => o.value === data.pitchCondition);
    if (match) pitchSelect.value = match.value;
  }

  if (data.dew) $('#dew').value = data.dew;
  if (data.recentOvers) $('#recentOvers').value = data.recentOvers;
  if (data.extras) $('#extras').value = data.extras;
}

// ── Presets ──────────────────────────────────────────────────

function applyPreset(key) {
  const p = PRESETS[key];
  if (!p) return;
  Object.entries(p).forEach(([k, v]) => {
    const el = $(`#${k}`);
    if (el) { el.value = v; el.dispatchEvent(new Event('change')); }
  });
  showToast('Preset loaded!', 'success');
}

// ── Get Decision ────────────────────────────────────────────

async function handleGetDecision(e) {
  e.preventDefault();
  if (state.isLoading) return;

  const matchState = gatherMatchState();
  if (!matchState.teamBatting || !matchState.teamBowling) {
    showToast('Please select batting and bowling teams', 'error');
    return;
  }

  state.matchState = matchState;
  state.isLoading = true;
  $('#getDecisionBtn').disabled = true;
  showLoadingState();

  try {
    const decision = await getDecision(matchState, state.persona);
    renderDecision(decision);
    addToStrategyLog(decision, matchState);
    showToast('Captain has spoken! 🏏', 'success');

    // Show ball-by-ball section (user clicks to simulate)
    $('#bbbSection').style.display = 'block';

    // Save to Supabase if connected
    if (isConnected()) {
      if (!state.sessionId) {
        const session = await createSession(matchState, state.persona);
        if (session) state.sessionId = session.id;
      }
      if (state.sessionId) await saveDecision(state.sessionId, matchState, decision);
    }
  } catch (err) {
    console.error(err);
    const friendly = formatApiError(err);
    showToast(friendly, 'error');
    $('#decisionBody').innerHTML = `<div class="decision-empty"><div class="icon">⚠️</div><p>${friendly}</p></div>`;
  } finally {
    state.isLoading = false;
    $('#getDecisionBtn').disabled = false;
  }
}

function gatherMatchState() {
  return {
    teamBatting: $('#teamBatting').value,
    teamBowling: $('#teamBowling').value,
    runs: $('#runs').value || '0',
    wickets: $('#wickets').value || '0',
    overs: $('#overs').value || '0',
    innings: parseInt($('#innings').value),
    target: $('#target').value || '',
    batsman1: $('#batsman1').value || 'Unknown',
    batsman1Runs: $('#batsman1Runs').value || '0',
    batsman2: $('#batsman2').value || 'Unknown',
    batsman2Runs: $('#batsman2Runs').value || '0',
    lastBowler: $('#lastBowler').value || '',
    availableBowlers: $('#availableBowlers').value || '',
    venue: $('#venue').value || '',
    pitchCondition: $('#pitchCondition').value || '',
    dew: $('#dew').value || 'None',
    recentOvers: $('#recentOvers').value || '',
    extras: $('#extras').value || '',
  };
}

// ── Render Decision ─────────────────────────────────────────

function showLoadingState() {
  $('#decisionBody').innerHTML = `
    <div class="loading-state">
      <div class="loading-ball"></div>
      <div class="loading-text">Captain is analyzing the situation...</div>
    </div>`;
}

function renderDecision(d) {
  let html = '';

  // Main Decision Card
  html += `
    <div class="decision-card card-decision" style="animation-delay:.1s">
      <div class="card-badge badge-decision">🎯 Decision — ${d.decisionType || 'tactical'}</div>
      <div class="card-title">${escHtml(d.decision || 'No decision available')}</div>
    </div>`;

  // Field Placement
  if (d.fieldPlacement && d.fieldPlacement.length > 0) {
    html += `
    <div class="decision-card card-field" style="animation-delay:.25s">
      <div class="card-badge badge-field">📍 Field Placement</div>
      <ul class="field-list">${d.fieldPlacement.map(p => `<li>${escHtml(p)}</li>`).join('')}</ul>
    </div>`;
  }

  // Reasoning
  if (d.reasoning) {
    html += `
    <div class="decision-card card-reasoning" style="animation-delay:.4s">
      <div class="card-badge badge-reasoning">🧠 Reasoning</div>
      <div class="card-text">${escHtml(d.reasoning)}</div>
    </div>`;
  }

  // Risk Assessment
  if (d.riskLevel) {
    const riskColors = { low: '🟢', medium: '🟡', high: '🔴' };
    html += `
    <div class="decision-card card-risk" style="animation-delay:.55s">
      <div class="card-badge badge-risk">⚡ Risk: ${riskColors[d.riskLevel] || '🟡'} ${d.riskLevel}</div>
      ${d.alternativeOption ? `<div class="card-text"><strong>Plan B:</strong> ${escHtml(d.alternativeOption)}</div>` : ''}
    </div>`;
  }

  $('#decisionBody').innerHTML = html;
}

// ── Strategy Log ──────────────────────────────────────────────

function getPhaseLabel(overs) {
  const o = parseFloat(overs) || 0;
  if (o <= 6) return 'POWERPLAY';
  if (o <= 15) return 'MIDDLE';
  return 'DEATH';
}

function addToStrategyLog(decision, matchState) {
  const entry = {
    id: Date.now(),
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    overs: matchState.overs || '?',
    score: `${matchState.runs}/${matchState.wickets}`,
    teams: `${matchState.teamBatting} vs ${matchState.teamBowling}`,
    phase: getPhaseLabel(matchState.overs),
    decision: decision.decision || 'N/A',
    decisionType: decision.decisionType || 'combined',
    reasoning: decision.reasoning || '',
    riskLevel: decision.riskLevel || 'medium',
  };

  state.strategyLog.unshift(entry);
  renderStrategyLog();
}

function renderStrategyLog() {
  const log = state.strategyLog;

  // Update stats
  $('#slogCallCount').textContent = log.length;
  if (log.length > 0) {
    $('#slogPhase').textContent = log[0].phase;
  }

  // Render entries
  const container = $('#slogEntries');
  if (log.length === 0) {
    container.innerHTML = `<div class="slog-empty" id="slogEmpty"><div class="icon">📊</div><p>No strategy calls yet. Get a Captain's Decision to start building the log.</p></div>`;
    return;
  }

  const riskIcons = { low: '🟢', medium: '🟡', high: '🔴' };

  container.innerHTML = log.map((e, i) => `
    <div class="slog-entry" style="animation-delay:${i * .06}s">
      <div class="slog-entry-head">
        <span class="slog-over">OV ${escHtml(e.overs)}</span>
        <span class="slog-type">${escHtml(e.decisionType)}</span>
        <span class="slog-time">${e.score} • ${e.time}</span>
      </div>
      <div class="slog-decision">${escHtml(e.decision)}</div>
      ${e.reasoning ? `<div class="slog-reasoning">${escHtml(e.reasoning).substring(0, 120)}${e.reasoning.length > 120 ? '...' : ''}</div>` : ''}
      <span class="slog-risk ${e.riskLevel}">${riskIcons[e.riskLevel] || '🟡'} ${e.riskLevel} risk</span>
      ${e.balls && e.balls.length ? renderSlogBalls(e.balls) : ''}
    </div>
  `).join('');
}

function renderSlogBalls(balls) {
  return `<div class="slog-ball-group" style="margin-top:10px">
    ${balls.map((b, i) => {
      const cls = getOutcomeClass(b.outcome);
      return `<div class="slog-ball-mini" style="animation-delay:${i * .08}s">
        <span class="bbb-ball-num">${escHtml(b.over || '')}</span>
        <span class="bbb-outcome ${cls}">${escHtml(b.outcome)}</span>
        <span class="slog-ball-mini-tactic">${escHtml(b.tactic || b.commentary || '')}</span>
      </div>`;
    }).join('')}
  </div>`;
}

// ── Ball-by-Ball Simulation ─────────────────────────────────

function getOutcomeClass(outcome) {
  const o = (outcome || '').toUpperCase();
  if (o === 'DOT' || o === '0') return 'out-dot';
  if (o === '4' || o === 'FOUR') return 'out-4';
  if (o === '6' || o === 'SIX') return 'out-6';
  if (o === 'WICKET' || o === 'W' || o === 'OUT') return 'out-W';
  if (o === 'WIDE' || o === 'NO BALL' || o === 'LEG BYE') return 'out-extra';
  return 'out-runs';
}

function getBallCardClass(outcome) {
  const o = (outcome || '').toUpperCase();
  if (o === 'WICKET' || o === 'W' || o === 'OUT') return 'wicket';
  if (o === '4' || o === '6' || o === 'FOUR' || o === 'SIX') return 'boundary';
  if (o === 'DOT' || o === '0') return 'dot';
  return 'runs';
}

function autoSimulateOver() {
  if (state.isSimulating) return;
  setTimeout(() => handleSimulateOver(), 800);
}

async function handleSimulateOver() {
  if (!state.matchState || state.isSimulating) return;
  state.isSimulating = true;
  const btn = $('#bbbSimulateBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Simulating...';

  const timeline = $('#bbbTimeline');
  timeline.innerHTML = '<div class="bbb-loading"><div class="fetch-spinner"></div> Simulating ball-by-ball...</div>';

  try {
    const balls = await simulateOver(state.matchState);
    if (!balls.length) throw new Error('No balls returned');

    // Update over label
    const firstBall = balls[0];
    const overNum = firstBall.over ? firstBall.over.split('.')[0] : '?';
    $('#bbbOverLabel').textContent = `Over ${overNum}`;

    // Render balls one by one with staggered animation
    timeline.innerHTML = '';
    balls.forEach((b, i) => {
      const cardClass = getBallCardClass(b.outcome);
      const outcomeClass = getOutcomeClass(b.outcome);
      const html = `
        <div class="bbb-ball ${cardClass}" style="animation-delay:${i * .15}s">
          <div class="bbb-ball-head">
            <span class="bbb-ball-num">${escHtml(b.over || `?.${b.ball}`)}</span>
            <span class="bbb-outcome ${outcomeClass}">${escHtml(b.outcome)}</span>
            <span class="bbb-players">${escHtml(b.bowler || '')} → ${escHtml(b.batsman || '')}</span>
            <span class="bbb-score">${escHtml(b.scoreAfter || '')}</span>
          </div>
          <div class="bbb-commentary">${escHtml(b.commentary || '')}</div>
          <div class="bbb-tactic">🧠 ${escHtml(b.tactic || '')}</div>
        </div>`;
      timeline.insertAdjacentHTML('beforeend', html);
    });

    // Add balls to strategy log
    state.ballLog.push(...balls);
    if (state.strategyLog.length > 0) {
      state.strategyLog[0].balls = balls;
    }
    $('#slogBalls').textContent = state.ballLog.length;
    renderStrategyLog();

    // Update the match state form with the last ball's score
    const lastBall = balls[balls.length - 1];
    if (lastBall.scoreAfter) {
      const parts = lastBall.scoreAfter.split('/');
      if (parts.length === 2) {
        $('#runs').value = parts[0];
        $('#wickets').value = parts[1];
      }
    }
    if (lastBall.over) {
      const o = parseFloat(lastBall.over);
      $('#overs').value = (Math.floor(o) + 1).toString();
    }

  } catch (err) {
    console.error('[Simulate]', err);
    timeline.innerHTML = `<div class="bbb-loading" style="color:var(--red)">⚠️ ${formatApiError(err)}</div>`;
  } finally {
    state.isSimulating = false;
    btn.disabled = false;
    btn.textContent = '▶ Simulate Next Over';
  }
}

// ── Chat ────────────────────────────────────────────────────

async function handleChatSend() {
  const input = $('#chatInput');
  const msg = input.value.trim();
  if (!msg || state.isChatLoading) return;

  input.value = '';
  state.isChatLoading = true;
  $('#chatSendBtn').disabled = true;

  // Remove empty state
  const empty = $('#chatEmpty');
  if (empty) empty.remove();

  // Add user bubble
  appendChatBubble('user', msg);
  state.chatHistory.push({ role: 'user', content: msg });

  // Show typing indicator
  const typing = document.createElement('div');
  typing.className = 'chat-typing';
  typing.id = 'typingIndicator';
  typing.innerHTML = '<span></span><span></span><span></span>';
  $('#chatMessages').appendChild(typing);
  scrollChat();

  try {
    const reply = await chatWithCaptain(msg, state.chatHistory, state.persona, state.matchState);
    typing.remove();
    appendChatBubble('assistant', reply);
    state.chatHistory.push({ role: 'assistant', content: reply });

    // Save to Supabase
    if (isConnected() && state.sessionId) {
      await saveChatMessage(state.sessionId, 'user', msg);
      await saveChatMessage(state.sessionId, 'assistant', reply);
    }
  } catch (err) {
    typing.remove();
    appendChatBubble('assistant', `⚠️ ${err.message}`);
  } finally {
    state.isChatLoading = false;
    $('#chatSendBtn').disabled = false;
    $('#chatInput').focus();
  }
}

function appendChatBubble(role, content) {
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}`;

  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const label = role === 'user' ? 'You' : '🏏 Captain';

  bubble.innerHTML = `${escHtml(content)}<div class="msg-meta">${label} · ${time}</div>`;
  $('#chatMessages').appendChild(bubble);
  scrollChat();
}

function scrollChat() {
  const el = $('#chatMessages');
  el.scrollTop = el.scrollHeight;
}

// ── Settings ────────────────────────────────────────────────

function saveSettings() {
  const geminiKey = $('#geminiKeyInput').value.trim();
  const sbUrl = $('#supabaseUrlInput').value.trim();
  const sbKey = $('#supabaseKeyInput').value.trim();
  const cricketKey = $('#cricketApiKeyInput').value.trim();

  if (geminiKey) {
    localStorage.setItem('ct_gemini_key', geminiKey);
    initGemini(geminiKey);
  }
  if (cricketKey) {
    localStorage.setItem('ct_cricket_api_key', cricketKey);
  } else {
    localStorage.removeItem('ct_cricket_api_key');
  }
  if (sbUrl && sbKey) {
    localStorage.setItem('ct_supabase_url', sbUrl);
    localStorage.setItem('ct_supabase_key', sbKey);
    initSupabase(sbUrl, sbKey);
  }

  $('#settingsModal').classList.remove('open');
  showToast('Settings saved! ✅', 'success');
}

// ── Helpers ─────────────────────────────────────────────────

function updatePersonaBadge() {
  $('#personaBadge').textContent = '🤖 AI Captain';
}

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showToast(msg, type = 'success') {
  const toast = $('#toast');
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function formatApiError(err) {
  const msg = err?.message || String(err);
  if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
    return 'Rate limit reached — Gemini free tier allows 20 requests/min. Please wait ~60s and try again.';
  }
  if (msg.includes('API key')) {
    return 'Invalid or missing API key — press Ctrl+, to open Settings.';
  }
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return 'Network error — check your internet connection.';
  }
  return msg.length > 150 ? msg.substring(0, 150) + '...' : msg;
}
