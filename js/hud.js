// ============================================================
// HUD DRAWING
// ============================================================
function updateHUD() {
    const g = game;
    scoreText.text = `SCORE: ${g.score}`;
    squadText.text = `SQUAD: ${g.squadCount}`;
    waveText.text = `WAVE: ${g.wave}`;

    // Weapon HUD
    if (g.weapon !== 'pistol') {
        weaponHudGfx.visible = true;
        weaponHudText.visible = true;
        weaponHudTimer.visible = true;
        const def = WEAPON_DEFS[g.weapon];
        const remaining = g.weaponTimer / (def.duration * 1000);
        const wColor = WEAPON_COLORS[g.weapon];

        weaponHudGfx.clear();
        const barW = 180, barH = 14, boxW = barW + 30, boxH = 50;
        const x = screenW / 2 - boxW / 2, y = screenH - 70;
        weaponHudGfx.roundRect(x, y, boxW, boxH, 8).fill({ color: 0x000000, alpha: 0.55 });
        weaponHudGfx.roundRect(x, y, boxW, boxH, 8).stroke({ width: 1, color: 0xffffff, alpha: 0.15 });
        const barX = screenW / 2 - barW / 2, barY = y + 28;
        weaponHudGfx.roundRect(barX, barY, barW, barH, 3).fill({ color: 0xffffff, alpha: 0.15 });
        if (remaining > 0) {
            weaponHudGfx.roundRect(barX, barY, Math.max(0, barW * remaining), barH, 3).fill(wColor);
        }

        weaponHudText.text = g.weapon.toUpperCase();
        weaponHudText.style.fill = wColor;
        weaponHudText.x = screenW / 2; weaponHudText.y = y + 14;

        weaponHudTimer.text = `${Math.ceil(g.weaponTimer / 1000)}s`;
        weaponHudTimer.x = screenW / 2; weaponHudTimer.y = barY + barH / 2;
    } else {
        weaponHudGfx.visible = false;
        weaponHudText.visible = false;
        weaponHudTimer.visible = false;
    }
}

// ============================================================
// BOSS HP BAR (below score HUD)
// ============================================================
function drawBossHud() {
    const g = game;
    const boss = g.enemies.find(e => e.alive && e.isBoss);
    if (!boss) {
        bossHudContainer.visible = false;
        return;
    }
    bossHudContainer.visible = true;
    bossHudGfx.clear();

    const bossLevel = Math.floor(g.wave / 5);
    const hpRatio = Math.max(0, boss.hp / boss.maxHp);
    const now = Date.now();

    // Layout — sits below the SCORE / SQUAD / WAVE row
    const barW = Math.min(400, screenW * 0.5);
    const barH = 16;
    const barX = screenW / 2 - barW / 2;
    const topY = 40; // clear of score text (y=14, ~18px font)
    const barY = topY + 20;
    const boxPad = 10;
    const boxX = barX - boxPad;
    const boxY = topY - 4;
    const boxW = barW + boxPad * 2;
    const boxH = barH + 38;

    // Outer glow pulse (intensifies at low HP)
    const glowPulse = Math.sin(now * 0.004) * 0.5 + 0.5;
    const glowAlpha = hpRatio < 0.3 ? 0.2 + glowPulse * 0.15 : 0.08 + glowPulse * 0.06;
    const glowColor = hpRatio < 0.3 ? 0xff2222 : 0xcc44ff;
    bossHudGfx.roundRect(boxX - 4, boxY - 4, boxW + 8, boxH + 8, 12)
        .fill({ color: glowColor, alpha: glowAlpha });

    // Background panel
    bossHudGfx.roundRect(boxX, boxY, boxW, boxH, 8)
        .fill({ color: 0x0a0a18, alpha: 0.8 });

    // Border — double stroke for depth
    bossHudGfx.roundRect(boxX, boxY, boxW, boxH, 8)
        .stroke({ width: 2, color: 0xcc66ff, alpha: 0.5 });
    bossHudGfx.roundRect(boxX + 2, boxY + 2, boxW - 4, boxH - 4, 6)
        .stroke({ width: 1, color: 0xffffff, alpha: 0.08 });

    // Decorative corner diamonds
    const dSize = 4;
    [boxX + 8, boxX + boxW - 8].forEach(dx => {
        bossHudGfx.poly([dx, boxY - 1, dx + dSize, boxY + dSize, dx, boxY + dSize * 2, dx - dSize, boxY + dSize])
            .fill({ color: 0xcc66ff, alpha: 0.7 });
    });

    // HP bar track
    bossHudGfx.roundRect(barX, barY, barW, barH, 4)
        .fill({ color: 0x1a1a2e, alpha: 0.9 });
    bossHudGfx.roundRect(barX, barY, barW, barH, 4)
        .stroke({ width: 1, color: 0x333355, alpha: 0.6 });

    // HP fill
    if (hpRatio > 0) {
        const fillW = Math.max(6, barW * hpRatio);
        // Color gradient: purple → orange → red
        const fillColor = hpRatio > 0.5 ? 0xcc44ff : hpRatio > 0.25 ? 0xff6644 : 0xff2222;
        bossHudGfx.roundRect(barX, barY, fillW, barH, 4).fill(fillColor);

        // Top highlight
        bossHudGfx.roundRect(barX + 2, barY + 2, fillW - 4, barH * 0.35, 2)
            .fill({ color: 0xffffff, alpha: 0.3 });
        // Bottom shadow inside bar
        bossHudGfx.roundRect(barX + 2, barY + barH * 0.65, fillW - 4, barH * 0.3, 2)
            .fill({ color: 0x000000, alpha: 0.2 });

        // Animated shimmer sweep
        const shimmerPhase = (now % 2000) / 2000;
        const shimmerX = barX + shimmerPhase * barW;
        const shimmerW = 30;
        if (shimmerX < barX + fillW) {
            const clippedW = Math.min(shimmerW, barX + fillW - shimmerX);
            bossHudGfx.roundRect(shimmerX, barY + 2, clippedW, barH - 4, 2)
                .fill({ color: 0xffffff, alpha: 0.15 * (1 - Math.abs(shimmerPhase - 0.5) * 2) });
        }
    }

    // Tick marks every 25%
    for (let i = 1; i < 4; i++) {
        const tx = barX + barW * i / 4;
        bossHudGfx.rect(tx - 0.5, barY, 1, barH).fill({ color: 0x000000, alpha: 0.35 });
    }

    // Name label
    bossHudNameText.text = bossLevel >= 3 ? `BOSS Lv.${bossLevel}` : 'BOSS';
    bossHudNameText.x = screenW / 2;
    bossHudNameText.y = barY - 2;

    // HP number + percentage
    const pct = Math.round(hpRatio * 100);
    bossHudHpText.text = `${boss.hp} / ${boss.maxHp}  (${pct}%)`;
    bossHudHpText.style.fill = hpRatio < 0.25 ? 0xff6666 : 0xcccccc;
    bossHudHpText.x = screenW / 2;
    bossHudHpText.y = barY + barH + 3;
}

