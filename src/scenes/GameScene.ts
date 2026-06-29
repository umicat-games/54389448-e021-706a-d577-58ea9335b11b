import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

// ─── Map constants ────────────────────────────────────────────────────────────
const TILE = 32;
const COLS = 26;
const ROWS = 20;
const MAP_X = Math.floor((GAME_WIDTH - COLS * TILE) / 2); // 192
const MAP_Y = 40;

// 0=empty 1=brick 2=steel
const BASE_MAP: number[][] = [
  [0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0],
  [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],
  [0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,2,2,0,0,1,1,0,0,0,0,0,2,2,0,0,0,0,1,1,0,0,2,2,0,0],
  [0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],
  [0,0,1,1,0,1,1,0,0,2,2,0,0,0,0,0,2,2,1,1,0,0,1,1,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,1,1,0,0,0,0,2,2,0,0,1,1,0,0,2,2,0,0,0,0,1,1,0,0],
  [0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0],
  [0,0,1,1,0,0,0,0,2,2,0,0,1,1,0,0,2,2,0,0,0,0,1,1,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,1,1,0,0,1,1,0,0,2,2,0,0,2,2,0,0,1,1,0,0,1,1,0,0],
  [0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],
  [0,2,2,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,0,2,2,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,1,1,0,0,1,1,1,0,0,0,1,1,1,0,1,1,0,0,0,0,0],
  [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0],
];

type Dir = 'up' | 'down' | 'left' | 'right';
type EnemyKind = 'normal' | 'armored';

interface Enemy {
  sprite: Phaser.Physics.Arcade.Sprite;
  kind: EnemyKind;
  hp: number;
  dir: Dir;
  moveTick: number;
  shootTick: number;
  flashTimer: number;
}

export class GameScene extends Phaser.Scene {
  // ── Groups ───────────────────────────────────────────────────────────────
  private bricks!: Phaser.Physics.Arcade.StaticGroup;
  private steels!: Phaser.Physics.Arcade.StaticGroup;
  private playerBullets!: Phaser.Physics.Arcade.Group;
  private enemyBullets!: Phaser.Physics.Arcade.Group;

  // ── Player ───────────────────────────────────────────────────────────────
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerDir: Dir = 'up';
  private playerShootCooldown = 0;
  private playerInvincible = 0;
  private playerAlive = true;
  private respawnTimer = 0;

  // ── Enemies ──────────────────────────────────────────────────────────────
  private enemyGroup!: Phaser.Physics.Arcade.Group;
  private enemies: Enemy[] = [];
  private enemySpawnQueue = 0;
  private enemySpawnTimer = 0;
  private totalEnemiesThisLevel = 0;
  private enemiesDefeated = 0;

  // ── Base ─────────────────────────────────────────────────────────────────
  private base!: Phaser.GameObjects.Image;
  private baseAlive = true;

  // ── Input ────────────────────────────────────────────────────────────────
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private spaceKey!: Phaser.Input.Keyboard.Key;

  // ── State ────────────────────────────────────────────────────────────────
  private score = 0;
  private lives = 3;
  private level = 1;
  private state: 'playing' | 'levelComplete' | 'gameOver' = 'playing';
  private stateTimer = 0;
  private gameOverCooldown = 0; // ms since entering gameOver — prevents instant restart

  // ── HUD ──────────────────────────────────────────────────────────────────
  private scoreText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private enemyCountText!: Phaser.GameObjects.Text;
  private overlayText!: Phaser.GameObjects.Text;

  // ── Map state ────────────────────────────────────────────────────────────
  private mapData: (number | null)[][] = [];

  constructor() {
    super({ key: 'GameScene' });
  }

