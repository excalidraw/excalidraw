#!/bin/sh
# This script injects runtime environment variables into the React app

echo "window.EXCALIDRAW_ENV = {" > /usr/share/nginx/html/env-config.js

# Find environment variables starting with VITE_ and write them into env-config.js
env | grep -E '^VITE_' | while read -r line; do
  # Split the line at the first equals sign
  key=$(echo "$line" | cut -d '=' -f 1)
  value=$(echo "$line" | cut -d '=' -f 2-)
  
  # Escape backslashes and double quotes in the value to make it a valid JSON string
  escaped_value=$(echo "$value" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g')
  
  echo "  \"$key\": \"$escaped_value\"," >> /usr/share/nginx/html/env-config.js
done

echo "};" >> /usr/share/nginx/html/env-config.js
