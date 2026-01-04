
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    Asteroid, Bullet, EntityType, GameState, Particle, Ship, ExpOrb, HullOrb, Vector, Drone, UpgradeCategory, UpgradeDef, Entity
} from '../types';
import {
    SHIP_SIZE, SHIP_THRUST, SHIP_TURN_SPEED, SHIP_FRICTION, SHIP_MAX_SPEED, SHIP_BASE_HULL,
    BULLET_SPEED, BULLET_LIFE, BULLET_RATE, BULLET_DAMAGE,
    ASTEROID_SPEED_BASE, MOLTEN_SPEED_MULTIPLIER, ASTEROID_HULL_DAMAGE, ASTEROID_SMALL_DAMAGE,
    PARTICLE_COUNT_EXPLOSION, COLORS, HULL_DROP_CHANCE,
    HULL_ORB_VALUE, XP_ORB_NORMAL_VALUE, XP_ORB_SUPER_VALUE,
    HIT_FLASH_FRAMES, SCREEN_SHAKE_DECAY,
    UPGRADES, XP_BASE_REQ, XP_SCALING_FACTOR,
    LEVEL_GATE_LARGE_ASTEROIDS, LEVEL_GATE_MOLTEN_SMALL, LEVEL_GATE_MOLTEN_LARGE, FORMATION_CHANCE,
    LEVEL_GATE_FROZEN, FROZEN_HP, FROZEN_SPEED, FROZEN_COLOR, FROZEN_AURA_RANGE, FROZEN_AURA_DAMAGE, FROZEN_SLOW_FACTOR,
    LEVEL_GATE_IRON, IRON_SPEED, IRON_HP_MULT, IRON_DAMAGE, IRON_KNOCKBACK, IRON_COLOR, ORB_MAGNET_RANGE_BASE,
    SPAWN_RATES
} from '../constants';
import GameUI from './GameUI';

// --- Utility Functions ---
const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;
const dist = (v1: Vector, v2: Vector) => Math.sqrt(Math.pow(v2.x - v1.x, 2) + Math.pow(v2.y - v1.y, 2));

const generatePolygon = (radius: number, sides: number, irregularity: number): Vector[] => {
    const vertices: Vector[] = [];
    for (let i = 0; i < sides; i++) {
        const angle = (i / sides) * Math.PI * 2;
        const r = radius + randomRange(-irregularity, irregularity);
        vertices.push({
            x: Math.cos(angle) * r,
            y: Math.sin(angle) * r,
        });
    }
    return vertices;
};

// Precise collision detection for triangular ship vs circular/polygonal asteroid
const checkShipCollision = (ship: Ship, asteroid: Asteroid): boolean => {
    const maxShipDim = ship.radius * 1.4;
    const distToCenter = dist(ship.pos, asteroid.pos);
    if (distToCenter > maxShipDim + asteroid.radius) return false;

    const hitRadius = asteroid.radius * 0.85;
    const cos = Math.cos(ship.rotation);
    const sin = Math.sin(ship.rotation);

    const points = [
        { x: ship.radius, y: 0 },
        { x: -ship.radius * 0.6, y: ship.radius * 0.75 },
        { x: -ship.radius * 0.6, y: -ship.radius * 0.75 }
    ];

    for (const p of points) {
        const wx = ship.pos.x + (p.x * cos - p.y * sin);
        const wy = ship.pos.y + (p.x * sin + p.y * cos);
        if (dist({ x: wx, y: wy }, asteroid.pos) < hitRadius) return true;
    }

    if (distToCenter < hitRadius) return true;

    return false;
};

interface FloatingText {
    id: string;
    text: string;
    pos: Vector;
    vel: Vector;
    life: number;
    color: string;
    size: number;
}

