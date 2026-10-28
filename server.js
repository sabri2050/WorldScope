
const express = require("express");
const https = require("https");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

function getRSS(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { "User-Agent": "WorldScope/1.0" }
    }, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error("France 24 HTTP " + response.statusCode));
        return;
      }

      let data = "";
      response.setEncoding("utf8");
      response.on("data", chunk => data += chunk);
      response.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

function decodeXML(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) =>
      String.fromCodePoint(Number(n))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16))
    )
    .trim();
}

function getTag(xml, tag) {
  const match = xml.match(
    new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + tag + ">")
  );
  return match ? decodeXML(match[1]) : "";
}

app.get("/api/news", async (req, res) => {
  try {
    const xml = await getRSS("https://www.france24.com/fr/rss");
    const items = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/g) || [];

    const news = items.slice(0, 25).map(item => {
      const imageMatch = item.match(
        /<(?:media:thumbnail|enclosure)\b[^>]*url=["']([^"']+)["']/i
      );

      return {
        category: getTag(item, "category"),
        title: getTag(item, "title"),
        link: getTag(item, "link"),
        description: getTag(item, "description").replace(/<[^>]*>/g, ""),
        date: getTag(item, "pubDate"),
        image: imageMatch ? imageMatch[1] : ""
      };
    }).filter(item => item.title && item.link);

    res.json({
      source: "France 24",
      total: news.length,
      news
    });
  } catch (error) {
    console.error("Erreur RSS :", error.message);
    res.status(502).json({
      error: "Impossible de récupérer les actualités de France 24 pour le moment."
    });
  }
});

app.listen(PORT, () => {
  console.log(`WorldScope fonctionne sur http://localhost:${PORT}`);
});
