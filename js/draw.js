// ============================================================
// DRAWING: SKY
// ============================================================
function drawSky(gfx) {
    const hY = screenH * CONFIG.HORIZON_RATIO;
    // Sky gradient (strips)
    const colors = [0x2a3a5a, 0x4a6a8a, 0x6a8aaa, 0x8aaacc, 0xaac0da];
    const steps = 25;
    for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        const ci = t * (colors.length - 1);
        const idx = Math.floor(ci);
        const frac = ci - idx;
        const c = idx >= colors.length - 1 ? colors[colors.length - 1] : lerpColor(colors[idx], colors[idx + 1], frac);
        const y = (i / steps) * (hY + 10);
        gfx.rect(0, y, screenW, (hY + 10) / steps + 1).fill(c);
    }

    // Cityscape silhouette
    for (let i = 0; i < 25; i++) {
        const bx = (i / 25) * screenW;
        const bw = screenW / 25;
        const bh = 10 + Math.sin(i * 2.7) * 15 + Math.sin(i * 1.3) * 10;
        gfx.rect(bx, hY - bh, bw - 1, bh).fill(0x556677);
        // Random windows
        if (bh > 12) {
            for (let w = 0; w < 3; w++) {
                const wx = bx + 3 + Math.random() * (bw - 8);
                const wy = hY - bh + 3 + Math.random() * (bh - 8);
                gfx.rect(wx, wy, 2, 2).fill({ color: 0xffdd88, alpha: 0.3 + Math.random() * 0.3 });
            }
        }
    }

    // Horizon line
    gfx.rect(0, hY - 2, screenW, 8).fill(0x3a5a7a);

    // Clouds
    if (game) {
        game.clouds.forEach(cloud => {
            const cx = cloud.x * screenW;
            const cy = cloud.y * screenH;
            cloud.blocks.forEach(b => {
                const bx = cx + b.dx * cloud.width;
                const by = cy + b.dy * cloud.height;
                const bw = b.w * cloud.width * 0.5;
                const bh = b.h * cloud.height * 0.5;
                gfx.rect(bx - bw / 2, by - bh / 2, bw, bh).fill({ color: 0xddeeff, alpha: cloud.opacity });
            });
        });
    }
}

// ============================================================
// DRAWING: BRIDGE
// ============================================================
function drawBridge(gfx) {
    const g = game;
    const numSegments = 60;
    const segmentDepth = 15;

    for (let i = numSegments - 1; i >= 0; i--) {
        const z1 = i * segmentDepth;
        const z2 = (i + 1) * segmentDepth;
        const p1L = project(-CONFIG.ROAD_HALF_WIDTH, z1);
        const p1R = project(CONFIG.ROAD_HALF_WIDTH, z1);
        const p2L = project(-CONFIG.ROAD_HALF_WIDTH, z2);
        const p2R = project(CONFIG.ROAD_HALF_WIDTH, z2);

        const shade = Math.floor(80 + (i / numSegments) * 30);
        const color = (shade << 16) | ((shade + 5) << 8) | (shade + 2);
        gfx.poly([p2L.x, p2L.y, p2R.x, p2R.y, p1R.x, p1R.y, p1L.x, p1L.y]).fill(color);

        // Center dashes
        const worldZ = z1 + g.cameraZ;
        if (Math.floor(worldZ / 30) % 2 === 0) {
            const cTop = project(0, z2);
            const cBot = project(0, z1);
            const a = Math.max(0, 0.6 - i / numSegments * 0.5);
            gfx.moveTo(cBot.x, cBot.y).lineTo(cTop.x, cTop.y)
                .stroke({ width: Math.max(1, 2 * p1L.scale), color: 0xffffff, alpha: a });
        }

        // Edge lines
        const ea = Math.max(0, 0.4 - i / numSegments * 0.35);
        const ew = Math.max(1, 2 * p1L.scale);
        gfx.moveTo(p1L.x + 3 * p1L.scale, p1L.y).lineTo(p2L.x + 3 * p2L.scale, p2L.y)
            .stroke({ width: ew, color: 0xc8b432, alpha: ea });
        gfx.moveTo(p1R.x - 3 * p1R.scale, p1R.y).lineTo(p2R.x - 3 * p2R.scale, p2R.y)
            .stroke({ width: ew, color: 0xc8b432, alpha: ea });
    }

    drawRailing(gfx, -1);
    drawRailing(gfx, 1);
}

