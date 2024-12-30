const puppeteer = require("puppeteer");
const admin = require("firebase-admin");

const serviceAccount = require("./rocketstocks-8901b-firebase-adminsdk-nil37-f6ea47acd5.json");
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://rocketstocks-8901b-default-rtdb.firebaseio.com/",
  });
}
const db = admin.firestore();

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchNSEDataWithPuppeteer = async () => {
  const rootURL = "https://www.nseindia.com";
  const niftyAPI =
    "https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%2050";
  const bankNiftyAPI =
    "https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%20BANK";
  const OIDataAPI =
    "https://www.nseindia.com/api/live-analysis-oi-spurts-underlyings";

  try {
    // Launch Puppeteer browser
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Set User-Agent to mimic a real browser
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );

    // Step 1: Visit the root URL to fetch cookies
    console.log("Navigating to the root URL to fetch cookies...");
    await page.goto(rootURL, { waitUntil: "domcontentloaded" });

    // Wait for cookies to be set
    const cookies = await page.cookies();
    console.log("Cookies fetched:");

    // Convert cookies into a header-friendly string
    const cookieHeader = cookies
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");

    // Step 2: Fetch data from the API using Puppeteer
    console.log("Fetching data from the API...");
    const responseNifty = await page.evaluate(
      async (niftyAPI, cookieHeader) => {
        const response = await fetch(niftyAPI, {
          method: "GET",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            Accept: "application/json",
            Cookie: cookieHeader,
            Referer: "https://www.nseindia.com/",
          },
        });
        return response.json();
      },
      niftyAPI,
      cookieHeader
    );
    const responseBank = await page.evaluate(
      async (bankNiftyAPI, cookieHeader) => {
        const response = await fetch(bankNiftyAPI, {
          method: "GET",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            Accept: "application/json",
            Cookie: cookieHeader,
            Referer: "https://www.nseindia.com/",
          },
        });
        return response.json();
      },
      bankNiftyAPI,
      cookieHeader
    );
    const responseOIData = await page.evaluate(
      async (OIDataAPI, cookieHeader) => {
        const response = await fetch(OIDataAPI, {
          method: "GET",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            Accept: "application/json",
            Cookie: cookieHeader,
            Referer: "https://www.nseindia.com/",
          },
        });
        return response.json();
      },
      OIDataAPI,
      cookieHeader
    );

    console.log("API Data fetched successfully:");

    const fieldsToExtract = [
      "symbol",
      "identifier",
      "series",
      "open",
      "dayHigh",
      "dayLow",
      "lastPrice",
      "previousClose",
      "pChange",
      "lastUpdateTime",
      "yearHigh",
      "ffmc",
      "yearLow",
      "perChange365d",
      "perChange30d",
      "latestOI",
      "prevOI",
      "changeInOI",
      "avgInOI",
    ];
    const mergedData = [];
    const symbolMap = {};

    await responseNifty.data.forEach((item) => {
      symbolMap[item.symbol] = { ...item, type: "Nifty 50" };
    });

    await responseBank.data.forEach((item) => {
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

    await responseOIData.data.forEach((item) => {
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

    Object.values(symbolMap).forEach(async (data) => mergedData.push(data));
    // Close the browser
    await browser.close();

    // Function to extract selected fields
    const FilteredData = mergedData.map(async (item, index) => {
      const stocks = {};
      const updatedTime = responseNifty.timestamp;
      const [date, time] = updatedTime.split(" ");
      const formattedTime = time.replace(/:/g, "-"); // Replace ":" with "-" for valid Firebase keys

      // Set the path: Stocks > DATE > TIME > SYMBOL
      const ref = db
        .collection("Stocks")
        .doc(date)
        .collection(formattedTime)
        .doc(item.symbol);

      fieldsToExtract.forEach((field) => {
        stocks[field] = item[field];
      });
      await ref.set(JSON.parse(JSON.stringify(stocks))); // Write stock data
      return true;
    });

    return FilteredData;
  } catch (error) {
    console.error("Error fetching data:", error.message);
    wait(10000);

    console.log("We are trying to Fetch data again !!! in 5 Sec");
    console.clear();
    wait(10000);

    fetchNSEDataWithPuppeteer();
    return false;
  }
};

const runFetchLoop = async () => {
  while (true) {
    try {
      console.log("Fetching NSE data...");
      await fetchNSEDataWithPuppeteer(); // Call the function
      console.clear();
      console.log("Data fetched successfully. Waiting for the next cycle...");
    } catch (error) {
      console.error("An error occurred:", error.message);
    }
    // Wait for a defined interval before the next execution
    await wait(10000); // 5 seconds delay
  }
};

// Start the loop
runFetchLoop();
