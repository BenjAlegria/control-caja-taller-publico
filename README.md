# Control de caja para talleres

Aplicación React para gestionar movimientos, pedidos y abonos, con exportaciones a Excel y PDF y empaquetado de escritorio con Electron.

Esta versión genérica no incluye configuración de un proyecto Firebase real, cuentas, contraseñas ni registros de clientes. Cada instalación debe conectar su propia base de datos.

## ¿Para qué sirve?

La aplicación permite gestionar los movimientos de ingresos y egresos de un taller y consultar cuánto dinero entra, cuánto sale y cuál es el balance del período.

Nació de una necesidad concreta: el cliente llevaba las cuentas en un cuaderno y sumaba todos los movimientos a mano. Revisar los registros y calcular los totales requería tiempo y podía dar lugar a errores de cálculo. La aplicación traslada ese registro a un sistema digital, mantiene los movimientos organizados y realiza las sumas automáticamente.

## Funciones principales

- Registrar ingresos y egresos con su fecha, concepto, categoría, monto y método de pago.
- Consultar el historial y buscar movimientos.
- Filtrar por período y calcular automáticamente los ingresos, los egresos y el balance neto.
- Gestionar pedidos, registrar abonos y consultar los saldos pendientes.
- Exportar los movimientos a Excel o PDF para revisarlos o compartirlos.
- Acceder con correo y contraseña mediante Firebase Authentication y almacenar los registros en Cloud Firestore.
- Usar la aplicación en el navegador o como programa de escritorio mediante Electron.

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
