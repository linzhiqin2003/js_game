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

// ============================================================
// MID-GAME SHOP (after mega boss kill)
// ============================================================
// Base options; troops & costs scale dynamically with wave and squad deficit
const MID_SHOP_BASE = [
    { troopsPct: 0.15, costBase: 400,  desc: '小队补充' },
    { troopsPct: 0.30, costBase: 900,  desc: '中队增援' },
    { troopsPct: 0.50, costBase: 1800, desc: '大规模增援' },
];

function getMidShopOption(idx) {
    const base = MID_SHOP_BASE[idx];
    const g = game;
    const n = g.midShopCount; // 1-based (already incremented in openMidShop)

    // Expected squad at this wave (same formula as getAdaptiveFactor)
    const expected = 3 + g.wave * 1.8;
    // Deficit ratio: <1 means behind schedule, >1 means ahead
    const ratio = Math.max(0.1, g.squadCount / Math.max(1, expected));

    // Rescue multiplier: the further behind, the more generous
    // ratio=0.3 → mult=2.0, ratio=0.5 → 1.5, ratio=1.0 → 1.0, ratio=2.0 → 0.7
    const rescueMult = Math.max(0.5, Math.min(2.5, 1.0 / Math.pow(ratio, 0.6)));

    // Base troops: percentage of expected squad, scaled by rescue
    const baseTroops = Math.max(3, Math.round(expected * base.troopsPct * rescueMult));
    // Also scale up with shop count (later shops naturally offer more)
    const troops = Math.round(baseTroops * (1 + (n - 1) * 0.3));

    // Cost: scales with wave progression, cheaper per-unit when in deficit
    const costMult = Math.max(0.6, Math.min(1.5, Math.pow(ratio, 0.4)));
    const cost = Math.round(base.costBase * (1 + (n - 1) * 0.5) * costMult);

    return { troops, cost, label: `+${troops} 兵力`, desc: base.desc };
}

function openMidShop() {
    const g = game;
    if (!g) return;
    g.state = 'midShop';
    g.midShopOpen = true;
    g.midShopBought = []; // reset per opening
    g.midShopCount++;
    document.getElementById('midShopOverlay').classList.remove('hidden');
    renderMidShop();
}

function renderMidShop() {
    const g = game;
    if (!g) return;

    // Stats
    const statsEl = document.getElementById('midShopStats');
    statsEl.innerHTML = `
        <span style="color:#ffcc00">得分: ${g.score}</span>
        <span style="color:#44aaff">兵力: ${g.squadCount}</span>
        <span style="color:#ff8833">波次: ${g.wave}</span>
    `;

    // Items
    const container = document.getElementById('midShopItems');
    container.innerHTML = '';
    MID_SHOP_BASE.forEach((_, idx) => {
        const opt = getMidShopOption(idx);
        const bought = g.midShopBought.includes(idx);
        const canAfford = !bought && g.score >= opt.cost;
        const item = document.createElement('div');
        item.className = 'midshop-item' + (bought ? ' midshop-bought' : '');
        item.innerHTML = `
            <div class="midshop-item-info">
                <div class="midshop-item-name">${opt.label}</div>
                <div class="midshop-item-desc">${opt.desc}</div>
            </div>
            ${bought
                ? `<span class="midshop-sold">售罄</span>`
                : `<button class="btn-midshop-buy" ${!canAfford ? 'disabled' : ''} data-idx="${idx}" data-cost="${opt.cost}">
                    ⭐ ${opt.cost} 分
                </button>`
            }
        `;
        container.appendChild(item);
    });

    // Buy button events
    container.querySelectorAll('.btn-midshop-buy').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            const cost = parseInt(btn.dataset.cost);
            const opt = getMidShopOption(idx);
            if (g.midShopBought.includes(idx)) return;
            if (g.score >= cost) {
                g.score -= cost;
                g.squadCount += opt.troops;
                if (g.squadCount > g.peakSquad) g.peakSquad = g.squadCount;
                g.midShopBought.push(idx);
                playSound('gate_good');
                renderMidShop(); // refresh display
            }
        });
    });
}

function closeMidShop() {
    const g = game;
    if (!g) return;
    g.state = 'playing';
    g.midShopOpen = false;
    document.getElementById('midShopOverlay').classList.add('hidden');
}

// Initialize shop events
updateShopCurrencies();
document.getElementById('shopBtn').addEventListener('click', openShop);
document.getElementById('shopBackBtn').addEventListener('click', closeShop);
document.getElementById('midShopGoBtn').addEventListener('click', closeMidShop);
document.querySelectorAll('.shop-tab').forEach(btn => {
    btn.addEventListener('click', () => switchShopTab(btn.dataset.tab));
});
