import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import cors from "cors";

app.use(cors());
const app = express();
const PORT = 3000;

const CACHE_FILE = "./cache.json";

function loadCache() {
    if (!fs.existsSync(CACHE_FILE)) return {};
    return JSON.parse(fs.readFileSync(CACHE_FILE));
}

function saveCache(data) {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
}

let cache = loadCache();

const API_BASE = "https://europe.albion-online-data.com/api/v2/stats/prices";

app.get("/prices/:itemId", async (req, res) => {
    const itemId = req.params.itemId;
    const locations = req.query.locations;

    try {
        const url = `${API_BASE}/${itemId}.json?locations=${locations}`;
        const response = await fetch(url);
        const data = await response.json();

        let result = {};

        data.forEach(i => {
            if (!i.city) return;

            const buy = i.sell_price_min || 0;
            const sell = i.buy_price_max || 0;

            if (!cache[itemId]) cache[itemId] = {};

            // si hay datos buenos → actualizar cache
            if (buy > 0 || sell > 0) {
                cache[itemId][i.city] = {
                    buy,
                    sell,
                    timestamp: Date.now()
                };
            }

            // si no hay datos → usar cache
            const fallback = cache[itemId]?.[i.city];

            result[i.city] = {
                buy: buy || fallback?.buy || 0,
                sell: sell || fallback?.sell || 0
            };
        });

        saveCache(cache);

        res.json(result);

    } catch (e) {
        res.json(cache[itemId] || {});
    }
});

app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
});
