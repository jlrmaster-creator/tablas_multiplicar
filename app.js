const tableSelect = document.querySelector("#table-select");
const modeSelect = document.querySelector("#mode-select");
const newRoundButton = document.querySelector("#new-round");
const soundToggleButton = document.querySelector("#sound-toggle");
const scoreEl = document.querySelector("#score");
const streakEl = document.querySelector("#streak");
const levelEl = document.querySelector("#level");
const modeNameEl = document.querySelector("#mode-name");
const questionEl = document.querySelector("#question");
const feedbackEl = document.querySelector("#feedback");
const gameBoard = document.querySelector("#game-board");
const celebrationEl = document.querySelector("#celebration");
const progressListEl = document.querySelector("#progress-list");
const medalListEl = document.querySelector("#medal-list");
const resetProgressButton = document.querySelector("#reset-progress");

const storageKey = "tablas-en-juego-progress-v1";

const modeNames = {
  balloons: "Globos de respuestas",
  train: "Tren de números",
  stars: "Estrellas rápidas",
};

const medalCatalog = [
  { id: "first-win", label: "Primer acierto" },
  { id: "ten-wins", label: "10 aciertos" },
  { id: "streak-5", label: "Racha 5" },
  { id: "streak-10", label: "Racha 10" },
  { id: "table-master", label: "Tabla dominada" },
  { id: "all-tables", label: "Explorador total" },
];

const state = {
  table: 1,
  factor: 1,
  answer: 1,
  score: 0,
  streak: 0,
  locked: false,
  soundEnabled: true,
  progress: Array(11).fill(0),
  medals: [],
};

let audioContext;

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (!saved) return;
    if (Array.isArray(saved.progress)) {
      state.progress = Array.from({ length: 11 }, (_, index) => Number(saved.progress[index]) || 0);
    }
    if (Array.isArray(saved.medals)) {
      state.medals = saved.medals.filter((medal) => medalCatalog.some((item) => item.id === medal));
    }
  } catch {
    state.progress = Array(11).fill(0);
    state.medals = [];
  }
}

function saveProgress() {
  localStorage.setItem(
    storageKey,
    JSON.stringify({
      progress: state.progress,
      medals: state.medals,
    }),
  );
}

function getTotalCorrect() {
  return state.progress.reduce((total, value) => total + value, 0);
}

function awardMedal(id) {
  if (state.medals.includes(id)) return;
  state.medals.push(id);
}

function updateMedals() {
  const totalCorrect = getTotalCorrect();
  if (totalCorrect >= 1) awardMedal("first-win");
  if (totalCorrect >= 10) awardMedal("ten-wins");
  if (state.streak >= 5) awardMedal("streak-5");
  if (state.streak >= 10) awardMedal("streak-10");
  if (state.progress.some((count, index) => index > 0 && count >= 10)) awardMedal("table-master");
  if (state.progress.slice(1).every((count) => count > 0)) awardMedal("all-tables");
}

function renderProgress() {
  progressListEl.replaceChildren();

  for (let table = 1; table <= 10; table += 1) {
    const count = state.progress[table] || 0;
    const percentage = Math.min(100, count * 10);
    const countLabel = Math.min(10, count);
    const item = document.createElement("div");
    item.className = "progress-item";
    item.innerHTML = `
      <span>Tabla ${table}</span>
      <div class="progress-track" aria-hidden="true">
        <div class="progress-fill" style="width: ${percentage}%"></div>
      </div>
      <strong class="progress-count">${countLabel}/10</strong>
    `;
    progressListEl.append(item);
  }
}

function renderMedals() {
  medalListEl.replaceChildren();
  medalCatalog.forEach((medal) => {
    const badge = document.createElement("span");
    const unlocked = state.medals.includes(medal.id);
    badge.className = unlocked ? "medal" : "medal is-locked";
    badge.textContent = medal.label;
    badge.title = medal.label;
    medalListEl.append(badge);
  });
}

function updateProgressView() {
  updateMedals();
  renderProgress();
  renderMedals();
  saveProgress();
}

const randomTableOption = document.createElement("option");
randomTableOption.value = "random";
randomTableOption.textContent = "Aleatorio: tablas 1-10";
tableSelect.append(randomTableOption);

for (let number = 1; number <= 10; number += 1) {
  const option = document.createElement("option");
  option.value = number;
  option.textContent = `Tabla del ${number}`;
  tableSelect.append(option);
}

