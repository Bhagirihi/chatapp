const express = require("express");
const app = express();
const http = require("http");
const path = require("path");
const server = http.createServer(app);
const PORT = process.env.PORTING || 4000;
const { Server } = require("socket.io");
const io = new Server(server);
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
let headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.nseindia.com/",
};

async function fetchCookies() {
  const userAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";
  const url = "https://www.nseindia.com";

  try {
    const browser = await puppeteer.launch({
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
    const cookies = await page
      .cookies()
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");
    headers = {
      ...headers,
      Cookie: cookieHeader,
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    };
    await browser.close();
    return cookies;
  } catch (error) {
    console.error("Error fetching NSE cookies:", error);
    throw error;
  }
}

async function fetchData(url) {
  try {
    const response = await axios.get(url, { headers });
    return response.data;
  } catch (error) {
    console.error(`Error fetching ${url}:`, error.message);
    return null;
  }
}

async function mergeDataBySymbol(nifty50, niftyBank, oiData) {
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
}

async function fetchDataAll() {
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
      io.emit("updateData", mergedData);
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
  fetchCookies()
    .then(async (cookies) => {
      const data = await fetchDataAll(cookieHeader);
      io.emit("message", data);
    })
    .catch((error) => {
      console.error("Error:", error);
      io.emit("message", error);
    });
  //
  socket.on("chat message", (msg) => {
    console.log("message: " + msg);
    io.emit("message", msg);
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
