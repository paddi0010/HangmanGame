const tmi = require("tmi.js");
const config = require("./secret_data/config.json");
const fs = require("fs");
const categories = require ("./data/words.json");

const client = new tmi.Client({
  options: {
    debug: true,
  },
  connection: {
    reconnect: true,
    secure: true,
  },
  identity: config.identify,
  channels: config.channels,
});

//word list is in the /data/words.json file

let selectedCategory = "standard"; // EN --> Default: standart, you can change this to technik, obst, tiere or stadt / DE --> Standart: standart, du kannst diese zu technik, obst tiere oder stadt ändern//
let randomWord;
let guessedLetters;
let gameRunning = false;
let gameTimer;
let gameDuration = 240000; // EN --> Default: 4 Minutes (in Milliseconds) / DE --> Standart: 4 Minuten Spiellänge (in Millisekunden)
let startWordCooldown = null;
let startWordCooldownDuration = 60000; // EN --> Default 1 Minute (in Milliseconds) / DE: --> Standart: 1 Minute Cooldown (in Milliseckunden)

const channel = config.channels[0];

client.on("connected", (address, port) => {
  console.log("Connected", "Adresse: " + address + " Port: " + port);
  client.say(channel, `Wörtersuchspiel gestartet! 🔎 Tippt "!start word" in den Chat um das Spiel zu starten!`); // EN --> Message, when the Bot started / DE --> Nachricht, wenn der Bot gestartet ist. /
});

// Commands
client.on("message", (channel, tags, message, self) => {
  if (self) return;

  if (message.toLowerCase() === "!start word") {
    startWordGame(channel, tags);
  } else if (message.toLowerCase() === "!stop word") {
    stopWordGame(channel, tags);
  } else if (message.toLowerCase().startsWith("!guess ")) {
    guessLetter(channel, tags, message);
  } else if (message.toLowerCase() === "!kategorien") {
    showCategories(channel, tags);
  } else if (message.toLowerCase() === "!kat") {
    showCurrentCategory(channel, tags);
  } else if (message.toLowerCase().startsWith("!kategorie ")) {
    changeCategory(channel, tags, message);
  } else if (message.toLowerCase() === "!word") {
    wordCommand(channel, tags);
  } else if (message.toLowerCase() === "!tipp") {
    provideTip(channel, tags, client);
  } else if (message.toLowerCase().startsWith("!cooldown ") && (tags.mod || tags.username.toLowerCase() === channel.replace("#", ""))) {
    setStartWordCooldown(channel, tags, message);
  } else if (message.toLowerCase() === "!cooldown") {
    showStartWordCooldown(channel);
  } else if (message.toLowerCase().startsWith("!spielzeit ") && (tags.mod || tags.username.toLowerCase() === channel.replace("#", ""))) {
      setGameDuration(channel, tags, message);
  } else if (message.toLowerCase() === "!spielzeit") {
    showGameDuration(channel, tags, message);
  }
});

// EN --> You can change this message whoever you like/ DE --> Du kannst diese Nachricht verändern, wie du möchtest//
function startWordGame(channel, tags) {
  tipCount = 3;
  if (gameRunning) {
    client.say(channel, "2 Spiele gleichzeitig? Nee, gibt sonst ein Chaos! Bitte beendet das aktuelle Spiel, bevor ihr ein neues startet. ⚠️");
    return;
  }

  if (startWordCooldown && Date.now() - startWordCooldown < startWordCooldownDuration) {
    const remainingCooldown = Math.ceil((startWordCooldownDuration - (Date.now() - startWordCooldown)) / 60000);
    client.say(channel, "Der `!start word`-Befehl kühlt noch ab. 🥶 Bitte wartet noch " + remainingCooldown + " Minute(n).");
    return;
  }

  startWordCooldown = Date.now();
  randomWord = getWordList()[Math.floor(Math.random() * getWordList().length)];
  guessedLetters = new Set();
  const gameDurationSeconds = gameDuration / 1000;

  client.say(channel, `Ein neues Spiel wurde gestartet. ✅ Hab mir mal ein Wort mit ${randomWord.length} Buchstaben rausgesucht. :D Ihr habt ${gameDurationSeconds} Sekunden Zeit! ⏲️ (!guess [Buchstabe])`);
  gameRunning = true;

  gameTimer = setTimeout(() => {
    client.say(channel, "Die Zeit ist um! Das Wort war: \"" + randomWord + "\" Beim nächsten Mal klappt es bestimmt besser! \"!start word\" für eine weitere Runde.");
    gameRunning = false;
  }, gameDuration);
}


