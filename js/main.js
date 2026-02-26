// ============================================================
// INPUT
// ============================================================
function setupInput() {
    const canvas = app.canvas;

    function getWorldX(clientX) {
        const rect = canvas.getBoundingClientRect();
        const canvasX = (clientX - rect.left) / rect.width * screenW;
        const centerX = screenW / 2;
        return ((canvasX - centerX) / (screenW / 2)) * CONFIG.ROAD_HALF_WIDTH;
    }

    canvas.addEventListener('mousemove', (e) => {
        if (game && game.state === 'playing') {
            game.inputX = Math.max(-CONFIG.ROAD_HALF_WIDTH, Math.min(CONFIG.ROAD_HALF_WIDTH, getWorldX(e.clientX)));
        }
    });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (game && game.state === 'playing' && e.touches.length > 0) {
            game.inputX = Math.max(-CONFIG.ROAD_HALF_WIDTH, Math.min(CONFIG.ROAD_HALF_WIDTH, getWorldX(e.touches[0].clientX)));
        }
    }, { passive: false });

    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (game && game.state === 'playing' && e.touches.length > 0) {
            game.inputX = getWorldX(e.touches[0].clientX);
        }
    }, { passive: false });

    document.addEventListener('keydown', (e) => {
        keys[e.key] = true;
        if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
            if (game) {
                if (game.state === 'playing') game.state = 'paused';
                else if (game.state === 'paused') game.state = 'playing';
            }
        }
        // Space key: activate first available weapon
        if (e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            activateSkillWeapon();
        }
        // Number hotkeys 1-4: activate specific weapons
        const weaponByHotkey = {};
        for (const [k, w] of Object.entries(SHOP_WEAPONS)) {
            if (w.hotkey) weaponByHotkey[w.hotkey] = k;
        }
        if (weaponByHotkey[e.key]) activateWeaponByKey(weaponByHotkey[e.key]);
    });
    document.addEventListener('keyup', (e) => { keys[e.key] = false; });

    // Pause button for touch devices
    const pauseBtn = document.getElementById('pauseBtn');
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        pauseBtn.style.display = 'block';
    }
    pauseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (game) {
            if (game.state === 'playing') game.state = 'paused';
            else if (game.state === 'paused') game.state = 'playing';
        }
    });

    // Skill activation button for touch devices
    const skillBtn = document.getElementById('skillBtn');
    if (skillBtn) {
        skillBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            activateSkillWeapon();
        });
    }
}

// ============================================================
// UI (start / gameover)
// ============================================================
// overlay and startBtn are defined in globals.js

function startGame() {
    initAudio();
    game = createGame();
    // Apply talent: squad bonus
    game.squadCount = 3 + getTalentSquadBonus();
    game.peakSquad = game.squadCount;
    // Check if any weapon has charges for skillReady flag
    const hasAnyCharges = Object.values(playerData.weaponCharges || {}).some(c => c > 0);
    game.skillReady = hasAnyCharges;
    game.skillCooldown = 0;
    spawnEnemyWave();
    overlay.classList.add('hidden');
    // Hide old single skill button; weapon slots handle touch input
    const skillBtn = document.getElementById('skillBtn');
    if (skillBtn) skillBtn.style.display = 'none';
    initWeaponSlots();
}

// Activate a specific weapon by its key (shotgun / laser / rocket / invincibility)
function activateWeaponByKey(weaponKey) {
    const g = game;
    if (!g || g.state !== 'playing') return;
    if (g.skillCooldown > 0) return;        // shared cooldown active
    if (g.weapon !== 'pistol') return;      // another weapon already active
    const charges = (playerData.weaponCharges || {})[weaponKey] || 0;
    if (charges <= 0) return;
    const shopW = SHOP_WEAPONS[weaponKey];
    if (!shopW) return;
    playerData.weaponCharges[weaponKey] = charges - 1;
    savePlayerData(playerData);
    g.weapon = weaponKey;
    g.weaponTimer = shopW.duration * 1000;
    g.skillReady = false;
    playSound('weapon_pickup');
    g.screenFlash = 0.4;
    g.shakeTimer = Math.max(g.shakeTimer, 6);
    addParticles(g.player.x, g.cameraZ + 10, 15, shopW.colorHex, 4, 20);
}

// Space key / SKILL button: activate first available weapon
function activateSkillWeapon() {
    for (const key of Object.keys(SHOP_WEAPONS)) {
        const charges = (playerData.weaponCharges || {})[key] || 0;
        if (charges > 0) { activateWeaponByKey(key); return; }
    }
}

