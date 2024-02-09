const tmi = require('tmi.js');
const config = require('./secret_data/config.json');

const client = new tmi.Client({ 
    options: {
        debug: true
    },
    connection: {
        reconnect: true,
        secure: true
    },
    identity: config.identify,
    channels: config.channels
});

// Array with Words for the game, if you will more, add the Words here // Liste mit Wörtern und den dazugehörigen Kategorien, auf Wunsch, hier welche einfügen//
const categories = {
  standard: ['mann', 'ballon', 'programm', 'fluss', 'hallo', 'ich', 'luft', 'bot', 'uhrzeit', 'moin', 'servus', 'klo', 'streamen', 'twitch', 'streamer', 'name'],
  technik: ['internet', 'zeit', 'ki', 'tastatur', 'maus', 'server', 'programmierung', 'bildschirm', 'monitor', 'lautsprecher'],
  obst: ['apfel', 'birne', 'banane', 'kirsche', 'traube', 'melone'],
  tiere: ['hund', 'katze', 'elefant', 'affe', 'giraffe', 'pferd', 'hamster', 'wolf', 'schlange', 'skorpion'],
  stadt: ['berlin', 'hamburg', 'muenchen', 'koeln', 'frankfurt', 'dresden']
};

let selectedCategory = 'standard'; // EN --> Default: standart, you can change this to technik, obst, tiere or stadt / DE --> Standart: standart, du kannst diese zu technik, obst tiere oder stadt ändern// 
let randomWord;
let guessedLetters;
let gameRunning = false; 
let gameTimer; 
let gameDuration = 240000; // EN --> Default: 4 Minutes (in Milliseconds) / DE --> Standart: 4 Minuten Spiellänge (in Millisekunden)/
let startWordCooldown = null;

const channel = config.channels[0];

client.on("connected", (address, port) => {
  console.log('Connected', "Adresse: " + address + " Port: " + port);
  client.say(channel, `Search Word Module gestartet! 🔎 Tippe "!start word" in den Chat um das Spiel zu starten!`); // EN --> Message, when the Bot started / DE --> Nachricht, wenn der Bot gestartet ist. /
});


// Commands
client.on('message', (channel, tags, message, self) => {
  if (self) return;

  if (message.toLowerCase() === '!start word') {
    startWordGame(channel, tags);
  } else if (message.toLowerCase() === '!stop word') {
    stopWordGame(channel, tags);
  } else if (message.toLowerCase().startsWith('!guess ')) {
    guessLetter(channel, tags, message);
  } else if (message.toLowerCase() === '!kategorien') {
    showCategories(channel, tags);
  } else if (message.toLowerCase() === '!kat') {
    showCurrentCategory(channel, tags);
  } else if (message.toLowerCase().startsWith('!kategorie ')) {
    changeCategory(channel, tags, message);
  } else if (message.toLowerCase() === '!word') {
    wordCommand(channel, tags);
  } else if (message.toLowerCase() === '!tipp') {
    provideTip(channel, tags, client);
  }
});

// EN --> You can change this message whoever you like/ DE --> Du kannst diese Nachricht verändern, wie du möchtest//
function startWordGame(channel, tags) {
  tipCount = 3
  if (gameRunning) {
    client.say(channel, 'Ein Spiel läuft bereits. Bitte beendet das aktuelle Spiel, bevor ihr ein neues startet. dinkDonk');
    return;
  }

  if (startWordCooldown && Date.now() - startWordCooldown < 600000) { // Cooldown: 10 Minutes (10 * 60 * 1000 Milliseconds)
    const remainingCooldown = Math.ceil((600000 - (Date.now() - startWordCooldown)) / 60000); // Calculation of remaining minutes
    client.say(channel, 'Der `!start word`-Befehl ist im Cooldown. Bitte warte noch ' + remainingCooldown + ' Minuten.');
    return;
  }

  startWordCooldown = Date.now(); // Set Colldown Timestamp
  randomWord = getWordList()[Math.floor(Math.random() * getWordList().length)];
  guessedLetters = new Set();
  const gameDurationMinutes = gameDuration / 60000;

  client.say(channel, `Das Spiel wurde gestartet. Das zu erratende Wort hat ${randomWord.length} Buchstaben. [${gameDurationMinutes} Minuten Zeit!] (!guess [buchstabe] ö=oe, ä=ae, ü=ue)`);
  gameRunning = true; // Set game status to “running”.

  // Timer für das Spiel starten
  gameTimer = setTimeout(() => {
    client.say(channel, 'Die Zeit ist abgelaufen! Das zu erratende Wort war: ' + randomWord + 'Wenn ihr noch eine Runde spielen wollt, gebt "!start word" ein.');
    gameRunning = false; // Set game status to "finished".
  }, gameDuration);
}


