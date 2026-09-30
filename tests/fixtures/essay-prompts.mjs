export const representativeEssay = 'Saya sangat gembira pada pagi itu. Saya membantu ibu menyediakan sarapan. Saya membantu ibu membancuh air teh. Selepas itu, kami makan bersama-sama. Saya sangat gembira kerana dapat membantu ibu.';
export const essayPromptRequest = (action = 'essay_review', changes = {}) => ({
  activity: 'essay', action, year: 3, title: 'Membantu Ibu Menyediakan Sarapan',
  stage: 5, studentText: representativeEssay, contentId: 'private-content-id',
  ...(action === 'essay_review' ? {} : {
    paragraphIndex: 2, previousParagraphs: ['Pada pagi Ahad, saya berada di dapur bersama ibu.'],
  }),
  ...changes,
});

export const externalHeadings = {
  sentence_hint: 'Petunjuk',
  vocabulary_help: 'Cadangan kata atau frasa',
  essay_next_step: 'Idea untuk sambung',
  essay_ideas: 'Idea untuk perenggan ini',
  essay_develop: 'Cara mengembangkan idea',
  essay_vivid: 'Cara menjadikan tulisan lebih menarik',
  paragraph_review: 'Semakan Perenggan',
  essay_review: 'Semakan Karangan',
};
