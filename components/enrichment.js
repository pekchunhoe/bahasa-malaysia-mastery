import { e, list } from "./ui.js";

export function provenanceLabel(record) {
  if (record?.source_type === "demo" || record?.status === "demo")
    return "DEMO · Contoh bahan tambahan, belum disemak guru";
  if (record?.source_type === "teacher_authored")
    return record.status === "reviewed" ? "Bahan tambahan guru · Disemak" : "Bahan tambahan guru · Draf";
  if (record?.source_type === "reviewed_source") return "Teks sumber disahkan";
  if (record?.source_type === "pupil") return "Tulisan murid";
  if (record?.content_source === "ai_generated" && record?.status === "diluluskan" && record?.pengesahan === "pukal_oleh_pengguna")
    return "Dijana AI · Diluluskan secara pukal oleh pengguna";
  if (record?.source_type === "ai_generated") return "Bantuan dijana AI · Belum disemak guru";
  return "Sumber belum dinyatakan";
}
export function renderEnrichment(record, { bank = false, activity = "sentence" } = {}) {
  if (!record || record.status === "draft") return "";
  const meaning = record.simple_definition || record.meaning;
  const example = record.example_sentence_simple || record.example_sentence;
  const hint = activity === "expansion" ? record.expansion_hint : record.sentence_hint;
  if (!meaning && !example && !hint && !record.grammatical_category && !record.opposite_word && !record.related_words?.length) return "";
  const body = `<p class="small source-label">${e(provenanceLabel(record))}</p><dl>${meaning ? `<dt>Maksud</dt><dd>${e(meaning)}</dd>` : ""}${record.grammatical_category ? `<dt>Kategori kata</dt><dd>${e(record.grammatical_category)}</dd>` : ""}${record.root_word ? `<dt>Kata dasar</dt><dd>${e(record.root_word)}</dd>` : ""}${record.opposite_word ? `<dt>Kata berlawanan</dt><dd>${e(record.opposite_word)}</dd>` : ""}</dl>${record.related_words?.length ? `<p>Kata berkaitan:</p>${list(record.related_words)}` : ""}${!bank && hint ? `<p>${e(hint)}</p>` : ""}`;
  const exampleBody = example ? `<blockquote>${e(example)}</blockquote><button class="small-button" data-speak="${e(example)}">Dengar contoh</button>` : "";
  // Native disclosure is an explicit pupil request. Examples never populate editors.
  return `<div class="enrichment">${body}${example ? bank ? `<p>Contoh ayat</p>${exampleBody}` : `<details data-master-example><summary>Lihat contoh ayat</summary>${exampleBody}<p>Tulis ayat kamu sendiri. Contoh ini bukan jawapan kamu.</p></details>` : ""}</div>`;
}

export function guidedSupport(topic, stage) {
  if (!topic) return "";
  const section = (label, values) => values?.length ? `<details class="enrichment"><summary>${e(label)}</summary>${list(values)}</details>` : "";
  return `${stage === 0 && topic.prompt ? `<p>${e(topic.prompt)}</p>` : ""}${[1, 3].includes(stage) ? section("Lihat panduan perenggan", topic.paragraph_guidance) : ""}${stage === 2 ? section("Lihat bantuan kosa kata", topic.vocabulary_help) : ""}${stage === 3 ? section("Lihat permulaan ayat pilihan", topic.sentence_starters) : ""}${[5, 7].includes(stage) ? section("Senarai semak sendiri", topic.checklist) : ""}${stage === 1 ? section("Lihat rangka contoh (bukan jawapan kamu)", topic.sample_outline) : ""}${stage === 5 && topic.model_text ? `<details class="enrichment"><summary>Lihat teks contoh · ${e(provenanceLabel(topic))}</summary><p>${e(topic.model_text)}</p><p>Semak dan baiki tulisan sendiri. Contoh tidak dimasukkan ke dalam draf kamu.</p></details>` : ""}`;
}
