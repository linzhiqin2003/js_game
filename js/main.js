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
    });
    document.addEventListener('keyup', (e) => { keys[e.key] = false; });
}

// ============================================================
// UI (start / gameover)
// ============================================================
// overlay and startBtn are defined in globals.js

function startGame() {
    initAudio();
    game = createGame();
    spawnEnemyWave();
    overlay.classList.add('hidden');
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
    overlay.innerHTML = `
        <h1>GAME OVER</h1>
        <div id="scoreDisplay">最终得分</div>
        <div id="finalScore">${game.score}</div>
        ${isNewRecord ? '<div style="color:#f0c040;font-size:28px;margin-bottom:12px;text-shadow:0 0 15px #f0c040;letter-spacing:3px;">★ NEW RECORD! ★</div>' : ''}
        <div style="color:#aaa;font-size:20px;margin-bottom:12px;">到达第 ${game.wave} 波 | 击杀 ${game.killCount}</div>
        <div style="color:#f90;font-size:22px;margin-bottom:10px;">最高连击: ${game.bestCombo}x</div>
        <div style="color:#88bbff;font-size:22px;margin-bottom:28px;">历史最高: ${hs.score} (第${hs.wave}波)</div>
        <button class="btn" onclick="startGame()">PLAY AGAIN</button>
    `;
}

startBtn.addEventListener('click', startGame);

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

    // Load monster sprite sheet (using Image element for file:// compatibility)
    try {
        await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                monsterTexture = PIXI.Texture.from(img);
                for (let i = 0; i < MONSTER_FRAME_COUNT; i++) {
                    const frame = new PIXI.Rectangle(
                        i * MONSTER_FRAME_SIZE, 0,
                        MONSTER_FRAME_SIZE, MONSTER_FRAME_SIZE
                    );
                    monsterFrames.push(new PIXI.Texture({ source: monsterTexture.source, frame }));
                }
                console.log('Monster sprite loaded:', monsterFrames.length, 'frames');
                resolve();
            };
            img.onerror = () => reject(new Error('Image load failed'));
            img.src = MONSTER_SPRITE_DATA;
        });
    } catch (e) {
        console.warn('Monster sprite not found, using procedural drawing:', e.message);
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

    const hudStyle = {
        fontFamily: 'Courier New', fontSize: 18, fill: 0xffffff, fontWeight: 'bold',
        stroke: { color: 0x000000, width: 4 },
        dropShadow: { color: 0x000000, blur: 4, distance: 2, angle: Math.PI / 4 },
    };

    scoreText = new PIXI.Text({ text: 'SCORE: 0', style: { ...hudStyle } });
    scoreText.x = screenW / 2 - 200; scoreText.y = 14;
    scoreText.anchor.set(0.5, 0);
    uiContainer.addChild(scoreText);

    squadText = new PIXI.Text({ text: 'SQUAD: 3', style: { ...hudStyle } });
    squadText.x = screenW / 2; squadText.y = 14;
    squadText.anchor.set(0.5, 0);
    uiContainer.addChild(squadText);

    waveText = new PIXI.Text({ text: 'WAVE: 1', style: { ...hudStyle } });
    waveText.x = screenW / 2 + 200; waveText.y = 14;
    waveText.anchor.set(0.5, 0);
    uiContainer.addChild(waveText);

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
        scoreText.x = screenW / 2 - 200;
        squadText.x = screenW / 2;
        waveText.x = screenW / 2 + 200;
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