function stopWordGame(channel, tags) {
  if (!gameRunning) {
    client.say(channel, "Du möchtest wirklich ein nicht gestartetest Spiel stoppen? Kappa");
    return;
  }

  clearTimeout(gameTimer);
  client.say(channel, 'Das Spiel wurde beendet. Danke fürs mitmachen! 👍 Wenn ihr noch eine Runde spielen wollt, gebt "!start word" ein.');
  gameRunning = false; // Set game status to "finished".
}

function setStartWordCooldown(channel, tags, message) {
  if (!tags.mod && tags.username.toLowerCase() !== channel.replace("#", "")) {
    client.say(channel, "Nur Moderatoren und der Broadcaster können den Cooldown ändern! ⚠️");
    return;
  }

  const newCooldownDuration = parseInt(message.toLowerCase().substring(10));

  if (!isNaN(newCooldownDuration) && newCooldownDuration >= 0) {
    startWordCooldownDuration = newCooldownDuration * 1000;
    saveCooldownDuration(startWordCooldownDuration);
    client.say(channel, `Cooldown für den Spielstart wurde auf ${newCooldownDuration} Sekunden geändert. ✅`);
  } else {
    client.say(channel, "Ungültige Eingabe! Bitte gib eine positive Zahl ein. ⚠️");
  }
}

function showStartWordCooldown(channel) {
  const cooldownSeconds = startWordCooldownDuration / 1000;
  client.say(channel, `Der Cooldown für den Spielstart beträgt derzeit ${cooldownSeconds} Sekunden. ⏱️`);
}

// Funktion zum Speichern der Cooldown-Dauer in einer Datei
function saveCooldownDuration(cooldownDuration) {
  const data = JSON.stringify({ startWordCooldownDuration: cooldownDuration });
  fs.writeFile("./data/cooldown_config.json", data, (err) => {
    if (err) {
      console.error("Fehler beim Speichern der Cooldown-Konfiguration:", err);
    }
  });
}

// Funktion zum Laden der Cooldown-Dauer aus einer Datei beim Start des Bots
function loadCooldownDuration() {
  fs.readFile("./data/cooldown_config.json", (err, data) => {
    if (err) {
      console.error("Fehler beim Lesen der Cooldown-Konfiguration:", err);
      return;
    }
    const parsedData = JSON.parse(data);
    if (!isNaN(parsedData.startWordCooldownDuration)) {
      startWordCooldownDuration = parsedData.startWordCooldownDuration;
    }
  });
}

// Beim Start des Bots die Cooldown-Dauer laden

function guessLetter(channel, tags, message) {
  if (!gameRunning) {
    client.say(channel, 'Nanana nicht so voreilig! 😄 Es läuft doch kein Spiel. ⛔ Mit "!start word" könnt ihr dieses starten.');
    return;
  }

  const guess = message.toLowerCase().substring(7);

  if (guess.length > 1) {
    if (guess === randomWord) {
      clearTimeout(gameTimer);
      client.say(channel, 'YES! Ihr habt das Wort "' + randomWord + '" erfolgereich erraten. ✅ Sehr nice! 😎');
      gameRunning = false;
    } else {
      client.say(channel, "Schade! :( Das geratene Wort ist nicht korrekt. Versucht es nochmal!");
    }
  } else {
    if (guessedLetters.has(guess)) {
      client.say(channel, "Diesen Buchstaben habt ihr bereits geraten. 😉");
    } else {
      if (randomWord.includes(guess)) {
        guessedLetters.add(guess);
        displayWord(channel);
        if (isWordGuessed()) {
          clearTimeout(gameTimer);
          client.say(channel, 'Sehr nice! 😎 Ihr habt das Wort "' + randomWord + '" erfolgereich erraten. ✅ Gut gemacht! 👍');
          gameRunning = false;
        }
      } else {
        client.say(channel, 'Schade! :( Der Buchstabe "' + guess + '" ist nicht im Wort enthalten. ❌ Versucht es nochmal!');
      }
    }
  }
}

function wordCommand(channel, tags) {
  const message = `---> Verfügbare Befehle: --- !start word - Startet ein neues Spiel. ✅ --- !stop word - Beendet das aktuelle Spiel. ❌ --- !guess [Buchstabe] - Rate einen Buchstaben. --- !kat - Zeigt dir die aktuelle Kategorie an. --- !kategorie (standard, technik, essen, tiere, stadt) - Kategorie ändern, !tipp - einen Tipp erhalten | ${tags.username} |`;
  client.say(channel, message);
}

