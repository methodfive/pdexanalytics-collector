import {createRequire} from "module";
const require = createRequire(import.meta.url);

export const createAppSyncAuthorizedWebSocket = (getAppSyncAuthorizationInfo) => {
    const WebSocket = require('ws');
    return class extends WebSocket {
        set onmessage(handler) {
            super.onmessage = event => {
                if (event.data) {
                    const data = this._tryParseJsonString(event.data);
                    console.log("WSS Message:", data);
                    if (data && data.type === 'start_ack') {
                        return;
                    }
                }

                if(handler != null)
                    return handler(event);
                else
                    return;
            };
        }

        _tryParseJsonString(jsonString) {
            try {
                return JSON.parse(jsonString);
            } catch (e) {
                return undefined;
            }
        }
    };
};