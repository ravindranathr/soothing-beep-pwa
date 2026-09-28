/**
 * ZenPulse — Mindful Interval Chime PWA
 * Features: Web Audio API soothing synthesizers, drift-free timing,
 * Screen WakeLock, Background Audio Keepalive, and PWA installation.
 */

// State Management
const state = {
  isRunning: false,
  intervalSeconds: 10,
  timeRemaining: 10.0,
  lastTimestamp: null,
  activePreset: 'tibetan',
  volume: 0.8,
  isMuted: false,
  wakeLockEnabled: true,
  breathGuideEnabled: true,
  beepCount: 0,
  sessionSeconds: 0,
  wakeLockSentinel: null,
  deferredPrompt: null
};

// Preset Configurations
const SOUND_PRESETS = {
  tibetan: {
    name: 'Tibetan Singing Bowl',
    play: (ctx, outNode, vol) => {
      // 432Hz fundamental with warm overtone stack and chorus shimmer
      const now = ctx.currentTime;
      const baseFreq = 432;
      const harmonics = [
        { freq: baseFreq, gain: 0.65, decay: 1.8 },
        { freq: baseFreq * 2 + 0.5, gain: 0.25, decay: 1.4 },
        { freq: baseFreq * 3 - 0.5, gain: 0.15, decay: 1.0 },
        { freq: baseFreq * 4.2, gain: 0.08, decay: 0.7 }
      ];

      // Master tone gain with soft attack
      const presetGain = ctx.createGain();
      presetGain.gain.setValueAtTime(0.0001, now);
      presetGain.gain.exponentialRampToValueAtTime(vol * 0.85, now + 0.03);

      // Lowpass filter for warm acoustic character
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1800, now);
      filter.frequency.exponentialRampToValueAtTime(400, now + 1.8);

      harmonics.forEach(h => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(h.freq, now);

        g.gain.setValueAtTime(h.gain, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + h.decay);

        osc.connect(g);
        g.connect(filter);

        osc.start(now);
        osc.stop(now + h.decay + 0.1);
      });

      filter.connect(presetGain);
      presetGain.connect(outNode);
    }
  },

  zenchime: {
    name: 'Zen Chime (528Hz)',
    play: (ctx, outNode, vol) => {
      // 528Hz Solfeggio crystalline chime
      const now = ctx.currentTime;
      const baseFreq = 528;

      const presetGain = ctx.createGain();
      presetGain.gain.setValueAtTime(0.0001, now);
      presetGain.gain.exponentialRampToValueAtTime(vol * 0.9, now + 0.02);

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      const gain2 = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(baseFreq, now);
      gain1.gain.setValueAtTime(0.7, now);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(baseFreq * 2.005, now);
      gain2.gain.setValueAtTime(0.3, now);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

      osc1.connect(gain1);
      osc2.connect(gain2);
      gain1.connect(presetGain);
      gain2.connect(presetGain);
      presetGain.connect(outNode);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.6);
      osc2.stop(now + 1.3);
    }
  },

  ambient: {
    name: 'Soft Ambient Sine',
    play: (ctx, outNode, vol) => {
      // Pure smooth calming sine ping
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(436, now + 0.9);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(vol * 0.75, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);

      osc.connect(gain);
      gain.connect(outNode);

      osc.start(now);
      osc.stop(now + 1.0);
    }
  },

  forest: {
    name: 'Forest Cascade',
    play: (ctx, outNode, vol) => {
      // Two-tone peaceful wind chime (D5 -> A5)
      const now = ctx.currentTime;
      const notes = [
        { freq: 587.33, time: 0, decay: 1.2, gain: 0.6 },
        { freq: 880.00, time: 0.09, decay: 1.4, gain: 0.45 }
      ];

      notes.forEach(note => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const noteStart = now + note.time;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(note.freq, noteStart);

        g.gain.setValueAtTime(0.0001, noteStart);
        g.gain.exponentialRampToValueAtTime(vol * note.gain, noteStart + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, noteStart + note.decay);

        osc.connect(g);
        g.connect(outNode);

        osc.start(noteStart);
        osc.stop(noteStart + note.decay + 0.05);
      });
    }
  },

  deepgong: {
    name: 'Deep Mindfulness Gong',
    play: (ctx, outNode, vol) => {
      // Grounding low resonant gong with subharmonics
      const now = ctx.currentTime;
      const baseFreq = 216;

      const presetGain = ctx.createGain();
      presetGain.gain.setValueAtTime(0.0001, now);
      presetGain.gain.exponentialRampToValueAtTime(vol * 0.85, now + 0.05);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, now);
      filter.frequency.exponentialRampToValueAtTime(250, now + 2.2);

      const harmonics = [
        { freq: baseFreq, gain: 0.6, decay: 2.2 },
        { freq: baseFreq * 0.5, gain: 0.35, decay: 2.4 },
        { freq: baseFreq * 1.5, gain: 0.2, decay: 1.6 }
      ];

      harmonics.forEach(h => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(h.freq, now);

        g.gain.setValueAtTime(h.gain, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + h.decay);

        osc.connect(g);
        g.connect(filter);

        osc.start(now);
        osc.stop(now + h.decay + 0.1);
      });

      filter.connect(presetGain);
      presetGain.connect(outNode);
    }
  }
};

