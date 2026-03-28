const fs = require('fs');
const vm = require('vm');
let src = fs.readFileSync('/Users/sandeepreddy/skill_galaxy/js/db.js', 'utf8');
// Replace const/let with var for sandbox visibility
src = src.replace(/^const /gm, 'var ');
src = src.replace(/^function /gm, 'var _fn_ = function ');
try {
  const sandbox = { localStorage: { getItem: () => '[]', setItem: () => {} }, JSON };
  vm.runInNewContext(src, sandbox);
  const SKILLS_DB = sandbox.SKILLS_DB;
  const CATEGORIES = sandbox.CATEGORIES;
  console.log('SKILLS_DB length:', SKILLS_DB.length);
  console.log('CATEGORIES keys:', Object.keys(CATEGORIES).length);
  console.log('First skill:', SKILLS_DB[0].id, SKILLS_DB[0].name);
  console.log('Last skill:', SKILLS_DB[SKILLS_DB.length-1].id);
  const s = SKILLS_DB[500];
  console.log('\nSample skill #500:');
  console.log('  Name:', s.name);
  console.log('  Cat:', s.cat);
  console.log('  Icon:', s.icon, s.iconType || 'emoji');
  console.log('  Desc:', s.desc.substring(0, 100));
  console.log('  MD length:', s.md.length, 'chars');
  console.log('  Has ROLE DEFINITION:', s.md.includes('ROLE DEFINITION'));
  console.log('  Has INTERACTION PROTOCOL:', s.md.includes('INTERACTION PROTOCOL'));
  console.log('  Has CORE COMPETENCIES:', s.md.includes('CORE COMPETENCIES'));
  console.log('  Has TONE:', s.md.includes('TONE'));

  const s2 = SKILLS_DB[5000];
  console.log('\nSample skill #5000:');
  console.log('  Name:', s2.name);
  console.log('  Cat:', s2.cat);
  console.log('  Icon:', s2.icon, s2.iconType || 'emoji');
  console.log('  Desc:', s2.desc.substring(0, 100));

  const noIcon = SKILLS_DB.filter(s => !s.iconType && !s.icon);
  console.log('\nSkills without any icon:', noIcon.length);

  const mds = new Set(SKILLS_DB.map(s => s.md));
  console.log('Unique MD content:', mds.size, '/', SKILLS_DB.length);

  console.log('\nSyntax OK');
} catch(e) {
  console.error('ERROR:', e.message);
  console.error(e.stack.split('\n').slice(0,5).join('\n'));
}
