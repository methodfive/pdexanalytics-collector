import {
    POLKADEX_AUTH,
    POLKADEX_WSS_GRAPHQL, POLKADEX_WSS_HOST
} from "../constants.js";
import gql from "graphql-tag";
import {isEmpty} from "../util.js";
import {execute} from "apollo-link";
import {UUIDOperationIdSubscriptionClient} from "../subscriptions/UUIDOperationIdSubscriptionClient.js";
import {createAppSyncAuthorizedWebSocket} from "../subscriptions/createAppSyncAuthorizedWebSocket.js";
import {createAppSyncGraphQLOperationAdapter} from "../subscriptions/createAppSyncGraphQLOperationAdapter.js";
import {WebSocketLink} from "apollo-link-ws";

let wsClient = null;

export async function streamTrades(market, callback, onDisconnect, onReconnect, onHandlerLoss) {
    if(isEmpty(market))
        return;

    console.log("Starting stream:", market);

    const subscriptionClient = createSubscriptionObservable(
        POLKADEX_WSS_GRAPHQL,
        gql`subscription WebsocketStreamsMessage($name: String!) {
              websocket_streams(name: $name) {
                data
              }
             }`,
        {"name": market+"-recent-trades"},
        onDisconnect, onReconnect, onHandlerLoss
    );

    let consumer = subscriptionClient.subscribe(eventData => {
        if (eventData != null && eventData.data != null && eventData.data.websocket_streams != null && eventData.data.websocket_streams.data != null) {
            let dataObj = eventData.data.websocket_streams.data;
            callback(JSON.parse(dataObj));
        }
        else
        {
            console.error("Unable to parse trade:", eventData);
        }
    }, (err) => {
        console.error(err);
    },() => {

    });
    return consumer;
}

export const getWsClient = function(wsurl, onDisconnect, onReconnect, onHandlerLoss) {
    if(wsClient != null)
        return wsClient;

    if(wsurl === null)
        return;

    const getAppSyncAuthorizationInfo = async () => ({host: POLKADEX_WSS_HOST, Authorization: POLKADEX_AUTH});

    wsClient = new UUIDOperationIdSubscriptionClient(wsurl, {
        reconnect: true,
        timeout: 5 * 60 * 1000,
        lazy: false
    }, createAppSyncAuthorizedWebSocket(getAppSyncAuthorizationInfo, onHandlerLoss), ['graphql-ws']);

    wsClient.use([createAppSyncGraphQLOperationAdapter(getAppSyncAuthorizationInfo)])
    wsClient.onConnected(data => {console.log('WSS connected', data)});
    wsClient.onError(data  => console.error('WSS error', data.message));
    wsClient.onDisconnected(data => { console.error('WSS disconnected'); onDisconnect();});
    wsClient.onReconnected(data => { console.log('WSS reconnected'); onReconnect();});

    return wsClient;
};

export const createSubscriptionObservable = (wsurl, query, variables, onDisconnect, onReconnect, onHandlerLoss) => {
    const extensions = {
        "authorization": {
            "Authorization": POLKADEX_AUTH,
            "host": POLKADEX_WSS_HOST
        }
    }
    const link = new WebSocketLink(getWsClient(wsurl, onDisconnect, onReconnect, onHandlerLoss));
    return execute(link, {query: query, variables: variables, extensions: extensions});
};

export async function closeStreams(streams) {
    try {
        console.log("Closing steams");
        let client = getWsClient();
        for (let key of streams.keys()) {
            try {
                streams.get(key).unsubscribe();
            } catch (e) {
            }
        }
        await client.unsubscribeAll();
        await client.close();
    } catch (e) {
        console.log("error", e);
    }
}

export function closeWssClient()
{
    if(wsClient != null)
    {
        console.log("Closing wss client");
        try {
            wsClient.close();
        } catch(e) {}
    }
}