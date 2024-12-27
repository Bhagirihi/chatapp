const express = require("express");
const app = express();
const http = require("http");
const path = require("path");
const server = http.createServer(app);
const PORT = process.env.PORTING || 4000;
const { Server } = require("socket.io");
const io = new Server(server);
const puppeteer = require("puppeteer");

async function fetchCookies(url) {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    await page.setExtraHTTPHeaders({
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
    });

    await page.goto("https://www.nseindia.com", { waitUntil: "networkidle2" });

    const cookies = await page.cookies();
    const cookieHeader = cookies
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");
    console.log("Cookies:", cookieHeader);

    await browser.close();
    console.log("Cookies:", cookieHeader); // Array of cookies
    io.emit("message", cookieHeader);
  } catch (error) {
    console.error("Error fetching cookies:", error);
    io.emit("message", JSON.stringify(error));
  }
}

//Handle SOCKET.IO
io.on("connection", (socket) => {
  console.log("a SOCKET connected ==>", socket.id);
  fetchCookies("https://www.nseindia.com/");
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
