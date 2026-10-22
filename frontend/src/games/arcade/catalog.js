import { ARCADE_GAME_REGISTRY } from '../../../../shared/gameRegistry.mjs';

export const ARCADE_GAMES = Object.freeze(Object.fromEntries(
  ARCADE_GAME_REGISTRY.map(({ id, ...game }) => [id, game]),
));
