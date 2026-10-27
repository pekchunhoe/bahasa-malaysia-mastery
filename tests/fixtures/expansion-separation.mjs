// Authored local teaching fixtures, not captured or live Gemini output.
export const detailExamples = [
  'Pada pagi Ahad, saya berasa gembira dapat membantu ibu menyediakan sarapan yang berkhasiat untuk keluarga di dapur dengan teliti kerana saya ingin meringankan tugasnya.',
  'Dengan berhati-hati, saya membantu ibu menyediakan sarapan yang lazat untuk keluarga di dapur pada pagi Ahad kerana tugas bersama itu membuat saya berasa bangga.',
  'Saya berasa bangga apabila membantu ibu menyediakan sarapan yang menyelerakan untuk keluarga di dapur pada pagi Ahad dengan cermat kerana saya dapat meringankan tugasnya.',
];
export const detailFeedback = {
  ok: true, summary: 'Ini tiga cara mengembangkan idea kamu.', errors: [], suggestions: [],
  explanation: 'Pilih contoh yang membantu kamu menulis sendiri.',
  examples: detailExamples.map(text => ({ text, situationRelevant: true, reason: 'Membantu ibu menyediakan sarapan untuk keluarga.' })),
};
export const creativeYearExamples = [
  { year: 1, before: 'Saya membantu ibu di dapur.', after: 'Saya membantu ibu menyediakan roti yang sedap untuk sarapan keluarga.' },
  { year: 4, before: 'Saya membantu ibu di dapur.', after: 'Harum roti bakar memenuhi dapur ketika saya membantu ibu menyediakan sarapan yang menyelerakan untuk keluarga.' },
  { year: 6, before: 'Saya membantu ibu di dapur.', after: 'Walaupun masih mengantuk, saya tetap membantu ibu menyediakan sarapan yang berkhasiat kerana kerja bersama itu meringankan tugasnya dan memberi kami peluang berbual sebelum memulakan kegiatan harian.' },
];