function drawRailing(gfx, side) {
    const numPosts = 30;
    const postSpacing = 20;
    const railX = side * (CONFIG.ROAD_HALF_WIDTH + 8);

    for (let i = 0; i < numPosts; i++) {
        const z = i * postSpacing;
        const p = project(railX, z);
        const postH = 25 * p.scale;
        const postW = Math.max(1, 3 * p.scale);
        if (p.y < screenH * CONFIG.HORIZON_RATIO) continue;
        const a = Math.max(0, 1 - i / numPosts);

        gfx.rect(p.x - postW / 2, p.y - postH, postW, postH).fill({ color: 0x646e78, alpha: a });

        // Navigation light on every 5th post
        if (i % 5 === 0 && i > 0) {
            gfx.circle(p.x, p.y - postH - 2, Math.max(1, 2 * p.scale))
                .fill({ color: 0xffaa44, alpha: a * 0.7 });
        }

        if (i < numPosts - 1) {
            const pNext = project(railX, (i + 1) * postSpacing);
            gfx.moveTo(p.x, p.y - postH).lineTo(pNext.x, pNext.y - 25 * pNext.scale)
                .stroke({ width: Math.max(1, 2 * p.scale), color: 0x8c96a0, alpha: a });
            gfx.moveTo(p.x, p.y - postH * 0.5).lineTo(pNext.x, pNext.y - 25 * pNext.scale * 0.5)
                .stroke({ width: Math.max(1, 2 * p.scale), color: 0x8c96a0, alpha: a });
        }
    }
}

function drawRoadDecor(gfx) {
    const g = game;
    g.roadSegments.forEach(d => {
        const relZ = d.z - (g.cameraZ % (200 * 40));
        if (relZ < 0 || relZ > 800) return;
        const p = project(d.x, relZ);
        if (p.y < screenH * CONFIG.HORIZON_RATIO) return;
        const s = p.scale * d.size;
        const a = 0.2 * p.scale;
        gfx.rect(p.x - s, p.y - s * 0.3, s * 2, s * 0.6)
            .fill({ color: d.type === 'crack' ? 0x555555 : 0x6a6050, alpha: a });
    });
}

// ============================================================
// DRAWING: CHARACTERS
// ============================================================
function drawPlayerSoldier(gfx, sx, sy, scale, animFrame) {
    const s = Math.max(1, scale * CONFIG.PIXEL_SIZE * 2.8);
    const legOffset = Math.sin(animFrame * 0.15) * 1.5 * s;
    // Shadow
    gfx.ellipse(sx, sy, 5 * s, 2 * s).fill({ color: 0x000000, alpha: 0.3 });
    // Boots
    px(gfx, sx - 3 * s, sy - 2 * s + legOffset, 2.5 * s, 2 * s, 0x2a2a2a);
    px(gfx, sx + 0.5 * s, sy - 2 * s - legOffset, 2.5 * s, 2 * s, 0x2a2a2a);
    // Legs
    px(gfx, sx - 2.5 * s, sy - 4 * s + legOffset, 2 * s, 2.5 * s, 0x3a3a3a);
    px(gfx, sx + 0.5 * s, sy - 4 * s - legOffset, 2 * s, 2.5 * s, 0x3a3a3a);
    // Body
    px(gfx, sx - 4 * s, sy - 9 * s, 8 * s, 5.5 * s, 0xc07020);
    px(gfx, sx - 3 * s, sy - 8 * s, 6 * s, 1 * s, 0xd08030);
    // Arms
    px(gfx, sx - 5 * s, sy - 8 * s, 1.5 * s, 4 * s, 0x606060);
    px(gfx, sx + 3.5 * s, sy - 8 * s, 1.5 * s, 4 * s, 0x606060);
    px(gfx, sx - 5 * s, sy - 8.5 * s, 1.5 * s, 3 * s, 0xc07020);
    px(gfx, sx + 3.5 * s, sy - 8.5 * s, 1.5 * s, 3 * s, 0xc07020);
    // Neck + Head
    px(gfx, sx - 1 * s, sy - 10 * s, 2 * s, 1.5 * s, 0xd4a574);
    px(gfx, sx - 2.5 * s, sy - 13 * s, 5 * s, 3.5 * s, 0xd4a574);
    // Hat
    px(gfx, sx - 3.5 * s, sy - 16 * s, 7 * s, 3.5 * s, 0xf0c040);
    px(gfx, sx - 3 * s, sy - 16.5 * s, 6 * s, 1 * s, 0xe0b030);
    px(gfx, sx - 4 * s, sy - 13 * s, 8 * s, 1 * s, 0xd0a020);
    // Gun
    px(gfx, sx - 1 * s, sy - 14 * s, 2 * s, 5.5 * s, 0x404040);
    px(gfx, sx - 0.5 * s, sy - 17 * s, 1 * s, 3 * s, 0x505050);
}

