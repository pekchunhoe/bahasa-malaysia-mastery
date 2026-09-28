export const sentences = (text) =>
  String(text || "")
    .match(/[^.!?\n]+(?:[.!?]+|$)/gu)
    ?.map((s) => s.trim())
    .filter(Boolean) || [];
export function writingCounts(text) {
  return {
    words:
      String(text || "").match(/[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*/gu)
        ?.length || 0,
    sentences: sentences(text).length,
  };
}
export function sentencePreview(fields) {
  const text = ["who", "action", "where", "when", "how", "why"]
    .map((key) => fields[key]?.trim())
    .filter(Boolean)
    .join(" ");
  return text
    ? text[0].toLocaleUpperCase("ms") +
        text.slice(1).replace(/[.!?]+$/, "") +
        "."
    : "";
}
export function hasWriting(draft) {
  return Boolean(
    draft.text.trim() ||
    draft.original.trim() ||
    draft.lines.some((x) => x.trim()) ||
    Object.values(draft.fields).some((x) => x.trim()) ||
    Object.values(draft.plan).some((x) => x.trim()),
  );
}
export const draftText = (draft) =>
  draft.activity === "story"
    ? [...draft.lines, draft.text].filter(Boolean).join("\n\n")
    : draft.text;
export function exportDraft(draft) {
  return `${draft.title}\nTahun ${draft.year}\n\n${draft.original ? `Ayat asal: ${draft.original}\n\n` : ""}${draftText(draft)}\n\nCatatan saya:\n${Object.values(draft.plan).filter(Boolean).join("\n")}\n${Object.values(draft.fields).filter(Boolean).join(" | ")}`;
}
