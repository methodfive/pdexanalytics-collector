import {getConnection, queryAsyncWithRetries} from "./database.js";
import {DB_RETRIES} from "../constants.js";
import {convertBalance, isEmpty, isMapEmpty} from "../util.js";

export async function getFeeWithdrawals()
{
    let results = new Map();
    try {
        let connectionPool = getConnection();

        await queryAsyncWithRetries(connectionPool,
            `select asset_symbol, asset_id, sum(amount) as amount from fee_withdrawals 
join assets on assets.symbol= fee_withdrawals.asset_symbol 
group by asset_symbol, asset_id`,
            [],
            ([rows,fields]) => {
                for(let i = 0; i < rows.length; i++)
                {
                    results.set(rows[i].asset_id, Number(rows[i].amount));
                }
            },
            DB_RETRIES
        );
    }
    catch(e) {
        console.error("Error getting fee withdrawals",e);
    }
    return results;
}

export async function saveFeeWithdawal(transferID, symbol, amount)
{
    if(isEmpty(symbol) || isEmpty(amount) || isEmpty(transferID))
        return;

    console.log("saveFeeWithdawal");

    try {
        let connectionPool = getConnection();

        await queryAsyncWithRetries(connectionPool,
            `INSERT IGNORE INTO fee_withdrawals (transfer_id, asset_symbol, amount) values (?, ?, ?)`,
            [transferID, symbol, amount],
            ([rows,fields]) => {},
            DB_RETRIES
        );
    }
    catch(e) {
        console.error("Error saving fee withdrawal",e);
    }
}