# Integrasi master BM — 28 September 2026

Integrasi kod dan pengesahan automatik selesai. Pengesahan visual telefon/desktop
dan muat semula dalam pelayar sebenar belum selesai kerana Browser tidak
menyediakan pelayar dalam sesi ini (`browsers.list()` mengembalikan senarai kosong).
Tiada commit, push, deploy atau panggilan API AI langsung dibuat.

## Audit sumber sebelum perubahan app

- Excel: `data/BM_MASTER_EJAAN_IMLAK_2026_MUKTAMAD.xlsx`.
- Eksport: `data/bm_content_2026_app_ready.json`.
- Tiada percanggahan antara Excel dan JSON: 1,080 ID unik, 720 ejaan Tahun 1–3,
  360 imlak Tahun 4–6, 720 ENRICHMENT dan 360 VOCAB_FOCUS; tiada padanan hilang.
- Setiap tahun mempunyai 24 unit: 10 item/unit bagi Tahun 1–3 dan 5 bagi Tahun 4–6.
- Semua 81 ejaan berbilang perkataan dikekalkan. 90 kemunculan teks berulang
  selepas kemunculan pertama kekal dengan ID berasingan.
- Padanan menggunakan `source_item_id = item_id`. Susunan baris dan teks yang
  sama tidak digunakan untuk menentukan identiti.
- Perbandingan tepat meliputi ID, tahun, jenis, nombor/nama unit dan tema,
  nombor item, teks latihan, perkataan fokus, maksud, kategori, contoh,
  petunjuk, kata dasar/berkaitan, fokus ejaan, status dan asal usul.
  Hanya `null`/kosong dan nombor Excel berbentuk rentetan disetarakan.
- Sumber `Disahkan`; pengayaan/fokus `diluluskan`, `ai_generated`, pengesahan
  pukal pengguna. Tiada tuntutan semakan individu guru.
- `ayat_diperkaya` dan `kesalahan_lazim` kosong: disahkan, tidak direka,
  tidak diterbitkan sebagai medan kosong kepada murid.
- Kedua-dua fail input tidak diubah. Hash, inventori helaian, keputusan audit
  dan asal usul sumber berada dalam `audit/workbook.json`.

## Sambungan aktiviti

| Aktiviti | Tingkah laku |
| --- | --- |
| Bank Kata & Frasa | 240 kata/frasa bagi setiap Tahun 1–3; 120 fokus bagi setiap Tahun 4–6. Penapis tahun/unit/tema yang tersedia, carian, maksud, kategori dan contoh. Kata dasar/berkaitan hanya jika tersedia. |
| Bina Ayat | Kata/frasa fokus dan petunjuk master; contoh di bawah butang pendedahan asli `details` yang tertutup sehingga diminta. Tiada salinan ke editor. |
| Kembangkan Ayat | Maksud, contoh pilihan dan petunjuk kembangkan jika tersedia; ayat asal kekal berasingan daripada revisi. Tiada model ayat diperkaya direka. |
| Latihan Ejaan & Imlak | Teks sah kekal `teks_app`. Bantuan ejaan pilihan. Fokus imlak hanya muncul selepas percubaan bukan kosong disemak; hilang semula ketika menaip atau mula percubaan baharu. Paparan jawapan kekal melalui pilihan sengaja. |
| Bina Perenggan | Cadangan kosa kata mengikut tahun/unit/tema, tanpa mengisi editor. |
| Karangan Berpandu | Cadangan kosa kata serta pilihan kata sedia ada; tajuk, peringkat dan draf berasingan dikekalkan. |
| Rantai Cerita | Cadangan kosa kata; pembuka dan sambungan murid dikekalkan. Ayat imlak tidak dicantum menjadi cerita. |

Cadangan penulisan memaparkan sehingga 12 kata daripada penapis semasa, dengan
kata pilihan didahulukan dan pautan kepada bank penuh. Tiada pemetaan automatik
tema kepada tajuk demo dicipta. Tajuk karangan dan pembuka cerita sedia ada masih
DEMO, berasingan daripada master.

## Seni bina dan simpanan

