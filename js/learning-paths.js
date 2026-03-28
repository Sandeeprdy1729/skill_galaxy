/**
 * SkillGalaxy — learning-paths.js
 * Curated Learning Paths with progress tracking (localStorage).
 * No AI API required — all data is hardcoded.
 */

/* ── LEARNING PATH DEFINITIONS ──────────────────────── */
const LEARNING_PATHS = [
  {
    id: 'ai-engineer-6mo',
    name: 'Become an AI Engineer',
    icon: '🤖',
    timeline: '6 months',
    tagline: 'From fundamentals to deploying production ML models.',
    desc: 'A structured 6-month path covering Python, math foundations, machine learning, deep learning, NLP, computer vision, and deployment. Designed for developers transitioning into AI.',
    cat: 'ai',
    diff: 'intermediate',
    steps: [
      { month: 1, title: 'Foundations', skills: ['python', 'numpy', 'pandas', 'linear-algebra', 'statistics'], desc: 'Build fluency in Python data stack and math fundamentals.' },
      { month: 2, title: 'Machine Learning Core', skills: ['supervised-learning', 'unsupervised-learning', 'feature-engineering', 'scikit-learn', 'data-preprocessing'], desc: 'Master classical ML algorithms and data pipelines.' },
      { month: 3, title: 'Deep Learning', skills: ['neural-networks', 'pytorch', 'tensorflow', 'gradient-descent', 'backpropagation'], desc: 'Understand neural architectures and train deep models.' },
      { month: 4, title: 'NLP & LLMs', skills: ['nlp', 'transformers', 'bert', 'gpt', 'prompt-engineering'], desc: 'Work with language models, fine-tuning, and prompt design.' },
      { month: 5, title: 'Computer Vision', skills: ['computer-vision', 'cnn', 'image-classification', 'object-detection', 'opencv'], desc: 'Image processing, CNNs, and visual recognition systems.' },
      { month: 6, title: 'Deployment & MLOps', skills: ['mlops', 'docker', 'kubernetes', 'model-serving', 'monitoring'], desc: 'Put models into production with CI/CD and monitoring.' },
    ]
  },
  {
    id: 'fullstack-to-devops',
    name: 'Full-Stack → DevOps Transition',
    icon: '🔄',
    timeline: '4 months',
    tagline: 'Level up from app developer to infrastructure engineer.',
    desc: 'A 4-month plan to transition from full-stack development into DevOps/SRE. Covers Linux, containers, CI/CD, infrastructure-as-code, cloud platforms, and observability.',
    cat: 'cloud',
    diff: 'advanced',
    steps: [
      { month: 1, title: 'Linux & Networking', skills: ['linux', 'bash-scripting', 'networking', 'dns', 'tcp-ip'], desc: 'Master the OS and networking fundamentals that power every server.' },
      { month: 2, title: 'Containers & Orchestration', skills: ['docker', 'kubernetes', 'container-security', 'helm', 'service-mesh'], desc: 'Containerize apps, orchestrate with K8s, manage deployments.' },
      { month: 3, title: 'CI/CD & IaC', skills: ['github-actions', 'terraform', 'ansible', 'jenkins', 'gitops'], desc: 'Automate builds, deployments, and infrastructure provisioning.' },
      { month: 4, title: 'Cloud & Observability', skills: ['aws', 'azure', 'prometheus', 'grafana', 'site-reliability-engineering'], desc: 'Deploy to cloud, implement monitoring, alerting, and incident response.' },
    ]
  },
  {
    id: 'cybersec-specialist',
    name: 'Cybersecurity Specialist',
    icon: '🛡️',
    timeline: '5 months',
    tagline: 'Learn to defend systems, find vulnerabilities, and respond to incidents.',
    desc: 'From security fundamentals to advanced penetration testing and incident response. Covers network security, web application security, cryptography, compliance, and threat hunting.',
    cat: 'security',
    diff: 'advanced',
    steps: [
      { month: 1, title: 'Security Foundations', skills: ['network-security', 'cryptography', 'linux-security', 'security-architecture', 'risk-management'], desc: 'Understand core security principles, threat models, and risk frameworks.' },
      { month: 2, title: 'Web & App Security', skills: ['web-application-security', 'owasp-top-10', 'sql-injection', 'xss-prevention', 'api-security'], desc: 'Find and fix vulnerabilities in web applications and APIs.' },
      { month: 3, title: 'Penetration Testing', skills: ['penetration-testing', 'vulnerability-assessment', 'metasploit', 'burp-suite', 'nmap'], desc: 'Learn offensive security tools and methodologies.' },
      { month: 4, title: 'Defense & Monitoring', skills: ['siem', 'intrusion-detection', 'threat-hunting', 'incident-response', 'forensics'], desc: 'Build detection pipelines, respond to incidents, and conduct forensics.' },
      { month: 5, title: 'Compliance & Cloud Security', skills: ['cloud-security', 'devsecops', 'compliance', 'zero-trust', 'identity-management'], desc: 'Secure cloud infrastructure and meet regulatory requirements.' },
    ]
  },
  {
    id: 'data-engineer-path',
    name: 'Data Engineering Mastery',
    icon: '📊',
    timeline: '4 months',
    tagline: 'Build robust data pipelines that power analytics and ML.',
    desc: 'Learn to design, build, and maintain data infrastructure. Covers SQL, ETL/ELT, data warehousing, streaming, data quality, and governance.',
    cat: 'data',
    diff: 'intermediate',
    steps: [
      { month: 1, title: 'SQL & Databases', skills: ['sql', 'postgresql', 'data-modeling', 'database-design', 'query-optimization'], desc: 'Master relational databases, advanced SQL, and schema design.' },
      { month: 2, title: 'ETL & Pipelines', skills: ['apache-airflow', 'data-pipelines', 'python', 'data-transformation', 'dbt'], desc: 'Build automated data workflows with modern orchestration tools.' },
      { month: 3, title: 'Big Data & Streaming', skills: ['apache-spark', 'apache-kafka', 'real-time-processing', 'data-lakes', 'parquet'], desc: 'Process massive datasets and build real-time streaming pipelines.' },
      { month: 4, title: 'Data Quality & Governance', skills: ['data-quality', 'data-governance', 'data-catalog', 'data-lineage', 'great-expectations'], desc: 'Ensure data reliability, compliance, and discoverability.' },
    ]
  },
  {
    id: 'blockchain-builder',
    name: 'Blockchain Developer',
    icon: '⛓️',
    timeline: '4 months',
    tagline: 'Build decentralized apps from smart contracts to DeFi.',
    desc: 'Learn blockchain development from fundamentals to deploying production dApps. Covers Ethereum, Solidity, smart contracts, DeFi, NFTs, and security.',
    cat: 'blockchain',
    diff: 'advanced',
    steps: [
      { month: 1, title: 'Blockchain Fundamentals', skills: ['blockchain', 'ethereum', 'consensus-mechanisms', 'cryptography', 'web3'], desc: 'Understand how blockchains work, consensus, and the Web3 ecosystem.' },
      { month: 2, title: 'Smart Contracts', skills: ['solidity', 'hardhat', 'smart-contract-development', 'erc-20', 'erc-721'], desc: 'Write, test, and deploy smart contracts on Ethereum.' },
      { month: 3, title: 'DeFi & dApps', skills: ['defi', 'decentralized-exchanges', 'lending-protocols', 'react', 'ethers-js'], desc: 'Build decentralized applications with frontend integration.' },
      { month: 4, title: 'Security & Advanced', skills: ['smart-contract-security', 'gas-optimization', 'upgradeable-contracts', 'layer-2', 'cross-chain'], desc: 'Audit contracts, optimize gas, and build cross-chain solutions.' },
    ]
  },
  {
    id: 'product-manager-path',
    name: 'Product Management Mastery',
    icon: '📋',
    timeline: '3 months',
    tagline: 'From feature prioritization to shipping products users love.',
    desc: 'A structured path for aspiring or junior PMs. Covers user research, roadmapping, analytics, go-to-market strategy, and stakeholder management.',
    cat: 'product',
    diff: 'intermediate',
    steps: [
      { month: 1, title: 'Discovery & Research', skills: ['user-research', 'market-analysis', 'competitive-analysis', 'customer-interviews', 'persona-development'], desc: 'Understand users, markets, and opportunities.' },
      { month: 2, title: 'Strategy & Execution', skills: ['product-strategy', 'roadmapping', 'prioritization', 'agile', 'scrum'], desc: 'Plan roadmaps, prioritize features, and ship iteratively.' },
      { month: 3, title: 'Growth & Analytics', skills: ['product-analytics', 'a-b-testing', 'growth-hacking', 'go-to-market', 'metrics'], desc: 'Measure success, run experiments, and drive growth.' },
    ]
  },
];