// ============================================================
// WAVE BANNER
// ============================================================
function drawWaveBanner() {
    const g = game;
    if (!g.waveBanner) {
        waveBannerContainer.visible = false;
        return;
    }
    waveBannerContainer.visible = true;
    const wb = g.waveBanner;
    const t = wb.timer / wb.maxTimer;

    // Slide in (0-0.15), hold (0.15-0.7), slide out (0.7-1.0)
    let alpha = 1, offsetY = 0;
    if (t < 0.15) {
        const p = t / 0.15;
        offsetY = (1 - p) * -80;
        alpha = p;
    } else if (t > 0.7) {
        const p = (t - 0.7) / 0.3;
        offsetY = p * 80;
        alpha = 1 - p;
    }

    waveBannerContainer.y = screenH * 0.3 + offsetY;
    waveBannerContainer.alpha = alpha;
    waveBannerText.text = `WAVE ${wb.wave}`;
    // Show adaptive difficulty as tactical info
    const af = getAdaptiveFactor();
    const afLabel = af >= 1.15 ? ` | 强度 ×${af.toFixed(1)}` : af <= 0.85 ? ` | 强度 ×${af.toFixed(1)}` : '';
    waveBannerSub.text = `INCOMING!${afLabel}`;
}

// ============================================================
// COMBO COUNTER
// ============================================================
function drawComboCounter() {
    const g = game;
    if (g.comboCount < 3) {
        comboText.visible = false;
        return;
    }
    comboText.visible = true;
    const pulse = 1 + Math.sin(Date.now() * 0.008) * 0.08;
    comboText.text = `COMBO x${g.comboCount}`;
    comboText.scale.set(pulse);

    if (g.comboCount >= 20) comboText.style.fill = 0xff3333;
    else if (g.comboCount >= 10) comboText.style.fill = 0xff8800;
    else if (g.comboCount >= 5) comboText.style.fill = 0xffcc00;
    else comboText.style.fill = 0xffffff;
}

// ============================================================
// DAMAGE NUMBERS & SCORE POPUPS
// ============================================================
function drawDamageNumbers() {
    const g = game;
    g.damageNumbers.forEach(d => {
        const relZ = d.z - g.cameraZ;
        if (relZ < -20) return;
        const p = project(d.x, Math.max(0, relZ));
        const t = d.life / d.maxLife;
        const label = getPooledLabel();
        label.text = String(d.value);
        label.style.fontSize = 16 + (1 - t) * 4;
        label.style.fill = d.color;
        label.anchor.set(0.5);
        label.x = p.x; label.y = p.y + d.offsetY;
        label.alpha = t;
        label.visible = true;
    });

    g.scorePopups.forEach(sp => {
        const t = sp.life / sp.maxLife;
        const label = getPooledLabel();
        label.text = sp.text;
        label.style.fontSize = 18 + (1 - t) * 6;
        label.style.fill = sp.color;
        label.anchor.set(0.5);
        label.x = sp.x; label.y = sp.y;
        label.alpha = t;
        label.visible = true;
    });
}

// ============================================================
// PAUSE OVERLAY
// ============================================================
function drawPauseOverlay() {
    pauseGfx.clear();
    // Full screen dark overlay
    pauseGfx.rect(0, 0, screenW, screenH).fill({ color: 0x000000, alpha: 0.65 });
    // Center box
    const boxW = 380, boxH = 200;
    const bx = screenW / 2 - boxW / 2, by = screenH / 2 - boxH / 2;
    pauseGfx.roundRect(bx, by, boxW, boxH, 16).fill({ color: 0x141428, alpha: 0.9 });
    pauseGfx.roundRect(bx, by, boxW, boxH, 16).stroke({ width: 2, color: 0xf0c040, alpha: 0.6 });
    pauseContainer.visible = true;
}
