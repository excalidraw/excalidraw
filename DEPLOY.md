# deploy文档
## build docker and run in ecs
###
```
docker login --username=tb_huan9huan registry.cn-qingdao.aliyuncs.com
docker login --username=tb_huan9huan registry-vpc.cn-qingdao.aliyuncs.com
```

----
## draw site
### build and push
version=0.3
```
docker build . -t draw-site:${version}
docker run -it --rm -p 3000:80 draw-site:${version}

imageid=draw-site:${version}
docker tag ${imageid} registry.cn-qingdao.aliyuncs.com/datalet/${imageid}
docker push registry.cn-qingdao.aliyuncs.com/datalet/${imageid}
```
### run in remote
```
image=draw-site:${version}
port=3000
image_url=registry-vpc.cn-qingdao.aliyuncs.com/datalet/${image}
name=draw-site-${port}
docker pull ${image_url}
docker stop ${name}
docker run -d --rm --name ${name} -p ${port}:80 ${image_url}
docker run -it --rm --name ${name} -p ${port}:80 ${image_url} /bin/sh
```
----
### room deploy
```

docker build . -t draw-room:${version}
docker run -it --rm -p 3001:80 draw-room:${version}

imageid=draw-room:${version}
docker tag ${imageid} registry.cn-qingdao.aliyuncs.com/datalet/${imageid}
docker push registry.cn-qingdao.aliyuncs.com/datalet/${imageid}
```
### run room server
```
port=3001
image=draw-room:${version}
image_url=registry-vpc.cn-qingdao.aliyuncs.com/datalet/${image}
name=draw-room-${port}
docker pull ${image_url}

docker run -d --name ${name} --rm -p ${port}:80 ${image_url}
docker run -it --rm --name ${name} -p ${port}:80 ${image_url} /bin/sh

```
------
### dns
```
A 47.104.205.44 draw.cvhex.cn
```
### nginx config
```
cat /etc/nginx/conf.d/draw.conf
upstream draw-site {
  server 127.0.0.1:3000;
}
upstream draw-room {
  server 127.0.0.1:3001;
}
server {
   listen 80;
   server_name draw.cvhex.com;

   access_log  /logs/draw/access.log;

   location / {
       proxy_pass http://draw-site;
   }
   location /socket.io/ {
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header Host $http_host;
      proxy_set_header X-NginX-Proxy false;
       proxy_pass http://draw-room;
      proxy_redirect off;

      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
   }
}
```

## verify
http://draw.cvhex.com/#room=91bd46ae3aa84dff9d21,pfLqgEoY1c2ioq8LmGwsFa

tail -f /logs/draw/access.log
