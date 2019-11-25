/**
 * General utilities module.
 *
 * General utility methods implementation.
 *
 * @author dcealopez
 * @since 1.0.0
 */

const countryEmojis = require('../resources/data/country-emojis.json');
const countryCircuits = require('../resources/data/country-circuits.json');

module.exports = {
     /**
      * Country name to emoji mapper.
      *
      * Returns the flag emoji for the given country name.
      *
      * @since 1.0.0
      * @author dcealopez
      * @param {string} countryName country name
      */
     countryNameToEmoji: (countryName) => {
          if (!countryEmojis[countryName]) {
               return '';
          }

          return countryEmojis[countryName];
     },
     /**
      * Circuit data fetcher.
      *
      * Returns the data for the given circuit Id.
      *
      * @since 1.0.0
      * @author dcealopez
      * @param {string} id circuit identifier string
      */
     getCircuitData: (id) => {
          for (var i = 0; i < countryCircuits.length; i++) {
               var ids = countryCircuits[i].id.split(',');

               if (!ids.includes(id)) {
                    continue;
               }

               return countryCircuits[i];
          }

          return null;
     }
}