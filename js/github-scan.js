/**
 * SkillGalaxy — github-scan.js
 * "Scan My GitHub" — Analyze public repos to suggest skills.
 * Uses GitHub REST API (free, no auth needed for public repos).
 * No AI API required.
 */

/* Language → skill category/tag mappings */
const LANG_TO_SKILLS = {
  'Python':       { cat: 'ai', tags: ['python','data-science','machine-learning','pandas','numpy','flask','django','fastapi'] },
  'JavaScript':   { cat: 'dev', tags: ['javascript','react','nodejs','express','web-development','typescript'] },
  'TypeScript':   { cat: 'dev', tags: ['typescript','react','angular','nodejs','web-development'] },
  'Java':         { cat: 'dev', tags: ['java','spring','microservices','enterprise'] },
  'Go':           { cat: 'cloud', tags: ['go','golang','microservices','kubernetes','docker'] },
  'Rust':         { cat: 'dev', tags: ['rust','systems-programming','performance'] },
  'C++':          { cat: 'dev', tags: ['c++','systems-programming','performance','embedded'] },
  'C#':           { cat: 'dev', tags: ['c#','dotnet','unity','game-development'] },
  'Ruby':         { cat: 'dev', tags: ['ruby','rails','web-development'] },
  'PHP':          { cat: 'dev', tags: ['php','laravel','wordpress','web-development'] },
  'Swift':        { cat: 'dev', tags: ['swift','ios','mobile-development'] },
  'Kotlin':       { cat: 'dev', tags: ['kotlin','android','mobile-development'] },
  'R':            { cat: 'data', tags: ['r','statistics','data-analysis','data-visualization'] },
  'Scala':        { cat: 'data', tags: ['scala','apache-spark','big-data'] },
  'Shell':        { cat: 'cloud', tags: ['bash','linux','devops','scripting'] },
  'Dockerfile':   { cat: 'cloud', tags: ['docker','containers','devops','kubernetes'] },
  'HCL':          { cat: 'cloud', tags: ['terraform','infrastructure-as-code','cloud'] },
  'Solidity':     { cat: 'blockchain', tags: ['solidity','ethereum','smart-contracts','web3'] },
  'Jupyter Notebook': { cat: 'ai', tags: ['data-science','machine-learning','python','jupyter'] },
  'HTML':         { cat: 'dev', tags: ['html','web-development','frontend'] },
  'CSS':          { cat: 'dev', tags: ['css','web-development','frontend','design'] },
  'Dart':         { cat: 'dev', tags: ['dart','flutter','mobile-development'] },
  'Lua':          { cat: 'creative', tags: ['lua','game-development','scripting'] },
  'MATLAB':       { cat: 'data', tags: ['matlab','data-analysis','engineering'] },
  'Julia':        { cat: 'ai', tags: ['julia','scientific-computing','machine-learning'] },
};

/* Topic → skill suggestion mappings */
const TOPIC_SKILLS = {
  'machine-learning': ['supervised-learning','unsupervised-learning','feature-engineering','neural-networks'],
  'deep-learning': ['neural-networks','pytorch','tensorflow','cnn','transformers'],
  'web': ['web-development','html','css','javascript','react'],
  'react': ['react','typescript','frontend','web-development'],
  'vue': ['vue','javascript','frontend','web-development'],
  'angular': ['angular','typescript','frontend'],
  'docker': ['docker','containers','kubernetes','devops'],
  'kubernetes': ['kubernetes','container-orchestration','helm','devops'],
  'terraform': ['terraform','infrastructure-as-code','cloud'],
  'security': ['cybersecurity','penetration-testing','security-architecture'],
  'blockchain': ['blockchain','smart-contracts','ethereum','web3'],
  'data-science': ['data-science','statistics','machine-learning','python'],
  'api': ['api-design','rest-api','graphql','microservices'],
  'testing': ['testing','test-automation','ci-cd','quality-assurance'],
  'devops': ['devops','ci-cd','docker','monitoring','linux'],
  'cloud': ['aws','azure','gcp','cloud-architecture'],
  'mobile': ['mobile-development','react-native','flutter'],
  'game': ['game-development','unity','game-design'],
  'ai': ['artificial-intelligence','machine-learning','nlp','computer-vision'],
  'nlp': ['nlp','transformers','text-classification','sentiment-analysis'],
};

