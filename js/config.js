// ============================================================
// CONFIGURATION & CONSTANTS
// ============================================================
const CONFIG = {
    ROAD_HALF_WIDTH: 220,
    VIEW_DIST: 200,
    HORIZON_RATIO: 0.22,
    PLAYER_SPEED: 3,
    CAMERA_SPEED: 0.8,
    BULLET_SPEED: 10,
    ENEMY_SPEED: 0.12,
    ENEMY_LATERAL_SPEED: 0.15,
    SHOOT_INTERVAL: 120,
    SPAWN_DISTANCE: 500,
    GATE_DISTANCE: 300,
    ENEMY_HP: 3,
    PIXEL_SIZE: 2,
    CLOUD_COUNT: 8,
    VIGNETTE_STRENGTH: 0.4,
    WAVE_BANNER_DURATION: 120,
    COMBO_TIMEOUT: 2000,
};

const WEAPON_DEFS = {
    pistol:        { fireRateMult: 1.0,  duration: Infinity },
    shotgun:       { fireRateMult: 2.0,  duration: 8  },
    laser:         { fireRateMult: 0.55, duration: 6  },
    rocket:        { fireRateMult: 1.7,  duration: 10 },
    invincibility: { fireRateMult: 1.0,  duration: 4  },
};

const WEAPON_COLORS = {
    pistol:  0xffff88,
    shotgun: 0xff9900,
    laser:   0x00ffff,
    rocket:  0xff4444,
};

// 大奶龙 (boss) sprite sheet
const MONSTER_FRAME_COUNT = 4;
const MONSTER_FRAME_SIZE = 64;

// 火焰奶龙 (fire dragon, elite type 3, wave 10+) sprite sheet
const FIRE_ENEMY_FRAME_COUNT = 8;
const FIRE_ENEMY_FRAME_SIZE = 256;

// 小奶龙 (normal enemy type 1) sprite sheet
const XIAO_NAI_LONG_FRAME_COUNT = 21;
const XIAO_NAI_LONG_FRAME_SIZE = 128;

// 派大星 (Patrick) sprite sheet layout
const PATRICK_COLS = 6;
const PATRICK_ROWS = 4;
const PATRICK_FRAME_W = 283;
const PATRICK_FRAME_H = 267;
const PATRICK_TOTAL_FRAMES = 23; // last row has 5

// Gate threshold: below this → multipliers, above → percentages
const PERCENT_GATE_THRESHOLD = 20;

// ============================================================
// TALENT SYSTEM — purchased with gems (boss drops)
// ============================================================
const TALENT_DEFS = [
    {
        id: 'damage',
        name: '攻击强化',
        desc: '所有武器基础伤害提升',
        icon: '⚔️',
        color: '#ff7755',
        colorHex: 0xff7755,
        maxLevel: 5,
        gemCosts: [1, 2, 3, 5, 8],
        effectDesc: (lv) => `+${lv * 15}% 伤害`,
    },
    {
        id: 'squad',
        name: '精英征召',
        desc: '增加游戏开始时的初始兵力',
        icon: '🪖',
        color: '#44aaff',
        colorHex: 0x44aaff,
        maxLevel: 5,
        gemCosts: [1, 2, 3, 5, 8],
        effectDesc: (lv) => `+${lv} 初始兵力`,
    },
    {
        id: 'fireRate',
        name: '急速连发',
        desc: '提升所有武器射击频率',
        icon: '💨',
        color: '#44ffcc',
        colorHex: 0x44ffcc,
        maxLevel: 4,
        gemCosts: [2, 3, 5, 8],
        effectDesc: (lv) => `-${lv * 8}% 射击间隔`,
    },
    {
        id: 'armor',
        name: '护甲强化',
        desc: '每级永久减少1点受击兵力损失',
        icon: '🛡️',
        color: '#44aaff',
        colorHex: 0x44aaff,
        maxLevel: 3,
        gemCosts: [1, 3, 6],
        effectDesc: (lv) => `−${lv} 受击伤害`,
        isArmor: true, // 特殊标记：读写 playerData.armor 而非 playerData.talents
    },
];

// ============================================================
// SHOP & COIN SYSTEM
// ============================================================
const COIN_DROP_BASE = 5;       // Base coins dropped by boss
const COIN_DROP_PER_LEVEL = 3;  // Extra coins per boss level
const COIN_MAGNET_RANGE = 80;   // Auto-pickup range for coins

// Shared cooldown (seconds) after any skill weapon expires — applies to ALL weapons
const SKILL_SHARED_COOLDOWN = 5;

// Shop weapon definitions: consumable charges purchased with coins
// Each purchase = 1 charge. All weapons share ONE cooldown after any activation expires.
const SHOP_WEAPONS = {
    shotgun: {
        name: '霰弹枪',
        desc: '扇形散射，近距离威力大',
        icon: '🔫',
        price: 15,
        color: '#ff9900',
        colorHex: 0xff9900,
        duration: 10,
        hotkey: '1',
    },
    laser: {
        name: '激光炮',
        desc: '穿透射线，贯穿所有敌人',
        icon: '⚡',
        price: 22,
        color: '#00ffff',
        colorHex: 0x00ffff,
        duration: 8,
        hotkey: '2',
    },
    rocket: {
        name: '火箭筒',
        desc: 'AOE爆炸，范围毁灭',
        icon: '🚀',
        price: 32,
        color: '#ff4444',
        colorHex: 0xff4444,
        duration: 10,
        hotkey: '3',
    },
    invincibility: {
        name: '无敌护盾',
        desc: '激活后4秒内免疫所有伤害，防御一切攻击',
        icon: '🛡️',
        price: 55,
        color: '#ffdd44',
        colorHex: 0xffdd44,
        duration: 4,
        hotkey: '4',
        defenseOnly: true, // 仅在防具标签页展示
    },
};

// ============================================================
// ARMOR SYSTEM — purchased with coins, permanent passive
// ============================================================
const SHOP_ARMOR = [
    { level: 1, name: '轻型护甲', icon: '🔰', desc: '每次受到伤害时减少1点兵力损失', price: 25,  color: '#44aaff', colorHex: 0x44aaff },
    { level: 2, name: '重型护甲', icon: '⚙️',  desc: '进一步减少1点伤害（累计 −2）',   price: 60, color: '#2266ee', colorHex: 0x2266ee },
    { level: 3, name: '钢铁意志', icon: '🏰', desc: '进一步减少1点伤害（累计 −3）',   price: 120, color: '#9944ff', colorHex: 0x9944ff },
];
