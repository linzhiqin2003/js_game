// ============================================================
// RENDER (orchestrator)
// ============================================================
function render() {
    const g = game;

    // Update screen size
    screenW = app.screen.width;
    screenH = app.screen.height;

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
                if (monsterFrames.length > 0) {
                    const spr = getPooledMonsterSprite();
                    if (spr) {
                        const frameIdx = Math.floor(e.animFrame * 0.15) % MONSTER_FRAME_COUNT;
                        spr.texture = monsterFrames[frameIdx];
                        spr.x = p.x;
                        spr.y = p.y;
                        // Scale: boss 2.5x, heavy 1.35x, normal 1x
                        const sizeMult = e.isBoss ? 2.5 : e.isHeavy ? 1.35 : 1.0;
                        const sprScale = p.scale * 1.8 * sizeMult;
                        spr.scale.set(sprScale, sprScale);
                        // Tint: boss purple, heavy red, normal white
                        spr.tint = e.hitFlash > 0 ? 0xff6666
                            : e.isBoss ? 0xcc66ff
                            : e.isHeavy ? 0xff9999 : 0xffffff;
                        spr.alpha = 1;
                        spr.zIndex = -relZ;
                    }
                } else {
                    drawEnemySoldier(entityGfx, p.x, p.y, p.scale, e.animFrame, e.hitFlash, e.type);
                }
                // HP bar: always for boss/heavy, otherwise when damaged
                if (e.hp < e.maxHp || e.isHeavy || e.isBoss) {
                    const sizeMult = e.isBoss ? 2.5 : e.isHeavy ? 1.35 : 1;
                    const barW = (e.isBoss ? 50 : e.isHeavy ? 26 : 20) * p.scale;
                    const barH = Math.max(1, (e.isBoss ? 5 : 3) * p.scale);
                    const barY = p.y - 18 * p.scale * sizeMult;
                    entityGfx.rect(p.x - barW / 2, barY, barW, barH).fill(0x440000);
                    const barColor = e.isBoss ? 0xcc44ff : e.isHeavy ? 0xff6666 : 0xff4444;
                    entityGfx.rect(p.x - barW / 2, barY, barW * (e.hp / e.maxHp), barH).fill(barColor);
                    // Boss: "BOSS" label above HP bar
                    if (e.isBoss) {
                        const bossLabel = getPooledLabel();
                        bossLabel.text = 'BOSS';
                        bossLabel.style.fontSize = Math.max(12, Math.floor(18 * p.scale));
                        bossLabel.style.fill = 0xcc66ff;
                        bossLabel.anchor.set(0.5);
                        bossLabel.x = p.x; bossLabel.y = barY - 10 * p.scale;
                        bossLabel.alpha = 1;
                        bossLabel.visible = true;
                    }
                    if (e.isHeavy && !e.isBoss) {
                        const markY = barY - 4 * p.scale;
                        entityGfx.circle(p.x, markY, 2.5 * p.scale).fill(0xff4444);
                    }
                }
                // Boss: pulsing aura glow
                if (e.isBoss) {
                    const pulse = Math.sin(Date.now() * 0.004) * 0.15 + 0.25;
                    const auraR = 30 * p.scale;
                    entityGfx.circle(p.x, p.y, auraR).fill({ color: 0x9933ff, alpha: pulse });
                    entityGfx.circle(p.x, p.y, auraR * 0.6).fill({ color: 0xcc66ff, alpha: pulse * 0.5 });
                }
                break;
            }
            case 'gate': drawGate(entityGfx, item.data); break;
        }
    });

    // Bullets (drawn after entities for visibility)
    drawBullets(entityGfx);

    // Enemy bullets (boss projectiles)
    g.enemyBullets.forEach(eb => {
        const relZ = eb.z - g.cameraZ;
        if (relZ < -10 || relZ > CONFIG.SPAWN_DISTANCE + 100) return;
        const ep = project(eb.x, relZ);
        const s = Math.max(2, 5 * ep.scale);
        // Glowing red/orange projectile
        entityGfx.circle(ep.x, ep.y, s * 2).fill({ color: eb.color, alpha: 0.3 });
        entityGfx.circle(ep.x, ep.y, s).fill({ color: eb.color, alpha: 0.9 });
        entityGfx.circle(ep.x, ep.y, s * 0.5).fill({ color: 0xffffff, alpha: 0.8 });
        // Trail
        const trailP = project(eb.x - eb.vx * 2, relZ - eb.vz * 2);
        if (trailP.scale > 0) {
            entityGfx.moveTo(trailP.x, trailP.y).lineTo(ep.x, ep.y)
                .stroke({ width: Math.max(1, s * 0.8), color: eb.color, alpha: 0.5 });
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
