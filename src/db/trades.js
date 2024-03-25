import {getConnection, queryAsyncWithRetries} from "./database.js";
import {getAssetsFromMarket, getDateFromUtc} from "../util.js";
import {DB_RETRIES} from "../constants.js";

export async function saveTrade(trade)
{
    if(trade == null)
        return;

    console.log("Save trade:",trade);

    try {
        let connectionPool = getConnection();

        let marketPairs = getAssetsFromMarket(trade.m);

        await queryAsyncWithRetries(connectionPool,
            `INSERT INTO trades (trade_id, base_asset_id, quote_asset_id, price, quantity, volume, timestamp, m_id, t_id, m_cid, t_cid, m_side, t_side, trade_oid) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) as new_data
         ON DUPLICATE KEY UPDATE 
            base_asset_id = new_data.base_asset_id,
            quote_asset_id = new_data.quote_asset_id,
            price = new_data.price,
            quantity = new_data.quantity,
            volume = new_data.volume,
            m_id = new_data.m_id,
            t_id = new_data.t_id,
            m_cid = new_data.m_cid,
            t_cid = new_data.t_cid,
            m_side = new_data.m_side,
            t_side = new_data.t_side,
            trade_oid = new_data.trade_oid,
            timestamp = new_data.timestamp`,
            [trade.stid, marketPairs[0], marketPairs[1], trade.p, trade.q, trade.vq, getDateFromUtc(trade.t),
                trade.m_id, trade.t_id, trade.m_cid, trade.t_cid, trade.m_side, trade.t_side, trade.trade_id],
            ([rows,fields]) => {},
            DB_RETRIES
        );
    }
    catch(e) {
        console.log("Error saving trade",e);
    }
}


export async function cleanTrades()
{
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
        console.log("Error cleaning trade",e);
    }
}

