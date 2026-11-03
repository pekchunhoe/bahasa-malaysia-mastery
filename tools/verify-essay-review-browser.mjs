// Isolated local Edge checks. API and clipboard responses are mocked, never live Gemini.
// Start npm run dev, then: node tools/verify-essay-review-browser.mjs
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { reviewParagraphs, reviewFeedback } from '../tests/fixtures/essay-review.mjs';
import { buildExternalTutorPrompt } from '../js/tutor-actions.js';
const origin = process.argv[2] || 'http://localhost:4174';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname), 'Local testing only');
const executable = process.env.BM_TEST_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
await access(executable);
const output = path.resolve('test-results/essay-review');
await mkdir(output, { recursive: true });
const profile = await mkdtemp(path.join(os.tmpdir(), 'bm-essay-review-'));
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
const close = () => evaluate(`document.querySelector('#modal').close()`);
const saved = () => evaluate(`localStorage.getItem('bmMastery:state:v1')`);
async function fill(paragraphs, input = false) {
  await evaluate(`(${JSON.stringify(paragraphs)}).forEach((text,i)=>{const el=document.querySelector('#essay-paragraph-'+(i+1));el.value=text;${input ? "el.dispatchEvent(new Event('input',{bubbles:true}));" : ''}})`);
}
async function screenshot(name, selector) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);
  await send('Page.bringToFront');
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true });
  await writeFile(path.join(output, `${name}.png`), Buffer.from(data, 'base64'));
}
async function key(key, code, virtualKey) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: virtualKey, ...(key === 'Enter' ? { text: '\r' } : {}) });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: virtualKey });
}
try {
  const port = (await until(() => readFile(path.join(profile, 'DevToolsActivePort'), 'utf8'))).split('\n')[0];
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const entry = pending.get(message.id); if (!entry) return;
      pending.delete(message.id);
      if (message.error) entry.reject(Error(JSON.stringify(message.error))); else entry.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
  };
  const page = await until(async () => {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    return targets.find(target => target.type === 'page' && target.url === 'about:blank');
  });
  const receive = socket.onmessage;
  socket.close(); socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = receive;
  console.log('Browser attached:', version.Browser);
  await send('Runtime.enable'); await send('Page.enable');
  await send('Runtime.runIfWaitingForDebugger');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__requests=[]; window.__copied=[]; window.__held=[]; window.__status=200;
    Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{if(window.__clipboardFail)throw Error('denied');window.__copied.push(text);}}});
    document.execCommand=()=>false;
    const originalFetch=window.fetch;
    window.fetch=async (url,init)=>{
      if(url!=='/api/gemini')return originalFetch(url,init);
      const request=JSON.parse(init.body);window.__requests.push(request);
      const response=()=>window.__status===200?Response.json({ok:true,action:request.action,data:window.__malformed?{ok:true}:${JSON.stringify(reviewFeedback)}}):Response.json({ok:false,error:{message:'Cikgu AI sibuk. Tunggu seminit sebelum mencuba lagi.'}},{status:window.__status});
      if(window.__hold)return new Promise(resolve=>window.__held.push(()=>resolve(response())));
      return response();
    };
  ` });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: origin + '/#essay' });
  await until(() => evaluate(`document.querySelectorAll('[data-essay-paragraph]').length===4`));
  // Choose an actual Year 3 topic; catalogue controls retain the app's real year.
  await evaluate(`const year=document.querySelector('#year-select');year.value='3';year.dispatchEvent(new Event('change',{bubbles:true}))`);
  await evaluate(`document.querySelector('#accept-confirm')?.click()`);
  await until(() => evaluate(`document.querySelector('#essay-paragraph-1') && document.querySelector('#year-select').value==='3'`));
  const initial = await saved();
  await fill(reviewParagraphs);
  for (const [action, index] of [['paragraph_review', 1], ['paragraph_review', 2], ['paragraph_review', 3], ['paragraph_review', 4], ['essay_review', undefined]]) {
    const selector = `[data-copy-essay-review="${action}"]${index ? `[data-review-paragraph="${index}"]` : ''}`;
    await click(selector);
    const prompt = await evaluate('window.__copied.at(-1)');
    assert.match(prompt, /Jangan jawab dalam JSON/);
    assert.doesNotMatch(prompt, /Pulangkan JSON|"summary"\s*:/);
    if (index) {
      assert.ok(prompt.includes(`Perenggan ${index}:\n│ ${reviewParagraphs[index - 1]}`));
      for (let i = index; i < 4; i++) assert.ok(!prompt.includes(reviewParagraphs[i]));
    } else for (const text of reviewParagraphs) assert.ok(prompt.includes(text));
    assert.equal(await saved(), initial);
    assert.equal(await evaluate('window.__requests.length'), 0);
  }
  assert.equal(await evaluate(`document.querySelectorAll('.essay-review-pair').length`), 5);
  const main = '[data-ai="paragraph_review"][data-ai-paragraph="2"]';
  await evaluate('window.__hold=true');
  await evaluate(`const main=document.querySelector(${JSON.stringify(main)});main.click();main.click()`);
  assert.equal(await evaluate('window.__requests.length'), 1);
  assert.equal(await evaluate(`document.querySelector(${JSON.stringify(main)}).disabled`), true);
  assert.match(await evaluate(`document.querySelector('#teacher-result').innerHTML`), /loading/);
  await evaluate('window.__held.shift()();window.__hold=false');
  await until(() => evaluate(`document.querySelector('#teacher-result').textContent.includes('Semakan Perenggan 2')`));
  const paragraphRequest = await evaluate('window.__requests.at(-1)');
  assert.equal(paragraphRequest.studentText, reviewParagraphs[1]);
  assert.deepEqual(paragraphRequest.previousParagraphs, reviewParagraphs.slice(0, 1));
  const originalStored = JSON.parse(await saved());
  const active = originalStored.drafts[originalStored.activeDrafts['3:essay']];
  assert.deepEqual(active.paragraphs, reviewParagraphs);
  await close();
  await fill(reviewParagraphs.map((text, i) => i === 3 ? text + ' Saya mahu membantu lagi.' : text));
  await click('[data-ai="essay_review"]');
  await until(() => evaluate(`document.querySelector('#teacher-result').textContent.includes('Semakan Karangan')`));
  const full = await evaluate('window.__requests.at(-1)');
  assert.equal(full.studentText, reviewParagraphs.map((text, i) => i === 3 ? text + ' Saya mahu membantu lagi.' : text).join('\n\n'));
  assert.equal(full.year, 3);
  await screenshot('desktop-feedback', '#teacher-result');
  await close();
  // Verify quota response, manual retry, invalid JSON data, and unchanged live writing.
  await evaluate(`window.__status=429;document.querySelector('#essay-paragraph-3').value+=' Draf baharu.'`);
  await click('[data-ai="paragraph_review"][data-ai-paragraph="3"]');
  await until(() => evaluate(`!!document.querySelector('#teacher-result [role="alert"]')`));
  assert.equal(await evaluate(`document.querySelector('#teacher-run').disabled`), false);
  await evaluate('window.__status=200'); await click('#teacher-run');
  await until(() => evaluate(`document.querySelector('#teacher-result').textContent.includes('Semakan Perenggan 3')`));
  await close();
  await evaluate(`window.__malformed=true;document.querySelector('#essay-paragraph-4').value+=' Draf semasa.'`);
  await click('[data-ai="essay_review"]');
  await until(() => evaluate(`!!document.querySelector('#teacher-result [role="alert"]')`));
  await evaluate('window.__malformed=false'); await click('#teacher-run');
  await until(() => evaluate(`document.querySelector('#teacher-result').textContent.includes('Semakan Karangan')`));
  await close();
  const copySelector = '[data-copy-essay-review="essay_review"]';
  const beforeCopy = await saved(), callsBeforeCopy = await evaluate('window.__requests.length');
  await evaluate('window.__clipboardFail=true'); await click(copySelector);
  await until(() => evaluate(`document.querySelector('.essay-combined [data-prompt-copy-feedback]').textContent.includes('Tidak dapat menyalin')`));
  await evaluate('window.__clipboardFail=false');
  // Native keyboard activation preserves the icon and visible confirmation.
  await evaluate(`document.querySelector(${JSON.stringify(copySelector)}).focus()`); await key('Enter', 'Enter', 13);
  await until(() => evaluate(`document.querySelector('.essay-combined [data-prompt-copy-feedback]').textContent.includes('Disalin')`));
  assert.equal(await saved(), beforeCopy);
  assert.equal(await evaluate('window.__requests.length'), callsBeforeCopy);
  assert.equal(await evaluate(`document.querySelector(${JSON.stringify(copySelector)}+' svg').getBoundingClientRect().width`), 14);
  for (const [name, width, height] of [['desktop', 1440, 1000], ['ipad-portrait', 768, 1024], ['ipad-landscape', 1024, 768], ['android', 360, 800], ['android-narrow', 320, 720]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    const geometry = await evaluate(`(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,pairs:[...document.querySelectorAll('.essay-review-pair')].map(pair=>{const main=pair.querySelector('[data-ai]'),copy=pair.querySelector('.mini-prompt-button'),a=main.getBoundingClientRect(),b=copy.getBoundingClientRect();return {left:a.left,right:b.right,mainRight:a.right,copyLeft:b.left,copyWidth:b.width,copyHeight:b.height,mainClient:main.clientWidth,mainScroll:main.scrollWidth,copies:pair.querySelectorAll('.mini-prompt-button').length,label:copy.getAttribute('aria-label')}})}))()`);
    assert.ok(geometry.scrollWidth <= width, `${name}: page overflow`);
    for (const pair of geometry.pairs) {
      assert.equal(pair.copies, 1); assert.match(pair.label, /Salin Prompt/);
      assert.ok(pair.left >= 0 && pair.right <= width, `${name}: controls off screen`);
      assert.ok(pair.mainRight <= pair.copyLeft, `${name}: overlapping buttons`);
      assert.ok(pair.copyWidth >= 44 && pair.copyHeight >= 44);
      assert.ok(pair.mainScroll <= pair.mainClient + 1, `${name}: truncated main button`);
    }
    await click('[data-ai="essay_review"]');
    await until(() => evaluate(`document.querySelector('#teacher-result').textContent.includes('Semakan Karangan')`));
    assert.ok(await evaluate(`document.querySelector('#modal').scrollWidth<=document.querySelector('#modal').clientWidth+1`), `${name}: feedback overflow`);
    if (name === 'ipad-portrait') await screenshot('ipad-portrait-feedback', '#teacher-result');
    await close();
    if (['desktop', 'ipad-portrait'].includes(name)) {
      await screenshot(`${name}-paragraph-actions`, '[data-ai="paragraph_review"][data-ai-paragraph="2"]');
      await screenshot(`${name}-essay-actions`, '[data-ai="essay_review"]');
    }
    results.push({ name, width, height, pageOverflow: false, overlap: false, reviewPairs: geometry.pairs.length, feedbackOverflow: false });
  }
  // Same output contract and snapshot as a real browser review request.
  assert.equal(buildExternalTutorPrompt(full).includes('Pulangkan JSON'), false);
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ api: 'mocked', results, requests: await evaluate('window.__requests.length'), errors }, null, 2) + '\n');
  console.log(JSON.stringify({ api: 'mocked', results, screenshots: output }));
} finally {
  socket?.close(); child.kill();
  await delay(500);
  // Only delete the unique temporary profile created by this script.
  assert.equal(path.dirname(profile), os.tmpdir());
  await rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
}
