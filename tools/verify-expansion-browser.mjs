// Local, isolated headless Edge checks. Start `npm run dev` before running.
// No browser package, credentials, production service or user profile is used.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { meaningFeedback, expansionFeedback } from '../tests/fixtures/expansion-ai.mjs';
import { reviewedExpansionCases, reviewedFeedback } from '../tests/fixtures/expansion-details.mjs';
import { detailFeedback } from '../tests/fixtures/expansion-separation.mjs';
import { expansionDetails, detailSelectionStates } from '../js/expansion.js';
const origin = process.argv[2] || process.env.BM_TEST_ORIGIN || 'http://localhost:4174';
const executable = process.env.BM_TEST_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
await access(executable);
const profile = await mkdtemp(path.join(os.tmpdir(), 'bm-expansion-browser-'));
const output = path.resolve('test-results/expansion');
await mkdir(output, { recursive: true });
const child = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let socket, seq = 0;
const pending = new Map(), errors = [], results = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn) {
  const start = Date.now();
  while (Date.now() - start < 15000) {
    try { const result = await fn(); if (result) return result; } catch {}
    await delay(100);
  }
  throw Error('Browser condition timed out');
}
function send(method, params = {}) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(Error(`CDP timeout: ${method}`)); }, 15000);
    pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
const select = async (selector, value) => evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); el.value=${JSON.stringify(value)}; el.dispatchEvent(new Event('change',{bubbles:true})); })()`);
const type = async (selector, value) => evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); el.value=${JSON.stringify(value)}; el.dispatchEvent(new Event('input',{bubbles:true})); })()`);
const click = async selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
const state = () => evaluate(`JSON.parse(localStorage.getItem('bmMastery:state:v1'))`);
const saved = async () => { const s = await state(); return s.drafts[s.activeDrafts[`${s.year}:expansion`]]; };
async function key(key, code, virtualKey) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: virtualKey, ...(key === 'Enter' ? { text: '\r' } : {}) });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: virtualKey });
}
async function screenshot(name) {
  const landscapePhone = await evaluate('innerHeight < 500');
  await evaluate(landscapePhone ? `document.querySelector('.expansion-situation').scrollIntoView({block:'start'})` : 'window.scrollTo(0,0)');
  // Edge can repeat compositor tiles in very short full-page captures. Keep
  // landscape-phone evidence to the actual viewport; DOM bounds cover the page.
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: !landscapePhone });
  await writeFile(path.join(output, name + '.png'), Buffer.from(data, 'base64'));
}
try {
  const port = (await until(async () => (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')))).split('\n')[0];
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const entry = pending.get(message.id); if (!entry) return; pending.delete(message.id);
      if (message.error) entry.reject(Error(JSON.stringify(message.error))); else entry.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
  };
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find(target => target.id === targetId);
  const receive = socket.onmessage;
  socket.close(); socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = receive;
  console.log('Browser attached:', version.Browser);
  await send('Runtime.enable'); await send('Page.enable');
  await send('Runtime.runIfWaitingForDebugger');
  console.log('Page runtime:', await evaluate('location.href'));
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__requests = []; window.__spoken = []; window.__pauses = 0; window.__resumes = 0;
    window.__copied = []; window.__releaseAI = [];
    const expansionFixture = ${JSON.stringify(expansionFeedback)};
    const meaningFixture = ${JSON.stringify(meaningFeedback)};
    const detailFixture = ${JSON.stringify(detailFeedback)};
    const reviewedFixtures = ${JSON.stringify(reviewedExpansionCases.map(record => ({ ...record, feedback: reviewedFeedback(record) })))};
    Object.defineProperty(navigator, 'clipboard', {value:{writeText:async text=>{if(window.__clipboardFail)throw Error('clipboard denied');window.__copied.push(text);}}});
    document.execCommand = () => false;
    const fetchOriginal = window.fetch;
    window.fetch = async (url, options) => {
      if (url === '/api/gemini') {
        const input = JSON.parse(options.body); window.__requests.push(input);
        let data = {ok:true,summary:'Cadangan pilihan.',errors:[],suggestions:[],explanation:'Kekalkan idea kamu.',example:input.keyword+' digunakan dalam ayat ini.'};
        if (input.situation && input.keyword === 'membantu') data = structuredClone(expansionFixture);
        if (input.action === 'keyword_meaning') data = {...meaningFixture,keyword:input.keyword};
        if (input.situationId === 'S002') {
          const text = 'Saya membantu ibu membersihkan rumah bersama keluarga.';
          if(input.action === 'keyword_meaning') data.contoh_ayat=text;
          else data.examples=[{text,situationRelevant:true,reason:'Keluarga bekerjasama membersihkan rumah.'}];
        }
        if (window.__useReviewedExamples) {
          const record = reviewedFixtures.find(record=>record.year===input.year && record.keyword===input.keyword && record.situationId===input.situationId);
          if(record && input.action !== 'keyword_meaning') data=structuredClone(record.feedback);
          if(record && input.action === 'keyword_meaning') data={...meaningFixture,keyword:input.keyword,contoh_ayat:'Pada waktu pagi, saya membantu ibu menyediakan sarapan yang berkhasiat di dapur.'};
        }
        if (input.action === 'sentence_expand_details') data=structuredClone(detailFixture);
        if (window.__badDetails && input.action === 'sentence_expand_details') data.examples=[];
        if (window.__badMeaning && input.action === 'keyword_meaning') data.meaning_zh='';
        const response = window.__rateLimited ? Response.json({ok:false,error:{message:'Cikgu AI sibuk. Tunggu seminit sebelum mencuba lagi.'}},{status:429}) : Response.json({ok:true,action:input.action,data});
        if(window.__holdAI) return new Promise(resolve=>window.__releaseAI.push(()=>resolve(response)));
        return response;
      }
      return fetchOriginal(url, options);
    };
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {value: class {constructor(text){this.text=text;}}});
    Object.defineProperty(window, 'speechSynthesis', {value:{getVoices:()=>[{lang:'ms-MY'}],speak:u=>window.__spoken.push(u.text),cancel(){},pause(){window.__pauses++},resume(){window.__resumes++},addEventListener(){},removeEventListener(){}}});
  ` });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${origin}/#expansion` });
  await until(() => evaluate(`!!document.querySelector('#expansion-keyword-select')`));
  assert.equal(await evaluate(`document.querySelectorAll('[data-detail]').length`), 8);
  assert.equal(await evaluate(`document.querySelectorAll('[data-local-check],#local-feedback').length`), 0);
  assert.equal((await saved()).itemId, 'Y1-E-U01-I01');
  await type('#keyword-search', 'emak');
  assert.ok(await evaluate(`document.querySelectorAll('#expansion-keyword-select option').length < 10`));
  assert.ok(await evaluate(`!!document.querySelector('#expansion-keyword-select option[value="Y1-E-U01-I02"]')`));
  await select('#expansion-keyword-select', 'Y1-E-U01-I02');
  const firstId = (await saved()).id;
  await type('#original-input', 'Saya membantu ibu.'); await click('[data-lock-original]');
  assert.equal((await saved()).original, '');
  assert.match(await evaluate(`document.querySelector('#original-keyword-check').textContent`), /emak/);
  await type('#original-input', 'Saya membantu emak.'); await click('[data-lock-original]');
  assert.equal((await saved()).original, 'Saya membantu emak.');
  await type('#student-text', 'Saya membantu emak di dapur.');
  for (const id of ['tempat', 'sebab', 'penerangan', 'kata_adjektif', 'kata_hubung']) await click(`[data-detail="${id}"]`);
  assert.match(await evaluate(`document.querySelector('#guide-kata_hubung').textContent`), /sambil/);
  await evaluate(`document.querySelector('input[data-keyword-mode][value="builtin"]').focus()`);
  await key('ArrowRight', 'ArrowRight', 39);
  assert.equal(await evaluate(`document.querySelector('input[data-keyword-mode]:checked').value`), 'custom');
  assert.equal(await evaluate(`!!document.querySelector('#expansion-keyword-select')`), false);
  assert.equal(await evaluate(`getComputedStyle(document.activeElement.nextElementSibling).outlineStyle`), 'solid');
  await key('Tab', 'Tab', 9);
  assert.equal(await evaluate('document.activeElement.id'), 'custom-keyword');
  await type('#custom-keyword', '   '); await key('Enter', 'Enter', 13);
  assert.match(await evaluate(`document.querySelector('#custom-keyword-error').textContent`), /dahulu/);
  await type('#custom-keyword', '<img src=x onerror=alert(1)>'); await key('Enter', 'Enter', 13);
  assert.equal(await evaluate(`document.querySelectorAll('.expansion-activity img').length`), 0);
  assert.equal((await saved()).fields.customKeyword, undefined);
  await type('#custom-keyword', '  kasih   sayang  '); await key('Enter', 'Enter', 13);
  assert.equal((await saved()).fields.customKeyword, 'kasih sayang');
  assert.equal((await saved()).text, 'Saya membantu emak di dapur.');
  assert.match(await evaluate(`document.querySelector('#expanded-keyword-check').textContent`), /kasih sayang/);
  await type('#student-text', 'Emak menunjukkan kasih sayang kepada kami.');
  assert.match(await evaluate(`document.querySelector('#expanded-keyword-check').textContent`), /ada dalam ayat/);
  for (const action of ['sentence_hint', 'sentence_check', 'sentence_expand', 'sentence_vivid', 'vocabulary_help']) {
    await click(`[data-ai="${action}"]`);
    await until(() => evaluate(`document.querySelector('#teacher-result').textContent.includes('Cadangan pilihan')`));
    const input = await evaluate('window.__requests.at(-1)');
    assert.equal(input.keyword, 'kasih sayang'); assert.equal(input.keywordMode, 'custom');
    assert.equal(input.originalSentence, 'Saya membantu emak.'); assert.equal(input.expansionOptions, undefined); assert.equal(input.detailSelections, undefined);
    await click('#teacher-prompt');
    await until(() => evaluate(`!!document.querySelector('#generated-prompt')`));
    assert.match(await evaluate(`document.querySelector('#generated-prompt').value`), /kasih sayang/);
    await evaluate(`document.querySelector('#modal').close()`);
  }
  const beforeSpeech = JSON.stringify(await saved());
  await click('[data-read-writing]'); await click('[data-speech="pause"]'); await click('[data-speech="resume"]');
  await select('[data-speech-rate]', '0.75'); await click('[data-speech="stop"]');
  assert.deepEqual(await evaluate('[window.__spoken.length,window.__pauses,window.__resumes]'), [1, 1, 1]);
  assert.equal(JSON.stringify(await saved()), beforeSpeech);
  await click('input[data-keyword-mode][value="builtin"]');
  assert.match(await evaluate(`document.querySelector('.keyword-focus').textContent`), /emak/);
  await click('input[data-keyword-mode][value="custom"]');
  await send('Page.reload'); await until(() => evaluate(`!!document.querySelector('#custom-keyword')`));
  assert.equal((await saved()).fields.customKeyword, 'kasih sayang'); assert.equal((await saved()).id, firstId);
  assert.equal((await saved()).original, 'Saya membantu emak.');
  assert.equal((await saved()).text, 'Emak menunjukkan kasih sayang kepada kami.');
  await screenshot('desktop-custom');
  for (const [name, width, height] of [['desktop',1440,900], ['ipad-portrait',768,1024], ['ipad-landscape',1024,768], ['ipad-air-portrait',820,1180], ['android-phone',360,800], ['phone-wide',412,915]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    for (const mode of ['builtin', 'custom']) {
      await click(`input[data-keyword-mode][value="${mode}"]`);
      const layout = await evaluate(`(() => {
        const selectors=['.keyword-modes label','.keyword-inputs input','.keyword-inputs select','#custom-keyword','.expansion-activity .chip','.expansion-activity textarea'];
        const bad=[...document.querySelectorAll(selectors.join(','))].filter(el=>{const r=el.getBoundingClientRect();return r.width && (r.left < -1 || r.right > innerWidth+1 || r.width < 44);}).map(el=>el.outerHTML.slice(0,120));
        return {overflow:document.documentElement.scrollWidth>innerWidth,bad, chips:[...document.querySelectorAll('.expansion-activity .chip')].map(el=>el.getBoundingClientRect().height)};
      })()`);
      assert.equal(layout.overflow, false, `${name} ${mode} page overflow`); assert.deepEqual(layout.bad, [], `${name} ${mode} clipped controls`);
      assert.ok(layout.chips.every(height => height >= 44));
      await screenshot(`${name}-${mode}`);
      results.push({ name, width, height, mode, status: 'PASS' });
    }
  }
  await click('input[data-keyword-mode][value="custom"]');
  const longKeyword = 'perkembangan pembelajaran Bahasa Melayu bersama keluarga tersayang';
  await type('#custom-keyword', longKeyword); await evaluate(`document.querySelector('#custom-keyword-form').requestSubmit()`);
  assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true);
  await screenshot('phone-long-keyword');
  await click('input[data-keyword-mode][value="builtin"]');
  await select('#expansion-keyword-select', 'Y1-E-U01-I03');
  assert.equal((await saved()).text, '');
  await select('#expansion-keyword-select', 'Y1-E-U01-I02');
  assert.equal((await saved()).text, 'Emak menunjukkan kasih sayang kepada kami.');
  await click('a[href="#sentence"]'); await until(() => evaluate(`!!document.querySelector('[data-use-preview]')`));
  assert.equal(await evaluate(`!!document.querySelector('.expansion-keyword')`), false);
  assert.equal(await evaluate(`!!document.querySelector('[data-local-check]')`), true, 'other activities retain their writing check');
  await click('a[href="#expansion"]'); await until(() => evaluate(`!!document.querySelector('.expansion-keyword')`));
  assert.equal((await saved()).text, 'Emak menunjukkan kasih sayang kepada kami.');
  // Situation workflow extends (and does not replace) the original browser checks.
  await click('input[data-keyword-mode][value="custom"]');
  await type('#custom-keyword', 'membantu'); await evaluate(`document.querySelector('#custom-keyword-form').requestSubmit()`);
  await type('#student-text', 'Saya membantu ibu menyediakan sarapan.');
  const pupilWriting = (await saved()).text;
  assert.match(await evaluate(`document.querySelector('.situation-focus').textContent`), /Belum dipilih/);
  assert.equal(await evaluate(`document.querySelectorAll('#situation-select option').length`), 101);
  await select('#situation-category', 'C01');
  assert.equal(await evaluate(`document.querySelectorAll('#situation-select option').length`), 11);
  await type('#situation-search', '  SARÁPAN  ');
  assert.equal(await evaluate(`document.querySelectorAll('#situation-select option').length`), 2);
  await select('#situation-select', 'S001');
  assert.equal((await saved()).fields.situationId, 'S001');
  assert.match(await evaluate(`document.querySelector('.situation-focus').textContent`), /Membantu ibu menyediakan sarapan/);
  await evaluate(`document.querySelector('input[data-situation-mode][value="builtin"]').focus()`);
  await key('ArrowRight', 'ArrowRight', 39);
  assert.equal(await evaluate(`document.querySelector('input[data-situation-mode]:checked').value`), 'custom');
  assert.equal(await evaluate(`!!document.querySelector('#situation-select')`), false);
  await type('#custom-situation', '   '); await click('#custom-situation-form button');
  assert.match(await evaluate(`document.querySelector('#custom-situation-error').textContent`), /dahulu/);
  await type('#custom-situation', '</textarea><img src=x onerror=alert(1)>'); await click('#custom-situation-form button');
  assert.equal(await evaluate(`document.querySelectorAll('.expansion-situation img').length`), 0);
  assert.equal((await saved()).fields.customSituation, undefined);
  const customSituation = 'Saya membantu ibu menyediakan sarapan di dapur pada hari Ahad.';
  await type('#custom-situation', '  ' + customSituation + '  '); await click('#custom-situation-form button');
  assert.equal((await saved()).fields.customSituation, customSituation);
  assert.equal((await saved()).text, pupilWriting);
  for (const action of ['sentence_hint', 'sentence_check', 'sentence_expand', 'sentence_vivid', 'vocabulary_help']) {
    await click(`[data-ai="${action}"]`);
    await until(() => evaluate(`document.querySelectorAll('#teacher-result [data-copy-example]').length===3`));
    const input = await evaluate('window.__requests.at(-1)');
    assert.equal(input.keyword, 'membantu'); assert.equal(input.situationMode, 'custom'); assert.equal(input.situationId, '');
    assert.equal(input.situation, customSituation); assert.equal(input.expansionOptions, undefined); assert.equal(input.detailSelections, undefined);
    const beforeCopies = await evaluate('window.__copied.length');
    await evaluate(`document.querySelector('#teacher-result [data-copy-example="0"]').focus()`); await key('Enter', 'Enter', 13);
    await until(() => evaluate(`window.__copied.length===${beforeCopies + 1}`));
    assert.equal(await evaluate(`window.__copied.at(-1)`), expansionFeedback.examples[0].text);
    assert.match(await evaluate(`document.querySelector('#teacher-result [data-copy-example="0"]').textContent`), /Disalin/);
    await click('#teacher-result [data-copy-example="2"]');
    assert.equal(await evaluate('window.__copied.at(-1)'), expansionFeedback.examples[2].text);
    assert.equal((await saved()).text, pupilWriting);
    await click('#teacher-prompt'); await until(() => evaluate(`!!document.querySelector('#generated-prompt')`));
    assert.ok((await evaluate(`document.querySelector('#generated-prompt').value`)).includes(customSituation));
    await evaluate(`document.querySelector('#modal').close()`);
  }
  await click('[data-keyword-meaning]');
  await until(() => evaluate(`!!document.querySelector('#meaning-teacher-result [lang="zh-Hans"]')`));
  assert.equal(await evaluate(`document.querySelectorAll('#meaning-teacher-result [data-copy-example]').length`), 1);
  assert.equal(await evaluate(`document.querySelector('#meaning-teacher-result [lang="zh-Hans"] dd').textContent`), meaningFeedback.meaning_zh);
  assert.equal(await evaluate('window.__requests.at(-1).situation'), customSituation);
  await click('#meaning-teacher-result [data-copy-example]');
  assert.equal(await evaluate('window.__copied.at(-1)'), meaningFeedback.contoh_ayat);
  const copiesBeforeFailure = await evaluate('window.__copied.length');
  await evaluate('window.__clipboardFail=true'); await click('#meaning-teacher-result [data-copy-example]');
  assert.equal(await evaluate('window.__copied.length'), copiesBeforeFailure);
  assert.match(await evaluate(`document.querySelector('#toast').textContent`), /Tidak dapat menyalin/);
  await evaluate('window.__clipboardFail=false');
  await send('Page.reload'); await until(() => evaluate(`!!document.querySelector('#custom-situation')`));
  assert.equal((await saved()).fields.situationMode, 'custom'); assert.equal((await saved()).fields.customSituation, customSituation);
  assert.equal((await saved()).text, pupilWriting);
  await click('input[data-situation-mode][value="builtin"]');
  assert.match(await evaluate(`document.querySelector('.situation-focus').textContent`), /Membantu ibu menyediakan sarapan/);
  await select('#situation-select', 'S002');
  await evaluate('window.__holdAI=true'); await click('[data-keyword-meaning]');
  await until(() => evaluate('window.__releaseAI.length===1'));
  assert.equal(await evaluate(`document.querySelector('[data-keyword-meaning]').disabled`), true);
  await select('#situation-select', 'S001');
  assert.equal(await evaluate(`document.querySelector('#keyword-meaning-result').textContent`), '');
  await evaluate('window.__holdAI=false'); await click('[data-keyword-meaning]');
  await until(() => evaluate(`!!document.querySelector('#meaning-teacher-result [lang="zh-Hans"]')`));
  await evaluate('window.__releaseAI.splice(0).forEach(release=>release())');
  assert.equal(await evaluate(`document.querySelector('#meaning-teacher-result .ai-example-text p').textContent`), meaningFeedback.contoh_ayat);
  assert.equal((await saved()).text, pupilWriting);
  // Malformed and quota responses must leave writing and retry controls intact.
  await select('#situation-select', 'S002'); await evaluate('window.__badMeaning=true'); await click('[data-keyword-meaning]');
  await until(() => evaluate(`!!document.querySelector('#meaning-teacher-result [role="alert"]')`));
  assert.equal((await saved()).text, pupilWriting);
  await evaluate('window.__badMeaning=false;window.__rateLimited=true'); await click('[data-keyword-meaning]');
  await until(() => evaluate(`document.querySelector('#meaning-teacher-result').textContent.includes('Tunggu seminit')`));
  assert.equal(await evaluate(`document.querySelector('[data-keyword-meaning]').disabled`), false);
  await evaluate('window.__rateLimited=false');
  // Offline selection uses the already loaded static catalogue.
  await send('Network.enable');
  await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await select('#situation-category', 'all'); await type('#situation-search', ''); await select('#situation-select', 'S001');
  assert.equal((await saved()).fields.situationId, 'S001');
  await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  const widths = [['desktop',1440,900], ['ipad-portrait',768,1024], ['ipad-landscape',1024,768], ['android-portrait',360,800], ['android-landscape',800,360]];
  for (const [name, width, height] of widths) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    for (const mode of ['builtin', 'custom']) {
      await click(`input[data-situation-mode][value="${mode}"]`); await click('[data-keyword-meaning]');
      await until(() => evaluate(`!!document.querySelector('#meaning-teacher-result [lang="zh-Hans"]')`));
      const layout = await evaluate(`(() => {
        const controls=[...document.querySelectorAll('.situation-inputs input,.situation-inputs select,#custom-situation,.meaning-languages,.keyword-meaning-output [data-copy-example]')];
        return {overflow:document.documentElement.scrollWidth>innerWidth,bad:controls.filter(el=>{const r=el.getBoundingClientRect();return r.left < -1 || r.right > innerWidth+1;}).map(el=>el.id||el.className),copyHeight:document.querySelector('#meaning-teacher-result [data-copy-example]').getBoundingClientRect().height};
      })()`);
      assert.equal(layout.overflow, false, `${name} ${mode} situation/meaning overflow`); assert.deepEqual(layout.bad, []); assert.ok(layout.copyHeight >= 44);
      await screenshot(`situation-${name}-${mode}`);
      results.push({ name: 'situation-' + name, width, height, mode, status: 'PASS' });
    }
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 800, deviceScaleFactor: 1, mobile: false });
  await evaluate(`document.querySelector('#meaning-teacher-result').scrollIntoView({block:'start'})`);
  const meaningScreenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(path.join(output, 'situation-phone-meaning-visible.png'), Buffer.from(meaningScreenshot.data, 'base64'));
  // Detail-aware checks use reviewed fixtures without replacing earlier coverage.
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await select('#year-select', '4'); await click('#accept-confirm');
  await until(() => evaluate(`document.querySelector('#year-select').value==='4'`));
  await click('input[data-keyword-mode][value="custom"]'); await type('#custom-keyword', 'membantu');
  await evaluate(`document.querySelector('#custom-keyword-form').requestSubmit()`);
  await select('#situation-select', 'S001');
  const richRecord = reviewedExpansionCases.find(record => record.year === 4);
  for (const detail of expansionDetails) {
    if (await evaluate(`document.querySelector('[data-detail="${detail.id}"]').checked`) !== true) await click(`[data-detail="${detail.id}"]`);
  }
  await type('#original-input', richRecord.original); await type('#student-text', 'Saya membantu ibu menyediakan sarapan.');
  await evaluate('window.__useReviewedExamples=true;window.__holdAI=true'); await click('[data-keyword-meaning]');
  await until(() => evaluate('window.__releaseAI.length===1'));
  await type('#original-input', 'Saya membantu ibu menyediakan sarapan.');
  assert.equal(await evaluate(`document.querySelector('#keyword-meaning-result').textContent`), '', 'original edit immediately invalidates pending output');
  await evaluate('window.__holdAI=false;window.__releaseAI.splice(0).forEach(release=>release())');
  await type('#original-input', richRecord.original); await click('[data-lock-original]');
  const richWriting = (await saved()).text;
  for (const action of ['sentence_hint', 'sentence_check', 'sentence_expand', 'sentence_vivid', 'vocabulary_help', 'keyword_meaning']) {
    await click(action === 'keyword_meaning' ? '[data-keyword-meaning]' : `[data-ai="${action}"]`);
    const scope = action === 'keyword_meaning' ? '#meaning-teacher-result' : '#teacher-result';
    await until(() => evaluate(`!!document.querySelector('${scope} [data-copy-example]')`));
    const input = await evaluate('window.__requests.at(-1)');
    assert.equal(input.year, 4); assert.equal(input.detailSelections, undefined); assert.equal(input.expansionOptions, undefined);
    assert.equal(input.originalSentence, richRecord.original); assert.equal(input.studentText, richWriting);
    const expected = action === 'keyword_meaning' ? 'Pada waktu pagi, saya membantu ibu menyediakan sarapan yang berkhasiat di dapur.' : richRecord.after;
    assert.equal(await evaluate(`document.querySelector('${scope} .ai-example-text p').textContent`), expected);
    await click(`${scope} [data-copy-example]`); assert.equal(await evaluate('window.__copied.at(-1)'), expected);
    assert.equal((await saved()).text, richWriting);
    if (action !== 'keyword_meaning') {
      await click('#teacher-prompt'); await until(() => evaluate(`!!document.querySelector('#generated-prompt')`));
      const prompt = await evaluate(`document.querySelector('#generated-prompt').value`);
      assert.ok(!prompt.includes('MATLAMAT BUTIRAN')); assert.ok(prompt.includes('PANDUAN CONTOH TAHUN 4'));
      assert.ok(!prompt.includes('Semak liputan butiran secara semantik')); await evaluate(`document.querySelector('#modal').close()`);
    }
  }
  const completedGeneral = await evaluate(`document.querySelector('#keyword-meaning-result').innerHTML`);
  await click('[data-detail="masa"]');
  assert.equal(await evaluate(`document.querySelector('#keyword-meaning-result').innerHTML`), completedGeneral);
  // An edit makes a fresh general request; checkbox changes must not cancel it.
  await type('#student-text', richWriting + ' Saya membantu ibu menyediakan roti.');
  await evaluate('window.__holdAI=true'); await click('[data-keyword-meaning]');
  await until(() => evaluate('window.__releaseAI.length===1'));
  await click('[data-detail="cara"]');
  assert.equal(await evaluate(`!!document.querySelector('#meaning-teacher-result .loading')`), true);
  await evaluate('window.__holdAI=false;window.__releaseAI.splice(0).forEach(release=>release())');
  await until(() => evaluate(`!!document.querySelector('#meaning-teacher-result [lang="zh-Hans"]')`));
  assert.equal(await evaluate('window.__requests.at(-1).detailSelections'), undefined);
  await type('#student-text', richWriting);
  await click('[data-detail="masa"]'); await click('[data-detail="cara"]');

  // The new inline action alone receives all eight states and returns three cards.
  assert.equal(await evaluate(`document.querySelector('[data-ai="sentence_expand_details"]').closest('.expansion-detail-section').querySelectorAll('[data-detail]').length`), 8);
  await click('[data-ai="sentence_expand_details"]');
  await until(() => evaluate(`document.querySelectorAll('#detail-teacher-result [data-copy-example]').length===3`));
  const dedicated = await evaluate('window.__requests.at(-1)');
  assert.deepEqual(dedicated.detailSelections, detailSelectionStates(expansionDetails.map(detail=>detail.id)));
  assert.equal(dedicated.year, 4); assert.equal(dedicated.situationId, 'S001'); assert.equal(dedicated.keyword, 'membantu');
  for (let i=0;i<3;i++) {
    await evaluate(`document.querySelector('#detail-teacher-result [data-copy-example="${i}"]').focus()`);
    await key('Enter','Enter',13);
    assert.equal(await evaluate('window.__copied.at(-1)'), detailFeedback.examples[i].text);
  }
  assert.equal((await saved()).text, richWriting);
  await click('#detail-teacher-prompt');
  await until(() => evaluate(`!!document.querySelector('#detail-generated-prompt')`));
  const detailPrompt = await evaluate(`document.querySelector('#detail-generated-prompt').value`);
  assert.ok(detailPrompt.includes('MATLAMAT BUTIRAN DIPILIH (8)'));
  assert.ok(!detailPrompt.includes('Pulangkan JSON')); assert.ok(detailPrompt.includes('Beri tepat TIGA'));
  await click('#detail-teacher-run');
  await until(() => evaluate(`document.querySelectorAll('#detail-teacher-result [data-copy-example]').length===3`));
  await click('[data-keyword-meaning]');
  await until(() => evaluate(`!!document.querySelector('#meaning-teacher-result [lang="zh-Hans"]')`));
  const independentGeneral = await evaluate(`document.querySelector('#keyword-meaning-result').innerHTML`);
  await click('[data-detail="masa"]');
  assert.equal(await evaluate(`document.querySelector('#expansion-detail-result').textContent`), '');
  assert.equal(await evaluate(`document.querySelector('#keyword-meaning-result').innerHTML`), independentGeneral);
  await evaluate('window.__holdAI=true'); await click('[data-ai="sentence_expand_details"]');
  await until(() => evaluate('window.__releaseAI.length===1'));
  await click('[data-detail="cara"]');
  assert.equal(await evaluate(`document.querySelector('#expansion-detail-result').textContent`), '');
  await evaluate('window.__holdAI=false'); await click('[data-ai="sentence_expand_details"]');
  await until(() => evaluate(`document.querySelectorAll('#detail-teacher-result [data-copy-example]').length===3`));
  const currentDetails = await evaluate(`document.querySelector('#expansion-detail-result').innerHTML`);
  await evaluate('window.__releaseAI.splice(0).forEach(release=>release())');
  assert.equal(await evaluate(`document.querySelector('#expansion-detail-result').innerHTML`), currentDetails);
  for (const detail of expansionDetails) if(await evaluate(`document.querySelector('[data-detail="${detail.id}"]').checked`)) await click(`[data-detail="${detail.id}"]`);
  const requestsBeforeEmpty = await evaluate('window.__requests.length');
  await click('[data-ai="sentence_expand_details"]');
  assert.equal(await evaluate('window.__requests.length'), requestsBeforeEmpty);
  assert.match(await evaluate(`document.querySelector('#detail-ai-status').textContent`), /Pilih sekurang-kurangnya satu butiran dahulu/);
  await click('[data-detail="tempat"]'); await evaluate('window.__badDetails=true');
  await click('[data-ai="sentence_expand_details"]');
  await until(() => evaluate(`!!document.querySelector('#detail-teacher-result [role="alert"]')`));
  await evaluate('window.__badDetails=false;window.__rateLimited=true'); await click('#detail-teacher-run');
  await until(() => evaluate(`document.querySelector('#detail-teacher-result').textContent.includes('Tunggu seminit')`));
  assert.equal(await evaluate(`document.querySelector('[data-ai="sentence_expand_details"]').disabled`), false);
  await evaluate('window.__rateLimited=false');
  for (const detail of expansionDetails) if(!await evaluate(`document.querySelector('[data-detail="${detail.id}"]').checked`)) await click(`[data-detail="${detail.id}"]`);
  await click('[data-ai="sentence_expand_details"]');
  await until(() => evaluate(`document.querySelectorAll('#detail-teacher-result [data-copy-example]').length===3`));
  for (const [name, width, height] of widths) {
    await send('Emulation.setDeviceMetricsOverride', {width,height,deviceScaleFactor:1,mobile:false});
    for (let i=0;i<3;i++) {
      await evaluate(`document.querySelector('#detail-teacher-result [data-copy-example="${i}"]').scrollIntoView({block:'center'})`);
      const bounds=await evaluate(`(() => {const el=document.querySelector('#detail-teacher-result [data-copy-example="${i}"]'),r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height,overflow:document.documentElement.scrollWidth>innerWidth};})()`);
      assert.ok(bounds.left>=0 && bounds.right<=width && bounds.height>=44 && bounds.top>=0 && bounds.bottom<=height, name);
      assert.equal(bounds.overflow,false,name);
    }
    const capture=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await writeFile(path.join(output,`dedicated-${name}.png`),Buffer.from(capture.data,'base64'));
    results.push({name:'dedicated-'+name,width,height,status:'PASS'});
  }
  for (const [name, width, height] of widths) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await click('[data-ai="sentence_expand"]'); await until(() => evaluate(`!!document.querySelector('#teacher-result [data-copy-example]')`));
    await evaluate(`document.querySelector('#teacher-result [data-copy-example]').scrollIntoView({block:'center'})`);
    const bounds = await evaluate(`(() => {const el=document.querySelector('#teacher-result [data-copy-example]'),r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height,pageOverflow:document.documentElement.scrollWidth>innerWidth};})()`);
    assert.ok(bounds.left >= 0 && bounds.right <= width && bounds.height >= 44 && bounds.top >= 0 && bounds.bottom <= height); assert.equal(bounds.pageOverflow, false);
    const capture = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(path.join(output, `detail-rich-${name}.png`), Buffer.from(capture.data, 'base64'));
    await evaluate(`document.querySelector('#modal').close()`);
    assert.equal(await evaluate(`document.querySelectorAll('[data-local-check],#local-feedback').length`), 0);
    results.push({ name: 'detail-rich-' + name, width, height, status: 'PASS' });
  }
  assert.equal((await saved()).text, richWriting);
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, 'browser-results.json'), JSON.stringify({ browser: version.Browser, checks: results, errors, interactionChecks: 'PASS; AI and speech mocked; no physical devices/audio' }, null, 2));
  console.log(`PASS: keyword/situation workflow, six general actions independent of checkboxes, dedicated detail action, richer fixtures, independent stale protection, removed checker, copy, meaning, offline, TTS, navigation, ${results.length} responsive checks. Screenshots: ${output}`);
} finally {
  if (socket?.readyState === WebSocket.OPEN) { await send('Browser.close').catch(() => {}); socket.close(); }
  if (child.exitCode === null) child.kill();
  if (path.dirname(profile) !== path.resolve(os.tmpdir()) || !path.basename(profile).startsWith('bm-expansion-browser-')) throw Error('Unexpected browser profile path');
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }).catch(() => {});
}
