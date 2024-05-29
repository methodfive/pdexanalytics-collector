export function isMapEmpty(e) {
    return e == null || e.size == 0
}

export function isEmpty(e) {
    return e == null || e.length === 0;
}

export function getDateFromUtc(t) {
    if(isEmpty(t))
        return;

    return new Date(Number(t));
}

export function getAssetsFromMarket(market) {
    if(isEmpty(market))
        return null;

    return market.split("-");
}

export function orderBookIncludes(newResults, oldResult) {
    for(let i = 0; i < newResults.length; i++)
    {
        if(newResults[i][0].localeCompare(oldResult[0]) === 0 &&
            newResults[i][1].localeCompare(oldResult[1]) === 0 &&
            Number(newResults[i][2]) === Number((oldResult[2])) &&
            newResults[i][3].localeCompare(oldResult[3]) === 0)
        {
            return true;
        }
    }
    return false;
}

export function convertBalance(amount)
{
    if(isEmpty(amount))
        return;

    return trimDecimals((Number(amount) * Math.pow(10,-12)), 6);
}

export function convertAmountToReadable(amount)
{
    if(isEmpty(amount))
        return;

    return trimDecimals((Number(amount) * Math.pow(10,-12)), 2);
}

export function trimDecimals(number, decimalPlaces)
{
    if(isEmpty(number) || isEmpty(decimalPlaces))
        return;

    let options = {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
        roundingMode: 'floor',
        useGrouping: false
    };

    const formatter = Intl.NumberFormat("en-US", options);
    return formatter.format(number);
}

export function calculateTVL(amount, price)
{
    if(isEmpty(amount) || isEmpty(price))
        return;

    return (Number(amount) * Math.pow(10,-12) * Number(price)).toFixed(2);
}

export function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

export function getFlooredFixed(v, d) {
    return (Math.floor(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d);
}

export const asyncCallWithTimeout = async (asyncPromise, timeLimit) => {
    let timeoutHandle;

    const timeoutPromise = new Promise((_resolve, reject) => {
        timeoutHandle = setTimeout(
            () => reject(new Error('Async call timeout limit reached')),
            timeLimit
        );
    });

    return Promise.race([asyncPromise, timeoutPromise]).then(result => {
        clearTimeout(timeoutHandle);
        return result;
    })
}