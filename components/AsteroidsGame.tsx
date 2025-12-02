
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Asteroid, Bullet, EntityType, GameState, Particle, Ship, FuelOrb, HullOrb, Vector, Drone, UpgradeCategory, UpgradeDef
} from '../types';
import { 
  SHIP_SIZE, SHIP_THRUST, SHIP_TURN_SPEED, SHIP_FRICTION, SHIP_MAX_SPEED,
  BULLET_SPEED, BULLET_LIFE, BULLET_RATE, BULLET_DAMAGE,
  ASTEROID_SPEED_BASE, MOLTEN_SPEED_MULTIPLIER, ASTEROID_HULL_DAMAGE, MOLTEN_SPAWN_RATE,
  FUEL_DECAY_ON_THRUST, FUEL_DECAY_PASSIVE, FUEL_ORB_VALUE, PARTICLE_COUNT_EXPLOSION, COLORS, FUEL_ORB_LIFE, FUEL_DROP_CHANCE,
  HULL_ORB_VALUE, HULL_DROP_CHANCE,
  HIT_FLASH_FRAMES, SCREEN_SHAKE_DECAY,
  UPGRADES, XP_BASE_REQ, XP_SCALING_FACTOR
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
  const droneRef = useRef<Drone | null>(null);
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
        maxFuelMult: 1.0,
        maxHullMult: 1.0,
        fireRateMult: 1.0,
        damageMult: 1.0,
        bulletSpeedMult: 1.0,
        pickupRange: 50,
        shieldCharges: 0,
        maxShieldCharges: 0,
        hasWingman: false,
        wingmanTier: 0
      }
    };

    asteroidsRef.current = [];
    bulletsRef.current = [];
    particlesRef.current = [];
    fuelOrbsRef.current = [];
    hullOrbsRef.current = [];
    droneRef.current = null;
    
    waveRef.current = 1;
    setScore(0);
    setLevel(1);
    setXpTarget(XP_BASE_REQ);
    setActiveUpgrades({});
    
    spawnWave(1);
    setGameState(GameState.PLAYING);
  }, []);

  const spawnWave = (wave: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Difficulty scaling: More asteroids and faster asteroids per wave/level
    const count = 3 + Math.floor(wave * 1.5); 
    const speedMult = 1 + (level * 0.05);

    for (let i = 0; i < count; i++) {
      spawnAsteroid(canvas.width, canvas.height, 3, undefined, speedMult);
    }
  };

  const spawnMoltenFlyby = (cw: number, ch: number) => {
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
      const sizeCat = Math.random() < (0.3 + level * 0.02) ? 3 : 2; // Higher chance for big ones at high levels
      const radius = sizeCat === 3 ? 75 : 35;
      const hp = sizeCat === 3 ? 250 : 80;
      const speedMult = (sizeCat === 3 ? MOLTEN_SPEED_MULTIPLIER * 0.8 : MOLTEN_SPEED_MULTIPLIER) * (1 + level * 0.05);
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

  const spawnAsteroid = (cw: number, ch: number, sizeCat: 1 | 2 | 3, pos?: Vector, speedMultiplier = 1.0) => {
    const radius = sizeCat === 3 ? 65 : sizeCat === 2 ? 35 : 18;
    // HP scales slightly with level to keep late game interesting
    const hpBase = sizeCat === 3 ? 150 : sizeCat === 2 ? 50 : 20; 
    const hp = hpBase * (1 + (level - 1) * 0.1);

    const speed = ASTEROID_SPEED_BASE * (1 + (Math.random() * 0.5)) * speedMultiplier; 
    
    let position = pos;
    if (!position) {
      if (Math.random() < 0.5) {
        position = { x: Math.random() < 0.5 ? 0 : cw, y: Math.random() * ch };
      } else {
        position = { x: Math.random() * cw, y: Math.random() < 0.5 ? 0 : ch };
      }
    }

    const angle = Math.random() * Math.PI * 2;
    asteroidsRef.current.push({
      id: Math.random().toString(36).substr(2, 9),
      type: EntityType.Asteroid,
      pos: position,
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
          const green = UPGRADES.filter(u => u.category === UpgradeCategory.SURVIVAL);
          const red = UPGRADES.filter(u => u.category === UpgradeCategory.COMBAT);
          const purple = UPGRADES.filter(u => u.category === UpgradeCategory.TECH);
          
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
              case 'efficiency': s.fuelEfficiency = 1.0 - (currentTier * 0.20); break; // -20%, -40%
              case 'tank': 
                  s.maxFuelMult = 1.0 + (currentTier * 0.30); 
                  shipRef.current.maxFuel = 100 * s.maxFuelMult;
                  shipRef.current.fuel = shipRef.current.maxFuel; // Refill on upgrade
                  break;
              case 'hull':
                  s.maxHullMult = 1.0 + (currentTier * 0.25);
                  shipRef.current.maxHull = 100 * s.maxHullMult;
                  shipRef.current.hull = shipRef.current.maxHull; // Full Repair
                  break;
              case 'rapidfire': s.fireRateMult = Math.max(0.2, 1.0 - (currentTier * 0.15)); break;
              case 'damage': s.damageMult = 1.0 + (currentTier * 0.25); break;
              case 'velocity': s.bulletSpeedMult = 1.0 + (currentTier * 0.20); break;
              case 'wingman': 
                  s.hasWingman = true; 
                  s.wingmanTier = currentTier;
                  // Initialize drone if not present
                  if (!droneRef.current) {
                      droneRef.current = {
                          id: 'drone', type: EntityType.Drone,
                          pos: { ...shipRef.current.pos }, vel: {x:0,y:0},
                          radius: 5, angle: 0, color: COLORS.DRONE, toBeRemoved: false,
                          targetId: null, orbitAngle: 0, lastShot: 0
                      };
                  }
                  break;
              case 'magnet': s.pickupRange = 50 + (currentTier * 50); break;
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
          // Progress to next level
          // Calculate relative progress based on previous level threshold?
          // Simplified: just show % of total target for now, or relative range.
          // Let's do relative to current level gap for smoother bar.
          // For simplicity in this iteration: % of current target.
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
            spawnMoltenFlyby(cw, ch);
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
          ship.vel.x += Math.cos(ship.rotation) * SHIP_THRUST;
          ship.vel.y += Math.sin(ship.rotation) * SHIP_THRUST;
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
        const speed = Math.sqrt(ship.vel.x**2 + ship.vel.y**2);
        if (speed > SHIP_MAX_SPEED) {
            ship.vel.x = (ship.vel.x / speed) * SHIP_MAX_SPEED;
            ship.vel.y = (ship.vel.y / speed) * SHIP_MAX_SPEED;
        }
        ship.pos.x += ship.vel.x;
        ship.pos.y += ship.vel.y;

        if (ship.pos.x < 0) ship.pos.x = cw;
        if (ship.pos.x > cw) ship.pos.x = 0;
        if (ship.pos.y < 0) ship.pos.y = ch;
        if (ship.pos.y > ch) ship.pos.y = 0;

        // Shooting
        const fireRate = Math.max(1, Math.floor(BULLET_RATE * stats.fireRateMult));
        if (frameCountRef.current % fireRate === 0) {
            bulletsRef.current.push({
                id: Math.random().toString(),
                type: EntityType.Bullet,
                pos: { 
                    x: ship.pos.x + Math.cos(ship.rotation) * ship.radius,
                    y: ship.pos.y + Math.sin(ship.rotation) * ship.radius
                },
                vel: {
                    x: Math.cos(ship.rotation) * BULLET_SPEED * stats.bulletSpeedMult + ship.vel.x * 0.2,
                    y: Math.sin(ship.rotation) * BULLET_SPEED * stats.bulletSpeedMult + ship.vel.y * 0.2
                },
                radius: 1.5,
                angle: ship.rotation,
                color: COLORS.BULLET,
                toBeRemoved: false,
                life: BULLET_LIFE * stats.bulletSpeedMult, // Range scales with speed
                damage: BULLET_DAMAGE * stats.damageMult
            });
        }

        // --- Drone Logic ---
        if (stats.hasWingman && droneRef.current) {
            const drone = droneRef.current;
            // Orbit
            drone.orbitAngle += 0.05;
            drone.pos.x = ship.pos.x + Math.cos(drone.orbitAngle) * 25;
            drone.pos.y = ship.pos.y + Math.sin(drone.orbitAngle) * 25;

            // Target & Shoot
            const droneFireRate = Math.max(10, 60 - (stats.wingmanTier * 5)); // Improves with tier
            if (frameCountRef.current - drone.lastShot > droneFireRate) {
                // Find nearest
                let nearest = null;
                let minDist = 300; // Drone range
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
                       radius: 1, // Smaller drone bullets
                       angle: angle,
                       color: COLORS.DRONE,
                       toBeRemoved: false,
                       life: BULLET_LIFE,
                       damage: BULLET_DAMAGE * 0.5 // Drone deals half damage
                   });
                   drone.lastShot = frameCountRef.current;
                }
            }
        }
      }

      // Physics Updates (run even if menu/gameover for background feel)
      // Bullets
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
                      ship.fuel = Math.min(ship.maxFuel, ship.fuel + FUEL_ORB_VALUE);
                      setScore(s => s + 50);
                  }
              });
              hullOrbsRef.current.forEach(o => {
                  if (o.toBeRemoved) return;
                  if (dist(ship.pos, o.pos) < ship.radius + o.radius) {
                      o.toBeRemoved = true;
                      ship.hull = Math.min(ship.maxHull, ship.hull + HULL_ORB_VALUE);
                      setScore(s => s + 50);
                  }
              });

              if (Date.now() > ship.invulnerableUntil) {
                  asteroidsRef.current.forEach(a => {
                     if (a.toBeRemoved) return;
                     if (checkShipCollision(ship, a)) {
                         if (a.type === EntityType.MoltenAsteroid) {
                             // Shield Logic
                             if (ship.stats.shieldCharges > 0) {
                                 ship.stats.shieldCharges--;
                                 a.toBeRemoved = true; // Destroy molten
                                 spawnParticles(a.pos, COLORS.MOLTEN, 40, 8);
                                 screenShakeRef.current = 15;
                                 ship.invulnerableUntil = Date.now() + 1000;
                             } else {
                                 handleGameOver("Molten Incineration");
                                 ship.toBeRemoved = true;
                             }
                         } else {
                             screenShakeRef.current = 6;
                             if (a.sizeCategory === 1) {
                                 a.toBeRemoved = true;
                                 spawnParticles(a.pos, a.color, 10, 4);
                                 ship.hull -= 8;
                                 setScore(s => s + 50);
                             } else {
                                 const angle = Math.atan2(ship.pos.y - a.pos.y, ship.pos.x - a.pos.x);
                                 const pushForce = 9;
                                 ship.vel.x += Math.cos(angle) * pushForce;
                                 ship.vel.y += Math.sin(angle) * pushForce;
                                 ship.hull -= ASTEROID_HULL_DAMAGE;
                                 a.hitFlash = HIT_FLASH_FRAMES;
                                 spawnParticles(ship.pos, COLORS.SHIP, 15, 6);
                                 ship.invulnerableUntil = Date.now() + 300;
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
              spawnWave(waveRef.current);
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

      // Ship & Drone
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
                  // Draw Charge Indicators
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

          // Draw Drone
          if (droneRef.current && ship.stats.hasWingman) {
              const d = droneRef.current;
              ctx.fillStyle = COLORS.DRONE;
              ctx.shadowColor = COLORS.DRONE;
              ctx.shadowBlur = 10;
              ctx.beginPath();
              ctx.arc(d.pos.x, d.pos.y, d.radius, 0, Math.PI * 2);
              ctx.fill();
              ctx.shadowBlur = 0;
          }
      }

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
  }, [gameState, initGame, score, xpTarget, level]); // Deps ensure loop picks up state changes if re-run

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
        {gameState === GameState.LEVEL_UP && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 pointer-events-auto backdrop-blur-md z-50">
                <div className="text-center w-full max-w-5xl px-4">
                    <h2 className="text-4xl font-black text-yellow-400 mb-2 uppercase tracking-widest animate-pulse">System Upgrade Available</h2>
                    <p className="text-gray-400 mb-12">Select an augmentation module</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {offeredUpgrades.map((u, i) => (
                            <button 
                                key={i}
                                onClick={() => applyUpgrade(u)}
                                className={`group relative p-8 border-2 bg-gray-900/90 hover:bg-gray-800 transition-all transform hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(0,0,0,0.5)] ${u.color} rounded-xl overflow-hidden`}
                            >
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity bg-current"></div>
                                <div className="text-xs font-bold uppercase tracking-widest mb-4 opacity-70">{u.category}</div>
                                <div className="text-2xl font-bold text-white mb-4 font-orbitron">{u.name}</div>
                                <div className="text-sm text-gray-300 leading-relaxed min-h-[3rem]">
                                    {u.description((activeUpgrades[u.id] || 0) + 1)}
                                </div>
                                <div className="mt-6 text-xs uppercase tracking-widest font-bold opacity-50">
                                    Current Tier: {activeUpgrades[u.id] || 0}
                                </div>
                            </button>
                        ))}
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