  // ─── Texture creation ─────────────────────────────────────────────────────
  private makeTextures(): void {
    // ── Player tank (facing up) ──────────────────────────────────────────
    {
      const g = this.make.graphics({ add: false });
      // tracks
      g.fillStyle(0x2d3a1a);
      g.fillRect(0, 4, 5, 24);
      g.fillRect(23, 4, 5, 24);
      // body
      g.fillStyle(0x4a6e28);
      g.fillRect(5, 6, 18, 20);
      // highlight
      g.fillStyle(0x5d8a32);
      g.fillRect(6, 7, 8, 8);
      // turret
      g.fillStyle(0x3d5c1e);
      g.fillRect(10, 8, 8, 8);
      // barrel
      g.fillStyle(0x2a3d14);
      g.fillRect(13, 0, 4, 14);
      // track details
      g.fillStyle(0x1a2210);
      for (let i = 0; i < 4; i++) {
        g.fillRect(0, 6 + i * 6, 5, 2);
        g.fillRect(23, 6 + i * 6, 5, 2);
      }
      g.generateTexture('tank-player', 28, 28);
      g.destroy();
    }

    // ── Enemy tank normal (facing UP, same orientation as player) ────────
    {
      const g = this.make.graphics({ add: false });
      // tracks
      g.fillStyle(0x1a3a1a);
      g.fillRect(0, 4, 5, 24);
      g.fillRect(23, 4, 5, 24);
      // body
      g.fillStyle(0x2a5e2a);
      g.fillRect(5, 6, 18, 20);
      // highlight
      g.fillStyle(0x3a7a3a);
      g.fillRect(6, 7, 8, 8);
      // turret
      g.fillStyle(0x1e4a1e);
      g.fillRect(10, 8, 8, 8);
      // barrel — pointing UP (y=0 to y=14, same as player)
      g.fillStyle(0x122812);
      g.fillRect(13, 0, 4, 14);
      // track details
      g.fillStyle(0x0d1a0d);
      for (let i = 0; i < 4; i++) {
        g.fillRect(0, 6 + i * 6, 5, 2);
        g.fillRect(23, 6 + i * 6, 5, 2);
      }
      g.generateTexture('tank-enemy-normal', 28, 28);
      g.destroy();
    }

    // ── Enemy tank armored (facing UP, same orientation as player) ────────
    {
      const g = this.make.graphics({ add: false });
      // tracks
      g.fillStyle(0x3a1a1a);
      g.fillRect(0, 4, 5, 24);
      g.fillRect(23, 4, 5, 24);
      // body
      g.fillStyle(0x8a2a2a);
      g.fillRect(5, 6, 18, 20);
      // highlight
      g.fillStyle(0xaa3a3a);
      g.fillRect(6, 7, 8, 8);
      // turret
      g.fillStyle(0x6e1e1e);
      g.fillRect(10, 8, 8, 8);
      // barrel — pointing UP (y=0 to y=14, same as player)
      g.fillStyle(0x4a1212);
      g.fillRect(13, 0, 4, 14);
      // track details
      g.fillStyle(0x2a0808);
      for (let i = 0; i < 4; i++) {
        g.fillRect(0, 6 + i * 6, 5, 2);
        g.fillRect(23, 6 + i * 6, 5, 2);
      }
      // armor stripe
      g.fillStyle(0xcc4444);
      g.fillRect(5, 17, 18, 2);
      g.generateTexture('tank-enemy-armored', 28, 28);
      g.destroy();
    }

    // ── Player bullet ────────────────────────────────────────────────────
    {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0xffee44);
      g.fillRect(2, 0, 4, 8);
      g.fillStyle(0xffffff);
      g.fillRect(3, 1, 2, 3);
      g.generateTexture('bullet-player', 8, 8);
      g.destroy();
    }