// ── Weapon Slots UI ──
function initWeaponSlots() {
    const slotsDiv = document.getElementById('weaponSlots');
    if (!slotsDiv) return;
    slotsDiv.innerHTML = '';
    for (const [key, w] of Object.entries(SHOP_WEAPONS)) {
        const slot = document.createElement('div');
        slot.className = 'wslot';
        slot.dataset.weapon = key;
        slot.style.setProperty('--wcolor', w.color);
        slot.innerHTML = `
            <div class="wslot-key">[${w.hotkey}]</div>
            <div class="wslot-icon">${w.icon}</div>
            <div class="wslot-count">×0</div>
            <div class="wslot-bar"><div class="wslot-bar-fill"></div></div>
            <div class="wslot-cd"></div>
        `;
        slot.addEventListener('click', () => activateWeaponByKey(key));
        slotsDiv.appendChild(slot);
    }
    slotsDiv.style.display = 'flex';
}

function updateWeaponSlots() {
    if (!game) return;
    const g = game;
    const slotsDiv = document.getElementById('weaponSlots');
    if (!slotsDiv || slotsDiv.style.display === 'none') return;

    const charges = playerData.weaponCharges || {};
    const isOnCooldown = g.skillCooldown > 0;
    const cdSec = Math.ceil(g.skillCooldown / 1000);
    const someWeaponActive = g.weapon !== 'pistol';

    slotsDiv.querySelectorAll('.wslot').forEach(slot => {
        const key = slot.dataset.weapon;
        const w = SHOP_WEAPONS[key];
        const count = charges[key] || 0;
        const isActive = g.weapon === key;

        // Count text + color
        const countEl = slot.querySelector('.wslot-count');
        countEl.textContent = `×${count}`;
        countEl.style.color = isActive ? '#ffd700'
            : (!isOnCooldown && !someWeaponActive && count > 0) ? w.color
            : 'rgba(255,255,255,0.5)';

        // Cooldown / active overlay
        const cdEl = slot.querySelector('.wslot-cd');
        if (isActive) {
            cdEl.textContent = Math.ceil(g.weaponTimer / 1000) + 's';
            cdEl.style.color = '#ffd700';
            cdEl.style.display = 'flex';
        } else if (isOnCooldown) {
            cdEl.textContent = cdSec + 's';
            cdEl.style.color = '#999';
            cdEl.style.display = 'flex';
        } else if (someWeaponActive) {
            cdEl.textContent = '';
            cdEl.style.display = 'flex';
        } else {
            cdEl.style.display = 'none';
        }

        // Timer progress bar (bottom edge of active slot)
        const barFill = slot.querySelector('.wslot-bar-fill');
        if (barFill) {
            if (isActive) {
                const def = WEAPON_DEFS[key];
                const pct = Math.max(0, g.weaponTimer / (def.duration * 1000)) * 100;
                barFill.style.width = pct + '%';
                barFill.style.background = w.color;
                slot.querySelector('.wslot-bar').style.display = 'block';
            } else {
                slot.querySelector('.wslot-bar').style.display = 'none';
            }
        }

        // State classes + border
        slot.className = 'wslot';
        if (isActive) {
            slot.classList.add('wslot-active');
            slot.style.borderColor = '#ffd700';
        } else if (count <= 0) {
            slot.classList.add('wslot-empty');
            slot.style.borderColor = 'rgba(255,255,255,0.08)';
        } else if (isOnCooldown || someWeaponActive) {
            slot.classList.add('wslot-dim');
            slot.style.borderColor = 'rgba(255,255,255,0.12)';
        } else {
            slot.classList.add('wslot-ready');
            slot.style.borderColor = w.color;
        }
    });
}

function getHighScore() {
    try { return JSON.parse(localStorage.getItem('bridgeAssault_highScore')) || { score: 0, wave: 0 }; }
    catch { return { score: 0, wave: 0 }; }
}

function saveHighScore(score, wave) {
    const prev = getHighScore();
    if (score > prev.score) {
        localStorage.setItem('bridgeAssault_highScore', JSON.stringify({ score, wave }));
        return true; // new record
    }
    return false;
}

