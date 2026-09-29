# Integrasi 1,000 karangan master

Pelaksanaan dan ujian automatik selesai. Ujian visual telefon/desktop serta
reload dalam pelayar sebenar belum dapat dijalankan kerana tiada pelayar
disediakan oleh sambungan Browser dalam sesi ini. Tiada commit, push, deploy
atau panggilan API AI langsung dibuat.

## Audit Excel

Sumber induk: `data/BM_MASTER_KARANGAN_1000_TAHAP_KERJA.xlsx`, tidak diubah.
Helaian sebenar: `MASTER_KARANGAN` (1,001 baris termasuk tajuk lajur) dan
`STATUS_DAN_PANDUAN` (12 baris). Helaian panduan turut dibaca sebelum import.

| Medan aplikasi | Lajur sumber |
| --- | --- |
| ID stabil | `id_tajuk` |
| Tahun, umur, tahap | `tahun`, `umur_anggaran`, `tahap` |
| Kategori carian | `tema` (tiada lajur bernama kategori) |
| Jenis karangan | `jenis_karangan` |
| Tajuk | `tajuk_karangan` |
| Format | `format_penulisan` |
| Aktiviti cadangan | `aktiviti_cadangan` |
| Status tajuk | `status` |
| Contoh penuh | `karangan_contoh` |
| Jumlah perkataan | `bilangan_perkataan` |
| Status contoh | `status_karangan` |

Terdapat tepat **1,000 ID unik, 1,000 tajuk unik dan 1,000 contoh unik**.
Kesemua medan lengkap, semua status tajuk `MUKTAMAD` dan status contoh `SIAP`.
Tiada rekod dikecualikan. Padanan tajuk/contoh diambil daripada baris yang sama
dan disimpan di bawah ID sumber yang sama; penapisan tidak memadankan teks tajuk.

Jumlah perkataan setiap contoh sama dengan Excel apabila dikira melalui ruang
putih, termasuk baris baharu. Julat sebenar ialah 131–170 perkataan, mematuhi
syarat 120–300 dalam helaian panduan. Contoh Tahun 1 dilabel sebagai bacaan
rujukan; panjangnya tidak dijadikan sasaran wajib tulisan murid.

| Tahun | Tajuk dan contoh lengkap |
| --- | ---: |
| 1 | 100 |
| 2 | 140 |
| 3 | 160 |
| 4 | 180 |
| 5 | 220 |
| 6 | 200 |
| Jumlah | 1,000 |

Terdapat 14 jenis karangan. Status asal dikekalkan; tiada label semakan individu
guru atau asal usul AI ditambah kerana medan tersebut tidak dibekalkan.
Hash sumber, inventori, kiraan dan pengecualian direkod dalam `audit/essays.json`.

## Import semula dan pemuatan

`npm run data:prepare` kini menjalankan import ejaan/imlak sedia ada serta import
karangan. Ia juga dijalankan sebelum dev/test dan di dalam build. Reader ZIP/XML
Python sedia ada boleh memilih helaian; formula dalam helaian kandungan ditolak.
Adapter menggunakan 13 lajur sebenar dan menghasilkan `data/generated/essays.js`.
Tiada Excel diparse dalam pelayar dan tiada 1,000 contoh disalin ke komponen UI.

Baris tidak lengkap atau belum MUKTAMAD/SIAP dikecualikan dengan sebab dalam audit
dan amaran konsol. ID/tajuk/contoh bertindih, tahun tidak sah atau jumlah perkataan
yang salah menghentikan import. Pembetulan, perubahan susunan dan penambahan baris
boleh diimport semula tanpa perubahan kod aktiviti. Ujian set data semasa
menetapkan 1,000 sebagai garis dasar; jika jumlah induk sengaja bertambah pada
masa hadapan, jangkaan kiraan ujian perlu dikemas kini.

Pemuatan modul karangan dikawal: kegagalan/malformed data memberikan mesej ralat
dan pilihan muat semula, sementara draf dan ejaan/imlak masih boleh digunakan.
Bank kosong atau tiada hasil penapis mempunyai mesej yang jelas. Build turut
memastikan katalog melepasi pengesahan runtime.

## Aktiviti disambungkan

- **Karangan Berpandu:** semua 1,000 tajuk merentas enam tahun; carian tajuk,
  kategori/tema dan jenis karangan. Lapan peringkat sedia ada dikekalkan dengan
  soalan perancangan, panduan format dan semakan mengikut tahun/jenis.
