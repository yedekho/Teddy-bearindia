import { Telegraf } from 'telegraf';
import puppeteer from 'puppeteer';
import { createWorker } from 'tesseract.js';
import cron from 'node-cron';
import moment from 'moment-timezone';

const BOT_TOKEN = '7915666109:AAF8KqwmSHjS-8Zk-EvhFMFEkzzXs5Y60gc';
const bot = new Telegraf(BOT_TOKEN);

// Initialize Tesseract worker
const worker = await createWorker('eng');

async function isWorkingDay() {
  const today = moment().tz('Asia/Kolkata');
  
  // Check if it's Sunday
  if (today.day() === 0) return false;
  
  // TODO: Add logic for public holidays
  // For now, we'll just check for Sunday
  
  return true;
}

async function recognizeText(imageBuffer) {
  const { data: { text } } = await worker.recognize(imageBuffer);
  return text.trim();
}

async function performLogin() {
  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Navigate to the login page
    await page.goto('https://sharekonnect.sharekhan.com/');
    
    // Fill in the login details
    await page.type('input[name="code"]', 'SHAREKHAN');
    await page.type('input[name="userId"]', '39466');
    await page.type('input[name="password"]', 'Achiadi@123');
    
    // Get the captcha image
    const captchaImg = await page.$('img[alt="captcha"]');
    const imageBuffer = await captchaImg.screenshot();
    
    // Recognize the captcha text
    const captchaText = await recognizeText(imageBuffer);
    
    // Enter the captcha
    await page.type('input[name="captcha"]', captchaText);
    
    // Click the login button
    await page.click('button[type="submit"]');
    
    // Wait for navigation
    await page.waitForNavigation();
    
    // Click the "Work from Home" button
    await page.click('button:contains("Work from Home")');
    
    await browser.close();
    
    return true;
  } catch (error) {
    console.error('Login error:', error);
    return false;
  }
}

// Schedule the task for 9:30 AM IST every day
cron.schedule('30 9 * * *', async () => {
  if (await isWorkingDay()) {
    const success = await performLogin();
    if (success) {
      bot.telegram.sendMessage(process.env.ADMIN_CHAT_ID, 'Login successful for today!');
    } else {
      bot.telegram.sendMessage(process.env.ADMIN_CHAT_ID, 'Login failed. Please check the logs.');
    }
  }
}, {
  timezone: 'Asia/Kolkata'
});

// Start command
bot.command('start', (ctx) => {
  ctx.reply('Bot is running! It will automatically perform login at 9:30 AM IST on working days.');
});

// Manual trigger command
bot.command('login', async (ctx) => {
  ctx.reply('Attempting manual login...');
  const success = await performLogin();
  ctx.reply(success ? 'Manual login successful!' : 'Manual login failed. Please check the logs.');
});

bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));