function showGameOver() {
    const isNewRecord = saveHighScore(game.score, game.wave);
    const hs = getHighScore();
    overlay.classList.remove('hidden');
    // Hide weapon slots and skill button
    const slotsDiv = document.getElementById('weaponSlots');
    if (slotsDiv) slotsDiv.style.display = 'none';
    const skillBtn = document.getElementById('skillBtn');
    if (skillBtn) skillBtn.style.display = 'none';
    overlay.innerHTML = `
        <h1>GAME OVER</h1>
        <div id="scoreDisplay">最终得分</div>
        <div id="finalScore">${game.score}</div>
        ${isNewRecord ? '<div style="color:#f0c040;font-size:min(28px,5vw);margin-bottom:12px;text-shadow:0 0 15px #f0c040;letter-spacing:3px;">★ NEW RECORD! ★</div>' : ''}
        <div style="color:#aaa;font-size:min(20px,4vw);margin-bottom:12px;">到达第 ${game.wave} 波 | 击杀 ${game.killCount}</div>
        <div style="color:#f90;font-size:min(22px,4.5vw);margin-bottom:10px;">最高连击: ${game.bestCombo}x</div>
        <div style="color:#ffd700;font-size:min(22px,4.5vw);margin-bottom:6px;">获得金币: +${game.coinsCollected} (总计: ${playerData.coins})</div>
        ${game.gemsCollected > 0 ? `<div style="color:#cc44ff;font-size:min(22px,4.5vw);margin-bottom:10px;text-shadow:0 0 10px #aa22ff;">💎 获得宝石: +${game.gemsCollected} (总计: ${playerData.gems})</div>` : `<div style="color:#666;font-size:min(16px,3.5vw);margin-bottom:10px;">击败 Boss 可获得宝石 💎</div>`}
        <div style="color:#88bbff;font-size:min(22px,4.5vw);margin-bottom:28px;">历史最高: ${hs.score} (第${hs.wave}波)</div>
        <div id="menuButtons">
            <button class="btn" onclick="restoreMainMenu()">MAIN MENU</button>
            <button class="btn" onclick="startGame()">PLAY AGAIN</button>
        </div>
    `;
}

function restoreMainMenu() {
    overlay.innerHTML = `
        <h1>BRIDGE ASSAULT</h1>
        <h2>桥 梁 突 击</h2>
        <div id="coinDisplay">
            <span class="coin-icon">&#x1FA99;</span>
            <span id="coinCount">${playerData.coins}</span>
            <span style="margin-left:16px;color:#cc44ff;">💎</span>
            <span id="gemCount" style="color:#cc44ff;">${playerData.gems || 0}</span>
        </div>
        <div id="menuButtons">
            <button class="btn" id="startBtn" onclick="startGame()">START GAME</button>
            <button class="btn btn-shop" id="shopBtn" onclick="openShop()">SHOP</button>
        </div>
    `;
}

// ============================================================
// SHOP SYSTEM
// ============================================================
let _shopTab = 'weapon'; // 'weapon' | 'talent' | 'defense'

function updateShopCurrencies() {
    const coinEl = document.getElementById('shopCoinCount');
    if (coinEl) coinEl.textContent = playerData.coins;
    const gemEl = document.getElementById('shopGemCount');
    if (gemEl) gemEl.textContent = playerData.gems || 0;
    // Also update main menu display
    const mcEl = document.getElementById('coinCount');
    if (mcEl) mcEl.textContent = playerData.coins;
    const mgEl = document.getElementById('gemCount');
    if (mgEl) mgEl.textContent = playerData.gems || 0;
}

function openShop() {
    document.getElementById('shopOverlay').classList.remove('hidden');
    _shopTab = 'weapon';
    renderShop();
}

function closeShop() {
    document.getElementById('shopOverlay').classList.add('hidden');
    updateShopCurrencies();
}

function switchShopTab(tab) {
    _shopTab = tab;
    renderShop();
}

function renderShop() {
    updateShopCurrencies();
    // Update tab active state
    document.querySelectorAll('.shop-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === _shopTab);
    });
    // Show/hide panels via style.display (not class — .hidden has no display:none rule)
    document.getElementById('shopWeaponPanel').style.display = _shopTab === 'weapon' ? '' : 'none';
    document.getElementById('shopTalentPanel').style.display = _shopTab === 'talent' ? '' : 'none';
    document.getElementById('shopDefensePanel').style.display = _shopTab === 'defense' ? '' : 'none';

    if (_shopTab === 'weapon') renderShopItems();
    else if (_shopTab === 'talent') renderTalentItems();
    else if (_shopTab === 'defense') renderDefenseItems();
}

