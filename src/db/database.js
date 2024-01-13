import * as mysql2 from "mysql2";

let connectionPool = null;

function createConnectionPool()
{
    connectionPool = mysql2.createPool({
        host: process.env.MYSQL_DB_HOST,
        user: process.env.MYSQL_DB_USER,
        database: process.env.MYSQL_DB,
        password: process.env.MYSQL_DB_PASSWORD,
        ssl: { rejectUnauthorized: false},
        waitForConnections: true,
        connectionLimit: 10,
        maxIdle: 10,
        idleTimeout: 60000,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
        timezone: 'Z',
    });
}

export function getConnection()
{
    if (connectionPool == null)
        createConnectionPool();

    return connectionPool;
}

export function closeConnectionPool()
{
    try {
        if(connectionPool != null) {
            connectionPool.end(function (err) {
                console.log("RDS connections closed.");
            });
        }
    }
    catch(e) {}
}

export async function queryAsyncWithRetries(connectionPool, sql, params, then, retries_left = 1) {
    return connectionPool.promise().query(sql, params)
        .then(then)
        .catch((err) => {
                if (retries_left >= 1 && err.code === 'ECONNRESET') {
                    console.error({msg: 'Retrying query', retries_left, err})
                    return queryAsyncWithRetries(connectionPool, sql, params, then,retries_left - 1)
                } else {
                    throw err
                }
            }
        );
}