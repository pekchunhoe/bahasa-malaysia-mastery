import { e, field, list } from '../components/ui.js';
import { editor, teacherCard } from '../components/writing.js';
import { essayExample, revisionHistory } from '../components/essay-catalog.js';
import { vocabularySupport } from '../components/vocabulary-support.js';
import { writingGuidance } from '../js/writing-guidance.js';
import { essayStages } from '../js/config.js';

export function renderMasterWriting({ pack, draft, state }, topic) {
  const guide = writingGuidance(topic, pack.year), activity = draft.activity;
  const stage = draft.stage;
  const planning = `<div class="fields-grid">${guide.questions.map((label, i) => field(label, draft.plan[`p${i}`] || '', `data-plan="p${i}"`, 'Idea saya sendiri…')).join('')}</div>`;
  const format = `<h3>Panduan ${e(topic.writing_type.toLocaleLowerCase('ms'))}</h3>${list(guide.format)}`;
  let instruction;
  if (activity === 'essay') {
    const selected = pack.vocabulary.filter(w => state.selectedVocabulary.includes(w.id));
    instruction = `<h2>${e(essayStages[stage])}</h2>${stage === 0 ? list(guide.questions) : ''}${stage === 1 ? planning : ''}${stage === 2 ? `<p>Pilih kata yang sesuai dengan idea sendiri.</p><div class="chips">${selected.map(w => `<span class="chip">${e(w.word)}</span>`).join('')}</div><a class="button" href="#vocabulary">Buka Bank Kata & Frasa</a>` : ''}${[3, 5, 7].includes(stage) ? format : ''}${stage === 4 ? '<p>Baca draf kamu. Bimbingan dan semakan asas muncul berasingan; kamu menentukan pembaikannya.</p>' : ''}${stage === 5 ? '<p>Semak versi terdahulu di bahagian Versi tulisan saya, kemudian baiki tulisan semasa dengan idea sendiri.</p>' : ''}${[5, 7].includes(stage) ? list(guide.checklist) : ''}${stage === 6 ? '<p>Fikirkan isi yang berkaitan dengan perenggan sebelumnya.</p><button class="button" data-next-paragraph>Pergi ke perenggan seterusnya</button>' : ''}<div class="stage-controls"><button class="small-button" data-stage="${Math.max(0, stage - 1)}" ${stage === 0 ? 'disabled' : ''}>Sebelumnya</button><button class="small-button" data-stage="${Math.min(7, stage + 1)}" ${stage === 7 ? 'disabled' : ''}>Seterusnya</button></div>`;
  } else if (activity === 'paragraph') {
    instruction = `<h2>Bina satu perenggan sendiri</h2><p>Pilih satu isi daripada rancangan kamu. Tulis ayat utama, kemudian tambah butiran yang berkaitan.${topic.format === 'Berformat' ? ' Untuk latihan ini, bina isi badan tulisan; gunakan Karangan Berpandu untuk format lengkap.' : ''}</p>${planning}${format}`;
  } else {
    instruction = `<h2>Cipta dan sambung cerita kamu</h2><p>Cipta ayat pembukaan sendiri berdasarkan tajuk. Pada setiap giliran, tambah peristiwa yang berkaitan dengan sambungan kamu sebelum ini.</p>${planning}${draft.lines.map((line, i) => `<div class="story-line"><span>${i + 1}</span><p>${e(line)}</p></div>`).join('')}${format}`;
  }
  const stages = activity === 'essay' ? `<nav class="stage-list" aria-label="Langkah karangan">${essayStages.map((label, i) => `<button class="stage ${stage === i ? 'active' : ''}" data-stage="${i}" ${stage === i ? 'aria-current="step"' : ''}><span>${i + 1}</span>${e(label)}</button>`).join('')}</nav>` : '';
  return `<section class="panel"><span class="mini-label">Tahun ${pack.year} · ${e(topic.writing_type)} · ${e(topic.category)}</span><h2 class="current-writing-title">${e(topic.title)}</h2><p>${e(guide.purpose)}</p><p class="notice">${e(guide.level)}</p><p class="small">Panduan aktiviti aplikasi. Contoh rujukan dikekalkan mengikut sumber master.</p></section>${essayExample(topic)}${stages}<div class="workspace-grid"><div><section class="panel">${instruction}</section><section class="panel writing-panel">${editor(draft, { label: activity === 'essay' ? 'Karangan saya' : activity === 'paragraph' ? 'Perenggan saya' : 'Sambungan cerita saya', rows: activity === 'story' ? 6 : guide.rows, placeholder: 'Tulis idea sendiri. Contoh tidak diisi ke ruang ini.' })}${activity === 'story' ? '<button class="button primary" data-add-story>Tambah pada rantai cerita</button>' : ''}</section>${revisionHistory(draft)}</div><div>${vocabularySupport(pack, state)}${teacherCard(activity)}</div></div>`;
}
