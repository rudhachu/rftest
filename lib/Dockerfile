FROM quay.io/princerudh/rudhra:latest
WORKDIR /rudhra
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["pm2-runtime", "ecosystem.config.js"]
