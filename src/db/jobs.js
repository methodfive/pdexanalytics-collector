import {getConnection, queryAsyncWithRetries} from "./database.js";

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
            1
        );

        await queryAsyncWithRetries(connectionPool,
            `insert into assets_hourly (stat_time,asset_id, tvl, price, balance)
        select ?, asset_id, tvl, price, balance from assets`,
            [currentTime],
            ([rows,fields]) => {},
            1
        );

        await queryAsyncWithRetries(connectionPool,
            `INSERT INTO exchange_daily (stat_date, users, tvl, total_staked, staked_tvl) values (CURDATE(), null, (select sum(tvl) from assets), null, null) as new_data
         ON DUPLICATE KEY UPDATE 
            users = IF(new_data.users is null, exchange_daily.users, new_data.users),
            tvl = IF(new_data.tvl is null, exchange_daily.tvl, new_data.tvl),
            total_staked = IF(new_data.total_staked is null, exchange_daily.total_staked, new_data.total_staked),
            staked_tvl = IF(new_data.staked_tvl is null, exchange_daily.staked_tvl, new_data.staked_tvl)`,
            [],
            ([rows,fields]) => {},
            1
        );
    }
    catch(e) {
        console.log("Error performing hourlyJob job",e);
    }
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
            1
        );
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
            1
        );
    }
    catch(e) {
        console.log("Error performing delete job",e);
    }

    try {
        let connectionPool = getConnection();

        await queryAsyncWithRetries(connectionPool,
            `delete from assets_hourly where stat_time <= DATE_SUB(CURTIME(), INTERVAL 7 DAY)`,
            [],
            ([rows,fields]) => {},
            1
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
            1
        );

        await queryAsyncWithRetries(connectionPool,
            `insert into markets_daily (stat_date, base_asset_id, quote_asset_id, volume, trades) 
                select date(timestamp), base_asset_id, quote_asset_id, sum(volume), count(*) from trades
                where date(timestamp) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
                group by base_asset_id, quote_asset_id, date(timestamp)`,
            [],
            ([rows,fields]) => {},
            1
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
            1
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
            1
        );
    }
    catch(e) {
        console.log("Error performing assets_daily job",e);
    }

}