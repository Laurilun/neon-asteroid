
import React from 'react';
import { GameState, Ship, UpgradeCategory, UpgradeDef } from '../types';
import { UPGRADES, SHIELD_RECHARGE_TIME } from '../constants';

interface GameUIProps {
    gameState: GameState;
    score: number;
    level: number;
    ship: Ship | null;
    pendingUpgrades: number;
    offeredUpgrades: UpgradeDef[];
    activeUpgrades: Record<string, number>;
    isDevMode: boolean;
    isSandbox: boolean;
    showDamageNumbers: boolean;
    startLevel: number;
    deathReason: string;
    xpBarRef: React.RefObject<HTMLDivElement | null>;
    hullBarRef: React.RefObject<HTMLDivElement | null>;
    shieldBarRef: React.RefObject<HTMLDivElement | null>;
    shieldTextRef: React.RefObject<HTMLDivElement | null>;
    onStartGame: () => void;
    onToggleDevMode: () => void;
    onToggleSandbox: () => void;
    onToggleDamageNumbers: () => void;
    onSetStartLevel: (lvl: number) => void;
    onSelectUpgrade: (u: UpgradeDef) => void;
}

// --- Icons ---
const TechIcon = () => (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
    </svg>
);

const CombatIcon = () => (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
);

const AddonIcon = () => (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
    </svg>
);

