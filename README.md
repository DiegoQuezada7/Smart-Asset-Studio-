# Smart Asset Studio

![Version](https://img.shields.io/badge/version-1.3.0-blue.svg) ![Electron](https://img.shields.io/badge/Electron-Desktop-orange.svg) ![AI Powered](https://img.shields.io/badge/AI-On--Device-green.svg)

**Smart Asset Studio** es una aplicación de escritorio profesional para la automatización y diseño de activos digitales. Combina la potencia de la Inteligencia Artificial para el recorte de imágenes con un estudio de diseño completo estilo "Canva", todo ejecutándose localmente en tu ordenador.

## 🚀 Características Principales

### 🧠 Eliminación de Fondo con IA (Local)

- **Procesamiento 100% Offline:** Utiliza modelos de IA avanzados (`@imgly/background-removal`) directamente en tu dispositivo. Tus imágenes nunca salen de tu ordenador.
- **Alta Precisión:** Detecta sujetos complejos como cabello y objetos finos automáticamente.

### 🎨 Editor de Máscaras (Mask Editor)

Perfecciona tus recortes con herramientas de precisión:

- **Pinceles Mágicos:** Herramientas de **Borrar** y **Restaurar** con tamaño y dureza ajustables.
- **Navegación Fluida:** Zoom inteligente y herramienta de "Mano" (Pan) para trabajar en detalles.
- **Historial Completo:** Sistema robusto de **Deshacer/Rehacer (Undo/Redo)** con botones dedicados y atajos de teclado (`Ctrl+Z` / `Ctrl+Y`).

### 🖌️ Design Studio Pro

Crea composiciones impactantes con herramientas de nivel profesional:

- **Manipulación de Imágenes en Tiempo Real:**
  - **Filtros de Color:** Ajuste de Brillo y Contraste.
  - **Efectos:** Opacidad y **Sombreado 3D (Drop Shadow)** configurable (desenfoque, distancia, color).
  - **Drag & Drop:** Arrastra imágenes directamente desde tu escritorio al lienzo.
- **Tipografía Avanzada:**
  - Añade textos profesionales.
  - Control total sobre Fuentes, Colores, Estilos (Negrita, Cursiva) y Alineación.
- **Flujo de Trabajo Inteligente:**
  - **Guías Magnéticas (Smart Snapping):** Alineación automática al centro del lienzo.
  - **Gestión de Capas:** Reordena, bloquea, oculta o elimina elementos fácilmente.
  - **Atajos Globales:** Mover con flechas, borrar con `Supr`, deshacer en cualquier momento.
  - **Presets de Redes Sociales:** Instagram Post (1080x1080), Story (1080x1920) y Full HD.

## 🛠️ Tecnologías Utilizadas

Este proyecto ha sido construido con las últimas tecnologías web y de escritorio:

- **Core:** [Next.js 16](https://nextjs.org/) (React) + TypeScript.
- **Desktop Engine:** [Electron](https://www.electronjs.org/).
- **Gráficos:** [Fabric.js v6](http://fabricjs.com/) (Canvas API optimizada).
- **AI:** `@imgly/background-removal`.
- **UI/UX:** CSS Modules + Framer Motion (Animaciones) + Lucide (Iconos).

## 📦 Instalación y Desarrollo

### Ejecutar en Desarrollo

```bash
# Instalar dependencias
npm install

# Iniciar entorno de desarrollo
npm run dev
```

### Compilar para Producción (Windows .exe)

```bash
# Generar instalador y ejecutable portable
npm run dist
```

El instalador se generará en la carpeta `/dist`.

## 🎮 Controles y Atajos

| Acción                 | Atajo / Control                                    |
| :--------------------- | :------------------------------------------------- |
| **Deshacer**           | `Ctrl + Z`                                         |
| **Rehacer**            | `Ctrl + Y`                                         |
| **Borrar Objeto**      | `Supr` o `Backspace`                               |
| **Mover Objeto**       | `Flechas del Teclado` (Shift para mayor velocidad) |
| **Zoom (Mask Editor)** | Rueda del Ratón                                    |
| **Pan (Mask Editor)**  | Espacio + Click y Arrastrar (o Herramienta Mano)   |

---

_Desarrollado con ❤️ para profesionales del diseño._
