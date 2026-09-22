# --- Этап 1: сборка ---
FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Этап 2: preview-сервер Vite ---
FROM node:20-alpine

WORKDIR /app

# Устанавливаем ВСЕ зависимости (включая dev), чтобы vite был доступен
COPY package*.json ./
RUN npm ci

# Копируем собранную статику
COPY --from=build /app/dist ./dist

EXPOSE 4173

CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "4173"]