- **Bina Perenggan:** semua tajuk boleh menjadi rangsangan untuk satu isi utama
  dan butiran sokongan. Bagi surat/laporan/ucapan, latihan diterangkan sebagai
  membina isi badan tulisan, bukan menggantikan format lengkap.
- **Rantai Cerita:** 324 tajuk pengalaman/rekaan yang sesuai. Murid mencipta
  pembukaan dan sambungan sendiri; tiada perenggan contoh dimasukkan ke rantai.
- **Bina Ayat/Kembangkan Ayat dan Ejaan/Imlak:** aliran master terdahulu dikekalkan;
  karangan tidak dipecahkan menjadi bank ayat latihan kedua.

Panduan tempatan meliputi pengalaman, rekaan, gambaran, penerangan mudah/fakta,
langkah mudah/panduan, pendapat, laporan, surat rasmi/tidak rasmi, dialog,
catatan harian serta syarahan/ucapan. Sumber menggabungkan syarahan dan ucapan
dalam satu jenis; panduan dibezakan lagi menggunakan awalan tajuk sumber yang
jelas. Panduan aplikasi ini bukan teks yang diekstrak atau rubrik rasmi.

Contoh hanya kelihatan selepas tindakan **Lihat contoh karangan**. Butang
**Sembunyikan contoh** menutupnya semula. Tajuk, status, jumlah perkataan dan label
CONTOH RUJUKAN MASTER dipaparkan. Teks dikekalkan tepat termasuk perenggan,
baris alamat surat dan giliran dialog. Tiada tindakan menyalin contoh ke editor.

## Draf dan versi

Kunci `bmMastery:state:v1` dan versi storan kekal. Medan tambahan `writingFilters`
dan `revisions` mempunyai nilai lalai ketika hidrasi draf lama. ID kandungan
memisahkan draf mengikut tahun, aktiviti dan tajuk sumber. Draf master merekod
versi import karangan; draf lama mengekalkan asal usulnya.

Carian/penapis tidak menukar draf aktif. Pemilihan tajuk membuka draf lain atau
menyambung draf ID itu. Tajuk demo lama masih boleh disambung melalui Draf Saya;
ID sedia ada tidak diberikan semula kepada tajuk master. Draf lama tanpa metadata
pilihan juga dipulihkan, bukan diganti oleh tajuk master pertama.

Tulisan semasa disimpan pada setiap input. Versi sebelum pembaikan boleh disimpan
secara jelas; masuk ke peringkat Baiki sendiri juga menyimpan versi sebelumnya
jika ada tulisan. Maksimum 20 versi dikekalkan tanpa menggantikan versi awal.
Versi termasuk dalam muat turun draf. Ayat asal dan revisi Kembangkan Ayat,
pelan, tahap kemajuan, sambungan cerita dan kemajuan ejaan/imlak kekal berasingan.

## Pengesahan

- `npm test`: **103 lulus, 0 gagal** (94 sebelum semakan susulan).
- `npm run check`: sintaks, pengasingan aset, ruang hujung baris dan penanda
  konflik lulus.
- `npm run build`: lulus, mengimport kedua-dua master dan mengesahkan enam pek.
- Ujian baharu menyemak pemetaan semua 1,000 baris, semua kombinasi penapis,
  pembetulan/baris baharu, penolakan input rosak, contoh tertutup, pelolosan HTML,
  format surat/dialog, semua jenis panduan, ralat/keadaan kosong dan draf lama.
- Ujian pengawal sebenar dengan DOM tiruan meliputi pilih tajuk → taip →
  autosimpan → simpan versi → baiki → tutup contoh → navigasi kembali →
  muat semula pengawal → pulihkan draf untuk ketiga-tiga aktiviti, tanpa API AI.
- Regresi ejaan/imlak kekal 1,080/720/360, 81 entri berbilang perkataan,
  penapisan, pendedahan jawapan dan pemulihan draf lulus.

CSS mengekalkan susun atur responsif sedia ada, menyusun penapis menegak pada
skrin kecil dan membalut tajuk/kandungan panjang. Contoh menggunakan `pre-wrap`
supaya format baris kekal. **Pengesahan visual sebenar tidak didakwa**:
Browser telah dicuba dan senarai pelayar kosong. Interaksi native disclosure,
paparan telefon/desktop dan reload pelayar sebenar masih perlu diperiksa apabila
pelayar tersedia; ujian pengawal/storan tidak menggantikan pemeriksaan tersebut.

## Fail berubah atau ditambah

