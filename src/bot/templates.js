/**
 * Message template module
 *
 * Message template module implementation for bot messages
 *
 * @author dcealopez
 * @since 1.0.0
 */

const path = require('path');
const fs = require('fs');
const { performance } = require('perf_hooks');
const translate = require('./translate/translate');

// Logger for this file
const logger = require('log4js').getLogger();

// Templates are stored here
let templates = [];

/**
 * Template file loading
 *
 * Loads all the template files found in the 'templates' directory
 *
 * @since 1.0.0
 */
function load() {
     templates = [];

     try {
          var templateFiles = fs.readdirSync('./src/bot/templates');
     } catch (err) {
          logger.error(err);
          return;
     }

     for (var i = 0; i < templateFiles.length; i++) {
          if (!(/\.template$/).test(templateFiles[i])) {
               logger.warn(`${templateFiles[i]} is not a valid template file`);
               continue;
          }

          try {
               var templateData = fs.readFileSync(path.join('./src/bot/templates', templateFiles[i]), { encoding: 'utf-8' });
               var templateName = templateFiles[i].replace('.template', '')
               templates.push({ templateName, templateData });
               logger.info(`Loaded template '${templateName}'`);
          } catch (err) {
               logger.error(err);
          }
     }
}

/**
 * Renders a template
 *
 * Renders the template with the given name and data
 *
 * @param {string} templateName the name of the template to render
 * @param {*} data object
 * @returns {string} the rendered template text
 */
function render(templateName, /* data object will be passed here as the second parameter */) {
     if (process.env.DEV_MODE) {
          logger.debug(`Rendering template '${templateName}'`);
     }

     var templateToRender = null;

     for (var i = 0; i < templates.length; i++) {
          if (templates[i].templateName === templateName) {
               templateToRender = templates[i].templateData;
               break;
          }
     }

     if (!templateToRender) {
          return "ERR_UNKNOWN_TEMPLATE";
     }

     // Measure the time taken to render the template
     if (process.env.DEV_MODE)  {
          var perfTimeStart = performance.now();
     }

     // Get all the JS code to evaluate using a regular expression
     var matches = templateToRender.match(/\{\{.*\}\}/g);

     // Evaluate and replace it with the evaluated values
     for (var i = 0; i < matches.length; i++) {
          var js = matches[i].substr(2, matches[i].length);
          js = js.substr(0, js.length - 2);
          js = js.replace(/(sessionInfo.)|(sessionResults.)/g, 'arguments[1].');

          templateToRender = templateToRender.replace(matches[i], eval(js));
     }

     if (process.env.DEV_MODE)  {
          logger.debug(`Template '${templateName}' rendered in ${performance.now() - perfTimeStart}ms`);
     }

     return templateToRender;
}

module.exports = {
     load: load,
     render: render,
};