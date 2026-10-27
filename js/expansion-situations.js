import { situations, situationCategories } from '../data/situations.js';
export { situations, situationCategories };
export const MAX_SITUATION = 300;
export const cleanSituation = value => typeof value === 'string' ? value.normalize('NFC').trim() : '';
export function situationError(value) {
  const text = cleanSituation(value);
  if (!text || !/\p{L}/u.test(text)) return 'Tulis situasi kamu dahulu.';
  if (text.length > MAX_SITUATION) return 'Gunakan situasi ringkas, maksimum 300 aksara.';
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]|<\/?[a-z][^>]*>/iu.test(text))
    return 'Tulis situasi dalam ayat biasa tanpa kod.';
  return '';
}
const searchText = value => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('ms').trim().replace(/\s+/gu, ' ');
export function filterSituations({ category = 'all', query = '' } = {}) {
  const terms = searchText(query).split(' ').filter(Boolean);
  return situations.filter(record => (category === 'all' || record.categoryId === category) &&
    terms.every(term => searchText(record.text).includes(term)));
}
export function activeSituation(draft) {
  const fields = draft.fields || {};
  const situationMode = fields.situationMode === 'custom' ? 'custom' : 'builtin';
  const record = situationMode === 'builtin' ? situations.find(record => record.id === fields.situationId) : null;
  const custom = cleanSituation(fields.customSituation);
  return { situationMode, situationId: record?.id || '',
    situation: situationMode === 'custom' ? situationError(custom) ? '' : custom : record?.text || '' };
}
// Resolve built-in text on the server from its stable ID. Never send a hidden
// mode's situation, or guess one for a draft created before this feature.
export function situationRequest(raw) {
  const situationMode = raw.situationMode ?? 'builtin';
  if (!['builtin', 'custom'].includes(situationMode)) throw Error('Mod situasi tidak sah.');
  const situationId = raw.situationId ?? '';
  const supplied = raw.situation ?? '';
  if (typeof situationId !== 'string' || typeof supplied !== 'string' || supplied.length > MAX_SITUATION)
    throw Error('Situasi tidak sah.');
  if (situationMode === 'custom') {
    if (situationId || (supplied && situationError(supplied))) throw Error('Situasi sendiri tidak sah.');
    return { situationMode, situationId: '', situation: cleanSituation(supplied) };
  }
  const record = situations.find(record => record.id === situationId);
  if ((situationId && !record) || (supplied && supplied !== record?.text)) throw Error('Situasi pilihan tidak sepadan.');
  return { situationMode, situationId: record?.id || '', situation: record?.text || '' };
}
export function hydrateSituationFields(fields) {
  const result = { ...fields };
  // Missing fields intentionally stay missing for legacy drafts.
  if ('situationMode' in result) result.situationMode = result.situationMode === 'custom' ? 'custom' : 'builtin';
  if ('situationId' in result && !situations.some(record => record.id === result.situationId)) result.situationId = '';
  if ('customSituation' in result) result.customSituation = situationError(result.customSituation) ? '' : cleanSituation(result.customSituation);
  if ('customSituationDraft' in result) result.customSituationDraft = result.customSituationDraft.slice(0, MAX_SITUATION);
  if ('situationQuery' in result) result.situationQuery = result.situationQuery.slice(0, 100);
  if ('situationCategory' in result && !situationCategories.some(record => record.id === result.situationCategory)) result.situationCategory = 'all';
  return result;
}
