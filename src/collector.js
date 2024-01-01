import "@polkadot/api-augment"
import {getOrderBookAssets, getOrderBookMarkets} from "./datasource/graphql.js";
import {closeRpcProvider, getAssetBalances, getTotalStaked} from "./datasource/mainnet.js";
import {
    FILTERED_ASSETS,
    LMP_WALLET, PDEX_ASSET, TIME_BETWEEN_TIMERS,
    UPDATE_ASSETS_FREQUENCY,
    UPDATE_MARKETS_FREQUENCY, UPDATE_STREAMS_FREQUENCY,
    UPDATE_TVL_FREQUENCY, UPDATE_USERS_FREQUENCY,
    USDT_ASSETS
} from "./constants.js";
import {calculateTVL, convertAmountToReadable, getAssetsFromMarket, isEmpty, isMapEmpty} from "./util.js";
import {getRegisteredUsers} from "./datasource/subscan.js";
import {saveTrade, saveAsset, saveAssets, saveMarket, saveExchangeDaily, nightlyJob} from "./database.js";
import {closeStreams, closeWssClient, streamTrades} from "./datasource/graphql_sub.js";
import {CronJob} from "cron";

export class Collector {
    assets;
    markets;
    streams;
    dailyStats;

    assetTimer;
    marketTimer;
    userTimer;
    subscriptionTimer;
    tvlTimer;

    streamDisconnectFlag;
    streamOkToReconnect;
    inUpdateTVL;
    inStartSubscriptions;

    constructor() {
        this.streams = new Map();
        this.streamDisconnectFlag = false;
        this.streamOkToReconnect = false;
        this.inUpdateTVL = false;
        this.inStartSubscriptions = false;
        this.handleShutdown();
    }

    async updateUsers() {
        console.log("updateUsers");
        let totalUsers = await getRegisteredUsers();

        if(totalUsers != null) {
            await saveExchangeDaily({users:totalUsers});
        }
    }

    async updateAssets() {
        console.log("updateAssets");
        let assets = await getOrderBookAssets();

        if(!isMapEmpty(assets)) {
            this.assets = assets;
            await saveAssets(this.assets);
        }
    }

    async updateMarkets() {
        console.log("updateMarkets");
        let markets = await getOrderBookMarkets();

        if(!isEmpty(markets)) {
            this.markets = markets;
            for(let i = 0; i < this.markets.length; i++)
            {
                if(this.marketAssetsExists(this.markets[i])) {
                    await saveMarket(this.markets[i]);
                }
            }
        }
    }

    async updateTVL() {
        console.log("updateTVL");

        if(isMapEmpty(this.assets))
            return;

        if(this.inUpdateTVL)
            return;

        this.inUpdateTVL = true;
        try {
            await getAssetBalances(this.assets, LMP_WALLET);

            let totalTVL = 0;
            for (let key of this.assets.keys()) {
                let asset = this.assets.get(key);
                this.updateAssetTVL(asset);

                if(asset.tvl != null) {
                    await saveAsset(asset);
                    totalTVL += Number(asset.tvl);
                }
            }
            console.log("TOTAL TVL:", totalTVL);
            await saveExchangeDaily({tvl:totalTVL});
        }
        finally
        {
            this.inUpdateTVL = false;
        }
    }

    async updateStaked()
    {
        if(this.inUpdateStaked)
            return;

        this.inUpdateStaked = true;

        try {
            let totalStaked = await getTotalStaked();
            let pdexPrice = this.getAssetPrice(PDEX_ASSET);

            if(isEmpty(pdexPrice))
                return;

            let stakedTvl = calculateTVL(totalStaked, pdexPrice);

            await saveExchangeDaily({total_staked: convertAmountToReadable(totalStaked), staked_tvl: stakedTvl});
        }
        finally
        {
            this.inUpdateStaked = false;
        }
    }

    async processTrade(trade) {
        if(isMapEmpty(this.assets))
            return;

        let market = trade.m;

        if(!this.marketExists(market))
            return;

        let pairs = getAssetsFromMarket(market);

        if(FILTERED_ASSETS.includes(pairs[0]) ||  FILTERED_ASSETS.includes(pairs[1])) {
            return;
        }

        if(USDT_ASSETS.includes(pairs[1])) {
            let asset = this.assets.get(pairs[0]);
            let oldPrice = asset.price;
            asset.price = trade.p;
            this.updateAssetTVL(asset);

            if(oldPrice != trade.p)
                await saveAsset(asset);
        }

        await saveTrade(trade);
    }