function drawEnemySoldier(gfx, sx, sy, scale, animFrame, hitFlash, type) {
    const s = Math.max(1, scale * CONFIG.PIXEL_SIZE * 2.5);
    const legOffset = Math.sin(animFrame * 0.12) * 1.2 * s;
    gfx.ellipse(sx, sy, 4 * s, 1.5 * s).fill({ color: 0x000000, alpha: 0.3 });

    // Color variants based on type
    let bodyColor, helmColor, darkColor;
    if (hitFlash > 0) {
        bodyColor = 0xffffff; helmColor = 0xffffff; darkColor = 0xdddddd;
    } else if (type === 1) {
        bodyColor = 0x4a5a3a; helmColor = 0x8b2020; darkColor = 0x2a3a1a;
    } else if (type === 2) {
        bodyColor = 0x5a6a30; helmColor = 0x4a5a25; darkColor = 0x3a4a1a;
    } else {
        bodyColor = 0x5a7020; helmColor = 0x4a6020; darkColor = 0x3a4a15;
    }
    const neckColor = hitFlash > 0 ? 0xffffee : 0x8a9a50;

    px(gfx, sx - 2.5 * s, sy - 1.5 * s + legOffset, 2 * s, 1.5 * s, 0x2a2a1a);
    px(gfx, sx + 0.5 * s, sy - 1.5 * s - legOffset, 2 * s, 1.5 * s, 0x2a2a1a);
    px(gfx, sx - 2 * s, sy - 3.5 * s + legOffset, 1.8 * s, 2.5 * s, darkColor);
    px(gfx, sx + 0.5 * s, sy - 3.5 * s - legOffset, 1.8 * s, 2.5 * s, darkColor);
    px(gfx, sx - 3.5 * s, sy - 7.5 * s, 7 * s, 4.5 * s, bodyColor);
    px(gfx, sx - 4.5 * s, sy - 7 * s, 1.5 * s, 3 * s, bodyColor);
    px(gfx, sx + 3 * s, sy - 7 * s, 1.5 * s, 3 * s, bodyColor);
    px(gfx, sx - 2 * s, sy - 10 * s, 4 * s, 3 * s, neckColor);
    px(gfx, sx - 3 * s, sy - 13 * s, 6 * s, 3.5 * s, helmColor);
    px(gfx, sx - 2.5 * s, sy - 13.5 * s, 5 * s, 1 * s, darkColor);
    px(gfx, sx + 1.5 * s, sy - 7 * s, 4 * s, 1.5 * s, 0x333333);
}

function drawDeadBody(gfx, sx, sy, scale, alpha) {
    const s = Math.max(1, scale * CONFIG.PIXEL_SIZE * 2.0);
    const a = (alpha || 0.7) * 0.7;
    px(gfx, sx - 5 * s, sy - 2 * s, 10 * s, 3 * s, 0x4a5a1a, a);
    px(gfx, sx - 6 * s, sy - 2 * s, 2.5 * s, 2.5 * s, 0x3a4a10, a);
    px(gfx, sx + 5 * s, sy - 1.5 * s, 3 * s, 2 * s, 0x2a3a10, a);
    // Blood pool
    gfx.ellipse(sx, sy, 6 * s, 2 * s).fill({ color: 0x440000, alpha: a * 0.4 });
}

function drawBarrel(gfx, sx, sy, scale, barrel) {
    const s = Math.max(1, scale * CONFIG.PIXEL_SIZE * 5.5);
    const pulse = Math.sin(Date.now() * 0.005 + (barrel ? barrel.pulsePhase : 0)) * 0.5 + 0.5;
    const isDamaged = barrel && barrel.hp < barrel.maxHp;

    // Pulsing danger glow aura
    const glowR = (7 + pulse * 3) * s;
    gfx.circle(sx, sy - 5 * s, glowR).fill({ color: 0xff4400, alpha: 0.12 + pulse * 0.08 });
    gfx.circle(sx, sy - 5 * s, glowR * 0.6).fill({ color: 0xff6600, alpha: 0.08 + pulse * 0.06 });

    // Barrel body - RED explosive look
    const bodyColor = isDamaged ? 0x8B2020 : 0xAA2222;
    px(gfx, sx - 4 * s, sy - 10 * s, 8 * s, 10 * s, bodyColor);
    // Metal bands
    px(gfx, sx - 4.5 * s, sy - 9 * s, 9 * s, 1.5 * s, 0x555555);
    px(gfx, sx - 4.5 * s, sy - 4 * s, 9 * s, 1.5 * s, 0x555555);
    // Top rim
    px(gfx, sx - 3.5 * s, sy - 11 * s, 7 * s, 1.5 * s, 0xBB3333);

    // Hazard stripes (yellow/black)
    for (let i = 0; i < 4; i++) {
        const stripeX = sx - 3 * s + i * 2 * s;
        px(gfx, stripeX, sy - 7.5 * s, 1.2 * s, 3 * s, i % 2 === 0 ? 0xffcc00 : 0x222222);
    }

    // Explosion danger icon (small star)
    const iconY = sy - 6 * s, iconS = 1.5 * s;
    gfx.poly([sx, iconY - iconS * 2, sx + iconS, iconY - iconS * 0.5,
              sx + iconS * 2, iconY, sx + iconS, iconY + iconS * 0.5,
              sx, iconY + iconS * 1.5, sx - iconS, iconY + iconS * 0.5,
              sx - iconS * 2, iconY, sx - iconS, iconY - iconS * 0.5])
        .fill({ color: 0xffaa00, alpha: 0.9 });

    // Crack lines when damaged
    if (isDamaged) {
        gfx.moveTo(sx - 2 * s, sy - 9 * s).lineTo(sx + 1 * s, sy - 5 * s).lineTo(sx - 1 * s, sy - 2 * s)
            .stroke({ width: 1, color: 0x000000, alpha: 0.7 });
        // Flicker light on top
        if (Math.sin(Date.now() * 0.02) > 0) {
            gfx.circle(sx, sy - 11 * s, 2 * s).fill({ color: 0xff4400, alpha: 0.7 });
        }
    }
}

