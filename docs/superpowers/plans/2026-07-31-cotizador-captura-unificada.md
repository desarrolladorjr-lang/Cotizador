# Captura unificada del Cotizador — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar las 4 pestañas y los toggles anidados del cotizador por una sola pantalla con un único eje `modalidad`, sin cambiar el payload que llega a Google Sheets.

**Architecture:** La lógica pura (motor de cálculo y armado del payload) sale de `deploy/js/app.js` a dos módulos con pruebas: `deploy/js/calc.js` y `deploy/js/payload.js`. La UI se parte en un bloque de compra y tres bloques de venta, cada uno en su archivo. `app.js` queda como shell: login, estado raíz y orquestación.

**Tech Stack:** React 18 UMD + Babel standalone en el navegador (sin build step), Tailwind por CDN, Vitest en Node para los módulos puros.

**Spec:** `docs/superpowers/specs/2026-07-31-cotizador-captura-unificada-design.md`

## Global Constraints

- Sin build step. Todo archivo con JSX entra como `<script type="text/babel" src="...">` en `deploy/index.html`. Archivos sin JSX entran como `<script src="...">` normal.
- Todos los `src` de `deploy/index.html` llevan el mismo parámetro de cache busting. El valor actual es `?v=20260730b`; al terminar el plan se sube a `?v=20260731a` en **todos** los scripts.
- El payload enviado a `GOOGLE_SCRIPT_URL` conserva nombres, tipos y significado de todos sus campos. No se toca `Codigo.gs`, ni columnas de la hoja, ni el dashboard.
- Acento naranja `#ff6600` para Terrestre/Marítimo/Nacional; verde `#16a34a` para Inventario.
- Constantes del motor, verbatim: `tasaRiesgoAnual = 0.15`, `margenExtra = 0.10`, `truncar = n => Math.trunc(n * 100) / 100`.
- Capacidad por carga: terrestre `19500`, marítimo `capacidadCNT * 1000`, nacional e inventario `24500`. El flete nacional siempre se divide entre `24500` (es tarifa por carga), sin importar la modalidad.
- Defaults internos no capturados en el formulario: `aduanaMex = "2308"`, `aduanaUsa = "65"`, `maniobras = "0.60"`, `merma = "0"`, `diasCobro = "0"`.
- Los módulos puros (`calc.js`, `payload.js`) exportan con el patrón dual: `module.exports` si existe `module`, si no asignan a `globalThis`. Así el navegador los usa como globales y Vitest los carga con `createRequire`.

## Decisión que el spec dejó abierta

Hoy conviven dos fórmulas para el ingreso nacional:

- pestaña Nacional: `precioMxnNacional / 24500` — el precio es **por carga**.
- rama `compras/intencionVenta/nacional`: `ivNacPrecioTotal / (comprasTotalCargas * 24500)` — el precio es **del embarque completo**.

El modelo unificado usa multi-proveedor, así que adopta la segunda: **"Precio Total MXN" es el total del embarque**, dividido entre `cargasTotales * 24500`. Con una sola carga el resultado es idéntico al de hoy.

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `package.json` (raíz, nuevo) | Devdependency de Vitest y script `test` |
| `vitest.config.js` (raíz, nuevo) | Incluye `deploy/js/**/*.test.js`, entorno node |
| `deploy/js/calc.js` (nuevo) | `KG_POR_CARGA`, `calcularCotizacion()`. Sin React, sin DOM |
| `deploy/js/calc.test.js` (nuevo) | Pruebas del motor |
| `deploy/js/payload.js` (nuevo) | `construirPayload()`. Sin React, sin DOM |
| `deploy/js/payload.test.js` (nuevo) | Pruebas del mapeo |
| `deploy/js/blocks/Compra.js` (nuevo) | `<BloqueCompra>` — único bloque de compra |
| `deploy/js/blocks/VentaNacional.js` (nuevo) | `<VentaNacional>` |
| `deploy/js/blocks/VentaTerrestre.js` (nuevo) | `<VentaTerrestre>` |
| `deploy/js/blocks/VentaMaritimo.js` (nuevo) | `<Celda>`, `<DesgloseMaritimo>`, `<VentaMaritimo>` |
| `deploy/js/app.js` (modificar) | Shell: login, `modalidad`, orquestación, guardado |
| `deploy/index.html` (modificar) | Carga de los scripts nuevos |

---

### Task 1: Motor de cálculo aislado y probado

Extrae el `useEffect` matemático de `app.js:486-554` a una función pura, con las pruebas que fijan los números actuales. Nada de la UI cambia todavía.

**Files:**
- Create: `package.json`
- Create: `vitest.config.js`
- Create: `deploy/js/calc.js`
- Test: `deploy/js/calc.test.js`

**Interfaces:**
- Consumes: nada.
- Produces:
  ```js
  KG_POR_CARGA = { terrestre: 19500, nacional: 24500, inventario: 24500 }
  // marítimo no está en el mapa: depende de capacidadCNT

  calcularCotizacion({
    modalidad,          // 'terrestre' | 'maritimo' | 'nacional' | 'inventario'
    porcentajeFijacion, // string | number
    fixPrice,           // string | number
    tcHoy,              // string | number
    diasCobro,          // string | number
    fleteNac,           // string | number
    cruceInt,           // string | number
    aduanaMex,          // string | number
    aduanaUsa,          // string | number
    merma,              // string | number   (porcentaje, 5 = 5%)
    maniobras,          // string | number
    ppProv,             // string | number   (MXN x KG)
    capacidadCNT,       // number (TON)
    precioTotalMxn,     // string | number   (sólo nacional)
    cargasTotales       // number
  }) => ({
    tcSeguro,          // number
    capKg,             // number
    precioVenta,       // number, 5 decimales
    precioTopeCompra,  // number
    utilidadNeta,      // number
    utilidadPorKg,     // number
    status             // 'good' | 'warning' | 'bad' | ''
  })
  ```

- [ ] **Step 1: Crear el harness de pruebas**

`package.json` en la raíz del repo:

```json
{
  "name": "cotizador",
  "private": true,
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "^1.6.0"
  }
}
```

`vitest.config.js` en la raíz:

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['deploy/js/**/*.test.js'],
  },
});
```

Instalar:

```bash
npm install
```

- [ ] **Step 2: Escribir la prueba que falla**

`deploy/js/calc.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { calcularCotizacion, KG_POR_CARGA } = require('./calc.js');

const base = {
  porcentajeFijacion: '100',
  fixPrice: '1000',
  tcHoy: '17',
  diasCobro: '30',
  fleteNac: '0',
  cruceInt: '0',
  aduanaMex: '2308',
  aduanaUsa: '65',
  merma: '0',
  maniobras: '0.60',
  ppProv: '0',
  capacidadCNT: 20,
  precioTotalMxn: '0',
  cargasTotales: 1,
};

describe('KG_POR_CARGA', () => {
  it('fija la capacidad por modalidad', () => {
    expect(KG_POR_CARGA.terrestre).toBe(19500);
    expect(KG_POR_CARGA.nacional).toBe(24500);
    expect(KG_POR_CARGA.inventario).toBe(24500);
  });
});

describe('calcularCotizacion — terrestre', () => {
  const r = calcularCotizacion({
    ...base, modalidad: 'terrestre', fleteNac: '39000', cruceInt: '1000', ppProv: '10',
  });

  it('descuenta el colchon de riesgo del tipo de cambio', () => {
    expect(r.tcSeguro).toBeCloseTo(16.6904, 4);
  });

  it('usa 19500 kg por carga', () => {
    expect(r.capKg).toBe(19500);
  });

  it('deriva el precio de venta de fijacion y fix price', () => {
    expect(r.precioVenta).toBe(1);
  });

  it('calcula el tope maximo de compra', () => {
    expect(r.precioTopeCompra).toBeCloseTo(13.4687, 4);
  });

  it('trunca la utilidad por kg a dos decimales', () => {
    expect(r.utilidadPorKg).toBe(3.46);
    expect(r.utilidadNeta).toBeCloseTo(67470, 2);
  });
});

describe('calcularCotizacion — semaforo', () => {
  const conPp = pp => calcularCotizacion({
    ...base, modalidad: 'terrestre', fleteNac: '39000', cruceInt: '1000', ppProv: pp,
  }).status;

  it('marca perdida arriba del tope', () => {
    expect(conPp('13.6')).toBe('bad');
  });

  it('marca riesgo en los ultimos 50 centavos', () => {
    expect(conPp('13.2')).toBe('warning');
  });

  it('marca aprobado con holgura', () => {
    expect(conPp('12')).toBe('good');
  });
});

describe('calcularCotizacion — merma', () => {
  it('reduce el tope por el porcentaje de merma', () => {
    const r = calcularCotizacion({
      ...base, modalidad: 'terrestre', fleteNac: '39000', cruceInt: '1000', merma: '5',
    });
    expect(r.precioTopeCompra).toBeCloseTo(12.7952, 4);
  });
});

