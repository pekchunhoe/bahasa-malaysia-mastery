// Adapted from Mandarin Mastery's persistent, user-triggered update notice.
// Keep it outside #app so navigation cannot duplicate it or reset the editor.
export function createDeploymentUpdateNotice({ saveBeforeReload, onSaveFailure, reload = () => window.location.reload() }) {
  let shown = false;
  let reloading = false;
  return () => {
    if (shown) return;
    shown = true;
    const notice = document.createElement('section');
    notice.className = 'deployment-update-notice';
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');
    notice.setAttribute('aria-atomic', 'true');
    notice.innerHTML = '<div><strong>Versi baharu tersedia</strong><p>Aplikasi telah dikemas kini. Muat semula untuk menggunakan versi terkini.</p></div><button type="button" class="button primary" aria-label="Muat semula aplikasi untuk menggunakan versi terkini">Muat semula</button>';
    const button = notice.querySelector('button');
    button.onclick = () => {
      if (reloading) return;
      // Retain BM's existing synchronous save guard. Failed saves remain retryable.
      if (!saveBeforeReload()) { onSaveFailure(); return; }
      reloading = true;
      button.disabled = true;
      reload();
    };
    document.body.append(notice);
    document.body.classList.add('deployment-update-visible');
  };
}
