import {convertBalance, getAssetsFromMarket, getDateFromUtc, isEmpty, isMapEmpty} from "../util.js";
import {getConnection, queryAsyncWithRetries} from "./database.js";
import {DB_RETRIES} from "../constants.js";

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
            `INSERT INTO assets (asset_id, symbol, name, price, tvl, is_active, balance) values (?, ?, ?, ?, ?, ?, ?) as new_data 
             ON DUPLICATE KEY UPDATE 
                symbol = new_data.symbol,
                name = new_data.name,
                price = IF(new_data.price is null, assets.price, new_data.price),
                tvl = IF(new_data.tvl is null, assets.tvl, new_data.tvl),
                is_active = new_data.is_active,
                balance = IF(new_data.balance is null, assets.balance, new_data.balance)`,
            [asset.asset_id, asset.symbol, asset.name, asset.price, asset.tvl, 1, convertBalance(asset.balance)],
            ([rows,fields]) => {},
            DB_RETRIES
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
            `INSERT INTO exchange_daily (stat_date, users, tvl, total_staked, staked_tvl, total_holders, total_stakers, total_issuance, treasury_balance, treasury_tvl) values (?, ?, (select sum(tvl) from assets), ?, ?, ?, ?, ?, ?, ?) as new_data
         ON DUPLICATE KEY UPDATE 
            users = IF(new_data.users is null, exchange_daily.users, new_data.users),
            tvl = IF(new_data.tvl is null, exchange_daily.tvl, new_data.tvl),
            total_staked = IF(new_data.total_staked is null, exchange_daily.total_staked, new_data.total_staked),
            staked_tvl = IF(new_data.staked_tvl is null, exchange_daily.staked_tvl, new_data.staked_tvl),
            total_holders = IF(new_data.total_holders is null, exchange_daily.total_holders, new_data.total_holders),
            total_stakers = IF(new_data.total_stakers is null, exchange_daily.total_stakers, new_data.total_stakers),
            total_issuance = IF(new_data.total_issuance is null, exchange_daily.total_issuance, new_data.total_issuance),
            treasury_balance = IF(new_data.treasury_balance is null, exchange_daily.treasury_balance, new_data.treasury_balance),
            treasury_tvl = IF(new_data.treasury_tvl is null, exchange_daily.treasury_tvl, new_data.treasury_tvl)
            `,
            [new Date(), stats.users, stats.total_staked, stats.staked_tvl, stats.total_holders, stats.total_stakers, stats.total_issuance, stats.treasury_balance, stats.treasury_tvl],
            ([rows,fields]) => {},
            DB_RETRIES
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
            `INSERT INTO trades (trade_id, base_asset_id, quote_asset_id, price, quantity, volume, timestamp, m_id, t_id, m_cid, t_cid, m_side, t_side, trade_oid) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) as new_data
         ON DUPLICATE KEY UPDATE 
            base_asset_id = new_data.base_asset_id,
            quote_asset_id = new_data.quote_asset_id,
            price = new_data.price,
            quantity = new_data.quantity,
            volume = new_data.volume,
            m_id = new_data.m_id,
            t_id = new_data.t_id,
            m_cid = new_data.m_cid,
            t_cid = new_data.t_cid,
            m_side = new_data.m_side,
            t_side = new_data.t_side,
            trade_oid = new_data.trade_oid,
            timestamp = new_data.timestamp`,
            [trade.stid, marketPairs[0], marketPairs[1], trade.p, trade.q, trade.vq, getDateFromUtc(trade.t),
                trade.m_id, trade.t_id, trade.m_cid, trade.t_cid, trade.m_side, trade.t_side, trade.trade_id],
            ([rows,fields]) => {},
            DB_RETRIES
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
            DB_RETRIES
        );
    }
    catch(e) {
        console.log("Error saving market",e);
    }
}