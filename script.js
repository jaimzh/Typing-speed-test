// DOM Elements
const startBtn = document.getElementById("start-btn");
const startOverlay = document.getElementById("start-overlay");
const resultsOverlay = document.getElementById("results-overlay");
const passageDisplay = document.getElementById("passage-display");
const retryBtn = document.getElementById("retry-btn");

// Control Elements (Desktop and Mobile)
const desktopDifficultyBtns = document.querySelectorAll(
  "#difficulty-toggles .btn-toggle",
);
const desktopModeBtns = document.querySelectorAll("#mode-toggles .btn-toggle");

const mobileDifficultyTrigger = document.querySelector(
  "#difficulty-dropdown .dropdown-trigger",
);
const mobileDifficultyItems = document.querySelectorAll(
  "#difficulty-dropdown .dropdown-item",
);
const mobileModeTrigger = document.querySelector(
  "#mode-dropdown .dropdown-trigger",
);
const mobileModeItems = document.querySelectorAll(
  "#mode-dropdown .dropdown-item",
);

const dropdowns = document.querySelectorAll(".dropdown");

// State
let state = {
  difficulty: "hard",
  mode: "timed",
  testStarted: false,
  timerStarted: false,
  startTime: null,
  timer: 60,
  timerInterval: null,
  currentIndex: 0,
  errors: 0,
  correctChars: 0,
  totalCharsTyped: 0,
  passageText: "",
};

// PB Storage Keys
const PB_KEYS = {
  easy: "typing_test_pb_easy",
  medium: "typing_test_pb_medium",
  hard: "typing_test_pb_hard",
};

// Initialize
async function init() {
  loadPBs();
  await loadPassage();
  setupEventListeners();
  syncUI();
}

async function loadPassage() {
  try {
    const response = await fetch("data.json");
    const data = await response.json();
    const passages = data[state.difficulty];
    const randomPassage = passages[Math.floor(Math.random() * passages.length)];
    state.passageText = randomPassage.text;

    // Wrap each character in a span
    passageDisplay.innerHTML = "";
    state.passageText.split("").forEach((char, index) => {
      const span = document.createElement("span");
      span.textContent = char;
      span.classList.add("char");
      if (index === 0) span.classList.add("current");
      passageDisplay.appendChild(span);
    });

    state.currentIndex = 0;
    state.errors = 0;
    state.correctChars = 0;
    state.totalCharsTyped = 0;
  } catch (error) {
    console.error("Error loading passage:", error);
  }
}

function startTest() {
  if (state.testStarted) return;

  state.testStarted = true;
  startOverlay.classList.add("hidden");
  passageDisplay.classList.remove("blur");

  window.focus();
}

function startTimer() {
  state.timerStarted = true;
  state.startTime = Date.now();

  state.timerInterval = setInterval(() => {
    state.timer--;
    document.getElementById("current-time").textContent =
      `0:${state.timer < 10 ? "0" : ""}${state.timer}`;

    if (state.timer <= 0) {
      endTest();
    }
    updateMetrics();
  }, 1000);
}

function updateMetrics() {
  const timeElapsed = (Date.now() - state.startTime) / 1000 / 60; // in minutes
  const wpm =
    timeElapsed > 0 ? Math.round(state.correctChars / 5 / timeElapsed) : 0;

  const accuracy =
    state.totalCharsTyped > 0
      ? Math.round((state.correctChars / state.totalCharsTyped) * 100)
      : 100;

  document.getElementById("current-wpm").textContent = wpm;
  document.getElementById("current-accuracy").textContent = `${accuracy}%`;
}

