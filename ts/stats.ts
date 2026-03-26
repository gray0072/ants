export const STATS = {
    maxAnts: 0,
    totalAntsProduced: 0,
    totalFoodCollected: 0,
    totalEnemiesKilled: 0,
    totalPrincessesFled: 0,

    reset(): void {
        this.maxAnts = 0;
        this.totalAntsProduced = 0;
        this.totalFoodCollected = 0;
        this.totalEnemiesKilled = 0;
        this.totalPrincessesFled = 0;
    },
};
