FROM node:24-bookworm-slim
WORKDIR /app
COPY --chown=node:node package.json ./
COPY --chown=node:node backend ./backend
COPY --chown=node:node frontend ./frontend
RUN mkdir /data && chown node:node /data && chmod 700 /data
USER node
ENV NODE_ENV=production DATABASE_PATH=/data/home.sqlite
EXPOSE 3000
CMD ["node", "backend/server.mjs"]
