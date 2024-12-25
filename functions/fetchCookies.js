const puppeteer = require("puppeteer");

const getCookiesWithPuppeteer = async () => {
  try {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0 Safari/537.36"
    );
    await page.goto("https://www.nseindia.com", {
      waitUntil: "domcontentloaded",
    });

    const cookies = await page.cookies();
    await browser.close();
    const cookieValue = cookies
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");
    console.log("COOKIE", cookieValue);
    return cookieValue;
  } catch (error) {
    console.error("Error fetching cookies:", error.message);
    throw new Error("Failed to retrieve cookies");
  }
};

module.exports = getCookiesWithPuppeteer();
