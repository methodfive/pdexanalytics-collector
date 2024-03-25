import {
    cleanExchange,
    newExchangeDailyDay,
    updateExchange24H,
    updateExchangeDaily,
    updateExchangeHourly
} from "./exchange.js";
import {cleanAssets, updateAssets24H, updateAssetsDaily, updateAssetsHourly} from "./assets.js";
import {updateMarkets24H, updateMarketsDaily} from "./markets.js";
import {cleanTrades} from "./trades.js";

export async function hourlyJob()
{
    let currentTime = new Date();
    currentTime.setMilliseconds(0)
    currentTime.setSeconds(0);
    currentTime.setMinutes(0);
    console.log("hourly job", currentTime);

    await updateAssetsHourly(currentTime);
    await newExchangeDailyDay(); //ensure exchange_daily exists for current day
    await updateExchangeHourly(currentTime);
}

export async function updateCaches()
{
    console.log("Updating cached data for dashboard");

    await updateMarkets24H();
    await updateAssets24H();
    await updateExchange24H();
    await newExchangeDailyDay();

    await updateAssetsDaily();
    await updateMarketsDaily();
}

export async function nightlyJob()
{
    console.log("Night job");

    await updateExchangeDaily()
    await newExchangeDailyDay();

    await updateAssetsDaily();
    await updateMarketsDaily();

    await cleanTrades();
    await cleanExchange();
    await cleanAssets();
}