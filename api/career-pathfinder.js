/**
 * SkillGalaxy — AI Career Pathfinder
 * Vercel Serverless Function: POST /api/career-pathfinder
 *
 * Request body: { currentRole: string, dreamRole: string }
 * Response:     { path: object, configured: boolean }
 *
 * Uses Claude to generate a personalized career roadmap with real SkillGalaxy skills.
 * Falls back to template-based paths if ANTHROPIC_API_KEY is not set.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { currentRole = '', dreamRole = '' } = req.body || {};

  if (!currentRole.trim() || !dreamRole.trim()) {
    return res.status(400).json({ error: 'Both currentRole and dreamRole are required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    // Return a template-based fallback path
    return res.status(200).json({
      configured: false,
      path: buildFallbackPath(currentRole, dreamRole),
    });
  }

  const MAX_ROLE_LENGTH = 200;
  const sanitizedCurrent = currentRole.slice(0, MAX_ROLE_LENGTH);
  const sanitizedDream = dreamRole.slice(0, MAX_ROLE_LENGTH);

  const prompt = `You are a career advisor for SkillGalaxy, a skill marketplace with 10,000+ AI skill files.

A user wants to transition from "${sanitizedCurrent}" to "${sanitizedDream}".

Generate a personalized career roadmap as a JSON object with this EXACT structure:
{
  "title": "From [Current] to [Dream]",
  "summary": "A 1-2 sentence inspiring summary of this journey",
  "totalMonths": 6,
  "phases": [
    {
      "name": "Phase name (e.g. Foundation Building)",
      "month": "Month 1-2",
      "duration": "2 months",
      "icon": "emoji",
      "description": "What the user will learn and accomplish",
      "skills": [
        {
          "name": "Skill Name",
          "category": "one of: ai-ml, dev, cloud, data, security, blockchain, product, creative, business, quantum, robotics, spatial, bio, climate, education, writing",
          "difficulty": "beginner|intermediate|advanced|expert",
          "reason": "Why this skill matters for the transition"
        }
      ],
      "milestone": "What the user can do after completing this phase"
    }
  ],
  "finalAdvice": "A motivational closing note about reaching the dream role"
}

Rules:
1. Create exactly 4-5 phases
2. Each phase should have 2-4 skills
3. Skills should use categories from: ai-ml, dev, cloud, data, security, blockchain, product, creative, business, quantum, robotics, spatial, bio, climate, education, writing
4. Make the journey realistic and actionable
5. Skills should progress from foundational to advanced
6. Include at least one AI/ML skill since these are AI skill files
7. Total journey should be 4-8 months
8. Be specific — not generic. Reference real tools, frameworks, and methodologies

Return ONLY the raw JSON object. No explanation, no markdown code fences.`;

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
        max_tokens: 2500,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      return res.status(200).json({
        configured: true,
        path: buildFallbackPath(sanitizedCurrent, sanitizedDream),
        error: 'AI service temporarily unavailable — showing template path',
      });
    }

    const data = await response.json();
    let text = (data?.content?.[0]?.text || '').trim();

    // Strip markdown fences if present
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

    let path;
    try {
      path = JSON.parse(text);
    } catch {
      return res.status(200).json({
        configured: true,
        path: buildFallbackPath(sanitizedCurrent, sanitizedDream),
        error: 'Could not parse AI response — showing template path',
      });
    }

    // Validate structure
    if (!path.phases || !Array.isArray(path.phases) || path.phases.length === 0) {
      return res.status(200).json({
        configured: true,
        path: buildFallbackPath(sanitizedCurrent, sanitizedDream),
        error: 'Invalid path structure — showing template path',
      });
    }

    return res.status(200).json({
      configured: true,
      path,
    });
  } catch (err) {
    console.error('career-pathfinder error:', err);
    return res.status(200).json({
      configured: true,
      path: buildFallbackPath(sanitizedCurrent, sanitizedDream),
      error: err.message,
    });
  }
}

/**
 * Build a template-based career path when no API key is available.
 */
function buildFallbackPath(currentRole, dreamRole) {
  return {
    title: `From ${currentRole} to ${dreamRole}`,
    summary: `A structured journey to transform your career from ${currentRole} to ${dreamRole}, leveraging AI-powered skill files to accelerate your learning.`,
    totalMonths: 6,
    phases: [
      {
        name: 'Foundation & Mindset',
        month: 'Month 1',
        duration: '1 month',
        icon: '🧱',
        description: 'Build the core mental models and foundational knowledge needed for your new role. Identify gaps between your current expertise and target requirements.',
        skills: [
          { name: 'Technical Writing', category: 'writing', difficulty: 'beginner', reason: 'Clear communication is essential in any role transition' },
          { name: 'Problem Solving Frameworks', category: 'business', difficulty: 'beginner', reason: 'Structured thinking accelerates learning in new domains' },
        ],
        milestone: 'You understand the landscape and have a clear learning roadmap',
      },
      {
        name: 'Core Skills Acquisition',
        month: 'Month 2-3',
        duration: '2 months',
        icon: '⚡',
        description: 'Dive deep into the primary technical skills required for your dream role. Focus on hands-on practice and building small projects.',
        skills: [
          { name: 'Python Development', category: 'dev', difficulty: 'intermediate', reason: 'Python is the lingua franca of modern tech roles' },
          { name: 'AI/ML Fundamentals', category: 'ai-ml', difficulty: 'intermediate', reason: 'AI skills are essential for any modern technical role' },
          { name: 'Cloud Basics', category: 'cloud', difficulty: 'beginner', reason: 'Cloud infrastructure underpins modern applications' },
        ],
        milestone: 'You can build small projects using core technologies',
      },
      {
        name: 'Specialization & Depth',
        month: 'Month 3-4',
        duration: '2 months',
        icon: '🎯',
        description: 'Specialize in the specific tools and methodologies used daily in your dream role. Build portfolio-worthy projects.',
        skills: [
          { name: 'Data Analysis', category: 'data', difficulty: 'intermediate', reason: 'Data-driven decision making is valued everywhere' },
          { name: 'API Development', category: 'dev', difficulty: 'intermediate', reason: 'Building and consuming APIs is a fundamental skill' },
          { name: 'Security Fundamentals', category: 'security', difficulty: 'beginner', reason: 'Security awareness is critical in every role' },
        ],
        milestone: 'You have 2-3 portfolio projects demonstrating your capabilities',
      },
      {
        name: 'Integration & Launch',
        month: 'Month 5-6',
        duration: '2 months',
        icon: '🚀',
        description: 'Combine all your skills into real-world applications. Network with professionals in your target role. Apply for positions.',
        skills: [
          { name: 'Product Thinking', category: 'product', difficulty: 'intermediate', reason: 'Understanding product development makes you a stronger candidate' },
          { name: 'Interview Preparation', category: 'business', difficulty: 'beginner', reason: 'Targeted preparation maximizes your chances of landing the role' },
        ],
        milestone: 'You\'re ready to apply and interview for your dream role with confidence',
      },
    ],
    finalAdvice: 'Every expert was once a beginner. The fact that you\'re planning this transition shows you already have the most important skill: initiative. Trust the process, celebrate small wins, and remember — the best time to start was yesterday, the second best time is now. 🌟',
  };
}
