/**
 * SkillGalaxy — SkillForge Lattice Query
 * Vercel Serverless Function: GET /api/forge?query=...&max_tokens=...
 *
 * Uses the skill graph (edges from skill_graph_edges) to return
 * an optimized subset of skills that minimizes tokens while
 * maximizing relevance × composability.
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { query = '', max_tokens = '2000' } = req.query;
  if (!query.trim()) return res.status(400).json({ error: 'Missing query' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  const safeMaxTokens = Math.min(Math.max(parseInt(max_tokens, 10) || 2000, 500), 10000);

  try {
    // Step 1: Get all skills (with embeddings if available)
    const skillsResp = await fetch(`${supabaseUrl}/rest/v1/skills?select=id,name,description,category,tags,avg_rating,download_count&avg_rating.gt=0&order=avg_rating.desc&limit=200`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });

    if (!skillsResp.ok) throw new Error('Failed to fetch skills');
    const skills = await skillsResp.json();

    if (!skills.length) return res.status(200).json({ skills: [], message: 'No skills found' });

    // Step 2: Score by query similarity (TF-IDF)
    const queryTokens = tokenize(query);
    const scored = skills.map(s => {
      const text = [s.name, s.description, ...(s.tags || [])].join(' ');
      const sim = cosineSim(queryTokens, tokenize(text));
      const tokens = estimateTokens(s);
      return { ...s, _sim: sim, _tokens: tokens };
    });

    scored.sort((a, b) => b._sim - a._sim);
    const candidates = scored.slice(0, 50);

    // Step 3: Fetch graph edges from Supabase
    const candidateIds = candidates.map(c => c.id);
    let graphEdges = [];
    try {
      const edgesResp = await fetch(
        `${supabaseUrl}/rest/v1/rpc/get_skill_edges`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ p_skill_ids: candidateIds }),
        }
      );
      if (edgesResp.ok) graphEdges = await edgesResp.json();
    } catch {
      // Fall back to local graph computation
    }

    // Step 4: Build local graph if needed
    const graph = graphEdges.length > 0
      ? { edges: graphEdges }
      : buildLocalGraph(candidates);

    // Step 5: Monte-Carlo subset selection
    const bestSubset = monteCarloSelect(candidates, graph, queryTokens, safeMaxTokens, 20);

    // Step 6: Calculate metrics
    const totalTokens = bestSubset.reduce((s, sk) => s + sk._tokens, 0);
    const baselineTokens = Math.round(totalTokens * 1.3);
    const tokenSavings = Math.round((1 - totalTokens / baselineTokens) * 100);

    return res.status(200).json({
      query,
      max_tokens: safeMaxTokens,
      skills: bestSubset.map(s => ({
        id: s.id,
        name: s.name,
        category: s.category,
        similarity: Math.round(s._sim * 100) / 100,
        tokens: s._tokens,
      })),
      metrics: {
        total_tokens: totalTokens,
        baseline_tokens: baselineTokens,
        token_savings: `${tokenSavings}%`,
        composite_size: bestSubset.length,
      },
    });
  } catch (err) {
    console.error('forge error:', err);
    return res.status(500).json({ error: err.message });
  }
}

/* ════════════════════════════════════════════════════════════════════
   CORE ALGORITHMS (duplicated from skillforge-compose.js)
   ════════════════════════════════════════════════════════════════════ */

function tokenize(text) {
  const words = (text || '').toLowerCase().replace(/[^a-z0-9\s-]/g, '').split(/\s+/).filter(Boolean);
  const freq = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;
  return freq;
}

function cosineSim(a, b) {
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0, magA = 0, magB = 0;
  for (const k of allKeys) {
    const va = a[k] || 0, vb = b[k] || 0;
    dot  += va * vb;
    magA += va * va;
    magB += vb * vb;
  }
  return (magA === 0 || magB === 0) ? 0 : dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function estimateTokens(skill) {
  if (skill.tokens && skill.tokens > 0) return skill.tokens;
  const text = [skill.name, skill.description, ...(skill.tags || [])].join(' ');
  return Math.max(300, Math.round(text.length / 3.5));
}

function buildLocalGraph(skills) {
  const edges = [];
  for (let i = 0; i < skills.length; i++) {
    for (let j = i + 1; j < skills.length; j++) {
      const a = skills[i], b = skills[j];
      const aTags = new Set((a.tags || []).map(t => t.toLowerCase()));
      const bTags = new Set((b.tags || []).map(t => t.toLowerCase()));
      const shared = [...aTags].filter(t => bTags.has(t));
      if (shared.length === 0 && a.category !== b.category) continue;
      const catBonus = a.category === b.category ? 1.5 : 1.0;
      const synergy = shared.length * 0.3 + catBonus * 0.2;
      const descSim = cosineSim(tokenize(a.description || ''), tokenize(b.description || ''));
      const overlap = Math.min(0.5, descSim * 0.6 + shared.length * 0.05);
      edges.push({ from: a.id, to: b.id, synergy, overlap });
    }
  }
  return { edges };
}

function monteCarloSelect(candidates, graph, queryTokens, maxTokens, simSteps) {
  let bestSubset = [];
  let bestScore = -Infinity;

  for (let step = 0; step < simSteps; step++) {
    const size = Math.min(3 + Math.floor(Math.random() * 6), 8);
    const subset = [];
    const used = new Set();

    // Greedy add high-similarity first
    for (const c of candidates) {
      if (subset.length >= size) break;
      const tokens = subset.reduce((s, sk) => s + (sk._tokens || 500), 0) + c._tokens;
      if (tokens <= maxTokens) {
        subset.push(c);
        used.add(c.id);
      }
    }

    // Monte Carlo: random sampling
    const remaining = candidates.filter(c => !used.has(c.id));
    for (let i = 0; i < Math.min(size, remaining.length); i++) {
      const idx = Math.floor(Math.random() * remaining.length);
      const cand = remaining[idx];
      const tokens = subset.reduce((s, sk) => s + (sk._tokens || 500), 0) + cand._tokens;
      if (tokens <= maxTokens && !used.has(cand.id)) {
        subset.push(cand);
        used.add(cand.id);
      }
    }

    if (!subset.length) continue;

    // Score: relevance - token penalty + synergy bonus
    const avgRel = subset.reduce((s, sk) => s + sk._sim, 0) / subset.length;
    const totalTokens = subset.reduce((s, sk) => s + sk._tokens, 0);
    const tokenPenalty = totalTokens / maxTokens;

    const ids = new Set(subset.map(s => s.id));
    let totalSynergy = 0;
    for (const e of graph.edges) {
      if (ids.has(e.from) && ids.has(e.to)) {
        totalSynergy += e.synergy || 0;
      }
    }

    const score = avgRel * 0.5 + (1 - tokenPenalty) * 0.3 + totalSynergy * 0.2;
    if (score > bestScore) {
      bestScore = score;
      bestSubset = subset;
    }
  }

  return bestSubset.length > 0 ? bestSubset : candidates.slice(0, Math.min(5, candidates.length));
}