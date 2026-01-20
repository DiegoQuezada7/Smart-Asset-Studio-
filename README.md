# Smart Asset Studio v1.0 🚀

Una suite de optimización de activos digitales de alto rendimiento, diseñada para vendedores de e-commerce, creadores y desarrolladores. Privada, local y potente.

![Smart Asset Studio](https://via.placeholder.com/800x400?text=Smart+Asset+Studio+Preview)

## ✨ Características Principales

### 🧠 Inteligencia Artificial Local

- **Eliminación de Fondo Premium**: Utiliza modelos de IA (`@imgly/background-removal`) ejecutados directamente en tu navegador. Tus fotos nunca tocan un servidor externo.
- **Upscaling 2x Inteligente**: Aumenta la resolución de tus imágenes sin perder calidad usando redes neuronales (`UpscalerJS` + `Tensorflow.js`).

### ⚡ Productividad "Batch" (Por Lotes)

- **Procesamiento Masivo**: Arrastra 50 fotos y procésalas todas de una vez.
- **Renombrado SEO**: Asigna nombres optimizados a todo un lote (ej. `nike-air-01.webp`, `nike-air-02.webp`) con un solo clic.
- **Exportación Flexible**: Descarga todo en un ZIP organizado.

### 🎨 Edición y Control

- **Comparador Deslizante**: Revisa el "Antes y Después" con un slider interactivo en cada resultado.
- **Pincel de Refinado**: ¿La IA se equivocó? Usa el editor manual para Borrar o Restaurar zonas específicas de la máscara.
- **Formatos de Salida**: Elige entre **PNG** (calidad), **WEBP** (web moderna) o **JPEG** (compacto). Control total sobre la compresión.

### 🛡️ Privacidad y Seguridad

- **100% Offline**: Funciona sin internet una vez cargada.
- **Historial Persistente**: Si cierras la pestaña por error, tus trabajos siguen ahí gracias a `IndexedDB`.
- **Datos Seguros**: Ninguna imagen sale de tu ordenador. Ideal para contenido confidencial.

## 🛠️ Tecnologías

Construido con un stack moderno y eficiente:

- **Framework**: Next.js 14 (App Router)
- **UI**: React + Framer Motion (Animaciones fluidas)
- **Estilos**: CSS Modules con diseño "Glassmorphism" oscuro.
- **Motores IA**: WebAssembly (WASM) + WebGL.

## 🚀 Cómo Iniciar

1. **Instalar dependencias**:

   ```bash
   npm install
   ```

2. **Arrancar el servidor de desarrollo**:

   ```bash
   npm run dev
   ```

3. **Abrir**: Visita `http://localhost:3000` en tu navegador.

## 📦 Construcción para Producción

### Opción A: Web Estática

Para generar una versión web optimizada:

```bash
npm run build
```

### Opción B: App de Escritorio (.exe)

Para generar el instalador de Windows:

```bash
npm run dist
```

El archivo de instalación aparecerá en la carpeta `dist/`.

---

_Desarrollado con ❤️ por Diego y Antigravity._
