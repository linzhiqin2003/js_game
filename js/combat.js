// ============================================================
// TALENT HELPERS — read live from playerData
// ============================================================
function getTalentDamageMult() { return 1 + (playerData.talents.damage || 0) * 0.15; }
function getTalentFireRateMult() { return 1 - (playerData.talents.fireRate || 0) * 0.08; }
function getTalentAoeMult()      { return 1 + (playerData.talents.aoe     || 0) * 0.25; }
function getTalentSquadBonus()   { return playerData.talents.squad || 0; }

// ============================================================
// WEAPON FIRING
// ============================================================
function fireWeapon() {
    const g = game;
    switch (g.weapon) {
        case 'invincibility': return; // 无敌状态不开枪，保持护盾效果
        case 'pistol': {
            const squad = g.squadCount;
            // More squad = more bullets (up to 8) + higher damage per bullet
            const bulletCount = Math.min(squad, 8);
            const pistolDmg = Math.max(1, Math.round((1 + Math.floor(squad / 6)) * getTalentDamageMult()));
            for (let i = 0; i < bulletCount; i++) {
                let bx, bz;
                if (i === 0) { bx = g.player.x; bz = g.cameraZ + 10; }
                else {
                    const row = Math.ceil(i / 3), col = ((i - 1) % 3) - 1;
                    bx = g.player.x + col * 25; bz = g.cameraZ + 10 + row * 20;
                }
                const angle = (bx - g.player.x) * 0.0004;
                g.bullets.push({ x: bx, z: bz, vx: Math.sin(angle) * CONFIG.BULLET_SPEED, vz: Math.cos(angle) * CONFIG.BULLET_SPEED, weapon: 'pistol', damage: pistolDmg });
            }
            playSound('shoot'); break;
        }
        case 'shotgun': {
            // Squad scales: pellet count 5→12, damage 1→3, range 250→400
            const squad = g.squadCount;
            const pellets = Math.min(5 + Math.floor(squad / 2), 12);
            const sgDmg = Math.max(1, Math.round((1 + Math.floor(squad / 4)) * getTalentDamageMult()));
            const sgRange = 250 + squad * 15;
            const spread = 0.25 + Math.min(squad * 0.02, 0.15); // wider spread with more squad
            for (let i = 0; i < pellets; i++) {
                const angle = -spread + 2 * spread * i / (pellets - 1) + (Math.random() - 0.5) * 0.06;
                const speed = CONFIG.BULLET_SPEED * (0.8 + Math.random() * 0.15);
                g.bullets.push({ x: g.player.x, z: g.cameraZ + 10, vx: Math.sin(angle) * speed, vz: Math.cos(angle) * speed, weapon: 'shotgun', damage: sgDmg, maxRange: sgRange, startZ: g.cameraZ + 10 });
            }
            playSound('shoot_shotgun'); break;
        }
        case 'laser': {
            // Squad scales: beam count 1→3, damage 1→4
            const lSquad = g.squadCount;
            const beamCount = Math.min(1 + Math.floor(lSquad / 3), 3);
            const lDmg = Math.max(1, Math.round((1 + Math.floor(lSquad / 3)) * getTalentDamageMult()));
            for (let b = 0; b < beamCount; b++) {
                const offsetX = beamCount === 1 ? 0 : (b - (beamCount - 1) / 2) * 30;
                g.bullets.push({ x: g.player.x + offsetX, z: g.cameraZ + 10, vx: 0, vz: CONFIG.BULLET_SPEED * 2.5, weapon: 'laser', damage: lDmg, pierce: true, hitEnemies: new Set() });
            }
            playSound('shoot_laser'); break;
        }
        case 'rocket': {
            const rSquad = g.squadCount;
            const rocketCount = rSquad >= 15 ? 3 : rSquad >= 6 ? 2 : 1;
            const rDmg = Math.max(1, Math.round((3 + Math.floor(rSquad / 2)) * getTalentDamageMult()));
            const rAoe = Math.min(150, Math.round((50 + rSquad * 5) * getTalentAoeMult()));
            for (let r = 0; r < rocketCount; r++) {
                const offsetX = rocketCount === 1 ? 0 : (r - (rocketCount - 1) / 2) * 30;
                g.bullets.push({ x: g.player.x + offsetX, z: g.cameraZ + 10, vx: 0, vz: CONFIG.BULLET_SPEED * 0.8, weapon: 'rocket', damage: rDmg, aoeRadius: rAoe });
            }
            playSound('shoot_rocket'); break;
        }
    }
    g.player.muzzleFlash = 4;
}

