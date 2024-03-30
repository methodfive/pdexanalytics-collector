import "@polkadot/api-augment"
import {getOrderBookAssets, getOrderBookMarkets} from "./providers/graphql.js";
import {getAssetBalances, getPDEXBalance, getTotalIssuance, getTotalStaked} from "./providers/mainnet.js";
import {
    FILTERED_ASSETS,
    LMP_WALLET,
    PDEX_ASSET, SUBSCAN_RATELIMIT_PAUSE, TREASURY_WALLET, UPDATE_MAINNET_FREQUENCY,
    UPDATE_ORDERBOOK_FREQUENCY,
    UPDATE_STREAMS_FREQUENCY,
    UPDATE_SUBSCAN_FREQUENCY,
    USDT_ASSETS
} from "./constants.js";
import {calculateTVL, convertAmountToReadable, getAssetsFromMarket, isEmpty, isMapEmpty, sleep} from "./util.js";
import {getRegisteredUsers, getTotalHolders, getTotalStakers} from "./providers/subscan.js";
import {
    closeConnectionPool
} from "./db/database.js";
import {closeStreams, closeWssClient, streamTrades} from "./providers/graphql_sub.js";
import {CronJob} from "cron";
import {hourlyJob, nightlyJob, updateCaches} from "./db/batch.js";
import {getPreviousTotalUsers, saveExchangeDaily} from "./db/exchange.js";
import {saveAsset, saveAssets} from "./db/assets.js";
import {saveMarket} from "./db/markets.js";
import {saveTrade} from "./db/trades.js";

export class Collector {
    assets;
    markets;
    streams;

    orderbookTimer;
    subscanTimer;
    mainnetTimer;

    streamDisconnectFlag;
    streamOkToReconnect;

    inUpdateSubscan;
    inUpdateOrderBook;
    inUpdateMainnet;
    inStartSubscriptions;

    constructor() {
        this.streams = new Map();
        this.streamDisconnectFlag = false;
        this.streamOkToReconnect = false;

        this.inUpdateSubscan = false;
        this.inUpdateOrderBook = false;
        this.inUpdateMainnet = false;
        this.inStartSubscriptions = false;

        this.handleShutdown();
    }

    async updateSubscanData() {
        if(this.inUpdateSubscan)
            return;

        this.inUpdateSubscan = true;

        try {
            await this.updateUsers();

            await sleep(SUBSCAN_RATELIMIT_PAUSE);

            await this.updateStaked();

            await sleep(SUBSCAN_RATELIMIT_PAUSE);

            await this.updateTreasury();
        }
        finally
        {
            this.inUpdateSubscan = false;
        }
    }

    async updateOrderBookData() {
        if(this.inUpdateOrderBook)
            return;

        this.inUpdateOrderBook = true;

        try {
            await this.updateAssets();
            await this.updateMarkets();
        }
        finally
        {
            this.inUpdateOrderBook = false;
        }
    }

    async updateMainnetData() {
        if(this.inUpdateMainnet)
            return;

        this.inUpdateMainnet = true;

        try {
            await this.updateTVL();
            await this.updateIssuance();
        }
        finally
        {
            this.inUpdateMainnet = false;
        }
    }

    async updateUsers() {
        console.log("updateUsers");
        let totalUsers = await getRegisteredUsers();

        if(totalUsers != null) {
            let previousUsers = await getPreviousTotalUsers();
            let usersChange = null;
            if(previousUsers != null)
            {
                usersChange = totalUsers - previousUsers;
            }

            await saveExchangeDaily({
                users: totalUsers,
                new_users: usersChange
            });
        }
    }

    async updateAssets() {
        console.log("updateAssets");
        let assets = await getOrderBookAssets();

        if(!isMapEmpty(assets)) {
            let oldAssets = this.assets;
            this.assets = assets;

            if(oldAssets != null) {
                for (let key of oldAssets.keys()) {
                    if (this.assets.has(key)) {
                        this.assets.get(key).price = oldAssets.get(key).price;
                    }
                }
            }

            await saveAssets(this.assets);
        }
    }

