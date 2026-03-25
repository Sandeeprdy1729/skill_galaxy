/**
 * SkillGalaxy — AI Semantic Search / Recommend Skills
 * Vercel Serverless Function: POST /api/recommend-skills
 *
 * Request body: { query: string, skillSummaries: [{id, name, desc, cat, tags}][] }
 * Response:     { recommendations: [{id, name, reason}][], configured: boolean }
 *
 * Uses Claude to rank skills by relevance to the user's natural-language query.
 * Falls back gracefully if ANTHROPIC_API_KEY is not set.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { query = '', skillSummaries = [] } = req.body || {};
  if (!query.trim()) return res.status(400).json({ error: 'Missing query' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ recommendations: [], configured: false });
  }

  // Limit to 200 skills to keep prompt manageable
  const sample = skillSummaries.slice(0, 200);

  const skillList = sample.map((s, i) =>
    `${i + 1}. id="${s.id}" | "${s.name}" [${s.cat}] — ${(s.desc || '').slice(0, 120)}`
  ).join('\n');

  const prompt = `You are a skill recommender for SkillGalaxy, a Claude skills marketplace.

User query: "${query.slice(0, 500)}"

Available skills:
${skillList}

Pick the 3 best skills for this query. Return ONLY valid JSON (no markdown):
[
  {"id": "<skill_id>", "name": "<skill_name>", "reason": "<one sentence why>"},
  {"id": "<skill_id>", "name": "<skill_name>", "reason": "<one sentence why>"},
  {"id": "<skill_id>", "name": "<skill_name>", "reason": "<one sentence why>"}
]`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-20240307',
        max_tokens: 512,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      return res.status(200).json({ recommendations: [], configured: true, error: 'AI service error' });
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text || '';

    let recommendations;
    try {
      recommendations = JSON.parse(text);
    } catch {
      const match = text.match(/\[[\s\S]*?\]/);
      recommendations = match ? JSON.parse(match[0]) : [];
    }

    if (!Array.isArray(recommendations)) recommendations = [];

    return res.status(200).json({
      configured:      true,
      recommendations: recommendations.slice(0, 3).map(r => ({
        id:     String(r.id || ''),
        name:   String(r.name || '').slice(0, 80),
        reason: String(r.reason || '').slice(0, 200),
      })),
    });
  } catch (err) {
    console.error('recommend-skills error:', err);
    return res.status(200).json({ recommendations: [], configured: true, error: err.message });
  }
}
