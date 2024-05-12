import { Collector } from "./collector.js";
import {updateMarkets24H} from "./db/markets.js";

export async function app() {
    const collector = new Collector();

    await collector.updateOrderBookData();
    await collector.updateSubscanData();
    await collector.updateMainnetData();

    await collector.startTimers();
    await collector.startSubscriptions();

    setInterval(() => {}, 1 << 30);
}