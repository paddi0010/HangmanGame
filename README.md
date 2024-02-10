# Introduction

This is a basic chat game names "hangman_game" and using JavaScript library tmi.js and node.js.


First, you must install NodeJs, you can find it here: https://nodejs.org/en and click the Button "20.11.0 LTS"

The answers of the Bot are in German language!


# How to use it


You can extract the zip archive wherever you like, preferably on your desktop. After you have unpacked this, you can start by entering the following values into the variables, you can do it in the /secret_data/config.json File. 

Doubleclick on the config.json File and you can see 3 Variables:

- channels - This is the Channel you wish to connect the Bot.

- username - This is the username of your bot account

- password - This is the oauth token of your bot, you can generate it on https://twitchapps.com/tmi/ make sure you are logged in with your **bot Account**, otherwise your Main Twitch Account will be used!


Then you can double-click on the `start_bot.bat`

Now the Twitch Game should be started!

*If you become the message `Login authentication failed`, check your login infomation in the /secret_data/config.json file*

**For stop the Bot, you can easy close the Command Window ;)**


# How to edit Bot Messages

You can open the `game.js` File and you can see a lot of Code. If you want to change the Message, you can change it, i do comments in EN und DE. Do NOT change the Commands otherwise the Bot Commands are buggy.

--> *I am a beginner in JavaScript, so there may be errors.
If you find a bug or encounter any other issues, feel free to open a issue, and I'll do my best to fix the bug or help you.* :)