function drawMuzzleFlash(gfx, sx, sy, scale, weapon) {
    const s = scale * 6;
    const color = WEAPON_COLORS[weapon] || 0xffffff;
    // Outer glow
    gfx.circle(sx, sy, s * 2.5).fill({ color, alpha: 0.2 });
    // Star shape
    gfx.poly([sx, sy - s * 3, sx + s, sy - s, sx + s * 2.5, sy, sx + s, sy + s * 0.5,
              sx, sy + s, sx - s, sy + s * 0.5, sx - s * 2.5, sy, sx - s, sy - s])
        .fill({ color: 0xffffff, alpha: 0.9 });
    // Inner glow
    gfx.circle(sx, sy, s * 1.2).fill({ color: 0xf0c040, alpha: 0.9 });
}

// ============================================================
// DRAWING: GATES
// ============================================================
function drawGate(gfx, gate) {
    const g = game;
    const relZ = gate.z - g.cameraZ;
    if (relZ < -20 || relZ > CONFIG.SPAWN_DISTANCE + 200) return;

    const allLeft = project(-CONFIG.ROAD_HALF_WIDTH, relZ);
    const panelHeight = 150 * allLeft.scale;

    const shimmer = Math.sin(Date.now() / 400) * 0.1;
    const now = Date.now();

    gate.options.forEach((opt, optIdx) => {
        const pLeft = project(opt.x - opt.width / 2, relZ);
        const pRight = project(opt.x + opt.width / 2, relZ);
        const panelW = pRight.x - pLeft.x;
        if (panelW < 4) return;
        const sc = pLeft.scale;

        // Floating bob — each panel oscillates independently
        const floatY = Math.sin(now / 600 + optIdx * 2.1) * 3 * sc;
        const panelX = pLeft.x, panelY = pLeft.y - panelHeight + floatY;
        const radius = Math.max(4, 10 * sc);

        // Ground shadow (ellipse below panel)
        const shadowW = panelW * 0.7, shadowH = Math.max(2, 4 * sc);
        const shadowCx = (pLeft.x + pRight.x) / 2, shadowCy = pLeft.y + 2;
        gfx.ellipse(shadowCx, shadowCy, shadowW / 2, shadowH).fill({ color: 0x000000, alpha: 0.25 });

        const isWeapon = opt.gateType === 'weapon';
        const op = opt.op || '+';
        const isGood = !isWeapon && (op === '+' || op === '×');

        // Fade-out animation (enhanced)
        let drawAlpha = 1;
        if (gate.triggered && gate.fadeTimer > 0) {
            const progress = 1 - gate.fadeTimer / 60;
            if (optIdx === gate.chosenIdx) {
                // Chosen panel: rapid white flash then vanish - shatter pieces handle the rest
                if (progress < 0.1) {
                    const flashAlpha = (1 - progress / 0.1) * 0.9;
                    const expand = progress * 15 * sc;
                    gfx.roundRect(panelX - expand, panelY - expand, panelW + expand * 2, panelHeight + expand * 2, radius + expand)
                        .fill({ color: 0xffffff, alpha: flashAlpha });
                }
                return;
            } else {
                // Unchosen panels: handled by gateCollapsePanels, just hide quickly
                drawAlpha = Math.max(0, 1 - progress * 8);
                if (drawAlpha <= 0) return;
            }
        }

        // Color scheme per op type
        let baseColor, glowColor;
        if (isWeapon) {
            baseColor = 0xd4a020; glowColor = 0xffd840;
        } else if (op === '×') {
            baseColor = 0x20a0a0; glowColor = 0x40e0e0;
        } else if (op === '+%') {
            baseColor = 0x1a8a50; glowColor = 0x30dd80; // green for % boost
        } else if (op === '+') {
            baseColor = 0x2098e0; glowColor = 0x50b0ff;
        } else if (op === '÷') {
            baseColor = 0xc06020; glowColor = 0xff9040;
        } else if (op === '-%') {
            baseColor = 0xa03040; glowColor = 0xe06070; // pinkish-red for % loss
        } else {
            baseColor = 0xd03030; glowColor = 0xff6060;
        }

        // Energy underglow (light pillar below panel — taller, brighter)
        const glowH = Math.max(5, 18 * sc);
        for (let gi = 0; gi < 4; gi++) {
            const gy = panelY + panelHeight + gi * glowH * 0.35;
            const ga2 = (0.2 - gi * 0.04) * drawAlpha;
            const shrink = gi * panelW * 0.1;
            gfx.rect(panelX + shrink, gy, panelW - shrink * 2, glowH * 0.35)
                .fill({ color: glowColor, alpha: ga2 });
        }

        // Outer glow bloom (wide, soft)
        for (let i = 4; i >= 0; i--) {
            const expand = (i + 1) * 4 * sc;
            const ga = (0.12 + shimmer * 0.6) * (5 - i) / 5 * drawAlpha;
            gfx.roundRect(panelX - expand, panelY - expand, panelW + expand * 2, panelHeight + expand * 2, radius + expand)
                .fill({ color: glowColor, alpha: ga });
        }

        // Main panel — semi-transparent glass
        gfx.roundRect(panelX, panelY, panelW, panelHeight, radius)
            .fill({ color: baseColor, alpha: 0.5 * drawAlpha });

        // Glass highlight stripe (top area)
        const hlH = panelHeight * 0.3;
        gfx.roundRect(panelX + 3, panelY + 3, panelW - 6, hlH, Math.max(2, radius - 2))
            .fill({ color: 0xffffff, alpha: 0.4 * drawAlpha });

        // Sheen sweep (animated diagonal highlight)
        const sheenPhase = (now / 2000 + optIdx * 0.7) % 1;
        const sheenY = panelY + panelHeight * sheenPhase;
        const sheenH = Math.max(4, 12 * sc);
        gfx.rect(panelX + 4, sheenY, panelW - 8, sheenH)
            .fill({ color: 0xffffff, alpha: 0.18 * drawAlpha * (1 - Math.abs(sheenPhase - 0.5) * 2) });

        // Border — bright glow edge
        gfx.roundRect(panelX, panelY, panelW, panelHeight, radius)
            .stroke({ width: Math.max(2, 3 * sc), color: glowColor, alpha: (0.95 + shimmer) * drawAlpha });

        // Inner border — subtle white
        gfx.roundRect(panelX + 4, panelY + 4, panelW - 8, panelHeight - 8, Math.max(2, radius - 3))
            .stroke({ width: Math.max(0.8, 1.5 * sc), color: 0xffffff, alpha: 0.25 * drawAlpha });

        // Content (uses label pool)
        const centerX = (pLeft.x + pRight.x) / 2;
        const centerY = panelY + panelHeight / 2;
        const fontSize = Math.max(16, Math.floor(38 * sc));
        const iconSize = Math.max(12, 20 * sc);

        if (isWeapon) {
            const wColor = WEAPON_COLORS[opt.weapon] || 0xffffff;
            // Weapon icon circle
            gfx.circle(centerX, centerY - fontSize * 0.3, iconSize * 1.5).fill({ color: wColor, alpha: 0.8 * drawAlpha });
            gfx.circle(centerX, centerY - fontSize * 0.3, iconSize * 0.6).fill({ color: 0xffffff, alpha: 0.5 * drawAlpha });
            // Labels via pool
            const nameLabel = getPooledLabel();
            nameLabel.text = opt.weapon.toUpperCase();
            nameLabel.style.fontSize = fontSize;
            nameLabel.style.fill = 0xffffff;
            nameLabel.anchor.set(0.5);
            nameLabel.x = centerX; nameLabel.y = centerY + fontSize * 0.6;
            nameLabel.alpha = drawAlpha;
            nameLabel.visible = true;

            const durLabel = getPooledLabel();
            durLabel.text = `${WEAPON_DEFS[opt.weapon].duration}s`;
            durLabel.style.fontSize = Math.max(10, Math.floor(18 * sc));
            durLabel.style.fill = 0xdddddd;
            durLabel.anchor.set(0.5);
            durLabel.x = centerX; durLabel.y = centerY + fontSize * 1.3;
            durLabel.alpha = drawAlpha * 0.85;
            durLabel.visible = true;
        } else {
            // Icon based on operation
            const as = iconSize * 2;
            const ay = centerY - fontSize * 0.3;
            if (op === '+' || op === '+%') {
                // Up arrow
                gfx.poly([centerX, ay - as, centerX + as * 0.7, ay + as * 0.1, centerX + as * 0.25, ay + as * 0.1,
                           centerX + as * 0.25, ay + as * 0.6, centerX - as * 0.25, ay + as * 0.6,
                           centerX - as * 0.25, ay + as * 0.1, centerX - as * 0.7, ay + as * 0.1])
                    .fill({ color: 0xffffff, alpha: 0.9 * drawAlpha });
            } else if (op === '×') {
                // Double up arrows (multiply = powerful boost)
                const s = as * 0.7;
                gfx.poly([centerX, ay - s, centerX + s * 0.6, ay + s * 0.05, centerX + s * 0.2, ay + s * 0.05,
                           centerX + s * 0.2, ay + s * 0.3, centerX - s * 0.2, ay + s * 0.3,
                           centerX - s * 0.2, ay + s * 0.05, centerX - s * 0.6, ay + s * 0.05])
                    .fill({ color: 0xffffff, alpha: 0.9 * drawAlpha });
                gfx.poly([centerX, ay - s + s * 0.35, centerX + s * 0.6, ay + s * 0.4, centerX + s * 0.2, ay + s * 0.4,
                           centerX + s * 0.2, ay + s * 0.65, centerX - s * 0.2, ay + s * 0.65,
                           centerX - s * 0.2, ay + s * 0.4, centerX - s * 0.6, ay + s * 0.4])
                    .fill({ color: 0xffffff, alpha: 0.6 * drawAlpha });
            } else if (op === '÷' || op === '-%') {
                // Down arrow
                gfx.poly([centerX, ay + as * 0.8, centerX + as * 0.6, ay - as * 0.05, centerX + as * 0.2, ay - as * 0.05,
                           centerX + as * 0.2, ay - as * 0.5, centerX - as * 0.2, ay - as * 0.5,
                           centerX - as * 0.2, ay - as * 0.05, centerX - as * 0.6, ay - as * 0.05])
                    .fill({ color: 0xffffff, alpha: 0.9 * drawAlpha });
            } else {
                // Down arrow (subtract)
                gfx.poly([centerX, ay + as, centerX + as * 0.7, ay - as * 0.1, centerX + as * 0.25, ay - as * 0.1,
                           centerX + as * 0.25, ay - as * 0.6, centerX - as * 0.25, ay - as * 0.6,
                           centerX - as * 0.25, ay - as * 0.1, centerX - as * 0.7, ay - as * 0.1])
                    .fill({ color: 0xffffff, alpha: 0.9 * drawAlpha });
            }
            // Value label
            const valLabel = getPooledLabel();
            if (op === '+%' || op === '-%') {
                valLabel.text = `${op === '+%' ? '+' : '-'}${opt.value}%`;
            } else {
                valLabel.text = `${op}${opt.value}`;
            }
            valLabel.style.fontSize = Math.floor(fontSize * 1.4);
            valLabel.style.fill = 0xffffff;
            valLabel.anchor.set(0.5);
            valLabel.x = centerX; valLabel.y = centerY + fontSize * 0.8;
            valLabel.alpha = drawAlpha;
            valLabel.visible = true;
        }
    });
}

