/**
 * F1 Alerts Bot.
 *
 * F1 Alerts Bot implementation.
 *
 * @author dcealopez
 * @since 1.0.0
 */

const Telegraf = require('telegraf');
const puppeteer = require('puppeteer');
const { performance } = require('perf_hooks');
const schedule = require('node-schedule');
const fs = require('fs');
const f1api = require('../api/formula1-api');
const weatherApi = require('../api/open-weather-map-api');
const translate = require('./translate');
const templates = require('./templates');
const utils = require('../utils');

// Logger for this file
const logger = require('log4js').getLogger();

// Bot instance
let botInstance = null;

// Session alerts status list
let sessionAlertsStatus = null;

// Indicates whether the circuit layout photo was already sent or not
let wasCircuitPhotoSent = false;

// Sometimes the F1 API derps and goes back and forth changing the session status for the race session,
// making the bot send duplicated session result alerts
// So we will use this to prevent that by setting this to true when the race session results are set,
// and will reset it when the grand prix name changes
let allResultsSent = false;

// Current Grand Prix name
let currentGrandPrixName = null;

// Browser and page for results rendering
let browser = null;
let page = null;

// Scheduled job instance for the drivers/constructors standings update
let driversConstructorsStandingUpdateAlertScheduledJob = null;

/**
 * Request callback.
 *
 * @since 1.0.0
 * @callback callback
 * @param {string} error
 * @param {string} response body
 */

/**
 * Session weather report data fetcher.
 *
 * Gets the weather report for the specified session.
 *
 * @param {*} sessionInfo session info object
 * @param {callback} callback request callback
 */
function getSessionWeatherReport(sessionInfo, callback) {
     // Avoid making the request if we know it will not return what we want
     if (!sessionInfo.race.meetingLocalityName) {
          callback(new Error('No locality specified'), null);
          return;
     }

     var weatherReport = { };

     // Attempt to get the current weather data
     // Sadly we will need to make two calls to get the info translated
     weatherApi.getWeatherDataAt(sessionInfo.race.meetingLocalityName, sessionInfo.race.meetingCountryName, 'en', 'imperial', (err, res) => {
          if (err) {
               callback(err, null);
               return;
          }

          if (!res.weather || !res.main || !res.wind) {
               callback(new Error('No weather data'), null);
               return;
          }

          weatherReport.en = res;

          weatherApi.getWeatherDataAt(sessionInfo.race.meetingLocalityName, sessionInfo.race.meetingCountryName, 'es', 'metric', (err, res) => {
               if (err) {
                    callback(err, null);
                    return;
               }

               if (!res.weather || !res.main || !res.wind) {
                    callback(new Error('No weather data'), null);
                    return;
               }

               weatherReport.es = res;
               callback(null, weatherReport);
          });
     });
}

/**
 * Session schedule displaying.
 *
 * Sends a message to the channel containing the next session schedule.
 *
 * @since 1.0.0
 * @param {*} sessionInfo session info object
 */
async function displaySessionScheduleMessage(sessionInfo) {
     try {
          await botInstance.telegram.sendMessage(process.env.TELEGRAM_CHANNEL_ID, templates.render('sessionSchedule', sessionInfo), {
               parse_mode: 'HTML'
          });
     } catch (err) {
          logger.error(`Error while sending message: ${err.toString()}`);
     }
}

/**
 * Session info displaying.
 *
 * Sends a message to the channel containing the incoming session info.
 *
 * @since 1.0.0
 * @param {*} sessionInfo session info object
 */
