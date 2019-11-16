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
const log4js = require('log4js');
const puppeteer = require('puppeteer');
const liveTimingApi = require('../api/f1-live-timing-api');
const translate = require('./translate/translate');

// Logger for this file
const logger = log4js.getLogger();

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
     var startDate = new Date(`${sessionInfo.StartDate}${sessionInfo.GmtOffset.substring(0, 6)}`);
     var endDate = new Date(`${sessionInfo.EndDate}${sessionInfo.GmtOffset.substring(0, 6)}`);

botInstance.sendMessage(process.env.TELEGRAM_CHANNEL_ID, `\u{1F3CE} <b>${sessionInfo.Meeting.Name.toUpperCase()}</b> \u{1F3CE}

<b>\u{1F1FA}\u{1F1F8} INCOMING SESSION \u{1F1FA}\u{1F1F8}</b>
<b>\u{1F1EA}\u{1F1F8} PRÓXIMA SESIÓN \u{1F1EA}\u{1F1F8}</b>

<b>\u{1F1FA}\u{1F1F8} ${sessionInfo.Name} \u{1F1FA}\u{1F1F8}</b>
<b>\u{1F1EA}\u{1F1F8} ${translate('es-ES', sessionInfo.Name)} \u{1F1EA}\u{1F1F8}</b>

<b>\u{2139} INFO \u{2139}</b>

<b>\u{1F1FA}\u{1F1F8} English / Inglés \u{1F1FA}\u{1F1F8}:</b>
<b>Start Date:</b> ${startDate.toLocaleString('en-EN', { dateStyle: 'short', timeStyle: 'full', timeZone: 'America/Cancun' })}
<b>End Date:</b> ${endDate.toLocaleString('en-EN', { dateStyle: 'short', timeStyle: 'full', timeZone: 'America/Cancun' })}

<b>\u{1F1EA}\u{1F1F8} Español / Spanish \u{1F1EA}\u{1F1F8}:</b>
<b>Fecha de inicio:</b> ${startDate.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'full', timeZone: 'Europe/Madrid' })}
<b>Fecha de fin:</b> ${endDate.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'full', timeZone: 'Europe/Madrid' })}`, {
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
     var driverStandingsData = sessionResults.free.data.DR;

     // Standings header
     var driverStandingsText = `<b><u>${sessionResults.free.data.R}</u></b>

<b>${sessionResults.free.data.S.toUpperCase()}
${translate('es-ES', sessionResults.free.data.S).toUpperCase()}</b>\n\n`;

     // Add lap count if needed
     if (sessionResults.free.data.L > 0) {
          driverStandingsText += `<b>${sessionResults.free.data.L} LAPS
${sessionResults.free.data.L} VUELTAS</b>\n\n`;
     }

     // Display the results in finishing order
     for (var i = 0; i < driverStandingsData.length; i++) {
          for (var j = 0; j < driverStandingsData.length; j++) {
               if ((i + 1).toString() === driverStandingsData[j].F[3]) {
                    var driverEntry = `${driverStandingsData[j].F[3].padStart(2)}  ${driverStandingsData[j].F[0]}  ${driverStandingsData[j].F[1]}  ${driverStandingsData[j].F[4]}`;
                    driverStandingsText += `${driverEntry.padEnd(25)}\n`;
               }
          }
     }

     // Send results alert message
     botInstance.sendMessage(process.env.TELEGRAM_CHANNEL_ID, `\u{1F3CE} <b>${sessionResults.free.data.R}</b> \u{1F3CE}

<b>\u{1F1FA}\u{1F1F8} SESSION RESULTS \u{1F1FA}\u{1F1F8}</b>
<b>\u{1F1EA}\u{1F1F8} RESULTADOS DE LA SESIÓN \u{1F1EA}\u{1F1F8}</b>

<b>\u{1F1FA}\u{1F1F8} ${sessionResults.free.data.S} \u{1F1FA}\u{1F1F8}</b>
<b>\u{1F1EA}\u{1F1F8} ${translate('es-ES', sessionResults.free.data.S)} \u{1F1EA}\u{1F1F8}</b>

\u{2B07}\u{2B07}\u{2B07}\u{2B07}\u{2B07}\u{2B07}`, {
          parse_mode: 'HTML'
     });

     // Generate and send the results photo
     (async () => {
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

                              logger.info(`Sending session info results (${sessionInfo.Meeting.Name} - ${sessionInfo.Name})`);
                              displaySessionResultsMessage(sessionResults);
                         });
                    } else {
                         logger.info(`Sending session info alert (${sessionInfo.Meeting.Name} - ${sessionInfo.Name})`);
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