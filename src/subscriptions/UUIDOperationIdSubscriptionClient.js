import {SubscriptionClient} from "subscriptions-transport-ws";
import {v4 as uuid4} from "uuid";

export class UUIDOperationIdSubscriptionClient extends SubscriptionClient {
    generateOperationId() {
        return uuid4();
    }
}