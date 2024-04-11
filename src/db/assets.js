import {getConnection, queryAsyncWithRetries} from "./database.js";
import {DB_RETRIES} from "../constants.js";
import {convertBalance, isEmpty, isMapEmpty} from "../util.js";

export async function updateAssets24H() {
    try {
        let connectionPool = getConnection();

        await queryAsyncWithRetries(connectionPool,
            `
INSERT INTO assets_24h(asset_id, tvl, fees, fees_value, new_fees, new_fees_value, price, balance, volume, trades, previous_tvl, previous_fees, previous_fees_value, previous_new_fees, previous_new_fees_value, previous_price, previous_balance, previous_volume, previous_trades)   
SELECT assets.asset_id, 
    COALESCE(assets.tvl, 0) AS tvl, 
    COALESCE(assets.fees,0) AS fees, 
    COALESCE(assets.fees_value,0) AS fees_value, 
    COALESCE(assets.fees,0) AS new_fees, 
    COALESCE(assets.fees_value,0) AS new_fees_value, 
    COALESCE(assets.price,0) AS price, 
    assets.balance, 
    COALESCE(ag1.volume,0) AS volume, 
    COALESCE(ag1.trades,0) AS trades, 
    COALESCE(previous.tvl,0) AS previous_tvl, 
    COALESCE(previous.fees,0) AS previous_fees, 
    COALESCE(previous.fees_value,0) AS previous_fees_value, 
    COALESCE(previous.new_fees,0) AS previous_new_fees, 
    COALESCE(previous.new_fees_value,0) AS previous_new_fees_value, 
    COALESCE(previous.price,0) AS previous_price, 
    COALESCE(previous.balance,0) AS previous_balance, 
    COALESCE(ag2.volume, 0) AS previous_volume,  
    COALESCE(ag2.trades, 0) AS previous_trades 
 FROM assets 
 LEFT OUTER JOIN ( 
    SELECT MAX(stat_time) AS stat_time, asset_id FROM assets_hourly 
    WHERE assets_hourly.stat_time <= DATE_SUB(NOW(), INTERVAL 1 DAY) 
    GROUP BY asset_id) previous_stat_time ON previous_stat_time.asset_id = assets.asset_id 
 LEFT OUTER JOIN 
    assets_hourly AS previous ON previous.asset_id = assets.asset_id AND previous.stat_time = previous_stat_time.stat_time 
 LEFT OUTER JOIN ( 
    SELECT COUNT(*) AS trades,SUM(volume) AS volume, base_asset_id AS asset_id 
    FROM trades 
    WHERE timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR) 
    GROUP BY base_asset_id 

    UNION 
                
    SELECT COUNT(*) AS trades,SUM(volume) AS volume, quote_asset_id AS asset_id 
    FROM trades 
    WHERE timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR) GROUP BY quote_asset_id 
) ag1 ON ag1.asset_id = assets.asset_id 
LEFT OUTER JOIN ( 
    SELECT COUNT(*) AS trades,SUM(volume) AS volume, base_asset_id AS asset_id 
    FROM trades 
    WHERE timestamp < DATE_SUB(NOW(), INTERVAL 24 HOUR) AND timestamp > DATE_SUB(NOW(), INTERVAL 48 HOUR)  
    GROUP BY base_asset_id 

    UNION 
                
    SELECT COUNT(*) AS trades,SUM(volume) AS volume, quote_asset_id AS asset_id 
    FROM trades 
    WHERE timestamp < DATE_SUB(NOW(), INTERVAL 24 HOUR) AND timestamp > DATE_SUB(NOW(), INTERVAL 48 HOUR)  
    GROUP BY quote_asset_id 
) ag2 ON ag2.asset_id = assets.asset_id 
ON DUPLICATE KEY UPDATE 
    tvl = COALESCE(assets.tvl, 0), 
    fees = COALESCE(assets.fees,0), 
    fees_value = COALESCE(assets.fees_value,0), 
    new_fees = COALESCE(assets.new_fees,0), 
    new_fees_value = COALESCE(assets.new_fees_value,0), 
    price = COALESCE(assets.price,0), 
    balance = assets.balance, 
    volume = COALESCE(ag1.volume,0), 
    trades = COALESCE(ag1.trades,0),  
    previous_tvl = COALESCE(previous.tvl,0), 
    previous_price = COALESCE(previous.price,0), 
    previous_balance = COALESCE(previous.balance,0),
    previous_volume = COALESCE(ag2.volume, 0), 
    previous_trades = COALESCE(ag2.trades, 0)
`,
            [],
            ([rows,fields]) => {},
            DB_RETRIES
        );
    }
    catch(e) {
        console.error("Error performing assets 24h",e);
    }
}

