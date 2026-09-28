import { e, icon } from "./ui.js";
import { navigation } from "../js/config.js";
import {
  hasWriting,
  writingCounts,
  draftText,
} from "../js/learning-service.js";
export function bookIllustration() {
  return `<svg viewBox="0 0 380 260" class="hero-art" role="img" aria-label="Ilustrasi buku terbuka dengan daun yang tumbuh"><circle cx="200" cy="126" r="103" fill="#d9e8cc"/><circle cx="289" cy="61" r="9" fill="#eebd64"/><path d="m74 80 5-10 5 10 11 5-11 5-5 10-5-10-11-5Z" fill="#e6b65d"/><path d="M82 191q103 53 234 0" fill="none" stroke="#b2c6a5" stroke-width="2"/><path d="m88 108 100 27 106-27 21 90-128 26-115-31Z" fill="#376451"/><path d="m87 98 101 20v94q-52-34-114-32Z" fill="#fffdf3"/><path d="m188 118 99-28 16 92q-67-1-115 30Z" fill="#f1ebd7"/><path d="M188 118v94" stroke="#c6c4aa" stroke-width="2"/><path d="m101 124 62 15m-66 1 67 17m-71-1 49 13m69-32 60-15m-58 30 61-15m-59 30 44-10" stroke="#c4c5ae" stroke-width="4" stroke-linecap="round"/><path d="M205 119q-12-42 17-82" stroke="#497857" stroke-width="4" fill="none"/><path d="M207 89q-45-7-38-39 35 4 38 39" fill="#719862"/><path d="M211 73q35-6 41-31-31-6-41 31" fill="#3f7254"/><path d="m116 195 1 27 15-8 12 13-2-25" fill="#d99563"/><circle cx="306" cy="148" r="4" fill="#d3a45a"/><path d="m62 154 4-6 4 6-4 6Z" fill="#769a71"/></svg>`;
}
export function renderHome({ pack, state }) {
  const drafts = Object.values(state.drafts)
    .filter(hasWriting)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const latest = drafts.find((d) => d.year === state.year);
  return `<div class="welcome-line"><div><span class="eyebrow">SEDIKIT DEMI SEDIKIT, SEMAKIN MAHIR</span><h1>Jom, kembangkan idea kamu<span class="green-dot">.</span></h1><p>Setiap cerita yang hebat bermula dengan satu perkataan.</p></div><span class="year-pill">${icon("sprout")} Tahun ${state.year}</span></div><section class="hero"><div class="hero-content"><span class="hero-label">RUANG UNTUK BELAJAR & BERKARYA</span><h2>Perkataan kecil.<br>Idea yang <em>besar.</em></h2><p>Kenali kata, bina ayat dan tulis cerita kamu sendiri.<br>Cikgu AI sedia membimbing, selangkah demi selangkah.</p><a class="button primary" href="#sentence">Mula bina ayat ${icon("arrow")}</a><span class="hero-note">Ikut rentak kamu sendiri</span></div>${bookIllustration()}</section><div class="section-heading"><div><span class="eyebrow">PERJALANAN BAHASA KAMU</span><h2>Dari kata kepada karya</h2></div><span class="small muted">Pilih ruang untuk mula belajar</span></div><div class="journey"><span>Perkataan</span><i>→</i><span>Frasa</span><i>→</i><span>Ayat</span><i>→</i><span>Ayat lebih lengkap</span><i>→</i><span>Perenggan</span><i>→</i><span>Karangan</span></div><div class="activity-grid">${navigation
    .filter((item) => item.step)
    .map(
      (item) =>
        `<a class="activity-card ${item.color}" href="#${item.id}"><div class="card-top"><span class="activity-icon">${icon(item.icon)}</span><span class="step-number">${item.step}</span></div><span class="card-tag">${item.tag}</span><h3>${e(item.label)}</h3><p>${e(item.description)}</p><span class="card-link">Mari cuba ${icon("arrow")}</span></a>`,
    )
    .join(
      "",
    )}</div><div class="home-bottom"><section class="panel continue-card"><div class="round-icon">${icon("folder")}</div><div><h3>${latest ? "Sambung idea kamu" : "Ruang untuk idea kamu"}</h3><p>${latest ? e(latest.title) : "Draf disimpan secara automatik pada peranti ini."}</p>${latest ? `<button class="text-button" data-resume="${e(latest.id)}">Sambung menulis →</button>` : '<a class="text-button" href="#drafts">Lihat Draf Saya →</a>'}</div></section><section class="panel tip-card"><span class="eyebrow">FOKUS TAHUN ${state.year}</span><h3>${e(pack.difficultyProfile.focus)}</h3><p>${e(pack.difficultyProfile.guidance)}</p></section></div>`;
}
export function renderDrafts({ state }) {
  const drafts = Object.values(state.drafts)
    .filter(hasWriting)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (!drafts.length)
    return `<section class="panel empty-state"><div class="round-icon">${icon("folder")}</div><h2>Idea kamu akan tersimpan di sini</h2><p>Belum ada draf. Mulakan dengan satu ayat, kemudian kembali bila-bila masa.</p><a class="button primary" href="#sentence">Bina ayat pertama ${icon("arrow")}</a></section>`;
  return `<p class="muted">${drafts.length} draf pada peranti ini · Semua tahun</p><div class="draft-grid">${drafts.map((d) => `<article class="panel draft-card"><div class="word-top"><span class="mini-label">Tahun ${d.year}</span><span class="small muted">${e(navigation.find((n) => n.id === d.activity)?.label)}</span></div><h2>${e(d.title)}</h2><p class="draft-excerpt">${e(draftText(d) || d.original || Object.values(d.plan).join(" ") || Object.values(d.fields).join(" "))}</p><p class="small muted">${e(new Intl.DateTimeFormat("ms-MY", { dateStyle: "medium", timeStyle: "short" }).format(new Date(d.updatedAt)))} · ${writingCounts(draftText(d)).words} perkataan</p><div class="actions"><button class="button primary" data-resume="${e(d.id)}">Sambung</button><button class="small-button" data-export="${e(d.id)}">Muat turun</button><button class="text-button danger" data-delete="${e(d.id)}">Padam</button></div></article>`).join("")}</div>`;
}
