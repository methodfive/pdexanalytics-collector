import {
    FILTERED_ASSETS, POLKADEX_AUTH,
    POLKADEX_GRAPHQL, USDT_ASSET_PRICE, USDT_ASSETS
} from "../constants.js";

import { createRequire } from 'module';
import {getAssetsFromMarket} from "../util.js";
const require = createRequire(import.meta.url);
const axios = require('axios');

export async function getOrderBookAssets() {
    let response = await axios.post(POLKADEX_GRAPHQL, {
        query: `query GetAllAssets($limit: Int, $nextToken: String) {
                  getAllAssets(limit: $limit, nextToken: $nextToken) {
                    items {
                      symbol
                      name
                      asset_id
                    }
                  nextToken
                  }
                }`
    },{
        headers: {
            'Authorization': POLKADEX_AUTH,
            'Content-Type': 'application/json'
    }}).catch(function(e) {
        console.log("Error querying assets", e.message);
    });

    if(response == null || response.data == null)
        return null;

    let assets = response.data.data.getAllAssets.items;

    assets = assets.filter((asset) => {
        return !FILTERED_ASSETS.includes(asset.asset_id);
    });

    let assetMap = new Map();
    for(let i = 0; i < assets.length; i++) {
        if(USDT_ASSETS.includes(assets[i].asset_id))
        {
            assets[i].price = USDT_ASSET_PRICE;
        }
        assetMap.set(assets[i].asset_id, assets[i]);
    }
    return assetMap;
}

export async function getOrderBookMarkets(assets) {
    let response = await axios.post(POLKADEX_GRAPHQL, {
        query: `query GetAllMarkets {
                  getAllMarkets {
                    items {
                      market
                    }
                  }
                }`
    },{
        headers: {
            'Authorization': POLKADEX_AUTH,
            'Content-Type': 'application/json'
        }}
    ).catch(function(e) {
        console.log("Error querying markets", e.message);
    });

    if(response == null || response.data == null)
        return null;

    let markets = response.data.data.getAllMarkets.items;

    let marketMap = new Map();
    for(let i = 0; i < markets.length; i++) {
        let obj = markets[i].market;
        let pairs = getAssetsFromMarket(obj);

        if(FILTERED_ASSETS.includes(pairs[0]) || FILTERED_ASSETS.includes(pairs[1])) {
            continue;
        }

        if(!assets.has(pairs[0]) || !assets.has(pairs[1]))
        {
            continue;
        }

        marketMap.set(obj, markets[i]);
    }
    return marketMap;
}

export async function getOrder(orderID) {
    console.log("Querying order ID:", orderID);
    let response = await axios.post(POLKADEX_GRAPHQL, {
            query: `query findOrderById($order_id: String!) {
                  findOrderById(order_id: $order_id) {
                    u
                    cid
                    id
                    t
                    m
                    s
                    ot
                    st
                    p
                    q
                    qoq
                    afp
                    fq
                    fee
                    stid
                    isReverted
                  }
                }`,
        variables: {
            'order_id': orderID
        },
        },{
            headers: {
                'Authorization': POLKADEX_AUTH,
                'Content-Type': 'application/json'
            }}
    ).catch(function(e) {
        console.log("Error querying order", e.message);
    });

    if(response == null || response.data == null)
        return null;

   console.log(response.data);
   return response.data;
}