async function displayIncomingSessionInfoMessage(sessionInfo) {
     var circuitData = utils.getCircuitData(sessionInfo.race.meetingCountryName);

     // Display simple info if we can't get the weather report
     if (!circuitData || !circuitData.locality || !circuitData.country) {
          try {
               await botInstance.telegram.sendMessage(process.env.TELEGRAM_CHANNEL_ID, templates.render('sessionInfo', sessionInfo), {
                    parse_mode: 'HTML'
               });
          } catch (err) {
               logger.error(`Error while sending message: ${err.toString()}`);
          }

          return;
     }

     // Try to get the weather report to display it
     var templateToUse = 'sessionInfoPlusWeather';

     sessionInfo.race.meetingLocalityName = circuitData.locality;
     sessionInfo.race.meetingCountryName = circuitData.country;

     getSessionWeatherReport(sessionInfo, async (err, weatherReport) => {
          if (err) {
               templateToUse = 'sessionInfo';

               logger.error(`Couldn't get weather data for session (${sessionInfo.race.meetingOfficialName} - ${sessionInfo.description})`);
               logger.error(err.toString());
          }

          sessionInfo.WeatherReport = weatherReport;

          try {
               await botInstance.telegram.sendMessage(process.env.TELEGRAM_CHANNEL_ID, templates.render(templateToUse, sessionInfo), {
                    parse_mode: 'HTML'
               });
          } catch (err) {
               logger.error(`Error while sending message: ${err.toString()}`);
          }
     });
}

/**
 * Session results displaying.
 *
 * Sends an image to the channel containing the results of the session.
 *
 * @since 1.0.0
 * @param {*} sessionResults session results object
 */
async function displaySessionResultsMessage(sessionResults) {
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
     var driverEntries = [];
     var longestDriverEntryTextLength = 0;

     for (let i = 0; i < driverStandingsData.length; i++) {
          for (let j = 0; j < driverStandingsData.length; j++) {
               if ((i + 1).toString() === driverStandingsData[j].F[3]) {
                    let driverEntry = `${driverStandingsData[j].F[3].padStart(2)}  `;
                    driverEntry += `${driverStandingsData[j].F[0]}  `;
                    driverEntry += `${driverStandingsData[j].F[1]}  `;
                    driverEntry += `${driverStandingsData[j].F[4]}`;

                    if (driverEntry.length > longestDriverEntryTextLength) {
                         longestDriverEntryTextLength = driverEntry.length;
                    }

                    driverEntries.push(driverEntry);
               }
          }
     }

     // Apply padding to all the driver entries text to align it correctly
     for (let i = 0; i < driverEntries.length; i++) {
          driverStandingsText += `${driverEntries[i].padEnd(longestDriverEntryTextLength)}\n`;
     }

     // Generate a photo of the results to send
     if (process.env.DEV_MODE) {
          logger.debug(`Generating results photo`);
     }

     // Measure the time taken to generate the photo
     if (process.env.DEV_MODE)  {
          var perfTimeStart = performance.now();
     }

     await page.setContent(`<center><pre id="standings" style="display: inline-block;">${driverStandingsText}</pre></center>`);
     const standingsElement = await page.$('#standings');
     const standingsBoundaries = await standingsElement.boundingBox();

     var standingsPhoto = await page.screenshot({
          clip: {
               x: standingsBoundaries.x,
               y: standingsBoundaries.y,
               width: Math.min(standingsBoundaries.width, page.viewport().width),
               height: Math.min(standingsBoundaries.height, page.viewport().height)
          }
     });

     if (process.env.DEV_MODE)  {
          logger.debug(`Results photo generated in ${performance.now() - perfTimeStart}ms`);
     }

     // Send results alert message
     try {
          await botInstance.telegram.sendMessage(process.env.TELEGRAM_CHANNEL_ID, templates.render('sessionResults', sessionResults), {
               parse_mode: 'HTML'
          });
     } catch (err) {
          logger.error(`Error while sending message: ${err.toString()}`);
     }

     // Send the photo
     try {
          await botInstance.telegram.sendPhoto(process.env.TELEGRAM_CHANNEL_ID, { source: standingsPhoto });
     } catch (err) {
          logger.error(`Error while sending photo: ${err.toString()}`);
     }
}

/**
 * Driver and constructors standing display.
 *
 * Send messages displaying the current drivers and constructors standings.
 *
 * @since 1.0.0
 */