// ============================================================
// DRAWING: BULLETS
// ============================================================
function drawBullets(gfx) {
    const g = game;
    g.bullets.forEach(b => {
        const relZ = b.z - g.cameraZ;
        if (relZ < 0 || relZ > CONFIG.SPAWN_DISTANCE + 100) return;
        const p = project(b.x, relZ);

        switch (b.weapon) {
            case 'pistol': default: {
                const s = Math.max(1, 3 * p.scale);
                const pTail = project(b.x - b.vx * 0.8, relZ - 8);
                gfx.moveTo(pTail.x, pTail.y).lineTo(p.x, p.y)
                    .stroke({ width: s, color: 0xffff88 });
                gfx.circle(p.x, p.y, s).fill(0xffffff);
                break;
            }
            case 'shotgun': {
                const s = Math.max(1, 2 * p.scale);
                const pTail = project(b.x - b.vx * 0.5, relZ - 5);
                gfx.moveTo(pTail.x, pTail.y).lineTo(p.x, p.y)
                    .stroke({ width: s, color: 0xffaa00 });
                gfx.circle(p.x, p.y, s * 0.8).fill(0xffee88);
                break;
            }
            case 'laser': {
                const s = Math.max(2, 4 * p.scale);
                const pTail = project(b.x, relZ - 30);
                // Outer glow
                gfx.moveTo(pTail.x, pTail.y).lineTo(p.x, p.y)
                    .stroke({ width: s * 2.5, color: 0x00ffff, alpha: 0.2 });
                // Core
                gfx.moveTo(pTail.x, pTail.y).lineTo(p.x, p.y)
                    .stroke({ width: s, color: 0x00ffff });
                // White center
                gfx.moveTo(pTail.x, pTail.y).lineTo(p.x, p.y)
                    .stroke({ width: Math.max(1, s * 0.4), color: 0xffffff, alpha: 0.8 });
                break;
            }
            case 'rocket': {
                const s = Math.max(2, 5 * p.scale);
                const pTail = project(b.x, relZ - 15);
                gfx.moveTo(pTail.x, pTail.y).lineTo(p.x, p.y)
                    .stroke({ width: s * 1.5, color: 0x999999, alpha: 0.4 });
                gfx.circle(p.x, p.y, s).fill(0xcc4444);
                gfx.circle(p.x, p.y - s * 0.5, s * 0.5).fill(0xff8888);
                gfx.circle(p.x, p.y + s * 1.2, s * 0.6).fill(0xffaa00);
                gfx.circle(p.x, p.y + s * 1.0, s * 0.3).fill(0xffff00);
                break;
            }
        }
    });
}

