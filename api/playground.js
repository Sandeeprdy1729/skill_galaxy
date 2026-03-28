/**
 * SkillGalaxy — Live Skill Playground
 * Vercel Serverless Function: POST /api/playground
 *
 * Request body: { message: string, skill_md: string, history?: [{role,content}] }
 * Response:     { reply: string, configured: boolean }
 *
 * Lets users "try" a skill by chatting with Claude with the skill applied.
 * Uses Claude Haiku to keep costs low and response times fast.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { message = '', skill_md = '', history = [] } = req.body || {};

  if (!message.trim()) {
    return res.status(400).json({ error: 'Missing message' });
  }
  if (!skill_md.trim()) {
    return res.status(400).json({ error: 'Missing skill content' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ reply: null, configured: false });
  }

  // Build the system prompt from the skill markdown
  const systemPrompt = `You are Claude with the following skill file applied. Follow the instructions in this skill exactly as specified.

--- SKILL FILE START ---
${skill_md.slice(0, 8000)}
--- SKILL FILE END ---

Important: Apply this skill naturally. Respond as if you always had this expertise. Keep responses concise but thorough (2-4 paragraphs max for this demo). Do NOT mention that you're using a skill file.`;

  // Build conversation history (limit to last 6 messages to control token usage)
  const messages = [];
  const recentHistory = history.slice(-6);
  for (const h of recentHistory) {
    if (h.role === 'user' || h.role === 'assistant') {
      messages.push({ role: h.role, content: String(h.content).slice(0, 1000) });
    }
  }
  messages.push({ role: 'user', content: message.slice(0, 2000) });

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
        max_tokens: 800,
        system:     systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      console.error('Playground API error:', response.status, errText);
      return res.status(200).json({
        reply: null,
        configured: true,
        error: 'AI service temporarily unavailable',
      });
    }

    const data = await response.json();
    const reply = (data?.content?.[0]?.text || '').trim();

    return res.status(200).json({
      configured: true,
      reply: reply.slice(0, 4000),
    });
  } catch (err) {
    console.error('playground error:', err);
    return res.status(200).json({
      reply: null,
      configured: true,
      error: err.message,
    });
  }
}
