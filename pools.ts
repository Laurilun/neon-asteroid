// ============================================================================
// ENTITY POOLS - Recycle objects to reduce garbage collection
// ============================================================================

import { Particle, Bullet, EntityType } from './types';

// Pool storage
const particlePool: Particle[] = [];
const bulletPool: Bullet[] = [];

// Pool size limits
const MAX_POOL_SIZE = 200;

// ============================================================================
// PARTICLE POOL
// ============================================================================

export function getParticle(): Particle {
    if (particlePool.length > 0) {
        return particlePool.pop()!;
    }
    // Create new if pool empty
    return {
        id: '',
        type: EntityType.Particle,
        pos: { x: 0, y: 0 },
        vel: { x: 0, y: 0 },
        radius: 1,
        angle: 0,
        color: '#fff',
        toBeRemoved: false,
        life: 1,
        maxLife: 1,
        decay: 0.05,
        variant: 'DEBRIS'
    };
}

export function releaseParticle(p: Particle): void {
    if (particlePool.length < MAX_POOL_SIZE) {
        p.toBeRemoved = false;
        particlePool.push(p);
    }
    // If pool is full, let GC handle it
}

// ============================================================================
// BULLET POOL
// ============================================================================

export function getBullet(): Bullet {
    if (bulletPool.length > 0) {
        return bulletPool.pop()!;
    }
    return {
        id: '',
        type: EntityType.Bullet,
        pos: { x: 0, y: 0 },
        vel: { x: 0, y: 0 },
        radius: 2,
        angle: 0,
        color: '#fff',
        toBeRemoved: false,
        life: 16,
        damage: 10,
        bouncesRemaining: 0
    };
}

export function releaseBullet(b: Bullet): void {
    if (bulletPool.length < MAX_POOL_SIZE) {
        b.toBeRemoved = false;
        bulletPool.push(b);
    }
}

// ============================================================================
// POOL STATS (for debugging)
// ============================================================================

export function getPoolStats() {
    return {
        particles: particlePool.length,
        bullets: bulletPool.length
    };
}