// ============================================================
// PARTICLES / EXPLOSIONS
// ============================================================
function addParticles(x, z, count, color, speed, life) {
    for (let i = 0; i < count; i++) {
        game.particles.push({
            x, z, vx: (Math.random() - 0.5) * speed, vz: (Math.random() - 0.5) * speed,
            vy: -Math.random() * speed * 1.5, y: 0,
            life: life * (0.5 + Math.random() * 0.5), maxLife: life,
            color, size: 2 + Math.random() * 3,
        });
    }
}

function addExplosion(x, z) {
    game.explosions.push({ x, z, timer: 0, maxTimer: 20 });
    addParticles(x, z, 12, 0xf0a020, 3, 25);
    addParticles(x, z, 6, 0xff4020, 2, 18);
    addParticles(x, z, 4, 0x333333, 1.5, 30);
    addParticles(x, z, 3, 0xffffff, 4, 6); // brief white flash sparks
}

function explodeBarrel(br) {
    const g = game;
    if (!br.alive) return;
    br.alive = false;
    g.score += 25;

    // Triple explosion burst
    addExplosion(br.x, br.z);
    addExplosion(br.x - 15, br.z + 10);
    addExplosion(br.x + 15, br.z - 10);
    // Extra fire particles
    addParticles(br.x, br.z, 20, 0xff6600, 4, 30);
    addParticles(br.x, br.z, 10, 0xffcc00, 3, 20);

    playSound('explosion');
    g.shakeTimer = Math.max(g.shakeTimer, 14);
    g.screenFlash = Math.max(g.screenFlash, 0.6);

    // "BOOM!" floating text
    const brP = project(br.x, br.z - g.cameraZ);
    g.barrelExplosionTexts.push({
        text: 'BOOM!', x: brP.x, y: brP.y,
        color: 0xff6600, scale: 0.3,
        timer: 0, maxTimer: 55,
    });

    // Blast radius ring visual
    g.explosions.push({ x: br.x, z: br.z, timer: 0, maxTimer: 25, isBlastRing: true });

    // AOE damage
    const aoeRadius = 55;
    g.enemies.forEach(e => {
        if (!e.alive) return;
        if (Math.abs(e.x - br.x) < aoeRadius && Math.abs(e.z - br.z) < aoeRadius) {
            e.hp -= br.aoeDamage;
            e.hitFlash = 6;
            addDamageNumber(e.x, e.z, br.aoeDamage, 0xff8800);
            if (e.hp <= 0) {
                const killScore = e.isBoss ? 100 : e.isHeavy ? 25 : 10;
                e.alive = false; g.score += killScore; g.killCount++;
                addExplosion(e.x, e.z);
                g.deadBodies.push({ x: e.x, z: e.z, timer: 300 });
                g.comboCount++; g.comboTimer = CONFIG.COMBO_TIMEOUT;
                g.bestCombo = Math.max(g.bestCombo, g.comboCount);
                if (e.isBoss) spawnBossCoins(e.x, e.z);
            }
        }
    });

    // Chain reaction to nearby barrels
    g.barrels.forEach(otherBr => {
        if (otherBr === br || !otherBr.alive || otherBr.chainTimer >= 0) return;
        if (Math.abs(otherBr.x - br.x) < aoeRadius && Math.abs(otherBr.z - br.z) < aoeRadius) {
            otherBr.chainTimer = 8;
        }
    });
}

