// ============================================================
// SPAWN FUNCTIONS (extracted from game.js)
// ============================================================

function spawnEnemyWave() {
    const g = game;
    const af = getAdaptiveFactor();
    const count = Math.min(3 + Math.ceil(g.wave * 1.5), 25);
    const rows = Math.ceil(count / 5);
    const baseZ = g.cameraZ + CONFIG.SPAWN_DISTANCE;
    // Damage scales with wave × adaptive factor
    const baseDmg = Math.ceil((1 + Math.floor(g.wave / 5)) * Math.sqrt(af));
    for (let r = 0; r < rows; r++) {
        const cols = Math.min(count - r * 5, 5);
        for (let c = 0; c < cols; c++) {
            const spread = CONFIG.ROAD_HALF_WIDTH * 0.7;
            const x = cols === 1 ? 0 : -spread + (spread * 2) * c / (cols - 1);
            // HP scales with wave × adaptive factor
            const rawHp = CONFIG.ENEMY_HP + g.wave + Math.floor(g.wave * g.wave / 40);
            const baseHp = Math.ceil(rawHp * af);
            // Heavy enemies: chance also scaled by adaptive factor
            const heavyChance = g.wave >= 6 ? (0.12 + g.wave * 0.006) * Math.min(1.5, af) : 0;
            const isHeavy = Math.random() < heavyChance;
            const type = Math.floor(Math.random() * 3);
            const typeMult = type === 1 ? 1.5 : 1.0; // red enemies are tougher
            const hp = Math.ceil((isHeavy ? baseHp * 2 : baseHp) * 1.2 * typeMult);
            const damage = Math.ceil((isHeavy ? baseDmg * 1.5 : baseDmg) * 1.2);
            g.enemies.push({
                x: x + (Math.random() - 0.5) * 20,
                z: baseZ + r * 45 + Math.random() * 15,
                hp, maxHp: hp, alive: true,
                damage, isHeavy,
                animFrame: 0, animTimer: Math.random() * 500, hitFlash: 0,
                type,
            });
        }
    }
    g.nextWaveZ = baseZ + rows * 35 + 200;
}

function spawnBoss(z) {
    const g = game;
    const bossLevel = Math.floor(g.wave / 5); // 1, 2, 3...
    // Boss HP: gentler early scaling so first boss is beatable
    const bulletCount = Math.min(g.squadCount, 8);
    const bulletDmg = 1 + Math.floor(g.squadCount / 6);
    const volleyDmg = bulletCount * bulletDmg;
    const bossHp = Math.max(40, Math.ceil(volleyDmg * (12 + bossLevel * 5)));
    const af = getAdaptiveFactor();
    const baseDmg = 1 + Math.floor(g.wave / 8);
    const bossDmg = Math.ceil(baseDmg * Math.sqrt(af));
    g.enemies.push({
        x: (Math.random() - 0.5) * CONFIG.ROAD_HALF_WIDTH * 0.6,
        z,
        hp: bossHp, maxHp: bossHp, alive: true,
        damage: bossDmg,
        isBoss: true, isHeavy: false,
        // Boss AI state — stays at far range, never advances
        bossShootTimer: 0,
        bossShootInterval: Math.max(60, 160 - bossLevel * 15),
        bossHoldZ: CONFIG.SPAWN_DISTANCE - 60, // stay near max visible range
        animFrame: 0, animTimer: Math.random() * 500, hitFlash: 0,
        type: 0,
    });
}

// PERCENT_GATE_THRESHOLD is defined in config.js

function generateTroopGateOption(wave, squad, idx, total) {
    const pool = [];
    // Fixed addition: always available
    const addVal = 2 + Math.floor(Math.random() * 2) + Math.floor(wave / 4);
    pool.push({ op: '+', value: addVal, w: 3 });
    // Fixed subtraction: always available
    const subVal = 1 + Math.floor(Math.random() * Math.min(3, Math.ceil(wave / 5)));
    pool.push({ op: '-', value: subVal, w: 2 });

    if (squad < PERCENT_GATE_THRESHOLD) {
        // Small squad: multipliers are the comeback mechanic
        if (wave >= 3) {
            pool.push({ op: '×', value: 2, w: 1.2 });
            if (wave >= 8) pool.push({ op: '×', value: 3, w: 0.4 });
        }
        if (wave >= 4) {
            pool.push({ op: '÷', value: 2, w: 1.5 });
            if (wave >= 8) pool.push({ op: '÷', value: 3, w: 0.6 });
        }
    } else {
        // Large squad: percentage gates for stable scaling
        const goodPcts = [15, 20];
        if (wave >= 6) goodPcts.push(25);
        if (wave >= 12) goodPcts.push(30);
        const gp = goodPcts[Math.floor(Math.random() * goodPcts.length)];
        pool.push({ op: '+%', value: gp, w: 1.5 });

        const badPcts = [10, 15];
        if (wave >= 8) badPcts.push(20);
        if (wave >= 15) badPcts.push(25);
        const bp = badPcts[Math.floor(Math.random() * badPcts.length)];
        pool.push({ op: '-%', value: bp, w: 1.2 });
    }

    // Weighted random pick
    const totalW = pool.reduce((s, p) => s + p.w, 0);
    let r = Math.random() * totalW;
    for (const p of pool) {
        r -= p.w;
        if (r <= 0) return { op: p.op, value: p.value };
    }
    return pool[0];
}

function isGoodOption(opt, squad) {
    switch (opt.op) {
        case '+': case '×': case '+%': return true;
        case '-': case '÷': case '-%': return false;
    }
    return false;
}