    // ── Enemy bullet ─────────────────────────────────────────────────────
    {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0xff6644);
      g.fillRect(2, 0, 4, 8);
      g.fillStyle(0xffaa88);
      g.fillRect(3, 1, 2, 3);
      g.generateTexture('bullet-enemy', 8, 8);
      g.destroy();
    }

    // ── Brick tile ───────────────────────────────────────────────────────
    {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0xaa4422);
      g.fillRect(0, 0, 32, 32);
      g.fillStyle(0xcc5533);
      g.fillRect(1, 1, 14, 6);
      g.fillRect(17, 1, 14, 6);
      g.fillRect(1, 9, 6, 6);
      g.fillRect(9, 9, 14, 6);
      g.fillRect(25, 9, 6, 6);
      g.fillRect(1, 17, 14, 6);
      g.fillRect(17, 17, 14, 6);
      g.fillRect(1, 25, 6, 6);
      g.fillRect(9, 25, 14, 6);
      g.fillRect(25, 25, 6, 6);
      g.fillStyle(0x883311);
      g.fillRect(0, 0, 32, 1);
      g.fillRect(0, 0, 1, 32);
      g.generateTexture('brick', 32, 32);
      g.destroy();
    }

    // ── Steel tile ───────────────────────────────────────────────────────
    {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0x778899);
      g.fillRect(0, 0, 32, 32);
      g.fillStyle(0xaabbcc);
      g.fillRect(2, 2, 28, 28);
      g.fillStyle(0x556677);
      g.fillRect(2, 2, 28, 2);
      g.fillRect(2, 2, 2, 28);
      g.fillStyle(0xddeeff);
      g.fillRect(4, 4, 10, 10);
      g.fillStyle(0x778899);
      g.fillRect(6, 6, 6, 6);
      g.fillRect(18, 18, 8, 8);
      g.generateTexture('steel', 32, 32);
      g.destroy();
    }

    // ── Base (eagle) ─────────────────────────────────────────────────────
    {
      const g = this.make.graphics({ add: false });
      // base platform
      g.fillStyle(0x333333);
      g.fillRect(0, 24, 32, 8);
      // eagle body
      g.fillStyle(0xddaa00);
      g.fillRect(8, 8, 16, 20);
      // wings
      g.fillStyle(0xffcc00);
      g.fillRect(0, 12, 8, 12);
      g.fillRect(24, 12, 8, 12);
      // head
      g.fillStyle(0xffdd44);
      g.fillRect(10, 2, 12, 10);
      // eyes
      g.fillStyle(0x222222);
      g.fillRect(12, 4, 3, 3);
      g.fillRect(17, 4, 3, 3);
      // beak
      g.fillStyle(0xff8800);
      g.fillRect(13, 8, 6, 4);
      // outline
      g.lineStyle(1, 0xaa7700);
      g.strokeRect(8, 8, 16, 20);
      g.generateTexture('base', 32, 32);
      g.destroy();
    }

    // ── Base destroyed ───────────────────────────────────────────────────
    {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0x222222);
      g.fillRect(0, 24, 32, 8);
      g.fillStyle(0x555555);
      g.fillRect(4, 10, 8, 16);
      g.fillRect(14, 6, 6, 20);
      g.fillRect(22, 12, 6, 14);
      g.fillStyle(0x444444);
      g.fillRect(2, 18, 28, 6);
      g.generateTexture('base-destroyed', 32, 32);
      g.destroy();
    }

    // ── Respawn flash ────────────────────────────────────────────────────
    {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0xffffff, 0.4);
      g.fillCircle(20, 20, 20);
      g.fillStyle(0xffff88, 0.6);
      g.fillCircle(20, 20, 12);
      g.generateTexture('respawn', 40, 40);
      g.destroy();
    }
  }

  // ─── create ───────────────────────────────────────────────────────────────
  create(): void {
    this.makeTextures();

    // Background
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x1a1a1a).setDepth(0);
    // Map background
    this.add.rectangle(
      MAP_X + (COLS * TILE) / 2,
      MAP_Y + (ROWS * TILE) / 2,
      COLS * TILE, ROWS * TILE, 0x222222
    ).setDepth(0);

    // Physics groups
    this.bricks = this.physics.add.staticGroup();
    this.steels = this.physics.add.staticGroup();
    this.enemyGroup = this.physics.add.group();
    this.playerBullets = this.physics.add.group({ defaultKey: 'bullet-player' });
    this.enemyBullets = this.physics.add.group({ defaultKey: 'bullet-enemy' });

    // Build map
    this.buildMap();

    // Base (eagle) — bottom center of map
    const baseCol = Math.floor(COLS / 2) - 1;
    const baseRow = ROWS - 1;
    const bx = MAP_X + baseCol * TILE;
    const by = MAP_Y + baseRow * TILE;
    this.base = this.add.image(bx, by, 'base').setOrigin(0, 0).setDepth(2);
    // Protect base with brick walls
    this.placeBrickAround(baseCol, baseRow);

    // Player
    this.spawnPlayer();

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Collisions
    this.setupCollisions();

    // HUD
    this.buildHUD();

    // Start first level
    this.startLevel();
  }

  // ─── Map building ─────────────────────────────────────────────────────────
  private buildMap(): void {
    // Deep copy map
    this.mapData = BASE_MAP.map(row => [...row]);

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const t = this.mapData[row][col];
        const wx = MAP_X + col * TILE;
        const wy = MAP_Y + row * TILE;
        if (t === 1) {
          const s = this.bricks.create(wx + TILE / 2, wy + TILE / 2, 'brick') as Phaser.Physics.Arcade.Sprite;
          s.setDepth(1);
          s.setData('row', row);
          s.setData('col', col);
        } else if (t === 2) {
          const s = this.steels.create(wx + TILE / 2, wy + TILE / 2, 'steel') as Phaser.Physics.Arcade.Sprite;
          s.setDepth(1);
        }
      }
    }
  }

  private placeBrickAround(col: number, row: number): void {
    // Place protective bricks around the eagle
    const positions: [number, number][] = [
      [col - 1, row - 1], [col, row - 1], [col + 1, row - 1], [col + 2, row - 1],
      [col - 1, row],     [col + 2, row],
    ];
    for (const [c, r] of positions) {
      if (c >= 0 && c < COLS && r >= 0 && r < ROWS && this.mapData[r][c] === 0) {
        this.mapData[r][c] = 1;
        const wx = MAP_X + c * TILE;
        const wy = MAP_Y + r * TILE;
        const s = this.bricks.create(wx + TILE / 2, wy + TILE / 2, 'brick') as Phaser.Physics.Arcade.Sprite;
        s.setDepth(1);
        s.setData('row', r);
        s.setData('col', c);
      }
    }
    this.bricks.refresh();
  }

  // ─── Player spawn ─────────────────────────────────────────────────────────
  private spawnPlayer(): void {
    const startCol = Math.floor(COLS / 2) - 1;
    const startRow = ROWS - 3;
    const px = MAP_X + startCol * TILE + TILE / 2;
    const py = MAP_Y + startRow * TILE + TILE / 2;

    if (this.player) {
      this.player.setPosition(px, py);
      this.player.setActive(true).setVisible(true);
      (this.player.body as Phaser.Physics.Arcade.Body).enable = true;
    } else {
      this.player = this.physics.add.sprite(px, py, 'tank-player');
      this.player.setDepth(2);
      this.player.setOrigin(0.5, 0.5);
      const pb = this.player.body as Phaser.Physics.Arcade.Body;
      pb.setSize(26, 26);
      pb.setBounce(0, 0); // no bouncing on collision
      pb.setMass(1);      // same mass as normal enemy — blocks but doesn't push
    }

    this.playerDir = 'up';
    this.player.setAngle(0);
    this.playerAlive = true;
    this.playerInvincible = 2000; // 2 sec invincibility

    // Flash effect for respawn
    this.tweens.add({
      targets: this.player,
      alpha: { from: 0.3, to: 1 },
      duration: 200,
      repeat: 4,
      onComplete: () => { if (this.player) this.player.setAlpha(1); },
    });
  }

  // ─── Collision setup ──────────────────────────────────────────────────────
  private setupCollisions(): void {
    // Player bullets vs bricks
    this.physics.add.overlap(this.playerBullets, this.bricks, (bullet, brick) => {
      this.destroyBullet(bullet as Phaser.Physics.Arcade.Sprite);
      this.destroyBrick(brick as Phaser.Physics.Arcade.Sprite);
    });

    // Player bullets vs steel
    this.physics.add.overlap(this.playerBullets, this.steels, (bullet) => {
      this.destroyBullet(bullet as Phaser.Physics.Arcade.Sprite);
    });

    // Enemy bullets vs bricks
    this.physics.add.overlap(this.enemyBullets, this.bricks, (bullet, brick) => {
      this.destroyBullet(bullet as Phaser.Physics.Arcade.Sprite);
      this.destroyBrick(brick as Phaser.Physics.Arcade.Sprite);
    });

    // Enemy bullets vs steel
    this.physics.add.overlap(this.enemyBullets, this.steels, (bullet) => {
      this.destroyBullet(bullet as Phaser.Physics.Arcade.Sprite);
    });

    // Player vs bricks/steel
    this.physics.add.collider(this.player, this.bricks);
    this.physics.add.collider(this.player, this.steels);

    // Player vs enemies (solid — can't drive through each other)
    this.physics.add.collider(this.player, this.enemyGroup);

    // Enemy vs enemy (solid)
    this.physics.add.collider(this.enemyGroup, this.enemyGroup);

    // Enemies vs walls (solid)
    this.physics.add.collider(this.enemyGroup, this.bricks);
    this.physics.add.collider(this.enemyGroup, this.steels);
  }

  // ─── HUD ──────────────────────────────────────────────────────────────────
  private buildHUD(): void {
    const panelX = MAP_X + COLS * TILE + 16;
    const panelW = GAME_WIDTH - panelX - 8;

    // Left panel for lives
    const leftX = 8;

    // Darken panels
    this.add.rectangle(MAP_X / 2, GAME_HEIGHT / 2, MAP_X - 4, GAME_HEIGHT, 0x111111).setDepth(9);
    this.add.rectangle(panelX + panelW / 2, GAME_HEIGHT / 2, panelW + 8, GAME_HEIGHT, 0x111111).setDepth(9);

    const txtStyle = { fontFamily: 'monospace', fontSize: '16px', color: '#cccccc' };
    const valStyle = { fontFamily: 'monospace', fontSize: '22px', color: '#ffee44' };

    // Score
    this.add.text(panelX, 20, 'SCORE', txtStyle).setDepth(10);
    this.scoreText = this.add.text(panelX, 40, '0', valStyle).setDepth(10);

    // Level
    this.add.text(panelX, 80, 'STAGE', txtStyle).setDepth(10);
    this.levelText = this.add.text(panelX, 100, '1', valStyle).setDepth(10);

    // Lives
    this.add.text(panelX, 140, 'LIVES', txtStyle).setDepth(10);
    this.livesText = this.add.text(panelX, 160, '3', valStyle).setDepth(10);

    // Enemies
    this.add.text(panelX, 200, 'ENEMY', txtStyle).setDepth(10);
    this.enemyCountText = this.add.text(panelX, 220, '0', valStyle).setDepth(10);

    // Left panel labels
    this.add.text(leftX, 20, 'TANK\nWAR', {
      fontFamily: 'monospace', fontSize: '18px', color: '#ffee44', align: 'center'
    }).setDepth(10);
    this.add.text(leftX, 80, 'WASD\n/↑↓←→\nMove', {
      fontFamily: 'monospace', fontSize: '11px', color: '#888888', align: 'left'
    }).setDepth(10);
    this.add.text(leftX, 145, 'SPACE\nShoot', {
      fontFamily: 'monospace', fontSize: '11px', color: '#888888', align: 'left'
    }).setDepth(10);

    // Center overlay text (level complete / game over)
    this.overlayText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '', {
      fontFamily: 'monospace', fontSize: '36px', color: '#ffee44', align: 'center',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(100).setAlpha(0);
  }

  private updateHUD(): void {
    this.scoreText.setText(String(this.score));
    this.levelText.setText(String(this.level));
    this.livesText.setText(String(this.lives));
    const remaining = this.enemySpawnQueue + this.enemies.filter(e => e.sprite.active).length;
    this.enemyCountText.setText(String(remaining));
  }

  // ─── Level management ─────────────────────────────────────────────────────
  private startLevel(): void {
    this.physics.world.resume(); // unfreeze after levelComplete / gameOver pause
    this.state = 'playing';
    this.totalEnemiesThisLevel = Math.min(6 + (this.level - 1) * 2, 20);
    this.enemySpawnQueue = this.totalEnemiesThisLevel;
    this.enemiesDefeated = 0;
    this.enemySpawnTimer = 2000;

    // Clear existing enemies and bullets
    this.enemyGroup.clear(true, true);
    this.enemies = [];
    this.playerBullets.clear(true, true);
    this.enemyBullets.clear(true, true);

    this.levelText.setText(String(this.level));
  }

  // ─── Enemy spawning ───────────────────────────────────────────────────────
  private spawnEnemy(): void {
    if (this.enemySpawnQueue <= 0) return;
    if (this.enemies.filter(e => e.sprite.active).length >= 4) return;

    const spawnCols = [1, Math.floor(COLS / 2) - 1, COLS - 3];
    const col = spawnCols[Math.floor(Math.random() * spawnCols.length)];
    const row = 0;
    const wx = MAP_X + col * TILE + TILE / 2;
    const wy = MAP_Y + row * TILE + TILE / 2;

    // 30% chance armored after level 2
    const kind: EnemyKind = (this.level >= 2 && Math.random() < 0.3) ? 'armored' : 'normal';
    const texKey = kind === 'armored' ? 'tank-enemy-armored' : 'tank-enemy-normal';

    // Use enemyGroup.create() so the body is fresh (no reset) and the
    // group-level colliders registered in setupCollisions() apply automatically.
    const sprite = this.enemyGroup.create(wx, wy, texKey) as Phaser.Physics.Arcade.Sprite;
    sprite.setDepth(2);
    sprite.setOrigin(0.5, 0.5);
    sprite.setAngle(180); // facing down initially
    const eb = sprite.body as Phaser.Physics.Arcade.Body;
    eb.setSize(26, 26);
    eb.setBounce(0, 0); // no bouncing — tanks stop dead on collision
    // Mass determines push hierarchy:
    //   armored (50) >> normal (1) — armored can bulldoze normal, not vice versa
    //   same mass → neither pushes the other (equal separation, bounce=0)
    eb.setMass(kind === 'armored' ? 50 : 1);

    // Spawn flash
    const flash = this.add.image(wx, wy, 'respawn').setDepth(5).setAlpha(0.8);
    this.tweens.add({
      targets: flash, alpha: 0, duration: 600,
      onComplete: () => flash.destroy(),
    });

    const enemy: Enemy = {
      sprite,
      kind,
      hp: kind === 'armored' ? 2 : 1,
      dir: 'down',
      moveTick: 0,
      shootTick: 1000 + Math.random() * 1000,
      flashTimer: 0,
    };
    this.enemies.push(enemy);
    this.enemySpawnQueue--;
  }

  // ─── Bullet firing ────────────────────────────────────────────────────────
  private fireBullet(fromX: number, fromY: number, dir: Dir, isPlayer: boolean): void {
    const speed = 320;
    const group = isPlayer ? this.playerBullets : this.enemyBullets;
    const texKey = isPlayer ? 'bullet-player' : 'bullet-enemy';

    const b = this.physics.add.sprite(fromX, fromY, texKey) as Phaser.Physics.Arcade.Sprite;
    group.add(b);
    b.setDepth(3);
    b.setOrigin(0.5, 0.5);

    let vx = 0, vy = 0, angle = 0;
    switch (dir) {
      case 'up':    vy = -speed; angle = 0;   break;
      case 'down':  vy =  speed; angle = 180; break;
      case 'left':  vx = -speed; angle = 270; break;
      case 'right': vx =  speed; angle = 90;  break;
    }
    b.setAngle(angle);
    (b.body as Phaser.Physics.Arcade.Body).setVelocity(vx, vy);
    (b.body as Phaser.Physics.Arcade.Body).setSize(6, 6);
  }

  // ─── Destroy helpers ──────────────────────────────────────────────────────
  private destroyBullet(b: Phaser.Physics.Arcade.Sprite): void {
    if (!b.active) return;
    this.spawnExplosion(b.x, b.y, 'small');
    b.destroy();
  }

  private destroyBrick(b: Phaser.Physics.Arcade.Sprite): void {
    if (!b.active) return;
    const row = b.getData('row') as number;
    const col = b.getData('col') as number;
    if (row !== undefined && col !== undefined) this.mapData[row][col] = 0;
    this.spawnExplosion(b.x, b.y, 'small');
    b.destroy();
    this.bricks.refresh();
  }

  private spawnExplosion(x: number, y: number, size: 'small' | 'big'): void {
    const count = size === 'big' ? 16 : 8;
    const range = size === 'big' ? 40 : 20;
    const colors = size === 'big' ? [0xff6600, 0xff3300, 0xffaa00, 0xffff00] : [0xff6600, 0xffaa44];
    const duration = size === 'big' ? 500 : 250;

    for (let i = 0; i < count; i++) {
      const g = this.add.graphics();
      const color = colors[Math.floor(Math.random() * colors.length)];
      g.fillStyle(color);
      const r = size === 'big' ? 3 + Math.random() * 4 : 2 + Math.random() * 2;
      g.fillCircle(0, 0, r);
      g.setPosition(x, y);
      g.setDepth(4);

      const angle = Math.random() * Math.PI * 2;
      const dist = range * (0.5 + Math.random() * 0.5);
      this.tweens.add({
        targets: g,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        scaleX: 0.1,
        scaleY: 0.1,
        duration: duration * (0.5 + Math.random() * 0.5),
        ease: 'Power2',
        onComplete: () => g.destroy(),
      });
    }

    if (size === 'big') {
      // Screen shake
      this.cameras.main.shake(120, 0.008);
    }
  }

  // ─── Enemy AI ─────────────────────────────────────────────────────────────
  private updateEnemies(delta: number): void {
    const speed = 80 + this.level * 8;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.sprite.active) {
        this.enemies.splice(i, 1);
        continue;
      }

      const body = e.sprite.body as Phaser.Physics.Arcade.Body;

      // Flash when hit (armored)
      if (e.flashTimer > 0) {
        e.flashTimer -= delta;
        e.sprite.setAlpha(Math.sin(e.flashTimer * 0.05) * 0.5 + 0.7);
        if (e.flashTimer <= 0) e.sprite.setAlpha(1);
      }

      // Movement tick
      e.moveTick -= delta;
      if (e.moveTick <= 0 || (Math.abs(body.velocity.x) < 1 && Math.abs(body.velocity.y) < 1)) {
        // Pick a direction: 40% toward player, 60% random
        const dx = this.player.x - e.sprite.x;
        const dy = this.player.y - e.sprite.y;
        const dirs: Dir[] = ['up', 'down', 'left', 'right'];

        let newDir: Dir;
        if (this.playerAlive && Math.random() < 0.4) {
          // Move toward player or base
          const target = Math.random() < 0.5
            ? { x: this.player.x, y: this.player.y }
            : { x: MAP_X + (Math.floor(COLS / 2) - 1) * TILE, y: MAP_Y + (ROWS - 1) * TILE };
          const tdx = target.x - e.sprite.x;
          const tdy = target.y - e.sprite.y;
          if (Math.abs(tdx) > Math.abs(tdy)) {
            newDir = tdx > 0 ? 'right' : 'left';
          } else {
            newDir = tdy > 0 ? 'down' : 'up';
          }
        } else {
          newDir = dirs[Math.floor(Math.random() * dirs.length)];
        }

        e.dir = newDir;
        this.setTankVelocity(e.sprite, newDir, speed);
        e.moveTick = 600 + Math.random() * 800;
      }

      // Keep in map bounds
      const minX = MAP_X + 14;
      const maxX = MAP_X + COLS * TILE - 14;
      const minY = MAP_Y + 14;
      const maxY = MAP_Y + ROWS * TILE - 14;
      if (e.sprite.x < minX) { e.sprite.x = minX; this.reverseDir(e, 'left'); }
      if (e.sprite.x > maxX) { e.sprite.x = maxX; this.reverseDir(e, 'right'); }
      if (e.sprite.y < minY) { e.sprite.y = minY; this.reverseDir(e, 'up'); }
      if (e.sprite.y > maxY) { e.sprite.y = maxY; this.reverseDir(e, 'down'); }

      // Shoot
      e.shootTick -= delta;
      if (e.shootTick <= 0) {
        this.fireBullet(e.sprite.x, e.sprite.y, e.dir, false);
        const shootInterval = Math.max(800, 1800 - this.level * 100);
        e.shootTick = shootInterval + Math.random() * shootInterval;
      }
    }
  }

  private reverseDir(e: Enemy, triggeredBy: Dir): void {
    const opposite: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };
    e.dir = opposite[triggeredBy];
    const speed = 80 + this.level * 8;
    this.setTankVelocity(e.sprite, e.dir, speed);
    e.moveTick = 300;
  }

  private setTankVelocity(sprite: Phaser.Physics.Arcade.Sprite, dir: Dir, speed: number): void {
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    switch (dir) {
      case 'up':    body.setVelocity(0, -speed); sprite.setAngle(0);   break;
      case 'down':  body.setVelocity(0,  speed); sprite.setAngle(180); break;
      case 'left':  body.setVelocity(-speed, 0); sprite.setAngle(270); break;
      case 'right': body.setVelocity( speed, 0); sprite.setAngle(90);  break;
    }
  }

  // ─── Hit detection: enemy bullets vs player / base ───────────────────────
  private checkEnemyBulletsVsPlayer(): void {
    if (!this.playerAlive || this.playerInvincible > 0) return;

    this.enemyBullets.getChildren().forEach(obj => {
      const b = obj as Phaser.Physics.Arcade.Sprite;
      if (!b.active) return;
      const dist = Phaser.Math.Distance.Between(b.x, b.y, this.player.x, this.player.y);
      if (dist < 16) {
        this.destroyBullet(b);
        this.hitPlayer();
      }
    });
  }

  private checkEnemyBulletsVsBase(): void {
    if (!this.baseAlive) return;
    const bx = MAP_X + (Math.floor(COLS / 2) - 1) * TILE + 16;
    const by = MAP_Y + (ROWS - 1) * TILE + 16;

    this.enemyBullets.getChildren().forEach(obj => {
      const b = obj as Phaser.Physics.Arcade.Sprite;
      if (!b.active) return;
      const dist = Phaser.Math.Distance.Between(b.x, b.y, bx, by);
      if (dist < 22) {
        this.destroyBullet(b);
        this.destroyBase();
      }
    });

    this.playerBullets.getChildren().forEach(obj => {
      const b = obj as Phaser.Physics.Arcade.Sprite;
      if (!b.active) return;
      const dist = Phaser.Math.Distance.Between(b.x, b.y, bx, by);
      if (dist < 22) {
        this.destroyBullet(b);
        this.destroyBase();
      }
    });
  }

  private checkPlayerBulletsVsEnemies(): void {
    this.playerBullets.getChildren().forEach(obj => {
      const b = obj as Phaser.Physics.Arcade.Sprite;
      if (!b.active) return;
      for (const e of this.enemies) {
        if (!e.sprite.active) continue;
        const dist = Phaser.Math.Distance.Between(b.x, b.y, e.sprite.x, e.sprite.y);
        if (dist < 18) {
          this.destroyBullet(b);
          this.hitEnemy(e);
          break;
        }
      }
    });
  }

  private checkEnemyBulletsVsEnemyBullets(): void {
    const pb = this.playerBullets.getChildren() as Phaser.Physics.Arcade.Sprite[];
    const eb = this.enemyBullets.getChildren() as Phaser.Physics.Arcade.Sprite[];
    for (const p of pb) {
      if (!p.active) continue;
      for (const e of eb) {
        if (!e.active) continue;
        const dist = Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y);
        if (dist < 8) {
          this.destroyBullet(p);
          this.destroyBullet(e);
        }
      }
    }
  }

  // ─── Damage ───────────────────────────────────────────────────────────────
  private hitPlayer(): void {
    if (!this.playerAlive) return;
    this.spawnExplosion(this.player.x, this.player.y, 'big');
    this.playerAlive = false;
    this.player.setActive(false).setVisible(false);
    (this.player.body as Phaser.Physics.Arcade.Body).enable = false;

    this.lives--;
    this.updateHUD();

    if (this.lives <= 0) {
      this.triggerGameOver();
    } else {
      this.respawnTimer = 2500;
    }
  }

  private hitEnemy(e: Enemy): void {
    e.hp--;
    if (e.hp <= 0) {
      this.spawnExplosion(e.sprite.x, e.sprite.y, 'big');
      this.score += e.kind === 'armored' ? 200 : 100;
      this.enemiesDefeated++;
      e.sprite.destroy();

      this.tweens.add({
        targets: this.scoreText,
        scaleX: 1.4, scaleY: 1.4,
        duration: 100,
        yoyo: true,
      });

      this.updateHUD();
      this.checkLevelComplete();
    } else {
      // Hit flash for armored
      e.flashTimer = 400;
    }
  }

  private destroyBase(): void {
    if (!this.baseAlive) return;
    this.baseAlive = false;
    this.base.setTexture('base-destroyed');
    this.spawnExplosion(this.base.x + 16, this.base.y + 16, 'big');
    this.time.delayedCall(300, () => this.spawnExplosion(this.base.x + 20, this.base.y + 10, 'big'));
    this.triggerGameOver();
  }

  // ─── Level flow ───────────────────────────────────────────────────────────
  private checkLevelComplete(): void {
    if (this.enemySpawnQueue <= 0 && this.enemies.filter(e => e.sprite.active).length === 0) {
      this.score += 500;
      this.updateHUD();
      this.state = 'levelComplete';
      this.stateTimer = 3000;
      this.physics.world.pause(); // freeze all movement while overlay shows
      this.showOverlay(`STAGE ${this.level}\nCOMPLETE!\n+500 BONUS`);
    }
  }

  private triggerGameOver(): void {
    this.state = 'gameOver';
    this.stateTimer = 4000;
    this.gameOverCooldown = 0; // reset — will count up in update()
    this.physics.world.pause(); // freeze all movement while overlay shows
    this.time.delayedCall(500, () => {
      this.showOverlay('GAME OVER\n\nPress SPACE\nto restart');
    });
  }

  private showOverlay(text: string): void {
    this.overlayText.setText(text);
    this.tweens.add({
      targets: this.overlayText,
      alpha: { from: 0, to: 1 },
      scaleX: { from: 0.5, to: 1 },
      scaleY: { from: 0.5, to: 1 },
      duration: 400,
      ease: 'Back.Out',
    });
  }

  private hideOverlay(): void {
    this.tweens.killTweensOf(this.overlayText); // stop any in-flight entrance tween
    this.overlayText.setAlpha(0);
    this.overlayText.setScale(1); // reset scale for next show
  }

  // ─── Bullet out-of-bounds ─────────────────────────────────────────────────
  private cullBullets(): void {
    const minX = MAP_X - 10, maxX = MAP_X + COLS * TILE + 10;
    const minY = MAP_Y - 10, maxY = MAP_Y + ROWS * TILE + 10;

    [...this.playerBullets.getChildren(), ...this.enemyBullets.getChildren()].forEach(obj => {
      const b = obj as Phaser.Physics.Arcade.Sprite;
      if (!b.active) return;
      if (b.x < minX || b.x > maxX || b.y < minY || b.y > maxY) {
        b.destroy();
      }
    });
  }

  // ─── Update ───────────────────────────────────────────────────────────────
  update(_time: number, delta: number): void {
    if (this.state === 'gameOver') {
      this.gameOverCooldown += delta;
      // Only accept restart input after 1500ms — prevents immediate restart
      // when Space was held for shooting at the moment of death.
      if (this.gameOverCooldown > 1500 && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
        this.restartGame();
      }
      return;
    }

    if (this.state === 'levelComplete') {
      this.stateTimer -= delta;
      if (this.stateTimer <= 0) {
        this.level++;
        this.hideOverlay();
        this.startLevel();
        if (!this.playerAlive && this.lives > 0) this.spawnPlayer();
      }
      return;
    }

    // ── Player movement ──────────────────────────────────────────────────
    if (this.playerAlive) {
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      const PSPEED = 140;
      body.setVelocity(0, 0);

      const up    = this.cursors.up.isDown    || (this.wasd.up    as Phaser.Input.Keyboard.Key).isDown;
      const down  = this.cursors.down.isDown  || (this.wasd.down  as Phaser.Input.Keyboard.Key).isDown;
      const left  = this.cursors.left.isDown  || (this.wasd.left  as Phaser.Input.Keyboard.Key).isDown;
      const right = this.cursors.right.isDown || (this.wasd.right as Phaser.Input.Keyboard.Key).isDown;

      if (up) {
        body.setVelocityY(-PSPEED);
        this.playerDir = 'up';
        this.player.setAngle(0);
      } else if (down) {
        body.setVelocityY(PSPEED);
        this.playerDir = 'down';
        this.player.setAngle(180);
      } else if (left) {
        body.setVelocityX(-PSPEED);
        this.playerDir = 'left';
        this.player.setAngle(270);
      } else if (right) {
        body.setVelocityX(PSPEED);
        this.playerDir = 'right';
        this.player.setAngle(90);
      }

      // Keep player in map
      const minX = MAP_X + 14, maxX = MAP_X + COLS * TILE - 14;
      const minY = MAP_Y + 14, maxY = MAP_Y + ROWS * TILE - 14;
      this.player.x = Phaser.Math.Clamp(this.player.x, minX, maxX);
      this.player.y = Phaser.Math.Clamp(this.player.y, minY, maxY);

      // Shooting
      this.playerShootCooldown -= delta;
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey) && this.playerShootCooldown <= 0) {
        this.fireBullet(this.player.x, this.player.y, this.playerDir, true);
        this.playerShootCooldown = 350;
      }

      // Invincibility countdown
      if (this.playerInvincible > 0) {
        this.playerInvincible -= delta;
        if (this.playerInvincible <= 0) this.player.setAlpha(1);
      }
    }

    // ── Respawn ──────────────────────────────────────────────────────────
    if (!this.playerAlive && this.lives > 0 && this.respawnTimer > 0) {
      this.respawnTimer -= delta;
      if (this.respawnTimer <= 0) {
        this.spawnPlayer();
      }
    }

    // ── Enemy spawning ───────────────────────────────────────────────────
    this.enemySpawnTimer -= delta;
    if (this.enemySpawnTimer <= 0 && this.enemySpawnQueue > 0) {
      this.spawnEnemy();
      this.enemySpawnTimer = 3000;
    }

    // ── Enemy AI ─────────────────────────────────────────────────────────
    this.updateEnemies(delta);

    // ── Hit detection ────────────────────────────────────────────────────
    this.checkPlayerBulletsVsEnemies();
    this.checkEnemyBulletsVsPlayer();
    this.checkEnemyBulletsVsBase();
    this.checkEnemyBulletsVsEnemyBullets();

    // ── Cull out-of-bounds bullets ───────────────────────────────────────
    this.cullBullets();

    // ── HUD update ───────────────────────────────────────────────────────
    this.updateHUD();
  }

  // ─── Restart ──────────────────────────────────────────────────────────────
  private restartGame(): void {
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.baseAlive = true;
    this.playerAlive = true;
    this.respawnTimer = 0;
    this.hideOverlay();

    // Re-build map
    this.bricks.clear(true, true);
    this.steels.clear(true, true);
    this.playerBullets.clear(true, true);
    this.enemyBullets.clear(true, true);
    this.enemyGroup.clear(true, true);
    this.enemies = [];

    this.buildMap();
    this.base.setTexture('base');
    this.placeBrickAround(Math.floor(COLS / 2) - 1, ROWS - 1);
    // No need to re-call setupCollisions — the existing colliders still
    // reference the same group objects (bricks/steels/enemyGroup/player).
    this.spawnPlayer();
    this.startLevel();
  }
}