// ============================================================
// DRAWING: EFFECTS (additive blend layer)
// ============================================================
function drawExplosions(gfx) {
    const g = game;
    g.explosions.forEach(exp => {
        const relZ = exp.z - g.cameraZ;
        const p = project(exp.x, relZ);
        const progress = exp.timer / exp.maxTimer;
        const a = 1 - progress;

        if (exp.isBlastRing) {
            // Expanding blast radius ring
            const ringR = 55 * p.scale * (0.3 + progress * 0.7);
            gfx.circle(p.x, p.y - 3 * p.scale, ringR)
                .stroke({ width: Math.max(2, 5 * p.scale * (1 - progress)), color: 0xff6600, alpha: a * 0.6 });
            gfx.circle(p.x, p.y - 3 * p.scale, ringR * 0.85)
                .fill({ color: 0xff4400, alpha: a * 0.12 });
        } else {
            const radius = (10 + progress * 25) * p.scale;
            const cy = p.y - 5 * p.scale;
            // Initial flash pop (first 15%)
            if (progress < 0.15) {
                const flashR = radius * 2 * (progress / 0.15);
                gfx.circle(p.x, cy, flashR).fill({ color: 0xffffff, alpha: (1 - progress / 0.15) * 0.7 });
            }
            // Shockwave ring
            gfx.circle(p.x, cy, radius * 1.5)
                .stroke({ width: Math.max(1, 3 * p.scale * (1 - progress)), color: 0xffcc44, alpha: a * 0.4 });
            // Outer fire
            gfx.circle(p.x, cy, radius).fill({ color: 0xf08020, alpha: a * 0.8 });
            // Inner core
            gfx.circle(p.x, cy, radius * 0.5).fill({ color: 0xfff8e0, alpha: a });
            // Spark lines radiating outward
            if (progress < 0.5) {
                const sparkA = (1 - progress * 2) * 0.6;
                for (let si = 0; si < 6; si++) {
                    const ang = si * Math.PI / 3 + exp.timer * 0.1;
                    const innerR = radius * 0.6, outerR = radius * 1.8 * (0.5 + progress);
                    gfx.moveTo(p.x + Math.cos(ang) * innerR, cy + Math.sin(ang) * innerR)
                        .lineTo(p.x + Math.cos(ang) * outerR, cy + Math.sin(ang) * outerR)
                        .stroke({ width: Math.max(1, 2 * p.scale), color: 0xffcc00, alpha: sparkA });
                }
            }
        }
    });
}