function displayDriversAndConstructorsStandings() {
     f1api.queryErgastF1Api('current driverStandings', (err, driverStandingsData) => {
          if (err) {
               logger.error(`Error while getting current driver standings data: ${err.toString()}`);
               return;
          }

          if (!driverStandingsData.MRData || !driverStandingsData.MRData.StandingsTable) {
               logger.error(`Error while getting current driver standings data: No standings data`);
               return;
          }

          f1api.queryErgastF1Api('current constructorStandings', async (err, constructorStandingsData) => {
               if (err) {
                    logger.error(`Error while getting current constructor standings data: ${err.toString()}`);
                    return;
               }

               if (!constructorStandingsData.MRData || !constructorStandingsData.MRData.StandingsTable) {
                    logger.error(`Error while getting current constructor standings data: No standings data`);
                    return;
               }

               // Build the results table (drivers)
               var driverStandings = driverStandingsData.MRData.StandingsTable.StandingsLists[0];

               // Header
               var driverStandingsText = `<b><u>SEASON ${driverStandings.season}, ROUND ${driverStandings.round}</u></b>\r\n`;
               driverStandingsText += `<b><u>TEMPORADA ${driverStandings.season}, RONDA ${driverStandings.round}</u></b>\r\n\r\n`;
               driverStandingsText += `<b>DRIVER STANDINGS\r\n`;
               driverStandingsText += `CLASIFICACIÓN DE PILOTOS</b>\r\n\r\n`;

               // Build the standings table
               var driverEntries = [];
               var longestDriverEntryTextLength = 0;
               var highestPointsTextLength = 0;

               for (let i = 0; i < driverStandings.DriverStandings.length; i++) {
                    if (i == 0) {
                         highestPointsTextLength = driverStandings.DriverStandings[i].points.length;
                    }

                    let driverEntry = `${driverStandings.DriverStandings[i].position.padStart(2)}  `;
                    driverEntry += `${driverStandings.DriverStandings[i].Driver.code}  `;
                    driverEntry += `${driverStandings.DriverStandings[i].points.padStart(highestPointsTextLength)}  `;
                    driverEntry += `${driverStandings.DriverStandings[i].wins.padStart(2)}`;

                    if (driverEntry.length > longestDriverEntryTextLength) {
                         longestDriverEntryTextLength = driverEntry.length;
                    }

                    driverEntries.push(driverEntry);
               }

               // Apply padding to all the driver entries text to align it correctly
               for (let i = 0; i < driverEntries.length; i++) {
                    driverStandingsText += `${driverEntries[i].padEnd(longestDriverEntryTextLength)}\n`;
               }

               // Generate a photo of the results to send
               if (process.env.DEV_MODE) {
                    logger.debug(`Generating driver standings photo`);
               }

               // Measure the time taken to generate the photo
               if (process.env.DEV_MODE)  {
                    var perfTimeStart = performance.now();
               }

               await page.setContent(`<center><pre id="standings" style="display: inline-block;">${driverStandingsText}</pre></center>`);
               const driverStandingsElement = await page.$('#standings');
               const driverStandingsBoundaries = await driverStandingsElement.boundingBox();

               var driverStandingsPhoto = await page.screenshot({
                    clip: {
                         x: driverStandingsBoundaries.x,
                         y: driverStandingsBoundaries.y,
                         width: Math.min(driverStandingsBoundaries.width, page.viewport().width),
                         height: Math.min(driverStandingsBoundaries.height, page.viewport().height)
                    }
               });

               if (process.env.DEV_MODE)  {
                    logger.debug(`Driver standings photo generated in ${performance.now() - perfTimeStart}ms`);
               }

               // Build the results table (constructors)
               var constructorStandings = constructorStandingsData.MRData.StandingsTable.StandingsLists[0];

               // Header
               var constructorStandingsText = `<b><u>SEASON ${driverStandings.season}, ROUND ${driverStandings.round}</u></b>\r\n`;
               constructorStandingsText += `<b><u>TEMPORADA ${driverStandings.season}, RONDA ${driverStandings.round}</u></b>\r\n\r\n`;
               constructorStandingsText += `<b>CONSTRUCTOR STANDINGS\r\n`;
               constructorStandingsText += `CLASIFICACIÓN DE CONSTRUCTORES</b>\r\n\r\n`;

               // Build the standings table
               var constructorEntries = [];
               var longestConstructorTextLength = 0;
               highestPointsTextLength = 0;

               for (let i = 0; i < constructorStandings.ConstructorStandings.length; i++) {
                    if (i == 0) {
                         highestPointsTextLength = constructorStandings.ConstructorStandings[i].points.length;
                    }

                    let constructorEntry = `${constructorStandings.ConstructorStandings[i].position.padStart(2)}  `;
                    constructorEntry += `${constructorStandings.ConstructorStandings[i].Constructor.name.toUpperCase().substring(0, 3)}  `;
                    constructorEntry += `${constructorStandings.ConstructorStandings[i].points.padStart(highestPointsTextLength)}  `;
                    constructorEntry += `${constructorStandings.ConstructorStandings[i].wins.padStart(2)}`;

                    if (constructorEntry.length > longestConstructorTextLength) {
                         longestConstructorTextLength = constructorEntry.length;
                    }

                    constructorEntries.push(constructorEntry);
               }

               // Apply padding to all the constructor entries text to align it correctly
               for (let i = 0; i < constructorEntries.length; i++) {
                    constructorStandingsText += `${constructorEntries[i].padEnd(longestConstructorTextLength)}\n`;
               }

               // Generate a photo of the results to send
               if (process.env.DEV_MODE) {
                    logger.debug(`Generating constructor standings photo`);
               }

               // Measure the time taken to generate the photo
               if (process.env.DEV_MODE)  {
                    perfTimeStart = performance.now();
               }

               await page.setContent(`<center><pre id="standings" style="display: inline-block;">${constructorStandingsText}</pre></center>`);
               const constructorStandingsElement = await page.$('#standings');
               const constructorStandingsBoundaries = await constructorStandingsElement.boundingBox();

               var constructorStandingsPhoto = await page.screenshot({
                    clip: {
                         x: constructorStandingsBoundaries.x,
                         y: constructorStandingsBoundaries.y,
                         width: Math.min(constructorStandingsBoundaries.width, page.viewport().width),
                         height: Math.min(constructorStandingsBoundaries.height, page.viewport().height)
                    }
               });

               if (process.env.DEV_MODE)  {
                    logger.debug(`Constructor standings photo generated in ${performance.now() - perfTimeStart}ms`);
               }

               // Send alert message
               try {
                    await botInstance.telegram.sendMessage(process.env.TELEGRAM_CHANNEL_ID, templates.render('standingsUpdate', driverStandings), {
                         parse_mode: 'HTML'
                    });
               } catch (err) {
                    logger.error(`Error while sending message: ${err.toString()}`);
               }

               // Send the driver standings photo
               try {
                    await botInstance.telegram.sendPhoto(process.env.TELEGRAM_CHANNEL_ID, { source: driverStandingsPhoto });
               } catch (err) {
                    logger.error(`Error while sending photo: ${err.toString()}`);
               }

               // Send the constructor standings photo
               try {
                    await botInstance.telegram.sendPhoto(process.env.TELEGRAM_CHANNEL_ID, { source: constructorStandingsPhoto });
               } catch (err) {
                    logger.error(`Error while sending photo: ${err.toString()}`);
               }
          })
     });
}

