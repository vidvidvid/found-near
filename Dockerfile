FROM node:24-alpine
WORKDIR /app
RUN apk add --no-cache su-exec
COPY --chown=node:node server.mjs recoveries.mjs leaderboard-api.mjs dormancy-api.mjs scan-api.mjs ./
COPY --chown=node:node dist ./dist
COPY docker-entrypoint.sh /usr/local/bin/found-entrypoint
RUN chmod +x /usr/local/bin/found-entrypoint
ENV RECOVERY_DB=/data/recoveries.sqlite
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["found-entrypoint"]
CMD ["node", "server.mjs"]
