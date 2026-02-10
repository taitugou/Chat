
// In-memory game state storage
// Map<roomId, gameInstance>
const games = new Map();

export function getGame(roomId) {
  return games.get(parseInt(roomId));
}

export function setGame(roomId, gameInstance) {
  games.set(parseInt(roomId), gameInstance);
}

export function deleteGame(roomId) {
  return games.delete(parseInt(roomId));
}

export function hasGame(roomId) {
  return games.has(parseInt(roomId));
}

export function getAllGames() {
  return games.entries();
}
