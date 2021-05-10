# deploy.sh
#!/bin/bash

npm run build 
aws --region us-east-2 --profile eb-cli s3 sync ./build s3://excalidraw-client --delete
aws s3 cp s3://excalidraw-client s3://excalidraw-client/ --recursive --metadata-directive REPLACE  --exclude '*' --include '*.css' --cache-control max-age=86400 --content-type text/css
aws s3 cp s3://excalidraw-client/ s3://excalidraw-client/ --recursive --metadata-directive REPLACE  --exclude '*' --include '*.js' --cache-control max-age=86400
aws s3 cp s3://excalidraw-client/ s3://excalidraw-client/ --recursive --metadata-directive REPLACE  --exclude '*' --include "*.jpg" --include "*.svg" --include "*.png" --cache-control max-age=86400
aws configure set preview.cloudfront true && aws cloudfront create-invalidation --distribution-id E22D3XFV0JO623 --paths '/*'
