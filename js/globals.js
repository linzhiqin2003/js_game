// ============================================================
// GLOBAL VARIABLES (shared across all modules)
// ============================================================

// PIXI Application
let app;
let screenW = 0, screenH = 0;

// Scene layers (assigned in init)
let worldContainer, skyGfx, bridgeGfx, entityGfx, effectGfx, particleGfx;
let labelContainer, vignetteSprite, screenFlashGfx;
let uiContainer, scoreText, squadText, waveText;
let weaponHudGfx, weaponHudText, weaponHudTimer;
let waveBannerContainer, waveBannerText, waveBannerSub;
let comboText;
let damageNumPool = [], damageNumIdx = 0;
let bossHudContainer, bossHudGfx, bossHudNameText, bossHudHpText;
let pauseContainer, pauseGfx, pauseTitle, pauseSub, pauseHint;

// Sprite textures
let monsterTexture = null;
let monsterFrames = [];
let monsterSpritePool = [];
let monsterSpriteIdx = 0;
let monsterSpriteContainer = null;

// Audio
let audioCtx;

// Game state
let game = null;

// Pools
let labelPool = [], labelPoolIdx = 0;

// Input
const keys = {};

// DOM references
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('startBtn');
