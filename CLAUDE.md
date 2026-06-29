# 坦克大战 (Tank Battle)

## Game
- **Genre**: Top-down tank shooter, single-player, defend-the-base / level-clearing
- **Style**: Modern pixel art — all sprites drawn with Phaser Graphics API

## Features Implemented
- Player tank: WASD / arrow-key movement, spacebar to shoot, 3 lives
- 2-second invincibility on spawn/respawn with alpha flash
- Two enemy types: Normal (green, 1 HP) and Armored (red, 2 HP) tanks
- Enemy AI: pathing toward player/base, random direction changes, timed shooting
- Up to 4 enemies on-screen at once; total scales per level (6 + 2*level, max 20)
- Destructible brick walls (cannon destroys them) and indestructible steel walls
- Base (Eagle) at bottom center — game over if destroyed
- Protective brick ring around the base on level start
- Bullet–bullet cancellation (player vs enemy)
- Particle explosion effects (small for bullets, big for tank kills / base)
- Screen shake on big explosions
- Level-complete flow (+500 bonus, 3-second pause, then next level)
- Game Over overlay with Space-to-restart
- Score system: 100 per normal, 200 per armored, 500 per stage
- HUD panels on left/right sides (score, stage, lives, enemy count, controls)

## Architecture
- **Pure code game** (not scene-as-data). GameScene.ts owns all logic.
- BootScene just shows loading bar then starts GameScene.
- All textures generated at runtime via `this.make.graphics().generateTexture()`.
- Map defined as a 26×20 number grid (0=empty, 1=brick, 2=steel).
- Physics: Arcade StaticGroup for walls, dynamic sprites for tanks/bullets.
- Enemy AI: moveTick / shootTick timers per enemy; velocity set via setTankVelocity().
- Hit detection for player/base: manual distance checks (arcade overlap for walls).

## Map constants
- TILE=32, COLS=26, ROWS=20
- MAP_X=224 (centered in 1280px canvas), MAP_Y=40
- Map total: 832×640 px

## Controls
- WASD / Arrow keys: move
- Space: shoot

## Last changed
- Initial build: full tank battle game from scratch
- Fixed: enemy tank textures redrawn facing UP (barrel at top) to match rotation logic; previously barrel was at bottom causing bullets to fire from the wrong end
- Fixed: added enemyGroup (Phaser.Physics.Arcade.Group) — player↔enemy and enemy↔enemy solid colliders registered via the group; enemies now block each other and the player