function renderShopItems() {
    const container = document.getElementById('shopItems');
    const equippedEl = document.getElementById('equippedInfo');
    container.innerHTML = '';

    for (const [key, weapon] of Object.entries(SHOP_WEAPONS)) {
        if (weapon.defenseOnly) continue; // 防具标签页专属
        const charges = (playerData.weaponCharges || {})[key] || 0;
        const equipped = playerData.equippedWeapon === key;
        const canAfford = playerData.coins >= weapon.price;

        const item = document.createElement('div');
        item.className = 'shop-item' + (charges > 0 ? ' owned' : '');
        item.innerHTML = `
            <div class="shop-item-icon" style="background:${weapon.color}22;border:2px solid ${weapon.color}">${weapon.icon}</div>
            <div class="shop-item-info">
                <div class="shop-item-name" style="color:${weapon.color}">${weapon.name}</div>
                <div class="shop-item-desc">${weapon.desc}</div>
                <div class="shop-item-duration">持续${weapon.duration}s | 按键 [${weapon.hotkey}] | 消耗品</div>
            </div>
            <div class="shop-item-action" style="display:flex;flex-direction:column;align-items:center;gap:6px">
                <span class="skill-charge-badge" style="color:${weapon.color}">× ${charges}</span>
                <button class="btn-buy" ${!canAfford ? 'disabled' : ''} data-weapon="${key}">🪙 ${weapon.price}</button>
            </div>
        `;
        container.appendChild(item);
    }
    container.querySelectorAll('.btn-buy').forEach(btn => {
        btn.addEventListener('click', () => buyWeapon(btn.dataset.weapon));
    });

    equippedEl.textContent = '按 1/2/3/4 键激活对应武器 | 空格键激活首个可用武器';
}

function renderTalentItems() {
    const container = document.getElementById('talentItems');
    container.innerHTML = '';

    for (const def of TALENT_DEFS) {
        const currentLevel = def.isArmor ? (playerData.armor || 0) : (playerData.talents[def.id] || 0);
        const maxed = currentLevel >= def.maxLevel;
        const nextCost = maxed ? null : def.gemCosts[currentLevel];
        const canAfford = !maxed && (playerData.gems || 0) >= nextCost;

        const item = document.createElement('div');
        item.className = 'shop-item' + (currentLevel > 0 ? ' owned' : '');

        // Level pips
        const pips = Array.from({ length: def.maxLevel }, (_, i) =>
            `<span class="talent-pip${i < currentLevel ? ' filled' : ''}" style="${i < currentLevel ? `background:${def.color};border-color:${def.color};box-shadow:0 0 5px ${def.color}66` : ''}"></span>`
        ).join('');

        const effectText = currentLevel > 0 ? def.effectDesc(currentLevel) : '未解锁';

        item.innerHTML = `
            <div class="shop-item-icon" style="background:${def.color}22;border:2px solid ${def.color}">${def.icon}</div>
            <div class="shop-item-info">
                <div class="shop-item-name" style="color:${def.color}">${def.name}</div>
                <div class="shop-item-desc">${def.desc}</div>
                <div class="shop-item-duration">${pips} ${effectText}</div>
            </div>
            <div class="shop-item-action" style="display:flex;flex-direction:column;align-items:center;gap:6px">
                <span class="skill-charge-badge" style="color:${def.color}">Lv ${currentLevel}</span>
                ${maxed
                    ? `<button class="btn-equipped">满级</button>`
                    : `<button class="btn-buy btn-talent-buy" ${!canAfford ? 'disabled' : ''} data-talent="${def.id}">💎 ${nextCost}</button>`
                }
            </div>
        `;
        container.appendChild(item);
    }

    container.querySelectorAll('.btn-talent-buy').forEach(btn => {
        btn.addEventListener('click', () => buyTalent(btn.dataset.talent));
    });
}

function buyWeapon(weaponKey) {
    const weapon = SHOP_WEAPONS[weaponKey];
    if (!weapon || playerData.coins < weapon.price) return;
    playerData.coins -= weapon.price;
    if (!playerData.weaponCharges) playerData.weaponCharges = {};
    playerData.weaponCharges[weaponKey] = (playerData.weaponCharges[weaponKey] || 0) + 1;
    // 首次购买自动装备
    if (!playerData.equippedWeapon) playerData.equippedWeapon = weaponKey;
    savePlayerData(playerData);
    renderShopItems();
    updateShopCurrencies();
}

