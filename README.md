# Panel Combustible

MyGeotab Add-In inicial para visualizar datos del motor relacionados con combustible por vehículo seleccionado.

Este proyecto está preparado para publicarse como sitio estático en GitHub Pages.

## Archivos

```text
mygeotab-fuel-addin/
├── index.html
├── main.js
├── styles.css
├── configuration.json
└── README.md
```

## URL de GitHub Pages

Cuando GitHub Pages esté activo desde `main` y `/root`, la URL esperada será:

```text
https://islenurd-lang.github.io/mygeotab-fuel-addin/index.html
```

El `configuration.json` usa la URL con versión:

```text
https://islenurd-lang.github.io/mygeotab-fuel-addin/index.html?v=1.0.4
```

## Activar GitHub Pages

1. Abre el repositorio en GitHub.
2. Ve a `Settings > Pages`.
3. En `Build and deployment`, selecciona `Deploy from a branch`.
4. Selecciona branch `main`.
5. Selecciona carpeta `/root`.
6. Guarda los cambios.

## Instalar en MyGeotab

1. Entra a MyGeotab.
2. Ve a `Administration > System > System Settings > Add-Ins`.
3. Agrega un nuevo Add-In.
4. Pega el contenido de `configuration.json`.
5. Guarda los cambios.
6. Recarga MyGeotab.
7. Abre `Panel Combustible` desde la sección de mantenimiento de motor.

## Validación

Abre DevTools y revisa la consola. Debes ver logs temporales como:

```text
[Panel Combustible] initialize ejecutado
[Panel Combustible] focus ejecutado
[Panel Combustible] blur ejecutado
```

Si abres `index.html` fuera de MyGeotab, la página no debe fallar. Mostrará un mensaje indicando que debe abrirse dentro de MyGeotab para usar el SDK.

## Notas técnicas

- JavaScript vanilla.
- Sin backend.
- Sin credenciales.
- Sin API keys.
- Sin frameworks.
- Sin llamadas HTTP externas.
- Usa el namespace `geotab.addin.panelCombustible`.
- Implementa carga de vehículos, multiselección con búsqueda, carga filtrada de diagnósticos de combustible y consulta combinada de `StatusData` mediante `api.call(...)`.
