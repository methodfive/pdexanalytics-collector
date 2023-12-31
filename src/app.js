import { Collector } from "./collector.js";

export async function app() {
    const collector = new Collector();

    await collector.updateAssets();
    await collector.updateUsers();
    await collector.updateMarkets();

    await collector.startTimers();

    await collector.updateTVL();

    await collector.startSubscriptions();

    setInterval(() => {}, 1 << 30);
}