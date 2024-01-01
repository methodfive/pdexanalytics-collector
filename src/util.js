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

export function convertAmountToReadable(amount)
{
    if(isEmpty(amount))
        return;

    return (Number(amount) * Math.pow(10,-12)).toFixed(2);
}

export function calculateTVL(amount, price)
{
    if(isEmpty(amount) || isEmpty(price))
        return;

    return (Number(amount) * Math.pow(10,-12) * Number(price)).toFixed(2);
}