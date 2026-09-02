FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
# Dummy URLs satisfy schema env() during image build. Railway injects real values at runtime.
RUN DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public" \
    DIRECT_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public" \
    npx prisma generate && npm run build

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci && \
    DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public" \
    DIRECT_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public" \
    npx prisma generate
COPY --from=build /app/dist ./dist
COPY scripts/docker-start.sh ./scripts/docker-start.sh
RUN chmod +x ./scripts/docker-start.sh
ENV NODE_ENV=production
EXPOSE 5000
CMD ["./scripts/docker-start.sh"]
