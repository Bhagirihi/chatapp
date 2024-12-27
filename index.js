const express = require("express");
const app = express();
const http = require("http");
const path = require("path");
const server = http.createServer(app);
const PORT = process.env.PORTING || 4000;
const { Server } = require("socket.io");
const io = new Server(server);
const axios = require("axios");

async function fetchCookies(url) {
  try {
    const response = await axios.get(url, {
      withCredentials: true,
      headers: {
        "User-Agent": "Mozilla/5.0", // Helps avoid bot detection
      },
    });

    const cookies = response.headers["set-cookie"];
    console.log("Cookies:", cookies); // Array of cookies
    io.emit("message", cookies);
  } catch (error) {
    console.error("Error fetching cookies:", error);
    io.emit("message", error);
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
