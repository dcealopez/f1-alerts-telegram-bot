/**
 * Formula 1 Live Timing API.
 *
 * Formula 1 Live Timing API implementation.
 *
 * @author dcealopez
 * @since 1.0.0
 */

const request = require('request');
const liveTimingApiUrl = 'https://livetiming.formula1.com/static';
const f1ApiUrl = 'https://api.formula1.com';
const ergastF1ApiUrl = 'https://ergast.com/api/f1';

/**
 * Request callback.
 *
 * @since 1.0.0
 * @callback callback
 * @param {string} error
 * @param {string} response body
 */

/**
 * Session info.
 *
 * Gets the current session information using the API.
 *
 * @since 1.0.0
 * @param {callback} callback request callback
 */
function getCurrentSessionInfo(callback) {
     request(`${liveTimingApiUrl}/SessionInfo.json`, (err, res, body) => {
          if (err) {
               callback(err, null);
               return;
          }

          try {
               var parsedData = JSON.parse(body.trim());

               callback(null, parsedData);
          } catch (err) {
               callback(err, null);
          }
     });
}

/**
 * Session results.
 *
 * Gets the specified session results.
 *
 * @param {*} sessionInfoObject Session info object
 * @param {callback} callback request callback
 */
function getSessionResults(sessionInfoObject, callback) {
     request(`${liveTimingApiUrl}/${sessionInfoObject.Path}SPFeed.json`, (err, res, body) => {
          if (err) {
               callback(err, null);
               return;
          }

          try {
               var parsedData = JSON.parse(body.trim());

               callback(null, parsedData);
          } catch (err) {
               callback(err, null);
          }
     });
}

/**
 * Event info.
 *
 * Gets the info about the current event.
 *
 * @param {*} callback request callback
 */
function getEventInfo(callback) {
     if (!process.env.F1_API_KEY) {
          callback(new Error(`'F1_API_KEY' env var is missing`), null);
          return;
     }

     request(`${f1ApiUrl}/v1/event-tracker`, {
          headers: {
               apikey: process.env.F1_API_KEY,
               locale: 'en'
          }
     }, (err, res, body) => {
          if (err) {
               callback(err, null);
               return;
          }

          try {
               var parsedData = JSON.parse(body);

               callback(null, parsedData);
          } catch (err) {
               callback(err, null);
          }
     });
}

/**
 * Circuit info.
 *
 * Gets info of all F1 circuits.
 *
 * @param {*} callback request callback
 */
function getCircuitInfo(callback) {
     request(`${ergastF1ApiUrl}/circuits.json`, (err, res, body) => {
          if (err) {
               callback(err, null);
               return;
          }

          try {
               var parsedData = JSON.parse(body);

               callback(null, parsedData);
          } catch (err) {
               callback(err, null);
          }
     });
}

module.exports = {
     getCurrentSessionInfo: getCurrentSessionInfo,
     getSessionResults: getSessionResults,
     getEventInfo: getEventInfo,
     getCircuitInfo: getCircuitInfo
};