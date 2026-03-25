/**
 * SkillGalaxy — SkillForge: AI Skill Generator
 * Vercel Serverless Function: POST /api/skillforge
 *
 * Request body: { description: string, category?: string, difficulty?: string }
 * Response:     { md: string, name: string, configured: boolean }
 *
 * Uses Claude to generate a production-quality .md skill file from a description.
 * Falls back gracefully if ANTHROPIC_API_KEY is not set.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { description = '', category = 'ai', difficulty = 'intermediate' } = req.body || {};
  if (!description.trim()) return res.status(400).json({ error: 'Missing description' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ md: null, name: null, configured: false });
  }

  const prompt = `You are SkillForge, an expert Claude skill file generator. Create a production-quality skill file based on the user's request.

User request: "${description.slice(0, 600)}"
Category: ${category}
Difficulty: ${difficulty}

Generate a complete, high-quality .md skill file with proper YAML frontmatter.

Requirements:
1. Start with ---YAML frontmatter--- containing: name (kebab-case), description, tags (comma list), difficulty, time_to_master, trigger, version: 1.0.0
2. Include a clear role definition (who Claude becomes when this skill activates)
3. Include 3-5 specific trigger phrases / scenarios
4. Include step-by-step instructions Claude should follow
5. Include output format examples
6. Be specific and actionable, not generic
7. Minimum 300 words of actual skill content (not counting frontmatter)

Return ONLY the raw .md file content, starting with ---. No explanation, no markdown code fences.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-5',
        max_tokens: 2000,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      return res.status(200).json({ md: null, name: null, configured: true, error: 'AI service error' });
    }

    const data = await response.json();
    let md = (data?.content?.[0]?.text || '').trim();

    // Ensure starts with frontmatter
    if (!md.startsWith('---')) {
      md = '---\n' + md;
    }

    // Extract name from frontmatter for the response
    const nameMatch = md.match(/^---[\s\S]*?^name:\s*(.+)$/m);
    const name = nameMatch ? nameMatch[1].trim().replace(/^['"]|['"]$/g, '') : 'generated-skill';

    return res.status(200).json({
      configured: true,
      md:         md.slice(0, 20000),
      name:       name.slice(0, 80),
    });
  } catch (err) {
    console.error('skillforge error:', err);
    return res.status(200).json({ md: null, name: null, configured: true, error: err.message });
  }
}
