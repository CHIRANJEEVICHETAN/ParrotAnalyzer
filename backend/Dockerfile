# Use Node.js 20.5.0 LTS image from the official Docker Hub
FROM node:20.5.0-alpine3.18

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the TypeScript configuration file (tsconfig.json) to the container
COPY tsconfig.json ./

# Copy all the source code into the container
COPY . .

# Compile TypeScript to JavaScript (output will be in dist/ directory)
RUN npm run build

# Copy your config folder (including ca.pem) into the built dist output
COPY src/config ./dist/src/config

# Expose port 8080 for Azure App Service
EXPOSE 8080

# Start the server
CMD ["npm", "start"]