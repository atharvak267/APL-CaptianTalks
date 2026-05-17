// ============================================================
// Captain Talks — Gemini AI Integration Module
// ============================================================

import { GoogleGenAI } from 'https://esm.run/@google/genai';

let ai = null;
const MODEL = 'gemini-2.5-flash';

// ── Captain Persona Definitions ─────────────────────────────

const PERSONAS = {
  dhoni: {
    name: 'MS Dhoni',
    style: `You channel MS Dhoni — "Captain Cool". Your style:
- Stay ice-cold calm. Never panic, even at 36 needed off 6 balls.
- Trust your instincts and back your bowlers to the hilt.
- Love giving the ball to unlikely heroes in pressure moments.
- Think 3 overs ahead — every decision is a chess move.
- Use phrases like "process over result", "keep it simple", "back yourself".
- Prefer pace at the death, but not afraid to bowl spin in power plays.
- Field placements are sharp — you read the batsman's intent from body language.
- Strategic timeouts are used to break momentum, never out of desperation.
- You speak in short, confident sentences — like a calm mentor.`,
  },

  rohit: {
    name: 'Rohit Sharma',
    style: `You channel Rohit Sharma — "Hitman Captain". Your style:
- Aggressive, instinct-driven captaincy — attack is the best defense.
- Back your bowlers early, rotate aggressively in the middle overs.
- Love attacking field placements — slips in T20s, silly points for spinners.
- Quick bowling changes — if it's not working, yank them off immediately.
- Use phrases like "go for the kill", "put them under pressure", "we don't take a backward step".
- Prefer using spinners in the middle overs as wicket-taking weapons.
- Trust your gut — sometimes bowl yourself or bring unexpected options.
- Strategic timeouts to plan attacking moves, not just defensive regrouping.
- You speak with confident swagger — like a senior pro who's seen it all.`,
  },

  hardik: {
    name: 'Hardik Pandya',
    style: `You channel Hardik Pandya — "Fearless Leader". Your style:
- Lead from the front — you're an all-rounder who backs himself to deliver.
- Unconventional, bold decisions — surprise the opposition.
- Love matchups — study each batter's weaknesses obsessively.
- Not afraid to bowl yourself in crunch overs or promote a lower-order hitter.
- Use phrases like "be fearless", "take the game on", "trust the process", "energy on the field".
- Heavy use of pace variations and slower balls at the death.
- Field placements are fluid — change every ball if needed.
- Impact Player is a tactical weapon — time it perfectly.
- You speak with intensity and energy — like a young captain hungry to prove himself.`,
  },

  auto: {
    name: 'AI Captain',
    style: `You are the ultimate IPL captain AI — combining the best of Dhoni's calm calculation, 
Rohit's aggressive instincts, and Hardik's fearless innovation.
- Analyze the situation objectively using data and cricket intelligence.
- Make bold decisions when the situation demands, conservative when needed.
- Think in terms of matchups, conditions, form, and pressure situations.
- Use authentic cricket commentary language — like a seasoned captain at a press conference.
- You speak with authority and deep cricket knowledge.`,
  },
};

// ── Core System Prompt ──────────────────────────────────────

function buildSystemPrompt(persona) {
  const p = PERSONAS[persona] || PERSONAS.auto;
  return `You are "Captain Talks" — an elite virtual IPL captain AI.

${p.style}

YOUR ROLE:
You analyze the current match situation and make the NEXT tactical decision a real IPL captain would make on the field.

DECISION CATEGORIES:
1. **Bowling**: Who bowls the next over, what lengths/variations to use
2. **Field Placement**: Exactly where to place 9 fielders (positions like fine leg, third man, point, cover, mid-off, mid-on, mid-wicket, square leg, long-on, deep point, etc.)
3. **Batting Order**: If a wicket falls, who should come in next and why
4. **Strategic Timeout**: When to call it (bowling team: overs 6-9, batting team: overs 13-16)
5. **Impact Player**: When to use the substitute — which player and why

IPL 2025 RULES YOU KNOW:
- Impact Player can replace any player from the XI at start of innings, after wicket, or end of over
- Strategic Timeout: bowling team between overs 6-9, batting team between overs 13-16 (2.5 min each)
- Powerplay: Overs 1-6 (max 2 fielders outside 30-yard circle)
- Middle Overs 7-15: max 5 fielders outside circle
- Death Overs 16-20: max 5 fielders outside circle
- DRS covers height-based no-balls and wide reviews
- Saliva is allowed to shine the ball

RESPONSE FORMAT — Return valid JSON (no markdown code fences):
{
  "decision": "One clear sentence stating the tactical decision",
  "decisionType": "bowling|batting|field|timeout|impact_player|combined",
  "reasoning": "2-4 sentences of captain/commentator-style reasoning explaining WHY. Use cricket language, reference specific matchups, conditions, form.",
  "fieldPlacement": ["Position1", "Position2", ...up to 9 positions],
  "riskLevel": "low|medium|high",
  "alternativeOption": "One sentence backup plan if the primary decision doesn't work"
}

Be decisive. Be specific. Name actual field positions. Think like a captain standing at mid-off, reading the game in real-time.`;
}

