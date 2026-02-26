// ============================================================
// CORE FUNCTIONS — game creation, projection, helpers, pools
// ============================================================

function createGame() {
    return {
        state: 'playing',
        cameraZ: 0,
        score: 0,
        wave: 1,
        squadCount: 3,
        weapon: 'pistol',
        weaponTimer: 0,
        player: { x: 0, animFrame: 0, animTimer: 0, muzzleFlash: 0 },
        enemies: [],
        bullets: [],
        gates: [],
        barrels: [],
        particles: [],
        explosions: [],
        deadBodies: [],
        shootTimer: 0,
        nextWaveZ: CONFIG.SPAWN_DISTANCE,
        nextGateZ: CONFIG.SPAWN_DISTANCE + 150,
        shakeX: 0, shakeY: 0, shakeTimer: 0,
        inputX: null,
        roadSegments: generateRoadDecor(),
        clouds: generateClouds(),
        // New visual features
        damageNumbers: [],
        scorePopups: [],
        comboCount: 0,
        comboTimer: 0,
        bestCombo: 0,
        killCount: 0,
        waveBanner: null,
        vignetteFlash: 0,
        screenFlash: 0,
        // Gate pass effects
        gateFlash: null,
        gateText: null,
        gateShatterPieces: [],
        gateCollapsePanels: [],
        speedLines: [],
        slowMo: 0,
        slowMoFactor: 1,
        // Barrel explosion texts
        barrelExplosionTexts: [],
        // Boss & enemy bullets
        enemyBullets: [],
        // Adaptive difficulty
        peakSquad: 3,
        // Coin drops
        coins: [],
        coinsCollected: 0, // coins earned this run
        // Gem drops (boss only)
        gems: [],
        gemsCollected: 0,
        // Mega boss tracking
        megaBossWarningShown: false,
        // Mid-game shop (after mega boss kill)
        midShopOpen: false,
        midShopTimer: 0,  // countdown frames before opening shop
        midShopBought: [], // indices of items bought this opening
        midShopCount: 0,   // how many times mid-shop has opened (for price scaling)
        // Skill weapon (shop-purchased, manual activation via Space key)
        skillWeapon: null,      // weapon key from SHOP_WEAPONS (set at game start if equipped)
        skillCooldown: 0,       // ms remaining before skill can be used again
        skillReady: true,       // true when skill can be activated
    };
}

function generateRoadDecor() {
    const decor = [];
    for (let i = 0; i < 200; i++) {
        decor.push({
            z: i * 40, type: Math.random() > 0.7 ? 'crack' : 'stain',
            x: (Math.random() - 0.5) * CONFIG.ROAD_HALF_WIDTH * 1.5,
            size: 4 + Math.random() * 8,
        });
    }
    return decor;
}

function generateClouds() {
    const clouds = [];
    for (let i = 0; i < CONFIG.CLOUD_COUNT; i++) {
        clouds.push({
            x: Math.random(), y: 0.02 + Math.random() * 0.12,
            speed: 0.03 + Math.random() * 0.08,
            width: 60 + Math.random() * 120, height: 15 + Math.random() * 25,
            opacity: 0.12 + Math.random() * 0.2,
            blocks: Array.from({length: 3 + Math.floor(Math.random() * 4)}, () => ({
                dx: (Math.random() - 0.5) * 0.6, dy: (Math.random() - 0.5) * 0.4,
                w: 0.5 + Math.random() * 0.8, h: 0.6 + Math.random() * 0.5,
            })),
        });
    }
    return clouds;
}

// ============================================================
// 3D PROJECTION
// ============================================================

// Per-frame projection cache — avoids recalculating sqrt/aspect per entity
const _proj = { viewDist: 200, horizonY: 0, groundY: 0, xScale: 1, sizeRef: 1, halfW: 0, isMobile: false };

