import {app} from "./app.js";

export async function main() {
    await app();
}

main().catch(console.error);