function equipWeapon(weaponKey) {
    const charges = (playerData.weaponCharges || {})[weaponKey] || 0;
    if (charges <= 0) return;
    playerData.equippedWeapon = weaponKey;
    savePlayerData(playerData);
    renderShopItems();
}

function buyTalent(talentId) {
    const def = TALENT_DEFS.find(d => d.id === talentId);
    if (!def) return;
    const currentLevel = def.isArmor ? (playerData.armor || 0) : (playerData.talents[talentId] || 0);
    if (currentLevel >= def.maxLevel) return;
    const cost = def.gemCosts[currentLevel];
    if ((playerData.gems || 0) < cost) return;
    playerData.gems -= cost;
    if (def.isArmor) {
        playerData.armor = currentLevel + 1;
    } else {
        playerData.talents[talentId] = currentLevel + 1;
    }
    savePlayerData(playerData);
    renderTalentItems();
    updateShopCurrencies();
}

function renderDefenseItems() {
    const container = document.getElementById('defenseItems');
    container.innerHTML = '';

    const inv = SHOP_WEAPONS['invincibility'];
    const invCharges = (playerData.weaponCharges || {})['invincibility'] || 0;
    const invCanAfford = playerData.coins >= inv.price;

    const invItem = document.createElement('div');
    invItem.className = 'shop-item' + (invCharges > 0 ? ' owned' : '');
    invItem.innerHTML = `
        <div class="shop-item-icon" style="background:${inv.color}22;border:2px solid ${inv.color}">${inv.icon}</div>
        <div class="shop-item-info">
            <div class="shop-item-name" style="color:${inv.color}">${inv.name}</div>
            <div class="shop-item-desc">${inv.desc}</div>
            <div class="shop-item-duration">持续${inv.duration}s | 按键 [4] | 消耗品</div>
        </div>
        <div class="shop-item-action" style="display:flex;flex-direction:column;align-items:center;gap:6px">
            <span class="skill-charge-badge" style="color:${inv.color}">× ${invCharges}</span>
            <button class="btn-buy inv-buy" ${!invCanAfford ? 'disabled' : ''}>🪙 ${inv.price}</button>
        </div>
    `;
    container.appendChild(invItem);

    // Event listeners
    const invBuyBtn = container.querySelector('.inv-buy');
    if (invBuyBtn) {
        invBuyBtn.addEventListener('click', () => {
            if (playerData.coins >= inv.price) {
                playerData.coins -= inv.price;
                if (!playerData.weaponCharges) playerData.weaponCharges = {};
                playerData.weaponCharges['invincibility'] = (playerData.weaponCharges['invincibility'] || 0) + 1;
                savePlayerData(playerData);
                renderDefenseItems();
                updateShopCurrencies();
            }
        });
    }

    const defenseInfo = document.getElementById('defenseInfo');
    if (defenseInfo) defenseInfo.textContent = '按 [4] 激活无敌护盾，消耗1次充能 | 护甲天赋请在天赋页升级';
}

function buyArmor(level) {
    const def = SHOP_ARMOR[level - 1];
    if (!def) return;
    if ((playerData.armor || 0) !== level - 1) return;
    if (playerData.coins < def.price) return;
    playerData.coins -= def.price;
    playerData.armor = level;
    savePlayerData(playerData);
    renderDefenseItems();
    updateShopCurrencies();
}

// Initialize main menu + shop events
startBtn.addEventListener('click', startGame);
updateShopCurrencies();
document.getElementById('shopBtn').addEventListener('click', openShop);
document.getElementById('shopBackBtn').addEventListener('click', closeShop);
// Tab buttons
document.querySelectorAll('.shop-tab').forEach(btn => {
    btn.addEventListener('click', () => switchShopTab(btn.dataset.tab));
});

// ============================================================
// VIGNETTE TEXTURE (pre-rendered)
// ============================================================
function createVignetteTexture(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const cx = w / 2, cy = h / 2;
    const outerR = Math.sqrt(cx * cx + cy * cy);
    const grad = ctx.createRadialGradient(cx, cy, outerR * 0.45, cx, cy, outerR);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(0,0,0,${CONFIG.VIGNETTE_STRENGTH})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    return PIXI.Texture.from(c);
}

