export const RPC_ENDPOINTS = ["wss://polkadex.api.onfinality.io/public-ws","wss://polkadex.public.curie.radiumblock.co/ws"];

export const POLKADEX_GRAPHQL = "https://yx375ldozvcvthjk2nczch3fhq.appsync-api.eu-central-1.amazonaws.com/graphql";
export const POLKADEX_WSS_GRAPHQL = "wss://yx375ldozvcvthjk2nczch3fhq.appsync-realtime-api.eu-central-1.amazonaws.com/graphql?header=eyJBdXRob3JpemF0aW9uIjoiUkVBRF9PTkxZIiwiaG9zdCI6Inl4Mzc1bGRvenZjdnRoamsybmN6Y2gzZmhxLmFwcHN5bmMtYXBpLmV1LWNlbnRyYWwtMS5hbWF6b25hd3MuY29tIn0=&payload=e30=";
export const POLKADEX_WSS_HOST = "yx375ldozvcvthjk2nczch3fhq.appsync-api.eu-central-1.amazonaws.com";
export const POLKADEX_AUTH = "READ_ONLY";

export const LMP_WALLET = "esoEt6uZ3GuFV8EzKB2EAREe3KE9WuRVfmhK1RRtwffY78ArH";

export const FILTERED_ASSETS = ['101112','123','188197390862117588552302061289480388608','456','789']
export const USDT_ASSETS = ['3496813586714279103986568049643838918']; // assets we can derive price from
export const PDEX_ASSET = "PDEX";
export const USDT_ASSET_PRICE = 1.00;

export const UPDATE_MAINNET_FREQUENCY = 1000 * 60 * 30;
export const UPDATE_ORDERBOOK_FREQUENCY = 1000 * 60 * 30;
export const UPDATE_SUBSCAN_FREQUENCY = 1000 * 60 * 30;
export const UPDATE_STREAMS_FREQUENCY = 1000 * 60 * 1;
export const SUBSCAN_RATELIMIT_PAUSE = 2500;

export const POLKADEX_SUBSCAN_EVENTS_URL = "https://polkadex.api.subscan.io/api/v2/scan/events";
export const POLKADEX_SUBSCAN_HOLDERS_URL = "https://polkadex.api.subscan.io/api/scan/token/holders";
export const POLKADEX_SUBSCAN_STATISTICS_URL = "https://polkadex.api.subscan.io/api/scan/accounts/statistics";

export const DB_RETRIES = 3;