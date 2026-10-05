import {
  firefox,
  type Page,
  type Locator,
} from 'playwright';

import fs from 'node:fs/promises';
import path from 'node:path';


/* =======================================================
   CONFIGURATION
======================================================= */

const PROFILE_URL =
  'https://www.naukri.com/mnjuser/profile';

const RESUME_PATH = path.resolve(
  process.env.RESUME_PATH ??
    'resume/SaqibAhmad_ResumeLatest.pdf'
);

const AUTH_STATE_PATH = path.resolve(
  process.env.AUTH_STATE_PATH ??
    'playwright/.auth/state.json'
);

const ARTIFACT_DIR = path.resolve(
  process.env.ARTIFACT_DIR ??
    'artifacts'
);

const headless =
  process.env.HEADLESS !== 'false';


/* =======================================================
   LOGGING
======================================================= */

function log(message: string): void {
  console.log(
    `[naukri] ${new Date().toISOString()} ${message}`
  );
}


/* =======================================================
   FILE VALIDATION
======================================================= */

async function ensureFile(
  filePath: string,
  description: string
): Promise<void> {
  try {
    const stat = await fs.stat(filePath);

    if (!stat.isFile()) {
      throw new Error(
        `${description} is not a file: ${filePath}`
      );
    }
  } catch {
    throw new Error(
      `${description} not found: ${filePath}`
    );
  }
}


/* =======================================================
   DEBUG ARTIFACTS
======================================================= */

async function captureDebugArtifacts(
  page: Page
): Promise<void> {
  await fs.mkdir(ARTIFACT_DIR, {
    recursive: true,
  });

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-');

  const screenshotPath = path.join(
    ARTIFACT_DIR,
    `failure-${timestamp}.png`
  );

  const htmlPath = path.join(
    ARTIFACT_DIR,
    `failure-${timestamp}.html`
  );

  const textPath = path.join(
    ARTIFACT_DIR,
    `failure-${timestamp}.txt`
  );

  const infoPath = path.join(
    ARTIFACT_DIR,
    `failure-${timestamp}-info.txt`
  );


  /* Screenshot */

  await page
    .screenshot({
      path: screenshotPath,
      fullPage: true,
    })
    .catch(() => undefined);


  /* HTML */

  const html = await page
    .content()
    .catch(() => '');

  await fs
    .writeFile(htmlPath, html)
    .catch(() => undefined);


  /* Visible page text */

  const bodyText = await page
    .locator('body')
    .innerText()
    .catch(() => '');

  await fs
    .writeFile(textPath, bodyText)
    .catch(() => undefined);


  /* Page information */

  const userAgent = await page
    .evaluate(
      () => navigator.userAgent
    )
    .catch(() => 'unknown');

  await fs
    .writeFile(
      infoPath,
      [
        `timestamp=${new Date().toISOString()}`,
        `url=${page.url()}`,
        `title=${await page.title().catch(() => 'unknown')}`,
        `headless=${headless}`,
        `userAgent=${userAgent}`,
      ].join('\n')
    )
    .catch(() => undefined);


  log(
    `Debug artifacts saved to ${ARTIFACT_DIR}`
  );
}


/* =======================================================
   CAPTCHA / LOGIN DETECTION
======================================================= */

async function detectBlockingState(
  page: Page
): Promise<void> {

  const url =
    page.url().toLowerCase();

  const body = (
    await page
      .locator('body')
      .innerText()
      .catch(() => '')
  ).toLowerCase();


  /* CAPTCHA / access block */

  if (
    url.includes('captcha') ||
    /captcha|verify you are human|access denied/.test(
      body
    )
  ) {
    throw new Error(
      'Naukri presented a CAPTCHA or access-block page. No bypass was attempted.'
    );
  }


  /* Login */

  if (
    url.includes('login') ||
    /sign in|log in|login/.test(
      body.slice(0, 3000)
    )
  ) {
    throw new Error(
      'Authenticated Naukri session is not available or has expired.'
    );
  }
}


/* =======================================================
   PAGE DIAGNOSTICS
======================================================= */

