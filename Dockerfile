FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
WORKDIR /app
COPY --chown=node:node backend ./backend
COPY --chown=node:node frontend ./frontend
COPY --chown=node:node database ./database
RUN mkdir -p /app/backend/uploads/payment-slips && chown -R node:node /app/backend/uploads
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=8s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:5000/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "backend/server.js"]