// Audio Engine Singleton
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.silentBufferSource = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(state.isMuted ? 0 : state.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.startKeepaliveBuffer();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Silent looping buffer keeps mobile browser audio pipelines active in background
  startKeepaliveBuffer() {
    if (!this.ctx) return;
    try {
      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
      this.silentBufferSource = this.ctx.createBufferSource();
      this.silentBufferSource.buffer = buffer;
      this.silentBufferSource.loop = true;

      const silentGain = this.ctx.createGain();
      silentGain.gain.value = 0.00001; // Inaudible
      this.silentBufferSource.connect(silentGain);
      silentGain.connect(this.ctx.destination);
      this.silentBufferSource.start();
    } catch (e) {
      console.warn('Keepalive buffer failed:', e);
    }
  }

  setVolume(vol, isMuted) {
    if (!this.masterGain || !this.ctx) return;
    const targetVol = isMuted ? 0 : vol;
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.ctx.currentTime);
    this.masterGain.gain.linearRampToValueAtTime(targetVol, this.ctx.currentTime + 0.05);
  }

  playChime(presetKey = state.activePreset) {
    this.init();
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const preset = SOUND_PRESETS[presetKey] || SOUND_PRESETS.tibetan;
    const effectiveVol = state.isMuted ? 0 : state.volume;
    preset.play(this.ctx, this.masterGain, effectiveVol);
  }
}

const audioEngine = new AudioEngine();

// DOM Element References
const elements = {
  toggleBtn: document.getElementById('toggleBtn'),
  toggleText: document.getElementById('toggleText'),
  playIcon: document.getElementById('playIcon'),
  pauseIcon: document.getElementById('pauseIcon'),
  previewBtn: document.getElementById('previewBtn'),
  timeDisplay: document.getElementById('timeDisplay'),
  statusBadge: document.getElementById('statusBadge'),
  intervalNote: document.getElementById('intervalNote'),
  intervalValueLabel: document.getElementById('intervalValueLabel'),
  progressTrack: document.getElementById('progressTrack'),
  rippleWrapper: document.getElementById('rippleWrapper'),
  visualizer: document.getElementById('visualizer'),
  breathGuide: document.getElementById('breathGuide'),
  presetChips: document.querySelectorAll('.chip'),
  intervalSlider: document.getElementById('intervalSlider'),
  soundCards: document.querySelectorAll('.sound-card'),
  soundPresetName: document.getElementById('soundPresetName'),
  volumeSlider: document.getElementById('volumeSlider'),
  volumeLabel: document.getElementById('volumeLabel'),
  muteBtn: document.getElementById('muteBtn'),
  volumeIcon: document.getElementById('volumeIcon'),
  muteIcon: document.getElementById('muteIcon'),
  wakeLockToggle: document.getElementById('wakeLockToggle'),
  breathGuideToggle: document.getElementById('breathGuideToggle'),
  beepCount: document.getElementById('beepCount'),
  sessionDuration: document.getElementById('sessionDuration'),
  resetStatsBtn: document.getElementById('resetStatsBtn'),
  installBtn: document.getElementById('installBtn')
};

// Progress Ring Configuration
const RING_RADIUS = 120;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS; // ~753.98
elements.progressTrack.style.strokeDasharray = `${CIRCUMFERENCE}`;
elements.progressTrack.style.strokeDashoffset = '0';