function generateBadOption(wave, squad) {
    if (squad >= PERCENT_GATE_THRESHOLD) {
        const pcts = [10, 15];
        if (wave >= 8) pcts.push(20);
        return { op: '-%', value: pcts[Math.floor(Math.random() * pcts.length)] };
    }
    const badPool = [{ op: '-', value: 1 + Math.floor(Math.random() * Math.min(3, Math.ceil(wave / 4))) }];
    if (wave >= 4) badPool.push({ op: '÷', value: 2 });
    if (wave >= 8) badPool.push({ op: '÷', value: 3 });
    return badPool[Math.floor(Math.random() * badPool.length)];
}

function applyTroopGateOp(squad, op, value) {
    switch (op) {
        case '+': return squad + value;
        case '-': return Math.max(1, squad - value);
        case '×': return squad * value; // only appears when squad < 20
        case '÷': return Math.max(1, Math.ceil(squad / value));
        case '+%': return squad + Math.max(1, Math.round(squad * value / 100));
        case '-%': return Math.max(1, squad - Math.round(squad * value / 100));
    }
    return squad;
}

function spawnGate() {
    const g = game;
    const z = g.nextGateZ;
    const numOptions = Math.random() < 0.3 ? 2 : 3; // 30% chance of 2 panels
    const isWeaponGate = g.wave % 2 === 0 && g.wave >= 2;
    const options = [];

    // Generate random panel widths and positions
    const roadW = CONFIG.ROAD_HALF_WIDTH * 2;
    // Each panel gets a random width factor
    const widthFactors = [];
    for (let i = 0; i < numOptions; i++) {
        widthFactors.push(0.7 + Math.random() * 0.6); // 0.7 ~ 1.3x variation
    }
    const factorSum = widthFactors.reduce((s, f) => s + f, 0);
    const usableWidth = roadW * 0.82; // leave margins
    const panelWidths = widthFactors.map(f => (f / factorSum) * usableWidth);

    // Random gaps between panels and edges
    const gapSlack = roadW - panelWidths.reduce((s, w) => s + w, 0);
    const gaps = [];
    let gapSum = 0;
    for (let i = 0; i <= numOptions; i++) {
        const gv = Math.random() + 0.2;
        gaps.push(gv);
        gapSum += gv;
    }

    const positions = [];
    let curX = -CONFIG.ROAD_HALF_WIDTH;
    for (let i = 0; i < numOptions; i++) {
        curX += (gaps[i] / gapSum) * gapSlack;
        positions.push({ cx: curX + panelWidths[i] / 2, w: panelWidths[i] });
        curX += panelWidths[i];
    }

    if (isWeaponGate) {
        // Weapon gates: 1-2 randomly placed panels (not filling the row)
        const weaponCount = Math.random() < 0.4 ? 1 : 2;
        const allWeapons = ['shotgun', 'laser', 'rocket'];
        for (let i = allWeapons.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allWeapons[i], allWeapons[j]] = [allWeapons[j], allWeapons[i]];
        }
        const hw = CONFIG.ROAD_HALF_WIDTH;
        const placed = [];
        for (let i = 0; i < weaponCount; i++) {
            const panelW = 55 + Math.random() * 35; // 55-90 width
            const margin = panelW / 2 + 15;
            let px, attempts = 0;
            do {
                px = -hw + margin + Math.random() * (hw * 2 - margin * 2);
                attempts++;
            } while (attempts < 20 && placed.some(prev => Math.abs(prev - px) < 80));
            placed.push(px);
            options.push({
                x: px, width: panelW,
                gateType: 'weapon', weapon: allWeapons[i % allWeapons.length],
            });
        }
    } else {
        const troopOps = [];
        for (let i = 0; i < numOptions; i++) {
            troopOps.push(generateTroopGateOption(g.wave, g.squadCount, i, numOptions));
        }
        const hasGood = troopOps.some(o => isGoodOption(o, g.squadCount));
        const hasBad = troopOps.some(o => !isGoodOption(o, g.squadCount));
        if (!hasGood) troopOps[0] = { op: '+', value: 2 + Math.floor(g.wave / 4) };
        if (!hasBad) troopOps[numOptions - 1] = generateBadOption(g.wave, g.squadCount);
        for (let i = troopOps.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [troopOps[i], troopOps[j]] = [troopOps[j], troopOps[i]];
        }
        for (let i = 0; i < numOptions; i++) {
            options.push({
                x: positions[i].cx, width: positions[i].w * 0.9,
                gateType: 'troop', op: troopOps[i].op, value: troopOps[i].value,
            });
        }
    }
    g.gates.push({ z, options, triggered: false, fadeTimer: 0, chosenIdx: -1 });
    g.nextGateZ = z + 350;
}

function spawnBarrels() {
    const g = game;
    const baseZ = g.nextWaveZ - 100;
    // Random count: 1-3 barrels, more likely at higher waves
    const count = 1 + Math.floor(Math.random() * Math.min(3, 1 + Math.floor(g.wave / 3)));
    const hw = CONFIG.ROAD_HALF_WIDTH * 0.85;
    for (let i = 0; i < count; i++) {
        // Random x across road width, z slightly staggered
        const x = -hw + Math.random() * hw * 2;
        const z = baseZ + (Math.random() - 0.5) * 80;
        // Ensure not too close to existing barrels
        const tooClose = g.barrels.some(b => b.alive && Math.abs(b.x - x) < 30 && Math.abs(b.z - z) < 40);
        if (tooClose) continue;
        g.barrels.push({
            x, z,
            hp: 2, maxHp: 2, aoeDamage: 5, alive: true,
            pulsePhase: Math.random() * Math.PI * 2,
            smokeTimer: 0, chainTimer: -1,
        });
    }
}
