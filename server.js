const express = require("express");
const app = express();
const http = require("http");
const path = require("path");
const server = http.createServer(app);
const PORT = process.env.PORTING || 4040;

// Handle App Request
app.use(express.static(path.resolve("./public")));

// Reusable function to serve files
const serveFile = (res, fileName) => {
  res.sendFile(path.join(__dirname, "public", fileName));
};

// Define routes using the reusable function
app.get("/", (req, res) => serveFile(res, "index.html"));
app.get("/signin", (req, res) => serveFile(res, "login.html"));
app.get("/signup", (req, res) => serveFile(res, "signup.html"));
app.get("/reset", (req, res) => serveFile(res, "reset-password.html"));
app.get("/dashboard", (req, res) => serveFile(res, "dashboard.html"));
app.get("/stocks", (req, res) => serveFile(res, "stock.html"));
app.get("/orders", (req, res) => serveFile(res, "orders.html"));
app.get("*", (req, res) => serveFile(res, "404.html"));

server.listen(PORT, async () => {
  console.log(`listening on *:${PORT}`);
});
