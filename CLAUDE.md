# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bridge Assault (桥梁突击) — a wave-based lane defense game built with vanilla JavaScript and PixiJS v8.6.1 (loaded via CDN). No build tools, bundler, or package manager. Open `index.html` directly in a browser or serve with any static file server.

## Running

```bash
# Any static server works, e.g.:
python3 -m http.server 8000
# Then open http://localhost:8000
```

There are no tests, linters, or build steps.

## Architecture

### Module Load Order (strict — defined in index.html)

```
config.js → globals.js → audio.js → core.js → spawn.js → combat.js → draw.js → hud.js → update.js → render.js → main.js
```

All modules share a single global scope. Later modules depend on functions/variables from earlier ones. **Order matters** — moving a script tag will break things.

### Module Responsibilities

| File | Role |
|------|------|
| `config.js` | All constants: game params (`CONFIG`), weapon definitions (`WEAPON_DEFS`, `SHOP_WEAPONS`), sprite sheet layouts, coin/shop config |
| `globals.js` | Global variable declarations (PixiJS objects, pools, DOM refs), `playerData` persistence (localStorage load/save) |
| `audio.js` | Web Audio API synthesized sound effects (no audio files) |
| `core.js` | `createGame()` state factory, `project()` 3D perspective, `getAdaptiveFactor()` difficulty scaling, object pools (labels, sprites) |
| `spawn.js` | Enemy wave generation, boss spawning, gate generation (troop/weapon), barrel placement |
| `combat.js` | `fireWeapon()` for all weapon types, particle/explosion helpers, `spawnBossCoins()`, damage numbers |
| `draw.js` | All rendering primitives: sky, bridge, characters, gates, bullets, effects, squad+player drawing |
| `hud.js` | HUD updates: score/squad/wave/coin text, weapon timer bar, boss HP bar, wave banner, combo counter, damage popups |
| `update.js` | Main game tick: input processing, bullet/enemy/coin physics, collision detection, gate interaction, spawning triggers, effect timers |
| `render.js` | Frame orchestrator: clears graphics, builds depth-sorted render list, calls draw functions in correct layer order |
| `main.js` | PixiJS app init, sprite loading, UI layer setup, input handlers, shop system (buy/equip/render), game start/over/menu flow, game loop ticker |

### Key Architectural Patterns

**Single game object** — `game = createGame()` in `core.js` holds all mutable state (enemies, bullets, particles, coins, etc.). Modules read/write this global directly.

**Pseudo-3D projection** — `project(worldX, relZ)` converts world coordinates to screen position+scale. A per-frame cache (`_proj`) avoids redundant calculations. Every entity render uses this.

**Adaptive difficulty** — `getAdaptiveFactor()` scales enemy stats based on current vs expected squad size, with logarithmic dampening. Used in `spawn.js` (HP/damage) and `update.js` (speed).

**Object pooling** — `getPooledLabel()` and `getPooledMonsterSprite()` recycle PixiJS objects to avoid GC pressure. Pools are reset each frame in `render.js`.

**Gate system** — Two modes based on `PERCENT_GATE_THRESHOLD` (squad < 20 gets multipliers as comeback mechanic, squad >= 20 gets percentage-based scaling).

### Data Persistence (localStorage)

- `bridgeAssault_playerData` — `{ coins, ownedWeapons[], equippedWeapon }` — saved on coin pickup, weapon purchase/equip
- `bridgeAssault_highScore` — `{ score, wave }` — saved on game over

### Game Loop

```
PixiJS ticker → if playing: update(dt) → always: render()
```

`update(dt)` handles all logic (movement, collision, spawning, effects). `render()` handles all drawing (clear, sort by Z, draw layers, HUD overlay).

### Boss System

- Spawns every 5 waves (`wave % 5 === 0`)
- Locked at far range (`bossHoldZ = SPAWN_DISTANCE`), never advances — camera pauses during boss fights
- Shoots aimed projectiles (+ spread at level 3+)
- Drops coins on death via `spawnBossCoins()` — all kill paths (direct hit, AOE, barrel explosion) must call this

### Shop/Weapon System

- Shop weapons defined in `SHOP_WEAPONS` (config.js) — purchased with coins, persisted in `playerData`
- Equipped weapon auto-applies at game start in `startGame()` (main.js) with timed duration
- Gate-acquired weapons (in-game) are temporary power-ups from `WEAPON_DEFS`

## Deployment

游戏部署在远程服务器 `myserver` 上，路径为 `~/js_game/`。

```bash
# 部署命令（同步 js、assets、index.html、style.css）
rsync -avz --delete \
  /Users/linzhiqin/Codespace/game_demo/js/ myserver:~/js_game/js/
rsync -avz --delete \
  /Users/linzhiqin/Codespace/game_demo/assets/ myserver:~/js_game/assets/
rsync -avz \
  /Users/linzhiqin/Codespace/game_demo/index.html \
  /Users/linzhiqin/Codespace/game_demo/style.css \
  myserver:~/js_game/
```

- 服务器别名：`myserver`（已在 ~/.ssh/config 配置）
- 服务器目录结构与本地一致：`index.html`, `style.css`, `js/`, `assets/`

## Conventions

- Language: UI text in Chinese, code comments/variables in English
- Cache-busting: Script/CSS URLs use `?v=N` query parameter — increment when changing files
- All sprite frame extraction happens in `main.js init()` from sprite sheet PNGs
- Enemy types: 0/2 = 派大星 (Patrick), 1 = 小奶龙 (small dragon), boss = 大奶龙 (boss dragon)
- Mobile detection: aspect ratio < 1 triggers mobile adjustments (bullet limits, gate panel count, horizon offset)
