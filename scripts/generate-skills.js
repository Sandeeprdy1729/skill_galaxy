#!/usr/bin/env node
/**
 * generate-skills.js
 * Transforms the 10k generic skills database into Anthropic-quality skill entries.
 * 
 * Usage: node scripts/generate-skills.js <input-file> [output-file]
 *   input-file:  path to skills_db_complete.js (10k skills)
 *   output-file: path to output db.js (default: js/db.js)
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ═══════════════════════════════════════════════════════════════
// 1. CATEGORY MAPPING  (138 sub-categories → 16 parent categories)
// ═══════════════════════════════════════════════════════════════
const CAT_MAP = {
  // AI & ML
  ai_ml: 'ai', deep_learning: 'ai', nlp: 'ai', computer_vision: 'ai',
  agentic_ai: 'ai', ai_safety: 'ai', ai_tools_mastery: 'ai',
  prompt_engineering: 'ai', llm_development: 'ai', rag_vector_db: 'ai',
  // Cybersecurity
  cybersecurity: 'security', cloud_security: 'security',
  // Data
  data_engineering: 'data', data_science: 'data', data_analytics: 'data',
  data_visualization: 'data', data_governance: 'data', big_data: 'data',
  statistics: 'data', databases: 'data', network_science: 'data',
  // Cloud & Infra
  cloud_aws: 'cloud', cloud_azure: 'cloud', cloud_gcp: 'cloud',
  devops: 'cloud', networking: 'cloud', hpc: 'cloud', os_systems: 'cloud',
  // Quantum & Physical Sciences
  quantum_computing: 'quantum', quantum_ml: 'quantum',
  astronomy: 'quantum', space_tech: 'quantum', materials_science: 'quantum',
  nanotechnology: 'quantum', physics_simulation: 'quantum',
  // Bio & Health
  computational_biology: 'bio', bioinformatics: 'bio', genomics: 'bio',
  drug_discovery: 'bio', biohacking: 'bio', synthetic_biology: 'bio',
  longevity: 'bio', pharmacology: 'bio', clinical_medicine: 'bio',
  health_informatics: 'bio', health_tech: 'bio', telemedicine: 'bio',
  mental_health: 'bio', nutrition: 'bio', fitness: 'bio',
  public_health: 'bio', neuroscience: 'bio', chemistry_ai: 'bio',
  // Spatial
  ar_vr: 'spatial', '3d_modeling': 'spatial', geospatial: 'spatial',
  // Blockchain & FinTech
  blockchain: 'blockchain', fintech: 'blockchain',
  // Robotics & Embedded
  robotics: 'robotics', autonomous_systems: 'robotics',
  embedded_systems: 'robotics', lab_automation: 'robotics',
  // Climate & Sustainability
  climate_science: 'climate', climate_policy: 'climate',
  green_tech: 'climate', renewable_energy: 'climate',
  circular_economy: 'climate', sustainability: 'climate',
  sustainable_agriculture: 'climate',
  // Product & Strategy
  product_management: 'product', product_analytics: 'product',
  project_management: 'product', consulting: 'product',
  personal_productivity: 'product', future_of_work: 'product',
  // Creative Technology
  animation: 'creative', motion_design: 'creative',
  graphic_design: 'creative', design_systems: 'creative',
  brand_design: 'creative', fashion_design: 'creative',
  interior_design: 'creative', game_design: 'creative',
  game_dev: 'creative', music_production: 'creative',
  video_production: 'creative', photography: 'creative',
  architecture: 'creative',
  // Development
  software_engineering: 'dev', web_frontend: 'dev', web_backend: 'dev',
  mobile_dev: 'dev', api_design: 'dev', testing_qa: 'dev',
  compiler_design: 'dev', no_code_tools: 'dev',
  human_computer_interaction: 'dev', mlops: 'dev',
  indian_tech: 'dev', miscellaneous_skills: 'dev',
  // Writing
  creative_writing: 'writing', academic_writing: 'writing',
  technical_writing: 'writing', copywriting: 'writing',
  journalism: 'writing', translation: 'writing',
  // Business
  business_strategy: 'business', entrepreneurship: 'business',
  ecommerce: 'business', sales: 'business', seo: 'business',
  digital_marketing: 'business', social_media: 'business',
  growth_hacking: 'business', real_estate: 'business',
  supply_chain: 'business', investment: 'business',
  trading_quant: 'business', finance: 'business',
  hr_people: 'business', legal_tech: 'business',
  public_speaking: 'business', community_building: 'business',
  economics: 'business', political_science: 'business',
  // Education & Design
  edtech: 'education', stem_education: 'education',
  curriculum_design: 'education', tutoring: 'education',
  language_learning: 'education', ux_design: 'education',
  sociology: 'education', philosophy: 'education',
  philosophy_ai: 'education', psychology: 'education',
  anthropology: 'education', history_analysis: 'education',
  linguistics: 'education',
};

// ═══════════════════════════════════════════════════════════════
// 2. SUB-CATEGORY ROLE TITLES & MISSIONS
// ═══════════════════════════════════════════════════════════════
const SUB_ROLES = {
  // AI & ML
  ai_ml:               { role: 'Machine Learning Engineer',          mission: 'build predictive models that learn from data and deliver production-ready intelligence' },
  deep_learning:        { role: 'Deep Learning Engineer',            mission: 'architect and train neural networks that solve complex perception and generation tasks' },
  nlp:                  { role: 'NLP Engineer',                      mission: 'extract meaning from text at scale using the best available techniques' },
  computer_vision:      { role: 'Computer Vision Engineer',          mission: 'build systems that give machines the ability to see and understand the visual world' },
  agentic_ai:           { role: 'AI Agent Architect',                mission: 'design autonomous AI systems that plan, reason, and take actions to achieve goals' },
  ai_safety:            { role: 'AI Safety Researcher',              mission: 'ensure AI systems are safe, honest, and aligned with human values' },
  ai_tools_mastery:     { role: 'AI Tools Specialist',               mission: 'leverage AI-powered tools to amplify human capabilities across workflows' },
  prompt_engineering:   { role: 'Prompt Engineer',                   mission: 'craft precise instructions that reliably elicit high-quality AI outputs' },
  llm_development:      { role: 'LLM Engineer',                     mission: 'move from prototype to production-grade language model systems that are reliable and cost-effective' },
  rag_vector_db:        { role: 'RAG Systems Architect',             mission: 'build retrieval-augmented generation systems that ground AI responses in authoritative data' },
  // Cybersecurity
  cybersecurity:        { role: 'Cybersecurity Engineer',            mission: 'protect systems and data from adversaries through defense in depth and proactive security' },
  cloud_security:       { role: 'Cloud Security Architect',          mission: 'design and implement security controls that protect cloud-native infrastructure without blocking velocity' },
  // Data
  data_engineering:     { role: 'Data Engineer',                     mission: 'build robust data pipelines that move, transform, and deliver data reliably at scale' },
  data_science:         { role: 'Data Scientist',                    mission: 'turn raw data into actionable insights and predictive models that drive decisions' },
  data_analytics:       { role: 'Analytics Engineer',                mission: 'transform raw data into clean, tested, documented datasets ready for analysis' },
  data_visualization:   { role: 'Data Visualization Specialist',     mission: 'translate complex data into clear, compelling visual narratives that drive understanding' },
  data_governance:      { role: 'Data Governance Lead',              mission: 'ensure data is trustworthy, discoverable, and used responsibly across the organization' },
  big_data:             { role: 'Big Data Engineer',                 mission: 'process and analyze massive datasets using distributed computing systems' },
  statistics:           { role: 'Statistical Analyst',               mission: 'apply rigorous statistical methods to extract reliable conclusions from data' },
  databases:            { role: 'Database Engineer',                 mission: 'design, optimize, and maintain database systems for performance and reliability' },
  network_science:      { role: 'Network Science Analyst',           mission: 'analyze complex networks to reveal hidden structures, flows, and influence patterns' },
  // Cloud & Infra
  cloud_aws:            { role: 'AWS Solutions Architect',           mission: 'design cost-effective, scalable, and resilient architectures on Amazon Web Services' },
  cloud_azure:          { role: 'Azure Cloud Engineer',              mission: 'build and manage enterprise workloads on Microsoft Azure with high availability' },
  cloud_gcp:            { role: 'GCP Cloud Architect',               mission: 'architect data-intensive and AI-ready solutions on Google Cloud Platform' },
  devops:               { role: 'DevOps Engineer',                   mission: 'automate the path from code commit to production with speed and safety' },
  networking:           { role: 'Network Engineer',                  mission: 'design and maintain network infrastructure for performance, security, and reliability' },
  hpc:                  { role: 'HPC Systems Engineer',              mission: 'optimize high-performance computing clusters for scientific and engineering workloads' },
  os_systems:           { role: 'Systems Engineer',                  mission: 'manage and optimize operating systems and low-level infrastructure for reliability' },
  // Quantum & Physical Sciences
  quantum_computing:    { role: 'Quantum Computing Researcher',      mission: 'develop quantum algorithms and applications that leverage quantum mechanical advantages' },
  quantum_ml:           { role: 'Quantum ML Researcher',             mission: 'explore the intersection of quantum computing and machine learning for novel capabilities' },
  astronomy:            { role: 'Computational Astronomer',          mission: 'analyze astronomical data and simulate celestial phenomena using computational methods' },
  space_tech:           { role: 'Space Technology Engineer',         mission: 'develop systems and technologies for space exploration and satellite operations' },
  materials_science:    { role: 'Computational Materials Scientist', mission: 'discover and design new materials through simulation and data-driven approaches' },
  nanotechnology:       { role: 'Nanotechnology Researcher',        mission: 'engineer materials and devices at the nanoscale for transformative applications' },
  physics_simulation:   { role: 'Computational Physicist',           mission: 'model physical systems through numerical simulation and computational methods' },
  // Bio & Health
  computational_biology:{ role: 'Computational Biologist',           mission: 'apply computational methods to understand biological systems at molecular and cellular scales' },
  bioinformatics:       { role: 'Bioinformatics Engineer',           mission: 'build pipelines that process and analyze biological sequence and structure data' },
  genomics:             { role: 'Genomics Analyst',                  mission: 'analyze genomic data to uncover genetic variations, functions, and disease associations' },
  drug_discovery:       { role: 'Drug Discovery Scientist',          mission: 'accelerate pharmaceutical development through computational screening and molecular modeling' },
  biohacking:           { role: 'Biohacking Specialist',             mission: 'apply DIY biology and self-experimentation principles to optimize human performance' },
  synthetic_biology:    { role: 'Synthetic Biologist',               mission: 'engineer biological systems and organisms for useful purposes using design principles' },
  longevity:            { role: 'Longevity Researcher',              mission: 'investigate aging mechanisms and interventions to extend healthy human lifespan' },
  pharmacology:         { role: 'Pharmacologist',                    mission: 'study drug interactions and mechanisms to optimize therapeutic outcomes' },
  clinical_medicine:    { role: 'Clinical Data Scientist',           mission: 'apply data science to clinical decision-making and healthcare outcome optimization' },
  health_informatics:   { role: 'Health Informatics Specialist',     mission: 'manage and analyze health data systems to improve patient care and outcomes' },
  health_tech:          { role: 'Health Technology Engineer',        mission: 'build technology solutions that improve healthcare delivery and patient outcomes' },
  telemedicine:         { role: 'Telemedicine Solutions Architect',  mission: 'design remote healthcare delivery systems that are accessible and clinically effective' },
  mental_health:        { role: 'Mental Health Tech Specialist',     mission: 'develop technology-driven approaches to mental health assessment and intervention' },
  nutrition:            { role: 'Nutrition Science Analyst',         mission: 'apply evidence-based nutritional science to optimize health outcomes' },
  fitness:              { role: 'Fitness Technology Specialist',     mission: 'leverage technology and data to optimize physical performance and wellness' },
  public_health:        { role: 'Public Health Data Analyst',        mission: 'analyze population health data to inform policy and improve community health outcomes' },
  neuroscience:         { role: 'Computational Neuroscientist',      mission: 'model neural systems and brain function through computational and data-driven approaches' },
  chemistry_ai:         { role: 'Computational Chemist',             mission: 'apply AI and simulation to chemical discovery, reaction prediction, and molecular design' },
  // Spatial
  ar_vr:                { role: 'XR Developer',                      mission: 'build immersive augmented and virtual reality experiences that transform interaction paradigms' },
  '3d_modeling':        { role: '3D Modeling Artist',                mission: 'create detailed three-dimensional models and environments for games, film, and visualization' },
  geospatial:           { role: 'GIS Engineer',                      mission: 'analyze and visualize geographic data to solve spatial problems and inform decisions' },
  // Blockchain & FinTech
  blockchain:           { role: 'Blockchain Engineer',               mission: 'build decentralized applications and smart contracts on distributed ledger platforms' },
  fintech:              { role: 'FinTech Developer',                 mission: 'build financial technology products that modernize payments, lending, and investment' },
  // Robotics & Embedded
  robotics:             { role: 'Robotics Engineer',                 mission: 'design and program robotic systems that perceive, plan, and act in physical environments' },
  autonomous_systems:   { role: 'Autonomous Systems Engineer',       mission: 'build self-governing systems that navigate and operate without human intervention' },
  embedded_systems:     { role: 'Embedded Systems Engineer',         mission: 'develop firmware and hardware interfaces for resource-constrained computing environments' },
  lab_automation:       { role: 'Lab Automation Engineer',           mission: 'automate laboratory workflows to increase throughput, reproducibility, and safety' },
  // Climate & Sustainability
  climate_science:      { role: 'Climate Scientist',                 mission: 'model and analyze climate systems to understand and predict environmental change' },
  climate_policy:       { role: 'Climate Policy Analyst',            mission: 'translate climate science into actionable policy recommendations and regulatory frameworks' },
  green_tech:           { role: 'Green Technology Engineer',         mission: 'develop clean technology solutions that reduce environmental impact at scale' },
  renewable_energy:     { role: 'Renewable Energy Engineer',         mission: 'design and optimize renewable energy systems for maximum efficiency and grid integration' },
  circular_economy:     { role: 'Circular Economy Strategist',       mission: 'redesign products and supply chains to eliminate waste and keep materials in circulation' },
  sustainability:       { role: 'Sustainability Analyst',            mission: 'measure, report, and improve organizational environmental and social impact' },
  sustainable_agriculture:{ role: 'AgTech Specialist',               mission: 'apply technology to make food production more efficient, sustainable, and resilient' },
  // Product & Strategy
  product_management:   { role: 'Product Manager',                   mission: 'discover what to build, align stakeholders, and ship products that customers love' },
  product_analytics:    { role: 'Product Analyst',                   mission: 'turn product usage data into insights that drive feature decisions and growth' },
  project_management:   { role: 'Project Manager',                   mission: 'deliver complex projects on time and within scope through structured planning and execution' },
  consulting:           { role: 'Management Consultant',             mission: 'diagnose business problems and design actionable strategies that create measurable value' },
  personal_productivity:{ role: 'Productivity Specialist',           mission: 'optimize personal and team workflows using systems thinking and the right tools' },
  future_of_work:       { role: 'Future of Work Strategist',         mission: 'prepare organizations for evolving work patterns, AI integration, and distributed teams' },
  // Creative Technology
  animation:            { role: 'Animation Artist',                  mission: 'bring stories and ideas to life through motion, timing, and visual storytelling' },
  motion_design:        { role: 'Motion Designer',                   mission: 'create dynamic visual communications through animation, video, and interactive design' },
  graphic_design:       { role: 'Graphic Designer',                  mission: 'solve communication problems through visual design that is both beautiful and functional' },
  design_systems:       { role: 'Design Systems Lead',               mission: 'build and maintain component libraries and design tokens that scale across products' },
  brand_design:         { role: 'Brand Designer',                    mission: 'create cohesive visual identities that communicate brand values and build recognition' },
  fashion_design:       { role: 'Fashion Designer',                  mission: 'design clothing and accessories that balance aesthetics, function, and market demand' },
  interior_design:      { role: 'Interior Designer',                 mission: 'create functional, beautiful spaces that improve how people live and work' },
  game_design:          { role: 'Game Designer',                     mission: 'craft engaging game mechanics, narratives, and player experiences' },
  game_dev:             { role: 'Game Developer',                    mission: 'build interactive entertainment software with performant real-time graphics and physics' },
  music_production:     { role: 'Music Producer',                    mission: 'compose, arrange, and produce audio that connects emotionally with listeners' },
  video_production:     { role: 'Video Producer',                    mission: 'plan, shoot, and edit video content that communicates stories effectively' },
  photography:          { role: 'Photographer',                      mission: 'capture and process images that tell stories and evoke emotional responses' },
  architecture:         { role: 'Architectural Designer',            mission: 'design buildings and spaces that are structurally sound, aesthetically compelling, and human-centered' },
  // Development
  software_engineering: { role: 'Software Engineer',                 mission: 'design and build reliable software systems that solve real problems and scale with demand' },
  web_frontend:         { role: 'Frontend Engineer',                 mission: 'build fast, accessible, and beautiful web interfaces that delight users' },
  web_backend:          { role: 'Backend Engineer',                  mission: 'design APIs and server systems that are fast, reliable, and secure at scale' },
  mobile_dev:           { role: 'Mobile Developer',                  mission: 'build native and cross-platform mobile applications with great user experiences' },
  api_design:           { role: 'API Architect',                     mission: 'design APIs that are intuitive, consistent, and enable rapid developer adoption' },
  testing_qa:           { role: 'QA Engineer',                       mission: 'ensure software quality through systematic testing strategies and automation' },
  compiler_design:      { role: 'Compiler Engineer',                 mission: 'build language toolchains that parse, analyze, optimize, and generate efficient code' },
  no_code_tools:        { role: 'No-Code Developer',                 mission: 'build functional applications and automations without writing traditional code' },
  human_computer_interaction: { role: 'HCI Researcher',              mission: 'study and improve how humans interact with computing systems' },
  mlops:                { role: 'MLOps Engineer',                    mission: 'bridge the gap between data science notebooks and robust production ML systems' },
  indian_tech:          { role: 'Technology Specialist',             mission: 'apply technology solutions to challenges specific to emerging markets and local contexts' },
  miscellaneous_skills: { role: 'Technology Generalist',             mission: 'apply broad technical knowledge across domains to solve diverse problems' },
  // Writing
  creative_writing:     { role: 'Creative Writer',                   mission: 'craft compelling narratives, prose, and poetry that resonate with readers' },
  academic_writing:     { role: 'Academic Writer',                   mission: 'produce rigorous, well-structured scholarly works that advance knowledge' },
  technical_writing:    { role: 'Technical Writer',                  mission: 'translate complex technical concepts into clear, usable documentation' },
  copywriting:          { role: 'Copywriter',                        mission: 'write persuasive copy that drives action and builds brand voice' },
  journalism:           { role: 'Journalist',                        mission: 'investigate, verify, and report stories that inform the public' },
  translation:          { role: 'Translator',                        mission: 'bridge languages and cultures while preserving meaning, tone, and nuance' },
  // Business
  business_strategy:    { role: 'Business Strategist',               mission: 'analyze markets and competitive dynamics to formulate winning strategies' },
  entrepreneurship:     { role: 'Startup Founder',                   mission: 'build ventures from zero to product-market fit with speed and resourcefulness' },
  ecommerce:            { role: 'E-Commerce Strategist',             mission: 'optimize online retail operations from conversion funnels to fulfillment' },
  sales:                { role: 'Sales Professional',                mission: 'build relationships and close deals through consultative, value-based selling' },
  seo:                  { role: 'SEO Specialist',                    mission: 'improve organic visibility through technical optimization, content strategy, and link building' },
  digital_marketing:    { role: 'Digital Marketer',                  mission: 'drive growth through data-driven campaigns across digital channels' },
  social_media:         { role: 'Social Media Strategist',           mission: 'build engaged audiences and drive brand awareness through social platforms' },
  growth_hacking:       { role: 'Growth Hacker',                     mission: 'find scalable, repeatable channels for user acquisition and retention' },
  real_estate:          { role: 'Real Estate Analyst',               mission: 'analyze property markets and investment opportunities using data-driven methods' },
  supply_chain:         { role: 'Supply Chain Analyst',              mission: 'optimize end-to-end supply chain operations for cost, speed, and resilience' },
  investment:           { role: 'Investment Analyst',                mission: 'evaluate assets and build portfolios using fundamental and quantitative analysis' },
  trading_quant:        { role: 'Quantitative Trader',               mission: 'develop systematic trading strategies using statistical models and algorithmic execution' },
  finance:              { role: 'Financial Analyst',                 mission: 'analyze financial data and build models that inform business and investment decisions' },
  hr_people:            { role: 'HR Specialist',                     mission: 'build people systems that attract, develop, and retain talent effectively' },
  legal_tech:           { role: 'Legal Tech Specialist',             mission: 'apply technology to streamline legal workflows and improve access to justice' },
  public_speaking:      { role: 'Public Speaker',                    mission: 'communicate ideas with clarity, confidence, and impact to any audience' },
  community_building:   { role: 'Community Builder',                 mission: 'create and nurture communities that drive engagement, learning, and collaboration' },
  economics:            { role: 'Economist',                         mission: 'analyze economic systems and policies using quantitative and theoretical frameworks' },
  political_science:    { role: 'Political Analyst',                 mission: 'analyze political systems, policy impacts, and governance structures' },
  // Education & Design
  edtech:               { role: 'EdTech Specialist',                 mission: 'design technology-enhanced learning experiences that improve educational outcomes' },
  stem_education:       { role: 'STEM Educator',                     mission: 'teach science, technology, engineering, and math through hands-on, inquiry-based methods' },
  curriculum_design:    { role: 'Curriculum Designer',               mission: 'design learning experiences that achieve measurable outcomes through structured progression' },
  tutoring:             { role: 'Tutor',                             mission: 'provide personalized instruction that adapts to individual learning styles and needs' },
  language_learning:    { role: 'Language Learning Specialist',      mission: 'facilitate language acquisition through immersive, contextual learning approaches' },
  ux_design:            { role: 'UX Designer',                       mission: 'design user experiences that are intuitive, accessible, and delightful' },
  sociology:            { role: 'Sociologist',                       mission: 'study social structures, institutions, and human behavior patterns' },
  philosophy:           { role: 'Philosopher',                       mission: 'examine fundamental questions about knowledge, reality, ethics, and meaning' },
  philosophy_ai:        { role: 'AI Ethics Philosopher',             mission: 'navigate the ethical dimensions of artificial intelligence and its societal impact' },
  psychology:           { role: 'Psychologist',                      mission: 'understand human cognition, behavior, and emotion through evidence-based methods' },
  anthropology:         { role: 'Anthropologist',                    mission: 'study human cultures, societies, and their development across time and context' },
  history_analysis:     { role: 'Historian',                         mission: 'analyze historical events and patterns to understand the present and inform the future' },
  linguistics:          { role: 'Linguist',                          mission: 'analyze language structure, meaning, and usage across human communication' },
};

// ═══════════════════════════════════════════════════════════════
// 3. PARENT CATEGORY DEFINITIONS
//    Icon, protocol pool (8 options), tone pool (3 options)
// ═══════════════════════════════════════════════════════════════
const PARENT_DEFS = {
  ai: {
    icon: '◎',
    protocols: [
      { t: 'Data First', d: 'Validate data quality, quantity, and distribution before any modeling. Bias in data means bias in results.' },
      { t: 'Baseline Before Complexity', d: 'Start with the simplest model that could work. Add complexity only when metrics justify it.' },
      { t: 'Evaluation-Driven', d: 'Define metrics and evaluation criteria before building. No eval = no progress.' },
      { t: 'Cost Awareness', d: 'Estimate compute, latency, and cost at production scale before committing to an approach.' },
      { t: 'Reproducibility', d: 'Log every experiment with fixed seeds, pinned versions, and tracked data lineage.' },
      { t: 'Deploy Defensively', d: 'Monitor predictions in production. Set alerting thresholds. Plan for model degradation.' },
      { t: 'Privacy by Design', d: 'Data anonymization and access controls from day one, not as an afterthought.' },
      { t: 'Iterate Rapidly', d: 'Short experiment cycles with clear hypotheses. Kill underperforming approaches early.' },
    ],
    tones: [
      'Engineering-focused and pragmatic. Cite specific benchmarks and tradeoffs.',
      'Research-informed but production-oriented. Theory serves practice.',
      'Precise with technical terminology. Quantify claims with metrics.',
    ],
  },
  security: {
    icon: '◬',
    protocols: [
      { t: 'Assume Breach', d: 'Design defenses with the assumption that attackers are already inside the perimeter.' },
      { t: 'Defense in Depth', d: 'No single control is sufficient. Layer security controls across network, application, and data tiers.' },
      { t: 'Least Privilege', d: 'Start with zero access and grant the minimum permissions required for each role.' },
      { t: 'Shift Left', d: 'Integrate security checks early in the development lifecycle, not as a post-deployment afterthought.' },
      { t: 'Automate Detection', d: 'Build automated detection and response pipelines. Manual monitoring does not scale.' },
      { t: 'Threat Model First', d: 'Enumerate attack vectors and failure modes before writing defensive code.' },
      { t: 'Incident Readiness', d: 'Practice incident response before incidents happen. Playbooks, tabletops, and retrospectives.' },
      { t: 'Evidence-Based Security', d: 'Measure security posture with metrics. Prioritize risks by exploitability and business impact.' },
    ],
    tones: [
      'Risk-focused and developer-friendly. Security should enable, not block.',
      'Analytically rigorous and adversary-focused. Think like the attacker.',
      'Methodical and compliance-aware. Document everything.',
    ],
  },
  data: {
    icon: '◷',
    protocols: [
      { t: 'Data Quality First', d: 'Validate, test, and monitor data quality at every stage of the pipeline.' },
      { t: 'Idempotency Always', d: 'Every pipeline run should produce the same result given the same inputs.' },
      { t: 'Schema as Contract', d: 'Define explicit schemas at system boundaries. Breaking changes require versioning.' },
      { t: 'Test Your Data', d: 'Data tests are as important as code tests. Validate freshness, completeness, and accuracy.' },
      { t: 'Document Lineage', d: 'Track where data comes from, how it transforms, and who depends on it.' },
      { t: 'Optimize Last', d: 'Make it correct first, make it fast second. Premature optimization hides bugs.' },
      { t: 'Version Everything', d: 'Version data, schemas, and pipelines. Enable rollback and reproducibility.' },
      { t: 'Monitor Freshness', d: 'Stale data is wrong data. Alert on missing or delayed upstream sources.' },
    ],
    tones: [
      'Methodical and reliability-focused. SQL-first, tool-agnostic thinking.',
      'Pragmatic and systems-oriented. Data quality is a feature, not an afterthought.',
      'Detail-oriented with a bias toward automation and observability.',
    ],
  },
  cloud: {
    icon: '◫',
    protocols: [
      { t: 'Infrastructure as Code', d: 'All infrastructure changes go through version-controlled configuration files, never manual clicks.' },
      { t: 'Design for Failure', d: 'Every component will fail. Build redundancy, circuit breakers, and graceful degradation.' },
      { t: 'Cost Visibility', d: 'Tag resources, set budgets, and review bills monthly. Cloud costs grow silently.' },
      { t: 'Security by Default', d: 'Private subnets, encrypted storage, and least-privilege IAM from the first deploy.' },
      { t: 'Automate Everything', d: 'If you do it twice, automate it. CI/CD, scaling, backups, and incident response.' },
      { t: 'Observe Before Optimizing', d: 'Instrument with metrics, logs, and traces before tuning performance.' },
      { t: 'Limit Blast Radius', d: 'Use accounts, namespaces, and network segmentation to contain failures.' },
      { t: 'Prefer Managed Services', d: 'Use cloud-managed services over self-hosted when operational burden matters more than control.' },
    ],
    tones: [
      'Systems-thinking and reliability-focused. Uptime is the product.',
      'Cost-conscious and automation-first. Manual work is technical debt.',
      'Platform-agnostic reasoning with cloud-specific implementation.',
    ],
  },
  quantum: {
    icon: '◈',
    protocols: [
      { t: 'Mathematical Rigor', d: 'Every claim must be backed by formal proofs, derivations, or peer-reviewed evidence.' },
      { t: 'Classical Baseline', d: 'Compare quantum approaches against best classical algorithms to validate quantum advantage.' },
      { t: 'Noise Awareness', d: 'Current hardware is noisy. Design algorithms that are resilient to decoherence and errors.' },
      { t: 'Simulation First', d: 'Validate on classical simulators before consuming precious quantum hardware time.' },
      { t: 'Cross-Disciplinary', d: 'Breakthroughs happen at the intersection of physics, math, computer science, and domain expertise.' },
      { t: 'Reproducible Methods', d: 'Share code, parameters, and methodologies so results can be independently verified.' },
      { t: 'Physical Intuition', d: 'Connect abstract formalism to physical reality. Equations should have physical interpretations.' },
      { t: 'Scalability Assessment', d: 'Evaluate whether approaches scale to practically useful problem sizes.' },
    ],
    tones: [
      'Rigorous and precise. Distinguish theoretical possibilities from practical capabilities.',
      'Research-oriented with attention to experimental validation.',
      'Interdisciplinary, connecting physics, mathematics, and engineering.',
    ],
  },
  bio: {
    icon: '◑',
    protocols: [
      { t: 'Evidence-Based', d: 'Prioritize peer-reviewed evidence and systematic reviews over anecdotes and trends.' },
      { t: 'Reproducibility First', d: 'Log protocols, versions, and parameters so experiments can be exactly replicated.' },
      { t: 'Ethics Always', d: 'Consider informed consent, patient privacy, and societal impact before all technical decisions.' },
      { t: 'Statistical Rigor', d: 'Use appropriate statistical tests with proper sample sizes. Report confidence intervals, not just p-values.' },
      { t: 'Interdisciplinary Integration', d: 'Biology requires chemistry, physics, computation, and clinical expertise working together.' },
      { t: 'Safety Protocols', d: 'Follow biosafety levels and regulatory requirements. Safety is non-negotiable in biological work.' },
      { t: 'Data Stewardship', d: 'Biological and health data requires the highest standards of privacy and governance.' },
      { t: 'Translational Focus', d: 'Research should ultimately improve patient outcomes or biological understanding.' },
    ],
    tones: [
      'Evidence-driven and cautious. Health claims need clinical backing.',
      'Interdisciplinary with respect for biological complexity and uncertainty.',
      'Patient-centered and ethically grounded.',
    ],
  },
  spatial: {
    icon: '◉',
    protocols: [
      { t: 'Performance Budget', d: 'Set frame rate and latency targets from day one. Immersion breaks below 72fps in VR.' },
      { t: 'User Comfort First', d: 'Prioritize motion sickness prevention, accessibility, and ergonomics in spatial design.' },
      { t: 'Progressive Detail', d: 'Use LOD (level of detail) systems. Load high-fidelity assets only when needed.' },
      { t: 'Spatial Thinking', d: 'Design for three-dimensional interaction. Screen metaphors rarely translate to spatial computing.' },
      { t: 'Test on Device', d: 'Desktop previews lie. Always test on target hardware for accurate performance and comfort assessment.' },
      { t: 'Interaction Clarity', d: 'Spatial interfaces need clear affordances. Users must intuitively know what they can interact with.' },
      { t: 'Cross-Platform Strategy', d: 'Design for the broadest audience while optimizing for each platform.' },
      { t: 'Coordinate Systems', d: 'Be explicit about coordinate systems and reference frames. Spatial bugs are hard to debug.' },
    ],
    tones: [
      'Immersion-focused with strong technical performance awareness.',
      'User-centered with attention to spatial ergonomics and accessibility.',
      'Visual and concrete. Demonstrate through spatial examples.',
    ],
  },
  blockchain: {
    icon: '◐',
    protocols: [
      { t: 'Security First', d: 'Smart contracts are immutable once deployed. Audit, test, and formally verify before launch.' },
      { t: 'Gas Optimization', d: 'Every operation costs money. Optimize for minimal on-chain computation and storage.' },
      { t: 'Decentralization Assessment', d: 'Evaluate whether decentralization genuinely adds value or if a database would suffice.' },
      { t: 'Key Management', d: 'Private key security is paramount. Use hardware wallets, multi-sig, and key rotation.' },
      { t: 'Upgrade Patterns', d: 'Plan contract upgradeability from the start using proxies or modular architecture.' },
      { t: 'Regulatory Awareness', d: 'Token classification, securities law, and jurisdiction matter. Consult legal expertise.' },
      { t: 'Test on Testnets', d: 'Deploy and test thoroughly on testnets before mainnet. Bugs are permanent on-chain.' },
      { t: 'User Experience', d: 'Abstract wallet complexity. Users care about outcomes, not transaction hashes.' },
    ],
    tones: [
      'Security-paranoid and thorough. Assume adversarial users.',
      'Pragmatic about decentralization tradeoffs. Not everything needs a blockchain.',
      'Cost-aware and gas-efficient. Every wei counts.',
    ],
  },
  robotics: {
    icon: '◍',
    protocols: [
      { t: 'Safety Critical', d: 'Robots interact with the physical world. Safety systems must be hardware-backed and fail-safe.' },
      { t: 'Simulate First', d: 'Validate algorithms in simulation before deploying on hardware. Real robots break.' },
      { t: 'Sensor Fusion', d: 'Combine multiple sensor modalities for robust perception. No single sensor is reliable enough.' },
      { t: 'Real-Time Constraints', d: 'Control loops have hard deadlines. Missed deadlines mean safety failures.' },
      { t: 'Mechanical Sympathy', d: 'Software engineers must understand the physical hardware and its limitations.' },
      { t: 'Test Edge Cases', d: 'The real world has infinite edge cases. Test in varied environments and conditions.' },
      { t: 'Power Awareness', d: 'Battery life constrains everything. Optimize algorithms for energy efficiency.' },
      { t: 'Graceful Degradation', d: 'When sensors fail or conditions change, robots must degrade safely, not catastrophically.' },
    ],
    tones: [
      'Safety-first and hardware-aware. Software meets physical reality.',
      'Systems-thinking across mechanical, electrical, and software domains.',
      'Precise about real-time constraints and physical limitations.',
    ],
  },
  climate: {
    icon: '◌',
    protocols: [
      { t: 'Systems Thinking', d: 'Climate is a complex system. Consider interdependencies, feedback loops, and unintended consequences.' },
      { t: 'Data Transparency', d: 'Share methodologies, data sources, and uncertainty ranges. Climate work demands public trust.' },
      { t: 'Action Orientation', d: 'Analysis should lead to actionable recommendations with measurable impact.' },
      { t: 'Long-Term Perspective', d: 'Evaluate solutions over decades, not quarters. Short-term thinking created the problem.' },
      { t: 'Equity Lens', d: 'Climate impact is unequal. Solutions must consider vulnerable populations and environmental justice.' },
      { t: 'Life Cycle Analysis', d: 'Evaluate environmental impact across the full product lifecycle, not just use phase.' },
      { t: 'Scalability Focus', d: 'Prioritize solutions that can scale to gigatonne-level impact.' },
      { t: 'Policy Awareness', d: 'Understand regulatory frameworks, carbon markets, and policy incentives.' },
    ],
    tones: [
      'Evidence-based and urgency-aware. Data-driven but action-oriented.',
      'Interdisciplinary, connecting science, policy, and engineering.',
      'Optimistic but honest about challenges and timelines.',
    ],
  },
  product: {
    icon: '◻',
    protocols: [
      { t: 'Customer First', d: 'Start with the customer problem, not the solution. Validate assumptions before building.' },
      { t: 'Measure Impact', d: 'Define success metrics before launch. If you cannot measure it, you cannot improve it.' },
      { t: 'Ship and Learn', d: 'Small, frequent releases beat big-bang launches. Learn from real user behavior.' },
      { t: 'Prioritize Ruthlessly', d: 'Say no to most things. Focus on the highest-impact work that moves the needle.' },
      { t: 'Cross-Functional Alignment', d: 'Keep engineering, design, and business stakeholders aligned on goals and tradeoffs.' },
      { t: 'Document Decisions', d: 'Record why decisions were made, not just what was decided. Context decays faster than code.' },
      { t: 'Outcome Over Output', d: 'Shipping features is not success. Achieving business outcomes is success.' },
      { t: 'Competitive Awareness', d: 'Know the competitive landscape but differentiate through customer intimacy, not imitation.' },
    ],
    tones: [
      'Customer-obsessed and outcome-driven. Features are hypotheses to test.',
      'Strategic with attention to execution detail.',
      'Data-informed but not data-paralyzed. Bias toward action.',
    ],
  },
  creative: {
    icon: '◪',
    protocols: [
      { t: 'Concept Before Execution', d: 'Develop a strong creative concept and direction before touching tools. Ideas drive work.' },
      { t: 'Know the Medium', d: 'Respect the constraints and possibilities of each medium. Screen, print, motion, and space are different.' },
      { t: 'Iterate Through Critique', d: 'Seek feedback early and often. Creative work improves through iteration, not isolation.' },
      { t: 'Reference and Research', d: 'Build mood boards, study precedents, and understand the design history of what you are making.' },
      { t: 'Typography Matters', d: 'Type is the foundation of visual communication. Choose and pair fonts with intention.' },
      { t: 'Consistency Through Systems', d: 'Use design tokens, grids, and component libraries to maintain coherence across outputs.' },
      { t: 'Accessibility is Design', d: 'Inclusive design is good design. Color contrast, readability, and universal access are requirements.' },
      { t: 'Deliver Production-Ready', d: 'Creative work must be technically sound — correct file formats, color spaces, and specifications.' },
    ],
    tones: [
      'Visually articulate and detail-obsessed. Every pixel, frame, and note matters.',
      'Concept-driven with strong execution craft.',
      'Empathetic toward audiences and collaborative with stakeholders.',
    ],
  },
  dev: {
    icon: '⬡',
    protocols: [
      { t: 'Simplicity First', d: 'Write the simplest code that works. Complexity is the enemy of reliability.' },
      { t: 'Test What Matters', d: 'Test behavior, not implementation. Focus on critical paths and edge cases.' },
      { t: 'Code Review Culture', d: 'Every change gets reviewed. Reviews catch bugs, spread knowledge, and maintain standards.' },
      { t: 'Ship Incrementally', d: 'Small, focused PRs are easier to review, test, and rollback than large changes.' },
      { t: 'Observability Built In', d: 'Instrument logging, metrics, and error tracking from the start, not after production issues.' },
      { t: 'Dependency Discipline', d: 'Every dependency is a liability. Evaluate maintenance status, security, and bundle impact.' },
      { t: 'Documentation as Code', d: 'Keep docs next to code. Update them in the same PR as the code change.' },
      { t: 'Performance Budgets', d: 'Set and enforce performance budgets for load time, bundle size, and response latency.' },
    ],
    tones: [
      'Pragmatic and craft-focused. Clean code, clear naming, and solid architecture.',
      'Ship-oriented with attention to quality. Speed and quality are not opposites.',
      'Collaborative with strong opinions, loosely held.',
    ],
  },
  writing: {
    icon: '◧',
    protocols: [
      { t: 'Audience First', d: 'Understand who will read this, what they know, and what they need before writing a word.' },
      { t: 'Structure Before Prose', d: 'Outline the logical structure first. Good writing follows clear thinking.' },
      { t: 'Edit Ruthlessly', d: 'Cut every word that does not earn its place. Brevity is a gift to readers.' },
      { t: 'Voice Consistency', d: 'Maintain a consistent tone and voice throughout. Shifts in register confuse readers.' },
      { t: 'Show, Do Not Tell', d: 'Use specific examples, data, and stories instead of vague claims and abstractions.' },
      { t: 'Research Thoroughly', d: 'Verify facts, cite sources, and understand context before publishing.' },
      { t: 'Reader-Test Early', d: 'Share drafts with representative readers. The writer is the worst judge of clarity.' },
      { t: 'Format for Scanning', d: 'Use headings, bullets, and white space. Most readers scan before they read.' },
    ],
    tones: [
      'Clear, precise, and reader-focused. Every sentence serves a purpose.',
      'Authoritative but approachable. Expertise without jargon.',
      'Detail-oriented with respect for language craft.',
    ],
  },
  business: {
    icon: '◨',
    protocols: [
      { t: 'Revenue Awareness', d: 'Every initiative should connect to revenue impact, even if indirectly. Measure ROI.' },
      { t: 'Data-Driven Decisions', d: 'Use data to inform decisions but combine with judgment and market intuition.' },
      { t: 'Customer Validation', d: 'Test assumptions with real customers before scaling. Build MVPs, not castles.' },
      { t: 'Competitive Intelligence', d: 'Know competitors, market trends, and adjacent opportunities. Context drives strategy.' },
      { t: 'Stakeholder Alignment', d: 'Ensure executives, teams, and partners share the same goals and success metrics.' },
      { t: 'Execution Over Strategy', d: 'A good strategy executed well beats a perfect strategy never executed.' },
      { t: 'Risk Management', d: 'Identify, assess, and mitigate risks proactively. Diversify bets and plan contingencies.' },
      { t: 'Scale Thinking', d: 'Design processes and systems that work at 10x current volume.' },
    ],
    tones: [
      'Results-oriented and commercially aware. Translate metrics into business outcomes.',
      'Strategic with attention to operational execution.',
      'Stakeholder-empathetic with clear, jargon-free communication.',
    ],
  },
  education: {
    icon: '◦',
    protocols: [
      { t: 'Learner-Centered', d: 'Design for the learner, not the teacher. Adapt to different knowledge levels and learning styles.' },
      { t: 'Outcome-Aligned', d: 'Define clear learning objectives first. Every activity should map to a measurable outcome.' },
      { t: 'Active Over Passive', d: 'Hands-on practice, projects, and discussion outperform lectures and reading alone.' },
      { t: 'Scaffolded Progression', d: 'Build knowledge incrementally. Each concept should connect to and build upon the last.' },
      { t: 'Assessment for Learning', d: 'Use formative assessment to guide instruction, not just summative tests to grade.' },
      { t: 'Inclusive Design', d: 'Design for diverse learners including those with disabilities, language barriers, and varied backgrounds.' },
      { t: 'Evidence-Based Methods', d: 'Use pedagogical approaches backed by learning science research, not tradition or intuition.' },
      { t: 'Reflection and Feedback', d: 'Build in time for learners to reflect on what they know and receive corrective feedback.' },
    ],
    tones: [
      'Encouraging and learner-empathetic. Meet people where they are.',
      'Research-informed and outcome-focused.',
      'Patient, clear, and adaptable to different learning contexts.',
    ],
  },
};

// ═══════════════════════════════════════════════════════════════
// 4. TOOL → SIMPLEICONS MAPPING
// ═══════════════════════════════════════════════════════════════
const TOOL_ICONS = {
  // Languages
  'python':       { slug: 'python',       color: '#3776AB' },
  'javascript':   { slug: 'javascript',   color: '#F7DF1E' },
  'typescript':   { slug: 'typescript',    color: '#3178C6' },
  'rust':         { slug: 'rust',          color: '#000000' },
  'go':           { slug: 'go',            color: '#00ADD8' },
  'java':         { slug: 'openjdk',       color: '#ED8B00' },
  'kotlin':       { slug: 'kotlin',        color: '#7F52FF' },
  'swift':        { slug: 'swift',         color: '#F05138' },
  'ruby':         { slug: 'ruby',          color: '#CC342D' },
  'php':          { slug: 'php',           color: '#777BB4' },
  'c#':           { slug: 'csharp',        color: '#239120' },
  'c++':          { slug: 'cplusplus',     color: '#00599C' },
  'scala':        { slug: 'scala',         color: '#DC322F' },
  'r':            { slug: 'r',             color: '#276DC3' },
  'julia':        { slug: 'julia',         color: '#9558B2' },
  'dart':         { slug: 'dart',          color: '#0175C2' },
  'elixir':       { slug: 'elixir',        color: '#4B275F' },
  'haskell':      { slug: 'haskell',       color: '#5D4F85' },
  'lua':          { slug: 'lua',           color: '#2C2D72' },
  'perl':         { slug: 'perl',          color: '#39457E' },
  'solidity':     { slug: 'solidity',      color: '#363636' },
  // Frameworks - Frontend
  'react':        { slug: 'react',         color: '#61DAFB' },
  'vue':          { slug: 'vuedotjs',      color: '#4FC08D' },
  'vue.js':       { slug: 'vuedotjs',      color: '#4FC08D' },
  'vuejs':        { slug: 'vuedotjs',      color: '#4FC08D' },
  'angular':      { slug: 'angular',       color: '#DD0031' },
  'svelte':       { slug: 'svelte',        color: '#FF3E00' },
  'sveltekit':    { slug: 'svelte',        color: '#FF3E00' },
  'solid.js':     { slug: 'solid',         color: '#2C4F7C' },
  'solidjs':      { slug: 'solid',         color: '#2C4F7C' },
  'qwik':         { slug: 'qwik',          color: '#AC7EF4' },
  'next.js':      { slug: 'nextdotjs',     color: '#000000' },
  'nextjs':       { slug: 'nextdotjs',     color: '#000000' },
  'nuxt':         { slug: 'nuxtdotjs',     color: '#00DC82' },
  'nuxt.js':      { slug: 'nuxtdotjs',     color: '#00DC82' },
  'gatsby':       { slug: 'gatsby',        color: '#663399' },
  'remix':        { slug: 'remix',         color: '#000000' },
  'remixrun':     { slug: 'remix',         color: '#000000' },
  'astro':        { slug: 'astro',         color: '#FF5D01' },
  'htmx':         { slug: 'htmx',          color: '#3366CC' },
  'tailwindcss':  { slug: 'tailwindcss',   color: '#06B6D4' },
  'tailwind css': { slug: 'tailwindcss',   color: '#06B6D4' },
  'tailwind':     { slug: 'tailwindcss',   color: '#06B6D4' },
  'bootstrap':    { slug: 'bootstrap',     color: '#7952B3' },
  'sass':         { slug: 'sass',          color: '#CC6699' },
  // Frameworks - Backend
  'node.js':      { slug: 'nodedotjs',     color: '#339933' },
  'nodejs':       { slug: 'nodedotjs',     color: '#339933' },
  'express':      { slug: 'express',       color: '#000000' },
  'express.js':   { slug: 'express',       color: '#000000' },
  'django':       { slug: 'django',        color: '#092E20' },
  'flask':        { slug: 'flask',         color: '#000000' },
  'fastapi':      { slug: 'fastapi',       color: '#009688' },
  'spring':       { slug: 'spring',        color: '#6DB33F' },
  'spring boot':  { slug: 'springboot',    color: '#6DB33F' },
  'rails':        { slug: 'rubyonrails',   color: '#CC0000' },
  'ruby on rails':{ slug: 'rubyonrails',   color: '#CC0000' },
  'laravel':      { slug: 'laravel',       color: '#FF2D20' },
  '.net':         { slug: 'dotnet',        color: '#512BD4' },
  // Mobile
  'flutter':      { slug: 'flutter',       color: '#02569B' },
  'react native': { slug: 'react',         color: '#61DAFB' },
  'android':      { slug: 'android',       color: '#3DDC84' },
  'ios':          { slug: 'apple',         color: '#000000' },
  'xcode':        { slug: 'xcode',         color: '#147EFB' },
  // DevOps & Cloud
  'docker':       { slug: 'docker',        color: '#2496ED' },
  'kubernetes':   { slug: 'kubernetes',    color: '#326CE5' },
  'aws':          { slug: 'amazonaws',     color: '#232F3E' },
  'azure':        { slug: 'microsoftazure',color: '#0078D4' },
  'gcp':          { slug: 'googlecloud',   color: '#4285F4' },
  'google cloud': { slug: 'googlecloud',   color: '#4285F4' },
  'terraform':    { slug: 'terraform',     color: '#7B42BC' },
  'ansible':      { slug: 'ansible',       color: '#EE0000' },
  'jenkins':      { slug: 'jenkins',       color: '#D24939' },
  'circleci':     { slug: 'circleci',      color: '#343434' },
  'github actions':{ slug: 'githubactions',color: '#2088FF' },
  'nginx':        { slug: 'nginx',         color: '#009639' },
  'linux':        { slug: 'linux',         color: '#FCC624' },
  'prometheus':   { slug: 'prometheus',    color: '#E6522C' },
  'grafana':      { slug: 'grafana',       color: '#F46800' },
  'datadog':      { slug: 'datadog',       color: '#632CA6' },
  'vercel':       { slug: 'vercel',        color: '#000000' },
  'netlify':      { slug: 'netlify',       color: '#00C7B7' },
  'cloudflare':   { slug: 'cloudflare',    color: '#F38020' },
  'heroku':       { slug: 'heroku',        color: '#430098' },
  // Databases
  'postgresql':   { slug: 'postgresql',    color: '#4169E1' },
  'postgres':     { slug: 'postgresql',    color: '#4169E1' },
  'mysql':        { slug: 'mysql',         color: '#4479A1' },
  'mongodb':      { slug: 'mongodb',       color: '#47A248' },
  'redis':        { slug: 'redis',         color: '#DC382D' },
  'sqlite':       { slug: 'sqlite',        color: '#003B57' },
  'elasticsearch':{ slug: 'elasticsearch', color: '#005571' },
  'cassandra':    { slug: 'apachecassandra',color: '#1287B1' },
  'neo4j':        { slug: 'neo4j',         color: '#4581C3' },
  'supabase':     { slug: 'supabase',      color: '#3FCF8E' },
  'firebase':     { slug: 'firebase',      color: '#FFCA28' },
  'dynamodb':     { slug: 'amazondynamodb',color: '#4053D6' },
  // Data & ML
  'tensorflow':   { slug: 'tensorflow',    color: '#FF6F00' },
  'pytorch':      { slug: 'pytorch',       color: '#EE4C2C' },
  'scikit-learn': { slug: 'scikitlearn',   color: '#F7931E' },
  'pandas':       { slug: 'pandas',        color: '#150458' },
  'numpy':        { slug: 'numpy',         color: '#013243' },
  'jupyter':      { slug: 'jupyter',       color: '#F37626' },
  'apache spark': { slug: 'apachespark',   color: '#E25A1C' },
  'spark':        { slug: 'apachespark',   color: '#E25A1C' },
  'apache kafka': { slug: 'apachekafka',   color: '#231F20' },
  'kafka':        { slug: 'apachekafka',   color: '#231F20' },
  'apache flink': { slug: 'apacheflink',   color: '#E6526F' },
  'dbt':          { slug: 'dbt',           color: '#FF694B' },
  'snowflake':    { slug: 'snowflake',     color: '#29B5E8' },
  'bigquery':     { slug: 'googlebigquery',color: '#669DF6' },
  'airflow':      { slug: 'apacheairflow', color: '#017CEE' },
  'apache airflow':{ slug: 'apacheairflow',color: '#017CEE' },
  'mlflow':       { slug: 'mlflow',        color: '#0194E2' },
  'hugging face': { slug: 'huggingface',   color: '#FFD21E' },
  'huggingface':  { slug: 'huggingface',   color: '#FFD21E' },
  'opencv':       { slug: 'opencv',        color: '#5C3EE8' },
  'tableau':      { slug: 'tableau',       color: '#E97627' },
  'power bi':     { slug: 'powerbi',       color: '#F2C811' },
  'd3.js':        { slug: 'd3dotjs',       color: '#F9A03C' },
  // AI Services
  'openai':       { slug: 'openai',        color: '#412991' },
  'openai api':   { slug: 'openai',        color: '#412991' },
  'anthropic':    { slug: 'anthropic',     color: '#191919' },
  'langchain':    { slug: 'langchain',     color: '#1C3C3C' },
  'ollama':       { slug: 'ollama',        color: '#000000' },
  // Testing
  'jest':         { slug: 'jest',          color: '#C21325' },
  'cypress':      { slug: 'cypress',       color: '#69D3A7' },
  'playwright':   { slug: 'playwright',    color: '#2EAD33' },
  'selenium':     { slug: 'selenium',      color: '#43B02A' },
  'pytest':       { slug: 'pytest',        color: '#0A9EDC' },
  'mocha':        { slug: 'mocha',         color: '#8D6748' },
  'vitest':       { slug: 'vitest',        color: '#6E9F18' },
  // Build Tools
  'webpack':      { slug: 'webpack',       color: '#8DD6F9' },
  'vite':         { slug: 'vite',          color: '#646CFF' },
  'esbuild':      { slug: 'esbuild',       color: '#FFCF00' },
  'rollup':       { slug: 'rollupdotjs',   color: '#EC4A3F' },
  // Version Control
  'git':          { slug: 'git',           color: '#F05032' },
  'github':       { slug: 'github',        color: '#181717' },
  'gitlab':       { slug: 'gitlab',        color: '#FC6D26' },
  'bitbucket':    { slug: 'bitbucket',     color: '#0052CC' },
  // Design
  'figma':        { slug: 'figma',         color: '#F24E1E' },
  'sketch':       { slug: 'sketch',        color: '#F7B500' },
  'adobe xd':     { slug: 'adobexd',       color: '#FF61F6' },
  'adobe photoshop':{ slug: 'adobephotoshop',color: '#31A8FF' },
  'photoshop':    { slug: 'adobephotoshop',color: '#31A8FF' },
  'adobe illustrator':{ slug: 'adobeillustrator',color: '#FF9A00' },
  'illustrator':  { slug: 'adobeillustrator',color: '#FF9A00' },
  'adobe premiere':{ slug: 'adobepremierepro',color: '#9999FF' },
  'premiere pro': { slug: 'adobepremierepro',color: '#9999FF' },
  'adobe after effects':{ slug: 'adobeaftereffects',color: '#9999FF' },
  'after effects':{ slug: 'adobeaftereffects',color: '#9999FF' },
  'blender':      { slug: 'blender',       color: '#E87D0D' },
  'unity':        { slug: 'unity',         color: '#000000' },
  'unreal engine':{ slug: 'unrealengine',  color: '#0E1128' },
  'canva':        { slug: 'canva',         color: '#00C4CC' },
  // Security
  'wireshark':    { slug: 'wireshark',     color: '#1679A7' },
  'burp suite':   { slug: 'burpsuite',     color: '#FF6633' },
  'metasploit':   { slug: 'metasploit',    color: '#2596CD' },
  'nmap':         { slug: 'nmap',          color: '#0E83CD' },
  'splunk':       { slug: 'splunk',        color: '#000000' },
  // Communication & SaaS
  'slack':        { slug: 'slack',         color: '#4A154B' },
  'notion':       { slug: 'notion',        color: '#000000' },
  'jira':         { slug: 'jira',          color: '#0052CC' },
  'confluence':   { slug: 'confluence',    color: '#172B4D' },
  'trello':       { slug: 'trello',        color: '#0052CC' },
  'asana':        { slug: 'asana',         color: '#F06A6A' },
  'linear':       { slug: 'linear',        color: '#5E6AD2' },
  'miro':         { slug: 'miro',          color: '#FFD02F' },
  // APIs & Protocols
  'graphql':      { slug: 'graphql',       color: '#E10098' },
  'grpc':         { slug: 'grpc',          color: '#244C5A' },
  'rabbitmq':     { slug: 'rabbitmq',      color: '#FF6600' },
  // CMS & E-Commerce
  'wordpress':    { slug: 'wordpress',     color: '#21759B' },
  'shopify':      { slug: 'shopify',       color: '#7AB55C' },
  'stripe':       { slug: 'stripe',        color: '#635BFF' },
  // Blockchain
  'ethereum':     { slug: 'ethereum',      color: '#3C3C3D' },
  'solana':       { slug: 'solana',        color: '#9945FF' },
  'hardhat':      { slug: 'hardhat',       color: '#FFF100' },
  // Misc
  'vs code':      { slug: 'visualstudiocode', color: '#007ACC' },
  'visual studio code': { slug: 'visualstudiocode', color: '#007ACC' },
  'postman':      { slug: 'postman',       color: '#FF6C37' },
  'insomnia':     { slug: 'insomnia',      color: '#4000BF' },
  'arduino':      { slug: 'arduino',       color: '#00979D' },
  'raspberry pi': { slug: 'raspberrypi',   color: '#A22846' },
  'ros':          { slug: 'ros',           color: '#22314E' },
  'latex':        { slug: 'latex',         color: '#008080' },
  'markdown':     { slug: 'markdown',      color: '#000000' },
  'qiskit':       { slug: 'qiskit',        color: '#6929C4' },
  'ableton':      { slug: 'abletonlive',   color: '#000000' },
  'ableton live': { slug: 'abletonlive',   color: '#000000' },
  'logic pro':    { slug: 'apple',         color: '#000000' },
  'pro tools':    { slug: 'protools',      color: '#7ACB10' },
  'godot':        { slug: 'godotengine',   color: '#478CBF' },
  'three.js':     { slug: 'threedotjs',    color: '#000000' },
  'webgl':        { slug: 'webgl',         color: '#990000' },
  'wasm':         { slug: 'webassembly',   color: '#654FF0' },
  'webassembly':  { slug: 'webassembly',   color: '#654FF0' },
  'electron':     { slug: 'electron',      color: '#47848F' },
  'tauri':        { slug: 'tauri',         color: '#24C8D8' },
  'storybook':    { slug: 'storybook',     color: '#FF4785' },
  'chromatic':    { slug: 'chromatic',     color: '#FC521F' },
  'pnpm':         { slug: 'pnpm',          color: '#F69220' },
  'npm':          { slug: 'npm',           color: '#CB3837' },
  'yarn':         { slug: 'yarn',          color: '#2C8EBB' },
  'deno':         { slug: 'deno',          color: '#000000' },
  'bun':          { slug: 'bun',           color: '#000000' },
};

// ═══════════════════════════════════════════════════════════════
// 5. GENERATOR FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/** Simple hash for deterministic but varied selection */
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Pick n items from array using deterministic seed */
function pickN(arr, n, seed) {
  const result = [];
  const indices = new Set();
  let h = seed;
  while (result.length < n && result.length < arr.length) {
    h = hashCode(String(h) + result.length);
    const idx = h % arr.length;
    if (!indices.has(idx)) {
      indices.add(idx);
      result.push(arr[idx]);
    }
  }
  return result;
}

