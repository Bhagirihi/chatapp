const express = require("express");
const app = express();
const http = require("http");
const ngrok = require("ngrok");
const path = require("path");
const cors = require("cors");

const server = http.createServer(app);
const PORT = process.env.SERVER_PORTING || 1000;
const bodyParser = require("body-parser");
const authController = require("./controllers/authController");
const orderManger = require("./controllers/orderManager");
const fs = require("fs");
const { Server } = require("socket.io");
const axios = require("axios");
// ✅ Enable CORS for Socket.io
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "*"], // Allow frontend
    methods: ["GET", "POST"],
    credentials: true,
  },
});
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const { execSync } = require("child_process");
const qrcode = require("qrcode-terminal");
let activeClients = new Map();
var orderedStocks = [];
let totalGainValue = 0;

// ✅ Enable CORS for Express routes
app.use(
  cors({
    origin: ["http://localhost:3000", "*"], // Allow frontend
    methods: ["GET", "POST"],
    credentials: true, // Allow credentials (cookies, auth headers)
  })
);

puppeteer.use(StealthPlugin());
let headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.nseindia.com/",
};
const delay = (ms) => new Promise((res) => setTimeout(res, ms));
let browser = null;
let chromiumPath = null;
let cookieHeader = null;
let cookieExpiry = null;

// Find Chromium's executable path dynamically
let opsys = process.platform;

const ordersFilePath = path.join(__dirname + "/data/orders.json");

async function getCookie() {
  const currentTime = Date.now();

  // Check if a valid cookie exists
  if (cookieHeader && cookieExpiry && cookieExpiry > currentTime) {
    console.log("Using cached cookie");
    return cookieHeader;
  }

  console.log("Cookie expired or not available, fetching new cookie");
  cookieHeader = await fetchCookies(); // Fetch new cookie
  return cookieHeader;
}

async function fetchCookies() {
  const userAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";
  const url = "https://www.nseindia.com";
  //const executablePath = findChrome(); // Automatically finds Chrome/Chromium on your system
  if (opsys == "linux" || opsys == "android") {
    try {
      chromiumPath = execSync("which chromium").toString().trim();
    } catch (err) {
      console.error("Chromium not found. Please install it in Termux.");
      chromiumPath = puppeteer.executablePath();
    }
  }
  try {
    if (opsys == "darwin" || opsys == "win32") {
      browser = await puppeteer.launch({
        // executablePath: chromiumPath, // Use dynamically found path
        channel: "chrome", // Use Chrome browser
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    } else if (opsys == "linux" || opsys == "android") {
      browser = await puppeteer.launch({
        executablePath: chromiumPath, // Use dynamically found path

        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    }

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
    cookieHeader = cookies
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");
    // Extract cookie expiration dynamically
    const minExpiry = cookies
      .map((cookie) => cookie.expires * 1000) // Convert from seconds to milliseconds
      .filter((expires) => expires > 0) // Ignore session cookies with no expiration
      .reduce((min, expires) => Math.min(min, expires), Infinity);

    if (minExpiry !== Infinity) {
      cookieExpiry = minExpiry; // Use the earliest expiration time
    } else {
      // If no expiration is provided, set a default expiry (e.g., 15 minutes)
      cookieExpiry = Date.now() + 15 * 60 * 1000;
    }
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

        recommended: MOSTACTIVE.includes(item.symbol) || false,
      };
    }
  });

  Object.values(symbolMap).forEach(async (data) => mergedData.push(data));
  const filteredSortedData = mergedData
    .filter((item) => item?.FNO?.length > 0) // You can adjust this condition as needed
    .sort((a, b) => b.FNO.length - a.FNO.length); // Sorting in descending order
  return filteredSortedData;
}

async function fetchExtraDataAll(socket, cookieHeader) {
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

    const indexCalls = datacall
      .filter((item) => item.pChange >= 25)
      .filter((item) => item.lastPrice < 50)
      .sort((a, b) => a.lastPrice - b.lastPrice);

    const indexPuts = dataput
      .filter((item) => item.pChange >= 25)
      .filter((item) => item.lastPrice < 50)
      .sort((a, b) => a.lastPrice - b.lastPrice);

    indexPuts.map((res) => {
      if (
        orderedStocks.includes(
          `${res.underlying}-${res.strikePrice}-${res.optionType}`
        )
      ) {
        totalGainValue += res.lastPrice;
        console.log("PRICE 1", totalGainValue);
      }
    });
    indexCalls.map((res) => {
      if (
        orderedStocks.includes(
          `${res.underlying}-${res.strikePrice}-${res.optionType}`
        )
      ) {
        totalGainValue += res.lastPrice;
        console.log("PRICE 2", totalGainValue);
      }
    });

    io.emit("updateOptionCalls", indexCalls, INDEXCALL.OPTIDX.timestamp);
    io.emit("updateOptionPuts", indexPuts, INDEXPUT.OPTIDX.timestamp);
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

      let STOCKCALL = stockCall.OPTSTK.data.filter((item) => item.pChange >= 1);
      let STOCKPUT = stockPut.OPTSTK.data.filter((item) => item.pChange >= 1);

      STOCKCALL.map((res) => {
        if (
          orderedStocks.includes(
            `${res.underlying}-${res.strikePrice}-${res.optionType}`
          )
        ) {
          totalGainValue += res.lastPrice;
          console.log("PRICE 3", totalGainValue);
        }
      });
      STOCKPUT.map((res) => {
        if (
          orderedStocks.includes(
            `${res.underlying}-${res.strikePrice}-${res.optionType}`
          )
        ) {
          totalGainValue += res.lastPrice;
          console.log("PRICE 4", totalGainValue);
        }
      });

      let ACTIVE = mostActive?.data;

      const LSTUPDATE = nifty50.timestamp;

      let mergedData = mergeDataBySymbol(
        NIFTY,
        BANKNIFTY,
        OIDATA,
        ACTIVE,
        STOCKCALL,
        STOCKPUT
      );
      Promise.all([mergedData]).then(async ([data]) => {
        io.emit("updateData", data, LSTUPDATE);
      });
    } else {
      throw new Error("Data fetch incomplete");
    }
  } catch (error) {
    console.error("Data fetch error:", error.message);
    socket.emit("error", "Failed to fetch stock data");
  }
}