    async updateMarkets() {
        console.log("updateMarkets");
        let markets = await getOrderBookMarkets();

        if (!isEmpty(markets)) {
            this.markets = markets;
            for (let i = 0; i < this.markets.length; i++) {
                if (this.marketAssetsExists(this.markets[i])) {
                    await saveMarket(this.markets[i]);
                }
            }
        }
    }

    async updateIssuance() {
        console.log("updateIssuance");

        let totalIssuance = await getTotalIssuance();

        await saveExchangeDaily({
            total_issuance: convertAmountToReadable(totalIssuance)});
    }

    async updateTVL() {
        console.log("updateTVL");

        if(isMapEmpty(this.assets))
            return;

        await getAssetBalances(this.assets, LMP_WALLET);

        for (let key of this.assets.keys()) {
            let asset = this.assets.get(key);
            this.updateAssetTVL(asset);

            if(asset.tvl != null) {
                await saveAsset(asset);
            }
        }
    }

    async updateStaked()
    {
        console.log("updateStaked");

        let totalStaked = await getTotalStaked();
        let pdexPrice = this.getAssetPrice(PDEX_ASSET);

        if(isEmpty(pdexPrice))
            return;

        let stakedTvl = calculateTVL(totalStaked, pdexPrice);

        let totalHolders = await getTotalHolders();

        await sleep(SUBSCAN_RATELIMIT_PAUSE);

        let totalStakers = await getTotalStakers();

        await saveExchangeDaily({
            total_staked: convertAmountToReadable(totalStaked),
            staked_tvl: stakedTvl,
            total_holders: totalHolders,
            total_stakers: totalStakers});
    }

    async updateTreasury()
    {
        console.log("updateTreasury");

        let pdexPrice = this.getAssetPrice(PDEX_ASSET);

        if(isEmpty(pdexPrice))
            return;

        let treasuryBalance = await getPDEXBalance(TREASURY_WALLET);

        if(treasuryBalance == null)
            return;

        let treasuryValue = calculateTVL(treasuryBalance, pdexPrice);

        await saveExchangeDaily({
            treasury_balance: convertAmountToReadable(treasuryBalance),
            treasury_tvl: treasuryValue});
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

            await sleep( 5 * 1000);

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
            clearInterval(this.orderbookTimer);
            clearInterval(this.subscanTimer);
            clearInterval(this.mainnetTimer);

            for (let key of this.streams.keys()) {
                try {
                    console.log("Closing stream:", key);
                    this.streams.get(key).unsubscribe();
                } catch(e) {}
            }
            closeWssClient();
            closeConnectionPool();
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
        this.orderbookTimer = setInterval(() => {
            this.updateOrderBookData()
        }, UPDATE_ORDERBOOK_FREQUENCY);

        setTimeout(() => {
            this.subscanTimer = setInterval(() => {
                this.updateSubscanData()
            }, UPDATE_SUBSCAN_FREQUENCY);
        }, 1000 * 60 * 5);


        setTimeout(() => {
            this.mainnetTimer = setInterval(() => {
                this.updateMainnetData();
            }, UPDATE_MAINNET_FREQUENCY);
        }, 1000 * 60 * 15);

        const this2 = this;
        new CronJob('*/5 * * * * *',
            async function () {
                await this2.startSubscriptions();
            },
            null,
            true,
            'Etc/UTC'
        );

        new CronJob('0 5 0 * * *',
            async function () {
                await nightlyJob();
            },
            null,
            true,
            'Etc/UTC'
        );

        new CronJob('0 8 * * * *',
            async function () {
                await hourlyJob();
            },
            null,
            true,
            'Etc/UTC'
        );

        new CronJob('0 */5 * * * *',
            async function () {
                await updateCaches();
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