Import/data:

- `tools/read-workbook.py`, `tools/import-essays.mjs`, `tools/prepare-data.mjs`
- `tools/build.mjs`, `package.json`
- `data/adapters/essays.js`, `data/generated/essays.js`, `audit/essays.json`

App/UI/storan:

- `js/essay-service.js`, `js/writing-guidance.js`, `js/curriculum-service.js`
- `js/app.js`, `js/state.js`, `js/storage.js`, `js/learning-service.js`
- `components/essay-catalog.js`
- `activities/master-writing.js`, `activities/writing.js`, `styles/app.css`

Ujian/dokumentasi:

- `tests/essay-integration.test.mjs`, `tests/phase3-controller.test.mjs`
- `tests/deployment.test.mjs`
- `tests/phase2.test.mjs`, `tests/phase3.test.mjs`
- `README.md`, `ARCHITECTURE.md`, `VERIFICATION.md`, laporan ini
- `dist/` dijana semula sebagai binaan tempatan.

Excel karangan ialah fail baharu yang diberikan pengguna dan tidak disunting.
Excel/JSON serta data terjana master ejaan/imlak tidak berubah secara kandungan.

## Continuation audit — 29 September 2026

Inspected Git status/diffs, recently modified integration files, and TODO markers
before editing. No interrupted stubs or disconnected master activity paths were
found. Existing code and tests were retained. One safety gap was found: requesting
AI guidance did not save a revision unless the pupil had manually saved one or
entered the essay's repair stage. Immediate editing after guidance could therefore
lose the earlier wording.

The continuation changes only these source/test/report files:

- `js/app.js`: save the complete pupil version before AI guidance in essay,
  paragraph and story activities; refresh the revision display without replacing
  the editor; warn when automatic snapshots reach the existing 20-version limit.
- `components/essay-catalog.js`: give revision history a refresh target and explain
  automatic saving before guidance.
- `tests/phase3-controller.test.mjs`: retain existing tests and add coverage for
  immediate revision/reload after guidance, unchanged-version deduplication,
  full history, and all six year transitions with empty/reset filters.
- `tests/deployment.test.mjs`: extend existing HTTP checks to the new public essay
  modules and blocked workbook/adapter/audit paths.
- `VERIFICATION.md` and this report: record current results and limitations.
- `dist/`: rebuilt using the existing production command. Required import hooks
  ran; generated source data and audit contents remained deterministic.

Data validation again confirms 1,000 unique IDs, titles and complete examples,
all MUKTAMAD/SIAP, with no missing/invalid years, excluded rows or word-count
mismatches. All 1,000 multiline texts match their workbook cells exactly. Counts
remain 100/140/160/180/220/200. There are 14 types and 324 eligible narrative titles.
The workbook hash before and after validation/build is
`ca1e5219ff8241c13b7873e728a3cab5088e00172389395520298a8a7019b445`.

All three activities use the generated master catalog. Year, theme/category,
essay type and title/keyword search remain supported. Demo titles originate in
the existing demo module and are retained for legacy draft compatibility; there
is no second manually maintained bank of the 1,000 master essays. The older JSON
source belongs to ejaan/imlak, and is not a competing essay source.

Autosave, stable-ID isolation, legacy restoration and navigation tests pass.
Examples remain closed by default, use escaped text with preserved line breaks,
and have no write-to-editor action. Native labels, selects, buttons and details
provide keyboard semantics; the close-example action returns focus to its summary.
Responsive CSS was reviewed for filter stacking, constrained selectors, long-title
wrapping, editor sizing and horizontally scrollable stages. This was a source
review, not a browser accessibility or visual test.

Final checks: **103 tests passed, zero failed**; `npm run check` passed (59 modules);
`npm run build` passed (40 assets, `bmMastery-cd3192302dc0`); `git diff --check`
passed. A local production HTTP check fetched all 40 assets and compared their
bytes to disk, resolved 87 relative module imports, checked blocked private paths,
and compared every production essay to the generated source dataset.

Browser setup was attempted using the installed Browser skill. Selection reported
no browser, and discovery returned `[]` after the documented troubleshooting step.
Desktop, tablet and mobile visual checks, native dropdown/disclosure interaction,
real keyboard/focus behavior and real browser reload therefore remain unverified.
No live AI or speech validation was performed. Version history retains its existing
20-version cap; pupils are warned to download the current draft when it is full.
Local-storage failure continues to show the existing temporary-save warning.

No commit, push, remote change, pull request or deployment was performed.
