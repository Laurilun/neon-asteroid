
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Asteroid, Bullet, EntityType, GameState, Particle, Ship, FuelOrb, HullOrb, Vector, Drone, UpgradeCategory, UpgradeDef
} from '../types';
import { 
  SHIP_SIZE, SHIP_THRUST, SHIP_TURN_SPEED, SHIP_FRICTION, SHIP_MAX_SPEED,
  BULLET_SPEED, BULLET_LIFE, BULLET_RATE, BULLET_DAMAGE,
  ASTEROID_SPEED_BASE, MOLTEN_SPEED_MULTIPLIER, ASTEROID_HULL_DAMAGE, ASTEROID_SMALL_DAMAGE, MOLTEN_SPAWN_RATE,
  FUEL_DECAY_ON_THRUST, FUEL_DECAY_PASSIVE, FUEL_ORB_VALUE, PARTICLE_COUNT_EXPLOSION, COLORS, FUEL_ORB_LIFE, FUEL_DROP_CHANCE,
  HULL_ORB_VALUE, HULL_DROP_CHANCE,
  HIT_FLASH_FRAMES, SCREEN_SHAKE_DECAY,
  UPGRADES, XP_BASE_REQ, XP_SCALING_FACTOR,
  LEVEL_GATE_LARGE_ASTEROIDS, LEVEL_GATE_MOLTEN_SMALL, LEVEL_GATE_MOLTEN_LARGE
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
  const dronesRef = useRef<Drone[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);

  const inputRef = useRef({ up: false, left: false, right: false });
  const frameRef = useRef<number>(0);
  const waveRef = useRef<number>(1);
  const frameCountRef = useRef<number>(0);
  const screenShakeRef = useRef<number>(0);

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
      hull: 100,
      maxHull: 100,
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
        multishotTier: 0
      }
    };

    asteroidsRef.current = [];
    bulletsRef.current = [];
    particlesRef.current = [];
    fuelOrbsRef.current = [];
    hullOrbsRef.current = [];
    dronesRef.current = [];
    floatingTextsRef.current = [];
    
    waveRef.current = 1;
    setScore(0);
    setLevel(1);
    setXpTarget(XP_BASE_REQ);
    setActiveUpgrades({});
    
    // Spawn first wave (offscreen)
    spawnWave(1, 1);
    setGameState(GameState.PLAYING);
  }, []);

  const spawnWave = (wave: number, currentLevel: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Difficulty scaling: More asteroids and faster asteroids per wave/level
    const count = 3 + Math.floor(wave * 1.5); 
    const speedMult = 1 + (currentLevel * 0.05);

    for (let i = 0; i < count; i++) {
      // Determine allowed size category based on level
      let sizeCat: 1 | 2 | 3 = 1;
      const rand = Math.random();
      
      if (currentLevel < LEVEL_GATE_LARGE_ASTEROIDS) {
          // Level 1: Mostly small, some medium. No large.
          sizeCat = rand > 0.6 ? 2 : 1;
      } else {
          // Level 2+: Full mix
          if (rand > 0.7) sizeCat = 3;
          else if (rand > 0.3) sizeCat = 2;
          else sizeCat = 1;
      }

      // Always spawn offscreen for new waves
      spawnAsteroid(canvas.width, canvas.height, sizeCat, undefined, speedMult, true);
    }
  };

  const spawnMoltenFlyby = (cw: number, ch: number, currentLevel: number) => {
      if (currentLevel < LEVEL_GATE_MOLTEN_SMALL) return;

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
      
      let sizeCat: 2 | 3 = 2;
      if (currentLevel >= LEVEL_GATE_MOLTEN_LARGE) {
           sizeCat = Math.random() < (0.3 + currentLevel * 0.02) ? 3 : 2; 
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
          vertices: generatePolygon(radius, 12 + sizeCat * 4, 15),
          hp: hp, 
          sizeCategory: sizeCat,
          hitFlash: 0
      });
  };

  const spawnAsteroid = (cw: number, ch: number, sizeCat: 1 | 2 | 3, pos?: Vector, speedMultiplier = 1.0, forceOffScreen = false) => {
    const radius = sizeCat === 3 ? 65 : sizeCat === 2 ? 35 : 18;
    const hpBase = sizeCat === 3 ? 150 : sizeCat === 2 ? 50 : 20; 
    const hp = hpBase * (1 + (level - 1) * 0.1);

    const speed = ASTEROID_SPEED_BASE * (1 + (Math.random() * 0.5)) * speedMultiplier; 
    
    let position = pos;
    if (!position) {
      if (forceOffScreen) {
        const buffer = radius + 20;
        if (Math.random() < 0.5) {
            // Left or Right
            position = { 
                x: Math.random() < 0.5 ? -buffer : cw + buffer, 
                y: Math.random() * ch 
            };
        } else {
            // Top or Bottom
            position = { 
                x: Math.random() * cw, 
                y: Math.random() < 0.5 ? -buffer : ch + buffer 
            };
        }
        
        // Aim generally towards the center if spawned far out
        // (Override the random angle below if we want them to drift IN)
      } else {
        // Fallback or on-edge spawn (used for Menu)
        if (Math.random() < 0.5) {
            position = { x: Math.random() < 0.5 ? 0 : cw, y: Math.random() * ch };
        } else {
            position = { x: Math.random() * cw, y: Math.random() < 0.5 ? 0 : ch };
        }
      }
    }

    // If spawned offscreen, calculate angle to point somewhat towards the screen
    let angle = Math.random() * Math.PI * 2;
    if (forceOffScreen && position) {
        const centerX = cw / 2;
        const centerY = ch / 2;
        const angleToCenter = Math.atan2(centerY - position.y, centerX - position.x);
        // Add some randomness so they don't all go to exact center
        angle = angleToCenter + (Math.random() - 0.5) * 1.5; 
    }

    asteroidsRef.current.push({
      id: Math.random().toString(36).substr(2, 9),
      type: EntityType.Asteroid,
      pos: position!,
      vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
      radius: radius,
      angle: 0,
      color: COLORS.ASTEROID,
      toBeRemoved: false,
      vertices: generatePolygon(radius, 10 + sizeCat * 2, sizeCat * 4),
      hp: hp,
      sizeCategory: sizeCat,
      hitFlash: 0
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

  const checkLevelUp = (currentScore: number) => {
      if (currentScore >= xpTarget) {
          // Trigger Level Up
          setGameState(GameState.LEVEL_UP);
          
          // Pick 3 random upgrades (one of each category)
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

  const applyUpgrade = (upgrade: UpgradeDef) => {
      // 1. Update Tier Count
      const newActive = { ...activeUpgrades };
      const currentTier = (newActive[upgrade.id] || 0) + 1;
      newActive[upgrade.id] = currentTier;
      setActiveUpgrades(newActive);

      // 2. Apply Stats to Ship
      if (shipRef.current) {
          const s = shipRef.current.stats;
          
          switch(upgrade.id) {
              case 'engine': 
                  s.thrustMult = 1.0 + (currentTier * 0.25);
                  s.speedMult = 1.0 + (currentTier * 0.25);
                  break;
              case 'tank': 
                  s.maxFuelMult = 1.0 + (currentTier * 0.40); 
                  s.fuelEfficiency = Math.max(0.1, 1.0 - (currentTier * 0.15)); // Reduce decay
                  s.fuelRecoveryMult = 1.0 + (currentTier * 0.20); // Increase intake
                  shipRef.current.maxFuel = 100 * s.maxFuelMult;
                  shipRef.current.fuel = shipRef.current.maxFuel; // Refill
                  break;
              case 'hull':
                  s.maxHullMult = 1.0 + (currentTier * 0.30);
                  shipRef.current.maxHull = 100 * s.maxHullMult;
                  shipRef.current.hull = shipRef.current.maxHull; // Full Repair
                  break;
              case 'rapidfire': s.fireRateMult = Math.max(0.1, 1.0 - (currentTier * 0.20)); break;
              case 'multishot': s.multishotTier = currentTier; break;
              case 'velocity': s.bulletSpeedMult = 1.0 + (currentTier * 0.25); break;
              case 'drone': 
                  s.droneCount = currentTier;
                  // Ensure drones array matches count
                  while (dronesRef.current.length < s.droneCount) {
                      dronesRef.current.push({
                          id: `drone-${dronesRef.current.length}`, 
                          type: EntityType.Drone,
                          pos: { ...shipRef.current.pos }, vel: {x:0,y:0},
                          radius: 5, angle: 0, color: COLORS.DRONE, toBeRemoved: false,
                          targetId: null, orbitOffset: (Math.PI * 2 * dronesRef.current.length), lastShot: 0
                      });
                  }
                  // Reset offsets for even spacing
                  dronesRef.current.forEach((d, i) => {
                      d.orbitOffset = (i / s.droneCount) * Math.PI * 2;
                  });
                  break;
              case 'magnet': s.pickupRange = 50 + (currentTier * 60); break;
              case 'shield': 
                  s.maxShieldCharges = currentTier; 
                  s.shieldCharges = currentTier; // Refill charges
                  break;
          }
      }

      // 3. Level Progression
      setLevel(l => l + 1);
      setXpTarget(prev => Math.floor(prev * XP_SCALING_FACTOR + 1000)); // Increase gap
      
      // 4. Resume Game
      setGameState(GameState.PLAYING);
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
        for(let i=0; i<5; i++) spawnAsteroid(canvas.width, canvas.height, 3);
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

      if (gameState === GameState.MENU || gameState === GameState.GAME_OVER) {
          if (asteroidsRef.current.length < 5 && Math.random() < 0.01) {
              spawnAsteroid(cw, ch, 3);
          }
      }

      const ship = shipRef.current;
      
      // --- LOGIC (Paused during LEVEL_UP) ---
      if (gameState === GameState.PLAYING && ship && !ship.toBeRemoved) {
        
        checkLevelUp(score);

        if (Math.random() < MOLTEN_SPAWN_RATE + (level * 0.0005)) {
            spawnMoltenFlyby(cw, ch, level);
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
                // Determine target angle based on swarm count for even distribution
                const angleOffset = (i / stats.droneCount) * Math.PI * 2;
                const currentAngle = globalOrbit + angleOffset;
                
                // Orbit movement
                drone.pos.x = ship.pos.x + Math.cos(currentAngle) * 35;
                drone.pos.y = ship.pos.y + Math.sin(currentAngle) * 35;

                // Auto-fire
                const droneFireRate = 30; // Drones fire moderately fast
                if (frameCountRef.current - drone.lastShot > droneFireRate) {
                    let nearest = null;
                    let minDist = 450; // Decent range
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
                            life: BULLET_LIFE * 1.5, // Drones have slightly better range than base ship
                            damage: BULLET_DAMAGE // Same damage
                        });
                        drone.lastShot = frameCountRef.current;
                    }
                }
            });
        }
      }

      // Physics Updates (run even if menu/gameover for background feel)
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
            if (a.hitFlash > 0) a.hitFlash--;
            
            if (a.type === EntityType.MoltenAsteroid) {
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

      // Orbs (Magnet Logic inside)
      const updateOrb = (o: FuelOrb | HullOrb) => {
        if (gameState !== GameState.LEVEL_UP) {
            // Magnet Effect
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
            o.vel.x *= 0.95; // Drag
            o.vel.y *= 0.95;
            o.life--;
            if (o.life <= 0) o.toBeRemoved = true;
            if (o.pos.x < 0) o.pos.x = cw;
            if (o.pos.x > cw) o.pos.x = 0;
            if (o.pos.y < 0) o.pos.y = ch;
            if (o.pos.y > ch) o.pos.y = 0;
        }
      };
      fuelOrbsRef.current.forEach(updateOrb);
      hullOrbsRef.current.forEach(updateOrb);

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
             if (t.life <= 0) (t as any).toBeRemoved = true; // Temporary cast for deletion logic
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
                        const ptVal = a.type === EntityType.MoltenAsteroid ? 1000 : 100 * a.sizeCategory;
                        setScore(s => s + ptVal);
                        spawnParticles(a.pos, a.color, PARTICLE_COUNT_EXPLOSION, 6);
                        
                        if (a.type !== EntityType.MoltenAsteroid && a.sizeCategory > 1) {
                            const newSize = (a.sizeCategory - 1) as 1 | 2;
                            // Small asteroid spawns can just stay where they are (pop-out effect from parent is fine)
                            spawnAsteroid(cw, ch, newSize, { ...a.pos }, 1.0 + (level * 0.05));
                            spawnAsteroid(cw, ch, newSize, { ...a.pos }, 1.0 + (level * 0.05));
                        }

                        const r = Math.random();
                        if (r < FUEL_DROP_CHANCE) spawnFuelOrb(a.pos);
                        else if (r < FUEL_DROP_CHANCE + HULL_DROP_CHANCE) spawnHullOrb(a.pos);
                    }
                }
            });
          });

          if (ship && !ship.toBeRemoved) {
              fuelOrbsRef.current.forEach(o => {
                  if (o.toBeRemoved) return;
                  if (dist(ship.pos, o.pos) < ship.radius + o.radius) {
                      o.toBeRemoved = true;
                      
                      const recovery = FUEL_ORB_VALUE * ship.stats.fuelRecoveryMult;
                      ship.fuel = Math.min(ship.maxFuel, ship.fuel + recovery);
                      
                      setScore(s => s + 50);
                      spawnFloatingText(ship.pos, `+${Math.round(recovery)} FUEL`, COLORS.FUEL);
                  }
              });
              hullOrbsRef.current.forEach(o => {
                  if (o.toBeRemoved) return;
                  if (dist(ship.pos, o.pos) < ship.radius + o.radius) {
                      o.toBeRemoved = true;
                      ship.hull = Math.min(ship.maxHull, ship.hull + HULL_ORB_VALUE);
                      setScore(s => s + 50);
                      spawnFloatingText(ship.pos, `+${HULL_ORB_VALUE} HULL`, COLORS.HULL);
                  }
              });

              if (Date.now() > ship.invulnerableUntil) {
                  asteroidsRef.current.forEach(a => {
                     if (a.toBeRemoved) return;
                     if (checkShipCollision(ship, a)) {
                         if (a.type === EntityType.MoltenAsteroid) {
                             if (ship.stats.shieldCharges > 0) {
                                 ship.stats.shieldCharges--;
                                 a.toBeRemoved = true; 
                                 spawnParticles(a.pos, COLORS.MOLTEN, 40, 8);
                                 screenShakeRef.current = 15;
                                 ship.invulnerableUntil = Date.now() + 1000;
                                 spawnFloatingText(ship.pos, "SHIELD BLOCK", COLORS.SHIELD);
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
                                 a.hitFlash = HIT_FLASH_FRAMES;
                                 spawnParticles(ship.pos, COLORS.SHIP, 15, 6);
                                 ship.invulnerableUntil = Date.now() + 300;
                                 spawnFloatingText(ship.pos, `-${ASTEROID_HULL_DAMAGE} HP`, '#ff0000', 16);
                             }
                             if (ship.hull <= 0) {
                                 handleGameOver("Hull Critical");
                                 ship.toBeRemoved = true;
                             }
                         }
                     }
                  });
              }
          }

          const activeNormalAsteroids = asteroidsRef.current.filter(a => a.type !== EntityType.MoltenAsteroid).length;
          if (activeNormalAsteroids === 0) {
              waveRef.current++;
              spawnWave(waveRef.current, level);
          }
      }

      bulletsRef.current = bulletsRef.current.filter(e => !e.toBeRemoved);
      asteroidsRef.current = asteroidsRef.current.filter(e => !e.toBeRemoved);
      particlesRef.current = particlesRef.current.filter(e => !e.toBeRemoved);
      fuelOrbsRef.current = fuelOrbsRef.current.filter(e => !e.toBeRemoved);
      hullOrbsRef.current = hullOrbsRef.current.filter(e => !e.toBeRemoved);

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
      fuelOrbsRef.current.forEach(o => {
          ctx.shadowColor = COLORS.FUEL;
          ctx.strokeStyle = COLORS.FUEL;
          const pulse = Math.sin(frameCountRef.current * 0.15 + o.pulsateOffset) * 2;
          ctx.beginPath(); ctx.arc(o.pos.x, o.pos.y, o.radius + pulse, 0, Math.PI * 2); ctx.stroke();
      });
      hullOrbsRef.current.forEach(o => {
          ctx.shadowColor = COLORS.HULL;
          ctx.strokeStyle = COLORS.HULL;
          const pulse = Math.sin(frameCountRef.current * 0.15 + o.pulsateOffset) * 2;
          ctx.beginPath(); ctx.arc(o.pos.x, o.pos.y, o.radius + pulse, 0, Math.PI * 2); 
          ctx.moveTo(o.pos.x - 3, o.pos.y); ctx.lineTo(o.pos.x + 3, o.pos.y);
          ctx.moveTo(o.pos.x, o.pos.y - 3); ctx.lineTo(o.pos.x, o.pos.y + 3); ctx.stroke();
      });
      ctx.shadowBlur = 0;

      // Asteroids
      asteroidsRef.current.forEach(a => {
          if (a.hitFlash > 0) {
              ctx.strokeStyle = COLORS.FLASH;
              ctx.lineWidth = 4;
              ctx.shadowColor = COLORS.FLASH;
              ctx.shadowBlur = 20;
          } else {
              ctx.strokeStyle = a.color;
              ctx.lineWidth = a.sizeCategory === 3 ? 3 : 2;
              ctx.shadowBlur = a.type === EntityType.MoltenAsteroid ? 20 + Math.sin(frameCountRef.current * 0.1) * 10 : 5;
              ctx.shadowColor = a.color;
          }
          
          ctx.beginPath();
          if (a.vertices.length > 0) {
              const v0 = a.vertices[0];
              ctx.moveTo(a.pos.x + v0.x, a.pos.y + v0.y);
              for (let i = 1; i < a.vertices.length; i++) ctx.lineTo(a.pos.x + a.vertices[i].x, a.pos.y + a.vertices[i].y);
          }
          ctx.closePath();
          ctx.stroke();

          if (a.hitFlash > 0) {
              ctx.fillStyle = COLORS.FLASH;
              ctx.globalAlpha = 0.8; ctx.fill(); ctx.globalAlpha = 1.0;
          } else if (a.type === EntityType.MoltenAsteroid) {
              ctx.fillStyle = a.color;
              ctx.globalAlpha = 0.2; ctx.fill(); ctx.globalAlpha = 1.0;
          }
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
  }, [gameState, initGame, score, xpTarget, level]); 

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
                         <h2 className="text-4xl font-black text-yellow-400 mb-2 uppercase tracking-widest animate-pulse">System Upgrade Available</h2>
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
                                    <span>DRONES</span>
                                    <span>{shipRef.current.stats.droneCount}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>SHIELDS</span>
                                    <span>{shipRef.current.stats.shieldCharges}</span>
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
                        <div className="col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
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
                  <br/>
                  <span className="text-blue-300 text-sm block mt-2">Zero-G Physics: Rotate & Thrust opposite to brake.</span>
                </p>
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