function callStockData(socket) {
  getCookie()
    .then(async (cookies) => {
      totalGainValue = 0;
      delay(2000);
      await fetchDataAll(socket, cookies);
      await fetchExtraDataAll(socket, cookies);
      await fetchTotalGain(socket);
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}

function fetchTotalGain(socket, gain = totalGainValue) {
  socket.emit("totalGain", gain);
}

//Handle SOCKET.IO
io.on("connection", (socket) => {
  console.log("a SOCKET connected ==>", socket.id);
  activeClients.set(socket.id, { connectedAt: new Date() });
  callStockData(socket);

  setInterval(function () {
    callStockData(socket);
  }, 10000);

  socket.on("reconnect_attempt", () => {
    console.log(`Client ${socket.id} attempting to reconnect`);
  });

  socket.on("reconnect", () => {
    console.log(`Client ${socket.id} reconnected`);
  });

  socket.on("disconnect", (reason) => {
    console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
    activeClients.delete(socket.id);
  });

  socket.on("customEvent", (data) => {
    console.log("📩 Received event from client:", data);

    // Optional: Broadcast to all clients
    io.emit("serverResponse", { reply: "Server received your message!" });
  });
});
// Reusable function to serve files
const serveFile = (res, fileName) => {
  res.sendFile(path.join(__dirname, "public", fileName));
};

// Middleware to parse JSON request bodies
app.use(bodyParser.json());

// ✅ Add a /ping route (Optional, for manual checks)
app.get("/ping", (req, res) => {
  res.status(200).send("🏓 Server is alive!");
});

// ✅ Self-Ping Every 40 Seconds
setInterval(() => {
  console.log("🔄 Keeping server awake...");

  fetch("https://minitrade.onrender.com/")
    .then(() => console.log("✅ Keep-alive ping sent to server"))
    .catch((err) => console.error("❌ Keep-alive ping failed:", err));
}, 40 * 1000); // Every 40 seconds

// ✅ Catch unhandled errors
process.on("uncaughtException", (err) => {
  console.error("🔥 Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("🔥 Unhandled Rejection:", reason);
});

app.get("/", (req, res) => serveFile(res, "nseIndex.html"));

// Reset Password Route
app.post("/reset-password", authController.resetPassword);

// Forgot Password Route
app.post("/forgot-password", authController.forgotPassword);

// Registration Route
app.post("/register", authController.register);

// Login Route
app.post("/login", authController.login);

//Order Route
app.post("/deleteOrder", function (req, res) {
  const orderId = Number(req.params.orderId);

  fs.readFile(ordersFilePath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).json({ error: "Unable to read orders file." });
    }

    let orders = JSON.parse(data);
    orders = orders.filter((order) => order.order !== orderId);

    fs.writeFile(ordersFilePath, JSON.stringify(orders, null, 2), (err) => {
      if (err) {
        return res.status(500).json({ error: "Unable to delete order." });
      }
      res.json({ message: "Order deleted successfully.", orders });
    });
  });
});

