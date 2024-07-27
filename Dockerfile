FROM node:16

# Set the working directory for App
WORKDIR .

# Copy package.json and package-lock.json into the container
COPY package*.json ./

# Install nodemon
RUN npm install -g nodemon

# Install dependencies
RUN npm install

# Copy the current directory contents into the container at /app/server
COPY . .

# If you are building your code for production
# RUN npm ci --only=production

# Default port which container listens internally
EXPOSE 5035

CMD [ "npm", "run", "start" ]
#CMD ["npm", "--trace-warnings", "run", "start" ]
