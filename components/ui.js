export const e = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const paths = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  book: '<path d="M12 5v16M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2Z"/>',
  pencil: '<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14Z"/>',
  sprout:
    '<path d="M12 21v-9M12 14C4 15 3 9 3 5c7 0 10 3 9 9ZM12 10c0-6 4-8 9-8 0 6-3 10-9 8"/>',
  align: '<path d="M4 5h16M4 10h11M4 15h16M4 20h11"/>',
  file: '<path d="M14 2H5v20h14V7Zm0 0v6h5M8 12h8M8 16h8"/>',
  spark:
    '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4M18 4h4"/>',
  folder: '<path d="M3 20V4h7l3 3h8v13Z"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  sound:
    '<path d="m11 4-6 5H2v6h3l6 5ZM15 8a6 6 0 0 1 0 8m3-12a11 11 0 0 1 0 16"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
};
export const icon = (name, cls = "") =>
  `<svg class="icon ${cls}" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.pencil}</svg>`;
export function toast(text) {
  const region = document.querySelector("#toast");
  region.textContent = text;
  region.classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => region.classList.remove("visible"), 4500);
}
export function showModal(title, body, onClose = () => {}) {
  const modal = document.querySelector("#modal");
  if (modal.open) {
    modal._cleanup?.();
    modal._cleanup = null;
  }
  const opener = document.activeElement;
  modal.innerHTML = `<div class="dialog-heading"><div><span class="eyebrow">BAHASA MELAYU MASTERY</span><h2 id="modal-title">${e(title)}</h2></div><button class="icon-button" data-close-modal aria-label="Tutup">×</button></div>${body}`;
  modal._cleanup = onClose;
  modal.onclose = () => {
    if (modal.open) return;
    modal._cleanup?.();
    modal._cleanup = null;
    if (opener?.isConnected) opener.focus();
  };
  modal.querySelector("[data-close-modal]").onclick = () => modal.close();
  if (!modal.open) modal.showModal();
  return modal;
}
export function confirmAction(title, message, confirmLabel, action) {
  const modal = showModal(
    title,
    `<p>${e(message)}</p><div class="actions"><button class="button" id="cancel-confirm">Batal</button><button class="button primary" id="accept-confirm">${e(confirmLabel)}</button></div>`,
  );
  modal.querySelector("#cancel-confirm").onclick = () => modal.close();
  modal.querySelector("#accept-confirm").onclick = () => {
    modal.close();
    action();
  };
}
export const field = (label, value, attrs = "", placeholder = "") =>
  `<label class="field">${e(label)}<input ${attrs} value="${e(value)}" placeholder="${e(placeholder)}" maxlength="1000"></label>`;
export const list = (values) =>
  `<ul class="gentle-list">${values.map((text) => `<li>${e(text)}</li>`).join("")}</ul>`;