// ── Chat System Prompt ──────────────────────────────────────

function buildChatSystemPrompt(persona, matchContext) {
  const p = PERSONAS[persona] || PERSONAS.auto;
  const contextStr = matchContext
    ? `\n\nCURRENT MATCH CONTEXT:\n${JSON.stringify(matchContext, null, 2)}`
    : '';

  return `You are "Captain Talks" — an elite virtual IPL captain AI having a conversation about cricket tactics.

${p.style}

You are chatting with a cricket fan or analyst about an ongoing IPL match.${contextStr}

RULES:
- Answer in the character of ${p.name} — use their speaking style and cricket philosophy.
- Reference specific cricket tactics, player matchups, pitch conditions, and IPL strategies.
- Be conversational but insightful — like a captain in a post-match press conference.
- Keep responses concise (2-5 sentences) unless asked for detailed analysis.
- If asked about something outside cricket, redirect to the match discussion.
- Use cricket slang and commentary language naturally.`;
}

// ── Initialize Gemini ───────────────────────────────────────

export function initGemini(apiKey) {
  if (!apiKey) return false;
  try {
    ai = new GoogleGenAI({ apiKey });
    console.log('[Gemini] Initialized');
    return true;
  } catch (err) {
    console.error('[Gemini] Init failed:', err);
    return false;
  }
}

// ── Get Tactical Decision ───────────────────────────────────

export async function getDecision(matchState, persona = 'auto') {
  if (!ai) throw new Error('Gemini not initialized — add your API key in Settings.');

  const userPrompt = `CURRENT MATCH SITUATION:
- Innings: ${matchState.innings === 1 ? '1st Innings' : '2nd Innings'}
- Batting Team: ${matchState.teamBatting}
- Bowling Team: ${matchState.teamBowling}
- Score: ${matchState.runs}/${matchState.wickets}
- Overs: ${matchState.overs}
- Current Batsmen: ${matchState.batsman1} (${matchState.batsman1Runs || '?'} runs) & ${matchState.batsman2} (${matchState.batsman2Runs || '?'} runs)
- On Strike: ${matchState.onStrike || matchState.batsman1}
- Last Bowler: ${matchState.lastBowler || 'N/A'}
- Available Bowlers: ${matchState.availableBowlers || 'N/A'}
- Recent Over(s): ${matchState.recentOvers || 'N/A'}
- Venue: ${matchState.venue || 'N/A'}
- Pitch: ${matchState.pitchCondition || 'N/A'}
- Dew Factor: ${matchState.dew || 'None'}
- Match Phase: ${getPhase(matchState.overs)}
${matchState.innings === 2 ? `- Target: ${matchState.target}\n- Required Rate: ${calcRRR(matchState)}` : ''}
${matchState.extras ? `- Additional Context: ${matchState.extras}` : ''}

What is your NEXT tactical decision as captain?`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: userPrompt,
    config: {
      systemInstruction: buildSystemPrompt(persona),
      temperature: 0.75,
    },
  });

  const text = response.text.trim();
  return parseDecisionResponse(text);
}

// ── Chat with Captain ───────────────────────────────────────

export async function chatWithCaptain(message, chatHistory, persona = 'auto', matchContext = null) {
  if (!ai) throw new Error('Gemini not initialized — add your API key in Settings.');

  const contents = [];
  for (const msg of chatHistory) {
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    });
  }
  contents.push({ role: 'user', parts: [{ text: message }] });

  const response = await ai.models.generateContent({
    model: MODEL,
    contents,
    config: {
      systemInstruction: buildChatSystemPrompt(persona, matchContext),
      temperature: 0.8,
    },
  });

  return response.text.trim();
}

// ── Helpers ─────────────────────────────────────────────────

function getPhase(overs) {
  const o = parseFloat(overs) || 0;
  if (o <= 6) return 'Powerplay (1-6)';
  if (o <= 15) return 'Middle Overs (7-15)';
  return 'Death Overs (16-20)';
}

function calcRRR(state) {
  const target = parseInt(state.target) || 0;
  const runs = parseInt(state.runs) || 0;
  const overs = parseFloat(state.overs) || 0;
  const remaining = 20 - overs;
  if (remaining <= 0) return 'N/A';
  return ((target - runs) / remaining).toFixed(2);
}

