#!/usr/bin/env node
// Validates every data file, then writes:
//   data.bundle.js            what the app loads now (ui, characters, English-alphabet stories)
//   data.sections.js          the other sections (Gujarati/Hindi akshar, numbers, deities, avatars) for the next app step
//   art/prompts/*.md          picture prompts, one file per section
//   art/IMAGE-LIST.xlsx       (made by scripts/make-xlsx.py) every picture in one Excel table
//
//   node scripts/build-data.mjs            -> check + build
//   node scripts/build-data.mjs --strict   -> missing pictures/audio also count as errors (use before release)
//   node scripts/build-data.mjs --verbose  -> list every missing file instead of counting them
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const exists = f => fs.existsSync(path.join(root, f));
const strict = process.argv.includes('--strict'), verbose = process.argv.includes('--verbose');
const LANGS = ['gu', 'hi', 'en'];
const errors = [], warns = [];
const err = m => errors.push(m);
const missing = { picture: [], audio: [] };

const ui = rd('data/ui.json'), chars = rd('data/characters.json'), slots = rd('data/slots.json'), style = rd('data/style.json');
delete chars._note;
const stories = {};
for (const f of fs.readdirSync(path.join(root, 'data/stories')).filter(f => f.endsWith('.json')).sort()) {
  const s = rd('data/stories/' + f); stories[s.id] = s;
  if (s.id + '.json' !== f) err(`${f}: id "${s.id}" must match the file name`);
}
const sec = {};
for (const n of ['akshar-gu', 'akshar-hi', 'numbers', 'deities', 'avatars']) sec[n] = rd(`data/sections/${n}.json`);

const GU = 'અ આ ઇ ઈ ઉ ઊ ઋ એ ઐ ઓ ઔ અં અઃ ક ખ ગ ઘ ચ છ જ ઝ ટ ઠ ડ ઢ ણ ત થ દ ધ ન પ ફ બ ભ મ ય ર લ વ શ ષ સ હ ળ ક્ષ જ્ઞ'.split(' ');
const HI = 'अ आ इ ई उ ऊ ऋ ए ऐ ओ औ अं अः क ख ग घ च छ ज झ ट ठ ड ढ ण त थ द ध न प फ ब भ म य र ल व श ष स ह क्ष त्र ज्ञ'.split(' ');
const EN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const needTxt = (where, o) => { for (const l of LANGS) if (!o?.[l] || !String(o[l]).trim()) err(`${where}: missing ${l}`); };
const shotOK = (w, sh, needWho) => {
  for (const k of ['setting', 'action', 'expression', 'camera']) if (!sh?.[k]) err(`${w}: shot.${k} missing`);
  if (needWho && !sh?.who?.length) err(`${w}: shot.who needs at least one character`);
  for (const who of sh?.who || []) if (!chars[who]?.look) err(`${w}: character "${who}" has no "look" in characters.json`);
};
const subjOK = (w, sh) => { for (const k of ['subject', 'setting']) if (!sh?.[k]) err(`${w}: shot.${k} missing`); };

// image list (every picture to be made)
const images = [];
const addImg = (section, file, label, prompt) => {
  const have = exists(file); images.push({ section, file, label, prompt, have });
  if (!have) missing.picture.push(file);
};
const lookOf = who => (who || []).map(w => `${chars[w].names.en}: ${chars[w].look}`).join('. ');
const FINAL = `${style.format} ${style.safety}`;
const scenePrompt = (sh, first) => `${style.style}. Setting: ${sh.setting}. Characters — ${lookOf(sh.who)}. Action: ${sh.action}. Expressions: ${sh.expression}. Camera: ${sh.camera}. ${FINAL}${first ? '' : ' ' + style.continuity}`;
const itemPrompt = (sh, who) => `${style.style}. Subject: ${sh.subject}.${who?.length ? ' Character — ' + lookOf(who) + '.' : ''} Setting: ${sh.setting}. ${style.item} ${FINAL}`;

// 1. ui + characters
for (const [k, v] of Object.entries(ui)) for (const l of LANGS) if (!v[l]) err(`ui.json "${k}": missing ${l}`);
for (const [id, c] of Object.entries(chars)) for (const l of LANGS) if (!c.names?.[l]) err(`characters.json "${id}": name missing in ${l}`);

