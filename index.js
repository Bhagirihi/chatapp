const express = require("express");
const app = express();
const http = require("http");
const path = require("path");
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;
const { Server } = require("socket.io");
const admin = require("firebase-admin");
const moment = require("moment");
const data = require("./nse-scraper");

const io = new Server(server);
const serviceAccount = require("./rocketstocks-8901b-firebase-adminsdk-nil37-f6ea47acd5.json");
// Keep track of connected sockets
const connectedSockets = new Set();

if (!admin.apps.length) {
  // Initialize Firebase Admin SDK
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

// Wait utility function
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Fetch the latest stock data by `lastUpdateTime` from a specific date and time
async function fetchLatestData(socket, date) {
  try {
    // Reference the specific date document
    const dateRef = db.collection("Stocks").doc(date);

    // Get sub-collections (times) under the date
    const collections = await dateRef.listCollections();

    // Fetch the latest stock data from the latest time sub-collection
    collections.forEach(async (timeCollection) => {
      // Query the collection and order by `lastUpdateTime` (descending)
      const snapshot = await timeCollection
        .orderBy("lastUpdateTime", "desc")
        .limit(1) // Limit to the most recent stock for that time
        .get();

      if (!snapshot.empty) {
        const finalData = [];
        snapshot.forEach((doc) => {
          console.log("Latest stock data:", doc);
          finalData.push(doc.data());
        });
        //  console.log("finalData", finalData);
        socket.emit("latestStockData", finalData); // Send the data to the client
      }
    });
  } catch (error) {
    console.error("Error fetching latest stock data:", error);
  }
}

async function fetchLatestTimeRecord(date) {
  const dateDocRef = db.collection("Stocks").doc(date);
  const subcollections = await dateDocRef.listCollections();
  if (subcollections.length === 0) {
    console.log(`No time-based subcollections found for ${date}.`);
    return null;
  }

  // Extract subcollection names and sort them to find the latest time
  const timeCollections = subcollections.map((col) => col.id);
  timeCollections.sort((a, b) => b.localeCompare(a)); // Sort in descending order (latest time first)

  const latestTime = timeCollections[0]; // Get the latest time
  console.log(`Latest time subcollection for ${latestTime}`);
  return latestTime;
}

async function fetchLatestDateRecord() {
  try {
    // Reference the "Stocks" collection
    const stocksCollectionRef = db.collection("Stocks");

    // Fetch all documents (dates) within the "Stocks" collection
    const snapshot = await stocksCollectionRef.listDocuments();
    if (snapshot.length === 0) {
      console.log("No date documents found in the 'Stocks' collection.");
      return null;
    }

    // Extract document IDs (dates)
    const dateDocuments = snapshot.map((doc) => doc.id);

    // Sort document IDs (dates) in descending order
    dateDocuments.sort((a, b) => {
      const dateA = moment(a, "DD-MMM-YYYY");
      const dateB = moment(b, "DD-MMM-YYYY");
      return dateB - dateA; // Descending order
    });

    // Get the latest date
    const latestDate = dateDocuments[0];
    console.log(`Latest Date document: ${latestDate}`);
    return latestDate;
  } catch (error) {
    console.error("Error fetching the latest date record:", error.message);
    return null;
  }
}

async function listenToSubCollection(socket, latestDate, latestTime) {
  const subCollectionRef = db
    .collection("Stocks")
    .doc(latestDate)
    .collection(latestTime);

  // Set up a real-time listener
  subCollectionRef.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      const type = change.type; // 'added', 'modified', 'removed'
      const data = change.doc.data();
      const docId = change.doc.id;
      // Emit the update via Socket.IO
      socket.emit("latestUpdateStockData", { type, docId, data });
    });
  });

  console.log(
    `Listening to changes in sub-collection: Stocks/${latestDate}/${latestTime}`
  );
}

// Handle Socket.IO events
io.on("connection", (socket) => {
  console.log("a SOCKET connected ==>", socket.id);
  connectedSockets.add(socket);

  // Start Firestore listener for real-time updates

  // Usage Example
  fetchLatestDateRecord()
    .then((latestDate) => {
      if (latestDate) {
        fetchLatestTimeRecord(latestDate)
          .then((latestTime) => {
            console.log(
              `Found the latest Data on: ${latestDate} ${latestTime}`
            );
            // fetchLatestData(socket, latestDate)
            listenToSubCollection(socket, latestDate, latestTime); // Replace with your Firestore collection path
          })
          .catch((error) => {
            console.error("Error:", error.message);
          });
      } else {
        console.log("No latest date found.");
      }
    })
    .catch((error) => {
      console.error("Error:", error.message);
    });

  // Handle socket disconnection
  socket.on("disconnect", () => {
    connectedSockets.delete(socket);
    console.log("user disconnected");
  });
});

// Handle App Request
app.use(express.static(path.resolve("./public")));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public" + "/index.html");
});

app.get("/fetch", (req, res) => {
  res.json(data);
});

// Start the server
server.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
});
