// Architectural profiles, not official curriculum mappings or assessment targets.
const profiles = [
  {
    focus: "Perkataan, frasa dan ayat mudah",
    guidance: "Pilih siapa dan apa yang dilakukan. Tulis satu ayat mudah.",
    fields: 2,
    feedback:
      "Ayat pendek, perkataan mudah, paling banyak dua cadangan. Elakkan istilah teknikal.",
    expectation: "Satu ayat bermakna dahulu; sambung dengan bimbingan.",
    questions: ["Siapakah yang kamu lihat?", "Apakah yang dilakukannya?"],
    exampleIndex: 0,
  },
  {
    focus: "Ayat yang lebih lengkap",
    guidance:
      "Tambahkan tempat atau masa jika sesuai. Cuba hubungkan dua ayat.",
    fields: 4,
    feedback:
      "Penerangan ringkas dan satu atau dua cadangan yang mudah dibuat.",
    expectation: "Dua atau lebih ayat berkaitan dengan bantuan.",
    questions: [
      "Di manakah perkara ini berlaku?",
      "Bilakah perkara ini berlaku?",
    ],
    exampleIndex: 1,
  },
  {
    focus: "Ayat majmuk dan urutan idea",
    guidance:
      "Hubungkan idea dengan kata hubung. Ceritakan sebab atau urutan peristiwa.",
    fields: 6,
    feedback:
      "Kenal pasti masalah khusus. Jelaskan kata hubung, sebab dan akibat secara mudah.",
    expectation: "Perenggan pendek dan karangan ringkas berpandu.",
    questions: [
      "Apakah yang berlaku selepas itu?",
      "Mengapakah perkara itu berlaku?",
    ],
    exampleIndex: 2,
  },
  {
    focus: "Idea utama dan butiran sokongan",
    guidance:
      "Pilih satu idea utama. Sokong idea itu dengan butiran dan contoh.",
    fields: 6,
    feedback:
      "Terangkan perkembangan idea utama, idea sampingan dan hubungan antara ayat.",
    expectation: "Perenggan yang berkembang dengan susunan idea yang jelas.",
    questions: [
      "Apakah idea utama kamu?",
      "Contoh manakah yang menyokong idea itu?",
    ],
    exampleIndex: 2,
  },
  {
    focus: "Perenggan yang saling berkaitan",
    guidance:
      "Rancang beberapa perenggan. Pelbagaikan ayat dan pilih kata yang tepat.",
    fields: 6,
    feedback:
      "Bincangkan tatabahasa, kohesi, pilihan kata dan variasi ayat dengan contoh pendek.",
    expectation:
      "Beberapa perenggan yang berkaitan dengan perancangan lebih berdikari.",
    questions: [
      "Bagaimanakah idea ini berkait dengan perenggan sebelumnya?",
      "Apakah butiran yang paling penting?",
    ],
    exampleIndex: 3,
  },
  {
    focus: "Menulis, menyunting dan memperhalus",
    guidance:
      "Bina pendapat sendiri. Semak koheren, penanda wacana dan ketepatan bahasa.",
    fields: 6,
    feedback:
      "Berikan penerangan tatabahasa, koheren, kohesi dan struktur. Utamakan pembaikan yang bermakna.",
    expectation:
      "Karangan beberapa perenggan yang koheren; semak dan baiki secara berdikari.",
    questions: [
      "Apakah pandangan atau cadangan kamu?",
      "Bagaimanakah penutup mengukuhkan idea utama?",
    ],
    exampleIndex: 3,
  },
];
export function difficultyFor(year) {
  if (!Number.isInteger(year) || !profiles[year - 1])
    throw new Error("Invalid year");
  return structuredClone({ year, ...profiles[year - 1] });
}