async function printPageDiagnostics(
  page: Page
): Promise<void> {

  log(
    '========== PAGE DIAGNOSTICS =========='
  );

  log(
    `URL: ${page.url()}`
  );

  log(
    `Title: ${
      await page
        .title()
        .catch(() => 'unknown')
    }`
  );


  const bodyText =
    await page
      .locator('body')
      .innerText()
      .catch(() => '');


  log(
    `Body text length: ${bodyText.length}`
  );


  if (bodyText.length > 0) {
    log(
      `Body text:\n${bodyText.slice(0, 5000)}`
    );
  }


  const inputCount =
    await page
      .locator('input')
      .count()
      .catch(() => 0);


  const fileInputCount =
    await page
      .locator(
        'input[type="file"]'
      )
      .count()
      .catch(() => 0);


  const lazyAttachCount =
    await page
      .locator('#lazyAttachCV')
      .count()
      .catch(() => 0);


  const attachClassCount =
    await page
      .locator('.attachCV')
      .count()
      .catch(() => 0);


  const attachIdCount =
    await page
      .locator('#attachCV')
      .count()
      .catch(() => 0);


  log(
    `Total input elements: ${inputCount}`
  );

  log(
    `File input elements: ${fileInputCount}`
  );

  log(
    `#lazyAttachCV count: ${lazyAttachCount}`
  );

  log(
    `.attachCV count: ${attachClassCount}`
  );

  log(
    `#attachCV count: ${attachIdCount}`
  );


  log(
    '======================================'
  );
}


/* =======================================================
   FIND RESUME INPUT
======================================================= */

async function findResumeInput(
  page: Page
): Promise<Locator> {

  log(
    'Searching for resume file input...'
  );


  const selectors = [
    'input#attachCV[type="file"]',
    '#attachCV',
    'input[type="file"]',
    'input[name="resume"]',
    'input[name="attachCV"]',
  ];


  for (const selector of selectors) {

    const locator =
      page.locator(selector).first();

    const count =
      await locator.count();


    log(
      `Checking "${selector}" -> ${count}`
    );


    if (count > 0) {

      log(
        `FOUND resume input using "${selector}".`
      );

      return locator;
    }
  }


  throw new Error(
    'Could not find the Naukri resume file input.'
  );
}


/* =======================================================
   FIND UPDATE RESUME BUTTON
======================================================= */

async function findUpdateButton(
  page: Page
): Promise<Locator> {

  const selector =
    'input.dummyUpload[value="Update resume"]';

  const button =
    page.locator(selector).last();

  const count =
    await button.count();


  log(
    `Update resume button count: ${count}`
  );


  if (count === 0) {
    throw new Error(
      'Could not find Naukri "Update resume" button.'
    );
  }


  return button;
}


/* =======================================================
   CLICK UPDATE RESUME
======================================================= */

async function clickUpdateResume(
  page: Page
): Promise<void> {

  const button =
    await findUpdateButton(page);


  const visible =
    await button
      .isVisible()
      .catch(() => false);


  const enabled =
    await button
      .isEnabled()
      .catch(() => false);


  log(
    `Update resume button visible: ${visible}`
  );

  log(
    `Update resume button enabled: ${enabled}`
  );


  if (!visible) {
    throw new Error(
      'Update resume button exists but is not visible.'
    );
  }


  if (!enabled) {
    throw new Error(
      'Update resume button exists but is disabled.'
    );
  }


  /*
   * Give Naukri a short moment to finish
   * any UI transition after selecting the file.
   */

  await page.waitForTimeout(1_000);


  /* ---------------------------------------------------
     ATTEMPT 1: NORMAL CLICK
  --------------------------------------------------- */

  log(
    'Attempting normal click on Update resume...'
  );


  try {

    await button.click({
      timeout: 5_000,
    });


    log(
      'Normal click succeeded.'
    );

    return;

  } catch (error) {

    log(
      `Normal click failed: ${String(error)}`
    );
  }


  /* ---------------------------------------------------
     ATTEMPT 2: FORCE CLICK
  --------------------------------------------------- */

  log(
    'Attempting force click on Update resume...'
  );


  try {

    await button.click({
      force: true,
      timeout: 10_000,
    });


    log(
      'Force click succeeded.'
    );

    return;

  } catch (error) {

    log(
      `Force click failed: ${String(error)}`
    );
  }


  /* ---------------------------------------------------
     ATTEMPT 3: DOM CLICK
  --------------------------------------------------- */

  log(
    'Attempting DOM click fallback...'
  );


  try {

    await button.evaluate(
      (element) => {
        (
          element as HTMLInputElement
        ).click();
      }
    );


    log(
      'DOM click executed successfully.'
    );

    return;

  } catch (error) {

    throw new Error(
      `All Update resume click attempts failed: ${String(error)}`
    );
  }
}


/* =======================================================
   VERIFY RESUME UPDATE
======================================================= */

