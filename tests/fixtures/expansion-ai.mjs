// Mocked teaching output, never a claim of live Gemini generation.
export const meaningFeedback = {
  ok: true, keyword: 'membantu',
  maksud_bm: 'Memberikan pertolongan kepada seseorang untuk melakukan sesuatu.',
  meaning_en: 'To help someone do something.',
  meaning_zh: '帮助别人做某件事情。',
  contoh_ayat: 'Saya membantu ibu menyediakan sarapan di dapur.',
  situationRelevant: true, reason: 'Contoh menerangkan bantuan kepada ibu semasa menyediakan sarapan.', sameMeaning: true,
};
export const expansionFeedback = {
  ok: true, summary: 'Kamu sudah menyatakan siapa yang dibantu.', errors: [],
  suggestions: ['Tambah butiran masa atau tempat yang sesuai.'], explanation: 'Pilih butiran yang berkaitan dengan idea kamu.',
  examples: [
    { text: 'Pada waktu pagi, saya membantu ibu menyediakan sarapan di dapur.', situationRelevant: true, reason: 'Bantuan kepada ibu untuk menyediakan sarapan.' },
    { text: 'Saya membantu ibu menyediakan sarapan sambil berbual dengannya.', situationRelevant: true, reason: 'Kegiatan bersama ibu semasa menyediakan sarapan.' },
    { text: 'Saya membantu ibu menyediakan sarapan supaya kami dapat makan bersama-sama.', situationRelevant: true, reason: 'Tujuan menyediakan sarapan bersama ibu.' },
  ],
};
export const expansionRequest = (changes = {}) => ({ activity: 'expansion', action: 'sentence_expand', year: 2,
  title: 'Tambah butiran yang bermakna', keywordMode: 'custom', keyword: 'membantu',
  situationMode: 'builtin', situationId: 'S001', situation: 'Membantu ibu menyediakan sarapan.',
  originalSentence: 'Saya membantu ibu.', studentText: 'Saya membantu ibu menyediakan sarapan.',
  expansionOptions: ['tempat', 'masa', 'kata_hubung'], ...changes });