// Inject SVG Gradient dynamically for glowing progress ring
function injectRingGradient() {
  const svg = document.querySelector('.progress-ring');
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399" />
      <stop offset="50%" stop-color="#10b981" />
      <stop offset="100%" stop-color="#06b6d4" />
    </linearGradient>
  `;
  svg.prepend(defs);
}
injectRingGradient();

// Format time utility
function formatSeconds(secs) {
  return secs.toFixed(1);
}

function formatMinutes(totalSecs) {
  const mins = Math.floor(totalSecs / 60);
  const remainingSecs = Math.floor(totalSecs % 60);
  return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
}

// Visual Effects
function triggerRipple() {
  const ripple = document.createElement('div');
  ripple.className = 'ripple-ring';
  elements.rippleWrapper.appendChild(ripple);
  setTimeout(() => ripple.remove(), 1600);

  // Bounce visualizer
  elements.visualizer.classList.add('animating');
  setTimeout(() => elements.visualizer.classList.remove('animating'), 1400);
}

// Update UI Functions
function updateDisplay() {
  elements.timeDisplay.innerHTML = `${formatSeconds(state.timeRemaining)}<span class="unit">s</span>`;

  // Circular progress: remaining / interval
  const fraction = Math.max(0, Math.min(1, state.timeRemaining / state.intervalSeconds));
  const offset = CIRCUMFERENCE * (1 - fraction);
  elements.progressTrack.style.strokeDashoffset = `${offset}`;

  // Breathing guide updates
  if (state.breathGuideEnabled && state.isRunning) {
    if (fraction > 0.5) {
      elements.breathGuide.textContent = 'Inhale slowly...';
      elements.breathGuide.style.color = '#34d399';
    } else {
      elements.breathGuide.textContent = 'Exhale gently...';
      elements.breathGuide.style.color = '#06b6d4';
    }
  } else {
    elements.breathGuide.textContent = state.isRunning ? 'Mindful Focus' : 'Ready to start';
    elements.breathGuide.style.color = '#94a3b8';
  }
}

function updateInterval(newSeconds) {
  state.intervalSeconds = Number(newSeconds);
  state.timeRemaining = state.intervalSeconds;

  elements.intervalNote.textContent = `Interval: ${state.intervalSeconds}s`;
  elements.intervalValueLabel.textContent = `${state.intervalSeconds} second${state.intervalSeconds > 1 ? 's' : ''}`;
  elements.intervalSlider.value = state.intervalSeconds;

  // Update chips active state
  elements.presetChips.forEach(chip => {
    const val = Number(chip.getAttribute('data-seconds'));
    chip.classList.toggle('active', val === state.intervalSeconds);
  });

  updateDisplay();
}

// Timer Loop using requestAnimationFrame + timestamp delta
function timerLoop(currentTimestamp) {
  if (!state.isRunning) return;

  if (!state.lastTimestamp) {
    state.lastTimestamp = currentTimestamp;
  }

  const delta = (currentTimestamp - state.lastTimestamp) / 1000;
  state.lastTimestamp = currentTimestamp;

  state.timeRemaining -= delta;

  // Interval reached!
  if (state.timeRemaining <= 0) {
    audioEngine.playChime();
    triggerRipple();
    state.beepCount += 1;
    elements.beepCount.textContent = state.beepCount;

    // Reset countdown
    state.timeRemaining = state.intervalSeconds;
  }

  updateDisplay();
  requestAnimationFrame(timerLoop);
}

// 1-Second ticker for session duration
let sessionTimerInterval = null;
function startSessionClock() {
  if (sessionTimerInterval) clearInterval(sessionTimerInterval);
  sessionTimerInterval = setInterval(() => {
    if (state.isRunning) {
      state.sessionSeconds += 1;
      elements.sessionDuration.textContent = formatMinutes(state.sessionSeconds);
    }
  }, 1000);
}

// Start / Pause Controls
function startTimer() {
  audioEngine.init();
  state.isRunning = true;
  state.lastTimestamp = null;

  elements.toggleBtn.classList.add('running');
  elements.toggleText.textContent = 'Pause';
  elements.playIcon.classList.add('hidden');
  elements.pauseIcon.classList.remove('hidden');

  elements.statusBadge.classList.add('active');
  elements.statusBadge.textContent = 'Chiming every ' + state.intervalSeconds + 's';

  requestWakeLock();
  startSessionClock();
  requestAnimationFrame(timerLoop);
}

function pauseTimer() {
  state.isRunning = false;
  elements.toggleBtn.classList.remove('running');
  elements.toggleText.textContent = 'Resume';
  elements.playIcon.classList.remove('hidden');
  elements.pauseIcon.classList.add('hidden');

  elements.statusBadge.classList.remove('active');
  elements.statusBadge.textContent = 'Paused';

  releaseWakeLock();
  updateDisplay();
}

function toggleTimer() {
  if (state.isRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
}

// Screen Wake Lock API
async function requestWakeLock() {
  if (!state.wakeLockEnabled || !('wakeLock' in navigator)) return;
  try {
    state.wakeLockSentinel = await navigator.wakeLock.request('screen');
    state.wakeLockSentinel.addEventListener('release', () => {
      state.wakeLockSentinel = null;
    });
  } catch (err) {
    console.log('WakeLock not granted or supported:', err);
  }
}

function releaseWakeLock() {
  if (state.wakeLockSentinel) {
    state.wakeLockSentinel.release().catch(() => {});
    state.wakeLockSentinel = null;
  }
}

// Re-request wake lock when returning to tab
document.addEventListener('visibilitychange', () => {
  if (state.isRunning && document.visibilityState === 'visible') {
    requestWakeLock();
    // Resume audio context if suspended while tab was asleep
    if (audioEngine.ctx && audioEngine.ctx.state === 'suspended') {
      audioEngine.ctx.resume();
    }
  }
});

// Event Listeners Setup
function initEventListeners() {
  // Primary buttons
  elements.toggleBtn.addEventListener('click', toggleTimer);

  elements.previewBtn.addEventListener('click', () => {
    audioEngine.playChime();
    triggerRipple();
  });

  // Interval chips
  elements.presetChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const sec = Number(chip.getAttribute('data-seconds'));
      updateInterval(sec);
    });
  });

  // Interval Slider
  elements.intervalSlider.addEventListener('input', (e) => {
    updateInterval(Number(e.target.value));
  });

  // Sound preset selection
  elements.soundCards.forEach(card => {
    card.addEventListener('click', () => {
      const presetKey = card.getAttribute('data-preset');
      state.activePreset = presetKey;

      elements.soundCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      const presetInfo = SOUND_PRESETS[presetKey];
      if (presetInfo) {
        elements.soundPresetName.textContent = presetInfo.name;
        audioEngine.playChime(presetKey);
        triggerRipple();
      }
    });
  });

  // Volume slider
  elements.volumeSlider.addEventListener('input', (e) => {
    state.volume = parseFloat(e.target.value);
    elements.volumeLabel.textContent = `${Math.round(state.volume * 100)}%`;
    if (state.isMuted && state.volume > 0) {
      state.isMuted = false;
      elements.volumeIcon.classList.remove('hidden');
      elements.muteIcon.classList.add('hidden');
    }
    audioEngine.setVolume(state.volume, state.isMuted);
  });

  // Mute button
  elements.muteBtn.addEventListener('click', () => {
    state.isMuted = !state.isMuted;
    elements.volumeIcon.classList.toggle('hidden', state.isMuted);
    elements.muteIcon.classList.toggle('hidden', !state.isMuted);
    audioEngine.setVolume(state.volume, state.isMuted);
  });

  // Toggles
  elements.wakeLockToggle.addEventListener('change', (e) => {
    state.wakeLockEnabled = e.target.checked;
    if (state.isRunning) {
      if (state.wakeLockEnabled) requestWakeLock();
      else releaseWakeLock();
    }
  });

  elements.breathGuideToggle.addEventListener('change', (e) => {
    state.breathGuideEnabled = e.target.checked;
    elements.breathGuide.style.display = state.breathGuideEnabled ? 'block' : 'none';
  });

  // Reset Stats
  elements.resetStatsBtn.addEventListener('click', () => {
    state.beepCount = 0;
    state.sessionSeconds = 0;
    elements.beepCount.textContent = '0';
    elements.sessionDuration.textContent = '00:00';
  });

  // Keyboard shortcuts: Space for Start/Pause, 'T' for Test chime
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
    if (e.code === 'Space') {
      e.preventDefault();
      toggleTimer();
    } else if (e.key === 't' || e.key === 'T') {
      e.preventDefault();
      audioEngine.playChime();
      triggerRipple();
    }
  });

  // PWA Install Prompt handling
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredPrompt = e;
    elements.installBtn.classList.remove('hidden');
  });

  elements.installBtn.addEventListener('click', async () => {
    if (!state.deferredPrompt) return;
    state.deferredPrompt.prompt();
    const { outcome } = await state.deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      elements.installBtn.classList.add('hidden');
    }
    state.deferredPrompt = null;
  });

  window.addEventListener('appinstalled', () => {
    elements.installBtn.classList.add('hidden');
  });
}

// Service Worker Registration for Offline PWA on GitHub Pages
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => console.log('ZenPulse ServiceWorker registered:', reg.scope))
        .catch((err) => console.log('ServiceWorker registration failed:', err));
    });
  }
}

// Initialization
function init() {
  updateInterval(10);
  initEventListeners();
  registerServiceWorker();
}

document.addEventListener('DOMContentLoaded', init);
