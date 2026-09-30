import { checkWritingBasics } from "./local-writing-check.js";
import { selectedItem } from "../components/content.js";
import { compareTranscription } from "./transcription.js";
import { appConfig, labels, navigation } from "./config.js";
import { createStore } from "./state.js";
import { getCurriculumPack } from "./curriculum-service.js";
import { createAIService } from "./ai-teacher.js";
import { executionMode } from "./tutor-actions.js";
import { createSpeechService } from "./speech-service.js";
import {
  draftText,
  exportDraft,
  sentencePreview,
  writingCounts,
} from "./learning-service.js";
import { e, icon, toast, confirmAction } from "../components/ui.js";
import { openTeacher } from "../components/ai-teacher.js";
import { copyWithConfirmation } from "../components/clipboard.js";
import { renderHome, renderDrafts } from "../components/home.js";
import { activityRegistry } from "../activities/registry.js";
import { vocabularyCards } from "../activities/vocabulary.js";
import { watchForDeploymentUpdate } from "./deployment-version.js";
import { writingTopicsFor } from "./essay-service.js";
import { topicResults, revisionHistory } from "../components/essay-catalog.js";
import { essayParagraphs, combineEssay, buildEssayParagraphContext, MAX_ESSAY_TEXT } from './essay-paragraphs.js';

const store = createStore(),
  ai = createAIService();
let pack,
  draft,
  updateAvailable = false,
  paragraphSelection = "";