app.post("/updateOrder", function (req, res) {
  const orderId = Number(req.params.orderId);
  const updatedOrder = req.body;

  fs.readFile(ordersFilePath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).json({ error: "Unable to read orders file." });
    }

    let orders = JSON.parse(data);
    const orderIndex = orders.findIndex((order) => order.order === orderId);

    if (orderIndex === -1) {
      return res.status(404).json({ error: "Order not found." });
    }

    orders[orderIndex] = { ...orders[orderIndex], ...updatedOrder };

    fs.writeFile(ordersFilePath, JSON.stringify(orders, null, 2), (err) => {
      if (err) {
        return res.status(500).json({ error: "Unable to update order." });
      }
      res.json({ message: "Order updated successfully.", orders });
    });
  });
});

app.post("/addOrder", function (req, res) {
  const newOrder = req.body;

  fs.readFile(ordersFilePath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).json({ error: "Unable to read orders file." });
    }

    let orders;
    try {
      orders = JSON.parse(data);
      if (!Array.isArray(orders)) {
        orders = []; // Initialize as an empty array if not an array
      }
    } catch (e) {
      return res.status(500).json({ error: "Invalid JSON in orders file." });
    }

    // Determine the order number
    const lastOrder = orders[orders.length - 1]; // Get the last order
    const lastOrderNumber = lastOrder ? lastOrder.order : 0; // Default to 0 if no orders
    newOrder.order = lastOrderNumber + 1; // Increment by 1

    // Add the current date and time in a readable format
    const now = new Date();
    newOrder.date = now.toLocaleString(); // Format like 'MM/DD/YYYY, HH:MM:SS AM/PM'

    orders.push(newOrder); // Add the new order to the list

    // Write the updated orders back to the file
    fs.writeFile(ordersFilePath, JSON.stringify(orders, null, 2), (err) => {
      if (err) {
        return res.status(500).json({ error: "Unable to save order." });
      }
      res.send({ message: "Order added successfully", orders });
    });
  });
});

app.post("/orderLists", function (req, res) {
  const { tabId } = req.body; // Expecting the tab ID from the request body

  let orders = fs.existsSync(ordersFilePath)
    ? JSON.parse(fs.readFileSync(ordersFilePath, "utf-8"))
    : [];

  fs.writeFileSync(ordersFilePath, JSON.stringify(orders, null, 2));

  // Filter orders based on the tabId
  let ordersList = [];
  switch (tabId) {
    case "orders-all":
      ordersList = orders;
      break;
    case "orders-executed":
      ordersList = orders.filter((order) => order.status === "Executed");
      break;
    case "orders-pending":
      ordersList = orders.filter((order) => order.status === "Pending");
      break;
    case "orders-cancelled":
      ordersList = orders.filter((order) => order.status === "Cancelled");
      break;
    default:
      return res.status(400).json({ message: "Invalid tabId" });
  }
  res.send({ message: "Order added successfully", ordersList });
});

app.post("/orderValues", function (req, res) {
  let orders = fs.existsSync(ordersFilePath)
    ? JSON.parse(fs.readFileSync(ordersFilePath, "utf-8"))
    : [];
  const today = new Date().toLocaleDateString("en-US"); // Format like 'MM/DD/YYYY'

  console.log("ORDER", orders, today);
  // Filter orders based on the tabId
  let totalInvestAmount = 0;
  let stockList = [];
  let ordersList = orders.filter((order) => order.date.includes(today));
  ordersList.map((orders) => {
    totalInvestAmount = totalInvestAmount + orders.total;
    stockList.push(orders.stick);
  });
  orderedStocks = stockList;
  res.send({
    message: "Order Fetch successfully",
    data: [
      {
        inOrders: ordersList.length,
        totalInvest: totalInvestAmount,
        stocks: stockList,
        currentValue: totalGainValue,
      },
    ],
  });
});

server.listen(PORT, async () => {
  console.log(`listening on *:${PORT}`);
  // try {
  //   // Start Ngrok tunnel
  //   const publicUrl = await ngrok.connect({
  //     addr: PORT, // Expose this port
  //     authtoken: "2pZZqBlxXZILz4vQZ1dYZ19skm5_7bxVDE9rCSyyzANZ9t4rc", // Replace with your Ngrok auth token
  //   });

  //   // Generate and display the QR code in the console
  //   qrcode.generate(publicUrl, { small: true }, (qrCode) => {
  //     console.log("Scan this QR Code:");
  //     console.log(qrCode);
  //   });
  // } catch (err) {
  //   console.error("Error starting Ngrok:", err);
  // }
});