Aliran import sedia ada diperluas: baca Excel secara luar talian untuk audit,
sahkan terhadap JSON, kemudian hasilkan **satu** `data/generated/master.js`
daripada JSON menggunakan adapter sedia ada. Modul tersebut mengandungi item
latihan dan indeks pengayaan ID. Tiada parser Excel dalam pelayar, tiada bank
imlak hasil pecahan ayat, tiada set master kedua. Enam pengayaan demo lama
dikeluarkan daripada koleksi produksi supaya tidak mengatasi eksport muktamad.

`bmMastery:state:v1`, modul state/storage, ID draf dan kandungan murid tidak
ditukar. Penapis hanya mengubah bahan yang dilihat. Draf lama serta ayat asal,
revisi, pelan, peringkat dan sambungan dipulihkan menggunakan mekanisme asal.

## Keputusan ujian

- `npm test`: **81 lulus, 0 gagal**.
- `npm run check`: sintaks JavaScript, ruang hujung baris, penanda konflik dan
  pengasingan aset pelayar lulus.
- `npm run build`: lulus; master disahkan semula, enam pek dimuatkan, aset
  produksi dijana. Excel, audit dan eksport JSON mentah tidak disalin ke `dist`.
- Audit penuh turut diuji dengan susunan rekod diterbalikkan dan input rosak:
  ID hilang/bertindih, perubahan teks/tahun/unit/status/fokus/contoh, kelulusan
  salah dan kandungan rekaan pada medan kosong ditolak.
- Penapis bank dan cadangan diuji untuk semua 144 kombinasi tahun/unit serta
  semua tema yang tersedia. Tahun 4–6 memaparkan fokus, bukan bank kosong.
- Pendedahan contoh diuji melalui markup `details` tertutup; tiada contoh
  dijadikan nilai editor. Latihan diuji sebelum/selepas semakan dan reset.
- Pemulihan storan dan pemuatan semula pengawal app diuji dengan sempadan DOM
  tiruan: ayat asal/revisi, draf, ID, pelan dan sambungan kekal; sifar permintaan
  rangkaian dalam pengawal integrasi.
- Ujian regresi navigasi/draf, pengendalian storan gagal, semakan transkripsi,
  suara tiruan, API berasaskan mock dan pelayan HTTP turut lulus.
- Semakan HTTP produksi: kesemua 31 modul dalam graf import dimuatkan dengan
  status 200; 1,080 item dan 1,080 pengayaan tersedia. Excel/audit disekat,
  eksport JSON mentah tidak diterbitkan sebagai salinan kedua. Binaan akhir:
  `bmMastery-697bb7ba8153`.

## Batasan pengesahan sebenar

Ujian pengawal/markup **bukan** ujian pelayar visual. Browser telah dicuba dan
tiada pelayar tersedia. Oleh itu paparan sebenar telefon/desktop, interaksi
`details` dalam pelayar, pemulihan selepas reload sebenar dan suara ms-MY belum
disahkan secara hujung ke hujung. CSS responsif sedia ada dikekalkan dan
penapis serta teks panjang diberi had lebar/balutan; ini tidak menggantikan
pemeriksaan visual. Folder ini juga tiada metadata Git, jadi inventori di bawah
ialah rekod perubahan sesi, bukan `git diff`.

## Inventori fail perubahan

Kod import/data:

- `tools/read-workbook.py`
- `tools/validate-master.mjs` (baharu)
- `tools/import-workbook.mjs`
- `tools/build.mjs`
- `data/generated/master.js` (dijana semula)
- `data/teacher/content.js`
- `js/curriculum-service.js`
- `js/enrichment-service.js`

Kod aktiviti/UI:

- `js/app.js`
- `components/content.js`
- `components/enrichment.js`
- `components/vocabulary-support.js` (baharu)
- `activities/vocabulary.js`
- `activities/sentence.js`
- `activities/practice.js`
- `activities/writing.js`
- `styles/app.css`

Ujian:

- `tests/master-integration.test.mjs` (baharu)
- `tests/phase2.test.mjs`
- `tests/phase3.test.mjs`
- `tests/phase3-controller.test.mjs`
- `tests/deployment.test.mjs`

Dokumentasi/hasil:

- `README.md`, `ARCHITECTURE.md`, `VERIFICATION.md`
- `audit/workbook.json`, `audit/MASTER_INTEGRATION.md`
- `dist/` dijana semula sebagai hasil binaan tempatan.
