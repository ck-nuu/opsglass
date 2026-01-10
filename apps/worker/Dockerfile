FROM node:20-slim AS builder
WORKDIR /app

# Enable corepack for pnpm/npm version management if needed, though we use npm here
ENV NPM_CONFIG_LOGLEVEL=warn

# Copy entire monorepo
COPY . .

# Install dependencies
RUN npm install

# Build the worker (and dependencies)
# We use turbo to build only the worker and its deps
RUN npm run build -w apps/worker

# Production runner
FROM node:20-slim AS runner
WORKDIR /app

# Copy necessary files from builder
# Note: For a perfect production build we'd use 'turbo prune', but for simplicity 
# we'll copy the built artifacts and node_modules. 
# A more optimized approach would be to install only production deps.
COPY --from=builder /app ./

WORKDIR /app/apps/worker

# Start the worker
CMD ["npm", "run", "start"]
