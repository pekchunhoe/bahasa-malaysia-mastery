// Local teaching prompts, not extracted essay answers or an official assessment rubric.
const guides = {
  'Cerita pengalaman': {
    purpose: 'Ceritakan pengalaman kamu mengikut urutan. Pilih butiran dan perasaan sendiri.',
    questions: ['Bila, di mana dan dengan siapa?', 'Apakah yang berlaku dahulu dan kemudian?', 'Apakah perasaan atau perkara yang kamu pelajari?'],
    format: ['Perkenalkan peristiwa.', 'Susun kejadian mengikut masa.', 'Akhiri dengan perasaan atau pengajaran.'],
  },
  'Cerita rekaan': {
    purpose: 'Cipta watak, tempat dan masalah sendiri. Fikirkan penyelesaian yang berkaitan.',
    questions: ['Siapakah watak dan di manakah cerita bermula?', 'Apakah masalah dan tindakan watak?', 'Bagaimanakah masalah selesai?'],
    format: ['Permulaan: kenalkan watak dan latar.', 'Perkembangan: masalah dan tindakan.', 'Penutup: penyelesaian dan perubahan watak.'],
  },
  'Gambaran': {
    purpose: 'Gambarkan orang, tempat atau suasana dengan butiran yang jelas.',
    questions: ['Apakah yang hendak digambarkan?', 'Apakah rupa, bunyi atau ciri yang menarik?', 'Mengapakah perkara ini bermakna kepada kamu?'],
    format: ['Kenalkan perkara yang digambarkan.', 'Susun ciri mengikut bahagian atau kepentingan.', 'Akhiri dengan kesan atau perasaan.'],
  },
  'Penerangan fakta': {
    purpose: 'Terangkan idea dengan fakta yang kamu tahu. Bezakan fakta daripada pendapat.',
    questions: ['Apakah perkara utama yang hendak diterangkan?', 'Apakah fakta dan contoh yang menyokongnya?', 'Apakah kesimpulan yang dapat dibuat?'],
    format: ['Kenalkan perkara utama.', 'Satu isi dan huraian yang berkaitan bagi setiap perenggan.', 'Rumuskan penerangan tanpa menambah fakta yang tidak pasti.'],
  },
  'Langkah dan panduan': {
    purpose: 'Susun langkah supaya pembaca dapat mengikutinya dengan selamat.',
    questions: ['Apakah tujuan dan persediaan yang diperlukan?', 'Apakah langkah pertama, seterusnya dan terakhir?', 'Apakah langkah keselamatan atau semakan hasil?'],
    format: ['Nyatakan tujuan dan persediaan.', 'Susun arahan mengikut turutan.', 'Terangkan hasil dan peringatan keselamatan.'],
  },
  'Karangan pendapat': {
    purpose: 'Nyatakan pendapat kamu dan jelaskan sebab serta contoh yang sesuai.',
    questions: ['Apakah pendirian kamu?', 'Mengapakah kamu berpendapat demikian? Apakah contohnya?', 'Apakah cadangan atau rumusan kamu?'],
    format: ['Nyatakan pendirian.', 'Huraikan sebab dan contoh bagi setiap isi.', 'Rumuskan pendirian dan cadangan dengan sopan.'],
  },
  'Laporan': {
    purpose: 'Laporkan kegiatan dengan maklumat yang jelas dan objektif.',
    questions: ['Apakah kegiatan, tarikh, tempat dan pihak yang terlibat?', 'Apakah tujuan dan perkara yang berlaku?', 'Apakah hasil kegiatan dan siapa yang menyediakan laporan?'],
    format: ['Tajuk laporan.', 'Pengenalan: kegiatan, masa, tempat dan peserta.', 'Isi: perjalanan dan hasil kegiatan.', 'Penutup, nama pelapor, jawatan dan tarikh jika diperlukan.'],
  },
  'Surat rasmi': {
    purpose: 'Tulis kepada penerima yang sesuai dengan bahasa yang sopan dan tujuan yang jelas.',
    questions: ['Siapakah pengirim dan penerima? Apakah alamat serta tarikh?', 'Apakah perkara dan tujuan surat?', 'Apakah butiran, permohonan atau tindakan yang diharapkan?'],
    format: ['Alamat pengirim dan penerima serta tarikh.', 'Panggilan hormat dan perkara surat.', 'Pengenalan tujuan, isi bernombor yang sesuai dan penutup sopan.', 'Tandatangan, nama dan jawatan jika berkenaan.'],
  },
  'Surat tidak rasmi': {
    purpose: 'Sampaikan cerita atau berita kepada keluarga atau sahabat dengan mesra.',
    questions: ['Kepada siapa kamu menulis?', 'Apakah berita atau pengalaman yang ingin dikongsi?', 'Apakah harapan dan salam penutup kamu?'],
    format: ['Alamat dan tarikh jika diperlukan oleh tugasan.', 'Kata sapaan dan bertanya khabar.', 'Isi surat dengan bahasa mesra.', 'Salam penutup dan nama pengirim.'],
  },
  'Dialog': {
    purpose: 'Cipta perbualan yang mempunyai tujuan dan giliran yang jelas.',
    questions: ['Siapakah yang berbual dan di mana?', 'Apakah soalan, jawapan atau masalah mereka?', 'Bagaimanakah perbualan berakhir?'],
    format: ['Nyatakan latar ringkas jika perlu.', 'Mulakan baris baharu untuk setiap penutur: Nama: percakapan.', 'Gunakan bahasa yang sesuai dan tanda baca yang jelas.'],
  },
  'Catatan harian': {
    purpose: 'Catat peristiwa dan perasaan kamu mengikut masa.',
    questions: ['Apakah hari, tarikh atau masa peristiwa?', 'Apakah yang kamu lakukan atau alami?', 'Bagaimanakah perasaan kamu selepas itu?'],
    format: ['Hari dan tarikh; masa jika perlu.', 'Peristiwa mengikut turutan.', 'Perasaan atau refleksi sendiri.'],
  },
  'Syarahan dan ucapan': {
    purpose: 'Sampaikan isi kepada pendengar dengan bahasa yang jelas dan sopan.',
    questions: ['Siapakah pendengar dan apakah tujuan kamu?', 'Apakah isi, alasan atau penghargaan yang hendak disampaikan?', 'Apakah pesanan dan penutup kamu?'],
    format: ['Kata alu-aluan mengikut pendengar.', 'Pengenalan tajuk atau tujuan majlis.', 'Isi yang tersusun dengan sapaan kepada hadirin jika sesuai.', 'Rumusan, harapan dan ucapan terima kasih.'],
  },
};
guides['Penerangan mudah'] = guides['Penerangan fakta'];
guides['Langkah mudah'] = guides['Langkah dan panduan'];
export function writingGuidance(topic, year) {
  let guide = guides[topic?.writing_type] || { purpose: 'Pilih satu idea dan tulis dengan kata-kata sendiri.',
    questions: ['Apakah idea utama?', 'Apakah butiran yang menyokongnya?', 'Bagaimanakah tulisan kamu berakhir?'],
    format: ['Pengenalan, isi yang berkaitan dan penutup.'] };
  // The workbook groups speeches together; the supplied title identifies the occasion.
  if (topic?.writing_type === 'Syarahan dan ucapan') {
    if (/^Ucapan\b/i.test(topic.title)) guide = { ...guide,
      purpose: 'Sampaikan ucapan yang sesuai dengan majlis dan orang yang hadir.',
      questions: ['Apakah majlis dan siapakah hadirin?', 'Siapakah yang hendak dialu-alukan atau dihargai?', 'Apakah harapan dan pesanan kamu untuk majlis ini?'],
      format: ['Kata alu-aluan dan sapaan kepada hadirin.', 'Nyatakan tujuan majlis serta penghargaan yang sesuai.', 'Sampaikan harapan, pesanan dan ucapan terima kasih.'] };
    else if (/^Syarahan\b/i.test(topic.title)) guide = { ...guide,
      purpose: 'Huraikan tajuk syarahan dengan isi, alasan dan contoh yang meyakinkan.',
      questions: ['Siapakah pendengar dan apakah tajuk syarahan?', 'Apakah isi, alasan dan contoh yang menyokongnya?', 'Apakah rumusan dan seruan kamu kepada pendengar?'],
      format: ['Kata alu-aluan dan pengenalan tajuk syarahan.', 'Susun isi, alasan dan contoh; gunakan sapaan yang sesuai.', 'Rumuskan isi, berikan seruan dan ucapkan terima kasih.'] };
  }
  return { ...guide,
    level: year <= 2 ? 'Mulakan dengan satu atau dua ayat mudah. Kembangkan satu perenggan dengan bantuan. Panjang contoh bukan sasaran wajib.'
      : year <= 4 ? 'Bina satu isi utama dan beberapa butiran sokongan. Hubungkan ayat dan perenggan mengikut urutan.'
        : 'Rancang isi, huraian dan contoh sendiri. Semak hubungan antara perenggan, format dan ketepatan bahasa.',
    rows: year <= 2 ? 6 : year <= 4 ? 10 : 14,
    checklist: ['Adakah tulisan saya berkaitan dengan tajuk?', 'Adakah isi saya disusun mengikut jenis karangan?', 'Adakah saya menggunakan kata-kata sendiri dan menyemak tanda baca?'] };
}
