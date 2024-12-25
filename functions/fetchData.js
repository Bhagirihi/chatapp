const axios = require("axios");

const fetchData = async (url, headers) => {
  console.log(url, headers);
  try {
    const response = await axios.get(url, { headers });
    return response.data;
  } catch (error) {
    console.error(`Error fetching ${url}:`, error.message);
    return null;
  }
};

const mergeDataBySymbol = (nifty50, niftyBank, oiData) => {
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
};

module.exports = { fetchData, mergeDataBySymbol };
