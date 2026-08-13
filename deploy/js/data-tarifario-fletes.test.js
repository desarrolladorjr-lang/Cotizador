import { describe, it, expect } from 'vitest';
import { resolverTarifaFlete } from './data-tarifario-fletes.js';

describe('Nuevas Reglas de Negociación de Flete', () => {
  it('1. Recoleccion directa: Origen -> Destino (Proveedor -> Cliente)', () => {
    const res = resolverTarifaFlete({
      clienteOrigen: 'MEINSUR',
      clienteDestino: 'BMTY',
      negociacion: 'RECOLECCION DIRECTA'
    });
    expect(res?.costo).toBe(61480);
    expect(res?.moneda).toBe('MXP');
  });

  it('2. Recoleccion Mty: Origen -> Mty (Proveedor -> Bodega Mty Escobedo)', () => {
    const res = resolverTarifaFlete({
      clienteOrigen: 'MEINSUR',
      negociacion: 'RECOLECCION MTY'
    });
    expect(res?.costo).toBe(61480);
    expect(res?.moneda).toBe('MXP');
  });

  it('3. Directo entrega: Origen -> Destino con flete CERO ($0)', () => {
    const res = resolverTarifaFlete({
      clienteOrigen: 'MEINSUR',
      clienteDestino: 'ARZYZ NL',
      negociacion: 'DIRECTO ENTREGA'
    });
    expect(res?.costo).toBe(0);
  });

  it('4. BMTY Entrega: Origen Mty -> Destino (Bodega Mty -> Cliente)', () => {
    const res = resolverTarifaFlete({
      clienteOrigen: 'BMTY',
      clienteDestino: 'ALUMINUM DYNAMICS MS',
      negociacion: 'BMTY ENTREGA'
    });
    expect(res?.costo).toBe(3150);
    expect(res?.moneda).toBe('USD');
  });

  it('5. BMTY Destino: Mty -> Destino (Bodega Mty -> Cliente)', () => {
    const res = resolverTarifaFlete({
      clienteOrigen: 'BMTY',
      clienteDestino: 'ALUMINUM DYNAMICS MS',
      negociacion: 'BMTY DESTINO'
    });
    expect(res?.costo).toBe(3150);
    expect(res?.moneda).toBe('USD');
  });

  it('6. Cliente SCHUPAN (Google Sheet): BMTY -> SCHUPAN', () => {
    const res = resolverTarifaFlete({
      clienteOrigen: 'BMTY',
      clienteDestino: 'SCHUPAN MI',
      negociacion: 'BMTY DESTINO'
    });
    expect(res?.costo).toBe(5950);
    expect(res?.moneda).toBe('USD');
  });

  it('7. Cliente FAGOR SLP (Google Sheet): FAGOR SLP -> JRG SLP', () => {
    const res = resolverTarifaFlete({
      clienteOrigen: 'FAGOR SLP',
      clienteDestino: 'JRG SLP',
      negociacion: 'RECOLECCION DIRECTA'
    });
    expect(res?.costo).toBe(6380);
    expect(res?.moneda).toBe('MXP');
  });

  it('8. Cliente NIKKEI (Google Sheet): BMTY -> NIKKEI', () => {
    const res = resolverTarifaFlete({
      clienteOrigen: 'BMTY',
      clienteDestino: 'NIKKEI',
      negociacion: 'BMTY DESTINO'
    });
    expect(res?.costo).toBe(30160);
    expect(res?.moneda).toBe('MXP');
  });
});
