import path from 'path';
import dotenv from 'dotenv';

dotenv.config({
  path: path.join(__dirname, '../.env')
});

import mineflayer from 'mineflayer';
import { pathfinder, Movements, goals } from 'mineflayer-pathfinder';
const { GoalBlock, GoalNear } = goals; // TS moment

let playerToFollow: string;
let playerGoal: goals.GoalNear;
let lostTrack: boolean;

async function init() {
  const bot = mineflayer.createBot({
    username: process.env.MINECRAFT_EMAIL,
    password: process.env.MINECRAFT_PASSWORD,
    auth: process.env.MINECRAFT_AUTH_TYPE as 'mojang' | 'microsoft' | undefined, // TS moment
    host: process.env.MINECRAFT_HOST,
    version: process.env.MINECRAFT_VERSION
  });

  bot.loadPlugin(pathfinder);

  bot.on('login', () => {
    console.log(`Logged in as ${bot.username}!`);

    const mcData = require('minecraft-data')(bot.version);
    const movements = new Movements(bot, mcData);
    movements.canDig = false;
    movements.allow1by1towers = false;
    movements.allowFreeMotion = true;
    movements.maxDropDown = 999;
    bot.pathfinder.setMovements(movements);
  });

  bot.on('spawn', () => {
    console.log('Bot spawned!');
  });

  bot.on('kicked', console.log);

  bot.on('error', (error) => {
    console.error(error);
  });

  bot.on('end', async (reason) => {
    console.log('Bot ended!');
    console.log(`Reason: ${reason}`);
    console.log('Re-starting in 10 seconds...');
    await sleep(10000);
    init();
  });

  bot.on('physicsTick', () => {
    if (!bot.pathfinder.isMoving()) {
      const nearestPlayerEntity = bot.nearestEntity(entity => entity.type === 'player');

      if (nearestPlayerEntity) {
        bot.lookAt(nearestPlayerEntity.position.offset(0, nearestPlayerEntity.height, 0));
      }
    }

    if (playerToFollow) {
      const player = bot.players[playerToFollow];
      if (player && player.entity) {
        if (lostTrack) {
          bot.chat(`Found ${playerToFollow} again!`);
          lostTrack = false;
        }
        
        const { x, y, z } = player.entity.position;
        if (!playerGoal) {
          playerGoal = new GoalNear(x, y, z, 1);
        }
        playerGoal.x = x;
        playerGoal.y = y;
        playerGoal.z = z;

        bot.pathfinder.setGoal(playerGoal);
      } else {
        if (!lostTrack) {
          bot.chat(`Lost track of ${playerToFollow}!`);
          lostTrack = true;
        }
      }
    }
  });

  bot.on('messagestr', (message, messagePosition, jsonMsg) => {
    if (message === 'Utilize o comando /logar <senha>.') {
      bot.chat(`/logar ${process.env.MINECRAFT_SERVER_PASSWORD}`);
    }
    const chatMatch = message.match(/^<(.*?)> (.*)$/);
    if (chatMatch) {
      const username = chatMatch[1];
      const message = chatMatch[2];
      console.log(`${username}: ${message}`);
      if (username === process.env.MINECRAFT_OWNER_NICKNAME) {
        if (message.startsWith('!')) {
          const args = message.split(' ');
          const command = args[0].substring(1).toLowerCase();
          args.shift();

          switch (command) {
            case 'tower':
            case 'home':
              bot.chat('Pathing to tower...');
              playerToFollow = null;
              var goal = new GoalBlock(166, 150, 4919);
              bot.pathfinder.setGoal(goal);
            break;

            case 'path':
            case 'goto':
              if (args.length === 3) {
                const x = parseInt(args[0]);
                const y = parseInt(args[1]);
                const z = parseInt(args[2]);
                if (isNaN(x) || isNaN(y) || isNaN(z)) {
                  bot.chat('Invalid coordinates!');
                } else {
                  playerToFollow = null;
                  bot.chat(`Pathing to ${x} ${y} ${z}...`);
                  var goal = new GoalBlock(x, y, z);
                  bot.pathfinder.setGoal(goal);
                }
              } else {
                bot.chat('Invalid coordinates!');
              }
            break;

            case 'follow':
              if (args.length === 1) {
                const username = args[0];
                const player = bot.players[username];
                if (player && player.entity) {
                  bot.chat(`Following ${username}...`);
                  playerToFollow = username;
                } else {
                  bot.chat('Player not found or not near!');
                }
              } else {
                bot.chat('Invalid arguments!');
              }
            break;

            case 'stop':
              bot.pathfinder.stop();
              playerToFollow = null;
              playerGoal = null;
              bot.chat('Stopped!');
            break;

            default:
              // bot.chat('Command not recognized!');
              break;
          }
        }
      }
    }
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

init();