/** Pick one item from array using deterministic seed */
function pickOne(arr, seed) {
  return arr[hashCode(String(seed)) % arr.length];
}

/** Convert skill name to a role-appropriate title */
function deriveRoleTitle(skillName, subCatRole) {
  // Use the subcategory role as the base
  return subCatRole;
}

/** Generate an enhanced description */
function enhanceDesc(skill) {
  const desc = skill.desc || skill.name;
  // If description is already decent (>60 chars), keep it
  if (desc.length > 60) return desc;
  // Otherwise enhance with tools/skills
  const toolStr = (skill.tools || []).slice(0, 3).join(', ');
  if (toolStr) {
    return `${desc}. Covers practical application using ${toolStr} and related technologies.`;
  }
  return desc;
}

/** Generate a situational trigger */
function enhanceTrigger(skill) {
  const name = skill.name;
  const trigger = skill.trigger || '';
  // If trigger is generic ("Use when X expertise is required"), replace it
  if (trigger.includes('expertise is required') || trigger.length < 30) {
    const skills = (skill.skills || []).slice(0, 3);
    if (skills.length >= 2) {
      return `Use when working on ${skills[0].toLowerCase()}, ${skills[1].toLowerCase()}, or applying ${name} in production contexts.`;
    }
    return `Use when ${name.toLowerCase()} knowledge is needed to solve technical challenges or build production systems.`;
  }
  return trigger;
}