function drawParticles(gfx) {
    game.particles.forEach(p => {
        const relZ = p.z - game.cameraZ;
        if (relZ < -10) return;
        const proj = project(p.x, Math.max(0, relZ));
        const a = p.life / p.maxLife;
        // Particles shrink + fade over lifetime
        const s = Math.max(0.5, p.size * proj.scale * (0.3 + a * 0.7));
        if (s < 0.5) return;
        // Slight offset for a spin/sparkle feel
        const ox = Math.sin(p.life * 0.8) * s * 0.3;
        const oy = Math.cos(p.life * 0.8) * s * 0.3;
        gfx.rect(proj.x - s / 2 + ox, proj.y + p.y * proj.scale - s / 2 + oy, s, s)
            .fill({ color: p.color, alpha: a * 0.9 });
        // Bright core for fresh particles
        if (a > 0.6) {
            const cs = s * 0.4;
            gfx.rect(proj.x - cs / 2 + ox, proj.y + p.y * proj.scale - cs / 2 + oy, cs, cs)
                .fill({ color: 0xffffff, alpha: (a - 0.6) * 2 });
        }
    });
}

// ============================================================
// DRAWING: GATE PASS EFFECTS
// ============================================================
function drawGateShatterPieces(gfx) {
    const g = game;
    g.gateShatterPieces.forEach(p => {
        const a = Math.min(1, p.life / p.maxLife * 1.5);
        const s = p.size * a;
        if (s < 0.5) return;
        // Glowing fragment
        gfx.rect(p.x - s, p.y - s, s * 2, s * 2).fill({ color: p.color, alpha: a * 0.9 });
        // White core
        gfx.rect(p.x - s * 0.4, p.y - s * 0.4, s * 0.8, s * 0.8).fill({ color: 0xffffff, alpha: a * 0.6 });
    });
}

function drawSpeedLines(gfx) {
    const g = game;
    g.speedLines.forEach(s => {
        const a = s.life / s.maxLife;
        const len = s.length * a;
        const dx = -s.vx / Math.sqrt(s.vx * s.vx + s.vy * s.vy) * len;
        const dy = -s.vy / Math.sqrt(s.vx * s.vx + s.vy * s.vy) * len;
        gfx.moveTo(s.x, s.y).lineTo(s.x + dx, s.y + dy)
            .stroke({ width: 2 + a * 2, color: s.color, alpha: a * 0.5 });
        // Bright tip
        gfx.circle(s.x, s.y, 2).fill({ color: 0xffffff, alpha: a * 0.7 });
    });
}

