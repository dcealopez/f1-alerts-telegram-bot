/**
 * Main process.
 *
 * F1 Alerts Bot entry point.
 *
 * @author dcealopez
 * @since 1.0.0
 */

// Load env variables config from .env
require('dotenv').config();

const log4js = require('log4js');
const cron = require('cron');
const f1bot = require('./bot/f1-alerts-bot');

// Logger for this file
const logger = log4js.getLogger();

// Main bot loop cron job
let botLoopCronJob = null;

/**
 * Main function.
 *
 * Bot entry point.
 *
 * @since 1.0.0
 */
(async () => {
     logger.info(`Starting F1 Alerts Bot for Telegram`);

     // Load all the message templates for the bot
     logger.info('Loading templates');
     require('./bot/templates').load();

     try {
          logger.info(`Initializing F1 Alerts Bot for Telegram`);
          await f1bot.init();
     } catch (err) {
          logger.fatal(err);
          process.exit(-1);
     }

     if (!process.env.TELEGRAM_CHANNEL_ID) {
          logger.fatal(`'TELEGRAM_CHANNEL_ID' env var is not defined`);
          process.exit(-1);
     }

     if (process.env.DEV_MODE) {
          logger.warn('Development mode is enabled');
     }

     if (!process.env.BOT_LOOP_CRON_TIME) {
          logger.fatal(`'BOT_LOOP_CRON_TIME' env var is not defined`);
          process.exit(-1);
     }

     if (!process.env.ALERT_TIME_AHEAD) {
          logger.fatal(`'ALERT_TIME_AHEAD' env var is not defined`);
          process.exit(-1);
     }

     logger.info(`Bot started for channel: ${process.env.TELEGRAM_CHANNEL_ID}`);

     // Create and run the main bot loop cron job
     botLoopCronJob = new cron.CronJob(process.env.BOT_LOOP_CRON_TIME, f1bot.lookForUpdates);
     botLoopCronJob.start();
})();