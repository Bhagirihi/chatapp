// Track open accordions
let openAccordions = {};
let stockLists = [];
let currentValue = 0;
const totalGainElement = document.getElementById("totalGain");

orderValues();

// Function to render the table (example implementation)
function renderIndexPutsTable(data, time) {
  // Dynamically populate table
  const indexPutsBody = document.querySelector("#indexPutsTable tbody");

  indexPutsBody.innerHTML = data
    .map((stock, index) => {
      const arrow = (value) =>
        value > 0
          ? `<span style="color: green;">&#9650;</span>` // Up arrow
          : `<span style="color: red;">&#9660;</span>`; // Down arrow
      const badgeClass = (value) => (value > 0 ? "bg-success" : "bg-danger");

      return `
<tr>
<td class="stat-cell"><a href="#">${stock.underlying}-${
        stock.strikePrice
      }</a></td>
<td class="stat-cell ${badgeClass(stock.optionType == "Call" ? 1 : -1)}">${
        stock.optionType
      }</td>
<td class="stat-cell">${arrow(stock.lastPrice)}${stock.lastPrice}</td>
<td class="stat-cell ${stock.pChange.toFixed(2) > 90 && "bg-warning"}">${
        stock.pChange.toFixed(2) || "-"
      }%</td>
<td class="cell">

  <button class="btn-sm app-btn-secondary buy-button" type="button" onclick="addOrder('${encodeURIComponent(
    JSON.stringify(stock)
  )}')">BUY IT</button>
</td>

</tr>
`;
    })
    .join("");
}

function renderIndexCallsTable(data, time) {
  const indexCallsBody = document.querySelector("#indexCallsTable tbody");

  indexCallsBody.innerHTML = data
    .map((stock, index) => {
      const arrow = (value) =>
        value > 0
          ? `<span style="color: green;">&#9650;</span>` // Up arrow
          : `<span style="color: red;">&#9660;</span>`; // Down arrow
      const badgeClass = (value) => (value > 0 ? "bg-success" : "bg-danger");

      return `
<tr>
<td class="stat-cell"><a href="#">${stock.underlying}-${
        stock.strikePrice
      }</a></td>
<td class="stat-cell ${badgeClass(stock.optionType == "Call" ? 1 : -1)}">${
        stock.optionType
      }</td>
<td class="stat-cell">${arrow(stock.lastPrice)}${stock.lastPrice}</td>
<td class="stat-cell ${stock.pChange.toFixed(2) > 90 && "bg-warning"}
      )} ">${stock.pChange.toFixed(2) || "-"}%</td>
<td class="cell">
  <button class="btn-sm app-btn-secondary buy-button" type="button" onclick="addOrder('${encodeURIComponent(
    JSON.stringify(stock)
  )}')">BUY IT</button>
</td>

</tr>
`;
    })
    .join("");
}

function renderFNO(data, filterFn) {
  const filteredData = data.filter(filterFn); // Filter data based on the function
  const arrow = (value) =>
    value > 0
      ? `<span style="color: green;">&#9650;</span>` // Up arrow
      : `<span style="color: red;">&#9660;</span>`; // Down arrow
  const tableRows = filteredData
    .map((row) => {
      return `<tr>
            <td class="stat-cell">${row.strikePrice}</td>
            <td class="stat-cell ">${arrow(row.optionType == "Put" ? -1 : 1)}${
        row.optionType
      }</td>
            <td class="stat-cell">${row.lastPrice}</td>
            <td class="stat-cell ${
              row.pChange.toFixed(2) > 90 && "bg-warning"
            }">${row.pChange.toFixed(2)}</td>
            <td class="cell">

      <button class="btn-sm app-btn-secondary buy-button" type="button" onclick="addOrder('${encodeURIComponent(
        JSON.stringify(row)
      )}')">BUY IT</button>
</td>
          </tr>`;
    })
    .join("");

  // Return the full table HTML
  return (
    tableRows &&
    `<table class="table table-border mb-10">
          <thead>
            <tr>
              <th class="meta">Strike Price</th>
              <th class="meta">Option</th>
              <th class="meta">Premium</th>
              <th class="meta">Vol %</th>
              <th class="meta">Actions</th>
            </tr>
          </thead>
          <tbody class="mb-5">
            ${tableRows}
          </tbody>
        </table>`
  );
}

