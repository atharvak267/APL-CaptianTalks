// ============================================================
// Captain Talks — Supabase Client Module
// ============================================================

let supabaseClient = null;

/**
 * Initialize the Supabase client with user credentials.
 */
export function initSupabase(url, key) {
  if (!url || !key) return null;
  try {
    const { createClient } = window.supabase;
    supabaseClient = createClient(url, key);
    console.log('[Supabase] Client initialized');
    return supabaseClient;
  } catch (err) {
    console.error('[Supabase] Init failed:', err);
    return null;
  }
}

export function getClient() {
  return supabaseClient;
}

export function isConnected() {
  return supabaseClient !== null;
}

// ── Match Sessions ──────────────────────────────────────────

export async function createSession(matchState, persona) {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient
    .from('match_sessions')
    .insert({
      team_batting: matchState.teamBatting,
      team_bowling: matchState.teamBowling,
      venue: matchState.venue,
      innings: matchState.innings,
      match_context: matchState,
      captain_persona: persona
    })
    .select()
    .single();
  if (error) { console.error('[Supabase] createSession:', error); return null; }
  return data;
}

export async function listSessions(limit = 20) {
  if (!supabaseClient) return [];
  const { data, error } = await supabaseClient
    .from('match_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('[Supabase] listSessions:', error); return []; }
  return data || [];
}

// ── AI Decisions ────────────────────────────────────────────

export async function saveDecision(sessionId, matchState, decision) {
  if (!supabaseClient || !sessionId) return null;
  const { data, error } = await supabaseClient
    .from('ai_decisions')
    .insert({
      session_id: sessionId,
      match_state: matchState,
      decision: decision.decision,
      reasoning: decision.reasoning,
      decision_type: decision.decisionType,
      field_placement: decision.fieldPlacement
    })
    .select()
    .single();
  if (error) { console.error('[Supabase] saveDecision:', error); return null; }
  return data;
}

// ── Chat Messages ───────────────────────────────────────────

export async function saveChatMessage(sessionId, role, content) {
  if (!supabaseClient || !sessionId) return null;
  const { data, error } = await supabaseClient
    .from('chat_messages')
    .insert({ session_id: sessionId, role, content })
    .select()
    .single();
  if (error) { console.error('[Supabase] saveChatMessage:', error); return null; }
  return data;
}

export async function loadChatHistory(sessionId) {
  if (!supabaseClient || !sessionId) return [];
  const { data, error } = await supabaseClient
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) { console.error('[Supabase] loadChatHistory:', error); return []; }
  return data || [];
}
