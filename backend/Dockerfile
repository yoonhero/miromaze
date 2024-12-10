FROM node:20-alpine

RUN mkdir -p /app

WORKDIR /app

COPY package*.json /app/

RUN npm install

COPY src/*.js /app/src/

EXPOSE 3000
CMD ["node", "./src/index.js"]