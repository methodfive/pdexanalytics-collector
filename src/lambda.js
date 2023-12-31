import {app} from "./app.js";

export const handler = async(event) => {
    await app();

    const response = {
        statusCode: 200,
        body: JSON.stringify('OK'),
    };
    return response;
};
