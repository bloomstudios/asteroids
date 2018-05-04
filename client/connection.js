import ClientGame from "./game";
import { cameraHeight } from "../shared/settings";
import * as KEYCODES from "../shared/keycodes";

/** @type {ClientGame} */
let game = null;
/** @type {GameState} */
let gameState = getInitialState();
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById(
  "game"
));
const gamePage = document.getElementById("gamePage");

const socket = new WebSocket(`ws://${window.location.host}`);

/** @returns {GameState} */
function getInitialState() {
  return {
    players: [],
    currentPlayerId: null,
    projectiles: []
  };
}

/**
 * Called immediately after user logs in successfully.
 * @param {string} token
 */
export function onRequestPlay(token) {
  const respawnMenu = document.getElementById("respawnMenu");
  respawnMenu.style.display = "none";
  socket.send(`USER_CONNECTED#${token}`);
  let isPressed = {};
  addEventListener("keydown", evt => {
    if (!isPressed[evt.keyCode]) {
      isPressed[evt.keyCode] = true;
      socket.send("KEYDOWN#" + evt.keyCode);
    }
  });
  addEventListener("keyup", evt => {
    socket.send("KEYUP#" + evt.keyCode);
    isPressed[evt.keyCode] = false;
  });
  const handlers = {
    ADD_CURRENT_PLAYER: content => {
      const player = JSON.parse(content);
      gameState.players.push(player);
      gameState.currentPlayerId = player.id;
      gamePage.style.display = "flex";
      const gameContainer = /** @type {HTMLElement} */ (document.querySelector(
        ".game-container"
      ));
      gameContainer.style.display = "flex";
      gameContainer.style.maxHeight = cameraHeight + "px";
      game = new ClientGame(canvas, gameState);
    },
    ADD_PLAYER: content => {
      gameState.players.push(JSON.parse(content));
    },
    UPDATE_PLAYER: content => {
      const { id } = JSON.parse(content);
      const playerIdx = gameState.players.findIndex(p => p.id === id);
      gameState.players[playerIdx] = JSON.parse(content);
    },
    REMOVE_PLAYER: content => {
      const id = parseInt(content);
      if (id === gameState.currentPlayerId) {
        const respawnButton = document.getElementById("respawnBtn");
        respawnMenu.style.display = "block";
        respawnButton.addEventListener("click", () => onRequestPlay(token));
        game.stop();
      }
      gameState.players = gameState.players.filter(p => p.id !== id);
    },
    ADD_PROJECTILE: content => {
      const projectile = JSON.parse(content);
      gameState.projectiles.push(projectile);
    },
    REMOVE_PROJECTILE: content => {
      const id = parseInt(content);
      gameState.projectiles = gameState.projectiles.filter(p => p.id !== id);
    }
  };
  socket.onmessage = message => {
    const splitted = message.data.split("#");
    const code = splitted[0];
    const content = splitted[1];
    handlers[code](content);
  };
}