export async function updateAssetsDaily(yesterday)
{
    try {
        let connectionPool = getConnection();

        let currentDate = " CURDATE()";
        if(yesterday != null && yesterday)
        {
            currentDate = " DATE_SUB(CURDATE(), INTERVAL 1 DAY)";
        }

        await queryAsyncWithRetries(connectionPool,
            `delete from assets_daily where date(stat_date) = ` + currentDate,
            [],
            ([rows,fields]) => {},
            DB_RETRIES
        );

        await queryAsyncWithRetries(connectionPool,
            `insert into assets_daily (stat_date, asset_id, fees, fees_value, new_fees, new_fees_value, balance, price, tvl, volume, trades) 
select stat_date, asset_id, avg(fees) as fees, avg(fees_value) as fees_value, avg(new_fees) as new_fees, avg(new_fees_value) as new_fees_value, avg(balance) as balance, avg(price) as price, sum(tvl) as tvl, sum(volume) as volume, sum(trades) as trades from (
 
 select date(timestamp) as stat_date, base_asset_id as asset_id, (select fees from assets where asset_id = trades.base_asset_id) as fees, (select fees_value from assets where asset_id = trades.base_asset_id) as fees_value, (select new_fees from assets where asset_id = trades.base_asset_id) as new_fees, (select new_fees_value from assets where asset_id = trades.base_asset_id) as new_fees_value, (select balance from assets where asset_id = trades.base_asset_id) as balance, (select price from assets where asset_id = trades.base_asset_id) as price, (select tvl from assets where asset_id = trades.base_asset_id) as tvl, sum(volume) as volume, count(*) as trades from trades
where date(timestamp) = ` + currentDate + `
group by base_asset_id, date(stat_date)

union

select date(timestamp) as stat_date, quote_asset_id as asset_id, (select fees from assets where asset_id = trades.quote_asset_id) as fees, (select fees_value from assets where asset_id = trades.quote_asset_id) as fees_value, (select new_fees from assets where asset_id = trades.quote_asset_id) as new_fees, (select new_fees_value from assets where asset_id = trades.quote_asset_id) as new_fees_value, (select balance from assets where asset_id = trades.quote_asset_id) as balance, (select price from assets where asset_id = trades.quote_asset_id) as price, (select tvl from assets where asset_id = trades.quote_asset_id) as tvl, sum(volume) as volume, count(*) as trades from trades
where date(timestamp) = ` + currentDate + `
group by quote_asset_id, date(stat_date)

union

select ` + currentDate + ` as stat_date, asset_id, fees, fees_value, new_fees, new_fees_value, balance, price, 
tvl, 0, 0 from assets 
where not exists (select * from trades where base_asset_id=assets.asset_id or quote_asset_id = assets.asset_id)
                
) stat_data
group by stat_date, asset_id`,
            [],
            ([rows,fields]) => {},
            DB_RETRIES
        );
    }
    catch(e) {
        console.error("Error performing assets_daily job",e);
    }
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
        let connectionPool = getConnection();

        await queryAsyncWithRetries(connectionPool,
            `INSERT INTO assets (asset_id, symbol, name, price, tvl, is_active, balance, fees, fees_value, new_fees, new_fees_value) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) as new_data 
             ON DUPLICATE KEY UPDATE 
                symbol = new_data.symbol,
                name = new_data.name,
                price = IF(new_data.price is null, assets.price, new_data.price),
                tvl = IF(new_data.tvl is null, assets.tvl, new_data.tvl),
                is_active = new_data.is_active,
                balance = IF(new_data.balance is null, assets.balance, new_data.balance),
                fees = IF(new_data.fees is null, assets.fees, new_data.fees),
                fees_value = IF(new_data.fees_value is null, assets.fees_value, new_data.fees_value),
                new_fees = IF(new_data.new_fees is null, assets.new_fees, new_data.new_fees),
                new_fees_value = IF(new_data.new_fees_value is null, assets.new_fees_value, new_data.new_fees_value)`,
            [asset.asset_id, asset.symbol, asset.name, asset.price, asset.tvl, 1, convertBalance(asset.balance), asset.fees, asset.fees_value, asset.new_fees, asset.new_fees_value],
            ([rows,fields]) => {},
            DB_RETRIES
        );
    }
    catch(e) {
        console.error("Error saving asset",e);
    }
}

