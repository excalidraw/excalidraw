#!/bin/sh

/etc/init.d/nginx stop
# Substitute the PORT in the Nginx config template and remove comments
envsubst '$PORT' < /etc/nginx/conf.d/nginx.conf.template | grep -v '^#' > /etc/nginx/conf.d/default.conf
if [ $? -ne 0 ]; then
  echo "Error: Failed to update /etc/nginx/conf.d/default.conf. with port ${PORT}"
  exit 1
fi
/etc/init.d/nginx restart

exec "$@"
