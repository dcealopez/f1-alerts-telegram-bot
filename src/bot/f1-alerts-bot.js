/**
 * F1 Alerts Bot.
 *
 * F1 Alerts Bot implementation.
 *
 * @author dcealopez
 * @since 1.0.0
 */

// Enable fix for issue #319 (https://github.com/yagop/node-telegram-bot-api/issues/319)
process.env.NTBA_FIX_319 = 1;

// Enable fix for issue #350 (https://github.com/yagop/node-telegram-bot-api/issues/350)
process.env.NTBA_FIX_350 = 1;

const TelegramBot = require('node-telegram-bot-api');
const puppeteer = require('puppeteer');
const { performance } = require('perf_hooks');
const liveTimingApi = require('../api/f1-live-timing-api');
const translate = require('./translate/translate');
const templates = require('./templates');

// Logger for this file
const logger = require('log4js').getLogger();

// Bot instance
let botInstance = null;

// Current F1 Session Info
let currentSessionInfo = null;

/**
 * Session info displaying.
 *
 * Sends a message to the channel containing the incoming session info.
 *
 * @since 1.0.0
 * @param {*} sessionInfo
 */
function displayIncomingSessionInfoMessage(sessionInfo) {
     botInstance.sendMessage(process.env.TELEGRAM_CHANNEL_ID, templates.render('sessionInfo', sessionInfo), {
          parse_mode: 'HTML'
     });
}

/**
 * Session results displaying.
 *
 * Sends an image to the channel containing the results of the session.
 *
 * @since 1.0.0
 * @param {*} sessionResults
 */
function displaySessionResultsMessage(sessionResults) {
     // Send results alert message
     botInstance.sendMessage(process.env.TELEGRAM_CHANNEL_ID, templates.render('sessionResults', sessionResults), {
          parse_mode: 'HTML'
     });

     // Build the results table
     var driverStandingsData = sessionResults.free.data.DR;

     // Header
     var driverStandingsText = `<b><u>${sessionResults.free.data.R}</u></b>\r\n\r\n`;
     driverStandingsText += `<b>${sessionResults.free.data.S.toUpperCase()}\r\n`;
     driverStandingsText += `${translate('es-ES', sessionResults.free.data.S).toUpperCase()}</b>\n\n`;

     // Display lap count if needed
     if (sessionResults.free.data.L > 0) {
          driverStandingsText += `<b>${sessionResults.free.data.L} LAPS\r\n`;
          driverStandingsText += `${sessionResults.free.data.L} VUELTAS</b>\r\n\r\n`;
     }

     // Build the standings table
     for (var i = 0; i < driverStandingsData.length; i++) {
          for (var j = 0; j < driverStandingsData.length; j++) {
               if ((i + 1).toString() === driverStandingsData[j].F[3]) {
                    var driverEntry = `${driverStandingsData[j].F[3].padStart(2)}  `;
                    driverEntry += `${driverStandingsData[j].F[0]}  `;
                    driverEntry += `${driverStandingsData[j].F[1]}  `;
                    driverEntry += `${driverStandingsData[j].F[4]}`;

                    driverStandingsText += `${driverEntry.padEnd(25)}\n`;
               }
          }
     }

     // Generate a photo of the results and send it
     (async () => {
          if (process.env.DEV_MODE) {
               logger.debug(`Generating results photo`);
          }

          // Measure the time taken to generate the photo
          if (process.env.DEV_MODE)  {
               var perfTimeStart = performance.now();
          }

          const browser = await puppeteer.launch();
          const page = await browser.newPage();

          await page.setContent(`<center><pre id="standings" style="display: inline-block;">${driverStandingsText}</pre></center>`);
          const standingsElement = await page.$("#standings");
          const standingsBoundaries = await standingsElement.boundingBox();

          var standingsPhoto = await page.screenshot({
               clip: {
                    x: standingsBoundaries.x,
                    y: standingsBoundaries.y,
                    width: Math.min(standingsBoundaries.width, page.viewport().width),
                    height: Math.min(standingsBoundaries.height, page.viewport().height),
               }
          });

          if (process.env.DEV_MODE)  {
               logger.debug(`Results photo generated in ${performance.now() - perfTimeStart}ms`);
          }

          botInstance.sendPhoto(process.env.TELEGRAM_CHANNEL_ID, standingsPhoto);
          await browser.close();
     })();
}

module.exports = {
     /**
      * Bot initialization.
      *
      * Initializes the bot.
      *
      * @since 1.0.0
      */
     init: () => {
          if (!process.env.BOT_TOKEN) {
               throw new Error(`'BOT_TOKEN' env var is not defined`);
          }

          botInstance = new TelegramBot(process.env.BOT_TOKEN);
     },
     /**
      * Session info listener.
      *
      * Looks for session status changes and sends info messages to the channel.
      *
      * @since 1.0.0
      */
     lookForUpdates: () => {
          liveTimingApi.getCurrentSessionInfo((err, sessionInfo) => {
               if (err) {
                    logger.error(err);
                    return;
               }

               // Check for session status updates
               if (currentSessionInfo === null ||
                    (currentSessionInfo.ArchiveStatus.Status !== sessionInfo.ArchiveStatus.Status) ||
                    (sessionInfo.Name !== currentSessionInfo.Name)) {
                    currentSessionInfo = sessionInfo;

                    if (sessionInfo.ArchiveStatus.Status === 'Complete') {
                         liveTimingApi.getSessionResults(sessionInfo, (err, sessionResults) => {
                              if (err) {
                                   logger.error(err);
                                   return;
                              }

                              logger.info(`Sending completed session results (${sessionInfo.Meeting.Name} - ${sessionInfo.Name})`);
                              displaySessionResultsMessage(sessionResults);
                         });
                    } else {
                         logger.info(`Sending incoming session info alert (${sessionInfo.Meeting.Name} - ${sessionInfo.Name})`);
                         displayIncomingSessionInfoMessage(sessionInfo);
                    }
               }
          });
     },
     /**
      * Bot instance getter.
      *
      * Gets the bot instance.
      *
      * @since 1.0.0
      * @returns {TelegramBot} Telegram bot instance
      */
     getInstance: () => botInstance
};