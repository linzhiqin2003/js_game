// ============================================================
// GLOBAL VARIABLES (shared across all modules)
// ============================================================

// PIXI Application
let app;
let screenW = 0, screenH = 0;

// Scene layers (assigned in init)
let worldContainer, skyGfx, bridgeGfx, entityGfx, effectGfx, particleGfx;
let labelContainer, vignetteSprite, screenFlashGfx;
let uiContainer, hudBgGfx, scoreText, squadText, waveText;
let weaponHudGfx, weaponHudText, weaponHudTimer;
let skillHudGfx, skillHudText;
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

// Monster sprites (派大星 = normal type 0/2, 小奶龙 = normal type 1, 大奶龙 = boss, 火焰奶龙 = elite type 3)
let normalMonsterFrames = [];
let xiaoNaiLongFrames = [];
let bossFrames = [];
let fireEnemyFrames = [];
let monsterSpritesLoaded = false;

// Audio
let audioCtx;

// Game state
let game = null;

// Pools
let labelPool = [], labelPoolIdx = 0;

// Input
const keys = {};

// Coin & Gem HUD
let coinHudText;
let gemHudText;

// DOM references
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('startBtn');

// ============================================================
// PERSISTENT DATA (localStorage)
// ============================================================
function loadPlayerData() {
    try {
        const raw = localStorage.getItem('bridgeAssault_playerData');
        if (raw) return JSON.parse(raw);
    } catch {}
    return { coins: 0, gems: 0, weaponCharges: {}, equippedWeapon: null, talents: { damage: 0, squad: 0, fireRate: 0, aoe: 0 }, armor: 0 };
}

function savePlayerData(data) {
    localStorage.setItem('bridgeAssault_playerData', JSON.stringify(data));
}

let playerData = loadPlayerData();
// Migrate old saves
if (playerData.gems === undefined) playerData.gems = 0;
if (!playerData.talents) playerData.talents = { damage: 0, squad: 0, fireRate: 0, aoe: 0 };
if (playerData.armor === undefined) playerData.armor = 0;
// Migrate: convert old ownedWeapons (permanent) → weaponCharges (consumable)
if (!playerData.weaponCharges) {
    playerData.weaponCharges = {};
    if (playerData.ownedWeapons && playerData.ownedWeapons.length > 0) {
        for (const wk of playerData.ownedWeapons) {
            playerData.weaponCharges[wk] = 3; // 补偿旧存档：每件已购武器给3次充能
        }
    }
    delete playerData.ownedWeapons;
}
