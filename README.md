# Control de caja para talleres

Aplicación React para gestionar movimientos, pedidos y abonos, con exportaciones a Excel y PDF y empaquetado de escritorio con Electron.

Esta versión genérica no incluye configuración de un proyecto Firebase real, cuentas, contraseñas ni registros de clientes. Cada instalación debe conectar su propia base de datos.

## Instalación

1. Instala Node.js 22.12 o posterior compatible con Vite 8.
2. Ejecuta `npm ci` en esta carpeta.
3. Crea tu propio proyecto Firebase y registra una aplicación web.
4. Copia `.env.example` a `.env.local` y completa los valores con la configuración de tu aplicación Firebase.
5. Habilita Authentication con correo y contraseña. Crea los usuarios autorizados desde la consola de Firebase.
6. Crea Cloud Firestore y establece reglas que permitan acceder a `movimientos` y `pedidos` únicamente a los usuarios autorizados de tu instalación. No habilites acceso público. Esta aplicación no configura ni publica reglas automáticamente.
7. Ejecuta `npm run dev`.

## Comandos

- `npm run build`: compila la aplicación web.
- `npm run lint`: revisa el código.
- `npm run electron:start`: compila y abre la aplicación de escritorio.
- `npm run electron:build`: genera el instalador en `dist_electron`.

## Personalización

Modifica `src/App.jsx` para cambiar textos, categorías y apariencia. Ajusta `package.json` para personalizar el nombre y el identificador del instalador.

## Configuración privada

Nunca subas `.env.local`, claves de cuentas de servicio, contraseñas, exportaciones ni respaldos. Los archivos de configuración locales y los resultados de compilación están excluidos de Git.

Las variables `VITE_` se incorporan al código compilado y son visibles para quien ejecute la aplicación. Solo deben contener configuración del cliente Firebase, nunca credenciales de administrador. La protección de los datos depende de Authentication y las reglas de Firestore.
