export function isMapEmpty(e) {
    return e == null || e.size == 0
}

export function isEmpty(e) {
    return e == null || e.length === 0;
}

export function getAssetsFromMarket(market) {
    if(isEmpty(market))
        return null;

    return market.split("-");
}