/* GitHub language colors */
const LANG_COLORS = {
  'Python': '#3572A5', 'JavaScript': '#f1e05a', 'TypeScript': '#3178c6',
  'Java': '#b07219', 'Go': '#00ADD8', 'Rust': '#dea584', 'C++': '#f34b7d',
  'C#': '#178600', 'Ruby': '#701516', 'PHP': '#4F5D95', 'Swift': '#F05138',
  'Kotlin': '#A97BFF', 'R': '#198CE7', 'Scala': '#c22d40', 'Shell': '#89e051',
  'Dockerfile': '#384d54', 'HTML': '#e34c26', 'CSS': '#563d7c', 'Dart': '#00B4AB',
  'Solidity': '#AA6746', 'Jupyter Notebook': '#DA5B0B', 'HCL': '#844FBA',
};

function openGitHubScan() {
  document.getElementById('githubScanOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('ghScanResults').style.display = 'none';
  document.getElementById('ghUsername').value = '';
  document.getElementById('ghUsername').focus();
}

function closeGitHubScan() {
  document.getElementById('githubScanOverlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

async function runGitHubScan() {
  const username = document.getElementById('ghUsername').value.trim();
  if (!username) { toast('Please enter a GitHub username', true); return; }

  const btn = document.getElementById('ghScanBtn');
  const resultsDiv = document.getElementById('ghScanResults');
  btn.textContent = '⏳ Scanning…';
  btn.disabled = true;
  resultsDiv.style.display = 'none';

  try {
    // Fetch user's public repos (up to 100)
    const resp = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`);
    if (!resp.ok) {
      if (resp.status === 404) throw new Error('User not found. Check the username.');
      throw new Error('GitHub API error: ' + resp.status);
    }
    const repos = await resp.json();

    if (!repos.length) {
      resultsDiv.style.display = 'block';
      resultsDiv.innerHTML = '<p style="color:var(--text-ter);font-size:.78rem">No public repos found for this user.</p>';
      return;
    }

    // Analyze languages
    const langCounts = {};
    const topics = new Set();
    let totalSize = 0;

    for (const repo of repos) {
      if (repo.language) {
        langCounts[repo.language] = (langCounts[repo.language] || 0) + (repo.size || 1);
        totalSize += repo.size || 1;
      }
      if (repo.topics) repo.topics.forEach(t => topics.add(t));
    }

    // Sort languages by usage
    const sortedLangs = Object.entries(langCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);

    // Find matching skills
    const allSkills = (typeof getAllSkills === 'function') ? getAllSkills() : [];
    const existingSkillTags = new Set();
    const suggestedSkillTags = new Set();

    // Skills user likely already has (from their top languages)
    for (const [lang] of sortedLangs.slice(0, 5)) {
      const mapping = LANG_TO_SKILLS[lang];
      if (mapping) mapping.tags.forEach(t => existingSkillTags.add(t));
    }

    // Skills from their repo topics
    for (const topic of topics) {
      const topicSkills = TOPIC_SKILLS[topic];
      if (topicSkills) topicSkills.forEach(t => existingSkillTags.add(t));
    }

    // Suggested skills to learn (from languages they use less, related fields)
    for (const [lang] of sortedLangs) {
      const mapping = LANG_TO_SKILLS[lang];
      if (mapping) {
        // Suggest skills from the same category they haven't likely used
        const catSkills = allSkills.filter(s => s.cat === mapping.cat);
        for (const s of catSkills.slice(0, 3)) {
          if (!existingSkillTags.has(s.id)) suggestedSkillTags.add(s.id);
        }
      }
    }

    // Find actual skill objects for "you know" section
    const knownSkills = allSkills.filter(s =>
      existingSkillTags.has(s.id) ||
      (s.tags && s.tags.some(t => existingSkillTags.has(t)))
    ).slice(0, 20);

    // Find skills to learn (different from what they know)
    const knownIds = new Set(knownSkills.map(s => s.id));
    const learnSkills = [];

    // Add skills from suggested tags
    for (const tagId of suggestedSkillTags) {
      if (learnSkills.length >= 15) break;
      const s = allSkills.find(x => x.id === tagId);
      if (s && !knownIds.has(s.id)) learnSkills.push(s);
    }

    // Fill up with popular skills from categories the user works in
    if (learnSkills.length < 15) {
      const userCats = new Set();
      for (const [lang] of sortedLangs.slice(0, 3)) {
        const mapping = LANG_TO_SKILLS[lang];
        if (mapping) userCats.add(mapping.cat);
      }
      for (const cat of userCats) {
        const catSkills = allSkills.filter(s => s.cat === cat && !knownIds.has(s.id) && !learnSkills.find(l => l.id === s.id));
        catSkills.sort((a, b) => (b.d || 0) - (a.d || 0));
        for (const s of catSkills.slice(0, 5)) {
          if (learnSkills.length >= 15) break;
          learnSkills.push(s);
        }
      }
    }

    // Render results
    resultsDiv.style.display = 'block';
    resultsDiv.innerHTML = `
      <div class="gh-section">
        <div class="m-lbl">📊 Your Tech Stack (${repos.length} repos analyzed)</div>
        <div class="gh-lang-grid">
          ${sortedLangs.map(([lang, size]) => {
            const pct = Math.round((size / totalSize) * 100);
            const color = LANG_COLORS[lang] || '#999';
            return `<div class="gh-lang-item"><span class="gh-lang-dot" style="background:${color}"></span>${esc(lang)} <span style="color:var(--text-ter);margin-left:auto">${pct}%</span></div>`;
          }).join('')}
        </div>
      </div>

      ${knownSkills.length > 0 ? `
      <div class="gh-section">
        <div class="m-lbl">✅ Skills You Likely Have (${knownSkills.length})</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">
          ${knownSkills.map(s => `<span class="gh-skill-chip" onclick="closeGitHubScan();setTimeout(()=>openDetail('${esc(s.id)}'),200)">${esc(s.name)}</span>`).join('')}
        </div>
      </div>` : ''}

      ${learnSkills.length > 0 ? `
      <div class="gh-section">
        <div class="m-lbl">🚀 Recommended Skills to Learn (${learnSkills.length})</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">
          ${learnSkills.map(s => `<span class="gh-skill-chip learn" onclick="closeGitHubScan();setTimeout(()=>openDetail('${esc(s.id)}'),200)">${esc(s.name)}</span>`).join('')}
        </div>
      </div>` : ''}

      ${topics.size > 0 ? `
      <div class="gh-section">
        <div class="m-lbl">🏷 Detected Topics</div>
        <div style="font-size:.72rem;color:var(--text-sec);line-height:1.8">
          ${Array.from(topics).slice(0, 30).map(t => `<code style="background:var(--cream-dark);padding:2px 6px;border-radius:4px;margin:1px">${esc(t)}</code>`).join(' ')}
        </div>
      </div>` : ''}

      <div style="text-align:center;margin-top:8px">
        <a href="https://github.com/${encodeURIComponent(username)}" target="_blank" rel="noopener" style="font-size:.72rem;color:var(--text-ter)">View ${esc(username)}'s GitHub profile →</a>
      </div>
    `;

  } catch (err) {
    resultsDiv.style.display = 'block';
    resultsDiv.innerHTML = `<p style="color:var(--red);font-size:.78rem">⚠ ${esc(err.message)}</p>`;
  } finally {
    btn.textContent = '🔍 Scan';
    btn.disabled = false;
  }
}
