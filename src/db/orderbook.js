import {getConnection, queryAsyncWithRetries} from "./database.js";
import {DB_RETRIES} from "../constants.js";
import {getAssetsFromMarket} from "../util.js";

export async function getOrderBookOrders(market) {
    let results = [];
    try {
        let connectionPool = getConnection();

        const assets = getAssetsFromMarket(market);

        await queryAsyncWithRetries(connectionPool,
            `
SELECT base_asset_id, quote_asset_id, price, side from orderbook where base_asset_id = ? and quote_asset_id = ?
`,
                [assets[0], assets[1]],
                ([rows,fields]) => {
                    for(let i = 0; i < rows.length; i++)
                    {
                        results.push([
                            rows[i].base_asset_id,
                            rows[i].quote_asset_id,
                            rows[i].price,
                            rows[i].side
                        ]);
                    }
                },
                DB_RETRIES
        );
    }
    catch(e) {
        console.error("Error performing getOrderBook",e);
    }
    return results;
}

export async function saveOrderBook(market, results) {
    try {
        let connectionPool = getConnection();

        const assets = getAssetsFromMarket(market);
        const data = [];
        for (let i = 0; i < results.length; i++) {
            data.push([ results[i].stid, assets[0], assets[1], results[i].p, results[i].q, results[i].s ]);
        }

        let i, j, tempArray, chunk = 10000;
        for (i = 0, j = data.length; i < j; i += chunk) {
            tempArray = data.slice(i, i + chunk);
            await queryAsyncWithRetries(connectionPool,
            `
INSERT INTO orderbook (stid, base_asset_id, quote_asset_id, price, quantity, side) values ? as new_data 
ON DUPLICATE KEY UPDATE quantity = new_data.quantity
`,
                [tempArray],
                ([result]) => { },
                DB_RETRIES
            );
        }
    }
    catch(e) {
        console.error("Error performing saveOrderBook",e);
    }
}

export async function setOrderBookUpdateTS() {
    try {
        let connectionPool = getConnection();

        await queryAsyncWithRetries(connectionPool,
            `
update orderbook_lastupdate set last_update = CURRENT_TIMESTAMP()
`,
            [],
            ([rows,fields]) => {},
            DB_RETRIES
        );
    }
    catch(e) {
        console.log("Error cleaning setOrderBookUpdateTS",e);
    }
}

export async function cleanOrderBook(ordersToRemove) {
    try {
        let connectionPool = getConnection();

        let i, j, tempArray, chunk = 10000;
        for (i = 0, j = ordersToRemove.length; i < j; i += chunk) {
            tempArray = ordersToRemove.slice(i, i + chunk);

            await queryAsyncWithRetries(connectionPool,
                `
delete from orderbook where (base_asset_id, quote_asset_id, price, side) in (?)
`,
                [tempArray],
                ([rows,fields]) => {},
                DB_RETRIES
            );
        }
    }
    catch(e) {
        console.error("Error performing cleanOrderBook",e);
    }
}