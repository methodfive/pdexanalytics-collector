import { createRequire } from 'module';
import {POLKADEX_SUBSCAN_EVENTS_URL} from "../constants.js";

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