FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl bash

COPY package*.json ./
COPY prisma ./prisma
RUN npm install --no-audit --no-fund
RUN npx prisma generate

COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN npm run build

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
