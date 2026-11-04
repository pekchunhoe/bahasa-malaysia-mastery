// Authored examples for deterministic integration tests; never live AI output.
export const memoryPointTexts = [
  ['Saya menyertai gotong-royong di sekolah pada hari Sabtu.'],
  ['Kami berkumpul di dewan.', 'Cikgu Amin membahagikan tugas.'],
  ['Kami mengambil penyapu, penyodok dan kain buruk.', 'Kami menyapu daun kering.', 'Kami memasukkan daun ke dalam beg sampah.'],
  ['Kami pergi ke kebun.', 'Kami mencabut rumput.', 'Kami menggemburkan tanah.', 'Kami menyiram pokok bunga.'],
  ['Kami membasuh tangan.', 'Kami beratur di kantin.', 'Kami menerima roti.', 'Kami minum air.', 'Kami berehat bersama rakan.'],
  ['Kami menyimpan peralatan.', 'Kami berkumpul semula.', 'Kami mendengar ucapan guru.', 'Kami menerima pujian.', 'Kami melihat sekolah yang bersih.', 'Kami pulang dengan gembira.'],
];
export const memoryParagraphs = memoryPointTexts.map(points => points.join(' '));
export const legacyMemoryNotes = { paragraphs: memoryPointTexts.map((points, i) => ({ paragraphIndex: i + 1,
  heading: ['Mula bergotong-royong', 'Pembahagian tugas', 'Membersihkan halaman', 'Menjaga kebun', 'Waktu rehat', 'Selesai bekerja'][i],
  points: points.map(text => ({ text, cue: '' })) })) };
const memoryCues = [
  [['Gotong-royong', 'Sekolah', 'Hari Sabtu']],
  [['Berkumpul', 'Dewan'], ['Pembahagian tugas', 'Cikgu Amin']],
  [['Peralatan pembersihan', 'Penyapu', 'Penyodok', 'Kain buruk'], ['Menyapu', 'Daun kering'], ['Mengumpul daun', 'Beg sampah']],
  [['Kebun'], ['Mencabut', 'Rumput'], ['Menggemburkan', 'Tanah'], ['Menyiram', 'Pokok bunga']],
  [['Kebersihan', 'Tangan'], ['Beratur', 'Kantin'], ['Makanan', 'Roti'], ['Minuman', 'Air'], ['Berehat', 'Rakan']],
  [['Menyimpan', 'Peralatan'], ['Berkumpul semula'], ['Ucapan', 'Guru'], ['Pujian'], ['Sekolah bersih'], ['Pulang', 'Gembira']],
];
export const memoryNotes = { paragraphs: legacyMemoryNotes.paragraphs.map((p, i) => ({
  paragraphIndex: p.paragraphIndex, heading: p.heading,
  points: p.points.map(({ text }, j) => {
    const boldWord = i === 1 && j === 1 ? 'membahagikan' : text.split(' ')[1];
    const start = text.indexOf(boldWord);
    return { primaryKeyword: memoryCues[i][j][0], additionalKeywords: memoryCues[i][j].slice(1),
      importantSentence: text, boldWord, highlight: { start, end: start + boldWord.length } };
  }),
})) };
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
