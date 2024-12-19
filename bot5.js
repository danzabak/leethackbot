const { Builder, By, until, Capabilities, Key } = require('selenium-webdriver');
const fs = require('fs');
const chrome = require('selenium-webdriver/chrome');

const CONFIG_PATH = './config.json';
const COOKIES_LEETCODE_PATH = './cookies_leetcode.json';
const SHORT_WAIT = 1000;
const LONG_WAIT = 4000;

async function setupBrowser() {
    const options = new chrome.Options();
    options.addArguments('--disable-infobars', '--disable-notifications', '--start-maximized');

    const capabilities = Capabilities.chrome();
    capabilities.set('pageLoadStrategy', 'eager'); // Ускоряем загрузку страниц

    return new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .withCapabilities(capabilities)
        .build();
}

async function loadCookies(driver) {
    try {
        if (fs.existsSync(COOKIES_LEETCODE_PATH)) {
            const cookies = JSON.parse(fs.readFileSync(COOKIES_LEETCODE_PATH, 'utf-8'));
            for (const cookie of cookies) {
                await driver.manage().addCookie(cookie);
            }
            console.log('🍪 Cookies loaded');
        }
    } catch (error) {
        console.error('🔴 Error loading cookies:', error);
    }
}

async function performLogin(driver) {
    try {
        await driver.get('https://leetcode.com/problemset/');
        await loadCookies(driver);
        await driver.navigate().refresh();
        await driver.sleep(SHORT_WAIT);

        const loggedInElement = await driver.findElements(By.css('#navbar_user_avatar'));
        if (loggedInElement.length === 0) {
            console.log('ℹ️ Not logged in. Redirecting to login page...');
            await driver.get('https://leetcode.com/accounts/login/');
            console.log('ℹ️ Log in manually and press Enter:');
            await new Promise(resolve => process.stdin.once('data', resolve));

            const cookies = await driver.manage().getCookies();
            fs.writeFileSync(COOKIES_LEETCODE_PATH, JSON.stringify(cookies));
            console.log('🍪 Cookies saved. Refreshing page...');
            await driver.navigate().refresh();
        } else {
            console.log('ℹ️ Logged in successfully.');
        }
    } catch (error) {
        console.error('🔴 Login error:', error);
    }
}

async function navigateToFirstTask(driver) {
    try {
        await driver.get('https://leetcode.com/problemset/?status=NOT_STARTED&page=1');
        await driver.sleep(SHORT_WAIT);

        const pickOneButton = await driver.findElement(
            By.xpath('//*[@id="__next"]/div[1]/div[4]/div[2]/div[1]/div[4]/div[1]/div[1]/div[5]/div[3]/span[2]')
        );
        await pickOneButton.click();
        console.log('✅ Navigated to the first task.');
        await driver.sleep(SHORT_WAIT);
    } catch (error) {
        console.error('🔴 Error navigating to the first task. Retrying...');
    }
}

async function extractAndPasteSolution(driver, useSecondSolution = false) {
    try {
        const clipboardy = (await import('clipboardy')).default;

        console.log('ℹ️ Looking for "Solutions" element...');
        const solutionsButton = await driver.wait(
            until.elementLocated(By.xpath("//div[contains(@class, 'normal') and text()='Solutions']")),
            LONG_WAIT
        );
        await solutionsButton.click();
        console.log('✅ Clicked on "Solutions".');

        console.log('ℹ️ Waiting for language options to load...');
        await driver.sleep(SHORT_WAIT); // Небольшая задержка перед проверкой

        console.log('ℹ️ Looking for "C++" language option...');
        const cppButton = await driver.wait(
            until.elementLocated(
                By.xpath("//span[contains(@class, 'cursor-pointer') and contains(text(), 'C++')]")
            ),
            LONG_WAIT
        );
        await driver.wait(until.elementIsVisible(cppButton), LONG_WAIT); // Ожидание видимости
        await cppButton.click();
        console.log('✅ Selected "C++".');

        console.log(`ℹ️ Looking for the ${useSecondSolution ? "second" : "first"} solution...`);
        const solutionIndex = useSecondSolution ? 2 : 1;
        const solutionXpath = `(//div[contains(@class, 'group flex w-full cursor-pointer flex-col gap-1.5 px-4 pt-3')])[${solutionIndex}]`;
        const solutionButton = await driver.wait(
            until.elementLocated(By.xpath(solutionXpath)),
            LONG_WAIT
        );
        await driver.wait(until.elementIsVisible(solutionButton), LONG_WAIT); // Ожидание видимости
        await solutionButton.click();
        console.log('✅ Opened the solution.');

        console.log('ℹ️ Extracting solution code...');
        const codeElement = await driver.wait(
            until.elementLocated(By.css('.group.relative pre')),
            LONG_WAIT
        );
        const solutionCode = await codeElement.getText();
        console.log('📋 Solution code extracted.');

        console.log('ℹ️ Copying solution to clipboard...');
        await clipboardy.write(solutionCode);

        console.log('ℹ️ Clearing the editor...');
        const editorElement = await driver.wait(
            until.elementLocated(By.css('div.view-lines.monaco-mouse-cursor-text')),
            LONG_WAIT
        );
        await editorElement.click();
        await driver.actions().keyDown(Key.CONTROL).sendKeys('a').keyUp(Key.CONTROL).perform();
        await driver.actions().sendKeys(Key.DELETE).perform();
        console.log('✅ Editor cleared.');

        console.log('ℹ️ Pasting solution into the editor...');
        await driver.actions().keyDown(Key.CONTROL).sendKeys('v').keyUp(Key.CONTROL).perform();
        console.log('✅ Solution pasted.');

        console.log('ℹ️ Submitting the solution...');
        const submitButton = await driver.findElement(By.css('[data-e2e-locator="console-submit-button"]'));
        await submitButton.click();
        console.log('✅ Submission initiated. Waiting for result...');
        await driver.sleep(5000); // Wait for result

        const acceptedElement = await driver.findElements(By.css("span[data-e2e-locator='submission-result']"));
        const errorElement = await driver.findElements(By.xpath("//span[contains(text(), 'Runtime Error')]"));

        if (acceptedElement.length > 0) {
            console.log('🎉 Solution accepted.');
            return 'Accepted';
        } else if (errorElement.length > 0) {
            console.log('❌ Solution failed.');
            return 'Error';
        }
    } catch (error) {
        console.error('🔴 Error while extracting and pasting solution:', error);
        return 'Error';
    }
}


async function main() {
    let driver;
    try {
        driver = await setupBrowser();
        await performLogin(driver);

        while (true) {
            try {
                await navigateToFirstTask(driver);
                const result = await extractAndPasteSolution(driver);
                if (result === 'Accepted') {
                    console.log('➡️ Moving to the next task...');
                    continue;
                }
            } catch (error) {
                console.error('🔴 Error in main loop:', error);
            }
        }
    } catch (error) {
        console.error('🔴 Critical error:', error);
    } finally {
        if (driver) await driver.quit();
    }
}

main();