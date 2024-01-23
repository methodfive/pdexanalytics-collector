import {getConnection, queryAsyncWithRetries} from "./database.js";
import {DB_RETRIES} from "../constants.js";
import {newExchangeDailyDay} from "./jobs.js";

export async function updateCaches()
{
    console.log("Updating cached data for dashboard");
    try {
        let connectionPool = getConnection();

        await queryAsyncWithRetries(connectionPool,
            `
INSERT INTO markets_24h (base_asset_id, quote_asset_id, trades, volume, previous_trades, previous_volume) 
SELECT 
    markets.base_asset_id, 
    markets.quote_asset_id, 
    COALESCE(ag1.trades,0) AS trades, 
    COALESCE(ag1.volume,0) AS volume, 
    COALESCE(ag2.trades,0) AS previous_trades, 
    COALESCE(ag2.volume,0) AS previous_volume 
FROM markets 
JOIN assets a1 ON a1.asset_id = markets.base_asset_id 
JOIN assets a2 ON a2.asset_id = markets.quote_asset_id 
LEFT OUTER JOIN ( 
    SELECT COUNT(*) AS trades,SUM(volume) AS volume, base_asset_id, quote_asset_id FROM trades 
    WHERE timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR)  
    GROUP BY base_asset_id, quote_asset_id 
) ag1 ON ag1.base_asset_id = markets.base_asset_id AND ag1.quote_asset_id = markets.quote_asset_id 
LEFT OUTER JOIN ( 
    SELECT COUNT(*) AS trades,SUM(volume) AS volume, base_asset_id, quote_asset_id FROM trades 
    WHERE timestamp < DATE_SUB(NOW(), INTERVAL 24 HOUR) AND timestamp > DATE_SUB(NOW(), INTERVAL 48 HOUR) 
    GROUP BY base_asset_id, quote_asset_id 
) ag2 ON ag2.base_asset_id = markets.base_asset_id AND ag2.quote_asset_id = markets.quote_asset_id 
ON DUPLICATE KEY UPDATE 
    trades = COALESCE(ag1.trades,0), 
    volume = COALESCE(ag1.volume,0), 
    previous_trades = COALESCE(ag2.trades,0), 
    previous_volume = COALESCE(ag2.volume,0) 
`,
            [],
            ([rows,fields]) => {},
            DB_RETRIES
        );

        await queryAsyncWithRetries(connectionPool,
            `
INSERT INTO assets_24h(asset_id, tvl, price, balance, volume, trades, previous_tvl, previous_price, previous_balance, previous_volume, previous_trades)   
SELECT assets.asset_id, 
    COALESCE(assets.tvl, 0) AS tvl, 
    COALESCE(assets.price,0) AS price, 
    assets.balance, 
    COALESCE(ag1.volume,0) AS volume, 
    COALESCE(ag1.trades,0) AS trades, 
    COALESCE(previous.tvl,0) AS previous_tvl, 
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

        await newExchangeDailyDay(connectionPool);

        await queryAsyncWithRetries(connectionPool,
            `
UPDATE exchange_24h 
CROSS JOIN (SELECT MAX(exchange_daily.stat_date) AS stat_date FROM exchange_daily) previous_exchange_daily 
JOIN exchange_daily ON exchange_daily.stat_date = previous_exchange_daily.stat_date 
CROSS JOIN ( 
    SELECT MAX(exchange_hourly.stat_time) AS stat_time FROM exchange_hourly 
    WHERE exchange_hourly.stat_time <= DATE_SUB(NOW(), INTERVAL 1 DAY)) previous_stat_time
LEFT OUTER JOIN exchange_hourly AS previous_data ON previous_data.stat_time = previous_stat_time.stat_time
CROSS JOIN (
    SELECT COUNT(*) AS trades, SUM(volume) AS volume 
    FROM trades
    WHERE timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR)) ag1
CROSS JOIN (SELECT COUNT(*) AS prev_trades, SUM(volume) AS prev_volume
    FROM trades
    WHERE timestamp < DATE_SUB(NOW(), INTERVAL 24 HOUR) AND timestamp > DATE_SUB(NOW(), INTERVAL 48 HOUR)) ag2 
SET 
    exchange_24h.tvl = COALESCE(exchange_daily.tvl, 0),
    exchange_24h.volume = COALESCE(ag1.volume, 0),
    exchange_24h.users = COALESCE(exchange_daily.users, 0),
    exchange_24h.trades = COALESCE(ag1.trades, 0),
    exchange_24h.total_staked = COALESCE(exchange_daily.total_staked, 0),
    exchange_24h.staked_tvl = COALESCE(exchange_daily.staked_tvl, 0),
    exchange_24h.total_holders = COALESCE(exchange_daily.total_holders, 0),
    exchange_24h.total_stakers = COALESCE(exchange_daily.total_stakers, 0),
    exchange_24h.previous_tvl = COALESCE(previous_data.tvl, 0),
    previous_volume = COALESCE(ag2.prev_volume, 0),
    exchange_24h.previous_users = COALESCE(previous_data.users, 0),
    exchange_24h.previous_trades = COALESCE(ag2.prev_trades, 0),
    exchange_24h.previous_total_staked = COALESCE(previous_data.total_staked, 0),
    exchange_24h.previous_staked_tvl = COALESCE(previous_data.staked_tvl, 0),
    exchange_24h.previous_total_holders = COALESCE(previous_data.total_holders, 0),
    exchange_24h.previous_total_stakers = COALESCE(previous_data.total_stakers, 0)
`,
            [],
            ([rows,fields]) => {},
            DB_RETRIES
        );
    }
    catch(e) {
        console.log("Error performing hourlyJob job",e);
    }
}