/* ── PROGRESS PERSISTENCE (localStorage) ─────────── */
const LP_STORAGE_KEY = 'sg-learning-progress';

function getLearningProgress() {
  try { return JSON.parse(localStorage.getItem(LP_STORAGE_KEY) || '{}'); }
  catch(e) { return {}; }
}

function saveLearningProgress(progress) {
  localStorage.setItem(LP_STORAGE_KEY, JSON.stringify(progress));
}

function toggleSkillComplete(pathId, skillId) {
  const progress = getLearningProgress();
  if (!progress[pathId]) progress[pathId] = { completed: [], startedAt: new Date().toISOString() };
  const idx = progress[pathId].completed.indexOf(skillId);
  if (idx >= 0) progress[pathId].completed.splice(idx, 1);
  else progress[pathId].completed.push(skillId);
  saveLearningProgress(progress);
  return progress;
}

function getPathProgress(pathId) {
  const progress = getLearningProgress();
  const pathData = progress[pathId] || { completed: [] };
  const path = LEARNING_PATHS.find(p => p.id === pathId);
  if (!path) return { percent: 0, completed: 0, total: 0 };
  const totalSkills = path.steps.reduce((s, step) => s + step.skills.length, 0);
  return {
    percent: totalSkills > 0 ? Math.round((pathData.completed.length / totalSkills) * 100) : 0,
    completed: pathData.completed.length,
    total: totalSkills,
    startedAt: pathData.startedAt,
    completedSkills: pathData.completed || [],
  };
}