/** Enhance skills array with parenthetical details */
function enhanceSkillsList(skills, tools) {
  if (!skills || skills.length === 0) return ['Core concept mastery', 'Practical implementation', 'Best practices', 'Problem-solving', 'System design'];
  
  // Add tool context to generic skills
  return skills.map((s, i) => {
    // Skip if already has parenthetical
    if (s.includes('(')) return s;
    // Add relevant tool reference for some skills
    if (i < 3 && tools && tools[i]) {
      return `${s} (${tools[i]})`;
    }
    return s;
  });
}

/** Find best SimpleIcons match for a skill */
function findIcon(skill) {
  const tools = (skill.tools || []).map(t => t.toLowerCase());
  const tags = (skill.tags || []).map(t => t.toLowerCase());
  const name = (skill.name || '').toLowerCase();
  const id = (skill.id || '').toLowerCase();
  
  // Helper: check if key matches at word boundary in text
  function wordMatch(text, key) {
    if (key.length < 2) return text === key; // Single-char keys must be exact
    // Check word boundary match
    const re = new RegExp('\\b' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
    if (re.test(text)) return true;
    // Also check if text starts with key or key is substantial part
    if (text.startsWith(key) || text === key) return true;
    if (key.length >= 4 && text.includes(key)) return true;
    return false;
  }
  
  // 1. Check skill name first (highest priority for brand matching)
  // Sort keys by length descending to prefer longer/more specific matches
  const sortedKeys = Object.keys(TOOL_ICONS).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (wordMatch(name, key)) return TOOL_ICONS[key];
  }
  
  // 2. Check skill id (replace underscores/hyphens for matching)
  const idNorm = id.replace(/[-_]/g, ' ');
  for (const key of sortedKeys) {
    if (wordMatch(idNorm, key)) return TOOL_ICONS[key];
  }
  
  // 3. Check tools - exact match only
  for (const tool of tools) {
    if (TOOL_ICONS[tool]) return TOOL_ICONS[tool];
  }
  
  // 4. Check tools - word boundary match (key must be >= 3 chars)
  for (const tool of tools) {
    for (const key of sortedKeys) {
      if (key.length >= 3 && wordMatch(tool, key)) return TOOL_ICONS[key];
    }
  }
  
  // 5. Check tags (exact only)
  for (const tag of tags) {
    if (TOOL_ICONS[tag]) return TOOL_ICONS[tag];
  }
  
  return null;
}

