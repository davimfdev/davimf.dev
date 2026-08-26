# Backend davimf-api
#
# IMPORTANTE: o contexto de build é a RAIZ DO REPOSITÓRIO, não server/.
# Os handlers continuam morando em netlify/functions/ e são compilados junto,
# sem nenhuma alteração no código-fonte deles.
#
#   docker build -f server/Dockerfile -t davimf-api .
#
# No Coolify: Base Directory = /  e  Dockerfile Location = /server/Dockerfile

# ---------------------------------------------------------------- build ----
FROM node:22-alpine AS build

WORKDIR /app/server

# Camada de dependências separada para aproveitar o cache entre builds.
COPY server/package.json server/package-lock.json ./
RUN npm ci

COPY netlify /app/netlify
COPY server/tsconfig.json ./tsconfig.json
COPY server/src ./src

RUN npm run build


# -------------------------------------------------------------- runtime ----
FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

WORKDIR /app/server

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Só o JavaScript compilado: dist/server/src/* (servidor) e
# dist/netlify/functions/* (handlers migrados).
COPY --from=build /app/server/dist ./dist

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server/src/index.js"]
