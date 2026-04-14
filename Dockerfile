FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build
RUN npm prune --omit=dev

ENV TRANSPORT=stdio
ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
