import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createSpeechService,
  selectMalayVoice,
  RATE_KEY,
  NATURAL_RATE,
} from "../js/speech-service.js";
import { activityRegistry } from "../activities/registry.js";
import { renderHome, renderDrafts } from "../components/home.js";
import { getCurriculumPack as loadCurriculumPack } from "../js/curriculum-service.js";
import { createStore } from "../js/state.js";
import { vocabularyCards } from "../activities/vocabulary.js";
import { e } from "../components/ui.js";
const getCurriculumPack = (year, id = "demo") => loadCurriculumPack(year, id);
const fixture = () => {
  const calls = [],
    status = [];
  const environment = {
    SpeechSynthesisUtterance: class {
      constructor(text) {
        this.text = text;
      }
    },
    speechSynthesis: {
      getVoices: () => [{ lang: "en-US" }, { lang: "ms-MY" }],
      speak: (utterance) => calls.push(utterance),
      cancel() {},
      pause() {},
      resume() {},
    },
    localStorage: {
      getItem: () => null,
      setItem: (key, value) => calls.push({ key, value }),
    },
  };
  return {
    environment,
    calls,
    status,
    speech: createSpeechService({
      environment,
      onChange: (s) => status.push(s),
    }),
  };
};
test("speech selects Malaysian Malay, then another Malay voice, then browser fallback", () => {
  assert.equal(
    selectMalayVoice([{ lang: "en-US" }, { lang: "ms-SG" }, { lang: "ms-MY" }])
      .lang,
    "ms-MY",
  );
  assert.equal(selectMalayVoice([{ lang: "ms-SG" }]).lang, "ms-SG");
  assert.equal(selectMalayVoice([{ lang: "en-US" }]), null);
});
test("speech queues BM sentences with highlighting callbacks, pause/resume/stop", () => {
  const { speech, calls, status } = fixture(),
    starts = [];
  assert.equal(
    speech.speak("Ali bermain. Saya membaca!", {
      onSentence: (index) => starts.push(index),
    }),
    true,
  );
  assert.equal(calls[0].lang, "ms-MY");
  assert.equal(calls[0].voice.lang, "ms-MY");
  assert.deepEqual(starts, [0]);
  assert.equal(speech.pause(), true);
  assert.equal(status.at(-1).paused, true);
  assert.equal(speech.resume(), true);
  calls[0].onend();
  assert.deepEqual(starts, [0, 1]);
  assert.equal(calls[1].text, "Saya membaca!");
  calls[1].onend();
  assert.equal(status.at(-1).speaking, false);
  speech.speak("Ayat baharu. Ayat kedua.");
  const old = calls.at(-1);
  speech.stop();
  old.onend();
  assert.equal(calls.at(-1), old);
});
test("missing Malay voice keeps ms-MY language and leaves voice unassigned", () => {
  const { speech, environment, calls } = fixture();
  environment.speechSynthesis.getVoices = () => [{ lang: "en-US" }];
  speech.speak("Rakan saya.");
  assert.equal(calls[0].lang, "ms-MY");
  assert.equal(calls[0].voice, undefined);
});
test("speech failures and unavailable storage never break learning", () => {
  assert.equal(
    createSpeechService({ environment: {} }).speak("Ayat saya."),
    false,
  );
  const { speech, environment, status } = fixture();
  environment.localStorage.setItem = () => {
    throw new Error("denied");
  };
  speech.setRate(0.75);
  assert.equal(speech.rate, 0.75);
  assert.ok(RATE_KEY.startsWith("bmMastery:"));
  environment.speechSynthesis.speak = () => {
    throw new Error("unavailable");
  };
  let errors = 0;
  assert.equal(speech.speak("Ayat saya.", { onError: () => errors++ }), false);
  assert.equal(errors, 1);
  assert.equal(status.at(-1).speaking, false);
  environment.speechSynthesis.cancel = () => {
    throw new Error("failed");
  };
  assert.doesNotThrow(() => speech.stop());
});
test("speech ignores blank input and persists valid speeds", () => {
  const { speech, calls } = fixture();
  assert.equal(speech.speak("  "), false);
  speech.setRate(1.25);
  assert.deepEqual(calls[0], { key: RATE_KEY, value: "1.25" });
  speech.speak("Saya membaca.");
  assert.equal(calls.at(-1).rate, 1.25 * NATURAL_RATE);
  speech.setRate(99);
  assert.equal(speech.rate, 1);
});
test("all activity engines render across all six years without embedding undefined content", () => {
  for (let year = 1; year <= 6; year++) {
    const storage = { getItem: () => null, setItem() {} },
      store = createStore({ storage });
    store.setYear(year);
    const pack = getCurriculumPack(year);
    for (const [activity, spec] of Object.entries(activityRegistry)) {
      if (activity === "practice") continue; // Real workbook practice is covered in phase2.test.mjs.
      const title =
        activity === "essay"
          ? pack.writingTopics[0].title
          : pack.activitySets[spec.task]?.title;
      const draft =
        activity === "vocabulary" ? null : store.draft(activity, title, pack);
      const html = spec.render({ pack, draft, state: store.state });
      assert.ok(html.length > 100);
      assert.ok(!html.includes("undefined"), `${activity} year ${year}`);
      if (draft) assert.ok(html.includes('id="student-text"'));
      if (activity === "essay")
        for (let stage = 0; stage < 8; stage++) {
          draft.stage = stage;
          assert.ok(
            !spec
              .render({ pack, draft, state: store.state })
              .includes("undefined"),
          );
        }
    }
    assert.ok(
      renderHome({ pack, state: store.state }).includes(`Tahun ${year}`),
    );
    assert.ok(renderDrafts({ state: store.state }).includes("Belum ada draf"));
  }
});
test("pupil text is HTML-escaped in editors, drafts, original sentences and story lines", () => {
  const store = createStore({ storage: { getItem: () => null, setItem() {} } }),
    pack = getCurriculumPack(1);
  const attack = "</textarea><script>alert(1)</script>";
  for (const activity of [
    "sentence",
    "expansion",
    "paragraph",
    "essay",
    "story",
  ]) {
    const draft = store.draft(activity, pack.writingTopics[0].title, pack);
    store.updateDraft(draft.id, {
      text: attack,
      original: attack,
      lines: [attack],
      fields: { who: attack },
      plan: { p0: attack },
    });
    const html = activityRegistry[activity].render({
      pack,
      draft,
      state: store.state,
    });
    assert.ok(!html.includes("<script>"));
    assert.ok(html.includes(e(attack)));
  }
  assert.ok(!renderDrafts({ state: store.state }).includes("<script>"));
});
test("vocabulary search/theme filtering and selected words are data-driven", () => {
  const pack = getCurriculumPack(1),
    state = { theme: "all", selectedVocabulary: ["demo-rakan"] };
  const match = vocabularyCards(pack, state, "rakan");
  assert.ok(match.includes("Kata dipilih"));
  assert.ok(
    vocabularyCards(pack, state, "not-a-word").includes("Tiada kata ditemui"),
  );
  const theme = vocabularyCards(pack, { ...state, theme: "Alam Sekitar" });
  assert.ok(theme.includes("taman"));
  assert.ok(!theme.includes("<h2>rakan</h2>"));
});
test("starting a fresh draft preserves all earlier writing", () => {
  const store = createStore({ storage: { getItem: () => null, setItem() {} } }),
    pack = getCurriculumPack(1);
  const first = store.draft("essay", "Tajuk", pack);
  store.updateDraft(first.id, { text: "Tulisan pertama." });
  const second = store.draft("essay", "Tajuk", pack, { fresh: true });
  assert.notEqual(second.id, first.id);
  assert.equal(store.state.drafts[first.id].text, "Tulisan pertama.");
  assert.equal(store.draft("essay", "Tajuk", pack).id, second.id);
});
