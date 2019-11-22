/**
 * General utilities module.
 *
 * General utility methods implementation.
 *
 * @author dcealopez
 * @since 1.0.0
 */

const countryEmojis = require('../resources/data/country-emojis.json');

module.exports = {
     /**
      * Country name to emoji mapper.
      *
      * Returns the flag emoji for the given country name.
      *
      * @param {string} countryName country name
      */
     countryNameToEmoji: (countryName) => {
          if (!countryEmojis[countryName]) {
               return '';
          }

          return countryEmojis[countryName];
     }
}