FROM node:20-alpine AS base

RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM base AS dev

COPY . .

EXPOSE 4000

CMD ["npm", "run", "dev"]

FROM base AS production

COPY . .
RUN npm run build

EXPOSE 4000

CMD ["npm", "run", "start"]
