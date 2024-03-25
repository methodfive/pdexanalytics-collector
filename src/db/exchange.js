import {getConnection, queryAsyncWithRetries} from "./database.js";
import {DB_RETRIES} from "../constants.js";

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

export async function updateExchange24H() {
    try {
        let connectionPool = getConnection();

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
    exchange_24h.treasury_balance = COALESCE(exchange_daily.treasury_balance, 0),
    exchange_24h.total_issuance = COALESCE(exchange_daily.total_issuance, 0),
    exchange_24h.treasury_tvl = COALESCE(exchange_daily.treasury_tvl, 0),
    exchange_24h.previous_tvl = COALESCE(previous_data.tvl, 0),
    previous_volume = COALESCE(ag2.prev_volume, 0),
    exchange_24h.previous_users = COALESCE(previous_data.users, 0),
    exchange_24h.previous_trades = COALESCE(ag2.prev_trades, 0),
    exchange_24h.previous_total_staked = COALESCE(previous_data.total_staked, 0),
    exchange_24h.previous_staked_tvl = COALESCE(previous_data.staked_tvl, 0),
    exchange_24h.previous_total_holders = COALESCE(previous_data.total_holders, 0),
    exchange_24h.previous_total_stakers = COALESCE(previous_data.total_stakers, 0),
    exchange_24h.previous_treasury_balance = COALESCE(previous_data.treasury_balance, 0),
    exchange_24h.previous_total_issuance = COALESCE(previous_data.total_issuance, 0),
    exchange_24h.previous_treasury_tvl = COALESCE(previous_data.treasury_tvl, 0)
`,
            [],
            ([rows,fields]) => {},
            DB_RETRIES
        );
    }
    catch(e) {
        console.log("Error performing exhange 24h",e);
    }
}

export async function updateExchangeDaily()
{

    try {
        let connectionPool = getConnection();

        await queryAsyncWithRetries(connectionPool,
            `update exchange_daily set
                volume = (select sum(volume) from trades where date(timestamp) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)),
                trades = (select count(*) from trades where date(timestamp) = DATE_SUB(CURDATE(), INTERVAL 1 DAY))
            where stat_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY)`,
            [],
            ([rows,fields]) => {},
            DB_RETRIES
        );
    }
    catch(e) {
        console.log("Error updating exchange daily",e);
    }
}

export async function newExchangeDailyDay()
{
    try {
        let connectionPool = getConnection();

        await queryAsyncWithRetries(connectionPool,
            `INSERT INTO exchange_daily (stat_date, tvl, users, total_staked, staked_tvl, total_holders, total_stakers, total_issuance, treasury_balance, treasury_tvl)
select CURDATE(), tvl, users, total_staked, staked_tvl, total_holders, total_stakers, total_issuance, treasury_balance, treasury_tvl from exchange_daily old_exchange_daily where stat_date != CURDATE() order by stat_date desc limit 1
ON DUPLICATE KEY UPDATE 
            tvl = IF(exchange_daily.tvl is null, old_exchange_daily.tvl, exchange_daily.tvl),
            users = IF(exchange_daily.users is null, old_exchange_daily.users, exchange_daily.users),
            total_staked = IF(exchange_daily.total_staked is null, old_exchange_daily.total_staked, exchange_daily.total_staked),
            staked_tvl = IF(exchange_daily.staked_tvl is null, old_exchange_daily.staked_tvl, exchange_daily.staked_tvl),
            total_holders = IF(exchange_daily.total_holders is null, old_exchange_daily.total_holders, exchange_daily.total_holders),
            total_stakers = IF(exchange_daily.total_stakers is null, old_exchange_daily.total_stakers, exchange_daily.total_stakers),
            total_issuance = IF(exchange_daily.total_issuance is null, old_exchange_daily.total_issuance, exchange_daily.total_issuance),
            treasury_balance = IF(exchange_daily.treasury_balance is null, old_exchange_daily.treasury_balance, exchange_daily.treasury_balance),
            treasury_tvl = IF(exchange_daily.treasury_tvl is null, old_exchange_daily.treasury_tvl, exchange_daily.treasury_tvl)
            `,
            [],
            ([rows,fields]) => {},
            DB_RETRIES
        );
    }
    catch(e) {
        console.log("Error creating new exchange day", e);
    }
}

export async function cleanExchange()
{
    try {
        let connectionPool = getConnection();

        await queryAsyncWithRetries(connectionPool,
            `delete from exchange_hourly where stat_time <= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
            [],
            ([rows,fields]) => {},
            DB_RETRIES
        );
    }
    catch(e) {
        console.log("Error cleaning trade",e);
    }
}

export async function updateExchangeHourly(currentTime)
{

    try {
        let connectionPool = getConnection();

        await queryAsyncWithRetries(connectionPool,
            `delete from exchange_hourly where stat_time = ?`,
            [currentTime],
            ([rows,fields]) => {},
            DB_RETRIES
        );

        await queryAsyncWithRetries(connectionPool,
            `insert into exchange_hourly (stat_time, tvl, volume, users, trades, total_staked, staked_tvl, total_holders, total_stakers, total_issuance, treasury_balance, treasury_tvl)
        select ?, tvl, volume, users, trades, total_staked, staked_tvl, total_holders, total_stakers, total_issuance, treasury_balance, treasury_tvl from exchange_daily order by stat_date desc limit 1`,
            [currentTime],
            ([rows,fields]) => {},
            DB_RETRIES
        );
    }
    catch(e) {
        console.log("Error updating exchange hourly",e);
    }
}
