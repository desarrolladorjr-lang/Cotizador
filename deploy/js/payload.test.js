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