// ============================================================
// INIT (async - sets up PixiJS)
// ============================================================
async function init() {
    app = new PIXI.Application();
    await app.init({
        resizeTo: window,
        backgroundColor: 0x0a1520,
        antialias: false,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
    });

    document.getElementById('gameContainer').appendChild(app.canvas);
    screenW = app.screen.width;
    screenH = app.screen.height;

    // Load monster sprites (派大星 = normal, 小奶龙 = normal type 1, 大奶龙 = boss)
    try {
        const loadImage = (src) => new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const imgSource = new PIXI.ImageSource({ resource: img });
                resolve(new PIXI.Texture({ source: imgSource }));
            };
            img.onerror = () => reject(new Error('Failed to load: ' + src));
            img.src = src;
        });
        const [patrickTex, xiaoNaiLongTex, bossTex, fireEnemyTex] = await Promise.all([
            loadImage('assets/patrick.png'),
            loadImage('assets/small_dragon.png'),
            loadImage('assets/boss_dragon.png'),
            loadImage('assets/fire_enemy.png'),
        ]);
        // Extract 派大星 frames (6 cols × 4 rows grid, last row has 5)
        for (let r = 0; r < PATRICK_ROWS; r++) {
            const colsInRow = r === PATRICK_ROWS - 1 ? 5 : PATRICK_COLS;
            for (let c = 0; c < colsInRow; c++) {
                const frame = new PIXI.Rectangle(
                    c * PATRICK_FRAME_W, r * PATRICK_FRAME_H,
                    PATRICK_FRAME_W, PATRICK_FRAME_H
                );
                normalMonsterFrames.push(new PIXI.Texture({ source: patrickTex.source, frame }));
            }
        }
        // Extract 小奶龙 frames (21 frames, 128×128 horizontal strip)
        for (let i = 0; i < XIAO_NAI_LONG_FRAME_COUNT; i++) {
            const frame = new PIXI.Rectangle(
                i * XIAO_NAI_LONG_FRAME_SIZE, 0,
                XIAO_NAI_LONG_FRAME_SIZE, XIAO_NAI_LONG_FRAME_SIZE
            );
            xiaoNaiLongFrames.push(new PIXI.Texture({ source: xiaoNaiLongTex.source, frame }));
        }
        // Extract 大奶龙 (boss) frames (4 frames, 64×64 horizontal strip)
        for (let i = 0; i < MONSTER_FRAME_COUNT; i++) {
            const frame = new PIXI.Rectangle(
                i * MONSTER_FRAME_SIZE, 0,
                MONSTER_FRAME_SIZE, MONSTER_FRAME_SIZE
            );
            bossFrames.push(new PIXI.Texture({ source: bossTex.source, frame }));
        }
        // Extract 火焰奶龙 frames (6 frames, 128×128 horizontal strip)
        for (let i = 0; i < FIRE_ENEMY_FRAME_COUNT; i++) {
            const frame = new PIXI.Rectangle(
                i * FIRE_ENEMY_FRAME_SIZE, 0,
                FIRE_ENEMY_FRAME_SIZE, FIRE_ENEMY_FRAME_SIZE
            );
            fireEnemyFrames.push(new PIXI.Texture({ source: fireEnemyTex.source, frame }));
        }
        monsterSpritesLoaded = true;
        console.log('Monster sprites loaded: 派大星', normalMonsterFrames.length, ', 小奶龙', xiaoNaiLongFrames.length, ', 大奶龙', bossFrames.length, ', 火焰奶龙', fireEnemyFrames.length, 'frames');
    } catch (e) {
        console.error('Monster sprites failed to load:', e);
    }

    // Scene layers
    worldContainer = new PIXI.Container();
    skyGfx = new PIXI.Graphics();
    bridgeGfx = new PIXI.Graphics();
    entityGfx = new PIXI.Graphics();
    effectGfx = new PIXI.Graphics();
    effectGfx.blendMode = 'add';
    particleGfx = new PIXI.Graphics();
    labelContainer = new PIXI.Container();

    monsterSpriteContainer = new PIXI.Container();
    worldContainer.addChild(skyGfx, bridgeGfx, entityGfx, monsterSpriteContainer, effectGfx, particleGfx, labelContainer);
    app.stage.addChild(worldContainer);

    // Vignette
    vignetteSprite = new PIXI.Sprite(createVignetteTexture(512, 512));
    vignetteSprite.width = screenW;
    vignetteSprite.height = screenH;
    app.stage.addChild(vignetteSprite);

    // Screen flash (on top of vignette)
    screenFlashGfx = new PIXI.Graphics();
    app.stage.addChild(screenFlashGfx);

    // UI Container
    uiContainer = new PIXI.Container();
    app.stage.addChild(uiContainer);

    // HUD background panel (drawn in hud.js)
    hudBgGfx = new PIXI.Graphics();
    uiContainer.addChild(hudBgGfx);

    const hudFontSize = Math.max(14, Math.min(18, screenW / 30));
    const hudStyle = {
        fontFamily: 'Courier New', fontSize: hudFontSize, fill: 0xffffff, fontWeight: 'bold',
        stroke: { color: 0x000000, width: 4 },
        dropShadow: { color: 0x000000, blur: 4, distance: 2, angle: Math.PI / 4 },
    };

    const hudSpacing = Math.min(200, screenW * 0.25);

    scoreText = new PIXI.Text({ text: 'SCORE: 0', style: { ...hudStyle } });
    scoreText.x = screenW / 2 - hudSpacing; scoreText.y = 10;
    scoreText.anchor.set(0.5, 0);
    uiContainer.addChild(scoreText);

    squadText = new PIXI.Text({ text: 'SQUAD: 3', style: { ...hudStyle } });
    squadText.x = screenW / 2; squadText.y = 10;
    squadText.anchor.set(0.5, 0);
    uiContainer.addChild(squadText);

    waveText = new PIXI.Text({ text: 'WAVE: 1', style: { ...hudStyle } });
    waveText.x = screenW / 2 + hudSpacing; waveText.y = 10;
    waveText.anchor.set(0.5, 0);
    uiContainer.addChild(waveText);

    // Coin HUD (below WAVE text, right side)
    coinHudText = new PIXI.Text({ text: `🪙 ${playerData.coins}`, style: { ...hudStyle, fill: 0xffd700 } });
    coinHudText.x = screenW / 2 + hudSpacing; coinHudText.y = 30;
    coinHudText.anchor.set(0.5, 0);
    uiContainer.addChild(coinHudText);

    // Gem HUD (below SCORE text, left side)
    gemHudText = new PIXI.Text({ text: `💎 ${playerData.gems || 0}`, style: { ...hudStyle, fill: 0xcc44ff } });
    gemHudText.x = screenW / 2 - hudSpacing; gemHudText.y = 30;
    gemHudText.anchor.set(0.5, 0);
    uiContainer.addChild(gemHudText);

    // Weapon HUD
    weaponHudGfx = new PIXI.Graphics();
    weaponHudGfx.visible = false;
    uiContainer.addChild(weaponHudGfx);

    weaponHudText = new PIXI.Text({ text: 'PISTOL', style: { fontFamily: 'Courier New', fontSize: 14, fill: 0xffffff, fontWeight: 'bold' } });
    weaponHudText.anchor.set(0.5); weaponHudText.visible = false;
    uiContainer.addChild(weaponHudText);

    weaponHudTimer = new PIXI.Text({ text: '', style: { fontFamily: 'Courier New', fontSize: 11, fill: 0xffffff } });
    weaponHudTimer.anchor.set(0.5); weaponHudTimer.visible = false;
    uiContainer.addChild(weaponHudTimer);

    // Skill HUD (bottom-left, shows skill weapon status)
    skillHudGfx = new PIXI.Graphics();
    skillHudGfx.visible = false;
    uiContainer.addChild(skillHudGfx);

    skillHudText = new PIXI.Text({ text: '', style: { fontFamily: 'Courier New', fontSize: 13, fill: 0xffffff, fontWeight: 'bold', stroke: { color: 0x000000, width: 3 } } });
    skillHudText.anchor.set(0.5);
    skillHudText.visible = false;
    uiContainer.addChild(skillHudText);

    // Wave banner
    waveBannerContainer = new PIXI.Container();
    waveBannerContainer.visible = false;
    uiContainer.addChild(waveBannerContainer);

    const bannerBg = new PIXI.Graphics();
    bannerBg.rect(-screenW, -30, screenW * 2, 70).fill({ color: 0x000000, alpha: 0.6 });
    waveBannerContainer.addChild(bannerBg);

    waveBannerText = new PIXI.Text({ text: 'WAVE 1', style: { fontFamily: 'Courier New', fontSize: 36, fill: 0xf0c040, fontWeight: 'bold', stroke: { color: 0x000000, width: 5 } } });
    waveBannerText.anchor.set(0.5); waveBannerText.x = screenW / 2;
    waveBannerContainer.addChild(waveBannerText);

    waveBannerSub = new PIXI.Text({ text: 'INCOMING!', style: { fontFamily: 'Courier New', fontSize: 16, fill: 0xcccccc } });
    waveBannerSub.anchor.set(0.5); waveBannerSub.x = screenW / 2; waveBannerSub.y = 25;
    waveBannerContainer.addChild(waveBannerSub);

    // Combo text
    comboText = new PIXI.Text({ text: '', style: { fontFamily: 'Courier New', fontSize: 22, fill: 0xffffff, fontWeight: 'bold', stroke: { color: 0x000000, width: 4 } } });
    comboText.anchor.set(1, 0);
    comboText.x = screenW - 20; comboText.y = 50;
    comboText.visible = false;
    uiContainer.addChild(comboText);

    // Boss HP bar (top of screen)
    bossHudContainer = new PIXI.Container();
    bossHudContainer.visible = false;
    uiContainer.addChild(bossHudContainer);

    bossHudGfx = new PIXI.Graphics();
    bossHudContainer.addChild(bossHudGfx);

    bossHudNameText = new PIXI.Text({ text: 'BOSS', style: {
        fontFamily: 'Courier New', fontSize: 16, fill: 0xcc66ff, fontWeight: 'bold',
        stroke: { color: 0x000000, width: 3 },
    }});
    bossHudNameText.anchor.set(0.5, 1);
    bossHudContainer.addChild(bossHudNameText);

    bossHudHpText = new PIXI.Text({ text: '', style: {
        fontFamily: 'Courier New', fontSize: 13, fill: 0xffffff,
        stroke: { color: 0x000000, width: 3 },
    }});
    bossHudHpText.anchor.set(0.5, 0);
    bossHudContainer.addChild(bossHudHpText);

    // Pause overlay (topmost layer)
    pauseContainer = new PIXI.Container();
    pauseContainer.visible = false;
    app.stage.addChild(pauseContainer);

    pauseGfx = new PIXI.Graphics();
    pauseContainer.addChild(pauseGfx);

    pauseTitle = new PIXI.Text({ text: 'PAUSED', style: {
        fontFamily: 'Courier New', fontSize: 52, fill: 0xf0c040, fontWeight: 'bold',
        stroke: { color: 0x000000, width: 6 },
        dropShadow: { color: 0x000000, blur: 8, distance: 3, angle: Math.PI / 4 },
    }});
    pauseTitle.anchor.set(0.5);
    pauseTitle.x = screenW / 2; pauseTitle.y = screenH / 2 - 40;
    pauseContainer.addChild(pauseTitle);

    pauseSub = new PIXI.Text({ text: '已暂停', style: {
        fontFamily: 'Courier New', fontSize: 24, fill: 0xcccccc,
    }});
    pauseSub.anchor.set(0.5);
    pauseSub.x = screenW / 2; pauseSub.y = screenH / 2 + 20;
    pauseContainer.addChild(pauseSub);

    pauseHint = new PIXI.Text({ text: '按 ESC 或 P 继续', style: {
        fontFamily: 'Courier New', fontSize: 16, fill: 0xf0c040,
    }});
    pauseHint.anchor.set(0.5);
    pauseHint.x = screenW / 2; pauseHint.y = screenH / 2 + 60;
    pauseHint.alpha = 0.7;
    pauseContainer.addChild(pauseHint);

    // Handle resize
    window.addEventListener('resize', () => {
        screenW = app.screen.width;
        screenH = app.screen.height;
        vignetteSprite.width = screenW;
        vignetteSprite.height = screenH;
        const hs = Math.min(200, screenW * 0.25);
        scoreText.x = screenW / 2 - hs;
        squadText.x = screenW / 2;
        waveText.x = screenW / 2 + hs;
        coinHudText.x = screenW / 2 + hs;
        if (gemHudText) gemHudText.x = screenW / 2 - hs;
        comboText.x = screenW - 20;
        waveBannerText.x = screenW / 2;
        waveBannerSub.x = screenW / 2;
    });

    // Input
    setupInput();

    // Game loop via PixiJS ticker
    app.ticker.add((ticker) => {
        if (!game) return;
        const dt = ticker.deltaMS;
        if (game.state === 'playing') update(dt);
        render();
    });
}

// Start
init();
