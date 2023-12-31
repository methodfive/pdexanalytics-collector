import graphqlPrinter from "graphql/language/printer.js";

export const createAppSyncGraphQLOperationAdapter = getAppSyncAuthorizationInfo => ({
    applyMiddleware: async (options, next) => {

        // AppSync expects GraphQL operation to be defined as a JSON-encoded object in a "data" property
        options.data = JSON.stringify({
            query: typeof options.query === 'string' ? options.query : graphqlPrinter.print(options.query),
            variables: options.variables
        });

        // AppSync only permits authorized operations
        options.extensions = {'authorization': await getAppSyncAuthorizationInfo()};

        delete options.operationName;
        delete options.variables;

        console.log(options);

        next();
    }
});