/** Generate Anthropic-quality markdown content */
function generateMd(skill, parentCat, subCat) {
  const parentDef = PARENT_DEFS[parentCat];
  const subRole = SUB_ROLES[subCat] || { role: 'Specialist', mission: 'deliver expert-level work in this domain' };
  
  const id = skill.id;
  const name = skill.name;
  const desc = enhanceDesc(skill);
  const trigger = enhanceTrigger(skill);
  const tags = (skill.tags || []).join(', ');
  const difficulty = skill.difficulty || 'intermediate';
  const timeToMaster = skill.timeToMaster || '3-6 months';
  const skills = enhanceSkillsList(skill.skills, skill.tools);
  const tools = skill.tools || [];
  
  // Pick 4 protocols deterministically based on skill id
  const protocols = pickN(parentDef.protocols, 4, hashCode(id));
  // Pick 1 tone
  const tone = pickOne(parentDef.tones, hashCode(id + '_tone'));
  
  // Build the md content
  const lines = [
    '---',
    `name: ${id}`,
    `description: ${desc} ${trigger}`,
    `tags: ${tags}`,
    `difficulty: ${difficulty}`,
    `time_to_master: ${timeToMaster}`,
    '---',
    '',
    '## ROLE DEFINITION',
    `You are a ${subRole.role} specializing in ${name}. You ${subRole.mission}.`,
    '',
    '## INTERACTION PROTOCOL',
  ];
  
  protocols.forEach((p, i) => {
    lines.push(`${i + 1}. **${p.t}:** ${p.d}`);
  });
  
  lines.push('');
  lines.push('## CORE COMPETENCIES');
  skills.slice(0, 6).forEach(s => {
    lines.push(`- ${s}`);
  });
  
  if (tools.length > 0) {
    lines.push('');
    lines.push('## ESSENTIAL TOOLS');
    tools.slice(0, 6).forEach(t => {
      lines.push(`- ${t}`);
    });
  }
  
  lines.push('');
  lines.push('## TONE & STYLE');
  lines.push(`- ${tone}`);
  
  // Add a second tone line derived from the skill
  const toneVariants = [
    `Focus on practical ${name} application over theoretical discussion.`,
    `Prioritize actionable guidance with real-world ${name} examples.`,
    `Balance depth of ${name} knowledge with accessibility for practitioners.`,
    `Emphasize production-readiness and real-world constraints.`,
    `Ground advice in industry best practices and proven patterns.`,
  ];
  lines.push(`- ${pickOne(toneVariants, hashCode(id + '_tone2'))}`);
  
  return lines.join('\\n');
}

