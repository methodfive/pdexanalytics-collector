import {getConnection, queryAsyncWithRetries} from "./database.js";
import {DB_RETRIES} from "../constants.js";

export async function updateCaches()
{
    console.log("caches");
    try {
        let connectionPool = getConnection();

        await queryAsyncWithRetries(connectionPool,
            `insert into markets_24h (base_asset_id, quote_asset_id, trades, volume, previous_trades, previous_volume)
select markets.base_asset_id, markets.quote_asset_id, coalesce(ag1.trades,0) as trades, coalesce(ag1.volume,0) as volume, 
coalesce(ag2.trades,0) as previous_trades, coalesce(ag2.volume,0) as previous_volume from markets
 join assets a1 on a1.asset_id = markets.base_asset_id 
 join assets a2 on a2.asset_id = markets.quote_asset_id
 left outer join (
                select count(*) as trades,sum(volume) as volume, base_asset_id, quote_asset_id from trades
                where timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR) 
                group by base_asset_id, quote_asset_id 
                ) ag1 on ag1.base_asset_id = markets.base_asset_id and ag1.quote_asset_id = markets.quote_asset_id 
 left outer join (
                select count(*) as trades,sum(volume) as volume, base_asset_id, quote_asset_id from trades
                where timestamp < DATE_SUB(NOW(), INTERVAL 24 HOUR) and
                timestamp > DATE_SUB(NOW(), INTERVAL 48 HOUR) 
                group by base_asset_id, quote_asset_id 
                ) ag2 on ag2.base_asset_id = markets.base_asset_id and ag2.quote_asset_id = markets.quote_asset_id 
ON DUPLICATE KEY UPDATE trades=coalesce(ag1.trades,0), volume=coalesce(ag1.volume,0), previous_trades=coalesce(ag2.trades,0), previous_volume=coalesce(ag2.volume,0) `,
            [],
            ([rows,fields]) => {},
            DB_RETRIES
        );

        await queryAsyncWithRetries(connectionPool,
            `insert into assets_24h(asset_id, tvl, price, balance, volume, trades, previous_tvl, previous_price, previous_balance, previous_volume, previous_trades) 
select assets.asset_id, coalesce(assets.tvl, 0) as tvl, coalesce(assets.price,0) as price, assets.balance, coalesce(ag1.volume,0) as volume, coalesce(ag1.trades,0) as trades, 
coalesce(previous.tvl,0) as previous_tvl, coalesce(previous.price,0) as previous_price, coalesce(previous.balance,0) as previous_balance, coalesce(ag2.prev_volume, 0) as previous_volume,  coalesce(ag2.prev_trades, 0) as previous_trades 
 from assets 
 left outer join (
   select max(stat_time) as stat_time, asset_id from assets_hourly 
   where assets_hourly.stat_time <= DATE_SUB(CURTIME(), INTERVAL 1 DAY) group by asset_id) 
previous_stat_time on previous_stat_time.asset_id = assets.asset_id
 left outer join assets_hourly as previous on previous.asset_id = assets.asset_id and previous.stat_time = previous_stat_time.stat_time 
 left outer join (
                select count(*) as trades,sum(volume) as volume, base_asset_id, quote_asset_id from trades
                where timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR) 
                group by base_asset_id, quote_asset_id 
                ) ag1 on ag1.base_asset_id = assets.asset_id or ag1.quote_asset_id = assets.asset_id 
 left outer join (
                select count(*) as prev_trades,sum(volume) as prev_volume, base_asset_id, quote_asset_id from trades
                where timestamp < DATE_SUB(NOW(), INTERVAL 24 HOUR) and
                timestamp > DATE_SUB(NOW(), INTERVAL 48 HOUR) 
                group by base_asset_id, quote_asset_id 
                ) ag2 on ag2.base_asset_id = assets.asset_id or ag2.quote_asset_id = assets.asset_id
ON DUPLICATE KEY 
UPDATE tvl=coalesce(assets.tvl, 0), price = coalesce(assets.price,0), balance = assets.balance, volume = coalesce(ag1.volume,0), 
trades = coalesce(ag1.trades,0),  previous_tvl = coalesce(previous.tvl,0), previous_price = coalesce(previous.price,0), 
previous_balance = coalesce(previous.balance,0),previous_volume = coalesce(ag2.prev_volume, 0), previous_trades = coalesce(ag2.prev_trades, 0)
`,
            [],
            ([rows,fields]) => {},
            DB_RETRIES
        );

        await queryAsyncWithRetries(connectionPool,
            `
insert into exchange_24h (tvl, volume, users, trades, total_staked, staked_tvl, total_holders, 
  total_stakers, previous_tvl, previous_volume, previous_users, previous_trades, previous_total_staked, previous_staked_tvl, 
  previous_total_holders, previous_total_stakers) 
  
  select coalesce(exchange_daily.tvl,0) as tvl, coalesce(ag1.volume,0) as volume, coalesce(exchange_daily.users,0) as users, coalesce(ag1.trades,0) as trades, 
  coalesce(exchange_daily.total_staked,0) as total_staked, coalesce(exchange_daily.staked_tvl,0) as staked_tvl, 
  coalesce(exchange_daily.total_holders,0) as total_holders, coalesce(exchange_daily.total_stakers,0) as total_stakers, 
coalesce(previous_data.tvl,0) as previous_tvl, coalesce(ag2.prev_volume,0) as previous_volume, coalesce(previous_data.users,0) as previous_users, coalesce(ag2.prev_trades,0) as previous_trades, 
  coalesce(previous_data.total_staked,0) as previous_total_staked, coalesce(previous_data.staked_tvl,0) as previous_staked_tvl, 
  coalesce(previous_data.total_holders,0) as previous_total_holders, coalesce(previous_data.total_stakers,0) as previous_total_stakers 
  from exchange_daily 
  
cross join (
   select max(stat_time) as stat_time from exchange_hourly  
   where exchange_hourly.stat_time <= DATE_SUB(CURTIME(), INTERVAL 1 DAY)) previous_stat_time 

left outer join exchange_hourly as previous_data on previous_data.stat_time = previous_stat_time.stat_time 

cross join (
                select count(*) as trades,sum(volume) as volume from trades
                where timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR) 
                ) ag1 
cross join (
                select count(*) as prev_trades,sum(volume) as prev_volume from trades
                where timestamp < DATE_SUB(NOW(), INTERVAL 24 HOUR) and
                timestamp > DATE_SUB(NOW(), INTERVAL 48 HOUR) 
                ) ag2 
  order by exchange_daily.stat_date desc limit 1 
  
  ON DUPLICATE KEY UPDATE 
  tvl = coalesce(exchange_daily.tvl,0), volume = coalesce(ag1.volume,0), users = coalesce(exchange_daily.users,0), trades = coalesce(ag1.trades,0), 
  total_staked = coalesce(exchange_daily.total_staked,0), staked_tvl = coalesce(exchange_daily.staked_tvl,0), 
  total_holders = coalesce(exchange_daily.total_holders,0), total_stakers = coalesce(exchange_daily.total_stakers,0), 
previous_tvl = coalesce(previous_data.tvl,0), previous_volume = coalesce(ag2.prev_volume,0), previous_users = coalesce(previous_data.users,0), previous_trades = coalesce(ag2.prev_trades,0), 
  previous_total_staked = coalesce(previous_data.total_staked,0), previous_staked_tvl = coalesce(previous_data.staked_tvl,0), 
  previous_total_holders = coalesce(previous_data.total_holders,0), previous_total_stakers = coalesce(previous_data.total_stakers,0)             
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