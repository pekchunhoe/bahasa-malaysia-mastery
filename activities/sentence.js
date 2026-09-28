import { stimulus } from "../components/content.js";
import { e, field, icon, list } from "../components/ui.js";
import { editor, teacherCard } from "../components/writing.js";
import { scaffoldFields } from "../js/config.js";
import { sentencePreview } from "../js/learning-service.js";
export function renderSentence({ pack, draft, state }) {
  const task = pack.activitySets.sentence,
    profile = pack.difficultyProfile;
  const fields = scaffoldFields.map(([key, label], index) =>
    field(
      label,
      draft.fields[key] || "",
      `data-scaffold="${key}"`,
      task.seeds[key] || "",
    ),
  );
  return `${stimulus(pack, state, draft)}<div class="workspace-grid"><div><section class="panel"><span class="eyebrow">FIKIR & BINA</span><h2>${e(task.title)}</h2><p>${e(task.prompt || (pack.year <= 3 ? "Tulis ayat asli menggunakan perkataan atau frasa yang dipilih." : "Tulis ayat baharu menggunakan kata atau frasa fokus. Pilih pelaku, tempat atau tujuan sendiri."))}</p><div class="notice">${e(profile.guidance)} Soalan ini pilihan untuk membantu idea, bukan formula wajib.</div><div class="fields-grid">${fields.slice(0, profile.fields).join("")}</div>${profile.fields < 6 ? `<details><summary>Tambah butiran pilihan</summary><div class="fields-grid">${fields.slice(profile.fields).join("")}</div></details>` : ""}<div class="preview-box"><span class="eyebrow">GABUNGAN IDEA KAMU</span><p id="sentence-preview">${e(sentencePreview(draft.fields) || "Idea kamu akan muncul di sini.")}</p><p class="small">Baca dan ubah susunan jika perlu. Ayat yang baik jelas dan bermakna.</p><button class="small-button" data-use-preview>Gunakan sebagai permulaan</button></div></section><section class="panel writing-panel">${editor(draft, { placeholder: "Siapakah yang kamu bayangkan? Apakah yang dilakukannya?" })}</section></div><div>${pack.demo ? `<section class="panel soft"><span class="eyebrow">CONTOH DEMO</span><p class="example">${e(task.examples[profile.exampleIndex])}</p><button class="text-button" data-speak="${e(task.examples[profile.exampleIndex])}">${icon("sound")} Dengar contoh</button><p class="small muted">Tulis ayat kamu sendiri. Tidak semua butiran diperlukan.</p></section>` : ""}${teacherCard("sentence")}</div></div>`;
}
export function renderExpansion({ pack, draft, state }) {
  const task = pack.activitySets.expansion;
  return `${stimulus(pack, state, draft)}<div class="workspace-grid"><div><section class="panel"><span class="eyebrow">BERMULA DENGAN SATU AYAT</span><h2>${e(task.title)}</h2><p>${pack.year <= 3 ? "Mula dengan ayat sendiri menggunakan kata atau frasa pilihan. Kemudian tambah butiran yang sesuai." : "Tulis ayat sendiri menggunakan kata atau frasa fokus, kemudian tambah butiran tempat, masa atau sebab yang sesuai."}</p>${draft.original ? `<div class="original"><span class="small">Ayat asal kamu · disimpan</span><p>${e(draft.original)}</p></div>` : `<label class="field">Ayat asal<input id="original-input" value="${e(draft.fields.originalDraft || "")}" maxlength="1000" placeholder="${e(task.original || "Tulis ayat asal kamu di sini") }"></label><div class="actions"><button class="button primary" data-lock-original>Mulakan dengan ayat saya</button>${pack.demo ? '<button class="button" data-demo-original>Guna ayat demo</button>' : ""}</div>`}<p>Pilih butiran yang membantu pembaca. Ayat yang lebih panjang tidak semestinya lebih baik.</p><div class="chips">${task.prompts.map((p) => `<label class="chip"><input type="checkbox" data-detail="${e(p)}" ${draft.plan[p.replaceAll(" ", "_")] === "yes" ? "checked" : ""}>${e(p)}</label>`).join("")}</div>${list(pack.difficultyProfile.questions)}</section><section class="panel writing-panel">${editor(draft, { label: "Ayat yang saya kembangkan" })}</section></div>${teacherCard("expansion")}</div>`;
}
