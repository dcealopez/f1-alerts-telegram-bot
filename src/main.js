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
const f1bot = require('./bot/f1-alerts-bot');

// Logger for this file
const logger = log4js.getLogger();

/**
 * Main function.
 *
 * Bot entry point.
 *
 * @since 1.0.0
 */
(() => {
     logger.info(`Starting F1 Alerts Bot ${process.env.npm_package_version}`);

     // Load all the message templates for the bot
     logger.info('Loading templates');
     require('./bot/templates').load();

     try {
          f1bot.init();
     } catch (err) {
          logger.fatal(err);
          process.exit(-1);
     }

     if (!process.env.TELEGRAM_CHANNEL_ID) {
          logger.fatal(`'TELEGRAM_CHANNEL_ID' env var is not defined`);
          process.exit(-1);
     }

     console.log(process.env.DEV_MODE);

     if (process.env.DEV_MODE) {
          logger.warn('Development mode is enabled');
     }

     if (!process.env.REFRESH_INTERVAL) {
          logger.fatal(`'REFRESH_INTERVAL' env var is not defined`);
          process.exit(-1);
     }

     logger.info(`Bot started for channel: ${process.env.TELEGRAM_CHANNEL_ID}`);

     // Start gathering live data
     setInterval(() => {
          f1bot.lookForUpdates();
     }, process.env.REFRESH_INTERVAL);

     logger.info(`Started listening for updates`);

     // Initial update
     f1bot.lookForUpdates();
})();