function endTest() {
  clearInterval(state.timerInterval);
  state.testStarted = false;
  state.timerStarted = false;

  const finalWpmVal = parseInt(
    document.getElementById("current-wpm").textContent,
  );
  const finalAccuracyVal = parseInt(
    document.getElementById("current-accuracy").textContent,
  );
  const finalAccuracyText =
    document.getElementById("current-accuracy").textContent;

  document.getElementById("final-wpm").textContent = finalWpmVal;
  document.getElementById("final-accuracy").textContent = finalAccuracyText;
  document.getElementById("final-characters").innerHTML =
    `${state.correctChars}<span class="slash">/${state.errors}</span>`;

  // Color accuracy dynamically (Perfect 100% is green, else red as per design)
  const accuracyItem = document.getElementById("accuracy-item");
  if (finalAccuracyVal === 100) {
    accuracyItem.className = "res-item accent-green";
  } else {
    accuracyItem.className = "res-item accent-red";
  }

  // Color characters (Correct count is always green, errors handled by .slash class in HTML)
  const charactersItem = document.getElementById("characters-item");
  charactersItem.className = "res-item accent-green";

  // UI elements for results state
  const resultTitle = document.getElementById("result-title");
  const resultSubtext = document.getElementById("result-subtext");
  const titleIcon = document.getElementById("title-icon");
  const resultIconContainer = document.getElementById("result-icon");
  const retryBtnText = document.getElementById("retry-btn-text");
  const confettiContainer = document.getElementById("confetti-container");

  const pbKey = PB_KEYS[state.difficulty];
  const previousPB = parseInt(localStorage.getItem(pbKey)) || 0;
  const isFirstTest = !localStorage.getItem(`has_tested_${state.difficulty}`);

  if (isFirstTest) {
    // Baseline Established
    resultTitle.textContent = "Baseline Established!";
    resultSubtext.textContent =
      "You've set the bar. Now the real challenge begins—time to beat it.";
    titleIcon.src = "./assets/images/icon-completed.svg";
    resultIconContainer.className = "result-icon";
    retryBtnText.textContent = "Beat This Score";
    localStorage.setItem(`has_tested_${state.difficulty}`, "true");
    resultsOverlay.classList.remove("show-confetti");
  } else if (finalWpmVal > previousPB) {
    // High Score Smashed
    resultTitle.textContent = "High Score Smashed!";
    resultSubtext.textContent =
      "You're getting faster. That was incredible typing.";
    titleIcon.src = "./assets/images/icon-new-pb.svg";
    resultIconContainer.className = "result-icon high-score";
    retryBtnText.textContent = "Beat This Score";
    resultsOverlay.classList.add("show-confetti");
    createConfetti();
  } else {
    // Test Complete
    resultTitle.textContent = "Test Complete!";
    resultSubtext.textContent =
      "Solid run. Keep pushing to beat your high score.";
    titleIcon.src = "./assets/images/icon-completed.svg";
    resultIconContainer.className = "result-icon";
    retryBtnText.textContent = "Go Again";
    resultsOverlay.classList.remove("show-confetti");
  }

  document.querySelector(".dashboard").classList.add("hidden");
  document.getElementById("passage-display").classList.add("hidden");
  resultsOverlay.classList.remove("hidden");
  saveScore(finalWpmVal);
  renderHighScores();
  checkNewPB(finalWpmVal);
}

function saveScore(wpm) {
  const scoresKey = `scores_${state.difficulty}`;
  const scores = JSON.parse(localStorage.getItem(scoresKey)) || [];
  const newScore = {
    wpm,
    date: new Date().toLocaleDateString(),
    id: Date.now(),
  };
  scores.push(newScore);
  scores.sort((a, b) => b.wpm - a.wpm);
  const topScores = scores.slice(0, 5);
  localStorage.setItem(scoresKey, JSON.stringify(topScores));
}

function renderHighScores() {
  const scoresKey = `scores_${state.difficulty}`;
  const scores = JSON.parse(localStorage.getItem(scoresKey)) || [];
  const list = document.getElementById("high-scores-list");
  const section = document.getElementById("high-scores-section");

  if (scores.length > 0) {
    section.classList.remove("hidden");
    list.innerHTML = scores
      .map(
        (s, i) => `
      <li class="score-entry">
        <span class="score-rank">#${i + 1}</span>
        <span class="score-wpm">${s.wpm} WPM</span>
        <span class="score-date">${s.date}</span>
      </li>
    `,
      )
      .join("");
  } else {
    section.classList.add("hidden");
  }
}

function createConfetti() {
  const container = document.getElementById("confetti-container");
  container.innerHTML = "";
  const colors = ["#3b82f6", "#ef4444", "#22c55e", "#eab308", "#ffffff"];

  for (let i = 0; i < 100; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left = Math.random() * 100 + "vw";
    piece.style.backgroundColor =
      colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = Math.random() * 2 + 1 + "s";
    piece.style.animationDelay = Math.random() * 0.5 + "s";
    piece.style.width = Math.random() * 10 + 5 + "px";
    piece.style.height = piece.style.width;
    container.appendChild(piece);
  }
}

function checkNewPB(wpm) {
  const currentPB = localStorage.getItem(PB_KEYS[state.difficulty]) || 0;
  if (wpm > currentPB) {
    localStorage.setItem(PB_KEYS[state.difficulty], wpm);
    loadPBs();
  }
}

