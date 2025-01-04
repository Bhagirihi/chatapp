const express = require("express");
const app = express();
const http = require("http");
const path = require("path");
const server = http.createServer(app);
const PORT = process.env.PORTING || 4000;
const { Server } = require("socket.io");
const axios = require("axios");
const io = new Server(server);
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 300 }); // Cache for 15 minutes

puppeteer.use(StealthPlugin());
let headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.nseindia.com/",
};
const delay = (ms) => new Promise((res) => setTimeout(res, ms));
async function fetchCookies() {
  const userAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";
  const url = "https://www.nseindia.com";
  // Detect Termux environment
  const isTermux = !!process.env.TERMUX_VERSION;

  // Set the executablePath for Termux
  const executablePath = isTermux
    ? "/data/data/com.termux/files/usr/bin/chromium" // Chromium in Termux
    : undefined; // Use default browser for non-Termux environments

  try {
    const browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    // Set headers to mimic a real browser
    await page.setUserAgent(userAgent);
    await page.setViewport({ width: 1280, height: 800 });
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      Referer: url,
    });

    // Handle resource interception to speed up navigation
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const resourceType = req.resourceType();
      if (["image", "stylesheet", "font"].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Navigate to the NSE website
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    // Fetch cookies
    const cookies = await page.cookies();
    const cookieHeader = cookies
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");
    console.log("COOKIES");

    await browser.close();
    return cookieHeader;
  } catch (error) {
    console.error("Error fetching NSE cookies:", error);
    throw error;
  }
}

async function fetchData(url, cookieHeader) {
  headers = {
    ...headers,
    Cookie: cookieHeader,
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  };
  try {
    const response = await axios.get(url, { headers });
    return response.data;
  } catch (error) {
    console.error(`Error fetching ${url}:`, error.message);
    return null;
  }
}

async function mergeDataBySymbol(
  nifty50,
  niftyBank,
  oiData,
  mostActive,
  updateTime,
  stockCall,
  stockPut
) {
  const mergedData = [];
  const MOSTACTIVE = mostActive.map((item) => item.symbol);
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

  stockCall.forEach((item) => {
    if (symbolMap[item.underlying]) {
      symbolMap[item.underlying] = {
        ...symbolMap[item.underlying],
        FNO: [
          ...(symbolMap[item.underlying]?.FNO || []), // Ensure FNO is an array or initialize it as an empty array
          {
            ...item,
          },
        ],
      };
    }
  });

  stockPut.forEach((item) => {
    if (symbolMap[item.underlying]) {
      symbolMap[item.underlying] = {
        ...symbolMap[item.underlying],
        FNO: [
          ...(symbolMap[item.underlying]?.FNO || []), // Ensure FNO is an array or initialize it as an empty array
          {
            ...item,
          },
        ],
      };
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
        updateTime: updateTime,
        recommended: MOSTACTIVE.includes(item.symbol) || false,
      };
    }
  });

  Object.values(symbolMap).forEach(async (data) => mergedData.push(data));
  const filteredSortedData = mergedData
    .filter((item) => item?.FNO?.length > 0) // You can adjust this condition as needed
    .sort((a, b) => b.FNO.length - a.FNO.length); // Sorting in descending order
  console.log("filteredSortedData", filteredSortedData);
  return filteredSortedData.length == 0
    ? [{ updateTime: updateTime }]
    : filteredSortedData;
}

async function fetchExtraDataAll(socket, cookieHeader) {
  console.log("HEADER ---");
  try {
    const indexCall = await fetchData(
      "https://www.nseindia.com/api/snapshot-derivatives-equity?index=calls-index-vol",
      cookieHeader
    );
    const indexPut = await fetchData(
      "https://www.nseindia.com/api/snapshot-derivatives-equity?index=puts-index-vol",
      cookieHeader
    );
    const INDEXCALL = indexCall;
    const INDEXPUT = indexPut;

    // Access the data array
    const datacall = INDEXCALL.OPTIDX.data;

    const dataput = INDEXPUT.OPTIDX.data;

    // Merge arrays
    const mergedArray = [...datacall, ...dataput]
      .filter((item) => item.pChange >= 25)
      .filter((item) => item.lastPrice < 50)
      .sort((a, b) => a.lastPrice - b.lastPrice);

    io.emit("updateOptionData", mergedArray, INDEXPUT.OPTIDX.timestamp);
  } catch (error) {
    console.error("Data fetch error:", error.message);
    socket.emit("error", "Failed to fetch stock data");
  }
}

async function fetchDataAll(socket, cookieHeader) {
  try {
    const nifty50 = await fetchData(
      "https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%2050",
      cookieHeader
    );
    const niftyBank = await fetchData(
      "https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%20BANK",
      cookieHeader
    );
    const oiData = await fetchData(
      "https://www.nseindia.com/api/live-analysis-oi-spurts-underlyings",
      cookieHeader
    );
    const stockCall = await fetchData(
      "https://www.nseindia.com/api/snapshot-derivatives-equity?index=calls-stocks-vol",
      cookieHeader
    );

    const stockPut = await fetchData(
      "https://www.nseindia.com/api/snapshot-derivatives-equity?index=puts-stocks-vol",
      cookieHeader
    );

    const mostActive = await fetchData(
      "https://www.nseindia.com/api/live-analysis-most-active-securities?index=volume",
      cookieHeader
    );

    if (
      nifty50?.data &&
      niftyBank?.data &&
      oiData?.data &&
      mostActive?.data &&
      stockCall.OPTSTK.data &&
      stockPut.OPTSTK.data
    ) {
      const NIFTY = nifty50?.data.filter(
        (item) => item.pChange >= 2 || item.pChange <= -2
      );
      const BANKNIFTY = niftyBank?.data.filter(
        (item) => item.pChange >= 2 || item.pChange <= -2
      );
      const OIDATA = oiData?.data.filter((item) => item.avgInOI >= 3);

      let STOCKCALL = stockCall.OPTSTK.data.filter(
        (item) => item.pChange >= 50
      );
      let STOCKPUT = stockPut.OPTSTK.data.filter((item) => item.pChange >= 50);
      let ACTIVE = mostActive?.data;

      const LSTUPDATE = nifty50.timestamp;

      let mergedData = mergeDataBySymbol(
        NIFTY,
        BANKNIFTY,
        OIDATA,
        ACTIVE,
        LSTUPDATE,
        STOCKCALL,
        STOCKPUT
      );
      Promise.all([mergedData]).then(async ([data]) => {
        io.emit("updateData", data);
      });
    } else {
      throw new Error("Data fetch incomplete");
    }
  } catch (error) {
    console.error("Data fetch error:", error.message);
    socket.emit("error", "Failed to fetch stock data");
  }
}

//Handle SOCKET.IO
io.on("connection", (socket) => {
  console.log("a SOCKET connected ==>", socket.id);

  socket.on("fetchData", async () => {
    fetchCookies()
      .then(async (cookies) => {
        await fetchDataAll(socket, cookies);
        await fetchExtraDataAll(socket, cookies);
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  });

  socket.on("Stocks", async () => {
    fetchCookies()
      .then(async (cookies) => {
        await fetchDataAll(socket, cookies);
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  });

  socket.on("Options", async () => {
    fetchCookies()
      .then(async (cookies) => {
        await fetchExtraDataAll(socket, cookies);
      })
      .catch((error) => {
        console.error("Error:", error);
      });
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
