FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --production=false

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:18-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY package*.json ./
RUN npm install --production

COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/data

EXPOSE 3001

CMD ["node", "dist/app.js"]