    async startSubscriptions() {
        console.log("startSubscriptions");

        if(isEmpty(this.markets))
            return;

        if(this.inStartSubscriptions)
            return;

        this.inStartSubscriptions = true

        if (this.streamOkToReconnect) {
            /*
            SubscriptionClient supports auto-reconnect if internet is lost, but we need to also support
            if polkadex team redeploys the graphql services which would cause the subscription to be cancelled. to handle this we
            will always recreate subscriptions on WSS reconnect
            */
            console.log("Cancelling subscriptions after reconnect");
            this.streamOkToReconnect = false;
            this.streamDisconnectFlag = false;

            await closeStreams(this.streams);
            this.streams.clear();

            await new Promise(r => setTimeout(r, 1000 * 60));
            this.streamDisconnectFlag = false;
            console.log("Done cancelling subscriptions");
        }

        if(this.streamDisconnectFlag) {
            this.inStartSubscriptions = false;
            return;
        }

        try {
            //initiate new streams as needed
            for (let i = 0; i < this.markets.length; i++) {
                let m = this.markets[i];

                if (!this.streams.has(m)) {
                    console.log("Starting observer for stream");
                    let consumer = await streamTrades(m, (trade) => {
                        this.processTrade(trade);
                    }, () => {
                        this.streamDisconnectFlag = true;
                    }, () => {
                        this.streamOkToReconnect = true;
                    });
                    this.streams.set(m, consumer);
                }
            }

            // disable steams for removed markets
            for (let key of this.streams.keys()) {
                if (!this.markets.includes(key)) {
                    try {
                        console.log("Closing stream:", key);
                        await this.streams.get(key).unsubscribe();
                    } catch (e) {
                    }
                    this.streams.delete(key);
                }
            }
        }
        finally
        {
            this.inStartSubscriptions = false;
        }
    }

    handleShutdown() {
        const shutdown = () => {
            clearInterval(this.assetTimer);
            clearInterval(this.marketTimer);
            clearInterval(this.userTimer);
            clearInterval(this.subscriptionTimer);
            clearInterval(this.tvlTimer);

            for (let key of this.streams.keys()) {
                try {
                    console.log("Closing stream:", key);
                    this.streams.get(key).unsubscribe();
                } catch(e) {}
            }
            closeWssClient();
            closeRpcProvider();
        };

        process.on('SIGTERM', () => {
            shutdown();
        });
        process.on('SIGINT', () => {
            shutdown();
            process.exit(0);
        });
    }

    async startTimers() {
        console.log("startTimers");
        this.assetTimer = setInterval(() => {
            this.updateAssets()
        }, UPDATE_ASSETS_FREQUENCY);

        setTimeout(() => {
            this.marketTimer = setInterval(() => {
                this.updateMarkets()
            }, UPDATE_MARKETS_FREQUENCY);
        }, TIME_BETWEEN_TIMERS);

        setTimeout(() => {
            this.userTimer = setInterval(() => {
                this.updateUsers()
            }, UPDATE_USERS_FREQUENCY);
        }, TIME_BETWEEN_TIMERS * 2);

        setTimeout(() => {
            this.subscriptionTimer = setInterval(() => {
                this.startSubscriptions()
            }, UPDATE_STREAMS_FREQUENCY);
        }, TIME_BETWEEN_TIMERS * 3);

        setTimeout(() => {
            this.tvlTimer = setInterval(() => {
                this.updateTVL();
            }, UPDATE_TVL_FREQUENCY);
        }, TIME_BETWEEN_TIMERS * 4);

        new CronJob('0 5 0 * * *',
            async function () {
                await nightlyJob();
                await this.updateStaked();
            },
            null,
            true,
            'Etc/UTC'
        );
    }

    updateAssetTVL(asset) {
        if(isEmpty(asset.price) || isEmpty(asset.balance))
            return;

        asset.tvl = calculateTVL(asset.balance, asset.price);
    }

    marketExists(market) {
        if(isEmpty(market) || isEmpty(this.markets))
            return false;

        return this.markets.includes(market);
    }

    getAssetPrice(asset)
    {
        if(isEmpty(this.assets))
            return null;

        if(this.assets.has(asset))
        {
            return this.assets.get(asset).price;
        }
        return null;
    }

    marketAssetsExists(market) {
        if(isEmpty(market) || isMapEmpty(this.assets))
            return false;

        const pairs = getAssetsFromMarket(market);
        if(this.assets.has(pairs[0]) && this.assets.has(pairs[1]))
            return true

        return false;
    }

}