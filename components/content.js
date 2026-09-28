import { renderEnrichment } from "./enrichment.js";
import { e } from "./ui.js";
import { filterItems } from "../js/curriculum-service.js";

export function unitPicker(pack, state) {
  return `<label class="field">Unit<select id="unit-select"><option value="all">Semua unit</option>${(pack.units || []).map(u => `<option value="${u.no}" ${String(state.unit) === String(u.no) ? "selected" : ""}>Unit ${u.no}${u.title ? ` · ${e(u.title)}` : ""}</option>`).join("")}</select></label>`;
}
export function themePicker(pack, state) {
  return pack.themes?.length ? `<label class="field">Tema<select id="theme-filter"><option value="all">Semua tema</option>${pack.themes.map(theme => `<option value="${e(theme)}" ${state.theme === theme ? "selected" : ""}>${e(theme)}</option>`).join("")}</select></label>` : "";
}
export function selectedItem(pack, state, draft) {
  if (draft?.itemId) return pack.items?.find(i => i.id === draft.itemId);
  return filterItems(pack.items || [], { unit: state.unit ?? "all" })[0];
}
export function stimulus(pack, state, draft, { hidden = false } = {}) {
  const item = selectedItem(pack, state, draft);
  if (!item) return "";
  const items = filterItems(pack.items, { unit: state.unit ?? "all" });
  // Keep an unfinished draft's stimulus visible even when the browse filter changes.
  if (!items.some(i => i.id === item.id)) items.unshift(item);
  const support = pack.enrichment?.[item.id];
  const word = support?.word || item.text;
  return `<section class="panel">${unitPicker(pack, state)}<label class="field">${hidden ? "Latihan" : "Bahan rangsangan"}<select id="item-select">${items.map(i => `<option value="${e(i.id)}" ${i.id === item.id ? "selected" : ""}>Unit ${i.unitNo} · Item ${i.itemNo}${hidden ? "" : ` · ${e(pack.enrichment?.[i.id]?.word || i.text)}`}</option>`).join("")}</select></label>${hidden ? "" : `<span class="mini-label">${item.type === "imlak" ? "Kata / frasa fokus" : item.form === "phrase" ? "Frasa / entri berbilang perkataan" : "Perkataan"}</span><blockquote>${e(word)}</blockquote><button class="small-button" data-speak="${e(word)}">Dengar kata / frasa</button>${renderEnrichment(support, { activity: draft?.activity })}`}<p class="small muted">${e(item.id)}${item.theme ? ` · ${e(item.theme)}` : ""}. Menukar unit tidak memadam draf. Pilih item untuk membuka drafnya; draf lama kekal disimpan.</p></section>`;
}
