const BUILD_VERSION = "__BUILD_VERSION__";
const VERSION_URL = new URL("../version.json", import.meta.url);
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const CHECK_TIMEOUT_MS = 15000;

const isProductionBuild = () => BUILD_VERSION !== "__BUILD_VERSION__";

export function watchForDeploymentUpdate(onUpdate) {
  if (!isProductionBuild() || typeof fetch !== "function")
    return { check: () => {}, stop: () => {} };

  let stopped = false;
  let announced = false;
  let pending = null;
  let activeController;
  const check = () => {
    if (stopped || announced || navigator.onLine === false) return;
    // Focus, visibility and timer events may arrive together. Share one check.
    if (pending) return pending;
    const controller = new AbortController();
    activeController = controller;
    const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
    pending = (async () => {
      try {
        const response = await fetch(VERSION_URL, { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const { version } = await response.json();
        if (!stopped && !announced && !controller.signal.aborted &&
            typeof version === "string" && /^bmMastery-[a-f0-9]{12}$/.test(version) && version !== BUILD_VERSION) {
          announced = true;
          onUpdate();
        }
      } catch {
        // A failed/offline check never interrupts writing; a later event retries.
      }
    })().finally(() => {
      clearTimeout(timeout);
      activeController = null;
      pending = null;
    });
    return pending;
  };
  const onVisible = () => {
    if (document.visibilityState === "visible") check();
  };
  const interval = setInterval(check, CHECK_INTERVAL_MS);
  window.addEventListener("focus", check);
  window.addEventListener("online", check);
  window.addEventListener("pageshow", onVisible);
  document.addEventListener("visibilitychange", onVisible);
  // BM has no service worker; deployment metadata is the sole update signal.
  check();

  return {
    check,
    stop() {
      stopped = true;
      activeController?.abort();
      clearInterval(interval);
      window.removeEventListener("focus", check);
      window.removeEventListener("online", check);
      window.removeEventListener("pageshow", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    },
  };
}