function renderStockTable(data) {
  const tableBody = document.querySelector("#stockTable tbody");

  // Ensure `openAccordions` matches the length of the data
  if (openAccordions.length !== data.length) {
    openAccordions = new Array(data.length).fill(false);
  }

  // Generate table rows
  tableBody.innerHTML = data
    .map((stock, index) => {
      const GAIN = stock.lastPrice.toFixed(2) - stock.open.toFixed(2);

      const arrow = (value) =>
        value > 0
          ? `<span style="color: green;">&#9650;</span>` // Up arrow
          : `<span style="color: red;">&#9660;</span>`; // Down arrow
      const badgeClass = (value) => (value > 0 ? "bg-success" : "bg-danger");

      // Generate the accordion row if open
      const accordionRow = openAccordions[index]
        ? `
      <tr class="accordion-row">
        <td colspan="6">
          ${renderFNO(
            stock.FNO || [],
            (_, i) => i % 2 === 0
          )} <!-- Even-indexed rows -->
        </td>
        <td colspan="6">
          ${renderFNO(
            stock.FNO || [],
            (_, i) => i % 2 !== 0
          )} <!-- Odd-indexed rows -->
        </td>
      </tr>`
        : "";

      // Generate the main row
      const mainRow = `
<tr>
  <td class="stat-cell"><a href="#">${stock.symbol}</a></td>
  <td class="stat-cell ${badgeClass(stock.lastPrice - stock.previousClose)}">${
        stock.lastPrice
      }</td>
  <td class="stat-cell ${badgeClass(stock.dayHigh - stock.yearHigh)}">${
        stock.dayHigh
      }</td>
  <td class="stat-cell ${badgeClass(stock.dayLow - stock.yearLow)}">${
        stock.dayLow
      }</td>
  <td class="stat-cell">${stock.previousClose}</td>
  <td class="stat-cell">${stock.yearHigh}</td>
  <td class="stat-cell">${stock.yearLow}</td>
  <td class="stat-cell">${arrow(GAIN)} ₹${GAIN.toFixed(2)}</td>
  <td class="stat-cell">${arrow(stock.avgInOI || 0)}${
        stock.avgInOI || "-"
      }%</td>
  <td class="stat-cell">${arrow(stock.pChange)}${stock.pChange || "-"}%</td>
  <td class="stat-cell">${arrow(stock.perChange30d)}${
        stock.perChange30d || "-"
      }%</td>
  <td class="stat-cell">${arrow(stock.perChange365d)}${
        stock.perChange365d || "-"
      }%</td>
  <td class="expandable">
    <span class="accordion-toggle" data-index="${index}">
      ${stock.FNO?.length || 0}
    </span>
  </td>
</tr>`;

      return mainRow + accordionRow;
    })
    .join("");

  // Add event listeners for accordion toggles
  document.querySelectorAll(".accordion-toggle").forEach((toggle) => {
    toggle.addEventListener("click", (e) => {
      const index = e.target.dataset.index;
      openAccordions[index] = !openAccordions[index]; // Toggle accordion state
      console.log("-", openAccordions);
      renderStockTable(data); // Re-render table with updated state
    });
  });
}

async function addOrder(data) {
  const value = JSON.parse(decodeURIComponent(data));
  const { optionType, lastPrice, strikePrice, underlying } = value;
  const newOrder = {
    order: "",
    stick: `${underlying}-${strikePrice}-${optionType}`,
    date: "",
    total: lastPrice,
    gain: "",
    status: "Executed",
    buyValue: lastPrice,
    currentValue: "",
  };

  // Send POST request to add a new order
  const response = await fetch("http://localhost:4000/addOrder", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(newOrder),
  });

  const result = await response.json();
  alert(result.message);

  form.reset(); // Clear the form
}

async function orderValues() {
  // Send POST request to add a new order
  const totalInvestElement = document.getElementById("totalInvest");
  const inOrderElement = document.getElementById("inOrder");

  const response = await fetch("http://localhost:4000/orderValues", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(),
  });
  console.log("response", response.ok);
  if (response.ok) {
    let result = await response.json();
    let orders = result.data[0];
    inOrderElement.textContent = `${orders?.inOrders}`;
    totalInvestElement.textContent = `₹${orders?.totalInvest?.toFixed(2)}`;

    stockLists = orders?.stocks;
    console.log("result", orders);
  } else {
    // Display error message from the server
    const error = await response.text();
    alert("Error: " + error);
  }
}

async function totalGain(gain) {
  const totalGainElement = document.getElementById("totalGain");
  totalGainElement.textContent = `₹${gain.toFixed(2)}`;
}
