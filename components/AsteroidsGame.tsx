import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Asteroid, Bullet, EntityType, GameState, Particle, Ship, FuelOrb, HullOrb, GoldOrb, Vector, Drone, UpgradeCategory, UpgradeDef, Entity
} from '../types';
import { 
  SHIP_SIZE, SHIP_THRUST, SHIP_TURN_SPEED, SHIP_FRICTION, SHIP_MAX_SPEED, SHIP_BASE_HULL,
  BULLET_SPEED, BULLET_LIFE, BULLET_RATE, BULLET_DAMAGE,
  ASTEROID_SPEED_BASE, MOLTEN_SPEED_MULTIPLIER, ASTEROID_HULL_DAMAGE, ASTEROID_SMALL_DAMAGE,
  FUEL_DECAY_ON_THRUST, FUEL_DECAY_PASSIVE, FUEL_ORB_VALUE, PARTICLE_COUNT_EXPLOSION, COLORS, FUEL_ORB_LIFE, FUEL_DROP_CHANCE,
  HULL_ORB_VALUE, HULL_DROP_CHANCE, GOLD_ORB_VALUE, DROP_CONVERSION_THRESHOLD,
  HIT_FLASH_FRAMES, SCREEN_SHAKE_DECAY,
  UPGRADES, XP_BASE_REQ, XP_SCALING_FACTOR,
  LEVEL_GATE_LARGE_ASTEROIDS, LEVEL_GATE_MOLTEN_SMALL, LEVEL_GATE_MOLTEN_LARGE, FORMATION_CHANCE,
  LEVEL_GATE_FROZEN, FROZEN_HP, FROZEN_SPEED, FROZEN_COLOR, FROZEN_AURA_RANGE, FROZEN_AURA_DAMAGE
} from '../constants';

// --- Utility Functions ---
const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;

