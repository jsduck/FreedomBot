FROM node:20-bookworm-slim

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

# Install Chromium and required system dependencies for Playwright runtime.
RUN npx playwright install --with-deps chromium

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
