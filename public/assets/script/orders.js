document.addEventListener("DOMContentLoaded", function () {
  const navTabs = document.querySelectorAll("#orders-table-tab .nav-link");

  navTabs.forEach((tab) => {
    tab.addEventListener("shown.bs.tab", function (event) {
      // Get the ID of the currently selected tab
      const selectedTabId = event.target.getAttribute("href").substring(1); // e.g., 'orders-all'

      // Render data for the selected tab
      renderDataForTab(selectedTabId);
    });
  });

  // Function to render data
  function renderDataForTab(tabId) {
    const tabContent = document.getElementById(tabId);

    // Clear existing content
    tabContent.innerHTML = `
          <div class="app-card app-card-orders-table shadow-sm mb-5">
              <div class="app-card-body">
                  <div class="table-responsive">
                      <table class="table table-border mb-0 " id="${tabId}-table">
                          <thead>
                              <tr>
                                  <th class="meta">id</th>
                                  <th class="meta">OrderID</th>
                                  <th class="meta">Stick</th>
                                  <th class="meta">Date</th>
                                  <th class="meta">Total</th>
                                  <th class="meta">Gain</th>
                                  <th class="meta">Status</th>

                              </tr>
                          </thead>
                          <tbody></tbody>
                      </table>
                  </div>
              </div>
          </div>
      `;

    // Fetch or simulate data
    setTimeout(async () => {
      const data = await getDataForTab(tabId);

      // Populate table rows
      const tableBody = tabContent.querySelector("tbody");
      tableBody.innerHTML = data
        .map((row, index) => {
          const Gain = row.currentValue - row.buyValue;
          const arrow =
            Gain > 0
              ? `<span style="color: green;">&#9650;</span>` // Up arrow
              : `<span style="color: red;">&#9660;</span>`; // Down arrow

          // Assign badge class based on status
          const badgeClass =
            row.status === "Executed"
              ? "bg-success"
              : row.status === "Pending"
              ? "bg-warning"
              : "bg-danger";

          return `
              <tr>
                  <td class="stat-cell">${index + 1}</td>
                  <td class="stat-cell">#${row.order}</td>
                  <td class="stat-cell"><span class="truncate badge ${
                    row.stick.includes("Put") ? "bg-warning" : "bg-success"
                  }">${row.stick}</span></td>
                  <td class="stat-cell"><span>${row.date}</span></td>
                  <td class="stat-cell">₹${row.total}</span></td>
                  <td class="stat-cell">${arrow} ₹${Gain}</td>
                  <td class="stat-cell"><span class="truncate badge ${badgeClass}">${
            row.status
          }</span></td>

              </tr>
          `;
        })
        .join("");
    }, 1000); // Simulated delay
  }

  async function getDataForTab(tabId) {
    try {
      const response = await fetch("http://localhost:4000/orderLists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tabId }), // Send the tabId to the server
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json(); // Parse the response body as JSON
      console.log("Orders Data:", data);
      // Filter data based on the tab ID
      return data.ordersList; // Assuming the response is a direct array of orders
    } catch (err) {
      console.error("Error:", err);
      alert("Something went wrong!");
      return [];
    }
  }

  // Initial render for the default active tab
  const defaultActiveTab = document
    .querySelector("#orders-table-tab .nav-link.active")
    .getAttribute("href")
    .substring(1);
  renderDataForTab(defaultActiveTab);
});
