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
const f1api = require('../api/formula1-api');
const weatherApi = require('../api/open-weather-map-api');
const translate = require('./translate/translate');
const templates = require('./templates');

// Logger for this file
const logger = require('log4js').getLogger();

// Bot instance
let botInstance = null;

// Session alerts status object
let sessionAlertsStatus = null;

// Browser and page for results rendering
let browser = null;
let page = null;

/**
 * Request callback.
 *
 * @since 1.0.0
 * @callback callback
 * @param {string} error
 * @param {string} response body
 */

/**
 * Session weather report data fetcher
 *
 * Gets the weather report for the specified session
 *
 * @param {*} sessionInfo
 * @param {callback} callback
 */
function getSessionWeatherReport(sessionInfo, callback) {
     var weatherReport = { };

     // Attempt to get the current weather data
     // Sadly we will need to make two calls to get the info translated
     weatherApi.getWeatherDataAt(sessionInfo.race.meetingLocalityName, sessionInfo.race.meetingCountryName, 'en', 'imperial', (err, res) => {
          if (err) {
               callback(err, null)
               return;
          }

          if (!res.weather || !res.main || !res.wind) {
               callback('No weather data', null);
               return;
          }

          weatherReport.en = res;

          weatherApi.getWeatherDataAt(sessionInfo.race.meetingLocalityName, sessionInfo.race.meetingCountryName, 'es', 'metric', (err, res) => {
               if (err) {
                    callback(err, null);
                    return;
               }

               if (!res.weather || !res.main || !res.wind) {
                    callback('No weather data', null);
                    return;
               }

               weatherReport.es = res;
               callback(null, weatherReport);
          });
     });
};

/**
 * Session info displaying.
 *
 * Sends a message to the channel containing the incoming session info.
 *
 * @since 1.0.0
 * @param {*} sessionInfo
 */
function displayIncomingSessionInfoMessage(sessionInfo) {
     var displayWeatherReport = true;

     // Try to get the weather report if we can get the circuit's locality
     f1api.getCircuitInfo((err, circuitInfo) => {
          if (err || !circuitInfo.MRData.CircuitTable || !circuitInfo.MRData.CircuitTable.Circuits) {
               if (err) {
                    logger.error(`Error while getting circuit info: ${err.toString()}`);
               }

               displayWeatherReport = false;
          }

          // Look for the locality
          if (displayWeatherReport) {
               for (var i = 0; circuitInfo.MRData.CircuitTable.Circuits.length; i++) {
                    if (circuitInfo.MRData.CircuitTable.Circuits[i].Location.country === sessionInfo.race.meetingCountryName) {
                         sessionInfo.race.meetingLocalityName = circuitInfo.MRData.CircuitTable.Circuits[i].Location.locality;
                         break;
                    }
               }
          }

          // Display extended info if we can get the weather report data for the session
          getSessionWeatherReport(sessionInfo, async (err, weatherReport) => {
               if (err || !displayWeatherReport) {
                    logger.error(`Couldn't get weather data for session (${sessionInfo.race.meetingOfficialName} - ${sessionInfo.description})`);

                    if (err) {
                         logger.error(err.toString());
                    }

                    try {
                         await botInstance.sendMessage(process.env.TELEGRAM_CHANNEL_ID, templates.render('sessionInfo', sessionInfo), {
                              parse_mode: 'HTML'
                         });
                    } catch (err) {
                         logger.error(`Error while sending message: ${err.toString()}`);
                    }

                    return;
               }

               sessionInfo.WeatherReport = weatherReport;

               try {
                    await botInstance.sendMessage(process.env.TELEGRAM_CHANNEL_ID, templates.render('sessionInfoPlusWeather', sessionInfo), {
                         parse_mode: 'HTML'
                    });
               } catch (err) {
                    logger.error(`Error while sending message: ${err.toString()}`);
               }
          });
     });
};

/**
 * Session results displaying.
 *
 * Sends an image to the channel containing the results of the session.
 *
 * @since 1.0.0
 * @param {*} sessionResults
 */
