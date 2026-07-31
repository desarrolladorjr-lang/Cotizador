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