const speech = createSpeechService({
  onChange: (status) => {
    store.runtime.speech = status;
    document.querySelectorAll("[data-speech]").forEach((button) => {
      button.disabled =
        button.dataset.speech === "pause"
          ? !status.speaking || status.paused
          : button.dataset.speech === "resume"
            ? !status.paused
            : !status.speaking;
    });
  },
});
const currentRoute = () => {
  const route = location.hash.slice(1);
  return navigation.some((item) => item.id === route)
    ? route
    : store.state.activity;
};
function status() {
  document.querySelectorAll("[data-save-status]").forEach((el) => {
    el.textContent = store.persistent ? `✓ ${labels.saved}` : labels.temporary;
    el.classList.toggle("storage-warning", !store.persistent);
  });
  const updateButton = document.querySelector("[data-update]");
  if (updateButton) updateButton.disabled = !store.persistent;
}
store.subscribe(status);
function prepare() {
  pack = getCurriculumPack(store.state.year, appConfig.curriculum);
  draft = null;
  paragraphSelection = "";
  const route = store.state.activity,
    spec = activityRegistry[route];
  if (spec && route !== "vocabulary") {
    const existing = store.state.drafts[store.state.activeDrafts[`${store.state.year}:${route}`]];
    if (route === "essay") {
      const id = store.state.selectedEssayContent[store.state.year] || existing?.contentId;
      const title = store.state.selectedEssayTitle[store.state.year] || existing?.title;
      const matches = pack.writingTopics.filter(t => t.title === title);
      const topic = (id ? pack.writingTopics.find(t => t.id === id) : matches.length === 1 ? matches[0] : null) || (!title && !id ? pack.writingTopics[0] : null);
      const chosenTitle = topic?.title || title || "Karangan saya";
      store.selectTitle(chosenTitle, topic?.id || id || "");
      draft = store.draft(route, chosenTitle, pack, { contentId: topic?.id || id || "" });
    } else if (route === "story" || route === "paragraph") {
      const topics = writingTopicsFor(pack, route);
      const matches = topics.filter(t => t.title === existing?.title);
      const starter = existing ? (existing.contentId ? topics.find(t => t.id === existing.contentId)
        : matches.length === 1 ? matches[0] : null) : topics[0];
      draft = store.draft(route, existing?.title || starter?.title || (route === 'paragraph' ? pack.activitySets.paragraph.title : "Cerita saya"), pack,
        { contentId: existing?.contentId || starter?.id || "" });
    } else {
      const title = pack.activitySets[spec.task].title;
      const item = ["sentence", "expansion", "practice"].includes(route) ? selectedItem(pack, store.state, existing) : null;
      draft = store.draft(route, title, pack, { itemId: existing ? existing.itemId || "" : item?.id || "" });
    }
  }
}
function render() {
  prepare();
  const state = store.state,
    route = state.activity,
    nav = navigation.find((n) => n.id === route);
  document.title = `${nav.label} · ${appConfig.name}`;
  const context = { pack, state, draft, speechStatus: speech.availability() };
  let view =
    route === "home"
      ? renderHome(context)
      : route === "drafts"
        ? renderDrafts(context)
        : activityRegistry[route].render(context);
  if (draft?.curriculumId === "demo")
    view = '<p class="notice">Draf ini bermula dalam DEMO Fasa 1. Tulisan asal kamu kekal disimpan.</p>' + view;
  document.querySelector("#app").innerHTML =
    `<aside class="sidebar"><a class="brand" href="#home"><span class="brand-icon">${icon("book")}</span><span>Bahasa Melayu<strong>Mastery<span class="brand-dot">.</span></strong></span></a><div class="sidebar-caption">RUANG BELAJAR KAMU</div><nav aria-label="Navigasi utama">${navigation.map((n) => `<a class="nav-item ${n.id === route ? "active" : ""}" href="#${n.id}" ${n.id === route ? 'aria-current="page"' : ""}>${icon(n.icon)}<span>${e(n.label)}</span>${n.id === route ? '<span class="nav-dot"></span>' : ""}</a>`).join("")}</nav><div class="sidebar-bottom"><div class="sidebar-quote">${icon("sprout")}<p>Idea kamu berharga.<br><strong>Mari kembangkannya.</strong></p></div><div class="sidebar-footer"><span class="tiny-dot"></span> ${appConfig.subtitle}</div></div></aside><div class="main-shell"><header class="topbar"><span class="breadcrumb">Ruang belajar <span>/</span> <strong>${e(nav.label)}</strong></span><div class="topbar-right"><span class="demo-tag">MASTER 2026</span><label class="year-select">Tahun pembelajaran<select id="year-select" aria-label="Pilih tahun pembelajaran">${appConfig.years.map((y) => `<option value="${y.year}" ${state.year === y.year ? "selected" : ""}>${y.label}</option>`).join("")}</select></label><span class="profile-icon" aria-label="Murid">M</span></div></header>${updateAvailable ? '<div class="update-banner" role="status">Versi baharu tersedia. Draf kamu kekal disimpan. <button class="small-button" data-update>Muat semula apabila bersedia</button></div>' : ""}<main id="main" tabindex="-1">${route !== "home" ? `<div class="page-heading"><div><span class="eyebrow">TAHUN ${state.year} · ${route === "drafts" ? "IDEA MILIK KAMU" : "BELAJAR SELANGKAH DEMI SELANGKAH"}</span><h1>${e(nav.label)}</h1><p>${e(nav.description || "Sambung menulis, bila-bila masa kamu bersedia.")}</p></div>${draft ? `<div class="actions"><button class="button" data-new-draft>Draf baharu</button><button class="button" data-export="${e(draft.id)}">Muat turun draf</button></div>` : ""}</div>` : ""}${view}<footer class="page-footer"><span>${icon("sprout")} Belajar berfikir. Berani menulis.</span><span>Ejaan & Imlak 2026 - Penulisan sendiri</span></footer><p class="global-save small" data-save-status aria-live="polite"></p></main></div>`;
  status();
  bind();
  const rate = document.querySelector("#speech-rate");
  if (rate) rate.value = String(speech.rate);
  document
    .querySelectorAll("[data-speech]")
    .forEach((button) => (button.disabled = true));
  if (!speech.supported())
    document
      .querySelectorAll("[data-speak], [data-read-writing]")
      .forEach((button) => {
        button.disabled = true;
        button.title = "Bacaan suara tidak tersedia dalam pelayar ini.";
      });
}
function updateWritingUI() {
  if (!draft) return;
  const count = writingCounts(draft.text),
    target = document.querySelector("#writing-count");
  if (target)
    target.textContent = `${count.words} perkataan · ${count.sentences} ayat`;
  if (draft.activity === 'essay') {
    const preview = document.querySelector('#student-text');
    if (preview) preview.value = draft.text;
    const copyButton = document.querySelector('[data-copy-combined-essay]');
    if (copyButton) copyButton.disabled = !draft.text.trim();
  }
}
function write(changes) {
  draft = store.updateDraft(draft.id, changes);
  updateWritingUI();
}
function refreshWords() {
  document.querySelector("#word-results").innerHTML = vocabularyCards(
    pack,
    store.state,
    document.querySelector("#word-search").value,
  );
}
function refreshWritingTopics() {
  const target = document.querySelector('#writing-topic-results');
  if (target && draft) target.innerHTML = topicResults(pack, store.state, draft);
}
function download(id) {
  const saved = store.state.drafts[id];
  if (!saved) return;
  const url = URL.createObjectURL(
    new Blob([exportDraft(saved)], { type: "text/plain;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `BM-Tahun-${saved.year}-${saved.id}.txt`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function read(text) {
  const target = document.querySelector("#speech-current");
  const clear = () => {
    if (target) target.textContent = "";
  };
  if (
    !speech.speak(text, {
      onSentence: (_, sentence) => {
        if (target) target.textContent = `Sedang dibaca: ${sentence}`;
      },
      onEnd: clear,
      onError: () => {
        clear();
        toast("Bacaan suara tidak tersedia. Kamu boleh terus menulis.");
      },
    })
  )
    toast("Bacaan suara tidak tersedia atau teks masih kosong.");
}
function currentEditorText() {
  const editor = document.querySelector("#student-text");
  const savedText = draft?.text || "";
  // Input events save immediately; retain that value if a non-browser boundary
  // exposes an empty placeholder node instead of the real editor value.
  return editor && (editor.value || !savedText) ? editor.value : savedText;
}
function liveEssayParagraphs() {
  return essayParagraphs(draft).map((text, i) => {
    const area = document.querySelector(`#essay-paragraph-${i + 1}`);
    return area?.dataset.essayParagraph === String(i + 1) ? area.value : text;
  });
}
function liveCombinedEssay() {
  return combineEssay(liveEssayParagraphs()).trim();
}
function syncEssayEditors() {
  const paragraphs = liveEssayParagraphs();
  if (combineEssay(paragraphs).length > MAX_ESSAY_TEXT) {
    toast('Karangan melebihi had 16,000 aksara. Pendekkan tulisan sebelum meminta bimbingan.');
    return false;
  }
  if (JSON.stringify(paragraphs) !== JSON.stringify(draft.paragraphs)) write({ paragraphs });
  return true;
}
function aiRequest(action, word, paragraphIndex, promptButton) {
  if (!word && draft?.activity === 'essay' && !syncEssayEditors()) return;
  const editorText = word ? "" : draft?.activity === 'essay' ? draft.text : currentEditorText();
  if (!word && draft && editorText !== draft.text)
    draft = store.updateDraft(draft.id, { text: editorText });
  const latestText = word
    ? ""
    : draft?.activity === "story"
      ? [...draft.lines, editorText].filter(Boolean).join("\n\n")
      : editorText;
  const studentText =
    word?.word ||
    (action === "paragraph_review" && store.state.activity === "essay" && !paragraphIndex
      ? paragraphSelection || latestText
      : latestText);
  const essayPromptOnly = draft?.activity === 'essay' && (promptButton || executionMode(action) === 'prompt');
  if (!word && !essayPromptOnly && ['essay', 'paragraph', 'story'].includes(draft?.activity) && latestText.trim()) {
    preserveWritingVersion();
    const history = document.querySelector('#writing-revisions');
    if (history) history.outerHTML = revisionHistory(draft);
  }
  const request = {
      action,
      activity: word ? "vocabulary" : store.state.activity,
      year: store.state.year,
      title: word
        ? ""
        : store.state.activity === "essay"
          ? store.state.selectedEssayTitle?.[store.state.year] || draft.title
          : draft.title,
      studentText,
      ...(draft?.contentId && ["essay", "story"].includes(store.state.activity) ? { contentId: draft.contentId } : {}),
      ...(store.state.activity === "essay" ? { stage: draft.stage } : {}),
      itemId: word?.id || draft?.itemId || "",
      ...(word || !["sentence", "expansion"].includes(store.state.activity) ? {} : { referenceText: selectedItem(pack, store.state, draft)?.text || "" }),
      ...(!word && draft?.activity === 'essay' && paragraphIndex
        ? buildEssayParagraphContext({ title: store.state.selectedEssayTitle[store.state.year] || draft.title,
            year: store.state.year, paragraphIndex, paragraphs: essayParagraphs(draft) }) : {}),
    };
  if (promptButton) {
    try {
      return copyWithConfirmation(promptButton, ai.externalPrompt(request))
        .catch(() => toast('Tidak dapat menyalin sekarang. Cuba lagi.'));
    } catch (error) { toast(error.message); return; }
  }
  openTeacher({ service: ai, store, request });
}
function preserveWritingVersion() {
  const saved = store.snapshotDraft(draft.id);
  if (!saved) toast('Versi tersimpan sudah penuh (20). Muat turun draf untuk menyimpan tulisan semasa sebelum membaiki.');
  return saved;
}
function rememberParagraph() {
  const editor = document.querySelector("#student-text");
  if (!editor) return;
  const { value, selectionStart: start, selectionEnd: end } = editor;
  if (end > start) paragraphSelection = value.slice(start, end);
  else {
    const from = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1,
      next = value.indexOf("\n", start);
    paragraphSelection = value.slice(from, next < 0 ? value.length : next);
  }
}
function bind() {
  const root = document.querySelector("#app");
  root.oninput = (event) => {
    const target = event.target;
    if (target.dataset.essayParagraph && draft?.activity === 'essay') {
      const index = Number(target.dataset.essayParagraph) - 1;
      if (!Number.isInteger(index) || index < 0 || index > 3) return;
      const paragraphs = essayParagraphs(draft);
      paragraphs[index] = target.value;
      if (combineEssay(paragraphs).length > MAX_ESSAY_TEXT) {
        target.value = essayParagraphs(draft)[index];
        toast('Ruang tulisan telah penuh (16,000 aksara). Muat turun draf sebelum memendekkan tulisan.');
        return;
      }
      write({ paragraphs });
      const feedback = document.querySelector('#local-feedback');
      if (feedback) feedback.textContent = '';
    }
    if (target.dataset.draftField === "text" && draft?.activity !== 'essay') {
      write({ text: target.value });
      const localFeedback = document.querySelector("#local-feedback");
      if (localFeedback) localFeedback.textContent = "";
      rememberParagraph();
    }
    if (store.state.activity === "practice" && target.dataset.draftField === "text") {
      document.querySelector('[aria-live="polite"]').textContent = "";
      document.querySelector("[data-practice-vocabulary]")?.remove();
    }
    if (target.dataset.scaffold) {
      write({
        fields: { ...draft.fields, [target.dataset.scaffold]: target.value },
      });
      document.querySelector("#sentence-preview").textContent =
        sentencePreview(draft.fields) || "Idea kamu akan muncul di sini.";
    }
    if (target.dataset.plan)
      write({ plan: { ...draft.plan, [target.dataset.plan]: target.value } });
    if (target.id === "original-input")
      write({ fields: { ...draft.fields, originalDraft: target.value } });
    if (target.id === "word-search") refreshWords();
    if (target.dataset.writingFilter === 'query') {
      store.setWritingFilter(store.state.activity, 'query', target.value);
      refreshWritingTopics();
    }
  };
  root.onchange = (event) => {
    const target = event.target;
    if (target.dataset.writingFilter && target.dataset.writingFilter !== 'query') {
      store.setWritingFilter(store.state.activity, target.dataset.writingFilter, target.value);
      refreshWritingTopics();
    }
    if (target.id === 'writing-topic-select' && target.value) {
      const topic = writingTopicsFor(pack, store.state.activity).find(t => t.id === target.value);
      if (topic) {
        speech.stop(); ai.clearCache();
        if (store.state.activity === 'essay') store.selectTitle(topic.title, topic.id);
        store.draft(store.state.activity, topic.title, pack, { contentId: topic.id });
        render();
      }
    }
    if (target.id === "year-select") {
      const next = Number(target.value);
      if (next === store.state.year) return;
      target.value = String(store.state.year);
      confirmAction(
        `Beralih ke Tahun ${next}?`,
        "Draf tahun ini kekal disimpan. Kamu boleh menyambungnya melalui Draf Saya.",
        "Tukar tahun",
        () => {
          speech.stop();
          store.setYear(next);
          render();
        },
      );
    }
    if (target.id === "unit-select") {
      speech.stop();
      store.setUnit(target.value);
      render();
    }
    if (target.id === "item-select") {
      speech.stop();
      ai.clearCache();
      store.draft(draft.activity, draft.title, pack, { itemId: target.value });
      render();
    }
    if (target.dataset.detail) write({ plan: { ...draft.plan, [target.dataset.detail.replaceAll(" ", "_")]: target.checked ? "yes" : "" } });
    if (target.id === "essay-title") {
      speech.stop();
      const topic = pack.writingTopics.find(t => t.id === target.value);
      store.selectTitle(topic?.title || target.value, topic?.id || "");
      ai.clearCache();
      render();
    }
    if (target.id === "story-starter") {
      const starter = pack.storyStarters.find(t => t.id === target.value);
      if (starter) {
        speech.stop(); ai.clearCache();
        store.draft("story", starter.title, pack, { contentId: starter.id });
        render();
      }
    }
    if (target.id === "theme-filter") {
      store.setTheme(target.value);
      if (store.state.activity === "vocabulary") refreshWords();
      else render();
    }
    if (target.id === "speech-rate") speech.setRate(target.value);
  };
  const editor = document.querySelector("#student-text");
  if (editor) {
    editor.onselect = rememberParagraph;
    editor.onkeyup = rememberParagraph;
    editor.onclick = rememberParagraph;
    editor.onblur = rememberParagraph;
  }
  root.onclick = (event) => {
    const button = event.target.closest("button");
    if (!button || button.disabled) return;
    const d = button.dataset;
    if ('hideExample' in d) {
      const disclosure = button.closest('[data-essay-example]');
      if (disclosure) { disclosure.open = false; disclosure.querySelector('summary').focus(); }
    }
    if ('resetWritingFilters' in d) {
      store.resetWritingFilters(store.state.activity);
      render();
    }
    if ('reloadEssays' in d) {
      if (store.persist()) location.reload();
      else toast(labels.temporary);
    }
    if ('saveWritingVersion' in d) {
      if (store.snapshotDraft(draft.id)) render();
      else toast('Tulis dahulu. Maksimum 20 versi; muat turun draf jika ruang versi sudah penuh.');
    }
    if ("localCheck" in d) {
      const { messages } = checkWritingBasics(draft.text);
      document.querySelector("#local-feedback").innerHTML = messages.length
        ? `<ul>${messages.map(message => `<li>${e(message)}</li>`).join("")}</ul>`
        : "Tiada isu dikesan oleh semakan asas ini. Makna dan tatabahasa belum dinilai.";
    }
    if ("practicePlay" in d) {
      const item = selectedItem(pack, store.state, draft);
      const unavailable = () => {
        document.querySelector("#practice-speech-status").textContent = "Bacaan suara gagal. Pilih Lihat jawapan untuk latihan visual atau minta bantuan guru.";
      };
      if (!speech.speak(item.text, { onError: unavailable })) unavailable();
    }
    if ("practiceReveal" in d) {
      store.practice(draft.itemId, { revealed: true });
      render();
    }
    if ("practiceReset" in d) {
      speech.stop();
      store.practice(draft.itemId, { revealed: false });
      store.draft(draft.activity, draft.title, pack, { fresh: true, itemId: draft.itemId, contentId: draft.contentId });
      render();
    }
    if ("practiceCheck" in d) {
      if (!draft.text.trim()) { toast("Taip percubaan kamu dahulu."); return; }
      const feedback = compareTranscription(selectedItem(pack, store.state, draft).text, draft.text);
      const progress = store.state.practice[draft.itemId] || { attempts: 0 };
      store.practice(draft.itemId, { attempts: progress.attempts + 1, correct: feedback.correct,
        independentCorrect: progress.independentCorrect || (feedback.correct && !progress.revealed) });
      write({ fields: { ...draft.fields, feedback: JSON.stringify(feedback), checkedText: draft.text } });
      render();
    }
    if (d.ai) aiRequest(d.ai, undefined, d.aiParagraph ? Number(d.aiParagraph) : undefined);
    if (d.janaPrompt) return aiRequest(d.janaPrompt, undefined, Number(d.promptParagraph), button);
    if ('copyCombinedEssay' in d) {
      const text = liveCombinedEssay();
      if (!text) {
        toast('Tulis karangan dahulu sebelum menyalin.');
        return;
      }
      return copyWithConfirmation(button, text).catch(() => toast('Tidak dapat menyalin sekarang. Cuba lagi.'));
    }
    if (d.wordAi || d.wordExample) {
      const word = pack.vocabulary.find(
        (w) => w.id === (d.wordAi || d.wordExample),
      );
      aiRequest(d.wordAi ? "word_explanation" : "example_sentence", word);
    }
    if (d.selectWord) {
      store.selectVocabulary(d.selectWord);
      refreshWords();
      toast("Kata ditambah pada pilihan kamu.");
    }
    if (d.speak) read(d.speak);
    if ("readWriting" in d) read(draftText(draft));
    if (d.speech) {
      speech[d.speech]();
      if (d.speech === "stop")
        document.querySelector("#speech-current").textContent = "";
    }
    if (d.resume) {
      speech.stop();
      store.resume(d.resume);
      location.hash = store.state.activity;
      render();
    }
    if (d.delete)
      confirmAction(
        "Padam draf ini?",
        "Draf ini akan dipadam daripada peranti ini. Tindakan ini tidak boleh dibatalkan.",
        "Padam draf",
        () => {
          store.deleteDraft(d.delete);
          render();
          toast("Draf dipadam.");
        },
      );
    if (d.export) download(d.export);
    if ("newDraft" in d) {
      speech.stop();
      store.draft(draft.activity, draft.title, pack, { fresh: true, itemId: draft.itemId, contentId: draft.contentId });
      render();
      toast("Draf baharu dibuka. Draf terdahulu kekal dalam Draf Saya.");
    }
    if ("usePreview" in d) {
      const value = sentencePreview(draft.fields);
      if (!value) {
        toast("Isi satu idea dahulu.");
        return;
      }
      const apply = () => {
        write({ text: value });
        render();
      };
      if (draft.text.trim())
        confirmAction(
          "Gunakan gabungan idea?",
          "Ini menggantikan teks di ruang Penulisan saya dengan gabungan idea kamu.",
          "Gunakan",
          apply,
        );
      else apply();
    }
    if ("lockOriginal" in d || "demoOriginal" in d) {
      const original =
        "demoOriginal" in d
          ? pack.activitySets.expansion.original
          : document.querySelector("#original-input").value.trim();
      if (!original) {
        toast("Tulis ayat asal dahulu.");
        return;
      }
      write({ original, ...(draft.text ? {} : { text: original }) });
      render();
    }
    if (d.stage !== undefined) {
      if (Number(d.stage) === 5 && draft.stage !== 5 && draft.text.trim()) preserveWritingVersion();
      write({ stage: Number(d.stage) });
      render();
    }
    if ("nextParagraph" in d) {
      if (draft.activity === 'essay') {
        const paragraphs = essayParagraphs(draft);
        const next = paragraphs.findIndex(p => !p.trim());
        document.querySelector(`#essay-paragraph-${next < 0 ? 4 : next + 1}`)?.focus();
        return;
      }
      if (draft.text.length > 15998) {
        toast(
          "Ruang tulisan telah penuh. Muat turun draf sebelum memulakan tulisan baharu.",
        );
        return;
      }
      write({ text: draft.text.trimEnd() + "\n\n" });
      render();
      document.querySelector("#student-text").focus();
    }
    if ("addStory" in d) {
      if (!draft.text.trim()) {
        toast("Tulis sambungan cerita dahulu.");
        return;
      }
      if (draft.lines.length >= 30) {
        toast("Rantai demo sudah penuh. Muat turun cerita kamu.");
        return;
      }
      if (draft.text.length > 4000) {
        toast("Pendekkan sambungan kepada 4,000 aksara atau kurang.");
        return;
      }
      write({ lines: [...draft.lines, draft.text.trim()], text: "" });
      render();
    }
    if ("update" in d) {
      if (store.persist()) location.reload();
      else toast(labels.temporary);
    }
  };
}
window.addEventListener("hashchange", () => {
  if (location.hash === "#main") {
    document.querySelector("#main").focus();
    return;
  }
  speech.stop();
  document.querySelector("#modal").close();
  store.navigate(currentRoute());
  render();
  window.scrollTo(0, 0);
  document.querySelector("#main").focus({ preventScroll: true });
});
window.addEventListener("pagehide", () => {
  store.persist();
  speech.stop();
});
store.navigate(currentRoute());
render();
watchForDeploymentUpdate(() => {
  updateAvailable = true;
  // Insert a notice without re-rendering or moving the pupil's caret.
  if (!document.querySelector(".update-banner"))
    document
      .querySelector(".topbar")
      .insertAdjacentHTML(
        "afterend",
        '<div class="update-banner" role="status">Versi baharu tersedia. Draf kamu kekal disimpan. <button class="small-button" data-update>Muat semula apabila bersedia</button></div>',
      );
  status();
});
