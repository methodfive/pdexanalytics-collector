import {getAssetsFromMarket, isEmpty, isMapEmpty} from "../util.js";
import {getConnection, queryAsyncWithRetries} from "./database.js";
import {DB_RETRIES} from "../constants.js";

export async function saveMarkets(markets)
{
    if(isMapEmpty(markets))
        return;

    for (let key of markets.keys()) {
        let market = markets.get(key);
        await saveMarket(market);
    }
}

export async function saveMarket(market)
{
    if(market == null || isEmpty(market.market))
        return;

    console.log("Save market:",market);

    try {
        let connectionPool = getConnection();

        let marketPairs = getAssetsFromMarket(market.market);

        await queryAsyncWithRetries(connectionPool,
            `INSERT INTO markets (base_asset_id, quote_asset_id, is_active, price) values (?, ?, ?, ?) as new_data
         ON DUPLICATE KEY UPDATE 
            is_active = new_data.is_active,
            price = IF(new_data.price is null, markets.price, new_data.price)`,
            [marketPairs[0], marketPairs[1], 1, market.price],
            ([rows,fields]) => {},
            DB_RETRIES
        );
    }
    catch(e) {
        console.log("Error saving market",e);
    }
}

export async function updateMarketsDaily(yesterday)
{
    try {
        let currentDate = " CURDATE()";
        if(yesterday != null && yesterday)
        {
            currentDate = " DATE_SUB(CURDATE(), INTERVAL 1 DAY)";
        }
        let connectionPool = getConnection();

        await queryAsyncWithRetries(connectionPool,
            `delete from markets_daily where date(stat_date) = ` + currentDate,
            [],
            ([rows,fields]) => {},
            DB_RETRIES
        );

        await queryAsyncWithRetries(connectionPool,
            `insert into markets_daily (stat_date, base_asset_id, quote_asset_id, volume, volume_quote, volume_base, trades) 
                select date(timestamp), base_asset_id, quote_asset_id, sum(volume), sum(volume_quote), sum(quantity), count(*) from trades
                where date(timestamp) = ` + currentDate + `
                group by base_asset_id, quote_asset_id, date(timestamp)
                union
                select ` + currentDate + ` as stat_date, base_asset_id, quote_asset_id, 0, 0, 0, 0 from markets where not exists (select * from trades where base_asset_id=markets.base_asset_id and quote_asset_id = markets.quote_asset_id)
            `,
            [],
            ([rows,fields]) => {},
            DB_RETRIES
        );
    }
    catch(e) {
        console.error("Error performing markets_daily job",e);
    }
}

export async function updateMarkets24H() {
    try {
        let connectionPool = getConnection();

        await queryAsyncWithRetries(connectionPool,
            `
INSERT INTO markets_24h (base_asset_id, quote_asset_id, trades, volume, volume_quote, volume_base, previous_trades, previous_volume, previous_volume_quote, previous_volume_base, price_low, price_high, price_24h) 
SELECT 
    markets.base_asset_id, 
    markets.quote_asset_id, 
    COALESCE(ag1.trades,0) AS trades, 
    COALESCE(ag1.volume,0) AS volume, 
    COALESCE(ag1.volume_quote,0) AS volume_quote, 
    COALESCE(ag1.volume_base,0) AS volume_base, 
    COALESCE(ag2.trades,0) AS previous_trades, 
    COALESCE(ag2.volume,0) AS previous_volume,
    COALESCE(ag2.volume_quote,0) AS previous_volume_quote,
    COALESCE(ag2.volume_base,0) AS previous_volume_base,
    ag1.price_low, 
    ag1.price_high,
    COALESCE(previous_price.price,0) AS price_24h
FROM markets 
JOIN assets a1 ON a1.asset_id = markets.base_asset_id 
JOIN assets a2 ON a2.asset_id = markets.quote_asset_id 
LEFT OUTER JOIN ( 
    SELECT COUNT(*) AS trades,SUM(volume) AS volume, SUM(volume_quote) AS volume_quote, SUM(quantity) as volume_base, min(price) as price_low, max(price) as price_high, base_asset_id, quote_asset_id FROM trades 
    WHERE timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR)  
    GROUP BY base_asset_id, quote_asset_id 
) ag1 ON ag1.base_asset_id = markets.base_asset_id AND ag1.quote_asset_id = markets.quote_asset_id 
LEFT OUTER JOIN ( 
    SELECT COUNT(*) AS trades,SUM(volume) AS volume, SUM(volume_quote) AS volume_quote, SUM(quantity) as volume_base, base_asset_id, quote_asset_id FROM trades 
    WHERE timestamp < DATE_SUB(NOW(), INTERVAL 24 HOUR) AND timestamp > DATE_SUB(NOW(), INTERVAL 48 HOUR) 
    GROUP BY base_asset_id, quote_asset_id 
) ag2 ON ag2.base_asset_id = markets.base_asset_id AND ag2.quote_asset_id = markets.quote_asset_id 
LEFT OUTER JOIN ( 
    SELECT MAX(trade_id) AS trade_id,base_asset_id, quote_asset_id FROM trades 
    WHERE timestamp <= DATE_SUB(NOW(), INTERVAL 1 DAY)    
    GROUP BY base_asset_id, quote_asset_id 
) previous_trade_time ON previous_trade_time.base_asset_id = markets.base_asset_id AND previous_trade_time.quote_asset_id = markets.quote_asset_id 
LEFT OUTER JOIN trades previous_price ON previous_price.trade_id = previous_trade_time.trade_id 
ON DUPLICATE KEY UPDATE 
    trades = COALESCE(ag1.trades,0), 
    volume = COALESCE(ag1.volume,0), 
    volume_quote = COALESCE(ag1.volume_quote,0), 
    volume_base = COALESCE(ag1.volume_base,0), 
    previous_trades = COALESCE(ag2.trades,0), 
    previous_volume = COALESCE(ag2.volume,0),
    previous_volume_quote = COALESCE(ag2.volume_quote,0),
    previous_volume_base = COALESCE(ag2.volume_base,0),
    price_low = ag1.price_low,
    price_high = ag1.price_high,
    price_24h = COALESCE(previous_price.price, 0)
`,
            [],
            ([rows, fields]) => {
            },
            DB_RETRIES
        );
    }
    catch(e) {
        console.error("Error performing markets 24h",e);
    }
}