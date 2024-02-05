import {getConnection, queryAsyncWithRetries} from "./database.js";
import {DB_RETRIES} from "../constants.js";

export async function hourlyJob()
{
    let currentTime = new Date();
    currentTime.setMilliseconds(0)
    currentTime.setSeconds(0);
    currentTime.setMinutes(0);
    console.log("hourly job", currentTime);

    try {
        let connectionPool = getConnection();

        await queryAsyncWithRetries(connectionPool,
            `delete from assets_hourly where stat_time = ?`,
            [currentTime],
            ([rows,fields]) => {},
            DB_RETRIES
        );

        await queryAsyncWithRetries(connectionPool,
            `insert into assets_hourly (stat_time,asset_id, tvl, price, balance)
        select ?, asset_id, tvl, price, balance from assets`,
            [currentTime],
            ([rows,fields]) => {},
            DB_RETRIES
        );

        await newExchangeDailyDay(connectionPool); //ensure exchange_daily exists for current day

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
        console.log("Error performing hourlyJob job",e);
    }
}

export async function newExchangeDailyDay(connectionPool)
{
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

export async function nightlyJob()
{
    console.log("Night job");

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

        await newExchangeDailyDay(connectionPool);
    }
    catch(e) {
        console.log("Error performing exchange_daily job",e);
    }

    try {
        let connectionPool = getConnection();

        await queryAsyncWithRetries(connectionPool,
            `delete from trades where timestamp <= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`,
            [],
            ([rows,fields]) => {},
            DB_RETRIES
        );
    }
    catch(e) {
        console.log("Error performing delete job",e);
    }

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
        console.log("Error performing delete job",e);
    }

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
        console.log("Error performing delete job",e);
    }

    try {
        let connectionPool = getConnection();

        await queryAsyncWithRetries(connectionPool,
            `delete from markets_daily where date(stat_date) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)`,
            [],
            ([rows,fields]) => {},
            DB_RETRIES
        );

        await queryAsyncWithRetries(connectionPool,
            `insert into markets_daily (stat_date, base_asset_id, quote_asset_id, volume, trades) 
                select date(timestamp), base_asset_id, quote_asset_id, sum(volume), count(*) from trades
                where date(timestamp) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
                group by base_asset_id, quote_asset_id, date(timestamp)`,
            [],
            ([rows,fields]) => {},
            DB_RETRIES
        );
    }
    catch(e) {
        console.log("Error performing markets_daily job",e);
    }

    try {
        let connectionPool = getConnection();

        await queryAsyncWithRetries(connectionPool,
            `delete from assets_daily where date(stat_date) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)`,
            [],
            ([rows,fields]) => {},
            DB_RETRIES
        );

        await queryAsyncWithRetries(connectionPool,
            `insert into assets_daily (stat_date, asset_id, balance, price, tvl, volume, trades) select stat_date, asset_id, avg(balance) as balance, avg(price) as price, sum(tvl) as tvl, sum(volume) as volume, sum(trades) as trades from (
    select date(timestamp) as stat_date, base_asset_id as asset_id, (select balance from assets where asset_id = trades.base_asset_id) as balance, (select price from assets where asset_id = trades.base_asset_id) as price, (select tvl from assets where asset_id = trades.base_asset_id) as tvl, sum(volume) as volume, count(*) as trades from trades
where date(timestamp) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
group by base_asset_id, date(stat_date)
union
select date(timestamp) as stat_date, quote_asset_id as asset_id, (select balance from assets where asset_id = trades.quote_asset_id) as balance, (select price from assets where asset_id = trades.quote_asset_id) as price, (select tvl from assets where asset_id = trades.quote_asset_id) as tvl, sum(volume) as volume, count(*) as trades from trades
where date(timestamp) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
group by quote_asset_id, date(stat_date)) stat_data
group by stat_date, asset_id`,
            [],
            ([rows,fields]) => {},
            DB_RETRIES
        );
    }
    catch(e) {
        console.log("Error performing assets_daily job",e);
    }

}