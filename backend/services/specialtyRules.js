// "Which doctor do I need?" - plain keyword rules, no AI and no diagnosis.
// It only points to a department to start with, and warns when words suggest an emergency.

const RED_FLAGS = [
  { label: 'Chest pain', test: /\bchest (pain|tightness|pressure)\b|\bpain in (my )?chest\b/ },
  { label: 'Trouble breathing', test: /\b(can ?not|can't|cannot|hard to|difficulty|trouble) breath|\bshort(ness)? of breath\b|\bgasping\b|\bbreathless\b/ },
  { label: 'Signs of a stroke', test: /\bface (is )?droop|\bslurred speech\b|\bsudden(ly)? (weak|numb)|\bone side (of (my|the) body )?(is )?(weak|numb)/ },
  { label: 'Fainting or unconscious', test: /\bunconscious\b|\bfaint(ed|ing)\b|\bpassed out\b|\bnot responding\b/ },
  { label: 'Heavy bleeding', test: /\b(heavy|severe|uncontrolled|won'?t stop) bleeding\b|\bbleeding (heavily|a lot|won'?t stop)\b|\bvomit(ing)? blood\b|\bcough(ing)? (up )?blood\b/ },
  { label: 'Seizure', test: /\bseizure\b|\bconvulsion/ },
  { label: 'Severe allergic reaction', test: /\bthroat (is )?(swelling|closing)\b|\bswollen (tongue|throat|lips)\b|\banaphyla/ },
  { label: 'Poisoning or overdose', test: /\bpoison|\boverdose\b|\bswallowed (a lot|too many|bleach|pesticide)/ },
  { label: 'Thoughts of self-harm', test: /\bkill myself\b|\bend my life\b|\bsuicid|\bself[- ]?harm\b|\bdon'?t want to live\b/, mental: true },
];

const DEPARTMENTS = [
  ['Cardiology', [/\bpalpitation/, /\bheart (racing|beating|pain|problem|disease)/, /\bhigh (blood pressure|bp)\b/, /\bblood pressure\b/, /\bcholesterol\b/, /\birregular heart/, /\bswelling (in|of) (my )?(legs|feet|ankles)\b/, /\bchest (pain|tightness)\b/]],
  ['Dermatology', [/\brash/, /\bitch(y|ing)?\b/, /\bacne\b/, /\bpimple/, /\bskin\b/, /\bhair (fall|loss)\b/, /\bdandruff\b/, /\beczema\b/, /\bpsoriasis\b/, /\bnails?\b/, /\bfungal\b/, /\bhives\b/]],
  ['Orthopedics', [/\bjoint/, /\bknee/, /\bback ?pain\b/, /\bshoulder/, /\bfracture/, /\bbroken (bone|arm|leg|wrist)\b/, /\bsprain/, /\bneck pain\b/, /\bhip pain\b/, /\barthritis\b/, /\bsports injur/, /\bmuscle (pain|strain)\b/]],
  ['Pediatrics', [/\bchild\b/, /\bchildren\b/, /\bbaby\b/, /\binfant\b/, /\btoddler\b/, /\bnewborn\b/, /\bmy (son|daughter|kid)\b/, /\bvaccinat/]],
  ['Gynecology', [/\bperiods?\b/, /\bpregnan/, /\bmenstrua/, /\bpcos\b/, /\bvaginal\b/, /\bmenopause\b/, /\bfertility\b/, /\bmissed (my )?period\b/]],
  ['Neurology', [/\bheadache/, /\bmigraine/, /\bdizz(y|iness)\b/, /\bnumbness\b/, /\btingling\b/, /\bmemory\b/, /\btremor/, /\bvertigo\b/, /\bseizures?\b/]],
  ['ENT', [/\bears?\b/, /\bearache\b/, /\bhearing\b/, /\bsore throat\b/, /\btonsil/, /\bsinus/, /\b(blocked|runny|stuffy) nose\b/, /\bsnoring\b/, /\bvoice\b/, /\bvertigo\b/]],
  ['Ophthalmology', [/\beyes?\b/, /\bvision\b/, /\bblurr?(ed|y)\b/, /\bcataract/, /\bglasses\b/, /\bdry eyes?\b/, /\bred eyes?\b/]],
  ['Dental Care', [/\btooth/, /\bteeth\b/, /\bgums?\b/, /\bdental\b/, /\bcavit/, /\bjaw\b/, /\bbraces\b/, /\bbad breath\b/]],
  ['General Medicine', [/\bfever\b/, /\bcold\b/, /\bcough/, /\bflu\b/, /\bfatigue\b/, /\btired(ness)?\b/, /\bweakness\b/, /\bdiabet/, /\bsugar\b/, /\bthyroid\b/, /\bstomach/, /\bvomit/, /\bdiarrh?o?ea\b/, /\bbody ?ache\b/, /\binfection\b/, /\bweight (loss|gain)\b/, /\bnausea\b/]],
];


function analyse(rawText) {
  const text = String(rawText || '').toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400);
  if (text.length < 3) return { text, redFlags: [], suggestions: [], fallback: false };

  const redFlags = RED_FLAGS.filter((r) => r.test.test(text)).map((r) => ({ label: r.label, mental: Boolean(r.mental) }));

  const scored = DEPARTMENTS.map(([department, rules]) => {
    const hits = rules.filter((re) => re.test(text)).map((re) => text.match(re)[0].trim());
    return { department, hits: [...new Set(hits)] };
  }).filter((d) => d.hits.length);

  scored.sort((a, b) => b.hits.length - a.hits.length);
  // A child's symptoms always put Pediatrics first.
  const kidIndex = scored.findIndex((d) => d.department === 'Pediatrics');
  if (kidIndex > 0) scored.unshift(scored.splice(kidIndex, 1)[0]);

  const suggestions = scored.slice(0, 3).map((d) => ({ department: d.department, because: d.hits.slice(0, 4) }));
  if (!suggestions.length) return { text, redFlags, suggestions: [{ department: 'General Medicine', because: [] }], fallback: true };
  return { text, redFlags, suggestions, fallback: false };
}

module.exports = { analyse, RED_FLAGS, DEPARTMENTS };