const createVector = (x: number, y: number): Vector => ({ x, y });

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
      { x: -ship.radius, y: ship.radius * 0.8 },      
      { x: -ship.radius, y: -ship.radius * 0.8 }      
  ];

  for (const p of points) {
      const wx = ship.pos.x + (p.x * cos - p.y * sin);
      const wy = ship.pos.y + (p.x * sin + p.y * cos);
      if (dist({x: wx, y: wy}, asteroid.pos) < hitRadius) return true;
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
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [xpTarget, setXpTarget] = useState(XP_BASE_REQ);
  const [deathReason, setDeathReason] = useState('');
  
  // Dev Mode State
  const [isDevMode, setIsDevMode] = useState(true);
  const [startLevel, setStartLevel] = useState(1);
  const [pendingUpgrades, setPendingUpgrades] = useState(0);
  
  // Level Up Choices
  const [offeredUpgrades, setOfferedUpgrades] = useState<UpgradeDef[]>([]);
  // Tracking current upgrades: Map<UpgradeID, Tier>
  const [activeUpgrades, setActiveUpgrades] = useState<Record<string, number>>({});

  // Game State Refs
  const shipRef = useRef<Ship | null>(null);
  const asteroidsRef = useRef<Asteroid[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const fuelOrbsRef = useRef<FuelOrb[]>([]);
  const hullOrbsRef = useRef<HullOrb[]>([]);
  const goldOrbsRef = useRef<GoldOrb[]>([]);
  const dronesRef = useRef<Drone[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);

  const inputRef = useRef({ up: false, left: false, right: false });
  const frameRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const screenShakeRef = useRef<number>(0);
  
  // Spawning Director Refs
  const spawnTimerRef = useRef<number>(0); // Cooldown between individual spawns
  const moltenTimerRef = useRef<number>(0); // Cooldown for molten events
  const frozenTimerRef = useRef<number>(0); // Cooldown for frozen events

  // HUD DOM Refs
  const fuelBarRef = useRef<HTMLDivElement>(null);
  const hullBarRef = useRef<HTMLDivElement>(null);
  const scoreElRef = useRef<HTMLDivElement>(null);
  const levelBarRef = useRef<HTMLDivElement>(null);

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
      fuel: 100,
      maxFuel: 100,
      hull: SHIP_BASE_HULL,
      maxHull: SHIP_BASE_HULL,
      invulnerableUntil: Date.now() + 2000,
      stats: {
        fuelEfficiency: 1.0,
        fuelRecoveryMult: 1.0,
        thrustMult: 1.0,
        speedMult: 1.0,
        maxFuelMult: 1.0,
        maxHullMult: 1.0,
        fireRateMult: 1.0,
        bulletSpeedMult: 1.0,
        pickupRange: 50,
        shieldCharges: 0,
        maxShieldCharges: 0,
        droneCount: 0,
        multishotTier: 0,
        xpMult: 1.0
      }
    };

    asteroidsRef.current = [];
    bulletsRef.current = [];
    particlesRef.current = [];
    fuelOrbsRef.current = [];
    hullOrbsRef.current = [];
    goldOrbsRef.current = [];
    dronesRef.current = [];
    floatingTextsRef.current = [];
    
    setScore(0);
    setActiveUpgrades({});
    spawnTimerRef.current = 60; 
    moltenTimerRef.current = 600; 
    frozenTimerRef.current = 900;
    
    // Dev Mode Initialization
    const initialLevel = isDevMode ? startLevel : 1;
    setLevel(initialLevel);
    
    // Recalculate XP Target for the selected level
    let target = XP_BASE_REQ;
    for(let i = 1; i < initialLevel; i++) {
        target = Math.floor(target * XP_SCALING_FACTOR + 1000);
    }
    setXpTarget(target);

    // Setup pending upgrades
    if (initialLevel > 1) {
        setPendingUpgrades(initialLevel - 1);
        prepareLevelUp(true); // Trigger first upgrade
    } else {
        setPendingUpgrades(0);
        setGameState(GameState.PLAYING);
    }

  }, [startLevel, isDevMode]);

  const getWeightedAsteroidSize = (currentLevel: number): 1 | 2 | 3 => {
      const rand = Math.random();
      if (currentLevel < LEVEL_GATE_LARGE_ASTEROIDS) {
          // Level 1: 70% Small, 30% Medium
          return rand > 0.7 ? 2 : 1;
      } else {
          // Scaling probability for Large asteroids
          const largeChance = Math.min(0.4, (currentLevel - 1) * 0.05);
          const mediumChance = 0.4;
          if (rand < largeChance) return 3;
          if (rand < largeChance + mediumChance) return 2;
          return 1;
      }
  };

  const spawnAsteroidFormation = (cw: number, ch: number, currentLevel: number) => {
      // Pick a side to spawn from
      const edge = Math.floor(Math.random() * 4);
      // Increased buffer so wide formations spawn fully off-screen before entering
      const buffer = 200; 
      let startPos = {x:0, y:0};
      
      // Determine center point of formation
      switch(edge) {
          case 0: startPos = { x: cw/2, y: -buffer }; break; // Top
          case 1: startPos = { x: cw + buffer, y: ch/2 }; break; // Right
          case 2: startPos = { x: cw/2, y: ch + buffer }; break; // Bottom
          case 3: startPos = { x: -buffer, y: ch/2 }; break; // Left
      }

      // Add randomness to start point along the edge, keeping away from corners to avoid clipping immediately
      if(edge === 0 || edge === 2) startPos.x = randomRange(200, cw - 200);
      else startPos.y = randomRange(200, ch - 200);

      // Aim towards general center of screen
      const centerX = cw / 2 + randomRange(-150, 150);
      const centerY = ch / 2 + randomRange(-150, 150);
      const angle = Math.atan2(centerY - startPos.y, centerX - startPos.x);
      
      const speedMult = 1 + (currentLevel * 0.05);
      const speed = ASTEROID_SPEED_BASE * speedMult;
      const vel = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
      
      // Formation vector (perpendicular to velocity)
      const perpAngle = angle + Math.PI / 2;
      const px = Math.cos(perpAngle);
      const py = Math.sin(perpAngle);
      
      const formationType = Math.random() < 0.5 ? 'LINE' : 'V_SHAPE';
      
      // Logic for spacing: Must prevent overlap and cover area
      const sizeCat = getWeightedAsteroidSize(currentLevel); 
      const radius = sizeCat === 3 ? 65 : sizeCat === 2 ? 35 : 18;
      
      // Minimum spacing is Diameter (2*r) + Gap (e.g. 50px).
      // We want them spread out, so let's add considerable gap (80-150px)
      const gap = randomRange(80, 150);
      const spacing = (radius * 2) + gap;

      // Count: Ensure enough asteroids to make the formation threatening given the wide spacing
      // 3 to 5 asteroids
      const count = 3 + Math.floor(Math.random() * 3); 

      for(let i=0; i<count; i++) {
          let offset = 0;
          let forwardOffset = 0;
          
          if (formationType === 'LINE') {
              offset = (i - (count-1)/2) * spacing;
              // Slight organic stagger for lines
              forwardOffset = randomRange(-30, 30);
          } else {
              // V-Shape
              const side = i % 2 === 0 ? 1 : -1;
              const idx = Math.ceil(i/2);
              offset = idx * spacing * side;
              forwardOffset = -Math.abs(idx * (spacing * 0.5)); // Deep V
          }

          const pos = {
              x: startPos.x + (px * offset) + (Math.cos(angle) * forwardOffset),
              y: startPos.y + (py * offset) + (Math.sin(angle) * forwardOffset)
          };

          createAsteroid(pos, vel, sizeCat);
      }
  };

  const createAsteroid = (pos: Vector, vel: Vector, sizeCat: 1 | 2 | 3) => {
      const radius = sizeCat === 3 ? 65 : sizeCat === 2 ? 35 : 18;
      const hpBase = sizeCat === 3 ? 150 : sizeCat === 2 ? 50 : 20; 
      const hp = hpBase * (1 + (level - 1) * 0.1);
      
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
      
      // Pick random spot off screen
      const buffer = 80;
      let pos = { x: 0, y: 0 };
      if (Math.random() < 0.5) {
          pos = { x: Math.random() < 0.5 ? -buffer : cw + buffer, y: Math.random() * ch };
      } else {
          pos = { x: Math.random() * cw, y: Math.random() < 0.5 ? -buffer : ch + buffer };
      }

      // Aim generally inward
      const centerX = cw / 2;
      const centerY = ch / 2;
      const angle = Math.atan2(centerY - pos.y, centerX - pos.x) + (Math.random() - 0.5) * 1.5;
      const vel = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };

      createAsteroid(pos, vel, sizeCat);
  };

  const spawnMoltenFlyby = (cw: number, ch: number, currentLevel: number) => {
      const edge = Math.floor(Math.random() * 4); 
      let pos = { x: 0, y: 0 };
      let target = { x: 0, y: 0 };
      const offset = 120;

      switch(edge) {
          case 0: pos = { x: Math.random() * cw, y: -offset }; target = { x: Math.random() * cw, y: ch + offset }; break;
          case 1: pos = { x: cw + offset, y: Math.random() * ch }; target = { x: -offset, y: Math.random() * ch }; break;
          case 2: pos = { x: Math.random() * cw, y: ch + offset }; target = { x: Math.random() * cw, y: -offset }; break;
          case 3: pos = { x: -offset, y: Math.random() * ch }; target = { x: cw + offset, y: Math.random() * ch }; break;
      }

      const angle = Math.atan2(target.y - pos.y, target.x - pos.x) + (Math.random() - 0.5) * 0.2; // Accurate targeting
      
      let sizeCat: 2 | 3 = 2;
      // Only spawn giant molten ones at higher levels
      if (currentLevel >= LEVEL_GATE_MOLTEN_LARGE) {
           sizeCat = Math.random() < 0.4 ? 3 : 2; 
      }

      const radius = sizeCat === 3 ? 75 : 35;
      const hp = sizeCat === 3 ? 250 : 80;
      const speedMult = (sizeCat === 3 ? MOLTEN_SPEED_MULTIPLIER * 0.8 : MOLTEN_SPEED_MULTIPLIER) * (1 + currentLevel * 0.05);
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
          rotationSpeed: randomRange(-0.01, 0.01),
          pulsateOffset: Math.random() * Math.PI * 2
      });
  };

  const spawnFrozenAsteroid = (cw: number, ch: number, currentLevel: number) => {
      // Similar to Molten but slow
      const edge = Math.floor(Math.random() * 4); 
      let pos = { x: 0, y: 0 };
      let target = { x: 0, y: 0 };
      const offset = 120;

      switch(edge) {
          case 0: pos = { x: Math.random() * cw, y: -offset }; target = { x: Math.random() * cw, y: ch + offset }; break;
          case 1: pos = { x: cw + offset, y: Math.random() * ch }; target = { x: -offset, y: Math.random() * ch }; break;
          case 2: pos = { x: Math.random() * cw, y: ch + offset }; target = { x: Math.random() * cw, y: -offset }; break;
          case 3: pos = { x: -offset, y: Math.random() * ch }; target = { x: cw + offset, y: Math.random() * ch }; break;
      }

      const angle = Math.atan2(target.y - pos.y, target.x - pos.x) + (Math.random() - 0.5) * 0.5;
      const speed = FROZEN_SPEED;
      const radius = 60; // Big
      
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

  const spawnParticles = (pos: Vector, color: string, count: number, speed = 2) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const v = Math.random() * speed;
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
        decay: 0.02 + Math.random() * 0.03,
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

  const spawnFuelOrb = (pos: Vector) => {
    // Check if player stats warrant a Gold Orb instead
    if (shipRef.current && shipRef.current.fuel >= shipRef.current.maxFuel * DROP_CONVERSION_THRESHOLD) {
        spawnGoldOrb(pos);
        return;
    }

    fuelOrbsRef.current.push({
      id: Math.random().toString(),
      type: EntityType.FuelOrb,
      pos: { ...pos },
      vel: { x: (Math.random() - 0.5) * 0.5, y: (Math.random() - 0.5) * 0.5 },
      radius: 8,
      angle: 0,
      color: COLORS.FUEL,
      toBeRemoved: false,
      life: FUEL_ORB_LIFE,
      pulsateOffset: Math.random() * Math.PI,
    });
  };

  const spawnHullOrb = (pos: Vector) => {
    // Check if player stats warrant a Gold Orb instead
    if (shipRef.current && shipRef.current.hull >= shipRef.current.maxHull * DROP_CONVERSION_THRESHOLD) {
        spawnGoldOrb(pos);
        return;
    }

    hullOrbsRef.current.push({
      id: Math.random().toString(),
      type: EntityType.HullOrb,
      pos: { ...pos },
      vel: { x: (Math.random() - 0.5) * 0.5, y: (Math.random() - 0.5) * 0.5 },
      radius: 8,
      angle: 0,
      color: COLORS.HULL,
      toBeRemoved: false,
      life: FUEL_ORB_LIFE,
      pulsateOffset: Math.random() * Math.PI,
    });
  };

  const spawnGoldOrb = (pos: Vector) => {
    goldOrbsRef.current.push({
      id: Math.random().toString(),
      type: EntityType.GoldOrb,
      pos: { ...pos },
      vel: { x: (Math.random() - 0.5) * 0.5, y: (Math.random() - 0.5) * 0.5 },
      radius: 10,
      angle: 0,
      color: COLORS.GOLD,
      toBeRemoved: false,
      life: FUEL_ORB_LIFE,
      pulsateOffset: Math.random() * Math.PI,
    });
  };

  const prepareLevelUp = (isDevSequence = false) => {
      setGameState(GameState.LEVEL_UP);
      
      if (isDevMode) {
          // In Dev Mode, show ALL upgrades
          setOfferedUpgrades(UPGRADES);
      } else {
          // Normal logic
          const green = UPGRADES.filter(u => u.category === UpgradeCategory.TECH);
          const red = UPGRADES.filter(u => u.category === UpgradeCategory.COMBAT);
          const purple = UPGRADES.filter(u => u.category === UpgradeCategory.ADDONS);
          
          const selection = [
              green[Math.floor(Math.random() * green.length)],
              red[Math.floor(Math.random() * red.length)],
              purple[Math.floor(Math.random() * purple.length)],
          ];
          setOfferedUpgrades(selection);
      }
  };

  const checkLevelUp = (currentScore: number) => {
      if (currentScore >= xpTarget) {
          prepareLevelUp();
      }
  };

  const applyUpgrade = (upgrade: UpgradeDef) => {
      const newActive = { ...activeUpgrades };
      const currentTier = (newActive[upgrade.id] || 0) + 1;
      newActive[upgrade.id] = currentTier;
      setActiveUpgrades(newActive);

      if (shipRef.current) {
          const s = shipRef.current.stats;
          
          switch(upgrade.id) {
              case 'engine': 
                  s.thrustMult = 1.0 + (currentTier * 0.25);
                  s.speedMult = 1.0 + (currentTier * 0.25);
                  break;
              case 'tank': 
                  s.maxFuelMult = 1.0 + (currentTier * 0.40); 
                  s.fuelEfficiency = Math.max(0.1, 1.0 - (currentTier * 0.15)); 
                  s.fuelRecoveryMult = 1.0 + (currentTier * 0.20); 
                  shipRef.current.maxFuel = 100 * s.maxFuelMult;
                  shipRef.current.fuel = shipRef.current.maxFuel; 
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
                          pos: { ...shipRef.current.pos }, vel: {x:0,y:0},
                          radius: 5, angle: 0, color: COLORS.DRONE, toBeRemoved: false,
                          targetId: null, orbitOffset: (Math.PI * 2 * dronesRef.current.length), lastShot: 0
                      });
                  }
                  dronesRef.current.forEach((d, i) => {
                      d.orbitOffset = (i / s.droneCount) * Math.PI * 2;
                  });
                  break;
              case 'magnet': s.pickupRange = 50 + (currentTier * 60); break;
              case 'shield': 
                  s.maxShieldCharges = currentTier; 
                  s.shieldCharges = currentTier; 
                  break;
              case 'scavenger': s.xpMult = 1.0 + (currentTier * 0.20); break;
          }

          // Passive Shield Recharge on ANY Level Up if module installed
          if (s.maxShieldCharges > 0) {
              s.shieldCharges = s.maxShieldCharges;
          }
      }

      if (pendingUpgrades > 0) {
          setPendingUpgrades(p => p - 1);
          // Stay in LEVEL_UP state, effectively refreshing the screen
      } else {
          setLevel(l => l + 1);
          setXpTarget(prev => Math.floor(prev * XP_SCALING_FACTOR + 1000)); 
          setGameState(GameState.PLAYING);
      }
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
        for(let i=0; i<5; i++) createAsteroid({x:Math.random()*canvas.width, y:Math.random()*canvas.height}, {x:Math.random()-0.5, y:Math.random()-0.5}, 3);
    }

    const loop = () => {
      frameCountRef.current++;
      const cw = canvas.width;
      const ch = canvas.height;
      
      // Update HUD
      if (shipRef.current) {
          if (fuelBarRef.current) {
              const pct = (shipRef.current.fuel / shipRef.current.maxFuel) * 100;
              fuelBarRef.current.style.width = `${pct}%`;
              if (shipRef.current.fuel < 20) {
                  fuelBarRef.current.classList.add('bg-red-500', 'animate-pulse');
                  fuelBarRef.current.classList.remove('bg-green-500');
              } else {
                  fuelBarRef.current.classList.remove('bg-red-500', 'animate-pulse');
                  fuelBarRef.current.classList.add('bg-green-500');
              }
          }
          if (hullBarRef.current) {
              const pct = (shipRef.current.hull / shipRef.current.maxHull) * 100;
              hullBarRef.current.style.width = `${pct}%`;
          }
      }
      if (scoreElRef.current) scoreElRef.current.innerText = score.toString().padStart(6, '0');
      if (levelBarRef.current) {
          const pct = Math.min(100, (score / xpTarget) * 100);
          levelBarRef.current.style.width = `${pct}%`;
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
             createAsteroid({x: cw+50, y: Math.random()*ch}, {x: -1, y: 0}, 3);
          }
      }

      const ship = shipRef.current;
      
      // --- LOGIC (Paused during LEVEL_UP) ---
      if (gameState === GameState.PLAYING && ship && !ship.toBeRemoved) {
        
        checkLevelUp(score);

        // --- SPAWNING DIRECTOR ---
        // 1. Maintain Target Density (Seamless Spawning)
        const targetDensity = 4 + Math.min(10, level); // Cap at 14 asteroids
        const activeAsteroids = asteroidsRef.current.filter(a => a.type === EntityType.Asteroid).length;
        
        if (activeAsteroids < targetDensity && spawnTimerRef.current <= 0) {
            // Chance to spawn Formation
            if (Math.random() < FORMATION_CHANCE && level >= 2) {
                spawnAsteroidFormation(cw, ch, level);
                spawnTimerRef.current = 180; // Longer delay after formation
            } else {
                spawnSingleAsteroid(cw, ch, level);
                spawnTimerRef.current = randomRange(30, 60); // Stagger single spawns
            }
        }
        if (spawnTimerRef.current > 0) spawnTimerRef.current--;

        // 2. Molten Threats (Smart Pacing)
        if (level >= LEVEL_GATE_MOLTEN_SMALL) {
            if (moltenTimerRef.current > 0) {
                moltenTimerRef.current--;
            } else {
                spawnMoltenFlyby(cw, ch, level);
                const minCooldown = Math.max(300, 900 - (level * 60)); 
                moltenTimerRef.current = minCooldown + randomRange(0, 300);
            }
        }

        // 3. Frozen Threats
        if (level >= LEVEL_GATE_FROZEN) {
            if (frozenTimerRef.current > 0) {
                frozenTimerRef.current--;
            } else {
                spawnFrozenAsteroid(cw, ch, level);
                frozenTimerRef.current = 1200; // Rare spawn
            }
        }

        // Apply Stats
        const stats = ship.stats;

        // Fuel
        ship.fuel = Math.max(0, ship.fuel - (FUEL_DECAY_PASSIVE * stats.fuelEfficiency));
        if (ship.fuel <= 0) handleGameOver("Life Support Failure");

        // Movement
        if (inputRef.current.left) ship.rotation -= SHIP_TURN_SPEED;
        if (inputRef.current.right) ship.rotation += SHIP_TURN_SPEED;

        if (inputRef.current.up && ship.fuel > 0) {
          const thrustPower = SHIP_THRUST * stats.thrustMult;
          ship.vel.x += Math.cos(ship.rotation) * thrustPower;
          ship.vel.y += Math.sin(ship.rotation) * thrustPower;
          ship.thrusting = true;
          ship.fuel = Math.max(0, ship.fuel - (FUEL_DECAY_ON_THRUST * stats.fuelEfficiency));
          if (frameCountRef.current % 3 === 0) {
             const exhaustPos = {
               x: ship.pos.x - Math.cos(ship.rotation) * ship.radius,
               y: ship.pos.y - Math.sin(ship.rotation) * ship.radius,
             };
             spawnParticles(exhaustPos, COLORS.SHIP_THRUST, 1, 3);
          }
        } else {
          ship.thrusting = false;
        }

        ship.vel.x *= SHIP_FRICTION;
        ship.vel.y *= SHIP_FRICTION;
        const currentSpeed = Math.sqrt(ship.vel.x**2 + ship.vel.y**2);
        const maxSpeed = SHIP_MAX_SPEED * stats.speedMult;
        
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

        // Shooting (Multishot Logic)
        const fireRate = Math.max(4, Math.floor(BULLET_RATE * stats.fireRateMult));
        if (frameCountRef.current % fireRate === 0) {
            const shotAngles = [];
            if (stats.multishotTier === 0) shotAngles.push(0);
            else if (stats.multishotTier === 1) shotAngles.push(-0.1, 0.1);
            else if (stats.multishotTier === 2) shotAngles.push(-0.2, 0, 0.2);
            else shotAngles.push(-0.3, -0.15, 0, 0.15, 0.3); // Penta-shot

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
            const baseOrbitSpeed = 0.02;
            const globalOrbit = frameCountRef.current * baseOrbitSpeed;
            
            dronesRef.current.forEach((drone, i) => {
                const angleOffset = (i / stats.droneCount) * Math.PI * 2;
                const currentAngle = globalOrbit + angleOffset;
                
                drone.pos.x = ship.pos.x + Math.cos(currentAngle) * 35;
                drone.pos.y = ship.pos.y + Math.sin(currentAngle) * 35;

                const droneFireRate = 30; 
                if (frameCountRef.current - drone.lastShot > droneFireRate) {
                    let nearest = null;
                    let minDist = 450; 
                    for(const a of asteroidsRef.current) {
                        const d = dist(drone.pos, a.pos);
                        if (d < minDist) {
                            minDist = d;
                            nearest = a;
                        }
                    }
                    if (nearest) {
                        const angle = Math.atan2(nearest.pos.y - drone.pos.y, nearest.pos.x - drone.pos.x);
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
                            life: BULLET_LIFE * 1.5, 
                            damage: BULLET_DAMAGE 
                        });
                        drone.lastShot = frameCountRef.current;
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

      // Asteroids
      asteroidsRef.current.forEach(a => {
        if (gameState !== GameState.LEVEL_UP) {
            a.pos.x += a.vel.x;
            a.pos.y += a.vel.y;
            a.rotation += a.rotationSpeed; 
            
            if (a.hitFlash > 0) a.hitFlash--;
            
            if (a.type === EntityType.MoltenAsteroid || a.type === EntityType.FrozenAsteroid) {
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

            // Frozen Aura
            if (a.type === EntityType.FrozenAsteroid && ship && !ship.toBeRemoved && gameState === GameState.PLAYING) {
                const d = dist(ship.pos, a.pos);
                if (d < FROZEN_AURA_RANGE) {
                    ship.hull -= FROZEN_AURA_DAMAGE;
                    if (frameCountRef.current % 30 === 0) {
                        spawnFloatingText(ship.pos, "-COLD", FROZEN_COLOR, 10);
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
                             handleGameOver("Hypothermia");
                         }
                    }
                }
            }
        }
      });

      // Orbs
      const updateOrb = (o: FuelOrb | HullOrb | GoldOrb, type: 'FUEL' | 'HULL' | 'GOLD') => {
        if (gameState !== GameState.LEVEL_UP) {
            if (gameState === GameState.PLAYING && ship && !ship.toBeRemoved) {
                const d = dist(o.pos, ship.pos);
                if (d < ship.stats.pickupRange) {
                    const angle = Math.atan2(ship.pos.y - o.pos.y, ship.pos.x - o.pos.x);
                    o.vel.x += Math.cos(angle) * 0.5;
                    o.vel.y += Math.sin(angle) * 0.5;
                }
            }

            o.pos.x += o.vel.x;
            o.pos.y += o.vel.y;
            o.vel.x *= 0.95; 
            o.vel.y *= 0.95;
            o.life--;
            if (o.life <= 0) o.toBeRemoved = true;
            if (o.pos.x < 0) o.pos.x = cw;
            if (o.pos.x > cw) o.pos.x = 0;
            if (o.pos.y < 0) o.pos.y = ch;
            if (o.pos.y > ch) o.pos.y = 0;
        }
      };
      fuelOrbsRef.current.forEach(o => updateOrb(o, 'FUEL'));
      hullOrbsRef.current.forEach(o => updateOrb(o, 'HULL'));
      goldOrbsRef.current.forEach(o => updateOrb(o, 'GOLD'));

      // Particles
      particlesRef.current.forEach(p => {
         if (gameState !== GameState.LEVEL_UP) {
            p.pos.x += p.vel.x;
            p.pos.y += p.vel.y;
            p.life -= p.decay;
            if (p.life <= 0) p.toBeRemoved = true;
         }
      });

      // Floating Texts
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
                        const ptVal = a.type === EntityType.MoltenAsteroid ? 1000 : a.type === EntityType.FrozenAsteroid ? 800 : 100 * a.sizeCategory;
                        
                        // XP Multiplier
                        setScore(s => s + Math.floor(ptVal * (ship?.stats.xpMult || 1)));
                        spawnParticles(a.pos, a.color, PARTICLE_COUNT_EXPLOSION, 6);
                        
                        // Split normal asteroids
                        if (a.type === EntityType.Asteroid && a.sizeCategory > 1) {
                            const newSize = (a.sizeCategory - 1) as 1 | 2;
                            createAsteroid({ ...a.pos }, {x: a.vel.x + randomRange(-0.5, 0.5), y: a.vel.y + randomRange(-0.5, 0.5)}, newSize);
                            createAsteroid({ ...a.pos }, {x: a.vel.x + randomRange(-0.5, 0.5), y: a.vel.y + randomRange(-0.5, 0.5)}, newSize);
                        }

                        // Loot Drops
                        const r = Math.random();
                        if (r < FUEL_DROP_CHANCE) spawnFuelOrb(a.pos);
                        else if (r < FUEL_DROP_CHANCE + HULL_DROP_CHANCE) spawnHullOrb(a.pos);
                    }
                }
            });
          });

          if (ship && !ship.toBeRemoved) {
              // Orbs Collection
              const collectOrb = (o: Entity, type: 'FUEL' | 'HULL' | 'GOLD') => {
                  o.toBeRemoved = true;
                  let val = 0;
                  
                  if (type === 'FUEL') {
                      val = FUEL_ORB_VALUE * ship.stats.fuelRecoveryMult;
                      ship.fuel = Math.min(ship.maxFuel, ship.fuel + val);
                      spawnFloatingText(ship.pos, `+${Math.round(val)} FUEL`, COLORS.FUEL);
                      setScore(s => s + Math.floor(50 * ship.stats.xpMult));
                  } else if (type === 'HULL') {
                      ship.hull = Math.min(ship.maxHull, ship.hull + HULL_ORB_VALUE);
                      spawnFloatingText(ship.pos, `+${HULL_ORB_VALUE} HULL`, COLORS.HULL);
                      setScore(s => s + Math.floor(50 * ship.stats.xpMult));
                  } else {
                      val = GOLD_ORB_VALUE * ship.stats.fuelRecoveryMult; // Reusing pickup mult
                      setScore(s => s + Math.floor(val * ship.stats.xpMult));
                      spawnFloatingText(ship.pos, `+${Math.floor(val)} XP`, COLORS.GOLD);
                  }
              };

              fuelOrbsRef.current.forEach(o => { if(!o.toBeRemoved && dist(ship.pos, o.pos) < ship.radius + o.radius) collectOrb(o, 'FUEL'); });
              hullOrbsRef.current.forEach(o => { if(!o.toBeRemoved && dist(ship.pos, o.pos) < ship.radius + o.radius) collectOrb(o, 'HULL'); });
              goldOrbsRef.current.forEach(o => { if(!o.toBeRemoved && dist(ship.pos, o.pos) < ship.radius + o.radius) collectOrb(o, 'GOLD'); });

              // Ship Collisions
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
                             screenShakeRef.current = 6;
                             if (a.sizeCategory === 1) {
                                 a.toBeRemoved = true;
                                 spawnParticles(a.pos, a.color, 10, 4);
                                 ship.hull -= ASTEROID_SMALL_DAMAGE;
                                 setScore(s => s + 50);
                                 spawnFloatingText(ship.pos, `-${ASTEROID_SMALL_DAMAGE} HP`, COLORS.TEXT, 12);
                             } else {
                                 const angle = Math.atan2(ship.pos.y - a.pos.y, ship.pos.x - a.pos.x);
                                 const pushForce = 9;
                                 ship.vel.x += Math.cos(angle) * pushForce;
                                 ship.vel.y += Math.sin(angle) * pushForce;
                                 ship.hull -= ASTEROID_HULL_DAMAGE;
                                 if (a.type !== EntityType.FrozenAsteroid) a.hitFlash = HIT_FLASH_FRAMES;
                                 spawnParticles(ship.pos, COLORS.SHIP, 15, 6);
                                 ship.invulnerableUntil = Date.now() + 300;
                                 spawnFloatingText(ship.pos, `-${ASTEROID_HULL_DAMAGE} HP`, '#ff0000', 16);
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
      fuelOrbsRef.current = fuelOrbsRef.current.filter(e => !e.toBeRemoved);
      hullOrbsRef.current = hullOrbsRef.current.filter(e => !e.toBeRemoved);
      goldOrbsRef.current = goldOrbsRef.current.filter(e => !e.toBeRemoved);

      // --- RENDER ---
      
      particlesRef.current.forEach(p => {
          ctx.globalAlpha = p.life;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1.0;
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
      
      fuelOrbsRef.current.forEach(o => drawOrb(o, COLORS.FUEL));
      hullOrbsRef.current.forEach(o => drawOrb(o, COLORS.HULL));
      goldOrbsRef.current.forEach(o => {
           drawOrb(o, COLORS.GOLD);
           ctx.fillStyle = COLORS.GOLD; ctx.globalAlpha = 0.5; ctx.fill(); ctx.globalAlpha = 1;
      });
      ctx.shadowBlur = 0;

      // Asteroids
      asteroidsRef.current.forEach(a => {
          ctx.save();
          ctx.translate(a.pos.x, a.pos.y);
          ctx.rotate(a.rotation);

          // Render Aura for Frozen
          if (a.type === EntityType.FrozenAsteroid) {
              ctx.save();
              ctx.rotate(-a.rotation); // Keep aura static relative to spin
              ctx.strokeStyle = FROZEN_COLOR;
              // Make aura stand out more
              ctx.lineWidth = 2 + Math.sin(frameCountRef.current * 0.1); 
              ctx.globalAlpha = 0.5 + Math.sin(frameCountRef.current * 0.05) * 0.3;
              ctx.beginPath();
              ctx.arc(0, 0, FROZEN_AURA_RANGE, 0, Math.PI*2);
              ctx.stroke();
              ctx.restore();
          }

          // 1. Occlusion Fill
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
                  const isMoltenOrFrozen = a.type === EntityType.MoltenAsteroid || a.type === EntityType.FrozenAsteroid;
                  const v0 = a.vertices[0];
                  ctx.moveTo(v0.x + (isMoltenOrFrozen ? randomRange(-jitter, jitter) : 0), v0.y + (isMoltenOrFrozen ? randomRange(-jitter, jitter) : 0));
                  for (let i = 1; i < a.vertices.length; i++) {
                      ctx.lineTo(a.vertices[i].x + (isMoltenOrFrozen ? randomRange(-jitter, jitter) : 0), a.vertices[i].y + (isMoltenOrFrozen ? randomRange(-jitter, jitter) : 0));
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
             const isSpecial = isMolten || isFrozen;

             // Pass 1: Glow / Beam
             drawPath(isSpecial ? 2.5 : 1.5); 
             ctx.strokeStyle = a.color;
             ctx.lineWidth = isSpecial ? 5 : 4;
             ctx.globalAlpha = 0.4;
             ctx.stroke();

             // Pass 2: Core
             drawPath(isSpecial ? 1.0 : 0.5); 
             ctx.strokeStyle = isMolten ? '#fff5f5' : isFrozen ? '#e0f2fe' : '#ffffff';
             ctx.lineWidth = isSpecial ? 2 : 1.5;
             ctx.globalAlpha = 1.0;
             ctx.stroke();
             
             if (isSpecial) {
                 // Molten/Frozen inner fill (Cleaned up: Removed the chaotic lines loop)
                 ctx.fillStyle = a.color;
                 ctx.globalAlpha = 0.3; 
                 ctx.fill(); 
             }
          }
          
          ctx.restore();
      });
      ctx.shadowBlur = 0;

      // Ship
      if (gameState === GameState.PLAYING && ship && !ship.toBeRemoved) {
          let shouldDraw = true;
          if (ship.invulnerableUntil > Date.now()) if (Math.floor(Date.now() / 100) % 2 === 0) shouldDraw = false;

          if (shouldDraw) {
              ctx.save();
              ctx.translate(ship.pos.x, ship.pos.y);
              ctx.rotate(ship.rotation);
              
              ctx.shadowBlur = 10;
              ctx.shadowColor = COLORS.SHIP;
              ctx.strokeStyle = COLORS.SHIP;
              ctx.lineWidth = 2;

              ctx.beginPath();
              ctx.moveTo(ship.radius, 0);       
              ctx.lineTo(-ship.radius, ship.radius * 0.8); 
              ctx.lineTo(-ship.radius, -ship.radius * 0.8); 
              ctx.closePath();
              ctx.stroke();

              if (ship.thrusting) {
                  ctx.fillStyle = COLORS.SHIP_THRUST;
                  ctx.shadowColor = COLORS.SHIP_THRUST;
                  ctx.shadowBlur = 20;
                  ctx.beginPath();
                  ctx.moveTo(-ship.radius, ship.radius * 0.5);
                  ctx.lineTo(-ship.radius - 15, 0); 
                  ctx.lineTo(-ship.radius, -ship.radius * 0.5);
                  ctx.fill();
              }
              ctx.restore();

              // Draw Shield
              if (ship.stats.shieldCharges > 0) {
                  ctx.strokeStyle = COLORS.SHIELD;
                  ctx.shadowColor = COLORS.SHIELD;
                  ctx.shadowBlur = 10 + Math.sin(frameCountRef.current * 0.2) * 5;
                  ctx.lineWidth = 2;
                  ctx.beginPath();
                  ctx.arc(ship.pos.x, ship.pos.y, ship.radius + 10, 0, Math.PI * 2);
                  ctx.stroke();
                  for(let i=0; i<ship.stats.shieldCharges; i++) {
                       const angle = Date.now() / 1000 + (i * (Math.PI*2)/ship.stats.shieldCharges);
                       const cx = ship.pos.x + Math.cos(angle) * (ship.radius + 10);
                       const cy = ship.pos.y + Math.sin(angle) * (ship.radius + 10);
                       ctx.fillStyle = COLORS.SHIELD;
                       ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI*2); ctx.fill();
                  }
                  ctx.shadowBlur = 0;
              }
          }

          // Draw Drones
          dronesRef.current.forEach(d => {
              ctx.fillStyle = COLORS.DRONE;
              ctx.shadowColor = COLORS.DRONE;
              ctx.shadowBlur = 10;
              ctx.beginPath();
              ctx.arc(d.pos.x, d.pos.y, d.radius, 0, Math.PI * 2);
              ctx.fill();
              
              // Tether line for visual clarity
              ctx.strokeStyle = COLORS.DRONE;
              ctx.lineWidth = 0.5;
              ctx.globalAlpha = 0.3;
              ctx.beginPath();
              ctx.moveTo(ship.pos.x, ship.pos.y);
              ctx.lineTo(d.pos.x, d.pos.y);
              ctx.stroke();
              ctx.globalAlpha = 1.0;
          });
          ctx.shadowBlur = 0;
      }
      
      // Render Floating Texts
      floatingTextsRef.current.forEach(t => {
          ctx.fillStyle = t.color;
          ctx.font = `bold ${t.size}px Orbitron`;
          ctx.fillText(t.text, t.pos.x, t.pos.y);
      });

      ctx.restore(); 
      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(frameRef.current);
    };
  }, [gameState, initGame, score, xpTarget, level, pendingUpgrades, isDevMode]); 

  return (
    <div className="relative w-full h-full bg-black">
      <canvas ref={canvasRef} className="block w-full h-full" />
      
      {/* UI Overlay */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        {/* Progress Bar (Visible Always) */}
        {gameState === GameState.PLAYING && (
            <div className="absolute top-0 left-0 w-full h-2 bg-gray-900 z-50">
                <div 
                    ref={levelBarRef}
                    className="h-full bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)] transition-all duration-300"
                    style={{width: '0%'}}
                ></div>
                <div className="absolute top-3 left-1/2 -translate-x-1/2 text-yellow-500 text-xs font-bold tracking-[0.2em] font-orbitron">
                    LEVEL {level}
                </div>
            </div>
        )}

        {gameState === GameState.PLAYING && (
          <div className="p-6 mt-4 flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                   <div className="w-24 text-cyan-400 font-bold font-orbitron text-sm">SCORE</div>
                   <div ref={scoreElRef} className="text-white text-xl tracking-widest font-mono">000000</div>
                </div>
                <div className="flex items-center gap-2">
                   <div className="w-24 text-green-400 font-bold font-orbitron text-sm">FUEL</div>
                   <div className="w-48 h-3 border border-green-900 bg-gray-900/50 rounded-sm relative overflow-hidden">
                      <div ref={fuelBarRef} className="absolute top-0 left-0 h-full bg-green-500 w-full"></div>
                   </div>
                </div>
                <div className="flex items-center gap-2">
                   <div className="w-24 text-blue-400 font-bold font-orbitron text-sm">HULL</div>
                   <div className="w-48 h-3 border border-blue-900 bg-gray-900/50 rounded-sm relative overflow-hidden">
                      <div ref={hullBarRef} className="absolute top-0 left-0 h-full bg-blue-500 w-full"></div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Level Up Modal */}
        {gameState === GameState.LEVEL_UP && shipRef.current && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/90 pointer-events-auto backdrop-blur-md z-50">
                <div className="w-full max-w-6xl px-8 flex flex-col gap-8">
                    <div className="text-center">
                         <h2 className="text-4xl font-black text-yellow-400 mb-2 uppercase tracking-widest animate-pulse">
                             {pendingUpgrades > 0 ? `System Upgrade Required (${pendingUpgrades} Remaining)` : "System Upgrade Available"}
                         </h2>
                         <p className="text-gray-400">Select an augmentation module</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                        {/* Stats Dashboard */}
                        <div className="col-span-1 bg-gray-900/80 border border-gray-700 p-4 rounded-xl">
                            <h3 className="text-cyan-400 font-bold mb-4 uppercase text-sm tracking-widest border-b border-gray-700 pb-2">Ship Status</h3>
                            <div className="space-y-4 text-sm font-mono text-gray-300">
                                <div className="flex justify-between">
                                    <span>HULL</span>
                                    <span className="text-blue-400">{Math.round(shipRef.current.hull)}/{Math.round(shipRef.current.maxHull)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>FUEL</span>
                                    <span className="text-green-400">{Math.round(shipRef.current.fuel)}/{Math.round(shipRef.current.maxFuel)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>XP MULT</span>
                                    <span className="text-yellow-400">x{shipRef.current.stats.xpMult.toFixed(1)}</span>
                                </div>
                            </div>
                            
                            <h3 className="text-purple-400 font-bold mt-8 mb-4 uppercase text-sm tracking-widest border-b border-gray-700 pb-2">Inventory</h3>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(activeUpgrades).map(([id, tier]) => (
                                    <div key={id} className="bg-gray-800 px-2 py-1 rounded text-xs text-white border border-gray-600" title={id}>
                                        {UPGRADES.find(u => u.id === id)?.name} <span className="text-yellow-500">IV{tier}</span>
                                    </div>
                                ))}
                                {Object.keys(activeUpgrades).length === 0 && <span className="text-gray-600 text-xs italic">No modules installed.</span>}
                            </div>
                        </div>

                        {/* Selection Cards */}
                        <div className={`col-span-3 grid grid-cols-1 ${isDevMode ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-6`}>
                            {offeredUpgrades.map((u, i) => (
                                <button 
                                    key={i}
                                    onClick={() => applyUpgrade(u)}
                                    className={`group relative p-6 border-2 bg-gray-900 hover:bg-gray-800 transition-all transform hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(0,0,0,0.5)] ${u.color} rounded-xl overflow-hidden flex flex-col`}
                                >
                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity bg-current"></div>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="text-xs font-bold uppercase tracking-widest opacity-70 border border-current px-2 py-0.5 rounded">{u.category}</div>
                                        <div className="text-xs font-bold opacity-50">Tier {(activeUpgrades[u.id] || 0) + 1}</div>
                                    </div>
                                    <div className="text-xl font-bold text-white mb-2 font-orbitron text-left">{u.name}</div>
                                    <div className="text-sm text-gray-300 leading-relaxed text-left flex-grow">
                                        {u.description((activeUpgrades[u.id] || 0) + 1)}
                                    </div>
                                    <div className="mt-4 w-full py-2 bg-white/10 group-hover:bg-white/20 text-white text-xs font-bold uppercase tracking-widest rounded transition-colors">
                                        Install
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {gameState === GameState.MENU && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 pointer-events-auto backdrop-blur-sm">
            <div className="text-center">
              <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-600 mb-8 filter drop-shadow-[0_0_15px_rgba(0,255,255,0.5)] tracking-tighter">
                NEON VOID
              </h1>
              <div className="space-y-4">
                <p className="text-gray-400 max-w-md mx-auto mb-8 leading-relaxed font-light">
                  Survive the asteroid belt. <span className="text-green-400">Collect Fuel.</span> 
                  <br/>
                  <span className="text-yellow-400">Gain Levels</span> to upgrade your ship.
                </p>

                <div className="mb-6 flex flex-col items-center gap-4">
                     {/* Dev Mode Toggle */}
                    <div 
                        className="flex items-center gap-3 bg-gray-900/80 px-4 py-2 rounded-full border border-gray-700 cursor-pointer hover:border-gray-500 transition-colors"
                        onClick={() => setIsDevMode(!isDevMode)}
                    >
                        <span className={`text-xs font-bold uppercase tracking-widest ${isDevMode ? 'text-cyan-400' : 'text-gray-500'}`}>Dev Mode</span>
                        <div className={`w-10 h-5 rounded-full p-1 transition-colors duration-300 relative ${isDevMode ? 'bg-cyan-900' : 'bg-gray-700'}`}>
                            <div className={`bg-cyan-400 w-3 h-3 rounded-full shadow-md transform transition-transform duration-300 absolute top-1 ${isDevMode ? 'left-6' : 'left-1'}`}></div>
                        </div>
                    </div>

                    {isDevMode && (
                        <div className="p-4 bg-gray-900/80 border border-gray-700 rounded-lg max-w-md mx-auto w-full animate-fadeIn">
                            <div className="text-yellow-500 font-bold mb-2 uppercase tracking-widest text-sm">Developer Override</div>
                            <div className="flex items-center justify-between gap-4">
                                <span className="text-gray-300 font-mono text-sm">START LEVEL: {startLevel}</span>
                                <input 
                                    type="range" min="1" max="20" step="1" 
                                    value={startLevel} 
                                    onChange={(e) => setStartLevel(parseInt(e.target.value))}
                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                />
                            </div>
                        </div>
                    )}
                </div>

                <button 
                  onClick={initGame}
                  className="px-12 py-4 bg-cyan-600 hover:bg-cyan-500 text-black font-bold text-xl rounded-none border-2 border-cyan-400 shadow-[0_0_20px_rgba(0,255,255,0.4)] transition-all hover:scale-105 active:scale-95 uppercase tracking-widest"
                >
                  Initiate Launch
                </button>
              </div>
            </div>
          </div>
        )}

        {gameState === GameState.GAME_OVER && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-900/20 pointer-events-auto backdrop-blur-md">
            <div className="text-center border border-red-500/30 p-12 bg-black/90 shadow-[0_0_50px_rgba(255,0,0,0.2)]">
              <h2 className="text-5xl font-bold text-red-500 mb-2 tracking-widest uppercase">CRITICAL FAILURE</h2>
              <p className="text-xl text-white mb-8 uppercase tracking-widest font-light">{deathReason}</p>
              
              <div className="mb-10 flex flex-col items-center">
                <div className="text-gray-500 text-xs uppercase tracking-[0.2em] mb-2">Final Score</div>
                <div className="text-7xl text-white font-mono font-bold text-shadow-glow">{score}</div>
                <div className="text-yellow-500 text-sm uppercase tracking-[0.2em] mt-4">Level Reached: {level}</div>
              </div>

              <button 
                onClick={initGame}
                className="px-8 py-3 bg-transparent border border-white text-white hover:bg-white hover:text-black transition-colors uppercase tracking-widest text-sm font-bold"
              >
                Reboot System
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AsteroidsGame;