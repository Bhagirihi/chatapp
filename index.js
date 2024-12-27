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
    const cookies = await page.cookies();
    await browser.close();
    return cookies;
  } catch (error) {
    console.error("Error fetching NSE cookies:", error);
    throw error;
  }
}

//Handle SOCKET.IO
io.on("connection", (socket) => {
  console.log("a SOCKET connected ==>", socket.id);
  fetchCookies()
    .then((cookies) => {
      console.log("Cookies:", cookies);
      const cookieHeader = cookies
        .map((cookie) => `${cookie.name}=${cookie.value}`)
        .join("; ");
      io.emit("message", cookieHeader);
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