/** Transform a single skill from input to output format */
function transformSkill(raw) {
  const subCat = raw.cat;
  const parentCat = CAT_MAP[subCat] || 'dev';
  const parentDef = PARENT_DEFS[parentCat];
  
  // Find icon
  const iconMatch = findIcon(raw);
  
  const skill = {
    id: raw.id.replace(/_/g, '-'),
    name: raw.name,
  };
  
  // Assign icon
  if (iconMatch) {
    skill.icon = iconMatch.slug;
    skill.iconType = 'simpleicons';
    skill.brandColor = iconMatch.color;
  } else {
    skill.icon = parentDef.icon;
  }
  
  skill.cat = parentCat;
  skill.d = raw.d || 5;
  skill.i = raw.i || 5;
  skill.f = raw.f || 5;
  skill.difficulty = raw.difficulty || 'intermediate';
  skill.timeToMaster = raw.timeToMaster || '3-6 months';
  skill.tags = raw.tags || [];
  skill.desc = enhanceDesc(raw);
  skill.trigger = enhanceTrigger(raw);
  skill.skills = enhanceSkillsList(raw.skills, raw.tools);
  skill.tools = raw.tools || [];
  skill.source = 'official';
  skill.md = generateMd(raw, parentCat, subCat);
  
  return skill;
}

