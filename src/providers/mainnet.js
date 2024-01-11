import {ApiPromise, WsProvider} from "@polkadot/api";
import {RPC_ENDPOINTS} from "../constants.js";
import {isEmpty, isMapEmpty} from "../util.js";

let _wsProvider = null;

function getWsProvider()
{
    if(_wsProvider == null)
    {
        _wsProvider = new WsProvider(RPC_ENDPOINTS);
    }
    return _wsProvider;
}

export function closeRpcProvider() {
    if (_wsProvider != null) {
        try {
            console.log("disconnecting from rpc");
            _wsProvider.disconnect();
        } catch (e) {
        }
    }
}

export async function getAssetBalances(assets, wallet) {
    if(isMapEmpty(assets) || isEmpty(wallet))
        return;

    const wsProvider = getWsProvider();
    const api = await ApiPromise.create({provider: wsProvider});

    let requestedAssets = [];
    for (let key of assets.keys()) {
        if(key != "PDEX")
            requestedAssets.push([key, wallet]);
    }

    const results = await api.query.assets.account.multi(requestedAssets);

    for(let i = 0; i < results.length; i++)
    {
        assets.get(requestedAssets[i][0]).balance = Number(results[i].toPrimitive().balance);
    }
    assets.get("PDEX").balance = await getPDEXBalance(wallet);
    return assets;
}

export async function getPDEXBalance(wallet) {
    if(isEmpty(wallet))
        return;

    const wsProvider = getWsProvider();
    const api = await ApiPromise.create({provider: wsProvider});

    let results = await api.derive.balances.all(wallet);
    return Number(results.availableBalance.toPrimitive());
}

async function getCurrentEra() {
    const wsProvider = getWsProvider();
    const api = await ApiPromise.create({provider: wsProvider});

    const chainActiveEra = await api.query.staking.activeEra();
    return JSON.parse(JSON.stringify(chainActiveEra)).index;
}

export async function getTotalStaked() {
    const wsProvider = getWsProvider();
    const api = await ApiPromise.create({provider: wsProvider});

    let activeEra = await getCurrentEra();

    let results = await api.query.staking.erasTotalStake([activeEra]);
    return results.toPrimitive();
}