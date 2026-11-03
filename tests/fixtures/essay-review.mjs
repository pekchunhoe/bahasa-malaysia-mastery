export const reviewParagraphs = [
  'Pada pagi Ahad, saya membantu ibu menyediakan sarapan di dapur.',
  'Saya membantu ibu memotong roti Kami meletakkan roti di atas pinggan.',
  'Selepas itu, saya membancuh air teh dengan berhati-hati. Ibu menyediakan telur rebus.',
  'Kami makan bersama-sama. Saya berasa gembira kerana dapat membantu ibu.',
];
export const reviewRequest = (action = 'essay_review', paragraphIndex = 2, changes = {}) => ({
  action, activity: 'essay', year: 3, title: 'Membantu Ibu Menyediakan Sarapan', stage: 4,
  writingType: 'Cerita pengalaman', planningNotes: ['Menyediakan sarapan bersama ibu.', 'Memotong roti dan membancuh teh.'],
  ...(action === 'paragraph_review' ? { paragraphIndex, previousParagraphs: reviewParagraphs.slice(0, paragraphIndex - 1),
    studentText: reviewParagraphs[paragraphIndex - 1] } : { studentText: reviewParagraphs.join('\n\n') }),
  ...changes,
});
export const reviewFeedback = {
  ok: true, summary: 'Idea membantu ibu jelas dan berkaitan dengan tajuk.',
  errors: ['Letakkan noktah selepas “roti” sebelum ayat “Kami meletakkan roti di atas pinggan.”'],
  suggestions: ['Kekalkan urutan tindakan supaya pembaca mudah mengikuti cerita.'],
  explanation: 'Noktah memisahkan dua ayat lengkap. Baca semula setiap ayat dengan perlahan.',
  example: 'Saya membantu ibu memotong roti. Kami meletakkan roti di atas pinggan.',
};
