/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Play, RotateCcw, Info, ChevronRight, Gamepad2, Keyboard, ArrowLeft, ArrowRight, ArrowUp, Zap } from 'lucide-react';

// --- Constants & Types ---

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;
const GRAVITY = 0.5;
const JUMP_FORCE = -12;
const MOVE_SPEED = 5;
const GROUND_HEIGHT = 60;

const HAPPY_MEAL_FACTS = [
  "The Happy Meal was first introduced in 1979.",
  "The first Happy Meal was 'Circus Wagon' themed.",
  "McDonald's is one of the world's largest toy distributors due to Happy Meals.",
  "In 2011, McDonald's added apple slices to every Happy Meal.",
  "The iconic red box with a yellow smile was designed to be a 'meal in a box'.",
  "Happy Meals are sold in over 100 countries worldwide.",
  "The first Happy Meal toy was a 'McWrist' watch.",
  "In 2004, McDonald's introduced the 'Adult Happy Meal' called the GoActive! Happy Meal.",
  "The Happy Meal was inspired by a 'Caja Feliz' (Happy Box) created in Guatemala.",
  "McDonald's has sold billions of Happy Meals since its debut."
];

type GameState = 'START' | 'LOADING' | 'PLAYING' | 'FACT_PAUSE' | 'LEVEL_COMPLETE' | 'GAME_OVER' | 'WIN' | 'MEGA_WIN' | 'BOSS_WARNING' | 'BOSS_SELECTION';

interface GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Projectile extends GameObject {
  vx: number;
  vy: number;
  type: 'pea' | 'fry';
}

interface Platform extends GameObject {
  color: string;
  type?: 'cloud' | 'grass' | 'metal';
  speed?: number;
  range?: number;
  startX?: number;
}

interface Collectible extends GameObject {
  collected: boolean;
  factIndex: number;
}

interface Enemy extends GameObject {
  speed: number;
  range: number;
  startX: number;
  type: 'broccoli';
}

interface Boss extends GameObject {
  health: number;
  maxHealth: number;
  speed: number;
  direction: number;
  lastShot: number;
  vy: number;
  jumping: boolean;
  jumpCooldown: number;
}

interface HealItem extends GameObject {
  collected: boolean;
  type: 'burger';
}

interface LevelConfig {
  worldWidth: number;
  platforms: Platform[];
  collectibles: Collectible[];
  enemies: Enemy[];
  healItems?: HealItem[];
  hasBoss?: boolean;
}

