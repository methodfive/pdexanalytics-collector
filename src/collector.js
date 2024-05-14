import "@polkadot/api-augment"
import {getOrderBook, getOrderBookAssets, getOrderBookMarkets} from "./providers/graphql.js";
import {getAssetBalances, getPDEXBalance, getTotalIssuance, getTotalStaked} from "./providers/mainnet.js";
import {
    FEES_WALLET,
    FILTERED_ASSETS,
    LMP_WALLET,
    PDEX_ASSET, SUBSCAN_RATELIMIT_PAUSE, TREASURY_WALLET,
    USDT_ASSETS
} from "./constants.js";
import {
    calculateTVL,
    convertAmountToReadable,
    convertBalance,
    getAssetsFromMarket,
    isEmpty,
    isMapEmpty,
    sleep
} from "./util.js";
import {getRegisteredUsers, getTotalHolders, getTotalStakers} from "./providers/subscan.js";
import {
    closeConnectionPool
} from "./db/database.js";
import {closeStreams, closeWssClient, streamTrades} from "./providers/graphql_sub.js";
import {CronJob} from "cron";
import {hourlyJob, nightlyJob, updateCaches} from "./db/batch.js";
import {getPreviousTotalUsers, saveExchangeDaily} from "./db/exchange.js";
import {getAssetPrices, getPreviousFeeTotal, saveAsset, saveAssets} from "./db/assets.js";
import {saveMarket, saveMarkets} from "./db/markets.js";
import {saveTrade} from "./db/trades.js";
import {cleanOrderBook, getOrderBookStids, saveOrderBook, setOrderBookUpdateTS} from "./db/orderbook.js";

export class Collector {
    assets;
    markets;
    streams;

    orderbookTimer;
    subscanTimer;
    mainnetTimer;

    streamDisconnectFlag;
    streamOkToReconnect;

    inStartSubscriptions;

    constructor() {
        this.streams = new Map();
        this.streamDisconnectFlag = false;
        this.streamOkToReconnect = false;

        this.inStartSubscriptions = false;

        this.handleShutdown();
    }

    async updateSubscanData() {
        try {
            await this.updateUsers();
        }
        catch(e)
        {
            console.error("Failed updating users", e);
        }

        await sleep(SUBSCAN_RATELIMIT_PAUSE);

        try {
            await this.updateStaked();
        }
        catch(e)
        {
            console.error("Failed updating staked", e);
        }

        await sleep(SUBSCAN_RATELIMIT_PAUSE);

        try
        {
            await this.updateTreasury();
        }
        catch(e)
        {
            console.error("Failed updating trasury", e);
        }
    }

    async updateAll() {
        try
        {
            await updateCaches();
        }
        catch(e)
        {
            console.error("Failed updating caches", e);
        }

        await this.updateOrderBookData();
        await this.updateMainnetData();
        await this.updateSubscanData();
    }

    async updateOrderBookData() {
        try
        {
            await this.updateAssets();
        }
        catch(e)
        {
            console.error("Failed updating assets", e);
        }

        try
        {
            await this.updateMarkets();
        }
        catch(e)
        {
            console.error("Failed updating markets", e);
        }
    }

    async updateMainnetData() {
        try
        {
            await this.updateTVL();
        }
        catch(e)
        {
            console.error("Failed updating tvl", e);
        }

        try
        {
            await this.updateIssuance();
        }
        catch(e)
        {
            console.error("Failed updating issuance", e);
        }

        try
        {
            await this.updateFees();
        }
        catch(e)
        {
            console.error("Failed updating fees", e);
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

            //console.log(await getAssetPrices());   use old prices as default if just starting up

            let oldAssets = this.assets;
            this.assets = assets;

            if(oldAssets != null) {
                for (let key of oldAssets.keys()) {
                    if (this.assets.has(key)) {
                        this.assets.get(key).price = oldAssets.get(key).price;
                    }
                }
            }

            let oldPrices = await getAssetPrices();
            if(oldPrices !== null) {
                for (let key of this.assets.keys()) {
                    if (isEmpty(this.assets.get(key).price) && oldPrices.has(key)) {
                        this.assets.get(key).price = oldPrices.get(key);
                    }
                }
            }
            await saveAssets(this.assets);
        }
    }

    async updateMarkets() {
        console.log("updateMarkets");
        let markets = await getOrderBookMarkets(this.assets);

        if (!isEmpty(markets)) {
            this.markets = markets;
            await saveMarkets(this.markets);
        }
    }

    async updateOrderBook() {
        console.log("updateOrderbook");

        if(isEmpty(this.markets))
            return;

        for (let key of this.markets.keys()) {
            try {
                let oldResults = await getOrderBookStids(key);

                let results = await getOrderBook(key,null,1);
                if(results !== null) {
                    await saveOrderBook(key, results);

                    let resultStids = [];
                    resultStids.push(...results.map(order => order.stid));

                    let ordersToRemove = oldResults.filter(x => !resultStids.includes(x))

                    if(ordersToRemove.length > 0) {
                        await cleanOrderBook(ordersToRemove);
                    }
                }
            }
            catch(e)
            {
                console.error("failed updating orderbook", e);
            }
        }

        await setOrderBookUpdateTS();
    }

