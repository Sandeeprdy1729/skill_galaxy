// ════════════════════════════════════════════════════════════
// SKILLGALAXY — ICON RENDERER (icon_renderer.js)
// NEW FILE: Save as js/icon_renderer.js
// Add <script src="js/icon_renderer.js"></script> to index.html
// ════════════════════════════════════════════════════════════

// Simple Icons CDN base
const SI_CDN = 'https://cdn.simpleicons.org/';

// Brand color map for Simple Icons (hex without #)
const SI_COLORS = {
  gmail: 'EA4335', slack: '4A154B', zoom: '2D8CFF',
  microsoftword: '2B579A', microsoftpowerpoint: 'B7472A',
  googledocs: '4285F4', notion: '000000', trello: '0052CC',
  asana: 'F06A6A', jira: '0052CC', monday: 'FF3D57',
  airtable: '18BFFF', calendly: '006BFF', todoist: 'DB4035',
  github: '181717', visualstudiocode: '007ACC', replit: 'F26207',
  bitbucket: '0052CC', stripe: '635BFF', zapier: 'FF4A00',
  n8n: 'EA4B71', webflow: '4353FF', figma: 'F24E1E',
  canva: '00C4CC', miro: 'FFD02F', midjourney: '000000',
  openai: '412991', runway: '000000', googlecamera: '4285F4',
  elevenlabs: '000000', perplexity: '20808D', jasper: 'FF5100',
  writesonicai: '7B68EE', astro: 'FF5D01', youtube: 'FF0000',
  tiktok: '000000', instagram: 'E4405F', x: '000000',
  linkedin: '0A66C2', reddit: 'FF4500', substack: 'FF6719',
  medium: '000000', wordpress: '21759B', capcut: '000000',
  loom: '625DF5', descript: '2D2D2D', twitch: '9146FF',
  vsco: '000000', spotify: '1DB954', youtubemusic: 'FF0000',
  netflix: 'E50914', shopify: '7AB55C', amazon: 'FF9900',
  ebay: 'E53238', etsy: 'F16521', hubspot: 'FF7A59',
  salesforce: '00A1E0', mailchimp: 'FFE01B', paypal: '003087',
  quickbooks: '2CA01C', turbotax: '355FB3', robinhood: '00C805',
  coinbase: '0052FF', bloombergquint: '000000', bitwarden: '175DDC',
  nordvpn: '4687FF', googlesheets: '34A853', microsoftexcel: '217346',
  googleanalytics: 'E37400', duolingo: '58CC02', coursera: '0056D2',
  udemy: 'EC5252', khanacademy: '14BF96', amazonkindle: 'FF9900',
  grammarly: '15C39A', otter: '1EB0F5', adobelightroom: '31A8FF',
  myfitnesspal: '00B2FF', strava: 'FC4C02', calm: '6DCFE7',
  headspace: 'F47D31', flo: 'FF5376', teladoc: '00A0C7',
  zocdoc: '428BCA', airbnb: 'FF5A5F', bookingcom: '003580',
  uber: '000000', doordash: 'FF3008', googlemaps: '4285F4',
  tripadvisor: '34E0A1', telegram: '2AABEE', whatsapp: '25D366',
  discord: '5865F2', pinterest: 'BD081C', pocket: 'EF3F56',
  wix: '0C6EFC',
};

/**
 * Render a skill icon — returns an <img> HTML string for Simple Icons
 * or falls back to emoji for non-iconType skills
 */
function renderSkillIcon(skill, size = 28) {
  if (skill.iconType === 'simpleicons' && skill.icon) {
    const slug = skill.icon.toLowerCase();
    const color = SI_COLORS[slug] || '666666';
    const url = SI_CDN + slug + '/' + color;
    return `<img 
      src="${url}" 
      alt="${skill.name} icon"
      class="skill-icon-img"
      width="${size}" 
      height="${size}"
      onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
      loading="lazy"
    /><span class="skill-icon-fallback" style="display:none">◈</span>`;
  }
  // Legacy emoji icon fallback
  return `<span class="skill-icon-emoji">${skill.icon || '◈'}</span>`;
}

/**
 * Get brand color for a skill (for accent borders/highlights)
 */
function getSkillBrandColor(skill) {
  if (skill.iconType === 'simpleicons' && skill.icon) {
    const color = SI_COLORS[skill.icon.toLowerCase()];
    return color ? '#' + color : null;
  }
  return null;
}

// Export for use in app.js
window.SkillIcons = { renderSkillIcon, getSkillBrandColor, SI_COLORS, SI_CDN };