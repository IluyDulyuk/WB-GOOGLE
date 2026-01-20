# --- ЭТАП 1: Сборка ---
FROM node:20-alpine AS builder

WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем все зависимости (включая dev для билда)
RUN npm install

# Копируем исходный код
COPY . .

# Собираем проект (создается папка dist)
RUN npm run build

# --- ЭТАП 2: Запуск ---
FROM node:20-alpine

WORKDIR /app

# Копируем только package.json и ставим только production зависимости
COPY package*.json ./
RUN npm install --only=production

# Копируем скомпилированные файлы из первого этапа
COPY --from=builder /app/dist ./dist

# Запуск приложения
CMD ["node", "dist/main"]