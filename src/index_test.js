import {encodeAddress} from "@polkadot/keyring";

export async function main() {
    let myHeaders = new Headers();
    myHeaders.append("Authorization", "READ_ONLY");
    myHeaders.append("Content-Type", "application/json");

    let graphql = JSON.stringify({
        query: "query GetAllMarkets {\n    getAllMarkets {\n        items {\n            market\n            max_order_price\n            min_order_price\n            min_order_qty\n            max_order_qty\n            price_tick_size\n            qty_step_size\n            base_asset_precision\n            quote_asset_precision\n        }\n    }\n}\n",
        variables: {}
    })
    let requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: graphql,
        redirect: 'follow'
    };

    await fetch("https://ycnpo54prfe4tidfrddbaanig4.appsync-api.eu-west-1.amazonaws.com/graphql", requestOptions)
        .then(response => response.text())
        .then(result => console.log(result))
        .catch(error => console.log('error', error));

    myHeaders = new Headers();
    myHeaders.append("Authorization", "READ_ONLY");
    myHeaders.append("Content-Type", "application/json");

    graphql = JSON.stringify({
        query: "subscription ($name: String!) {\n    websocket_streams(name: $name) {\n        name\n        data\n    }\n}",
        variables: {"name":"esqZdrqhgH8zy1wqYh1aLKoRyoRWLFbX9M62eKfaTAoK67pJ5"}
    })
    requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: graphql,
        redirect: 'follow'
    };

    await fetch("wss://ycnpo54prfe4tidfrddbaanig4.appsync-realtime-api.eu-west-1.amazonaws.com/graphql", requestOptions)
        .then(response => response.text())
        .then(result => console.log(result))
        .catch(error => console.log('error', error));
}

main().catch(console.error).finally(() => process.exit());