# excalidraw-clases (fork para tutorías)

Fork de [excalidraw/excalidraw](https://github.com/excalidraw/excalidraw) con una
función extra: **Importar PDF** (menú hamburguesa → *Importar PDF*). Cada página
se renderiza a imagen y se coloca en el canvas, lista para rayar encima con el
estudiante.

La colaboración en vivo usa los servidores oficiales de Excalidraw (cifrado de
extremo a extremo intacto): no hay que configurar nada.

## Desarrollo local

```bash
yarn install
yarn start   # http://localhost:3000
```

## Deploy en Vercel (5 pasos)

1. En Vercel → *Add New Project* → importa `excalidraw-clases`.
2. Framework: **Vite** (autodetectado). No cambies build/output (`vercel.json`
   ya define `outputDirectory: excalidraw-app/build`).
3. Variables de entorno: ninguna obligatoria para uso básico. La colaboración
   apunta por defecto a los servidores oficiales.
4. Deploy.
5. Verifica: abre la URL, menú → *Importar PDF* (prueba con un PDF de 5 y de
   20 páginas), e inicia una sesión *Live collaboration* en dos navegadores.

## Notas

- Límite de importación: 50 MB y 30 primeras páginas por PDF.
- `pdfjs-dist` se carga de forma perezosa (solo al importar), no afecta la
  carga inicial.
- Rama de la función: `feature/pdf-import`.
