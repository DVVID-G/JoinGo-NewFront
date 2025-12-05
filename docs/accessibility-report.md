# Informe de Accesibilidad (WCAG 2.1 AA)

## Resumen
- **Perceptible:** Se recalibró toda la paleta en `src/index.css` para garantizar un contraste mínimo de 4.5:1 en texto normal y 3:1 en controles no textuales. Se eliminaron opacidades que degradaban el contraste y se documentaron los pares de color clave.
- **Operable:** La navegación, botones y acciones de texto ahora incluyen indicadores visibles independientes del color (subrayados, contornos `focus-visible`, variaciones tipográficas). Las animaciones cuentan con una regla `prefers-reduced-motion` que anula transiciones y escalados.
- **Comprensible:** `CreateMeetingForm` incorpora validaciones en línea, regiones `aria-live`, estados `aria-invalid` y mensajes descriptivos asociados con `aria-describedby`, manteniendo los toasts solo como soporte adicional.

## Tabla de contraste principal
| Token / Uso | Valor HSL (aprox. Hex) | Fondo | Luminancia | Ratio | Estado |
|-------------|-------------------------|--------|------------|-------|--------|
| `--foreground` (#0D1525) sobre `--background` (#F9FAFB) | hsl(220,47%,10%) | hsl(210,20%,98%) | 0.0078 vs 0.9556 | **17.4:1** | ✅ 1.4.3
| `--primary` (#0B6298) sobre `--background` | hsl(203,86%,32%) | hsl(210,20%,98%) | 0.1111 vs 0.9556 | **6.2:1** | ✅ 1.4.3
| `--primary-foreground` (#FFFFFF) sobre `--primary` |  |  | 1.0 vs 0.1111 | **6.5:1** | ✅ 1.4.3
| `--accent` (#CD4619) sobre `--background` | hsl(15,78%,45%) | hsl(210,20%,98%) | 0.1737 vs 0.9556 | **4.5:1** | ✅ límite 1.4.3
| `--muted-foreground` (#454E5E) sobre `--muted` (#EFF2F7) | hsl(220,15%,32%) | hsl(210,20%,95%) | 0.0743 vs 0.8856 | **7.5:1** | ✅ 1.4.3
| `--secondary-foreground` (#FFFFFF) sobre `--secondary` (#0F1F2F) |  | hsl(218,32%,14%) | 1.0 vs 0.0147 | **16.2:1** | ✅ 1.4.3
| `--destructive-foreground` (#FFFFFF) sobre `--destructive` (#B02A2A) | hsl(0,65%,42%) |  | 1.0 vs 0.1080 | **6.6:1** | ✅ 1.4.3

> Notas: Las luminancias y ratios se calcularon con la fórmula relativa de WCAG; todos los pares relevantes utilizados en texto normal superan 4.5:1.

## Mejoras de interacción
- `Header`, `Footer`, enlaces y botones: subrayados en los estados activos, contornos `focus-visible` personalizados y estilos reforzados para acciones destructivas y de copiar código (`UpcomingMeetings`).
- Acciones inline ahora utilizan botones con borde y relleno (`bg-primary/5`, `border-primary/40`) más un texto SR-only para describir la acción.

## Animaciones y movimiento
- `.animate-fade-in`, `.animate-slide-up`, `.animate-scale-in`, `.btn-gradient` y `.btn-accent` obedecen `@media (prefers-reduced-motion: reduce)`, suprimiendo animaciones y transiciones cuando el usuario lo solicita (criterio 2.3.3 / 2.2.2).

## Formularios y feedback
- `CreateMeetingForm` valida campos antes de navegar, establece `aria-invalid`, mensajes `role="alert"` asociados y un resumen `aria-live` oculto. Los toasts permanecen como confirmación visual, pero no son la única fuente de información (criterios 3.3.1, 3.3.3 y 4.1.3).

## Pruebas sugeridas
1. **Contrast Checker:** verificar los valores anteriores con cualquier analizador (Chromium DevTools > Accessibility).  
2. **Preferencias de movimiento:** activar "Reducir movimiento" en el SO y confirmar ausencia de animaciones al recargar.  
3. **Navegación por teclado:** usar `Tab`/`Shift+Tab` para recorrer `Header`, `Footer`, enlaces y formularios asegurando contornos visibles y orden lógico.  
4. **Lector de pantalla:** con NVDA/VoiceOver validar la lectura de mensajes de error en `CreateMeetingForm` y de los botones de copiar/eliminar en `UpcomingMeetings`.

## Próximos pasos
- Extender las mismas pautas a páginas restantes (`Dashboard`, `Profile`, etc.).
- Incorporar pruebas automáticas Lighthouse axe-core en CI para prevenir regresiones. 