// 2. ONE character = ONE alphabet slot, across the English, Gujarati and Hindi alphabets
const seen = {}; let slotCount = 0;
const claim = (alpha, letter, id) => {
  slotCount++;
  if (!chars[id]) { err(`${alpha}.${letter}: unknown character "${id}"`); return; }
  const key = `${alpha}.${letter}`;
  if (seen[id]) err(`REPEAT: "${id}" is used for both ${seen[id]} and ${key}. Give one of them a different character.`);
  else seen[id] = key;
};
const checkSet = (alpha, got, want) => {
  const miss = want.filter(x => !got.includes(x)), extra = got.filter(x => !want.includes(x));
  if (miss.length) err(`${alpha}: letters missing: ${miss.join(' ')}`);
  if (extra.length) err(`${alpha}: unexpected letters: ${extra.join(' ')}`);
  if (new Set(got).size !== got.length) err(`${alpha}: a letter appears twice`);
};
checkSet('abcd', Object.keys(slots.abcd), EN);
for (const [letter, id] of Object.entries(slots.abcd)) claim('abcd', letter, id);
for (const [name, alpha, want] of [['akshar-gu', 'gu', GU], ['akshar-hi', 'hi', HI]]) {
  const items = sec[name].items;
  checkSet(name, items.map(i => i.letter), want);
  items.forEach(it => {
    const w = `${name} ${it.letter}`;
    claim(alpha, it.letter, it.char);
    needTxt(w + ' text', it.text); subjOK(w, it.shot);
    const nm = chars[it.char]?.names?.[alpha];
    if (nm && !it.exempt && !nm.startsWith(it.letter)) err(`${w}: the ${alpha} name "${nm}" must start with the letter (or add "exempt": true with a reason)`);
    if (it.exempt && !it.why) err(`${w}: exempt needs a "why"`);
    for (const l of LANGS) if (it.text?.[l]?.length > 420) warns.push(`${w}: ${l} text is long (${it.text[l].length})`);
    addImg(name, `art/items/${name}/${it.char}.webp`, `${it.letter} — ${chars[it.char]?.names?.en}`, itemPrompt(it.shot, chars[it.char]?.look ? [it.char] : []));
  });
}

// 3. English-alphabet stories
for (const L of EN) if (!stories['abcd-' + L]) warns.push(`abcd-${L}: story file not written yet`);
for (const s of Object.values(stories)) {
  const [alpha, letter] = s.id.split('-');
  if (slots[alpha]?.[letter] !== s.char) err(`${s.id}: char "${s.char}" does not match slots.json (${slots[alpha]?.[letter]})`);
  needTxt(`${s.id} tag`, s.tag); needTxt(`${s.id} lesson`, s.lesson);
  if (!s.scenes?.length) err(`${s.id}: needs scenes`);
  else if (s.scenes.length < 4 || s.scenes.length > 8) warns.push(`${s.id}: ${s.scenes.length} scenes (aim for 5-7)`);
  (s.scenes || []).forEach((sc, i) => {
    const w = `${s.id} scene ${sc.id}`;
    if (sc.id !== i + 1) err(`${w}: scene ids must be 1,2,3… in order`);
    needTxt(w + ' text', sc.text);
    for (const l of LANGS) if (sc.text?.[l] && sc.text[l].length > 560) warns.push(`${w}: ${l} text is ${sc.text[l].length} characters (keep each scene short)`);
    shotOK(w, sc.shot, true);
    addImg('abcd', `art/scenes/${letter}/${sc.id}.webp`, `${letter}/${sc.id} — ${chars[s.char].names.en} · ${sc.mood}`, scenePrompt(sc.shot, sc.id === 1));
    for (const l of LANGS) if (!exists(`audio/${l}/${letter}-${sc.id}.mp3`)) missing.audio.push(`audio/${l}/${letter}-${sc.id}.mp3`);
  });
  (s.points || []).forEach((p, i) => needTxt(`${s.id} points[${i}]`, p));
  (s.words || []).forEach((p, i) => needTxt(`${s.id} words[${i}]`, p));
  if ((s.quiz || []).length < 3) warns.push(`${s.id}: fewer than 3 quiz questions`);
  (s.quiz || []).forEach((q, i) => {
    needTxt(`${s.id} quiz[${i}].q`, q.q);
    for (const l of LANGS) if (q.a?.[l]?.length !== 3) err(`${s.id} quiz[${i}]: ${l} needs exactly 3 answers (first one is the right one)`);
  });
}

// 4. numbers
sec.numbers.items.forEach(n => {
  const w = `numbers ${n.id}`;
  needTxt(w + ' names', n.names); needTxt(w + ' stands', n.stands); needTxt(w + ' text', n.text); subjOK(w, n.shot);
  addImg('numbers', `art/items/numbers/${n.id}.webp`, `${n.n} — ${n.names.en}`, itemPrompt(n.shot, []));
});