describe('calcularCotizacion — maritimo', () => {
  const r = calcularCotizacion({
    ...base, modalidad: 'maritimo', cruceInt: '2000', capacidadCNT: 20,
  });

  it('toma la capacidad del contenedor en kg', () => {
    expect(r.capKg).toBe(20000);
  });

  it('calcula el tope con la capacidad del contenedor', () => {
    expect(r.precioTopeCompra).toBeCloseTo(14.2517, 4);
  });
});

describe('calcularCotizacion — nacional', () => {
  const r = calcularCotizacion({
    ...base, modalidad: 'nacional', precioTotalMxn: '500000',
    cargasTotales: 2, fleteNac: '20000',
  });

  it('no aplica tipo de cambio seguro', () => {
    expect(r.tcSeguro).toBe(0);
  });

  it('reparte el precio total entre todas las cargas', () => {
    expect(r.precioTopeCompra).toBeCloseTo(8.7878, 4);
  });
});

describe('calcularCotizacion — inventario', () => {
  const r = calcularCotizacion({ ...base, modalidad: 'inventario', ppProv: '10' });

  it('no calcula tope porque no hay venta', () => {
    expect(r.precioTopeCompra).toBe(0);
    expect(r.utilidadNeta).toBe(0);
    expect(r.precioVenta).toBe(0);
  });

  it('deja el semaforo vacio', () => {
    expect(r.status).toBe('');
  });
});
```

- [ ] **Step 3: Correr la prueba y verificar que falla**

```bash
npm test
```

Esperado: FAIL — `Cannot find module './calc.js'`.

- [ ] **Step 4: Escribir la implementación mínima**

`deploy/js/calc.js`:

```js
// Motor de cálculo del cotizador. Función pura: sin React, sin DOM, sin estado.
// Se carga como global en el navegador y con require() en las pruebas.
(function (root) {
  const KG_POR_CARGA = { terrestre: 19500, nacional: 24500, inventario: 24500 };

  const TASA_RIESGO_ANUAL = 0.15;
  const MARGEN_EXTRA = 0.10;
  const KG_CARGA_FLETE_NAC = 24500;

  const truncar = n => Math.trunc(n * 100) / 100;

  function calcularCotizacion(e) {
    const num = v => Number(v) || 0;

    const modalidad = e.modalidad;
    const tieneVenta = modalidad !== 'inventario';

    const numTcHoy = num(e.tcHoy);
    const numMerma = num(e.merma);
    const numManiobras = num(e.maniobras);
    const numPpProv = num(e.ppProv);
    const numFleteNac = num(e.fleteNac);

    // Se calcula también en nacional aunque el ingreso no lo use: viaja en el payload.
    const precioVenta = tieneVenta
      ? Number((((num(e.porcentajeFijacion) / 100) * num(e.fixPrice)) / 1000).toFixed(5))
      : 0;

    if (!tieneVenta) {
      return {
        tcSeguro: 0,
        capKg: KG_POR_CARGA.inventario,
        precioVenta: 0,
        precioTopeCompra: 0,
        utilidadNeta: 0,
        utilidadPorKg: 0,
        status: '',
      };
    }

    let tcSeguro, capKg, ingresoKgMxn, logKg;

    if (modalidad === 'nacional') {
      tcSeguro = 0;
      capKg = KG_POR_CARGA.nacional;
      logKg = numFleteNac / KG_CARGA_FLETE_NAC;
      const cargas = num(e.cargasTotales) || 1;
      ingresoKgMxn = num(e.precioTotalMxn) / (cargas * KG_POR_CARGA.nacional);
    } else {
      const colchon = ((numTcHoy * TASA_RIESGO_ANUAL / 365) * num(e.diasCobro)) + MARGEN_EXTRA;
      tcSeguro = numTcHoy - colchon;
      capKg = modalidad === 'maritimo'
        ? num(e.capacidadCNT) * 1000
        : KG_POR_CARGA.terrestre;
      const costoLogNacKg = numFleteNac / KG_CARGA_FLETE_NAC;
      const costoLogIntKg = (num(e.aduanaMex) + ((num(e.cruceInt) + num(e.aduanaUsa)) * tcSeguro)) / capKg;
      logKg = costoLogNacKg + costoLogIntKg;
      ingresoKgMxn = precioVenta * tcSeguro;
    }

    const precioTopeCompra = (ingresoKgMxn - logKg - numManiobras) * (1 - (numMerma / 100));
    const costoCompraMaterial = truncar((numPpProv / (1 - (numMerma / 100))) + numManiobras);
    const utilidadPorKg = truncar(ingresoKgMxn - costoCompraMaterial - logKg);

    let status;
    if (numPpProv > precioTopeCompra) status = 'bad';
    else if (numPpProv > precioTopeCompra - 0.5) status = 'warning';
    else status = 'good';

    return {
      tcSeguro,
      capKg,
      precioVenta,
      precioTopeCompra,
      utilidadNeta: utilidadPorKg * capKg,
      utilidadPorKg,
      status,
    };
  }

  const api = { KG_POR_CARGA, calcularCotizacion };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
```

- [ ] **Step 5: Correr las pruebas y verificar que pasan**

```bash
npm test
```

Esperado: PASS, 15 pruebas.

- [ ] **Step 6: Ignorar node_modules**

Agregar a `.gitignore` (crearlo si no existe):

```
node_modules/
```

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.js .gitignore deploy/js/calc.js deploy/js/calc.test.js
git commit -m "test(cotizador): extrae el motor de calculo a calc.js con pruebas"
```

---

### Task 2: Armado del payload aislado y probado

Extrae el mapeo de `app.js:610-647` a una función pura con las reglas nuevas del spec §5.

**Files:**
- Create: `deploy/js/payload.js`
- Test: `deploy/js/payload.test.js`

**Interfaces:**
- Consumes: nada de Task 1 (son independientes).
- Produces:
  ```js
  construirPayload({
    credential, fecha, usuario, modalidad,
    cliente, proveedores,        // proveedores: [{ proveedor, cargas }]
    material, destino, origenEmbarque,
    porcentajeFijacion, fixPrice, tcHoy,
    fleteNac, cruceInt, ppProv, notas,
    embalaje, negociacion, origenFlete, destinoFlete,
    calculo                      // el objeto que devuelve calcularCotizacion()
  }) => objeto plano listo para JSON.stringify
  ```

- [ ] **Step 1: Escribir la prueba que falla**

`deploy/js/payload.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { construirPayload } = require('./payload.js');

const calculo = {
  tcSeguro: 16.690411, capKg: 19500, precioVenta: 1,
  precioTopeCompra: 13.468662, utilidadNeta: 67470,
  utilidadPorKg: 3.46, status: 'good',
};

const base = {
  credential: 'tok', fecha: '31/07/2026', usuario: 'a@b.com',
  modalidad: 'terrestre', cliente: 'ACME',
  proveedores: [{ proveedor: 'PROV A', cargas: '2' }, { proveedor: 'PROV B', cargas: '1.5' }],
  material: 'PET', destino: 'LAREDO', origenEmbarque: 'Mérida',
  porcentajeFijacion: '100', fixPrice: '1000', tcHoy: '17',
  fleteNac: '39000', cruceInt: '1000', ppProv: '10', notas: 'x',
  embalaje: 'PACAS', negociacion: 'DIRECTO ENTREGA',
  origenFlete: 'GDL', destinoFlete: 'MTY',
  calculo,
};

describe('construirPayload — modalidad', () => {
  const m = mod => construirPayload({ ...base, modalidad: mod }).modalidad;

  it('traduce cada modalidad a la etiqueta que espera la hoja', () => {
    expect(m('terrestre')).toBe('Terrestre');
    expect(m('maritimo')).toBe('Marítimo');
    expect(m('nacional')).toBe('Nacional');
    expect(m('inventario')).toBe('Compras');
  });
});

describe('construirPayload — proveedores y cargas', () => {
  const p = construirPayload(base);

  it('une los proveedores sin sufijos de intencion', () => {
    expect(p.proveedor).toBe('PROV A, PROV B');
  });

  it('suma las cargas de todas las filas', () => {
    expect(p.cargas).toBe(3.5);
  });
});

describe('construirPayload — con venta', () => {
  const p = construirPayload(base);

  it('marca intencion de venta y no inventario', () => {
    expect(p.intencionVenta).toBe(true);
    expect(p.paraInventarios).toBe(false);
    expect(p.intencionCompra).toBe(false);
  });

  it('conserva el cliente', () => {
    expect(p.cliente).toBe('ACME');
  });

  it('deriva el precio de compra total de ppProv por los kg totales', () => {
    // 3.5 cargas x 19500 kg = 68250 kg;  10 MXN/kg => 682500
    expect(p.precioCompraMxn).toBe(682500);
    expect(p.ppProv).toBe(10);
  });

  it('arrastra los resultados del calculo', () => {
    expect(p.precioTopeCompra).toBe(13.47);
    expect(p.utilidadNeta).toBe(67470);
    expect(p.status).toBe('Aprobado');
    expect(p.tcSeguro).toBe(16.69);
  });
});

describe('construirPayload — inventario', () => {
  const p = construirPayload({
    ...base,
    modalidad: 'inventario',
    calculo: { tcSeguro: 0, capKg: 24500, precioVenta: 0, precioTopeCompra: 0, utilidadNeta: 0, utilidadPorKg: 0, status: '' },
  });

  it('no manda cliente', () => {
    expect(p.cliente).toBe('');
  });

  it('marca para inventarios', () => {
    expect(p.paraInventarios).toBe(true);
    expect(p.intencionVenta).toBe(false);
  });

  it('manda en cero lo que depende de la venta', () => {
    expect(p.precioVenta).toBe(0);
    expect(p.precioTopeCompra).toBe(0);
    expect(p.utilidadNeta).toBe(0);
    expect(p.status).toBe('');
  });

  it('usa 24500 kg por carga para el total de compra', () => {
    // 3.5 cargas x 24500 kg = 85750 kg;  10 MXN/kg => 857500
    expect(p.precioCompraMxn).toBe(857500);
  });
});

describe('construirPayload — campos condicionales', () => {
  it('manda origen de embarque solo en maritimo', () => {
    expect(construirPayload({ ...base, modalidad: 'maritimo' }).origenEmbarque).toBe('Mérida');
    expect(construirPayload({ ...base, modalidad: 'terrestre' }).origenEmbarque).toBe('');
  });

  it('conserva tipoCompra y contrato fijos mientras Back to Back esta fuera', () => {
    const p = construirPayload(base);
    expect(p.tipoCompra).toBe('Compra Mercado');
    expect(p.contrato).toBe('');
  });
});

describe('construirPayload — estatus', () => {
  const s = status => construirPayload({ ...base, calculo: { ...calculo, status } }).status;

  it('traduce el semaforo a la etiqueta de la hoja', () => {
    expect(s('good')).toBe('Aprobado');
    expect(s('warning')).toBe('Apretado');
    expect(s('bad')).toBe('Pérdida');
    expect(s('')).toBe('');
  });
});
```

- [ ] **Step 2: Correr la prueba y verificar que falla**

```bash
npm test
```

Esperado: FAIL — `Cannot find module './payload.js'`.

- [ ] **Step 3: Escribir la implementación mínima**

`deploy/js/payload.js`:

```js
// Mapea el modelo de captura al payload que espera Codigo.gs. Función pura.
// Los nombres y tipos de los campos son contrato con la hoja: no cambiarlos.
(function (root) {
  const ETIQUETA_MODALIDAD = {
    terrestre: 'Terrestre',
    maritimo: 'Marítimo',
    nacional: 'Nacional',
    inventario: 'Compras',
  };

  const ETIQUETA_STATUS = {
    good: 'Aprobado',
    warning: 'Apretado',
    bad: 'Pérdida',
    '': '',
  };

  function construirPayload(e) {
    const num = v => Number(v) || 0;
    const tieneVenta = e.modalidad !== 'inventario';
    const c = e.calculo;

    const cargas = e.proveedores.reduce((sum, r) => sum + num(r.cargas), 0);
    const kgTotales = cargas * c.capKg;

    return {
      credential: e.credential,
      fecha: e.fecha,
      usuario: e.usuario,
      modalidad: ETIQUETA_MODALIDAD[e.modalidad],
      cliente: tieneVenta ? e.cliente : '',
      proveedor: e.proveedores.map(r => r.proveedor).join(', '),
      cargas,
      material: e.material,
      destino: e.destino,
      origenEmbarque: e.modalidad === 'maritimo' ? e.origenEmbarque : '',
      porcentajeFijacion: num(e.porcentajeFijacion),
      fixPrice: num(e.fixPrice),
      precioVenta: c.precioVenta,
      tcHoy: num(e.tcHoy),
      tcSeguro: Number(c.tcSeguro.toFixed(2)),
      fleteNac: num(e.fleteNac),
      cruceInt: num(e.cruceInt),
      precioTopeCompra: Number(c.precioTopeCompra.toFixed(2)),
      ppProv: Number(num(e.ppProv).toFixed(2)),
      status: ETIQUETA_STATUS[c.status],
      utilidadNeta: Number(c.utilidadNeta.toFixed(2)),
      tipoCompra: 'Compra Mercado',
      notas: e.notas,
      embalaje: e.embalaje,
      negociacion: e.negociacion,
      contrato: '',
      paraInventarios: !tieneVenta,
      intencionVenta: tieneVenta,
      intencionCompra: false,
      origenFlete: e.origenFlete,
      destinoFlete: e.destinoFlete,
      precioCompraMxn: Number((num(e.ppProv) * kgTotales).toFixed(2)),
    };
  }

  const api = { construirPayload };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
```

- [ ] **Step 4: Correr las pruebas y verificar que pasan**

```bash
npm test
```

Esperado: PASS, todas las pruebas de `calc.test.js` y `payload.test.js`.

- [ ] **Step 5: Commit**

```bash
git add deploy/js/payload.js deploy/js/payload.test.js
git commit -m "test(cotizador): extrae el armado del payload a payload.js"
```

---

### Task 3: Bloque de compra

Componente nuevo, todavía sin renderizar. La app sigue funcionando igual.

**Files:**
- Create: `deploy/js/blocks/Compra.js`
- Modify: `deploy/index.html`

**Interfaces:**
- Consumes: `KG_POR_CARGA` de `calc.js`; el global `FLETES_NACIONALES_COMPRAS` de `data-fletes-nacionales.js`.
- Produces:
  ```jsx
  <BloqueCompra
    proveedores={[{ proveedor, cargas }]}  setProveedores={fn}
    opcionesProveedor={[string]}
    material={string}                      setMaterial={fn}
    opcionesMaterial={[string]}
    embalaje={string}                      setEmbalaje={fn}
    negociacion={string}                   setNegociacion={fn}
    origenFlete={string}                   setOrigenFlete={fn}
    destinoFlete={string}                  setDestinoFlete={fn}
    fleteNac={string}                      setFleteNac={fn}
    ppProv={string}                        setPpProv={fn}
    capKg={number}
  />
  ```

- [ ] **Step 1: Escribir el componente**

`deploy/js/blocks/Compra.js`:

```jsx
// Bloque de compra. Igual en las cuatro modalidades: el material se compra siempre
// del mismo modo; lo que cambia por modalidad es cómo se vende.
function BloqueCompra({
  proveedores, setProveedores, opcionesProveedor,
  material, setMaterial, opcionesMaterial,
  embalaje, setEmbalaje,
  negociacion, setNegociacion,
  origenFlete, setOrigenFlete,
  destinoFlete, setDestinoFlete,
  fleteNac, setFleteNac,
  ppProv, setPpProv,
  capKg,
}) {
  const selCls = "w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-xs outline-none focus:border-white transition-colors appearance-none";

  const cargasTotales = proveedores.reduce((s, r) => s + (Number(r.cargas) || 0), 0);
  const kg = cargasTotales * capKg;
  const lb = kg * 2.20462;
  const totalCompra = (Number(ppProv) || 0) * kg;

  const actualizar = (i, campo, valor) => {
    setProveedores(proveedores.map((r, j) => j === i ? { ...r, [campo]: valor } : r));
  };
  const agregar = () => setProveedores([...proveedores, { proveedor: opcionesProveedor[0] || '', cargas: '1' }]);
  const quitar = i => setProveedores(proveedores.filter((_, j) => j !== i));

  const origenes = [...new Set(FLETES_NACIONALES_COMPRAS.map(r => r.o))].sort();
  const destinos = [...new Set(FLETES_NACIONALES_COMPRAS.map(r => r.d))].sort();

  const buscarFlete = (o, d) => {
    const match = FLETES_NACIONALES_COMPRAS.find(r => r.o === o && r.d === d);
    setFleteNac(match ? match.precio.toString() : "0");
  };

  return (
    <div className="space-y-3 bg-gray-900 border border-gray-700 rounded-xl p-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Compra</div>

      <div className="space-y-2">
        <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider">Proveedores y Cargas</label>
        {proveedores.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <select value={row.proveedor} onChange={e => actualizar(i, 'proveedor', e.target.value)} className={"flex-1 " + selCls}>
              {opcionesProveedor.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <input type="number" step="0.5" value={row.cargas} onChange={e => actualizar(i, 'cargas', e.target.value)}
                   className="w-20 bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-sm outline-none focus:border-white" />
            {proveedores.length > 1 && (
              <button onClick={() => quitar(i)} className="text-red-400 hover:text-red-300 font-black text-sm px-2">✕</button>
            )}
          </div>
        ))}
        <div className="flex items-center justify-between">
          <button onClick={agregar} className="text-[9px] font-black uppercase tracking-wide" style={{ color: '#ff6600' }}>+ Proveedor</button>
          <div className="bg-gray-800 px-3 py-1.5 rounded border border-gray-700 text-center whitespace-nowrap">
            <div className="text-white text-[11px] font-black leading-tight">{kg.toLocaleString()} KG</div>
            <div className="text-gray-500 text-[9px] font-bold leading-tight">{Math.round(lb).toLocaleString()} LB</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Embalaje</label>
          <select value={embalaje} onChange={e => setEmbalaje(e.target.value)} className={selCls}>
            <option value="">— Embalaje —</option>
            {["PACAS", "JUMBOS", "GAYLORD"].map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Negociación</label>
          <select value={negociacion} onChange={e => setNegociacion(e.target.value)} className={selCls}>
            <option value="">— Negociación —</option>
            {["RECOLECCION DIRECTA", "RECOLECCION BMTY", "DIRECTO ENTREGA", "BMTY ENTREGA", "LAREDO ENTREGA"].map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Material</label>
        <select value={material} onChange={e => setMaterial(e.target.value)} className={selCls + " truncate"}>
          {opcionesMaterial.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Origen</label>
          <select value={origenFlete}
                  onChange={e => { setOrigenFlete(e.target.value); buscarFlete(e.target.value, destinoFlete); }}
                  className={selCls + " truncate"}>
            <option value="">— Origen —</option>
            {origenes.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Destino</label>
          <select value={destinoFlete}
                  onChange={e => { setDestinoFlete(e.target.value); buscarFlete(origenFlete, e.target.value); }}
                  className={selCls + " truncate"}>
            <option value="">— Destino —</option>
            {destinos.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Flete Nac.</label>
        <div className="relative">
          <span className="absolute left-2 top-2 text-gray-400 font-bold text-xs">$</span>
          <input type="number" value={fleteNac}
                 onChange={e => { setFleteNac(e.target.value); setOrigenFlete(''); setDestinoFlete(''); }}
                 className="w-full bg-black border border-gray-700 rounded-lg p-2 pl-6 text-white font-bold text-sm outline-none focus:border-white" />
        </div>
      </div>

      <div>
        <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Precio de Compra (MXN x KG)</label>
        <div className="relative">
          <span className="absolute left-2 top-2.5 text-green-500 font-bold text-xs">$</span>
          <input type="number" step="0.01" value={ppProv} onChange={e => setPpProv(e.target.value)} placeholder="0.00"
                 className="w-full bg-black border border-gray-700 rounded-lg p-2.5 pl-6 text-green-400 font-mono font-bold text-sm outline-none focus:border-white" />
        </div>
        <div className="text-[9px] text-gray-500 font-bold mt-1 text-right">
          Total: {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(totalCompra)}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Registrar los scripts nuevos en el HTML**

En `deploy/index.html`, entre los datos estáticos y `app.js`, agregar `calc.js` y `payload.js` como scripts normales (no llevan JSX) y `Compra.js` como Babel:

```html
    <!-- Lógica pura (sin JSX) -->
    <script src="js/calc.js?v=20260731a"></script>
    <script src="js/payload.js?v=20260731a"></script>

    <!-- Bloques de captura (JSX) -->
    <script type="text/babel" src="js/blocks/Compra.js?v=20260731a"></script>
```

- [ ] **Step 3: Verificar que la app sigue cargando**

```bash
npx serve deploy
```

Abrir `http://localhost:3000`, iniciar sesión, y confirmar en la consola del navegador que no hay errores y que `typeof BloqueCompra === 'function'` y `typeof calcularCotizacion === 'function'`.

- [ ] **Step 4: Commit**

```bash
git add deploy/js/blocks/Compra.js deploy/index.html
git commit -m "feat(cotizador): bloque de compra unico"
```

---

### Task 4: Bloque de venta nacional

**Files:**
- Create: `deploy/js/blocks/VentaNacional.js`
- Modify: `deploy/index.html`

**Interfaces:**
- Consumes: nada.
- Produces:
  ```jsx
  <VentaNacional
    cliente={string}         setCliente={fn}    opcionesCliente={[string]}
    destino={string}         setDestino={fn}    opcionesDestino={[string]}
    precioTonMxn={string}    setPrecioTonMxn={fn}
    precioTotalMxn={string}  setPrecioTotalMxn={fn}
  />
  ```

- [ ] **Step 1: Escribir el componente**

`deploy/js/blocks/VentaNacional.js`:

```jsx
// Venta nacional: precio en pesos, sin tipo de cambio ni logística internacional.
// El precio por tonelada es una ayuda de captura: llena el total a 24.5 ton por carga.
function VentaNacional({
  cliente, setCliente, opcionesCliente,
  destino, setDestino, opcionesDestino,
  precioTonMxn, setPrecioTonMxn,
  precioTotalMxn, setPrecioTotalMxn,
}) {
  const selCls = "w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-sm outline-none focus:border-white transition-colors appearance-none";

  return (
    <div className="space-y-3 bg-gray-900 border border-gray-700 rounded-xl p-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Venta — Nacional</div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Cliente</label>
          <select value={cliente} onChange={e => setCliente(e.target.value)} className={selCls + " truncate"}>
            {opcionesCliente.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Destino</label>
          <select value={destino} onChange={e => setDestino(e.target.value)} className={selCls + " truncate"}>
            {opcionesDestino.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-black p-3 rounded-xl border border-gray-700 space-y-2">
        <div>
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Precio x Ton (MXN) — opcional</label>
          <div className="relative">
            <span className="absolute left-1 top-1.5 text-gray-500 font-bold">$</span>
            <input type="number" step="0.01" value={precioTonMxn}
                   onChange={e => {
                     const val = e.target.value;
                     setPrecioTonMxn(val);
                     setPrecioTotalMxn(val === '' ? '' : (Number(val) * 24.5).toFixed(2));
                   }}
                   placeholder="0.00"
                   className="w-full bg-transparent border-b border-gray-700 p-1.5 pl-5 text-gray-300 font-mono font-bold text-sm outline-none focus:border-white" />
          </div>
        </div>
        <div>
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Precio Total MXN</label>
          <div className="relative">
            <span className="absolute left-1 top-1.5 text-green-500 font-bold">$</span>
            <input type="number" step="0.01" value={precioTotalMxn}
                   onChange={e => { setPrecioTotalMxn(e.target.value); setPrecioTonMxn(''); }}
                   placeholder="0.00"
                   className="w-full bg-transparent border-b border-gray-700 p-1.5 pl-5 text-green-400 font-mono font-bold text-sm outline-none focus:border-white" />
          </div>
          <div className="text-[9px] text-gray-500 font-bold mt-1">Total del embarque completo, no por carga.</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Registrar el script**

En `deploy/index.html`, después de `Compra.js`:

```html
    <script type="text/babel" src="js/blocks/VentaNacional.js?v=20260731a"></script>
```

- [ ] **Step 3: Verificar que carga**

Recargar `http://localhost:3000` y confirmar en consola: `typeof VentaNacional === 'function'`, sin errores.

- [ ] **Step 4: Commit**

```bash
git add deploy/js/blocks/VentaNacional.js deploy/index.html
git commit -m "feat(cotizador): bloque de venta nacional"
```

---

### Task 5: Bloque de venta terrestre

**Files:**
- Create: `deploy/js/blocks/VentaTerrestre.js`
- Modify: `deploy/index.html`

**Interfaces:**
- Consumes: nada.
- Produces:
  ```jsx
  <VentaTerrestre
    cliente destino opcionesCliente opcionesDestino (+ setters)
    porcentajeFijacion fixPrice diasCobro merma (+ setters)
    precioVenta={number}   // readonly, viene de calcularCotizacion()
    tcHoy setTcHoy tcSeguro={number} cargandoTC={bool} onActualizarTC={fn}
    rutaIntSelect setRutaIntSelect cruceInt setCruceInt
  />
  ```
  y el global `RUTAS_FLETE_INT` (array de `{ name, cost, currency }`).

- [ ] **Step 1: Escribir el componente**

`deploy/js/blocks/VentaTerrestre.js`:

```jsx
// Rutas de cruce internacional por carretera. Las de MXN se convierten a USD al T.C.
const RUTAS_FLETE_INT = [
  { name: "MTY - LDO TEX",      cost: 17500, currency: 'MXN' },
  { name: "JAL - LDO",          cost: 2450,  currency: 'USD' },
  { name: "QRO - LDO",          cost: 35000, currency: 'MXN' },
  { name: "MTY - MICHIGAN",     cost: 4850,  currency: 'USD' },
  { name: "AGS - LDO",          cost: 1900,  currency: 'USD' },
  { name: "MTY - RUSSVILLE KY", cost: 3750,  currency: 'USD' },
  { name: "MTY - ALABAMA",      cost: 3800,  currency: 'USD' },
  { name: "MTY - TEXARKANA TX", cost: 3000,  currency: 'USD' },
];

function VentaTerrestre({
  cliente, setCliente, opcionesCliente,
  destino, setDestino, opcionesDestino,
  porcentajeFijacion, setPorcentajeFijacion,
  fixPrice, setFixPrice,
  diasCobro, setDiasCobro,
  merma, setMerma,
  precioVenta,
  tcHoy, setTcHoy, tcSeguro, cargandoTC, onActualizarTC,
  rutaIntSelect, setRutaIntSelect,
  cruceInt, setCruceInt,
}) {
  const selCls = "w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-sm outline-none focus:border-white transition-colors appearance-none";

  const elegirRuta = val => {
    setRutaIntSelect(val);
    if (val === 'N/A' || val === '') { setCruceInt("0"); return; }
    const r = RUTAS_FLETE_INT.find(x => x.name === val);
    if (!r) return;
    if (r.currency === 'USD') setCruceInt(r.cost.toString());
    else {
      const tc = Number(tcHoy) || 0;
      if (tc > 0) setCruceInt((r.cost / tc).toFixed(2));
    }
  };

  return (
    <div className="space-y-3 bg-gray-900 border border-gray-700 rounded-xl p-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Venta — Terrestre</div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Cliente</label>
          <select value={cliente} onChange={e => setCliente(e.target.value)} className={selCls + " truncate"}>
            {opcionesCliente.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Destino</label>
          <select value={destino} onChange={e => setDestino(e.target.value)} className={selCls + " truncate"}>
            {opcionesDestino.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Flete Int.</label>
          <select value={rutaIntSelect} onChange={e => elegirRuta(e.target.value)}
                  className="w-full bg-black border border-gray-700 rounded-lg p-2 text-white font-bold text-[10px] outline-none truncate focus:border-white appearance-none">
            <option value="">Ruta / Manual...</option>
            <option value="N/A">N/A (Sin Flete)</option>
            {RUTAS_FLETE_INT.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
          </select>
        </div>
        <div className="relative">
          <span className="absolute left-2 top-2 font-bold text-xs" style={{ color: '#ff6600' }}>$</span>
          <input type="number" value={cruceInt}
                 onChange={e => { setCruceInt(e.target.value); setRutaIntSelect(''); }}
                 className="w-full bg-black border border-gray-700 rounded-lg p-2 pl-6 text-white font-bold text-sm outline-none focus:border-white" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex justify-between items-end mb-1">
            <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider">T.C. Banco</label>
            <button onClick={onActualizarTC} className="text-[9px] font-bold hover:text-white transition-colors" style={{ color: '#ff6600' }}>
              {cargandoTC ? '⏳...' : '🔄 Act.'}
            </button>
          </div>
          <div className="relative">
            <span className="absolute left-2 top-2 text-gray-400 font-bold">$</span>
            <input type="number" step="0.01" value={tcHoy} onChange={e => setTcHoy(e.target.value)}
                   className="w-full bg-black border border-gray-700 rounded-lg p-2 pl-6 text-white font-bold text-sm outline-none focus:border-white" />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#ff6600' }}>T.C. Seguro</label>
          <div className="relative">
            <span className="absolute left-2 top-2 font-bold" style={{ color: '#ff6600' }}>$</span>
            <input type="text" readOnly value={tcSeguro > 0 ? tcSeguro.toFixed(2) : "0.00"} title="Cálculo con colchón de riesgo aplicado"
                   className="w-full bg-black border rounded-lg p-2 pl-6 font-mono font-bold text-sm outline-none cursor-not-allowed shadow-inner"
                   style={{ color: '#ff6600', borderColor: '#ff6600' }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 bg-black p-3 rounded-xl border border-gray-700">
        <div>
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">% Fijación</label>
          <div className="relative">
            <input type="number" value={porcentajeFijacion} onChange={e => setPorcentajeFijacion(e.target.value)}
                   className="w-full bg-transparent border-b border-gray-700 p-1.5 text-white font-bold text-sm outline-none focus:border-white" />
            <span className="absolute right-1 top-1.5 text-gray-400 font-bold">%</span>
          </div>
        </div>
        <div>
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Fix Price</label>
          <div className="relative">
            <span className="absolute left-1 top-1.5 font-bold" style={{ color: '#ff6600' }}>$</span>
            <input type="number" value={fixPrice} onChange={e => setFixPrice(e.target.value)}
                   className="w-full bg-transparent border-b border-gray-700 p-1.5 pl-5 text-white font-bold text-sm outline-none focus:border-white" />
          </div>
        </div>
        <div>
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Venta (x KG)</label>
          <div className="relative">
            <span className="absolute left-1 top-1.5 text-green-500 font-bold">$</span>
            <input type="text" readOnly value={precioVenta.toFixed(5)}
                   className="w-full bg-transparent border-b border-gray-700 p-1.5 pl-5 text-green-400 font-mono font-bold text-sm outline-none cursor-not-allowed" />
          </div>
        </div>
        <div>
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Días Crédito</label>
          <input type="number" value={diasCobro} onChange={e => setDiasCobro(e.target.value)}
                 className="w-full bg-transparent border-b border-gray-700 p-1.5 text-white font-bold text-sm outline-none text-center focus:border-white" />
        </div>
        <div className="col-span-2">
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1 text-center" title="Porcentaje estimado de basura/tierra">Merma</label>
          <div className="relative">
            <input type="number" step="0.1" value={merma} onChange={e => setMerma(e.target.value)}
                   className="w-full bg-transparent border-b border-gray-700 p-1.5 text-white font-bold text-sm outline-none focus:border-white text-center" />
            <span className="absolute right-3 top-2 text-gray-400 font-bold">%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Registrar el script**

En `deploy/index.html`, después de `VentaNacional.js`:

```html
    <script type="text/babel" src="js/blocks/VentaTerrestre.js?v=20260731a"></script>
```

- [ ] **Step 3: Verificar que carga**

Recargar y confirmar en consola: `typeof VentaTerrestre === 'function'` y `RUTAS_FLETE_INT.length === 8`.

- [ ] **Step 4: Commit**

```bash
git add deploy/js/blocks/VentaTerrestre.js deploy/index.html
git commit -m "feat(cotizador): bloque de venta terrestre"
```

---

### Task 6: Bloque de venta marítimo

Mueve `Celda` y `DesgloseMaritimo` (hoy en `app.js:5-49`) a este archivo, junto con la cascada del tarifario.

**Files:**
- Create: `deploy/js/blocks/VentaMaritimo.js`
- Modify: `deploy/js/app.js:1-49` (borrar `Celda` y `DesgloseMaritimo`)
- Modify: `deploy/index.html`

**Interfaces:**
- Consumes: globales `TARIFARIO_DATA`, `TARIFARIO_PROVEEDORES_EXTRA`, `calcDespacho` de `data-tarifario.js`; `RUTAS_FLETE_INT` no se usa aquí.
- Produces:
  ```jsx
  <VentaMaritimo
    cliente destino opcionesCliente opcionesDestino (+ setters)
    origenEmbarque setOrigenEmbarque opcionesOrigenEmbarque={[string]}
    porcentajeFijacion fixPrice diasCobro merma (+ setters)
    precioVenta={number}
    tcHoy setTcHoy tcSeguro cargandoTC onActualizarTC
    capacidadCNT setCapacidadCNT
    tarifario={{ proveedor, origen, destino, equipo, tipo }}
    setTarifario={fn}
    maritimoRow setMaritimoRow
    cruceInt setCruceInt
    sinTarifario={bool}   // derivado en app.js, ver Task 7
  />
  ```

- [ ] **Step 1: Escribir el componente**

`deploy/js/blocks/VentaMaritimo.js`:

```jsx
// Celda de concepto del desglose: etiqueta arriba, importe abajo.
const Celda = ({ label, valor, accent, destacado }) => (
  <div className={"rounded-lg px-2 py-1.5 border " + (destacado ? 'bg-gray-900' : 'bg-black border-gray-800')}
       style={destacado ? { borderColor: accent } : undefined}>
    <div className="text-[8px] font-black uppercase tracking-wider leading-tight" style={{ color: destacado ? accent : '#9ca3af' }}>{label}</div>
    <div className="font-mono font-black whitespace-nowrap text-[11px]" style={{ color: destacado ? accent : '#e5e7eb' }}>{valor}</div>
  </div>
);

// Desglose de solo lectura del tarifario marítimo. Replica las columnas del xlsx.
function DesgloseMaritimo({ row, tc, accent }) {
  if (!row) return null;

  const d = calcDespacho(row.pol);
  const numTc = Number(tc) || 0;

  // El tarifario captura el despacho en MXN; aquí se muestra en USD al T.C. banco.
  const usd = n => numTc > 0 ? 'USD ' + Math.round(n / numTc).toLocaleString('es-MX') : '—';

  return (
    <div className="bg-black rounded-xl border border-gray-700 p-3 mt-2">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <span className="text-[9px] font-black uppercase tracking-wider text-gray-500">Desglose — {row.pol}</span>
        <span className="text-[9px] font-bold text-gray-600 font-mono">T.C. {numTc > 0 ? numTc.toFixed(2) : '—'}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        <Celda label="Ocean Freight" valor={'USD ' + row.of.toLocaleString('es-MX')} accent={accent} destacado />
        <Celda label="Pedimento"     valor={usd(d.ped)}  accent={accent} />
        <Celda label="Maniobras"     valor={usd(d.man)}  accent={accent} />
        <Celda label="Honorarios"    valor={usd(d.hon)}  accent={accent} />
        <Celda label="Validación"    valor={usd(d.val)}  accent={accent} />
        <Celda label="Servicio COVE" valor={usd(d.cove)} accent={accent} />
      </div>

      <div className="h-px bg-gray-700 my-2"></div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        <Celda label="Total AA"  valor={usd(d.totalAA)} accent={accent} />
        <Celda label="Arrastre"  valor={usd(d.arr)}     accent={accent} />
        <Celda label="Arrastre + Despacho" valor={usd(d.total)} accent={accent} destacado />
      </div>

      <div className="text-[8px] text-gray-600 font-bold leading-tight pt-1.5">Despacho convertido de MXN a T.C. banco</div>
    </div>
  );
}

function VentaMaritimo({
  cliente, setCliente, opcionesCliente,
  destino, setDestino, opcionesDestino,
  origenEmbarque, setOrigenEmbarque, opcionesOrigenEmbarque,
  porcentajeFijacion, setPorcentajeFijacion,
  fixPrice, setFixPrice,
  diasCobro, setDiasCobro,
  merma, setMerma,
  precioVenta,
  tcHoy, setTcHoy, tcSeguro, cargandoTC, onActualizarTC,
  capacidadCNT, setCapacidadCNT,
  tarifario, setTarifario,
  maritimoRow, setMaritimoRow,
  cruceInt, setCruceInt,
  sinTarifario,
}) {
  const selCls = "w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-sm outline-none focus:border-white transition-colors appearance-none";
  const selMini = "w-full bg-black border border-gray-700 rounded-lg p-1.5 text-white font-bold text-[10px] outline-none truncate focus:border-white appearance-none";

  const t = tarifario;
  const proveedores = [...new Set([...TARIFARIO_DATA.map(r => r.p), ...TARIFARIO_PROVEEDORES_EXTRA])].sort();
  const origenes = t.proveedor ? [...new Set(TARIFARIO_DATA.filter(r => r.p === t.proveedor).map(r => r.o))].sort() : [];
  const destinos = t.origen ? [...new Set(TARIFARIO_DATA.filter(r => r.p === t.proveedor && r.o === t.origen).map(r => r.pod))].sort() : [];
  const equipos  = t.destino ? [...new Set(TARIFARIO_DATA.filter(r => r.p === t.proveedor && r.o === t.origen && r.pod === t.destino).map(r => r.eq))].sort() : [];
  const filas    = t.equipo ? TARIFARIO_DATA.filter(r => r.p === t.proveedor && r.o === t.origen && r.pod === t.destino && r.eq === t.equipo) : [];
  const tipos    = [...new Set(filas.filter(r => r.tipo !== null).map(r => r.tipo))].sort();

  return (
    <div className="space-y-3 bg-gray-900 border border-gray-700 rounded-xl p-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Venta — Marítimo</div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Cliente</label>
          <select value={cliente} onChange={e => setCliente(e.target.value)} className={selCls + " truncate"}>
            {opcionesCliente.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Destino</label>
          <select value={destino} onChange={e => setDestino(e.target.value)} className={selCls + " truncate"}>
            {opcionesDestino.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Origen Embarque</label>
        <select value={origenEmbarque} onChange={e => setOrigenEmbarque(e.target.value)} className={selCls + " truncate"}>
          <option value="">— Origen —</option>
          {opcionesOrigenEmbarque.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider">Ocean Freight</label>

        <select value={t.proveedor}
                onChange={e => setTarifario({ proveedor: e.target.value, origen: '', destino: '', equipo: '', tipo: '' })}
                className={selMini}>
          <option value="">— Proveedor —</option>
          {proveedores.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        {sinTarifario && (
          <p className="text-[9px] text-gray-500 leading-tight">Sin tarifario. Captura el ocean freight manual (USD) abajo; el despacho va en Aduana MX.</p>
        )}

        {!sinTarifario && t.proveedor && (
          <select value={t.origen}
                  onChange={e => setTarifario({ ...t, origen: e.target.value, destino: '', equipo: '', tipo: '' })}
                  className={selMini}>
            <option value="">— Origen —</option>
            {origenes.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        )}

        {t.origen && (
          <select value={t.destino}
                  onChange={e => setTarifario({ ...t, destino: e.target.value, equipo: '', tipo: '' })}
                  className={selMini}>
            <option value="">— Destino —</option>
            {destinos.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}

        {t.destino && (
          <select value={t.equipo}
                  onChange={e => setTarifario({ ...t, equipo: e.target.value, tipo: '' })}
                  className={selMini}>
            <option value="">— Equipo —</option>
            {equipos.map(eq => <option key={eq} value={eq}>{eq}</option>)}
          </select>
        )}

        {tipos.length > 0 && t.equipo && (
          <select value={t.tipo} onChange={e => setTarifario({ ...t, tipo: e.target.value })} className={selMini}>
            <option value="">— Tipo —</option>
            {tipos.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        )}

        <div className="relative">
          <span className="absolute left-2 top-2 font-bold text-xs" style={{ color: '#ff6600' }}>$</span>
          <input type="number" value={cruceInt}
                 onChange={e => {
                   setCruceInt(e.target.value);
                   // Editar el cruce a mano invalida la selección del tarifario.
                   if (TARIFARIO_DATA.some(r => r.p === t.proveedor)) {
                     setTarifario({ proveedor: '', origen: '', destino: '', equipo: '', tipo: '' });
                     setMaritimoRow(null);
                   }
                 }}
                 className="w-full bg-black border border-gray-700 rounded-lg p-2 pl-6 text-white font-bold text-sm outline-none focus:border-white" />
        </div>

        <DesgloseMaritimo row={maritimoRow} tc={tcHoy} accent="#ff6600" />
      </div>

      <div>
        <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">
          Cap. Contenedor — <span className="font-black text-white">{capacidadCNT} TON</span>
        </label>
        <input type="range" min="5" max="30" step="1" value={capacidadCNT}
               onChange={e => setCapacidadCNT(Number(e.target.value))}
               className="w-full cursor-pointer" style={{ accentColor: '#ff6600' }} />
        <div className="flex justify-between text-[9px] text-gray-600 font-bold mt-0.5"><span>5T</span><span>30T</span></div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex justify-between items-end mb-1">
            <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider">T.C. Banco</label>
            <button onClick={onActualizarTC} className="text-[9px] font-bold hover:text-white transition-colors" style={{ color: '#ff6600' }}>
              {cargandoTC ? '⏳...' : '🔄 Act.'}
            </button>
          </div>
          <div className="relative">
            <span className="absolute left-2 top-2 text-gray-400 font-bold">$</span>
            <input type="number" step="0.01" value={tcHoy} onChange={e => setTcHoy(e.target.value)}
                   className="w-full bg-black border border-gray-700 rounded-lg p-2 pl-6 text-white font-bold text-sm outline-none focus:border-white" />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#ff6600' }}>T.C. Seguro</label>
          <div className="relative">
            <span className="absolute left-2 top-2 font-bold" style={{ color: '#ff6600' }}>$</span>
            <input type="text" readOnly value={tcSeguro > 0 ? tcSeguro.toFixed(2) : "0.00"} title="Cálculo con colchón de riesgo aplicado"
                   className="w-full bg-black border rounded-lg p-2 pl-6 font-mono font-bold text-sm outline-none cursor-not-allowed shadow-inner"
                   style={{ color: '#ff6600', borderColor: '#ff6600' }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 bg-black p-3 rounded-xl border border-gray-700">
        <div>
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">% Fijación</label>
          <div className="relative">
            <input type="number" value={porcentajeFijacion} onChange={e => setPorcentajeFijacion(e.target.value)}
                   className="w-full bg-transparent border-b border-gray-700 p-1.5 text-white font-bold text-sm outline-none focus:border-white" />
            <span className="absolute right-1 top-1.5 text-gray-400 font-bold">%</span>
          </div>
        </div>
        <div>
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Fix Price</label>
          <div className="relative">
            <span className="absolute left-1 top-1.5 font-bold" style={{ color: '#ff6600' }}>$</span>
            <input type="number" value={fixPrice} onChange={e => setFixPrice(e.target.value)}
                   className="w-full bg-transparent border-b border-gray-700 p-1.5 pl-5 text-white font-bold text-sm outline-none focus:border-white" />
          </div>
        </div>
        <div>
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Venta (x KG)</label>
          <div className="relative">
            <span className="absolute left-1 top-1.5 text-green-500 font-bold">$</span>
            <input type="text" readOnly value={precioVenta.toFixed(5)}
                   className="w-full bg-transparent border-b border-gray-700 p-1.5 pl-5 text-green-400 font-mono font-bold text-sm outline-none cursor-not-allowed" />
          </div>
        </div>
        <div>
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Días Crédito</label>
          <input type="number" value={diasCobro} onChange={e => setDiasCobro(e.target.value)}
                 className="w-full bg-transparent border-b border-gray-700 p-1.5 text-white font-bold text-sm outline-none text-center focus:border-white" />
        </div>
        <div className="col-span-2">
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1 text-center" title="Porcentaje estimado de basura/tierra">Merma</label>
          <div className="relative">
            <input type="number" step="0.1" value={merma} onChange={e => setMerma(e.target.value)}
                   className="w-full bg-transparent border-b border-gray-700 p-1.5 text-white font-bold text-sm outline-none focus:border-white text-center" />
            <span className="absolute right-3 top-2 text-gray-400 font-bold">%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Borrar los componentes duplicados de app.js**

En `deploy/js/app.js`, eliminar las líneas 3-49 (el comentario de `Celda`, el componente `Celda` y la función `DesgloseMaritimo`). La primera línea del archivo (`const { useState, useEffect } = React;`) se conserva.

- [ ] **Step 3: Registrar el script antes de app.js**

En `deploy/index.html`, después de `VentaTerrestre.js`:

```html
    <script type="text/babel" src="js/blocks/VentaMaritimo.js?v=20260731a"></script>
```

- [ ] **Step 4: Verificar que la app sigue funcionando**

Recargar `http://localhost:3000`, entrar a la pestaña Marítimo, elegir un proveedor con tarifario (por ejemplo `GWT` → `Mérida`) y confirmar que el desglose se sigue pintando igual y que no hay errores en consola.

- [ ] **Step 5: Commit**

```bash
git add deploy/js/blocks/VentaMaritimo.js deploy/js/app.js deploy/index.html
git commit -m "feat(cotizador): bloque de venta maritimo con el desglose del tarifario"
```

---

### Task 7: Shell con un solo eje de modalidad

Reescribe el cuerpo de `App` para usar `modalidad`, renderizar los bloques y borrar todo el estado muerto. Es el cambio grande; los bloques ya existen y están probados a mano.

**Files:**
- Modify: `deploy/js/app.js` (todo el componente `App`)
- Modify: `deploy/index.html` (subir `?v=` de todos los scripts a `20260731a`)

**Interfaces:**
- Consumes: `calcularCotizacion`, `KG_POR_CARGA` (Task 1); `construirPayload` (Task 2); `BloqueCompra` (Task 3); `VentaNacional` (Task 4); `VentaTerrestre` (Task 5); `VentaMaritimo` (Task 6).
- Produces: la app final.

- [ ] **Step 1: Reemplazar los estados de pestaña, simulador y Back to Back**

En `deploy/js/app.js`, borrar estas declaraciones de estado y todo lo que las use:

- `activeTab` / `setActiveTab`
- `compraDirecta`, `modoNuevoSurtido`, `contrato`, `pendientes`, `hasFetchedPendientes`, `cargandoPendientes`, `errorPendientes`, y la función `fetchPendientes` completa con su `useEffect`
- `modoSimulador` y **todos** los estados con prefijo `sim` (`simPrecioVenta`, `simTcHoy`, `simDiasCobro`, `simFleteNac`, `simCruceInt`, `simAduanaMex`, `simAduanaUsa`, `simMerma`, `simManiobras`, `simPpProv`, `simPorcentajeFijacion`, `simFixPrice`, `simRutaNacSelect`, `simRutaIntSelect`, `simPrecioTonNacional`, `simPrecioMxnNacional`, `simTcSeguro`, `simPrecioTopeCompra`, `simUtilidadNeta`, `simStatus`, `simCargandoTC`), el segundo `useEffect` de cálculo y `obtenerTipoDeCambioSim`
- `comprasTipo`, `intencionVentaModalidad`, `precioCompraMxnCompras`, `ivNacPrecioTotal`, `comprasProveedores` (se renombra), `cargas`, `proveedor`
- `rutaNacSelect` — el flete nacional ahora se resuelve sólo por origen/destino en `BloqueCompra`, el selector de ruta con precios fijos desaparece
- los derivados `tabPendientes`, `currentContratos`, `visualKg`, `visualLb`, `comprasTotalCargas`, `numCargas`, y el `useEffect` que corrige material/cliente contra pendientes

Y agregar en su lugar:

```jsx
  const [modalidad, setModalidad] = useState('terrestre');
  const tieneVenta = modalidad !== 'inventario';

  const [proveedores, setProveedores] = useState([{ proveedor: '', cargas: '1' }]);
  const [tarifario, setTarifario] = useState({ proveedor: '', origen: '', destino: '', equipo: '', tipo: '' });
```

Los estados que **se conservan** tal cual: `usuario`, `errorLogin`, `credToken`, `cliente`, `material`, `destino`, `origenEmbarque`, `embalaje`, `negociacion`, `notas`, `porcentajeFijacion`, `fixPrice`, `tcHoy`, `diasCobro`, `fleteNac`, `cruceInt`, `aduanaMex`, `aduanaUsa`, `merma`, `maniobras`, `ppProv`, `capacidadCNT`, `rutaIntSelect`, `comprasOrigenFlete`, `comprasDestinoFlete`, `precioTonNacional`, `precioMxnNacional`, `maritimoRow`, `cargandoTC`, `guardando`, `mensajeExito`.

- [ ] **Step 2: Sustituir los dos motores de cálculo por una llamada a calcularCotizacion**

Borrar los dos `useEffect` de cálculo (`app.js:486-554` y `app.js:557-603`) y los estados `tcSeguro`, `precioTopeCompra`, `utilidadNeta`, `utilidadPorKg`, `status`. En su lugar, un derivado en cada render:

```jsx
  const cargasTotales = proveedores.reduce((s, r) => s + (Number(r.cargas) || 0), 0);

  const calculo = calcularCotizacion({
    modalidad, porcentajeFijacion, fixPrice, tcHoy, diasCobro,
    fleteNac, cruceInt, aduanaMex, aduanaUsa, merma, maniobras, ppProv,
    capacidadCNT, precioTotalMxn: precioMxnNacional, cargasTotales,
  });

  const { tcSeguro, capKg, precioVenta, precioTopeCompra, utilidadNeta, status } = calculo;
```

- [ ] **Step 3: Reemplazar la barra de pestañas por los chips de modalidad**

Sustituir el bloque `{/* Tabs */}` (`app.js:736-767` en el archivo original) por:

```jsx
        {/* Modalidad — único eje de la captura */}
        <div className="flex border-b border-gray-700 bg-gray-900 text-[10px] font-black uppercase tracking-wider relative z-10">
          {[
            ['terrestre',  'Terrestre',  '#ff6600'],
            ['maritimo',   'Marítimo',   '#ff6600'],
            ['nacional',   'Nacional',   '#ff6600'],
            ['inventario', 'Inventario', '#16a34a'],
          ].map(([val, lbl, color]) => (
            <button
              key={val}
              onClick={() => setModalidad(val)}
              className={`flex-1 py-3 text-center transition-colors ${modalidad === val ? 'text-white border-b-2' : 'text-gray-500 hover:text-gray-300'}`}
              style={{
                borderColor: modalidad === val ? color : 'transparent',
                color: modalidad === val && val === 'inventario' ? '#4ade80' : undefined,
              }}
            >
              {lbl}
            </button>
          ))}
        </div>
```

- [ ] **Step 4: Reemplazar el cuerpo del formulario por los bloques**

Sustituir todo el contenido del `<div className="p-6 space-y-5 relative z-10">` — desde el toggle `Back to Back / Simular` hasta justo antes del bloque `Tope Máximo de Compra` — por:

```jsx
          <BloqueCompra
            proveedores={proveedores} setProveedores={setProveedores}
            opcionesProveedor={opcionesProveedorActual}
            material={material} setMaterial={setMaterial}
            opcionesMaterial={opcionesMaterialActual}
            embalaje={embalaje} setEmbalaje={setEmbalaje}
            negociacion={negociacion} setNegociacion={setNegociacion}
            origenFlete={comprasOrigenFlete} setOrigenFlete={setComprasOrigenFlete}
            destinoFlete={comprasDestinoFlete} setDestinoFlete={setComprasDestinoFlete}
            fleteNac={fleteNac} setFleteNac={setFleteNac}
            ppProv={ppProv} setPpProv={setPpProv}
            capKg={capKg}
          />

          {modalidad === 'nacional' && (
            <VentaNacional
              cliente={cliente} setCliente={setCliente} opcionesCliente={optionsClientesNacional}
              destino={destino} setDestino={setDestino} opcionesDestino={optionsDestinoNacional}
              precioTonMxn={precioTonNacional} setPrecioTonMxn={setPrecioTonNacional}
              precioTotalMxn={precioMxnNacional} setPrecioTotalMxn={setPrecioMxnNacional}
            />
          )}

          {modalidad === 'terrestre' && (
            <VentaTerrestre
              cliente={cliente} setCliente={setCliente} opcionesCliente={optionsClientesTerrestre}
              destino={destino} setDestino={setDestino} opcionesDestino={optionsDestinoTerrestre}
              porcentajeFijacion={porcentajeFijacion} setPorcentajeFijacion={setPorcentajeFijacion}
              fixPrice={fixPrice} setFixPrice={setFixPrice}
              diasCobro={diasCobro} setDiasCobro={setDiasCobro}
              merma={merma} setMerma={setMerma}
              precioVenta={precioVenta}
              tcHoy={tcHoy} setTcHoy={setTcHoy} tcSeguro={tcSeguro}
              cargandoTC={cargandoTC} onActualizarTC={obtenerTipoDeCambio}
              rutaIntSelect={rutaIntSelect} setRutaIntSelect={setRutaIntSelect}
              cruceInt={cruceInt} setCruceInt={setCruceInt}
            />
          )}

          {modalidad === 'maritimo' && (
            <VentaMaritimo
              cliente={cliente} setCliente={setCliente} opcionesCliente={optionsClientesMaritimo}
              destino={destino} setDestino={setDestino} opcionesDestino={optionsDestinoMaritimo}
              origenEmbarque={origenEmbarque} setOrigenEmbarque={setOrigenEmbarque}
              opcionesOrigenEmbarque={[...new Set(TARIFARIO_DATA.map(r => r.o))].sort()}
              porcentajeFijacion={porcentajeFijacion} setPorcentajeFijacion={setPorcentajeFijacion}
              fixPrice={fixPrice} setFixPrice={setFixPrice}
              diasCobro={diasCobro} setDiasCobro={setDiasCobro}
              merma={merma} setMerma={setMerma}
              precioVenta={precioVenta}
              tcHoy={tcHoy} setTcHoy={setTcHoy} tcSeguro={tcSeguro}
              cargandoTC={cargandoTC} onActualizarTC={obtenerTipoDeCambio}
              capacidadCNT={capacidadCNT} setCapacidadCNT={setCapacidadCNT}
              tarifario={tarifario} setTarifario={setTarifario}
              maritimoRow={maritimoRow} setMaritimoRow={setMaritimoRow}
              cruceInt={cruceInt} setCruceInt={setCruceInt}
              sinTarifario={sinTarifario}
            />
          )}
```

Y agregar, junto a los demás derivados:

```jsx
  const opcionesMaterialActual = modalidad === 'terrestre' ? optionsMaterialTerrestre
                               : modalidad === 'maritimo'  ? optionsMaterialMaritimo
                               : optionsMaterialNacional;

  const opcionesProveedorActual = modalidad === 'terrestre' ? optionsProveedorTerrestre
                                : modalidad === 'maritimo'  ? optionsProveedorMaritimo
                                : optionsProveedorNacional;

  // Un proveedor marítimo "sin tarifario" aparece en el dropdown pero no tiene rutas.
  const sinTarifario = !!tarifario.proveedor
    && !TARIFARIO_DATA.some(r => r.p === tarifario.proveedor);
```

- [ ] **Step 5: Adaptar el efecto que resuelve la fila del tarifario y aduanaMex**

Reemplazar el `useEffect` que hoy busca `maritimoRow` y ajusta `aduanaMex` (`app.js:330-365` aprox., el que contiene el comentario "Por eso aduanaMex queda en 0") por:

```jsx
  // La fila del tarifario define el ocean freight y si el despacho ya viene incluido.
  useEffect(() => {
    if (modalidad !== 'maritimo' || !tarifario.equipo) {
      setMaritimoRow(null);
      return;
    }
    const row = TARIFARIO_DATA.find(r =>
      r.p === tarifario.proveedor && r.o === tarifario.origen &&
      r.pod === tarifario.destino && r.eq === tarifario.equipo &&
      (tarifario.tipo === '' || r.tipo === tarifario.tipo));
    setMaritimoRow(row || null);
    if (row) {
      const d = calcDespacho(row.pol);
      const tc = Number(tcHoy) || 0;
      // El cruce marítimo suma ocean freight + arrastre + despacho, en USD.
      setCruceInt(tc > 0 ? (row.of + (d.total / tc)).toFixed(2) : row.of.toString());
      // El despacho ya va dentro del cruce, así que aduanaMex no lo vuelve a cobrar.
      setAduanaMex("0");
    }
  }, [modalidad, tarifario, tcHoy]);

  // Fuera de marítimo con tarifario, el despacho se cobra aparte.
  useEffect(() => {
    if (modalidad !== 'maritimo' || sinTarifario || !tarifario.proveedor) setAduanaMex("2308");
  }, [modalidad, sinTarifario, tarifario.proveedor]);
```

- [ ] **Step 6: Ocultar el resultado en inventario y usar construirPayload al guardar**

El bloque `Tope Máximo de Compra` + semáforo se envuelve en `{tieneVenta && (...)}`. El input `¿A cuánto lo cerraste?` se elimina de ahí: el precio de compra ya se captura en `BloqueCompra`. En su lugar, para inventario:

```jsx
          {!tieneVenta && (
            <div className="text-center bg-black py-4 rounded-xl border border-green-700">
              <label className="block text-[10px] font-black uppercase tracking-widest mb-1 text-green-400">Costo de la Compra</label>
              <div className="text-3xl font-black text-white font-mono tracking-tight">
                {fMxn((Number(ppProv) || 0) * cargasTotales * capKg)}
              </div>
              <p className="text-[9px] text-gray-400 mt-1 uppercase font-bold tracking-wider">Sin venta ligada — no hay tope</p>
            </div>
          )}
```

Y `handleGuardarCotizacion` sustituye su objeto `payload` literal por:

```jsx
      const payload = construirPayload({
        credential: credToken,
        fecha: new Date().toLocaleDateString('es-MX'),
        usuario: usuario.email,
        modalidad, cliente, proveedores,
        material, destino, origenEmbarque,
        porcentajeFijacion, fixPrice, tcHoy,
        fleteNac, cruceInt, ppProv, notas,
        embalaje, negociacion,
        origenFlete: comprasOrigenFlete,
        destinoFlete: comprasDestinoFlete,
        calculo,
      });
```

- [ ] **Step 7: Subir el cache busting de todos los scripts**

En `deploy/index.html`, cambiar `?v=20260730b` por `?v=20260731a` en `data-options.js`, `data-fletes-nacionales.js`, `data-tarifario.js` y `app.js`. Los scripts nuevos ya lo traen.

- [ ] **Step 8: Verificar que las pruebas siguen pasando**

```bash
npm test
```

Esperado: PASS. Los módulos puros no se tocaron en esta tarea.

- [ ] **Step 9: Verificar la app a mano**

```bash
npx serve deploy
```

Con la consola del navegador abierta:

1. Cargar, iniciar sesión: cuatro chips visibles, `Terrestre` activo, bloque de compra y bloque de venta terrestre pintados. Sin errores en consola.
2. Capturar dos filas de proveedor y confirmar que el total KG cambia.
3. Cambiar a `Marítimo`: el bloque de compra conserva proveedores, material, embalaje y precio de compra.
4. Cambiar a `Inventario`: desaparece el bloque de venta, desaparece el tope y el semáforo, aparece "Costo de la Compra".
5. Buscar `activeTab`, `modoSimulador` y `compraDirecta` en `deploy/js/app.js`: cero resultados.

- [ ] **Step 10: Commit**

```bash
git add deploy/js/app.js deploy/index.html
git commit -m "feat(cotizador): captura unificada en una sola pantalla"
```

---

### Task 8: Verificación de paridad del payload y cierre

Confirma contra la hoja real que el registro que se escribe es el mismo de antes, y deja el grafo actualizado.

**Files:**
- Modify: ninguno salvo que la verificación encuentre un defecto.

**Interfaces:**
- Consumes: la app completa de Task 7.
- Produces: nada.

- [ ] **Step 1: Guardar una cotización por modalidad**

Con `npx serve deploy` corriendo, guardar una cotización en cada modalidad y anotar los valores capturados.

- [ ] **Step 2: Comparar contra la hoja**

Abrir la hoja de Google y verificar, para las cuatro filas nuevas:

| Modalidad capturada | Columna `modalidad` | `paraInventarios` | `intencionVenta` | `cliente` |
|---|---|---|---|---|
| Terrestre | `Terrestre` | falso | verdadero | el capturado |
| Marítimo | `Marítimo` | falso | verdadero | el capturado |
| Nacional | `Nacional` | falso | verdadero | el capturado |
| Inventario | `Compras` | verdadero | falso | vacío |

Ninguna columna debe quedar corrida ni vacía respecto a filas anteriores del mismo tipo.

- [ ] **Step 3: Verificar la paridad numérica del marítimo**

Capturar el mismo caso dos veces: proveedor **con** tarifario (por ejemplo `GWT` → `Mérida` → un POD → un equipo) y proveedor **sin** tarifario (`RAD`, con el ocean freight escrito a mano). Confirmar:

- Con tarifario: `cruceInt` incluye ocean freight + arrastre + despacho, y `aduanaMex` es `0`.
- Sin tarifario: `aduanaMex` vuelve a `2308` y el desglose no se pinta.
- El tope resultante coincide con el que daba la versión anterior para las mismas entradas (comparar contra el commit `af0d853` si hace falta: `git stash && git checkout af0d853 -- deploy/ && npx serve deploy`, y al terminar `git checkout HEAD -- deploy/ && git stash pop`).

- [ ] **Step 4: Actualizar el grafo**

```bash
graphify update .
```

- [ ] **Step 5: Commit**

```bash
git add graphify-out
git commit -m "chore(graphify): actualiza el grafo tras la captura unificada"
```

---

## Cobertura del spec

| Sección del spec | Tarea |
|---|---|
| §Modelo — `modalidad`, `tieneVenta` | 7 |
| §Modelo — estado que se elimina | 7 |
| §Layout | 7 |
| §1 Selector de modalidad | 7 |
| §2 Bloque compra | 3 |
| §2 Capacidad por carga | 1 (`KG_POR_CARGA`), 7 (`capKg`) |
| §3 Venta nacional | 4 |
| §3 Venta terrestre | 5 |
| §3 Venta marítimo + desglose + sin tarifario | 6, 7 (efecto de `aduanaMex`) |
| §4 Precio de compra unificado | 2 (`precioCompraMxn`), 3 (captura), 7 (resultado) |
| §5 Payload | 2 |
| §6 Estructura de archivos | 1, 2, 3, 4, 5, 6 |
| §Verificación | 7 (paso 9), 8 |
