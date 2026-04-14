FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY . .
RUN npm run build

ENV TRANSPORT=stdio
ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
