/**
 * Open Weather Map API.
 *
 * Open Weather Map API Implementation.
 *
 * @author dcealopez
 * @since 1.0.0
 */

const request = require('request');
const apiUrl = 'https://api.openweathermap.org/data/2.5';

/**
 * Weather code-emoji mapper.
 *
 * Maps OWM's weather codes to emoji codes.
 *
 * @param {number} code OWM weather code
 * @returns {string} emoji unicode representation of the weather code
 */
function getEmojiForWeatherCode(code) {
     switch (code) {
          case code >= 200 && code <= 299: // Storm
               return '\u{1F4A8}';
          case code >= 300 && code <= 399: // Drizzle
               return '\u{1F4A7}';
          case code >= 500 && code <= 599: // Rain
               return '\u{2614}';
          case (code >= 600 && code <= 699) || code === 903 || code === 906: // Snow
               return '\u{26C4}';
          case code >= 700 && code <= 799: // Atmosphere
               return '\u{1F301}';
          case 800: // Clear
               return '\u{2600}';
          case 801: // Clear-sun
               return '\u{26C5}';
          case code === 802 || code === 803 || code === 804: // Clouds
               return '\u{2601}';
          case 904: // Hot
               return '\u{1F525}';
          default:
               return '\u{1F300}';
     }
}

/**
 * Request callback.
 *
 * @since 1.0.0
 * @callback callback
 * @param {string} error
 * @param {string} response body
 */

/**
 * Weather Data fetcher.
 *
 * Gets the current weather data at the specified location.
 *
 * @since 1.0.0
 * @param {string} city city name
 * @param {string} country country name
 * @param {string} lang language in which the data will be formatted (es, en...)
 * @param {string} units units format
 * @param {callback} callback request callback
 */
function getWeatherDataAt(city, country, lang, units, callback) {
     if (!process.env.OWM_API_KEY) {
          callback(new Error(`'OWM_API_KEY' env var is not defined`), null);
          return;
     }

     request(encodeURI(`${apiUrl}/weather/?q=${city},${country}&lang=${lang}&units=${units}&APPID=${process.env.OWM_API_KEY}`), (err, res, body) => {
          if (err) {
               callback(err, null);
               return;
          }

          try {
               var parsedData = JSON.parse(body);
          } catch(err) {
               callback(err, null);
               return;
          }

          callback(null, parsedData);
     });
}

module.exports = {
     getWeatherDataAt: getWeatherDataAt,
     getEmojiForWeatherCode: getEmojiForWeatherCode
};