async function verifyResumeUpdate(
  page: Page
): Promise<boolean> {

  log(
    'Waiting for Naukri to process the resume update...'
  );

  await page.waitForTimeout(3_000);


  /*
   * Check Naukri's success message container.
   */

  const successMessage =
    page.locator(
      '.success-message-container'
    ).first();


  const successCount =
    await successMessage.count();


  log(
    `Success message container count: ${successCount}`
  );


  if (successCount > 0) {

    const visible =
      await successMessage
        .isVisible()
        .catch(() => false);


    log(
      `Success message visible: ${visible}`
    );


    if (visible) {

      const messageText =
        await successMessage
          .innerText()
          .catch(() => '');


      log(
        `Naukri success message: ${messageText}`
      );


      return true;
    }
  }


  /*
   * Check for common success-related elements.
   */

  const successSelectors = [
    '.success-message-container',
    '[class*="success-message"]',
    '[class*="successMessage"]',
  ];


  for (
    const selector of successSelectors
  ) {

    const locator =
      page.locator(selector).first();


    if (
      await locator.count()
    ) {

      const visible =
        await locator
          .isVisible()
          .catch(() => false);


      if (visible) {

        const text =
          await locator
            .innerText()
            .catch(() => '');


        log(
          `Success element found: ${selector}`
        );

        log(
          `Success text: ${text}`
        );


        return true;
      }
    }
  }


  /*
   * Final page text check.
   */

  const bodyText =
    await page
      .locator('body')
      .innerText()
      .catch(() => '');


  const lowerBody =
    bodyText.toLowerCase();


  const successTexts = [
    'resume uploaded successfully',
    'resume updated successfully',
    'resume has been updated',
    'resume uploaded',
    'resume updated',
  ];


  for (
    const text of successTexts
  ) {

    if (
      lowerBody.includes(
        text.toLowerCase()
      )
    ) {

      log(
        `Success text found: "${text}"`
      );

      return true;
    }
  }


  /*
   * The filename being visible is NOT treated
   * as confirmation because your resume was
   * already manually updated earlier today.
   */

  if (
    bodyText.includes(
      'SaqibAhmad_ResumeLatest.pdf'
    )
  ) {

    log(
      'Resume filename is visible.'
    );

    log(
      'Filename alone is not treated as upload confirmation.'
    );
  }


  return false;
}


/* =======================================================
   WRITE RESULT FILE
======================================================= */

async function writeResultFile(
  page: Page,
  resumeStat: {
    size: number;
  },
  uploadConfirmed: boolean
): Promise<void> {

  const bodyText =
    await page
      .locator('body')
      .innerText()
      .catch(() => '');


  const interestingLines =
    bodyText
      .split('\n')
      .map(
        (line) => line.trim()
      )
      .filter(
        (line) =>
          /resume|updated|uploaded|success/i.test(
            line
          )
      )
      .slice(0, 30);


  await fs.writeFile(
    path.join(
      ARTIFACT_DIR,
      'result.txt'
    ),
    [
      `timestamp=${new Date().toISOString()}`,
      `url=${page.url()}`,
      `resume=${RESUME_PATH}`,
      `resume_bytes=${resumeStat.size}`,
      `headless=${headless}`,
      `upload_confirmed=${uploadConfirmed}`,
      '',
      'resume_related_text=',
      ...interestingLines,
    ].join('\n')
  );
}


/* =======================================================
   MAIN
======================================================= */

