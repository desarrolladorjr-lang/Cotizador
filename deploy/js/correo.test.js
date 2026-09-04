// El correo de aviso vive en Codigo.gs (Apps Script), no en un módulo: se carga
// evaluando el archivo en un sandbox y sacando las funciones puras. Se prueba
// aquí, junto al payload, porque el bug que motivó esto fue exactamente ese
// divorcio: el correo leía claves que construirPayload ya no mandaba y la tabla
// llegaba en blanco, sin que nada fallara.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { construirPayload } from './payload.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const CODIGO_GS = path.join(AQUI, '..', '..', 'Codigo.gs');

function cargarCodigoGs() {
  const fuente = fs.readFileSync(CODIGO_GS, 'utf8');
  const sandbox = { Logger: { log() {} } };
  new Function(
    'with (this) {' +
      fuente +
      '; this.construirCuerpoCorreo = construirCuerpoCorreo;' +
      '  this.asuntoCorreo = asuntoCorreo;' +
      '  this.correoValor = correoValor;' +
      '  this.CORREO_SECCIONES = CORREO_SECCIONES; }'
  ).call(sandbox);
  return sandbox;
}

const gs = cargarCodigoGs();

const CAPTURA_BASE = {
  credential: '',
  sesion: '',
  fecha: '17/08/2026',
  usuario: 'jj@sidellscrap.com',
  cliente: 'ACME',
  proveedores: [{ proveedor: 'JAVIER V.', cargas: 2 }],
  material: '6063 PAINTED',
  destino: 'LAREDO',
  origenEmbarque: 'MANZANILLO',
  porcentajeFijacion: 85,
  fixPrice: 1.05,
  tcHoy: 18.5,
  fleteNac: 1.2,
  cruceInt: 0.8,
  ppProv: 38.75,
  notas: 'sin novedad',
  diasCobro: 30,
  merma: 3,
  embalaje: 'GAYLORD',
  negociacion: 'RECOLECCION DIRECTA',
  origenFlete: 'MTY',
  destinoFlete: 'BMTY',
  calculo: {
    capKg: 24500,
    tcSeguro: 18.2,
    precioVenta: 52.4,
    precioTopeCompra: 42,
    utilidadNeta: 120000,
    status: 'good',
  },
};

const payloadDe = (modalidad, extra = {}) =>
  construirPayload({ ...CAPTURA_BASE, ...extra, modalidad });

/** Texto plano del correo, para aseverar sin pelearse con el HTML. */
const textoDe = (payload) =>
  gs.construirCuerpoCorreo(payload).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('correoValor', () => {
  it('da formato según el tipo', () => {
    expect(gs.correoValor(1898750, 'moneda')).toBe('$1,898,750.00');
    expect(gs.correoValor(3, 'porcentaje')).toBe('3.00 %');
    expect(gs.correoValor(49000, 'numero')).toBe('49,000');
    expect(gs.correoValor(2.5, 'numero')).toBe('2.50');
  });

  it('escapa el HTML del texto libre: las notas las escribe el usuario', () => {
    expect(gs.correoValor('<b>ojo</b>', 'texto')).toBe('&lt;b&gt;ojo&lt;/b&gt;');
  });

  it('no imprime NaN cuando un campo numérico trae texto', () => {
    expect(gs.correoValor('N/D', 'moneda')).toBe('N/D');
  });
});

describe('asuntoCorreo', () => {
  it('lleva modalidad, cliente y material', () => {
    expect(gs.asuntoCorreo(payloadDe('terrestre'))).toBe(
      'Nueva cotización - Terrestre | ACME | 6063 PAINTED'
    );
  });

  it('no deja separadores sueltos cuando falta un dato', () => {
    expect(gs.asuntoCorreo({ modalidad: 'Terrestre', cliente: '', material: '' })).toBe(
      'Nueva cotización - Terrestre'
    );
  });
});

describe('construirCuerpoCorreo', () => {
  // Este es el caso que llegaba en blanco: toda etiqueta del correo tiene que
  // corresponder a una clave que construirPayload realmente manda.
  it('trae los datos capturados, no la tabla vacía', () => {
    const texto = textoDe(payloadDe('terrestre'));
    expect(texto).toContain('ACME');
    expect(texto).toContain('JAVIER V.');
    expect(texto).toContain('6063 PAINTED');
    expect(texto).toContain('49,000');
    expect(texto).toContain('$38.75');
    expect(texto).toContain('$120,000.00');
    expect(texto).toContain('Aprobado');
  });

  it('cada clave del correo existe en el payload de todas las modalidades', () => {
    const claves = new Set();
    for (const seccion of gs.CORREO_SECCIONES) {
      for (const campo of seccion.campos) claves.add(campo[0]);
    }
    for (const modalidad of ['terrestre', 'maritimo', 'nacional', 'inventario']) {
      const payload = payloadDe(modalidad);
      for (const clave of claves) {
        expect(payload, `${clave} falta en el payload de ${modalidad}`).toHaveProperty(clave);
      }
    }
  });

  it('omite los costos que la modalidad no usa en vez de enseñarlos en $0.00', () => {
    expect(textoDe(payloadDe('terrestre'))).not.toContain('Oceans');
    expect(textoDe(payloadDe('maritimo'))).toContain('Oceans');
    expect(textoDe(payloadDe('nacional'))).not.toContain('Flete internacional');
  });

  it('en Inventarios no imprime venta: la hoja también la deja vacía', () => {
    const texto = textoDe(payloadDe('inventario'));
    expect(texto).not.toContain('Precio de venta');
    expect(texto).not.toContain('Utilidad neta');
    expect(texto).not.toContain('Precio tope de compra');
    // Lo que sí es de la compra se conserva.
    expect(texto).toContain('PPAC Proveedor');
    expect(texto).toContain('$38.75');
  });

  // Nacional vende en pesos: el cotizador ni pide fijación ni TC, pero el payload
  // arrastra lo que quedó de la modalidad anterior. Si el correo lo imprime,
  // alguien lo lee como si fuera el trato.
  it('en Nacional no imprime fijación, fix price ni TC: no existen en pesos', () => {
    const texto = textoDe(payloadDe('nacional', { precioKgMxn: 41 }));
    expect(texto).not.toContain('% Fijación');
    expect(texto).not.toContain('Fix Price');
    expect(texto).not.toContain('TC Banco');
    expect(texto).not.toContain('TC Seguro');
    expect(texto).not.toContain('Días de crédito');
    // La venta en pesos sí se imprime.
    expect(texto).toContain('Precio de venta');
  });

  it('en Terrestre sí imprime el TC y la fijación', () => {
    const texto = textoDe(payloadDe('terrestre'));
    expect(texto).toContain('TC Banco');
    expect(texto).toContain('Fix Price');
    expect(texto).toContain('% Fijación');
  });

  it('omite los campos vacíos en vez de dejar el renglón hueco', () => {
    expect(textoDe(payloadDe('terrestre', { notas: '' }))).not.toContain('Observaciones');
  });
});
