import { CONFIG } from './config';
import { STATE } from './state';

export const PheromoneModule = {
  update(): void {
    const { COLS, ROWS, PHER_DECAY, PHER_MIN } = CONFIG;
    const len = COLS * ROWS;
    for (let i = 0; i < len; i++) {
      if (STATE.pheromone && STATE.pheromone[i] > 0) {
        STATE.pheromone[i] -= PHER_DECAY;
        if (STATE.pheromone[i] < PHER_MIN) STATE.pheromone[i] = 0;
      }
    }
  },
};