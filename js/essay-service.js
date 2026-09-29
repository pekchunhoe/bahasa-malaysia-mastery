// A failed optional essay asset must not prevent saved drafts or ejaan/imlak loading.
export async function readEssayCatalog(loader) {
  try {
    const { essays } = await loader();
    if (!essays?.version || !Array.isArray(essays.items)) throw Error('Invalid essay catalog');
    const ids = new Set(), titles = new Set();
    for (const item of essays.items) {
      const title = item.title?.trim().normalize('NFC').toLocaleLowerCase('ms');
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(item.id) || ids.has(item.id) || !title || titles.has(title) ||
          !Number.isInteger(item.year) || item.year < 1 || item.year > 6 ||
          ![item.category, item.writing_type, item.format, item.model_text].every(v => typeof v === 'string' && v.trim()) ||
          item.source_type !== 'essay_master' || item.status !== 'MUKTAMAD' || item.example_status !== 'SIAP' ||
          item.word_count < 120 || item.word_count > 300 || item.word_count !== item.model_text.trim().split(/\s+/u).length)
        throw Error('Incomplete or inconsistent essay catalog');
      ids.add(item.id); titles.add(title);
    }
    return { status: 'ready', version: essays.version, items: essays.items };
  } catch {
    return { status: 'error', version: '', items: [], message: 'Bank karangan tidak dapat dimuatkan. Draf kamu masih boleh ditulis dan disimpan. Cuba muat semula apabila bersedia.' };
  }
}
const catalog = await readEssayCatalog(() => import('../data/generated/essays.js'));
export function essaysForYear(year) {
  return { ...catalog, items: catalog.items.filter(item => item.year === year) };
}
export function filterEssays(items, { year, category = 'all', type = 'all', query = '' } = {}) {
  const search = query.trim().normalize('NFC').toLocaleLowerCase('ms');
  return items.filter(item => (year == null || item.year === year) &&
    (category === 'all' || item.category === category) && (type === 'all' || item.writing_type === type) &&
    `${item.title} ${item.category || ''} ${item.writing_type || ''}`.normalize('NFC').toLocaleLowerCase('ms').includes(search));
}
export const isNarrative = item => ['Cerita pengalaman', 'Cerita rekaan'].includes(item.writing_type);
export function writingTopicsFor(pack, activity) {
  return activity === 'story' ? pack.storyStarters || [] : activity === 'paragraph' ? pack.paragraphTopics || [] : pack.writingTopics || [];
}
export function selectedWritingTopic(pack, draft) {
  const topics = writingTopicsFor(pack, draft.activity);
  if (draft.contentId) return topics.find(topic => topic.id === draft.contentId);
  const matching = topics.filter(topic => topic.title === draft.title);
  return matching.length === 1 ? matching[0] : undefined;
}
