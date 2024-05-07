export const RPC_ENDPOINTS = ["wss://polkadex.api.onfinality.io/public-ws","wss://polkadex.public.curie.radiumblock.co/ws"];

export const POLKADEX_GRAPHQL = "https://api.polkadex.trade/graphql";
export const POLKADEX_WSS_GRAPHQL = "wss://api.polkadex.trade/graphql/realtime?header=eyJBdXRob3JpemF0aW9uIjoiUkVBRF9PTkxZIiwiaG9zdCI6Inl4Mzc1bGRvenZjdnRoamsybmN6Y2gzZmhxLmFwcHN5bmMtYXBpLmV1LWNlbnRyYWwtMS5hbWF6b25hd3MuY29tIn0=&payload=e30=";
export const POLKADEX_WSS_HOST = "api.polkadex.trade";
export const POLKADEX_AUTH = "READ_ONLY";

export const LMP_WALLET = "esoEt6uZ3GuFV8EzKB2EAREe3KE9WuRVfmhK1RRtwffY78ArH";
export const TREASURY_WALLET = "esoEt6uZ9vs23yW8aqTACLf1tViGpSLZKnhPXt5Nq7vQwHGew";
export const FEES_WALLET = "esoEt6uZ9iFbMKnPaBjdKoZjnsnrHcSksFB6KzPsuode3BTMR";

export const FILTERED_ASSETS = ['101112','123','188197390862117588552302061289480388608','456','789']
export const USDT_ASSETS = ['3496813586714279103986568049643838918']; // assets we can derive price from
export const PDEX_ASSET = "PDEX";
export const USDT_ASSET_PRICE = 1.00;

export const UPDATE_MAINNET_FREQUENCY = 1000 * 60 * 5;
export const UPDATE_ORDERBOOK_FREQUENCY = 1000 * 60 * 5;
export const UPDATE_SUBSCAN_FREQUENCY = 1000 * 60 * 5;
export const SUBSCAN_RATELIMIT_PAUSE = 2500;
export const SUBSCAN_ROW_LIMIT = 100;

export const POLKADEX_SUBSCAN_EVENTS_URL = "https://polkadex.api.subscan.io/api/v2/scan/events";
export const POLKADEX_SUBSCAN_HOLDERS_URL = "https://polkadex.api.subscan.io/api/scan/token/holders";
export const POLKADEX_SUBSCAN_STATISTICS_URL = "https://polkadex.api.subscan.io/api/scan/accounts/statistics";
export const POLKADEX_SUBSCAN_TRANSFERS_API = "https://polkadex.api.subscan.io/api/scan/assets/transfers";

export const DB_RETRIES = 3;