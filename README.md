# f1-alerts-telegram-bot


**F1 Alerts bot for Telegram.**

This bot displays alerts for the FIA Formula 1 Championship on Telegram.

**Official Telegram channel:** https://t.me/f1alerts

The official Formula 1 web API (free) is used alongside the [Open Weather Map API](https://openweathermap.org/) to fetch the event information used to display the alerts.

The [Ergast API](http://ergast.com/mrd/) is also used to fetch information about the driver and constructor standings.

### Features

- Displays full session schedules for many locations across the world.
- Sends circuit layout photos.
- Sends reminder alerts for incoming sessions.
- Shows the weather report of the circuit for incoming sessions.
- Generates and sends photos for the results of each session.
- Displays updated driver and constructor standings after each Grand Prix.

### Configuration

The following enviroment variables must be set for the bot to run:

```
# Telegram bot token
BOT_TOKEN=

# Open Weather Map API Key
OWM_API_KEY=

# F1 static API Key (DO NOT MODIFY)
F1_API_KEY=qPgPPRJyGCIPxFT3el4MF7thXHyJCzAP

# Development mode (0 disabled, 1 enabled)
DEV_MODE=

# Telegram channel ID the bot will send messages to
TELEGRAM_CHANNEL_ID=

# Refresh interval (Cron Time format)
BOT_LOOP_CRON_TIME=*/1 * * * 0,4,5,6

# Time ahead for incoming session alerts (in ms)
ALERT_TIME_AHEAD=900000

# Time ahead for the session schedule alerts (in ms)
SESSION_TIMES_ALERT_TIME_AHEAD=43200000

# Time to wait after the race to display the updated driver/constructors standings messages (in ms)
TIME_STANDINGS_UPDATE_AFTER_RACE=21600000

# LOG4JS Config file
LOG4JS_CONFIG=
```

### Logging

The [log4js](https://www.npmjs.com/package/log4js) node module is used for logging. A log4js configuration file is not required for the bot to run but it is recommended.

Here is an example configuration:

```
{
     "appenders": {
          "console": {
               "type": "console",
               "layout": {
                    "type": "pattern",
                    "pattern": "%[[%d{yyyy-MM-dd hh:mm:ss.SSS}] [%p] %m%]"
               }
          },
          "all": {
               "type": "dateFile",
               "filename": "./logs/bot.log",
               "layout": {
                    "type": "pattern",
                    "pattern": "[%d{yyyy-MM-dd hh:mm:ss.SSS}] [%p] %m"
               },
               "compress": true,
               "alwaysIncludePattern": true,
               "keepFileExt": true
          }
     },
     "categories": {
          "default": { "appenders": ["console", "all"], "level": "all" }
     }
}
```

###Images

Session schedule alert:

![](https://user-images.githubusercontent.com/22688330/69465891-c9c10080-0d82-11ea-887b-677c91699fd0.png)

Incoming session alert w/ weather report:

![](https://user-images.githubusercontent.com/22688330/69465920-df362a80-0d82-11ea-932a-265a02cbc0e4.PNG)

Session results alert:

![](https://user-images.githubusercontent.com/22688330/69465944-f70dae80-0d82-11ea-9a84-4481f5325c35.PNG)

Standings update alert:

![](https://user-images.githubusercontent.com/22688330/69465988-1ad0f480-0d83-11ea-98a3-96ba809104ab.PNG)