const AsteroidsGame: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [gameState, setGameState] = useState<GameState>(GameState.MENU);

    // Game Logic Refs (Decoupled from React State for Perf)
    const scoreRef = useRef(0);
    const levelRef = useRef(1);
    const xpTargetRef = useRef(XP_BASE_REQ);
    const activeUpgradesRef = useRef<Record<string, number>>({});

    // UI State (Synced occasionally or on events)
    const [uiScore, setUiScore] = useState(0);
    const [uiLevel, setUiLevel] = useState(1);
    const [uiPendingUpgrades, setUiPendingUpgrades] = useState(0);
    const [uiOfferedUpgrades, setUiOfferedUpgrades] = useState<UpgradeDef[]>([]);
    const [uiActiveUpgrades, setUiActiveUpgrades] = useState<Record<string, number>>({});
    const [deathReason, setDeathReason] = useState('');

    // Dev Mode State
    const [isDevMode, setIsDevMode] = useState(false);
    const [startLevel, setStartLevel] = useState(1);

    // Game State Refs
    const shipRef = useRef<Ship | null>(null);
    const asteroidsRef = useRef<Asteroid[]>([]);
    const bulletsRef = useRef<Bullet[]>([]);
    const particlesRef = useRef<Particle[]>([]);
    const expOrbsRef = useRef<ExpOrb[]>([]);
    const hullOrbsRef = useRef<HullOrb[]>([]);
    const dronesRef = useRef<Drone[]>([]);
    const floatingTextsRef = useRef<FloatingText[]>([]);

    const inputRef = useRef({ up: false, left: false, right: false });
    const frameRef = useRef<number>(0);
    const frameCountRef = useRef<number>(0);
    const screenShakeRef = useRef<number>(0);

    // Director Refs
    const spawnTimerRef = useRef<number>(0);
    const moltenTimerRef = useRef<number>(0);
    const frozenTimerRef = useRef<number>(0);
    const ironTimerRef = useRef<number>(0);

    // HUD Refs (For XP Bar, we can pass a ref to GameUI if we wanted direct DOM manip, but state is fine for low freq updates)
    const levelBarRef = useRef<HTMLDivElement>(null);
    const hullBarRef = useRef<HTMLDivElement>(null);

    // --- Initialization ---
    const initGame = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        shipRef.current = {
            id: 'player',
            type: EntityType.Player,
            pos: { x: canvas.width / 2, y: canvas.height / 2 },
            vel: { x: 0, y: 0 },
            radius: SHIP_SIZE,
            angle: -Math.PI / 2,
            rotation: -Math.PI / 2,
            color: COLORS.SHIP,
            toBeRemoved: false,
            thrusting: false,
            hull: SHIP_BASE_HULL,
            maxHull: SHIP_BASE_HULL,
            invulnerableUntil: Date.now() + 2000,
            isFrozen: false,
            stats: {
                regenRate: 0,
                thrustMult: 1.0,
                speedMult: 1.0,
                maxHullMult: 1.0,
                fireRateMult: 1.0,
                bulletSpeedMult: 1.0,
                pickupRange: ORB_MAGNET_RANGE_BASE,
                shieldCharges: 0,
                maxShieldCharges: 0,
                droneCount: 0,
                droneFireRateMult: 1.0,
                droneGunCount: 1,
                multishotTier: 0,
                xpMult: 1.0
            }
        };

        asteroidsRef.current = [];
        bulletsRef.current = [];
        particlesRef.current = [];
        expOrbsRef.current = [];
        hullOrbsRef.current = [];
        dronesRef.current = [];
        floatingTextsRef.current = [];

        scoreRef.current = 0;
        activeUpgradesRef.current = {};

        setUiScore(0);
        setUiActiveUpgrades({});

        spawnTimerRef.current = 60;
        moltenTimerRef.current = SPAWN_RATES.MOLTEN.START;
        frozenTimerRef.current = SPAWN_RATES.FROZEN.START;
        ironTimerRef.current = SPAWN_RATES.IRON.START;

        const initialLevel = isDevMode ? startLevel : 1;
        levelRef.current = initialLevel;
        setUiLevel(initialLevel);

        let target = XP_BASE_REQ;
        for (let i = 1; i < initialLevel; i++) {
            target = Math.floor(target * XP_SCALING_FACTOR + 1000);
        }
        xpTargetRef.current = target;

        if (initialLevel > 1) {
            setUiPendingUpgrades(initialLevel - 1);
            prepareLevelUp(true);
        } else {
            setUiPendingUpgrades(0);
            setGameState(GameState.PLAYING);
        }

    }, [startLevel, isDevMode]);

    const getWeightedAsteroidSize = (currentLevel: number): 1 | 2 | 3 => {
        const rand = Math.random();
        if (currentLevel < LEVEL_GATE_LARGE_ASTEROIDS) {
            return rand > 0.7 ? 2 : 1;
        } else {
            const largeChance = Math.min(0.4, (currentLevel - 1) * 0.05);
            const mediumChance = 0.4;
            if (rand < largeChance) return 3;
            if (rand < largeChance + mediumChance) return 2;
            return 1;
        }
    };

    const getTargetAngle = (startPos: Vector) => {
        if (!shipRef.current) return 0;
        const shipPos = shipRef.current.pos;
        const targetX = shipPos.x + randomRange(-100, 100);
        const targetY = shipPos.y + randomRange(-100, 100);
        return Math.atan2(targetY - startPos.y, targetX - startPos.x);
    };

    const spawnAsteroidFormation = (cw: number, ch: number, currentLevel: number) => {
        const edge = Math.floor(Math.random() * 4);
        const buffer = 300;
        let startCenter = { x: 0, y: 0 };

        switch (edge) {
            case 0: startCenter = { x: randomRange(0, cw), y: -buffer }; break; // Top
            case 1: startCenter = { x: cw + buffer, y: randomRange(0, ch) }; break; // Right
            case 2: startCenter = { x: randomRange(0, cw), y: ch + buffer }; break; // Bottom
            case 3: startCenter = { x: -buffer, y: randomRange(0, ch) }; break; // Left
        }

        const centerAngle = getTargetAngle(startCenter);
        const speedMult = 1 + (currentLevel * 0.05);
        const baseGroupSpeed = ASTEROID_SPEED_BASE * speedMult * 1.1;

        const count = 6 + Math.floor(Math.random() * 5);

        for (let i = 0; i < count; i++) {
            // Increase spread to avoid clustering
            const offsetX = (Math.random() - 0.5 + Math.random() - 0.5) * 300;
            const offsetY = (Math.random() - 0.5 + Math.random() - 0.5) * 300;

            const pos = {
                x: startCenter.x + offsetX,
                y: startCenter.y + offsetY
            };

            const driftAngle = centerAngle + randomRange(-0.2, 0.2);
            const driftSpeed = baseGroupSpeed * randomRange(0.85, 1.15);

            const vel = {
                x: Math.cos(driftAngle) * driftSpeed,
                y: Math.sin(driftAngle) * driftSpeed
            };

            const sizeCat = getWeightedAsteroidSize(currentLevel);
            createAsteroid(pos, vel, sizeCat);
        }
    };

    const createAsteroid = (pos: Vector, vel: Vector, sizeCat: 1 | 2 | 3) => {
        const radius = sizeCat === 3 ? 65 : sizeCat === 2 ? 35 : 18;
        const hpBase = sizeCat === 3 ? 150 : sizeCat === 2 ? 50 : 20;
        const hp = hpBase * (1 + (levelRef.current - 1) * 0.1);

        asteroidsRef.current.push({
            id: Math.random().toString(36).substr(2, 9),
            type: EntityType.Asteroid,
            pos: pos,
            vel: vel,
            radius: radius,
            angle: 0,
            color: COLORS.ASTEROID,
            toBeRemoved: false,
            vertices: generatePolygon(radius, 10 + sizeCat * 2, sizeCat * 4),
            hp: hp,
            sizeCategory: sizeCat,
            hitFlash: 0,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: randomRange(-0.02, 0.02),
            pulsateOffset: Math.random() * Math.PI * 2
        });
    };

    const spawnSingleAsteroid = (cw: number, ch: number, currentLevel: number) => {
        const sizeCat = getWeightedAsteroidSize(currentLevel);
        const speedMult = 1 + (currentLevel * 0.05);
        const speed = ASTEROID_SPEED_BASE * (1 + (Math.random() * 0.5)) * speedMult;

        const buffer = 80;
        let pos = { x: 0, y: 0 };
        if (Math.random() < 0.5) {
            pos = { x: Math.random() < 0.5 ? -buffer : cw + buffer, y: Math.random() * ch };
        } else {
            pos = { x: Math.random() * cw, y: Math.random() < 0.5 ? -buffer : ch + buffer };
        }

        const angle = getTargetAngle(pos) + randomRange(-0.5, 0.5);
        const vel = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };

        createAsteroid(pos, vel, sizeCat);
    };

    const spawnMoltenFlyby = (cw: number, ch: number, currentLevel: number) => {
        const edge = Math.floor(Math.random() * 4);
        let pos = { x: 0, y: 0 };
        const offset = 120;

        switch (edge) {
            case 0: pos = { x: Math.random() * cw, y: -offset }; break;
            case 1: pos = { x: cw + offset, y: Math.random() * ch }; break;
            case 2: pos = { x: Math.random() * cw, y: ch + offset }; break;
            case 3: pos = { x: -offset, y: Math.random() * ch }; break;
        }

        const angle = getTargetAngle(pos);

        let sizeCat: 1 | 2 | 3 = 2;

        const rand = Math.random();
        if (currentLevel >= LEVEL_GATE_MOLTEN_LARGE) {
            if (rand < 0.4) sizeCat = 3;
            else if (rand < 0.8) sizeCat = 2;
            else sizeCat = 1;
        } else {
            if (rand < 0.3) sizeCat = 1;
            else sizeCat = 2;
        }

        const radius = sizeCat === 3 ? 85 : sizeCat === 2 ? 35 : 18;
        const hp = sizeCat === 3 ? 400 : sizeCat === 2 ? 100 : 30;

        let sizeSpeedMod = 1.0;
        if (sizeCat === 1) sizeSpeedMod = 1.6;
        if (sizeCat === 3) sizeSpeedMod = 0.7;

        const speedMult = MOLTEN_SPEED_MULTIPLIER * sizeSpeedMod * (1 + currentLevel * 0.05);
        const speed = ASTEROID_SPEED_BASE * speedMult;

        asteroidsRef.current.push({
            id: Math.random().toString(36).substr(2, 9),
            type: EntityType.MoltenAsteroid,
            pos: pos,
            vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
            radius: radius,
            angle: 0,
            color: COLORS.MOLTEN,
            toBeRemoved: false,
            vertices: generatePolygon(radius, 10 + sizeCat * 2, sizeCat * 4),
            hp: hp,
            sizeCategory: sizeCat,
            hitFlash: 0,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: randomRange(-0.01, 0.01) * (4 - sizeCat),
            pulsateOffset: Math.random() * Math.PI * 2
        });
    };

    const spawnIronSwarm = (cw: number, ch: number, currentLevel: number) => {
        const edge = Math.floor(Math.random() * 4);
        let startPos = { x: 0, y: 0 };
        const offset = 150;

        switch (edge) {
            case 0: startPos = { x: Math.random() * cw, y: -offset }; break;
            case 1: startPos = { x: cw + offset, y: Math.random() * ch }; break;
            case 2: startPos = { x: Math.random() * cw, y: ch + offset }; break;
            case 3: startPos = { x: -offset, y: Math.random() * ch }; break;
        }

        const angle = getTargetAngle(startPos);
        const speed = IRON_SPEED * (1 + currentLevel * 0.05);

        const count = 3 + (Math.random() > 0.7 ? 1 : 0);

        for (let i = 0; i < count; i++) {
            const sizeCat = Math.random() < 0.6 ? 1 : 2;
            const radius = sizeCat === 2 ? 30 : 15;
            const hp = (sizeCat === 2 ? 50 : 20) * IRON_HP_MULT * (1 + currentLevel * 0.1);

            const spread = 70;
            const pos = {
                x: startPos.x + randomRange(-spread, spread),
                y: startPos.y + randomRange(-spread, spread)
            };

            const div = 0.1;
            const finalAngle = angle + randomRange(-div, div);

            const vel = {
                x: Math.cos(finalAngle) * speed * randomRange(0.9, 1.1),
                y: Math.sin(finalAngle) * speed * randomRange(0.9, 1.1)
            };

            asteroidsRef.current.push({
                id: Math.random().toString(36).substr(2, 9),
                type: EntityType.IronAsteroid,
                pos: pos,
                vel: vel,
                radius: radius,
                angle: 0,
                color: IRON_COLOR,
                toBeRemoved: false,
                vertices: generatePolygon(radius, 6 + sizeCat * 2, 5),
                hp: hp,
                sizeCategory: sizeCat,
                hitFlash: 0,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: randomRange(-0.05, 0.05),
                pulsateOffset: Math.random() * Math.PI * 2
            });
        }
    };

    const spawnFrozenAsteroid = (cw: number, ch: number, currentLevel: number) => {
        const edge = Math.floor(Math.random() * 4);
        let pos = { x: 0, y: 0 };
        const offset = 120;

        switch (edge) {
            case 0: pos = { x: Math.random() * cw, y: -offset }; break;
            case 1: pos = { x: cw + offset, y: Math.random() * ch }; break;
            case 2: pos = { x: Math.random() * cw, y: ch + offset }; break;
            case 3: pos = { x: -offset, y: Math.random() * ch }; break;
        }

        const angle = getTargetAngle(pos);
        const speed = FROZEN_SPEED;
        const radius = 60;

        asteroidsRef.current.push({
            id: Math.random().toString(36).substr(2, 9),
            type: EntityType.FrozenAsteroid,
            pos: pos,
            vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
            radius: radius,
            angle: 0,
            color: FROZEN_COLOR,
            toBeRemoved: false,
            vertices: generatePolygon(radius, 12, 10),
            hp: FROZEN_HP * (1 + currentLevel * 0.1),
            sizeCategory: 3,
            hitFlash: 0,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: randomRange(-0.005, 0.005),
            pulsateOffset: Math.random() * Math.PI * 2
        });
    };

    const spawnParticles = (pos: Vector, color: string, count: number, speed = 2, variant: 'THRUST' | 'DEBRIS' | 'SHOCKWAVE' = 'DEBRIS') => {
        if (variant === 'SHOCKWAVE') {
            particlesRef.current.push({
                id: Math.random().toString(),
                type: EntityType.Particle,
                pos: { ...pos },
                vel: { x: 0, y: 0 },
                radius: 5,
                angle: 0,
                color: color,
                toBeRemoved: false,
                life: 1.0,
                maxLife: 1.0,
                decay: 0.04,
                variant: 'SHOCKWAVE'
            });
            return;
        }

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const v = variant === 'THRUST' ? speed : Math.random() * speed;

            particlesRef.current.push({
                id: Math.random().toString(),
                type: EntityType.Particle,
                pos: { ...pos },
                vel: { x: Math.cos(angle) * v, y: Math.sin(angle) * v },
                radius: Math.random() * 2 + 1,
                angle: 0,
                color: color,
                toBeRemoved: false,
                life: 1.0,
                maxLife: 1.0,
                decay: variant === 'THRUST' ? randomRange(0.1, 0.2) : (0.02 + Math.random() * 0.03),
                variant: variant
            });
        }
    };

    const spawnFloatingText = (pos: Vector, text: string, color: string, size: number = 14) => {
        floatingTextsRef.current.push({
            id: Math.random().toString(),
            text,
            pos: { ...pos },
            vel: { x: 0, y: -1 },
            life: 40,
            color,
            size
        });
    };

    const spawnExpOrb = (pos: Vector, variant: 'NORMAL' | 'SUPER') => {
        const isSuper = variant === 'SUPER';
        expOrbsRef.current.push({
            id: Math.random().toString(),
            type: EntityType.ExpOrb,
            pos: { ...pos },
            vel: { x: (Math.random() - 0.5) * 0.5, y: (Math.random() - 0.5) * 0.5 },
            radius: isSuper ? 8 : 4,
            angle: 0,
            color: isSuper ? COLORS.XP_SUPER : COLORS.XP_NORMAL,
            toBeRemoved: false,
            value: isSuper ? XP_ORB_SUPER_VALUE : XP_ORB_NORMAL_VALUE,
            variant,
            pulsateOffset: Math.random() * Math.PI,
        });
    };

    const spawnHullOrb = (pos: Vector) => {
        hullOrbsRef.current.push({
            id: Math.random().toString(),
            type: EntityType.HullOrb,
            pos: { ...pos },
            vel: { x: (Math.random() - 0.5) * 0.5, y: (Math.random() - 0.5) * 0.5 },
            radius: 8,
            angle: 0,
            color: COLORS.HULL,
            toBeRemoved: false,
            pulsateOffset: Math.random() * Math.PI,
        });
    };

    const prepareLevelUp = (isDevSequence = false) => {
        // Increment level and update XP target IMMEDIATELY when level-up triggers
        // This prevents multiple level-ups from accumulated XP
        if (!isDevSequence) {
            levelRef.current += 1;
            setUiLevel(levelRef.current);
            xpTargetRef.current = Math.floor(xpTargetRef.current * XP_SCALING_FACTOR + 1000);
        }

        setGameState(GameState.LEVEL_UP);

        const availablePool = UPGRADES.filter(u => {
            if (!u.parentId) return true;
            const parentTier = activeUpgradesRef.current[u.parentId] || 0;
            return parentTier > 0;
        });

        if (isDevMode) {
            setUiOfferedUpgrades(availablePool);
        } else {
            const green = availablePool.filter(u => u.category === UpgradeCategory.TECH);
            const red = availablePool.filter(u => u.category === UpgradeCategory.COMBAT);
            const purple = availablePool.filter(u => u.category === UpgradeCategory.ADDONS);

            const selection: UpgradeDef[] = [];
            if (green.length > 0) selection.push(green[Math.floor(Math.random() * green.length)]);
            if (red.length > 0) selection.push(red[Math.floor(Math.random() * red.length)]);
            if (purple.length > 0) selection.push(purple[Math.floor(Math.random() * purple.length)]);

            while (selection.length < 3 && availablePool.length > selection.length) {
                const rand = availablePool[Math.floor(Math.random() * availablePool.length)];
                if (!selection.includes(rand)) selection.push(rand);
            }

            setUiOfferedUpgrades(selection);
        }

        // Sync State for UI
        setUiActiveUpgrades({ ...activeUpgradesRef.current });
    };

    const checkLevelUp = (currentScore: number) => {
        if (currentScore >= xpTargetRef.current) {
            prepareLevelUp();
        }
    };

    const applyUpgrade = (upgrade: UpgradeDef) => {
        const newActive = { ...activeUpgradesRef.current };
        const currentTier = (newActive[upgrade.id] || 0) + 1;
        newActive[upgrade.id] = currentTier;
        activeUpgradesRef.current = newActive;
        setUiActiveUpgrades(newActive); // Sync UI

        if (shipRef.current) {
            const s = shipRef.current.stats;

            switch (upgrade.id) {
                case 'engine':
                    s.thrustMult = 1.0 + (currentTier * 0.25);
                    s.speedMult = 1.0 + (currentTier * 0.25);
                    break;
                case 'regen':
                    s.regenRate = currentTier * 3; // 3 HP/sec per tier
                    break;
                case 'hull':
                    s.maxHullMult = 1.0 + (currentTier * 0.30);
                    shipRef.current.maxHull = SHIP_BASE_HULL * s.maxHullMult;
                    shipRef.current.hull = shipRef.current.maxHull;
                    break;
                case 'rapidfire': s.fireRateMult = Math.max(0.1, 1.0 - (currentTier * 0.20)); break;
                case 'multishot': s.multishotTier = currentTier; break;
                case 'velocity': s.bulletSpeedMult = 1.0 + (currentTier * 0.25); break;
                case 'drone':
                    s.droneCount = currentTier;
                    while (dronesRef.current.length < s.droneCount) {
                        dronesRef.current.push({
                            id: `drone-${dronesRef.current.length}`,
                            type: EntityType.Drone,
                            pos: { ...shipRef.current.pos }, vel: { x: 0, y: 0 },
                            radius: 5, angle: 0, color: COLORS.DRONE, toBeRemoved: false,
                            targetId: null, orbitOffset: (Math.PI * 2 * dronesRef.current.length), lastShot: 0,
                            targetPos: { ...shipRef.current.pos }
                        });
                    }
                    dronesRef.current.forEach((d, i) => {
                        d.orbitOffset = (i / s.droneCount) * Math.PI * 2;
                    });
                    break;
                case 'drone_rofl':
                    s.droneFireRateMult = Math.max(0.1, 1.0 - (currentTier * 0.20));
                    break;
                case 'drone_gun':
                    s.droneGunCount = 1 + currentTier;
                    break;
                case 'magnet': s.pickupRange = ORB_MAGNET_RANGE_BASE + (currentTier * 60); break;
                case 'shield':
                    s.maxShieldCharges = currentTier;
                    s.shieldCharges = currentTier;
                    break;
                case 'scavenger': s.xpMult = 1.0 + (currentTier * 0.25); break;
            }

            if (s.maxShieldCharges > 0 && upgrade.id === 'shield') {
                s.shieldCharges = s.maxShieldCharges;
            }
        }

        setUiPendingUpgrades(prev => {
            if (prev > 0) return prev - 1;

            // Resume game after selecting upgrade
            setGameState(GameState.PLAYING);
            return 0;
        });
    };

    const handleGameOver = (reason: string) => {
        setDeathReason(reason);
        setGameState(GameState.GAME_OVER);
        screenShakeRef.current = 25;
    };

    // --- Game Loop ---
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const handleResize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', handleResize);
        handleResize();

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'ArrowUp') inputRef.current.up = true;
            if (e.code === 'ArrowLeft') inputRef.current.left = true;
            if (e.code === 'ArrowRight') inputRef.current.right = true;
            if (e.code === 'Space' && (gameState === GameState.MENU || gameState === GameState.GAME_OVER)) {
                initGame();
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'ArrowUp') inputRef.current.up = false;
            if (e.code === 'ArrowLeft') inputRef.current.left = false;
            if (e.code === 'ArrowRight') inputRef.current.right = false;
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        if (gameState === GameState.MENU && asteroidsRef.current.length === 0) {
            for (let i = 0; i < 5; i++) createAsteroid({ x: Math.random() * canvas.width, y: Math.random() * canvas.height }, { x: Math.random() - 0.5, y: Math.random() - 0.5 }, 3);
        }

        const loop = () => {
            // NOTE: Do not read React State here. Use Refs.
            frameCountRef.current++;
            const cw = canvas.width;
            const ch = canvas.height;
            const currentLevel = levelRef.current;

            // Update XP Bar in HUD directly to avoid React Render on every frame
            if (levelBarRef.current) {
                const pct = Math.min(100, (scoreRef.current / xpTargetRef.current) * 100);
                levelBarRef.current.style.width = `${pct}%`;
            }

            // Update Hull Bar in HUD directly (same pattern as XP bar)
            if (hullBarRef.current && shipRef.current) {
                const hullPct = Math.max(0, Math.min(100, (shipRef.current.hull / shipRef.current.maxHull) * 100));
                hullBarRef.current.style.width = `${hullPct}%`;
            }

            ctx.save();

            if (screenShakeRef.current > 0) {
                const shakeX = (Math.random() - 0.5) * screenShakeRef.current;
                const shakeY = (Math.random() - 0.5) * screenShakeRef.current;
                ctx.translate(shakeX, shakeY);
                screenShakeRef.current *= SCREEN_SHAKE_DECAY;
                if (screenShakeRef.current < 0.5) screenShakeRef.current = 0;
            }

            ctx.fillStyle = '#050505';
            ctx.fillRect(-50, -50, cw + 100, ch + 100);

            // Menu Background Asteroids
            if (gameState === GameState.MENU || gameState === GameState.GAME_OVER) {
                if (asteroidsRef.current.length < 5 && Math.random() < 0.01) {
                    createAsteroid({ x: cw + 50, y: Math.random() * ch }, { x: -1, y: 0 }, 3);
                }
            }

            const ship = shipRef.current;

            // --- LOGIC (Paused during LEVEL_UP) ---
            if (gameState === GameState.PLAYING && ship && !ship.toBeRemoved) {

                checkLevelUp(scoreRef.current);

                // --- SPAWNING DIRECTOR ---
                const targetDensity = 4 + Math.min(10, currentLevel);
                const activeAsteroids = asteroidsRef.current.filter(a => a.type === EntityType.Asteroid).length;

                if (activeAsteroids < targetDensity && spawnTimerRef.current <= 0) {
                    if (Math.random() < FORMATION_CHANCE && currentLevel >= 2) {
                        spawnAsteroidFormation(cw, ch, currentLevel);
                        spawnTimerRef.current = 200;
                    } else {
                        spawnSingleAsteroid(cw, ch, currentLevel);
                        spawnTimerRef.current = randomRange(30, 60);
                    }
                }
                if (spawnTimerRef.current > 0) spawnTimerRef.current--;

                if (currentLevel >= LEVEL_GATE_MOLTEN_SMALL) {
                    if (moltenTimerRef.current > 0) {
                        moltenTimerRef.current--;
                    } else {
                        spawnMoltenFlyby(cw, ch, currentLevel);
                        const cooldown = Math.max(SPAWN_RATES.MOLTEN.MIN, SPAWN_RATES.MOLTEN.START - (currentLevel * SPAWN_RATES.MOLTEN.DECREASE));
                        moltenTimerRef.current = cooldown + randomRange(0, SPAWN_RATES.MOLTEN.VARIANCE);
                    }
                }

                if (currentLevel >= LEVEL_GATE_FROZEN) {
                    if (frozenTimerRef.current > 0) {
                        frozenTimerRef.current--;
                    } else {
                        spawnFrozenAsteroid(cw, ch, currentLevel);
                        const cooldown = Math.max(SPAWN_RATES.FROZEN.MIN, SPAWN_RATES.FROZEN.START - (currentLevel * SPAWN_RATES.FROZEN.DECREASE));
                        frozenTimerRef.current = cooldown + randomRange(0, SPAWN_RATES.FROZEN.VARIANCE);
                    }
                }

                if (currentLevel >= LEVEL_GATE_IRON) {
                    if (ironTimerRef.current > 0) {
                        ironTimerRef.current--;
                    } else {
                        spawnIronSwarm(cw, ch, currentLevel);
                        const cooldown = Math.max(SPAWN_RATES.IRON.MIN, SPAWN_RATES.IRON.START - (currentLevel * SPAWN_RATES.IRON.DECREASE));
                        ironTimerRef.current = cooldown + randomRange(0, SPAWN_RATES.IRON.VARIANCE);
                    }
                }

                // Apply Stats
                const stats = ship.stats;

                ship.isFrozen = false;

                if (stats.regenRate > 0 && ship.hull < ship.maxHull) {
                    ship.hull = Math.min(ship.maxHull, ship.hull + stats.regenRate / 60);
                }

                // Check for Frozen Status Logic
                for (const a of asteroidsRef.current) {
                    if (a.type === EntityType.FrozenAsteroid && !a.toBeRemoved) {
                        if (dist(ship.pos, a.pos) < FROZEN_AURA_RANGE) {
                            ship.isFrozen = true;
                            ship.hull -= FROZEN_AURA_DAMAGE;
                            if (ship.hull <= 0) {
                                if (ship.stats.shieldCharges > 0) {
                                    ship.stats.shieldCharges--;
                                    ship.hull = 1;
                                    ship.invulnerableUntil = Date.now() + 2000;
                                    spawnFloatingText(ship.pos, "SHIELD SAVED!", COLORS.SHIELD, 20);
                                    screenShakeRef.current = 15;
                                    spawnParticles(ship.pos, COLORS.SHIELD, 30, 5);
                                } else {
                                    handleGameOver("Hypothermia");
                                }
                            }
                        }
                    }
                }
                if (ship.isFrozen && frameCountRef.current % 30 === 0) {
                    spawnFloatingText(ship.pos, "-COLD", FROZEN_COLOR, 10);
                }

                // Movement
                if (inputRef.current.left) ship.rotation -= SHIP_TURN_SPEED;
                if (inputRef.current.right) ship.rotation += SHIP_TURN_SPEED;

                if (inputRef.current.up) {
                    let thrustPower = SHIP_THRUST * stats.thrustMult;
                    if (ship.isFrozen) thrustPower *= FROZEN_SLOW_FACTOR;

                    ship.vel.x += Math.cos(ship.rotation) * thrustPower;
                    ship.vel.y += Math.sin(ship.rotation) * thrustPower;
                    ship.thrusting = true;

                    // Thrust Particles Logic
                    // Scale with engine tier
                    const engineTier = activeUpgradesRef.current['engine'] || 0;
                    const particleCount = engineTier > 2 ? 3 : 2;

                    for (let i = 0; i < particleCount; i++) {
                        const notchOffset = -ship.radius * 0.3;
                        const bx = ship.pos.x + Math.cos(ship.rotation) * notchOffset;
                        const by = ship.pos.y + Math.sin(ship.rotation) * notchOffset;

                        // Cone effect
                        const spread = 0.25;
                        const angle = ship.rotation + Math.PI + randomRange(-spread, spread);
                        const speed = randomRange(3 + engineTier * 0.5, 6 + engineTier * 0.5);

                        // Dynamic Color based on power
                        let pColor = COLORS.SHIP_THRUST;
                        if (engineTier >= 2) pColor = COLORS.SHIP_THRUST_T2;
                        if (engineTier >= 4) pColor = COLORS.SHIP_THRUST_T3;

                        particlesRef.current.push({
                            id: Math.random().toString(),
                            type: EntityType.Particle,
                            pos: { x: bx, y: by },
                            vel: { x: Math.cos(angle) * speed + ship.vel.x * 0.2, y: Math.sin(angle) * speed + ship.vel.y * 0.2 },
                            life: 1.0,
                            maxLife: 1.0,
                            decay: randomRange(0.15, 0.25),
                            color: pColor,
                            radius: randomRange(1.5 + engineTier * 0.5, 3 + engineTier * 0.5),
                            angle: 0,
                            toBeRemoved: false,
                            variant: 'THRUST'
                        });
                    }
                } else {
                    ship.thrusting = false;
                }

                ship.vel.x *= SHIP_FRICTION;
                ship.vel.y *= SHIP_FRICTION;
                const currentSpeed = Math.sqrt(ship.vel.x ** 2 + ship.vel.y ** 2);

                let maxSpeed = SHIP_MAX_SPEED * stats.speedMult;
                if (ship.isFrozen) maxSpeed *= FROZEN_SLOW_FACTOR;

                if (currentSpeed > maxSpeed) {
                    ship.vel.x = (ship.vel.x / currentSpeed) * maxSpeed;
                    ship.vel.y = (ship.vel.y / currentSpeed) * maxSpeed;
                }
                ship.pos.x += ship.vel.x;
                ship.pos.y += ship.vel.y;

                if (ship.pos.x < 0) ship.pos.x = cw;
                if (ship.pos.x > cw) ship.pos.x = 0;
                if (ship.pos.y < 0) ship.pos.y = ch;
                if (ship.pos.y > ch) ship.pos.y = 0;

                // Shooting
                const fireRate = Math.max(4, Math.floor(BULLET_RATE * stats.fireRateMult));
                if (frameCountRef.current % fireRate === 0) {
                    const shotAngles: number[] = [];
                    if (stats.multishotTier === 0) shotAngles.push(0);
                    else if (stats.multishotTier === 1) shotAngles.push(-0.1, 0.1);
                    else if (stats.multishotTier === 2) shotAngles.push(-0.2, 0, 0.2);
                    else {
                        // Dynamic scaling for tier 3+: tier+1 bullets
                        const count = stats.multishotTier + 1;
                        const totalSpread = 0.6;
                        for (let i = 0; i < count; i++) {
                            shotAngles.push(-totalSpread / 2 + (totalSpread * i / (count - 1)));
                        }
                    }

                    shotAngles.forEach(offset => {
                        const a = ship.rotation + offset;
                        bulletsRef.current.push({
                            id: Math.random().toString(),
                            type: EntityType.Bullet,
                            pos: {
                                x: ship.pos.x + Math.cos(a) * ship.radius,
                                y: ship.pos.y + Math.sin(a) * ship.radius
                            },
                            vel: {
                                x: Math.cos(a) * BULLET_SPEED * stats.bulletSpeedMult + ship.vel.x * 0.2,
                                y: Math.sin(a) * BULLET_SPEED * stats.bulletSpeedMult + ship.vel.y * 0.2
                            },
                            radius: 1.5,
                            angle: a,
                            color: COLORS.BULLET,
                            toBeRemoved: false,
                            life: BULLET_LIFE * stats.bulletSpeedMult,
                            damage: BULLET_DAMAGE
                        });
                    });
                }

                // --- Drone Swarm Logic ---
                if (stats.droneCount > 0) {
                    dronesRef.current.forEach((drone, i) => {
                        const t = frameCountRef.current;

                        // Organic "Breathing" Orbit
                        // Instead of a rigid circle, use sine waves to vary the radius and add noise
                        const count = stats.droneCount;
                        const baseRadius = 55;
                        const radiusVar = Math.sin(t * 0.03 + i) * 10;
                        const orbitRadius = baseRadius + radiusVar;

                        const angleSpeed = 0.015;
                        const baseAngle = t * angleSpeed + (i * (Math.PI * 2 / count));

                        // Add "Wander" noise to the ideal position
                        const wanderX = Math.sin(t * 0.05 + i * 3) * 15;
                        const wanderY = Math.cos(t * 0.04 + i * 7) * 15;

                        const idealX = ship.pos.x + Math.cos(baseAngle) * orbitRadius + wanderX;
                        const idealY = ship.pos.y + Math.sin(baseAngle) * orbitRadius + wanderY;

                        // Physics: Soft Spring
                        const dx = idealX - drone.pos.x;
                        const dy = idealY - drone.pos.y;

                        const springStrength = 0.04; // Softer spring for floaty feel
                        const damping = 0.92; // Higher damping for smooth movement

                        drone.vel.x += dx * springStrength;
                        drone.vel.y += dy * springStrength;

                        // Add separation force (avoid stacking)
                        dronesRef.current.forEach((other, j) => {
                            if (i !== j) {
                                const distToOther = dist(drone.pos, other.pos);
                                if (distToOther < 20) {
                                    const angleToOther = Math.atan2(drone.pos.y - other.pos.y, drone.pos.x - other.pos.x);
                                    const push = (20 - distToOther) * 0.05;
                                    drone.vel.x += Math.cos(angleToOther) * push;
                                    drone.vel.y += Math.sin(angleToOther) * push;
                                }
                            }
                        });

                        drone.vel.x *= damping;
                        drone.vel.y *= damping;

                        drone.pos.x += drone.vel.x;
                        drone.pos.y += drone.vel.y;

                        if (dist(drone.pos, ship.pos) > 400) {
                            drone.pos.x = idealX;
                            drone.pos.y = idealY;
                            drone.vel = { x: 0, y: 0 };
                        }

                        // Shooting Logic
                        const droneFireRate = Math.floor(30 * stats.droneFireRateMult);
                        if (t - drone.lastShot > droneFireRate) {
                            let nearest = null;
                            let minDist = 450;
                            for (const a of asteroidsRef.current) {
                                const d = dist(drone.pos, a.pos);
                                if (d < minDist) {
                                    minDist = d;
                                    nearest = a;
                                }
                            }
                            if (nearest) {
                                const angle = Math.atan2(nearest.pos.y - drone.pos.y, nearest.pos.x - drone.pos.x);
                                // recoil
                                drone.vel.x -= Math.cos(angle) * 1.5;
                                drone.vel.y -= Math.sin(angle) * 1.5;

                                const gunCount = stats.droneGunCount || 1;
                                const spread = 0.15;
                                const startAngle = angle - ((gunCount - 1) * spread) / 2;

                                for (let g = 0; g < gunCount; g++) {
                                    const fireAngle = startAngle + (g * spread);
                                    bulletsRef.current.push({
                                        id: Math.random().toString(),
                                        type: EntityType.Bullet,
                                        pos: { ...drone.pos },
                                        vel: {
                                            x: Math.cos(fireAngle) * BULLET_SPEED * stats.bulletSpeedMult,
                                            y: Math.sin(fireAngle) * BULLET_SPEED * stats.bulletSpeedMult
                                        },
                                        radius: 1.2,
                                        angle: fireAngle,
                                        color: COLORS.DRONE,
                                        toBeRemoved: false,
                                        life: BULLET_LIFE * 1.5,
                                        damage: BULLET_DAMAGE
                                    });
                                }
                                drone.lastShot = t;
                            }
                        }
                    });
                }
            }

            // Physics Updates
            bulletsRef.current.forEach(b => {
                if (gameState !== GameState.LEVEL_UP) {
                    b.pos.x += b.vel.x;
                    b.pos.y += b.vel.y;
                    b.life--;
                    if (b.pos.x < 0 || b.pos.x > cw || b.pos.y < 0 || b.pos.y > ch) b.toBeRemoved = true;
                    if (b.life <= 0) b.toBeRemoved = true;
                }
            });

            asteroidsRef.current.forEach(a => {
                if (gameState !== GameState.LEVEL_UP) {
                    a.pos.x += a.vel.x;
                    a.pos.y += a.vel.y;
                    a.rotation += a.rotationSpeed;

                    if (a.hitFlash > 0) a.hitFlash--;

                    if (a.type === EntityType.MoltenAsteroid || a.type === EntityType.FrozenAsteroid || a.type === EntityType.IronAsteroid) {
                        const buffer = 200;
                        if (a.pos.x < -buffer || a.pos.x > cw + buffer || a.pos.y < -buffer || a.pos.y > ch + buffer) {
                            a.toBeRemoved = true;
                        }
                    } else {
                        if (a.pos.x < -a.radius) a.pos.x = cw + a.radius;
                        if (a.pos.x > cw + a.radius) a.pos.x = -a.radius;
                        if (a.pos.y < -a.radius) a.pos.y = ch + a.radius;
                        if (a.pos.y > ch + a.radius) a.pos.y = -a.radius;
                    }
                }
            });

            const updateOrb = (o: ExpOrb | HullOrb, type: 'EXP' | 'HULL') => {
                if (gameState !== GameState.LEVEL_UP) {
                    if (gameState === GameState.PLAYING && ship && !ship.toBeRemoved) {
                        const d = dist(o.pos, ship.pos);
                        if (d < ship.stats.pickupRange) {
                            const angle = Math.atan2(ship.pos.y - o.pos.y, ship.pos.x - o.pos.x);
                            o.vel.x += Math.cos(angle) * 0.7;
                            o.vel.y += Math.sin(angle) * 0.7;
                        }
                    }

                    o.pos.x += o.vel.x;
                    o.pos.y += o.vel.y;
                    o.vel.x *= 0.95;
                    o.vel.y *= 0.95;

                    if (o.pos.x < 0) o.pos.x = cw;
                    if (o.pos.x > cw) o.pos.x = 0;
                    if (o.pos.y < 0) o.pos.y = ch;
                    if (o.pos.y > ch) o.pos.y = 0;
                }
            };
            expOrbsRef.current.forEach(o => updateOrb(o, 'EXP'));
            hullOrbsRef.current.forEach(o => updateOrb(o, 'HULL'));

            particlesRef.current.forEach(p => {
                if (gameState !== GameState.LEVEL_UP) {
                    if (p.variant === 'SHOCKWAVE') {
                        p.radius += 4;
                        p.life -= p.decay;
                        if (p.life <= 0) p.toBeRemoved = true;
                    } else {
                        p.pos.x += p.vel.x;
                        p.pos.y += p.vel.y;

                        if (p.variant === 'DEBRIS') {
                            p.vel.x *= 0.92;
                            p.vel.y *= 0.92;
                        }

                        p.life -= p.decay;
                        if (p.life <= 0) p.toBeRemoved = true;
                    }
                }
            });

            floatingTextsRef.current.forEach(t => {
                if (gameState !== GameState.LEVEL_UP) {
                    t.pos.y += t.vel.y;
                    t.life--;
                    if (t.life <= 0) (t as any).toBeRemoved = true;
                }
            });
            floatingTextsRef.current = floatingTextsRef.current.filter(t => t.life > 0);

            // --- Collisions ---
            if (gameState === GameState.PLAYING) {
                bulletsRef.current.forEach(b => {
                    if (b.toBeRemoved) return;
                    asteroidsRef.current.forEach(a => {
                        if (a.toBeRemoved) return;
                        if (dist(b.pos, a.pos) < a.radius) {
                            b.toBeRemoved = true;
                            a.hp -= b.damage;
                            a.hitFlash = HIT_FLASH_FRAMES;
                            spawnParticles(b.pos, b.color, 2, 4);

                            if (a.hp <= 0) {
                                a.toBeRemoved = true;
                                screenShakeRef.current = a.sizeCategory * 2;

                                spawnParticles(a.pos, a.color, 1, 0, 'SHOCKWAVE');
                                spawnParticles(a.pos, a.color, 8, 4, 'DEBRIS');

                                if (a.type === EntityType.Asteroid && a.sizeCategory > 1) {
                                    const newSize = (a.sizeCategory - 1) as 1 | 2;
                                    createAsteroid({ ...a.pos }, { x: a.vel.x + randomRange(-0.5, 0.5), y: a.vel.y + randomRange(-0.5, 0.5) }, newSize);
                                    createAsteroid({ ...a.pos }, { x: a.vel.x + randomRange(-0.5, 0.5), y: a.vel.y + randomRange(-0.5, 0.5) }, newSize);
                                }

                                if (Math.random() < HULL_DROP_CHANCE) spawnHullOrb(a.pos);

                                const isSpecial = a.type !== EntityType.Asteroid;
                                if (isSpecial) {
                                    const dropCount = Math.random() < 0.2 ? 3 : Math.random() < 0.5 ? 2 : 1;
                                    for (let i = 0; i < dropCount; i++) {
                                        spawnExpOrb({ x: a.pos.x + randomRange(-10, 10), y: a.pos.y + randomRange(-10, 10) }, 'SUPER');
                                    }
                                } else {
                                    spawnExpOrb(a.pos, 'NORMAL');
                                }
                            }
                        }
                    });
                });

                if (ship && !ship.toBeRemoved) {
                    const collectOrb = (o: Entity, type: 'EXP' | 'HULL') => {
                        o.toBeRemoved = true;

                        if (type === 'HULL') {
                            ship.hull = Math.min(ship.maxHull, ship.hull + HULL_ORB_VALUE);
                            spawnFloatingText(ship.pos, `+${HULL_ORB_VALUE} HULL`, COLORS.HULL);
                        } else {
                            const orb = o as ExpOrb;
                            // Dynamic XP Value scaling with Level
                            const baseVal = orb.value;
                            const levelScaledVal = Math.floor(baseVal * (1 + currentLevel * 0.15));
                            const finalVal = Math.floor(levelScaledVal * ship.stats.xpMult);

                            scoreRef.current += finalVal;
                            setUiScore(scoreRef.current);

                            const color = orb.variant === 'SUPER' ? COLORS.XP_SUPER : COLORS.XP_NORMAL;
                            spawnFloatingText(ship.pos, `+${finalVal}`, color, orb.variant === 'SUPER' ? 20 : 12);
                        }
                    };

                    expOrbsRef.current.forEach(o => { if (!o.toBeRemoved && dist(ship.pos, o.pos) < ship.radius + o.radius) collectOrb(o, 'EXP'); });
                    hullOrbsRef.current.forEach(o => { if (!o.toBeRemoved && dist(ship.pos, o.pos) < ship.radius + o.radius) collectOrb(o, 'HULL'); });

                    if (Date.now() > ship.invulnerableUntil) {
                        asteroidsRef.current.forEach(a => {
                            if (a.toBeRemoved) return;
                            if (checkShipCollision(ship, a)) {
                                if (a.type === EntityType.MoltenAsteroid) {
                                    if (ship.stats.shieldCharges > 0) {
                                        ship.stats.shieldCharges--;
                                        a.toBeRemoved = true;
                                        spawnParticles(a.pos, COLORS.MOLTEN, 40, 8);
                                        screenShakeRef.current = 20;
                                        ship.invulnerableUntil = Date.now() + 2000;
                                        spawnFloatingText(ship.pos, "SHIELD SAVED!", COLORS.SHIELD, 20);
                                        spawnParticles(ship.pos, COLORS.SHIELD, 30, 5);
                                    } else {
                                        handleGameOver("Molten Incineration");
                                        ship.toBeRemoved = true;
                                    }
                                } else {
                                    let knockback = 9;
                                    let damage = ASTEROID_HULL_DAMAGE;
                                    if (a.type === EntityType.IronAsteroid) {
                                        knockback = IRON_KNOCKBACK;
                                        damage = IRON_DAMAGE;
                                    }

                                    if (a.sizeCategory === 1 && a.type !== EntityType.IronAsteroid) {
                                        a.toBeRemoved = true;
                                        spawnParticles(a.pos, a.color, 10, 4);
                                        ship.hull -= ASTEROID_SMALL_DAMAGE;
                                        spawnFloatingText(ship.pos, `-${ASTEROID_SMALL_DAMAGE} HP`, COLORS.TEXT, 12);
                                        screenShakeRef.current = 6;
                                    } else {
                                        const angle = Math.atan2(ship.pos.y - a.pos.y, ship.pos.x - a.pos.x);
                                        ship.vel.x += Math.cos(angle) * knockback;
                                        ship.vel.y += Math.sin(angle) * knockback;
                                        ship.hull -= damage;
                                        if (a.type !== EntityType.FrozenAsteroid) a.hitFlash = HIT_FLASH_FRAMES;
                                        spawnParticles(ship.pos, COLORS.SHIP, 15, 6);
                                        ship.invulnerableUntil = Date.now() + 300;
                                        spawnFloatingText(ship.pos, `-${damage} HP`, '#ff0000', 16);
                                        screenShakeRef.current = a.type === EntityType.IronAsteroid ? 15 : 6;
                                    }

                                    if (ship.hull <= 0) {
                                        if (ship.stats.shieldCharges > 0) {
                                            ship.stats.shieldCharges--;
                                            ship.hull = 1;
                                            ship.invulnerableUntil = Date.now() + 2000;
                                            spawnFloatingText(ship.pos, "SHIELD SAVED!", COLORS.SHIELD, 20);
                                            screenShakeRef.current = 15;
                                            spawnParticles(ship.pos, COLORS.SHIELD, 30, 5);
                                        } else {
                                            handleGameOver("Hull Critical");
                                            ship.toBeRemoved = true;
                                        }
                                    }
                                }
                            }
                        });
                    }
                }
            }

            bulletsRef.current = bulletsRef.current.filter(e => !e.toBeRemoved);
            asteroidsRef.current = asteroidsRef.current.filter(e => !e.toBeRemoved);
            particlesRef.current = particlesRef.current.filter(e => !e.toBeRemoved);
            expOrbsRef.current = expOrbsRef.current.filter(e => !e.toBeRemoved);
            hullOrbsRef.current = hullOrbsRef.current.filter(e => !e.toBeRemoved);

            // --- RENDER ---

            particlesRef.current.forEach(p => {
                ctx.save();
                ctx.globalAlpha = p.life;

                if (p.variant === 'SHOCKWAVE') {
                    ctx.strokeStyle = p.color;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
                    ctx.stroke();
                } else if (p.variant === 'THRUST') {
                    ctx.fillStyle = p.color;
                    ctx.shadowColor = p.color;
                    ctx.shadowBlur = 10;
                    ctx.beginPath();
                    ctx.arc(p.pos.x, p.pos.y, p.radius * p.life, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                } else {
                    ctx.strokeStyle = p.color;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(p.pos.x, p.pos.y);
                    ctx.lineTo(p.pos.x - p.vel.x * 2, p.pos.y - p.vel.y * 2);
                    ctx.stroke();
                }

                ctx.restore();
            });

            bulletsRef.current.forEach(b => {
                ctx.fillStyle = b.color;
                ctx.beginPath();
                ctx.arc(b.pos.x, b.pos.y, b.radius, 0, Math.PI * 2);
                ctx.fill();
            });

            // Orbs
            ctx.shadowBlur = 15;
            ctx.lineWidth = 2;
            const drawOrb = (o: Entity, color: string) => {
                ctx.shadowColor = color;
                ctx.strokeStyle = color;
                const pulse = Math.sin(frameCountRef.current * 0.15 + (o as any).pulsateOffset) * 2;
                ctx.beginPath(); ctx.arc(o.pos.x, o.pos.y, o.radius + pulse, 0, Math.PI * 2); ctx.stroke();
            };

            expOrbsRef.current.forEach(o => {
                drawOrb(o, o.color);
                ctx.fillStyle = o.color;
                ctx.globalAlpha = o.variant === 'SUPER' ? 0.6 : 0.2;
                ctx.fill();
                ctx.globalAlpha = 1.0;
            });
            hullOrbsRef.current.forEach(o => drawOrb(o, COLORS.HULL));
            ctx.shadowBlur = 0;

            // Asteroids
            asteroidsRef.current.forEach(a => {
                ctx.save();
                ctx.translate(a.pos.x, a.pos.y);
                ctx.rotate(a.rotation);

                if (a.type === EntityType.FrozenAsteroid) {
                    ctx.save();
                    ctx.rotate(-a.rotation);
                    ctx.strokeStyle = FROZEN_COLOR;
                    ctx.lineWidth = 2 + Math.sin(frameCountRef.current * 0.1);
                    ctx.globalAlpha = 0.5 + Math.sin(frameCountRef.current * 0.05) * 0.3;
                    ctx.beginPath();
                    ctx.arc(0, 0, FROZEN_AURA_RANGE, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.restore();
                }

                if (a.hitFlash <= 0) {
                    ctx.beginPath();
                    if (a.vertices.length > 0) {
                        const v0 = a.vertices[0];
                        ctx.moveTo(v0.x, v0.y);
                        for (let i = 1; i < a.vertices.length; i++) ctx.lineTo(a.vertices[i].x, a.vertices[i].y);
                    }
                    ctx.closePath();
                    ctx.fillStyle = '#050505';
                    ctx.fill();
                }

                const drawPath = (jitter: number = 0) => {
                    ctx.beginPath();
                    if (a.vertices.length > 0) {
                        const isSpecial = a.type === EntityType.MoltenAsteroid || a.type === EntityType.FrozenAsteroid || a.type === EntityType.IronAsteroid;
                        const v0 = a.vertices[0];
                        ctx.moveTo(v0.x + (isSpecial ? randomRange(-jitter, jitter) : 0), v0.y + (isSpecial ? randomRange(-jitter, jitter) : 0));
                        for (let i = 1; i < a.vertices.length; i++) {
                            ctx.lineTo(a.vertices[i].x + (isSpecial ? randomRange(-jitter, jitter) : 0), a.vertices[i].y + (isSpecial ? randomRange(-jitter, jitter) : 0));
                        }
                    }
                    ctx.closePath();
                };

                if (a.hitFlash > 0) {
                    drawPath();
                    ctx.fillStyle = COLORS.FLASH;
                    ctx.shadowColor = COLORS.FLASH;
                    ctx.shadowBlur = 20;
                    ctx.fill();
                } else {
                    ctx.shadowBlur = 0;
                    const isMolten = a.type === EntityType.MoltenAsteroid;
                    const isFrozen = a.type === EntityType.FrozenAsteroid;
                    const isIron = a.type === EntityType.IronAsteroid;
                    const isSpecial = isMolten || isFrozen || isIron;

                    drawPath(isSpecial ? 2.5 : 1.5);
                    ctx.strokeStyle = a.color;
                    ctx.lineWidth = isSpecial ? 5 : 4;
                    ctx.globalAlpha = 0.4;
                    ctx.stroke();

                    drawPath(isSpecial ? 1.0 : 0.5);
                    ctx.strokeStyle = isMolten ? '#fff5f5' : isFrozen ? '#e0f2fe' : isIron ? '#fcd34d' : '#ffffff';
                    ctx.lineWidth = isSpecial ? 2 : 1.5;
                    ctx.globalAlpha = 1.0;
                    ctx.stroke();

                    if (isSpecial) {
                        ctx.fillStyle = a.color;
                        ctx.globalAlpha = isIron ? 0.6 : 0.3;
                        ctx.fill();
                    }
                }

                ctx.restore();
            });
            ctx.shadowBlur = 0;

            // Ship & Drones
            if (gameState === GameState.PLAYING && ship && !ship.toBeRemoved) {

                dronesRef.current.forEach(d => {
                    ctx.save();
                    ctx.translate(d.pos.x, d.pos.y);
                    // Orient drone towards movement or ship
                    const velAngle = Math.atan2(d.vel.y, d.vel.x);
                    const angle = (dist(d.vel, { x: 0, y: 0 }) > 0.1) ? velAngle : frameCountRef.current * 0.05;
                    ctx.rotate(angle);

                    let droneColor = COLORS.DRONE;
                    let isHeavy = ship.stats.droneGunCount > 1;
                    let isSpeed = ship.stats.droneFireRateMult < 0.9;

                    if (isHeavy) droneColor = '#60a5fa'; // Blue
                    if (isSpeed) droneColor = '#f472b6'; // Pink

                    // NEW VISUALS: Crystal/Data Bit style
                    ctx.shadowColor = droneColor;
                    ctx.shadowBlur = 10;

                    // Core Diamond
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath();
                    ctx.moveTo(4, 0); ctx.lineTo(0, 3); ctx.lineTo(-4, 0); ctx.lineTo(0, -3);
                    ctx.fill();

                    // Outer Shell (Rotating segments)
                    ctx.strokeStyle = droneColor;
                    ctx.lineWidth = 1.5;
                    const t = frameCountRef.current;

                    // Segment 1
                    ctx.save();
                    ctx.rotate(t * 0.1);
                    ctx.beginPath();
                    ctx.arc(0, 0, 8, -0.5, 0.5);
                    ctx.stroke();
                    ctx.restore();

                    // Segment 2
                    ctx.save();
                    ctx.rotate(t * 0.1 + Math.PI);
                    ctx.beginPath();
                    ctx.arc(0, 0, 8, -0.5, 0.5);
                    ctx.stroke();
                    ctx.restore();

                    // Heavy Drones get extra bits
                    if (isHeavy) {
                        ctx.fillStyle = droneColor;
                        ctx.fillRect(-8, -1, 3, 2);
                        ctx.fillRect(5, -1, 3, 2);
                    }

                    ctx.restore();
                });

                let shouldDraw = true;
                if (ship.invulnerableUntil > Date.now()) if (Math.floor(Date.now() / 100) % 2 === 0) shouldDraw = false;

                if (shouldDraw) {
                    ctx.save();
                    ctx.translate(ship.pos.x, ship.pos.y);
                    ctx.rotate(ship.rotation);

                    ctx.shadowBlur = 10;
                    ctx.shadowColor = ship.isFrozen ? FROZEN_COLOR : COLORS.SHIP;
                    ctx.strokeStyle = ship.isFrozen ? FROZEN_COLOR : COLORS.SHIP;
                    ctx.lineWidth = 2;

                    ctx.beginPath();
                    ctx.moveTo(ship.radius, 0);
                    ctx.lineTo(-ship.radius * 0.6, ship.radius * 0.75);
                    ctx.lineTo(-ship.radius * 0.3, 0);
                    ctx.lineTo(-ship.radius * 0.6, -ship.radius * 0.75);
                    ctx.closePath();
                    ctx.stroke();

                    if (ship.isFrozen) {
                        ctx.fillStyle = FROZEN_COLOR;
                        ctx.globalAlpha = 0.3;
                        ctx.fill();
                        ctx.globalAlpha = 1.0;
                    }
                    ctx.restore();

                    if (ship.stats.shieldCharges > 0) {
                        ctx.strokeStyle = COLORS.SHIELD;
                        ctx.shadowColor = COLORS.SHIELD;
                        ctx.shadowBlur = 10 + Math.sin(frameCountRef.current * 0.2) * 5;
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.arc(ship.pos.x, ship.pos.y, ship.radius + 10, 0, Math.PI * 2);
                        ctx.stroke();
                        for (let i = 0; i < ship.stats.shieldCharges; i++) {
                            const angle = Date.now() / 1000 + (i * (Math.PI * 2) / ship.stats.shieldCharges);
                            const cx = ship.pos.x + Math.cos(angle) * (ship.radius + 10);
                            const cy = ship.pos.y + Math.sin(angle) * (ship.radius + 10);
                            ctx.fillStyle = COLORS.SHIELD;
                            ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
                        }
                        ctx.shadowBlur = 0;
                    }
                }
            }

            floatingTextsRef.current.forEach(t => {
                ctx.fillStyle = t.color;
                ctx.font = `bold ${t.size}px monospace`;
                ctx.textAlign = 'center';
                ctx.shadowColor = 'black';
                ctx.shadowBlur = 4;
                ctx.fillText(t.text, t.pos.x, t.pos.y);
                ctx.shadowBlur = 0;
            });

            ctx.restore();
            frameRef.current = requestAnimationFrame(loop);
        };

        frameRef.current = requestAnimationFrame(loop);

        return () => {
            cancelAnimationFrame(frameRef.current);
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [gameState, initGame, checkLevelUp]);

    return (
        <div className="relative w-full h-full font-mono">
            <canvas ref={canvasRef} className="block" />
            <GameUI
                gameState={gameState}
                score={uiScore}
                level={uiLevel}
                ship={shipRef.current}
                pendingUpgrades={uiPendingUpgrades}
                offeredUpgrades={uiOfferedUpgrades}
                activeUpgrades={uiActiveUpgrades}
                isDevMode={isDevMode}
                startLevel={startLevel}
                deathReason={deathReason}
                xpBarRef={levelBarRef}
                hullBarRef={hullBarRef}
                onStartGame={initGame}
                onToggleDevMode={() => setIsDevMode(!isDevMode)}
                onSetStartLevel={setStartLevel}
                onSelectUpgrade={applyUpgrade}
            />
        </div>
    );
};

export default AsteroidsGame;
