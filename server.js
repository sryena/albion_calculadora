import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import cors from "cors";

const app = express();

const PORT = process.env.PORT || 10000;

// =======================================
// CORS
// =======================================

app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"]
}));

app.use((req, res, next) => {

    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

    next();

});

// =======================================
// CACHE
// =======================================

const CACHE_FILE = "./cache.json";

function loadCache() {

    try {

        if (!fs.existsSync(CACHE_FILE)) {
            return {};
        }

        return JSON.parse(
            fs.readFileSync(CACHE_FILE, "utf-8")
        );

    } catch (e) {

        console.error("Cache load error:", e);
        return {};

    }

}

function saveCache(data) {

    try {

        fs.writeFileSync(
            CACHE_FILE,
            JSON.stringify(data, null, 2)
        );

    } catch (e) {

        console.error("Cache save error:", e);

    }

}

let cache = loadCache();

// =======================================
// API
// =======================================

// IMPORTANTE:
// usar www y NO europe
// porque devuelve más resultados

const API_BASE =
    "https://www.albion-online-data.com/api/v2/stats";

// =======================================
// HELPERS
// =======================================

function sanitizePrice(value) {

    if (!value) return 0;

    if (isNaN(value)) return 0;

    return Number(value);

}

function getFallbackPrice(itemId, city, type) {

    if (!cache[itemId]) return 0;

    if (!cache[itemId][city]) return 0;

    return cache[itemId][city][type] || 0;

}

// =======================================
// ROOT
// =======================================

app.get("/", (req, res) => {

    res.json({
        status: "online",
        service: "Albion Calculator Backend",
        cacheItems: Object.keys(cache).length
    });

});

// =======================================
// PRECIOS
// =======================================

app.get("/prices/:itemId", async (req, res) => {

    try {

        const itemId =
            req.params.itemId;

        const locations =
            req.query.locations || "";

        const qualities =
            req.query.qualities || "1";

        const url =
            `${API_BASE}/prices/${itemId}.json?locations=${locations}&qualities=${qualities}`;

        console.log("Fetching:", url);

        const response =
            await fetch(url);

        if (!response.ok) {

            console.error(
                "Albion API HTTP Error:",
                response.status
            );

            return res.json(
                cache[itemId] || {}
            );

        }

        const text =
            await response.text();

        let data = [];

        try {

            data = JSON.parse(text);

        } catch (e) {

            console.error(
                "JSON parse error:"
            );

            console.log(text);

            return res.json(
                cache[itemId] || {}
            );

        }

        let result = {};

        if (Array.isArray(data)) {

            data.forEach(item => {

                if (!item.city) return;

                const city =
                    item.city;

                const buyCost =
                    sanitizePrice(
                        item.sell_price_min
                    );

                const sellRevenue =
                    sanitizePrice(
                        item.buy_price_max
                    );

                if (!cache[itemId]) {
                    cache[itemId] = {};
                }

                // guardar en cache
                if (
                    buyCost > 0 ||
                    sellRevenue > 0
                ) {

                    cache[itemId][city] = {

                        buyCost,
                        sellRevenue,

                        updatedAt:
                            Date.now()

                    };

                }

                result[city] = {

                    buyCost:
                        buyCost ||
                        getFallbackPrice(
                            itemId,
                            city,
                            "buyCost"
                        ),

                    sellRevenue:
                        sellRevenue ||
                        getFallbackPrice(
                            itemId,
                            city,
                            "sellRevenue"
                        )

                };

            });

        }

        saveCache(cache);

        res.json(result);

    } catch (e) {

        console.error(
            "Prices endpoint error:",
            e
        );

        res.json({});

    }

});

// =======================================
// HISTORY
// =======================================

app.get("/history/:itemId", async (req, res) => {

    try {

        const itemId =
            req.params.itemId;

        const timeScale =
            req.query.timescale || 24;

        const locations =
            req.query.locations || "";

        const url =
            `${API_BASE}/history/${itemId}.json?time-scale=${timeScale}&locations=${locations}`;

        console.log("History:", url);

        const response =
            await fetch(url);

        if (!response.ok) {

            console.error(
                "History HTTP error:",
                response.status
            );

            return res.json([]);

        }

        const text =
            await response.text();

        let data = [];

        try {

            data = JSON.parse(text);

        } catch (e) {

            console.error(
                "History JSON parse error"
            );

            console.log(text);

            return res.json([]);

        }

        res.json(data);

    } catch (e) {

        console.error(
            "History endpoint error:",
            e
        );

        res.json([]);

    }

});

// =======================================
// CACHE VIEWER
// =======================================

app.get("/cache", (req, res) => {

    res.json(cache);

});

// =======================================
// CLEAR CACHE
// =======================================

app.get("/clear-cache", (req, res) => {

    cache = {};

    saveCache(cache);

    res.json({
        success: true
    });

});

// =======================================
// START
// =======================================

app.listen(PORT, () => {

    console.log("");
    console.log("=================================");
    console.log(" Albion Backend Running");
    console.log("=================================");
    console.log(`PORT: ${PORT}`);
    console.log("=================================");
    console.log("");

});
