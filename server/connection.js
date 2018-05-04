require("http");
const WebSocket = require("ws");
const Game = require("./game");
const KEYCODES = require("../shared/keycodes");
const GameSettings = require("../shared/settings");

/** @type {Server} */
module.exports = server => {
  /** @type {GameState} */
  const gameState = { currentPlayerId: 0, players: [], projectiles: [] };
  const game = new Game(gameState);

  const WebSocketServer = new WebSocket.Server({ server });
  let currentId = 1;
  let sockets = [];

  game.addEventListener("REMOVE_PLAYER", ({ payload }) => {
    sockets.forEach(
      s => s.readyState === s.OPEN && s.send("REMOVE_PLAYER#" + payload.id)
    );
    gameState.players = gameState.players.filter(p => p.id !== payload.id);
  });
  game.addEventListener("REMOVE_PROJECTILE", ({ payload }) => {
    sockets.forEach(
      s => s.readyState === s.OPEN && s.send("REMOVE_PROJECTILE#" + payload.id)
    );
    gameState.projectiles = gameState.projectiles.filter(
      p => p.id !== payload.id
    );
  });

  WebSocketServer.on("connection", socket => {
    let playerId = null;
    sockets.push(socket);

    socket.on("message", onMessage);
    socket.on("close", () => {
      gameState.players = gameState.players.filter(p => p.id !== playerId);
      sockets = sockets.filter(s => s.playerId !== playerId);
      sockets.forEach(
        s => s.readyState !== s.CLOSED && s.send("REMOVE_PLAYER#" + playerId)
      );
    });

    const handlers = {
      USER_CONNECTED: content => {
        /** @type {Player} */
        playerId = currentId++;
        // @ts-ignore
        socket.playerId = playerId;
        const player = {
          id: playerId,
          x: 150,
          y: 150,
          xSpeed: 0,
          ySpeed: 0,
          acc: 0,
          rotation: 0,
          rotationSpeed: 0,
          rotationAcc: 0
        };
        gameState.players.push(player);
        socket.send("ADD_CURRENT_PLAYER#" + JSON.stringify(player));
        gameState.players
          .filter(p => p.id !== player.id)
          .forEach(p => socket.send("ADD_PLAYER#" + JSON.stringify(p)));
        sockets
          .filter(s => s.readyState === s.OPEN && s.playerId !== player.id)
          .forEach(s => s.send("ADD_PLAYER#" + JSON.stringify(player)));
      },
      KEYDOWN: content => {
        const player = gameState.players.find(p => p.id === playerId);
        if (player) {
          const keycode = parseInt(content);
          if (keycode === KEYCODES.UP) player.acc = GameSettings.acc;
          else if (keycode === KEYCODES.DOWN) player.acc = -GameSettings.acc;
          else if (keycode === KEYCODES.RIGHT)
            player.rotationAcc = GameSettings.rotationAcc;
          else if (keycode === KEYCODES.LEFT)
            player.rotationAcc = -GameSettings.rotationAcc;
          sockets.forEach(s =>
            s.send("UPDATE_PLAYER#" + JSON.stringify(player))
          );
        }
      },
      KEYUP: content => {
        const player = gameState.players.find(p => p.id === playerId);
        if (player) {
          const keycode = parseInt(content);
          if (keycode === KEYCODES.UP || keycode === KEYCODES.DOWN)
            player.acc = 0;
          else if (keycode === KEYCODES.RIGHT || keycode === KEYCODES.LEFT)
            player.rotationAcc = 0;

          if (keycode === KEYCODES.SPACE) {
            const { playerWidth, playerHeight } = GameSettings;
            /** @type { Projectile } */
            const projectile = {
              id: currentId++,
              x: player.x + playerWidth / 2,
              y: player.y + playerHeight / 2,
              xSpeed: Math.cos(player.rotation) * GameSettings.projectileSpeed,
              ySpeed: Math.sin(player.rotation) * GameSettings.projectileSpeed,
              playerId
            };
            gameState.projectiles.push(projectile);
            sockets.forEach(s =>
              s.send("ADD_PROJECTILE#" + JSON.stringify(projectile))
            );
          }

          sockets.forEach(s =>
            s.send("UPDATE_PLAYER#" + JSON.stringify(player))
          );
        }
      }
    };

    /**
     * @param {string} message
     */
    async function onMessage(message) {
      const splitted = message.split("#");
      const code = splitted[0];
      const content = splitted[1];
      handlers[code](content);
    }
  });
};