function spawnBossCoins(x, z) {
    const g = game;
    const bossLvl = Math.floor(g.wave / 5);
    // 前期概率小后期概率大: wave5=50%, wave10=70%, wave15=85%, wave20+=90%
    const coinDropChance = Math.min(0.90, 0.3 + bossLvl * 0.2);
    if (Math.random() > coinDropChance) return;
    // 多boss时每个boss掉落减少，总量保持合理
    const bossCount = Math.min(1 + Math.floor((bossLvl - 1) / 2), 4);
    const perBossMult = bossCount === 1 ? 1.0 : Math.max(0.3, 0.7 / bossCount);
    // 前期少后期多，但增长更平缓
    const baseCoinCount = COIN_DROP_BASE + Math.min(bossLvl * COIN_DROP_PER_LEVEL, 15);
    const coinCount = Math.max(1, Math.round(baseCoinCount * perBossMult));
    // 落到玩家附近（boss死时玩家在 cameraZ+10），向玩家方向抛
    const playerZ = g.cameraZ + 10;
    for (let ci = 0; ci < coinCount; ci++) {
        // 向玩家方向散射，而不是在boss位置散射
        const targetX = g.player.x + (Math.random() - 0.5) * 80;
        const targetZ = playerZ + 20 + Math.random() * 60;
        g.coins.push({
            x: x + (Math.random() - 0.5) * 30,
            z: z,
            vx: (targetX - x) * 0.03 + (Math.random() - 0.5) * 1,
            vz: (targetZ - z) * 0.04,
            vy: -3 - Math.random() * 3,
            y: 0,
            value: 1,
            life: 600,
            bobPhase: Math.random() * Math.PI * 2,
            sparkle: Math.random(),
        });
    }
}

function spawnBossGems(x, z) {
    const g = game;
    const bossLvl = Math.floor(g.wave / 5);
    // 多boss时只有最后一个boss掉宝石（每波最多1次宝石掉落）
    const bossCount = Math.min(1 + Math.floor((bossLvl - 1) / 2), 4);
    const aliveBosses = g.enemies.filter(e => e.alive && e.isBoss).length;
    // 只在最后一个boss死亡时才有机会掉宝石
    if (aliveBosses > 1) return;
    // 概率掉落：wave5=20%, wave10=40%, wave15=55%, wave20=65%, wave25+=75%
    const gemDropChance = Math.min(0.75, 0.0 + bossLvl * 0.2);
    if (Math.random() > gemDropChance) return;
    // 前期少后期多: wave5=1, wave10=1, wave15=1~2, wave20+=1~2
    const count = bossLvl <= 2 ? 1 : (Math.random() < 0.65 ? 1 : 2);
    // 向玩家方向抛，确保能捡到
    const playerZ = g.cameraZ + 10;
    for (let i = 0; i < count; i++) {
        const targetX = g.player.x + (Math.random() - 0.5) * 50;
        const targetZ = playerZ + 10 + Math.random() * 40;
        g.gems.push({
            x: x + (Math.random() - 0.5) * 20,
            z: z,
            vx: (targetX - x) * 0.03 + (Math.random() - 0.5) * 0.5,
            vz: (targetZ - z) * 0.04,
            vy: -6 - Math.random() * 3,
            y: 0,
            value: 1,
            life: 800,
            bobPhase: Math.random() * Math.PI * 2,
        });
    }
}

function addDamageNumber(x, z, value, color) {
    game.damageNumbers.push({
        x, z, value, color: color || 0xffffff,
        life: 50, maxLife: 50, offsetY: 0,
    });
}

function addScorePopup(text, sx, sy, color) {
    game.scorePopups.push({
        text, x: sx, y: sy, color: color || 0xffcc00,
        life: 45, maxLife: 45,
    });
}
