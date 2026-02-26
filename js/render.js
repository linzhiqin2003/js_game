// ============================================================
// RENDER (orchestrator)
// ============================================================
function render() {
    const g = game;

    // Update screen size + projection cache
    screenW = app.screen.width;
    screenH = app.screen.height;
    updateProjectionCache();

    // Reset pools
    resetLabelPool();
    resetMonsterSpritePool();

    // Clear all per-frame graphics
    skyGfx.clear();
    bridgeGfx.clear();
    entityGfx.clear();
    effectGfx.clear();
    particleGfx.clear();
    screenFlashGfx.clear();

    // Camera shake
    worldContainer.x = g.shakeTimer > 0 ? g.shakeX : 0;
    worldContainer.y = g.shakeTimer > 0 ? g.shakeY : 0;

    // Sky + Clouds
    drawSky(skyGfx);

    // Bridge
    drawBridge(bridgeGfx);
    drawRoadDecor(bridgeGfx);

    // Sorted entities
    const renderList = [];
    g.deadBodies.forEach(d => renderList.push({ type: 'dead', data: d, z: d.z }));
    g.barrels.forEach(b => { if (b.alive) renderList.push({ type: 'barrel', data: b, z: b.z }); });
    g.enemies.forEach(e => { if (e.alive) renderList.push({ type: 'enemy', data: e, z: e.z }); });
    g.gates.forEach(gate => {
        if (!gate.triggered || gate.fadeTimer > 0) renderList.push({ type: 'gate', data: gate, z: gate.z });
    });

    renderList.sort((a, b) => b.z - a.z);

    renderList.forEach(item => {
        const relZ = item.z - g.cameraZ;
        if (relZ < -20 || relZ > CONFIG.SPAWN_DISTANCE + 200) return;
        const p = project(item.data.x !== undefined ? item.data.x : 0, relZ);

        switch (item.type) {
            case 'dead': drawDeadBody(entityGfx, p.x, p.y, p.scale, item.data.timer / 300); break;
            case 'barrel': {
                drawBarrel(entityGfx, p.x, p.y, p.scale, item.data);
                // HP bar when damaged
                if (item.data.hp < item.data.maxHp) {
                    const s = Math.max(1, p.scale * CONFIG.PIXEL_SIZE * 5.5);
                    const barW = 20 * p.scale, barH = Math.max(1, 2.5 * p.scale);
                    const barY = p.y - 13 * s;
                    entityGfx.rect(p.x - barW / 2, barY, barW, barH).fill(0x440000);
                    entityGfx.rect(p.x - barW / 2, barY, barW * (item.data.hp / item.data.maxHp), barH).fill(0xff4444);
                }
                break;
            }
            case 'enemy': {
                const e = item.data;
                if (monsterSpritesLoaded) {
                    const spr = getPooledMonsterSprite();
                    if (spr) {
                        if (e.isBoss) {
                            // 大奶龙 (boss): 4 frames, 64×64
                            const frameIdx = Math.floor(e.animFrame * 0.4) % bossFrames.length;
                            spr.texture = bossFrames[frameIdx];
                        } else if (e.type === 1 && xiaoNaiLongFrames.length > 0) {
                            // 小奶龙 (normal type 1): 21 frames, 128×128
                            const frameIdx = Math.floor(e.animFrame * 0.4) % xiaoNaiLongFrames.length;
                            spr.texture = xiaoNaiLongFrames[frameIdx];
                        } else if (e.type === 3 && fireEnemyFrames.length > 0) {
                            // 火焰奶龙 (elite type 3): 6 frames, 128×128
                            const frameIdx = Math.floor(e.animFrame * 0.25) % fireEnemyFrames.length;
                            spr.texture = fireEnemyFrames[frameIdx];
                        } else {
                            // 派大星 (normal type 0/2): cycle through all frames
                            const frameIdx = Math.floor(e.animFrame * 0.4) % normalMonsterFrames.length;
                            spr.texture = normalMonsterFrames[frameIdx];
                        }
                        spr.x = p.x;
                        spr.y = p.y;
                        // Normalize each sprite to ~40px target height, then apply world scale
                        const TARGET_H = 120;
                        let frameH = e.isBoss ? MONSTER_FRAME_SIZE
                            : e.type === 1 ? XIAO_NAI_LONG_FRAME_SIZE
                            : e.type === 3 ? FIRE_ENEMY_FRAME_SIZE : PATRICK_FRAME_H;
                        let sizeMult = e.isMegaBoss ? 7.0 : e.isBoss ? 4.2 : e.isHeavy ? 1.6
                            : e.type === 1 ? 1.4 : e.type === 3 ? 2.2 : 1.3;
                        const sprScale = p.scale * (TARGET_H / frameH) * sizeMult;
                        const wobble = Math.sin(e.animFrame * 0.15) * 0.02 * sprScale;
                        spr.scale.set(sprScale + wobble, sprScale - wobble);
                        // Tint: hit flash; fire elite gets red tint since fire bg was removed
                        spr.tint = e.hitFlash > 0 ? 0xffaaaa : e.isMegaBoss ? 0xff2222 : e.type === 3 ? 0xff5533 : 0xffffff;
                        spr.alpha = 1;
                        spr.zIndex = -relZ;
                    }
                } else {
                    drawEnemySoldier(entityGfx, p.x, p.y, p.scale, e.animFrame, e.hitFlash, e.type);
                }
                // HP bar: always for boss/heavy/fire elite, otherwise when damaged
                if (e.hp < e.maxHp || e.isHeavy || e.isBoss || e.type === 3) {
                    const barSizeMult = e.isMegaBoss ? 5.0 : e.isBoss ? 3.5 : e.type === 3 ? 1.8 : e.isHeavy ? 1.35 : 1;
                    const barW = (e.isMegaBoss ? 90 : e.isBoss ? 65 : e.type === 3 ? 32 : e.isHeavy ? 26 : 20) * p.scale;
                    const barH = Math.max(1, (e.isMegaBoss ? 7 : e.isBoss ? 5 : 3) * p.scale);
                    const barY = p.y - 18 * p.scale * barSizeMult;
                    entityGfx.rect(p.x - barW / 2, barY, barW, barH).fill(0x440000);
                    const barColor = e.isMegaBoss ? 0xff2222 : e.isBoss ? 0xcc44ff : e.type === 3 ? 0xff6622 : e.isHeavy ? 0xff6666 : 0xff4444;
                    entityGfx.rect(p.x - barW / 2, barY, barW * (e.hp / e.maxHp), barH).fill(barColor);
                    // Boss: label above HP bar
                    if (e.isBoss) {
                        const bossLabel = getPooledLabel();
                        bossLabel.text = e.isMegaBoss ? '🔥 大龙王' : '大奶龙';
                        bossLabel.style.fontSize = Math.max(12, Math.floor((e.isMegaBoss ? 22 : 18) * p.scale));
                        bossLabel.style.fill = e.isMegaBoss ? 0xff4444 : 0xcc66ff;
                        bossLabel.anchor.set(0.5);
                        bossLabel.x = p.x; bossLabel.y = barY - (e.isMegaBoss ? 14 : 10) * p.scale;
                        bossLabel.alpha = 1;
                        bossLabel.visible = true;
                    }
if (e.isHeavy && !e.isBoss) {
                        const markY = barY - 4 * p.scale;
                        entityGfx.circle(p.x, markY, 2.5 * p.scale).fill(0xff4444);
                    }
                }
                // Boss: pulsing aura glow
                if (e.isMegaBoss) {
                    // Mega boss: large fiery red aura with multiple rings
                    const pulse = Math.sin(Date.now() * 0.005) * 0.15 + 0.3;
                    const auraR = 50 * p.scale;
                    entityGfx.circle(p.x, p.y, auraR * 1.5).fill({ color: 0xff2200, alpha: pulse * 0.15 });
                    entityGfx.circle(p.x, p.y, auraR).fill({ color: 0xff4400, alpha: pulse });
                    entityGfx.circle(p.x, p.y, auraR * 0.6).fill({ color: 0xff8800, alpha: pulse * 0.6 });
                    // Flickering fire particles around mega boss
                    const now = Date.now();
                    for (let fi = 0; fi < 4; fi++) {
                        const fAngle = (now * 0.003) + fi * Math.PI / 2;
                        const fx = p.x + Math.cos(fAngle) * auraR * 0.9;
                        const fy = p.y + Math.sin(fAngle) * auraR * 0.4;
                        entityGfx.circle(fx, fy, Math.max(2, 4 * p.scale)).fill({ color: 0xff6600, alpha: pulse * 0.7 });
                    }
                } else if (e.isBoss) {
                    const pulse = Math.sin(Date.now() * 0.004) * 0.15 + 0.25;
                    const auraR = 30 * p.scale;
                    entityGfx.circle(p.x, p.y, auraR).fill({ color: 0x9933ff, alpha: pulse });
                    entityGfx.circle(p.x, p.y, auraR * 0.6).fill({ color: 0xcc66ff, alpha: pulse * 0.5 });
                }
                // Fire elite: orange-red aura
                if (e.type === 3) {
                    const pulse = Math.sin(Date.now() * 0.007) * 0.15 + 0.25;
                    const auraR = 22 * p.scale;
                    entityGfx.circle(p.x, p.y, auraR).fill({ color: 0xff4400, alpha: pulse });
                    entityGfx.circle(p.x, p.y, auraR * 0.55).fill({ color: 0xff8800, alpha: pulse * 0.5 });
                }
                break;
            }
            case 'gate': drawGate(entityGfx, item.data); break;
        }
    });

    // Coins
    g.coins.forEach(coin => {
        const relZ = coin.z - g.cameraZ;
        if (relZ < -10 || relZ > CONFIG.SPAWN_DISTANCE + 100) return;
        const p = project(coin.x, relZ);
        const s = Math.max(2, 6 * p.scale);
        const bob = Math.sin(coin.bobPhase) * 3 * p.scale;
        const cy = p.y + coin.y * p.scale + bob;
        const fadeAlpha = coin.life < 60 ? coin.life / 60 : 1;
        // Glow
        entityGfx.circle(p.x, cy, s * 2.5).fill({ color: 0xffd700, alpha: 0.2 * fadeAlpha });
        // Coin body
        entityGfx.circle(p.x, cy, s).fill({ color: 0xffd700, alpha: 0.9 * fadeAlpha });
        // Highlight
        entityGfx.circle(p.x - s * 0.25, cy - s * 0.25, s * 0.45).fill({ color: 0xffffff, alpha: 0.6 * fadeAlpha });
        // Sparkle
        if (coin.sparkle > 0.7 && Math.sin(Date.now() * 0.01 + coin.bobPhase) > 0.5) {
            entityGfx.circle(p.x + s * 0.5, cy - s * 0.5, s * 0.3).fill({ color: 0xffffff, alpha: 0.8 * fadeAlpha });
        }
    });

    // Gems (boss drops — purple diamond shape)
    g.gems.forEach(gem => {
        const relZ = gem.z - g.cameraZ;
        if (relZ < -10 || relZ > CONFIG.SPAWN_DISTANCE + 100) return;
        const p = project(gem.x, relZ);
        const s = Math.max(3, 9 * p.scale);
        const bob = Math.sin(gem.bobPhase) * 4 * p.scale;
        const cy = p.y + gem.y * p.scale + bob;
        const fadeAlpha = gem.life < 60 ? gem.life / 60 : 1;
        const spin = gem.bobPhase * 2;
        // Outer glow rings
        entityGfx.circle(p.x, cy, s * 3.2).fill({ color: 0x9900ff, alpha: 0.10 * fadeAlpha });
        entityGfx.circle(p.x, cy, s * 2.0).fill({ color: 0xcc44ff, alpha: 0.18 * fadeAlpha });
        // Diamond body (rotated rhombus)
        const hw = s * 0.85, hh = s * 1.3;
        const cos = Math.cos(spin * 0.3), sinv = Math.sin(spin * 0.3);
        const pts = [
            [0, -hh], [hw, 0], [0, hh], [-hw, 0],
        ].map(([dx, dy]) => [p.x + dx * cos - dy * sinv, cy + dx * sinv + dy * cos]);
        entityGfx.poly(pts.flat()).fill({ color: 0xbb33ff, alpha: 0.92 * fadeAlpha });
        // Inner lighter facet (top face)
        const fpts = [
            [0, -hh * 0.9], [hw * 0.6, -hh * 0.1], [0, hh * 0.25], [-hw * 0.6, -hh * 0.1],
        ].map(([dx, dy]) => [p.x + dx * cos - dy * sinv, cy + dx * sinv + dy * cos]);
        entityGfx.poly(fpts.flat()).fill({ color: 0xdd88ff, alpha: 0.55 * fadeAlpha });
        // White sparkle
        entityGfx.circle(p.x + hw * 0.3 * cos, cy - hh * 0.55 * cos, s * 0.28)
            .fill({ color: 0xffffff, alpha: (0.6 + Math.sin(Date.now() * 0.012 + gem.bobPhase) * 0.4) * fadeAlpha });
    });

    // Bullets (drawn after entities for visibility)
    drawBullets(entityGfx);

    // Enemy bullets (boss projectiles)
    const playerZ = g.cameraZ + 10;
    g.enemyBullets.forEach(eb => {
        const relZ = eb.z - g.cameraZ;
        if (relZ < -10 || relZ > CONFIG.SPAWN_DISTANCE + 100) return;
        const ep = project(eb.x, relZ);
        const isFlame = eb.type === 'flame';
        const s = Math.max(3, (isFlame ? 9 : 7) * ep.scale);

        // Trail
        const trailP = project(eb.x - eb.vx * 3, relZ - eb.vz * 3);
        if (trailP.scale > 0) {
            entityGfx.moveTo(trailP.x, trailP.y).lineTo(ep.x, ep.y)
                .stroke({ width: Math.max(2, s * (isFlame ? 1.4 : 1.0)), color: eb.color, alpha: isFlame ? 0.7 : 0.5 });
        }
        // Outer warning glow
        entityGfx.circle(ep.x, ep.y, s * 3.5).fill({ color: eb.color, alpha: isFlame ? 0.18 : 0.12 });
        entityGfx.circle(ep.x, ep.y, s * 2).fill({ color: eb.color, alpha: 0.3 });
        // Core
        entityGfx.circle(ep.x, ep.y, s).fill({ color: eb.color, alpha: 0.95 });
        entityGfx.circle(ep.x, ep.y, s * 0.45).fill({ color: isFlame ? 0xffee44 : 0xffffff, alpha: 0.9 });
        // Flame particles trail
        if (isFlame && Math.random() < 0.3) {
            game.particles.push({
                x: eb.x + (Math.random() - 0.5) * 4, z: eb.z,
                vx: (Math.random() - 0.5) * 0.5, vz: 0.1,
                vy: -0.8 - Math.random() * 0.4, y: 0,
                life: 6 + Math.random() * 4, maxLife: 10,
                color: Math.random() < 0.5 ? 0xff6600 : 0xffaa00, size: 1.5 + Math.random() * 2,
            });
        }

        // Ground warning: project bullet trajectory to player's Z plane
        if (eb.vz < 0 && relZ > 5) {
            const dt = (playerZ - eb.z) / eb.vz;
            if (dt > 0 && dt < 120) {
                const warnX = eb.x + eb.vx * dt;
                if (Math.abs(warnX) < CONFIG.ROAD_HALF_WIDTH + 30) {
                    const wp = project(warnX, 0);
                    const warnPulse = Math.sin(Date.now() * 0.012 - dt * 0.05) * 0.4 + 0.6;
                    const warnR = Math.max(6, 14 * wp.scale) * (1 + (1 - Math.min(1, dt / 80)) * 0.5);
                    const warnAlpha = (1 - Math.min(1, dt / 90)) * 0.6 * warnPulse;
                    entityGfx.circle(wp.x, wp.y, warnR * 1.6).stroke({ width: Math.max(1, 2 * wp.scale), color: 0xff2200, alpha: warnAlpha });
                    entityGfx.circle(wp.x, wp.y, warnR * 0.7).fill({ color: 0xff4400, alpha: warnAlpha * 0.5 });
                }
            }
        }
    });

    // Effects (additive)
    drawExplosions(effectGfx);

    // Particles
    drawParticles(particleGfx);

    // Player + squad (always on top of world entities)
    drawSquadAndPlayer(entityGfx);

    // Gate shatter pieces (additive blend)
    drawGateShatterPieces(effectGfx);

    // Speed lines (additive blend)
    drawSpeedLines(effectGfx);

    // Screen flash
    if (g.screenFlash > 0) {
        screenFlashGfx.rect(0, 0, screenW, screenH).fill({ color: 0xffffff, alpha: g.screenFlash * 0.3 });
    }

    // Gate colored flash
    if (g.gateFlash) {
        const fa = g.gateFlash.timer / g.gateFlash.maxTimer;
        screenFlashGfx.rect(0, 0, screenW, screenH).fill({ color: g.gateFlash.color, alpha: fa * 0.35 });
    }

    // Gate collapse panels
    drawGateCollapsePanels(screenFlashGfx);

    // Vignette flash (red tint on damage)
    if (g.vignetteFlash > 0) {
        screenFlashGfx.rect(0, 0, screenW, screenH).fill({ color: 0xaa0000, alpha: g.vignetteFlash * 0.15 });
    }

    // Damage numbers + score popups + gate/barrel text
    drawDamageNumbers();
    drawGateFloatingText();
    drawBarrelExplosionTexts();

    // HUD
    updateHUD();
    drawBossHud();
    drawWaveBanner();
    drawComboCounter();

    // Pause overlay
    if (g.state === 'paused') {
        drawPauseOverlay();
    } else {
        pauseContainer.visible = false;
    }
}