    async updateIssuance() {
        console.log("updateIssuance");

        let totalIssuance = await getTotalIssuance();

        if(isEmpty(totalIssuance))
            return;

        await saveExchangeDaily({
            total_issuance: convertAmountToReadable(totalIssuance)});
    }

    async updateTVL() {
        console.log("updateTVL");

        if(isMapEmpty(this.assets))
            return;

        await getAssetBalances(this.assets, LMP_WALLET, function(assets, asset, balance) {
            assets.get(asset).balance = balance;
        });

        for (let key of this.assets.keys()) {
            let asset = this.assets.get(key);
            this.updateAssetTVL(asset);
            this.updateFeeValue(asset);

            if(asset.tvl != null) {
                await saveAsset(asset);
            }
        }
    }

    async updateFees()
    {
        console.log("updateFees");

        if(isMapEmpty(this.assets))
            return;

        await getAssetBalances(this.assets, FEES_WALLET, function(assets, asset, balance) {
            assets.get(asset).fees = convertBalance(balance);
        });

        for (let key of this.assets.keys()) {
            if(isNaN(this.assets.get(key).fees))
                this.assets.get(key).fees = null;

            if(this.assets.get(key).fees !== null) {
                this.assets.get(key).fees = Number(this.assets.get(key).fees)

                if (this.assets.get(key).price != null)
                    this.assets.get(key).fees_value = Number(this.assets.get(key).fees) * Number(this.assets.get(key).price);
            }
        }

        let previousDaysFees = await getPreviousFeeTotal();
        if(previousDaysFees != null) {
            for (let key of this.assets.keys()) {
                if (previousDaysFees.has(key) && this.assets.get(key).fees != null) {
                    this.assets.get(key).new_fees = Number(this.assets.get(key).fees) - Number(previousDaysFees.get(key).fees);

                    if (this.assets.get(key).new_fees < 0) // this should never happen, unless funds were withdrawn from the fee wallet
                        this.assets.get(key).new_fees = Number(this.assets.get(key).new_fees);

                    if (this.assets.get(key).price != null)
                        this.assets.get(key).new_fees_value = Number(this.assets.get(key).new_fees) * Number(this.assets.get(key).price);
                }
            }
        }

        console.log(this.assets);
        await saveAssets(this.assets);
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

    async updateMarketPrice(market, price)
    {
        let marketObj = this.markets.get(market);
        let oldPrice = marketObj.price;
        marketObj.price = price;

        if(oldPrice != price) {
            await saveMarket(marketObj);
        }
    }

    async updateAssetPrice(assetID, price)
    {
        let asset = this.assets.get(assetID);
        let oldPrice = asset.price;
        asset.price = price;

        if(oldPrice != price) {
            this.updateAssetTVL(asset);
            await saveAsset(asset);
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

        await this.updateMarketPrice(market, trade.p);

        if(USDT_ASSETS.includes(pairs[1])) {
            trade.v = trade.vq;
            await this.updateAssetPrice(pairs[0], trade.p);
        }
        else
        {
            let quoteAssetPrice = this.getAssetPrice(pairs[1]);

            if(quoteAssetPrice != null) {
                trade.v = Number(trade.vq) * Number(quoteAssetPrice); // calculate volume in USD
                await this.updateAssetPrice(pairs[0], Number(trade.p) * Number(quoteAssetPrice)); // calculate price in USD
            }
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
            for (let key of this.markets.keys()) {
                if (!this.streams.has(key)) {
                    console.log("Starting observer for stream");
                    let consumer = await streamTrades(key, (trade) => {
                        this.processTrade(trade);
                    }, () => {
                        //this.streamDisconnectFlag = true;
                    }, () => {
                        //this.streamOkToReconnect = true;
                    }, () => {
                        this.streamDisconnectFlag = true;
                        this.streamOkToReconnect = true;
                    });
                    this.streams.set(key, consumer);
                }
            }

            // disable steams for removed markets
            for (let key of this.streams.keys()) {
                if (!this.markets.has(key)) {
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

        const this2 = this;
        new CronJob('*/5 * * * * *', // every 5 seconds
            async function () {
                await this2.startSubscriptions();
            },
            null,
            true,
            'Etc/UTC'
        );

        new CronJob('30 * * * * *', // every minute
            async function () {
                await this2.updateOrderBook();
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
                await this2.updateAll();
            },
            null,
            true,
            'Etc/UTC'
        );
    }

    updateFeeValue(asset) {
        if(isEmpty(asset.price) || isEmpty(asset.fees))
            return;

        asset.fees_value = Number(asset.fees) * Number(asset.price);

        if(isEmpty(asset.price) || isEmpty(asset.new_fees))
            return;

        asset.new_fees_value = Number(asset.new_fees) * Number(asset.price);
    }

    updateAssetTVL(asset) {
        if(isEmpty(asset.price) || isEmpty(asset.balance))
            return;

        asset.tvl = calculateTVL(asset.balance, asset.price);
    }

    marketExists(market) {
        if(isEmpty(market) || isEmpty(this.markets))
            return false;

        return this.markets.has(market);
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