/* ── RENDER LEARNING PATHS SECTION ───────────────── */
function showLearningPaths() {
  // Hide bundles/grid, show paths
  document.getElementById('bundlesSection').style.display = 'none';
  document.getElementById('skillsGrid').style.display = 'none';
  document.getElementById('diffPills').style.display = 'none';
  document.querySelector('.sec-row')?.style.setProperty('display', 'none');
  document.getElementById('uploadSection').style.display = 'none';

  let section = document.getElementById('learningPathsSection');
  if (!section) {
    section = document.createElement('div');
    section.id = 'learningPathsSection';
    const content = document.querySelector('.content');
    const diffPills = document.getElementById('diffPills');
    content.insertBefore(section, diffPills);
  }
  section.style.display = 'block';

  section.innerHTML = `
    <div class="sec-row" style="margin-bottom:14px">
      <div class="sec-label">📋 Learning Paths <span class="sec-count">${LEARNING_PATHS.length}</span></div>
      <button onclick="hideLearningPaths()" style="background:none;border:none;color:var(--text-ter);cursor:pointer;font-size:.72rem">← Back to all skills</button>
    </div>
    <div style="font-size:.8rem;color:var(--text-sec);margin-bottom:18px;line-height:1.6">
      Structured learning journeys with step-by-step skill progressions. Track your progress — data stays in your browser.
    </div>
    <div class="lp-grid">${LEARNING_PATHS.map(renderPathCard).join('')}</div>
  `;
}

function hideLearningPaths() {
  const section = document.getElementById('learningPathsSection');
  if (section) section.style.display = 'none';
  document.getElementById('skillsGrid').style.display = '';
  document.getElementById('diffPills').style.display = '';
  document.querySelectorAll('.sec-row').forEach(el => el.style.display = '');
  document.getElementById('uploadSection').style.display = '';
}

function renderPathCard(path) {
  const prog = getPathProgress(path.id);
  const c = (typeof CATEGORIES !== 'undefined' && CATEGORIES[path.cat]) || { tag:'#f0e4d8', tagText:'#c07b4a', dot:'#c07b4a' };
  const catLabel = (typeof CATEGORIES !== 'undefined' && CATEGORIES[path.cat]?.label) || path.cat;
  const totalSkills = path.steps.reduce((s, step) => s + step.skills.length, 0);

  return `
  <div class="lp-card" onclick="openLearningPath('${path.id}')">
    <div class="lp-card-head">
      <span class="lp-icon">${path.icon}</span>
      <div class="lp-card-meta">
        <span class="card-tag" style="background:${c.tag};color:${c.tagText}">${esc(catLabel)}</span>
        <span class="diff-badge ${esc(path.diff)}">${esc(path.diff)}</span>
      </div>
    </div>
    <div class="lp-card-name">${esc(path.name)}</div>
    <div class="lp-card-tagline">${esc(path.tagline)}</div>
    <div class="lp-card-info">
      <span>⏱ ${esc(path.timeline)}</span>
      <span>📚 ${totalSkills} skills</span>
      <span>${path.steps.length} phases</span>
    </div>
    ${prog.completed > 0 ? `
    <div class="lp-progress-bar">
      <div class="lp-progress-fill" style="width:${prog.percent}%"></div>
    </div>
    <div class="lp-progress-text">${prog.percent}% complete · ${prog.completed}/${prog.total} skills</div>
    ` : ''}
  </div>`;
}

