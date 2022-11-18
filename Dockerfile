FROM node
COPY . /app
WORKDIR /app
RUN npm install && cd node_modules/naihelper.js/ && npm run prepare
CMD node index.js