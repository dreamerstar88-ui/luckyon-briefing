FROM apify/actor-node-playwright-chrome:20

COPY package*.json ./
RUN npm --quiet set progress=false \
 && npm install --omit=dev --no-audit --no-fund \
 && echo "Installed NPM packages:" \
 && (npm list --omit=dev --all || true)

COPY . ./

CMD ["node", "src/main.js"]