function parseDecisionResponse(text) {
  // Strip markdown code fences if present
  let cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // If JSON parsing fails, return as unstructured
    return {
      decision: cleaned.substring(0, 200),
      decisionType: 'combined',
      reasoning: cleaned,
      fieldPlacement: [],
      riskLevel: 'medium',
      alternativeOption: '',
    };
  }
}

// ── Generate Match State from Teams ─────────────────────────

export async function generateMatchState(teamBatting, teamBowling) {
  if (!ai) throw new Error('Gemini not initialized — add your API key in Settings.');

  const prompt = `You are an IPL match data generator. Generate a realistic LIVE IPL 2025 match state for ${teamBatting} batting against ${teamBowling}.

RULES:
- Use REAL player names from the actual IPL 2025 squads of ${teamBatting} and ${teamBowling}.
- Pick a random match phase (powerplay, middle overs, or death overs).
- Pick a realistic innings (1st or 2nd — if 2nd, include a reasonable target).
- Pick a real IPL venue that is a home ground for either team.
- Make the scenario interesting — not a flat game. Add tension.
- Make sure available bowlers are from the ${teamBowling} squad with realistic overs remaining.

Return ONLY valid JSON with NO markdown fences:
{
  "runs": 120,
  "wickets": 3,
  "overs": "14.3",
  "innings": 1,
  "target": null,
  "batsman1": "Player Name",
  "batsman1Runs": 45,
  "batsman2": "Player Name",
  "batsman2Runs": 12,
  "lastBowler": "Bowler Name",
  "availableBowlers": "Bowler1 (2ov left), Bowler2 (1ov left), Bowler3 (3ov left)",
  "venue": "Stadium Name",
  "pitchCondition": "Batting Friendly",
  "dew": "None",
  "recentOvers": "8, 12, 6, 14",
  "extras": "Brief context about the match situation"
}

pitchCondition must be one of: Batting Friendly, Pace Friendly, Spin Friendly, Balanced, Two-Paced, Slow & Low
dew must be one of: None, Light, Heavy`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { temperature: 0.9 },
  });

  const text = response.text.trim();
  let cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error('Failed to parse match data from AI. Please try again.');
  }
}

// ── Simulate Ball-by-Ball Over ─────────────────────────────

export async function simulateOver(matchState) {
  if (!ai) throw new Error('Gemini not initialized — add your API key in Settings.');

  const prompt = `You are a ball-by-ball IPL match simulator and tactical analyst.

CURRENT MATCH STATE:
- ${matchState.teamBatting} ${matchState.runs}/${matchState.wickets} in ${matchState.overs} overs vs ${matchState.teamBowling}
- Batsmen: ${matchState.batsman1} (${matchState.batsman1Runs || 0}*) & ${matchState.batsman2} (${matchState.batsman2Runs || 0})
- Last Bowler: ${matchState.lastBowler || 'N/A'}
- Venue: ${matchState.venue || 'N/A'}
- Pitch: ${matchState.pitchCondition || 'N/A'}
${matchState.innings == 2 ? `- Target: ${matchState.target}, Need ${(matchState.target || 0) - (matchState.runs || 0)} off ${Math.max(0, (120 - Math.floor(parseFloat(matchState.overs || 0) * 6 + (parseFloat(matchState.overs || 0) % 1) * 10)))} balls` : ''}

Generate 6 balls for the NEXT over. For each ball, simulate a realistic outcome.

Return ONLY valid JSON array with NO markdown fences:
[
  {
    "ball": 1,
    "over": "15.1",
    "bowler": "Bowler Name",
    "batsman": "Batsman Name",
    "delivery": "short of length outside off",
    "outcome": "DOT",
    "runs": 0,
    "commentary": "Tight line, batsman shoulders arms. Good discipline.",
    "tactic": "Building dot-ball pressure, testing the batsman's patience",
    "scoreAfter": "121/3",
    "isWicket": false,
    "isBoundary": false
  },
  ...6 balls total
]

OUTCOME must be one of: DOT, 1, 2, 3, 4, 6, WIDE, NO BALL, WICKET, LEG BYE
Make it DRAMATIC and REALISTIC — include at least one boundary or wicket to keep it interesting.
Each ball's commentary should sound like a real TV commentator.
Each ball's tactic should be a brief captain's tactical thought (1 sentence).
scoreAfter must reflect cumulative score after each ball.`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { temperature: 0.85 },
  });

  const text = response.text.trim();
  let cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    const balls = JSON.parse(cleaned);
    return Array.isArray(balls) ? balls : [];
  } catch {
    throw new Error('Failed to parse ball-by-ball data.');
  }
}
