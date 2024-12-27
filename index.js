const express = require("express");

const http = require("http");

const path = require("path");
const axios = require("axios");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
require("dotenv").config();

const PORT = process.env.PORTING || 4000;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.nseindia.com/",
};

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(url, { headers });
      const cookies = await response.headers["set-cookie"];
      console.log("Cookies: ==>", cookies); // Array of cookies
      return cookies;
    } catch (error) {
      if (i === retries - 1) throw error;
      console.log(`Retrying... (${i + 1})`);
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** i));
    }
  }
}

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

  socket.on("fetchData", async () => {
    const cookieHeader = await fetchWithRetry("https://www.nseindia.com");
    console.log("Getting cookies with Puppeteer...", cookieHeader);
    headers = {
      ...headers,
      Cookie: cookieHeader,
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    };
    console.log("Wait starts...");
    await wait(5000); // Waits for 5 seconds
    console.log("5 seconds have passed.");
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
        const NIFTY = nifty50?.data.filter(
          (item) => item.pChange >= 2 || item.pChange <= -2
        );
        const BANKNIFTY = niftyBank?.data.filter(
          (item) => item.pChange >= 2 || item.pChange <= -2
        );
        const OIDATA = oiData?.data.filter((item) => item.avgInOI >= 3);

        let mergedData = mergeDataBySymbol(NIFTY, BANKNIFTY, OIDATA);
        if (mergedData.length == 0) {
          mergedData = mergeDataBySymbol(
            nifty50?.data,
            niftyBank?.data,
            oiData?.data
          );
        }
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