export async function cleanAssets()
{
    try {
        let connectionPool = getConnection();

        await queryAsyncWithRetries(connectionPool,
            `delete from assets_hourly where stat_time <= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
            [],
            ([rows,fields]) => {},
            DB_RETRIES
        );
    }
    catch(e) {
        console.error("Error cleaning assets",e);
    }
}

export async function updateAssetsHourly(currentTime)
{
    try {
        let connectionPool = getConnection();

        await queryAsyncWithRetries(connectionPool,
            `delete from assets_hourly where stat_time = ?`,
            [currentTime],
            ([rows,fields]) => {},
            DB_RETRIES
        );

        await queryAsyncWithRetries(connectionPool,
            `insert into assets_hourly (stat_time,asset_id, tvl, price, balance, fees, fees_value, new_fees, new_fees_value)
        select ?, asset_id, tvl, price, balance, fees, fees_value, new_fees, new_fees_value  from assets`,
            [currentTime],
            ([rows,fields]) => {},
            DB_RETRIES
        );
    }
    catch(e) {
        console.log("Error updating assets hourly",e);
    }
}

export async function getPreviousFeeTotal()
{
    let results = new Map();
    try {
        let connectionPool = getConnection();

        await queryAsyncWithRetries(connectionPool,
            `select assets.asset_id, assets_daily.fees from assets assets 
                 JOIN (SELECT MAX(assets_daily.stat_date) AS stat_date, asset_id FROM assets_daily where stat_date <= DATE_SUB(CURDATE(), INTERVAL 1 DAY) group by asset_id) previous_assets_daily on previous_assets_daily.asset_id = assets.asset_id 
                 JOIN assets_daily assets_daily on assets_daily.stat_date = previous_assets_daily.stat_date and assets_daily.asset_id = assets.asset_id `,
            [],
            ([rows,fields]) => {
                for(let i = 0; i < rows.length; i++)
                {
                    if(rows[i].fees == null)
                        rows[i].fees = 0;

                    results.set(rows[i].asset_id, rows[i]);
                }
            },
            DB_RETRIES
        );
    }
    catch(e) {
        console.error("Error getting previous days fee total",e);
    }
    return results;
}

export async function getAssetPrices()
{
    console.log("getAssetPrices:");

    let connectionPool = null;
    let results = new Map();

    try {
        connectionPool = await getConnection();

        await queryAsyncWithRetries(connectionPool,
            `select asset_id, price from assets`,
            null,
            ([rows,fields]) => {
                for(let i = 0; i < rows.length; i++)
                {
                    results.set(rows[i].asset_id, rows[i].price);
                }
            }, DB_RETRIES);
    }
    catch(e) {
        console.error("Error fetching getassets prices",e);
    }

    return results;
}