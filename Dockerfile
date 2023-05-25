FROM node:16-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

COPY . .

ENV PORT=3000

EXPOSE $PORT

CMD ["npm", "start"]
