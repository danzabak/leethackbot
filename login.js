const { Builder, By, until } = require('selenium-webdriver');
const fs = require('fs');
const chrome = require('selenium-webdriver/chrome');

const COOKIES_LEETCODE_PATH = './cookies_leetcode.json';
const WAIT_TIME = 40000; // Время ожидания для ручного ввода (10 секунд)

async function saveCookies() {
    let driver;

    try {
        // Настройка браузера
        driver = await new Builder()
            .forBrowser('chrome')
            .setChromeOptions(new chrome.Options())
            .build();

        console.log('ℹ️ Открываю страницу логина LeetCode...');
        await driver.get('https://leetcode.com/accounts/login/');

        console.log('ℹ️ Пожалуйста, войдите вручную.');
        console.log(`⏳ Жду ${WAIT_TIME / 1000} секунд...`);
        await driver.sleep(WAIT_TIME);

        console.log('ℹ️ Проверяю авторизацию...');
        const loggedInElement = await driver.findElements(By.css('#navbar_user_avatar'));

        if (loggedInElement.length === 0) {
            console.log('❌ Не удалось войти. Проверьте логин и пароль.');
        } else {
            console.log('✅ Успешно вошли. Сохраняю cookies...');
            const cookies = await driver.manage().getCookies();
            fs.writeFileSync(COOKIES_LEETCODE_PATH, JSON.stringify(cookies, null, 2));
            console.log(`🍪 Cookies сохранены в файл: ${COOKIES_LEETCODE_PATH}`);
        }
    } catch (error) {
        console.error('🔴 Произошла ошибка:', error);
    } finally {
        if (driver) await driver.quit();
    }
}

saveCookies();
