import {getAssetsFromMarket, getDateFromUtc, isEmpty, isMapEmpty} from "../util.js";
import {getConnection, queryAsyncWithRetries} from "./database.js";

export async function saveAssets(assets)
{
    if(isMapEmpty(assets))
        return;

    for (let key of assets.keys()) {
        let asset = assets.get(key);
        await saveAsset(asset);
    }
}

export async function saveAsset(asset)
{
    if(asset == null || isEmpty(asset.asset_id))
        return;

    console.log("Save asset:",asset);

    try {
        let connectionPool = getConnection();

        await queryAsyncWithRetries(connectionPool,
            `INSERT INTO assets (asset_id, symbol, name, price, tvl, is_active) values (?, ?, ?, ?, ?, ?) as new_data 
             ON DUPLICATE KEY UPDATE 
                symbol = new_data.symbol,
                name = new_data.name,
                price = IF(new_data.price is null, assets.price, new_data.price),
                tvl = IF(new_data.tvl is null, assets.tvl, new_data.tvl),
                is_active = new_data.is_active`,
            [asset.asset_id, asset.symbol, asset.name, asset.price, asset.tvl, 1],
            ([rows,fields]) => {},
            1
        );
    }
    catch(e) {
        console.log("Error saving asset",e);
    }
}


export async function saveExchangeDaily(stats)
{
    if(stats == null)
        return;

    console.log("Save Exchange daily:",stats);

    try {
        let connectionPool = getConnection();

        await queryAsyncWithRetries(connectionPool,
            `INSERT INTO exchange_daily (stat_date, users, tvl, total_staked, staked_tvl) values (?, ?, ?, ?, ?) as new_data
         ON DUPLICATE KEY UPDATE 
            users = IF(new_data.users is null, exchange_daily.users, new_data.users),
            tvl = IF(new_data.tvl is null, exchange_daily.tvl, new_data.tvl),
            total_staked = IF(new_data.total_staked is null, exchange_daily.total_staked, new_data.total_staked),
            staked_tvl = IF(new_data.staked_tvl is null, exchange_daily.staked_tvl, new_data.staked_tvl)`,
            [new Date(), stats.users, stats.tvl, stats.total_staked, stats.staked_tvl],
            ([rows,fields]) => {},
            1
        );
    }
    catch(e) {
        console.log("Error saving users",e);
    }
}

export async function saveTrade(trade)
{
    if(trade == null)
        return;

    console.log("Save trade:",trade);

    try {
        let connectionPool = getConnection();

        let marketPairs = getAssetsFromMarket(trade.m);

        await queryAsyncWithRetries(connectionPool,
            `INSERT INTO trades (trade_id, base_asset_id, quote_asset_id, price, quantity, volume, timestamp) values (?, ?, ?, ?, ?, ?, ?) as new_data
         ON DUPLICATE KEY UPDATE 
            base_asset_id = new_data.base_asset_id,
            quote_asset_id = new_data.quote_asset_id,
            price = new_data.price,
            quantity = new_data.quantity,
            volume = new_data.volume,
            timestamp = new_data.timestamp`,
            [trade.stid, marketPairs[0], marketPairs[1], trade.p, trade.q, trade.vq, getDateFromUtc(trade.t)],
            ([rows,fields]) => {},
            1
        );
    }
    catch(e) {
        console.log("Error saving trade",e);
    }
}

export async function saveMarket(market)
{
    if(isEmpty(market))
        return;

    console.log("Save market:",market);

    try {
        let connectionPool = getConnection();

        let marketPairs = getAssetsFromMarket(market);

        await queryAsyncWithRetries(connectionPool,
            `INSERT INTO markets (base_asset_id, quote_asset_id, is_active) values (?, ?, ?) as new_data
         ON DUPLICATE KEY UPDATE 
            is_active = new_data.is_active`,
            [marketPairs[0], marketPairs[1], 1],
            ([rows,fields]) => {},
            1
        );
    }
    catch(e) {
        console.log("Error saving market",e);
    }
}