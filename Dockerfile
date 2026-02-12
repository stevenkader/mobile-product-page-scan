FROM mcr.microsoft.com/playwright:v1.41.2-jammy

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application files
COPY . .

# Create scans directory
RUN mkdir -p public/scans

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "server.js"]