tableSelect.value = "2";
state.table = 2;

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(values) {
  return values
    .map((value) => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map((item) => item.value);
}

function makeOptions(answer) {
  const options = new Set([answer]);
  while (options.size < 4) {
    const offset = randomBetween(-10, 10);
    const candidate = Math.max(1, answer + offset);
    if (candidate !== answer) options.add(candidate);
  }
  return shuffle([...options]);
}

function setLevel() {
  if (state.score >= 180) levelEl.textContent = "Maestro";
  else if (state.score >= 90) levelEl.textContent = "Aventurero";
  else levelEl.textContent = "Explorador";
}

function setQuestion() {
  state.table = tableSelect.value === "random" ? randomBetween(1, 10) : Number(tableSelect.value);
  state.factor = randomBetween(1, 10);
  state.answer = state.table * state.factor;
  state.locked = false;
  questionEl.textContent = `${state.table} × ${state.factor} = ?`;
  modeNameEl.textContent = modeNames[modeSelect.value];
  feedbackEl.textContent = "Elige la respuesta correcta.";
}

function updateStatus() {
  scoreEl.textContent = state.score;
  streakEl.textContent = state.streak;
  setLevel();
}

function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext) audioContext = new AudioContextClass();
  return audioContext;
}

function playTone(frequency, startTime, duration, volume) {
  const context = getAudioContext();
  if (!context || !state.soundEnabled) return;

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startTime);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.03);
}

function playCorrectSound() {
  const context = getAudioContext();
  if (!context || !state.soundEnabled) return;
  const now = context.currentTime;
  playTone(523.25, now, 0.16, 0.16);
  playTone(659.25, now + 0.09, 0.16, 0.14);
  playTone(783.99, now + 0.18, 0.22, 0.12);
}

function playWrongSound() {
  const context = getAudioContext();
  if (!context || !state.soundEnabled) return;
  const now = context.currentTime;
  playTone(220, now, 0.18, 0.13);
  playTone(164.81, now + 0.12, 0.22, 0.11);
}

function updateSoundToggle() {
  soundToggleButton.setAttribute("aria-pressed", String(state.soundEnabled));
  soundToggleButton.textContent = state.soundEnabled ? "Sonido: si" : "Sonido: no";
}

function showCelebration() {
  celebrationEl.hidden = false;
  window.setTimeout(() => {
    celebrationEl.hidden = true;
  }, 2300);
}

function handleAnswer(value, button) {
  if (state.locked) return;
  state.locked = true;

  const isCorrect = value === state.answer;
  button.classList.add(isCorrect ? "is-correct" : "is-wrong");

  if (isCorrect) {
    playCorrectSound();
    state.progress[state.table] += 1;
    state.score += 10 + Math.min(state.streak, 5) * 2;
    state.streak += 1;
    feedbackEl.textContent = "Muy bien. Has encontrado la respuesta.";
    if (state.streak % 10 === 0) showCelebration();
  } else {
    playWrongSound();
    state.streak = 0;
    feedbackEl.textContent = `Casi. ${state.table} × ${state.factor} es ${state.answer}.`;
  }

  updateStatus();
  updateProgressView();
  window.setTimeout(renderRound, 950);
}

function makeAnswerButton(value, className) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = value;
  button.setAttribute("aria-label", `Respuesta ${value}`);
  button.addEventListener("click", () => handleAnswer(value, button));
  return button;
}

function renderBalloons() {
  gameBoard.className = "game-board answer-grid";
  makeOptions(state.answer).forEach((value) => {
    gameBoard.append(makeAnswerButton(value, "answer-choice"));
  });
}

function renderTrain() {
  gameBoard.className = "game-board train-track";
  const options = makeOptions(state.answer);
  options.forEach((value, index) => {
    const row = document.createElement("div");
    row.className = "train-row";

    const engine = document.createElement("div");
    engine.className = "train-engine";
    engine.textContent = index + 1;

    const wagon = makeAnswerButton(value, "wagon");
    row.append(engine, wagon);
    gameBoard.append(row);
  });
}

function renderStars() {
  gameBoard.className = "game-board stars-grid";
  const options = shuffle([...makeOptions(state.answer), state.answer + 10, Math.max(1, state.answer - 10)])
    .filter((value, index, list) => list.indexOf(value) === index)
    .slice(0, 6);

  if (!options.includes(state.answer)) {
    options[randomBetween(0, options.length - 1)] = state.answer;
  }

  shuffle(options).forEach((value) => {
    gameBoard.append(makeAnswerButton(value, "star-button"));
  });
}

function renderRound() {
  gameBoard.replaceChildren();
  setQuestion();

  if (modeSelect.value === "train") renderTrain();
  else if (modeSelect.value === "stars") renderStars();
  else renderBalloons();
}

function resetGame() {
  state.score = 0;
  state.streak = 0;
  updateStatus();
  renderRound();
}

tableSelect.addEventListener("change", resetGame);
modeSelect.addEventListener("change", resetGame);
newRoundButton.addEventListener("click", resetGame);
soundToggleButton.addEventListener("click", () => {
  state.soundEnabled = !state.soundEnabled;
  updateSoundToggle();
});
resetProgressButton.addEventListener("click", () => {
  state.progress = Array(11).fill(0);
  state.medals = [];
  updateProgressView();
});

loadProgress();
updateStatus();
updateSoundToggle();
updateProgressView();
renderRound();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}
