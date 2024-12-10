# Use a lightweight Node.js image
FROM node:20-alpine

# Set working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install only production dependencies
RUN npm install

# Copy the built Svelte files into the container
COPY . .

# Build the Svelte app
RUN npm run build

# Use a lightweight static server to serve the built app
# RUN npm install -g serve

# Expose the port on which the app will run
EXPOSE 3000

# Run the static server to serve the app
# CMD ["serve", "-s", "build", "-l", "5000"]

CMD ["node", "build"]