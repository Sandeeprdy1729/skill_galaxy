/**
 * SkillGalaxy — AI Skill Validator
 * Vercel Serverless Function: POST /api/validate-skill
 *
 * Request body: { name, description, md_content }
 * Response:     { score: 1-10, feedback: string, approved: boolean, configured: boolean }
 *
 * Setup: add ANTHROPIC_API_KEY to your Vercel project environment variables.
 * Without the key the endpoint returns { configured: false } and the UI
 * skips the AI score step gracefully.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name = '', description = '', md_content = '' } = req.body || {};
  if (!md_content) return res.status(400).json({ error: 'Missing md_content' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ score: null, feedback: null, approved: null, configured: false });
  }

  const prompt = `You are reviewing a Claude skill file for quality. Score it 1–10 and give 1–2 sentences of actionable feedback.

Skill name: ${name.slice(0, 100)}
Description: ${description.slice(0, 300)}

Skill file (first 2500 chars):
${md_content.slice(0, 2500)}

Scoring criteria:
- 8–10: Clear role definition, specific trigger phrases, concrete actionable instructions, good structure
- 5–7: Decent content but missing specific triggers or instructions are too generic
- 1–4: Vague, too short, no clear purpose, or basically just a description

Respond ONLY with valid JSON (no markdown, no extra text):
{"score": <integer 1-10>, "feedback": "<1-2 sentences>", "approved": <true if score >= 6>}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-20240307',
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', response.status, errText);
      return res.status(200).json({ score: null, feedback: null, approved: null, configured: true, error: 'AI service error' });
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text || '';

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*?\}/);
      result = match ? JSON.parse(match[0]) : null;
    }

    if (!result || typeof result.score !== 'number') {
      return res.status(200).json({ score: null, feedback: null, approved: null, configured: true, error: 'Could not parse AI response' });
    }

    return res.status(200).json({
      score:      Math.max(1, Math.min(10, Math.round(result.score))),
      feedback:   String(result.feedback || '').slice(0, 400),
      approved:   result.approved !== false && result.score >= 6,
      configured: true,
    });
  } catch (err) {
    console.error('Validator error:', err);
    return res.status(200).json({ score: null, feedback: null, approved: null, configured: true, error: err.message });
  }
}
