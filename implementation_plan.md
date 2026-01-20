# Plan de Implementación: Smart Asset Studio

## 1. Visión del Producto

Una aplicación web premium para vendedores de e-commerce y creadores.
**Propuesta de Valor**: Convierte fotos de producto "amateur" en activos listos para vender en segundos (Upscale + Fondo Limpio + SEO).

## 2. Pila Tecnológica

- **Framework Web**: Next.js (React) - Para una aplicación rápida, escalable y moderna.
- **Estilos**: Vanilla CSS moderno (CSS Modules/Variables) - Diseño "Premium", Glassmorphism, animaciones fluidas.
- **Procesamiento de Imágenes**:
  - Inicialmente usaremos bibliotecas de Javascript (como `browser-image-compression` o `remove.bg` API wrappers) para prototipar.
  - Potencialmente un backend Python más adelante si necesitamos potencia local.
- **Almacenamiento Local**: `IndexedDB` o Estado local para privacidad (el usuario no sube sus fotos a la nube a menos que sea necesario).

## 3. Hoja de Ruta (Roadmap)

### Fase 1: Cimientos y Diseño (Día 1)

- [x] Inicializar proyecto Next.js.
- [x] Configurar Variables CSS Globales (Paleta de colores premium, tipografías).
- [x] Crear Layout principal (Sidebar, Header, Main Canvas).

### Fase 2: El "Workbench" (Área de Trabajo)

- [x] Componente **Drag & Drop** inmersivo para subir múltiples imágenes.
- [x] **Grid de Galería**: Vista previa elegante de las fotos cargadas.
- [x] **Visor de Resultados**: Lista comparativa/grid de imágenes procesadas.

### Fase 3: Motores de Procesamiento

- [x] Implementar **Remoción de Fondo** (Integración Local con @imgly/background-removal).
- [x] Implementar función de **Upscaling** (Realizado con UpscalerJS y Tensorflow.js, opcional en UI).
- [x] Editor de Metadatos (Renombrado masivo para SEO e individual).

### Fase 4: Exportación y Pulido

- [x] Botón de "Exportar Todo" (Generación ZIP con JSZip).
- [x] Configuración Avanzada de Exportación (Formatos WEBP/JPEG/PNG y Calidad).
- [x] Animaciones de carga y transiciones de "wow factor".

## 4. Estética de Diseño (Guía Visual)

- **Tema**: Oscuro/Cyberpunk limpio o "Studio Clean" (Blanco/Gris/Acento neón).
- **Tipografía**: 'Inter' o 'Outfit' (Google Fonts).
- **Detalles**: Bordes sutiles, sombras difuminadas, feedback háptico visual (iluminación al hacer hover).
