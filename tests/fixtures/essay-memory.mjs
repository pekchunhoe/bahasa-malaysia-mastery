// Authored examples for deterministic integration tests; never live AI output.
export const memoryPointTexts = [
  ['Menyertai gotong-royong di sekolah pada hari Sabtu.'],
  ['Berkumpul di dewan.', 'Cikgu Amin membahagikan tugas.'],
  ['Mengambil penyapu.', 'Menyapu daun kering.', 'Memasukkan daun ke dalam beg sampah.'],
  ['Pergi ke kebun.', 'Mencabut rumput.', 'Menggemburkan tanah.', 'Menyiram pokok bunga.'],
  ['Membasuh tangan.', 'Beratur di kantin.', 'Menerima roti.', 'Minum air.', 'Berehat bersama rakan.'],
  ['Menyimpan peralatan.', 'Berkumpul semula.', 'Mendengar ucapan guru.', 'Menerima pujian.', 'Melihat sekolah yang bersih.', 'Pulang dengan gembira.'],
];
export const memoryParagraphs = memoryPointTexts.map(points => points.join(' '));
export const memoryNotes = { paragraphs: memoryPointTexts.map((points, i) => ({ paragraphIndex: i + 1,
  heading: ['Mula bergotong-royong', 'Pembahagian tugas', 'Membersihkan halaman', 'Menjaga kebun', 'Waktu rehat', 'Selesai bekerja'][i],
  points: points.map(text => ({ text, cue: '' })) })) };
export const memoryReview = points => ({ points: points.map((_, i) => ({ pointIndex: i + 1,
  status: i === 0 ? 'penuh' : i === 1 ? 'sebahagian' : 'tiada',
  comment: i === 0 ? 'Makna isi pertama jelas.' : i === 1 ? 'Nyatakan siapa yang melakukan tugas.' : 'Cuba ingat tindakan ini.' })),
  sequence: { status: 'betul', comment: 'Idea disusun dengan jelas.' },
  language: { status: 'perlu_dibaiki', comment: 'Semak huruf besar pada awal ayat.' },
  suggestion: 'Bagus mencuba! Baca isi sekali lagi, kemudian tulis dengan ayat sendiri.' });
export const memoryInput = action => ({ action, activity: 'memory', year: 3, title: 'Hari Gotong-royong',
  studentText: action === 'memory_review' ? 'Kami berhimpun di dewan. Guru memberikan tugasan.' : '',
  ...(action === 'memory_points' ? { sourceParagraphs: memoryParagraphs }
    : { paragraphIndex: 2, originalParagraph: memoryParagraphs[1], importantPoints: memoryNotes.paragraphs[1].points }) });
