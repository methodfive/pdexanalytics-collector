import * as mysql2 from "mysql2";
import {getAssetsFromMarket, isEmpty, isMapEmpty} from "./util.js";

let connectionPool = null;

function createConnectionPool()
{
    connectionPool = mysql2.createPool({
        host: process.env.MYSQL_DB_HOST,
        user: process.env.MYSQL_DB_USER,
        database: process.env.MYSQL_DB,
        password: process.env.MYSQL_DB_PASSWORD,
        ssl: { rejectUnauthorized: false},
        waitForConnections: true,
        connectionLimit: 10,
        maxIdle: 10,
        idleTimeout: 60000,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0
    });
}

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
        if (connectionPool == null)
            createConnectionPool();

        connectionPool.query(
            `INSERT INTO assets (asset_id, symbol, name, price, tvl, is_active) values (?, ?, ?, ?, ?, ?) as new_data 
             ON DUPLICATE KEY UPDATE 
                symbol = new_data.symbol,
                name = new_data.name,
                price = IF(new_data.price is null, assets.price, new_data.price),
                tvl = IF(new_data.tvl is null, assets.tvl, new_data.tvl),
                is_active = new_data.is_active`, [asset.asset_id, asset.symbol, asset.name, asset.price, asset.tvl, 1],
            function (err, rows, fields) {
                if (err)
                    console.log("saveAsset error", err);
            }
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
        if (connectionPool == null)
            createConnectionPool();

        connectionPool.query(
            `INSERT INTO exchange_daily (stat_date, users, tvl) values (?, ?, ?) as new_data
         ON DUPLICATE KEY UPDATE 
            users = IF(new_data.users is null, exchange_daily.users, new_data.users),
            tvl = IF(new_data.tvl is null, exchange_daily.tvl, new_data.tvl)`, [new Date(), stats.users, stats.tvl],
            function (err, rows, fields) {
                if (err)
                    console.log("saveUsers error", err);
            }
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
        if (connectionPool == null)
            createConnectionPool();

        let marketPairs = getAssetsFromMarket(trade.m);

        connectionPool.query(
            `INSERT INTO trades (trade_id, base_asset_id, quote_asset_id, price, quantity, volume, timestamp) values (?, ?, ?, ?, ?, ?, ?) as new_data
         ON DUPLICATE KEY UPDATE 
            base_asset_id = new_data.base_asset_id,
            quote_asset_id = new_data.quote_asset_id,
            price = new_data.price,
            quantity = new_data.quantity,
            volume = new_data.volume,
            timestamp = new_data.timestamp`, [trade.stid, marketPairs[0], marketPairs[1], trade.p, trade.q, trade.vq, new Date(trade.t)],
            function (err, rows, fields) {
                console.log(rows);
                console.log(fields);
                if (err)
                    console.log("saveTrade error", err);
            }
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
        if (connectionPool == null)
            createConnectionPool();

        let marketPairs = getAssetsFromMarket(market);

        connectionPool.query(
            `INSERT INTO markets (base_asset_id, quote_asset_id, is_active) values (?, ?, ?) as new_data
         ON DUPLICATE KEY UPDATE 
            is_active = new_data.is_active`, [marketPairs[0], marketPairs[1], 1],
            function (err, rows, fields) {
                if (err)
                    console.log("saveMarket error", err);
            }
        );
    }
    catch(e) {
        console.log("Error saving market",e);
    }
}

export async function nightlyJob()
{
    console.log("Night job");

    try {
        if (connectionPool == null)
            createConnectionPool();

        connectionPool.query(
            `update exchange_daily set
                volume = (select sum(volume) from trades where date(timestamp) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)),
                trades = (select count(*) from trades where date(timestamp) = DATE_SUB(CURDATE(), INTERVAL 1 DAY))
            where stat_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY)`, [],
            function (err, rows, fields) {
                if (err)
                    console.log("nightlyJob exchange error", err);
            }
        );
    }
    catch(e) {
        console.log("Error performing exchange_daily job",e);
    }

    try {
        if (connectionPool == null)
            createConnectionPool();

        connectionPool.query(
            `insert into markets_daily (stat_date, base_asset_id, quote_asset_id, volume, trades) 
                select date(timestamp), base_asset_id, quote_asset_id, sum(volume), count(*) from trades
                where date(timestamp) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
                group by base_asset_id, quote_asset_id, date(timestamp)`, [],
            function (err, rows, fields) {
                if (err)
                    console.log("nightlyJob markets error", err);
            }
        );
    }
    catch(e) {
        console.log("Error performing markets_daily job",e);
    }

    try {
        if (connectionPool == null)
            createConnectionPool();

        connectionPool.query(
            `insert into assets_daily (stat_date, asset_id, price, tvl, volume, trades) select stat_date, asset_id, avg(price) as price, sum(tvl) as tvl, sum(volume) as volume, sum(trades) as trades from (
    select date(timestamp) as stat_date, base_asset_id as asset_id, (select price from assets where asset_id = trades.base_asset_id) as price, (select tvl from assets where asset_id = trades.base_asset_id) as tvl, sum(volume) as volume, count(*) as trades from trades
where date(timestamp) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
group by base_asset_id, date(timestamp)
union
select date(timestamp) as stat_date, quote_asset_id as asset_id, (select price from assets where asset_id = trades.quote_asset_id) as price, (select tvl from assets where asset_id = trades.quote_asset_id) as tvl, sum(volume) as volume, count(*) as trades from trades
where date(timestamp) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
group by quote_asset_id, date(timestamp)) stat_data
group by stat_date, asset_id `, [],
            function (err, rows, fields) {
                if (err)
                    console.log("nightlyJob assets error", err);
            }
        );
    }
    catch(e) {
        console.log("Error performing assets_daily job",e);
    }

}

