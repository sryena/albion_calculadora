import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 10000;

// 🔥 CORS BIEN CONFIGURADO
app.use(cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"]
}));

// 🔥 HEADERS EXTRA (clave en Render)
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    next();
});

const CACHE_FILE = "./cache.json";

function loadCache() {
    if (!fs.existsSync(CACHE_FILE)) return {};
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
}

function saveCache(data) {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
}

let cache = loadCache();

const API_BASE = "https://europe.albion-online-data.com/api/v2/stats";

// =========================
// ✅ PRECIOS
// =========================
app.get("/prices/:itemId", async (req, res) => {
    const itemId = req.params.itemId;
    const locations = req.query.locations || "";

    try {
        const url = `${API_BASE}/prices/${itemId}.json?locations=${locations}&qualities=1`;

        const response = await fetch(url);
        const data = await response.json();

        let result = {};

        if (Array.isArray(data)) {
            data.forEach(i => {
                if (!i.city) return;

                const buyCost = i.sell_price_min || 0;
                const sellRevenue = i.buy_price_max || 0;

                if (!cache[itemId]) cache[itemId] = {};

                if (buyCost > 0 || sellRevenue > 0) {
                    cache[itemId][i.city] = {
                        buyCost,
                        sellRevenue,
                        timestamp: Date.now()
                    };
                }

                const fallback = cache[itemId]?.[i.city];

                result[i.city] = {
                    buyCost: buyCost || fallback?.buyCost || 0,
                    sellRevenue: sellRevenue || fallback?.sellRevenue || 0
                };
            });
        }

        saveCache(cache);
        res.json(result);

    } catch (e) {
        console.error("API error:", e);
        res.json(cache[itemId] || {});
    }
});

// =========================
// ✅ HISTORY (NUEVO ENDPOINT)
// =========================
app.get("/history/:itemId", async (req, res) => {
    const itemId = req.params.itemId;

    try {
        const url = `${API_BASE}/history/${itemId}.json?time-scale=24`;

        const response = await fetch(url);
        const data = await response.json();

        res.json(data);

    } catch (e) {
        console.error("History error:", e);
        res.json([]);
    }
});

app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
});
