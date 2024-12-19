FROM node:18-alpine
WORKDIR /app
COPY . .
#RUN rm -rf node_modules
RUN npm install
RUN npm rebuild sqlite3
CMD ["npm", "run","pm2-start"]
EXPOSE 3000