function stopWordGame(channel, tags) {
  if (!gameRunning) {
    client.say(channel, 'Es läuft kein Spiel. ⛔');
  }

  clearTimeout(gameTimer);
  client.say(channel, 'Das Spiel wurde beendet. Wenn ihr noch eine Runde spielen wollt, gebt "!start word" ein.');

  gameRunning = false; // Set game status to "finished".
};

function guessLetter(channel, tags, message) {
  if (!gameRunning) {
    client.say(channel, 'Es läuft kein Spiel. ⛔ Bitte startet dies mit dem Befehl "!start word".');
    return;
  }

  const guess = message.toLowerCase().substring(7);

  if (guessedLetters.has(guess)) {
    client.say(channel, 'Diesen Buchstaben habt ihr bereits geraten.');
  } else {
    if (randomWord.includes(guess)) {
      guessedLetters.add(guess);
      displayWord(channel);
      if (isWordGuessed()) {
        clearTimeout(gameTimer);
        client.say(channel, 'Glückwunsch! Ihr habt das Wort "' + randomWord + '" erraten. ✅');
        gameRunning = false;
      }
    } else {
      client.say(channel, 'Der Buchstabe "' + guess + '" ist nicht im Wort enthalten.');
    }
  }
};

function wordCommand(channel, tags) {
  const message = `BabyYodaSip ---> Verfügbare Befehle: --- !start word - Startet ein neues Spiel. Loading --- !stop word - Beendet das aktuelle Spiel. ❌ --- !guess [Buchstabe] - Rate einen Buchstaben. --- !kat - Zeigt dir die aktuelle Kategorie an. --- !kategorie (standard, technik, obst, tiere, stadt) - Kategorie ändern | ${tags.username} |`;
    client.say(channel, message);
}

function showCategories(channel, tags) {
    client.say(channel, 'Verfügbare Kategorien: ' + Object.keys(categories).join(', ') + ` | ${tags.username} |`);
  };

function showCurrentCategory(channel, tags) {
  if (selectedCategory) {
    client.say(channel, 'Die aktuelle Kategorie ist: ' + selectedCategory + ` | ${tags.username} |`);
  }
};

//change Category function
function changeCategory(channel, tags, message) {
  if (gameRunning) {
    client.say(channel, `Du kannst die Kategorie nicht ändern, während ein Spiel läuft. Gebe dazu "!stop word" in den Chat ein! | ${tags.username} |`);
    return;
  }

  const selectedCategoryName = message.toLowerCase().substring(11);

  if (Object.keys(categories).includes(selectedCategoryName)) {
    selectedCategory = selectedCategoryName;
    client.say(channel, 'Die Kategorie wurde auf ' + selectedCategory + ' geändert! ✅');
  } else {
    client.say(channel, 'Ungültige Kategorie! ⛔');
  }
};

// Function to display the word with placeholders for letters not guessed
function displayWord(channel) {
  let displayedWord = '';

  for (let i = 0; i < randomWord.length; i++) {
    const letter = randomWord[i];

    if (guessedLetters.has(letter)) {
      displayedWord += letter + ' ';
    } else {
      displayedWord += '_ ';
    }
  }

  client.say(channel, displayedWord);
};

// Function to check if the entire word has been guessed
function isWordGuessed() {
  for (let i = 0; i < randomWord.length; i++) {
    if (!guessedLetters.has(randomWord[i])) {
      return false;
    }
  }

  return true;
};

function getWordList() {
  return categories[selectedCategory];
};

function provideTip(channel, tags, client) {
  if (!gameRunning) {
    client.say(channel, `Es läuft kein Spiel. ⛔ Bitte startet dies mit dem Befehl "!start word". || ${tags.username} ||`);
    return;
  }

  if (tipCount > 0) {
    const unrevealedLetters = Array.from(new Set(randomWord.split('').filter(letter => !guessedLetters.has(letter))));
    const randomUnrevealedLetter = unrevealedLetters[Math.floor(Math.random() * unrevealedLetters.length)];
    client.say(channel, `Tipp: Ein Buchstabe im Wort ist "${randomUnrevealedLetter}" || ${tags.username} ||`);
    tipCount--;

    client.say(channel, `Verbleibende Tipps: ${tipCount} ⚠️`);
  } else {
    client.say(channel, `Ihr habt keine verbleibenden Tipps. ⛔`);
  }
}

client.connect().catch(console.error);
