// Initialize the socket connection (replace with your server URL)
const socket = io("http://localhost:4000");

// Handle connection events
socket.on("connect", () => {
  console.log("Connected to the WebSocket server");
});

socket.on("updateOptionCalls", (data, timestamp) => {
  console.log("updateOptionCalls", data.length);
  /* DISPLAY TOP 5 HIGH % VOL DATA */
  renderIndexCallsTable(data, timestamp);
});

socket.on("updateOptionPuts", (data, timestamp) => {
  console.log("updateOptionPuts", data.length);
  /* DISPLAY TOP 5 HIGH % VOL DATA */
  renderIndexPutsTable(data, timestamp);
});

socket.on("updateData", (data) => {
  console.log("updateData", data.length);
  /* DISPLAY TOP 5 HIGH % VOL DATA */
  renderStockTable(data);
});
socket.on("totalGain", (data) => {
  /* DISPLAY TOTAL GAIN */
  totalGain(data);
});

socket.on("disconnect", () => {
  console.log("Disconnected from the WebSocket server");
});

// Export the socket instance and functions
export { socket };

// <script type="module">
//     import { socket, sendMessage } from './socket.js';

//     // Example: Send a message when a button is clicked
//     document.querySelector('#sendButton').addEventListener('click', () => {
//         sendMessage('customEvent', { key: 'value' });
//     });

//     // Example: Listen for socket updates
//     socket.on('customUpdate', (data) => {
//         console.log('Custom update received:', data);
//     });
// </script>
