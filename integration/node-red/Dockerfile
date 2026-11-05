FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=optional --no-audit --no-fund
COPY FrontEnd/package.json FrontEnd/package-lock.json ./FrontEnd/
RUN npm --prefix FrontEnd ci --no-audit --no-fund
COPY FrontEnd/src ./FrontEnd/src
COPY FrontEnd/tsconfig.processing.json ./FrontEnd/
RUN npm run build
COPY integration ./integration
ENV NODE_RED_HOST=0.0.0.0 NODE_RED_EDITOR=false NODE_RED_DATA_DIR=/data
RUN mkdir /data && chown -R node:node /data /app
USER node
EXPOSE 1880
CMD ["node", "integration/node-red/start.mjs"]
