// Shared by the activity, storage boundary and server-side tutor contract.
export const MAX_KEYWORD = 80;
export const expansionDetails = Object.freeze([
  { id: 'tempat', label: 'tempat', guidance: 'Di manakah perkara itu berlaku? Contoh: di ruang tamu.',
    generation: 'Nyatakan lokasi sebenar yang membantu pembaca dan sesuai dengan situasi, bukan sekadar perkataan tempat. Kekalkan lokasi yang telah dinyatakan murid.' },
  { id: 'masa', label: 'masa', guidance: 'Bilakah perkara itu berlaku? Contoh: pada waktu petang.',
    generation: 'Tambahkan masa yang sesuai dengan kegiatan tanpa percanggahan. Jangan mereka tarikh atau mengulang masa yang sudah jelas; jika masa khusus tidak diketahui, pilih ungkapan masa umum yang munasabah.' },
  { id: 'cara', label: 'cara', guidance: 'Bagaimanakah tindakan itu dilakukan? Contoh: dengan berhati-hati.',
    generation: 'Terangkan bagaimana tindakan dilakukan dengan ungkapan Melayu yang semula jadi, misalnya dengan teliti. Cara itu mesti berkait dengan tindakan sebenar.' },
  { id: 'sebab', label: 'sebab', guidance: 'Mengapakah perkara itu berlaku? Tambah alasan yang menjelaskan tindakan.',
    generation: 'Jelaskan alasan atau motivasi yang munasabah bagi tindakan, bukan sebab baharu yang tidak berkaitan atau bercanggah dengan idea murid.' },
  { id: 'perasaan', label: 'perasaan', guidance: 'Apakah perasaan watak? Contoh: Saya berasa gembira.',
    generation: 'Nyatakan emosi atau reaksi yang sesuai dengan watak dan konteks. Jangan memaksa gembira, sedih atau takut apabila tiada kaitan yang munasabah.' },
  { id: 'penerangan', label: 'penerangan', guidance: 'Tambah maklumat untuk menjelaskan orang, benda atau kegiatan. Contoh: buku cerita tentang haiwan.',
    generation: 'Tambah penjelasan atau gambaran yang memberi maklumat baharu tentang orang, benda atau kegiatan. Elakkan mengulang isi yang sama dengan kata lain.' },
  { id: 'kata_adjektif', label: 'kata adjektif', guidance: 'Nyatakan sifat atau ciri. Contoh: bersih, luas, rajin.',
    generation: 'Gunakan sifat yang tepat dan relevan, misalnya sarapan yang berkhasiat. Jangan menyelitkan kata adjektif rawak atau deretan sifat hiasan.' },
  { id: 'kata_hubung', label: 'kata hubung', guidance: 'Hubungkan idea atau klausa dengan dan, tetapi, kerana, supaya, apabila, walaupun, sambil atau lalu. Contoh: Ali membaca buku sambil menunggu adiknya pulang.',
    generation: 'Hubungkan idea atau klausa secara gramatis menggunakan dan, kerana, supaya, apabila, walaupun, sambil atau tetapi mengikut makna. Elakkan hubungan klausa yang janggal dan kata hubung berlebihan.' },
]);
export function cleanKeyword(value) {
  return typeof value === 'string' ? value.normalize('NFC').trim().replace(/\s+/gu, ' ') : '';
}
export function keywordError(value) {
  const word = cleanKeyword(value);
  if (!word) return 'Taip kata kunci kamu dahulu.';
  if (word.length > MAX_KEYWORD || word.split(' ').length > 8)
    return 'Gunakan kata atau frasa pendek, maksimum 80 aksara dan 8 perkataan.';
  if (!/^[\p{L}\p{M}]+(?:[-'\u2019][\p{L}\p{M}]+)*['\u2019]?(?:(?:,\s*|\s+)[\p{L}\p{M}]+(?:[-'\u2019][\p{L}\p{M}]+)*['\u2019]?)*$/u.test(word))
    return 'Gunakan huruf, ruang, tanda sempang, koma atau apostrof yang sesuai.';
  return '';
}
const normalized = value => cleanKeyword(value).toLocaleLowerCase('ms').replace(/\u2019/g, "'");
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function containsKeyword(text, keyword) {
  if (typeof text !== 'string' || keywordError(keyword)) return false;
  // Keep hyphenated words and apostrophes intact. A phrase can span a comma,
  // quotation marks or whitespace, but never unrelated sentence boundaries.
  const phrase = normalized(keyword).split(/[\s,]+/u).map(escape).join('[\\s,;:“”"()\\[\\]]+');
  return new RegExp(`(?<![\\p{L}\\p{M}\\p{N}'-])${phrase}(?![\\p{L}\\p{M}\\p{N}'-])`, 'u').test(normalized(text));
}
export function expansionVocabulary(pack) {
  return (pack.vocabulary || []).filter(word => !keywordError(word.word));
}
export function expansionKeyword(pack, draft) {
  const mode = draft.fields.expansionMode === 'custom' ? 'custom' : 'builtin';
  const words = expansionVocabulary(pack);
  const entry = words.find(word => word.id === (draft.fields.builtinKeywordId || draft.itemId));
  // An unresolvable legacy item has no guessed target. Preserve its writing.
  const keyword = mode === 'custom' ? cleanKeyword(draft.fields.customKeyword) : entry?.word || '';
  return { mode, keyword: keywordError(keyword) ? '' : keyword, entry: mode === 'builtin' ? entry : null };
}
export function keywordFeedback(text, keyword) {
  if (!keyword) return 'Pilih atau aktifkan kata kunci dahulu.';
  return containsKeyword(text, keyword)
    ? `Kata kunci “${keyword}” ada dalam ayat. Semak juga kesesuaian maknanya.`
    : `Pastikan ayat kamu mengandungi kata kunci “${keyword}”. Kekalkan ejaannya dan semak maknanya.`;
}
export function selectedExpansionDetails(draft) {
  return expansionDetails.filter(detail => draft.plan[detail.id] === 'yes').map(detail => detail.id);
}
export function detailSelectionStates(selected = []) {
  return Object.fromEntries(expansionDetails.map(detail => [detail.id, selected.includes(detail.id)]));
}
export function migrateExpansionPlan(plan) {
  const result = { ...plan };
  if (result.kata_keterangan === 'yes' && !Object.hasOwn(result, 'kata_hubung')) result.kata_hubung = 'yes';
  delete result.kata_keterangan;
  return result;
}
