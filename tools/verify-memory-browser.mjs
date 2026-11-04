// Isolated Edge browser checks. Gemini and clipboard are mocked; no pupil data is used.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { memoryNotes, memoryParagraphs, memoryReview } from '../tests/fixtures/essay-memory.mjs';
const origin = process.argv[2] || 'http://localhost:4174';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const executable = process.env.BM_TEST_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
await access(executable);
const output = path.resolve(process.argv[3] || 'test-results/essay-memory');
await mkdir(output, { recursive: true });
const profile = await mkdtemp(path.join(os.tmpdir(), 'bm-memory-'));
const child = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  ...(process.env.BM_TEST_NO_SANDBOX === '1' ? ['--no-sandbox'] : []),
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let socket, sequence = 0;
const pending = new Map(), errors = [], results = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn) {
  const start = Date.now();
  while (Date.now() - start < 15000) {
    const value = await fn().catch(() => false);
    if (value) return value;
    await delay(100);
  }
  throw Error('Browser condition timed out');
}
function send(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(Error(`CDP timeout: ${method}`)); }, 20000);
    pending.set(id, { resolve: result => { clearTimeout(timer); resolve(result); }, reject: error => { clearTimeout(timer); reject(error); } });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
const saved = () => evaluate(`JSON.parse(localStorage.getItem('bmMastery:state:v1'))`);
const text = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).textContent`);
const write = value => evaluate(`{const editor=document.querySelector('#memory-writing');editor.value=${JSON.stringify(value)};editor.dispatchEvent(new Event('input',{bubbles:true}));}`);
async function route(name) {
  await evaluate(`location.hash=${JSON.stringify('#' + name)}`);
  await until(() => evaluate(`document.querySelector('nav [aria-current="page"]').getAttribute('href')===${JSON.stringify('#' + name)}`));
}
async function screenshot(name, selector, block = 'center') {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:${JSON.stringify(block)}})`);
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true });
  await writeFile(path.join(output, name + '.png'), Buffer.from(data, 'base64'));
}
try {
  const port = (await until(() => readFile(path.join(profile, 'DevToolsActivePort'), 'utf8'))).split('\n')[0];
  const browser = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  console.log('Browser:', browser.Browser);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const entry = pending.get(message.id); if (!entry) return;
      pending.delete(message.id);
      if (message.error) entry.reject(Error(JSON.stringify(message.error))); else entry.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
  };
  await send('Runtime.runIfWaitingForDebugger');
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__requests=[];window.__copied=[];window.__richCopied=[];window.__held=[];window.__status=200;
    window.__nativeClipboard=navigator.clipboard;
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{
      write:async items=>{if(window.__richFail||window.__clipboardFail)throw Error('denied');window.__richCopied.push({html:await(await items[0].getType('text/html')).text(),text:await(await items[0].getType('text/plain')).text()});},
      writeText:async text=>{if(window.__clipboardFail)throw Error('denied');window.__copied.push(text);}
    }});
    document.execCommand=()=>{if(window.__fallbackOK){window.__copied.push(document.querySelector('textarea[readonly]').value);return true;}return false;};
    const originalFetch=window.fetch;
    window.fetch=async (url,init)=>{
      if(url!=='/api/gemini')return originalFetch(url,init);
      const request=JSON.parse(init.body);window.__requests.push(request);
      const response=()=>Response.json(window.__status!==200?{ok:false,error:{message:'Cikgu AI sibuk. Tunggu seminit sebelum mencuba lagi.'}}:{ok:true,action:request.action,data:window.__malformed?{}:request.action==='memory_points'?${JSON.stringify(memoryNotes)}:(${memoryReview.toString()})(request.importantPoints)}, {status:window.__status});
      if(window.__hold)return new Promise(resolve=>window.__held.push(()=>resolve(response())));
      return response();
    };
  ` });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: origin + '/#memory' });
  await until(() => evaluate(`document.querySelector('.memory-workspace')`));
  assert.match(await text('.memory-workspace'), /Siapkan karangan kamu/);
  assert.equal(await evaluate('window.__requests.length'), 0);
  await click('.memory-workspace a[href="#essay"]');
  await until(() => evaluate(`document.querySelector('#essay-paragraph-1')`));
  await evaluate(`{const year=document.querySelector('#year-select');year.value='3';year.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#accept-confirm')?.click();}`);
  await until(() => evaluate(`document.querySelector('#year-select').value==='3'&&document.querySelector('#essay-paragraph-1')`));
  await evaluate(`{const select=document.querySelector('#writing-topic-select');const option=[...select.options].find(o=>/gotong/i.test(o.textContent));if(!option)throw Error('Missing gotong-royong topic');select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));}`);
  const editors = [memoryParagraphs.slice(0, 2).join('\n\n'), memoryParagraphs[2], memoryParagraphs[3], memoryParagraphs.slice(4).join('\n\n')];
  await evaluate(`(${JSON.stringify(editors)}).forEach((value,i)=>{const editor=document.querySelector('#essay-paragraph-'+(i+1));editor.value=value;editor.dispatchEvent(new Event('input',{bubbles:true}));})`);
  const originalState = await saved(), draftId = originalState.activeDrafts['3:essay'], originalDraft = originalState.drafts[draftId];
  await route('memory');
  assert.equal(await evaluate(`document.querySelector('a[href="#essay"]').nextElementSibling.getAttribute('href')`), '#memory');
  assert.equal(await evaluate('window.__requests.length'), 0);
  await evaluate('window.__hold=true');
  await click('[data-memory-action="generate"]'); await click('[data-memory-action="generate"]');
  assert.equal(await evaluate('window.__requests.length'), 1);
  await evaluate('window.__held.shift()();window.__hold=false');
  await until(() => evaluate(`document.querySelector('.memory-activities')`));
  assert.deepEqual(await evaluate('window.__requests[0].sourceParagraphs'), memoryParagraphs);
  assert.deepEqual((await saved()).drafts[draftId].memory.versions[0].notes.paragraphs.map(p => p.points.length), [1, 2, 3, 4, 5, 6]);
  assert.equal(await evaluate(`document.querySelector('[data-memory-action="copy"]').disabled`), true);
  assert.equal(await evaluate(`document.querySelector('[data-memory-action="copy-notes"]').disabled`), false);
  const stateBeforeCopy = await saved(), callsBeforeCopy = await evaluate('window.__requests.length');
  await click('[data-memory-action="copy-notes"]');
  await until(() => evaluate(`document.querySelector('[data-memory-notes-copy-status]').textContent==='✅ Isi penting berjaya disalin!'`));
  const richPayload = await evaluate('window.__richCopied.at(-1)');
  assert.equal((richPayload.html.match(/<table /g) || []).length, 6);
  assert.equal((richPayload.html.match(/<tr>/g) || []).length, 21);
  await writeFile(path.join(output, 'clipboard-notes.html'), richPayload.html);
  await writeFile(path.join(output, 'clipboard-notes.txt'), richPayload.text);
  assert.deepEqual(await saved(), stateBeforeCopy);
  assert.equal(await evaluate('window.__requests.length'), callsBeforeCopy);
  await evaluate('window.__richFail=true'); await click('[data-memory-action="copy-notes"]');
  await until(() => evaluate(`document.querySelector('[data-memory-notes-copy-status]').textContent.includes('format teks')`));
  assert.equal(await evaluate('window.__copied.at(-1)'), richPayload.text);
  await evaluate('window.__clipboardFail=true'); await click('[data-memory-action="copy-notes"]');
  await until(() => evaluate(`document.querySelector('[data-memory-notes-copy-status]').textContent.includes('Belum berjaya')`));
  assert.ok(!(await text('[data-memory-notes-copy-status]')).includes('✅'));
  await evaluate('window.__fallbackOK=true'); await click('[data-memory-action="copy-notes"]');
  await until(() => evaluate(`document.querySelector('[data-memory-notes-copy-status]').textContent.includes('format teks')`));
  assert.equal(await evaluate('window.__copied.at(-1)'), richPayload.text);
  await evaluate('window.__richFail=false;window.__clipboardFail=false;window.__fallbackOK=false');
  for (let i = 0; i < 5; i++) await click('[data-memory-move="1"]');
  assert.equal(await evaluate(`document.querySelectorAll('.memory-points li').length`), 6);
  await screenshot('desktop-all-six-points', '.memory-activities');
  await click('[data-memory-activity="1"]');
  assert.equal(await evaluate(`document.querySelectorAll('.memory-points li').length`), 0);
  await click('[data-memory-action="reveal"]');
  assert.equal(await evaluate(`document.querySelectorAll('.memory-points li').length`), 6);
  await click('[data-memory-action="reveal"]');
  assert.equal(await evaluate(`document.querySelectorAll('.memory-points li').length`), 0);
  await click('[data-memory-activity="2"]');
  assert.equal(await evaluate(`document.querySelectorAll('.memory-points, [data-original-paragraph]').length`), 0);
  const writing = ['Saya menyertai aktiviti itu!', 'Kami berhimpun. Guru memberi tugas.', '', 'Saya menjaga bunga.', 'Kami berehat di kantin.', 'Kami pulang dengan gembira.'];
  await write(writing[5]);
  await evaluate('window.__hold=true'); await click('[data-memory-action="check"]');
  const pendingWriting = writing[5] + ' Kami seronok.';
  await write(pendingWriting);
  await evaluate(`document.querySelector('#memory-writing').focus();document.querySelector('#memory-writing').setSelectionRange(4,8);window.__held.shift()();window.__hold=false;`);
  await until(() => evaluate(`document.querySelector('.memory-feedback')`));
  assert.equal(await evaluate(`document.querySelector('#memory-writing').value`), pendingWriting);
  assert.deepEqual(await evaluate(`[document.activeElement.id,document.activeElement.selectionStart,document.activeElement.selectionEnd]`), ['memory-writing', 4, 8]);
  assert.match(await text('.memory-feedback'), /Isi diingati: 1 daripada 6/);
  assert.deepEqual(await evaluate('window.__requests.at(-1).importantPoints'), memoryNotes.paragraphs[5].points);
  assert.equal(await evaluate('window.__requests.at(-1).originalParagraph'), memoryParagraphs[5]);
  await write('Kami pulang. Saya berasa seronok!'); writing[5] = 'Kami pulang. Saya berasa seronok!';
  assert.match(await text('.memory-feedback'), /versi terdahulu/);
  await evaluate('window.__status=429'); await click('[data-memory-action="check"]');
  await until(() => evaluate(`document.querySelector('[data-memory-error]').textContent.includes('sibuk')`));
  assert.equal(await evaluate(`document.querySelector('#memory-writing').value`), writing[5]);
  await evaluate('window.__status=200;window.__malformed=true'); await click('[data-memory-action="check"]');
  await until(() => evaluate(`document.querySelector('[data-memory-error]').textContent.includes('tidak lengkap')`));
  await evaluate('window.__malformed=false'); await click('[data-memory-action="check"]');
  await until(() => evaluate(`!document.querySelector('[data-memory-error]').textContent&&!document.querySelector('.memory-feedback').textContent.includes('versi terdahulu')`));
  await screenshot('desktop-feedback', '#memory-writing');
  for (let i = 4; i >= 0; i--) { await click('[data-memory-move="-1"]'); await write(writing[i]); }
  assert.match(await text('[data-memory-incomplete]'), /Perenggan 3/);
  const assembled = () => [originalDraft.title, ...writing.filter(p => p.trim())].join('\n\n');
  await click('[data-memory-action="copy"]');
  await until(() => evaluate(`document.querySelector('[data-memory-copy-status]').textContent.includes('Berjaya')`));
  assert.equal(await evaluate('window.__copied.at(-1)'), assembled());
  await evaluate('window.__clipboardFail=true'); await click('[data-memory-action="copy"]');
  await until(() => evaluate(`document.querySelector('[data-memory-copy-status]').textContent.includes('Belum berjaya')`));
  assert.ok(!(await text('[data-memory-copy-status]')).includes('✅'));
  await evaluate('window.__fallbackOK=true'); await click('[data-memory-action="copy"]');
  await until(() => evaluate(`document.querySelector('[data-memory-copy-status]').textContent.includes('✅')`));
  assert.equal(await evaluate('window.__copied.at(-1)'), assembled());
  await evaluate('window.__clipboardFail=false;window.__fallbackOK=false');
  await click('[data-memory-move="1"]'); await click('[data-memory-move="1"]');
  writing[2] = 'Kami menyapu daun kering.'; await write(writing[2]);
  assert.equal(await evaluate(`document.querySelectorAll('[data-memory-incomplete]').length`), 0);
  await click('[data-memory-action="check"]');
  await until(() => evaluate(`document.querySelector('.memory-feedback')`));
  const requestsBeforeNavigation = await evaluate('window.__requests.length');
  await route('vocabulary'); await route('memory');
  assert.equal(await evaluate('window.__requests.length'), requestsBeforeNavigation);
  assert.equal(await evaluate(`document.querySelector('#memory-writing').value`), writing[2]);
  await send('Page.reload'); await until(() => evaluate(`document.querySelector('#memory-writing')`));
  assert.equal(await evaluate(`document.querySelector('#memory-writing').value`), writing[2]);
  assert.deepEqual((await saved()).drafts[draftId].memory.versions[0].writing, writing);
  assert.deepEqual((await saved()).drafts[draftId].paragraphs, originalDraft.paragraphs);
  assert.equal(await evaluate('window.__requests.length'), 0);
  for (const [name, width, height, mobile] of [['desktop', 1440, 1000, false], ['ipad-landscape', 1024, 768, true], ['ipad-portrait', 768, 1024, true], ['android', 360, 800, true], ['narrow-mobile', 320, 720, true]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
    await click('[data-memory-activity="0"]');
    const geometry = await evaluate(`({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,controls:[...document.querySelectorAll('.memory-workspace button')].map(el=>({width:el.clientWidth,scroll:el.scrollWidth,height:el.getBoundingClientRect().height}))})`);
    assert.ok(geometry.scroll <= geometry.width + 1, name + ': page overflow');
    assert.ok(geometry.controls.every(c => c.scroll <= c.width + 1 && c.height >= 44), name + ': controls clipped or too small');
    const rows = await evaluate(`[...document.querySelectorAll('.memory-points li')].map(row=>{const box=row.querySelector('.memory-keywords'),sentence=row.querySelector('.memory-sentence'),b=box.getBoundingClientRect(),s=sentence.getBoundingClientRect(),css=getComputedStyle(box);return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,sentenceLeft:s.left,sentenceTop:s.top,boxWidth:box.clientWidth,boxScroll:box.scrollWidth,sentenceWidth:sentence.clientWidth,sentenceScroll:sentence.scrollWidth,strong:sentence.querySelectorAll('strong').length,word:sentence.querySelector('strong').textContent,border:css.borderTopWidth,background:css.backgroundColor,weight:getComputedStyle(sentence).fontWeight};})`);
    assert.equal(rows.length, 3);
    for (const row of rows) {
      assert.equal(row.strong, 1); assert.ok(!/\s/.test(row.word)); assert.equal(row.weight, '400');
      assert.ok(row.boxScroll <= row.boxWidth + 1 && row.sentenceScroll <= row.sentenceWidth + 1, name + ': notes clipped');
      assert.notEqual(row.border, '0px'); assert.notEqual(row.background, 'rgba(0, 0, 0, 0)');
      if (width > 480) assert.ok(row.sentenceLeft >= row.right, name + ': two columns');
      else assert.ok(row.sentenceTop >= row.bottom, name + ': box immediately above sentence');
    }
    assert.match(await text('.memory-keywords'), /Penyapu • Penyodok • Kain buruk/);
    await screenshot(name + '-learn', '.memory-activities');
    // Deliberately long cue phrases exercise wrapping through the real renderer.
    // Restore DOM afterwards; neither saved notes nor student writing are changed.
    const stress = await evaluate(`(async()=>{
      const list=document.querySelector('.memory-points'),before=list.outerHTML;
      const {renderMemoryPoints}=await import('/components/memory-notes.js');
      list.outerHTML=renderMemoryPoints({points:[{primaryKeyword:'Peralatan pembersihan untuk aktiviti gotong-royong bersama rakan sekolah',additionalKeywords:['Penyapu dan penyodok untuk membersihkan halaman sekolah','Kain buruk untuk mengelap meja dan kerusi'],importantSentence:'Kami menyediakan peralatan pembersihan sebelum memulakan aktiviti gotong-royong.',boldWord:'menyediakan'}]});
      const updated=document.querySelector('.memory-points');
      const values={pageOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,clipped:[...updated.querySelectorAll('div')].some(el=>el.scrollWidth>el.clientWidth+1),cueHeight:updated.querySelector('.memory-keywords').getBoundingClientRect().height};
      updated.outerHTML=before;return values;
    })()`);
    assert.equal(stress.pageOverflow, false, name + ': long phrase overflow');
    assert.equal(stress.clipped, false, name + ': long phrase clipping');
    assert.ok(stress.cueHeight > 60, name + ': cues wrap over multiple lines');
    await click('[data-memory-activity="2"]');
    await screenshot(name + '-write', '#memory-writing');
    await screenshot(name + '-final', '[data-memory-final]');
    results.push({ name, width, height, pageOverflow: false, controlsClipped: false, touchTargets: '>=44px',
      keywordLayout: width > 480 ? 'two columns' : 'box directly above sentence', singleBoldWords: true, supportingCues: 3, longCuesWrap: true });
  }
  await route('essay');
  await evaluate(`{const el=document.querySelector('#essay-paragraph-1');el.value+=' Sumber berubah.';el.dispatchEvent(new Event('input',{bubbles:true}));}`);
  await route('memory');
  assert.equal(await evaluate(`document.querySelectorAll('.memory-activities').length`), 0);
  let versions = (await saved()).drafts[draftId].memory.versions;
  assert.equal(versions.length, 2); assert.deepEqual(versions[0].writing, writing); assert.equal(versions[1].notes, null);
  await evaluate(`{const el=document.querySelector('[data-memory-version]');el.value='0';el.dispatchEvent(new Event('change',{bubbles:true}));}`);
  assert.match(await text('.memory-source'), /versi karangan terdahulu/);
  await click('[data-memory-action="copy"]');
  await until(() => evaluate(`window.__copied.length>0`));
  assert.equal(await evaluate('window.__copied.at(-1)'), assembled());
  // Switching essay identities must never reuse notes or writing from the previous title.
  await route('essay');
  await evaluate(`{const select=document.querySelector('#writing-topic-select');select.value=[...select.options].find(o=>o.value&&o.value!==${JSON.stringify(originalDraft.contentId)}).value;select.dispatchEvent(new Event('change',{bubbles:true}));}`);
  await route('memory');
  assert.match(await text('.memory-workspace'), /Siapkan karangan kamu/);
  await route('essay');
  await evaluate(`{const select=document.querySelector('#writing-topic-select');select.value=${JSON.stringify(originalDraft.contentId)};select.dispatchEvent(new Event('change',{bubbles:true}));}`);
  await route('memory');
  versions = (await saved()).drafts[draftId].memory.versions;
  assert.deepEqual(versions[0].writing, writing);
  // Exercise the native browser clipboard/paste path in this temporary profile.
  // Word, Docs and physical device paste remain separate compatibility checks.
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  let nativePaste;
  try {
    await send('Browser.grantPermissions', { origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
    await send('Page.bringToFront');
    await evaluate(`(async()=>{
      const p=${JSON.stringify(richPayload)};
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:window.__nativeClipboard});
      window.__nativePayload=p;
      const editor=document.createElement('div');editor.id='paste-verification';editor.contentEditable='true';editor.setAttribute('aria-label','Rich-text paste verification');
      editor.style='background:white;padding:24px;max-width:1000px;margin:20px auto;border:1px solid #aaa;';
      document.querySelector('main').replaceChildren(editor);editor.focus();
      const {copyRichText}=await import('/components/clipboard.js');
      if(await copyRichText(p)!=='html')throw Error('Native rich clipboard unsupported');
    })()`);
    await send('Input.dispatchKeyEvent', { type: 'keyDown', modifiers: 2, key: 'v', code: 'KeyV', windowsVirtualKeyCode: 86 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: 2, key: 'v', code: 'KeyV', windowsVirtualKeyCode: 86 });
    await until(() => evaluate(`document.querySelectorAll('#paste-verification table').length===6`));
    const pasted = await evaluate(`({tables:document.querySelectorAll('#paste-verification table').length,rows:[...document.querySelectorAll('#paste-verification tr')].map(row=>({cues:row.cells[0].innerText,sentence:row.cells[1].innerText,strong:[...row.cells[1].querySelectorAll('strong,b')].filter(el=>getComputedStyle(el).fontWeight>400).length,border:getComputedStyle(row.cells[0]).borderTopWidth,background:getComputedStyle(row.cells[0]).backgroundColor,weight:getComputedStyle(row.cells[1]).fontWeight})),html:document.querySelector('#paste-verification').innerHTML})`);
    assert.equal(pasted.rows.length, 21);
    assert.ok(pasted.rows.every(row => row.strong === 1 && row.border !== '0px' && row.background !== 'rgba(0, 0, 0, 0)' && row.weight === '400'));
    await writeFile(path.join(output, 'native-pasted-notes.html'), pasted.html);
    await screenshot('desktop-native-rich-paste', '#paste-verification', 'start');
    nativePaste = { status: 'PASS', editor: 'Edge contenteditable', tables: pasted.tables, rows: pasted.rows.length, singleBoldWords: true, visibleKeywordBoxes: true };
  } catch (failure) {
    nativePaste = { status: 'UNVERIFIED', reason: failure.message };
    console.log('Native paste:', nativePaste);
  }
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ api: 'mocked', clipboard: 'mocked rich/text success, denial and fallback; separate native paste attempt', nativePaste, results, errors }, null, 2) + '\n');
  console.log(JSON.stringify({ status: 'PASS', nativePaste, results, screenshots: output }));
} finally {
  socket?.close(); child.kill(); await delay(500);
  assert.equal(path.dirname(profile), os.tmpdir());
  await rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
}
