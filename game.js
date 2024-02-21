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
  client.say(channel, `Search Word Module gestartet! 🔎 Tippe "!start word" in den Chat um das Spiel zu starten!`); // EN --> Message, when the Bot started / DE --> Nachricht, wenn der Bot gestartet ist. /
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
  } else if (message.toLowerCase().startsWith("!duration ") && (tags.mod || tags.username.toLowerCase() === channel.replace("#", ""))) {
      setGameDuration(channel, tags, message);
  } else if (message.toLowerCase() === "!duration") {
    showGameDuration(channel);
  }
});

// EN --> You can change this message whoever you like/ DE --> Du kannst diese Nachricht verändern, wie du möchtest//
function startWordGame(channel, tags) {
  tipCount = 3;
  if (gameRunning) {
    client.say(channel, "Ein Spiel läuft bereits. Bitte beendet das aktuelle Spiel, bevor ihr ein neues startet. ⚠️");
    return;
  }

  if (startWordCooldown && Date.now() - startWordCooldown < startWordCooldownDuration) {
    const remainingCooldown = Math.ceil((startWordCooldownDuration - (Date.now() - startWordCooldown)) / 60000);
    client.say(channel, "Der `!start word`-Befehl ist im Cooldown. Bitte warte noch " + remainingCooldown + " Minute(n).");
    return;
  }

  startWordCooldown = Date.now();
  randomWord = getWordList()[Math.floor(Math.random() * getWordList().length)];
  guessedLetters = new Set();
  const gameDurationSeconds = gameDuration / 1000;

  client.say(channel, `Das Spiel wurde gestartet. Das zu erratende Wort hat ${randomWord.length} Buchstaben. [${gameDurationSeconds} Sekunden Zeit!] (!guess [Buchstabe])`);
  gameRunning = true;

  gameTimer = setTimeout(() => {
    client.say(channel, "Die Zeit ist abgelaufen! Das zu erratende Wort war: \"" + randomWord + "\" Wenn ihr noch eine Runde spielen wollt, gebt \"!start word\" ein.");
    gameRunning = false;
  }, gameDuration);
}


function stopWordGame(channel, tags) {
  if (!gameRunning) {
    client.say(channel, "Es läuft kein Spiel. ⛔");
    return;
  }

  clearTimeout(gameTimer);
  client.say(channel, 'Das Spiel wurde beendet. Wenn ihr noch eine Runde spielen wollt, gebt "!start word" ein.');
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
    client.say(channel, 'Es läuft kein Spiel. ⛔ Bitte startet dies mit dem Befehl "!start word".');
    return;
  }

  const guess = message.toLowerCase().substring(7);

  if (guess.length > 1) {
    if (guess === randomWord) {
      clearTimeout(gameTimer);
      client.say(channel, 'Glückwunsch! Ihr habt das Wort "' + randomWord + '" erraten. ✅');
      gameRunning = false;
    } else {
      client.say(channel, "Das geratene Wort ist nicht korrekt. ");
    }
  } else {
    if (guessedLetters.has(guess)) {
      client.say(channel, "Diesen Buchstaben habt ihr bereits geraten.");
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
    client.say(channel, `Du kannst die Kategorie nicht ändern, während ein Spiel läuft. Gebe dazu "!stop word" in den Chat ein! | ${tags.username} |`);
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
    client.say(channel, `Es läuft kein Spiel. ⛔ Bitte startet dies mit dem Befehl "!start word". || ${tags.username} ||`);
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
    client.say(channel, `Tipp: Ein Buchstabe im Wort ist "${randomUnrevealedLetter}" || ${tags.username} ||`);
    tipCount--;

    client.say(channel, `Verbleibende Tipps: ${tipCount} ⚠️`);
  } else {
    client.say(channel, `Ihr habt keine verbleibenden Tipps. ⛔`);
  }
}

function setGameDuration(channel, tags, message) {
  const newDuation = parseInt(message.toLowerCase().substring(10));

  if (!isNaN(newDuation) && newDuation > 0) {
    gameDuration = newDuation * 1000;
    saveGameDuration(gameDuration);
    client.say(channel, `Die Spieldauer wurde auf ${newDuation} Sekunden geändert. ✅`);
  } else {
    client.say(channel, "Ungültige Eingabe! Bitte gib eine positive Zahl ein.");
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
