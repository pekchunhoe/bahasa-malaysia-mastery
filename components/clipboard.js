// Shared by example cards and immediate local Jana Prompt controls.
const confirmations = new WeakMap();
const copying = new WeakSet();
export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return; } catch { /* Try the local fallback. */ }
  }
  const active = document.activeElement;
  const selection = active && typeof active.selectionStart === 'number'
    ? [active.selectionStart, active.selectionEnd, active.selectionDirection] : null;
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  // Remain inside the modal's focus scope when copying from a dialog.
  const parent = active?.closest?.('dialog[open]') || document.body;
  try {
    parent.append(area);
    area.select();
    if (!document.execCommand('copy')) throw new Error('copy unavailable');
  } finally {
    area.remove();
    active?.focus();
    if (selection) active.setSelectionRange(...selection);
  }
}
export async function copyWithConfirmation(button, text) {
  if (button.disabled || copying.has(button)) return;
  const existing = confirmations.get(button);
  const state = existing || { text: button.textContent, label: button.getAttribute('aria-label') || button.textContent };
  // Keep keyboard focus on the native button while preventing duplicate writes.
  copying.add(button);
  clearTimeout(state.timer);
  confirmations.delete(button);
  if (existing) {
    button.textContent = state.text;
    button.setAttribute('aria-label', state.label);
  }
  button.setAttribute('aria-busy', 'true');
  try {
    await copyText(text);
    button.textContent = 'Disalin ✓';
    button.setAttribute('aria-label', `${state.label} — Disalin ✓`);
    state.timer = setTimeout(() => {
      if (button.isConnected) {
        button.textContent = state.text;
        button.setAttribute('aria-label', state.label);
      }
      confirmations.delete(button);
    }, 1800);
    state.timer.unref?.();
    confirmations.set(button, state);
  } finally {
    copying.delete(button);
    button.setAttribute('aria-busy', 'false');
  }
}