async function main(): Promise<void> {

  await fs.mkdir(
    ARTIFACT_DIR,
    {
      recursive: true,
    }
  );


  /* ---------------------------------------------------
     Validate files
  --------------------------------------------------- */

  await ensureFile(
    RESUME_PATH,
    'Resume'
  );


  await ensureFile(
    AUTH_STATE_PATH,
    'Playwright authentication state'
  );


  const resumeStat =
    await fs.stat(
      RESUME_PATH
    );


  if (
    resumeStat.size >
    300 * 1024
  ) {

    throw new Error(
      `Resume is ${resumeStat.size} bytes. Naukri's current upload page shows a 300 KB maximum.`
    );
  }


  log(
    `Using resume: ${RESUME_PATH}`
  );

  log(
    `Resume size: ${resumeStat.size} bytes`
  );

  log(
    `Auth state: ${AUTH_STATE_PATH}`
  );

  log(
    `Headless: ${headless}`
  );

  log(
    `Opening ${PROFILE_URL}`
  );


  /* ---------------------------------------------------
     Launch browser
  --------------------------------------------------- */

  const browser =
    await firefox.launch({
      headless,

      args: [
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });


  const context =
    await browser.newContext({
      storageState:
        AUTH_STATE_PATH,

      viewport: {
        width: 1440,
        height: 1000,
      },

      locale: 'en-IN',

      timezoneId:
        'Asia/Kolkata',
    });


  const page =
    await context.newPage();


  try {

    /* -------------------------------------------------
       Browser console errors
    ------------------------------------------------- */

    page.on(
      'console',
      (message) => {

        if (
          message.type() ===
          'error'
        ) {

          log(
            `Browser console error: ${message.text()}`
          );
        }
      }
    );


    /* -------------------------------------------------
       Network failures
    ------------------------------------------------- */

    page.on(
      'requestfailed',
      (request) => {

        /*
         * Ignore Naukri's telemetry failures.
         * They don't normally affect the resume
         * upload operation.
         */

        if (
          request.url().includes(
            'logs.naukri.com'
          )
        ) {
          return;
        }


        log(
          `Request failed: ${request.method()} ${request.url()}`
        );


        if (
          request.failure()
        ) {

          log(
            `Request failure reason: ${
              request.failure()
                ?.errorText
            }`
          );
        }
      }
    );


    /* -------------------------------------------------
       Navigate
    ------------------------------------------------- */

    try {

      await page.goto(
        PROFILE_URL,
        {
          waitUntil:
            'domcontentloaded',

          timeout: 60_000,
        }
      );

    } catch (error) {

      log(
        `Navigation failed: ${String(error)}`
      );

      await captureDebugArtifacts(
        page
      );

      throw error;
    }


    log(
      `Initial navigation completed: ${page.url()}`
    );


    /*
     * Wait for Naukri's JavaScript UI
     * to finish rendering.
     */

    await page.waitForTimeout(
      5_000
    );


    await page
      .waitForLoadState(
        'networkidle',
        {
          timeout: 15_000,
        }
      )
      .catch(() => undefined);


    /* -------------------------------------------------
       Check login / CAPTCHA
    ------------------------------------------------- */

    await detectBlockingState(
      page
    );


    /* -------------------------------------------------
       Diagnostics
    ------------------------------------------------- */

    await printPageDiagnostics(
      page
    );


    log(
      `Loaded ${page.url()}`
    );


    /* -------------------------------------------------
       Find resume input
    ------------------------------------------------- */

    const fileInput =
      await findResumeInput(
        page
      );


    log(
      'Resume file input found.'
    );


    /* -------------------------------------------------
       Select resume
    ------------------------------------------------- */

    await fileInput.setInputFiles(
      RESUME_PATH
    );


    log(
      'Resume file selected.'
    );


    /*
     * Wait briefly for Naukri's UI
     * to react to the selected file.
     */

    await page.waitForTimeout(
      1_000
    );


    /* -------------------------------------------------
       Click Update resume
    ------------------------------------------------- */

    await clickUpdateResume(
      page
    );


    /* -------------------------------------------------
       Verify result
    ------------------------------------------------- */

    const uploadConfirmed =
      await verifyResumeUpdate(
        page
      );


    /* -------------------------------------------------
       Final screenshot
    ------------------------------------------------- */

    const screenshotPath =
      path.join(
        ARTIFACT_DIR,
        'success.png'
      );


    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
    });


    /* -------------------------------------------------
       Result file
    ------------------------------------------------- */

    await writeResultFile(
      page,
      resumeStat,
      uploadConfirmed
    );


    /* -------------------------------------------------
       Final result
    ------------------------------------------------- */

    log(
      '========================================'
    );


    if (uploadConfirmed) {

      log(
        'SUCCESS: Naukri reported that the resume was updated.'
      );

    } else {

      log(
        'WARNING: The Update button was clicked, but an explicit success message was not detected.'
      );

      log(
        'Check artifacts/success.png and artifacts/result.txt.'
      );
    }


    log(
      'Resume upload flow completed.'
    );


    log(
      '========================================'
    );

  } catch (error) {

    log(
      `Automation failed: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`
    );


    await captureDebugArtifacts(
      page
    );


    await fs.writeFile(
      path.join(
        ARTIFACT_DIR,
        'error.txt'
      ),
      [
        new Date().toISOString(),

        error instanceof Error
          ? error.stack ??
            error.message
          : String(error),

        `url=${page.url()}`,
      ].join('\n')
    );


    throw error;

  } finally {

    await context.close();

    await browser.close();
  }
}


/* =======================================================
   START
======================================================= */

main().catch(
  (error) => {

    console.error(
      error instanceof Error
        ? error.stack ??
          error.message
        : error
    );

    process.exit(1);
  }
);