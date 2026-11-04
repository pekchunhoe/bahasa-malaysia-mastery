import { ensureMemoryVersion, memorySource, sourceIdentity, finalMemoryEssay } from './essay-memory.js';
import { memoryFinal, memoryFeedback } from '../activities/essay-memory.js';
import { copyRichText, copyText } from '../components/clipboard.js';
import { memoryNotesClipboard } from '../components/memory-notes.js';

export function createMemoryController({ store, ai, render, document: dom = globalThis.document }) {
  let draft, selected = 0, current = 0, identity = '', revealed = false, busy = '', error = '';
  const view = () => ({ draft, selected, current, version: draft?.memory?.versions[selected], revealed, busy, error });
  const refresh = focus => {
    if (store.state.activity !== 'memory') return;
    const editor = !focus && dom.activeElement?.id === 'memory-writing' ? dom.activeElement : null;
    const selection = editor ? [editor.selectionStart, editor.selectionEnd, editor.selectionDirection, editor.scrollTop] : null;
    render();
    if (focus) dom.querySelector(focus)?.focus();
    else if (selection) {
      const restored = dom.querySelector('#memory-writing');
      if (restored) {
        restored.focus({ preventScroll: true });
        restored.setSelectionRange(...selection.slice(0, 3));
        restored.scrollTop = selection[3];
      }
    }
  };
  async function request(action) {
    if (busy) return;
    const { version } = view();
    if (!version || (action === 'memory_review' && (!version.notes || !version.writing[version.paragraph].trim()))) return;
    const index = version.paragraph, writing = version.writing[index], notesKey = JSON.stringify(version.notes?.paragraphs[index]);
    const raw = { action, activity: 'memory', year: draft.year, title: version.source.title, studentText: writing,
      ...(action === 'memory_points' ? { sourceParagraphs: version.source.paragraphs }
        : { paragraphIndex: index + 1, originalParagraph: version.source.paragraphs[index], importantPoints: version.notes.paragraphs[index].points }) };
    busy = action; error = ''; refresh();
    try {
      // Only explicit regeneration bypasses the shared request cache.
      if (action === 'memory_points') ai.clearCache(raw);
      const result = await ai.request(raw);
      if (result.mode !== 'api') throw Error('Cikgu AI belum tersedia untuk latihan ini. Cuba lagi kemudian.');
      if (action === 'memory_points') version.notes = result.feedback;
      else version.feedback[index] = { writing, notesKey, result: result.feedback };
      store.persist();
    } catch (failure) {
      if (view().version === version)
        error = failure.message || 'Cikgu AI tidak dapat dihubungi. Cuba lagi kemudian.';
    } finally {
      busy = ''; refresh();
    }
  }
  return {
    prepare() {
      const source = memorySource(store.state);
      if (!source) { draft = null; identity = ''; return view(); }
      const nextIdentity = source.draft.id + (source.source ? sourceIdentity(source.source) : 'empty');
      draft = source.draft;
      const length = draft.memory?.versions.length || 0;
      current = source.source ? ensureMemoryVersion(draft, source.source) : -1;
      if (identity !== nextIdentity) { selected = current >= 0 ? current : length - 1; identity = nextIdentity; revealed = false; error = ''; }
      if ((draft.memory?.versions.length || 0) !== length) store.persist();
      return view();
    },
    input(target) {
      if (!Object.hasOwn(target.dataset, 'memoryWriting')) return false;
      const { version } = view();
      if (!version || typeof target.value !== 'string' || target.value.length > 16000) return true;
      version.writing[version.paragraph] = target.value;
      store.persist();
      const final = dom.querySelector('[data-memory-final-content]');
      if (final) final.innerHTML = memoryFinal(version);
      const feedback = dom.querySelector('[data-memory-feedback]');
      if (feedback) feedback.innerHTML = memoryFeedback(version);
      const check = dom.querySelector('[data-memory-action="check"]');
      if (check) check.disabled = !!busy || !target.value.trim();
      return true;
    },
    change(target) {
      if (!Object.hasOwn(target.dataset, 'memoryVersion')) return false;
      const index = Number(target.value);
      if (Number.isInteger(index) && draft?.memory.versions[index]) {
        selected = index; revealed = false; error = ''; refresh('.memory-heading');
      }
      return true;
    },
    bindDisclosure() {
      const disclosure = dom.querySelector('[data-memory-final]');
      const { version } = view();
      if (disclosure) disclosure.ontoggle = () => {
        if (disclosure.isConnected && version && version.finalOpen !== disclosure.open) { version.finalOpen = disclosure.open; store.persist(); }
      };
    },
    click(button) {
      const data = button.dataset;
      if (!['memoryAction', 'memoryMove', 'memoryActivity'].some(key => Object.hasOwn(data, key))) return false;
      const { version } = view();
      if (!version) return true;
      if (data.memoryMove) {
        version.paragraph = Math.max(0, Math.min(version.source.paragraphs.length - 1, version.paragraph + Number(data.memoryMove)));
        revealed = false; store.persist(); refresh('.memory-heading');
      } else if (Object.hasOwn(data, 'memoryActivity')) {
        if ([0, 1, 2].includes(Number(data.memoryActivity))) version.activity = Number(data.memoryActivity);
        revealed = false; store.persist(); refresh('.memory-heading');
      } else if (data.memoryAction === 'reveal') { revealed = !revealed; refresh('[data-memory-action="reveal"]'); }
      else if (data.memoryAction === 'generate') void request('memory_points');
      else if (data.memoryAction === 'check') void request('memory_review');
      else if (data.memoryAction === 'copy-notes') {
        const payload = memoryNotesClipboard(version), status = dom.querySelector('[data-memory-notes-copy-status]');
        if (!payload || button.getAttribute('aria-busy') === 'true') return true;
        button.setAttribute('aria-busy', 'true');
        if (status) status.textContent = '';
        void copyRichText(payload).then(format => {
          if (status) status.textContent = format === 'html' ? '✅ Isi penting berjaya disalin!'
            : '✅ Isi penting disalin dalam format teks. Format teks tidak dapat mengekalkan kotak berbingkai.';
        }, () => {
          if (status) status.textContent = 'Belum berjaya menyalin isi penting. Cuba lagi dan benarkan akses papan keratan.';
        }).finally(() => button.setAttribute('aria-busy', 'false'));
      }
      else if (data.memoryAction === 'copy') {
        const text = finalMemoryEssay(version), status = dom.querySelector('[data-memory-copy-status]');
        if (!text || button.getAttribute('aria-busy') === 'true') return true;
        button.setAttribute('aria-busy', 'true');
        if (status) status.textContent = '';
        void copyText(text).then(() => {
          if (status) status.textContent = '✅ Berjaya disalin!';
        }, () => {
          if (status) status.textContent = 'Belum berjaya disalin. Pilih tulisan di atas dan salin secara manual.';
        }).finally(() => button.setAttribute('aria-busy', 'false'));
      }
      return true;
    },
  };
}
