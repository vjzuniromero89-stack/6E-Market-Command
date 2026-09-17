# 6E Market Command

Dashboard original de demostración para 6E / EURUSD. Los datos son de ejemplo; no hay conexión a cotizaciones en vivo.

## Ejecutar

Con Node.js 24 LTS y npm instalados:

```sh
npm ci
npm run dev
```

## Compilar

```sh
npm install
npm run build
npm start
```

## GitHub y Vercel

1. Descomprime el ZIP y copia su contenido en la raíz del repositorio, junto a `package.json`.
2. Incluye `package-lock.json` y la carpeta `app` al subir los archivos a GitHub.
3. En Vercel selecciona Next.js, Node.js 24.x y el directorio raíz que contiene `package.json`.
4. Usa `npm ci` para instalar y `npm run build` para compilar; conserva la salida predeterminada de Next.js.
5. Guarda los cambios en GitHub para iniciar un nuevo despliegue.

## Actualización de dependencias

- Original: commit 60251109b99b338dc7b353bdf6425ea446fcbf32.
- Next.js: 15.5.3 → 15.5.25.
- React y React DOM: 19.1.1 → 19.1.9.
- Se genera package-lock.json para instalaciones reproducibles.
- Los archivos de app, estilos, contenido y lógica permanecen intactos.
- Aviso oficial de seguridad: https://nextjs.org/blog/august-2026-security-release

El ZIP incluye el código fuente completo. Las dependencias y la compilación se generan al instalar y desplegar; no se incluyen node_modules, .next ni el historial .git.

Verificación: npm install y npm run build completados correctamente. Auditoría npm: 0 vulnerabilidades conocidas al 17 de septiembre de 2026. Se fija PostCSS 8.5.28 mediante overrides para corregir avisos de seguridad de la dependencia interna de Next.js.

