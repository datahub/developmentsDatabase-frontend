var ExtractTextPlugin = require("extract-text-webpack-plugin");
var webpack = require('webpack');
module.exports = {
    entry: "./js/app.js",
    output: {
        filename: "./js/bundle.js"
    },
    //devtool: "source-map",
    module: {
        loaders: [{
                test: /\.scss$/,
                loader: ExtractTextPlugin.extract(["css?sourceMap", "sass?sourceMap"])
            }]
    },
    plugins: [
        new ExtractTextPlugin("./css/styles.css")
        ,new webpack.DefinePlugin({
            'process.env': {
              'NODE_ENV': JSON.stringify('production')
            }
        })
    ],
    watch: true
}
