/**
 * Formula 1 Live Timing API.
 *
 * Formula 1 Live Timing API implementation.
 *
 * @author dcealopez
 * @since 1.0.0
 */

const request = require('request');
const apiUrl = 'https://livetiming.formula1.com/static';

/**
 * Session info.
 *
 * Gets the current session information using the API.
 *
 * @since 1.0.0
 */
function getCurrentSessionInfo(callback) {
     request(`${apiUrl}/SessionInfo.json`, (err, res, body) => {
          if (err) {
               callback(err, null);
          }

          callback(null, JSON.parse(body.trim()));
     });
};

/**
 * Session results.
 *
 * Gets the specified session results.
 *
 * @param {*} Session info object
 */
function getSessionResults(sessionInfoObject, callback) {
     request(`${apiUrl}/${sessionInfoObject.Path}SPFeed.json`, (err, res, body) => {
          if (err) {
               callback(err, null);
          }

          callback(null, JSON.parse(body.trim()));
     })
}

module.exports = {
     getCurrentSessionInfo: getCurrentSessionInfo,
     getSessionResults: getSessionResults
}