function updateProjectionCache() {
    const aspect = screenW / screenH;
    _proj.isMobile = aspect < 1;
    _proj.viewDist = CONFIG.VIEW_DIST;
    _proj.horizonY = screenH * CONFIG.HORIZON_RATIO;
    _proj.groundY = screenH * 0.97;
    _proj.xScale = screenW / (CONFIG.ROAD_HALF_WIDTH * 2.5);
    _proj.sizeRef = 1.0;
    _proj.halfW = screenW / 2;
}

function getHorizonRatio() {
    const aspect = screenW / screenH;
    return aspect < 1 ? CONFIG.HORIZON_RATIO + 0.06 : CONFIG.HORIZON_RATIO;
}

function project(worldX, relZ) {
    const c = _proj;
    const scale = c.viewDist / (c.viewDist + Math.max(relZ, 0.1));
    return {
        x: c.halfW + worldX * scale * c.xScale,
        y: c.horizonY + (c.groundY - c.horizonY) * scale,
        scale: scale * c.sizeRef,
    };
}

// ============================================================
// ADAPTIVE DIFFICULTY — enemies scale based on what gates gave you
// ============================================================

function getAdaptiveFactor() {
    const g = game;
    // Baseline: expected squad if player gets average-luck gates
    // Start 3, roughly +1.8 per wave from average gate outcomes
    const expected = 3 + g.wave * 1.8;
    // Use blend: current squad matters, but peak prevents gaming
    // (can't just intentionally lose soldiers to face weaker enemies)
    const effective = Math.max(g.squadCount, g.peakSquad * 0.6);
    // Ratio: >1 means stronger than expected, <1 means weaker
    const ratio = effective / Math.max(1, expected);
    // Logarithmic dampening — a 4x power advantage becomes ~2x enemy buff
    // pow(0.55) compresses the ratio so swings are gradual
    const factor = Math.pow(Math.max(0.25, ratio), 0.55);
    // Clamp to sane range: enemies are at least 50% base, at most 250%
    return Math.max(0.5, Math.min(2.5, factor));
}

// ============================================================
// DRAWING HELPERS
// ============================================================

function px(gfx, x, y, w, h, color, alpha) {
    if (alpha !== undefined) {
        gfx.rect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)).fill({ color, alpha });
    } else {
        gfx.rect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)).fill(color);
    }
}

function lerpColor(c1, c2, t) {
    const r1 = (c1 >> 16) & 0xff, g1 = (c1 >> 8) & 0xff, b1 = c1 & 0xff;
    const r2 = (c2 >> 16) & 0xff, g2 = (c2 >> 8) & 0xff, b2 = c2 & 0xff;
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return (r << 16) | (g << 8) | b;
}

// ============================================================
// OBJECT POOLS — label & monster sprite recycling
// ============================================================

function getPooledLabel() {
    if (labelPoolIdx < labelPool.length) {
        const t = labelPool[labelPoolIdx++];
        t.visible = true;
        return t;
    }
    const t = new PIXI.Text({
        text: '', style: {
            fontFamily: 'Courier New', fontSize: 14, fill: 0xffffff,
            fontWeight: 'bold',
            stroke: { color: 0x000000, width: 3 },
        },
    });
    labelPool.push(t);
    labelContainer.addChild(t);
    labelPoolIdx++;
    return t;
}

function resetLabelPool() {
    for (let i = 0; i < labelPool.length; i++) {
        labelPool[i].visible = false;
    }
    labelPoolIdx = 0;
}

// Monster sprite pool
function getPooledMonsterSprite() {
    if (!monsterSpritesLoaded) return null;
    if (monsterSpriteIdx >= monsterSpritePool.length) {
        const spr = new PIXI.Sprite(normalMonsterFrames[0]);
        spr.anchor.set(0.5, 1); // Anchor at bottom center
        spr.visible = false;
        monsterSpriteContainer.addChild(spr);
        monsterSpritePool.push(spr);
    }
    const spr = monsterSpritePool[monsterSpriteIdx++];
    spr.visible = true;
    return spr;
}

function resetMonsterSpritePool() {
    for (let i = 0; i < monsterSpritePool.length; i++) {
        monsterSpritePool[i].visible = false;
    }
    monsterSpriteIdx = 0;
}