async function displaySessionResultsMessage(sessionResults) {
     // Send results alert message
     try {
          await botInstance.sendMessage(process.env.TELEGRAM_CHANNEL_ID, templates.render('sessionResults', sessionResults), {
               parse_mode: 'HTML'
          });
     } catch (err) {
          logger.error(`Error while sending message: ${err.toString()}`);
     }

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

          try {
               await botInstance.sendPhoto(process.env.TELEGRAM_CHANNEL_ID, standingsPhoto);
          } catch (err) {
               logger.error(`Error while sending photo: ${err.toString()}`);
          }
     })();
};

module.exports = {
     /**
      * Bot initialization.
      *
      * Initializes the bot.
      *
      * @since 1.0.0
      */
     init: async() => {
          if (!process.env.BOT_TOKEN) {
               throw new Error(`'BOT_TOKEN' env var is not defined`);
          }

          botInstance = new TelegramBot(process.env.BOT_TOKEN);

          // Pre-initialize the browser and page for results rendering
          browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
          page = await browser.newPage();
     },
     /**
      * Session info listener.
      *
      * Looks for session status changes and sends info messages to the channel.
      *
      * @since 1.0.0
      */
     lookForUpdates: () => {
          if (process.env.DEV_MODE) {
               logger.debug(`Looking for updates`);
          }

          // Query event info for incoming session messages
          f1api.getEventInfo((err, eventInfo) => {
               if (err) {
                    logger.error(`Error while getting event info: ${err.toString()}`);
                    return;
               }

               var timetables = eventInfo.seasonContext.timetables;

               // Initialize session alerts status object
               if (sessionAlertsStatus === null) {
                    sessionAlertsStatus = [];

                    for (var i = 0; i < timetables.length; i++){
                         sessionAlertsStatus.push({
                              description: timetables[i].description,
                              alertSent: false,
                              resultsShown: false
                         });
                    }
               }

               // Loop through the timetables and show alerts for the incoming sessions
               for (var i = 0; i < timetables.length; i++) {
                    if (timetables[i].state === 'completed') {
                         sessionAlertsStatus[i].alertSent = false;
                         continue;
                    }

                    // Reset results shown status
                    sessionAlertsStatus[i].resultsShown = false

                    if (sessionAlertsStatus[i].alertSent) {
                         continue;
                    }

                    var currentDate = new Date();
                    var startTime = new Date(`${timetables[i].startTime}${timetables[i].gmtOffset}`);
                    var msDifference = startTime.getTime() - currentDate.getTime();

                    if (msDifference <= process.env.ALERT_TIME_AHEAD && msDifference > 0) {
                         var sessionInfo = timetables[i];
                         sessionInfo.race = eventInfo.race;
                         sessionInfo.msToGo = msDifference;

                         logger.info(`Sending incoming session info alert (${sessionInfo.race.meetingOfficialName} - ${timetables[i].description})`);
                         displayIncomingSessionInfoMessage(sessionInfo);
                         sessionAlertsStatus[i].alertSent = true;
                    }
               }
          });

          f1api.getCurrentSessionInfo((err, sessionInfo) => {
               if (err) {
                    logger.error(`Error while getting session info: ${err.toString()}`);
                    return;
               }

               // Show results if the session is completed
               if (sessionInfo.ArchiveStatus.Status === 'Complete' && sessionAlertsStatus !== null) {
                    for (var i = 0; i < sessionAlertsStatus.length; i++) {
                         if (sessionInfo.Name === sessionAlertsStatus[i].description && !sessionAlertsStatus[i].resultsShown) {
                              f1api.getSessionResults(sessionInfo, async (err, sessionResults) => {
                                   if (err) {
                                        logger.error(`Error while getting session results: ${err.toString()}`);
                                        return;
                                   }

                                   logger.info(`Sending completed session results (${sessionResults.free.data.R} - ${sessionInfo.Name})`);
                                   await displaySessionResultsMessage(sessionResults);
                                   sessionAlertsStatus[i].resultsShown = true;
                              });

                              break;
                         }
                    }
               }
          });
     }
};