function showCategories(channel, tags) {
  client.say(channel, "Verfügbare Kategorien: " + Object.keys(categories).join(", ") + ` | ${tags.username} |`);
}

function showCurrentCategory(channel, tags) {
  if (selectedCategory) {
    client.say(channel, "Die aktuelle Kategorie ist: " + selectedCategory + ` | ${tags.username} |`);
  }
}

//change Category function
function changeCategory(channel, tags, message) {
  if (gameRunning) {
    client.say(channel, `Da will wohl jemand das Spiel sabotieren?! Kappa Die Kategorie kannst du nicht während eines laufenden Spiels ändern. | ${tags.username} |`);
    return;
  }

  const selectedCategoryName = message.toLowerCase().substring(11);

  if (Object.keys(categories).includes(selectedCategoryName)) {
    selectedCategory = selectedCategoryName;
    client.say(channel, "Die Kategorie wurde auf " + selectedCategory + " geändert! ✅");
  } else {
    client.say(channel, "Ungültige Kategorie! ⛔");
  }
}

// Function to display the word with placeholders for letters not guessed
function displayWord(channel) {
  let displayedWord = "";

  for (let i = 0; i < randomWord.length; i++) {
    const letter = randomWord[i];

    if (guessedLetters.has(letter)) {
      displayedWord += letter + " ";
    } else {
      displayedWord += "_ ";
    }
  }

  client.say(channel, displayedWord);
}

// Function to check if the entire word has been guessed
function isWordGuessed() {
  const lowerCaseRandomWord = randomWord.toLowerCase();
  for (let i = 0; i < lowerCaseRandomWord.length; i++) {
    if (!guessedLetters.has(lowerCaseRandomWord[i])) {
      return false;
    }
  }
  return true;
}

function getWordList() {
  const categoryWords = categories[selectedCategory];
  return categoryWords.map((word) => word.toLowerCase()); // Alle Wörter in Kleinbuchstaben umwandeln
}

function provideTip(channel, tags, client) {
  if (!gameRunning) {
    client.say(channel, `Nanana nicht so voreilig! 😄 Es läuft doch kein Spiel. ⛔ Mit "!start word" kannst du dieses starten. || ${tags.username} ||`);
    return;
  }

  if (tipCount > 0) {
    const unrevealedLetters = Array.from(
      new Set(
        randomWord.split("").filter((letter) => !guessedLetters.has(letter))
      )
    );
    const randomUnrevealedLetter =
      unrevealedLetters[Math.floor(Math.random() * unrevealedLetters.length)];
    client.say(channel, `Tipp: Ein Buchstabe im Wort ist "${randomUnrevealedLetter}" (!guess <buchstabe> zum eintragen) || ${tags.username} ||`);
    tipCount--;

    client.say(channel, `Verbleibende Tipps: ${tipCount} ⚠️`);
  } else {
    client.say(channel, `Ihr habt alle Tipps verballert! Super gemacht.... Kappa`);
  }
}

function setGameDuration(channel, tags, message) {
  const newDuation = parseInt(message.toLowerCase().substring(10));

  if (!isNaN(newDuation) && newDuation > 0) {
    gameDuration = newDuation * 1000;
    saveGameDuration(gameDuration);
    client.say(channel, `Die Spieldauer wurde auf ${newDuation} Sekunden geändert. ✅`);
  } else {
    client.say(channel, "Ungültige Eingabe! ⛔ Bitte gib eine positive Zahl ein.");
  }
}

function showGameDuration(channel) {
  const durationSeconds = gameDuration / 1000;
  client.say(channel, `Die aktuelle Spieldauer beträgt ${durationSeconds} Sekunden.`);
}

function saveGameDuration(duration) {
  const data = JSON.stringify({ gameDuration: duration });
  fs.writeFile("./data/game_duration_config.json", data, (err) => {
    if (err) {
      console.error("Fehler beim Speichern der Spieldauer. ⚠️:", err);
    }
  });
}

function loadGameDuration() {
  fs.readFile("./data/game_duration_config.json", (err, data) => {
      if (err) {
          console.error("Fehler beim Lesen der Spieldauer-Konfiguration:", err);
          return;
      }
      const parsedData = JSON.parse(data);
      if (!isNaN(parsedData.gameDuration)) {
          gameDuration = parsedData.gameDuration;
      }
  });
}
client.connect().catch(console.error);
loadCooldownDuration();
loadGameDuration();