/* ── OPEN LEARNING PATH DETAIL ───────────────────── */
function openLearningPath(pathId) {
  const path = LEARNING_PATHS.find(p => p.id === pathId);
  if (!path) return;
  const prog = getPathProgress(pathId);
  const c = (typeof CATEGORIES !== 'undefined' && CATEGORIES[path.cat]) || { tag:'#f0e4d8', tagText:'#c07b4a' };
  const catLabel = (typeof CATEGORIES !== 'undefined' && CATEGORIES[path.cat]?.label) || path.cat;
  const totalSkills = path.steps.reduce((s, step) => s + step.skills.length, 0);
  const allSkills = (typeof getAllSkills === 'function') ? getAllSkills() : [];

  const modal = document.getElementById('lpModalBody');
  document.getElementById('lpModalTitle').textContent = path.name;
  document.getElementById('lpModalTagline').textContent = path.tagline;

  modal.innerHTML = `
    <div class="lp-detail-header">
      <div class="lp-detail-icon">${path.icon}</div>
      <div>
        <div class="lp-detail-meta">
          <span class="card-tag" style="background:${c.tag};color:${c.tagText}">${esc(catLabel)}</span>
          <span class="diff-badge ${esc(path.diff)}">${esc(path.diff)}</span>
          <span style="font-size:.72rem;color:var(--text-ter)">⏱ ${esc(path.timeline)}</span>
        </div>
        <p class="modal-desc" style="margin-top:8px">${esc(path.desc)}</p>
      </div>
    </div>

    <div class="lp-overall-progress">
      <div class="lp-progress-bar lp-progress-lg">
        <div class="lp-progress-fill" style="width:${prog.percent}%"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:.72rem;color:var(--text-ter);margin-top:4px">
        <span>${prog.completed}/${prog.total} skills completed</span>
        <span>${prog.percent}%</span>
      </div>
    </div>

    <div class="lp-timeline">
      ${path.steps.map((step, si) => {
        const stepCompleted = step.skills.filter(sk => prog.completedSkills.includes(sk)).length;
        const stepTotal = step.skills.length;
        const stepDone = stepCompleted === stepTotal && stepTotal > 0;
        return `
        <div class="lp-step ${stepDone ? 'lp-step-done' : ''}">
          <div class="lp-step-header">
            <div class="lp-step-marker">${stepDone ? '✓' : si + 1}</div>
            <div class="lp-step-title">
              <strong>Phase ${si + 1}: ${esc(step.title)}</strong>
              <span class="lp-step-month">Month ${step.month}</span>
            </div>
            <span class="lp-step-count">${stepCompleted}/${stepTotal}</span>
          </div>
          <p class="lp-step-desc">${esc(step.desc)}</p>
          <div class="lp-step-skills">
            ${step.skills.map(sk => {
              const match = allSkills.find(s => s.id === sk || s.id.endsWith('-'+sk) || s.name.toLowerCase().replace(/\s+/g,'-') === sk);
              const isDone = prog.completedSkills.includes(sk);
              return `
              <div class="lp-skill-row ${isDone ? 'lp-skill-done' : ''}" data-path="${pathId}" data-skill="${sk}">
                <label class="lp-check" onclick="event.stopPropagation();handleLpToggle('${pathId}','${sk}')">
                  <span class="lp-checkbox ${isDone ? 'checked' : ''}">${isDone ? '✓' : ''}</span>
                </label>
                <span class="lp-skill-name" onclick="${match ? `openDetail('${esc(match.id)}')` : ''}" style="${match ? 'cursor:pointer' : ''}">${match ? esc(match.name) : esc(sk.replace(/-/g,' ').replace(/\\b\\w/g,l=>l.toUpperCase()))}</span>
                ${match ? '<span style="color:var(--text-ter);font-size:.6rem;margin-left:auto">↗ view</span>' : '<span style="color:var(--text-ter);font-size:.6rem;margin-left:auto;font-style:italic">coming soon</span>'}
              </div>`;
            }).join('')}
          </div>
        </div>`;
      }).join('')}
    </div>

    <div class="modal-actions" style="margin-top:20px">
      <button class="btn-ghost" onclick="resetPathProgress('${pathId}')">↺ Reset Progress</button>
      <button class="btn-ghost" onclick="closeLPModal()">Close</button>
    </div>
  `;

  document.getElementById('lpOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function handleLpToggle(pathId, skillId) {
  toggleSkillComplete(pathId, skillId);
  openLearningPath(pathId); // re-render
}

function resetPathProgress(pathId) {
  const progress = getLearningProgress();
  delete progress[pathId];
  saveLearningProgress(progress);
  openLearningPath(pathId);
  toast('Progress reset');
}

function closeLPModal() {
  document.getElementById('lpOverlay')?.classList.remove('open');
  document.body.style.overflow = '';
  // Refresh cards if visible
  const section = document.getElementById('learningPathsSection');
  if (section && section.style.display !== 'none') showLearningPaths();
}
