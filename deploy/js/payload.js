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
    if (e.modalidad === '') {
      throw new Error('construirPayload: modalidad vacía — la captura está incompleta, no hay hoja destino.');
    }
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
      // El cruce internacional es una fila del tarifario marítimo (o del flete
      // internacional terrestre); en Nacional/Inventario no tiene sentido y puede
      // quedar en el estado de una modalidad anterior si el usuario cambió de venta.
      cruceInt: (e.modalidad === 'nacional' || e.modalidad === 'inventario') ? 0 : num(e.cruceInt),
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