/**
 * Circuit photo sending.
 *
 * Sends the circuit photo for the given country.
 *
 * @since 1.0.0
 * @param {string} country country name
 */
async function sendCircuitPhoto(id) {
     var circuitData = utils.getCircuitData(id);

     if (!circuitData || !circuitData.layoutImage || !circuitData.name) {
          logger.error(`No circuit data found with id '${id}'`);
          return;
     }

     var imagePath = `./resources/images/circuits/${circuitData.layoutImage}`;

     if (!fs.existsSync(imagePath)) {
          logger.error(`File not found: ${imagePath}`);
          return;
     }

     try {
          // Measure the time taken to send the photo
          if (process.env.DEV_MODE)  {
               var perfTimeStart = performance.now();
          }

          await botInstance.telegram.sendPhoto(process.env.TELEGRAM_CHANNEL_ID, {
               source: fs.createReadStream(imagePath),
          }, {
               caption: `\u{1F3CE} ${utils.countryNameToEmoji(circuitData.country)} ${circuitData.name} ${utils.countryNameToEmoji(circuitData.country)} \u{1F3CE}`
          });

          if (process.env.DEV_MODE)  {
               logger.debug(`Circuit layout photo sent in ${performance.now() - perfTimeStart}ms`);
          }
     } catch (err) {
          logger.error(`Error while sending photo: ${err.toString()}`);
     }
}

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

          botInstance = new Telegraf(process.env.BOT_TOKEN);

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
          f1api.getEventInfo(async (err, eventInfo) => {
               if (err) {
                    logger.error(`Error while getting event info: ${err.toString()}`);
                    return;
               }

               if (!eventInfo.seasonContext || !eventInfo.seasonContext.timetables || !eventInfo.race) {
                    logger.error('Error while getting event info: No event info');
                    return;
               }

               var timetables = eventInfo.seasonContext.timetables;

               // (Re)Initialize session alerts status list when needed
               if (sessionAlertsStatus === null || currentGrandPrixName !== eventInfo.race.meetingOfficialName) {
                    sessionAlertsStatus = [];

                    // Check if the current event has the new sprint qualifying format
                    let eventHasSprintQualifying = false;

                    for (let i = 0; i < timetables.length; i++) {
                         if (timetable[i].session === 's') {
                              eventHasSprintQualifying = true;
                              break;
                         }
                    }

                    // Logical order of the sessions
                    const sessionOrder = null;

                    if (eventHasSprintQualifying) {
                         sessionOrder = ['p1', 'q', 'p2', 's', 'r'];
                    } else {
                         sessionOrder = ['p1', 'p2', 'p3', 'q', 'r'];
                    }

                    for (let i = 0; i < timetables.length; i++) {
                         // Get the previous session index in the timetables for every session
                         let prevSessionIdx = -1;

                         for (let j = 0; j < sessionOrder.length; j++) {
                              if (timetables[i].session === sessionOrder[j] && j !== 0) {
                                   for (let k = 0; k < timetables.length; k++) {
                                        if (timetables[k].session == sessionOrder[j - 1]) {
                                             prevSessionIdx = k;
                                        }
                                   }

                                   break;
                              }
                         }

                         sessionAlertsStatus.push({
                              description: timetables[i].description,
                              state: timetables[i].state,
                              alertSent: false,
                              scheduleSent: false,
                              // Prevent showing results when launching the bot for the first time...
                              // ... if the session is already complete
                              resultsShown: timetables[i].state === 'completed',
                              prevSessionIdx: prevSessionIdx
                         });
                    }
               }

               // Keep track of the current grand prix name
               if (currentGrandPrixName !== eventInfo.race.meetingOfficialName) {
                    currentGrandPrixName = eventInfo.race.meetingOfficialName;
                    logger.info(`Current Grand Prix: ${currentGrandPrixName}`);

                    // Reset these flags when the grand prix name changes
                    wasCircuitPhotoSent = false;
                    allResultsSent = false;
               }

               // Loop through the timetables and show alerts for the incoming sessions
               for (let i = 0; i < timetables.length; i++) {
                    if (timetables[i].state === 'completed') {
                         sessionAlertsStatus[i].state = timetables[i].state;
                         sessionAlertsStatus[i].alertSent = false;
                         sessionAlertsStatus[i].scheduleSent = false;
                         continue;
                    }

                    // Reset results shown status and update data for the session alerts status list
                    sessionAlertsStatus[i].resultsShown = false;
                    sessionAlertsStatus[i].description = timetables[i].description;
                    sessionAlertsStatus[i].state = timetables[i].state;

                    // Get time diff until session start
                    var currentDate = new Date();
                    var startTime = new Date(`${timetables[i].startTime}${timetables[i].gmtOffset}`);
                    var msDifference = startTime.getTime() - currentDate.getTime();

                    // Session schedule alert
                    if (!sessionAlertsStatus[i].scheduleSent) {
                         // Only show the schedule if the results for the previous session were shown
                         var prevSessionCompleted = true;

                         if (sessionAlertsStatus[i].prevSessionIdx !== -1 &&
                              !sessionAlertsStatus[sessionAlertsStatus[i].prevSessionIdx].resultsShown) {
                              prevSessionCompleted = false;
                         }

                         if (prevSessionCompleted && msDifference <= process.env.SESSION_TIMES_ALERT_TIME_AHEAD && msDifference > 0) {
                              let sessionInfo = timetables[i];
                              sessionInfo.race = eventInfo.race;
                              sessionInfo.msToGo = msDifference;

                              logger.info(`Sending incoming session schedule (${sessionInfo.race.meetingOfficialName} - ${timetables[i].description})`);
                              await displaySessionScheduleMessage(sessionInfo);
                              sessionAlertsStatus[i].scheduleSent = true;

                              // Send the circuit photo layout too (if it hasn't been sent before)
                              if (!wasCircuitPhotoSent) {
                                   logger.info(`Sending circuit layout photo (${sessionInfo.race.meetingOfficialName} - ${timetables[i].description})`);
                                   await sendCircuitPhoto(eventInfo.race.meetingCountryName);
                                   wasCircuitPhotoSent = true;
                              }
                         }
                    }

                    // Session info alert
                    if (!sessionAlertsStatus[i].alertSent && msDifference <= process.env.ALERT_TIME_AHEAD && msDifference > 0) {
                         let sessionInfo = timetables[i];
                         sessionInfo.race = eventInfo.race;
                         sessionInfo.msToGo = msDifference;

                         logger.info(`Sending incoming session info alert (${sessionInfo.race.meetingOfficialName} - ${timetables[i].description})`);
                         await displayIncomingSessionInfoMessage(sessionInfo);
                         sessionAlertsStatus[i].alertSent = true;
                    }
               }
          });

          // Query session info for result messages
          f1api.getCurrentSessionInfo((err, sessionInfo) => {
               if (err) {
                    logger.error(`Error while getting session info: ${err.toString()}`);
                    return;
               }

               if (!sessionInfo.ArchiveStatus || !sessionInfo.Meeting || !sessionInfo.Meeting.Circuit) {
                    logger.error('Error while getting session info: No session info');
                    return;
               }

               // Show results if the session is completed
               if (sessionInfo.ArchiveStatus.Status === 'Complete' && sessionAlertsStatus !== null && !allResultsSent) {
                    for (let i = 0; i < sessionAlertsStatus.length; i++) {
                         if (sessionInfo.Name === sessionAlertsStatus[i].description
                              && !sessionAlertsStatus[i].resultsShown && sessionAlertsStatus[i].state == 'completed') {
                              f1api.getSessionResults(sessionInfo, async (err, sessionResults) => {
                                   if (err) {
                                        logger.error(`Error while getting session results: ${err.toString()}`);
                                        return;
                                   }

                                   // Store the country name so we can map the flag emoji on the template
                                   sessionResults.countryName = sessionInfo.Meeting.Country.Name;

                                   logger.info(`Sending completed session results (${sessionResults.free.data.R} - ${sessionInfo.Name})`);
                                   await displaySessionResultsMessage(sessionResults);
                                   sessionAlertsStatus[i].resultsShown = true;

                                   // Display drivers/constructors standings messages after the race has completed
                                   if (sessionInfo.Name === 'Race') {
                                        var scheduleDate = new Date();

                                        scheduleDate.setTime(scheduleDate.getTime() + parseInt(process.env.TIME_STANDINGS_UPDATE_AFTER_RACE));
                                        driversConstructorsStandingUpdateAlertScheduledJob = schedule.scheduleJob(scheduleDate, displayDriversAndConstructorsStandings);

                                        // Fix to prevent sending duplicated race session results due to the F1 API
                                        // being dumb
                                        allResultsSent = true;
                                   }
                              });

                              break;
                         }
                    }
               }
          });
     }
};