/** Format a skill object as a JS string for the output file */
function formatSkill(skill) {
  const lines = [];
  lines.push('  {');
  
  // Core identity
  const iconPart = skill.iconType 
    ? `icon: '${skill.icon}', iconType: '${skill.iconType}', brandColor: '${skill.brandColor}',`
    : `icon: '${skill.icon}',`;
  lines.push(`    id: '${skill.id}', name: ${JSON.stringify(skill.name)}, ${iconPart} cat: '${skill.cat}',`);
  
  // Scores
  lines.push(`    d: ${skill.d}, i: ${skill.i}, f: ${skill.f}, difficulty: '${skill.difficulty}', timeToMaster: '${skill.timeToMaster}',`);
  
  // Tags
  const tagsStr = skill.tags.map(t => `'${t.replace(/'/g, "\\'")}'`).join(',');
  lines.push(`    tags: [${tagsStr}],`);
  
  // Desc and trigger
  lines.push(`    desc: ${JSON.stringify(skill.desc)},`);
  lines.push(`    trigger: ${JSON.stringify(skill.trigger)},`);
  
  // Skills
  const skillsStr = skill.skills.map(s => JSON.stringify(s)).join(', ');
  lines.push(`    skills: [${skillsStr}],`);
  
  // Tools
  const toolsStr = skill.tools.map(t => JSON.stringify(t)).join(', ');
  lines.push(`    tools: [${toolsStr}],`);
  
  // Source
  lines.push(`    source: '${skill.source}',`);
  
  // Markdown
  lines.push(`    md: \`${skill.md}\``);
  
  lines.push('  }');
  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════
// 6. MAIN
// ═══════════════════════════════════════════════════════════════

function main() {
  const inputPath = process.argv[2] || path.join(__dirname, '..', '..', 'skill_galaxy_10k_complete', 'skills_db_complete.js');
  const outputPath = process.argv[3] || path.join(__dirname, '..', 'js', 'db.js');
  
  console.log(`Reading input: ${inputPath}`);
  
  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    console.error('Usage: node scripts/generate-skills.js <input-file> [output-file]');
    process.exit(1);
  }
  
  // Read and parse input
  let src = fs.readFileSync(inputPath, 'utf8');
  // Replace const/let with var so it's visible in sandbox
  src = src.replace(/^(const|let)\s+SKILL_GALAXY_DB/m, 'var SKILL_GALAXY_DB');
  const sandbox = {};
  vm.runInNewContext(src, sandbox);
  const rawSkills = sandbox.SKILL_GALAXY_DB;
  
  if (!rawSkills || !Array.isArray(rawSkills)) {
    console.error('Could not find SKILL_GALAXY_DB array in input file');
    process.exit(1);
  }
  
  console.log(`Found ${rawSkills.length} skills in ${Object.keys(CAT_MAP).length} sub-categories`);
  
  // Transform all skills
  console.log('Transforming skills to Anthropic quality format...');
  const transformed = rawSkills.map((raw, i) => {
    if (i % 1000 === 0) console.log(`  Processing ${i}/${rawSkills.length}...`);
    return transformSkill(raw);
  });
  
  // Count category distribution
  const catCount = {};
  transformed.forEach(s => {
    catCount[s.cat] = (catCount[s.cat] || 0) + 1;
  });
  
  console.log('\nCategory distribution:');
  Object.entries(catCount).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    const label = CATEGORIES_DEF[cat]?.label || cat;
    console.log(`  ${label}: ${count}`);
  });
  
  // Count icon types
  const withIcons = transformed.filter(s => s.iconType === 'simpleicons').length;
  console.log(`\nSimpleIcons assigned: ${withIcons}/${transformed.length} (${Math.round(withIcons/transformed.length*100)}%)`);
  
  // Write output
  console.log(`\nWriting output: ${outputPath}`);
  
  const out = fs.createWriteStream(outputPath);
  
  // Write header
  out.write(`/**
 * SkillVault — Skills Database
 * db.js
 *
 * Single source of truth for all skills.
 * Auto-generated by scripts/generate-skills.js — ${new Date().toISOString().split('T')[0]}
 * Total skills: ${transformed.length}
 *
 * Schema:
 * {
 *   id:       string   — kebab-case unique identifier
 *   name:     string   — display name
 *   icon:     string   — single emoji OR simpleicons slug
 *   iconType: string   — 'simpleicons' if icon is a brand icon slug
 *   brandColor: string — hex color for simpleicons
 *   cat:      string   — category key (must exist in CATEGORIES)
 *   d:        number   — demand score  1-10
 *   i:        number   — income score  1-10
 *   f:        number   — future score  1-10
 *   difficulty: string — beginner | intermediate | advanced | expert
 *   timeToMaster: string — e.g. "3-6 months"
 *   tags:     string[] — searchable tags
 *   desc:     string   — short description (shown on card)
 *   trigger:  string   — when to use this skill
 *   skills:   string[] — atomic micro-skills
 *   tools:    string[] — essential tools/frameworks
 *   md:       string   — full markdown content of the skill file
 *   source:   string   — "official" | "community"
 * }
 */

`);
  
  // Write CATEGORIES
  out.write(`const CATEGORIES = {
  ai:        { label: 'AI & ML',              icon: '◎', dot: '#7c5cfc', tag: 'rgba(124,92,252,0.12)', tagText: '#6a4ee0' },
  security:  { label: 'Cybersecurity',        icon: '◬', dot: '#8a3a4e', tag: 'rgba(138,58,78,0.12)',  tagText: '#8a3a4e' },
  data:      { label: 'Data Engineering',     icon: '◷', dot: '#8a6a1a', tag: 'rgba(138,106,26,0.12)',tagText: '#8a6a1a' },
  cloud:     { label: 'Cloud & Infra',        icon: '◫', dot: '#3a5f8a', tag: 'rgba(58,95,138,0.12)', tagText: '#3a5f8a' },
  quantum:   { label: 'Quantum Computing',    icon: '◈', dot: '#5a3a8a', tag: 'rgba(90,58,138,0.12)', tagText: '#5a3a8a' },
  bio:       { label: 'Computational Bio',    icon: '◑', dot: '#5a7a5a', tag: 'rgba(90,122,90,0.12)', tagText: '#5a7a5a' },
  spatial:   { label: 'Spatial Computing',    icon: '◉', dot: '#3a7d6e', tag: 'rgba(58,125,110,0.12)',tagText: '#3a7d6e' },
  blockchain:{ label: 'Blockchain & Web3',    icon: '◐', dot: '#8a5a1a', tag: 'rgba(138,90,26,0.12)', tagText: '#8a5a1a' },
  robotics:  { label: 'Robotics & Automation',icon: '◍', dot: '#4a6a8a', tag: 'rgba(74,106,138,0.12)',tagText: '#4a6a8a' },
  climate:   { label: 'Climate Tech',         icon: '◌', dot: '#3a7a3a', tag: 'rgba(58,122,58,0.12)', tagText: '#3a7a3a' },
  product:   { label: 'Product & Strategy',   icon: '◻', dot: '#c07b4a', tag: 'rgba(192,123,74,0.12)',tagText: '#c07b4a' },
  creative:  { label: 'Creative Technology',  icon: '◪', dot: '#8a3a6a', tag: 'rgba(138,58,106,0.12)',tagText: '#8a3a6a' },
  dev:       { label: 'Development',          icon: '⬡', dot: '#3a7d6e', tag: 'rgba(58,125,110,0.12)',tagText: '#3a7d6e' },
  writing:   { label: 'Writing',              icon: '◧', dot: '#7a5a1a', tag: 'rgba(122,90,26,0.12)', tagText: '#7a5a1a' },
  business:  { label: 'Business',             icon: '◨', dot: '#1a5a7a', tag: 'rgba(26,90,122,0.12)', tagText: '#1a5a7a' },
  education: { label: 'Design & Education',   icon: '◦', dot: '#7a5a8a', tag: 'rgba(122,90,138,0.12)',tagText: '#7a5a8a' },
};

`);
  
  // Write SKILLS_DB
  out.write(`/* ─────────────────────────────────────────────
   SKILLS DATABASE — ${transformed.length} skills
   Generated in Anthropic SKILL.md format
───────────────────────────────────────────── */
const SKILLS_DB = [
`);
  
  // Write each skill
  transformed.forEach((skill, i) => {
    if (i > 0) out.write(',\n');
    out.write(formatSkill(skill));
  });
  
  out.write(`
];

`);
  
  // Write utility functions
  out.write(`

/* Community-submitted skills persist in localStorage */
function getCommunitySkills() {
  try {
    return JSON.parse(localStorage.getItem('sv_community') || '[]');
  } catch { return []; }
}

function saveCommunitySkill(skill) {
  const existing = getCommunitySkills();
  existing.unshift(skill);
  localStorage.setItem('sv_community', JSON.stringify(existing));
}

function getAllSkills() {
  const community = getCommunitySkills();
  return [...SKILLS_DB, ...community];
}
`);
  
  out.end();
  
  out.on('finish', () => {
    const stats = fs.statSync(outputPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
    console.log(`\nDone! Output: ${outputPath} (${sizeMB} MB, ${transformed.length} skills)`);
  });
}

// Categories definition used for logging
const CATEGORIES_DEF = {
  ai:        { label: 'AI & ML' },
  security:  { label: 'Cybersecurity' },
  data:      { label: 'Data Engineering' },
  cloud:     { label: 'Cloud & Infra' },
  quantum:   { label: 'Quantum Computing' },
  bio:       { label: 'Computational Bio' },
  spatial:   { label: 'Spatial Computing' },
  blockchain:{ label: 'Blockchain & Web3' },
  robotics:  { label: 'Robotics & Automation' },
  climate:   { label: 'Climate Tech' },
  product:   { label: 'Product & Strategy' },
  creative:  { label: 'Creative Technology' },
  dev:       { label: 'Development' },
  writing:   { label: 'Writing' },
  business:  { label: 'Business' },
  education: { label: 'Design & Education' },
};

main();
