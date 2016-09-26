module.exports = {
    entry: "./ozenfant.js",
    output: {
        path: __dirname + '/dist',
        filename: "ozenfant.js"
    },
    module: {
        loaders: [
            { test: /\.css$/, loader: "style!css" }
        ]
    }
};