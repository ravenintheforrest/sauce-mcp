# Sauce recipe MCP — hosted HTTP server (Streamable HTTP) for the cloud connector.
FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

ENV PORT=8788
EXPOSE 8788
CMD ["node", "dist/http.js"]
