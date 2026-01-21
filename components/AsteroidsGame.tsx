
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    Asteroid, Bullet, EntityType, GameState, Particle, Ship, ExpOrb, HullOrb, FreebieOrb, Vector, Drone, UpgradeCategory, UpgradeDef, Entity, FractureData, AsteroidCloud
} from '../types';
import {
    // Ship
    SHIP_SIZE, SHIP_THRUST, SHIP_TURN_SPEED, SHIP_FRICTION, SHIP_MAX_SPEED, SHIP_BASE_HULL,
    // Combat
    BULLET_SPEED, BULLET_LIFE, BULLET_RATE, BULLET_DAMAGE, BULLET_RADIUS,
    INVULN_DURATION_SHIELD, INVULN_DURATION_HIT, INVULN_BLINK_RATE,
    // NEW Asteroid System
    ASTEROID_SIZES, ASTEROID_BASE, SIZE_MULTIPLIERS, ASTEROID_TYPES,
    ASTEROID_SPLIT_COUNT_NORMAL, ASTEROID_SPLIT_COUNT_XLARGE, ASTEROID_SPLIT_MIN_SIZE, ASTEROID_SPLIT_SEPARATION_SPEED, ASTEROID_SPLIT_OFFSET_RATIO,
    // Soft Physics (declump only - gravity is now Tungsten-specific)
    SOFT_DECLUMP_RANGE, SOFT_DECLUMP_FORCE,
    // NEW Spawning System
    SPAWN_INTERVAL_BASE, SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_DECAY,
    THREAT_BUDGET_BASE, THREAT_BUDGET_PER_LEVEL, THREAT_BUDGET_MAX, TARGET_ASTEROID_MIN,
    LEVEL_HP_SCALING, LEVEL_SPEED_SCALING, LEVEL_SPEED_CAP,
    SPAWN_GATES, TYPE_SPAWN_WEIGHTS, SIZE_SPAWN_WEIGHTS,
    // Asteroid Cloud (cohesive swarm entity)
    CLOUD_SPAWN_CHANCE, CLOUD_SIZE_MIN, CLOUD_SIZE_MAX, CLOUD_SIZE_PER_LEVEL,
    CLOUD_COHESION_STRENGTH, CLOUD_HOMING_STRENGTH,
    CLOUD_SPEED_BASE, CLOUD_SPEED_PER_LEVEL, CLOUD_SPEED_MAX,
    CLOUD_SPAWN_RADIUS, CLOUD_MAX_SPREAD,
    // Iron Shotgun Burst
    IRON_BURST_COUNT_BASE, IRON_BURST_COUNT_PER_LEVEL, IRON_BURST_COUNT_MAX, IRON_BURST_SPEED_MULT, IRON_BURST_SPREAD,
    // Drones
    DRONE_ORBIT_RADIUS, DRONE_ORBIT_VARIANCE, DRONE_ORBIT_SPEED,
    DRONE_WANDER_X, DRONE_WANDER_Y, DRONE_SPRING, DRONE_DAMPING,
    DRONE_SEPARATION_DIST, DRONE_SEPARATION_FORCE, DRONE_TELEPORT_DIST,
    DRONE_TARGET_RANGE, DRONE_BASE_FIRE_RATE, DRONE_RECOIL, DRONE_GUN_SPREAD, DRONE_BASE_DAMAGE,
    // Economy
    XP_ORB_NORMAL_VALUE, XP_ORB_SUPER_VALUE, XP_ORB_RADIUS,
    HULL_ORB_VALUE, HULL_ORB_RADIUS, HULL_DROP_CHANCE,
    ORB_MAGNET_RANGE_BASE, ORB_DRIFT_SPEED, XP_BASE_REQ, XP_SCALING_FACTOR,
    FREEBIE_ORB_RADIUS, FREEBIE_DROP_CHANCE_BASE, FREEBIE_DROP_CHANCE_PER_SIZE,
    // Upgrades
    UPGRADE_ENGINE_MULT, UPGRADE_REGEN_PER_TIER, UPGRADE_HULL_MULT,
    UPGRADE_FIRE_RATE_SPEED_MULT, UPGRADE_DAMAGE_MULT_COMPOUND, UPGRADE_RANGE_MULT, // Pro Balance
    UPGRADE_VELOCITY_MULT, UPGRADE_MAGNET_RANGE, UPGRADE_XP_MULT,
    UPGRADE_DRONE_FIRE_RATE_SPEED_MULT, UPGRADE_DRONE_DAMAGE_MULT_COMPOUND, UPGRADE_DRONE_RANGE_MULT,
    SHIELD_RECHARGE_TIME, SHIELD_RADIATION_BASE_RADIUS, SHIELD_RADIATION_RADIUS_PER_TIER,
    SHIELD_RADIATION_BASE_DPS, SHIELD_RADIATION_DPS_PER_TIER,
    MULTISHOT_SPREAD,
    // Visuals
    PARTICLE_COUNT_EXPLOSION, PARTICLE_LIFE, PARTICLE_DECAY_THRUST, PARTICLE_DECAY_DEBRIS, SHOCKWAVE_DECAY,
    FLOATING_TEXT_LIFE, FLOATING_TEXT_SPEED, FLOATING_TEXT_SIZE,
    SCREEN_SHAKE_DECAY, HIT_FLASH_FRAMES, MENU_ASTEROID_COUNT, COLORS,
    // Performance
    MAX_PARTICLES, MAX_XP_ORBS, MAX_HULL_ORBS, MAX_FLOATING_TEXT, MAX_BULLETS,
    // Upgrade Definitions
    UPGRADES,
    // Type imports
    AsteroidTypeName
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

// (generateFractureData removed - simplified breaking system uses position offsets instead)

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
    const xpRef = useRef(0); // XP (Leveling) - ONLY from Orbs (Renamed from scoreRef to avoid confusion)
    const pointsRef = useRef(0); // Score (Display/Leaderboard) - From kills & orbs
    const levelRef = useRef(1);
    const xpTargetRef = useRef(XP_BASE_REQ);
    const activeUpgradesRef = useRef<Record<string, number>>({});

    // UI State (Synced occasionally or on events)
    const [uiScore, setUiScore] = useState(0); // Now represents POINTS
    const [uiXp, setUiXp] = useState(0);       // New state for XP bar
    const [uiXpTarget, setUiXpTarget] = useState(XP_BASE_REQ); // New state for XP target
    const [uiLevel, setUiLevel] = useState(1);
    const [uiPendingUpgrades, setUiPendingUpgrades] = useState(0);
    const [uiOfferedUpgrades, setUiOfferedUpgrades] = useState<UpgradeDef[]>([]);
    const [uiActiveUpgrades, setUiActiveUpgrades] = useState<Record<string, number>>({});
    const [deathReason, setDeathReason] = useState('');

    // Dev Mode State
    const [isDevMode, setIsDevMode] = useState(false);
    const [isSandbox, setIsSandbox] = useState(false);
    const [showDamageNumbers, setShowDamageNumbers] = useState(true); // Default ON
    const [startLevel, setStartLevel] = useState(1);
    const [isFreebie, setIsFreebie] = useState(false); // Track free upgrade state
    const sandboxRef = useRef(false); // Ref for game loop access
    const showDamageNumbersRef = useRef(true); // Ref for game loop access

    // Game State Refs
    const shipRef = useRef<Ship | null>(null);
    const asteroidsRef = useRef<Asteroid[]>([]);
    const bulletsRef = useRef<Bullet[]>([]);
    const particlesRef = useRef<Particle[]>([]);
    const expOrbsRef = useRef<ExpOrb[]>([]);
    const hullOrbsRef = useRef<HullOrb[]>([]);
    const freebieOrbsRef = useRef<FreebieOrb[]>([]);
    const dronesRef = useRef<Drone[]>([]);
    const asteroidCloudsRef = useRef<AsteroidCloud[]>([]);
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

    // Staggered spawn queue for "pew pew pew" cloud effect
    interface PendingSpawn {
        spawnAt: number; // Frame to spawn at
        pos: Vector;
        vel: Vector;
        sizeCat: 1 | 2;
        typeName: AsteroidTypeName;
    }
    const pendingSpawnsRef = useRef<PendingSpawn[]>([]);

    // HUD Refs (For XP Bar, we can pass a ref to GameUI if we wanted direct DOM manip, but state is fine for low freq updates)
    const levelBarRef = useRef<HTMLDivElement>(null);
    const hullBarRef = useRef<HTMLDivElement>(null);
    const shieldBarRef = useRef<HTMLDivElement>(null);
    const shieldTextRef = useRef<HTMLDivElement>(null);
    const hullTextRef = useRef<HTMLDivElement>(null);
    const xpTextRef = useRef<HTMLDivElement>(null);
    const regenTextRef = useRef<HTMLDivElement>(null);

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
                pickupRange: ORB_MAGNET_RANGE_BASE,
                shieldCharges: 0,
                maxShieldCharges: 0,
                shieldRechargeTimer: 0,
                droneCount: 0,
                droneFireRateMult: 1.0,
                droneDamageMult: 1.0,
                droneRangeMult: 1.0,
                multishotTier: 0,
                xpMult: 1.0,
                // New stats
                rangeTier: 0,
                ricochetTier: 0,
                damageMult: 1.0,
                shieldRadiationTier: 0
            }
        };

        asteroidsRef.current = [];
        bulletsRef.current = [];
        particlesRef.current = [];
        expOrbsRef.current = [];
        hullOrbsRef.current = [];
        freebieOrbsRef.current = [];
        dronesRef.current = [];
        floatingTextsRef.current = [];

        xpRef.current = 0;
        pointsRef.current = 0;
        activeUpgradesRef.current = {};

        setUiScore(0);
        setUiActiveUpgrades({});

        spawnTimerRef.current = SPAWN_INTERVAL_BASE;

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

        // Sync sandbox ref for game loop
        sandboxRef.current = isSandbox;

        // Sandbox mode: spawn stationary test asteroids with infinite HP
        if (isSandbox) {
            const cx = canvas.width / 2;
            const cy = canvas.height / 2;

            // 3 close asteroids (clustered, not touching)
            const testPositions = [
                { x: cx + 100, y: cy },        // Right of center
                { x: cx + 180, y: cy - 60 },   // Upper right
                { x: cx + 180, y: cy + 60 },   // Lower right
            ];

            const mediumRadius = ASTEROID_BASE.RADIUS * SIZE_MULTIPLIERS[ASTEROID_SIZES.MEDIUM].radius;
            const largeRadius = ASTEROID_BASE.RADIUS * SIZE_MULTIPLIERS[ASTEROID_SIZES.LARGE].radius;

            testPositions.forEach((pos, i) => {
                asteroidsRef.current.push({
                    id: `sandbox-${i}`,
                    type: EntityType.Asteroid,
                    pos: pos,
                    vel: { x: 0, y: 0 }, // Stationary
                    radius: mediumRadius,
                    angle: 0,
                    color: '#ff00ff', // Magenta for visibility
                    toBeRemoved: false,
                    vertices: generatePolygon(mediumRadius, 10, 8),
                    hp: Infinity, // Infinite HP
                    maxHp: Infinity,
                    sizeCategory: 2,
                    hitFlash: 0,
                    rotation: 0,
                    rotationSpeed: 0, // No rotation
                    pulsateOffset: Math.random() * Math.PI * 2
                });
            });

            // 1 far asteroid
            asteroidsRef.current.push({
                id: 'sandbox-far',
                type: EntityType.Asteroid,
                pos: { x: cx + 400, y: cy },
                vel: { x: 0, y: 0 },
                radius: largeRadius,
                angle: 0,
                color: '#00ffff', // Cyan for visibility
                toBeRemoved: false,
                vertices: generatePolygon(largeRadius, 12, 12),
                hp: Infinity,
                maxHp: Infinity,
                sizeCategory: 3,
                hitFlash: 0,
                rotation: 0,
                rotationSpeed: 0,
                pulsateOffset: Math.random() * Math.PI * 2
            });

            // 2 asteroids below the main cluster (for testing chain bounces)
            const lowerPositions = [
                { x: cx - 50, y: cy + 300 },
                { x: cx + 50, y: cy + 300 }
            ];
            lowerPositions.forEach((pos, i) => {
                asteroidsRef.current.push({
                    id: `sandbox-lower-${i}`,
                    type: EntityType.Asteroid,
                    pos: pos,
                    vel: { x: 0, y: 0 },
                    radius: mediumRadius,
                    angle: 0,
                    color: '#ffff00', // Yellow for visibility
                    toBeRemoved: false,
                    vertices: generatePolygon(mediumRadius, 10, 8),
                    hp: Infinity,
                    maxHp: Infinity,
                    sizeCategory: 2,
                    hitFlash: 0,
                    rotation: 0,
                    rotationSpeed: 0,
                    pulsateOffset: Math.random() * Math.PI * 2
                });
            });
        }

    }, [startLevel, isDevMode, isSandbox]);

    // ==========================================================================
    // NEW UNIFIED SPAWNING SYSTEM
    // ==========================================================================

    // Helper: Get spawn position from random screen edge
    const getSpawnPosition = (cw: number, ch: number, buffer = 100): Vector => {
        const edge = Math.floor(Math.random() * 4);
        switch (edge) {
            case 0: return { x: randomRange(0, cw), y: -buffer };      // Top
            case 1: return { x: cw + buffer, y: randomRange(0, ch) };  // Right
            case 2: return { x: randomRange(0, cw), y: ch + buffer };  // Bottom
            default: return { x: -buffer, y: randomRange(0, ch) };     // Left
        }
    };

    // Helper: Get angle toward player (with slight randomness)
    const getTargetAngle = (startPos: Vector, spread = 0.3) => {
        if (!shipRef.current) return Math.random() * Math.PI * 2;
        const shipPos = shipRef.current.pos;
        const baseAngle = Math.atan2(shipPos.y - startPos.y, shipPos.x - startPos.x);
        return baseAngle + randomRange(-spread, spread);
    };

    // Helper: Calculate weight for spawn chance at given level
    const getWeight = (config: { base: number; perLevel?: number; min?: number; max?: number }, level: number): number => {
        let weight = config.base + (config.perLevel || 0) * (level - 1);
        if (config.min !== undefined) weight = Math.max(config.min, weight);
        if (config.max !== undefined) weight = Math.min(config.max, weight);
        return Math.max(0, weight);
    };

    // Select asteroid type based on level and weights
    // NOTE: IRON excluded here - it ONLY spawns via spawnIronBurst()
    const selectAsteroidType = (currentLevel: number): AsteroidTypeName => {
        const types: AsteroidTypeName[] = ['REGULAR', 'MOLTEN', 'FROZEN', 'TUNGSTEN']; // No IRON!
        const weights: number[] = [];

        for (const type of types) {
            // Check if any size of this type is unlocked
            const gate = SPAWN_GATES[type];
            const anyUnlocked = Object.values(gate).some(lvl => currentLevel >= lvl);

            if (anyUnlocked) {
                weights.push(getWeight(TYPE_SPAWN_WEIGHTS[type], currentLevel));
            } else {
                weights.push(0);
            }
        }

        // Weighted random selection
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        if (totalWeight <= 0) return 'REGULAR';

        let random = Math.random() * totalWeight;
        for (let i = 0; i < types.length; i++) {
            random -= weights[i];
            if (random <= 0) return types[i];
        }
        return 'REGULAR';
    };

    // Select size based on level, type, and weights
    const selectAsteroidSize = (currentLevel: number, typeName: AsteroidTypeName): 1 | 2 | 3 | 4 => {
        const sizes: (keyof typeof ASTEROID_SIZES)[] = ['SMALL', 'MEDIUM', 'LARGE', 'XLARGE'];
        const gate = SPAWN_GATES[typeName];
        const weights: number[] = [];

        for (const size of sizes) {
            const requiredLevel = gate[size];
            if (currentLevel >= requiredLevel) {
                weights.push(getWeight(SIZE_SPAWN_WEIGHTS[size], currentLevel));
            } else {
                weights.push(0);
            }
        }

        // Weighted random selection
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        if (totalWeight <= 0) return ASTEROID_SIZES.SMALL as 1;

        let random = Math.random() * totalWeight;
        for (let i = 0; i < sizes.length; i++) {
            random -= weights[i];
            if (random <= 0) return ASTEROID_SIZES[sizes[i]] as 1 | 2 | 3 | 4;
        }
        return ASTEROID_SIZES.SMALL as 1;
    };

    // Map type name to EntityType
    const getEntityType = (typeName: AsteroidTypeName): EntityType => {
        switch (typeName) {
            case 'MOLTEN': return EntityType.MoltenAsteroid;
            case 'IRON': return EntityType.IronAsteroid;
            case 'FROZEN': return EntityType.FrozenAsteroid;
            case 'TUNGSTEN': return EntityType.TungstenAsteroid;
            default: return EntityType.Asteroid;
        }
    };

    // Calculate asteroid properties from base × size × type multipliers
    const calculateAsteroidProps = (
        typeName: AsteroidTypeName,
        sizeCat: 1 | 2 | 3 | 4,
        currentLevel: number
    ) => {
        const typeConfig = ASTEROID_TYPES[typeName];
        const sizeMult = SIZE_MULTIPLIERS[sizeCat];

        // Calculate base stats with multipliers
        const radius = ASTEROID_BASE.RADIUS * sizeMult.radius;
        const baseHp = ASTEROID_BASE.HP * sizeMult.hp * typeConfig.hpMult;
        const hp = baseHp * (1 + (currentLevel - 1) * LEVEL_HP_SCALING);

        // Speed scales with level but caps
        const levelSpeedMult = Math.min(LEVEL_SPEED_CAP, 1 + (currentLevel - 1) * LEVEL_SPEED_SCALING);
        const speed = ASTEROID_BASE.SPEED * sizeMult.speed * typeConfig.speedMult * levelSpeedMult;

        const vertices = ASTEROID_BASE.VERTICES + sizeMult.vertices;
        const rotation = ASTEROID_BASE.ROTATION * (1 / sizeMult.radius); // Bigger = slower rotation

        return { radius, hp, speed, vertices, rotation, color: typeConfig.color };
    };

    // Main spawn function - spawns any asteroid type/size
    const spawnAsteroid = (cw: number, ch: number, currentLevel: number, forceType?: AsteroidTypeName, forceSize?: 1 | 2 | 3 | 4) => {
        const typeName = forceType || selectAsteroidType(currentLevel);
        const sizeCat = forceSize || selectAsteroidSize(currentLevel, typeName);
        const typeConfig = ASTEROID_TYPES[typeName];
        const props = calculateAsteroidProps(typeName, sizeCat, currentLevel);

        // Spawn position
        const pos = getSpawnPosition(cw, ch, props.radius + 50);

        // Calculate velocity
        let angle: number;
        let speed = props.speed;

        if (typeConfig.homingBurst) {
            // Iron: Aim directly at player with tight accuracy
            angle = getTargetAngle(pos, 0.1);
        } else {
            // Other types: General direction toward player
            angle = getTargetAngle(pos, 0.4);
        }

        const vel = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };

        // Create the asteroid
        asteroidsRef.current.push({
            id: Math.random().toString(36).substr(2, 9),
            type: getEntityType(typeName),
            pos: pos,
            vel: vel,
            radius: props.radius,
            angle: 0,
            color: props.color,
            toBeRemoved: false,
            vertices: generatePolygon(props.radius, props.vertices, sizeCat * 3),
            hp: props.hp,
            maxHp: props.hp,
            sizeCategory: sizeCat,
            hitFlash: 0,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: randomRange(-props.rotation, props.rotation),
            pulsateOffset: Math.random() * Math.PI * 2
        });
    };

    // Spawn an asteroid cloud - cohesive formation that follows cloud center
    const spawnCloud = (cw: number, ch: number, currentLevel: number) => {
        const scaledCount = CLOUD_SIZE_MIN + Math.floor(currentLevel * CLOUD_SIZE_PER_LEVEL);
        const count = Math.min(scaledCount, CLOUD_SIZE_MAX);

        // Cloud spawns from edge
        const spawnPos = getSpawnPosition(cw, ch, 120);
        const baseAngle = getTargetAngle(spawnPos, 0);

        // Cloud speed toward player
        const speedMult = Math.min(CLOUD_SPEED_BASE + currentLevel * CLOUD_SPEED_PER_LEVEL, CLOUD_SPEED_MAX);
        const props = calculateAsteroidProps('REGULAR', 1, currentLevel);
        const cloudSpeed = props.speed * speedMult;

        const cloudId = Math.random().toString(36).substr(2, 9);
        const memberIds: string[] = [];
        const memberOffsets: Vector[] = [];

        // Create members with fixed offsets from cloud center
        for (let i = 0; i < count; i++) {
            // Random scatter formation (not a perfect circle)
            const offsetAngle = Math.random() * Math.PI * 2;
            const offsetDist = 15 + Math.random() * (CLOUD_SPAWN_RADIUS * 1.5);
            const offset: Vector = {
                x: Math.cos(offsetAngle) * offsetDist,
                y: Math.sin(offsetAngle) * offsetDist
            };
            memberOffsets.push(offset);

            const memberPos = {
                x: spawnPos.x + offset.x,
                y: spawnPos.y + offset.y
            };

            const memberId = Math.random().toString(36).substr(2, 9);
            memberIds.push(memberId);

            // Members have zero velocity - cloud controls their position
            asteroidsRef.current.push({
                id: memberId,
                type: EntityType.Asteroid,
                pos: memberPos,
                vel: { x: 0, y: 0 },
                radius: props.radius,
                angle: 0,
                color: props.color,
                toBeRemoved: false,
                vertices: generatePolygon(props.radius, props.vertices, 3),
                hp: props.hp,
                maxHp: props.hp,
                sizeCategory: 1,
                hitFlash: 0,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: randomRange(-props.rotation, props.rotation),
                pulsateOffset: Math.random() * Math.PI * 2
            });
        }

        asteroidCloudsRef.current.push({
            id: cloudId,
            pos: { ...spawnPos },
            vel: { x: Math.cos(baseAngle) * cloudSpeed, y: Math.sin(baseAngle) * cloudSpeed },
            memberIds: memberIds,
            memberOffsets: memberOffsets,
            spawnTime: frameCountRef.current
        });
    };

    // Spawn Iron shotgun burst - scales with level for progressive difficulty
    const spawnIronBurst = (cw: number, ch: number, currentLevel: number) => {
        // Count scales with level: base 2, +0.2 per level, max 7
        const scaledCount = IRON_BURST_COUNT_BASE + Math.floor(currentLevel * IRON_BURST_COUNT_PER_LEVEL);
        const count = Math.min(scaledCount, IRON_BURST_COUNT_MAX);
        const spawnPos = getSpawnPosition(cw, ch, 120);
        const baseAngle = getTargetAngle(spawnPos, 0.1);

        for (let i = 0; i < count; i++) {
            // Per-asteroid medium chance scales with level (2% per level, max 30%)
            const mediumChance = Math.min(0.02 * currentLevel, 0.30);
            const sizeCat = (Math.random() < mediumChance ? 2 : 1) as 1 | 2;
            const props = calculateAsteroidProps('IRON', sizeCat, currentLevel);

            // Shotgun spread and very fast
            const angle = baseAngle + (Math.random() - 0.5) * IRON_BURST_SPREAD * 2;
            const burstSpeed = props.speed * IRON_BURST_SPEED_MULT;
            const vel = {
                x: Math.cos(angle) * burstSpeed,
                y: Math.sin(angle) * burstSpeed
            };

            // Slight stagger so they fan out
            const offsetDist = i * 8;
            const offsetAngle = angle + Math.PI;
            const pos = {
                x: spawnPos.x + Math.cos(offsetAngle) * offsetDist,
                y: spawnPos.y + Math.sin(offsetAngle) * offsetDist
            };

            asteroidsRef.current.push({
                id: Math.random().toString(36).substr(2, 9),
                type: EntityType.IronAsteroid,
                pos: pos,
                vel: vel,
                radius: props.radius,
                angle: 0,
                color: props.color,
                toBeRemoved: false,
                vertices: generatePolygon(props.radius, props.vertices, 3),
                hp: props.hp,
                maxHp: props.hp,
                sizeCategory: sizeCat,
                hitFlash: 0,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: randomRange(-props.rotation * 2, props.rotation * 2), // Spin fast
                pulsateOffset: Math.random() * Math.PI * 2
            });
        }
    };

    // Create asteroid at specific position (for splitting)
    const createAsteroid = (pos: Vector, vel: Vector, sizeCat: 1 | 2 | 3 | 4, typeName: AsteroidTypeName = 'REGULAR') => {
        const props = calculateAsteroidProps(typeName, sizeCat, levelRef.current);

        asteroidsRef.current.push({
            id: Math.random().toString(36).substr(2, 9),
            type: getEntityType(typeName),
            pos: pos,
            vel: vel,
            radius: props.radius,
            angle: 0,
            color: props.color,
            toBeRemoved: false,
            vertices: generatePolygon(props.radius, props.vertices, sizeCat * 3),
            hp: props.hp,
            maxHp: props.hp,
            sizeCategory: sizeCat,
            hitFlash: 0,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: randomRange(-props.rotation, props.rotation),
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

    // Plasma cartridge - spawn near ship tip, tumbles as it ejects
    const spawnPlasmaExhaust = (shipPos: Vector, shipAngle: number, shipVel: Vector) => {
        // Pick random side (left or right)
        const side = Math.random() > 0.5 ? 1 : -1;

        // Spawn near the tip: more forward + small side offset
        const forwardOffset = 12; // Further toward muzzle
        const sideOffset = 4;     // Closer to center
        const sideAngle = shipAngle + (Math.PI / 2) * side;
        const spawnX = shipPos.x + Math.cos(shipAngle) * forwardOffset + Math.cos(sideAngle) * sideOffset;
        const spawnY = shipPos.y + Math.sin(shipAngle) * forwardOffset + Math.sin(sideAngle) * sideOffset;

        // Vent outward + slightly backward
        const ventAngle = sideAngle + (Math.PI * 0.15) * side;
        const ventSpeed = 0.8 + Math.random() * 0.3;

        // Random spin direction for tumble
        const spinDir = Math.random() > 0.5 ? 1 : -1;

        particlesRef.current.push({
            id: Math.random().toString(),
            type: EntityType.Particle,
            pos: { x: spawnX, y: spawnY },
            vel: {
                x: Math.cos(ventAngle) * ventSpeed + shipVel.x * 0.1,
                y: Math.sin(ventAngle) * ventSpeed + shipVel.y * 0.1
            },
            radius: 2,
            angle: shipAngle + spinDir * 0.5,
            color: '#66ddff',
            toBeRemoved: false,
            life: 1.0,
            maxLife: 1.0,
            decay: 0.025, // Slower - lingers longer
            variant: 'SHELL'
        });
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
            vel: { x: (Math.random() - 0.5) * ORB_DRIFT_SPEED, y: (Math.random() - 0.5) * ORB_DRIFT_SPEED },
            radius: isSuper ? XP_ORB_RADIUS.SUPER : XP_ORB_RADIUS.NORMAL,
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
            vel: { x: (Math.random() - 0.5) * ORB_DRIFT_SPEED, y: (Math.random() - 0.5) * ORB_DRIFT_SPEED },
            radius: HULL_ORB_RADIUS,
            angle: 0,
            color: COLORS.HULL,
            toBeRemoved: false,
            pulsateOffset: Math.random() * Math.PI,
        });
    };

    // Rare upgrade orb - grants free upgrade without level increase!
    const spawnFreebieOrb = (pos: Vector) => {
        freebieOrbsRef.current.push({
            id: Math.random().toString(),
            type: EntityType.FreebieOrb,
            pos: { ...pos },
            vel: { x: (Math.random() - 0.5) * ORB_DRIFT_SPEED * 0.5, y: (Math.random() - 0.5) * ORB_DRIFT_SPEED * 0.5 },
            radius: FREEBIE_ORB_RADIUS,
            angle: 0,
            color: '#ffd700', // Gold color
            toBeRemoved: false,
            pulsateOffset: Math.random() * Math.PI,
            sparklePhase: 0,
        });
        spawnFloatingText(pos, "FREEBIE!", '#ffd700', 16);
    };

    // Centralized Asteroid Death Logic
    const destroyAsteroid = (a: Asteroid) => {
        if (a.toBeRemoved) return;
        a.toBeRemoved = true;

        // Legacy scoring block removed

        // Re-declare isSpecial for use in loot/scoring below
        const isSpecial = a.type !== EntityType.Asteroid;

        // Visuals
        spawnParticles(a.pos, a.color, 1, 0, 'SHOCKWAVE');
        spawnParticles(a.pos, a.color, 8, 4, 'DEBRIS');

        // Splitting - check if this asteroid type splits using the new type config
        const getTypeName = (type: EntityType): AsteroidTypeName => {
            switch (type) {
                case EntityType.MoltenAsteroid: return 'MOLTEN';
                case EntityType.IronAsteroid: return 'IRON';
                case EntityType.FrozenAsteroid: return 'FROZEN';
                case EntityType.TungstenAsteroid: return 'TUNGSTEN';
                default: return 'REGULAR';
            }
        };
        const typeName = getTypeName(a.type);
        const typeConfig = ASTEROID_TYPES[typeName];
        const shouldSplit = typeConfig.splits && a.sizeCategory >= ASTEROID_SPLIT_MIN_SIZE;

        if (shouldSplit) {
            const newSize = (a.sizeCategory - 1) as 1 | 2 | 3;
            // XLARGE splits into 3, others split into 2
            const splitCount = a.sizeCategory === 4 ? ASTEROID_SPLIT_COUNT_XLARGE : ASTEROID_SPLIT_COUNT_NORMAL;

            // Calculate separation angles for even distribution
            const baseAngle = Math.random() * Math.PI * 2;
            const angleStep = (Math.PI * 2) / splitCount;

            for (let i = 0; i < splitCount; i++) {
                const sepAngle = baseAngle + (angleStep * i);
                const sepSpeed = ASTEROID_SPLIT_SEPARATION_SPEED;
                const offsetDist = a.radius * ASTEROID_SPLIT_OFFSET_RATIO;

                createAsteroid(
                    {
                        x: a.pos.x + Math.cos(sepAngle) * offsetDist,
                        y: a.pos.y + Math.sin(sepAngle) * offsetDist
                    },
                    {
                        x: a.vel.x + Math.cos(sepAngle) * sepSpeed,
                        y: a.vel.y + Math.sin(sepAngle) * sepSpeed
                    },
                    newSize,
                    typeName // Pass the type so children are the same type
                );
            }
        }

        // Loot
        if (Math.random() < HULL_DROP_CHANCE) spawnHullOrb(a.pos);

        // Loot
        if (Math.random() < HULL_DROP_CHANCE) spawnHullOrb(a.pos);

        // XP Orbs - bigger special asteroids drop more super XP
        if (isSpecial) {
            // Size-based super XP count: small=1-2, medium=2-3, large=3-4, xlarge=4-5
            const baseDrops = a.sizeCategory;
            const dropCount = baseDrops + (Math.random() < 0.5 ? 1 : 0);
            for (let i = 0; i < dropCount; i++) {
                spawnExpOrb({ x: a.pos.x + randomRange(-15, 15), y: a.pos.y + randomRange(-15, 15) }, 'SUPER');
            }

            // Freebie Orb chance - rare drop from specials
            // NERF: Iron has 1/5th chance since they spawn in bursts of 5-7
            let freebieChance = FREEBIE_DROP_CHANCE_BASE + (a.sizeCategory * FREEBIE_DROP_CHANCE_PER_SIZE);
            if (a.type === EntityType.IronAsteroid) {
                freebieChance *= 0.2; // Nerf for burst spawns - effectively per-wave chance
            }
            if (Math.random() < freebieChance) {
                spawnFreebieOrb(a.pos);
            }
        } else {
            spawnExpOrb(a.pos, 'NORMAL');
        }

        // SCORING: Add points directly to score (pointsRef) upon kill
        // Points = Base XP Value * Size Multiplier * Type Multiplier
        // This is pure score, NOT XP for leveling.
        const sizeMult = SIZE_MULTIPLIERS[a.sizeCategory as 1 | 2 | 3 | 4];
        const points = Math.floor(ASTEROID_BASE.XP_VALUE * sizeMult.xp * (isSpecial ? 2 : 1));
        pointsRef.current += points;

    };

    // Centralized Shield Save Logic - use this whenever a shield save triggers
    const triggerShieldSave = () => {
        const ship = shipRef.current;
        if (!ship || ship.stats.shieldCharges <= 0) return false;

        ship.stats.shieldCharges--;
        ship.hull = ship.maxHull * 0.25; // Heal to 25% HP
        ship.invulnerableUntil = Date.now() + INVULN_DURATION_SHIELD;

        spawnFloatingText(ship.pos, "SHIELD SAVED!", COLORS.SHIELD, 20);
        spawnParticles(ship.pos, COLORS.SHIELD, 30, 5);
        screenShakeRef.current = 15;

        return true; // Shield was used
    };

    const prepareLevelUp = (isDevSequence = false) => {
        // Increment level and update XP target IMMEDIATELY when level-up triggers
        // This prevents multiple level-ups from accumulated XP
        if (!isDevSequence) {
            levelRef.current += 1;
            setUiLevel(levelRef.current);

            // FIX: Reset XP bar - carry over overflow to next level
            const previousTarget = xpTargetRef.current;
            const overflow = xpRef.current - previousTarget;
            xpRef.current = Math.max(0, overflow); // Keep overflow XP, but not negative

            // Calculate new target (without the +1000 - just use scaling factor)
            xpTargetRef.current = Math.floor(previousTarget * XP_SCALING_FACTOR);
        }

        setGameState(GameState.LEVEL_UP);

        const availablePool = UPGRADES.filter(u => {
            if (!u.parentId) return true;
            const parentTier = activeUpgradesRef.current[u.parentId] || 0;
            return parentTier > 0;
        });

        if (isDevMode) {
            // Dev mode: show ALL upgrades, including sub-upgrades without parent requirement
            setUiOfferedUpgrades([...UPGRADES]);
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

    const checkLevelUp = (currentXp: number) => {
        if (currentXp >= xpTargetRef.current) {
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
                    s.thrustMult = 1.0 + (currentTier * UPGRADE_ENGINE_MULT);
                    s.speedMult = 1.0 + (currentTier * UPGRADE_ENGINE_MULT);
                    break;
                case 'regen':
                    s.regenRate = currentTier * UPGRADE_REGEN_PER_TIER;
                    break;
                case 'hull':
                    // Compound scaling: 130%, 169%, 220%... (each tier multiplies by 1.30)
                    s.maxHullMult = Math.pow(1.0 + UPGRADE_HULL_MULT, currentTier);
                    shipRef.current.maxHull = SHIP_BASE_HULL * s.maxHullMult;
                    shipRef.current.hull = shipRef.current.maxHull;
                    break;
                case 'rapidfire': s.fireRateMult = 1.0 / (1.0 + (currentTier * UPGRADE_FIRE_RATE_SPEED_MULT)); break;
                case 'multishot': s.multishotTier = currentTier; break;
                case 'range':
                    s.rangeTier = currentTier;
                    // Pro Balance: Compounding Damage (1.15 ^ tier)
                    s.damageMult = Math.pow(UPGRADE_DAMAGE_MULT_COMPOUND, currentTier);
                    break;
                case 'ricochet':
                    s.ricochetTier = currentTier;
                    break;
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
                    // Drone Overclock Logic (Smart Scaling)
                    // Fire Rate: Linear Speed (+15% per tier) -> Delay / (1 + Tier * 0.15)
                    // Damage: Compounding (+10% per tier) -> Base * (1.10 ^ Tier)
                    // Range: Linear (+25% per tier)
                    s.droneFireRateMult = 1.0 / (1.0 + (currentTier * UPGRADE_DRONE_FIRE_RATE_SPEED_MULT));
                    s.droneDamageMult = Math.pow(UPGRADE_DRONE_DAMAGE_MULT_COMPOUND, currentTier);
                    s.droneRangeMult = 1.0 + (currentTier * UPGRADE_DRONE_RANGE_MULT);
                    break;
                case 'magnet':
                    s.pickupRange = ORB_MAGNET_RANGE_BASE + (currentTier * UPGRADE_MAGNET_RANGE);
                    s.xpMult = 1.0 + (currentTier * UPGRADE_XP_MULT); // Now also gives orb value bonus
                    break;
                case 'shield':
                    s.maxShieldCharges = currentTier;
                    s.shieldCharges = currentTier;
                    s.shieldRechargeTimer = 0; // Reset timer on upgrade
                    break;
                case 'shield_radiation':
                    s.shieldRadiationTier = currentTier;
                    break;
            }

            if (s.maxShieldCharges > 0 && upgrade.id === 'shield') {
                s.shieldCharges = s.maxShieldCharges;
            }
        }

        setUiPendingUpgrades(prev => {
            if (prev > 0) return prev - 1;

            // Resume game after selecting upgrade
            setGameState(GameState.PLAYING);
            setIsFreebie(false);
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
                const pct = Math.min(100, (xpRef.current / xpTargetRef.current) * 100);
                levelBarRef.current.style.width = `${pct}%`;
            }
            // Update XP Text overlay
            if (xpTextRef.current) {
                xpTextRef.current.textContent = `${Math.floor(xpRef.current)} / ${xpTargetRef.current}`;
            }

            // Update Hull Bar in HUD directly (same pattern as XP bar)
            if (hullBarRef.current && shipRef.current) {
                const hullPct = Math.max(0, Math.min(100, (shipRef.current.hull / shipRef.current.maxHull) * 100));
                hullBarRef.current.style.width = `${hullPct}%`;
            }
            // Update Hull Text overlay
            if (hullTextRef.current && shipRef.current) {
                hullTextRef.current.textContent = `${Math.round(shipRef.current.hull)} / ${Math.round(shipRef.current.maxHull)}`;
            }
            // Update Regen Text overlay
            if (regenTextRef.current && shipRef.current) {
                const reg = shipRef.current.stats.regenRate;
                if (reg > 0) {
                    regenTextRef.current.textContent = `+${reg.toFixed(1)}/s`;
                    regenTextRef.current.style.opacity = '1';
                } else {
                    regenTextRef.current.style.opacity = '0';
                }
            }

            // Sync Score with React State (throttled to every 15 frames / 250ms)
            if (frameCountRef.current % 15 === 0) {
                setUiScore(Math.floor(pointsRef.current));
            }

            // Update Shield Recharge Bar in HUD directly
            if (shieldBarRef.current && shipRef.current) {
                const stats = shipRef.current.stats;
                if (stats.shieldCharges < stats.maxShieldCharges) {
                    const shieldPct = Math.min(100, (stats.shieldRechargeTimer / SHIELD_RECHARGE_TIME) * 100);
                    shieldBarRef.current.style.width = `${shieldPct}%`;
                    shieldBarRef.current.parentElement!.style.display = 'block';
                } else {
                    shieldBarRef.current.parentElement!.style.display = 'none';
                }
            }

            // Update Shield Text in HUD directly for instant feedback
            if (shieldTextRef.current && shipRef.current) {
                const stats = shipRef.current.stats;
                if (stats.shieldCharges > 0) {
                    shieldTextRef.current.textContent = `SHIELD x${stats.shieldCharges}/${stats.maxShieldCharges}`;
                    shieldTextRef.current.className = 'text-purple-400 text-[10px] font-bold drop-shadow-sm';
                } else {
                    shieldTextRef.current.textContent = 'CHARGING...';
                    shieldTextRef.current.className = 'text-purple-600 text-[10px] font-medium drop-shadow-sm';
                }
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

                checkLevelUp(xpRef.current);

                // --- SPAWNING DIRECTOR: THREAT-WEIGHTED SYSTEM ---
                if (!sandboxRef.current) {
                    // Calculate current threat on screen
                    const calculateThreat = (a: Asteroid): number => {
                        const sizeMult = SIZE_MULTIPLIERS[a.sizeCategory as 1 | 2 | 3 | 4];
                        let typeMult = 1.0;
                        if (a.type === EntityType.MoltenAsteroid) typeMult = ASTEROID_TYPES.MOLTEN.threatMult;
                        else if (a.type === EntityType.IronAsteroid) typeMult = ASTEROID_TYPES.IRON.threatMult;
                        else if (a.type === EntityType.FrozenAsteroid) typeMult = ASTEROID_TYPES.FROZEN.threatMult;
                        else typeMult = ASTEROID_TYPES.REGULAR.threatMult;
                        return sizeMult.threat * typeMult;
                    };

                    const currentThreat = asteroidsRef.current.reduce((sum, a) => sum + calculateThreat(a), 0);
                    const targetThreat = Math.min(
                        THREAT_BUDGET_MAX,
                        THREAT_BUDGET_BASE + currentLevel * THREAT_BUDGET_PER_LEVEL
                    );
                    const activeAsteroids = asteroidsRef.current.length;

                    // Enforce minimum asteroid COUNT (never empty screen!)
                    if (activeAsteroids < TARGET_ASTEROID_MIN) {
                        const needed = TARGET_ASTEROID_MIN - activeAsteroids;
                        for (let i = 0; i < needed; i++) {
                            spawnAsteroid(cw, ch, currentLevel);
                        }
                    }

                    // Spawn interval decays with level
                    const spawnInterval = Math.max(
                        SPAWN_INTERVAL_MIN,
                        Math.floor(SPAWN_INTERVAL_BASE * Math.pow(SPAWN_INTERVAL_DECAY, currentLevel - 1))
                    );

                    // Spawn if under threat budget
                    if (currentThreat < targetThreat && spawnTimerRef.current <= 0) {
                        // First check if we should spawn an Iron shotgun burst
                        const ironGate = SPAWN_GATES.IRON.SMALL;
                        const ironWeight = currentLevel >= ironGate ?
                            Math.min(TYPE_SPAWN_WEIGHTS.IRON.max || 100, TYPE_SPAWN_WEIGHTS.IRON.base + currentLevel * (TYPE_SPAWN_WEIGHTS.IRON.perLevel || 0)) : 0;
                        const totalWeight = 100 + ironWeight;
                        const ironChance = ironWeight / totalWeight;

                        if (Math.random() < ironChance && currentLevel >= ironGate) {
                            // Iron ALWAYS spawns as shotgun burst
                            spawnIronBurst(cw, ch, currentLevel);
                            spawnTimerRef.current = spawnInterval * 1.5;
                        } else {
                            // Normal spawn
                            spawnAsteroid(cw, ch, currentLevel);
                            spawnTimerRef.current = spawnInterval + randomRange(-10, 10);

                            // Asteroid cloud for cohesive swarm engagement
                            if (Math.random() < CLOUD_SPAWN_CHANCE && currentLevel >= 2) {
                                spawnCloud(cw, ch, currentLevel);
                            }
                        }
                    }
                    if (spawnTimerRef.current > 0) spawnTimerRef.current--;
                }

                // --- PROCESS STAGGERED SPAWNS (pew pew pew effect) ---
                const currentFrame = frameCountRef.current;
                const toSpawn = pendingSpawnsRef.current.filter(p => p.spawnAt <= currentFrame);
                pendingSpawnsRef.current = pendingSpawnsRef.current.filter(p => p.spawnAt > currentFrame);

                for (const pending of toSpawn) {
                    const props = calculateAsteroidProps(pending.typeName, pending.sizeCat, currentLevel);
                    asteroidsRef.current.push({
                        id: Math.random().toString(36).substr(2, 9),
                        type: getEntityType(pending.typeName),
                        pos: { ...pending.pos },
                        vel: { ...pending.vel },
                        radius: props.radius,
                        angle: 0,
                        color: props.color,
                        toBeRemoved: false,
                        vertices: generatePolygon(props.radius, props.vertices, pending.sizeCat * 3),
                        hp: props.hp,
                        maxHp: props.hp,
                        sizeCategory: pending.sizeCat,
                        hitFlash: 0,
                        rotation: Math.random() * Math.PI * 2,
                        rotationSpeed: randomRange(-props.rotation, props.rotation),
                        pulsateOffset: Math.random() * Math.PI * 2
                    });
                }
                const stats = ship.stats;

                ship.isFrozen = false;

                if (stats.regenRate > 0 && ship.hull < ship.maxHull) {
                    ship.hull = Math.min(ship.maxHull, ship.hull + stats.regenRate / 60);
                }

                // Shield Recharge Logic (30s per charge)
                if (stats.shieldCharges < stats.maxShieldCharges) {
                    stats.shieldRechargeTimer += 1000 / 60; // Add ~16.67ms per frame
                    if (stats.shieldRechargeTimer >= SHIELD_RECHARGE_TIME) {
                        stats.shieldCharges++;
                        stats.shieldRechargeTimer = 0;
                        spawnFloatingText(ship.pos, "SHIELD RECHARGED!", COLORS.SHIELD, 16);
                        spawnParticles(ship.pos, COLORS.SHIELD, 15, 3);
                    }
                }

                // Shield Radiation Aura (DoT to nearby enemies) - only works with active shields
                if (stats.shieldRadiationTier > 0 && stats.shieldCharges > 0) {
                    const radiationRadius = SHIELD_RADIATION_BASE_RADIUS + (stats.shieldRadiationTier * SHIELD_RADIATION_RADIUS_PER_TIER);
                    const radiationDPS = SHIELD_RADIATION_BASE_DPS + (stats.shieldRadiationTier * SHIELD_RADIATION_DPS_PER_TIER);
                    const damagePerFrame = radiationDPS / 60;

                    for (const a of asteroidsRef.current) {
                        if (!a.toBeRemoved && dist(ship.pos, a.pos) < radiationRadius + a.radius) {
                            a.hp -= damagePerFrame;
                            a.hitFlash = Math.max(a.hitFlash, 1); // Subtle flash

                            // Show damage numbers every 30 frames (0.5s) to avoid spam
                            if (frameCountRef.current % 30 === 0) {
                                const dmg = Math.round(radiationDPS / 2); // Half-second damage
                                spawnFloatingText(
                                    { x: a.pos.x + randomRange(-10, 10), y: a.pos.y + randomRange(-10, 10) },
                                    `-${dmg}`,
                                    '#a855f7', // Purple for radiation
                                    10
                                );
                            }

                            // Handle Death from Radiation
                            // Handle Death from Radiation
                            if (a.hp <= 0) {
                                destroyAsteroid(a);
                            }
                        }
                    }
                }

                // Check for Aura Status Logic - handles both Frozen (slow) and Molten (burn)
                let isInFrozenAura = false;
                let isInMoltenAura = false;

                for (const a of asteroidsRef.current) {
                    if (a.toBeRemoved) continue;

                    // Get type config for aura check
                    let typeConfig: typeof ASTEROID_TYPES.FROZEN | typeof ASTEROID_TYPES.MOLTEN | null = null;
                    let auraType: 'frozen' | 'molten' | null = null;

                    if (a.type === EntityType.FrozenAsteroid) {
                        typeConfig = ASTEROID_TYPES.FROZEN;
                        auraType = 'frozen';
                    } else if (a.type === EntityType.MoltenAsteroid) {
                        typeConfig = ASTEROID_TYPES.MOLTEN;
                        auraType = 'molten';
                    }

                    if (typeConfig && typeConfig.hasAura && typeConfig.auraRange) {
                        // Calculate aura range with size scaling
                        const sizeScale = typeConfig.auraSizeScale || 0;
                        const sizeBonus = 1 + (a.sizeCategory - 1) * sizeScale; // +scale% per size tier
                        const auraRange = (typeConfig.auraRange * sizeBonus) + a.radius;

                        if (dist(ship.pos, a.pos) < auraRange) {
                            // Apply aura damage
                            const auraDPS = typeConfig.auraDPS || 10;
                            ship.hull -= auraDPS / 60;

                            if (auraType === 'frozen') {
                                isInFrozenAura = true;
                            } else if (auraType === 'molten') {
                                isInMoltenAura = true;
                            }

                            if (ship.hull <= 0) {
                                if (!triggerShieldSave()) {
                                    handleGameOver(auraType === 'frozen' ? "Hypothermia" : "Incinerated");
                                }
                            }
                        }
                    }
                }

                // Set frozen state for slow effect (only Frozen aura slows)
                ship.isFrozen = isInFrozenAura;

                // Show aura damage text
                if (isInFrozenAura && frameCountRef.current % 30 === 0) {
                    spawnFloatingText(ship.pos, "-COLD", ASTEROID_TYPES.FROZEN.color, 10);
                }
                if (isInMoltenAura && frameCountRef.current % 20 === 0) {
                    spawnFloatingText(ship.pos, "BURN!", ASTEROID_TYPES.MOLTEN.color, 12);
                }

                // Movement
                if (inputRef.current.left) ship.rotation -= SHIP_TURN_SPEED;
                if (inputRef.current.right) ship.rotation += SHIP_TURN_SPEED;

                if (inputRef.current.up) {
                    let thrustPower = SHIP_THRUST * stats.thrustMult;
                    const slowFactor = ASTEROID_TYPES.FROZEN.auraSlowFactor || 0.4;
                    if (ship.isFrozen) thrustPower *= slowFactor;

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
                const slowFactor2 = ASTEROID_TYPES.FROZEN.auraSlowFactor || 0.4;
                if (ship.isFrozen) maxSpeed *= slowFactor2;

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
                    else if (stats.multishotTier === 1) shotAngles.push(-MULTISHOT_SPREAD.DOUBLE, MULTISHOT_SPREAD.DOUBLE);
                    else if (stats.multishotTier === 2) shotAngles.push(-MULTISHOT_SPREAD.TRIPLE, 0, MULTISHOT_SPREAD.TRIPLE);
                    else {
                        // Dynamic scaling for tier 3+: tier+1 bullets
                        const count = stats.multishotTier + 1;
                        const totalSpread = MULTISHOT_SPREAD.DYNAMIC_TOTAL;
                        for (let i = 0; i < count; i++) {
                            shotAngles.push(-totalSpread / 2 + (totalSpread * i / (count - 1)));
                        }
                    }

                    // Multishot damage split: total DPS = 100% + 30% per tier, split across bullets
                    const bulletCount = shotAngles.length;
                    const totalDpsMult = 1.0 + stats.multishotTier * 0.3;
                    const damagePerBullet = (BULLET_DAMAGE * totalDpsMult / bulletCount) * stats.damageMult;

                    shotAngles.forEach(offset => {
                        // Range scaling: Uses Linear PRO BALANCE constant (+30% per tier)
                        const variance = (Math.random() * 6) - 3;
                        const bulletLife = (BULLET_LIFE * (1.0 + stats.rangeTier * UPGRADE_RANGE_MULT)) + variance;

                        // Angle Spread: Tiny variation in direction (+/- 0.5 degrees) for "non-robotic" fire
                        const angleFuzz = (Math.random() - 0.5) * 0.015;
                        const a = ship.rotation + offset + angleFuzz;

                        bulletsRef.current.push({
                            id: Math.random().toString(),
                            type: EntityType.Bullet,
                            pos: {
                                x: ship.pos.x + Math.cos(a) * ship.radius,
                                y: ship.pos.y + Math.sin(a) * ship.radius
                            },
                            vel: {
                                x: Math.cos(a) * BULLET_SPEED + ship.vel.x * 0.2,
                                y: Math.sin(a) * BULLET_SPEED + ship.vel.y * 0.2
                            },
                            radius: BULLET_RADIUS,
                            angle: a,
                            color: COLORS.BULLET,
                            toBeRemoved: false,
                            life: bulletLife,
                            damage: damagePerBullet,
                            bouncesRemaining: stats.ricochetTier
                        });
                    });

                    // Plasma exhaust wisp ejects once per shot
                    spawnPlasmaExhaust(ship.pos, ship.rotation, ship.vel);
                }

                // --- Drone Swarm Logic ---
                if (stats.droneCount > 0) {
                    dronesRef.current.forEach((drone, i) => {
                        const t = frameCountRef.current;

                        // Organic "Breathing" Orbit
                        // Instead of a rigid circle, use sine waves to vary the radius and add noise
                        const count = stats.droneCount;
                        const baseRadius = DRONE_ORBIT_RADIUS;
                        const radiusVar = Math.sin(t * 0.03 + i) * DRONE_ORBIT_VARIANCE;
                        const orbitRadius = baseRadius + radiusVar;

                        const angleSpeed = DRONE_ORBIT_SPEED;
                        const baseAngle = t * angleSpeed + (i * (Math.PI * 2 / count));

                        // Add "Wander" noise to the ideal position
                        const wanderX = Math.sin(t * 0.05 + i * 3) * DRONE_WANDER_X;
                        const wanderY = Math.cos(t * 0.04 + i * 7) * DRONE_WANDER_Y;

                        const idealX = ship.pos.x + Math.cos(baseAngle) * orbitRadius + wanderX;
                        const idealY = ship.pos.y + Math.sin(baseAngle) * orbitRadius + wanderY;

                        // Physics: Soft Spring
                        const dx = idealX - drone.pos.x;
                        const dy = idealY - drone.pos.y;

                        const springStrength = DRONE_SPRING;
                        const damping = DRONE_DAMPING;

                        drone.vel.x += dx * springStrength;
                        drone.vel.y += dy * springStrength;

                        // Add separation force (avoid stacking)
                        dronesRef.current.forEach((other, j) => {
                            if (i !== j) {
                                const distToOther = dist(drone.pos, other.pos);
                                if (distToOther < DRONE_SEPARATION_DIST) {
                                    const angleToOther = Math.atan2(drone.pos.y - other.pos.y, drone.pos.x - other.pos.x);
                                    const push = (DRONE_SEPARATION_DIST - distToOther) * DRONE_SEPARATION_FORCE;
                                    drone.vel.x += Math.cos(angleToOther) * push;
                                    drone.vel.y += Math.sin(angleToOther) * push;
                                }
                            }
                        });

                        drone.vel.x *= damping;
                        drone.vel.y *= damping;

                        drone.pos.x += drone.vel.x;
                        drone.pos.y += drone.vel.y;

                        if (dist(drone.pos, ship.pos) > DRONE_TELEPORT_DIST) {
                            drone.pos.x = idealX;
                            drone.pos.y = idealY;
                            drone.vel = { x: 0, y: 0 };
                        }

                        // Shooting Logic - Fire at target, bullet travels straight (no homing)
                        const droneFireRate = Math.floor(DRONE_BASE_FIRE_RATE * stats.droneFireRateMult);
                        // Targeting Range now scales with Overclock upgrade
                        const effectiveTargetRange = DRONE_TARGET_RANGE * stats.droneRangeMult;
                        if (t - drone.lastShot > droneFireRate) {
                            let nearest = null;
                            let minDist = effectiveTargetRange;
                            for (const a of asteroidsRef.current) {
                                const d = dist(drone.pos, a.pos);
                                if (d < minDist) {
                                    minDist = d;
                                    nearest = a;
                                }
                            }
                            if (nearest) {
                                const targetAngle = Math.atan2(nearest.pos.y - drone.pos.y, nearest.pos.x - drone.pos.x);
                                // Add aim spread for natural feel (±8.5 degrees)
                                const aimSpread = (Math.random() - 0.5) * 0.3;
                                const angle = targetAngle + aimSpread;

                                // recoil
                                drone.vel.x -= Math.cos(angle) * DRONE_RECOIL;
                                drone.vel.y -= Math.sin(angle) * DRONE_RECOIL;

                                // Drone bullet range: Same as ship (1.0x), scaled by Overclock, ±20% variance for lively feel (not a buff)
                                const baseRange = BULLET_LIFE * 1.0 * stats.droneRangeMult;
                                const droneBulletLife = baseRange * (0.8 + Math.random() * 0.4);

                                bulletsRef.current.push({
                                    id: Math.random().toString(),
                                    type: EntityType.Bullet,
                                    pos: { ...drone.pos },
                                    vel: {
                                        x: Math.cos(angle) * BULLET_SPEED,
                                        y: Math.sin(angle) * BULLET_SPEED
                                    },
                                    radius: 1.2,
                                    angle: angle,
                                    color: COLORS.DRONE,
                                    toBeRemoved: false,
                                    life: droneBulletLife,
                                    damage: DRONE_BASE_DAMAGE * stats.droneDamageMult,
                                    bouncesRemaining: 0 // Drones don't get ricochet
                                });
                                drone.lastShot = t;
                            }
                        }
                    });
                }
            }

            // Physics Updates
            bulletsRef.current.forEach(b => {
                if (gameState !== GameState.LEVEL_UP) {
                    // Track trail for ricochet bullets (before moving)
                    if (b.isRicochet && b.trail) {
                        b.trail.push({ x: b.pos.x, y: b.pos.y });
                        // Keep trail length limited (max 8 positions)
                        if (b.trail.length > 8) b.trail.shift();
                    }

                    b.pos.x += b.vel.x;
                    b.pos.y += b.vel.y;
                    b.life--;
                    if (b.pos.x < 0 || b.pos.x > cw || b.pos.y < 0 || b.pos.y > ch) b.toBeRemoved = true;
                    if (b.life <= 0) b.toBeRemoved = true;
                }
            });

            asteroidsRef.current.forEach(a => {
                if (gameState !== GameState.LEVEL_UP) {
                    // MOLTEN HOMING: Gently track player, but decay so it drifts off
                    if (a.type === EntityType.MoltenAsteroid && ship && !ship.toBeRemoved) {
                        const HOMING_STRENGTH = 0.015; // Very gentle tracking
                        const angleToPlayer = Math.atan2(ship.pos.y - a.pos.y, ship.pos.x - a.pos.x);
                        const speed = Math.sqrt(a.vel.x * a.vel.x + a.vel.y * a.vel.y);

                        // Blend current velocity toward player direction
                        a.vel.x += Math.cos(angleToPlayer) * HOMING_STRENGTH;
                        a.vel.y += Math.sin(angleToPlayer) * HOMING_STRENGTH;

                        // Normalize to maintain original speed (prevent acceleration)
                        const newSpeed = Math.sqrt(a.vel.x * a.vel.x + a.vel.y * a.vel.y);
                        if (newSpeed > 0) {
                            a.vel.x = (a.vel.x / newSpeed) * speed;
                            a.vel.y = (a.vel.y / newSpeed) * speed;
                        }
                    }

                    // SOFT PHYSICS: Repulsion Only (gravity is now Tungsten-specific)
                    // Asteroids push apart when overlapping to prevent stacking
                    for (const other of asteroidsRef.current) {
                        if (other === a || other.toBeRemoved) continue;
                        const dx = a.pos.x - other.pos.x;
                        const dy = a.pos.y - other.pos.y;
                        const d = Math.sqrt(dx * dx + dy * dy);

                        if (d === 0) continue; // Skip if perfectly overlapping

                        const minDist = (a.radius + other.radius) * SOFT_DECLUMP_RANGE;

                        // REPULSION: Push apart when overlapping
                        if (d < minDist) {
                            const pushStrength = ((minDist - d) / minDist) * SOFT_DECLUMP_FORCE;
                            a.vel.x += (dx / d) * pushStrength;
                            a.vel.y += (dy / d) * pushStrength;
                        }
                    }

                    // TUNGSTEN GRAVITY AURA: Pull regular asteroids toward Tungsten
                    // Only Tungsten asteroids have gravity, and they only affect REGULAR asteroids
                    if (a.type === EntityType.Asteroid) { // If this is a REGULAR asteroid
                        for (const tungsten of asteroidsRef.current) {
                            if (tungsten.toBeRemoved || tungsten.type !== EntityType.TungstenAsteroid) continue;

                            const dx = tungsten.pos.x - a.pos.x;
                            const dy = tungsten.pos.y - a.pos.y;
                            const d = Math.sqrt(dx * dx + dy * dy);

                            if (d === 0) continue;

                            // Get Tungsten's gravity config
                            const tungstenConfig = ASTEROID_TYPES.TUNGSTEN;
                            if (!tungstenConfig.hasGravityAura) continue;

                            // Calculate gravity range with size scaling
                            const sizeScale = tungstenConfig.gravitySizeScale || 0;
                            const sizeBonus = 1 + (tungsten.sizeCategory - 1) * sizeScale;
                            const gravityRange = (tungstenConfig.gravityRange || 200) * sizeBonus;

                            // Pull toward Tungsten if in range
                            if (d < gravityRange) {
                                const pullStrength = (1 - (d / gravityRange)) * (tungstenConfig.gravityStrength || 0.15);
                                a.vel.x += (dx / d) * pullStrength;
                                a.vel.y += (dy / d) * pullStrength;
                            }
                        }
                    }

                    a.pos.x += a.vel.x;
                    a.pos.y += a.vel.y;
                    a.rotation += a.rotationSpeed;

                    if (a.hitFlash > 0) a.hitFlash--;

                    if (a.type === EntityType.MoltenAsteroid || a.type === EntityType.FrozenAsteroid || a.type === EntityType.IronAsteroid || a.type === EntityType.TungstenAsteroid) {
                        // Tungsten has 600px gravity aura, so it needs a larger buffer to not despawn while visible
                        const buffer = a.type === EntityType.TungstenAsteroid ? 600 : 200;
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

            // --- ASTEROID CLOUD PHYSICS ---
            // Clouds keep their member asteroids together and home toward player
            if (ship && !ship.toBeRemoved) {
                asteroidCloudsRef.current.forEach((cloud) => {
                    // Find living members with their offset indices
                    const livingMembers: { member: Asteroid; idx: number }[] = [];
                    for (let i = 0; i < cloud.memberIds.length; i++) {
                        const member = asteroidsRef.current.find(a => a.id === cloud.memberIds[i] && !a.toBeRemoved);
                        if (member) livingMembers.push({ member, idx: i });
                    }

                    // If all members destroyed, remove cloud
                    if (livingMembers.length === 0) {
                        cloud.memberIds = [];
                        return;
                    }

                    // Steer cloud toward player (gentle)
                    const dx = ship.pos.x - cloud.pos.x;
                    const dy = ship.pos.y - cloud.pos.y;
                    const d = Math.sqrt(dx * dx + dy * dy);

                    if (d > 0) {
                        const targetVx = (dx / d) * 1.2;
                        const targetVy = (dy / d) * 1.2;
                        cloud.vel.x += (targetVx - cloud.vel.x) * 0.002;
                        cloud.vel.y += (targetVy - cloud.vel.y) * 0.002;
                    }

                    // Cap speed
                    const spd = Math.sqrt(cloud.vel.x * cloud.vel.x + cloud.vel.y * cloud.vel.y);
                    if (spd > 1.5) {
                        cloud.vel.x = (cloud.vel.x / spd) * 1.5;
                        cloud.vel.y = (cloud.vel.y / spd) * 1.5;
                    }

                    // Move cloud center
                    cloud.pos.x += cloud.vel.x;
                    cloud.pos.y += cloud.vel.y;

                    // Position members at fixed offsets (direct follow)
                    for (const { member, idx } of livingMembers) {
                        const offset = cloud.memberOffsets[idx];
                        if (offset) {
                            // Direct position - no interpolation delay
                            member.pos.x = cloud.pos.x + offset.x;
                            member.pos.y = cloud.pos.y + offset.y;
                            member.vel.x = 0;
                            member.vel.y = 0;
                        }
                    }

                    // Off-screen cleanup
                    const buffer = 150;
                    if (cloud.pos.x < -buffer || cloud.pos.x > cw + buffer || cloud.pos.y < -buffer || cloud.pos.y > ch + buffer) {
                        for (const { member } of livingMembers) {
                            member.toBeRemoved = true;
                        }
                        cloud.memberIds = [];
                    }
                });

                // Clean up empty clouds
                asteroidCloudsRef.current = asteroidCloudsRef.current.filter(c => c.memberIds.length > 0);
            }

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
            freebieOrbsRef.current.forEach(o => {
                // Update freebie orbs like other orbs but with slower magnet pull
                if (gameState !== GameState.LEVEL_UP) {
                    if (gameState === GameState.PLAYING && ship && !ship.toBeRemoved) {
                        const d = dist(o.pos, ship.pos);

                        // Collection detection - ship touches orb
                        if (d < ship.radius + o.radius) {
                            o.toBeRemoved = true;
                            // Grant free upgrade - just show the menu directly, don't add to pending
                            // The menu will show, player picks, then game resumes
                            setIsFreebie(true);
                            prepareLevelUp(true); // true = free upgrade (no level increment)
                            spawnFloatingText(ship.pos, "FREE UPGRADE!", '#22c55e', 18);
                            spawnParticles(ship.pos, '#a855f7', 15, 4);
                            screenShakeRef.current = 5;
                            return;
                        }

                        if (d < ship.stats.pickupRange * 0.7) { // Slightly shorter magnet range
                            const angle = Math.atan2(ship.pos.y - o.pos.y, ship.pos.x - o.pos.x);
                            o.vel.x += Math.cos(angle) * 0.4; // Slower pull
                            o.vel.y += Math.sin(angle) * 0.4;
                        }
                    }
                    o.pos.x += o.vel.x;
                    o.pos.y += o.vel.y;
                    o.vel.x *= 0.98; // Slower decay (floatier)
                    o.vel.y *= 0.98;
                    o.sparklePhase += 0.15; // Sparkle animation

                    // Wrap around screen
                    if (o.pos.x < 0) o.pos.x = cw;
                    if (o.pos.x > cw) o.pos.x = 0;
                    if (o.pos.y < 0) o.pos.y = ch;
                    if (o.pos.y > ch) o.pos.y = 0;
                }
            });


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
                        } else if (p.variant === 'SHELL') {
                            // Plasma exhaust - gentle friction in zero-G
                            p.vel.x *= 0.96;
                            p.vel.y *= 0.96;
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
                        // Skip collision with immediate source asteroid (last in chain)
                        const lastInChain = b.hitChainIds?.[b.hitChainIds.length - 1];
                        if (lastInChain === a.id) return;
                        if (dist(b.pos, a.pos) < a.radius) {
                            a.hp -= b.damage;
                            a.hitFlash = HIT_FLASH_FRAMES;
                            spawnParticles(b.pos, b.color, 2, 4);

                            // Show damage number if enabled
                            if (showDamageNumbersRef.current) {
                                const dmgText = Math.round(b.damage).toString();
                                const offsetX = (Math.random() - 0.5) * 20;
                                const offsetY = (Math.random() - 0.5) * 10;
                                spawnFloatingText(
                                    { x: b.pos.x + offsetX, y: b.pos.y + offsetY },
                                    dmgText,
                                    b.color === '#ff6600' ? '#ff6600' : '#ffcc00', // Orange for ricochet, yellow for normal
                                    12
                                );
                            }

                            // Ricochet: spawn new bullet if bounces remaining
                            if (b.bouncesRemaining > 0) {
                                // Calculate current max range based on ship stats
                                const stats = ship.stats;
                                const currentMaxLife = BULLET_LIFE * (1.0 + stats.rangeTier * 0.25);
                                const ricochetLife = currentMaxLife * 0.7;
                                const bulletRange = ricochetLife * BULLET_SPEED;

                                const currentChain = b.hitChainIds || [];
                                const newChain = [...currentChain, a.id]; // Add current target to chain

                                // Collect all valid targets within bullet travel range
                                const validTargets: typeof a[] = [];
                                for (const other of asteroidsRef.current) {
                                    if (other === a || other.toBeRemoved) continue;
                                    const distToEdge = dist(b.pos, other.pos) - other.radius;
                                    if (distToEdge < bulletRange) {
                                        validTargets.push(other);
                                    }
                                }

                                // Pick random target from valid ones
                                const target = validTargets.length > 0
                                    ? validTargets[Math.floor(Math.random() * validTargets.length)]
                                    : null;

                                // Spawn ricochet if we have a target
                                if (target) {
                                    const angle = Math.atan2(target.pos.y - b.pos.y, target.pos.x - b.pos.x);
                                    const bounceDepth = (b.bounceDepth ?? 0) + 1;

                                    // White → Cyan gradient based on bounce depth
                                    const ricochetColors = ['#ffffff', '#e0ffff', '#b0ffff', '#80ffff', '#00ffff'];
                                    const bulletColor = ricochetColors[Math.min(bounceDepth, ricochetColors.length - 1)];

                                    bulletsRef.current.push({
                                        id: Math.random().toString(),
                                        type: EntityType.Bullet,
                                        pos: { ...b.pos },
                                        vel: {
                                            x: Math.cos(angle) * BULLET_SPEED,
                                            y: Math.sin(angle) * BULLET_SPEED
                                        },
                                        radius: Math.max(1.0, b.radius * 0.85),
                                        angle: angle,
                                        color: bulletColor,
                                        toBeRemoved: false,
                                        life: ricochetLife,
                                        damage: b.damage * 0.5, // 50% damage per bounce (nerfed from 60%)
                                        bouncesRemaining: b.bouncesRemaining - 1,
                                        hitChainIds: newChain,
                                        isRicochet: true,
                                        bounceDepth: bounceDepth,
                                        trail: [{ ...b.pos }]
                                    });
                                }
                            }

                            b.toBeRemoved = true;

                            if (a.hp <= 0) {
                                destroyAsteroid(a);
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
                            // XP orbs give flat value (xpMult from Tractor Beam still applies)
                            const finalVal = Math.floor(orb.value * ship.stats.xpMult);

                            // SEPARATION: XP vs POINTS
                            // 1. Add to XP for leveling (strictly XP)
                            xpRef.current += finalVal;

                            // 2. Add to Points for score (strictly Score)
                            // Points = XP Value * 10 (arbitrary score scaling for satisfaction)
                            const pointsVal = finalVal * 10;
                            pointsRef.current += pointsVal;

                            const color = orb.variant === 'SUPER' ? COLORS.XP_SUPER : COLORS.XP_NORMAL;
                            spawnFloatingText(ship.pos, `+${finalVal} XP`, color, orb.variant === 'SUPER' ? 20 : 12);
                        }
                    };

                    expOrbsRef.current.forEach(o => { if (!o.toBeRemoved && dist(ship.pos, o.pos) < ship.radius + o.radius) collectOrb(o, 'EXP'); });
                    hullOrbsRef.current.forEach(o => { if (!o.toBeRemoved && dist(ship.pos, o.pos) < ship.radius + o.radius) collectOrb(o, 'HULL'); });

                    if (Date.now() > ship.invulnerableUntil) {
                        asteroidsRef.current.forEach(a => {
                            if (a.toBeRemoved) return;
                            if (checkShipCollision(ship, a)) {
                                // Calculate damage from new type system (all types including Molten)
                                const getAsteroidTypeName = (type: EntityType): AsteroidTypeName => {
                                    switch (type) {
                                        case EntityType.MoltenAsteroid: return 'MOLTEN';
                                        case EntityType.IronAsteroid: return 'IRON';
                                        case EntityType.FrozenAsteroid: return 'FROZEN';
                                        default: return 'REGULAR';
                                    }
                                };
                                const asteroidTypeName = getAsteroidTypeName(a.type);
                                const asteroidTypeConfig = ASTEROID_TYPES[asteroidTypeName];
                                const sizeMult = SIZE_MULTIPLIERS[a.sizeCategory as 1 | 2 | 3 | 4];

                                const baseDamage = ASTEROID_BASE.DAMAGE * sizeMult.damage * asteroidTypeConfig.damageMult;
                                const damage = Math.round(baseDamage);

                                // Base knockback + type-specific multiplier (Iron = massive pushback!)
                                const baseKnockback = 6 + a.sizeCategory * 2;
                                const knockbackTypeMult = asteroidTypeConfig.knockbackMult || 1.0;
                                const knockback = baseKnockback * knockbackTypeMult;

                                // Molten also has extra knockback (2x on top of type mult)
                                const finalKnockback = a.type === EntityType.MoltenAsteroid ? knockback * 2 : knockback;

                                // All asteroids deal damage + knockback (ship no longer destroys on impact)
                                const angle = Math.atan2(ship.pos.y - a.pos.y, ship.pos.x - a.pos.x);
                                ship.vel.x += Math.cos(angle) * finalKnockback;
                                ship.vel.y += Math.sin(angle) * finalKnockback;
                                ship.hull -= damage;
                                if (a.type !== EntityType.FrozenAsteroid) a.hitFlash = HIT_FLASH_FRAMES;

                                // Molten gets extra dramatic effects
                                if (a.type === EntityType.MoltenAsteroid) {
                                    spawnParticles(a.pos, COLORS.MOLTEN, 30, 8);
                                    screenShakeRef.current = 20;
                                    spawnFloatingText(ship.pos, `-${damage} BURN!`, '#ff4444', 20);
                                } else {
                                    spawnParticles(ship.pos, COLORS.SHIP, 15, 6);
                                    screenShakeRef.current = a.type === EntityType.IronAsteroid ? 15 : 6;
                                    spawnFloatingText(ship.pos, `-${damage} HP`, '#ff0000', 16);
                                }

                                ship.invulnerableUntil = Date.now() + 300;

                                if (ship.hull <= 0) {
                                    if (!triggerShieldSave()) {
                                        const deathReason = a.type === EntityType.MoltenAsteroid ? "Incinerated" : "Hull Critical";
                                        handleGameOver(deathReason);
                                        ship.toBeRemoved = true;
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
            freebieOrbsRef.current = freebieOrbsRef.current.filter(e => !e.toBeRemoved);

            // --- RENDER ---

            // Helper: skip rendering entities far offscreen (they still exist, just not drawn)
            const buffer = 100; // buffer zone around screen
            const isOnScreen = (pos: Vector, radius: number = 0) =>
                pos.x > -buffer - radius && pos.x < cw + buffer + radius &&
                pos.y > -buffer - radius && pos.y < ch + buffer + radius;

            particlesRef.current.forEach(p => {
                if (!isOnScreen(p.pos, p.radius)) return; // Skip offscreen

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
                } else if (p.variant === 'SHELL') {
                    // Plasma cartridge - elongated glowing shape that tumbles
                    ctx.save();
                    ctx.translate(p.pos.x, p.pos.y);

                    // Tumble based on elapsed time (spins in zero-G)
                    const spinSpeed = p.angle > 0 ? 8 : -8; // Spin direction from spawn
                    const tumble = p.angle + (1 - p.life) * spinSpeed;
                    ctx.rotate(tumble);

                    // Glow effect
                    ctx.shadowColor = p.color;
                    ctx.shadowBlur = 4; // Subtle glow

                    // Cartridge dimensions (smaller)
                    const width = 2;
                    const height = 4;

                    // Outer glow (cyan) - dimmer
                    ctx.fillStyle = p.color;
                    ctx.globalAlpha = p.life * 0.35;
                    ctx.beginPath();
                    ctx.roundRect(-width / 2 - 1, -height / 2 - 1, width + 2, height + 2, 2);
                    ctx.fill();

                    // Inner core - less bright
                    ctx.fillStyle = '#aaddff';
                    ctx.globalAlpha = p.life * 0.5;
                    ctx.beginPath();
                    ctx.roundRect(-width / 2, -height / 2, width, height, 1);
                    ctx.fill();

                    ctx.shadowBlur = 0;
                    ctx.restore();
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
                if (!isOnScreen(b.pos, b.radius + 50)) return; // Skip offscreen (extra buffer for trail)

                // Draw trail for ricochet bullets
                if (b.isRicochet && b.trail && b.trail.length > 1) {
                    ctx.save();
                    ctx.lineCap = 'round';
                    for (let i = 1; i < b.trail.length; i++) {
                        const prev = b.trail[i - 1];
                        const curr = b.trail[i];
                        const alpha = (i / b.trail.length) * 0.6; // Fade from 0 to 0.6
                        const width = 1 + (i / b.trail.length) * 1.5; // Width 1 to 2.5
                        ctx.globalAlpha = alpha;
                        ctx.strokeStyle = b.color;
                        ctx.lineWidth = width;
                        ctx.beginPath();
                        ctx.moveTo(prev.x, prev.y);
                        ctx.lineTo(curr.x, curr.y);
                        ctx.stroke();
                    }
                    // Connect trail to current position
                    ctx.globalAlpha = 0.6;
                    ctx.lineWidth = 2.5;
                    ctx.beginPath();
                    ctx.moveTo(b.trail[b.trail.length - 1].x, b.trail[b.trail.length - 1].y);
                    ctx.lineTo(b.pos.x, b.pos.y);
                    ctx.stroke();
                    ctx.restore();
                }

                // "Plasma Bolt" visual: Glowing comet with tight jitter for confident feel
                const speed = dist(b.vel, { x: 0, y: 0 });
                const isFading = b.life < 12;
                const baseAlpha = isFading ? b.life / 12 : 1.0;

                ctx.save();
                ctx.globalAlpha = baseAlpha;

                // Tighter jitter (80-110%) = confident plasma, not sputtery
                const jitter = 0.8 + Math.random() * 0.3;
                // Longer tail multiplier for satisfying comet trail
                const tailLen = Math.min(Math.max(b.radius * 3, speed * 2.8), 28) * jitter;

                // Subtle width pulse (97-103%) - barely noticeable but adds life
                const widthJitter = 0.97 + Math.random() * 0.06;
                const headRadius = b.radius * widthJitter;

                const angle = Math.atan2(b.vel.y, b.vel.x);
                ctx.translate(b.pos.x, b.pos.y);
                ctx.rotate(angle);

                // Subtle outer glow (gives "plasma" energy feel)
                ctx.fillStyle = b.isRicochet ? b.color : '#88ccff';
                ctx.globalAlpha = baseAlpha * 0.25;
                ctx.beginPath();
                ctx.arc(0, 0, headRadius * 1.8, 0, Math.PI * 2);
                ctx.fill();

                // Main bullet core
                ctx.globalAlpha = baseAlpha;
                ctx.fillStyle = b.color;
                ctx.beginPath();
                ctx.arc(0, 0, headRadius, 0, Math.PI * 2);
                ctx.fill();

                // Tapered comet tail - longer and more satisfying
                ctx.beginPath();
                ctx.moveTo(0, headRadius * 0.75);  // Top of tail
                ctx.lineTo(-tailLen, 0);            // Point of tail
                ctx.lineTo(0, -headRadius * 0.75); // Bottom of tail
                ctx.fill();

                ctx.restore();
            });

            // Orbs (no shadows - retro style + performance)
            ctx.lineWidth = 2;
            const pulseBase = Math.sin(frameCountRef.current * 0.15); // Cache trig for all orbs
            const drawOrb = (o: Entity, color: string) => {
                if (!isOnScreen(o.pos, o.radius + 10)) return; // Skip offscreen
                ctx.strokeStyle = color;
                const pulse = Math.sin(pulseBase + (o as any).pulsateOffset) * 2;
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

            // Freebie Orbs - subtle tri-color effect (green/red/purple)
            freebieOrbsRef.current.forEach(o => {
                if (!isOnScreen(o.pos, o.radius + 10)) return;

                const pulse = Math.sin(pulseBase + o.pulsateOffset) * 2;
                const sparkleOffset = o.sparklePhase;

                // Tri-color scheme (Tech/Combat/Addon)
                const triColors = ['#22c55e', '#ef4444', '#a855f7']; // green, red, purple
                const currentColorIdx = Math.floor(sparkleOffset / 3) % 3;
                const mainColor = triColors[currentColorIdx];

                // Subtle outer glow
                ctx.save();
                ctx.globalAlpha = 0.25;
                ctx.fillStyle = mainColor;
                ctx.shadowColor = mainColor;
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.arc(o.pos.x, o.pos.y, o.radius + pulse + 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();

                // Main orb - white core
                ctx.strokeStyle = mainColor;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(o.pos.x, o.pos.y, o.radius + pulse, 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.fill();

                // Just 3 sparkle points (one of each color), smaller
                for (let i = 0; i < 3; i++) {
                    const angle = sparkleOffset * 0.5 + (i * Math.PI * 2 / 3);
                    const sparkleRadius = o.radius + 6 + Math.sin(sparkleOffset + i) * 2;
                    const sx = o.pos.x + Math.cos(angle) * sparkleRadius;
                    const sy = o.pos.y + Math.sin(angle) * sparkleRadius;

                    ctx.fillStyle = triColors[i];
                    ctx.globalAlpha = 0.5;
                    ctx.beginPath();
                    ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.globalAlpha = 1.0;
            });

            // Asteroids
            asteroidsRef.current.forEach(a => {
                if (!isOnScreen(a.pos, a.radius + 50)) return; // Skip offscreen (extra buffer for aura)

                ctx.save();
                ctx.translate(a.pos.x, a.pos.y);
                ctx.rotate(a.rotation);

                if (a.type === EntityType.FrozenAsteroid) {
                    const frozenCfg = ASTEROID_TYPES.FROZEN;
                    const sizeScale = frozenCfg.auraSizeScale || 0;
                    const sizeBonus = 1 + (a.sizeCategory - 1) * sizeScale;
                    const auraRadius = ((frozenCfg.auraRange || 120) * sizeBonus) + a.radius;

                    ctx.save();
                    ctx.rotate(-a.rotation);
                    ctx.strokeStyle = frozenCfg.color;
                    ctx.lineWidth = 2 + Math.sin(frameCountRef.current * 0.1);
                    ctx.globalAlpha = 0.5 + Math.sin(frameCountRef.current * 0.05) * 0.3;
                    ctx.beginPath();
                    ctx.arc(0, 0, auraRadius, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.restore();
                }

                // Molten burn aura - fiery orange ring
                if (a.type === EntityType.MoltenAsteroid) {
                    const moltenCfg = ASTEROID_TYPES.MOLTEN;
                    if (moltenCfg.hasAura && moltenCfg.auraRange) {
                        const sizeScale = moltenCfg.auraSizeScale || 0;
                        const sizeBonus = 1 + (a.sizeCategory - 1) * sizeScale;
                        const auraRadius = (moltenCfg.auraRange * sizeBonus) + a.radius;

                        ctx.save();
                        ctx.rotate(-a.rotation);

                        // Fiery glow effect
                        const flicker = Math.sin(frameCountRef.current * 0.15) * 0.2;
                        ctx.strokeStyle = '#ff4500'; // Orange-red
                        ctx.lineWidth = 3 + Math.sin(frameCountRef.current * 0.2) * 2;
                        ctx.globalAlpha = 0.4 + flicker;
                        ctx.beginPath();
                        ctx.arc(0, 0, auraRadius, 0, Math.PI * 2);
                        ctx.stroke();

                        // Inner heat ring
                        ctx.strokeStyle = '#ff6600';
                        ctx.lineWidth = 1.5;
                        ctx.globalAlpha = 0.3 + flicker * 0.5;
                        ctx.beginPath();
                        ctx.arc(0, 0, auraRadius - 5, 0, Math.PI * 2);
                        ctx.stroke();

                        ctx.restore();
                    }
                }

                // Tungsten gravity aura - dark brown with vibrating space-bending effect
                if (a.type === EntityType.TungstenAsteroid) {
                    const tungstenCfg = ASTEROID_TYPES.TUNGSTEN;
                    if (tungstenCfg.hasGravityAura && tungstenCfg.gravityRange) {
                        const sizeScale = tungstenCfg.gravitySizeScale || 0;
                        const sizeBonus = 1 + (a.sizeCategory - 1) * sizeScale;
                        const gravityRadius = (tungstenCfg.gravityRange * sizeBonus) + a.radius;

                        ctx.save();
                        ctx.rotate(-a.rotation);

                        // Vibrating space-bending effect - multiple rings that oscillate
                        const time = frameCountRef.current * 0.08;
                        const baseColor = '#6b4f3a'; // Warm brown glow

                        for (let i = 0; i < 4; i++) {
                            // Each ring pulses inward at staggered speeds
                            const ringPhase = (time + i * 0.25) % 1;
                            const ringRadius = gravityRadius * (1 - ringPhase * 0.4);
                            const ringAlpha = (1 - ringPhase) * 0.2;

                            // Vibrating line width for space-bending effect
                            const vibrate = Math.sin(frameCountRef.current * 0.3 + i * 1.5) * 1.5;
                            const lineWidth = 2 + Math.abs(vibrate);

                            ctx.strokeStyle = baseColor;
                            ctx.lineWidth = lineWidth;
                            ctx.globalAlpha = ringAlpha;
                            ctx.beginPath();
                            ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
                            ctx.stroke();
                        }

                        // Inner distortion ring - extra vibrating effect
                        const innerVibrate = Math.sin(frameCountRef.current * 0.5) * 3;
                        ctx.strokeStyle = '#4a3728';
                        ctx.lineWidth = 3 + Math.abs(innerVibrate);
                        ctx.globalAlpha = 0.3 + Math.sin(frameCountRef.current * 0.15) * 0.1;
                        ctx.beginPath();
                        ctx.arc(0, 0, a.radius * 1.8 + innerVibrate, 0, Math.PI * 2);
                        ctx.stroke();

                        ctx.restore();
                    }
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
                        const isSpecial = a.type === EntityType.MoltenAsteroid || a.type === EntityType.FrozenAsteroid || a.type === EntityType.IronAsteroid || a.type === EntityType.TungstenAsteroid;
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
                    const isTungsten = a.type === EntityType.TungstenAsteroid;
                    const isSpecial = isMolten || isFrozen || isIron || isTungsten;

                    // Tungsten gets vibrating line width for space-bending effect
                    const vibrateAmount = isTungsten ? Math.sin(frameCountRef.current * 0.4) * 2 : 0;
                    const outerWidth = (isSpecial ? 5 : 4) + vibrateAmount;
                    const innerWidth = (isSpecial ? 2 : 1.5) + vibrateAmount * 0.5;

                    drawPath(isSpecial ? 2.5 : 1.5);
                    ctx.strokeStyle = a.color;
                    ctx.lineWidth = outerWidth;
                    ctx.globalAlpha = 0.4;
                    ctx.stroke();

                    drawPath(isSpecial ? 1.0 : 0.5);
                    ctx.strokeStyle = isMolten ? '#fff5f5' : isFrozen ? '#e0f2fe' : isIron ? '#fcd34d' : isTungsten ? '#8b7355' : '#ffffff';
                    ctx.lineWidth = innerWidth;
                    ctx.globalAlpha = 1.0;
                    ctx.stroke();

                    if (isSpecial) {
                        ctx.fillStyle = a.color;
                        ctx.globalAlpha = isIron ? 0.6 : isTungsten ? 0.5 : 0.3;
                        ctx.fill();
                    }
                }

                // (Fracture line rendering removed - the position offset + shockwave gives better breaking feel)

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
                    let isHeavy = ship.stats.droneDamageMult > 1.0; // Overclocked drones deal more damage
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

                    const frozenShipColor = ASTEROID_TYPES.FROZEN.color;
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = ship.isFrozen ? frozenShipColor : COLORS.SHIP;
                    ctx.strokeStyle = ship.isFrozen ? frozenShipColor : COLORS.SHIP;
                    ctx.lineWidth = 2;

                    ctx.beginPath();
                    ctx.moveTo(ship.radius, 0);
                    ctx.lineTo(-ship.radius * 0.6, ship.radius * 0.75);
                    ctx.lineTo(-ship.radius * 0.3, 0);
                    ctx.lineTo(-ship.radius * 0.6, -ship.radius * 0.75);
                    ctx.closePath();
                    ctx.stroke();

                    if (ship.isFrozen) {
                        ctx.fillStyle = frozenShipColor;
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

                    // Shield Radiation Aura Visual - unified style with asteroid auras (no dotted line)
                    if (ship.stats.shieldRadiationTier > 0 && ship.stats.shieldCharges > 0) {
                        const radiationRadius = SHIELD_RADIATION_BASE_RADIUS + (ship.stats.shieldRadiationTier * SHIELD_RADIATION_RADIUS_PER_TIER);
                        const pulseIntensity = 0.4 + Math.sin(frameCountRef.current * 0.08) * 0.2;
                        const pulseWidth = 2 + Math.sin(frameCountRef.current * 0.12) * 1;

                        ctx.save();
                        ctx.strokeStyle = '#a855f7'; // Purple radiation
                        ctx.lineWidth = pulseWidth + ship.stats.shieldRadiationTier * 0.3;
                        ctx.globalAlpha = pulseIntensity;
                        ctx.beginPath();
                        ctx.arc(ship.pos.x, ship.pos.y, radiationRadius, 0, Math.PI * 2);
                        ctx.stroke();
                        ctx.restore();
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
                isSandbox={isSandbox}
                showDamageNumbers={showDamageNumbers}
                startLevel={startLevel}
                deathReason={deathReason}
                isFreebie={isFreebie}
                xpBarRef={levelBarRef}
                hullBarRef={hullBarRef}
                shieldBarRef={shieldBarRef}
                shieldTextRef={shieldTextRef}
                hullTextRef={hullTextRef}
                xpTextRef={xpTextRef}
                regenTextRef={regenTextRef}
                onStartGame={initGame}
                onToggleDevMode={() => setIsDevMode(!isDevMode)}
                onToggleSandbox={() => setIsSandbox(!isSandbox)}
                onToggleDamageNumbers={() => {
                    const newValue = !showDamageNumbers;
                    setShowDamageNumbers(newValue);
                    showDamageNumbersRef.current = newValue;
                }}
                onSetStartLevel={setStartLevel}
                onSelectUpgrade={applyUpgrade}
            />
        </div>
    );
};

export default AsteroidsGame;
