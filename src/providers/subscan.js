import { createRequire } from 'module';
import {
    PDEX_ASSET,
    POLKADEX_SUBSCAN_EVENTS_URL,
    POLKADEX_SUBSCAN_HOLDERS_URL,
    POLKADEX_SUBSCAN_STATISTICS_URL, POLKADEX_SUBSCAN_TRANSFERS_API, SUBSCAN_ROW_LIMIT
} from "../constants.js";

const require = createRequire(import.meta.url);
const axios = require('axios');

export async function getRegisteredUsers() {
    let response = await axios.post(POLKADEX_SUBSCAN_EVENTS_URL, {
        module: "ocex",
        event_id:"MainAccountRegistered",
        order: "desc",
        page: 1,
        row: 100
    },{
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.SUBSCAN_API_KEY
        }
    }).catch(function (error) {
        console.log(error);
        return null;
    });

    if(response != null && response.data != null && response.data.code == 0)
        return response.data.data.count;
    else
        return null;
}

export async function getTotalHolders() {
    let response = await axios.post(POLKADEX_SUBSCAN_HOLDERS_URL, {
        page: 1,
        row: 100,
        included_zero_balance:false,
        token: PDEX_ASSET
    },{
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.SUBSCAN_API_KEY
        }
    }).catch(function (error) {
        console.log(error);
        return null;
    });

    if(response != null && response.data != null && response.data.code == 0)
        return response.data.data.count;
    else
        return null;
}

export async function getTotalStakers() {
    let response = await axios.post(POLKADEX_SUBSCAN_STATISTICS_URL, {
        type: "role"
    },{
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.SUBSCAN_API_KEY
        }
    }).catch(function (error) {
        console.log(error);
        return null;
    });

    if(response != null && response.data != null && response.data.code == 0) {
        let results = response.data.data;
        if(results != null) {
            for (let i = 0; i < results.length; i++) {
                if (results[i]["role"] == "nominator")
                    return results[i]["count"];
            }
        }
        return null;
    }
    else
        return null;
}

export async function getTransfers(address, after_id) {
    let id = after_id === null ? null : [after_id.block_num, after_id.event_idx];

    let response = await axios.post(POLKADEX_SUBSCAN_TRANSFERS_API, {
        after_id: id,
        address: address,
        direction: "sent",
        order: "asc",
        page: 0,
        row: SUBSCAN_ROW_LIMIT
    },{
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.SUBSCAN_API_KEY
        }
    }).catch(function (error) {
        console.log(error);
        return null;
    });

    if(response != null && response.data != null && response.data.code == 0)
        return response.data.data.transfers;
    else
        return null;
}