// 5. deities + avatars (3 scenes each, facts, lesson)
for (const name of ['deities', 'avatars']) {
  sec[name].items.forEach(d => {
    const w = `${name} ${d.id}`;
    if (!chars[d.char]) err(`${w}: unknown character "${d.char}"`);
    needTxt(w + ' lesson', d.lesson);
    for (const f of name === 'deities' ? ['vahan', 'loves'] : ['yuga', 'form']) needTxt(`${w} ${f}`, d[f]);
    if (name === 'deities') { if (!d.mantra?.sa) err(`${w}: mantra.sa missing`); needTxt(w + ' mantra.say', d.mantra?.say); needTxt(w + ' mantra.meaning', d.mantra?.meaning); }
    if ((d.scenes || []).length < 3) err(`${w}: needs at least 3 scenes`);
    (d.scenes || []).forEach((sc, i) => {
      const ww = `${w} scene ${sc.id}`;
      if (sc.id !== i + 1) err(`${ww}: scene ids must be 1,2,3… in order`);
      needTxt(ww + ' text', sc.text); shotOK(ww, sc.shot, true);
      addImg(name, `art/items/${name}/${d.id}/${sc.id}.webp`, `${chars[d.char]?.names?.en} · scene ${sc.id}`, scenePrompt(sc.shot, sc.id === 1));
    });
  });
}

// 6. write bundles
fs.writeFileSync(path.join(root, 'data.bundle.js'),
  '// GENERATED by scripts/build-data.mjs — edit the files in data/, not this one.\nwindow.DATA=' + JSON.stringify({ ui, chars, slots, stories }) + ';\n');
fs.writeFileSync(path.join(root, 'data.sections.js'),
  '// GENERATED by scripts/build-data.mjs — edit the files in data/sections/, not this one.\nwindow.SECTIONS=' + JSON.stringify(sec) + ';\n');

// 7. picture prompts
const titles = { 'abcd': '01 English A–Z stories', 'akshar-gu': '02 Gujarati akshar', 'akshar-hi': '03 Hindi akshar', 'numbers': '04 Numbers', 'deities': '05 Deities', 'avatars': '06 Dashavatar' };
fs.mkdirSync(path.join(root, 'art/prompts'), { recursive: true });
for (const f of fs.readdirSync(path.join(root, 'art/prompts'))) fs.unlinkSync(path.join(root, 'art/prompts', f));
for (const [sname, title] of Object.entries(titles)) {
  const list = images.filter(i => i.section === sname);
  let md = `# ${title}: picture prompts (${list.length} pictures)\n\n_Generated by scripts/build-data.mjs — do not edit by hand._\n\nOne prompt per picture. Save each as the file name shown (webp, 2816x1536, 16:9). `;
  md += sname === 'abcd' || sname === 'deities' || sname === 'avatars' ? 'Make scene 1 of each story first and use it as the reference image for that story\'s other scenes.\n' : 'Each picture stands alone.\n';
  for (const im of list) md += `\n### \`${im.file}\`  ·  ${im.label}${im.have ? '  ✅ done' : ''}\n\n> ${im.prompt}\n`;
  fs.writeFileSync(path.join(root, 'art/prompts', titles[sname].replace(/ /g, '-').replace(/[^\w-]/g, '') + '.md'), md);
}

// studio list (used by studio.html)
const refOf = f => { const m = f.match(/^(.*\/)(\d+)\.webp$/); return m && m[2] !== '1' ? m[1] + '1.webp' : null; };
fs.writeFileSync(path.join(root, 'art/images.json'), JSON.stringify(images.map(i => ({ s: i.section, f: i.file, l: i.label, p: i.prompt, r: refOf(i.file) }))));

// report
const nSc = Object.values(stories).reduce((n, s) => n + s.scenes.length, 0);
console.log(`characters: ${Object.keys(chars).length} · alphabet slots: ${slotCount} (abcd ${Object.keys(slots.abcd).length}, gu ${sec['akshar-gu'].items.length}, hi ${sec['akshar-hi'].items.length}) · stories: ${Object.keys(stories).length} (${nSc} scenes) · numbers ${sec.numbers.items.length} · deities ${sec.deities.items.length} · avatars ${sec.avatars.items.length}`);
console.log(`pictures to make: ${images.filter(i => !i.have).length} of ${images.length}  (see art/IMAGE-LIST.xlsx and art/prompts/)`);
for (const [k, list] of Object.entries(missing)) if (list.length) {
  if (strict) list.forEach(m => errors.push(`${k} missing: ${m}`));
  else if (k === 'audio') console.log(`voice files not made yet: ${list.length} (run scripts/make-audio.py)`);
}
if (warns.length) console.log(`\n${warns.length} note(s):\n  - ` + warns.join('\n  - '));
if (verbose) console.log('\nmissing pictures:\n  ' + missing.picture.join('\n  '));
if (errors.length) { console.error(`\n${errors.length} ERROR(S):\n  x ` + errors.join('\n  x ')); process.exit(1); }
console.log('\nOK: data is valid.');
