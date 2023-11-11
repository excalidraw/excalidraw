# launch excalidraw with dynamic envs
# author: @alswl
# usage:
#
# 1. modify nodejs process.env in src first
# gsed -i 's/process.env/window._env_/g' $(grep 'process.env' -R -l src)
# yarn build:app:docker
#
# 2. using env
# export REACT_APP_BACKEND_V2_GET_URL=http://127.0.0.1:3000/api/v2/
# export REACT_APP_BACKEND_V2_POST_URL=http://127.0.0.1:3000/api/v2/post/
# export REACT_APP_LIBRARY_URL=https://libraries.excalidraw.com
# export REACT_APP_LIBRARY_BACKEND=https://us-central1-excalidraw-room-persistence.cloudfunctions.net/libraries
# export REACT_APP_PORTAL_URL=https://portal.excalidraw.com
# export REACT_APP_WS_SERVER_URL="http://127.0.0.1"
# export REACT_APP_FIREBASE_CONFIG='{"apiKey":"AIzaSyAd15pYlMci_xIp9ko6wkEsDzAAA0Dn0RU","authDomain":"excalidraw-room-persistence.firebaseapp.com","databaseURL":"https://excalidraw-room-persistence.firebaseio.com","projectId":"excalidraw-room-persistence","storageBucket":"excalidraw-room-persistence.appspot.com","messagingSenderId":"654800341332","appId":"1:654800341332:web:4a692de832b55bd57ce0c1"}'
# export REACT_APP_GOOGLE_ANALYTICS_ID=UA-387204-13
# export REACT_APP_MATOMO_URL=https://excalidraw.matomo.cloud/
# export REACT_APP_CDN_MATOMO_TRACKER_URL=//cdn.matomo.cloud/excalidraw.matomo.cloud/matomo.js
# export REACT_APP_MATOMO_SITE_ID=1
# export REACT_APP_PLUS_APP=https://app.excalidraw.com
# alswl's fork version env
# export REACT_APP_HTTP_STORAGE_BACKEND_URL=http://127.0.0.1:8081/api/v2
# export REACT_APP_STORAGE_BACKEND=http
#
# 3. launch nginx, python launcher.py /usr/share/nginx/html


import argparse
import os
import signal
import subprocess
import sys

from bs4 import BeautifulSoup

PATCH_BY = "x-patch-by"
ALSWL_EXCALIDRAW = "alswl/excalidraw"

default_envs = {
    "NODE_ENV": "production",
    "PUBLIC_URL": "",
    "PKG_NAME": "@excalidraw/excalidraw",
    "PKG_VERSION": "0.15.0",
    "ANALYZER": "false",
    "EXAMPLE": "false",
}

embed_envs = [
    # embed
    "NODE_ENV",
    "PUBLIC_URL",
    "PKG_NAME",
    "PKG_VERSION",
    "ANALYZER",
    "EXAMPLE",
]


def get_env_or_default(name: str):
    v = os.environ.get(name, "")
    if v == "":
        v = default_envs.get(name, "")
    return v


def get_envs():
    envs = [key for key, value in os.environ.items()]
    react_apps = [key for key in envs if key.startswith("REACT_APP_")]
    return react_apps + embed_envs


def gen_dot_env(root: str):
    # gen .env in root

    with open(os.path.join(root, ".env"), "w") as f:
        for name in get_envs():
            val = get_env_or_default(name)
            f.write(f"{name}={val}\n")


def gen_env_js(root: str):
    code = "window._env_ = {"
    for name in get_envs():
        val = get_env_or_default(name)
        code += f"{name}: '{val}',"
    code += "}"

    with open(os.path.join(root, "env.js"), "w") as f:
        f.write(code)
    return code


def patch_index_html(root: str, script: str):
    with open(os.path.join(root, "index.html"), "r") as f:
        page = f.read()

    with open(os.path.join(root, "index.origin.html"), "w") as f:
        f.write(page)

    soup = BeautifulSoup(page, "html.parser")
    first = soup.find("script")
    if first is None:
        print("script not found")
        sys.exit(1)
    if first.has_attr(PATCH_BY) and first[PATCH_BY] == ALSWL_EXCALIDRAW:
        return
    new_script = soup.new_tag("script")
    new_script.string = script
    new_script[PATCH_BY] = ALSWL_EXCALIDRAW
    first.insert_before(new_script)
    with open(os.path.join(root, "index.html"), "w") as f:
        f.write(soup.prettify())


def exec_nginx():
    cmd = ["nginx", "-g", "daemon off;"]
    p = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        stdin=subprocess.PIPE,
        # cmd, stdout=subprocess.PIPE,
    )
    try:
        while True:
            readline = p.stdout.readline()
            try:
                stdout = readline.decode("utf-8").strip()

                if stdout:
                    print(stdout)
            except UnicodeDecodeError:
                pass

    except KeyboardInterrupt:
        p.send_signal(signal.SIGINT)
        p.wait()


def patch_service_worker(root):
    # search javascript in root and replace window._env_.PUBLIC_URL to real value
    # 1. search js file
    for root, dirs, files in os.walk(root):
        for file in files:
            if file.endswith(".js") or file.endswith(".js.map"):
                path = os.path.join(root, file)
                with open(path, "r") as f:
                    code = f.read()
                code = code.replace(
                    "window._env_.PUBLIC_URL", f"'{get_env_or_default('PUBLIC_URL')}'"
                )
                with open(path, "w") as f:
                    f.write(code)


def main():
    parser = argparse.ArgumentParser()
    # add position arg
    parser.add_argument("root", type=str, help="web root path")
    args = parser.parse_args()

    root = args.root
    # check exist index.html
    if not os.path.exists(os.path.join(root, "index.html")):
        print("index.html not found")
        sys.exit(1)

    # gen .env
    code = gen_env_js(root)
    patch_index_html(root, code)
    patch_service_worker(root)

    exec_nginx()


if __name__ == "__main__":
    main()