function loadPBs() {
  const pb = localStorage.getItem(PB_KEYS[state.difficulty]) || 0;
  const display = document.getElementById("pb-wpm");
  const displayMobile = document.getElementById("pb-wpm-mobile");
  if (display) display.textContent = `${pb} WPM`;
  if (displayMobile) displayMobile.textContent = `${pb} WPM`;
}

function syncUI() {
  desktopDifficultyBtns.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.value === state.difficulty);
  });
  desktopModeBtns.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.value === state.mode);
  });

  mobileDifficultyTrigger.textContent =
    state.difficulty.charAt(0).toUpperCase() + state.difficulty.slice(1);
  mobileDifficultyItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.value === state.difficulty);
  });

  const modeLabel = state.mode === "timed" ? "Timed (60s)" : "Passage";
  mobileModeTrigger.textContent = modeLabel;
  mobileModeItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.value === state.mode);
  });
}

function resetTest() {
  clearInterval(state.timerInterval);
  state.testStarted = false;
  state.timerStarted = false;
  state.timer = 60;
  state.currentIndex = 0;
  state.errors = 0;
  state.correctChars = 0;
  state.totalCharsTyped = 0;

  document.getElementById("current-time").textContent = "0:60";
  document.getElementById("current-wpm").textContent = "0";
  document.getElementById("current-accuracy").textContent = "100%";

  resultsOverlay.classList.add("hidden");
  resultsOverlay.classList.remove("show-confetti");
  document.getElementById("confetti-container").innerHTML = "";
  document.querySelector(".dashboard").classList.remove("hidden");
  document.getElementById("passage-display").classList.remove("hidden");
  startOverlay.classList.remove("hidden");
  passageDisplay.classList.add("blur");
  loadPassage();
}

function setupEventListeners() {
  window.addEventListener("keydown", (e) => {
    if (!state.testStarted || state.timer <= 0) return;

    if (!state.timerStarted && e.key.length === 1) {
      startTimer();
    }

    const chars = passageDisplay.querySelectorAll(".char");
    const targetChar = state.passageText[state.currentIndex];

    if (e.key === "Backspace") {
      if (state.currentIndex > 0) {
        chars[state.currentIndex].classList.remove(
          "current",
          "correct",
          "incorrect",
        );
        state.currentIndex--;
        chars[state.currentIndex].classList.remove("correct", "incorrect");
        chars[state.currentIndex].classList.add("current");
      }
      return;
    }

    if (e.key.length !== 1) return;

    state.totalCharsTyped++;

    if (e.key === targetChar) {
      chars[state.currentIndex].classList.add("correct");
      state.correctChars++;
    } else {
      chars[state.currentIndex].classList.add("incorrect");
      state.errors++;
    }

    chars[state.currentIndex].classList.remove("current");
    state.currentIndex++;

    if (state.currentIndex < chars.length) {
      chars[state.currentIndex].classList.add("current");
    } else {
      endTest();
    }

    updateMetrics();
  });

  startBtn.addEventListener("click", startTest);
  passageDisplay.addEventListener("click", () => {
    if (!state.testStarted) startTest();
  });
  retryBtn.addEventListener("click", resetTest);

  desktopDifficultyBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.difficulty = btn.dataset.value;
      syncUI();
      loadPBs();
      if (!state.testStarted) loadPassage();
    });
  });

  desktopModeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.mode = btn.dataset.value;
      syncUI();
    });
  });

  dropdowns.forEach((dd) => {
    const trigger = dd.querySelector(".dropdown-trigger");
    const menu = dd.querySelector(".dropdown-menu");
    const items = dd.querySelectorAll(".dropdown-item");

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdowns.forEach((other) => {
        if (other !== dd)
          other.querySelector(".dropdown-menu").classList.remove("show");
      });
      menu.classList.toggle("show");
    });

    items.forEach((item) => {
      item.addEventListener("click", () => {
        const type = dd.id.includes("difficulty") ? "difficulty" : "mode";
        state[type] = item.dataset.value;
        syncUI();
        loadPBs();
        menu.classList.remove("show");
        if (type === "difficulty" && !state.testStarted) loadPassage();
      });
    });
  });

  document.addEventListener("click", () => {
    document
      .querySelectorAll(".dropdown-menu")
      .forEach((m) => m.classList.remove("show"));
  });
}

init();
