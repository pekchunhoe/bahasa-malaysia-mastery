import { selectedWritingTopic } from "../js/essay-service.js";
import { topicPicker } from "../components/essay-catalog.js";
import { renderMasterWriting } from "./master-writing.js";
import { vocabularySupport } from "../components/vocabulary-support.js";
import { provenanceLabel, guidedSupport } from "../components/enrichment.js";
import { e, field, list } from "../components/ui.js";
import { editor, teacherCard } from "../components/writing.js";
import { essayStages } from "../js/config.js";
function renderLegacyParagraph({ pack, draft, state }) {
  const task = pack.activitySets.paragraph;
  return `<div class="workspace-grid"><div><section class="panel"><span class="eyebrow">SATU IDEA, BEBERAPA AYAT</span><h2>${e(task.title)}</h2><p>${e(task.prompt)}</p>${list(pack.difficultyProfile.questions)}<div class="fields-grid">${task.fields.map((label, index) => field(label, draft.plan[`p${index}`] || "", `data-plan="p${index}"`, "Catatan ringkas kamu…")).join("")}</div><p class="small muted">Gunakan ruang idea yang membantu kamu. Tidak semua perenggan perlu mengikut susunan yang sama.</p></section><section class="panel writing-panel">${editor(draft, { label: "Perenggan saya", rows: 9 })}</section></div><div>${vocabularySupport(pack, state)}${teacherCard("paragraph")}</div></div>`;
}
function renderLegacyEssay({ pack, draft, state }) {
  const matches = pack.writingTopics.filter(t => t.title === draft.title);
  const topic = draft.contentId ? pack.writingTopics.find(t => t.id === draft.contentId) : matches.length === 1 ? matches[0] : null;
  const options = pack.writingTopics.filter(t => t.source_type !== "essay_master")
    .map(
      (t) =>
        `<option value="${e(t.id)}" ${topic?.id === t.id ? "selected" : ""}>${e(t.title)}${t.source_type ? ` - ${t.status === "demo" ? "DEMO" : "Guru"}` : ""}</option>`,
    )
    .join("");
  const selected = pack.vocabulary.filter((w) =>
    state.selectedVocabulary.includes(w.id),
  );
  return `${topic?.source_type ? `<p class="notice">${e(provenanceLabel(topic))}. Tajuk dan panduan berasingan daripada master ejaan dan imlak.</p>` : ""}<section class="panel essay-title"><label class="field">Tajuk karangan<select id="essay-title">${!topic ? `<option value="${e(draft.contentId || draft.title)}" selected>${e(draft.title)}</option>` : ""}${options}</select></label><div><span class="mini-label">${e(topic?.genre || "Penulisan sendiri")}</span><p class="small muted">${e(pack.difficultyProfile.expectation)}</p></div></section><nav class="stage-list" aria-label="Langkah karangan">${essayStages.map((stage, i) => `<button class="stage ${draft.stage === i ? "active" : ""}" data-stage="${i}" ${draft.stage === i ? 'aria-current="step"' : ""}><span>${i + 1}</span>${e(stage)}</button>`).join("")}</nav><div class="workspace-grid"><div><section class="panel"><span class="eyebrow">LANGKAH ${draft.stage + 1}</span><h2>${e(essayStages[draft.stage])}</h2>${guidedSupport(topic, draft.stage)}${draft.stage === 0 ? `${list(topic?.questions || pack.difficultyProfile.questions)}<p class="small muted">Soalan tempatan ini membantu kamu berfikir. Cikgu AI membaca tajuk dan tulisan kamu sahaja.</p>` : ""}${draft.stage === 1 ? `<div class="fields-grid">${["Permulaan", "Idea / peristiwa", "Penutup"].map((label, index) => field(label, draft.plan[`p${index}`] || "", `data-plan="p${index}"`, "Rancang dengan kata-kata sendiri…")).join("")}</div>` : ""}${draft.stage === 2 ? `<p>Pilih perkataan di Bank Kata. Idea dan draf kamu disimpan semasa kamu mencari kata.</p><div class="chips">${selected.map((w) => `<span class="chip">${e(w.word)}</span>`).join("") || '<span class="muted">Belum ada kata dipilih.</span>'}</div><a class="button" href="#vocabulary">Buka Bank Kata & Frasa</a>` : ""}${[3, 5].includes(draft.stage) ? `<p>${e(pack.difficultyProfile.guidance)} Tulis dan baiki sendiri dalam ruang di bawah.</p>` : ""}${draft.stage === 4 ? "<p>Pilih bimbingan Cikgu AI di bawah perenggan kamu. Cadangan muncul berasingan daripada tulisan kamu.</p>" : ""}${draft.stage === 6 ? '<p>Baca semula perenggan sebelumnya. Apakah idea yang sesuai selepas itu?</p><button class="button" data-next-paragraph>Pergi ke perenggan seterusnya</button>' : ""}${draft.stage === 7 ? "<p>Baca keseluruhan tulisan. Adakah idea berkait dengan tajuk dan tersusun? Gunakan “Semak karangan saya” untuk menjana prompt semakan.</p>" : ""}<div class="stage-controls"><button class="small-button" data-stage="${Math.max(0, draft.stage - 1)}" ${draft.stage === 0 ? "disabled" : ""}>Sebelumnya</button><button class="small-button" data-stage="${Math.min(7, draft.stage + 1)}" ${draft.stage === 7 ? "disabled" : ""}>Seterusnya →</button></div></section><section class="panel writing-panel">${editor(draft, { label: "Karangan saya", rows: 14 })}<p class="small muted">Gunakan Cikgu AI pada setiap perenggan untuk bimbingan yang berkaitan.</p></section></div><div>${vocabularySupport(pack, state)}${teacherCard("essay")}</div></div>`;
}
function renderLegacyStory({ pack, draft, state }) {
  const matches = (pack.storyStarters || []).filter(t => t.title === draft.title);
  const authored = draft.contentId ? pack.storyStarters?.find(t => t.id === draft.contentId) : matches.length === 1 ? matches[0] : null;
  const legacy = pack.demo ? pack.activitySets.story : null;
  const title = authored?.title || legacy?.title || draft.title;
  const opening = authored?.starter_text || legacy?.opening || "Pembuka cerita ini tidak tersedia. Sambungan kamu kekal disimpan.";
  const choices = (pack.storyStarters || []).filter(t => t.source_type !== "essay_master").map(t => `<option value="${e(t.id)}" ${authored?.id === t.id ? "selected" : ""}>${e(t.title)} - ${t.status === "demo" ? "DEMO" : "Guru"}</option>`).join("");
  return `<div class="workspace-grid"><div><section class="panel"><span class="eyebrow">CERITA BERMULA DI SINI</span><p class="source-label">${authored ? e(provenanceLabel(authored)) : legacy ? "DEMO" : "Draf kamu"}</p>${choices ? `<label class="field">Pembuka cerita<select id="story-starter">${!authored ? `<option value="" selected>${e(draft.title)}</option>` : ""}${choices}</select></label><p class="small">Menukar pembuka membuka draf berasingan. Sambungan lama kekal disimpan.</p>` : ""}<h2>${e(title)}</h2><div class="story-opening">${e(opening)}</div>${draft.lines.map((line, i) => `<div class="story-line"><span>${i + 1}</span><p>${e(line)}</p></div>`).join("")}<details class="enrichment"><summary>Petunjuk untuk menyambung cerita</summary>${authored?.setting ? `<p>Latar: ${e(authored.setting)}</p>` : ""}${authored?.characters?.length ? list(authored.characters) : ""}${authored?.challenge ? `<p>${e(authored.challenge)}</p>` : ""}${list(authored?.vocabulary_hints || [])}${list(authored?.continuation_prompts || (legacy ? [legacy.hint] : []))}${list(pack.difficultyProfile.questions)}</details></section><section class="panel writing-panel">${editor(draft, { label: "Sambungan cerita saya", rows: 5 })}<button class="button primary" data-add-story>Tambah pada rantai cerita</button><p class="small muted">Cuba satu atau dua ayat. Sambungan terdahulu kekal disimpan.</p></section></div><div>${vocabularySupport(pack, state)}${teacherCard("story")}</div></div>`;
}

function renderWriting(context, legacyRenderer) {
  const topic = selectedWritingTopic(context.pack, context.draft);
  const view = topic?.source_type === 'essay_master'
    ? renderMasterWriting(context, topic) : legacyRenderer(context);
  return topicPicker(context.pack, context.state || {}, context.draft) + view;
}
export const renderParagraph = context => renderWriting(context, renderLegacyParagraph);
export const renderEssay = context => renderWriting(context, renderLegacyEssay);
export const renderStory = context => renderWriting(context, renderLegacyStory);
