// ============================================================
// SPAWN FUNCTIONS (extracted from game.js)
// ============================================================

function spawnEnemyWave() {
    const g = game;
    const af = getAdaptiveFactor();
    const count = Math.min(3 + Math.ceil(g.wave * 1.5), 25);
    const rows = Math.ceil(count / 5);
    const baseZ = g.cameraZ + CONFIG.SPAWN_DISTANCE;
    // Damage scales with wave × adaptive factor; early waves deal less damage
    // 后期伤害增长更平缓：对数增长 + 软封顶
    const earlyDmgMult = g.wave <= 2 ? 0.5 : 1.0;
    const rawDmg = (1 + Math.floor(g.wave / 5)) * Math.sqrt(af) * earlyDmgMult;
    // 软封顶：超过3后增长变缓（对数衰减），后期伤害更温和
    const baseDmg = rawDmg <= 3 ? Math.ceil(rawDmg) : Math.ceil(3 + Math.log2(rawDmg - 2));
    for (let r = 0; r < rows; r++) {
        const cols = Math.min(count - r * 5, 5);
        for (let c = 0; c < cols; c++) {
            const spread = CONFIG.ROAD_HALF_WIDTH * 0.7;
            const x = cols === 1 ? 0 : -spread + (spread * 2) * c / (cols - 1);
            // HP scales with wave × adaptive factor; early waves get a soft start
            const earlyMult = g.wave <= 2 ? 0.5 : 1.0;
            const rawHp = CONFIG.ENEMY_HP + g.wave + Math.floor(g.wave * g.wave / 40);
            const baseHp = Math.ceil(rawHp * af * earlyMult);
            // Heavy enemies: chance also scaled by adaptive factor
            const heavyChance = g.wave >= 6 ? (0.12 + g.wave * 0.006) * Math.min(1.5, af) : 0;
            const isHeavy = Math.random() < heavyChance;
            // 兵种概率按层级分布，低级高概率、高级低概率，随wave递变
            // type0/2: 派大星(普通), type1: 小奶龙(中级), type3: 火焰奶龙(高级)
            const w = g.wave;
            const wt0 = Math.max(2, 10 - w * 0.3);       // 普通兵：前期主力，逐渐减少
            const wt2 = Math.max(2, 10 - w * 0.3);       // 派大星变种：同上
            const wt1 = w >= 3 ? Math.min(6, 1 + w * 0.3) : 0;  // 小奶龙：wave3+出现，逐步增多
            const wt3 = w > 10 ? Math.min(4, (w - 10) * 0.25) : 0; // 火焰奶龙：wave10+出现，缓慢增长
            const wtTotal = wt0 + wt1 + wt2 + wt3;
            const roll = Math.random() * wtTotal;
            let type;
            if (roll < wt0) type = 0;
            else if (roll < wt0 + wt2) type = 2;
            else if (roll < wt0 + wt2 + wt1) type = 1;
            else type = 3;
            const hpTypeMult = type === 1 ? 2.0 : type === 3 ? 3.5 : 1.0;
            const dmgTypeMult = type === 1 ? 1.4 : type === 3 ? 2.5 : 1.0;
            const hp = Math.ceil((isHeavy ? baseHp * 2 : baseHp) * 1.38 * hpTypeMult);
            const damage = Math.ceil((isHeavy ? baseDmg * 1.5 : baseDmg) * 1.0 * dmgTypeMult);
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

    // Boss count grows every 2 levels: 1,1,2,2,3,3,4,4...  (cap at 4)
    const bossCount = Math.min(1 + Math.floor((bossLevel - 1) / 2), 4);

    // Per-boss stat reduction: more bosses = individually weaker
    // 1→100%  2→72%  3→58%  4→50%
    const statMult = bossCount === 1 ? 1.0 : Math.max(0.45, 1.0 / Math.sqrt(bossCount * 0.85));

    const bulletCount = Math.min(g.squadCount, 8);
    const bulletDmg = 1 + Math.floor(g.squadCount / 6);
    const volleyDmg = bulletCount * bulletDmg;
    const af = getAdaptiveFactor();
    const baseDmg = 1 + Math.floor(g.wave / 6);

    // Shoot interval: each boss fires a bit slower to keep total fire rate manageable
    const baseInterval = Math.max(55, 160 - bossLevel * 15);
    const shootInterval = Math.round(baseInterval * (1 + (bossCount - 1) * 0.2));

    // Spread bosses evenly across road (wider spread with more bosses)
    const xSpread = CONFIG.ROAD_HALF_WIDTH * (bossCount > 1 ? 0.85 : 0.6);

    for (let i = 0; i < bossCount; i++) {
        let bx;
        if (bossCount === 1) {
            bx = (Math.random() - 0.5) * xSpread;
        } else {
            const t = i / (bossCount - 1); // 0..1 evenly spaced
            bx = -xSpread / 2 + t * xSpread + (Math.random() - 0.5) * 18;
        }
        const bossHp = Math.max(20, Math.ceil(volleyDmg * (12 + bossLevel * 5) * statMult));
        // 多boss时单个boss伤害+10%补偿
        const multiBossDmgMult = bossCount > 1 ? 1.1 : 1.0;
        const bossDmg = Math.max(1, Math.ceil(baseDmg * Math.sqrt(af) * statMult * multiBossDmgMult));
        const zOffset = bossCount > 1 ? (Math.random() - 0.5) * 55 : 0;

        g.enemies.push({
            x: bx,
            z: z + zOffset,
            hp: bossHp, maxHp: bossHp, alive: true,
            damage: bossDmg,
            isBoss: true, isHeavy: false,
            bossShootTimer: Math.floor(Math.random() * shootInterval), // stagger initial shots
            bossShootInterval: shootInterval,
            bossHoldZ: CONFIG.SPAWN_DISTANCE,
            animFrame: 0, animTimer: Math.random() * 500, hitFlash: 0,
            type: 0,
        });
    }
}

// PERCENT_GATE_THRESHOLD is defined in config.js

function generateTroopGateOption(wave, squad, idx, total) {
    const pool = [];

    // === 加法增益：前期加少，后期加多；小增益大概率，大增益小概率 ===
    const waveBonus = Math.floor(wave / 5); // 每5波基础值+1
    // 小加: +1~3 + waveBonus, 高权重（常见）
    pool.push({ op: '+', value: 1 + Math.floor(Math.random() * 3) + waveBonus, w: 5 });
    // 中加: +4~6 + waveBonus, wave3+解锁, 中等权重
    if (wave >= 3) {
        pool.push({ op: '+', value: 4 + Math.floor(Math.random() * 3) + waveBonus, w: 2.5 });
    }
    // 大加: +7~12 + waveBonus*2, wave8+解锁, 低权重（稀有）
    if (wave >= 8) {
        pool.push({ op: '+', value: 7 + Math.floor(Math.random() * 6) + waveBonus * 2, w: 0.8 });
    }

    // === 减法惩罚：小减大概率，大减小概率 ===
    pool.push({ op: '-', value: 1 + Math.floor(Math.random() * 2), w: 5 });   // -1~2 常见
    if (wave >= 4) {
        pool.push({ op: '-', value: 3 + Math.floor(Math.random() * 3), w: 1.0 }); // -3~5 稀有
    }

    if (squad < PERCENT_GATE_THRESHOLD) {
        // 小队伍：乘法作为翻盘机制
        if (wave >= 3) {
            pool.push({ op: '×', value: 2, w: 1.0 });    // ×2 偶尔出现
            if (wave >= 10) pool.push({ op: '×', value: 3, w: 0.2 }); // ×3 非常稀有
        }
        if (wave >= 4) {
            pool.push({ op: '÷', value: 2, w: 1.2 });
            if (wave >= 10) pool.push({ op: '÷', value: 3, w: 0.3 });
        }
    } else {
        // 大队伍：百分比门，大百分比小概率
        // 小百分比增益: +10~15%, 较常见
        pool.push({ op: '+%', value: 10 + Math.floor(Math.random() * 6), w: 2.0 });
        // 大百分比增益: +20~30%, wave8+, 稀有
        if (wave >= 8) {
            pool.push({ op: '+%', value: 20 + Math.floor(Math.random() * 11), w: 0.6 });
        }
        // 百分比惩罚
        pool.push({ op: '-%', value: 10 + Math.floor(Math.random() * 6), w: 1.5 });
        if (wave >= 10) {
            pool.push({ op: '-%', value: 20 + Math.floor(Math.random() * 6), w: 0.5 });
        }
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
        // 小百分比惩罚更常见
        const roll = Math.random();
        if (wave >= 10 && roll < 0.2) return { op: '-%', value: 20 + Math.floor(Math.random() * 6) };
        return { op: '-%', value: 10 + Math.floor(Math.random() * 6) };
    }
    // 小减法更常见，大减法和除法稀有
    const roll = Math.random();
    if (wave >= 8 && roll < 0.1) return { op: '÷', value: 3 };
    if (wave >= 4 && roll < 0.3) return { op: '÷', value: 2 };
    return { op: '-', value: 1 + Math.floor(Math.random() * Math.min(3, Math.ceil(wave / 5))) };
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
    // Mobile: always 2 panels to avoid cramping; desktop: 2 or 3
    const isMobile = _proj.isMobile;
    const numOptions = isMobile ? 2 : (Math.random() < 0.3 ? 2 : 3);
    const isWeaponGate = g.wave % 2 === 0 && g.wave >= 2 && Math.random() < 0.7; // 70% of even waves → -30%
    const options = [];

    // Generate random panel widths and positions
    // 随机决定布局：~40%概率有可通行空隙，~60%概率挤满路面
    const roadW = CONFIG.ROAD_HALF_WIDTH * 2;
    const hasPassableGaps = Math.random() < 0.4;
    const minGap = hasPassableGaps ? 30 : 0; // 有空隙时至少30单位可通行
    const widthFactors = [];
    for (let i = 0; i < numOptions; i++) {
        widthFactors.push(0.7 + Math.random() * 0.6); // 0.7 ~ 1.3x variation
    }
    const factorSum = widthFactors.reduce((s, f) => s + f, 0);
    // 有空隙时面板占55-65%，挤满时占80-85%
    const usableRatio = hasPassableGaps ? (0.55 + Math.random() * 0.1) : (0.80 + Math.random() * 0.05);
    const usableWidth = roadW * usableRatio;
    const panelWidths = widthFactors.map(f => (f / factorSum) * usableWidth);

    const totalPanelW = panelWidths.reduce((s, w) => s + w, 0);
    const totalGapSpace = roadW - totalPanelW;
    const innerGapCount = Math.max(0, numOptions - 1);
    const reservedGap = innerGapCount * minGap;
    const freeGap = Math.max(0, totalGapSpace - reservedGap);
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
        curX += (gaps[i] / gapSum) * freeGap + (i > 0 ? minGap : 0);
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
        // 保证至少一个好门；允许多个坏门同列出现
        const hasGood = troopOps.some(o => isGoodOption(o, g.squadCount));
        if (!hasGood) troopOps[0] = { op: '+', value: 2 + Math.floor(g.wave / 4) };
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
