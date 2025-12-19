module.exports = {
    apps: [{
        name: "burguer-ia-bot",
        script: "./index.js",
        watch: true,
        ignore_watch: ["node_modules", ".wwebjs*"],
        env: {
            NODE_ENV: "production",
        }
    }]
}
