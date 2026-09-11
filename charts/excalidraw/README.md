Original taken from:
https://github.com/johanneskastl/excalidraw-helm-chart/

# excalidraw

Virtual whiteboard for sketching hand-drawn like diagrams

## TL;DR
```console
$ helm repo add excalidraw https://excalidraw.github.io/excalidraw-helm-chart/
$ helm repo update
$ helm install excalidraw excalidraw/excalidraw
```

## Installing the Chart
To install the chart with the release name `excalidraw`:
```console
helm install excalidraw excalidraw/excalidraw
```

## Uninstalling the Chart
To uninstall the `excalidraw` deployment:
```console
helm uninstall excalidraw
```
The command removes all the Kubernetes components associated with the chart and deletes the release.

## Configuration

Read through the [values.yaml](./values.yaml) file. It has several commented out suggested values.

YAML file that specifies the values for the above parameters can be provided while installing the chart.
For example,
```console
helm install excalidraw excalidraw/excalidraw -f values.yaml
```

