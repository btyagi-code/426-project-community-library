FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3002

HEALTHCHECK --interval=5s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3002/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["npm", "start"]