FROM node:16

# Install Puppeteer's dependencies
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libnss3 \
    libxcomposite1 \
    libxrandr2 \
    libxdamage1 \
    libx11-xcb1 \
    libxcb-dri3-0 \
    libgbm-dev \
    libasound2

# Set the working directory inside the Docker container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port the app will run on (optional, unless you're serving a web service)
EXPOSE 4000

# Command to run your app
CMD ["node", "index.js"]
