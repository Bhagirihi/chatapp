const express = require("express");
const app = express();
const http = require("http");
const path = require("path");
const axios = require("axios");
const puppeteer = require("puppeteer");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

const PORT = process.env.PORTING || 4000;
let headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.nseindia.com/",
};

const getCookiesWithPuppeteer = async () => {
  try {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0 Safari/537.36"
    );
    await page.goto("https://www.nseindia.com", {
      waitUntil: "domcontentloaded",
    });

    const cookies = await page.cookies();
    await browser.close();

    return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
  } catch (error) {
    console.error("Error fetching cookies:", error.message);
    throw new Error("Failed to retrieve cookies");
  }
};

const fetchData = async (url) => {
  try {
    const response = await axios.get(url, { headers });
    return response.data;
  } catch (error) {
    console.error(`Error fetching ${url}:`, error.message);
    return null;
  }
};

const mergeDataBySymbol = (nifty50, niftyBank, oiData) => {
  const mergedData = [];
  const symbolMap = {};

  nifty50.forEach((item) => {
    symbolMap[item.symbol] = { ...item, type: "Nifty 50" };
  });

  niftyBank.forEach((item) => {
    if (symbolMap[item.symbol]) {
      symbolMap[item.symbol] = {
        ...symbolMap[item.symbol],
        ...item,
        type: "Nifty 50 & Nifty Bank",
      };
    } else {
      symbolMap[item.symbol] = { ...item, type: "Nifty Bank" };
    }
  });

  oiData.forEach((item) => {
    if (symbolMap[item.symbol]) {
      symbolMap[item.symbol] = {
        ...symbolMap[item.symbol],
        latestOI: item.latestOI,
        prevOI: item.prevOI,
        changeInOI: item.changeInOI,
        avgInOI: item.avgInOI,
      };
    }
  });

  Object.values(symbolMap).forEach((data) => mergedData.push(data));
  return mergedData;
};

//Handle SOCKET.IO
io.on("connection", async (socket) => {
  console.log("a SOCKET connected ==>", socket.id);
  console.log("Getting cookies with Puppeteer...");
  const cookieHeader = await getCookiesWithPuppeteer();
  headers = {
    ...headers,
    Cookie: cookieHeader,
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  };
  console.log("header", headers.length > 0);
  socket.emit("loader", false);

  socket.on("chat message", (msg) => {
    console.log("message: " + msg);
    io.emit("message", msg);
  });

  socket.on("fetchData", async () => {
    try {
      const nifty50 = await fetchData(
        "https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%2050"
      );
      const niftyBank = await fetchData(
        "https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%20BANK"
      );
      const oiData = await fetchData(
        "https://www.nseindia.com/api/live-analysis-oi-spurts-underlyings"
      );

      if (nifty50?.data && niftyBank?.data && oiData?.data) {
        const mergedData = mergeDataBySymbol(
          nifty50.data,
          niftyBank.data,
          oiData.data
        );
        socket.emit("updateData", mergedData);
      } else {
        throw new Error("Data fetch incomplete");
      }
    } catch (error) {
      console.error("Data fetch error:", error.message);
      socket.emit("error", "Failed to fetch stock data");
    }
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

// Handle App Request
app.use(express.static(path.resolve("./public")));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public" + "/index.html");
});

server.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
});
