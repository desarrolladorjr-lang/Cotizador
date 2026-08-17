// Mapea el modelo de captura al payload que espera Codigo.gs. Función pura.
// Los nombres y tipos de los campos son contrato con la hoja: no cambiarlos.
(function (root) {
  const ETIQUETA_MODALIDAD = {
    terrestre: 'Terrestre',
    maritimo: 'Marítimo',
    nacional: 'Nacional',
    inventario: 'Inventarios',
  };

  // Bodega Monterrey: destinatario de todo lo que se compra para inventario.
  const CLIENTE_INVENTARIOS = 'BMTY';

  const ETIQUETA_STATUS = {
    good: 'Aprobado',
    warning: 'Apretado',
    bad: 'Pérdida',
    '': '',
  };

  function construirPayload(e) {
    if (e.modalidad === '') {
      throw new Error('construirPayload: modalidad vacía — la captura está incompleta, no hay hoja destino.');
    }
    const num = v => Number(v) || 0;
    const tieneVenta = e.modalidad !== 'inventario';
    const c = e.calculo;

    const cargas = e.proveedores.reduce((sum, r) => sum + num(r.cargas), 0);
    const kgTotales = cargas * c.capKg;

    const proveedor = e.proveedores
      .map(r => r.proveedor || (e.opcionesProveedor && e.opcionesProveedor[0]) || '')
      .filter(Boolean)
      .join(', ');

    return {
      credential: e.credential,
      fecha: e.fecha,
      usuario: e.usuario,
      modalidad: ETIQUETA_MODALIDAD[e.modalidad],
      // En Inventarios no hay comprador: el material entra a bodega propia, asi que
      // la columna CLIENTE va marcada con BMTY en vez de quedar en blanco.
      cliente: tieneVenta ? e.cliente : CLIENTE_INVENTARIOS,
      proveedor,
      cargas,
      kgOc: Number(kgTotales.toFixed(2)),
      material: e.material,
      // En Compras no hay destino de venta: la hoja guarda el destino del flete.
      destino: e.modalidad === 'inventario' ? (e.destinoFlete || '') : e.destino,
      origenEmbarque: e.modalidad === 'maritimo' ? e.origenEmbarque : '',
      porcentajeFijacion: num(e.porcentajeFijacion),
      fixPrice: num(e.fixPrice),
      precioVenta: c.precioVenta,
      tcHoy: num(e.tcHoy),
      tcSeguro: Number(c.tcSeguro.toFixed(2)),
      diasCredito: tieneVenta && e.modalidad !== 'nacional' ? num(e.diasCobro) : 0,
      merma: num(e.merma),
      fleteNac: num(e.fleteNac),
      // Un solo campo de captura (cruceInt) alimenta dos columnas de la hoja:
      // en terrestre es el flete internacional, en marítimo es el paquete
      // ocean freight + arrastre + despacho. En Nacional/Inventario no aplica y
      // puede traer un valor viejo si el usuario cambió de modalidad.
      fleteInt: e.modalidad === 'terrestre' ? num(e.cruceInt) : 0,
      oceans: e.modalidad === 'maritimo' ? num(e.cruceInt) : 0,
      precioTopeCompra: Number(c.precioTopeCompra.toFixed(2)),
      ppProv: Number(num(e.ppProv).toFixed(2)),
      status: ETIQUETA_STATUS[c.status] ?? 'Pérdida',
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
