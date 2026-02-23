const STATION_START_ISO = "2019-11-08T19:42:00Z";
const BUFFER_WARNING_MS = 9000;

const TRACKS = [
  { time: "0:00:05", title: "Modjo - Lady (Hear Me Tonight)" },
  { time: "0:04:45", title: "Lady Gaga - Applause" },
  { time: "0:08:11", title: "All Saints - Pure Shores" },
  { time: "0:13:12", title: "Maroon 5 feat. Christina Aguilera - Moves Like Jagger" },
  { time: "0:16:32", title: "Gorillaz feat. De La Soul - Feel Good Inc." },
  { time: "0:20:28", title: "Backstreet Boys - I Want It That Way" },
  { time: "0:25:39", title: "Bobby Brown - On Our Own" },
  { time: "0:30:12", title: "Cassie - Me & U" },
  { time: "0:33:21", title: "Bronski Beat - Smalltown Boy" },
  { time: "0:38:03", title: "Moloko - The Time Is Now" },
  { time: "0:41:35", title: "The Blow Monkeys feat. Kym Mazelle - Wait" },
  { time: "0:44:49", title: "Pet Shop Boys - West End Girls" },
  { time: "0:49:23", title: "Jane Child - Don't Wanna Fall In Love" },
  { time: "0:52:42", title: "Real Life - Send Me An Angel" },
  { time: "0:57:13", title: "M.I.A. - Bad Girls" },
  { time: "1:02:01", title: "Robbie Williams & Kylie Minogue - Kids" },
  { time: "1:09:59", title: "Taylor Dayne - Tell It To My Heart" },
  { time: "1:13:24", title: "Hall & Oates - Adult Education" },
  { time: "1:18:46", title: "Jamiroquai - Alright" },
  { time: "1:22:44", title: "Wham! - Everything She Wants" },
  { time: "1:26:39", title: "Morcheeba - Tape Loop" },
  { time: "1:35:12", title: "Simply Red - Something Got Me Started" },
  { time: "1:38:53", title: "Living In A Box - Living In A Box" },
  { time: "1:42:14", title: "Mike Posner - Cooler Than Me" },
  { time: "1:45:54", title: "The Black Eyed Peas - Meet Me Halfway" },
  { time: "1:50:42", title: "Naked Eyes - Promises, Promises" },
  { time: "1:54:32", title: "Sly Fox - Let's Go All The Way" },
  { time: "2:03:49", title: "N-Joi - Anthem" },
  { time: "2:07:13", title: "Amerie - 1 Thing" },
  { time: "2:11:37", title: "Robyn feat. Kleerup - With Every Heartbeat" }
].map((track) => ({
  ...track,
  seconds: parseTimestamp(track.time)
}));

const audio = document.getElementById("radio");
const playPauseBtn = document.getElementById("playPauseBtn");
const liveBtn = document.getElementById("liveBtn");
const liveStatus = document.getElementById("liveStatus");
const liveHint = document.getElementById("liveHint");
const stationPicker = document.getElementById("stationPicker");
const trackPickerBtn = document.getElementById("trackPickerBtn");
const trackPickerValue = document.getElementById("trackPickerValue");
const trackDropdown = document.getElementById("trackDropdown");
const trackList = document.getElementById("trackList");
const nowPlaying = document.getElementById("nowPlaying");
const nextPlaying = document.getElementById("nextPlaying");
const radioShell = document.querySelector(".radio-shell");
const liveGate = document.getElementById("liveGate");
const enterLiveBtn = document.getElementById("enterLiveBtn");
const volumeSlider = document.getElementById("volumeSlider");
const volumeValue = document.getElementById("volumeValue");
const volumeMuteBtn = document.getElementById("volumeMuteBtn");
const volumeIcon = document.getElementById("volumeIcon");

const stationStartMs = new Date(STATION_START_ISO).getTime();
let bufferTimeoutId = null;
let isPickerOpen = false;
let selectedTrackIndex = -1;
let activeTrackIndex = -1;
let lastVolumeBeforeMute = 100;

init();

function init() {
  loadVolumeState();
  applyVolume(Number(volumeSlider.value), false);
  fillTrackSelect();
  bindEvents();
  if (!Number.isFinite(stationStartMs)) {
    liveHint.textContent = "Station configuration error: invalid live start date.";
  }
}

