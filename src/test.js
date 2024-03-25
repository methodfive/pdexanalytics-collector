import {saveTrade} from "./db/queries.js";
import {getOrder} from "./providers/graphql.js";

export async function main() {
    const trade = {
        type: 'TradeEvent',
        m: 'PDEX-3496813586714279103986568049643838918',
        p: '0.903',
        vq: '0.903',
        q: '1',
        m_id: '0xcd309fe7ae28f020ab87c8c17cbf0cc26ac3592c79161c50f22e2aa328d601d7',
        t_id: '0x58890a01176c44ce3050013517ff6ea50ec84909e60ca3a6cbdc6ef48b478fb1',
        m_cid: '0x7765626170702d0000f023fa8a01b6efbdc7bcc8bf111120d970c46baf76396e',
        t_cid: '0x7765626170702d000017526451ee9d7cf791e675773c9fda2e3f169e924a3dfa',
        trade_id: '0xed8abbbf2b61d54f35d0131432a885c4ae91453382e9a8ecfe55652e3fcac434',
        m_side: 'Ask',
        t_side: 'Bid',
        t: 1711027668215,
        stid: 25383804
    };
    console.log(trade);

    //await saveTrade(trade);

    await getOrder(trade.m_id);
    await getOrder(trade.t_id);
}

main().catch(console.error);