// --- Game Component ---

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>('START');
  const [currentFact, setCurrentFact] = useState<string | null>(null);
  const [loadingFact, setLoadingFact] = useState<string>("");
  const [factTimer, setFactTimer] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [bossDifficulty, setBossDifficulty] = useState<'EASY' | 'HARD' | null>(null);
  const [showControls, setShowControls] = useState(false);
  
  // Game Logic Refs
  const playerRef = useRef({
    x: 50,
    y: CANVAS_HEIGHT - GROUND_HEIGHT - 40,
    width: 32,
    height: 32,
    dy: 0,
    jumping: false,
    facingRight: true,
    invulnerable: 0,
    lastShot: 0,
    hasBlaster: false
  });

  const keysRef = useRef<{ [key: string]: boolean }>({});
  const platformsRef = useRef<Platform[]>([]);
  const collectiblesRef = useRef<Collectible[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const healItemsRef = useRef<HealItem[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const bossRef = useRef<Boss | null>(null);
  const cameraXRef = useRef(0);
  const worldWidthRef = useRef(3000);

  const LEVELS: LevelConfig[] = [
    {
      worldWidth: 2000,
      platforms: [
        { x: 0, y: CANVAS_HEIGHT - GROUND_HEIGHT, width: 2000, height: GROUND_HEIGHT, color: '#8B4513', type: 'grass' },
        { x: 300, y: 280, width: 120, height: 20, color: '#FFC72C', type: 'cloud' },
        { x: 550, y: 220, width: 120, height: 20, color: '#FFC72C', type: 'cloud', speed: 1.5, range: 100 },
        { x: 800, y: 280, width: 120, height: 20, color: '#FFC72C', type: 'cloud' },
        { x: 1100, y: 200, width: 150, height: 20, color: '#FFC72C', type: 'cloud', speed: 2, range: 150 },
        { x: 1400, y: 250, width: 150, height: 20, color: '#FFC72C', type: 'cloud' },
      ],
      collectibles: [
        { x: 400, y: 150, width: 30, height: 30, collected: false, factIndex: 0 },
        { x: 900, y: 100, width: 30, height: 30, collected: false, factIndex: 1 },
        { x: 1500, y: 150, width: 30, height: 30, collected: false, factIndex: 2 },
        { x: 570, y: 190, width: 30, height: 30, collected: false, factIndex: 7 },
      ],
      enemies: [
        { x: 600, y: CANVAS_HEIGHT - GROUND_HEIGHT - 40, width: 40, height: 40, speed: 2, range: 100, startX: 600, type: 'broccoli' },
        { x: 1200, y: CANVAS_HEIGHT - GROUND_HEIGHT - 40, width: 40, height: 40, speed: 3, range: 150, startX: 1200, type: 'broccoli' },
        { x: 320, y: 240, width: 40, height: 40, speed: 1.5, range: 40, startX: 320, type: 'broccoli' },
        { x: 820, y: 240, width: 40, height: 40, speed: 1.5, range: 40, startX: 820, type: 'broccoli' },
        { x: 590, y: 180, width: 40, height: 40, speed: 1, range: 30, startX: 590, type: 'broccoli' },
        { x: 1150, y: 160, width: 40, height: 40, speed: 1, range: 30, startX: 1150, type: 'broccoli' },
      ]
    },
    {
      worldWidth: 2500,
      platforms: [
        { x: 0, y: CANVAS_HEIGHT - GROUND_HEIGHT, width: 2500, height: GROUND_HEIGHT, color: '#8B4513', type: 'grass' },
        { x: 200, y: 300, width: 100, height: 20, color: '#FFC72C', type: 'cloud' },
        { x: 400, y: 240, width: 100, height: 20, color: '#FFC72C', type: 'cloud', speed: 2, range: 100 },
        { x: 650, y: 180, width: 100, height: 20, color: '#FFC72C', type: 'cloud' },
        { x: 900, y: 250, width: 100, height: 20, color: '#FFC72C', type: 'cloud', speed: -1.5, range: 150 },
        { x: 1200, y: 200, width: 100, height: 20, color: '#FFC72C', type: 'cloud' },
        { x: 1500, y: 280, width: 100, height: 20, color: '#FFC72C', type: 'cloud', speed: 2.5, range: 200 },
        { x: 1800, y: 220, width: 100, height: 20, color: '#FFC72C', type: 'cloud' },
      ],
      collectibles: [
        { x: 700, y: 80, width: 30, height: 30, collected: false, factIndex: 3 },
        { x: 1300, y: 100, width: 30, height: 30, collected: false, factIndex: 4 },
        { x: 1900, y: 80, width: 30, height: 30, collected: false, factIndex: 5 },
      ],
      healItems: [
        { x: 930, y: 220, width: 40, height: 30, collected: false, type: 'burger' },
      ],
      enemies: [
        { x: 500, y: CANVAS_HEIGHT - GROUND_HEIGHT - 40, width: 40, height: 40, speed: 2, range: 100, startX: 500, type: 'broccoli' },
        { x: 1000, y: CANVAS_HEIGHT - GROUND_HEIGHT - 40, width: 40, height: 40, speed: 4, range: 200, startX: 1000, type: 'broccoli' },
        { x: 1600, y: CANVAS_HEIGHT - GROUND_HEIGHT - 40, width: 40, height: 40, speed: 3, range: 150, startX: 1600, type: 'broccoli' },
        { x: 420, y: 200, width: 40, height: 40, speed: 1.2, range: 30, startX: 420, type: 'broccoli' },
        { x: 920, y: 210, width: 40, height: 40, speed: 1.2, range: 30, startX: 920, type: 'broccoli' },
        { x: 1220, y: 160, width: 40, height: 40, speed: 1.2, range: 30, startX: 1220, type: 'broccoli' },
      ]
    },
    {
      worldWidth: 1200,
      hasBoss: true,
      platforms: [
        { x: 0, y: CANVAS_HEIGHT - GROUND_HEIGHT, width: 1200, height: GROUND_HEIGHT, color: '#8B4513', type: 'grass' },
        { x: 200, y: 250, width: 150, height: 20, color: '#FFC72C', type: 'cloud', speed: 1.5, range: 100 },
        { x: 850, y: 250, width: 150, height: 20, color: '#FFC72C', type: 'cloud' },
      ],
      collectibles: [
        { x: 600, y: 100, width: 30, height: 30, collected: false, factIndex: 6 },
      ],
      healItems: [
        { x: 600, y: 250, width: 40, height: 30, collected: false, type: 'burger' },
      ],
      enemies: []
    }
  ];

  // Initialize Level
  const initLevel = (levelIdx: number, difficulty: 'EASY' | 'HARD' | null = null) => {
    const config = LEVELS[levelIdx];
    worldWidthRef.current = config.worldWidth;
    platformsRef.current = config.platforms.map(p => ({ ...p, startX: p.x }));
    collectiblesRef.current = config.collectibles;
    
    // Add extra enemies for hard mode
    const baseEnemies = [...config.enemies];
    if (config.hasBoss && difficulty === 'HARD') {
      baseEnemies.push(
        { x: 300, y: CANVAS_HEIGHT - GROUND_HEIGHT - 40, width: 40, height: 40, speed: 2, range: 100, startX: 300, type: 'broccoli' },
        { x: 900, y: CANVAS_HEIGHT - GROUND_HEIGHT - 40, width: 40, height: 40, speed: 2, range: 100, startX: 900, type: 'broccoli' }
      );
    }
    enemiesRef.current = baseEnemies;
    
    healItemsRef.current = config.healItems ? config.healItems.map(item => ({ ...item })) : [];
    projectilesRef.current = [];
    
    if (config.hasBoss) {
      playerRef.current.hasBlaster = true;
      const bossSpeed = difficulty === 'EASY' ? 1 : 2.5;
      bossRef.current = {
        x: 800,
        y: CANVAS_HEIGHT - GROUND_HEIGHT - 100,
        width: 100,
        height: 100,
        health: 5,
        maxHealth: 5,
        speed: bossSpeed,
        direction: 1,
        lastShot: 0,
        vy: 0,
        jumping: false,
        jumpCooldown: 0
      };
    } else {
      bossRef.current = null;
    }

    playerRef.current = {
      x: 50,
      y: CANVAS_HEIGHT - GROUND_HEIGHT - 40,
      width: 32,
      height: 32,
      dy: 0,
      jumping: false,
      facingRight: true,
      invulnerable: 0,
      lastShot: 0,
      hasBlaster: config.hasBoss || false
    };
    cameraXRef.current = 0;
    
    if (levelIdx === 0) {
      setScore(0);
      setLives(3);
    }

    setLoadingFact(HAPPY_MEAL_FACTS[Math.floor(Math.random() * HAPPY_MEAL_FACTS.length)]);
    setGameState('LOADING');
    setTimeout(() => {
      if (config.hasBoss) {
        setGameState('BOSS_WARNING');
        setTimeout(() => {
          setGameState('PLAYING');
        }, 3000);
      } else {
        setGameState('PLAYING');
      }
    }, 2000);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keysRef.current[e.code] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.code] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Fact Timer Effect
  useEffect(() => {
    let interval: any;
    if (gameState === 'FACT_PAUSE' && factTimer > 0) {
      interval = setInterval(() => {
        setFactTimer(t => Math.max(0, t - 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameState, factTimer]);

  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const update = () => {
      const player = playerRef.current;
      if (player.invulnerable > 0) player.invulnerable--;

      // Movement
      if (keysRef.current['ArrowLeft'] || keysRef.current['KeyA']) {
        player.x -= MOVE_SPEED;
        player.facingRight = false;
      }
      if (keysRef.current['ArrowRight'] || keysRef.current['KeyD']) {
        player.x += MOVE_SPEED;
        player.facingRight = true;
      }

      // Jump
      if ((keysRef.current['ArrowUp'] || keysRef.current['KeyW']) && !player.jumping) {
        player.dy = JUMP_FORCE;
        player.jumping = true;
      }

      // Shooting (Fries) - Space Bar
      if (player.hasBlaster && keysRef.current['Space']) {
        const now = Date.now();
        if (now - player.lastShot > 300) {
          projectilesRef.current.push({
            x: player.facingRight ? player.x + player.width : player.x - 20,
            y: player.y + player.height / 2 - 5,
            width: 20,
            height: 10,
            vx: player.facingRight ? 8 : -8,
            vy: 0,
            type: 'fry'
          });
          player.lastShot = now;
        }
      }

      // Gravity
      player.dy += GRAVITY;
      player.y += player.dy;

      // Update and Collision with Platforms
      platformsRef.current.forEach(platform => {
        // Move Platform
        if (platform.speed && platform.startX !== undefined && platform.range !== undefined) {
          const oldX = platform.x;
          platform.x += platform.speed;
          if (Math.abs(platform.x - platform.startX) > platform.range) {
            platform.speed *= -1;
          }
          
          // If player is standing on this platform, move them with it
          if (
            !player.jumping &&
            player.dy === 0 &&
            player.x + player.width > oldX &&
            player.x < oldX + platform.width &&
            Math.abs(player.y + player.height - platform.y) < 2
          ) {
            player.x += (platform.x - oldX);
          }

          // If enemies are standing on this platform, move them with it
          enemiesRef.current.forEach(enemy => {
            if (
              enemy.x + enemy.width > oldX &&
              enemy.x < oldX + platform.width &&
              Math.abs(enemy.y + enemy.height - platform.y) < 2
            ) {
              const dx = platform.x - oldX;
              enemy.x += dx;
              enemy.startX += dx;
            }
          });

          // If collectibles are standing on this platform, move them with it
          collectiblesRef.current.forEach(collectible => {
            if (
              !collectible.collected &&
              collectible.x + collectible.width > oldX &&
              collectible.x < oldX + platform.width &&
              Math.abs(collectible.y + collectible.height - platform.y) < 2
            ) {
              collectible.x += (platform.x - oldX);
            }
          });

          // If heal items are standing on this platform, move them with it
          healItemsRef.current.forEach(item => {
            if (
              !item.collected &&
              item.x + item.width > oldX &&
              item.x < oldX + platform.width &&
              Math.abs(item.y + item.height - platform.y) < 2
            ) {
              item.x += (platform.x - oldX);
            }
          });

          // If boss is standing on this platform, move them with it
          if (bossRef.current) {
            const boss = bossRef.current;
            if (
              !boss.jumping &&
              boss.vy === 0 &&
              boss.x + boss.width > oldX &&
              boss.x < oldX + platform.width &&
              Math.abs(boss.y + boss.height - platform.y) < 2
            ) {
              boss.x += (platform.x - oldX);
            }
          }
        }

        // Collision
        if (
          player.dy >= 0 &&
          player.x + player.width > platform.x &&
          player.x < platform.x + platform.width &&
          player.y + player.height >= platform.y &&
          player.y + player.height <= platform.y + player.dy + 5
        ) {
          player.y = platform.y - player.height;
          player.dy = 0;
          player.jumping = false;
        }
      });

      // World Bounds
      if (player.x < 0) player.x = 0;
      if (player.x > worldWidthRef.current - player.width) {
        if (currentLevel < LEVELS.length - 1) {
          setGameState('LEVEL_COMPLETE');
        } else if (!LEVELS[currentLevel].hasBoss) {
          setGameState('MEGA_WIN');
        }
      }

      // Fall off
      if (player.y > CANVAS_HEIGHT) {
        handleDeath();
      }

      // Camera
      cameraXRef.current = Math.max(0, Math.min(player.x - CANVAS_WIDTH / 2, worldWidthRef.current - CANVAS_WIDTH));

      // Collectibles
      collectiblesRef.current.forEach(collectible => {
        if (!collectible.collected && 
            player.x < collectible.x + collectible.width &&
            player.x + player.width > collectible.x &&
            player.y < collectible.y + collectible.height &&
            player.y + player.height > collectible.y) {
          collectible.collected = true;
          setScore(s => s + 1);
          setCurrentFact(HAPPY_MEAL_FACTS[collectible.factIndex]);
          setFactTimer(3);
          setGameState('FACT_PAUSE');
        }
      });

      // Heal Items
      healItemsRef.current.forEach(item => {
        if (!item.collected && 
            player.x < item.x + item.width &&
            player.x + player.width > item.x &&
            player.y < item.y + item.height &&
            player.y + player.height > item.y) {
          item.collected = true;
          setLives(l => Math.min(l + 1, 3)); // Max 3 lives
        }
      });

      // Projectiles Update
      projectilesRef.current.forEach((proj, pIdx) => {
        proj.x += proj.vx;
        proj.y += proj.vy;

        // Remove if off screen
        if (proj.x < cameraXRef.current - 100 || proj.x > cameraXRef.current + CANVAS_WIDTH + 100) {
          projectilesRef.current.splice(pIdx, 1);
          return;
        }

        // Collision with player (Peas)
        if (proj.type === 'pea' && player.invulnerable === 0 &&
            player.x < proj.x + proj.width &&
            player.x + player.width > proj.x &&
            player.y < proj.y + proj.height &&
            player.y + player.height > proj.y) {
          handleDeath();
          projectilesRef.current.splice(pIdx, 1);
          return;
        }

        // Collision with Boss (Fries)
        if (proj.type === 'fry' && bossRef.current) {
          const boss = bossRef.current;
          if (proj.x < boss.x + boss.width &&
              proj.x + proj.width > boss.x &&
              proj.y < boss.y + boss.height &&
              proj.y + proj.height > boss.y) {
            boss.health -= 0.5;
            projectilesRef.current.splice(pIdx, 1);
            if (boss.health <= 0) {
              setGameState('MEGA_WIN');
            }
            return;
          }
        }
      });

      // Enemies
      enemiesRef.current.forEach((enemy, index) => {
        enemy.x += enemy.speed;
        if (Math.abs(enemy.x - enemy.startX) > enemy.range) {
          enemy.speed *= -1;
        }

        // Collision with player
        if (player.invulnerable === 0 &&
            player.x < enemy.x + enemy.width &&
            player.x + player.width > enemy.x &&
            player.y < enemy.y + enemy.height &&
            player.y + player.height > enemy.y) {
          
          // Stomp logic for broccoli
          if (player.dy > 0 && player.y + player.height < enemy.y + 20) {
            enemiesRef.current.splice(index, 1);
            player.dy = -8; // Bounce
          } else {
            handleDeath();
          }
        }
      });

      // Boss Logic
      if (bossRef.current) {
        const boss = bossRef.current;
        
        // Horizontal Movement
        boss.x += boss.speed * boss.direction;
        if (boss.x > worldWidthRef.current - boss.width - 50 || boss.x < 400) {
          boss.direction *= -1;
        }

        // Boss Gravity & Jumping
        boss.vy += GRAVITY;
        boss.y += boss.vy;

        // Boss Platform Collision
        platformsRef.current.forEach(platform => {
          if (
            boss.vy >= 0 &&
            boss.x + boss.width > platform.x &&
            boss.x < platform.x + platform.width &&
            boss.y + boss.height >= platform.y &&
            boss.y + boss.height <= platform.y + boss.vy + 5
          ) {
            boss.y = platform.y - boss.height;
            boss.vy = 0;
            boss.jumping = false;
          }
        });

        // Occasional Jump
        if (!boss.jumping && boss.jumpCooldown <= 0) {
          // Jump if player is nearby or just randomly
          const distToPlayer = Math.abs(player.x - boss.x);
          const jumpChance = bossDifficulty === 'HARD' ? 0.04 : 0.02;
          if (distToPlayer < 300 && Math.random() < jumpChance) {
            boss.vy = -10;
            boss.jumping = true;
            boss.jumpCooldown = bossDifficulty === 'HARD' ? 60 : 120; // 1s vs 2s
          }
        }
        if (boss.jumpCooldown > 0) boss.jumpCooldown--;

        // Shooting (Aimed Peas)
        const now = Date.now();
        const shotInterval = bossDifficulty === 'HARD' ? 800 : 1500;
        if (now - boss.lastShot > shotInterval) {
          const dx = (player.x + player.width / 2) - (boss.x + boss.width / 2);
          const dy = (player.y + player.height / 2) - (boss.y + boss.height / 2);
          const dist = Math.sqrt(dx * dx + dy * dy);
          const speed = 6;
          
          projectilesRef.current.push({
            x: boss.x + boss.width / 2,
            y: boss.y + boss.height / 2,
            width: 20,
            height: 20,
            vx: (dx / dist) * speed,
            vy: (dy / dist) * speed,
            type: 'pea'
          });
          boss.lastShot = now;
        }

        // Collision with boss (Stomp)
        if (player.invulnerable === 0 &&
            player.x < boss.x + boss.width &&
            player.x + player.width > boss.x &&
            player.y < boss.y + boss.height &&
            player.y + player.height > boss.y) {
          
          if (player.dy > 0 && player.y + player.height < boss.y + 30) {
            boss.health -= 1;
            player.dy = -10;
            player.invulnerable = 60;
            if (boss.health <= 0) {
              setGameState('MEGA_WIN');
            }
          } else {
            handleDeath();
          }
        }
      }
    };

    const handleDeath = () => {
      setLives(l => {
        if (l <= 1) {
          setGameState('GAME_OVER');
          return 0;
        }
        playerRef.current.x = Math.max(50, playerRef.current.x - 200);
        playerRef.current.y = 0;
        playerRef.current.dy = 0;
        playerRef.current.invulnerable = 120;
        return l - 1;
      });
    };

    const draw = () => {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      ctx.save();
      ctx.translate(-cameraXRef.current, 0);

      // Background (Playful Sky & Hills)
      const skyGradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      skyGradient.addColorStop(0, '#87CEEB');
      skyGradient.addColorStop(1, '#E0F6FF');
      ctx.fillStyle = skyGradient;
      ctx.fillRect(cameraXRef.current, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Distant Hills
      ctx.fillStyle = '#90EE9044';
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(cameraXRef.current * 0.5 + i * 400, CANVAS_HEIGHT - 50, 200, 0, Math.PI * 2);
        ctx.fill();
      }

      // Platforms
      platformsRef.current.forEach(p => {
        if (p.type === 'grass') {
          // Ground with grass top
          ctx.fillStyle = '#8B4513';
          ctx.fillRect(p.x, p.y + 10, p.width, p.height - 10);
          ctx.fillStyle = '#228B22';
          ctx.fillRect(p.x, p.y, p.width, 10);
          // Grass tufts
          ctx.beginPath();
          for (let x = p.x; x < p.x + p.width; x += 20) {
            ctx.moveTo(x, p.y);
            ctx.lineTo(x + 5, p.y - 5);
            ctx.lineTo(x + 10, p.y);
          }
          ctx.fill();
        } else {
          // Cloud platform
          ctx.fillStyle = 'white';
          ctx.beginPath();
          ctx.roundRect(p.x, p.y, p.width, p.height, 10);
          ctx.fill();
          ctx.strokeStyle = '#FFC72C';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });

      // Collectibles
      collectiblesRef.current.forEach(c => {
        if (!c.collected) {
          ctx.fillStyle = '#DA291C';
          ctx.beginPath();
          ctx.roundRect(c.x, c.y, c.width, c.height, 5);
          ctx.fill();
          ctx.strokeStyle = '#FFC72C';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(c.x + 5, c.y + 5);
          ctx.lineTo(c.x + 15, c.y - 5);
          ctx.lineTo(c.x + 25, c.y + 5);
          ctx.stroke();
        }
      });

      // Heal Items (Burger)
      healItemsRef.current.forEach(item => {
        if (!item.collected) {
          // Bun top
          ctx.fillStyle = '#E5A04D';
          ctx.beginPath();
          ctx.arc(item.x + item.width / 2, item.y + 10, item.width / 2, Math.PI, 0);
          ctx.fill();
          // Meat
          ctx.fillStyle = '#8B4513';
          ctx.fillRect(item.x, item.y + 10, item.width, 8);
          // Cheese
          ctx.fillStyle = '#FFC72C';
          ctx.fillRect(item.x, item.y + 18, item.width, 4);
          // Bun bottom
          ctx.fillStyle = '#E5A04D';
          ctx.fillRect(item.x, item.y + 22, item.width, 8);
          
          // Sesame seeds
          ctx.fillStyle = 'white';
          for (let i = 0; i < 5; i++) {
            ctx.fillRect(item.x + 5 + i * 7, item.y + 5, 2, 2);
          }
        }
      });

      // Enemies
      enemiesRef.current.forEach(e => {
        // Angry Broccoli
        ctx.fillStyle = '#228B22';
        ctx.fillRect(e.x + 12, e.y + 20, 16, 20);
        ctx.beginPath();
        ctx.arc(e.x + 20, e.y + 15, 20, 0, Math.PI * 2);
        ctx.fill();
        
        // Angry Face
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(e.x + 12, e.y + 12, 5, 0, Math.PI * 2);
        ctx.arc(e.x + 28, e.y + 12, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(e.x + 12, e.y + 12, 2, 0, Math.PI * 2);
        ctx.arc(e.x + 28, e.y + 12, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Angry Brows
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(e.x + 5, e.y + 5);
        ctx.lineTo(e.x + 15, e.y + 10);
        ctx.moveTo(e.x + 35, e.y + 5);
        ctx.lineTo(e.x + 25, e.y + 10);
        ctx.stroke();
        
        // Frown
        ctx.beginPath();
        ctx.arc(e.x + 20, e.y + 25, 5, Math.PI, 0);
        ctx.stroke();
      });

      // Projectiles
      projectilesRef.current.forEach(proj => {
        if (proj.type === 'pea') {
          ctx.fillStyle = '#32CD32';
          ctx.beginPath();
          ctx.arc(proj.x + proj.width / 2, proj.y + proj.height / 2, proj.width / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'black';
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          // Fry
          ctx.fillStyle = '#FFC72C';
          ctx.fillRect(proj.x, proj.y, proj.width, proj.height);
          ctx.strokeStyle = '#DA291C';
          ctx.strokeRect(proj.x, proj.y, proj.width, proj.height);
        }
      });

      // Boss (Giant Pea)
      if (bossRef.current) {
        const b = bossRef.current;
        ctx.fillStyle = '#32CD32';
        ctx.beginPath();
        ctx.arc(b.x + b.width / 2, b.y + b.height / 2, b.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#006400';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Boss Face
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(b.x + 30, b.y + 40, 15, 0, Math.PI * 2);
        ctx.arc(b.x + 70, b.y + 40, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(b.x + 30, b.y + 40, 6, 0, Math.PI * 2);
        ctx.arc(b.x + 70, b.y + 40, 6, 0, Math.PI * 2);
        ctx.fill();

        // Health Bar
        ctx.fillStyle = 'red';
        ctx.fillRect(b.x, b.y - 20, b.width, 10);
        ctx.fillStyle = 'green';
        ctx.fillRect(b.x, b.y - 20, b.width * (b.health / b.maxHealth), 10);
      }

      // Player (Chicken Nugget)
      const p = playerRef.current;
      if (p.invulnerable % 10 < 5) {
        ctx.fillStyle = '#E5A04D';
        ctx.beginPath();
        ctx.roundRect(p.x, p.y, p.width, p.height, 8);
        ctx.fill();
        ctx.strokeStyle = '#B8860B';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Blaster
        if (p.hasBlaster) {
          ctx.fillStyle = '#DA291C';
          const blasterX = p.facingRight ? p.x + p.width - 5 : p.x - 15;
          ctx.fillRect(blasterX, p.y + p.height / 2 - 5, 20, 10);
          ctx.fillStyle = '#FFC72C';
          ctx.fillRect(blasterX + (p.facingRight ? 15 : 0), p.y + p.height / 2 - 2, 5, 4);
        }
        
        ctx.fillStyle = 'white';
        const eyeX = p.facingRight ? p.x + 20 : p.x + 5;
        ctx.beginPath();
        ctx.arc(eyeX, p.y + 10, 4, 0, Math.PI * 2);
        ctx.arc(eyeX + 8, p.y + 10, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(eyeX + (p.facingRight ? 2 : -2), p.y + 10, 2, 0, Math.PI * 2);
        ctx.arc(eyeX + 8 + (p.facingRight ? 2 : -2), p.y + 10, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x + 16, p.y + 20, 6, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.stroke();
      }

      ctx.restore();

      // UI
      ctx.fillStyle = 'black';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(`Happy Meals: ${score}`, 20, 30);
      ctx.fillText(`Lives: ${'❤️'.repeat(lives)}`, 20, 55);
      ctx.fillText(`Level: ${currentLevel + 1}`, 20, 80);

      if (gameState === 'PLAYING') {
        update();
        animationFrameId = requestAnimationFrame(draw);
      }
    };

    draw();
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState, score, lives, currentLevel, bossDifficulty]);

  const startGame = () => {
    setBossDifficulty(null);
    setCurrentLevel(0);
    initLevel(0);
  };

  const resumeGame = () => {
    setGameState('PLAYING');
    setCurrentFact(null);
  };

  return (
    <div className="min-h-screen bg-[#DA291C] flex flex-items-center justify-center p-4 font-sans text-white">
      <div className="relative max-w-4xl w-full bg-white rounded-3xl overflow-hidden shadow-2xl border-8 border-[#FFC72C]">
        
        <canvas 
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-auto block"
        />

        {gameState === 'PLAYING' && (
          <div className="absolute top-4 right-4 z-50">
            <button 
              onClick={() => setShowControls(!showControls)}
              className="bg-white/20 backdrop-blur-md p-3 rounded-full hover:bg-white/40 border-2 border-white/50 transition-all active:scale-95"
              title={showControls ? "Hide Touch Controls" : "Show Touch Controls"}
            >
              {showControls ? <Keyboard className="text-white" size={24} /> : <Gamepad2 className="text-white" size={24} />}
            </button>
          </div>
        )}

        <AnimatePresence>
          {gameState === 'PLAYING' && showControls && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute inset-0 pointer-events-none z-40 flex flex-col justify-end p-6"
            >
              <div className="flex justify-between items-end w-full">
                {/* Movement Controls */}
                <div className="flex gap-4 pointer-events-auto">
                  <button
                    onPointerDown={() => keysRef.current['ArrowLeft'] = true}
                    onPointerUp={() => keysRef.current['ArrowLeft'] = false}
                    onPointerLeave={() => keysRef.current['ArrowLeft'] = false}
                    className="w-20 h-20 bg-black/40 backdrop-blur-lg rounded-2xl flex items-center justify-center border-2 border-white/30 active:bg-white/20 active:scale-95 transition-all"
                  >
                    <ArrowLeft size={40} className="text-white" />
                  </button>
                  <button
                    onPointerDown={() => keysRef.current['ArrowRight'] = true}
                    onPointerUp={() => keysRef.current['ArrowRight'] = false}
                    onPointerLeave={() => keysRef.current['ArrowRight'] = false}
                    className="w-20 h-20 bg-black/40 backdrop-blur-lg rounded-2xl flex items-center justify-center border-2 border-white/30 active:bg-white/20 active:scale-95 transition-all"
                  >
                    <ArrowRight size={40} className="text-white" />
                  </button>
                </div>

                {/* Jump & Shoot Controls */}
                <div className="flex gap-4 pointer-events-auto">
                  {playerRef.current.hasBlaster && (
                    <button
                      onPointerDown={() => keysRef.current['Space'] = true}
                      onPointerUp={() => keysRef.current['Space'] = false}
                      onPointerLeave={() => keysRef.current['Space'] = false}
                      className="w-20 h-20 bg-red-600/60 backdrop-blur-lg rounded-full flex items-center justify-center border-2 border-white/30 active:bg-red-500/80 active:scale-90 transition-all shadow-xl"
                    >
                      <Zap size={40} className="text-white" />
                    </button>
                  )}
                  <button
                    onPointerDown={() => keysRef.current['ArrowUp'] = true}
                    onPointerUp={() => keysRef.current['ArrowUp'] = false}
                    onPointerLeave={() => keysRef.current['ArrowUp'] = false}
                    className="w-24 h-24 bg-[#FFC72C]/60 backdrop-blur-lg rounded-full flex items-center justify-center border-4 border-white/50 active:bg-[#FFC72C]/80 active:scale-90 transition-all shadow-2xl"
                  >
                    <ArrowUp size={48} className="text-white" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {gameState === 'START' && (
            <motion.div 
              key="start"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#DA291C] flex flex-col items-center justify-center text-center p-8"
            >
              <motion.div
                animate={{ y: [0, -15, 0], rotate: [0, 5, -5, 0] }}
                transition={{ repeat: Infinity, duration: 3 }}
                className="w-32 h-32 bg-[#E5A04D] rounded-2xl mb-6 border-4 border-[#FFC72C] flex items-center justify-center shadow-lg"
              >
                <div className="flex gap-2">
                  <div className="w-3 h-3 bg-black rounded-full" />
                  <div className="w-3 h-3 bg-black rounded-full" />
                </div>
              </motion.div>
              <h1 className="text-6xl font-black mb-4 tracking-tighter text-[#FFC72C] drop-shadow-lg">
                NUGGET RUN
              </h1>
              <p className="text-xl mb-8 font-medium max-w-md">
                Help the Chicken Nugget defeat the Giant Pea and discover Happy Meal secrets!
              </p>
              <button 
                onClick={startGame}
                className="bg-[#FFC72C] text-[#DA291C] px-10 py-5 rounded-full text-3xl font-black flex items-center gap-3 hover:scale-110 transition-transform shadow-2xl"
              >
                <Play fill="currentColor" size={32} /> START ORDER
              </button>
            </motion.div>
          )}

          {gameState === 'LOADING' && (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#DA291C] flex flex-col items-center justify-center text-center p-12"
            >
              <div className="mb-8">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="w-20 h-20 border-8 border-[#FFC72C] border-t-transparent rounded-full mx-auto" 
                />
              </div>
              <h2 className="text-4xl font-black mb-8 text-[#FFC72C] tracking-tight">LEVEL {currentLevel + 1} LOADING...</h2>
              <div className="bg-white text-[#DA291C] p-10 rounded-[2.5rem] max-w-xl w-full shadow-2xl border-4 border-[#FFC72C]">
                <div className="flex items-center gap-3 mb-6 justify-center">
                  <Info className="text-[#DA291C]" size={28} />
                  <span className="font-black uppercase tracking-[0.2em] text-sm">Happy Meal Fact</span>
                </div>
                <p className="text-2xl font-bold leading-relaxed text-gray-800 italic">
                  "{loadingFact}"
                </p>
              </div>
            </motion.div>
          )}

          {gameState === 'FACT_PAUSE' && (
            <motion.div 
              key="fact"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center p-6 bg-black/60 backdrop-blur-md"
            >
              <div className="bg-white text-[#DA291C] p-10 rounded-[3rem] max-w-md w-full shadow-2xl border-8 border-[#FFC72C]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-[#DA291C] p-3 rounded-2xl">
                    <Info className="text-white" size={32} />
                  </div>
                  <h2 className="text-3xl font-black uppercase tracking-tight">Secret Found!</h2>
                </div>
                <p className="text-2xl font-bold leading-relaxed mb-10 text-gray-800 italic">
                  "{currentFact}"
                </p>
                <button 
                  onClick={resumeGame}
                  disabled={factTimer > 0}
                  className={`w-full py-5 rounded-2xl text-2xl font-black flex items-center justify-center gap-2 transition-all shadow-lg ${
                    factTimer > 0 
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                    : 'bg-[#FFC72C] text-[#DA291C] hover:bg-[#f0ba28]'
                  }`}
                >
                  {factTimer > 0 ? `READING... (${factTimer}s)` : 'KEEP GOING'} <ChevronRight size={32} />
                </button>
              </div>
            </motion.div>
          )}

          {gameState === 'BOSS_WARNING' && (
            <motion.div 
              key="bosswarning"
              initial={{ opacity: 0, scale: 2 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="absolute inset-0 bg-[#DA291C] flex flex-col items-center justify-center text-center p-8"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 0.5 }}
                className="text-white mb-8"
              >
                <Info size={120} />
              </motion.div>
              <h2 className="text-7xl font-black mb-4 text-[#FFC72C] tracking-tighter italic">
                WARNING!
              </h2>
              <p className="text-4xl font-black text-white uppercase tracking-widest">
                THE GIANT PEA IS APPROACHING!
              </p>
              <div className="mt-12 w-64 h-4 bg-black/20 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 3, ease: "linear" }}
                  className="h-full bg-[#FFC72C]"
                />
              </div>
            </motion.div>
          )}

          {gameState === 'LEVEL_COMPLETE' && (
            <motion.div 
              key="levelcomplete"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-[#FFC72C] flex flex-col items-center justify-center text-center p-8 text-[#DA291C]"
            >
              <h2 className="text-6xl font-black mb-4 tracking-tighter">LEVEL {currentLevel + 1} COMPLETE!</h2>
              <p className="text-2xl mb-8 font-bold">You're getting closer to the Golden Arches!</p>
              <button 
                onClick={() => {
                  const nextLevel = currentLevel + 1;
                  if (LEVELS[nextLevel].hasBoss) {
                    setGameState('BOSS_SELECTION');
                  } else {
                    setCurrentLevel(nextLevel);
                    initLevel(nextLevel);
                  }
                }}
                className="bg-[#DA291C] text-white px-12 py-6 rounded-full text-3xl font-black flex items-center gap-4 hover:scale-110 transition-transform shadow-2xl"
              >
                NEXT LEVEL <ChevronRight size={40} />
              </button>
            </motion.div>
          )}

          {gameState === 'BOSS_SELECTION' && (
            <motion.div 
              key="bossselection"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 bg-[#DA291C] flex flex-col items-center justify-center text-center p-8 text-white"
            >
              <h2 className="text-6xl font-black mb-8 tracking-tighter text-[#FFC72C]">CHOOSE YOUR CHALLENGE</h2>
              <div className="flex gap-8">
                <button 
                  onClick={() => {
                    setBossDifficulty('EASY');
                    setCurrentLevel(currentLevel + 1);
                    initLevel(currentLevel + 1, 'EASY');
                  }}
                  className="bg-green-500 text-white px-10 py-8 rounded-3xl text-3xl font-black flex flex-col items-center gap-4 hover:scale-110 transition-transform shadow-2xl border-4 border-white"
                >
                  <div className="text-5xl">🥗</div>
                  EASY
                  <span className="text-sm font-bold opacity-80 uppercase tracking-widest">Slow Boss</span>
                </button>
                <button 
                  onClick={() => {
                    setBossDifficulty('HARD');
                    setCurrentLevel(currentLevel + 1);
                    initLevel(currentLevel + 1, 'HARD');
                  }}
                  className="bg-black text-white px-10 py-8 rounded-3xl text-3xl font-black flex flex-col items-center gap-4 hover:scale-110 transition-transform shadow-2xl border-4 border-[#FFC72C]"
                >
                  <div className="text-5xl">🥦🔥</div>
                  HARDER
                  <span className="text-sm font-bold opacity-80 uppercase tracking-widest">Fast Boss + Minions</span>
                </button>
              </div>
            </motion.div>
          )}

          {gameState === 'MEGA_WIN' && (
            <motion.div 
              key="megawin"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 bg-[#DA291C] flex flex-col items-center justify-center text-center p-8 text-white"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 5, ease: "linear" }}
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{ background: 'radial-gradient(circle, #FFC72C 0%, transparent 70%)' }}
              />
              <Trophy size={150} className="mb-8 text-[#FFC72C]" />
              <h2 className="text-8xl font-black mb-6 tracking-tighter text-[#FFC72C]">ULTIMATE VICTORY!</h2>
              <p className="text-3xl mb-12 font-black max-w-2xl">
                The Giant Pea has been defeated! You are the true Happy Meal Hero!
              </p>
              <div className="bg-white text-[#DA291C] p-10 rounded-[3rem] mb-12 shadow-2xl border-8 border-[#FFC72C]">
                <h3 className="text-3xl font-black mb-2">GRAND TOTAL</h3>
                <div className="text-7xl font-black">{score} Happy Meals Discovered</div>
              </div>
              <button 
                onClick={startGame}
                className="bg-[#FFC72C] text-[#DA291C] px-16 py-8 rounded-full text-4xl font-black flex items-center gap-6 hover:scale-110 transition-transform shadow-2xl"
              >
                <RotateCcw size={50} /> START OVER
              </button>
            </motion.div>
          )}

          {gameState === 'GAME_OVER' && (
            <motion.div 
              key="gameover"
              initial={{ opacity: 0, scale: 1.2 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-center p-8"
            >
              <h2 className="text-8xl font-black mb-6 text-[#DA291C] tracking-tighter">GAME OVER</h2>
              <p className="text-3xl mb-12 font-bold">The veggies were too strong!</p>
              <button 
                onClick={startGame}
                className="bg-[#FFC72C] text-[#DA291C] px-12 py-6 rounded-full text-3xl font-black flex items-center gap-4 hover:scale-110 transition-transform shadow-2xl"
              >
                <RotateCcw size={40} /> RE-ORDER
              </button>
            </motion.div>
          )}

          {gameState === 'WIN' && (
            <motion.div 
              key="win"
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute inset-0 bg-[#FFC72C] flex flex-col items-center justify-center text-center p-8 text-[#DA291C]"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
              >
                <Trophy size={120} className="mb-8" />
              </motion.div>
              <h2 className="text-7xl font-black mb-6 tracking-tighter">VICTORY!</h2>
              <p className="text-3xl mb-12 font-black">You defeated the Giant Pea!</p>
              <div className="bg-white p-8 rounded-[2.5rem] mb-12 shadow-xl border-4 border-[#DA291C]">
                <h3 className="text-2xl font-black mb-2 opacity-70">FINAL SCORE</h3>
                <div className="text-6xl font-black">{score} Happy Meals Found</div>
              </div>
              <button 
                onClick={startGame}
                className="bg-[#DA291C] text-white px-12 py-6 rounded-full text-3xl font-black flex items-center gap-4 hover:scale-110 transition-transform shadow-2xl"
              >
                <RotateCcw size={40} /> PLAY AGAIN
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="bg-[#FFC72C] p-4 flex justify-between items-center px-8 text-[#DA291C] font-black text-sm tracking-widest">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-[#DA291C] rounded-full animate-pulse shadow-sm" />
            NUGGET QUEST v2.0
          </div>
          <div className="opacity-80">MCDONALD'S FAN ADVENTURE</div>
        </div>
      </div>
    </div>
  );
}
