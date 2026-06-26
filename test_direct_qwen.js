import puppeteer from 'puppeteer';
import path from 'path';

const ARTIFACT_DIR = '/Users/curtispenick/.gemini/antigravity/brain/58f08bf8-26de-41e8-9672-e57951be959b';

async function runTest() {
  console.log('🚀 Starting direct Ollama API test with Qwen2.5-VL...');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', msg => {
    console.log(`[Browser Console] ${msg.type().toUpperCase()}: ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.error(`[Browser Error] ${err.toString()}`);
  });

  try {
    console.log('🔗 Navigating to http://localhost:5173...');
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('h1', { timeout: 60000 });
    console.log('✅ Page loaded successfully.');
    await new Promise(r => setTimeout(r, 2000));

    // Switch to Pi 5 tab
    console.log('📂 Switching to Pi 5 Console tab...');
    const tabButtons = await page.$$('button');
    let piTabBtn = null;
    for (const btn of tabButtons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('3. Pi 5 AI Brain')) {
        piTabBtn = btn;
        break;
      }
    }
    if (piTabBtn) {
      await piTabBtn.click();
      console.log('✅ Switched to Pi 5 tab.');
      await new Promise(r => setTimeout(r, 1000));
    }

    // Configure Brain Provider to 'ollama' (should be default, but let's select it explicitly)
    console.log('⚙️ Selecting Local Ollama API...');
    await page.select('select:nth-of-type(1)', 'ollama'); // first select
    await new Promise(r => setTimeout(r, 1000));

    // Try to click refresh models to populate list
    console.log('↻ Refreshing model list...');
    const buttons = await page.$$('button');
    let refreshBtn = null;
    for (const btn of buttons) {
      const className = await page.evaluate(el => el.className, btn);
      if (className.includes('p-1.5') && className.includes('text-slate-400')) { // Refresh button has this class
        refreshBtn = btn;
        break;
      }
    }
    if (refreshBtn) {
      await refreshBtn.click();
      console.log('✅ Clicked refresh models.');
      await new Promise(r => setTimeout(r, 2500));
    }

    // Select 'qwen2.5vl:3b' from the model select dropdown
    console.log('⚙️ Selecting qwen2.5vl:3b model...');
    await page.evaluate(() => {
      const selects = document.querySelectorAll('select');
      if (selects.length >= 2) {
        const modelSelect = selects[1];
        const option = Array.from(modelSelect.options).find(o => o.value.includes('qwen'));
        if (option) {
          modelSelect.value = option.value;
          modelSelect.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          console.error('qwen option not found! Options:', Array.from(modelSelect.options).map(o => o.value));
        }
      }
    });
    await new Promise(r => setTimeout(r, 1000));

    // Switch to Arduino IDE tab
    console.log('📂 Switching to Arduino IDE tab...');
    const tabs = await page.$$('button');
    let codeTabBtn = null;
    for (const btn of tabs) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('2. Arduino IDE')) {
        codeTabBtn = btn;
        break;
      }
    }
    if (codeTabBtn) {
      await codeTabBtn.click();
      await new Promise(r => setTimeout(r, 1000));
    }

    // Compile & Upload
    console.log('⚡ Clicking Compile & Upload...');
    const actions = await page.$$('button');
    let compileBtn = null;
    for (const btn of actions) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Compile & Upload')) {
        compileBtn = btn;
        break;
      }
    }
    if (compileBtn) {
      await compileBtn.click();
      console.log('✅ Uploaded sketch.');
      await new Promise(r => setTimeout(r, 1500));
    }

    // Run Simulation
    console.log('▶️ Starting simulation...');
    const playActions = await page.$$('button');
    let runBtn = null;
    for (const btn of playActions) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Run Simulation')) {
        runBtn = btn;
        break;
      }
    }
    if (runBtn) {
      await runBtn.click();
      console.log('✅ Simulation active.');
    }

    // Wait 25 seconds to capture responses and errors
    console.log('⏱️ Waiting for AI queries to execute...');
    await new Promise(r => setTimeout(r, 25000));

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    console.log('🔌 Closing browser...');
    await browser.close();
    console.log('🏁 Finished.');
  }
}

runTest();
