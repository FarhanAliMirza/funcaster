FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV HTTP=1 NO_OPEN=1 PORT=8080
EXPOSE 8080
USER node
CMD ["node","server.js"]
