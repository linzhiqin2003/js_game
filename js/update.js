function update(dt) {
    const g = game;
    if (g.state !== 'playing') return;

    // Keyboard
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) g.inputX = g.player.x - CONFIG.PLAYER_SPEED * 10;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) g.inputX = g.player.x + CONFIG.PLAYER_SPEED * 10;

    // Slow-mo processing
    if (g.slowMo > 0) {
        g.slowMo -= dt;
        g.slowMoFactor = 0.3;
    } else {
        g.slowMoFactor = 1.0;
    }

    // Pause camera when a boss is alive — fight before moving on
    const bossAlive = g.enemies.some(e => e.alive && e.isBoss);
    if (!bossAlive) {
        g.cameraZ += CONFIG.CAMERA_SPEED * g.slowMoFactor;
    }

    if (g.inputX !== null) {
        g.player.x += (g.inputX - g.player.x) * 0.12;
    }
    g.player.x = Math.max(-CONFIG.ROAD_HALF_WIDTH + 15, Math.min(CONFIG.ROAD_HALF_WIDTH - 15, g.player.x));

    g.player.animFrame += 0.3;
    g.player.muzzleFlash = Math.max(0, g.player.muzzleFlash - 1);

    // Weapon timer
    if (g.weapon !== 'pistol' && g.weaponTimer > 0) {
        g.weaponTimer -= dt;
        if (g.weaponTimer <= 0) {
            const expiredWeapon = g.weapon;
            g.weapon = 'pistol'; g.weaponTimer = 0;
            // Start shared cooldown when any shop weapon expires
            if (SHOP_WEAPONS[expiredWeapon]) {
                g.skillCooldown = SKILL_SHARED_COOLDOWN * 1000;
                g.skillReady = false;
            }
        }
    }

    // Shared cooldown timer (applies to ALL weapons)
    if (g.skillCooldown > 0) {
        g.skillCooldown -= dt;
        if (g.skillCooldown <= 0) {
            g.skillCooldown = 0;
            const hasCharges = Object.values(playerData.weaponCharges || {}).some(c => c > 0);
            g.skillReady = hasCharges;
        }
    }

    // Auto-shoot
    g.shootTimer -= dt;
    const fireInterval = (g.weapon === 'pistol' ? 90 : CONFIG.SHOOT_INTERVAL * WEAPON_DEFS[g.weapon].fireRateMult) * getTalentFireRateMult();
    if (g.shootTimer <= 0) { g.shootTimer = fireInterval; fireWeapon(); }

    // Bullets
    g.bullets.forEach(b => {
        b.x += b.vx * g.slowMoFactor; b.z += b.vz * g.slowMoFactor;
        // Rocket smoke trail
        if (b.weapon === 'rocket' && Math.random() < 0.4) {
            g.particles.push({
                x: b.x + (Math.random() - 0.5) * 4, z: b.z - 3,
                vx: (Math.random() - 0.5) * 0.3, vz: -0.2,
                vy: -0.5 - Math.random() * 0.3, y: 0,
                life: 10 + Math.random() * 6, maxLife: 16,
                color: 0x888888, size: 2 + Math.random() * 2,
            });
        }
    });
    g.bullets = g.bullets.filter(b => {
        if (b.dead) return false;
        if (b.z - g.cameraZ > CONFIG.SPAWN_DISTANCE + 100 || b.z < g.cameraZ - 10) return false;
        if (b.maxRange && b.z - b.startZ > b.maxRange) return false;
        return true;
    });
    const bulletLimit = _proj.isMobile ? 120 : 300;
    if (g.bullets.length > bulletLimit) g.bullets.splice(0, g.bullets.length - Math.floor(bulletLimit * 0.7));

    // Bullet-enemy collision
    g.bullets.forEach(b => {
        if (b.dead) return;
        for (let e of g.enemies) {
            if (!e.alive) continue;
            if (b.pierce && b.hitEnemies && b.hitEnemies.has(e)) continue;
            const dx = Math.abs(b.x - e.x), dz = Math.abs(b.z - e.z);
            const hitX = b.weapon === 'rocket' ? 28 : 22, hitZ = b.weapon === 'rocket' ? 20 : 16;
            if (dx < hitX && dz < hitZ) {
                e.hp -= (b.damage || 1);
                e.hitFlash = 4;
                playSound('hit');
                addParticles(e.x, e.z, 3, 0xffaa00, 2, 10);
                addDamageNumber(e.x, e.z, b.damage || 1);

                if (b.pierce && b.hitEnemies) { b.hitEnemies.add(e); }
                else if (b.aoeRadius) {
                    b.dead = true;
                    addExplosion(b.x, b.z);
                    g.shakeTimer = 8; g.screenFlash = 0.3;
                    playSound('explosion');
                    g.enemies.forEach(other => {
                        if (!other.alive || other === e) return;
                        const adx = Math.abs(other.x - b.x), adz = Math.abs(other.z - b.z);
                        if (adx < b.aoeRadius && adz < b.aoeRadius) {
                            // Distance falloff: center=100%, edge=30%
                            const dist = Math.sqrt(adx * adx + adz * adz);
                            const falloff = Math.max(0.3, 1 - dist / b.aoeRadius * 0.7);
                            const aoeDmg = Math.max(1, Math.floor((b.damage || 1) * falloff));
                            other.hp -= aoeDmg; other.hitFlash = 4;
                            if (other.hp <= 0) {
                                const ks = other.isMegaBoss ? 300 : other.isBoss ? 100 : other.isHeavy ? 25 : 10;
                                other.alive = false; g.score += ks; g.killCount++;
                                addExplosion(other.x, other.z);
                                g.deadBodies.push({ x: other.x, z: other.z, timer: 300 });
                                if (other.isBoss) {
                            spawnBossCoins(other.x, other.z); spawnBossGems(other.x, other.z);
                            if (other.isMegaBoss) spawnBossCoins(other.x, other.z); // mega boss double coins
                            const stillBossAlive = g.enemies.some(o => o !== other && o.alive && o.isBoss);
                            if (!stillBossAlive) g.enemyBullets = [];
                        }
                            }
                        }
                    });
                } else { b.dead = true; }

                if (e.hp <= 0) {
                    const killScore = e.isMegaBoss ? 300 : e.isBoss ? 100 : e.isHeavy ? 25 : 10;
                    e.alive = false; g.score += killScore; g.killCount++;
                    g.comboCount++; g.comboTimer = CONFIG.COMBO_TIMEOUT;
                    if (g.comboCount > g.bestCombo) g.bestCombo = g.comboCount;
                    addExplosion(e.x, e.z);
                    g.deadBodies.push({ x: e.x, z: e.z, timer: 300 });
                    playSound('explosion');
                    const ep = project(e.x, e.z - g.cameraZ);
                    if (e.isMegaBoss) {
                        // Mega boss death: massive explosion cascade
                        for (let mi = 0; mi < 5; mi++) {
                            addExplosion(e.x + (Math.random() - 0.5) * 60, e.z + (Math.random() - 0.5) * 60);
                        }
                        addParticles(e.x, e.z, 60, 0xff4400, 8, 45);
                        addParticles(e.x, e.z, 30, 0xffaa00, 6, 35);
                        addParticles(e.x, e.z, 20, 0xffffff, 5, 25);
                        g.shakeTimer = 35; g.screenFlash = 0.9;
                        g.slowMo = 400;
                        addScorePopup(`🔥 大龙王 +${killScore}!`, ep.x, ep.y - 40, 0xff4400);
                        // Extra loot — more coins and guaranteed gems
                        spawnBossCoins(e.x, e.z);
                        spawnBossCoins(e.x, e.z); // double coins
                        spawnBossGems(e.x, e.z);
                        const otherBossAlive = g.enemies.some(o => o !== e && o.alive && o.isBoss);
                        if (!otherBossAlive) g.enemyBullets = [];
                    } else if (e.isBoss) {
                        // Boss death: big explosion + extra particles + strong shake
                        addExplosion(e.x + 20, e.z + 15);
                        addExplosion(e.x - 20, e.z - 15);
                        addParticles(e.x, e.z, 40, 0xcc66ff, 6, 35);
                        addParticles(e.x, e.z, 20, 0xffffff, 4, 25);
                        g.shakeTimer = 25; g.screenFlash = 0.6;
                        addScorePopup(`大奶龙 +${killScore}!`, ep.x, ep.y - 30, 0xcc66ff);
                        // Drop coins + gems per boss
                        spawnBossCoins(e.x, e.z);
                        spawnBossGems(e.x, e.z);
                        // Only clear bullets when the LAST boss dies
                        const otherBossAlive = g.enemies.some(o => o !== e && o.alive && o.isBoss);
                        if (!otherBossAlive) g.enemyBullets = [];
                    } else {
                        g.shakeTimer = 5;
                        addScorePopup(`+${killScore}`, ep.x, ep.y - 20, e.isHeavy ? 0xff8800 : 0xffcc00);
                    }
                }
                if (!b.pierce) break;
            }
        }
    });
    g.bullets = g.bullets.filter(b => !b.dead);

    // Bullet-barrel collision
    g.bullets.forEach(b => {
        if (b.dead) return;
        for (let br of g.barrels) {
            if (!br.alive) continue;
            if (Math.abs(b.x - br.x) < 18 && Math.abs(b.z - br.z) < 15) {
                br.hp--;
                addParticles(br.x, br.z, 3, 0xff8800, 2, 10);
                if (!b.pierce) b.dead = true;
                if (br.hp <= 0) explodeBarrel(br);
                if (!b.pierce) break;
            }
        }
    });
    g.bullets = g.bullets.filter(b => !b.dead);

    // Enemies
    g.enemies.forEach(e => {
        if (!e.alive) return;
        e.animFrame += 0.2;
        e.hitFlash = Math.max(0, e.hitFlash - 1);
        const playerZ = g.cameraZ + 10;

        if (e.isBoss) {
            // === BOSS AI: locked at far range, remote attack only ===
            // Hard-lock to hold distance — never drift closer
            e.z = playerZ + e.bossHoldZ;

            // Lateral tracking with separation — bosses avoid overlapping
            const otherBosses = g.enemies.filter(b => b.alive && b.isBoss && b !== e);
            // Repulsion from other bosses
            let repelX = 0;
            const minSep = 80; // 最小间距
            for (const ob of otherBosses) {
                const sep = e.x - ob.x;
                const absSep = Math.abs(sep);
                if (absSep < minSep) {
                    // 越近推力越大
                    const force = (minSep - absSep) / minSep * 0.6;
                    repelX += (sep === 0 ? (Math.random() - 0.5) : Math.sign(sep)) * force;
                }
            }
            // Track player loosely
            const lateralDx = g.player.x - e.x;
            const trackSpeed = otherBosses.length > 0 ? 0.2 : 0.3; // 多boss时追踪更慢
            const deadZone = otherBosses.length > 0 ? 40 : 25; // 多boss时死区更大
            let moveX = 0;
            if (Math.abs(lateralDx) > deadZone) {
                moveX = Math.sign(lateralDx) * trackSpeed;
            }
            // Combine tracking + separation, clamp to road
            e.x += moveX + repelX;
            e.x = Math.max(-CONFIG.ROAD_HALF_WIDTH * 0.85, Math.min(CONFIG.ROAD_HALF_WIDTH * 0.85, e.x));
            // Ranged attack: shoot at player from far range
            e.bossShootTimer++;
            if (e.bossShootTimer >= e.bossShootInterval) {
                e.bossShootTimer = 0;
                const dx = g.player.x - e.x;
                const dz = playerZ - e.z;
                const dist = Math.sqrt(dx * dx + dz * dz) || 1;
                const bossLvl = Math.floor(g.wave / 5);
                const mobileScale = _proj.isMobile ? 0.9 : 1.0; // 移动端子弹速度微降10%
                const speed = Math.min(5.2, 2.6 + bossLvl * 0.52) * mobileScale;
                // Main shot aimed at player
                g.enemyBullets.push({
                    x: e.x, z: e.z,
                    vx: dx / dist * speed, vz: dz / dist * speed,
                    damage: e.damage, life: 300,
                    type: 'aimed', color: 0xff3333,
                });
                // Spread shots only at boss level 3+ (wave 15+)
                if (bossLvl >= 3) {
                    for (let s = -1; s <= 1; s += 2) {
                        const angle = Math.atan2(dz, dx) + s * 0.25;
                        g.enemyBullets.push({
                            x: e.x, z: e.z,
                            vx: Math.cos(angle) * speed * 0.85, vz: Math.sin(angle) * speed * 0.85,
                            damage: Math.max(1, e.damage - 1), life: 250,
                            type: 'spread', color: 0xff6644,
                        });
                    }
                }
                // Muzzle flash particles
                addParticles(e.x, e.z, 4, e.isMegaBoss ? 0xff2200 : 0xff4444, 3, 10);
            }

            // === MEGA BOSS SKILL SYSTEM ===
            if (e.isMegaBoss) {
                e.megaSkillTimer++;
                if (e.megaSkillTimer >= e.megaSkillCooldown) {
                    e.megaSkillTimer = 0;
                    const skill = e.megaNextSkill % 3;
                    e.megaNextSkill++;

                    if (skill === 0) {
                        // --- FLAME BREATH: fan of fire projectiles ---
                        const fanCount = 7 + Math.min(e.megaLevel, 5) * 2;
                        const fanSpread = 0.6 + e.megaLevel * 0.05;
                        const mobileScale = _proj.isMobile ? 0.9 : 1.0;
                        const fSpeed = Math.min(4.5, 2.2 + e.megaLevel * 0.3) * mobileScale;
                        for (let fi = 0; fi < fanCount; fi++) {
                            const angle = -fanSpread + 2 * fanSpread * fi / (fanCount - 1);
                            const baseAngle = Math.atan2(playerZ - e.z, g.player.x - e.x);
                            const finalAngle = baseAngle + angle;
                            g.enemyBullets.push({
                                x: e.x, z: e.z,
                                vx: Math.cos(finalAngle) * fSpeed,
                                vz: Math.sin(finalAngle) * fSpeed,
                                damage: Math.max(1, e.damage - 1), life: 200,
                                type: 'flame', color: 0xff6600,
                            });
                        }
                        addParticles(e.x, e.z, 20, 0xff4400, 5, 20);
                        addParticles(e.x, e.z, 10, 0xffaa00, 4, 15);
                        g.shakeTimer = Math.max(g.shakeTimer, 10);
                        // Warning text
                        const bp = project(e.x, e.z - g.cameraZ);
                        addScorePopup('🔥 火焰吐息!', bp.x, bp.y - 40, 0xff4400);
                    } else if (skill === 1) {
                        // --- SUMMON MINIONS: spawn a small squad of enemies ---
                        if (e.megaSummonCount < 3 + e.megaLevel) {
                            e.megaSummonCount++;
                            const summonCount = 3 + Math.min(e.megaLevel, 4);
                            const summonZ = e.z - 30;
                            const af2 = getAdaptiveFactor();
                            for (let si = 0; si < summonCount; si++) {
                                const sx = e.x + (si - (summonCount - 1) / 2) * 40 + (Math.random() - 0.5) * 15;
                                const rawHp = CONFIG.ENEMY_HP + g.wave * 0.6;
                                const summonHp = Math.ceil(rawHp * af2 * 0.7 * 1.38);
                                const summonDmg = Math.max(1, Math.ceil((1 + Math.floor(g.wave / 8)) * 0.8));
                                g.enemies.push({
                                    x: sx, z: summonZ + (Math.random() - 0.5) * 20,
                                    hp: summonHp, maxHp: summonHp, alive: true,
                                    damage: summonDmg, isHeavy: false,
                                    animFrame: 0, animTimer: Math.random() * 500, hitFlash: 0,
                                    type: Math.random() < 0.5 ? 0 : 1,
                                });
                            }
                            // Summon visual
                            addParticles(e.x, summonZ, 15, 0xcc44ff, 4, 18);
                            g.shakeTimer = Math.max(g.shakeTimer, 6);
                            const bp2 = project(e.x, e.z - g.cameraZ);
                            addScorePopup('👹 召唤小兵!', bp2.x, bp2.y - 40, 0xcc44ff);
                        } else {
                            // Max summons reached, do flame breath instead
                            e.megaSkillTimer = e.megaSkillCooldown - 20; // quick retry with next skill
                        }
                    } else if (skill === 2) {
                        // --- GROUND SLAM: shockwave dealing squad damage ---
                        const slamDmg = Math.max(1, Math.ceil(e.damage * 0.6));
                        if (g.weapon !== 'invincibility') {
                            const squadArmor = Math.min(2, Math.floor(g.squadCount / 15));
                            const finalDmg = Math.max(1, slamDmg - (playerData.armor || 0) - squadArmor);
                            g.squadCount = Math.max(0, g.squadCount - finalDmg);
                            g.gateText = { text: `⚡ 震地冲击 −${finalDmg}!`, color: 0xff2222, timer: 0, maxTimer: 80, scale: 0.1 };
                            g.gateFlash = { color: 0xff2222, timer: 18, maxTimer: 18 };
                            if (g.squadCount <= 0) { g.state = 'gameover'; showGameOver(); }
                        } else {
                            addParticles(g.player.x, playerZ, 10, 0xffdd44, 3, 12);
                            g.gateText = { text: '⚡ 震地冲击 (抵挡!)', color: 0xffdd44, timer: 0, maxTimer: 70, scale: 0.1 };
                        }
                        // Visual: big shockwave ring from boss
                        g.explosions.push({ x: e.x, z: e.z, timer: 0, maxTimer: 35, isBlastRing: true });
                        addParticles(e.x, e.z, 25, 0xff4444, 6, 25);
                        addParticles(g.player.x, playerZ, 12, 0xff6644, 4, 15);
                        g.shakeTimer = Math.max(g.shakeTimer, 22);
                        g.vignetteFlash = Math.min(1.5, 0.9);
                        g.screenFlash = Math.max(g.screenFlash, 0.4);
                        // Speed lines for shockwave
                        const pp = project(g.player.x, 0);
                        for (let s = 0; s < 20; s++) {
                            const a = (s / 20) * Math.PI * 2;
                            const spd = 7 + Math.random() * 7;
                            g.speedLines.push({
                                x: pp.x, y: pp.y,
                                vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
                                life: 10 + Math.random() * 8, maxLife: 18,
                                length: 20 + Math.random() * 25, color: 0xff4444,
                            });
                        }
                        playSound('explosion');
                    }
                }
            }
        } else {
            // === Normal enemy AI ===
            const af = getAdaptiveFactor();
            const speedMult = 1 + (af - 1) * 0.25; // subtle: af=2 → only 1.25x speed
            const mobileSpeedScale = _proj.isMobile ? 0.9 : 1.0; // 移动端敌人速度微降10%
            e.z -= (CONFIG.ENEMY_SPEED + g.wave * 0.012) * speedMult * g.slowMoFactor * mobileSpeedScale;
            const lateralDx = g.player.x - e.x;
            if (Math.abs(lateralDx) > 15) {
                const blocked = g.enemies.some(o => o !== e && o.alive && Math.abs(o.x - e.x) < 35 && o.z < e.z && o.z > e.z - 60);
                if (!blocked) e.x += Math.sign(lateralDx) * (CONFIG.ENEMY_LATERAL_SPEED + g.wave * 0.008) * mobileSpeedScale;
            }
        }
        e.x = Math.max(-CONFIG.ROAD_HALF_WIDTH + 10, Math.min(CONFIG.ROAD_HALF_WIDTH - 10, e.x));
        // Enemy reaches player — check proximity to player position
        const dzToPlayer = e.z - playerZ;
        const dxToPlayer = Math.abs(e.x - g.player.x);
        // Close contact: enemy touches player squad directly
        const closeContact = dzToPlayer < 15 && dzToPlayer > -30 && dxToPlayer < 40;
        // Passed through: enemy got behind the player line (breached defense)
        const passedThrough = e.z <= g.cameraZ - 20;
        if (closeContact || passedThrough) {
            // Enemy reaches/passes player — die and cost squad based on enemy damage
            e.alive = false;
            if (g.state !== 'gameover') {
                if (g.weapon === 'invincibility') {
                    // 无敌状态：偏转特效，不扣兵力
                    addParticles(e.x, e.z, 10, 0xffdd44, 3, 12);
                } else {
                const rawDmg = e.damage || 1;
                // 兵力越多防御越高：每15人+1减伤，最多+2
                const squadArmor = Math.min(2, Math.floor(g.squadCount / 15));
                const dmg = Math.max(1, rawDmg - (playerData.armor || 0) - squadArmor);
                g.squadCount = Math.max(0, g.squadCount - dmg);

                // --- Troop loss visual effects (mirror of gate "+兵力" effect) ---
                const lossColor = 0xff3333;

                // 1. Big floating text: "-X 兵力"
                g.gateText = { text: `−${dmg} 兵力`, color: lossColor, timer: 0, maxTimer: 70, scale: 0.1 };

                // 2. Screen red flash
                g.gateFlash = { color: lossColor, timer: 15, maxTimer: 15 };

                // 3. Red shatter pieces flying outward from player
                const playerP = project(g.player.x, 0);
                for (let f = 0; f < 15 + dmg * 5; f++) {
                    const angle = Math.random() * Math.PI * 2;
                    const spd = 3 + Math.random() * 5;
                    g.gateShatterPieces.push({
                        x: playerP.x + (Math.random() - 0.5) * 40,
                        y: playerP.y + (Math.random() - 0.5) * 30,
                        targetX: playerP.x + Math.cos(angle) * 200,
                        targetY: playerP.y + Math.sin(angle) * 200,
                        vx: Math.cos(angle) * spd,
                        vy: Math.sin(angle) * spd,
                        size: 2 + Math.random() * 4,
                        color: lossColor,
                        life: 20 + Math.random() * 15,
                        maxLife: 35,
                    });
                }

                // 4. Red speed lines radiating from player
                for (let s = 0; s < 16; s++) {
                    const angle = (s / 16) * Math.PI * 2;
                    const spd = 6 + Math.random() * 6;
                    g.speedLines.push({
                        x: playerP.x, y: playerP.y,
                        vx: Math.cos(angle) * spd,
                        vy: Math.sin(angle) * spd,
                        life: 10 + Math.random() * 8,
                        maxLife: 18,
                        length: 20 + Math.random() * 25,
                        color: lossColor,
                    });
                }

                // 5. Explosion particles + shake + vignette
                addParticles(e.x, e.z, 8 + dmg * 2, 0xff0000, 2.5, 18);
                g.shakeTimer = Math.min(20, 8 + dmg * 3);
                g.vignetteFlash = Math.min(1.5, 0.8 + dmg * 0.15);
                g.slowMo = 150;
                playSound('explosion');
                if (g.squadCount <= 0) { g.state = 'gameover'; showGameOver(); }
                } // end else (not invincible)
            }
        }
    });

    // Enemy bullets (boss projectiles)
    g.enemyBullets.forEach(eb => {
        eb.x += eb.vx * g.slowMoFactor;
        eb.z += eb.vz * g.slowMoFactor;
        eb.life--;
        if (eb.life <= 0) { eb.dead = true; return; }
        // Off-screen cleanup
        const relZ = eb.z - g.cameraZ;
        if (relZ < -50 || relZ > CONFIG.SPAWN_DISTANCE + 100 ||
            Math.abs(eb.x) > CONFIG.ROAD_HALF_WIDTH + 50) {
            eb.dead = true; return;
        }
        // Hit player?
        const pz = g.cameraZ + 10;
        if (Math.abs(eb.z - pz) < 18 && Math.abs(eb.x - g.player.x) < 30) {
            eb.dead = true;
            if (g.state !== 'gameover') {
                if (g.weapon === 'invincibility') {
                    // 无敌状态：偏转特效，不扣兵力
                    addParticles(g.player.x, pz, 10, 0xffdd44, 3, 12);
                    g.shakeTimer = Math.min(g.shakeTimer, 3);
                } else {
                const rawDmg = eb.damage || 1;
                // 兵力越多防御越高：每15人+1减伤，最多+2
                const squadArmor = Math.min(2, Math.floor(g.squadCount / 15));
                const dmg = Math.max(1, rawDmg - (playerData.armor || 0) - squadArmor);
                g.squadCount = Math.max(0, g.squadCount - dmg);
                const hitColor = 0xff3333;
                g.gateText = { text: `−${dmg} 兵力`, color: hitColor, timer: 0, maxTimer: 70, scale: 0.1 };
                g.gateFlash = { color: hitColor, timer: 12, maxTimer: 12 };
                const pp = project(g.player.x, 0);
                for (let f = 0; f < 10 + dmg * 3; f++) {
                    const a = Math.random() * Math.PI * 2;
                    g.gateShatterPieces.push({
                        x: pp.x + (Math.random() - 0.5) * 30,
                        y: pp.y + (Math.random() - 0.5) * 20,
                        targetX: pp.x + Math.cos(a) * 150,
                        targetY: pp.y + Math.sin(a) * 150,
                        vx: Math.cos(a) * (3 + Math.random() * 4),
                        vy: Math.sin(a) * (3 + Math.random() * 4),
                        size: 2 + Math.random() * 3, color: hitColor,
                        life: 15 + Math.random() * 12, maxLife: 27,
                    });
                }
                for (let s = 0; s < 12; s++) {
                    const a = (s / 12) * Math.PI * 2;
                    g.speedLines.push({
                        x: pp.x, y: pp.y,
                        vx: Math.cos(a) * (5 + Math.random() * 5),
                        vy: Math.sin(a) * (5 + Math.random() * 5),
                        life: 8 + Math.random() * 6, maxLife: 14,
                        length: 15 + Math.random() * 20, color: hitColor,
                    });
                }
                addParticles(g.player.x, pz, 6 + dmg, 0xff4444, 2, 12);
                g.shakeTimer = Math.min(15, 6 + dmg * 2);
                g.vignetteFlash = Math.min(1.2, 0.6 + dmg * 0.1);
                playSound('explosion');
                if (g.squadCount <= 0) { g.state = 'gameover'; showGameOver(); }
                } // end else (not invincible)
            }
        }
    });
    g.enemyBullets = g.enemyBullets.filter(eb => !eb.dead);

    // Gate collision
    g.gates.forEach(gate => {
        if (gate.triggered && gate.fadeTimer > 0) { gate.fadeTimer--; return; }
        if (gate.triggered) return;
        const relZ = gate.z - g.cameraZ;
        if (relZ <= 8 && relZ > -25) {
            for (let i = 0; i < gate.options.length; i++) {
                const opt = gate.options[i];
                const xMargin = 12; // extra forgiving margin on each side
                if (g.player.x > opt.x - opt.width / 2 - xMargin && g.player.x < opt.x + opt.width / 2 + xMargin) {
                    gate.triggered = true; gate.fadeTimer = 60; gate.chosenIdx = i;

                    // Determine flash color and text
                    let flashColor, floatingText;
                    if (opt.gateType === 'weapon') {
                        flashColor = 0xffd700;
                        floatingText = opt.weapon.toUpperCase() + '!';
                        g.weapon = opt.weapon;
                        g.weaponTimer = WEAPON_DEFS[opt.weapon].duration * 1000;
                        playSound('weapon_pickup');
                    } else {
                        const op = opt.op || '+';
                        const oldSquad = g.squadCount;
                        g.squadCount = applyTroopGateOp(g.squadCount, op, opt.value);
                        if (g.squadCount > g.peakSquad) g.peakSquad = g.squadCount;
                        const diff = g.squadCount - oldSquad;
                        // Show actual gain/loss
                        if (diff >= 0) {
                            flashColor = (op === '×') ? 0x44ddff : (op === '+%') ? 0x30dd80 : 0x4488ff;
                            floatingText = `+${diff} 兵力!`;
                            playSound('gate_good');
                        } else {
                            flashColor = (op === '÷') ? 0xff8800 : (op === '-%') ? 0xe06070 : 0xff3333;
                            floatingText = `${diff} 兵力`;
                            playSound('gate_bad');
                        }
                    }

                    // 1. Screen-wide colored flash
                    g.gateFlash = { color: flashColor, timer: 20, maxTimer: 20 };

                    // 2. Shatter chosen panel into pixel fragments toward player
                    const chosenP = project(opt.x, Math.max(1, relZ));
                    const playerP = project(g.player.x, 0);
                    for (let f = 0; f < 35; f++) {
                        g.gateShatterPieces.push({
                            x: chosenP.x + (Math.random() - 0.5) * 100,
                            y: chosenP.y + (Math.random() - 0.5) * 80,
                            targetX: playerP.x, targetY: playerP.y,
                            vx: (Math.random() - 0.5) * 6,
                            vy: (Math.random() - 0.5) * 6,
                            size: 3 + Math.random() * 6,
                            color: flashColor,
                            life: 30 + Math.random() * 20,
                            maxLife: 50,
                        });
                    }

                    // 3. Big floating text
                    g.gateText = { text: floatingText, color: flashColor, timer: 0, maxTimer: 90, scale: 0.1 };

                    // 4. Unchosen panels crack and collapse
                    gate.options.forEach((otherOpt, otherIdx) => {
                        if (otherIdx === i) return;
                        const otherP = project(otherOpt.x, Math.max(1, relZ));
                        g.gateCollapsePanels.push({
                            sx: otherP.x, sy: otherP.y - 80 * otherP.scale,
                            w: 100 * otherP.scale, h: 80 * otherP.scale,
                            vy: 0, rotAngle: 0,
                            rotSpeed: (Math.random() - 0.5) * 0.12,
                            life: 45, maxLife: 45,
                            color: otherOpt.gateType === 'weapon' ? 0xd4a020
                                : otherOpt.value > 0 ? 0x2098e0 : 0xd03030,
                            crackProgress: 0,
                        });
                    });

                    // 5. Strong camera shake
                    g.shakeTimer = Math.max(g.shakeTimer, 18);

                    // 6. Slow-mo effect
                    g.slowMo = 250;

                    // 7. Speed lines radiating from center
                    for (let s = 0; s < 28; s++) {
                        const angle = (s / 28) * Math.PI * 2;
                        const spd = 8 + Math.random() * 8;
                        g.speedLines.push({
                            x: screenW / 2, y: screenH * 0.45,
                            vx: Math.cos(angle) * spd,
                            vy: Math.sin(angle) * spd,
                            life: 12 + Math.random() * 12,
                            maxLife: 24,
                            length: 25 + Math.random() * 35,
                            color: flashColor,
                        });
                    }

                    // Original particles too
                    addParticles(opt.x, gate.z, 25, flashColor, 5, 30);
                    addParticles(g.player.x, g.cameraZ, 12, 0xffffff, 3, 20);

                    break;
                }
            }
            if (!gate.triggered && relZ < -8) { gate.triggered = true; gate.fadeTimer = 0; }
        }
    });

    // Spawning
    if (g.cameraZ + CONFIG.SPAWN_DISTANCE > g.nextWaveZ) {
        spawnEnemyWave();
        if (Math.random() > 0.3) spawnBarrels();
        g.wave++;
        // Mega boss every 10 waves, regular boss every 5 waves (but not on mega wave)
        if (g.wave % 10 === 0) {
            spawnMegaBoss(g.nextWaveZ - 80);
        } else if (g.wave % 5 === 0) {
            spawnBoss(g.nextWaveZ - 80);
        }
        g.waveBanner = { wave: g.wave, timer: 0, maxTimer: CONFIG.WAVE_BANNER_DURATION };
        playSound('wave_start');
    }
    if (g.cameraZ + CONFIG.SPAWN_DISTANCE > g.nextGateZ) spawnGate();

    // Barrel chain reaction timers
    g.barrels.forEach(br => {
        if (!br.alive || br.chainTimer < 0) return;
        if (br.chainTimer > 0) { br.chainTimer--; }
        else if (br.chainTimer === 0) { br.chainTimer = -1; explodeBarrel(br); }
    });

    // Barrel smoke/sparks for damaged barrels
    g.barrels.forEach(br => {
        if (!br.alive || br.hp >= br.maxHp) return;
        br.smokeTimer++;
        if (br.smokeTimer % 6 === 0) {
            g.particles.push({
                x: br.x + (Math.random() - 0.5) * 10, z: br.z,
                vx: (Math.random() - 0.5) * 0.5, vz: 0,
                vy: -1.0 - Math.random() * 0.5, y: 0,
                life: 18 + Math.random() * 10, maxLife: 28,
                color: 0x555555, size: 3 + Math.random() * 3,
            });
        }
        if (br.smokeTimer % 10 === 0) {
            g.particles.push({
                x: br.x + (Math.random() - 0.5) * 8, z: br.z,
                vx: (Math.random() - 0.5) * 2, vz: (Math.random() - 0.5),
                vy: -2.5 - Math.random() * 2, y: 0,
                life: 8 + Math.random() * 5, maxLife: 13,
                color: 0xff8800, size: 1 + Math.random() * 2,
            });
        }
    });

    // Coin physics + pickup
    const playerZ = g.cameraZ + 10;
    g.coins.forEach(coin => {
        // Physics: scatter then settle
        coin.x += coin.vx;
        coin.z += coin.vz;
        coin.y += coin.vy;
        coin.vy += 0.25; // gravity
        if (coin.y > 0) { coin.y = 0; coin.vy = -coin.vy * 0.3; coin.vx *= 0.8; coin.vz *= 0.8; }
        coin.vx *= 0.97; coin.vz *= 0.97;
        coin.bobPhase += 0.08;
        coin.life--;
        // Magnet: pull toward player when close
        const dx = g.player.x - coin.x;
        const dz = playerZ - coin.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < COIN_MAGNET_RANGE) {
            const pull = 0.15 * (1 - dist / COIN_MAGNET_RANGE);
            coin.x += dx * pull;
            coin.z += dz * pull;
        }
        // Pickup
        if (dist < 25) {
            coin.collected = true;
            g.coinsCollected += coin.value;
            playerData.coins += coin.value;
            savePlayerData(playerData);
            // Pickup effect — golden burst with speed lines
            const cp = project(coin.x, coin.z - g.cameraZ);
            addScorePopup(`🪙+${coin.value}`, cp.x, cp.y - 20, 0xffd700);
            addParticles(coin.x, coin.z, 14, 0xffd700, 4, 18);
            addParticles(coin.x, coin.z, 6, 0xffffff, 3, 10);
            addParticles(coin.x, coin.z, 4, 0xffaa00, 2, 12);
            // Speed lines radiating from pickup point
            for (let s = 0; s < 8; s++) {
                const a = (s / 8) * Math.PI * 2;
                g.speedLines.push({
                    x: cp.x, y: cp.y,
                    vx: Math.cos(a) * (4 + Math.random() * 3),
                    vy: Math.sin(a) * (4 + Math.random() * 3),
                    life: 6 + Math.random() * 4, maxLife: 10,
                    length: 12 + Math.random() * 10, color: 0xffd700,
                });
            }
            g.screenFlash = Math.max(g.screenFlash, 0.12);
            g.shakeTimer = Math.max(g.shakeTimer, 3);
            // Big floating text like troop change
            g.gateText = { text: `🪙 +${coin.value} 金币`, color: 0xffd700, timer: 0, maxTimer: 60, scale: 0.1 };
            g.gateFlash = { color: 0xffd700, timer: 10, maxTimer: 10 };
            playSound('gate_good');
        }
    });
    g.coins = g.coins.filter(c => !c.collected && c.life > 0);

    // Gem physics + pickup
    const GEM_MAGNET_RANGE = 120;
    g.gems.forEach(gem => {
        gem.x += gem.vx;
        gem.z += gem.vz;
        gem.y += gem.vy;
        gem.vy += 0.25;
        if (gem.y > 0) { gem.y = 0; gem.vy = -gem.vy * 0.25; gem.vx *= 0.75; gem.vz *= 0.75; }
        gem.vx *= 0.97; gem.vz *= 0.97;
        gem.bobPhase += 0.06;
        gem.life--;
        const gdx = g.player.x - gem.x;
        const gdz = playerZ - gem.z;
        const gdist = Math.sqrt(gdx * gdx + gdz * gdz);
        if (gdist < GEM_MAGNET_RANGE) {
            const pull = 0.12 * (1 - gdist / GEM_MAGNET_RANGE);
            gem.x += gdx * pull;
            gem.z += gdz * pull;
        }
        if (gdist < 25) {
            gem.collected = true;
            g.gemsCollected += gem.value;
            playerData.gems = (playerData.gems || 0) + gem.value;
            savePlayerData(playerData);
            // Pickup effect — purple explosion with blast ring + speed lines
            const gp = project(gem.x, gem.z - g.cameraZ);
            addScorePopup(`💎+${gem.value}`, gp.x, gp.y - 25, 0xcc44ff);
            addParticles(gem.x, gem.z, 20, 0xaa22ff, 5, 25);
            addParticles(gem.x, gem.z, 10, 0xffffff, 4, 12);
            addParticles(gem.x, gem.z, 8, 0xcc88ff, 6, 18);
            addParticles(gem.x, gem.z, 4, 0xff44ff, 3, 15);
            // Speed lines radiating from pickup — more dramatic
            for (let s = 0; s < 16; s++) {
                const a = (s / 16) * Math.PI * 2;
                const spd = 5 + Math.random() * 5;
                g.speedLines.push({
                    x: gp.x, y: gp.y,
                    vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
                    life: 8 + Math.random() * 6, maxLife: 14,
                    length: 18 + Math.random() * 15, color: 0xcc44ff,
                });
            }
            // Shatter pieces flying outward
            for (let f = 0; f < 12; f++) {
                const a = Math.random() * Math.PI * 2;
                g.gateShatterPieces.push({
                    x: gp.x + (Math.random() - 0.5) * 20,
                    y: gp.y + (Math.random() - 0.5) * 15,
                    targetX: gp.x + Math.cos(a) * 150,
                    targetY: gp.y + Math.sin(a) * 150,
                    vx: Math.cos(a) * (3 + Math.random() * 3),
                    vy: Math.sin(a) * (3 + Math.random() * 3),
                    size: 2 + Math.random() * 4, color: 0xcc44ff,
                    life: 18 + Math.random() * 10, maxLife: 28,
                });
            }
            g.screenFlash = Math.max(g.screenFlash, 0.25);
            g.shakeTimer = Math.max(g.shakeTimer, 8);
            g.slowMo = Math.max(g.slowMo, 80);
            // Big floating text like troop change
            g.gateText = { text: `💎 +${gem.value} 宝石`, color: 0xcc44ff, timer: 0, maxTimer: 70, scale: 0.1 };
            g.gateFlash = { color: 0xcc44ff, timer: 12, maxTimer: 12 };
            playSound('weapon_pickup');
        }
    });
    g.gems = g.gems.filter(gem => !gem.collected && gem.life > 0);

    // Cleanup
    g.enemies = g.enemies.filter(e => e.alive || e.z > g.cameraZ - 50);
    g.gates = g.gates.filter(gate => gate.z > g.cameraZ - 50 && (!gate.triggered || gate.fadeTimer > 0));
    g.barrels = g.barrels.filter(b => b.alive && b.z > g.cameraZ - 50);
    g.deadBodies.forEach(d => d.timer--);
    g.deadBodies = g.deadBodies.filter(d => d.timer > 0 && d.z > g.cameraZ - 50);

    // Particles
    g.particles.forEach(p => { p.x += p.vx; p.z += p.vz; p.y += p.vy; p.vy += 0.3; p.life--; });
    g.particles = g.particles.filter(p => p.life > 0);
    const particleLimit = _proj.isMobile ? 150 : 400;
    if (g.particles.length > particleLimit) g.particles.splice(0, g.particles.length - Math.floor(particleLimit * 0.75));

    // Explosions
    g.explosions.forEach(e => e.timer++);
    g.explosions = g.explosions.filter(e => e.timer < e.maxTimer);

    // Shake
    if (g.shakeTimer > 0) {
        g.shakeX = (Math.random() - 0.5) * g.shakeTimer * 1.5;
        g.shakeY = (Math.random() - 0.5) * g.shakeTimer * 1.5;
        g.shakeTimer--;
    } else { g.shakeX = 0; g.shakeY = 0; }

    // Gate shatter pieces (fly toward player then fade)
    g.gateShatterPieces.forEach(p => {
        p.x += (p.targetX - p.x) * 0.07 + p.vx;
        p.y += (p.targetY - p.y) * 0.07 + p.vy;
        p.vx *= 0.9; p.vy *= 0.9;
        p.life--;
    });
    g.gateShatterPieces = g.gateShatterPieces.filter(p => p.life > 0);
    if (g.gateShatterPieces.length > 100) g.gateShatterPieces.splice(0, g.gateShatterPieces.length - 80);

    // Gate floating text
    if (g.gateText) {
        g.gateText.timer++;
        if (g.gateText.timer < 12) g.gateText.scale = Math.min(1.8, g.gateText.scale + 0.16);
        else if (g.gateText.timer > 55) g.gateText.scale *= 0.94;
        if (g.gateText.timer >= g.gateText.maxTimer) g.gateText = null;
    }

    // Gate collapse panels
    g.gateCollapsePanels.forEach(p => {
        p.crackProgress = Math.min(1, p.crackProgress + 0.06);
        if (p.crackProgress >= 0.5) {
            p.vy += 1.5;
            p.sy += p.vy;
            p.rotAngle += p.rotSpeed;
        }
        p.life--;
    });
    g.gateCollapsePanels = g.gateCollapsePanels.filter(p => p.life > 0);

    // Speed lines
    g.speedLines.forEach(s => { s.x += s.vx; s.y += s.vy; s.life--; });
    g.speedLines = g.speedLines.filter(s => s.life > 0);

    // Gate flash
    if (g.gateFlash) {
        g.gateFlash.timer--;
        if (g.gateFlash.timer <= 0) g.gateFlash = null;
    }

    // Barrel explosion texts
    g.barrelExplosionTexts.forEach(t => {
        t.timer++;
        if (t.timer < 10) t.scale = Math.min(2.2, t.scale + 0.22);
        t.y -= 1.5;
    });
    g.barrelExplosionTexts = g.barrelExplosionTexts.filter(t => t.timer < t.maxTimer);

    // Damage numbers
    g.damageNumbers.forEach(d => { d.offsetY -= 1.2; d.life--; });
    g.damageNumbers = g.damageNumbers.filter(d => d.life > 0);
    if (g.damageNumbers.length > 30) g.damageNumbers.splice(0, g.damageNumbers.length - 20);

    // Score popups
    g.scorePopups.forEach(p => { p.y -= 1.5; p.life--; });
    g.scorePopups = g.scorePopups.filter(p => p.life > 0);

    // Combo timer
    if (g.comboTimer > 0) {
        g.comboTimer -= dt;
        if (g.comboTimer <= 0) {
            if (g.comboCount >= 3) {
                const bonus = g.comboCount * 5;
                g.score += bonus;
                addScorePopup(`COMBO x${g.comboCount}! +${bonus}`, screenW / 2, screenH * 0.4, 0xff8800);
            }
            g.comboCount = 0;
        }
    }

    // Wave banner
    if (g.waveBanner) {
        g.waveBanner.timer++;
        if (g.waveBanner.timer >= g.waveBanner.maxTimer) g.waveBanner = null;
    }

    // Vignette flash decay
    g.vignetteFlash = Math.max(0, g.vignetteFlash - 0.03);
    g.screenFlash = Math.max(0, g.screenFlash - 0.05);

    // Clouds
    g.clouds.forEach(c => {
        c.x += c.speed * 0.00008;
        if (c.x > 1.3) c.x = -0.3;
    });
}