const GameUI: React.FC<GameUIProps> = ({
    gameState, score, level, ship, pendingUpgrades, offeredUpgrades, activeUpgrades,
    isDevMode, isSandbox, showDamageNumbers, startLevel, deathReason, xpBarRef, hullBarRef, shieldBarRef, shieldTextRef,
    onStartGame, onToggleDevMode, onToggleSandbox, onToggleDamageNumbers, onSetStartLevel, onSelectUpgrade
}) => {

    const renderHUD = () => (
        <div className="absolute top-4 left-4 text-white font-mono pointer-events-none select-none z-20">
            <div className="text-2xl font-bold mb-1 drop-shadow-md">{score.toString().padStart(6, '0')}</div>
            <div className="text-sm text-gray-400 drop-shadow-md">LVL {level}</div>

            <div className="flex flex-col gap-1 mt-2">
                {/* Hull Bar */}
                <div className="w-48 h-4 bg-gray-900 border border-gray-700 relative overflow-hidden rounded shadow-lg">
                    <div
                        ref={hullBarRef}
                        className="h-full bg-blue-500 transition-all duration-200 ease-out"
                        style={{ width: '100%' }}
                    ></div>
                </div>

                {/* XP Bar (Moved Here) */}
                <div className="w-48 h-1.5 bg-gray-900 border border-gray-800 relative overflow-hidden rounded">
                    <div
                        ref={xpBarRef}
                        className="h-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)] transition-all duration-100 ease-linear"
                        style={{ width: '0%' }}
                    ></div>
                </div>
            </div>

            {/* Shield Indicator - text controlled by game loop via ref */}
            {ship && ship.stats.maxShieldCharges > 0 && (
                <div className="mt-2">
                    <div
                        ref={shieldTextRef}
                        className="text-purple-400 text-[10px] font-bold drop-shadow-sm"
                    >
                        SHIELD x{ship.stats.shieldCharges}/{ship.stats.maxShieldCharges}
                    </div>
                    {/* Recharge Bar - always render, visibility controlled by game loop */}
                    <div className="w-32 h-1.5 bg-gray-800 border border-purple-900/50 rounded-full mt-1 overflow-hidden" style={{ display: 'none' }}>
                        <div
                            ref={shieldBarRef}
                            className="h-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-100"
                            style={{ width: '0%' }}
                        ></div>
                    </div>
                </div>
            )}
        </div>
    );

    const renderMenu = () => (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-30 pointer-events-auto">
            <div className="text-center">
                <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-600 mb-8 filter drop-shadow-[0_0_15px_rgba(0,255,255,0.5)] tracking-tighter">
                    NEON VOID
                </h1>

                <p className="text-gray-400 max-w-md mx-auto mb-8 leading-relaxed font-light">
                    Survive the asteroid belt. <span className="text-green-400">Harvest Energy.</span>
                    <br />
                    <span className="text-yellow-400">Upgrade your arsenal</span>.
                </p>

                <div className="flex flex-col items-center gap-6">

                    {/* Damage Numbers Toggle - Premium Style */}
                    <button
                        onClick={onToggleDamageNumbers}
                        className={`
                            group flex items-center gap-3 px-5 py-2.5 rounded-xl border transition-all duration-300
                            ${showDamageNumbers
                                ? 'bg-gradient-to-r from-yellow-900/40 to-amber-900/40 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.2)]'
                                : 'bg-gray-900/60 border-gray-700 hover:border-gray-600'}
                        `}
                    >
                        <span className={`text-sm font-medium tracking-wide transition-colors ${showDamageNumbers ? 'text-yellow-400' : 'text-gray-500 group-hover:text-gray-400'}`}>
                            Damage Numbers
                        </span>
                        <div className={`relative w-11 h-6 rounded-full transition-all duration-300 ${showDamageNumbers ? 'bg-yellow-600/50' : 'bg-gray-800'}`}>
                            <div className={`
                                absolute top-1 w-4 h-4 rounded-full transition-all duration-300 shadow-lg
                                ${showDamageNumbers
                                    ? 'left-6 bg-gradient-to-br from-yellow-400 to-amber-500 shadow-yellow-500/50'
                                    : 'left-1 bg-gray-500'}
                            `}></div>
                        </div>
                    </button>

                    {/* Dev Mode Toggle */}
                    <button
                        onClick={onToggleDevMode}
                        className="flex items-center gap-3 bg-gray-900/80 px-4 py-2 rounded-full border border-gray-700 hover:border-gray-500 transition-colors"
                    >
                        <span className={`text-xs font-bold uppercase tracking-widest ${isDevMode ? 'text-cyan-400' : 'text-gray-500'}`}>Dev Mode</span>
                        <div className={`w-10 h-5 rounded-full p-1 transition-colors duration-300 relative ${isDevMode ? 'bg-cyan-900' : 'bg-gray-700'}`}>
                            <div className={`bg-cyan-400 w-3 h-3 rounded-full shadow-md transform transition-transform duration-300 absolute top-1 ${isDevMode ? 'left-6' : 'left-1'}`}></div>
                        </div>
                    </button>

                    {/* Dev Controls (Level Slider + Sandbox) */}
                    {isDevMode && (
                        <div className="p-4 bg-gray-900/80 border border-gray-700 rounded-lg w-64 animate-fadeIn">
                            <div className="text-yellow-500 font-bold mb-2 uppercase tracking-widest text-xs">Start Level Override</div>
                            <div className="flex items-center justify-between gap-4">
                                <span className="text-gray-300 font-mono text-sm">{startLevel}</span>
                                <input
                                    type="range" min="1" max="20" step="1"
                                    value={startLevel}
                                    onChange={(e) => onSetStartLevel(parseInt(e.target.value))}
                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                />
                            </div>

                            {/* Sandbox Toggle */}
                            <div className="mt-4 pt-3 border-t border-gray-700">
                                <button
                                    onClick={onToggleSandbox}
                                    className="flex items-center gap-3 w-full justify-between"
                                >
                                    <span className={`text-xs font-bold uppercase tracking-widest ${isSandbox ? 'text-orange-400' : 'text-gray-500'}`}>
                                        Sandbox Mode
                                    </span>
                                    <div className={`w-10 h-5 rounded-full p-1 transition-colors duration-300 relative ${isSandbox ? 'bg-orange-900' : 'bg-gray-700'}`}>
                                        <div className={`bg-orange-400 w-3 h-3 rounded-full shadow-md transform transition-transform duration-300 absolute top-1 ${isSandbox ? 'left-6' : 'left-1'}`}></div>
                                    </div>
                                </button>
                                <div className="text-gray-600 text-[10px] mt-1">Spawns test asteroids with infinite HP</div>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={onStartGame}
                        className="group relative px-12 py-4 bg-cyan-600 hover:bg-cyan-500 text-black font-bold text-xl clip-path-polygon border-none transition-all hover:scale-105 active:scale-95 uppercase tracking-widest shadow-[0_0_20px_rgba(6,182,212,0.6)]"
                        style={{ clipPath: 'polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0 30%)' }}
                    >
                        INITIATE LAUNCH
                    </button>

                    <div className="text-gray-600 text-xs mt-4">
                        OR PRESS [SPACE]
                    </div>
                </div>
            </div>
        </div>
    );

    const renderGameOver = () => (
        <div className="absolute inset-0 flex items-center justify-center bg-red-900/30 backdrop-blur-sm z-40">
            <div className="text-center text-white p-8 bg-black/80 border border-red-900/50 rounded-2xl shadow-2xl">
                <h2 className="text-5xl font-bold mb-4 text-red-500 tracking-tight">CRITICAL FAILURE</h2>
                <div className="text-lg text-gray-400 mb-1 uppercase tracking-widest text-xs">TERMINATION CAUSE</div>
                <p className="text-2xl mb-8 text-white font-mono">{deathReason}</p>

                <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">FINAL SCORE</div>
                <div className="text-4xl font-mono mb-8 text-yellow-400">{score}</div>

                <button
                    onClick={onStartGame}
                    className="mt-8 px-8 py-3 bg-transparent border border-white text-white hover:bg-white hover:text-black transition-colors uppercase tracking-widest text-sm font-bold"
                >
                    REBOOT SYSTEM
                </button>
                <div className="text-gray-500 text-xs mt-4 animate-pulse">PRESS [SPACE]</div>
            </div>
        </div>
    );

    const renderLevelUp = () => {
        const getTheme = (cat: UpgradeCategory) => {
            switch (cat) {
                case UpgradeCategory.TECH: return {
                    borderColor: 'border-green-500/30',
                    borderHover: 'group-hover:border-green-400',
                    bg: 'bg-gray-900',
                    bgHover: 'group-hover:bg-green-900/20',
                    iconBg: 'bg-green-500/10',
                    iconColor: 'text-green-400',
                    titleColor: 'text-green-400',
                    glow: 'group-hover:shadow-[0_0_30px_-5px_rgba(74,222,128,0.15)]',
                    icon: <TechIcon />
                };
                case UpgradeCategory.COMBAT: return {
                    borderColor: 'border-red-500/30',
                    borderHover: 'group-hover:border-red-400',
                    bg: 'bg-gray-900',
                    bgHover: 'group-hover:bg-red-900/20',
                    iconBg: 'bg-red-500/10',
                    iconColor: 'text-red-400',
                    titleColor: 'text-red-400',
                    glow: 'group-hover:shadow-[0_0_30px_-5px_rgba(248,113,113,0.15)]',
                    icon: <CombatIcon />
                };
                case UpgradeCategory.ADDONS: return {
                    borderColor: 'border-purple-500/30',
                    borderHover: 'group-hover:border-purple-400',
                    bg: 'bg-gray-900',
                    bgHover: 'group-hover:bg-purple-900/20',
                    iconBg: 'bg-purple-500/10',
                    iconColor: 'text-purple-400',
                    titleColor: 'text-purple-400',
                    glow: 'group-hover:shadow-[0_0_30px_-5px_rgba(192,132,252,0.15)]',
                    icon: <AddonIcon />
                };
                default: return {
                    borderColor: 'border-gray-500', borderHover: '', bg: 'bg-gray-900', bgHover: '',
                    iconBg: '', iconColor: '', titleColor: '', glow: '', icon: null
                };
            }
        };

        return (
            <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-xl z-50 animate-fadeIn">
                <div className="max-w-6xl w-full p-8 flex flex-col gap-8 h-[90vh]">

                    {/* HEADER */}
                    <div className="flex justify-between items-end border-b border-gray-800 pb-6">
                        <div>
                            <h2 className="text-5xl font-black text-white tracking-tighter mb-2">
                                SYSTEM <span className="text-yellow-400">UPGRADE</span>
                            </h2>
                            <p className="text-gray-400 font-mono text-sm tracking-widest">
                                AUGMENTATION REQUIRED <span className="text-cyan-500 mx-2">//</span> <span className="text-white">{pendingUpgrades > 0 ? `${pendingUpgrades} POINTS REMAINING` : 'SELECT MODULE'}</span>
                            </p>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">Current Level</div>
                            <div className="text-4xl font-black text-white">{level}</div>
                        </div>
                    </div>

                    <div className="flex-1 grid grid-cols-12 gap-8 min-h-0">
                        {/* LEFT COLUMN: SHIP SCHEMATICS */}
                        <div className="col-span-4 bg-gray-900/40 border border-gray-800 rounded-2xl p-6 flex flex-col gap-6 backdrop-blur-sm overflow-hidden">
                            <div className="text-xs text-gray-500 uppercase tracking-widest font-bold border-b border-gray-800 pb-3 flex justify-between items-center">
                                <span>Ship Diagnostics</span>
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            </div>

                            {ship && (
                                <>
                                    {/* Health Viz */}
                                    <div className="bg-black/40 rounded-xl p-4 border border-gray-800">
                                        <div className="flex justify-between text-xs mb-2 text-gray-400 font-mono tracking-wider">
                                            <span>HULL INTEGRITY</span>
                                            <span>{Math.round(ship.hull)} / {Math.round(ship.maxHull)}</span>
                                        </div>
                                        <div className="h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                                            <div
                                                className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-300"
                                                style={{ width: `${(ship.hull / ship.maxHull) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    {/* Stats List */}
                                    <div className="space-y-3 text-xs font-mono text-gray-300 flex-1">
                                        <div className="flex justify-between items-center p-2 rounded hover:bg-white/5 transition-colors">
                                            <span className="text-gray-500">THRUST OUTPUT</span>
                                            <span className="text-green-400 font-bold">{Math.round(ship.stats.thrustMult * 100)}%</span>
                                        </div>
                                        <div className="flex justify-between items-center p-2 rounded hover:bg-white/5 transition-colors">
                                            <span className="text-gray-500">WEAPON RATE</span>
                                            <span className="text-red-400 font-bold">{Math.round((1 / ship.stats.fireRateMult) * 100)}%</span>
                                        </div>
                                        <div className="flex justify-between items-center p-2 rounded hover:bg-white/5 transition-colors">
                                            <span className="text-gray-500">RANGE</span>
                                            <span className="text-red-400 font-bold">{Math.round((1 + ship.stats.rangeTier * 0.25) * 100)}%</span>
                                        </div>
                                        <div className="flex justify-between items-center p-2 rounded hover:bg-white/5 transition-colors">
                                            <span className="text-gray-500">DAMAGE</span>
                                            <span className="text-red-400 font-bold">{Math.round(ship.stats.damageMult * 100)}%</span>
                                        </div>
                                        <div className="flex justify-between items-center p-2 rounded hover:bg-white/5 transition-colors">
                                            <span className="text-gray-500">DRONE COUNT</span>
                                            <span className="text-purple-400 font-bold">{ship.stats.droneCount}</span>
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="mt-auto pt-6 border-t border-gray-800">
                                <div className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-4">Installed Modules</div>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(activeUpgrades).map(([id, tier]) => {
                                        // Correctly lookup definition from the global UPGRADES constant
                                        const def = UPGRADES.find(u => u.id === id) || { category: UpgradeCategory.TECH };
                                        let colorClass = 'text-gray-400 border-gray-700';
                                        if (def.category === UpgradeCategory.TECH) colorClass = 'text-green-400 border-green-900 bg-green-900/20';
                                        if (def.category === UpgradeCategory.COMBAT) colorClass = 'text-red-400 border-red-900 bg-red-900/20';
                                        if (def.category === UpgradeCategory.ADDONS) colorClass = 'text-purple-400 border-purple-900 bg-purple-900/20';

                                        return (
                                            <div key={id} className={`px-3 py-1.5 rounded text-[10px] font-mono border flex items-center gap-2 ${colorClass}`}>
                                                <span className="uppercase font-bold tracking-wider">{id.replace('_', ' ')}</span>
                                                <span className="w-px h-3 bg-current opacity-30"></span>
                                                <span className="font-bold">V{tier}</span>
                                            </div>
                                        )
                                    })}
                                    {Object.keys(activeUpgrades).length === 0 && (
                                        <div className="text-gray-600 text-[10px] italic w-full text-center py-4 border border-dashed border-gray-800 rounded">
                                            NO AUGMENTATIONS INSTALLED
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: SELECTION */}
                        <div className="col-span-8 overflow-y-auto pr-2 custom-scrollbar">
                            <div className="grid grid-cols-1 gap-4">
                                {offeredUpgrades.map((u, i) => {
                                    const theme = getTheme(u.category);
                                    const currentTier = activeUpgrades[u.id] || 0;
                                    const nextTier = currentTier + 1;

                                    return (
                                        <button
                                            key={u.id + i}
                                            onClick={() => onSelectUpgrade(u)}
                                            className={`
                                            group relative w-full text-left rounded-xl border transition-all duration-300 overflow-hidden
                                            ${theme.bg} ${theme.borderColor} ${theme.borderHover} ${theme.glow}
                                            hover:bg-opacity-100 hover:-translate-y-1 hover:scale-[1.01]
                                        `}
                                        >
                                            {/* Background Gradient Hover */}
                                            <div className={`absolute inset-0 opacity-0 ${theme.bgHover} transition-opacity duration-300`}></div>

                                            <div className="relative p-6 flex items-center gap-6 z-10">
                                                {/* ICON */}
                                                <div className={`
                                                w-16 h-16 rounded-xl flex items-center justify-center text-2xl
                                                ${theme.iconBg} ${theme.iconColor} border border-white/5
                                                group-hover:scale-110 transition-transform duration-300 shadow-inner
                                            `}>
                                                    {theme.icon}
                                                </div>

                                                {/* TEXT */}
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className={`text-xl font-bold tracking-tight group-hover:text-white transition-colors duration-200 ${theme.titleColor}`}>
                                                            {u.name}
                                                        </div>
                                                        <div className={`text-[10px] px-2 py-1 rounded border border-white/10 bg-black/20 uppercase tracking-widest ${theme.iconColor}`}>
                                                            {u.category}
                                                        </div>
                                                    </div>
                                                    <div className="text-sm text-gray-400 font-mono leading-relaxed group-hover:text-gray-300 transition-colors">
                                                        {u.description(nextTier)}
                                                    </div>
                                                </div>

                                                {/* TIER INFO */}
                                                <div className="flex flex-col items-center justify-center border-l border-white/5 pl-6 min-w-[80px]">
                                                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">TIER</div>
                                                    <div className="text-3xl font-black text-white">{currentTier}</div>
                                                    <div className="text-xs text-green-500 font-bold mt-1">▲ LVL UP</div>
                                                </div>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            {renderHUD()}
            {isDevMode && (
                <div className="absolute top-4 right-4 text-right pointer-events-none z-50">
                    <div className="text-xs text-cyan-500 mb-1 font-bold animate-pulse">DEV MODE ACTIVE</div>
                </div>
            )}
            {gameState === GameState.MENU && renderMenu()}
            {gameState === GameState.GAME_OVER && renderGameOver()}
            {gameState === GameState.LEVEL_UP && renderLevelUp()}
        </>
    );
};

export default GameUI;