function drawGateCollapsePanels(gfx) {
    const g = game;
    g.gateCollapsePanels.forEach(p => {
        const a = Math.max(0, p.life / p.maxLife);
        if (a <= 0) return;
        const hw = p.w / 2, hh = p.h / 2;
        const cx = p.sx, cy = p.sy + hh;
        const cos = Math.cos(p.rotAngle), sin = Math.sin(p.rotAngle);
        // Compute rotated corners
        const corners = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([dx, dy]) =>
            [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos]);
        // Draw panel
        gfx.poly(corners.flat()).fill({ color: p.color, alpha: a * 0.7 });
        // Crack lines across panel
        if (p.crackProgress > 0.1) {
            const ca = a * Math.min(1, p.crackProgress * 2);
            for (let i = 0; i < 3; i++) {
                const x1 = cx + (Math.random() - 0.5) * p.w * 0.8;
                const y1 = cy + (Math.random() - 0.5) * p.h * 0.8;
                const x2 = cx + (Math.random() - 0.5) * p.w * 0.8;
                const y2 = cy + (Math.random() - 0.5) * p.h * 0.8;
                gfx.moveTo(x1, y1).lineTo(x2, y2)
                    .stroke({ width: 1.5, color: 0x000000, alpha: ca * 0.6 });
            }
        }
        // Border
        gfx.poly(corners.flat()).stroke({ width: 2, color: 0xffffff, alpha: a * 0.3 });
    });
}

function drawGateFloatingText() {
    const g = game;
    if (!g.gateText) return;
    const t = g.gateText;
    const progress = t.timer / t.maxTimer;
    const a = progress > 0.6 ? 1 - (progress - 0.6) / 0.4 : 1;
    const label = getPooledLabel();
    label.text = t.text;
    label.style.fontSize = Math.floor(42 * t.scale);
    label.style.fill = t.color;
    label.style.fontWeight = 'bold';
    label.anchor.set(0.5);
    label.x = screenW / 2;
    label.y = screenH * 0.35 - progress * 40;
    label.alpha = a;
    label.visible = true;
    // Shadow/outline label
    const shadow = getPooledLabel();
    shadow.text = t.text;
    shadow.style.fontSize = Math.floor(42 * t.scale);
    shadow.style.fill = 0x000000;
    shadow.style.fontWeight = 'bold';
    shadow.anchor.set(0.5);
    shadow.x = screenW / 2 + 2;
    shadow.y = screenH * 0.35 - progress * 40 + 2;
    shadow.alpha = a * 0.5;
    shadow.visible = true;
}

function drawBarrelExplosionTexts() {
    const g = game;
    g.barrelExplosionTexts.forEach(t => {
        const a = 1 - t.timer / t.maxTimer;
        if (a <= 0) return;
        const label = getPooledLabel();
        label.text = t.text;
        label.style.fontSize = Math.floor(36 * t.scale);
        label.style.fill = t.color;
        label.style.fontWeight = 'bold';
        label.anchor.set(0.5);
        label.x = t.x; label.y = t.y;
        label.alpha = a;
        label.visible = true;
        // Shadow
        const sh = getPooledLabel();
        sh.text = t.text;
        sh.style.fontSize = Math.floor(36 * t.scale);
        sh.style.fill = 0x000000;
        sh.style.fontWeight = 'bold';
        sh.anchor.set(0.5);
        sh.x = t.x + 2; sh.y = t.y + 2;
        sh.alpha = a * 0.5;
        sh.visible = true;
    });
}

// ============================================================
// DRAWING: SQUAD + PLAYER
// ============================================================
function drawSquadAndPlayer(gfx) {
    const g = game;
    // Squad members — scale columns by squad size for visible growth
    const maxDraw = Math.min(g.squadCount, 40); // draw up to 40
    const cols = g.squadCount <= 5 ? 3 : g.squadCount <= 15 ? 5 : 7;
    const spacing = g.squadCount <= 15 ? 25 : 20; // tighter when many
    for (let i = 1; i < maxDraw; i++) {
        const row = Math.ceil(i / cols);
        const col = ((i - 1) % cols) - Math.floor(cols / 2);
        const soldierScale = g.squadCount <= 15 ? 0.85 : g.squadCount <= 30 ? 0.7 : 0.55;
        const sp = project(g.player.x + col * spacing, row * (spacing * 0.8));
        drawPlayerSoldier(gfx, sp.x, sp.y, sp.scale * soldierScale, g.player.animFrame + i * 3);
    }

    // Squad count badge (always show when > maxDraw or > 8 for clarity)
    if (g.squadCount > 8) {
        const p = project(g.player.x, 0);
        const badgeSize = g.squadCount > 40 ? 18 : 14;
        gfx.circle(p.x + 30, p.y - 45, badgeSize).fill({ color: 0x000000, alpha: 0.7 });
        const badge = getPooledLabel();
        badge.text = String(g.squadCount);
        badge.style.fontSize = badgeSize; badge.style.fill = 0xf0c040;
        badge.anchor.set(0.5); badge.x = p.x + 30; badge.y = p.y - 45;
        badge.visible = true;
    }

    // Main player
    const pp = project(g.player.x, 0);
    drawPlayerSoldier(gfx, pp.x, pp.y, pp.scale, g.player.animFrame);

    // Muzzle flash
    if (g.player.muzzleFlash > 0) {
        drawMuzzleFlash(gfx, pp.x, pp.y - 30 * pp.scale, pp.scale, g.weapon);
    }
}
