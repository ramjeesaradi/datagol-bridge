# Specify the base Docker image. You can read more about
# the available images at https://docs.apify.com/sdk/js/docs/guides/docker-images
# You can also use any other image from Docker Hub.
FROM apify/actor-node:22

# Copy package.json and package-lock.json to leverage Docker layer caching.
COPY package*.json ./

# Install production dependencies.
RUN npm install --omit=dev --omit=optional && rm -rf ~/.npm

# Copy the rest of the source code.
# This step is separate from the npm install to ensure that changes to
# source code don't invalidate the dependency cache.
COPY . ./


# Create and run as a non-root user.
RUN adduser -h /home/apify -D apify && \
    chown -R apify:apify ./
USER apify

# Run the image.
CMD npm start --silent