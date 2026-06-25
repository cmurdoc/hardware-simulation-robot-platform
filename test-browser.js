import puppeteer from 'puppeteer';
import path from 'path';

// Artifact directory for saving screenshots
const ARTIFACT_DIR = '/Users/curtispenick/.gemini/antigravity/brain/58f08bf8-26de-41e8-9672-e57951be959b';

async function runTest() {
  console.log('🚀 Starting automated browser integration tests against Local Port 8000...');
  
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
    // 1. Navigate to dev server
    console.log('🔗 Navigating to http://localhost:5173...');
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('h1', { timeout: 60000 });
    console.log('✅ Page loaded successfully.');
    await new Promise(r => setTimeout(r, 2000));

    // 2. Switch to Pi 5 Console tab (Tab 3)
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

    // 3. Configure AI Brain Provider to Custom Server (Port 8000)
    console.log('⚙️ Selecting Custom Local AI Server (Port 8000)...');
    await page.select('select', 'custom'); // first select is Brain Provider
    await new Promise(r => setTimeout(r, 1000));

    // Select Vision Tandem Mode
    console.log('📸 Selecting vision /pipeline/tandem mode...');
    const buttons = await page.$$('button');
    let tandemBtn = null;
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('/pipeline/tandem')) {
        tandemBtn = btn;
        break;
      }
    }
    if (tandemBtn) {
      await tandemBtn.click();
      console.log('✅ Activated Vision /pipeline/tandem Mode.');
      await new Promise(r => setTimeout(r, 1000));
    }

    // 4. Switch to Arduino IDE tab
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

    // 5. Compile & Upload the sketch
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
      console.log('✅ Uploaded Universal sketch.');
      await new Promise(r => setTimeout(r, 1500));
    }

    // 6. Run Simulation
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

    // Wait 15 seconds for movement to occur (custom server responses will query every 1.5s, local LLM takes 3-6s)
    console.log('⏱️ Waiting for robot movement and server command routing...');
    await new Promise(r => setTimeout(r, 15000));

    // Capture screenshot of running state
    const runPath = path.join(ARTIFACT_DIR, 'test_running.png');
    await page.screenshot({ path: runPath });
    console.log(`📸 Saved running state screenshot to: ${runPath}`);

    // Verify if robot position coordinates changed from 0.00
    const positionText = await page.evaluate(() => {
      const divs = Array.from(document.querySelectorAll('div'));
      for (const d of divs) {
        if (d.textContent.includes('ROBOT POS:')) return d.textContent;
      }
      return null;
    });

    console.log(`📊 Final Position Overlay: ${positionText}`);

    if (positionText && (!positionText.includes('X: 0.00m') || !positionText.includes('Z: 0.00m') || !positionText.includes('Dir: 0°'))) {
      console.log('🎉 SUCCESS: The robot successfully received motor inputs from the port 8000 server and moved/rotated!');
    } else {
      console.error('❌ FAIL: The robot is still sitting at (0, 0) with 0° rotation. Check connection routing.');
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  } finally {
    console.log('🔌 Closing browser...');
    await browser.close();
    console.log('🏁 Integration tests finished.');
  }
}

runTest();
