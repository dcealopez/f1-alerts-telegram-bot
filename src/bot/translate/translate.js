/**
 * Translation module.
 *
 * Translation module implementation.
 *
 * @author dcealopez
 * @since 1.0.0
 */

const translations = require('./translations.json');

/**
 * String translation.
 *
 * Translates the given string to the given locale.
 *
 * @since 1.0.0
 * @param {string} locale string
 * @param {string} string to translate
 * @returns {string} the translated string, if it can be translated
 */
function translate(locale, string) {
     if (!translations[locale][string]) {
          return string;
     }

     return translations[locale][string];
}

module.exports = translate;