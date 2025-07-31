Original taken from:
https://github.com/johanneskastl/excalidraw-helm-chart/

# excalidraw

![Version: 0.6.0](https://img.shields.io/badge/Version-0.6.0-informational?style=flat-square)

Virtual whiteboard for sketching hand-drawn like diagrams

## TL;DR
```console
$ helm repo add johanneskastl-excalidraw https://johanneskastl.github.io/excalidraw-helm-chart/
$ helm repo update
$ helm install excalidraw johanneskastl-excalidraw/excalidraw
```

## Installing the Chart
To install the chart with the release name `excalidraw`:
```console
helm install excalidraw johanneskastl-excalidraw/excalidraw
```

## Uninstalling the Chart
To uninstall the `excalidraw` deployment:
```console
helm uninstall excalidraw
```
The command removes all the Kubernetes components associated with the chart and deletes the release.

## Configuration

Read through the [values.yaml](./values.yaml) file. It has several commented out suggested values.

Specify each parameter using the `--set key=value[,key=value]` argument to `helm install`. For example,
```console
helm install excalidraw \
  --set env.TZ="America/New York" \
    johanneskastl-excalidraw/excalidraw
```

Alternatively, a YAML file that specifies the values for the above parameters can be provided while installing the chart.
For example,
```console
helm install excalidraw johanneskastl-excalidraw/excalidraw -f values.yaml
```