function bindEvents() {
  playPauseBtn.addEventListener("click", togglePlayPause);

  volumeSlider.addEventListener("input", (event) => {
    const volume = parseInt(event.target.value, 10);
    applyVolume(volume);
  });
  volumeMuteBtn.addEventListener("click", toggleMute);

  liveBtn.addEventListener("click", async () => {
    syncToLive();
    await startPlaybackAttempt(true);
  });

  enterLiveBtn.addEventListener("click", async () => {
    syncToLive();
    await startPlaybackAttempt(true);
  });

  trackPickerBtn.addEventListener("click", () => {
    if (isPickerOpen) {
      closeTrackPicker();
      return;
    }

    openTrackPicker(selectedTrackIndex >= 0 ? selectedTrackIndex : 0);
  });

  trackPickerBtn.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openTrackPicker(selectedTrackIndex >= 0 ? selectedTrackIndex : 0);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeTrackPicker();
    }
  });

  trackList.addEventListener("keydown", (event) => {
    if (!isPickerOpen) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveOption(Math.min(TRACKS.length - 1, activeTrackIndex + 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveOption(Math.max(0, activeTrackIndex - 1));
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setActiveOption(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setActiveOption(TRACKS.length - 1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      chooseTrack(activeTrackIndex);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeTrackPicker();
      trackPickerBtn.focus();
    }
  });

  document.addEventListener("click", (event) => {
    if (!isPickerOpen) {
      return;
    }

    const clickedInside = stationPicker.contains(event.target);
    if (!clickedInside) {
      closeTrackPicker();
    }
  });

  window.addEventListener("resize", () => {
    if (isPickerOpen) {
      updatePickerPlacement();
    }
  });

  window.addEventListener("scroll", () => {
    if (isPickerOpen) {
      updatePickerPlacement();
    }
  });

  audio.addEventListener("loadedmetadata", async () => {
    syncToLive();
    updateNowPlaying();
    await startPlaybackAttempt(true);
    updateLiveState();
  });

  audio.addEventListener("play", () => {
    playPauseBtn.textContent = "Pause";
    radioShell.classList.add("playing");
    hideGate();
    clearBufferWarning();
    liveHint.textContent = "Broadcasting live";
    updateLiveState();
    updateNowPlaying();
  });

  audio.addEventListener("pause", () => {
    playPauseBtn.textContent = "Play";
    radioShell.classList.remove("playing");
    clearBufferWarning();
    if (audio.currentTime > 0) {
      liveHint.textContent = "Broadcast paused";
    }
    updateLiveState();
  });

  audio.addEventListener("waiting", () => {
    if (!audio.paused) {
      liveHint.textContent = "Buffering stream...";
      scheduleBufferWarning();
    }
  });

  audio.addEventListener("stalled", () => {
    if (!audio.paused) {
      liveHint.textContent = "Network stalled. Reconnecting...";
      scheduleBufferWarning();
    }
  });

  audio.addEventListener("playing", () => {
    clearBufferWarning();
    liveHint.textContent = "Broadcasting live";
  });

  audio.addEventListener("timeupdate", () => {
    updateLiveState();
    updateNowPlaying();
  });

  document.addEventListener("keydown", (event) => {
    if (isPickerOpen && event.key === "Escape") {
      closeTrackPicker();
      trackPickerBtn.focus();
      return;
    }

    if (isPickerOpen) {
      return;
    }

    const tag = document.activeElement ? document.activeElement.tagName : "";
    const isFormControl = tag === "INPUT" || tag === "TEXTAREA";
    if (isFormControl) {
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();
      togglePlayPause();
      return;
    }

    if (event.key.toLowerCase() === "l") {
      event.preventDefault();
      syncToLive();
      startPlaybackAttempt(true);
    }
  });
}

async function togglePlayPause() {
  if (audio.paused) {
    await startPlaybackAttempt(false);
  } else {
    audio.pause();
  }
}

async function startPlaybackAttempt(liveAction) {
  try {
    await audio.play();
    if (liveAction) {
      setLiveBadge(true);
    }
  } catch (err) {
    showGate();
    clearBufferWarning();
    liveHint.textContent = "Autoplay blocked. Click Enter LIVE to start.";
  }
}

function syncToLive() {
  if (!Number.isFinite(audio.duration) || audio.duration <= 0 || !Number.isFinite(stationStartMs)) {
    return;
  }

  audio.currentTime = getLiveSecond(audio.duration);
  updateNowPlaying();
  updateLiveState(true);
}

function getLiveSecond(duration) {
  const elapsedSec = Math.floor((Date.now() - stationStartMs) / 1000);
  return ((elapsedSec % duration) + duration) % duration;
}

function updateLiveState(forceLive = false) {
  if (!Number.isFinite(audio.duration) || audio.duration <= 0 || !Number.isFinite(stationStartMs)) {
    setLiveBadge(false);
    return;
  }

  if (forceLive && !audio.paused) {
    setLiveBadge(true);
    return;
  }

  const liveSecond = getLiveSecond(audio.duration);
  const diff = circularDifference(audio.currentTime, liveSecond, audio.duration);
  const isLive = diff < 2 && !audio.paused;
  setLiveBadge(isLive);
}

function setLiveBadge(isLive) {
  liveStatus.dataset.live = String(isLive);
  liveStatus.textContent = isLive ? "On Air" : "Off Air";
  liveBtn.classList.toggle("is-live", isLive);
}

function updateNowPlaying() {
  if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
    nowPlaying.textContent = "Waiting for stream...";
    nextPlaying.textContent = "Next: --";
    return;
  }

  const { currentIndex, nextIndex, etaToNext } = resolveTrackPosition(audio.currentTime, audio.duration);
  const currentTrack = TRACKS[currentIndex];
  const nextTrack = TRACKS[nextIndex];

  nowPlaying.textContent = currentTrack ? currentTrack.title : "Unknown track";
  nextPlaying.textContent = nextTrack
    ? `Next: ${nextTrack.title} in ${formatClock(etaToNext)}`
    : "Next: --";
}

function resolveTrackPosition(currentTime, duration) {
  let currentIndex = TRACKS.length - 1;

  for (let i = 0; i < TRACKS.length; i += 1) {
    if (TRACKS[i].seconds <= currentTime) {
      currentIndex = i;
    } else {
      break;
    }
  }

  const nextIndex = (currentIndex + 1) % TRACKS.length;
  const nextTime = TRACKS[nextIndex].seconds;
  const etaToNext = nextTime > currentTime
    ? nextTime - currentTime
    : duration - currentTime + nextTime;

  return { currentIndex, nextIndex, etaToNext };
}

function fillTrackSelect() {
  TRACKS.forEach((track, index) => {
    const item = document.createElement("li");
    const option = document.createElement("button");
    option.type = "button";
    option.className = "track-option";
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", "false");
    option.setAttribute("id", `track-option-${index}`);
    option.dataset.index = String(index);
    option.textContent = track.title;

    option.addEventListener("click", async () => {
      await chooseTrack(index);
    });

    option.addEventListener("mouseenter", () => {
      setActiveOption(index, false);
    });

    item.append(option);
    trackList.append(item);
  });
}

function openTrackPicker(startIndex) {
  isPickerOpen = true;
  updatePickerPlacement();
  stationPicker.classList.add("is-open");
  trackDropdown.hidden = false;
  trackPickerBtn.setAttribute("aria-expanded", "true");
  setActiveOption(startIndex);
  trackList.focus({ preventScroll: true });
}

function closeTrackPicker() {
  isPickerOpen = false;
  stationPicker.classList.remove("is-open");
  stationPicker.classList.remove("drop-up");
  trackList.style.maxHeight = "";
  trackDropdown.hidden = true;
  trackPickerBtn.setAttribute("aria-expanded", "false");
  setActiveOption(-1, false);
}

function setActiveOption(index, shouldScroll = true) {
  const options = trackList.querySelectorAll(".track-option");
  activeTrackIndex = index;

  options.forEach((option) => option.classList.remove("is-active"));
  if (index < 0 || index >= options.length) {
    trackList.removeAttribute("aria-activedescendant");
    return;
  }

  const activeOption = options[index];
  activeOption.classList.add("is-active");
  trackList.setAttribute("aria-activedescendant", activeOption.id);

  if (shouldScroll) {
    activeOption.scrollIntoView({ block: "nearest" });
  }
}

async function chooseTrack(index) {
  if (index < 0 || index >= TRACKS.length) {
    return;
  }

  const track = TRACKS[index];
  selectedTrackIndex = index;
  trackPickerValue.textContent = track.title;
  markSelectedTrack();
  closeTrackPicker();
  trackPickerBtn.focus();

  audio.currentTime = track.seconds;
  updateNowPlaying();
  await startPlaybackAttempt(false);
  updateLiveState();
}

function markSelectedTrack() {
  const options = trackList.querySelectorAll(".track-option");
  options.forEach((option) => {
    option.classList.remove("is-selected");
    option.setAttribute("aria-selected", "false");
  });

  if (selectedTrackIndex < 0 || selectedTrackIndex >= options.length) {
    return;
  }

  options[selectedTrackIndex].classList.add("is-selected");
  options[selectedTrackIndex].setAttribute("aria-selected", "true");
}

function parseTimestamp(timestamp) {
  const parts = timestamp.split(":").map(Number);
  return parts.reduce((acc, value) => acc * 60 + value, 0);
}

function formatClock(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hrs > 0) {
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function circularDifference(a, b, length) {
  const raw = Math.abs(a - b);
  return Math.min(raw, length - raw);
}

function scheduleBufferWarning() {
  clearBufferWarning();
  bufferTimeoutId = window.setTimeout(() => {
    if (!audio.paused) {
      liveHint.textContent = "Stream is taking longer than usual. Check your connection.";
    }
  }, BUFFER_WARNING_MS);
}

function clearBufferWarning() {
  if (bufferTimeoutId !== null) {
    window.clearTimeout(bufferTimeoutId);
    bufferTimeoutId = null;
  }
}

function showGate() {
  liveGate.classList.remove("hidden");
  enterLiveBtn.focus();
}

function hideGate() {
  liveGate.classList.add("hidden");
}

function updatePickerPlacement() {
  const rect = stationPicker.getBoundingClientRect();
  const shellRect = radioShell.getBoundingClientRect();
  const gap = 14;
  const minListHeight = 150;
  const preferredListHeight = 210;
  const dropdownOffset = 8;

  const spaceBelow = shellRect.bottom - rect.bottom - gap - dropdownOffset;
  const spaceAbove = rect.top - shellRect.top - gap - dropdownOffset;
  const shouldDropUp = spaceBelow < minListHeight && spaceAbove > spaceBelow;

  stationPicker.classList.toggle("drop-up", shouldDropUp);

  const available = shouldDropUp ? spaceAbove : spaceBelow;
  const safeHeight = Math.max(120, Math.min(preferredListHeight, Math.floor(available)));
  trackList.style.maxHeight = `${safeHeight}px`;
}

function applyVolume(value, persist = true) {
  const safeVolume = Math.max(0, Math.min(100, Number(value) || 0));
  const isMuted = safeVolume === 0;

  audio.volume = safeVolume / 100;
  audio.muted = isMuted;
  volumeSlider.value = String(safeVolume);
  volumeValue.textContent = `${safeVolume}%`;
  volumeSlider.style.setProperty("--volume-progress", `${safeVolume}%`);
  updateVolumeIcon(safeVolume);
  volumeMuteBtn.setAttribute("aria-pressed", String(isMuted));
  volumeMuteBtn.setAttribute("aria-label", isMuted ? "Unmute audio" : "Mute audio");

  if (!isMuted) {
    lastVolumeBeforeMute = safeVolume;
  }

  if (persist) {
    saveVolumeState(safeVolume, lastVolumeBeforeMute);
  }
}

function toggleMute() {
  const currentVolume = parseInt(volumeSlider.value, 10) || 0;
  if (currentVolume === 0) {
    const restored = Math.max(1, lastVolumeBeforeMute || 60);
    applyVolume(restored);
    return;
  }

  lastVolumeBeforeMute = currentVolume;
  applyVolume(0);
}

function updateVolumeIcon(volume) {
  if (volume <= 0) {
    volumeIcon.textContent = "🔇";
    return;
  }

  if (volume < 45) {
    volumeIcon.textContent = "🔉";
    return;
  }

  volumeIcon.textContent = "🔊";
}

function loadVolumeState() {
  try {
    const savedVolume = window.localStorage.getItem("radioVolume");
    const savedLast = window.localStorage.getItem("radioVolumeLast");

    if (savedVolume !== null) {
      const parsedVolume = parseInt(savedVolume, 10);
      if (Number.isFinite(parsedVolume)) {
        volumeSlider.value = String(Math.max(0, Math.min(100, parsedVolume)));
      }
    }

    if (savedLast !== null) {
      const parsedLast = parseInt(savedLast, 10);
      if (Number.isFinite(parsedLast) && parsedLast > 0) {
        lastVolumeBeforeMute = Math.min(100, parsedLast);
      }
    }
  } catch (_error) {
    // Ignore storage access issues (private mode / blocked storage).
  }
}

function saveVolumeState(volume, lastVolume) {
  try {
    window.localStorage.setItem("radioVolume", String(volume));
    window.localStorage.setItem("radioVolumeLast", String(lastVolume));
  } catch (_error) {
    // Ignore storage access issues (private mode / blocked storage).
  }
}
